import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Template } from './Template';
import { User } from './User';
import { TemplateJobStatusEnum } from '../enums';

@Entity({ name: 'template_jobs' })
export class TemplateJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Template, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'templateId' })
  template!: Template;

  @Index('idx_template_jobs_template_id')
  @Column({ type: 'uuid' })
  templateId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Index('idx_template_jobs_user_id')
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'text', default: TemplateJobStatusEnum.QUEUED })
  status!: TemplateJobStatusEnum;

  @Column({ type: 'jsonb', nullable: true })
  parameters?: any;

  @Column({ type: 'jsonb', nullable: true })
  results?: any;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string | null;

  @Column({ type: 'int', default: 0 })
  creditsUsed!: number;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt?: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

