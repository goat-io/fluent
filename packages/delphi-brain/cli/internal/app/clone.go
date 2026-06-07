package app

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"

	"github.com/goat-io/delphi-brain/cli/internal/domain"
)

const defaultBatchSize = 10

type CloneService struct {
	repos    domain.RepoRepository
	gh       domain.GitHubClient
	reposDir string
}

func NewCloneService(repos domain.RepoRepository, gh domain.GitHubClient, reposDir string) *CloneService {
	return &CloneService{repos: repos, gh: gh, reposDir: reposDir}
}

// CloneResult holds the outcome of a single clone operation.
type CloneResult struct {
	Name    string
	Message string
	Err     error
}

// Clone clones a single repo by name, or updates it if already cloned.
func (s *CloneService) Clone(name string) (string, error) {
	url, err := s.repos.GetURL(name)
	if err != nil {
		return "", fmt.Errorf("repo not found: %s", name)
	}

	os.MkdirAll(s.reposDir, 0755)
	dest := filepath.Join(s.reposDir, name)

	if _, err := os.Stat(filepath.Join(dest, ".git")); err == nil {
		// Already cloned — fetch latest
		if err := s.gh.UpdateRepo(dest); err != nil {
			return "", fmt.Errorf("update failed: %w", err)
		}
		s.repos.SetCloned(name, dest)
		return fmt.Sprintf("Updated: %s", name), nil
	}

	if err := s.gh.CloneRepo(url, dest); err != nil {
		return "", fmt.Errorf("clone failed: %w", err)
	}

	s.repos.SetCloned(name, dest)
	return fmt.Sprintf("Cloned: %s", name), nil
}

// CloneParallel clones a list of repos in parallel batches.
// batchSize controls concurrency (0 = default of 10).
// The callback is called for each completed clone (thread-safe).
func (s *CloneService) CloneParallel(names []string, batchSize int, onResult func(CloneResult)) {
	if batchSize <= 0 {
		batchSize = defaultBatchSize
	}

	var done atomic.Int64
	total := len(names)

	for i := 0; i < total; i += batchSize {
		end := i + batchSize
		if end > total {
			end = total
		}
		batch := names[i:end]

		var wg sync.WaitGroup
		for _, name := range batch {
			wg.Add(1)
			go func(n string) {
				defer wg.Done()
				msg, err := s.Clone(n)
				count := done.Add(1)
				result := CloneResult{Name: n, Message: msg, Err: err}
				if onResult != nil {
					onResult(result)
				} else {
					if err != nil {
						fmt.Fprintf(os.Stderr, "  [%d/%d] skip %s: %v\n", count, total, n, err)
					} else {
						fmt.Printf("  [%d/%d] %s\n", count, total, msg)
					}
				}
			}(name)
		}
		wg.Wait()
	}
}

// CloneAll returns all non-archived repo names.
func (s *CloneService) CloneAll() ([]string, error) {
	return s.repos.ListNames(domain.RepoFilter{ExcludeArchived: true})
}

// CloneDomain returns all non-archived repo names in a domain.
func (s *CloneService) CloneDomain(domainName string) ([]string, error) {
	return s.repos.ListNames(domain.RepoFilter{Domain: domainName, ExcludeArchived: true})
}
