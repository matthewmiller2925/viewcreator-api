import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from '../../entities/Subscription';
import { User } from '../../entities/User';
import { BillingService } from './billing.service';
import { BillingController, WebhooksController } from './billing.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, Subscription])],
  providers: [BillingService],
  controllers: [BillingController, WebhooksController],
  exports: [BillingService],
})
export class BillingModule {}


