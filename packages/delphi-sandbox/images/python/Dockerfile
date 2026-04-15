# goatlab/agent-python — Python agent workbench
# Build: docker build -t goatlab/agent-python:latest ./images/python/
FROM goatlab/agent-base:latest

RUN apt-get update && apt-get install -y -q --no-install-recommends \
    python3 python3-pip python3-venv \
    && curl -LsSf https://astral.sh/uv/install.sh | sh \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

ENV PATH="/root/.local/bin:${PATH}"
