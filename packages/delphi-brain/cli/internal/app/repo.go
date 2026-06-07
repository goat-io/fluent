package app

import (
	"encoding/json"
	"fmt"
	"path/filepath"

	"github.com/goat-io/delphi-brain/cli/internal/domain"
)

type RepoService struct {
	repos    domain.RepoRepository
	tags     domain.TagRepository
	services domain.ServiceRepository
	docs     domain.DocumentRepository
	gh       domain.GitHubClient
}

func NewRepoService(repos domain.RepoRepository, tags domain.TagRepository, services domain.ServiceRepository, docs domain.DocumentRepository, gh domain.GitHubClient) *RepoService {
	return &RepoService{repos: repos, tags: tags, services: services, docs: docs, gh: gh}
}

func (s *RepoService) Import(org string) (int, error) {
	repos, err := s.gh.ListRepos(org)
	if err != nil {
		return 0, err
	}
	return s.repos.UpsertBatch(repos)
}

func (s *RepoService) Add(name, url, domainName string) error {
	return s.repos.Upsert(domain.Repo{Name: name, GitHubURL: url, Domain: domainName})
}

func (s *RepoService) List(filter domain.RepoFilter) ([]domain.RepoSummary, error) {
	return s.repos.List(filter)
}

func (s *RepoService) Get(name string) (*domain.Repo, []string, []domain.ServiceSummary, error) {
	repo, err := s.repos.Get(name)
	if err != nil {
		return nil, nil, nil, err
	}

	tags, _ := s.tags.ListByEntity("repo", name)
	svcs, _ := s.services.ListByRepo(name)

	return repo, tags, svcs, nil
}

// SyncSpecs fetches .brain.yml from each repo in the given org via GitHub API.
// This is the highest-priority metadata source. Repos without the file are skipped.
func (s *RepoService) SyncSpecs(org string, onProgress func(name, status string)) (found, notFound int, err error) {
	names, err := s.repos.ListNames(domain.RepoFilter{ExcludeArchived: true})
	if err != nil {
		return 0, 0, err
	}

	for _, name := range names {
		spec, err := s.gh.FetchRepoSpec(org, name)
		if err != nil || spec == nil {
			notFound++
			continue
		}

		updated := false
		// Scalars
		for field, value := range map[string]string{
			"domain":    spec.Domain,
			"team":      spec.Team,
			"system":    spec.System,
			"lifecycle": spec.Lifecycle,
		} {
			if value != "" {
				if err := s.repos.Update(name, field, value); err == nil {
					updated = true
				}
			}
		}
		if spec.Description != "" {
			if err := s.repos.Update(name, "description", spec.Description); err == nil {
				updated = true
			}
		}

		// String arrays → stored as JSON
		for field, arr := range map[string][]string{
			"provides_apis": spec.ProvidesAPIs,
			"consumes_apis": spec.ConsumesAPIs,
			"tags":          spec.Tags,
		} {
			if len(arr) > 0 {
				if j, err := json.Marshal(arr); err == nil {
					if err := s.repos.Update(name, field, string(j)); err == nil {
						updated = true
					}
				}
			}
		}

		// dependsOn is now []Dependency objects, not []string — marshal separately
		if len(spec.DependsOn) > 0 {
			if j, err := json.Marshal(spec.DependsOn); err == nil {
				if err := s.repos.Update(name, "depends_on", string(j)); err == nil {
					updated = true
				}
			}
		}

		// Structured objects → stored as JSON
		type jsonField struct {
			field string
			value interface{}
			empty bool
		}
		jsonFields := []jsonField{
			{"links", spec.Links, len(spec.Links) == 0},
			{"collaborators", spec.Collaborators, len(spec.Collaborators) == 0},
			{"deployment", spec.Deployment, spec.Deployment == nil},
			{"observability", spec.Observability, spec.Observability == nil},
			{"security", spec.Security, spec.Security == nil},
		}
		for _, jf := range jsonFields {
			if !jf.empty {
				if j, err := json.Marshal(jf.value); err == nil {
					if err := s.repos.Update(name, jf.field, string(j)); err == nil {
						updated = true
					}
				}
			}
		}

		if updated {
			found++
			if onProgress != nil {
				onProgress(name, "updated from .brain/spec.json")
			}
		}
	}

	return found, notFound, nil
}

// SyncFromCatalog backfills repo domain and status from indexed catalog entries.
// Catalog path convention: catalog/<kind>/<entry-name>/README.md (folder format).
// Only updates repos that still have domain='unknown'. Domain comes from the
// frontmatter; if missing, the entry is skipped (no path-derived fallback —
// the folder name is now the kind, not the domain).
// Returns (updated count, skipped count, error).
func (s *RepoService) SyncFromCatalog() (int, int, error) {
	catalogDocs, err := s.docs.List(domain.DocumentFilter{Catalog: true})
	if err != nil {
		return 0, 0, fmt.Errorf("listing catalog entries: %w", err)
	}

	updated, skipped := 0, 0
	for _, doc := range catalogDocs {
		// Folder format: catalog/<kind>/<entry-name>/README.md — entry name is
		// the parent directory of the README.
		dir := filepath.Dir(doc.Path)
		repoName := filepath.Base(dir)
		if repoName == "" || repoName == "catalog" {
			skipped++
			continue
		}

		domainValue := doc.Domain
		if domainValue == "" {
			skipped++
			continue
		}

		// Check if repo exists in DB
		repo, err := s.repos.Get(repoName)
		if err != nil {
			skipped++
			continue
		}

		// Update domain if it's unknown or different
		needsUpdate := false
		if repo.Domain == "unknown" || repo.Domain == "" {
			if err := s.repos.Update(repoName, "domain", domainValue); err == nil {
				needsUpdate = true
			}
		}

		// Update status from catalog if repo status is generic "active" and catalog has specific status
		if doc.Status != "" && doc.Status != repo.Status {
			catalogStatus := doc.Status
			// Map catalog statuses to repo statuses
			switch catalogStatus {
			case "production":
				catalogStatus = "active"
			case "prototype", "sunset":
				catalogStatus = "maintained"
			case "dead":
				catalogStatus = "dead"
			}
			// Only update if it's a valid repo status
			validStatuses := map[string]bool{"active": true, "maintained": true, "stale": true, "dead": true, "archived": true}
			if validStatuses[catalogStatus] {
				if err := s.repos.Update(repoName, "status", catalogStatus); err == nil {
					needsUpdate = true
				}
			}
		}

		if needsUpdate {
			updated++
		}
	}

	return updated, skipped, nil
}

func (s *RepoService) Update(name string, fields map[string]string) []error {
	var errs []error
	for field, value := range fields {
		if !domain.AllowedRepoUpdateFields[field] {
			errs = append(errs, fmt.Errorf("field not allowed: %s", field))
			continue
		}
		if err := s.repos.Update(name, field, value); err != nil {
			errs = append(errs, fmt.Errorf("error updating %s: %w", field, err))
		}
	}
	return errs
}
