import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { SubscriptionStatusEnum } from '../enums';
import { User } from './User';

@Entity({ name: 'subscriptions' })
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Index('idx_subscriptions_user_id')
  @Column({ type: 'uuid' })
  userId!: string;

  @Index('idx_subscriptions_stripe_subscription_id', { unique: true })
  @Column({ type: 'text', nullable: true, unique: true })
  stripeSubscriptionId?: string | null;

  @Column({ type: 'text', nullable: true })
  stripePriceId?: string | null;

  @Column({ type: 'text', nullable: true })
  stripeProductId?: string | null;

  @Column({ type: 'text', default: SubscriptionStatusEnum.INCOMPLETE })
  status!: SubscriptionStatusEnum;

  @Column({ type: 'timestamptz', nullable: true })
  currentPeriodStart?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  currentPeriodEnd?: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}


