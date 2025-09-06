import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserCredit } from '../../entities/UserCredit';
import { CreditTransaction } from '../../entities/CreditTransaction';
import { CreditsService } from './credits.service';
import { CreditsController } from './credits.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserCredit, CreditTransaction])],
  providers: [CreditsService],
  controllers: [CreditsController],
  exports: [CreditsService],
})
export class CreditsModule {}

