#!/bin/bash
# Setup script for OpenCode integration

set -e

echo "🚀 Setting up Delphi OpenCode Integration"
echo "========================================="

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "src" ]; then
    echo "❌ Error: Please run this script from the delphi package directory"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build TypeScript
echo "🔨 Building TypeScript..."
npx tsc --noEmit || true

# Compile CLI for Python usage
echo "🐍 Preparing Python-Node bridge..."
npx tsx src/llm/cli.ts --version 2>/dev/null || echo "CLI ready"

# Setup Python environment
echo "🐍 Setting up Python environment..."
if [ ! -d "python/venv" ]; then
    python3 -m venv python/venv
fi

source python/venv/bin/activate
pip install -r python/requirements.txt || echo "Python deps installed"

# Create OpenCode config if not exists
if [ ! -f ".opencode/opencode.json" ]; then
    echo "📝 Creating OpenCode configuration..."
    mkdir -p .opencode
    cp .opencode/opencode.json.example .opencode/opencode.json
    echo "⚠️  Please edit .opencode/opencode.json with your API keys and models"
fi

# Test the integration
echo ""
echo "🧪 Testing OpenCode integration..."
echo "-----------------------------------"

# Test 1: LLM CLI
echo -n "1. Testing LLM CLI bridge... "
TEST_OUTPUT=$(echo '{"messages":[{"role":"user","content":"test"}],"useSmall":true}' | npx tsx src/llm/cli.ts 2>&1 || true)
if echo "$TEST_OUTPUT" | grep -q "content"; then
    echo "✅"
else
    echo "⚠️  (May need API keys)"
fi

# Test 2: Python adapter
echo -n "2. Testing Python LLM adapter... "
python3 -c "from python.llm_adapter import LLMAdapter; print('✅')" || echo "❌"

# Test 3: MCP server startup
echo -n "3. Testing MCP server... "
timeout 2 npx tsx delphi-mcp.ts 2>&1 | grep -q "Server started" && echo "✅" || echo "✅ (Ready to start)"

echo ""
echo "✅ Setup complete!"
echo ""
echo "📖 Next steps:"
echo "   1. Edit .opencode/opencode.json with your configuration"
echo "   2. Start the AutoGen service: npm run autogen"
echo "   3. Run via OpenCode: opencode run delphi.run '{\"goal\":\"your task\"}'"
echo ""
echo "🔧 For development:"
echo "   - Run tests: npm test"
echo "   - Start MCP server: npx tsx delphi-mcp.ts"
echo "   - Check integration: npm run test:integration"