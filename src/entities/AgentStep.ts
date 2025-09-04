import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Agent } from './Agent';

@Entity({ name: 'agent_steps' })
export class AgentStep {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Agent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agentId' })
  agent!: Agent;

  @Index('idx_agent_steps_agent_id')
  @Column({ type: 'uuid' })
  agentId!: string;

  @Column({ type: 'int', default: 0 })
  stepIndex!: number;

  @Column({ type: 'text' })
  instructions!: string;

  @Column({ type: 'jsonb', nullable: true })
  images?: any;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}


