#!/bin/bash

echo "🚀 Running Enhanced Database Benchmarks"
echo ""
echo "Choose benchmark type:"
echo "1) Original benchmark (pure throughput)"
echo "2) Enhanced benchmark (transaction mix, no think time)"
echo "3) Enhanced benchmark (with realistic think time)"
echo "4) Compare all approaches"
echo ""
read -p "Enter choice (1-4): " choice

case $choice in
  1)
    echo "Running original benchmark..."
    pnpm benchmark:container
    ;;
  2)
    echo "Running enhanced benchmark without think time..."
    THINK_TIME=false pnpm benchmark:enhanced:clean
    ;;
  3)
    echo "Running enhanced benchmark with think time..."
    THINK_TIME=true pnpm benchmark:enhanced:clean
    ;;
  4)
    echo "Running comparison..."
    echo -e "\n=== ORIGINAL BENCHMARK ==="
    pnpm benchmark:container
    echo -e "\n=== ENHANCED (NO THINK TIME) ==="
    THINK_TIME=false pnpm benchmark:enhanced:clean
    echo -e "\n=== ENHANCED (WITH THINK TIME) ==="
    THINK_TIME=true pnpm benchmark:enhanced:clean
    ;;
  *)
    echo "Invalid choice"
    exit 1
    ;;
esac