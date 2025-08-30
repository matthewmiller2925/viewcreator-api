# ViewCreator API Logging System

This document describes the comprehensive logging system implemented in the ViewCreator NestJS API using Winston.

## Overview

The logging system provides:
- **Structured Logging**: JSON-formatted logs with consistent structure
- **Multiple Log Levels**: Error, Warn, Info, Debug, Verbose
- **Context-Aware Logging**: Each service has its own logging context
- **Performance Monitoring**: Automatic performance tracking for slow operations
- **HTTP Request Logging**: All HTTP requests are automatically logged
- **Environment-Specific Configuration**: Different logging behavior for development/production
- **Security Event Logging**: Special handling for security-related events

## Configuration

### Environment Variables

```env
# Logging Configuration
LOG_LEVEL=info          # Available: error, warn, info, debug, verbose
NODE_ENV=development    # development, production, test
APP_NAME=viewcreator-api
```

### Log Levels

- **error**: Critical errors that need immediate attention
- **warn**: Warning messages about potential issues
- **info**: General application flow information
- **debug**: Detailed debugging information (development only)
- **verbose**: Very detailed information (development only)

## Log Formats

### Development Format (Console)
```
14:30:25.123 INFO [ImageGenerationService] Starting image generation {"prompt":"A beautiful sunset...","aspectRatio":"16:9","style":"photorealistic"}
```

### Production Format (JSON)
```json
{
  "timestamp": "2024-01-15 14:30:25.123",
  "level": "INFO",
  "service": "viewcreator-api",
  "context": "ImageGenerationService",
  "message": "Starting image generation",
  "meta": {
    "prompt": "A beautiful sunset...",
    "aspectRatio": "16:9",
    "style": "photorealistic"
  }
}
```

## Log Files (Production Only)

- `logs/combined.log` - All log levels
- `logs/error.log` - Error level only
- `logs/access.log` - HTTP access logs

Files are automatically rotated when they reach 5MB, keeping 10 historical files.

## Logging Features

### 1. HTTP Request Logging

All HTTP requests are automatically logged with:
- Method, URL, status code
- Response time
- User agent and IP address
- Request/response correlation

```json
{
  "timestamp": "2024-01-15 14:30:25.123",
  "level": "INFO",
  "context": "HTTP",
  "message": "HTTP Request",
  "method": "POST",
  "url": "/api/image-generation/generate",
  "statusCode": 200,
  "responseTime": "2.5s"
}
```

### 2. Image Generation Logging

Specialized logging for image generation operations:

```typescript
// Automatic logging in ImageGenerationService
this.logger.logImageGeneration(prompt, style, aspectRatio, duration, success, error);
```

### 3. Performance Monitoring

Automatic performance tracking:
- Operations taking >10s are flagged as slow for image generation/variation
- Operations taking >5s are flagged as slow for image editing
- API call duration tracking

### 4. Security Event Logging

Special handling for security-related events:

```typescript
this.logger.logSecurityEvent('invalid-image-upload', 'medium', {
  imageUrl: imageUrl.substring(0, 100) + '...',
  error: message,
});
```

### 5. API Call Tracking

External API calls are tracked:

```typescript
this.logger.logApiCall('Gemini', 'generateContent', apiDuration, success, error);
```

## Usage Examples

### Basic Logging in Services

```typescript
import { CustomLoggerService } from '../../common/logger';

@Injectable()
export class MyService {
  constructor(private logger: CustomLoggerService) {
    this.logger.setContext('MyService');
  }

  async doSomething() {
    this.logger.log('Starting operation');
    
    try {
      // Your code here
      this.logger.debug('Operation details', { param1: 'value' });
      this.logger.log('Operation completed successfully');
    } catch (error) {
      this.logger.error('Operation failed', error.stack);
      throw error;
    }
  }
}
```

### Performance Logging

```typescript
const startTime = Date.now();
// ... operation code ...
const duration = Date.now() - startTime;

this.logger.logPerformance('my-operation', duration, {
  additionalData: 'value'
});
```

### Structured Logging with Metadata

```typescript
this.logger.log('User action', {
  userId: '123',
  action: 'generate_image',
  prompt: 'A beautiful landscape',
  timestamp: new Date().toISOString()
});
```

## Log Analysis

### Finding Specific Operations

```bash
# Find all image generation requests
grep "Image Generation" logs/combined.log

# Find slow operations
grep "slow" logs/combined.log

# Find errors
grep "ERROR" logs/combined.log
```

### Performance Analysis

```bash
# Find operations taking longer than 10 seconds
grep "PERFORMANCE" logs/combined.log | grep -E "1[0-9]{4,}ms"

# API call performance
grep "API_CALL" logs/combined.log
```

### Security Monitoring

```bash
# Security events
grep "SECURITY" logs/combined.log

# Failed requests
grep "statusCode\":5" logs/combined.log
```

## Best Practices

### 1. Context Setting
Always set context in your services:
```typescript
constructor(private logger: CustomLoggerService) {
  this.logger.setContext('YourServiceName');
}
```

### 2. Sensitive Data Handling
Never log sensitive information:
- API keys
- User passwords
- Personal information
- Full image data (use metadata instead)

### 3. Structured Logging
Use structured logging with metadata:
```typescript
// Good
this.logger.log('User registered', { userId: '123', email: 'user@example.com' });

// Bad
this.logger.log(`User 123 registered with email user@example.com`);
```

### 4. Error Logging
Always include stack traces for errors:
```typescript
this.logger.error('Operation failed', error.stack);
```

### 5. Performance Logging
Log performance metrics for important operations:
```typescript
const startTime = Date.now();
// ... operation ...
const duration = Date.now() - startTime;
this.logger.logPerformance('operation-name', duration, metadata);
```

## Monitoring and Alerting

### Key Metrics to Monitor

1. **Error Rate**: Number of ERROR level logs
2. **Performance**: Operations taking >10 seconds
3. **API Failures**: External API call failures
4. **Security Events**: Failed authentication, invalid uploads
5. **HTTP Status Codes**: 4xx and 5xx responses

### Sample Monitoring Queries

```bash
# Error rate in last hour
grep "ERROR" logs/combined.log | grep "$(date -d '1 hour ago' '+%Y-%m-%d %H')" | wc -l

# Slow operations in last hour
grep "slow" logs/combined.log | grep "$(date -d '1 hour ago' '+%Y-%m-%d %H')" | wc -l
```

## Development vs Production

### Development
- Console output with colors
- Debug and verbose levels enabled
- Shorter log retention

### Production
- JSON formatted logs
- File-based logging with rotation
- Info level and above only
- Longer log retention
- Structured for log aggregation systems

## Integration with Log Management

The JSON format is compatible with:
- **ELK Stack** (Elasticsearch, Logstash, Kibana)
- **Splunk**
- **CloudWatch Logs**
- **Datadog**
- **New Relic**

Example Logstash configuration:
```json
{
  "input": {
    "file": {
      "path": "/path/to/logs/*.log",
      "codec": "json"
    }
  },
  "filter": {
    "date": {
      "match": ["timestamp", "yyyy-MM-dd HH:mm:ss.SSS"]
    }
  }
}
```
