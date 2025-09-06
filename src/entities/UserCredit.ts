import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User';

@Entity({ name: 'user_credits' })
export class UserCredit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Index('idx_user_credits_user_id', { unique: true })
  @Column({ type: 'uuid', unique: true })
  userId!: string;

  @Column({ type: 'int', default: 100 })
  balance!: number;

  @Column({ type: 'int', default: 0 })
  totalEarned!: number;

  @Column({ type: 'int', default: 0 })
  totalSpent!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

