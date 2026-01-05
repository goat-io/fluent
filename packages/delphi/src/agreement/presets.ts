/**
 * Discussion Presets
 * Pre-configured discussion templates for common scenarios
 */
import { DiscussionBuilder } from './discussion-builder.js'

/**
 * Code Review Discussion
 * Multiple reviewers evaluate code changes
 */
export function codeReviewDiscussion() {
  return new DiscussionBuilder()
    .inDomain('review')
    .useStrategy('code-review') // Apply optimized model mapping
    .withProposer({
      id: 'code-author',
      expertise: ['implementation', 'feature-development'],
      personality: 'supportive',
      weight: 0.8,
    })
    .withReviewer({
      id: 'security-reviewer',
      expertise: ['security', 'vulnerability-detection'],
      personality: 'critical',
      weight: 1.2,
      systemPrompt: `Focus on security implications, injection vulnerabilities, 
                     authentication/authorization issues, and data exposure risks.`,
    })
    .withReviewer({
      id: 'performance-reviewer',
      expertise: ['performance', 'optimization'],
      personality: 'analytical',
      weight: 1.0,
      systemPrompt: `Analyze time complexity, space complexity, database queries,
                     caching opportunities, and potential bottlenecks.`,
    })
    .withReviewer({
      id: 'architecture-reviewer',
      expertise: ['architecture', 'design-patterns'],
      personality: 'analytical',
      weight: 1.1,
      systemPrompt: `Evaluate architectural decisions, SOLID principles compliance,
                     coupling/cohesion, and maintainability.`,
    })
    .withArbiter({
      id: 'lead-developer',
      expertise: ['architecture', 'best-practices'],
      weight: 1.5,
    })
    .configure({
      maxTurns: 3,
      maxDurationMs: 120000, // 2 minutes
      consensusThreshold: 0.7,
      conflictResolution: 'weighted',
      requireExplanation: true,
    })
}

/**
 * Architecture Decision Discussion
 * Agents debate architectural choices
 */
export function architectureDecisionDiscussion() {
  return new DiscussionBuilder()
    .inDomain('architecture')
    .useStrategy('architecture-decision') // Apply optimized model mapping
    .withProposer({
      id: 'solution-architect',
      expertise: ['system-design', 'scalability'],
      personality: 'creative',
      weight: 1.0,
    })
    .withReviewer({
      id: 'backend-architect',
      expertise: ['backend', 'databases', 'microservices'],
      personality: 'analytical',
      weight: 1.0,
    })
    .withReviewer({
      id: 'frontend-architect',
      expertise: ['frontend', 'user-experience', 'performance'],
      personality: 'creative',
      weight: 1.0,
    })
    .withReviewer({
      id: 'devops-architect',
      expertise: ['infrastructure', 'deployment', 'monitoring'],
      personality: 'critical',
      weight: 1.0,
    })
    .withArbiter({
      id: 'chief-architect',
      expertise: ['enterprise-architecture', 'strategy'],
      weight: 2.0,
    })
    .configure({
      maxTurns: 5,
      maxDurationMs: 180000, // 3 minutes
      consensusThreshold: 0.75,
      conflictResolution: 'arbiter',
      allowDissent: true,
    })
}

/**
 * Test Strategy Discussion
 * Agents plan testing approach
 */
export function testStrategyDiscussion() {
  return new DiscussionBuilder()
    .inDomain('testing')
    .withProposer({
      id: 'qa-lead',
      expertise: ['testing', 'quality-assurance'],
      personality: 'analytical',
      weight: 1.2,
    })
    .withReviewer({
      id: 'unit-test-expert',
      expertise: ['unit-testing', 'tdd', 'mocking'],
      personality: 'analytical',
      weight: 1.0,
    })
    .withReviewer({
      id: 'integration-test-expert',
      expertise: ['integration-testing', 'e2e-testing'],
      personality: 'critical',
      weight: 1.0,
    })
    .withReviewer({
      id: 'performance-test-expert',
      expertise: ['load-testing', 'stress-testing', 'benchmarking'],
      personality: 'analytical',
      weight: 0.9,
    })
    .configure({
      maxTurns: 4,
      maxDurationMs: 90000,
      consensusThreshold: 0.66,
      conflictResolution: 'majority',
    })
}

/**
 * API Design Discussion
 * Agents design REST/GraphQL APIs
 */
export function apiDesignDiscussion() {
  return new DiscussionBuilder()
    .inDomain('design')
    .withProposer({
      id: 'api-designer',
      expertise: ['api-design', 'rest', 'graphql'],
      personality: 'creative',
      weight: 1.0,
    })
    .withReviewer({
      id: 'backend-developer',
      expertise: ['backend', 'implementation'],
      personality: 'analytical',
      weight: 1.0,
    })
    .withReviewer({
      id: 'frontend-consumer',
      expertise: ['frontend', 'api-consumption'],
      personality: 'critical',
      weight: 1.0,
      systemPrompt: `Evaluate from API consumer perspective: ease of use,
                     consistency, documentation needs, error handling.`,
    })
    .withReviewer({
      id: 'security-expert',
      expertise: ['security', 'authentication', 'authorization'],
      personality: 'critical',
      weight: 1.1,
    })
    .configure({
      maxTurns: 4,
      maxDurationMs: 120000,
      consensusThreshold: 0.7,
      requireExplanation: true,
    })
}

/**
 * Quick Decision Discussion
 * Fast consensus for simple decisions
 */
export function quickDecisionDiscussion() {
  return new DiscussionBuilder()
    .inDomain('code')
    .withProposer({
      id: 'proposer',
      weight: 1.0,
    })
    .withReviewers(2, {
      weight: 1.0,
      personality: 'analytical',
    })
    .configure({
      maxTurns: 2,
      maxDurationMs: 30000, // 30 seconds
      consensusThreshold: 0.66,
      conflictResolution: 'majority',
      tokenBudgetPerTurn: 1000,
    })
}

/**
 * Refactoring Discussion
 * Agents plan and review refactoring
 */
export function refactoringDiscussion() {
  return new DiscussionBuilder()
    .inDomain('code')
    .withProposer({
      id: 'refactoring-lead',
      expertise: ['refactoring', 'clean-code'],
      personality: 'analytical',
      weight: 1.0,
    })
    .withReviewer({
      id: 'code-quality-reviewer',
      expertise: ['code-quality', 'maintainability'],
      personality: 'critical',
      weight: 1.0,
      systemPrompt: `Focus on: code duplication, cyclomatic complexity,
                     naming conventions, SOLID principles, readability.`,
    })
    .withReviewer({
      id: 'test-coverage-reviewer',
      expertise: ['testing', 'test-coverage'],
      personality: 'analytical',
      weight: 0.9,
      systemPrompt: `Ensure refactoring maintains or improves test coverage,
                     doesn't break existing tests, and improves testability.`,
    })
    .withReviewer({
      id: 'backwards-compat-reviewer',
      expertise: ['api-compatibility', 'versioning'],
      personality: 'critical',
      weight: 1.1,
      systemPrompt: `Check for breaking changes, API compatibility,
                     migration paths, and deprecation strategies.`,
    })
    .configure({
      maxTurns: 3,
      maxDurationMs: 90000,
      consensusThreshold: 0.75,
      requireExplanation: true,
    })
}

/**
 * Database Schema Discussion
 * Agents design database schemas
 */
export function databaseSchemaDiscussion() {
  return new DiscussionBuilder()
    .inDomain('architecture')
    .withProposer({
      id: 'data-architect',
      expertise: ['database-design', 'normalization'],
      personality: 'analytical',
      weight: 1.2,
    })
    .withReviewer({
      id: 'performance-dba',
      expertise: ['query-optimization', 'indexing'],
      personality: 'analytical',
      weight: 1.0,
      systemPrompt: `Analyze query patterns, index usage, denormalization needs,
                     partitioning strategies, and caching opportunities.`,
    })
    .withReviewer({
      id: 'application-developer',
      expertise: ['orm', 'data-access'],
      personality: 'supportive',
      weight: 0.9,
      systemPrompt: `Consider ORM mapping, query complexity, migration ease,
                     and application-level data access patterns.`,
    })
    .withReviewer({
      id: 'data-compliance-officer',
      expertise: ['gdpr', 'data-privacy', 'compliance'],
      personality: 'critical',
      weight: 1.1,
      systemPrompt: `Ensure PII handling, data retention policies, audit trails,
                     encryption requirements, and regulatory compliance.`,
    })
    .configure({
      maxTurns: 4,
      maxDurationMs: 150000,
      consensusThreshold: 0.7,
      conflictResolution: 'weighted',
    })
}
