import { Injectable, LoggerService, Scope } from '@nestjs/common';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Inject } from '@nestjs/common';

@Injectable({ scope: Scope.TRANSIENT })
export class CustomLoggerService implements LoggerService {
  private context?: string;
  private static readonly defaultSensitiveKeys: ReadonlySet<string> = new Set([
    'password',
    'passwordHash',
    'authorization',
    'accessToken',
    'refreshToken',
    'token',
    'client_secret',
    'apiKey',
    'x-api-key',
  ]);

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  setContext(context: string) {
    this.context = context;
  }

  log(message: any, contextOrMeta?: string | Record<string, any>, context?: string) {
    if (typeof contextOrMeta === 'object' && contextOrMeta !== null) {
      this.logger.info(message, { context: context || this.context, ...contextOrMeta });
    } else {
      this.logger.info(message, { context: contextOrMeta || this.context });
    }
  }

  error(message: any, trace?: string, context?: string) {
    this.logger.error(message, {
      context: context || this.context,
      ...(trace && { trace }),
    });
  }

  warn(message: any, contextOrMeta?: string | Record<string, any>, context?: string) {
    if (typeof contextOrMeta === 'object' && contextOrMeta !== null) {
      this.logger.warn(message, { context: context || this.context, ...contextOrMeta });
    } else {
      this.logger.warn(message, { context: contextOrMeta || this.context });
    }
  }

  debug(message: any, contextOrMeta?: string | Record<string, any>, context?: string) {
    if (typeof contextOrMeta === 'object' && contextOrMeta !== null) {
      this.logger.debug(message, { context: context || this.context, ...contextOrMeta });
    } else {
      this.logger.debug(message, { context: contextOrMeta || this.context });
    }
  }

  verbose(message: any, contextOrMeta?: string | Record<string, any>, context?: string) {
    if (typeof contextOrMeta === 'object' && contextOrMeta !== null) {
      this.logger.verbose(message, { context: context || this.context, ...contextOrMeta });
    } else {
      this.logger.verbose(message, { context: contextOrMeta || this.context });
    }
  }

  // Additional utility methods for structured logging
  redact<T = any>(value: T, extraSensitiveKeys: string[] = []): T {
    const keysToRedact = new Set<string>([...CustomLoggerService.defaultSensitiveKeys, ...extraSensitiveKeys]);
    const seen = new WeakSet();

    const redactInner = (input: any): any => {
      if (input === null || input === undefined) return input;
      if (typeof input !== 'object') return input;
      if (seen.has(input)) return '[Circular]';
      seen.add(input);

      if (Array.isArray(input)) {
        return input.map((item) => redactInner(item));
      }

      const output: Record<string, any> = {};
      for (const [key, val] of Object.entries(input)) {
        if (keysToRedact.has(key)) {
          output[key] = '[REDACTED]';
        } else if (typeof val === 'object' && val !== null) {
          output[key] = redactInner(val);
        } else {
          output[key] = val;
        }
      }
      return output;
    };

    return redactInner(value);
  }

  logRequest(method: string, url: string, statusCode: number, responseTime: number, userId?: string) {
    this.logger.http('HTTP Request', {
      context: 'HTTP',
      method,
      url,
      statusCode,
      responseTime: `${responseTime}ms`,
      ...(userId && { userId }),
    });
  }

  logApiCall(service: string, endpoint: string, duration: number, success: boolean, error?: string) {
    const level = success ? 'info' : 'error';
    this.logger.log(level, 'External API Call', {
      context: 'API_CALL',
      service,
      endpoint,
      duration: `${duration}ms`,
      success,
      ...(error && { error }),
    });
  }

  logImageGeneration(prompt: string, style: string, aspectRatio: string, duration: number, success: boolean, error?: string) {
    const level = success ? 'info' : 'error';
    this.logger.log(level, 'Image Generation', {
      context: 'IMAGE_GENERATION',
      prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''), // Truncate long prompts
      style,
      aspectRatio,
      duration: `${duration}ms`,
      success,
      ...(error && { error }),
    });
  }

  logImageVariation(originalPrompt: string, variationType: string, duration: number, success: boolean, error?: string) {
    const level = success ? 'info' : 'error';
    this.logger.log(level, 'Image Variation', {
      context: 'IMAGE_VARIATION',
      originalPrompt: originalPrompt.substring(0, 100) + (originalPrompt.length > 100 ? '...' : ''),
      variationType,
      duration: `${duration}ms`,
      success,
      ...(error && { error }),
    });
  }

  logImageEditing(overlayCount: number, duration: number, success: boolean, error?: string) {
    const level = success ? 'info' : 'error';
    this.logger.log(level, 'Image Editing', {
      context: 'IMAGE_EDITING',
      overlayCount,
      duration: `${duration}ms`,
      success,
      ...(error && { error }),
    });
  }

  logPerformance(operation: string, duration: number, metadata?: Record<string, any>) {
    this.logger.info('Performance Metric', {
      context: 'PERFORMANCE',
      operation,
      duration: `${duration}ms`,
      ...metadata,
    });
  }

  logSecurityEvent(event: string, severity: 'low' | 'medium' | 'high', details?: Record<string, any>) {
    this.logger.warn('Security Event', {
      context: 'SECURITY',
      event,
      severity,
      ...details,
    });
  }
}
