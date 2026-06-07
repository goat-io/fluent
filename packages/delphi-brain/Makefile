.PHONY: serve serve-chat build import clone index clean help setup \
       ollama-install ollama-model ollama-embed ollama-check \
       ui-install ui-dev ui-build sync stats search

# Delphi Brain — generic company-reasoning framework (extracted, company-agnostic).
# Just run: make serve (API + UI, no Ollama). For chat + RAG: make serve-chat.
#
# Company specifics live behind the `_instance/` seam and `brain.config.json`
# (see brain.config.example.json). The framework itself ships no company data.

BRAIN := ./cli/brain
BRAIN_SRC := cli
UI_DIR := frontend
CONFIG_FILE := $(BRAIN_SRC)/internal/domain/config.go
BRAIN_MODEL ?= $(shell grep 'DefaultModel' $(CONFIG_FILE) | head -1 | sed 's/.*= "//;s/"//')
BRAIN_PORT ?= $(shell grep 'DefaultPort' $(CONFIG_FILE) | head -1 | sed 's/.*= "//;s/"//')
BRAIN_ORG ?= $(shell grep 'DefaultGitHubOrg' $(CONFIG_FILE) | head -1 | sed 's/.*= "//;s/"//')
export BRAIN_ORG

# ── Main ──────────────────────────────────────────────────

serve: build index ui-install ## Start Brain API + UI (Ollama-free; for chat use `make serve-chat`)
	@pkill -f "cli/brain serve" 2>/dev/null || true
	@sleep 1
	@echo ""
	@echo "🧠 Starting Delphi Brain..."
	@echo "   API:    http://localhost:$(BRAIN_PORT)"
	@echo "   UI:     http://localhost:5173"
	@echo "   Chat:   disabled (run \`make serve-chat\` to enable Ollama-backed chat)"
	@echo ""
	@$(BRAIN) serve --port=$(BRAIN_PORT) &
	@cd $(UI_DIR) && npm run dev

setup: ollama-install ollama-check ollama-model ollama-embed build index ui-install ## One-shot first-time setup (Ollama + models + build + index)
	@echo ""
	@echo "✅ Setup complete. Run \`make serve\` (API+UI) or \`make serve-chat\` (with chat panel)."

serve-chat: ollama-install ollama-check ollama-model ollama-embed build index ui-install ## Same as `serve` plus Ollama for the chat panel
	@pkill -f "cli/brain serve" 2>/dev/null || true
	@sleep 1
	@echo ""
	@echo "🧠 Starting Delphi Brain (with chat)..."
	@echo "   Model:  $(BRAIN_MODEL)"
	@echo "   API:    http://localhost:$(BRAIN_PORT)"
	@echo "   UI:     http://localhost:5173"
	@echo ""
	@BRAIN_MODEL=$(BRAIN_MODEL) $(BRAIN) serve --port=$(BRAIN_PORT) &
	@cd $(UI_DIR) && npm run dev

# ── Internal targets ──────────────────────────────────────

build:
	@cd $(BRAIN_SRC) && CGO_ENABLED=1 go build -tags sqlite_fts5 -o brain .
	@$(BRAIN) schema registry >/dev/null  ## auto-regenerate schema/kinds-registry.json

index: build
	@$(BRAIN) index

ui-install:
	@cd $(UI_DIR) && npm install --silent

ollama-check:
	@if ! command -v ollama >/dev/null 2>&1; then \
		echo "❌ Ollama not installed. Run: make ollama-install"; \
		exit 1; \
	fi
	@if ! curl -sf http://localhost:11434/api/tags >/dev/null 2>&1; then \
		echo "⚠️  Ollama not running. Starting..."; \
		ollama serve & \
		sleep 2; \
	fi
	@echo "✅ Ollama running"

OLLAMA_MIN_VERSION := 0.20.6

ollama-install:
	@if command -v ollama >/dev/null 2>&1; then \
		echo "✅ Ollama present"; \
	elif [ "$$(uname)" = "Darwin" ]; then \
		echo "Installing Ollama..."; brew install --cask ollama 2>/dev/null || curl -fsSL https://ollama.com/install.sh | sh; \
	elif [ "$$(uname)" = "Linux" ]; then \
		echo "Installing Ollama..."; curl -fsSL https://ollama.com/install.sh | sh; \
	else \
		echo "❌ Unsupported OS. Install manually: https://ollama.com/download"; exit 1; \
	fi

ollama-model: ollama-check
	@if ollama list 2>/dev/null | grep -q "$(BRAIN_MODEL)"; then \
		echo "✅ Model $(BRAIN_MODEL) ready"; \
	else \
		echo "Pulling $(BRAIN_MODEL)..."; ollama pull $(BRAIN_MODEL); \
	fi

BRAIN_EMBED_MODEL ?= nomic-embed-text

ollama-embed: ollama-check ## Pull the embedding model used by RAG / hybrid search
	@if ollama list 2>/dev/null | grep -q "$(BRAIN_EMBED_MODEL)"; then \
		echo "✅ Embed model $(BRAIN_EMBED_MODEL) ready"; \
	else \
		echo "Pulling $(BRAIN_EMBED_MODEL)..."; ollama pull $(BRAIN_EMBED_MODEL); \
	fi

# ── Extras ────────────────────────────────────────────────

import: build ## Import all repos from a GitHub org (set BRAIN_ORG)
	$(BRAIN) repo import

clone: build ## Clone all repos (parallel)
	$(BRAIN) clone all --batch=10

sync: build ## Sync repo metadata
	$(BRAIN) repo sync

stats: build ## Show statistics
	$(BRAIN) stats

search: build ## Search (usage: make search q="alarm")
	$(BRAIN) query "SELECT name, domain FROM repos WHERE name LIKE '%$(q)%'"

clean: ## Remove the built binary (NOT brain.db)
	rm -f cli/brain

help: ## Show this help
	@echo ""
	@echo "  Delphi Brain"
	@echo ""
	@echo "  \033[36mmake setup\033[0m                              First-time: install Ollama + models, build, index"
	@echo "  \033[36mmake serve\033[0m                              API + UI, no Ollama (default)"
	@echo "  \033[36mmake serve-chat\033[0m                         Same plus Ollama-backed chat panel + RAG"
	@echo "  \033[36mBRAIN_PORT=8080 make serve\033[0m              Custom port"
	@echo ""
