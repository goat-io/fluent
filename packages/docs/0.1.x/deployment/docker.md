# Docker Deployment

This guide covers containerizing and deploying Fluent applications using Docker for production environments.

## Overview

Docker provides a consistent and portable way to deploy your Fluent applications. This guide covers single-container and multi-container deployments with Docker Compose.

## Prerequisites

- Docker 20.10+ installed
- Docker Compose 2.0+ installed
- Basic understanding of Docker concepts
- Access to a container registry (Docker Hub, AWS ECR, etc.)

## Single Container Deployment

### 1. Dockerfile

Create a production-ready Dockerfile:

```dockerfile
# Multi-stage build for production
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# Production stage
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S fluent -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install pnpm
RUN npm install -g pnpm

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Change ownership to app user
RUN chown -R fluent:nodejs /app
USER fluent

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
```

### 2. Health Check Script

Create `healthcheck.js`:

```javascript
const http = require('http');

const options = {
  hostname: 'localhost',
  port: process.env.PORT || 3000,
  path: '/health',
  method: 'GET',
  timeout: 2000
};

const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

req.on('error', () => {
  process.exit(1);
});

req.on('timeout', () => {
  req.destroy();
  process.exit(1);
});

req.end();
```

### 3. Docker Ignore

Create `.dockerignore`:

```
node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.env.local
.env.development
.env.test
coverage
.nyc_output
*.log
dist
build
.DS_Store
.vscode
.idea
*.swp
*.swo
*~
```

### 4. Building the Image

```bash
# Build the Docker image
docker build -t fluent-app:latest .

# Build with specific tag
docker build -t fluent-app:v1.0.0 .

# Build with build arguments
docker build --build-arg NODE_ENV=production -t fluent-app:latest .
```

### 5. Running the Container

```bash
# Run with environment variables
docker run -d \
  --name fluent-app \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL=postgresql://user:pass@db:5432/fluent \
  -e JWT_SECRET=your-secret-here \
  --restart unless-stopped \
  fluent-app:latest

# Run with environment file
docker run -d \
  --name fluent-app \
  -p 3000:3000 \
  --env-file .env.production \
  --restart unless-stopped \
  fluent-app:latest
```

## Multi-Container Deployment

### 1. Docker Compose Configuration

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    container_name: fluent-app
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://fluent:${POSTGRES_PASSWORD}@postgres:5432/fluent
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    networks:
      - fluent-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.fluent.rule=Host(`api.yourdomain.com`)"
      - "traefik.http.routers.fluent.tls=true"
      - "traefik.http.routers.fluent.tls.certresolver=letsencrypt"

  postgres:
    image: postgres:14-alpine
    container_name: fluent-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_DB=fluent
      - POSTGRES_USER=fluent
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init-db.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U fluent"]
      interval: 30s
      timeout: 10s
      retries: 5
    networks:
      - fluent-network

  redis:
    image: redis:7-alpine
    container_name: fluent-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 5
    networks:
      - fluent-network

  nginx:
    image: nginx:alpine
    container_name: fluent-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
      - ./static:/usr/share/nginx/html/static
    depends_on:
      - app
    networks:
      - fluent-network

volumes:
  postgres_data:
  redis_data:

networks:
  fluent-network:
    driver: bridge
```

### 2. Production Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  app:
    image: fluent-app:latest
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
        order: start-first
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
        window: 120s
      resources:
        limits:
          cpus: '0.50'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://fluent:${POSTGRES_PASSWORD}@postgres:5432/fluent
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - LOG_LEVEL=info
    healthcheck:
      test: ["CMD", "node", "healthcheck.js"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    depends_on:
      - postgres
      - redis
    networks:
      - fluent-network

  postgres:
    image: postgres:14-alpine
    deploy:
      placement:
        constraints:
          - node.labels.database == true
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
    environment:
      - POSTGRES_DB=fluent
      - POSTGRES_USER=fluent
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_INITDB_ARGS=--encoding=UTF-8
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backup:/backup
    networks:
      - fluent-network

  redis:
    image: redis:7-alpine
    deploy:
      placement:
        constraints:
          - node.labels.cache == true
      resources:
        limits:
          cpus: '0.50'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - fluent-network

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local

networks:
  fluent-network:
    driver: overlay
    attachable: true
```

### 3. Environment Configuration

Create `.env.production`:

```bash
# Database
POSTGRES_PASSWORD=your-secure-postgres-password
POSTGRES_DB=fluent
POSTGRES_USER=fluent

# Redis
REDIS_PASSWORD=your-secure-redis-password

# Application
JWT_SECRET=your-super-secure-jwt-secret
NODE_ENV=production
LOG_LEVEL=info

# Scaling
REPLICAS=3
```

### 4. Nginx Configuration

Create `nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream app {
        server app:3000;
    }

    server {
        listen 80;
        server_name yourdomain.com;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;

        # Gzip compression
        gzip on;
        gzip_vary on;
        gzip_min_length 1024;
        gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

        # Rate limiting
        limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

        location / {
            limit_req zone=api burst=20 nodelay;
            
            proxy_pass http://app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Timeouts
            proxy_connect_timeout 5s;
            proxy_send_timeout 10s;
            proxy_read_timeout 10s;
        }

        # Health check
        location /health {
            access_log off;
            proxy_pass http://app;
        }

        # Static files
        location /static {
            alias /usr/share/nginx/html/static;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

## Container Registry

### 1. Docker Hub

```bash
# Login to Docker Hub
docker login

# Tag image
docker tag fluent-app:latest yourusername/fluent-app:latest
docker tag fluent-app:latest yourusername/fluent-app:v1.0.0

# Push image
docker push yourusername/fluent-app:latest
docker push yourusername/fluent-app:v1.0.0
```

### 2. AWS ECR

```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com

# Create repository
aws ecr create-repository --repository-name fluent-app --region us-east-1

# Tag image
docker tag fluent-app:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/fluent-app:latest

# Push image
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/fluent-app:latest
```

### 3. Google Container Registry

```bash
# Configure Docker to use gcloud
gcloud auth configure-docker

# Tag image
docker tag fluent-app:latest gcr.io/your-project-id/fluent-app:latest

# Push image
docker push gcr.io/your-project-id/fluent-app:latest
```

## Deployment Scripts

### 1. Deployment Script

Create `deploy.sh`:

```bash
#!/bin/bash

set -e

# Configuration
IMAGE_NAME="fluent-app"
IMAGE_TAG="${1:-latest}"
CONTAINER_NAME="fluent-app"
PORT="3000"

echo "Deploying $IMAGE_NAME:$IMAGE_TAG..."

# Stop existing container
if [ $(docker ps -q -f name=$CONTAINER_NAME) ]; then
    echo "Stopping existing container..."
    docker stop $CONTAINER_NAME
fi

# Remove existing container
if [ $(docker ps -aq -f name=$CONTAINER_NAME) ]; then
    echo "Removing existing container..."
    docker rm $CONTAINER_NAME
fi

# Pull latest image
echo "Pulling latest image..."
docker pull $IMAGE_NAME:$IMAGE_TAG

# Run new container
echo "Starting new container..."
docker run -d \
  --name $CONTAINER_NAME \
  -p $PORT:$PORT \
  --env-file .env.production \
  --restart unless-stopped \
  --health-cmd="node healthcheck.js" \
  --health-interval=30s \
  --health-timeout=10s \
  --health-retries=3 \
  $IMAGE_NAME:$IMAGE_TAG

# Wait for container to be healthy
echo "Waiting for container to be healthy..."
timeout=60
while [ $timeout -gt 0 ]; do
    if [ "$(docker inspect --format='{{.State.Health.Status}}' $CONTAINER_NAME)" == "healthy" ]; then
        echo "Container is healthy!"
        break
    fi
    sleep 1
    timeout=$((timeout-1))
done

if [ $timeout -eq 0 ]; then
    echo "Container failed to become healthy"
    exit 1
fi

echo "Deployment completed successfully!"
```

### 2. Docker Compose Deployment

Create `deploy-compose.sh`:

```bash
#!/bin/bash

set -e

# Configuration
ENVIRONMENT="${1:-production}"
COMPOSE_FILE="docker-compose.yml"

if [ "$ENVIRONMENT" = "production" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
fi

echo "Deploying with $COMPOSE_FILE..."

# Pull latest images
echo "Pulling latest images..."
docker-compose -f $COMPOSE_FILE pull

# Stop and remove existing containers
echo "Stopping existing containers..."
docker-compose -f $COMPOSE_FILE down

# Start new containers
echo "Starting new containers..."
docker-compose -f $COMPOSE_FILE up -d

# Wait for services to be healthy
echo "Waiting for services to be healthy..."
timeout=120
while [ $timeout -gt 0 ]; do
    if docker-compose -f $COMPOSE_FILE ps | grep -q "healthy"; then
        echo "Services are healthy!"
        break
    fi
    sleep 2
    timeout=$((timeout-2))
done

if [ $timeout -eq 0 ]; then
    echo "Services failed to become healthy"
    docker-compose -f $COMPOSE_FILE logs
    exit 1
fi

# Clean up old images
echo "Cleaning up old images..."
docker image prune -f

echo "Deployment completed successfully!"
```

## Monitoring & Logging

### 1. Container Monitoring

```bash
# Monitor container resource usage
docker stats fluent-app

# Monitor logs
docker logs -f fluent-app

# Monitor all containers
docker-compose logs -f
```

### 2. Log Configuration

```yaml
# Add to docker-compose.yml
services:
  app:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
        compress: "true"
```

### 3. Health Check Monitoring

```bash
# Check container health
docker inspect --format='{{.State.Health.Status}}' fluent-app

# View health check logs
docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' fluent-app
```

## Security Best Practices

### 1. Image Security

```dockerfile
# Use specific version tags
FROM node:18.16.0-alpine

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S fluent -u 1001

# Set file permissions
RUN chown -R fluent:nodejs /app
USER fluent

# Remove package managers
RUN rm -rf /usr/local/bin/npm /usr/local/bin/npx
```

### 2. Runtime Security

```bash
# Run with security options
docker run -d \
  --name fluent-app \
  --security-opt=no-new-privileges:true \
  --read-only \
  --tmpfs /tmp \
  --tmpfs /run \
  --cap-drop=ALL \
  --cap-add=NET_BIND_SERVICE \
  fluent-app:latest
```

### 3. Network Security

```yaml
# Docker Compose network isolation
networks:
  fluent-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

## Backup & Recovery

### 1. Database Backup

```bash
# Backup PostgreSQL
docker exec fluent-postgres pg_dump -U fluent fluent > backup.sql

# Backup with Docker Compose
docker-compose exec postgres pg_dump -U fluent fluent > backup.sql
```

### 2. Volume Backup

```bash
# Backup volumes
docker run --rm \
  -v fluent_postgres_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/postgres-backup.tar.gz /data

# Restore volumes
docker run --rm \
  -v fluent_postgres_data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/postgres-backup.tar.gz -C /
```

## Troubleshooting

### 1. Common Issues

```bash
# Container won't start
docker logs fluent-app

# Check container resource usage
docker stats fluent-app

# Debug container
docker exec -it fluent-app /bin/sh

# Check network connectivity
docker exec fluent-app ping postgres
```

### 2. Performance Issues

```bash
# Monitor resource usage
docker stats --no-stream

# Check container limits
docker inspect fluent-app | grep -A 10 Resources

# Analyze logs
docker logs --since=1h fluent-app | grep ERROR
```

## Deployment Checklist

- [ ] Dockerfile optimized for production
- [ ] Health checks configured
- [ ] Security practices implemented
- [ ] Environment variables configured
- [ ] Container registry set up
- [ ] Deployment scripts created
- [ ] Monitoring and logging configured
- [ ] Backup strategy implemented
- [ ] Network security configured
- [ ] Resource limits set
- [ ] SSL certificates configured
- [ ] Load balancer configured (if needed)

## Next Steps

1. [Kubernetes Deployment](kubernetes.md) - Deploy to Kubernetes
2. [Cloud Providers](cloud-providers.md) - Deploy to cloud platforms
3. [CI/CD Pipeline](ci-cd.md) - Set up automated deployments
4. [Monitoring](../operations/monitoring.md) - Monitor your Docker deployment