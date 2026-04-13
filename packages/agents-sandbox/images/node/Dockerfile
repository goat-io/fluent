# goatlab/agent-node — Node.js agent workbench
# Build: docker build -t goatlab/agent-node:latest ./images/node/
FROM goatlab/agent-base:latest

RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g pnpm@9 tsx \
    && apt-get clean && rm -rf /var/lib/apt/lists/*
