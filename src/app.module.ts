import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ImageGenerationModule } from './modules/image-generation/image-generation.module';
import { ImageVariationModule } from './modules/image-variation/image-variation.module';
import { ImageEditingModule } from './modules/image-editing/image-editing.module';
import { CommonModule } from './modules/common/common.module';
import { LoggerModule, HttpLoggingInterceptor } from './common/logger';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    LoggerModule,
    ImageGenerationModule,
    ImageVariationModule,
    ImageEditingModule,
    CommonModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpLoggingInterceptor,
    },
  ],
})
export class AppModule {}
