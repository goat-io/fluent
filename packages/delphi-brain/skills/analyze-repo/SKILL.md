---
name: analyze-repo
description: Deep-dive analysis of a the company GitHub repository. Produces a structured catalog entry for the knowledge base. Use when analyzing any repo from the company's org.
when_to_use: "analyze repo", "document repo", "catalog repo", "deep dive", "repo analysis"
argument-hint: "<repo-name> [depth: p0|p1|p2|p3]"
allowed-tools: Bash Glob Grep Read Write Edit Agent
effort: max
---

# Repository Analysis Methodology

You are analyzing a repository from the company's GitHub organization to produce a structured catalog entry for the company knowledge base at `/Users/igca/Documents/Code/example/`.

## Input

- `$ARGUMENTS` — repo name (e.g. `cp-aurora-backend`) and optional depth level
- If no depth given, default to `p1`

## Depth Levels

| Level | When | What to capture |
|-------|------|-----------------|
| **p0** | Core production services (business-critical) | EVERYTHING. Every API endpoint, every DB table, every inter-service call, every business flow, every config option. Line-level evidence. |
| **p1** | Production tools, active libs, supporting services | Full structure, all APIs, dependencies, deployment. Key business logic. |
| **p2** | Prototype, sunset, low-activity | Purpose, tech stack, structure overview, why it exists, archive-or-keep recommendation. |
| **p3** | Dead, legacy, labs, recruiting | One paragraph. What it was. Archive recommendation. |

## Output Structure

Each analyzed repo gets its own folder with up to three files:

```
catalog/repos/<repo-name>/
  README.md          # Catalog entry — the main analysis document
  catalog-info.json       # Service spec — structured metadata for Brain (JSON)
  openapi.json       # API surface — OpenAPI 3.1 stub (JSON, only if repo exposes HTTP/GraphQL APIs)
```

All files written to `/Users/igca/Documents/Code/example/catalog/repos/<repo-name>/`.

All structured data uses **JSON** (not YAML). JSON is what Brain serves via the API — no conversion needed, native Go support, no parser ambiguity.

### Convention in analyzed repos

Teams can also place a `.brain/` folder at the root of their own repo:

```
<their-repo>/
  .brain/
    spec.json        # Same format as catalog-info.json — team-owned metadata
```

Brain reads `.brain/spec.json` from each repo via the GitHub API during `brain repo sync`. The catalog `catalog-info.json` is the agent's assessment; the repo's `.brain/spec.json` is the team's declaration. Team declarations take priority.

---

## Phase 0: Clone and Orient (all depths)

1. **Check if already cloned** in the Brain repos directory first:
   ```
   ls /Users/igca/Documents/Code/example/repos/<repo-name>/
   ```
   If it exists, use it. If not, clone it using Brain CLI:
   ```
   cd /Users/igca/Documents/Code/example/brain/cli && go run . clone repo <repo-name>
   ```
   This clones to `repos/<repo-name>/` with `--depth=1` and registers it in the database.

   For p0 depth, you need full history — clone manually:
   ```
   gh repo clone the company/<repo-name> /Users/igca/Documents/Code/example/repos/<repo-name>
   ```

   **For inter-dependency analysis**, other the company repos may already be cloned in `repos/`. Check there first before cloning additional repos. You can list what's available:
   ```
   cd /Users/igca/Documents/Code/example/brain/cli && go run . repo list --cloned
   ```

2. Gather basic facts:
   - `ls -la` root directory
   - Read `README.md` if exists
   - Read `package.json`, `pom.xml`, `build.gradle`, `requirements.txt`, `Cargo.toml`, `*.csproj`, `go.mod` — whichever applies
   - Read `Dockerfile`, `docker-compose.yml` if exist
   - Read `.github/workflows/*.yml` for CI/CD
   - `git log --oneline -20` for recent activity
   - `git log --oneline --since="2025-01-01" | wc -l` for activity level

3. Map directory tree (depth 3):
   ```
   find . -type f -not -path './.git/*' -not -path '*/node_modules/*' -not -path '*/target/*' -not -path '*/dist/*' -not -path '*/__pycache__/*' | head -500
   ```

4. Count lines of code:
   ```
   find . -type f -not -path './.git/*' -not -path '*/node_modules/*' -not -path '*/target/*' \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.java' -o -name '*.py' -o -name '*.cs' -o -name '*.c' -o -name '*.h' -o -name '*.go' -o -name '*.rs' -o -name '*.vue' -o -name '*.sql' \) | xargs wc -l 2>/dev/null | tail -1
   ```

---

## Phase 1: Tech Stack Identification (all depths)

Identify and record:

| What | Where to look |
|------|--------------|
| Primary language(s) | File extensions, build configs |
| Framework | package.json deps, pom.xml deps, imports |
| Runtime | Dockerfile base image, engine field |
| Database | Connection strings, ORM configs, migration files |
| Message broker | Kafka/SQS/SNS/RabbitMQ references in code or config |
| Cloud services | AWS SDK usage, terraform files, CloudFormation |
| Auth mechanism | JWT, OAuth, API keys — check middleware/interceptors |

---

## Phase 2: Architecture Analysis (p0, p1, p2)

### 2.1 Entry Points

Find the application entry point(s):
- **Node/TS:** `main` field in package.json, or `src/index.ts`, `src/main.ts`, `src/server.ts`, `src/app.ts`
- **Java:** `@SpringBootApplication`, `public static void main`, `Application.java`
- **Python:** `__main__.py`, `app.py`, `main.py`, `wsgi.py`, `manage.py`
- **C#:** `Program.cs`, `Startup.cs`
- **Go:** `main.go`, `cmd/*/main.go`
- **C:** `main.c`, Makefile targets

Read the entry point. Trace the bootstrap sequence: what gets initialized, what services start, what ports open.

### 2.2 Internal Structure

Map the top-level modules/packages:
```
ls -d src/*/  OR  ls -d */src/  OR  ls -d lib/*/
```

For each major module, read its index/barrel file to understand what it exports.

Identify the architectural pattern:
- MVC / Controller-Service-Repository
- Clean Architecture / Hexagonal
- Event-driven / CQRS
- Monolith / Microservice / Serverless (Lambda)
- Embedded (bare-metal, RTOS, HAL layers)

### 2.3 Configuration

Find all configuration sources:
- Environment variables: grep for `process.env`, `os.environ`, `System.getenv`, `@Value`, `os.Getenv`
- Config files: `.env.example`, `config/`, `application.yml`, `application.properties`, `appsettings.json`
- Feature flags, secrets references

**List every environment variable** the service reads. This is critical for understanding deployment and inter-service wiring.

---

## Phase 3: API Surface — What This Service PROVIDES (p0, p1)

### 3.1 HTTP/REST APIs

Find route definitions:
- **Express/Koa:** grep for `router.get`, `router.post`, `app.get`, `app.post`, `.route(`
- **Spring:** grep for `@GetMapping`, `@PostMapping`, `@RequestMapping`, `@RestController`
- **Flask/FastAPI:** grep for `@app.route`, `@router.get`, `@app.get`
- **ASP.NET:** grep for `[HttpGet]`, `[HttpPost]`, `[Route(`, `MapGet`, `MapPost`
- **Go:** grep for `http.HandleFunc`, `mux.Handle`, `gin.GET`

For each endpoint found, record:
- HTTP method + path
- Request body / query params (from types, validators, or decorators)
- Response shape (from return types or serializers)
- Auth requirement (middleware applied)
- File path and line number

### 3.2 GraphQL APIs

- Find schema files: `*.graphql`, `*.gql`
- Find resolvers: grep for `@Resolver`, `resolvers`, `typeDefs`
- List queries, mutations, subscriptions

### 3.3 WebSocket / Real-time

- grep for `socket.io`, `ws`, `WebSocket`, `@WebSocketGateway`, `STOMP`
- Document events emitted and consumed

### 3.4 gRPC / Protocol Buffers

- Find `*.proto` files
- List service definitions and RPCs

### 3.5 TCP / Custom Protocols

- grep for `net.createServer`, `ServerSocket`, `socket.bind`
- Document protocol format if custom (common in IoT/embedded repos)

### 3.6 CLI Interface

- If the repo is a CLI tool, document commands, flags, and arguments

### 3.7 Exported Libraries

- If the repo is a library (npm package, Maven artifact, pip package), document the public API: exported functions, classes, types

---

## Phase 4: Dependency Graph — EXHAUSTIVE (p0, p1)

**This is the most critical phase.** We are untangling a jungle of 171 interconnected repos. Every dependency you miss is a hidden coupling that will bite during the transformation. Go through every line of code that imports, calls, or connects to anything external.

### 4.0 Package Dependencies — Read EVERY manifest

Start with the dependency manifest. Read the ENTIRE file, not just a summary.

| Language | Files to read COMPLETELY |
|----------|------------------------|
| **Node/TS** | `package.json` (dependencies AND devDependencies), `package-lock.json` (check for workspace refs), `yarn.lock` |
| **Java** | `pom.xml` (every `<dependency>`), `build.gradle` / `build.gradle.kts`, `settings.gradle` (multi-module?) |
| **Python** | `requirements.txt`, `setup.py`, `setup.cfg`, `pyproject.toml`, `Pipfile` |
| **Go** | `go.mod` (every `require`), check for internal the company module imports |
| **C#/.NET** | `*.csproj` (every `<PackageReference>`), `packages.config`, `Directory.Build.props` |
| **C/C++** | `CMakeLists.txt`, `Makefile`, `*.mk`, `conanfile.txt`, `vcpkg.json` |
| **Rust** | `Cargo.toml` (every `[dependencies]` entry) |

For EACH dependency found, classify it:

| Category | Examples | Why it matters |
|----------|---------|----------------|
| **the company internal** | `@example/*`, any `github.com/the company/*` import | Direct inter-repo coupling |
| **Framework** | express, spring-boot, flask, nestjs | Defines the architecture |
| **Database driver** | mongoose, pg, mysql2, typeorm, prisma | Reveals data dependencies |
| **Message broker client** | amqplib, rhea, aws-sdk SQS/SNS, kafkajs | Reveals async dependencies |
| **Cloud SDK** | aws-sdk, @aws-sdk/*, google-cloud/* | Reveals infra dependencies |
| **Auth library** | passport, keycloak-connect, jsonwebtoken, firebase-admin | Reveals auth chain |
| **HTTP client** | axios, node-fetch, got, RestTemplate, requests | Service-to-service calls |
| **Shared internal lib** | cp-cloudplatform-layer-*, shared-*, common-* | Hidden coupling |

**Pay special attention to the company internal packages.** These are the inter-repo dependencies that define the actual dependency graph. grep for:
```bash
grep -r "example\|the company\|@example\|cp-cloudplatform\|cp-common" package.json pom.xml go.mod requirements.txt *.csproj 2>/dev/null
```

### 4.1 HTTP Clients — Trace EVERY outbound call

Don't just grep for HTTP clients — **read the actual call sites** and determine the target service.

```bash
# Find all outbound HTTP calls
grep -rn "fetch(\|axios\.\|http\.get\|http\.post\|HttpClient\|RestTemplate\|WebClient\|requests\.\(get\|post\|put\|delete\)\|urllib\|http\.NewRequest\|got\(\|superagent" --include="*.ts" --include="*.js" --include="*.java" --include="*.py" --include="*.go" --include="*.cs" .
```

For EACH call found:
1. **Read the surrounding code** — what URL is being called? Is it hardcoded or from env/config?
2. **Trace the URL** — map it to a the company service or external API
3. **Check the env vars** — URLs often come from `process.env.ICO_URL`, `process.env.IOT_BACKEND_URL` etc.
4. **Record the direction** — who calls whom, on what path, with what auth

Common the company inter-service URL patterns:
- `*icareonline*`, `*ico*` → ICO
- `*460*`, `*example-460*` → 460-service
- `*generic-iot*`, `*iot-backend*` → IoT backend
- `*caronte*`, `*aurora*` → ICC platform
- `*icare-plus*`, `*icp*` → ICP app
- `*keycloak*`, `*account.brain*` → Keycloak
- `*sendmessage*` → sendmessage-service

### 4.2 Database Connections — Find EVERY data store

```bash
# Connection strings and database references
grep -rn "mongodb\|mongoose\|MONGO\|postgres\|pg\.\|sequelize\|typeorm\|prisma\|dynamodb\|DynamoDB\|DocumentClient\|firestore\|Firestore\|redis\|Redis\|ElastiCache\|sql\.Open\|sqlx\|MSSQL\|SqlServer\|mariadb\|mysql" --include="*.ts" --include="*.js" --include="*.java" --include="*.py" --include="*.go" --include="*.cs" --include="*.yml" --include="*.yaml" --include="*.json" .
```

For each data store:
1. What database type and name?
2. Which tables/collections/keys does this service read from? Write to?
3. Is this the owner of the data, or is it reading someone else's database?
4. Is there schema sharing (multiple services hitting the same DB)?

### 4.3 Message Queues / Events — Find EVERY queue and topic

```bash
# Message broker usage
grep -rn "SQS\|SNS\|amqp\|amqplib\|rhea\|artemis\|jms\|JMS\|kafka\|KafkaProducer\|KafkaConsumer\|MSMQ\|EventBridge\|eventbridge\|publish\|subscribe\|sendMessage\|receiveMessage" --include="*.ts" --include="*.js" --include="*.java" --include="*.py" --include="*.go" --include="*.cs" .
```

For each queue/topic:
1. What is the queue/topic name? (look for it in code AND in env vars AND in IaC)
2. Does this service PRODUCE or CONSUME?
3. What message format? (look for serializers, message types, schemas)
4. Who is on the other end? (trace the queue name to find the consumer/producer)

### 4.4 Cloud Service Dependencies

```bash
# AWS services
grep -rn "S3\|s3\.\|putObject\|getObject\|Lambda\|lambda\.invoke\|SES\|sendEmail\|CloudWatch\|putMetric\|Secrets\|SSM\|Parameter\|DynamoDB\|Cognito\|API Gateway\|ECS\|EKS\|ECR\|Transit\|EventBridge" --include="*.ts" --include="*.js" --include="*.java" --include="*.py" --include="*.go" .

# GCP services
grep -rn "firestore\|Firestore\|CloudFunction\|cloud\.google\|firebase\|FCM\|pubsub" --include="*.ts" --include="*.js" --include="*.java" --include="*.py" .
```

### 4.5 External Third-Party APIs

```bash
grep -rn "twilio\|sendgrid\|stripe\|apns\|APNs\|FCM\|firebase\|google.*maps\|google.*geocod\|sentry\|datadog\|opsgenie\|generic\.se\|vodafone\|maingate\|navision\|CSL" --include="*.ts" --include="*.js" --include="*.java" --include="*.py" --include="*.go" .
```

### 4.6 Inter-Repo Cross-References

**This is unique to the company analysis.** Check if this repo directly imports or references other the company repos:

```bash
# Direct code imports of other the company repos
grep -rn "from.*example\|require.*example\|import.*example\|github\.com/the company" --include="*.ts" --include="*.js" --include="*.java" --include="*.py" --include="*.go" .

# Shared layers (the cp-cloudplatform-layer-* pattern)
grep -rn "cloudplatform.*layer\|shared.*layer\|common.*layer" --include="*.ts" --include="*.js" --include="*.py" .

# Docker/Helm references to other services
grep -rn "image:.*example\|image:.*aurora\|image:.*cp-" --include="*.yml" --include="*.yaml" --include="Dockerfile" .
```

If you find inter-repo dependencies, **check the `repos/` folder** to see if the referenced repo is already cloned. If so, read its entry point to confirm the integration:
```bash
ls /Users/igca/Documents/Code/example/repos/<referenced-repo>/
```

### 4.7 Infrastructure-as-Code Dependencies

Read Terraform, CDK, CloudFormation, and Helm files to find infra-level dependencies that don't appear in application code:

```bash
# Terraform
grep -rn "resource\|data\|module" --include="*.tf" .

# CDK
grep -rn "new.*\(Stack\|Function\|Queue\|Topic\|Table\|Bucket\|Cluster\)" --include="*.ts" --include="*.py" .

# Helm values
cat **/values*.yaml **/values*.yml 2>/dev/null | grep -i "host\|url\|endpoint\|service\|image"
```

### 4.8 Build the Dependency Summary

After completing 4.0–4.7, produce a complete dependency summary table:

| Dependency | Type | Direction | Protocol | Evidence |
|-----------|------|-----------|----------|----------|
| `<target>` | service / database / queue / cloud / external | calls / called-by / reads / writes / publishes / subscribes | HTTP / AMQP / TCP / SDK | `file:line` |

**This table feeds directly into `catalog-info.json`'s `dependsOn`, `providesApis`, and `consumesApis` fields.** Every entry in the JSON must have a corresponding row in this table with a file:line reference.

---

## Phase 5: Data Model (p0 only)

For p0 repos, go deep on data:

1. **Find all entity/model definitions** — read each one fully
2. **Read all migration files** in chronological order — understand schema evolution
3. **Map entity relationships** — foreign keys, references, join tables
4. **Identify the core domain objects** — what are the main "things" this service manages?
5. **Data flow:** trace how data enters (API/event) → gets processed → gets stored → gets emitted

---

## Phase 6: Business Logic (p0, p1)

1. **Identify the core business operations** — what does this service actually DO beyond CRUD?
2. **Trace key flows end-to-end:**
   - Alarm comes in → what happens?
   - Device connects → what happens?
   - User configures something → what happens?
3. **Find business rules** — validation, conditional logic, state machines, workflow steps
4. **Document with file:line references** — every claim must be traceable to code

---

## Phase 7: Deployment, Hosting & Observability (p0, p1)

Map exactly WHERE this service runs, HOW it gets deployed, and HOW it's monitored. We need a complete picture of the operational footprint.

### 7.1 Container & Runtime

```bash
# Dockerfile
cat Dockerfile* 2>/dev/null
# Docker compose
cat docker-compose*.yml 2>/dev/null
```

Record:
- Base image and version (e.g. `node:18-alpine`, `openjdk:21`, `mcr.microsoft.com/dotnet/aspnet:6.0`)
- Exposed ports
- Build stages (multi-stage?)
- Entry command (`CMD` / `ENTRYPOINT`)
- Runtime user (runs as root?)

### 7.2 Orchestration — WHERE it runs

```bash
# Helm charts
find . -name "Chart.yaml" -o -name "values*.yaml" -o -name "values*.yml" | head -20
# K8S manifests
find . -name "*.yaml" -path "*/k8s/*" -o -name "*.yaml" -path "*/kubernetes/*" | head -20
# ECS task definitions
find . -name "*.json" -path "*task-def*" -o -name "*.json" -path "*ecs*" | head -20
# Serverless (Lambda)
find . -name "serverless.yml" -o -name "serverless.ts" -o -name "template.yaml" -path "*sam*" | head -10
# CDK
find . -name "*.ts" -path "*cdk*" -o -name "*.py" -path "*cdk*" | head -10
```

For each deployment target found, record:

| Question | Where to find it |
|----------|-----------------|
| **Cloud provider** | AWS / GCP / on-premise |
| **Compute type** | EKS pod / ECS Fargate / Lambda / Cloud Function / IIS / bare metal |
| **Region** | Terraform vars, Helm values, CDK config |
| **Replicas / scaling** | Helm `replicaCount`, ECS `desiredCount`, Lambda concurrency |
| **Resource limits** | Helm `resources.limits`, ECS `cpu`/`memory` |
| **Health probes** | `livenessProbe`, `readinessProbe` in Helm/K8S |
| **Ingress / Load balancer** | ALB, NLB, Ingress controller, API Gateway |
| **Service mesh / sidecar** | Envoy, Istio, any sidecar containers |
| **Namespace** | K8S namespace, ECS cluster name |

### 7.3 Environments

```bash
# Helm values per environment
ls **/values-*.yaml **/values.*.yaml 2>/dev/null
# Terraform workspaces
grep -r "workspace\|tfvars" --include="*.tf" . 2>/dev/null
# Serverless stages
grep -r "stage\|--stage" --include="*.yml" --include="*.ts" . 2>/dev/null
# Environment references in CI
grep -rn "environment\|deploy.*prod\|deploy.*staging\|deploy.*dev" .github/workflows/*.yml 2>/dev/null
```

List every environment this service deploys to (e.g. `dev`, `staging`, `alicante`, `bilbao`, `barcelona`, `production`).

### 7.4 CI/CD Pipeline

```bash
# GitHub Actions
cat .github/workflows/*.yml 2>/dev/null
# Jenkinsfile
cat Jenkinsfile* 2>/dev/null
# CodeBuild
cat buildspec*.yml 2>/dev/null
# Makefile deploy targets
grep -n "deploy\|release\|publish" Makefile 2>/dev/null
```

Record the full pipeline:
1. **Trigger** — on push? on tag? manual?
2. **Build** — what builds? Docker image? npm package? Java artifact?
3. **Test** — what tests run? Unit? Integration? E2E?
4. **Publish** — where does the artifact go? ECR? npm registry? S3?
5. **Deploy** — how does it reach production? Helm upgrade? ECS update? Lambda deploy? Manual?
6. **Rollback** — is there a rollback mechanism?

### 7.5 Monitoring & Observability

```bash
# Monitoring libraries
grep -rn "prometheus\|grafana\|loki\|datadog\|sentry\|cloudwatch\|newrelic\|elastic\|opentelemetry\|otel\|telegraf\|statsd\|pino\|winston\|log4j\|slf4j\|bunyan" --include="*.ts" --include="*.js" --include="*.java" --include="*.py" --include="*.go" --include="*.cs" .

# Health endpoints
grep -rn "health\|healthz\|ready\|readiness\|liveness\|status\|ping" --include="*.ts" --include="*.js" --include="*.java" --include="*.py" --include="*.go" .

# Alert configurations
find . -name "*.rules" -o -name "*alert*" -o -name "*opsgenie*" -o -name "*pagerduty*" | head -10

# Dashboard definitions
find . -name "*grafana*" -o -name "*dashboard*" -path "*.json" | head -10

# Error tracking
grep -rn "Sentry\|sentry\|dsn\|SENTRY_DSN\|bugsnag\|rollbar" --include="*.ts" --include="*.js" --include="*.java" --include="*.py" .
```

Record the full observability stack:

| Layer | What to find | Evidence |
|-------|-------------|----------|
| **Logging** | Framework (pino/winston/log4j/slog), structured?, log level config, where do logs go (stdout/Loki/CloudWatch) | `file:line` |
| **Metrics** | What metrics are emitted? Prometheus counters/gauges/histograms? StatsD? Custom CloudWatch metrics? | `file:line` |
| **Tracing** | OpenTelemetry? X-Ray? Jaeger? Correlation IDs? | `file:line` |
| **Error tracking** | Sentry DSN? Datadog APM? Native crash reports? | `file:line` |
| **Health checks** | `/health` endpoint? K8S probes? ECS health check? | `file:line` |
| **Dashboards** | Grafana dashboard JSON? CloudWatch dashboard? Link to dashboard? | path or URL |
| **Alerting** | OpsGenie? PagerDuty? Telegram? CloudWatch Alarms? Alert rules? | `file:line` |
| **On-call** | Who gets paged? Any escalation config? | config file |

### 7.6 Secrets & Config Management

```bash
# Secrets references
grep -rn "Secrets.*Manager\|SSM\|Parameter.*Store\|VAULT\|vault\|KMS\|kms\|sealed.*secret" --include="*.ts" --include="*.js" --include="*.java" --include="*.py" --include="*.go" --include="*.yml" --include="*.yaml" --include="*.tf" .

# Hardcoded secrets (SECURITY FINDING)
grep -rn "password.*=\|secret.*=\|api_key.*=\|apiKey.*=\|token.*=" --include="*.ts" --include="*.js" --include="*.java" --include="*.py" --include="*.yml" --include="*.yaml" --include="*.json" --include="*.properties" . | grep -v node_modules | grep -v test | grep -v mock | head -20
```

Record:
- Where are secrets stored? (Secrets Manager, SSM, Helm values, env vars, hardcoded?)
- Any hardcoded credentials? (flag as **SECURITY FINDING**)
- Config injection method? (env vars, mounted files, K8S ConfigMaps/Secrets)

### 7.7 Deployment Summary Table

Produce this table in the README:

| | |
|---|---|
| **Cloud** | AWS / GCP / on-premise |
| **Compute** | EKS / ECS Fargate / Lambda / Cloud Function / IIS |
| **Region** | eu-north-1 / europe-west1 / on-premise Stockholm |
| **Container** | `<image>:<tag>` |
| **Replicas** | N (or auto-scaled min-max) |
| **Resources** | CPU: X, Memory: Y |
| **Environments** | dev, staging, prod (list all) |
| **CI/CD** | GitHub Actions / CodeBuild / manual |
| **Deploy method** | Helm upgrade / ECS rolling / Lambda deploy |
| **Logging** | Loki / CloudWatch / stdout |
| **Metrics** | Prometheus / CloudWatch / Datadog |
| **Error tracking** | Sentry / none |
| **Alerting** | OpsGenie / Telegram / CloudWatch Alarms / none |
| **Health endpoint** | `/health` / none |
| **Secrets** | Secrets Manager / SSM / Helm values / hardcoded |

---

## Phase 8: Health & Staleness Assessment (all depths)

| Signal | How to check |
|--------|-------------|
| Last meaningful commit | `git log --oneline -5` (ignore bot/dependency bumps) |
| Commit frequency (last 12 months) | `git log --since="2025-04-28" --oneline \| wc -l` |
| Open issues / PRs | `gh pr list --state open` and `gh issue list --state open` |
| CI status | Last workflow run: `gh run list --limit 5` |
| Dependency freshness | Check for outdated/vulnerable deps |
| Test existence | Find test files, estimate coverage |
| Documentation quality | README completeness, inline comments, API docs |

### Collaborators — Who owns this?

Find the people who know this code:

```bash
# Top committers (last 12 months)
git log --since="2025-01-01" --format="%aN <%aE>" | sort | uniq -c | sort -rn | head -10

# Top committers (all time)
git shortlog -sne --no-merges | head -10

# CODEOWNERS file
cat .github/CODEOWNERS CODEOWNERS 2>/dev/null

# Last person to touch key files
git log -1 --format="%aN <%aE>" -- src/ lib/ app/ 2>/dev/null
```

For each person found, record:
- **owner** — top committer AND still active (commits in last 6 months)
- **maintainer** — significant commits but less recent, or named in CODEOWNERS
- **contributor** — has commits but not primary

This goes directly into `catalog-info.json` `collaborators` array. When this service breaks at 3am, this is who gets called.

Assign a staleness score:
- **Active** — commits in last 30 days, CI green
- **Maintained** — commits in last 6 months, no critical issues
- **Stale** — no commits in 6-12 months
- **Inactive** — no commits in 12+ months, no CI, no longer maintained

---

## Phase 8.5: Security Scan — Lightweight (all depths)

Quick automated scan for common security issues. Not a full pentest — just catch the obvious things that should never be in a repo.

### Hardcoded Secrets

```bash
# Passwords, API keys, tokens in code and config
grep -rn --include="*.ts" --include="*.js" --include="*.java" --include="*.py" --include="*.go" --include="*.cs" --include="*.yml" --include="*.yaml" --include="*.json" --include="*.xml" --include="*.properties" --include="*.env" --include="*.config" \
  -i "password\s*[:=]\|secret\s*[:=]\|api_key\s*[:=]\|apikey\s*[:=]\|api.key\s*[:=]\|token\s*[:=]\|private.key\|BEGIN RSA\|BEGIN PRIVATE\|BEGIN EC PRIVATE\|jdbc:\|mongodb+srv://\|postgres://.*:.*@\|mysql://.*:.*@\|redis://.*:.*@" \
  . | grep -v node_modules | grep -v test | grep -v mock | grep -v example | grep -v __pycache__ | head -30

# AWS credentials
grep -rn "AKIA[0-9A-Z]\{16\}\|aws_secret_access_key\|AWS_SECRET" . --include="*.ts" --include="*.js" --include="*.py" --include="*.yml" --include="*.yaml" --include="*.json" --include="*.env" --include="*.tf" | grep -v node_modules | head -10

# Terraform state files (contain all secrets)
find . -name "*.tfstate" -o -name "*.tfstate.backup" 2>/dev/null

# .env files committed (should be gitignored)
find . -name ".env" -o -name ".env.local" -o -name ".env.production" 2>/dev/null | grep -v node_modules

# Private keys committed
find . -name "*.pem" -o -name "*.key" -o -name "*.p12" -o -name "*.pfx" -o -name "*.jks" 2>/dev/null | grep -v node_modules
```

### Auth & Access Control

```bash
# Missing auth on endpoints (look for routes without middleware)
grep -rn "app\.\(get\|post\|put\|delete\|patch\).*['\"/]" --include="*.ts" --include="*.js" . | grep -v auth | grep -v middleware | grep -v test | head -20

# Disabled auth checks
grep -rn "noAuth\|skipAuth\|bypassAuth\|auth.*false\|auth.*disabled\|check_permission.*True\|verify.*false\|no.verify" --include="*.ts" --include="*.js" --include="*.java" --include="*.py" --include="*.go" . | grep -v test | head -10

# CORS wildcards
grep -rn "Access-Control-Allow-Origin.*\*\|cors.*origin.*\*\|AllowAllOrigins\|allow_all_origins" --include="*.ts" --include="*.js" --include="*.java" --include="*.py" --include="*.go" . | head -10
```

### Dangerous Patterns

```bash
# SQL injection risks (string concatenation in queries)
grep -rn "query.*+.*\"\|execute.*+.*\"\|raw.*+.*\"\|format.*SELECT\|format.*INSERT\|format.*UPDATE\|format.*DELETE\|f\"SELECT\|f\"INSERT" --include="*.ts" --include="*.js" --include="*.java" --include="*.py" --include="*.go" . | grep -v test | head -10

# Command injection
grep -rn "exec(\|os\.system\|subprocess\.\(call\|run\|Popen\)\|child_process\|Runtime\.exec" --include="*.ts" --include="*.js" --include="*.java" --include="*.py" . | grep -v node_modules | grep -v test | head -10

# Disabled TLS verification
grep -rn "rejectUnauthorized.*false\|verify.*false\|InsecureSkipVerify\|VERIFY_NONE\|check_hostname.*False\|NODE_TLS_REJECT_UNAUTHORIZED.*0" --include="*.ts" --include="*.js" --include="*.java" --include="*.py" --include="*.go" . | head -10

# Overly permissive IAM
grep -rn '"Action".*"\*"\|"Resource".*"\*"\|Effect.*Allow.*\*' --include="*.json" --include="*.tf" --include="*.yml" --include="*.yaml" . | grep -v node_modules | head -10

# Debug/dev mode in production configs
grep -rn "DEBUG.*true\|debug.*=.*1\|devMode\|development.*mode" --include="*.yml" --include="*.yaml" --include="*.json" --include="*.properties" . | grep -v node_modules | grep -v test | head -10
```

### Dependency Vulnerabilities

```bash
# Check for known vulnerable dependency versions (quick heuristic)
# Node
cat package.json 2>/dev/null | grep -i "log4j\|lodash.*['\"]3\.\|lodash.*['\"]4\.[0-9]\.\|express.*['\"]3\.\|minimist.*['\"]0\.\|axios.*['\"]0\.1[0-8]"

# Check if lock file exists (no lock file = no reproducible builds)
ls package-lock.json yarn.lock pnpm-lock.yaml Gemfile.lock go.sum requirements.txt poetry.lock Cargo.lock 2>/dev/null
```

### Security Summary

Produce a security findings section in the README:

```markdown
## Security Findings

| Severity | Finding | Location | Recommendation |
|----------|---------|----------|----------------|
| CRITICAL | Hardcoded database password | `config/db.yml:12` | Move to Secrets Manager |
| HIGH | Missing auth on admin endpoint | `routes/admin.ts:45` | Add auth middleware |
| MEDIUM | CORS allows all origins | `server.ts:23` | Restrict to known origins |
| LOW | No lock file | repo root | Add package-lock.json |
| INFO | TLS verification disabled (dev only) | `test/setup.ts:8` | Confirm dev-only |
```

And add to `catalog-info.json`:

```json
{
  "security": {
    "findings": [
      {
        "severity": "critical|high|medium|low|info",
        "finding": "<what>",
        "location": "<file:line>",
        "recommendation": "<fix>"
      }
    ],
    "hasHardcodedSecrets": true,
    "hasMissingAuth": false,
    "hasLockFile": true,
    "tlsVerificationDisabled": false
  }
}
```

**Rules:**
- Run on ALL depth levels — even p3 repos can have leaked secrets
- Only report findings with file:line evidence
- Don't flag test/mock files unless they contain real credentials
- Severity: CRITICAL = leaked real credentials or exposed data. HIGH = missing auth, injection. MEDIUM = permissive CORS, debug mode. LOW = missing lock file, outdated deps. INFO = things to verify.
- **This is life-safety infrastructure.** A compromised alarm system can cost lives. Flag everything, err on the side of caution.

---

## Phase 9: Write the Catalog Entry (README.md)

Write the main analysis to:
```
/Users/igca/Documents/Code/example/catalog/repos/<repo-name>/README.md
```

Domain mapping:
- `icc/` — repos owned by Madrid team, cp-aurora-*, cp-icc-*
- `ico/` — i-care-online*, ico-*
- `iot-backend/` — cp-generic-iot-*, cp-*-service (Malmö IoT)
- `apps/` — app-*, responder
- `embedded/` — dpd-*, hdp-*, embedded-*
- `identity/` — cp-identities, cp-single-signon, customers-*, csp-*, identity-*, my-example-*
- `infrastructure/` — network-infra, shared-actions, grafana-*, aws-*, helm-*, ssm-*, maven, jenkins-*
- `data/` — sim-data-*, dsp-sms-*, mcc-mnc-*
- `labs/` — lab-*, innovation-*, focusday-*, ideahub, example-status-*
- `legacy/` — dcps-*, ico-icom, ico-icoc, *-old
- `recruiting/` — code-challenge-*, git-it, basic-node-setup
- `docs/` — architecture-documents, cp-documentation, readme, .github-private, andreas-plant-uml

Use this template:

```markdown
---
name: <repo-name>
description: <one-line description>
last-updated: <date of this analysis>
owner: <team/person>
status: <production|prototype|sunset|dead|unknown>
domain: <icc|ico|iot-backend|apps|embedded|identity|infrastructure|data|labs|legacy|recruiting|docs>
repo: https://github.com/the company/<repo-name>
---

# <repo-name>

> <One paragraph summary: what it is, what it does, why it exists>

## Quick Facts

| | |
|---|---|
| **Language** | |
| **Framework** | |
| **Runtime** | |
| **Hosting** | |
| **Port(s)** | |
| **Database** | |
| **Message Broker** | |
| **CI/CD** | |
| **Last Active Commit** | |
| **Activity (12mo)** | X commits |
| **Staleness** | Active / Maintained / Inactive / Archived |
| **Lines of Code** | |
| **Contact** | |

## Architecture

### Directory Structure

(truncated tree showing key dirs only)

### Internal Design

(Pattern used, key modules, how they relate)

### Entry Point

(Bootstrap sequence, what starts, what ports open — with file:line refs)

### Configuration

| Env Variable | Purpose | Default | Required |
|---|---|---|---|

## APIs Provided

### HTTP Endpoints

| Method | Path | Auth | Description | File |
|---|---|---|---|---|

### WebSocket Events / GraphQL / gRPC / TCP Protocol

(if applicable)

## APIs Consumed

### Inter-Service Calls

| Target Service | Protocol | Purpose | File |
|---|---|---|---|

### Database Access

| Database | Type | Tables/Collections | Access Pattern | File |
|---|---|---|---|---|

### Message Queues / Events

| Direction | Queue/Topic | Format | File |
|---|---|---|---|

### Cloud Services

| Service | Purpose | File |
|---|---|---|

### External APIs

| Provider | Purpose | File |
|---|---|---|

## Data Model

(Entity relationship summary — for p0 only)

## Key Business Logic

(Core operations, business rules, state machines — with file:line refs)

## Deployment

| | |
|---|---|
| **Dockerfile** | (base image, exposed ports) |
| **K8S/Helm** | (replicas, resources, probes) |
| **Terraform** | (what infra it provisions) |
| **CI/CD Pipeline** | (build → test → deploy steps) |

## Dependencies

### Package Dependencies (notable)

(Only list significant deps — frameworks, ORMs, SDKs — not every utility)

### Inter-Service Dependencies

\```
<repo-name> ──calls──▶ service-A
<repo-name> ──calls──▶ service-B
<repo-name> ◀──called by── service-C
<repo-name> ──publishes──▶ topic-X
<repo-name> ◀──subscribes── topic-Y
\```

## Health Assessment

| Signal | Status |
|---|---|
| Last commit | |
| Commits (12mo) | |
| CI/CD | |
| Tests | |
| Documentation | |
| Dependency freshness | |

**Recommendation:** (keep / maintain / sunset / archive / merge into X)

## Cross-References

- Related repos: [link](../other-repo/)
- Architecture docs: [link](../../../architecture/overview.md)
- Service docs: [link](../../../services/relevant.md)
```

---

## Phase 10: Generate `catalog-info.json` Service Spec

Write to: `catalog/repos/<repo-name>/catalog-info.json`

This is the agent's structured assessment of the repo's metadata. Brain reads it during `brain repo sync` and serves it directly via the API — no conversion needed.

```json
{
  "name": "<repo-name>",
  "description": "<one-line description from your analysis>",
  "domain": "<icc|ico|iot-backend|apps|embedded|identity|infrastructure|data|labs|legacy|recruiting|docs>",
  "type": "<service|library|firmware|app|tool|config>",
  "lifecycle": "<experimental|production|deprecated>",
  "system": "<logical system: icc, iot-backend, apps, etc.>",
  "team": "<madrid|malmö|luleå|vietnam>",
  "collaborators": [
    {
      "name": "<full name>",
      "role": "<owner|maintainer|contributor>",
      "github": "<github-username>",
      "email": "<email if discoverable>"
    }
  ],
  "dependsOn": [
    "<service or infra this repo calls at runtime>"
  ],
  "providesApis": [
    "<API identifier matching operationId convention in openapi.json>"
  ],
  "consumesApis": [
    "<API identifier of services this repo calls>"
  ],
  "tags": ["<language>", "<framework>", "<cloud>", "<infra>"],
  "links": [
    {
      "title": "Catalog Entry",
      "url": "https://github.com/the company/example/blob/main/catalog/repos/<repo-name>/"
    }
  ],
  "deployment": {
    "cloud": "<aws|gcp|on-premise>",
    "compute": "<eks|ecs-fargate|lambda|cloud-function|iis|embedded>",
    "region": "<aws region or location>",
    "environments": ["dev", "staging", "production"],
    "cicd": "<github-actions|codebuild|manual>",
    "deployMethod": "<helm-upgrade|ecs-rolling|lambda-deploy|manual>"
  },
  "observability": {
    "logging": "<loki|cloudwatch|stdout|none>",
    "metrics": "<prometheus|cloudwatch|datadog|none>",
    "errorTracking": "<sentry|datadog|none>",
    "alerting": "<opsgenie|telegram|cloudwatch-alarms|none>",
    "healthEndpoint": "</health|/healthz|none>"
  },
  "security": {
    "findings": [
      {
        "severity": "<critical|high|medium|low|info>",
        "finding": "<description>",
        "location": "<file:line>",
        "recommendation": "<fix>"
      }
    ],
    "hasHardcodedSecrets": false,
    "hasMissingAuth": false,
    "hasLockFile": true,
    "tlsVerificationDisabled": false
  }
}
```

**Rules:**
- `dependsOn`: runtime dependencies from Phase 4 (services, databases, brokers — not dev tools)
- `providesApis`: APIs from Phase 3 — use identifiers that match `operationId` values in openapi.json
- `consumesApis`: external APIs called from Phase 4
- `tags`: language, framework, cloud provider, key infra (e.g. `["java", "spring-boot", "aws", "eks", "mongodb"]`)
- `links`: always include catalog entry link; add runbook/dashboard URLs if found
- `deployment`: from Phase 7 — where it runs, how it gets there
- `observability`: from Phase 7.5 — how it's monitored, what alerts exist
- Omit keys with empty arrays, empty strings, or objects with all-empty values
- Omit fields you can't determine from code

---

## Phase 11: Generate `openapi.json` API Spec (only if repo exposes HTTP or GraphQL APIs)

Write to: `catalog/repos/<repo-name>/openapi.json`

Generate an OpenAPI 3.1 stub from the APIs discovered in Phase 3. This is a lightweight spec — paths, methods, summary, and auth. No request/response schemas (teams add those later).

**Skip this phase entirely** for repos that don't expose HTTP/GraphQL APIs (libraries, firmware, tools, config repos).

```json
{
  "openapi": "3.1.0",
  "info": {
    "title": "<repo-name>",
    "version": "1.0.0",
    "description": "<one-line description>",
    "contact": {
      "name": "<team>"
    }
  },
  "servers": [
    {
      "url": "https://<service-url-if-known>",
      "description": "Production"
    }
  ],
  "paths": {
    "/<path>": {
      "<method>": {
        "operationId": "<descriptive-id>",
        "summary": "<what it does>",
        "security": [{"<scheme>": []}],
        "tags": ["<logical-group>"]
      }
    },
    "/graphql": {
      "post": {
        "operationId": "graphql",
        "summary": "GraphQL endpoint",
        "description": "Queries: login, logout, groupList, jobList, ...\nMutations: groupJoin, jobInput, groupChatMessageAdd, ...",
        "security": [{"keycloak": []}]
      }
    }
  },
  "components": {
    "securitySchemes": {
      "keycloak": {
        "type": "openIdConnect",
        "openIdConnectUrl": "https://account.brain.net/.well-known/openid-configuration"
      },
      "apiKey": {
        "type": "apiKey",
        "in": "header",
        "name": "x-api-key"
      },
      "firebase": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "Firebase JWT"
      }
    }
  }
}
```

**Rules:**
- One path entry per unique route discovered in Phase 3
- `operationId` should be descriptive and stable (e.g. `createOperatorSession`, `getDeviceByImei`)
- `security` must reflect actual auth found in code — use `[]` (empty array) for unauthenticated routes
- Group related endpoints with `tags`
- For GraphQL: document as a single `POST /graphql` with queries/mutations listed in `description`
- For TCP/custom protocols: skip openapi.json — document in README.md instead
- For WebSocket: skip openapi.json — document events in README.md instead
- Don't invent endpoints — only document what you found in code with file:line evidence
- Only include `securitySchemes` that this service actually uses

---

## Rules for the Analyst Agent

1. **Every claim must have a file:line reference.** No guessing. If you can't find evidence, say "not found in code."
2. **Read actual code, not just file names.** A file called `alarm-handler.ts` might do something unexpected.
3. **Grep broadly, then read narrowly.** Start with wide searches, then read the specific files that matter.
4. **Capture env vars exhaustively.** These are the wiring between services — miss one and you miss a dependency.
5. **Distinguish between "code exists" and "code runs."** Dead code, commented-out blocks, unused imports don't count.
6. **Note what's MISSING.** No tests? No README? No error handling? No auth? These are findings too.
7. **Be honest about uncertainty.** "This appears to connect to X but I couldn't confirm" is better than a wrong assertion.
8. **Don't document node_modules, vendor, or generated code.** Only human-written source.
9. **For embedded/firmware repos:** Focus on HAL layers, peripheral drivers, communication protocols (UART, SPI, BLE, LTE), memory layout, and flash/boot sequences instead of HTTP APIs.
10. **Time-box yourself.** p0 = up to 30 minutes per repo. p1 = 15 min. p2 = 5 min. p3 = 2 min. If you're stuck, note what you couldn't determine and move on.
11. **Always produce all applicable output files.** README.md and catalog-info.json for every repo. openapi.json only for repos that expose HTTP/GraphQL APIs.
12. **Create the output directory** before writing: `mkdir -p catalog/repos/<repo-name>/`
