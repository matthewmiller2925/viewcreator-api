import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppModule } from './app.module';
import { CustomLoggerService } from './common/logger';
import * as cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Use Winston logger
  const logger = await app.resolve(CustomLoggerService);
  logger.setContext('Bootstrap');
  app.useLogger(logger);
  
  // Enable CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  
  // Enable validation with detailed error messages
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => {
      // Log detailed validation errors to console for debugging
      console.error('=== VALIDATION FAILED ===');
      errors.forEach((error, index) => {
        console.error(`Error ${index + 1}:`, {
          property: error.property,
          value: typeof error.value === 'string' && error.value.length > 100 
            ? error.value.substring(0, 100) + '...' 
            : error.value,
          constraints: error.constraints,
          children: error.children?.map(child => ({
            property: child.property,
            constraints: child.constraints
          }))
        });
      });
      console.error('========================');
      
      // Create a detailed error message
      const errorMessage = `Validation failed: ${errors.map(e => 
        `${e.property}: ${Object.values(e.constraints || {}).join(', ')}`
      ).join('; ')}`;
      
      return new ValidationPipe().createExceptionFactory()(errors);
    },
  }));

  // Cookie parser
  app.use(cookieParser());
  
  // Increase payload size limit for image editing (10MB)
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));
  
  // Set global prefix
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  // Raw body for Stripe webhooks - must target the prefixed route
  app.use(`/${globalPrefix}/webhooks/stripe`, express.raw({ type: 'application/json' }));
  
  const port = process.env.PORT || 3001;
  const appName = process.env.APP_NAME || 'viewcreator-api';
  
  await app.listen(port);
  
  logger.log(`🚀 ${appName} is running on: http://localhost:${port}/api`);
  logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.log(`Log Level: ${process.env.LOG_LEVEL || 'info'}`);
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
