#!/bin/bash

# Delphi Automated Dev Pipeline - Start Script
# This script starts all required services for the Delphi pipeline

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AUTOGEN_PORT=8100  # Non-standard port for AutoGen service
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}🚀 Starting Delphi Automated Dev Pipeline${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a port is in use
port_is_free() {
    ! lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1
}

# Function to wait for a service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=0
    
    echo -ne "${YELLOW}⏳ Waiting for $service_name to be ready${NC}"
    while [ $attempt -lt $max_attempts ]; do
        if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200\|404"; then
            echo -e "\r${GREEN}✅ $service_name is ready!${NC}                    "
            return 0
        fi
        echo -n "."
        sleep 1
        ((attempt++))
    done
    echo -e "\r${RED}❌ $service_name failed to start${NC}"
    return 1
}

# Step 1: Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

if ! command_exists node; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+${NC}"
    exit 1
fi

if ! command_exists python3; then
    echo -e "${RED}❌ Python 3 is not installed. Please install Python 3.10+${NC}"
    exit 1
fi

if ! command_exists tsx; then
    echo -e "${YELLOW}📦 Installing tsx globally...${NC}"
    npm install -g tsx
fi

echo -e "${GREEN}✅ All prerequisites met${NC}"

# Step 2: Check ports
echo -e "\n${YELLOW}🔍 Checking port availability...${NC}"

if ! port_is_free $AUTOGEN_PORT; then
    echo -e "${RED}❌ Port $AUTOGEN_PORT is already in use (AutoGen)${NC}"
    echo -e "${YELLOW}💡 Stopping existing service on port $AUTOGEN_PORT...${NC}"
    lsof -ti:$AUTOGEN_PORT | xargs kill -9 2>/dev/null || true
    sleep 2
fi

echo -e "${GREEN}✅ Ports are available${NC}"

# Step 3: Update environment file
echo -e "\n${YELLOW}🔧 Configuring environment...${NC}"

cd "$PROJECT_DIR"

# Create .env file with updated configuration
cat > .env << EOF
# Delphi Environment Configuration
OPENAI_API_KEY=${OPENAI_API_KEY:-your-openai-key-here}
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-your-anthropic-key-here}
AUTOGEN_SERVICE_URL=http://localhost:${AUTOGEN_PORT}
SQLITE_DB_PATH=${PROJECT_DIR}/.delphi/checkpoints.db
TEST_COMMAND=npm test
ENABLE_TESTS=true
MAX_ITERATIONS=5
EOF

# Create .delphi directory for SQLite database
mkdir -p .delphi

echo -e "${GREEN}✅ Environment configured${NC}"

# Step 4: Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "\n${YELLOW}📦 Installing Node.js dependencies...${NC}"
    npm install
fi

cd python

if [ ! -d "venv" ]; then
    echo -e "\n${YELLOW}🐍 Creating Python virtual environment...${NC}"
    python3 -m venv venv
fi

echo -e "\n${YELLOW}📦 Installing Python dependencies...${NC}"
source venv/bin/activate
pip install -q -r requirements.txt

cd ..

# Step 5: Start AutoGen service
echo -e "\n${YELLOW}🤖 Starting AutoGen service on port $AUTOGEN_PORT...${NC}"

# Kill any existing AutoGen process
pkill -f "autogen_service.py" 2>/dev/null || true

# Start AutoGen in background
cd python
source venv/bin/activate
AUTOGEN_PORT=${AUTOGEN_PORT} python autogen_service.py > ../autogen.log 2>&1 &
AUTOGEN_PID=$!
cd ..

# Wait for AutoGen to be ready
if wait_for_service "http://localhost:${AUTOGEN_PORT}/health" "AutoGen service"; then
    echo -e "${YELLOW}   PID: $AUTOGEN_PID${NC}"
else
    echo -e "${RED}❌ AutoGen service failed to start. Check autogen.log for details${NC}"
    exit 1
fi

# Step 6: Test the setup
echo -e "\n${YELLOW}🧪 Running quick test...${NC}"

# Create a test script
cat > test_setup.ts << 'EOF'
import { Http } from '@goatlab/js-utils';

async function testSetup() {
    const autogenPort = process.env.AUTOGEN_SERVICE_URL?.split(':').pop()?.replace('/', '') || '8100';
    
    console.log('Testing AutoGen service...');
    try {
        const client = Http.getClient({ prefixUrl: `http://localhost:${autogenPort}` });
        const health = await client.get('health').json();
        console.log('✅ AutoGen service is healthy:', health);
    } catch (error) {
        console.error('❌ AutoGen service test failed:', error.message);
        process.exit(1);
    }
    
    console.log('\n✅ All services are working correctly!');
}

testSetup().catch(console.error);
EOF

npx tsx test_setup.ts
rm test_setup.ts

# Step 7: Display usage instructions
echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 Delphi Pipeline is ready!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo
echo -e "${BLUE}Services running:${NC}"
echo -e "  🤖 AutoGen API: localhost:${AUTOGEN_PORT}"
echo -e "  💾 SQLite DB:   ${PROJECT_DIR}/.delphi/checkpoints.db"
echo -e "  📝 Logs:        autogen.log"
echo
echo -e "${BLUE}Usage:${NC}"
echo -e "  ${YELLOW}npx tsx src/graph.ts \"Your task description\"${NC}"
echo
echo -e "${BLUE}Examples:${NC}"
echo -e "  ${YELLOW}npx tsx src/graph.ts \"Add user authentication\"${NC}"
echo -e "  ${YELLOW}npx tsx src/graph.ts \"Refactor database queries\"${NC}"
echo
echo -e "${BLUE}To stop all services:${NC}"
echo -e "  ${YELLOW}./stop.sh${NC}"
echo
echo -e "${BLUE}To view logs:${NC}"
echo -e "  ${YELLOW}tail -f autogen.log${NC}"
echo

# Keep track of PIDs
echo "$AUTOGEN_PID" > .autogen.pid

echo -e "${GREEN}Happy coding! 🚀${NC}"