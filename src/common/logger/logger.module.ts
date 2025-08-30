import { Module, Global } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { ConfigService } from '@nestjs/config';
import { CustomLoggerService } from './custom-logger.service';
import { createWinstonConfig } from './logger.config';

@Global()
@Module({
  imports: [
    WinstonModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => createWinstonConfig(configService),
    }),
  ],
  providers: [CustomLoggerService],
  exports: [CustomLoggerService, WinstonModule],
})
export class LoggerModule {}
