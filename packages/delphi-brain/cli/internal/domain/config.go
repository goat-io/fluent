package domain

import (
	"encoding/json"
	"os"
	"sync"
)

// Default configuration for the Brain service.
const (
	DefaultModel      = "qwen3:4b"
	DefaultEmbedModel = "nomic-embed-text"
	DefaultOllamaURL  = "http://localhost:11434"
	DefaultPort       = "7613"
	// DefaultGitHubOrg is intentionally empty: Brain is company-agnostic.
	// Provide the org per-instance via `brain.config.json` (github.defaultOrg)
	// or the BRAIN_ORG env var.
	DefaultGitHubOrg = ""
)

// BrainConfig is the per-company instance configuration — the seam that keeps
// the framework generic. Loaded from `brain.config.json` (see
// brain.config.example.json). Every place a company identity used to be baked
// into generic code (chat system prompt, source links, branding, default org)
// now reads from here. The HTTP API serves it at GET /api/config so the
// frontend de-hardcodes too.
type BrainConfig struct {
	Org struct {
		Name           string `json:"name"`
		Description    string `json:"description"`
		SourceBaseURL  string `json:"sourceBaseUrl"`
		CatalogRepoURL string `json:"catalogRepoUrl"`
	} `json:"org"`
	GitHub struct {
		DefaultOrg string `json:"defaultOrg"`
	} `json:"github"`
	Chat struct {
		AssistantName        string `json:"assistantName"`
		Model                string `json:"model"`
		SystemPromptTemplate string `json:"systemPromptTemplate"`
	} `json:"chat"`
	Embed struct {
		Model string `json:"model"`
	} `json:"embed"`
	Branding struct {
		ShortName string         `json:"shortName"`
		Tagline   string         `json:"tagline"`
		LogoURL   string         `json:"logoUrl"`
		Palette   map[string]any `json:"palette"`
	} `json:"branding"`
}

var (
	cfgOnce   sync.Once
	cfgLoaded BrainConfig
)

// ConfigPath returns the path to the instance config file. Override via
// BRAIN_CONFIG; defaults to `brain.config.json` relative to the working dir.
func ConfigPath() string {
	if v := os.Getenv("BRAIN_CONFIG"); v != "" {
		return v
	}
	return "brain.config.json"
}

// LoadConfig reads and caches brain.config.json. A missing file is not an error
// — it returns a zero config with sane defaults applied, so the framework runs
// generically out of the box.
func LoadConfig() BrainConfig {
	cfgOnce.Do(func() {
		var c BrainConfig
		if data, err := os.ReadFile(ConfigPath()); err == nil {
			_ = json.Unmarshal(data, &c)
		}
		if c.Chat.AssistantName == "" {
			c.Chat.AssistantName = "Brain"
		}
		if c.Chat.Model == "" {
			c.Chat.Model = DefaultModel
		}
		if c.Embed.Model == "" {
			c.Embed.Model = DefaultEmbedModel
		}
		cfgLoaded = c
	})
	return cfgLoaded
}

// GitHubOrg returns the configured GitHub org. Precedence: BRAIN_ORG env var,
// then brain.config.json (github.defaultOrg), then DefaultGitHubOrg.
func GitHubOrg() string {
	if v := os.Getenv("BRAIN_ORG"); v != "" {
		return v
	}
	if v := LoadConfig().GitHub.DefaultOrg; v != "" {
		return v
	}
	return DefaultGitHubOrg
}

// CatalogDir returns the directory containing typed catalog entries. Override
// via `BRAIN_CATALOG_DIR=<path>` (relative to repo root). Default: `catalog`.
func CatalogDir() string {
	if v := os.Getenv("BRAIN_CATALOG_DIR"); v != "" {
		return v
	}
	return "catalog"
}

// NarrativesDir returns the directory containing cross-cutting narrative docs.
// Override via `BRAIN_NARRATIVES_DIR=<path>`. Default: `narratives`.
func NarrativesDir() string {
	if v := os.Getenv("BRAIN_NARRATIVES_DIR"); v != "" {
		return v
	}
	return "narratives"
}

// SchemaDir returns the directory containing the Brain JSON Schemas
// (schema/<kind>.schema.json). Override via `BRAIN_SCHEMA_DIR=<path>`.
// Default: `schema`. Backs SchemaService (Phase 1, schema-as-runtime).
func SchemaDir() string {
	if v := os.Getenv("BRAIN_SCHEMA_DIR"); v != "" {
		return v
	}
	return "schema"
}

// CandidatesDir returns the path (relative to repo root) to the LLM-proposed
// wiki staging area. Files under this path are excluded from indexing, RAG,
// and graph traversal (§8 Q11). Default: `narratives/candidates`.
func CandidatesDir() string {
	if v := os.Getenv("BRAIN_CANDIDATES_DIR"); v != "" {
		return v
	}
	return "narratives/candidates"
}

// TelemetryDir returns the path (relative to repo root) where Brain writes
// the telemetry event log + rollup. Both files are committed to git per §8 Q1.
// Override via `BRAIN_TELEMETRY_DIR`. Default: `telemetry`.
func TelemetryDir() string {
	if v := os.Getenv("BRAIN_TELEMETRY_DIR"); v != "" {
		return v
	}
	return "telemetry"
}
