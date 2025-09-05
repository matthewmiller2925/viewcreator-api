import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agent } from '../../entities/Agent';
import { AgentStep } from '../../entities/AgentStep';
import { AgentRun } from '../../entities/AgentRun';
import { AgentRunStep } from '../../entities/AgentRunStep';
import { Template } from '../../entities/Template';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { FalAiModule } from '../fal-ai/fal-ai.module';
import { CreditsModule } from '../credits/credits.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Agent, AgentStep, AgentRun, AgentRunStep, Template]),
    FalAiModule,
    CreditsModule
  ],
  providers: [AgentsService],
  controllers: [AgentsController],
  exports: [AgentsService],
})
export class AgentsModule {}


