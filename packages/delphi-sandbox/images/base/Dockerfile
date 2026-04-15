# goatlab/agent-base — Minimal agent workbench
# Build: docker build -t goatlab/agent-base:latest ./images/base/
FROM ubuntu:24.04

ENV LANG='en_US.UTF-8' LANGUAGE='en_US:en' LC_ALL='en_US.UTF-8'
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y -q --no-install-recommends \
    git curl wget jq ca-certificates locales openssh-client unzip tar \
    && echo "en_US.UTF-8 UTF-8" >> /etc/locale.gen \
    && locale-gen en_US.UTF-8 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Pulumi CLI
RUN curl -fsSL https://get.pulumi.com | sh
ENV PATH="/root/.pulumi/bin:${PATH}"

WORKDIR /workspace
CMD ["sleep", "infinity"]
