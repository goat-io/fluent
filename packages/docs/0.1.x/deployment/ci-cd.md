# CI/CD Pipeline Setup

This comprehensive guide covers setting up Continuous Integration and Continuous Deployment pipelines for Fluent applications across different platforms.

## Overview

CI/CD pipelines automate the build, test, and deployment process, ensuring consistent and reliable deployments. This guide covers GitHub Actions, GitLab CI, Jenkins, and cloud-specific CI/CD solutions.

## Prerequisites

- Version control system (Git)
- Container registry access
- Target deployment environment
- Testing framework configured
- Environment variables and secrets configured

## GitHub Actions

### 1. Basic CI/CD Pipeline

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

env:
  NODE_VERSION: '18'
  PNPM_VERSION: '8'

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: fluent_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
    
    - name: Setup pnpm
      uses: pnpm/action-setup@v2
      with:
        version: ${{ env.PNPM_VERSION }}
    
    - name: Get pnpm store directory
      id: pnpm-cache
      shell: bash
      run: |
        echo "STORE_PATH=$(pnpm store path)" >> $GITHUB_OUTPUT
    
    - name: Setup pnpm cache
      uses: actions/cache@v3
      with:
        path: ${{ steps.pnpm-cache.outputs.STORE_PATH }}
        key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
        restore-keys: |
          ${{ runner.os }}-pnpm-store-
    
    - name: Install dependencies
      run: pnpm install --frozen-lockfile
    
    - name: Run linting
      run: pnpm lint
    
    - name: Run type checking
      run: pnpm type-check
    
    - name: Run tests
      run: pnpm test
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/fluent_test
        REDIS_URL: redis://localhost:6379
        NODE_ENV: test
        JWT_SECRET: test-secret
    
    - name: Run coverage
      run: pnpm test:coverage
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
        flags: unittests
        name: codecov-umbrella
    
    - name: Build application
      run: pnpm build
    
    - name: Upload build artifacts
      uses: actions/upload-artifact@v3
      with:
        name: build-artifacts
        path: |
          dist/
          package.json
          pnpm-lock.yaml
        retention-days: 30

  security-scan:
    runs-on: ubuntu-latest
    needs: test
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        scan-type: 'fs'
        scan-ref: '.'
        format: 'sarif'
        output: 'trivy-results.sarif'
    
    - name: Upload Trivy scan results
      uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: 'trivy-results.sarif'
    
    - name: Audit dependencies
      run: pnpm audit --audit-level moderate

  build-and-push:
    runs-on: ubuntu-latest
    needs: [test, security-scan]
    if: github.ref == 'refs/heads/main'
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3
    
    - name: Login to Docker Hub
      uses: docker/login-action@v3
      with:
        username: ${{ secrets.DOCKER_USERNAME }}
        password: ${{ secrets.DOCKER_PASSWORD }}
    
    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ secrets.DOCKER_USERNAME }}/fluent-app
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=semver,pattern={{version}}
          type=semver,pattern={{major}}.{{minor}}
          type=sha,prefix=main-
    
    - name: Build and push Docker image
      uses: docker/build-push-action@v5
      with:
        context: .
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max
        platforms: linux/amd64,linux/arm64

  deploy-staging:
    runs-on: ubuntu-latest
    needs: build-and-push
    environment: staging
    if: github.ref == 'refs/heads/main'
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Deploy to staging
      run: |
        echo "Deploying to staging environment..."
        # Add deployment commands here
        curl -X POST "${{ secrets.STAGING_WEBHOOK_URL }}" \
          -H "Authorization: Bearer ${{ secrets.STAGING_TOKEN }}" \
          -H "Content-Type: application/json" \
          -d '{"image": "${{ secrets.DOCKER_USERNAME }}/fluent-app:main-${{ github.sha }}"}'
    
    - name: Run smoke tests
      run: |
        echo "Running smoke tests..."
        # Add smoke test commands here
        sleep 30
        curl -f "${{ secrets.STAGING_URL }}/health" || exit 1

  deploy-production:
    runs-on: ubuntu-latest
    needs: deploy-staging
    environment: production
    if: github.ref == 'refs/heads/main'
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Deploy to production
      run: |
        echo "Deploying to production environment..."
        # Add production deployment commands here
        curl -X POST "${{ secrets.PRODUCTION_WEBHOOK_URL }}" \
          -H "Authorization: Bearer ${{ secrets.PRODUCTION_TOKEN }}" \
          -H "Content-Type: application/json" \
          -d '{"image": "${{ secrets.DOCKER_USERNAME }}/fluent-app:main-${{ github.sha }}"}'
    
    - name: Run production health checks
      run: |
        echo "Running production health checks..."
        sleep 60
        curl -f "${{ secrets.PRODUCTION_URL }}/health" || exit 1
    
    - name: Notify deployment
      uses: 8398a7/action-slack@v3
      with:
        status: ${{ job.status }}
        channel: '#deployments'
        text: 'Production deployment completed successfully! 🚀'
      env:
        SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
      if: always()
```

### 2. Multi-Environment Pipeline

```yaml
# .github/workflows/multi-env.yml
name: Multi-Environment Pipeline

on:
  push:
    branches: [ main, develop, 'release/*' ]
  pull_request:
    branches: [ main, develop ]

jobs:
  determine-environment:
    runs-on: ubuntu-latest
    outputs:
      environment: ${{ steps.env.outputs.environment }}
      should-deploy: ${{ steps.env.outputs.should-deploy }}
    
    steps:
    - name: Determine environment
      id: env
      run: |
        if [[ "${{ github.ref }}" == "refs/heads/main" ]]; then
          echo "environment=production" >> $GITHUB_OUTPUT
          echo "should-deploy=true" >> $GITHUB_OUTPUT
        elif [[ "${{ github.ref }}" == "refs/heads/develop" ]]; then
          echo "environment=staging" >> $GITHUB_OUTPUT
          echo "should-deploy=true" >> $GITHUB_OUTPUT
        elif [[ "${{ github.ref }}" == refs/heads/release/* ]]; then
          echo "environment=uat" >> $GITHUB_OUTPUT
          echo "should-deploy=true" >> $GITHUB_OUTPUT
        else
          echo "environment=none" >> $GITHUB_OUTPUT
          echo "should-deploy=false" >> $GITHUB_OUTPUT
        fi

  test:
    runs-on: ubuntu-latest
    # ... (same as previous test job)

  deploy:
    runs-on: ubuntu-latest
    needs: [determine-environment, test]
    environment: ${{ needs.determine-environment.outputs.environment }}
    if: needs.determine-environment.outputs.should-deploy == 'true'
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Deploy to ${{ needs.determine-environment.outputs.environment }}
      run: |
        echo "Deploying to ${{ needs.determine-environment.outputs.environment }}"
        # Environment-specific deployment logic
        case "${{ needs.determine-environment.outputs.environment }}" in
          "production")
            echo "Production deployment"
            # Add production deployment commands
            ;;
          "staging")
            echo "Staging deployment"
            # Add staging deployment commands
            ;;
          "uat")
            echo "UAT deployment"
            # Add UAT deployment commands
            ;;
        esac
```

### 3. Kubernetes Deployment

```yaml
# .github/workflows/k8s-deploy.yml
name: Kubernetes Deployment

on:
  push:
    branches: [ main ]

jobs:
  deploy-k8s:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Setup kubectl
      uses: azure/setup-kubectl@v3
      with:
        version: 'v1.24.0'
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-east-1
    
    - name: Update kubeconfig
      run: |
        aws eks update-kubeconfig --region us-east-1 --name fluent-cluster
    
    - name: Deploy to Kubernetes
      run: |
        # Update image tag in deployment
        sed -i 's|IMAGE_TAG|${{ github.sha }}|g' k8s/deployment.yaml
        
        # Apply Kubernetes manifests
        kubectl apply -f k8s/namespace.yaml
        kubectl apply -f k8s/configmap.yaml
        kubectl apply -f k8s/secrets.yaml
        kubectl apply -f k8s/deployment.yaml
        kubectl apply -f k8s/service.yaml
        kubectl apply -f k8s/ingress.yaml
        
        # Wait for deployment to complete
        kubectl rollout status deployment/fluent-app -n fluent-app --timeout=300s
    
    - name: Verify deployment
      run: |
        kubectl get pods -n fluent-app
        kubectl get services -n fluent-app
        kubectl get ingress -n fluent-app
```

## GitLab CI/CD

### 1. GitLab CI Configuration

```yaml
# .gitlab-ci.yml
stages:
  - test
  - build
  - deploy-staging
  - deploy-production

variables:
  DOCKER_DRIVER: overlay2
  DOCKER_TLS_CERTDIR: "/certs"
  NODE_VERSION: "18"
  PNPM_VERSION: "8"

# Cache configuration
cache:
  paths:
    - node_modules/
    - .pnpm-store/

# Services for testing
services:
  - postgres:14
  - redis:7-alpine

# Environment variables for testing
variables:
  POSTGRES_DB: fluent_test
  POSTGRES_USER: postgres
  POSTGRES_PASSWORD: postgres
  REDIS_URL: redis://redis:6379
  DATABASE_URL: postgresql://postgres:postgres@postgres:5432/fluent_test

# Test stage
test:
  stage: test
  image: node:18-alpine
  before_script:
    - npm install -g pnpm@$PNPM_VERSION
    - pnpm config set store-dir .pnpm-store
    - pnpm install --frozen-lockfile
  script:
    - pnpm lint
    - pnpm type-check
    - pnpm test
    - pnpm test:coverage
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
    paths:
      - coverage/
    expire_in: 1 week
  coverage: '/Lines\s*:\s*(\d+\.\d+)%/'

# Security scanning
security-scan:
  stage: test
  image: alpine:latest
  before_script:
    - apk add --no-cache curl
    - curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin
  script:
    - trivy fs --exit-code 0 --format template --template "@contrib/sarif.tpl" -o trivy-results.sarif .
    - trivy fs --exit-code 1 --severity HIGH,CRITICAL .
  artifacts:
    reports:
      sast: trivy-results.sarif
    expire_in: 1 week
  allow_failure: true

# Build stage
build:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker build -t $CI_REGISTRY_IMAGE:latest .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
    - docker push $CI_REGISTRY_IMAGE:latest
  only:
    - main
    - develop

# Deploy to staging
deploy-staging:
  stage: deploy-staging
  image: alpine:latest
  environment:
    name: staging
    url: https://staging.yourdomain.com
  before_script:
    - apk add --no-cache curl
  script:
    - |
      curl -X POST "$STAGING_WEBHOOK_URL" \
        -H "Authorization: Bearer $STAGING_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"image\": \"$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA\"}"
    - sleep 30
    - curl -f "$STAGING_URL/health" || exit 1
  only:
    - develop

# Deploy to production
deploy-production:
  stage: deploy-production
  image: alpine:latest
  environment:
    name: production
    url: https://yourdomain.com
  before_script:
    - apk add --no-cache curl
  script:
    - |
      curl -X POST "$PRODUCTION_WEBHOOK_URL" \
        -H "Authorization: Bearer $PRODUCTION_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"image\": \"$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA\"}"
    - sleep 60
    - curl -f "$PRODUCTION_URL/health" || exit 1
  when: manual
  only:
    - main
```

### 2. GitLab CI with Kubernetes

```yaml
# .gitlab-ci.yml (Kubernetes deployment)
deploy-k8s:
  stage: deploy-production
  image: bitnami/kubectl:latest
  environment:
    name: production
    url: https://yourdomain.com
  before_script:
    - kubectl config use-context $KUBE_CONTEXT
  script:
    - |
      # Update image tag
      sed -i "s|IMAGE_TAG|$CI_COMMIT_SHA|g" k8s/deployment.yaml
      
      # Apply manifests
      kubectl apply -f k8s/
      
      # Wait for deployment
      kubectl rollout status deployment/fluent-app -n fluent-app --timeout=300s
      
      # Verify deployment
      kubectl get pods -n fluent-app
  only:
    - main
```

## Jenkins Pipeline

### 1. Declarative Pipeline

```groovy
// Jenkinsfile
pipeline {
    agent any
    
    environment {
        NODE_VERSION = '18'
        PNPM_VERSION = '8'
        DOCKER_REGISTRY = 'your-registry.com'
        IMAGE_NAME = 'fluent-app'
        KUBECONFIG = credentials('kubeconfig')
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        
        stage('Setup') {
            steps {
                sh '''
                    # Install Node.js
                    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
                    sudo apt-get install -y nodejs
                    
                    # Install pnpm
                    npm install -g pnpm@${PNPM_VERSION}
                    
                    # Install dependencies
                    pnpm install --frozen-lockfile
                '''
            }
        }
        
        stage('Test') {
            parallel {
                stage('Lint') {
                    steps {
                        sh 'pnpm lint'
                    }
                }
                
                stage('Type Check') {
                    steps {
                        sh 'pnpm type-check'
                    }
                }
                
                stage('Unit Tests') {
                    steps {
                        sh 'pnpm test'
                    }
                    post {
                        always {
                            publishTestResults testResultsPattern: 'test-results.xml'
                            publishCoverage adapters: [
                                coberturaAdapter('coverage/cobertura-coverage.xml')
                            ]
                        }
                    }
                }
            }
        }
        
        stage('Security Scan') {
            steps {
                sh '''
                    # Install Trivy
                    curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin
                    
                    # Run security scan
                    trivy fs --exit-code 0 --format template --template "@contrib/sarif.tpl" -o trivy-results.sarif .
                    trivy fs --exit-code 1 --severity HIGH,CRITICAL .
                '''
            }
            post {
                always {
                    recordIssues enabledForFailure: true, tools: [sarif(pattern: 'trivy-results.sarif')]
                }
            }
        }
        
        stage('Build') {
            steps {
                sh 'pnpm build'
            }
            post {
                success {
                    archiveArtifacts artifacts: 'dist/**/*', fingerprint: true
                }
            }
        }
        
        stage('Docker Build') {
            when {
                branch 'main'
            }
            steps {
                script {
                    def image = docker.build("${DOCKER_REGISTRY}/${IMAGE_NAME}:${env.BUILD_NUMBER}")
                    docker.withRegistry('https://' + DOCKER_REGISTRY, 'docker-registry-credentials') {
                        image.push()
                        image.push('latest')
                    }
                }
            }
        }
        
        stage('Deploy to Staging') {
            when {
                branch 'develop'
            }
            steps {
                sh '''
                    # Deploy to staging
                    curl -X POST "$STAGING_WEBHOOK_URL" \
                        -H "Authorization: Bearer $STAGING_TOKEN" \
                        -H "Content-Type: application/json" \
                        -d "{\\"image\\": \\"${DOCKER_REGISTRY}/${IMAGE_NAME}:${BUILD_NUMBER}\\"}"
                    
                    # Wait and verify
                    sleep 30
                    curl -f "$STAGING_URL/health" || exit 1
                '''
            }
        }
        
        stage('Deploy to Production') {
            when {
                branch 'main'
            }
            steps {
                input message: 'Deploy to production?', ok: 'Deploy'
                
                sh '''
                    # Update Kubernetes deployment
                    sed -i "s|IMAGE_TAG|${BUILD_NUMBER}|g" k8s/deployment.yaml
                    
                    # Apply manifests
                    kubectl apply -f k8s/
                    
                    # Wait for deployment
                    kubectl rollout status deployment/fluent-app -n fluent-app --timeout=300s
                    
                    # Verify deployment
                    kubectl get pods -n fluent-app
                '''
            }
        }
    }
    
    post {
        always {
            cleanWs()
        }
        
        success {
            slackSend(
                channel: '#deployments',
                color: 'good',
                message: "✅ Build ${env.BUILD_NUMBER} succeeded for ${env.JOB_NAME}"
            )
        }
        
        failure {
            slackSend(
                channel: '#deployments',
                color: 'danger',
                message: "❌ Build ${env.BUILD_NUMBER} failed for ${env.JOB_NAME}"
            )
        }
    }
}
```

### 2. Pipeline as Code (Multibranch)

```groovy
// Jenkinsfile (multibranch)
@Library('fluent-pipeline-library') _

pipeline {
    agent any
    
    parameters {
        booleanParam(
            name: 'SKIP_TESTS',
            defaultValue: false,
            description: 'Skip test execution'
        )
        choice(
            name: 'DEPLOYMENT_ENV',
            choices: ['staging', 'production'],
            description: 'Target deployment environment'
        )
    }
    
    stages {
        stage('Preparation') {
            steps {
                script {
                    // Determine environment based on branch
                    if (env.BRANCH_NAME == 'main') {
                        env.DEPLOY_ENV = 'production'
                    } else if (env.BRANCH_NAME == 'develop') {
                        env.DEPLOY_ENV = 'staging'
                    } else {
                        env.DEPLOY_ENV = 'none'
                    }
                }
            }
        }
        
        stage('Build and Test') {
            steps {
                buildAndTest([
                    nodeVersion: '18',
                    pnpmVersion: '8',
                    skipTests: params.SKIP_TESTS
                ])
            }
        }
        
        stage('Deploy') {
            when {
                anyOf {
                    branch 'main'
                    branch 'develop'
                }
            }
            steps {
                deployToEnvironment([
                    environment: env.DEPLOY_ENV,
                    imageTag: env.BUILD_NUMBER
                ])
            }
        }
    }
}
```

## Cloud-Specific CI/CD

### 1. AWS CodePipeline

```yaml
# buildspec.yml
version: 0.2

phases:
  install:
    runtime-versions:
      nodejs: 18
    commands:
      - npm install -g pnpm@8
      
  pre_build:
    commands:
      - echo Logging in to Amazon ECR...
      - aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com
      - REPOSITORY_URI=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/fluent-app
      - COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)
      - IMAGE_TAG=${COMMIT_HASH:=latest}
      
  build:
    commands:
      - echo Build started on `date`
      - echo Installing dependencies...
      - pnpm install --frozen-lockfile
      - echo Running tests...
      - pnpm test
      - echo Building application...
      - pnpm build
      - echo Building Docker image...
      - docker build -t $REPOSITORY_URI:latest .
      - docker tag $REPOSITORY_URI:latest $REPOSITORY_URI:$IMAGE_TAG
      
  post_build:
    commands:
      - echo Build completed on `date`
      - echo Pushing Docker image...
      - docker push $REPOSITORY_URI:latest
      - docker push $REPOSITORY_URI:$IMAGE_TAG
      - echo Writing image definitions file...
      - printf '[{"name":"fluent-app","imageUri":"%s"}]' $REPOSITORY_URI:$IMAGE_TAG > imagedefinitions.json

artifacts:
  files:
    - imagedefinitions.json
    - k8s/**/*
```

### 2. Google Cloud Build

```yaml
# cloudbuild.yaml
steps:
  # Install dependencies
  - name: 'node:18'
    entrypoint: 'bash'
    args:
      - '-c'
      - |
        npm install -g pnpm@8
        pnpm install --frozen-lockfile
  
  # Run tests
  - name: 'node:18'
    entrypoint: 'bash'
    args:
      - '-c'
      - |
        npm install -g pnpm@8
        pnpm test
    env:
      - 'NODE_ENV=test'
      - 'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fluent_test'
  
  # Build application
  - name: 'node:18'
    entrypoint: 'bash'
    args:
      - '-c'
      - |
        npm install -g pnpm@8
        pnpm build
  
  # Build Docker image
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - 'gcr.io/$PROJECT_ID/fluent-app:$COMMIT_SHA'
      - '-t'
      - 'gcr.io/$PROJECT_ID/fluent-app:latest'
      - '.'
  
  # Push to Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - 'gcr.io/$PROJECT_ID/fluent-app:$COMMIT_SHA'
  
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - 'gcr.io/$PROJECT_ID/fluent-app:latest'
  
  # Deploy to Cloud Run
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'fluent-app'
      - '--image'
      - 'gcr.io/$PROJECT_ID/fluent-app:$COMMIT_SHA'
      - '--region'
      - 'us-central1'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'

options:
  logging: CLOUD_LOGGING_ONLY
  machineType: 'E2_HIGHCPU_8'

timeout: '1200s'
```

### 3. Azure DevOps

```yaml
# azure-pipelines.yml
trigger:
  branches:
    include:
      - main
      - develop

variables:
  - group: fluent-app-variables
  - name: imageRepository
    value: 'fluent-app'
  - name: dockerfilePath
    value: '$(Build.SourcesDirectory)/Dockerfile'
  - name: tag
    value: '$(Build.BuildId)'

stages:
  - stage: Test
    displayName: 'Test stage'
    jobs:
      - job: Test
        displayName: 'Test job'
        pool:
          vmImage: 'ubuntu-latest'
        
        services:
          postgres:
            image: postgres:14
            env:
              POSTGRES_PASSWORD: postgres
              POSTGRES_DB: fluent_test
            ports:
              - 5432:5432
          
          redis:
            image: redis:7-alpine
            ports:
              - 6379:6379
        
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: '18.x'
            displayName: 'Install Node.js'
          
          - script: |
              npm install -g pnpm@8
              pnpm install --frozen-lockfile
            displayName: 'Install dependencies'
          
          - script: |
              pnpm lint
              pnpm type-check
            displayName: 'Run linting and type checking'
          
          - script: |
              pnpm test
            displayName: 'Run tests'
            env:
              DATABASE_URL: postgresql://postgres:postgres@localhost:5432/fluent_test
              REDIS_URL: redis://localhost:6379
              NODE_ENV: test
          
          - script: |
              pnpm build
            displayName: 'Build application'
          
          - task: PublishTestResults@2
            inputs:
              testRunner: JUnit
              testResultsFiles: 'test-results.xml'
            displayName: 'Publish test results'
          
          - task: PublishCodeCoverageResults@1
            inputs:
              codeCoverageTool: Cobertura
              summaryFileLocation: 'coverage/cobertura-coverage.xml'
            displayName: 'Publish coverage results'

  - stage: Build
    displayName: 'Build stage'
    dependsOn: Test
    condition: and(succeeded(), in(variables['Build.SourceBranch'], 'refs/heads/main', 'refs/heads/develop'))
    jobs:
      - job: Build
        displayName: 'Build job'
        pool:
          vmImage: 'ubuntu-latest'
        
        steps:
          - task: Docker@2
            displayName: 'Build and push image'
            inputs:
              command: buildAndPush
              repository: $(imageRepository)
              dockerfile: $(dockerfilePath)
              containerRegistry: $(dockerRegistryServiceConnection)
              tags: |
                $(tag)
                latest

  - stage: Deploy
    displayName: 'Deploy stage'
    dependsOn: Build
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
    jobs:
      - deployment: Deploy
        displayName: 'Deploy job'
        pool:
          vmImage: 'ubuntu-latest'
        environment: 'production'
        strategy:
          runOnce:
            deploy:
              steps:
                - task: KubernetesManifest@0
                  displayName: 'Deploy to Kubernetes'
                  inputs:
                    action: deploy
                    kubernetesServiceConnection: $(kubernetesServiceConnection)
                    namespace: fluent-app
                    manifests: |
                      $(Pipeline.Workspace)/manifests/deployment.yaml
                      $(Pipeline.Workspace)/manifests/service.yaml
                    containers: |
                      $(containerRegistry)/$(imageRepository):$(tag)
```

## Advanced CI/CD Features

### 1. Blue-Green Deployment

```yaml
# blue-green-deployment.yml
name: Blue-Green Deployment

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout
      uses: actions/checkout@v4
    
    - name: Determine current environment
      id: current-env
      run: |
        CURRENT=$(kubectl get service fluent-app-active -o jsonpath='{.spec.selector.version}')
        if [ "$CURRENT" == "blue" ]; then
          echo "target=green" >> $GITHUB_OUTPUT
          echo "current=blue" >> $GITHUB_OUTPUT
        else
          echo "target=blue" >> $GITHUB_OUTPUT
          echo "current=green" >> $GITHUB_OUTPUT
        fi
    
    - name: Deploy to target environment
      run: |
        # Update deployment with new image
        kubectl set image deployment/fluent-app-${{ steps.current-env.outputs.target }} \
          fluent-app=${{ secrets.DOCKER_USERNAME }}/fluent-app:${{ github.sha }}
        
        # Wait for deployment to complete
        kubectl rollout status deployment/fluent-app-${{ steps.current-env.outputs.target }} --timeout=300s
    
    - name: Run smoke tests
      run: |
        # Test the target environment
        kubectl port-forward service/fluent-app-${{ steps.current-env.outputs.target }} 8080:80 &
        sleep 10
        curl -f http://localhost:8080/health || exit 1
        pkill -f "kubectl port-forward"
    
    - name: Switch traffic
      run: |
        # Update active service to point to new deployment
        kubectl patch service fluent-app-active -p '{"spec":{"selector":{"version":"${{ steps.current-env.outputs.target }}"}}}'
        
        # Verify traffic switch
        sleep 30
        curl -f ${{ secrets.PRODUCTION_URL }}/health || exit 1
    
    - name: Scale down old environment
      run: |
        # Scale down the old deployment
        kubectl scale deployment fluent-app-${{ steps.current-env.outputs.current }} --replicas=0
```

### 2. Canary Deployment

```yaml
# canary-deployment.yml
name: Canary Deployment

on:
  push:
    branches: [ main ]

jobs:
  canary-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout
      uses: actions/checkout@v4
    
    - name: Deploy canary version
      run: |
        # Deploy canary with 10% traffic
        kubectl set image deployment/fluent-app-canary \
          fluent-app=${{ secrets.DOCKER_USERNAME }}/fluent-app:${{ github.sha }}
        
        kubectl rollout status deployment/fluent-app-canary --timeout=300s
        
        # Update traffic split (90% stable, 10% canary)
        kubectl apply -f - <<EOF
        apiVersion: argoproj.io/v1alpha1
        kind: Rollout
        metadata:
          name: fluent-app
        spec:
          strategy:
            canary:
              steps:
              - setWeight: 10
              - pause: {duration: 5m}
              - setWeight: 50
              - pause: {duration: 5m}
              - setWeight: 100
        EOF
    
    - name: Monitor canary metrics
      run: |
        # Monitor error rates and response times
        sleep 300  # Wait 5 minutes
        
        # Check error rate (should be < 1%)
        ERROR_RATE=$(curl -s "${{ secrets.PROMETHEUS_URL }}/api/v1/query?query=rate(http_requests_total{status=~\"5..\"}[5m])" | jq -r '.data.result[0].value[1]')
        
        if (( $(echo "$ERROR_RATE > 0.01" | bc -l) )); then
          echo "High error rate detected: $ERROR_RATE"
          exit 1
        fi
    
    - name: Promote canary
      run: |
        # If metrics are good, promote canary to stable
        kubectl patch rollout fluent-app -p '{"spec":{"strategy":{"canary":{"steps":[{"setWeight":100}]}}}}'
        
        # Wait for full rollout
        kubectl rollout status rollout/fluent-app --timeout=300s
```

### 3. Rollback Strategy

```yaml
# rollback.yml
name: Rollback

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to rollback'
        required: true
        default: 'production'
        type: choice
        options:
          - staging
          - production
      revision:
        description: 'Revision to rollback to'
        required: false
        default: '1'

jobs:
  rollback:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    
    steps:
    - name: Checkout
      uses: actions/checkout@v4
    
    - name: Rollback deployment
      run: |
        # Rollback to previous revision
        kubectl rollout undo deployment/fluent-app -n fluent-app --to-revision=${{ inputs.revision }}
        
        # Wait for rollback to complete
        kubectl rollout status deployment/fluent-app -n fluent-app --timeout=300s
    
    - name: Verify rollback
      run: |
        # Verify application is healthy
        sleep 60
        curl -f "${{ secrets.PRODUCTION_URL }}/health" || exit 1
    
    - name: Notify rollback
      uses: 8398a7/action-slack@v3
      with:
        status: 'success'
        text: 'Rollback completed for ${{ inputs.environment }} environment'
      env:
        SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

## Best Practices

### 1. Pipeline Configuration
- Use environment-specific configurations
- Implement proper secret management
- Use caching for dependencies
- Implement parallel execution where possible

### 2. Testing Strategy
- Run unit tests in every pipeline
- Implement integration tests for critical paths
- Use smoke tests for deployment verification
- Implement security scanning

### 3. Deployment Strategy
- Use blue-green or canary deployments for zero-downtime
- Implement automated rollback on failure
- Use feature flags for gradual rollouts
- Monitor deployment metrics

### 4. Security
- Scan dependencies for vulnerabilities
- Use signed commits and images
- Implement least privilege access
- Rotate secrets regularly

## Troubleshooting

### 1. Common Issues

```bash
# GitHub Actions debugging
gh run list --workflow=ci-cd.yml
gh run view <run-id>
gh run logs <run-id>

# GitLab CI debugging
gitlab-ci-multi-runner exec docker test
gitlab-ci-multi-runner exec docker build

# Jenkins debugging
# Check build logs in Jenkins UI
# Use pipeline replay feature for debugging
```

### 2. Pipeline Optimization

```yaml
# Optimize build times
- name: Cache dependencies
  uses: actions/cache@v3
  with:
    path: ~/.pnpm-store
    key: ${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}

# Parallel execution
jobs:
  test:
    strategy:
      matrix:
        node-version: [16, 18, 20]
    runs-on: ubuntu-latest
    steps:
      # ... test steps
```

## Deployment Checklist

- [ ] CI/CD platform configured
- [ ] Pipeline files created and tested
- [ ] Environment variables and secrets configured
- [ ] Test suite comprehensive and fast
- [ ] Security scanning implemented
- [ ] Deployment strategies defined
- [ ] Rollback procedures tested
- [ ] Monitoring and alerting configured
- [ ] Documentation updated
- [ ] Team training completed

## Next Steps

1. [Operations Monitoring](../operations/monitoring.md) - Set up comprehensive monitoring
2. [Backup and Recovery](../operations/backup.md) - Implement backup strategies
3. [Troubleshooting](../troubleshooting/common-issues.md) - Debug deployment issues
4. [Scaling](../operations/scaling.md) - Implement auto-scaling