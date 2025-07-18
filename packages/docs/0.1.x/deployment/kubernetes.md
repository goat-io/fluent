# Kubernetes Deployment

This comprehensive guide covers deploying Fluent applications to Kubernetes clusters for production environments.

## Overview

Kubernetes provides powerful orchestration capabilities for containerized applications. This guide covers deployment strategies, configuration management, and best practices for running Fluent applications on Kubernetes.

## Prerequisites

- Kubernetes cluster (1.20+)
- kubectl configured
- Docker images built and pushed to registry
- Basic understanding of Kubernetes concepts
- Helm 3.0+ (optional, for advanced deployments)

## Basic Deployment

### 1. Namespace Configuration

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: fluent-app
  labels:
    name: fluent-app
    environment: production
```

### 2. ConfigMap for Configuration

```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluent-config
  namespace: fluent-app
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  PORT: "3000"
  REDIS_URL: "redis://redis-service:6379"
  DATABASE_URL: "postgresql://fluent:password@postgres-service:5432/fluent"
  # Add other non-sensitive configuration
```

### 3. Secrets for Sensitive Data

```yaml
# secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: fluent-secrets
  namespace: fluent-app
type: Opaque
data:
  JWT_SECRET: <base64-encoded-secret>
  POSTGRES_PASSWORD: <base64-encoded-password>
  REDIS_PASSWORD: <base64-encoded-password>
  # Add other sensitive data
```

### 4. Application Deployment

```yaml
# app-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fluent-app
  namespace: fluent-app
  labels:
    app: fluent-app
    version: v1.0.0
spec:
  replicas: 3
  selector:
    matchLabels:
      app: fluent-app
  template:
    metadata:
      labels:
        app: fluent-app
        version: v1.0.0
    spec:
      containers:
      - name: fluent-app
        image: your-registry/fluent-app:v1.0.0
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: fluent-config
              key: NODE_ENV
        - name: LOG_LEVEL
          valueFrom:
            configMapKeyRef:
              name: fluent-config
              key: LOG_LEVEL
        - name: PORT
          valueFrom:
            configMapKeyRef:
              name: fluent-config
              key: PORT
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: fluent-secrets
              key: DATABASE_URL
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: fluent-secrets
              key: JWT_SECRET
        
        # Resource limits
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        
        # Health checks
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        
        # Security context
        securityContext:
          runAsNonRoot: true
          runAsUser: 1001
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
            - ALL
        
        # Volume mounts
        volumeMounts:
        - name: tmp-volume
          mountPath: /tmp
        - name: logs-volume
          mountPath: /app/logs
      
      volumes:
      - name: tmp-volume
        emptyDir: {}
      - name: logs-volume
        emptyDir: {}
      
      # Pod security context
      securityContext:
        fsGroup: 1001
        runAsNonRoot: true
        seccompProfile:
          type: RuntimeDefault
      
      # Deployment strategy
      strategy:
        type: RollingUpdate
        rollingUpdate:
          maxUnavailable: 1
          maxSurge: 1
```

### 5. Service Configuration

```yaml
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: fluent-app-service
  namespace: fluent-app
  labels:
    app: fluent-app
spec:
  selector:
    app: fluent-app
  ports:
  - name: http
    port: 80
    targetPort: 3000
    protocol: TCP
  type: ClusterIP
```

## Database Deployment

### 1. PostgreSQL StatefulSet

```yaml
# postgres-statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: fluent-app
spec:
  serviceName: postgres-service
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:14-alpine
        ports:
        - containerPort: 5432
          name: postgres
        env:
        - name: POSTGRES_DB
          value: fluent
        - name: POSTGRES_USER
          value: fluent
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: fluent-secrets
              key: POSTGRES_PASSWORD
        - name: PGDATA
          value: /var/lib/postgresql/data/pgdata
        
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        
        livenessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - fluent
          initialDelaySeconds: 30
          periodSeconds: 10
        
        readinessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - fluent
          initialDelaySeconds: 5
          periodSeconds: 5
        
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        
        securityContext:
          runAsUser: 999
          runAsGroup: 999
          allowPrivilegeEscalation: false
  
  volumeClaimTemplates:
  - metadata:
      name: postgres-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi
      storageClassName: fast-ssd
```

### 2. PostgreSQL Service

```yaml
# postgres-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres-service
  namespace: fluent-app
spec:
  selector:
    app: postgres
  ports:
  - name: postgres
    port: 5432
    targetPort: 5432
  type: ClusterIP
```

### 3. Redis Deployment

```yaml
# redis-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: fluent-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
          name: redis
        command:
        - redis-server
        - --appendonly
        - "yes"
        - --requirepass
        - "$(REDIS_PASSWORD)"
        env:
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: fluent-secrets
              key: REDIS_PASSWORD
        
        resources:
          requests:
            memory: "64Mi"
            cpu: "50m"
          limits:
            memory: "128Mi"
            cpu: "100m"
        
        livenessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 30
          periodSeconds: 10
        
        readinessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 5
          periodSeconds: 5
        
        volumeMounts:
        - name: redis-data
          mountPath: /data
        
        securityContext:
          runAsUser: 999
          runAsGroup: 999
          allowPrivilegeEscalation: false
      
      volumes:
      - name: redis-data
        emptyDir: {}
```

### 4. Redis Service

```yaml
# redis-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: redis-service
  namespace: fluent-app
spec:
  selector:
    app: redis
  ports:
  - name: redis
    port: 6379
    targetPort: 6379
  type: ClusterIP
```

## Ingress Configuration

### 1. NGINX Ingress

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: fluent-app-ingress
  namespace: fluent-app
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - api.yourdomain.com
    secretName: fluent-app-tls
  rules:
  - host: api.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: fluent-app-service
            port:
              number: 80
```

### 2. Traefik Ingress

```yaml
# traefik-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: fluent-app-ingress
  namespace: fluent-app
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: websecure
    traefik.ingress.kubernetes.io/router.tls: "true"
    traefik.ingress.kubernetes.io/router.tls.certresolver: letsencrypt
    traefik.ingress.kubernetes.io/router.middlewares: fluent-app-ratelimit@kubernetescrd
spec:
  rules:
  - host: api.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: fluent-app-service
            port:
              number: 80
```

## Horizontal Pod Autoscaling

### 1. HPA Configuration

```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: fluent-app-hpa
  namespace: fluent-app
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: fluent-app
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 50
        periodSeconds: 15
      - type: Pods
        value: 2
        periodSeconds: 60
```

### 2. Vertical Pod Autoscaling

```yaml
# vpa.yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: fluent-app-vpa
  namespace: fluent-app
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: fluent-app
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
    - containerName: fluent-app
      maxAllowed:
        cpu: 1
        memory: 1Gi
      minAllowed:
        cpu: 100m
        memory: 128Mi
```

## Network Policies

### 1. Network Policy Configuration

```yaml
# network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: fluent-app-network-policy
  namespace: fluent-app
spec:
  podSelector:
    matchLabels:
      app: fluent-app
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    - namespaceSelector:
        matchLabels:
          name: monitoring
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
  - to: []
    ports:
    - protocol: TCP
      port: 443
    - protocol: TCP
      port: 80
    - protocol: UDP
      port: 53
```

## Security

### 1. Pod Security Standards

```yaml
# pod-security-policy.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: fluent-app
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

### 2. RBAC Configuration

```yaml
# rbac.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: fluent-app-sa
  namespace: fluent-app
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: fluent-app-role
  namespace: fluent-app
rules:
- apiGroups: [""]
  resources: ["secrets", "configmaps"]
  verbs: ["get", "list"]
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: fluent-app-rolebinding
  namespace: fluent-app
subjects:
- kind: ServiceAccount
  name: fluent-app-sa
  namespace: fluent-app
roleRef:
  kind: Role
  name: fluent-app-role
  apiGroup: rbac.authorization.k8s.io
```

## Monitoring

### 1. Prometheus Monitoring

```yaml
# prometheus-monitoring.yaml
apiVersion: v1
kind: ServiceMonitor
metadata:
  name: fluent-app-monitor
  namespace: fluent-app
  labels:
    app: fluent-app
spec:
  selector:
    matchLabels:
      app: fluent-app
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
```

### 2. Grafana Dashboard

```yaml
# grafana-dashboard.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluent-app-dashboard
  namespace: monitoring
  labels:
    grafana_dashboard: "1"
data:
  fluent-app.json: |
    {
      "dashboard": {
        "title": "Fluent App Dashboard",
        "panels": [
          {
            "title": "Request Rate",
            "type": "graph",
            "targets": [
              {
                "expr": "rate(http_requests_total[5m])",
                "legendFormat": "{{method}} {{status}}"
              }
            ]
          },
          {
            "title": "Response Time",
            "type": "graph",
            "targets": [
              {
                "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
                "legendFormat": "95th percentile"
              }
            ]
          }
        ]
      }
    }
```

## Persistent Storage

### 1. Storage Class

```yaml
# storage-class.yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: kubernetes.io/aws-ebs
parameters:
  type: gp3
  iops: "3000"
  throughput: "125"
  encrypted: "true"
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
```

### 2. Persistent Volume Claim

```yaml
# pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: fluent-app-uploads
  namespace: fluent-app
spec:
  accessModes:
  - ReadWriteMany
  resources:
    requests:
      storage: 10Gi
  storageClassName: fast-ssd
```

## Helm Charts

### 1. Chart Structure

```
fluent-app/
├── Chart.yaml
├── values.yaml
├── values-production.yaml
├── templates/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── configmap.yaml
│   ├── secrets.yaml
│   ├── hpa.yaml
│   └── tests/
│       └── test-connection.yaml
└── charts/
    ├── postgresql/
    └── redis/
```

### 2. Chart.yaml

```yaml
apiVersion: v2
name: fluent-app
description: A Helm chart for Fluent application
type: application
version: 0.1.0
appVersion: "1.0.0"

dependencies:
- name: postgresql
  version: "11.6.12"
  repository: "https://charts.bitnami.com/bitnami"
  condition: postgresql.enabled
- name: redis
  version: "16.13.2"
  repository: "https://charts.bitnami.com/bitnami"
  condition: redis.enabled

keywords:
- fluent
- nodejs
- api
home: https://github.com/your-org/fluent-app
sources:
- https://github.com/your-org/fluent-app
maintainers:
- name: Your Name
  email: your.email@example.com
```

### 3. values.yaml

```yaml
# Default values for fluent-app
replicaCount: 3

image:
  repository: your-registry/fluent-app
  pullPolicy: IfNotPresent
  tag: "latest"

nameOverride: ""
fullnameOverride: ""

service:
  type: ClusterIP
  port: 80

ingress:
  enabled: true
  className: "nginx"
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
  hosts:
  - host: api.yourdomain.com
    paths:
    - path: /
      pathType: Prefix
  tls:
  - secretName: fluent-app-tls
    hosts:
    - api.yourdomain.com

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 250m
    memory: 256Mi

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

nodeSelector: {}
tolerations: []
affinity: {}

# Database configuration
postgresql:
  enabled: true
  auth:
    postgresPassword: "your-password"
    database: "fluent"
    username: "fluent"
    password: "your-password"
  primary:
    persistence:
      size: 10Gi

redis:
  enabled: true
  auth:
    password: "your-redis-password"
  master:
    persistence:
      size: 1Gi

# Application configuration
config:
  nodeEnv: production
  logLevel: info
  jwtSecret: "your-jwt-secret"
```

### 4. Deployment Template

```yaml
# templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "fluent-app.fullname" . }}
  labels:
    {{- include "fluent-app.labels" . | nindent 4 }}
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "fluent-app.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      {{- with .Values.podAnnotations }}
      annotations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      labels:
        {{- include "fluent-app.selectorLabels" . | nindent 8 }}
    spec:
      containers:
      - name: {{ .Chart.Name }}
        image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
        imagePullPolicy: {{ .Values.image.pullPolicy }}
        ports:
        - name: http
          containerPort: 3000
          protocol: TCP
        env:
        - name: NODE_ENV
          value: {{ .Values.config.nodeEnv }}
        - name: LOG_LEVEL
          value: {{ .Values.config.logLevel }}
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: {{ include "fluent-app.fullname" . }}-secret
              key: jwt-secret
        - name: DATABASE_URL
          value: "postgresql://{{ .Values.postgresql.auth.username }}:{{ .Values.postgresql.auth.password }}@{{ include "fluent-app.fullname" . }}-postgresql:5432/{{ .Values.postgresql.auth.database }}"
        - name: REDIS_URL
          value: "redis://:{{ .Values.redis.auth.password }}@{{ include "fluent-app.fullname" . }}-redis-master:6379"
        
        livenessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
        
        readinessProbe:
          httpGet:
            path: /ready
            port: http
          initialDelaySeconds: 5
          periodSeconds: 5
        
        resources:
          {{- toYaml .Values.resources | nindent 10 }}
      
      {{- with .Values.nodeSelector }}
      nodeSelector:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.affinity }}
      affinity:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.tolerations }}
      tolerations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
```

## Deployment Scripts

### 1. Deploy Script

```bash
#!/bin/bash
# deploy.sh

set -e

NAMESPACE="fluent-app"
RELEASE_NAME="fluent-app"
CHART_PATH="./helm/fluent-app"
VALUES_FILE="values-production.yaml"

echo "Deploying Fluent App to Kubernetes..."

# Create namespace if it doesn't exist
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Deploy with Helm
helm upgrade --install $RELEASE_NAME $CHART_PATH \
  --namespace $NAMESPACE \
  --values $VALUES_FILE \
  --wait \
  --timeout 10m

echo "Deployment completed!"

# Show deployment status
kubectl get pods -n $NAMESPACE
kubectl get services -n $NAMESPACE
kubectl get ingress -n $NAMESPACE
```

### 2. Rollback Script

```bash
#!/bin/bash
# rollback.sh

set -e

NAMESPACE="fluent-app"
RELEASE_NAME="fluent-app"
REVISION=${1:-1}

echo "Rolling back to revision $REVISION..."

helm rollback $RELEASE_NAME $REVISION --namespace $NAMESPACE --wait

echo "Rollback completed!"
```

## Best Practices

### 1. Resource Management
- Set appropriate resource requests and limits
- Use HPA for dynamic scaling
- Configure QoS classes properly

### 2. Security
- Use Pod Security Standards
- Implement Network Policies
- Run containers as non-root users
- Use secrets for sensitive data

### 3. Monitoring
- Configure health checks
- Use Prometheus for metrics
- Set up log aggregation
- Monitor resource usage

### 4. Deployment Strategy
- Use rolling updates
- Implement blue-green deployments for critical updates
- Test deployments in staging first
- Have rollback procedures ready

## Troubleshooting

### 1. Common Issues

```bash
# Check pod status
kubectl get pods -n fluent-app

# Check pod logs
kubectl logs -f deployment/fluent-app -n fluent-app

# Describe pod for events
kubectl describe pod <pod-name> -n fluent-app

# Check resource usage
kubectl top pods -n fluent-app
```

### 2. Debug Commands

```bash
# Execute into pod
kubectl exec -it <pod-name> -n fluent-app -- /bin/sh

# Port forward for debugging
kubectl port-forward svc/fluent-app-service 3000:80 -n fluent-app

# Check ingress
kubectl get ingress -n fluent-app
kubectl describe ingress fluent-app-ingress -n fluent-app
```

## Deployment Checklist

- [ ] Kubernetes cluster configured
- [ ] Docker images built and pushed
- [ ] Secrets and ConfigMaps created
- [ ] Resource limits configured
- [ ] Health checks implemented
- [ ] Ingress configured with SSL
- [ ] Monitoring configured
- [ ] Autoscaling configured
- [ ] Network policies implemented
- [ ] Backup strategy in place
- [ ] Security policies applied
- [ ] Deployment scripts tested

## Next Steps

1. [Cloud Providers](cloud-providers.md) - Deploy to specific cloud platforms
2. [CI/CD Pipeline](ci-cd.md) - Automate deployments
3. [Monitoring](../operations/monitoring.md) - Set up comprehensive monitoring
4. [Scaling](../operations/scaling.md) - Implement advanced scaling strategies