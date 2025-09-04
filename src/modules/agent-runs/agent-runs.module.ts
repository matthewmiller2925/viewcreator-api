import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentRun } from '../../entities/AgentRun';
import { AgentRunStep } from '../../entities/AgentRunStep';
import { Agent } from '../../entities/Agent';
import { AgentStep } from '../../entities/AgentStep';
import { AgentRunsService } from './agent-runs.service';
import { AgentRunsController } from './agent-runs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AgentRun, AgentRunStep, Agent, AgentStep])],
  providers: [AgentRunsService],
  controllers: [AgentRunsController],
  exports: [AgentRunsService],
})
export class AgentRunsModule {}


