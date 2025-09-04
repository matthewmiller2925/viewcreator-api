import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from './User';
import { Template } from './Template';
import { AgentStep } from './AgentStep';

@Entity({ name: 'agents' })
export class Agent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Index('idx_agents_user_id')
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => Template, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'templateId' })
  template?: Template | null;

  @Index('idx_agents_template_id')
  @Column({ type: 'uuid', nullable: true })
  templateId?: string | null;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  instructions!: string;

  @Column({ type: 'text', nullable: true })
  profileImageUrl?: string | null;

  @OneToMany(() => AgentStep, (step) => step.agent)
  steps?: AgentStep[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}


