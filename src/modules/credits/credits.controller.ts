import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { CreditsService } from './credits.service';
import { CreditTransactionTypeEnum } from '../../enums';

@Controller('credits')
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  @Get('balance/:userId')
  async getUserCredits(@Param('userId') userId: string) {
    return this.creditsService.getUserCredits(userId);
  }

  @Get('transactions/:userId')
  async getTransactionHistory(
    @Param('userId') userId: string,
    @Query('limit') limit?: string
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.creditsService.getTransactionHistory(userId, limitNum);
  }

  @Post('add')
  async addCredits(@Body() body: { userId: string; amount: number; description: string; type?: CreditTransactionTypeEnum }) {
    return this.creditsService.addCredits(
      body.userId, 
      body.amount, 
      body.description, 
      body.type || CreditTransactionTypeEnum.PURCHASE
    );
  }

  @Get('costs')
  async getCostInfo() {
    return {
      imageGeneration: {
        perImage: 10,
        description: '10 credits per generated image'
      },
      agentRun: {
        perStep: 5,
        perImageStep: 15, // 5 base + 10 for image
        description: '5 credits per step, +10 additional for image generation steps'
      }
    };
  }
}
