#!/bin/bash
# Complete test suite runner for Delphi

set -e

echo "🧪 Delphi Test Suite"
echo "===================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Track results
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run test category
run_test() {
    local name=$1
    local cmd=$2
    
    echo -e "\n${YELLOW}Running: $name${NC}"
    if eval "$cmd"; then
        echo -e "${GREEN}✅ $name passed${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ $name failed${NC}"
        ((TESTS_FAILED++))
    fi
}

# TypeScript Tests
run_test "TypeScript Types" "npx vitest run tests/types.spec.ts --reporter=verbose"
run_test "SQLite Adapter" "npx vitest run tests/sqlite.spec.ts --reporter=verbose"
run_test "Model Adapter" "npx vitest run tests/adapter.spec.ts --reporter=verbose"
run_test "Graph Integration" "npx vitest run tests/graph.integration.spec.ts --reporter=verbose"
run_test "Security Tests" "npx vitest run tests/security.spec.ts --reporter=verbose"

# Python Tests
echo -e "\n${YELLOW}Setting up Python environment...${NC}"
if [ ! -d "python/venv" ]; then
    python3 -m venv python/venv
fi
source python/venv/bin/activate
pip install -q -r python/requirements.txt

run_test "Python Planner" "python -m pytest python/tests/test_planner.py -v"
run_test "Python Reviewer" "python -m pytest python/tests/test_reviewer.py -v"
run_test "CLI Bridge" "python -m pytest python/tests/test_cli_bridge.py -v"

# Coverage Report
echo -e "\n${YELLOW}Coverage Report:${NC}"
echo "----------------"

# TypeScript coverage
TS_COVERAGE=$(npx vitest run --coverage 2>/dev/null | grep "All files" | awk '{print $10}' || echo "N/A")
echo "TypeScript Coverage: $TS_COVERAGE"

# Python coverage
PY_COVERAGE=$(python -m pytest --cov=python --cov-report=term 2>/dev/null | grep "TOTAL" | awk '{print $4}' || echo "N/A")
echo "Python Coverage: $PY_COVERAGE"

# Summary
echo -e "\n${YELLOW}Test Summary:${NC}"
echo "============="
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed${NC}"
    exit 1
fi