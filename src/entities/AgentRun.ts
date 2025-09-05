import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Agent } from './Agent';
import { User } from './User';
import { AgentRunStatusEnum } from '../enums';
import { AgentRunStep } from './AgentRunStep';

@Entity({ name: 'agent_runs' })
export class AgentRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Agent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agentId' })
  agent!: Agent;

  @Index('idx_agent_runs_agent_id')
  @Column({ type: 'uuid' })
  agentId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Index('idx_agent_runs_user_id')
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'text', default: AgentRunStatusEnum.QUEUED })
  status!: AgentRunStatusEnum;

  @Column({ type: 'jsonb', nullable: true })
  parameters?: any;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string | null;

  @Column({ type: 'int', default: 0, nullable: true })
  creditsUsed?: number;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt?: Date | null;

  @OneToMany(() => AgentRunStep, (step) => step.agentRun)
  steps?: AgentRunStep[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}


