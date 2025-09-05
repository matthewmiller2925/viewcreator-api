import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { Agent } from '../../entities/Agent';
import { AgentStep } from '../../entities/AgentStep';

@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post()
  async createAgent(@Body() body: any) {
    const { steps, ...agentData } = body ?? {};
    const created = await this.agentsService.createAgent(agentData as Partial<Agent>);
    if (Array.isArray(steps) && steps.length > 0) {
      const normalizedSteps: Array<Partial<AgentStep>> = steps.map((s: any, index: number) => ({
        agentId: created.id,
        stepIndex: s.stepIndex ?? index,
        instructions: s.instructions ?? s.prompt ?? '',
        images: s.images ?? null,
      })).filter((s) => (s.instructions || '').trim().length > 0);
      if (normalizedSteps.length > 0) {
        await this.agentsService.upsertSteps(created.id, normalizedSteps);
      }
    }
    return created;
  }

  @Put(':id')
  async updateAgent(@Param('id') id: string, @Body() body: Partial<Agent>) {
    return this.agentsService.updateAgent(id, body);
  }

  @Put(':id/steps')
  async upsertSteps(@Param('id') id: string, @Body() body: { steps: Array<Partial<AgentStep>> }) {
    return this.agentsService.upsertSteps(id, body.steps ?? []);
  }

  @Get(':id')
  async getAgent(@Param('id') id: string) {
    return this.agentsService.findAgentById(id);
  }

  @Get(':id/edit')
  async getAgentForEdit(@Param('id') id: string) {
    return this.agentsService.findAgentWithSteps(id);
  }

  @Get()
  async listAgents(@Query('userId') userId: string) {
    return this.agentsService.listAgentsByUser(userId);
  }

  @Post(':id/run')
  async runAgent(@Param('id') id: string, @Body() body: { userId: string }) {
    return this.agentsService.runAgent(id, body.userId);
  }

  @Get('runs/:runId/status')
  async getRunStatus(@Param('runId') runId: string) {
    return this.agentsService.getRunStatus(runId);
  }

  @Get('runs/user/:userId')
  async getUserAgentRuns(@Param('userId') userId: string) {
    return this.agentsService.getUserAgentRuns(userId);
  }
}


