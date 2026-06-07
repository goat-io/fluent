// Package ollama is a tiny HTTP client for the local Ollama API. We use it
// for nomic-embed-text vectors (Phase D RAG). The chat path uses ollama's
// generate endpoint elsewhere; embeddings are kept here to avoid coupling.
package ollama

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

const (
	defaultURL   = "http://localhost:11434"
	defaultModel = "nomic-embed-text"
)

type Client struct {
	BaseURL string
	Model   string
	HTTP    *http.Client
}

func New() *Client {
	url := os.Getenv("BRAIN_OLLAMA_URL")
	if url == "" {
		url = defaultURL
	}
	model := os.Getenv("BRAIN_EMBED_MODEL")
	if model == "" {
		model = defaultModel
	}
	return &Client{
		BaseURL: url,
		Model:   model,
		HTTP:    &http.Client{Timeout: 120 * time.Second},
	}
}

// Available returns true when Ollama responds within 1s. Used to gate RAG
// ingestion so the rest of the indexer keeps working when Ollama is down.
func (c *Client) Available() bool {
	hc := &http.Client{Timeout: 1 * time.Second}
	r, err := hc.Get(c.BaseURL + "/api/tags")
	if err != nil {
		return false
	}
	defer r.Body.Close()
	return r.StatusCode == 200
}

type embedReq struct {
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
}

type embedResp struct {
	Embedding []float32 `json:"embedding"`
}

// Embed returns the vector for `text`, treated as a document chunk.
// Use EmbedQuery for user queries — nomic-embed-text requires different
// task prefixes for asymmetric retrieval and mixing them collapses recall.
func (c *Client) Embed(text string) ([]float32, error) {
	return c.embedWithPrefix("search_document: ", text)
}

// EmbedQuery returns the vector for a search query. Prefix differs from
// document embedding so the model places queries and docs in the same space.
func (c *Client) EmbedQuery(text string) ([]float32, error) {
	return c.embedWithPrefix("search_query: ", text)
}

func (c *Client) embedWithPrefix(prefix, text string) ([]float32, error) {
	if text == "" {
		return nil, nil
	}
	body, _ := json.Marshal(embedReq{Model: c.Model, Prompt: prefix + text})
	req, _ := http.NewRequest("POST", c.BaseURL+"/api/embeddings", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("ollama embed %d: %s", resp.StatusCode, string(b))
	}
	var er embedResp
	if err := json.NewDecoder(resp.Body).Decode(&er); err != nil {
		return nil, err
	}
	return er.Embedding, nil
}
