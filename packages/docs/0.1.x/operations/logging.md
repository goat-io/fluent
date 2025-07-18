# Logging Strategies

This guide covers comprehensive logging strategies for Fluent applications including structured logging, log aggregation, and analysis.

## Structured Logging

### Winston Configuration
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'fluent-app' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

export default logger;
```

## Log Aggregation

### ELK Stack Configuration
```yaml
# docker-compose.yml
version: '3.8'
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.5.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data

  logstash:
    image: docker.elastic.co/logstash/logstash:8.5.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    depends_on:
      - elasticsearch

  kibana:
    image: docker.elastic.co/kibana/kibana:8.5.0
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch
```

### Log Analysis
```javascript
// Kibana dashboard queries
// Error rate by endpoint
{
  "query": {
    "bool": {
      "must": [
        { "range": { "@timestamp": { "gte": "now-1h" } } },
        { "term": { "level": "error" } }
      ]
    }
  },
  "aggs": {
    "endpoints": {
      "terms": { "field": "endpoint.keyword" }
    }
  }
}
```

## Best Practices

### 1. Log Levels
- **ERROR**: System errors, exceptions
- **WARN**: Warnings, recoverable issues
- **INFO**: General application flow
- **DEBUG**: Detailed diagnostic information

### 2. Sensitive Data
```typescript
const sanitizeLog = (data: any) => {
  const sanitized = { ...data };
  delete sanitized.password;
  delete sanitized.token;
  delete sanitized.creditCard;
  return sanitized;
};
```

### 3. Performance
```typescript
// Conditional logging
if (logger.isDebugEnabled()) {
  logger.debug('Expensive operation', expensiveComputation());
}

// Async logging
logger.info('User action', { userId, action }, (error) => {
  if (error) console.error('Logging failed:', error);
});
```