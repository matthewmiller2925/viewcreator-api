import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { AgentRunStepStatusEnum } from '../enums';
import { AgentRun } from './AgentRun';
import { AgentStep } from './AgentStep';

@Entity({ name: 'agent_run_steps' })
export class AgentRunStep {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => AgentRun, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agentRunId' })
  agentRun!: AgentRun;

  @Index('idx_agent_run_steps_agent_run_id')
  @Column({ type: 'uuid' })
  agentRunId!: string;

  @ManyToOne(() => AgentStep, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'agentStepId' })
  agentStep?: AgentStep | null;

  @Index('idx_agent_run_steps_agent_step_id')
  @Column({ type: 'uuid', nullable: true })
  agentStepId?: string | null;

  @Column({ type: 'int', default: 0 })
  stepIndex!: number;

  @Column({ type: 'text', default: AgentRunStepStatusEnum.PENDING })
  status!: AgentRunStepStatusEnum;

  @Column({ type: 'text', nullable: true })
  output?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  artifacts?: any;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt?: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}


