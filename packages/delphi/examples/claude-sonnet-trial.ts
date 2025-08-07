#!/usr/bin/env tsx
/**
 * Claude Sonnet Trial - Simple Anthropic-only example for Delphi
 * 
 * 🎯 DESIGNED FOR CLAUDE/ANTHROPIC API USERS ONLY
 * 
 * This is a simplified version of the OpenCode credentials example that:
 * 1. Uses ONLY Claude Sonnet models (3.5-Sonnet, 3-Sonnet, 3-Haiku)
 * 2. Requires ONLY Anthropic API credentials (no OpenAI, Google, etc.)
 * 3. Demonstrates multi-agent security code review with consensus
 * 4. Optionally integrates with Claude Code CLI for automated fixes
 * 5. Perfect for users who want to try Delphi with minimal setup
 * 
 * How to run:
 * npx tsx examples/claude-sonnet-trial.ts
 * 
 * Usage:
 * 1. Set your Anthropic API key:
 *    export ANTHROPIC_API_KEY=your-anthropic-key
 * 
 * 2. Run basic code review:
 *    npx tsx examples/claude-sonnet-trial.ts review
 * 
 * 3. Run code review with Claude Code CLI integration:
 *    npx tsx examples/claude-sonnet-trial.ts review --use-claude-code
 * 
 * 4. Test connection only:
 *    npx tsx examples/claude-sonnet-trial.ts test-connection
 * 
 * 5. Custom review goal:
 *    npx tsx examples/claude-sonnet-trial.ts review --goal "Review for security issues" --model "claude-3-5-sonnet"
 */

import { Command } from "commander";
import pino from "pino";
import {
	AgentRole,
	createLLMAgent,
} from "../src/agreement/index.js";
import { DiscussionBuilder } from "../src/agreement/discussion-builder.js";
import { getLLMAdapter } from "../src/llm/index.js";
import {
	type ConsensusResult,
} from "../src/agreement/types.js";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { loadOpenCodeConfig } from "../src/utils/opencode-config.js";

// Logger setup
const logger = pino({
	name: "claude-sonnet-trial",
	level: process.env.LOG_LEVEL || "info",
	transport: {
		target: "pino-pretty",
		options: {
			colorize: true,
		},
	},
});

interface ClaudeTrialOptions {
	model?: string;
	goal?: string;
	timeout?: number;
	useClaudeCode?: boolean;
	codeFile?: string;
}

// Available Claude Sonnet models
const CLAUDE_MODELS = {
	"claude-3-5-sonnet": "anthropic/claude-3-5-sonnet-20241022",
	"claude-3-sonnet": "anthropic/claude-3-sonnet-20240229",
	"claude-3-haiku": "anthropic/claude-3-haiku-20240307", // Backup option for faster/cheaper runs
} as const;

/**
 * Get Anthropic API key from OpenCode config or environment
 */
function getAnthropicApiKey(): string | undefined {
	// First check OpenCode config
	try {
		const config = loadOpenCodeConfig();
		// Check api_keys (correct path) not models
		if (config?.api_keys?.anthropic) {
			logger.info("✅ Using Anthropic API key from OpenCode configuration");
			return config.api_keys.anthropic;
		}
	} catch (error) {
		// OpenCode config not found, will fall back to env var
		logger.debug({ error: error.message }, "Failed to load OpenCode config");
	}
	
	// Fall back to environment variable
	return process.env.ANTHROPIC_API_KEY;
}

/**
 * Validate that we have Anthropic API access
 */
function validateAnthropicAccess(): string {
	const apiKey = getAnthropicApiKey();
	if (!apiKey) {
		throw new Error(
			"No Anthropic API key found!\n\n" +
			"You can provide it in one of these ways:\n" +
			"1. OpenCode config: ~/.opencode/config.json\n" +
			"2. Environment variable: export ANTHROPIC_API_KEY=your-key-here\n\n" +
			"Get your API key from: https://console.anthropic.com/"
		);
	}
	
	if (apiKey.length < 10 || !apiKey.startsWith('sk-')) {
		logger.warn("⚠️ API key format looks unusual. Make sure it's correct.");
	}
	
	return apiKey;
}

/**
 * Test connection to Claude API
 */
async function testClaudeConnection(model?: string): Promise<void> {
	const log = logger.child({ test: "claude-connection" });
	
	log.info("🔍 Testing Claude API connection...");
	
	try {
		const apiKey = validateAnthropicAccess();
		
		const selectedModel = model || "claude-3-sonnet";
		const fullModelName = CLAUDE_MODELS[selectedModel as keyof typeof CLAUDE_MODELS] || CLAUDE_MODELS["claude-3-sonnet"];
		
		log.info(`Using model: ${fullModelName}`);
		
		// Create LLM adapter with Anthropic config
		const llmAdapter = getLLMAdapter({
			model: fullModelName,
			small_model: fullModelName, // Use same model for consistency
			api_keys: {
				anthropic: apiKey
			},
			max_tokens: 1000,
			temperature: 0.7
		});
		
		const response = await llmAdapter.chat({
			messages: [{
				role: "user" as const,
				content: "Please respond with exactly: 'Claude connection successful! Ready for code review.'"
			}],
			maxTokens: 50
		});
		
		log.info(`✅ Claude API connection successful!`);
		log.info(`Response: ${response.content}`);
		
		if (response.usage) {
			log.info(`Token usage: ${response.usage.totalTokens} total (${response.usage.promptTokens} prompt + ${response.usage.completionTokens} completion)`);
		}
		
		console.log('\n' + '='.repeat(60));
		console.log('✅ CLAUDE CONNECTION TEST PASSED');
		console.log('='.repeat(60));
		console.log(`Model: ${fullModelName}`);
		console.log(`Response: ${response.content}`);
		console.log('='.repeat(60) + '\n');
		
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		log.error({ error: errorMessage, stack: error instanceof Error ? error.stack : undefined }, "❌ Claude API connection failed");
		throw error;
	}
}

/**
 * Check if Claude Code CLI is available
 */
function checkClaudeCodeCLI(): boolean {
	try {
		execSync('claude --version', { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
}

/**
 * Run code through Claude Code CLI
 */
async function runClaudeCodeEdit(prompt: string, files?: string[]): Promise<string> {
	const log = logger.child({ action: "claude-code-edit" });
	
	if (!checkClaudeCodeCLI()) {
		throw new Error(
			"Claude Code CLI not found. Install it with:\n" +
			"npm install -g @anthropic-ai/claude-code\n" +
			"Or run without --use-claude-code flag"
		);
	}
	
	log.info("🔧 Running Claude Code CLI...");
	
	try {
		// Build Claude Code command
		let command = `claude -p "${prompt.replace(/"/g, '\\"')}"`;
		
		if (files && files.length > 0) {
			// Add specific files if provided
			command += ` ${files.join(' ')}`;
		}
		
		log.debug(`Executing: ${command}`);
		
		const result = execSync(command, { 
			encoding: 'utf8',
			maxBuffer: 1024 * 1024 * 5 // 5MB buffer
		});
		
		log.info("✅ Claude Code CLI completed");
		return result;
		
	} catch (error) {
		log.error({ error }, "❌ Claude Code CLI failed");
		throw new Error(`Claude Code CLI execution failed: ${error.message}`);
	}
}

/**
 * Run Claude Sonnet multi-agent code review
 */
async function runClaudeSonnetReview(options: ClaudeTrialOptions): Promise<ConsensusResult | null> {
	const log = logger.child({ action: 'claude-sonnet-review' });
	
	log.info(`🚀 Starting Claude Sonnet code review`);
	
	try {
		const apiKey = validateAnthropicAccess();
		
		// Determine model to use
		const selectedModel = options.model || "claude-3-sonnet";
		const fullModelName = CLAUDE_MODELS[selectedModel as keyof typeof CLAUDE_MODELS] || CLAUDE_MODELS["claude-3-sonnet"];
		
		log.info(`🎯 Using Claude model: ${fullModelName}`);
		
		// Create LLM adapter with Anthropic-only config
		const llmAdapter = getLLMAdapter({
			model: fullModelName,
			small_model: fullModelName, // Consistent model for all agents
			api_keys: {
				anthropic: apiKey
			},
			max_tokens: 2000,
			temperature: 0.7
		});
		
		log.info(`✅ LLM adapter initialized for Anthropic`);
		
		// Create Claude Sonnet agents for discussion
		const agents = [
			createLLMAgent("claude-proposer", AgentRole.PROPOSER, llmAdapter),
			createLLMAgent("claude-reviewer-1", AgentRole.REVIEWER, llmAdapter),
			createLLMAgent("claude-reviewer-2", AgentRole.REVIEWER, llmAdapter),
		];
		
		log.info(`✅ Created ${agents.length} Claude Sonnet agents`);
		
		// Build discussion
		const goal = options.goal || "Review JavaScript authentication code for security vulnerabilities and best practices";
		
		const discussion = new DiscussionBuilder<ConsensusResult>()
			.goal(goal)
			.withConstraints(
				"Focus on security vulnerabilities and exploits",
				"Follow OWASP security guidelines",
				"Check for proper input validation",
				"Verify secure authentication practices",
				"Provide specific, actionable recommendations"
			)
			.expecting(
				"Detailed security analysis",
				"List of vulnerabilities found",
				"Specific recommendations for fixes",
				"Overall security assessment decision"
			)
			.successWhen(
				"All critical security issues are identified",
				"Recommendations are specific and actionable",
				"All Claude agents reach consensus on security status"
			)
			.withTimeout(options.timeout || 120000) // 2 minutes
			.configure({
				maxTurns: 4,
				maxDurationMs: 100000,
				tokenBudgetPerTurn: 1800,
				consensusThreshold: 0.75,
			});
		
		const { context, config: discussionConfig } = discussion.build();
		
		log.info(`🎯 Starting Claude consensus discussion with goal: ${goal}`);
		
		// Sample code for review - realistic authentication function with security issues
		const codeToReview = `
// User authentication system
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

class AuthService {
    constructor() {
        this.users = new Map(); // In-memory user store
        this.sessions = new Map(); // Active sessions
        this.jwtSecret = process.env.JWT_SECRET || 'default-secret-key';
    }

    // Register new user
    async registerUser(username, password, email) {
        // Basic validation
        if (!username || !password) {
            throw new Error('Username and password required');
        }

        // Check if user exists
        if (this.users.has(username)) {
            throw new Error('User already exists');
        }

        // Hash password with MD5 (simplified)
        const hashedPassword = crypto.createHash('md5').update(password).digest('hex');

        // Store user
        const user = {
            id: crypto.randomUUID(),
            username,
            password: hashedPassword,
            email,
            createdAt: new Date(),
            isActive: true
        };

        this.users.set(username, user);
        return { success: true, userId: user.id };
    }

    // Authenticate user
    async authenticateUser(username, password) {
        const user = this.users.get(username);
        
        if (!user) {
            throw new Error('User not found');
        }

        // Check password
        const hashedPassword = crypto.createHash('md5').update(password).digest('hex');
        
        if (user.password !== hashedPassword) {
            throw new Error('Invalid credentials');
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user.id, 
                username: user.username,
                exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
            },
            this.jwtSecret
        );

        // Store session
        const sessionId = crypto.randomUUID();
        this.sessions.set(sessionId, {
            userId: user.id,
            token,
            createdAt: new Date()
        });

        return {
            success: true,
            token,
            sessionId,
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        };
    }

    // Validate session
    validateSession(token) {
        try {
            const decoded = jwt.verify(token, this.jwtSecret);
            return { valid: true, user: decoded };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    // Admin function to list all users
    getAllUsers() {
        return Array.from(this.users.values()).map(user => ({
            id: user.id,
            username: user.username,
            email: user.email,
            password: user.password // Exposed for debugging
        }));
    }
}

module.exports = AuthService;
		`.trim();
		
		// Create discussion prompt
		const discussionPrompt = `
${JSON.stringify(context)}

Please review the following JavaScript authentication service code for security vulnerabilities:

\`\`\`javascript
${codeToReview}
\`\`\`

Focus your security analysis on:
1. **Password Security**: Hashing algorithms, storage methods
2. **Authentication Logic**: Validation, error handling
3. **Session Management**: Token generation, storage, validation  
4. **Data Exposure**: Information leaks, debugging artifacts
5. **Input Validation**: SQL injection, XSS, other injection attacks
6. **JWT Security**: Secret management, expiration handling
7. **Overall Architecture**: Security design patterns

Provide specific vulnerability findings and actionable security recommendations.
		`.trim();
		
		// Get reviews from all Claude agents
		const proposals = [];
		const sessionId = crypto.randomUUID();
		const startTime = Date.now();
		
		for (const agent of agents) {
			try {
				log.info(`💬 Getting security review from ${agent.name} (${agent.role})`);
				const response = await agent.chat({
					messages: [{
						role: "user" as const,
						content: discussionPrompt
					}]
				});
				
				proposals.push({
					agent: agent.name,
					role: agent.role,
					content: response.content
				});
				
				log.debug(`Response from ${agent.name}: ${response.content.slice(0, 150)}...`);
			} catch (error) {
				log.error({ error, agent: agent.name }, `Failed to get response from agent`);
			}
		}
		
		if (proposals.length === 0) {
			log.error("❌ No proposals received from any Claude agents");
			return null;
		}
		
		log.info(`✅ Received ${proposals.length} security reviews from Claude agents`);
		
		// Security-focused consensus calculation
		const criticalIssues = ['md5', 'sql injection', 'xss', 'plaintext', 'hardcoded', 'weak', 'vulnerable'];
		const approvalWords = ['secure', 'good', 'acceptable', 'safe', 'adequate', 'proper'];
		const concernWords = ['issue', 'problem', 'vulnerable', 'weak', 'risk', 'dangerous', 'insecure'];
		
		let criticalCount = 0;
		let approvalCount = 0;
		let concernCount = 0;
		
		proposals.forEach(proposal => {
			const content = proposal.content.toLowerCase();
			
			const hasCritical = criticalIssues.some(issue => content.includes(issue));
			const hasApproval = approvalWords.some(word => content.includes(word));
			const hasConcern = concernWords.some(word => content.includes(word));
			
			if (hasCritical) {
				criticalCount++;
			} else if (hasConcern) {
				concernCount++;
			} else if (hasApproval) {
				approvalCount++;
			}
		});
		
		// Security consensus: must be unanimous approval with no critical issues
		const consensusScore = proposals.length > 0 ? approvalCount / proposals.length : 0;
		const hasCriticalIssues = criticalCount > 0;
		const duration = Date.now() - startTime;
		
		// Security decision logic
		let decision: string;
		let decisionEmoji: string;
		
		if (hasCriticalIssues || criticalCount > 0) {
			decision = 'SECURITY_REJECTED';
			decisionEmoji = '🚨';
		} else if (consensusScore >= 0.75 && concernCount === 0) {
			decision = 'SECURITY_APPROVED';
			decisionEmoji = '🛡️';
		} else {
			decision = 'NEEDS_SECURITY_REVIEW';
			decisionEmoji = '⚠️';
		}
		
		log.info(`📊 Claude Security Review Results:`);
		log.info(`   Consensus Score: ${consensusScore.toFixed(2)}`);
		log.info(`   Critical Issues Found: ${criticalCount}`);
		log.info(`   Security Concerns: ${concernCount}`);
		log.info(`   Security Approvals: ${approvalCount}`);
		log.info(`   Duration: ${duration}ms`);
		log.info(`   Security Decision: ${decision} ${decisionEmoji}`);
		
		// Create result object
		const result: ConsensusResult = {
			proposalId: sessionId,
			finalContent: JSON.stringify({
				securityDecision: decision,
				consensusScore,
				securityBreakdown: { 
					critical: criticalCount, 
					concerns: concernCount, 
					approvals: approvalCount 
				},
				reviews: proposals,
				codeReviewed: codeToReview,
				model: fullModelName,
				duration,
				claudeModel: selectedModel
			}, null, 2),
			consensus: {
				score: consensusScore,
				method: 'claude-security-analysis',
				participantCount: proposals.length,
			},
			auditTrail: proposals.map((p, i) => ({
				step: i + 1,
				agent: p.agent,
				action: 'security-review',
				timestamp: new Date().toISOString(),
				content: p.content.slice(0, 500) + (p.content.length > 500 ? '...' : ''),
			})),
			sessionId,
			duration,
			iterations: 1,
		};
		
		// Display security results
		console.log('\n' + '='.repeat(80));
		console.log('🛡️  CLAUDE SONNET SECURITY REVIEW RESULTS');
		console.log('='.repeat(80));
		console.log(`Goal: ${goal}`);
		console.log(`Claude Model: ${selectedModel} (${fullModelName})`);
		console.log(`Security Decision: ${decision} ${decisionEmoji}`);
		console.log(`Consensus Score: ${consensusScore.toFixed(2)}`);
		console.log(`Duration: ${duration}ms`);
		console.log(`\nSecurity Analysis: ${criticalCount} critical, ${concernCount} concerns, ${approvalCount} approvals`);
		
		console.log(`\nClaude Agent Reviews:`);
		proposals.forEach((p, i) => {
			console.log(`\n${i + 1}. ${p.agent} (${p.role}):`);
			console.log(`   ${p.content.slice(0, 600)}${p.content.length > 600 ? '...' : ''}`);
		});
		
		// Claude Code integration option
		if (options.useClaudeCode && decision === 'NEEDS_SECURITY_REVIEW') {
			console.log(`\n${'='.repeat(80)}`);
			console.log('🔧 CLAUDE CODE INTEGRATION');
			console.log(`${'='.repeat(80)}`);
			
			try {
				log.info("🔧 Running Claude Code CLI to fix security issues...");
				
				const fixPrompt = `Based on the security review above, please fix the following security vulnerabilities found in the authentication code:

1. Replace MD5 hashing with bcrypt for password security
2. Add proper input validation and sanitization
3. Use secure JWT secret management
4. Remove password exposure in getAllUsers method
5. Add rate limiting and brute force protection
6. Implement proper error handling without information leakage

Please provide the corrected, secure version of the AuthService class.`;
				
				const claudeCodeResult = await runClaudeCodeEdit(fixPrompt, options.codeFile ? [options.codeFile] : undefined);
				
				console.log("✅ Claude Code CLI completed! Review the changes:");
				console.log(claudeCodeResult);
				
			} catch (error) {
				log.warn({ error }, "⚠️ Claude Code CLI integration failed, but security review is complete");
				console.log(`\n⚠️ Claude Code integration failed: ${error.message}`);
				console.log("The security review above is still valid. You can manually apply the recommendations.");
			}
		}
		
		console.log('\n' + '='.repeat(80));
		
		return result;
		
	} catch (error) {
		log.error({ error: error.message }, "❌ Claude Sonnet review failed");
		throw error;
	}
}

// CLI setup
const program = new Command()
	.name("claude-sonnet-trial")
	.description("Claude Sonnet multi-agent code review with optional Claude Code CLI integration")
	.version("1.0.0");

program
	.command("test-connection")
	.description("Test connection to Claude API")
	.option("-m, --model <model>", "Claude model to test", "claude-3-sonnet")
	.action(async (options) => {
		try {
			await testClaudeConnection(options.model);
		} catch (error) {
			logger.error("Claude connection test failed");
			process.exit(1);
		}
	});

program
	.command("review")
	.description("Run Claude Sonnet multi-agent code review")
	.option("-m, --model <model>", "Claude model to use (claude-3-5-sonnet, claude-3-sonnet, claude-3-haiku)", "claude-3-sonnet")
	.option("-g, --goal <goal>", "Goal for the security review")
	.option("-t, --timeout <ms>", "Timeout in milliseconds", "120000")
	.option("--use-claude-code", "Use Claude Code CLI for automated fixes after review")
	.option("-f, --code-file <file>", "Specific code file to review with Claude Code CLI")
	.action(async (options) => {
		try {
			const result = await runClaudeSonnetReview({
				model: options.model,
				goal: options.goal,
				timeout: parseInt(options.timeout, 10),
				useClaudeCode: options.useClaudeCode,
				codeFile: options.codeFile
			});
			
			if (result) {
				logger.info("✅ Claude Sonnet review completed successfully");
			} else {
				logger.error("❌ Claude Sonnet review failed to produce results");
				process.exit(1);
			}
		} catch (error) {
			logger.error("Claude Sonnet review failed");
			process.exit(1);
		}
	});

program
	.command("models")
	.description("List available Claude models")
	.action(() => {
		console.log('\n' + '='.repeat(60));
		console.log('AVAILABLE CLAUDE MODELS');
		console.log('='.repeat(60));
		
		Object.entries(CLAUDE_MODELS).forEach(([shortName, fullName]) => {
			const recommended = shortName === 'claude-3-sonnet' ? ' (default)' : '';
			console.log(`${shortName}: ${fullName}${recommended}`);
		});
		
		console.log('='.repeat(60));
		console.log('Note: Requires ANTHROPIC_API_KEY environment variable');
		console.log('Get your key from: https://console.anthropic.com/');
		console.log('='.repeat(60) + '\n');
	});

// Default action - run review with defaults
program
	.action(async () => {
		try {
			logger.info("🎯 Running default Claude Sonnet security review");
			logger.info("💡 Use --help to see all available options");
			
			const result = await runClaudeSonnetReview({
				model: "claude-3-sonnet",
				goal: "Perform comprehensive security analysis of authentication code, identifying vulnerabilities and providing specific fixes"
			});
			
			if (result) {
				logger.info("✅ Claude Sonnet security review completed successfully");
				console.log(`\n💡 Next steps:`);
				console.log(`   • Review the security findings above`);
				console.log(`   • Run with --use-claude-code to get automated fixes`);
				console.log(`   • Try different Claude models with -m flag`);
			} else {
				logger.error("❌ Claude Sonnet review failed");
				process.exit(1);
			}
		} catch (error) {
			logger.error("Claude Sonnet review failed");
			process.exit(1);
		}
	});

// Parse CLI or run default
if (import.meta.url === `file://${process.argv[1]}`) {
	program.parse();
}

export { runClaudeSonnetReview, testClaudeConnection, CLAUDE_MODELS };