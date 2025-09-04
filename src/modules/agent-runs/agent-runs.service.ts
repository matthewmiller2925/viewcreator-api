import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentRun } from '../../entities/AgentRun';
import { AgentRunStep } from '../../entities/AgentRunStep';
import { Agent } from '../../entities/Agent';
import { AgentStep } from '../../entities/AgentStep';
import { AgentRunStatusEnum, AgentRunStepStatusEnum } from '../../enums';

@Injectable()
export class AgentRunsService {
  constructor(
    @InjectRepository(AgentRun)
    private readonly agentRunRepository: Repository<AgentRun>,
    @InjectRepository(AgentRunStep)
    private readonly agentRunStepRepository: Repository<AgentRunStep>,
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
    @InjectRepository(AgentStep)
    private readonly agentStepRepository: Repository<AgentStep>,
  ) {}

  async queueRun(agentId: string, userId: string, parameters?: unknown): Promise<AgentRun> {
    const run = this.agentRunRepository.create({
      agentId,
      userId,
      status: AgentRunStatusEnum.QUEUED,
      parameters: parameters ?? null,
      startedAt: null,
      finishedAt: null,
    });
    const saved = await this.agentRunRepository.save(run);
    const steps = await this.agentStepRepository.find({ where: { agentId }, order: { stepIndex: 'ASC' } });
    const runSteps = steps.map((s, idx) => this.agentRunStepRepository.create({
      agentRunId: saved.id,
      agentStepId: s.id,
      stepIndex: idx,
      status: AgentRunStepStatusEnum.PENDING,
    }));
    await this.agentRunStepRepository.save(runSteps);
    return saved;
  }

  async markRunStarted(runId: string): Promise<void> {
    await this.agentRunRepository.update({ id: runId }, { status: AgentRunStatusEnum.RUNNING, startedAt: new Date() });
  }

  async markRunFinished(runId: string, succeeded: boolean, errorMessage?: string | null): Promise<void> {
    await this.agentRunRepository.update({ id: runId }, {
      status: succeeded ? AgentRunStatusEnum.SUCCEEDED : AgentRunStatusEnum.FAILED,
      finishedAt: new Date(),
      errorMessage: errorMessage ?? null,
    });
  }

  async updateRunStep(
    runStepId: string,
    data: Partial<Pick<AgentRunStep, 'status' | 'output' | 'artifacts' | 'errorMessage' | 'startedAt' | 'finishedAt'>>,
  ): Promise<void> {
    const { artifacts, ...rest } = data as any;
    await this.agentRunStepRepository.update({ id: runStepId }, { ...rest, artifacts: artifacts as any });
  }
}


