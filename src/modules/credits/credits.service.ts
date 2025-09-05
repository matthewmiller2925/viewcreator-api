import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { UserCredit } from '../../entities/UserCredit';
import { CreditTransaction } from '../../entities/CreditTransaction';
import { CreditTransactionTypeEnum } from '../../enums';

@Injectable()
export class CreditsService {
  constructor(
    @InjectRepository(UserCredit)
    private readonly userCreditsRepository: Repository<UserCredit>,
    @InjectRepository(CreditTransaction)
    private readonly transactionsRepository: Repository<CreditTransaction>,
    private readonly dataSource: DataSource,
  ) {}

  // Credit cost calculations
  private calculateImageGenerationCost(count: number = 1): number {
    return count * 10; // 10 credits per image
  }

  private calculateAgentRunCost(stepCount: number, imageSteps: number): number {
    const baseStepCost = stepCount * 5; // 5 credits per step
    const imageCost = imageSteps * 10; // Additional 10 credits per image step
    return baseStepCost + imageCost;
  }

  async ensureUserCredits(userId: string): Promise<UserCredit> {
    let userCredit = await this.userCreditsRepository.findOne({ where: { userId } });
    
    if (!userCredit) {
      // Create initial credit balance for new users
      userCredit = this.userCreditsRepository.create({
        userId,
        balance: 100, // Starting credits
        totalEarned: 100,
        totalSpent: 0,
      });
      userCredit = await this.userCreditsRepository.save(userCredit);

      // Record initial credit transaction
      await this.recordTransaction(
        userId,
        CreditTransactionTypeEnum.BONUS,
        100,
        userCredit.balance,
        'Welcome bonus - 100 free credits',
        null,
        null
      );
    }

    return userCredit;
  }

  async getUserCredits(userId: string): Promise<UserCredit> {
    return this.ensureUserCredits(userId);
  }

  async checkSufficientCredits(userId: string, requiredCredits: number): Promise<boolean> {
    const userCredit = await this.ensureUserCredits(userId);
    return userCredit.balance >= requiredCredits;
  }

  async deductCredits(
    userId: string, 
    amount: number, 
    description: string, 
    relatedJobId?: string,
    relatedJobType?: string
  ): Promise<UserCredit> {
    return this.dataSource.transaction(async (manager) => {
      // Lock the user credit record for update
      const userCredit = await manager.findOne(UserCredit, { 
        where: { userId },
        lock: { mode: 'pessimistic_write' }
      });

      if (!userCredit) {
        throw new Error('User credits not found');
      }

      if (userCredit.balance < amount) {
        throw new Error('Insufficient credits');
      }

      // Update balance
      userCredit.balance -= amount;
      userCredit.totalSpent += amount;
      const updatedCredit = await manager.save(UserCredit, userCredit);

      // Record transaction
      await manager.save(CreditTransaction, {
        userId,
        type: CreditTransactionTypeEnum.USAGE,
        amount: -amount,
        balanceAfter: updatedCredit.balance,
        description,
        relatedJobId,
        relatedJobType,
      });

      return updatedCredit;
    });
  }

  async addCredits(
    userId: string, 
    amount: number, 
    description: string,
    type: CreditTransactionTypeEnum = CreditTransactionTypeEnum.PURCHASE
  ): Promise<UserCredit> {
    return this.dataSource.transaction(async (manager) => {
      const userCredit = await manager.findOne(UserCredit, { 
        where: { userId },
        lock: { mode: 'pessimistic_write' }
      });

      if (!userCredit) {
        throw new Error('User credits not found');
      }

      // Update balance
      userCredit.balance += amount;
      userCredit.totalEarned += amount;
      const updatedCredit = await manager.save(UserCredit, userCredit);

      // Record transaction
      await manager.save(CreditTransaction, {
        userId,
        type,
        amount,
        balanceAfter: updatedCredit.balance,
        description,
      });

      return updatedCredit;
    });
  }

  async getTransactionHistory(userId: string, limit: number = 50): Promise<CreditTransaction[]> {
    return this.transactionsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  private async recordTransaction(
    userId: string,
    type: CreditTransactionTypeEnum,
    amount: number,
    balanceAfter: number,
    description: string,
    relatedJobId: string | null,
    relatedJobType: string | null
  ): Promise<CreditTransaction> {
    const transaction = this.transactionsRepository.create({
      userId,
      type,
      amount,
      balanceAfter,
      description,
      relatedJobId,
      relatedJobType,
    });
    return this.transactionsRepository.save(transaction);
  }

  // Cost calculation methods
  getImageGenerationCost(count: number = 1): number {
    return this.calculateImageGenerationCost(count);
  }

  getAgentRunCost(stepCount: number, imageSteps: number): number {
    return this.calculateAgentRunCost(stepCount, imageSteps);
  }
}
