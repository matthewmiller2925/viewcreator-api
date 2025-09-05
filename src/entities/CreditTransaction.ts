import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User';
import { CreditTransactionTypeEnum } from '../enums';

@Entity({ name: 'credit_transactions' })
export class CreditTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Index('idx_credit_transactions_user_id')
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'text' })
  type!: CreditTransactionTypeEnum;

  @Column({ type: 'int' })
  amount!: number;

  @Column({ type: 'int' })
  balanceAfter!: number;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'text', nullable: true })
  relatedJobId?: string | null;

  @Column({ type: 'text', nullable: true })
  relatedJobType?: string | null; // 'template' | 'agent' | 'fal-ai'

  @Column({ type: 'jsonb', nullable: true })
  metadata?: any;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
