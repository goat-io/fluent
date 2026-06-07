package app

import "github.com/goat-io/delphi-brain/cli/internal/domain"

// App groups all application services. Driving adapters (CLI, HTTP) use this
// as a single entry point to the application layer.
type App struct {
	Repos        *RepoService
	Services     *ServiceService
	Protocols    *ProtocolService
	Tags         *TagService
	Cloner       *CloneService
	Documents    *DocumentService
	Query        *QueryService
	Architecture *ArchitectureService
	Stitcher     *StitcherService
	Cost         *CostService
	Diagrams     *DiagramService
	Scope        *ScopeService
	Chat         *ChatService
	RAG          *RAGService
	Schema       *SchemaService
	Telemetry    *TelemetryService
	Lint         *LintService
	Evolve       *EvolveService
	Candidate    *CandidateService
}

// New wires all application services from the provided ports.
func New(
	repos domain.RepoRepository,
	services domain.ServiceRepository,
	protocols domain.ProtocolRepository,
	tags domain.TagRepository,
	docs domain.DocumentRepository,
	query domain.QueryRunner,
	cost domain.CostRepository,
	gh domain.GitHubClient,
	rag domain.RAGRepository,
	embedder domain.Embedder,
	reposDir string,
	repoRoot string,
) *App {
	docSvc := NewDocumentService(docs)
	querySvc := NewQueryService(query)
	stitcher := NewStitcherService(repoRoot)
	ragSvc := NewRAGService(rag, embedder)
	chatSvc := NewChatService(docSvc, querySvc, repoRoot)
	chatSvc.SetRAG(ragSvc)
	return &App{
		Repos:        NewRepoService(repos, tags, services, docs, gh),
		Services:     NewServiceService(services),
		Protocols:    NewProtocolService(protocols),
		Tags:         NewTagService(tags),
		Cloner:       NewCloneService(repos, gh, reposDir),
		Documents:    NewDocumentServiceWithRAG(docs, ragSvc),
		Query:        querySvc,
		Architecture: NewArchitectureService(repoRoot),
		Stitcher:     stitcher,
		Cost:         NewCostService(cost),
		Diagrams:     NewDiagramService(stitcher),
		Scope:        NewScopeService(stitcher),
		Chat:         chatSvc,
		RAG:          ragSvc,
		Schema:       NewSchemaService(repoRoot),
		Telemetry:    NewTelemetryService(repoRoot),
	}
}

// PostInit wires services that depend on each other (lint needs telemetry +
// docs + schema). Called after New() — keeps New()'s signature flat.
func (a *App) PostInit(repoRoot string) {
	a.Lint = NewLintService(repoRoot, a.Telemetry, a.Documents, a.Schema)
	a.Evolve = NewEvolveService(a.Telemetry, a.Lint)
	a.Candidate = NewCandidateService(repoRoot, a.Telemetry)
	// Phase 7 of brain-llm-wiki-evolution-plan.md — load lens manifests from
	// the instance's _instance/lenses/ dir. Drop-a-file extensibility.
	a.Scope.LoadManifests(repoRoot + "/brain/frontend/src/_instance/lenses")
}
