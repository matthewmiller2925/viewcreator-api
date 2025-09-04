import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_users_email', { unique: true })
  @Column({ type: 'citext', unique: true })
  email!: string;

  @Column({ type: 'text' })
  passwordHash!: string;

  @Index('idx_users_stripe_customer_id', { unique: true })
  @Column({ type: 'text', nullable: true, unique: true })
  stripeCustomerId?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
