package github

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strings"

	"github.com/goat-io/delphi-brain/cli/internal/domain"
)

// Client interacts with GitHub through the gh CLI.
type Client struct{}

func NewClient() *Client {
	return &Client{}
}

// ghRepo is the JSON shape returned by `gh repo list --json ...`.
type ghRepo struct {
	Name            string `json:"name"`
	URL             string `json:"url"`
	Description     string `json:"description"`
	IsArchived      bool   `json:"isArchived"`
	PrimaryLanguage struct {
		Name string `json:"name"`
	} `json:"primaryLanguage"`
	// repositoryTopics from gh CLI is either null or an array of {name: string}
	RepositoryTopics json.RawMessage `json:"repositoryTopics"`
}

type ghTopic struct {
	Name string `json:"name"`
}

func parseTopics(raw json.RawMessage) []string {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}

	// Try array of objects with .name field
	var topics []ghTopic
	if err := json.Unmarshal(raw, &topics); err == nil {
		var names []string
		for _, t := range topics {
			names = append(names, t.Name)
		}
		return names
	}

	// Try array of strings
	var names []string
	if err := json.Unmarshal(raw, &names); err == nil {
		return names
	}

	return nil
}

func (c *Client) ListRepos(org string) ([]domain.Repo, error) {
	out, err := exec.Command("gh", "repo", "list", org, "--limit", "500",
		"--json", "name,url,description,primaryLanguage,isArchived,repositoryTopics").Output()
	if err != nil {
		return nil, fmt.Errorf("gh error: %w", err)
	}

	var ghRepos []ghRepo
	if err := json.Unmarshal(out, &ghRepos); err != nil {
		return nil, fmt.Errorf("json parse error: %w", err)
	}

	var repos []domain.Repo
	for _, gr := range ghRepos {
		repo := domain.Repo{
			Name:        gr.Name,
			GitHubURL:   gr.URL,
			Description: gr.Description,
			Language:    gr.PrimaryLanguage.Name,
			Status:      "active",
			Domain:      "unknown",
		}

		if gr.IsArchived {
			repo.Status = "archived"
		}

		// Parse GitHub topics for structured metadata.
		// Convention: "domain-<name>", "team-<name>", "status-<name>"
		topics := parseTopics(gr.RepositoryTopics)
		for _, topic := range topics {

			switch {
			case strings.HasPrefix(topic, "domain-"):
				repo.Domain = strings.TrimPrefix(topic, "domain-")
			case strings.HasPrefix(topic, "team-"):
				repo.Team = strings.TrimPrefix(topic, "team-")
			case strings.HasPrefix(topic, "status-"):
				// Only override if not archived (archived from GitHub takes priority)
				if !gr.IsArchived {
					repo.Status = strings.TrimPrefix(topic, "status-")
				}
			}
		}

		repos = append(repos, repo)
	}

	return repos, nil
}

func (c *Client) CloneRepo(url, dest string) error {
	cmd := exec.Command("gh", "repo", "clone", url, dest, "--", "--depth=1")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func (c *Client) UpdateRepo(dest string) error {
	fetch := exec.Command("git", "-C", dest, "fetch", "--depth=1", "origin")
	fetch.Stderr = os.Stderr
	if err := fetch.Run(); err != nil {
		return fmt.Errorf("fetch failed: %w", err)
	}
	reset := exec.Command("git", "-C", dest, "reset", "--hard", "FETCH_HEAD")
	reset.Stderr = os.Stderr
	return reset.Run()
}

// FetchRepoSpec reads .brain/spec.json from a repo via the GitHub contents API.
// Returns nil, nil if the file doesn't exist (404).
func (c *Client) FetchRepoSpec(org, repoName string) (*domain.RepoSpec, error) {
	out, err := exec.Command("gh", "api",
		fmt.Sprintf("repos/%s/%s/contents/.brain/spec.json", org, repoName),
		"--jq", ".content",
	).Output()
	if err != nil {
		return nil, nil
	}

	decoded, err := base64.StdEncoding.DecodeString(strings.TrimSpace(string(out)))
	if err != nil {
		return nil, nil
	}

	var spec domain.RepoSpec
	if err := json.Unmarshal(decoded, &spec); err != nil {
		return nil, nil
	}
	return &spec, nil
}
