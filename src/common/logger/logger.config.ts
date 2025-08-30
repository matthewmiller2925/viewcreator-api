import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import { WinstonModuleOptions } from 'nest-winston';

export const createWinstonConfig = (configService: ConfigService): WinstonModuleOptions => {
  const logLevel = configService.get<string>('LOG_LEVEL', 'info');
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const appName = configService.get<string>('APP_NAME', 'viewcreator-api');

  // Custom format for structured logging
  const customFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, context, trace, ...meta }) => {
      const logEntry: Record<string, any> = {
        timestamp,
        level: level.toUpperCase(),
        service: appName,
        context: context || 'Application',
        message,
      };
      
      if (trace) {
        logEntry.trace = trace;
      }
      
      if (Object.keys(meta).length > 0) {
        logEntry.meta = meta;
      }
      
      return JSON.stringify(logEntry);
    })
  );

  // Console format for development
  const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
      const contextStr = context ? `[${context}]` : '';
      const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
      return `${timestamp} ${level} ${contextStr} ${message}${metaStr}`;
    })
  );

  const transports: winston.transport[] = [];

  // Console transport
  if (nodeEnv === 'development') {
    transports.push(
      new winston.transports.Console({
        level: logLevel,
        format: consoleFormat,
      })
    );
  } else {
    transports.push(
      new winston.transports.Console({
        level: logLevel,
        format: customFormat,
      })
    );
  }

  // File transports for production
  if (nodeEnv === 'production') {
    // Error logs
    transports.push(
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: customFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 10,
      })
    );

    // Combined logs
    transports.push(
      new winston.transports.File({
        filename: 'logs/combined.log',
        format: customFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 10,
      })
    );

    // HTTP access logs
    transports.push(
      new winston.transports.File({
        filename: 'logs/access.log',
        level: 'http',
        format: customFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      })
    );
  }

  return {
    level: logLevel,
    format: customFormat,
    transports,
    exitOnError: false,
    // Silent logging during tests
    silent: nodeEnv === 'test',
  };
};
