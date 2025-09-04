import { Body, Controller, Param, Post } from '@nestjs/common';
import { AgentRunsService } from './agent-runs.service';

@Controller('agent-runs')
export class AgentRunsController {
  constructor(private readonly agentRunsService: AgentRunsService) {}

  @Post(':agentId/queue')
  async queueRun(@Param('agentId') agentId: string, @Body() body: { userId: string; parameters?: unknown }) {
    return this.agentRunsService.queueRun(agentId, body.userId, body.parameters);
  }
}


