# Cloud Provider Deployment

This comprehensive guide covers deploying Fluent applications to major cloud providers including AWS, Google Cloud Platform, and Microsoft Azure.

## Overview

Cloud providers offer managed services and infrastructure that simplify deployment and scaling of Fluent applications. This guide covers platform-specific deployment strategies, managed services integration, and best practices.

## Amazon Web Services (AWS)

### 1. ECS Deployment

#### Task Definition

```json
{
  "family": "fluent-app",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::123456789012:role/fluent-app-task-role",
  "containerDefinitions": [
    {
      "name": "fluent-app",
      "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/fluent-app:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "3000"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:fluent-app/database-url"
        },
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:fluent-app/jwt-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/fluent-app",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

#### ECS Service

```yaml
# ecs-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: fluent-app-service
spec:
  serviceName: fluent-app
  cluster: fluent-cluster
  taskDefinition: fluent-app:1
  desiredCount: 3
  launchType: FARGATE
  networkConfiguration:
    awsvpcConfiguration:
      subnets:
        - subnet-12345678
        - subnet-87654321
      securityGroups:
        - sg-12345678
      assignPublicIp: ENABLED
  loadBalancers:
    - targetGroupArn: arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/fluent-app-tg/1234567890123456
      containerName: fluent-app
      containerPort: 3000
  deploymentConfiguration:
    maximumPercent: 200
    minimumHealthyPercent: 100
    deploymentCircuitBreaker:
      enable: true
      rollback: true
```

#### Application Load Balancer

```yaml
# alb-terraform.tf
resource "aws_lb" "fluent_app" {
  name               = "fluent-app-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids

  enable_deletion_protection = true

  tags = {
    Environment = "production"
    Project     = "fluent-app"
  }
}

resource "aws_lb_target_group" "fluent_app" {
  name     = "fluent-app-tg"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
    interval            = 30
    path                = "/health"
    matcher             = "200"
    port                = "traffic-port"
    protocol            = "HTTP"
  }

  tags = {
    Environment = "production"
    Project     = "fluent-app"
  }
}

resource "aws_lb_listener" "fluent_app" {
  load_balancer_arn = aws_lb.fluent_app.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"
  certificate_arn   = var.ssl_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.fluent_app.arn
  }
}
```

### 2. EKS Deployment

#### EKS Cluster

```yaml
# eks-cluster.yaml
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: fluent-cluster
  region: us-east-1
  version: "1.24"

availabilityZones:
  - us-east-1a
  - us-east-1b
  - us-east-1c

managedNodeGroups:
  - name: fluent-workers
    instanceType: t3.medium
    minSize: 2
    maxSize: 10
    desiredCapacity: 3
    volumeSize: 20
    volumeType: gp3
    amiFamily: AmazonLinux2
    
    iam:
      withAddonPolicies:
        autoScaler: true
        albIngress: true
        cloudWatch: true
        
    labels:
      role: worker
      environment: production
      
    tags:
      Environment: production
      Project: fluent-app
      
    ssh:
      allow: true
      publicKeyName: fluent-app-key

addons:
  - name: vpc-cni
    version: latest
  - name: coredns
    version: latest
  - name: kube-proxy
    version: latest
  - name: aws-ebs-csi-driver
    version: latest

cloudWatch:
  clusterLogging:
    enableTypes:
      - audit
      - authenticator
      - controllerManager
      - scheduler
      - api
```

#### Auto Scaling

```yaml
# cluster-autoscaler.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: cluster-autoscaler-status
  namespace: kube-system
  labels:
    k8s-app: cluster-autoscaler
data:
  nodes.max: "10"
  nodes.min: "2"
  scale-down-delay-after-add: "10m"
  scale-down-unneeded-time: "10m"
  scale-down-utilization-threshold: "0.5"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cluster-autoscaler
  namespace: kube-system
  labels:
    k8s-app: cluster-autoscaler
spec:
  replicas: 1
  selector:
    matchLabels:
      k8s-app: cluster-autoscaler
  template:
    metadata:
      labels:
        k8s-app: cluster-autoscaler
    spec:
      serviceAccountName: cluster-autoscaler
      containers:
      - image: k8s.gcr.io/autoscaling/cluster-autoscaler:v1.24.0
        name: cluster-autoscaler
        command:
        - ./cluster-autoscaler
        - --v=4
        - --stderrthreshold=info
        - --cloud-provider=aws
        - --skip-nodes-with-local-storage=false
        - --expander=least-waste
        - --node-group-auto-discovery=asg:tag=k8s.io/cluster-autoscaler/enabled,k8s.io/cluster-autoscaler/fluent-cluster
        - --balance-similar-node-groups
        - --skip-nodes-with-system-pods=false
        resources:
          limits:
            cpu: 100m
            memory: 300Mi
          requests:
            cpu: 100m
            memory: 300Mi
        volumeMounts:
        - name: ssl-certs
          mountPath: /etc/ssl/certs/ca-certificates.crt
          readOnly: true
      volumes:
      - name: ssl-certs
        hostPath:
          path: /etc/ssl/certs/ca-certificates.crt
```

### 3. RDS Integration

```yaml
# rds-terraform.tf
resource "aws_db_subnet_group" "fluent_app" {
  name       = "fluent-app-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name = "Fluent App DB subnet group"
  }
}

resource "aws_db_instance" "fluent_app" {
  identifier = "fluent-app-db"
  
  engine         = "postgres"
  engine_version = "14.6"
  instance_class = "db.t3.micro"
  
  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type         = "gp3"
  storage_encrypted    = true
  
  db_name  = "fluent"
  username = "fluent"
  password = var.db_password
  
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.fluent_app.name
  
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  skip_final_snapshot = false
  final_snapshot_identifier = "fluent-app-final-snapshot"
  
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn
  
  performance_insights_enabled = true
  performance_insights_retention_period = 7
  
  tags = {
    Name = "Fluent App Database"
    Environment = "production"
  }
}
```

## Google Cloud Platform (GCP)

### 1. Cloud Run Deployment

```yaml
# cloud-run-service.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: fluent-app
  namespace: default
  annotations:
    run.googleapis.com/ingress: all
    run.googleapis.com/execution-environment: gen2
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/maxScale: "10"
        autoscaling.knative.dev/minScale: "1"
        run.googleapis.com/cpu-throttling: "true"
        run.googleapis.com/memory: "512Mi"
        run.googleapis.com/cpu: "1000m"
        run.googleapis.com/vpc-access-connector: fluent-vpc-connector
        run.googleapis.com/vpc-access-egress: private-ranges-only
    spec:
      containerConcurrency: 80
      timeoutSeconds: 300
      containers:
      - image: gcr.io/your-project/fluent-app:latest
        ports:
        - name: http1
          containerPort: 3000
        env:
        - name: NODE_ENV
          value: production
        - name: PORT
          value: "3000"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: fluent-secrets
              key: database-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: fluent-secrets
              key: jwt-secret
        resources:
          limits:
            cpu: 1000m
            memory: 512Mi
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### 2. GKE Deployment

```yaml
# gke-cluster.yaml
apiVersion: container.v1
kind: Cluster
metadata:
  name: fluent-cluster
spec:
  location: us-central1
  releaseChannel:
    channel: REGULAR
  
  network: projects/your-project/global/networks/fluent-vpc
  subnetwork: projects/your-project/regions/us-central1/subnetworks/fluent-subnet
  
  ipAllocationPolicy:
    clusterSecondaryRangeName: pods
    servicesSecondaryRangeName: services
  
  networkPolicy:
    enabled: true
    provider: CALICO
  
  addonsConfig:
    httpLoadBalancing:
      disabled: false
    horizontalPodAutoscaling:
      disabled: false
    networkPolicyConfig:
      disabled: false
    istioConfig:
      disabled: false
  
  workloadIdentityConfig:
    workloadPool: your-project.svc.id.goog
  
  nodePools:
  - name: fluent-pool
    initialNodeCount: 3
    config:
      machineType: n1-standard-2
      diskSizeGb: 20
      diskType: pd-ssd
      imageType: COS_CONTAINERD
      
      oauthScopes:
      - https://www.googleapis.com/auth/cloud-platform
      
      workloadMetadataConfig:
        mode: GKE_METADATA
      
      shieldedInstanceConfig:
        enableSecureBoot: true
        enableIntegrityMonitoring: true
    
    autoscaling:
      enabled: true
      minNodeCount: 2
      maxNodeCount: 10
    
    management:
      autoUpgrade: true
      autoRepair: true
    
    upgradeSettings:
      maxSurge: 1
      maxUnavailable: 0
```

### 3. Cloud SQL Integration

```yaml
# cloud-sql-terraform.tf
resource "google_sql_database_instance" "fluent_app" {
  name             = "fluent-app-db"
  database_version = "POSTGRES_14"
  region           = "us-central1"
  
  settings {
    tier = "db-f1-micro"
    
    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      location                       = "us-central1"
      point_in_time_recovery_enabled = true
      backup_retention_settings {
        retained_backups = 7
        retention_unit   = "COUNT"
      }
    }
    
    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.fluent_vpc.id
      require_ssl     = true
    }
    
    database_flags {
      name  = "log_checkpoints"
      value = "on"
    }
    
    database_flags {
      name  = "log_connections"
      value = "on"
    }
    
    database_flags {
      name  = "log_disconnections"
      value = "on"
    }
    
    maintenance_window {
      day          = 7
      hour         = 3
      update_track = "stable"
    }
  }
  
  deletion_protection = true
}

resource "google_sql_database" "fluent_app" {
  name     = "fluent"
  instance = google_sql_database_instance.fluent_app.name
}

resource "google_sql_user" "fluent_app" {
  name     = "fluent"
  instance = google_sql_database_instance.fluent_app.name
  password = var.db_password
}
```

### 4. Cloud Storage Integration

```yaml
# cloud-storage-terraform.tf
resource "google_storage_bucket" "fluent_app_uploads" {
  name          = "fluent-app-uploads-${random_id.bucket_suffix.hex}"
  location      = "US"
  force_destroy = false
  
  uniform_bucket_level_access = true
  
  versioning {
    enabled = true
  }
  
  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type = "Delete"
    }
  }
  
  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }
  
  cors {
    origin          = ["https://yourdomain.com"]
    method          = ["GET", "HEAD", "PUT", "POST", "DELETE"]
    response_header = ["*"]
    max_age_seconds = 3600
  }
}

resource "google_storage_bucket_iam_binding" "fluent_app_uploads" {
  bucket = google_storage_bucket.fluent_app_uploads.name
  role   = "roles/storage.objectAdmin"
  
  members = [
    "serviceAccount:${google_service_account.fluent_app.email}",
  ]
}
```

## Microsoft Azure

### 1. Container Instances

```yaml
# container-instance.yaml
apiVersion: 2019-12-01
type: Microsoft.ContainerInstance/containerGroups
properties:
  containers:
  - name: fluent-app
    properties:
      image: yourregistry.azurecr.io/fluent-app:latest
      resources:
        requests:
          cpu: 1
          memoryInGB: 1
      ports:
      - protocol: TCP
        port: 3000
      environmentVariables:
      - name: NODE_ENV
        value: production
      - name: PORT
        value: "3000"
      - name: DATABASE_URL
        secureValue: "$(DATABASE_URL)"
      - name: JWT_SECRET
        secureValue: "$(JWT_SECRET)"
      
      livenessProbe:
        httpGet:
          path: /health
          port: 3000
        initialDelaySeconds: 30
        periodSeconds: 10
      
      readinessProbe:
        httpGet:
          path: /ready
          port: 3000
        initialDelaySeconds: 5
        periodSeconds: 5
  
  osType: Linux
  restartPolicy: Always
  
  ipAddress:
    type: Public
    dnsNameLabel: fluent-app
    ports:
    - protocol: TCP
      port: 3000
  
  networkProfile:
    id: /subscriptions/{subscription-id}/resourceGroups/fluent-rg/providers/Microsoft.Network/networkProfiles/fluent-network-profile
```

### 2. AKS Deployment

```yaml
# aks-cluster.yaml
apiVersion: containerservice.azure.com/v1
kind: ManagedCluster
metadata:
  name: fluent-cluster
  location: East US
spec:
  kubernetesVersion: "1.24.6"
  dnsPrefix: fluent-cluster
  
  agentPoolProfiles:
  - name: agentpool
    count: 3
    vmSize: Standard_D2s_v3
    osType: Linux
    mode: System
    
    enableAutoScaling: true
    minCount: 2
    maxCount: 10
    
    osDiskSizeGB: 30
    osDiskType: Managed
    
    vnetSubnetID: /subscriptions/{subscription-id}/resourceGroups/fluent-rg/providers/Microsoft.Network/virtualNetworks/fluent-vnet/subnets/aks-subnet
    
    nodeLabels:
      environment: production
      role: worker
    
    nodeTaints:
    - key: "workload"
      value: "application"
      effect: "NoSchedule"
  
  networkProfile:
    networkPlugin: azure
    serviceCidr: 10.0.0.0/16
    dnsServiceIP: 10.0.0.10
    dockerBridgeCidr: 172.17.0.1/16
    outboundType: loadBalancer
    
    loadBalancerSku: standard
    
    networkPolicy: calico
  
  servicePrincipalProfile:
    clientId: "{client-id}"
    secret: "{client-secret}"
  
  addonProfiles:
    httpApplicationRouting:
      enabled: true
    omsAgent:
      enabled: true
      config:
        logAnalyticsWorkspaceResourceID: /subscriptions/{subscription-id}/resourceGroups/fluent-rg/providers/Microsoft.OperationalInsights/workspaces/fluent-workspace
    azurePolicy:
      enabled: true
    azureKeyvaultSecretsProvider:
      enabled: true
  
  enableRBAC: true
  enablePodSecurityPolicy: true
  
  apiServerAccessProfile:
    authorizedIPRanges:
    - "0.0.0.0/32"
    enablePrivateCluster: false
```

### 3. Azure Database for PostgreSQL

```yaml
# postgresql-terraform.tf
resource "azurerm_postgresql_flexible_server" "fluent_app" {
  name                   = "fluent-app-db"
  resource_group_name    = azurerm_resource_group.fluent_app.name
  location               = azurerm_resource_group.fluent_app.location
  version                = "14"
  
  delegated_subnet_id    = azurerm_subnet.database.id
  private_dns_zone_id    = azurerm_private_dns_zone.database.id
  
  administrator_login    = "fluent"
  administrator_password = var.db_password
  
  zone = "1"
  
  storage_mb = 32768
  
  sku_name = "GP_Standard_D2s_v3"
  
  backup_retention_days        = 7
  geo_redundant_backup_enabled = false
  
  high_availability {
    mode                      = "ZoneRedundant"
    standby_availability_zone = "2"
  }
  
  maintenance_window {
    day_of_week  = 0
    start_hour   = 8
    start_minute = 0
  }
  
  tags = {
    Environment = "production"
    Project     = "fluent-app"
  }
}

resource "azurerm_postgresql_flexible_server_database" "fluent_app" {
  name      = "fluent"
  server_id = azurerm_postgresql_flexible_server.fluent_app.id
  collation = "en_US.utf8"
  charset   = "utf8"
}

resource "azurerm_postgresql_flexible_server_configuration" "fluent_app" {
  name      = "log_checkpoints"
  server_id = azurerm_postgresql_flexible_server.fluent_app.id
  value     = "on"
}
```

### 4. Azure App Service

```yaml
# app-service.yaml
apiVersion: web.azure.com/v1
kind: Site
metadata:
  name: fluent-app
  location: East US
spec:
  serverFarmId: /subscriptions/{subscription-id}/resourceGroups/fluent-rg/providers/Microsoft.Web/serverfarms/fluent-app-plan
  
  siteConfig:
    linuxFxVersion: "DOCKER|yourregistry.azurecr.io/fluent-app:latest"
    alwaysOn: true
    http20Enabled: true
    minTlsVersion: "1.2"
    
    appSettings:
    - name: NODE_ENV
      value: production
    - name: PORT
      value: "3000"
    - name: DATABASE_URL
      value: "@Microsoft.KeyVault(SecretUri=https://fluent-keyvault.vault.azure.net/secrets/database-url/)"
    - name: JWT_SECRET
      value: "@Microsoft.KeyVault(SecretUri=https://fluent-keyvault.vault.azure.net/secrets/jwt-secret/)"
    
    connectionStrings:
    - name: DefaultConnection
      connectionString: "$(DATABASE_URL)"
      type: PostgreSQL
    
    healthCheckPath: "/health"
    
    ipSecurityRestrictions:
    - ipAddress: "0.0.0.0/0"
      action: Allow
      priority: 100
      name: "Allow all"
    
    cors:
      allowedOrigins:
      - "https://yourdomain.com"
      supportCredentials: true
  
  identity:
    type: SystemAssigned
  
  httpsOnly: true
  
  tags:
    Environment: production
    Project: fluent-app
```

## Multi-Cloud Deployment

### 1. Terraform Multi-Cloud Configuration

```hcl
# multi-cloud-terraform.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

provider "google" {
  project = var.gcp_project
  region  = var.gcp_region
}

provider "azurerm" {
  features {}
}

# Variables
variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "primary_cloud" {
  description = "Primary cloud provider"
  type        = string
  default     = "aws"
}

# Conditional deployment based on primary cloud
module "aws_deployment" {
  source = "./aws"
  count  = var.primary_cloud == "aws" ? 1 : 0
  
  environment = var.environment
  # ... other variables
}

module "gcp_deployment" {
  source = "./gcp"
  count  = var.primary_cloud == "gcp" ? 1 : 0
  
  environment = var.environment
  # ... other variables
}

module "azure_deployment" {
  source = "./azure"
  count  = var.primary_cloud == "azure" ? 1 : 0
  
  environment = var.environment
  # ... other variables
}
```

### 2. Cross-Cloud Networking

```yaml
# vpn-gateway.yaml
# AWS VPN Gateway
resource "aws_vpn_gateway" "fluent_app" {
  vpc_id = aws_vpc.fluent_app.id
  
  tags = {
    Name = "fluent-app-vpn-gateway"
  }
}

# GCP VPN Gateway
resource "google_compute_vpn_gateway" "fluent_app" {
  name    = "fluent-app-vpn-gateway"
  network = google_compute_network.fluent_app.id
  region  = var.gcp_region
}

# Azure VPN Gateway
resource "azurerm_virtual_network_gateway" "fluent_app" {
  name                = "fluent-app-vpn-gateway"
  location            = azurerm_resource_group.fluent_app.location
  resource_group_name = azurerm_resource_group.fluent_app.name
  
  type     = "Vpn"
  vpn_type = "RouteBased"
  
  active_active = false
  enable_bgp    = false
  sku           = "VpnGw1"
  
  ip_configuration {
    name                          = "vnetGatewayConfig"
    public_ip_address_id          = azurerm_public_ip.vpn_gateway.id
    private_ip_address_allocation = "Dynamic"
    subnet_id                     = azurerm_subnet.gateway.id
  }
}
```

## Deployment Scripts

### 1. AWS Deployment Script

```bash
#!/bin/bash
# deploy-aws.sh

set -e

CLUSTER_NAME="fluent-cluster"
SERVICE_NAME="fluent-app"
REGION="us-east-1"
IMAGE_URI="123456789012.dkr.ecr.us-east-1.amazonaws.com/fluent-app:latest"

echo "Deploying to AWS ECS..."

# Build and push Docker image
docker build -t fluent-app:latest .
docker tag fluent-app:latest $IMAGE_URI
docker push $IMAGE_URI

# Update ECS service
aws ecs update-service \
  --cluster $CLUSTER_NAME \
  --service $SERVICE_NAME \
  --force-new-deployment \
  --region $REGION

# Wait for deployment to complete
aws ecs wait services-stable \
  --cluster $CLUSTER_NAME \
  --services $SERVICE_NAME \
  --region $REGION

echo "AWS deployment completed!"
```

### 2. GCP Deployment Script

```bash
#!/bin/bash
# deploy-gcp.sh

set -e

PROJECT_ID="your-project-id"
SERVICE_NAME="fluent-app"
REGION="us-central1"
IMAGE_URI="gcr.io/$PROJECT_ID/fluent-app:latest"

echo "Deploying to Google Cloud Run..."

# Build and push Docker image
docker build -t fluent-app:latest .
docker tag fluent-app:latest $IMAGE_URI
docker push $IMAGE_URI

# Deploy to Cloud Run
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_URI \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --max-instances 10 \
  --memory 512Mi \
  --cpu 1000m \
  --project $PROJECT_ID

echo "GCP deployment completed!"
```

### 3. Azure Deployment Script

```bash
#!/bin/bash
# deploy-azure.sh

set -e

RESOURCE_GROUP="fluent-rg"
WEBAPP_NAME="fluent-app"
REGISTRY="yourregistry.azurecr.io"
IMAGE_NAME="fluent-app:latest"

echo "Deploying to Azure App Service..."

# Build and push Docker image
docker build -t $IMAGE_NAME .
docker tag $IMAGE_NAME $REGISTRY/$IMAGE_NAME
docker push $REGISTRY/$IMAGE_NAME

# Deploy to App Service
az webapp config container set \
  --name $WEBAPP_NAME \
  --resource-group $RESOURCE_GROUP \
  --docker-custom-image-name $REGISTRY/$IMAGE_NAME \
  --docker-registry-server-url https://$REGISTRY

# Restart the app service
az webapp restart \
  --name $WEBAPP_NAME \
  --resource-group $RESOURCE_GROUP

echo "Azure deployment completed!"
```

## Best Practices

### 1. Cloud-Agnostic Design
- Use containerization for portability
- Implement configuration management
- Use managed services where possible
- Design for multi-region deployments

### 2. Security
- Use managed identity services
- Implement network security
- Enable encryption at rest and in transit
- Use secrets management services

### 3. Monitoring and Observability
- Use cloud-native monitoring tools
- Implement distributed tracing
- Set up centralized logging
- Configure alerting and notifications

### 4. Cost Optimization
- Use auto-scaling features
- Implement resource tagging
- Monitor and optimize resource usage
- Use spot instances where appropriate

## Troubleshooting

### 1. Common Issues

```bash
# AWS ECS
aws ecs describe-services --cluster fluent-cluster --services fluent-app
aws logs tail /ecs/fluent-app --follow

# GCP Cloud Run
gcloud run services describe fluent-app --region us-central1
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=fluent-app"

# Azure App Service
az webapp log tail --name fluent-app --resource-group fluent-rg
az webapp show --name fluent-app --resource-group fluent-rg
```

### 2. Performance Monitoring

```bash
# AWS CloudWatch
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name CPUUtilization \
  --dimensions Name=ServiceName,Value=fluent-app \
  --start-time 2023-01-01T00:00:00Z \
  --end-time 2023-01-02T00:00:00Z \
  --period 300 \
  --statistics Average

# GCP Monitoring
gcloud monitoring metrics list --filter="resource.type=cloud_run_revision"

# Azure Monitor
az monitor metrics list --resource fluent-app --resource-group fluent-rg --resource-type Microsoft.Web/sites
```

## Deployment Checklist

- [ ] Cloud provider account and CLI configured
- [ ] Container registry set up
- [ ] Docker images built and pushed
- [ ] Infrastructure as Code configured
- [ ] Secrets and configuration managed
- [ ] Monitoring and logging configured
- [ ] Security policies implemented
- [ ] Backup and disaster recovery planned
- [ ] Cost monitoring configured
- [ ] Deployment automation implemented
- [ ] Health checks configured
- [ ] Load balancing configured

## Next Steps

1. [CI/CD Pipeline](ci-cd.md) - Automate cloud deployments
2. [Monitoring](../operations/monitoring.md) - Set up cloud monitoring
3. [Backup and Recovery](../operations/backup.md) - Implement cloud backup strategies
4. [Scaling](../operations/scaling.md) - Configure cloud auto-scaling