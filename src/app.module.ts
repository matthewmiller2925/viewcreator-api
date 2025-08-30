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
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from './entities/User';
import { Template } from './entities/Template';
import { UsersModule } from './modules/users/users.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('PG_HOST'),
        port: parseInt(configService.get<string>('PG_PORT') || '5432', 10),
        username: configService.get<string>('PG_USER'),
        password: configService.get<string>('PG_PASSWORD'),
        database: configService.get<string>('PG_DATABASE'),
        entities: [User, Template],
        synchronize: false,
        autoLoadEntities: false,
      }),
    }),
    LoggerModule,
    ImageGenerationModule,
    ImageVariationModule,
    ImageEditingModule,
    CommonModule,
    AuthModule,
    UsersModule,
    TemplatesModule,
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
