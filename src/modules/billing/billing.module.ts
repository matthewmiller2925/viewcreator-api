import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from '../../entities/Subscription';
import { User } from '../../entities/User';
import { CreditTransaction } from '../../entities/CreditTransaction';
import { BillingService } from './billing.service';
import { BillingController, WebhooksController } from './billing.controller';
import { CreditsModule } from '../credits/credits.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Subscription, CreditTransaction]), CreditsModule],
  providers: [BillingService],
  controllers: [BillingController, WebhooksController],
  exports: [BillingService],
})
export class BillingModule {}


