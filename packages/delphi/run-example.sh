#!/bin/bash

# Example runner for Delphi pipeline
echo "🚀 Running Delphi Pipeline Example"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# Load environment variables
source .env

# Run the pipeline with a simple task
npx tsx src/graph.ts "Create a hello.ts file that exports a greet function returning 'Hello from Delphi!' with proper TypeScript types"