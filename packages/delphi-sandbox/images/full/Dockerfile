# goatlab/agent-full — Full-stack agent workbench
# Build: docker build -t goatlab/agent-full:latest ./images/full/
FROM goatlab/agent-base:latest

# Node.js 20 + pnpm
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g pnpm@9 tsx \
    && rm -rf /var/lib/apt/lists/*

# Python 3 + uv
RUN apt-get update && apt-get install -y -q --no-install-recommends \
    python3 python3-pip python3-venv \
    && curl -LsSf https://astral.sh/uv/install.sh | sh \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Build tools
RUN apt-get update && apt-get install -y -q --no-install-recommends \
    build-essential make g++ \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Docker CLI (for Docker-in-Docker via socket mount)
RUN curl -fsSL https://get.docker.com | sh \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Docker Compose plugin
RUN mkdir -p /usr/local/lib/docker/cli-plugins \
    && curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m) \
       -o /usr/local/lib/docker/cli-plugins/docker-compose \
    && chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

ENV PATH="/root/.local/bin:${PATH}"
