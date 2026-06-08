package app

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/goat-io/delphi-brain/cli/internal/domain"
)

// ChatService provides agentic conversational access to the Brain knowledge base.
// The LLM decides which tools to call (search, read file, query DB, list repos)
// and iterates until it has enough information to answer.
type ChatService struct {
	docs         *DocumentService
	query        *QueryService
	rag          *RAGService // optional; nil = rag_search tool unavailable
	root         string
	ollamaURL    string
	model        string
	systemPrompt string
}

func NewChatService(docs *DocumentService, query *QueryService, root string) *ChatService {
	cfg := domain.LoadConfig()
	ollamaURL := os.Getenv("OLLAMA_URL")
	if ollamaURL == "" {
		ollamaURL = domain.DefaultOllamaURL
	}
	// Model precedence: BRAIN_MODEL env, then brain.config.json (chat.model),
	// then the built-in default.
	model := os.Getenv("BRAIN_MODEL")
	if model == "" {
		model = cfg.Chat.Model
	}
	if model == "" {
		model = domain.DefaultModel
	}
	return &ChatService{
		docs:         docs,
		query:        query,
		root:         root,
		ollamaURL:    ollamaURL,
		model:        model,
		systemPrompt: buildSystemPrompt(cfg),
	}
}

// SetRAG enables the rag_search tool when the RAG service + Ollama are wired.
func (s *ChatService) SetRAG(rag *RAGService) { s.rag = rag }

// --- Ollama API types ---

type Message struct {
	Role      string     `json:"role"`
	Content   string     `json:"content"`
	ToolCalls []ToolCall `json:"tool_calls,omitempty"`
}

type ChatRequest struct {
	Messages []Message `json:"messages"`
}

type ToolCall struct {
	Function ToolFunction `json:"function"`
}

type ToolFunction struct {
	Name      string          `json:"name"`
	Arguments json.RawMessage `json:"arguments"`
}

type ollamaRequest struct {
	Model    string          `json:"model"`
	Messages []ollamaMessage `json:"messages"`
	Tools    []ollamaTool    `json:"tools,omitempty"`
	Stream   bool            `json:"stream"`
	// Disable extended <think> blocks for qwen3 (and similar). Falls through
	// harmlessly for models that don't recognise the field. Without this,
	// qwen3:4b spends pages reasoning before any tool call or answer.
	Think bool `json:"think"`
	// Constrain output to JSON. Used for the pre-flight SQL decider so the
	// model can't ramble — it returns either {"sql": "SELECT …"} or {}.
	Format string `json:"format,omitempty"`
}

type ollamaMessage struct {
	Role      string     `json:"role"`
	Content   string     `json:"content"`
	ToolCalls []ToolCall `json:"tool_calls,omitempty"`
}

type ollamaTool struct {
	Type     string             `json:"type"`
	Function ollamaToolFunction `json:"function"`
}

type ollamaToolFunction struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters"`
}

type ollamaStreamChunk struct {
	Message struct {
		Role      string     `json:"role"`
		Content   string     `json:"content"`
		Thinking  string     `json:"thinking,omitempty"`
		ToolCalls []ToolCall `json:"tool_calls,omitempty"`
	} `json:"message"`
	Done bool `json:"done"`
}

// --- System prompt ---

// genericChatInstructions is the company-agnostic core of the chat system
// prompt. Company-specific facts are injected from brain.config.json
// (org.name, org.description) by buildSystemPrompt — never hardcoded here.
const genericChatInstructions = `The user's question is pre-grounded: before you see it, a semantic search runs across the entire knowledge base and the top matches are injected as system "Retrieved context" messages. **Read the retrieved context first.** It is the authoritative source for your answer.

How to respond:
1. Read the retrieved-context blocks (system messages titled "Retrieved context").
2. If they contain the answer → answer in 2–4 sentences, citing the file paths (e.g. narratives/architecture/overview.md). DO NOT call any tools. DO NOT pretend to call a tool. DO NOT speculate beyond the context.
3. If the context is missing the answer → call ONE tool (rag_search for concepts, read_file for a specific path, query_db for SQL counts), then answer.
4. Keep reasoning to a single short sentence. No long internal deliberation. /no_think

If you find yourself thinking about contradictions between context and imagined tool results, you are over-thinking. Just answer from the retrieved context.

Keep answers concise. Use markdown.`

// buildSystemPrompt assembles the chat system prompt for the configured company.
// If chat.systemPromptTemplate is set in brain.config.json it is used verbatim
// (with {{assistantName}}, {{org.name}}, {{org.description}} interpolated);
// otherwise the generic instructions are used with the company name and
// description injected. No company identity is ever hardcoded here.
func buildSystemPrompt(cfg domain.BrainConfig) string {
	name := cfg.Chat.AssistantName
	if name == "" {
		name = "Brain"
	}
	org := cfg.Org.Name
	if org == "" {
		org = "the company"
	}
	if t := strings.TrimSpace(cfg.Chat.SystemPromptTemplate); t != "" {
		t = strings.ReplaceAll(t, "{{assistantName}}", name)
		t = strings.ReplaceAll(t, "{{org.name}}", org)
		t = strings.ReplaceAll(t, "{{org.description}}", cfg.Org.Description)
		return t
	}
	var b strings.Builder
	fmt.Fprintf(&b, "You are %s, %s's knowledge assistant.\n\n", name, org)
	b.WriteString(genericChatInstructions)
	if d := strings.TrimSpace(cfg.Org.Description); d != "" {
		b.WriteString("\n\n## Company\n\n" + d + "\n")
	}
	return b.String()
}

// --- Tool definitions ---

var tools = []ollamaTool{
	{
		Type: "function",
		Function: ollamaToolFunction{
			Name:        "search_docs",
			Description: "Search the Brain knowledge base for documents matching a query. Returns file paths and snippets. Use this to find relevant documentation about any topic.",
			Parameters: map[string]interface{}{
				"type":     "object",
				"required": []string{"query"},
				"properties": map[string]interface{}{
					"query": map[string]interface{}{
						"type":        "string",
						"description": "Search query (e.g. 'alarm routing', 'ICC backend', 'database')",
					},
				},
			},
		},
	},
	{
		Type: "function",
		Function: ollamaToolFunction{
			Name:        "read_file",
			Description: "Read a file from the knowledge base. Use after search_docs to read full content of a relevant file.",
			Parameters: map[string]interface{}{
				"type":     "object",
				"required": []string{"path"},
				"properties": map[string]interface{}{
					"path": map[string]interface{}{
						"type":        "string",
						"description": "Relative file path (e.g. 'narratives/architecture/overview.md')",
					},
				},
			},
		},
	},
	{
		Type: "function",
		Function: ollamaToolFunction{
			Name:        "query_repos",
			Description: "Query the repository database. Returns repo names, domains, teams, languages, and statuses. Use for questions about repos, teams, counts, or ownership.",
			Parameters: map[string]interface{}{
				"type":     "object",
				"required": []string{"domain"},
				"properties": map[string]interface{}{
					"domain": map[string]interface{}{
						"type":        "string",
						"description": "Filter by domain (e.g. 'icc', 'iot-backend', 'apps', 'embedded', 'ico', 'identity', 'infrastructure'). Use empty string for all domains.",
					},
				},
			},
		},
	},
	{
		Type: "function",
		Function: ollamaToolFunction{
			Name:        "rag_search",
			Description: "Semantic search across all indexed markdown via vector embeddings (nomic-embed-text). Returns the top chunks most semantically relevant to the query, with file paths and similarity scores. Use for conceptual or natural-language questions where keyword matching alone (search_docs) would miss synonyms or paraphrases.",
			Parameters: map[string]interface{}{
				"type":     "object",
				"required": []string{"query"},
				"properties": map[string]interface{}{
					"query": map[string]interface{}{
						"type":        "string",
						"description": "Natural-language question or topic (e.g. 'how does FOTA delivery work', 'where do alarms get persisted')",
					},
					"k": map[string]interface{}{
						"type":        "integer",
						"description": "Number of chunks to return (default 5)",
					},
				},
			},
		},
	},
	{
		Type: "function",
		Function: ollamaToolFunction{
			Name:        "query_db",
			Description: "Run a read-only SQL query against the Brain database. Tables: repos (name, domain, team, language, status, description, lifecycle), documents (path, name, domain, owner, status), services (name, repo_name, type, hosting, port). Use for counting, filtering, or aggregating data.",
			Parameters: map[string]interface{}{
				"type":     "object",
				"required": []string{"sql"},
				"properties": map[string]interface{}{
					"sql": map[string]interface{}{
						"type":        "string",
						"description": "SELECT SQL query (e.g. 'SELECT domain, COUNT(*) as count FROM repos GROUP BY domain')",
					},
				},
			},
		},
	},
}

// --- Tool execution ---

func (s *ChatService) executeTool(name string, args json.RawMessage) string {
	switch name {
	case "search_docs":
		return s.toolSearchDocs(args)
	case "read_file":
		return s.toolReadFile(args)
	case "query_repos":
		return s.toolQueryRepos(args)
	case "query_db":
		return s.toolQueryDB(args)
	case "rag_search":
		return s.toolRAGSearch(args)
	default:
		return fmt.Sprintf("Unknown tool: %s", name)
	}
}

func (s *ChatService) toolSearchDocs(args json.RawMessage) string {
	var p struct {
		Query string `json:"query"`
	}
	json.Unmarshal(args, &p)
	if p.Query == "" {
		return "Error: query is required"
	}

	results, err := s.docs.Search(p.Query+"*", 10)
	if err != nil {
		return fmt.Sprintf("Search error: %v", err)
	}
	if len(results) == 0 {
		return "No results found for: " + p.Query
	}

	var out strings.Builder
	for _, r := range results {
		fmt.Fprintf(&out, "- %s: %s (domain: %s)\n", r.Path, r.Name, r.Domain)
		if r.Snippet != "" {
			fmt.Fprintf(&out, "  > %s\n", r.Snippet)
		}
	}
	return out.String()
}

func (s *ChatService) toolReadFile(args json.RawMessage) string {
	var p struct {
		Path string `json:"path"`
	}
	json.Unmarshal(args, &p)
	if p.Path == "" {
		return "Error: path is required"
	}

	fullPath := filepath.Join(s.root, p.Path)
	data, err := os.ReadFile(fullPath)
	if err != nil {
		return fmt.Sprintf("File not found: %s", p.Path)
	}

	content := string(data)
	_, body := domain.ParseFrontmatter(content)

	// Truncate very long files
	if len(body) > 6000 {
		body = body[:6000] + "\n...(truncated, use search_docs to find specific sections)"
	}
	return body
}

func (s *ChatService) toolQueryRepos(args json.RawMessage) string {
	var p struct {
		Domain string `json:"domain"`
	}
	json.Unmarshal(args, &p)

	var sql string
	if p.Domain == "" {
		sql = "SELECT name, domain, COALESCE(NULLIF(team,''),'unknown') as team, COALESCE(NULLIF(language,''),'unknown') as language, status FROM repos ORDER BY domain, name"
	} else {
		sql = fmt.Sprintf("SELECT name, COALESCE(NULLIF(team,''),'unknown') as team, COALESCE(NULLIF(language,''),'unknown') as language, status FROM repos WHERE domain = '%s' ORDER BY name", p.Domain)
	}

	cols, rows, err := s.query.Select(sql)
	if err != nil {
		return fmt.Sprintf("Query error: %v", err)
	}

	var out strings.Builder
	fmt.Fprintf(&out, "Found %d repos", len(rows))
	if p.Domain != "" {
		fmt.Fprintf(&out, " in domain '%s'", p.Domain)
	}
	fmt.Fprintf(&out, ":\n\n| %s |\n", strings.Join(cols, " | "))
	sep := make([]string, len(cols))
	for i := range sep {
		sep[i] = "---"
	}
	fmt.Fprintf(&out, "| %s |\n", strings.Join(sep, " | "))
	for _, row := range rows {
		fmt.Fprintf(&out, "| %s |\n", strings.Join(row, " | "))
	}
	return out.String()
}

func (s *ChatService) toolQueryDB(args json.RawMessage) string {
	var p struct {
		SQL string `json:"sql"`
	}
	json.Unmarshal(args, &p)
	if p.SQL == "" {
		return "Error: sql is required"
	}

	// Safety: only allow SELECT
	if !strings.HasPrefix(strings.ToUpper(strings.TrimSpace(p.SQL)), "SELECT") {
		return "Error: only SELECT queries allowed"
	}

	cols, rows, err := s.query.Select(p.SQL)
	if err != nil {
		return fmt.Sprintf("SQL error: %v", err)
	}

	var out strings.Builder
	fmt.Fprintf(&out, "| %s |\n", strings.Join(cols, " | "))
	sep := make([]string, len(cols))
	for i := range sep {
		sep[i] = "---"
	}
	fmt.Fprintf(&out, "| %s |\n", strings.Join(sep, " | "))
	for _, row := range rows {
		fmt.Fprintf(&out, "| %s |\n", strings.Join(row, " | "))
	}
	fmt.Fprintf(&out, "\n(%d rows)\n", len(rows))
	return out.String()
}

// --- Streaming with tool-calling loop ---

// ChunkType distinguishes content vs thinking tokens in SSE events.
type ChunkType string

const (
	ChunkContent  ChunkType = "content"
	ChunkThinking ChunkType = "thinking"
	ChunkDone     ChunkType = "done"
)

type StreamFunc func(chunkType ChunkType, text string) error

// Stream runs an agentic loop: sends messages to Ollama, if the model calls tools
// we execute them and feed results back. Loops until the model produces a text response.
// Text chunks are streamed to the client via onChunk.
func (s *ChatService) Stream(req ChatRequest, onChunk StreamFunc) error {
	// Build conversation with system prompt
	msgs := []ollamaMessage{
		{Role: "system", Content: s.systemPrompt},
	}

	// Add conversation history (last 20 messages)
	start := 0
	if len(req.Messages) > 20 {
		start = len(req.Messages) - 20
	}
	for _, m := range req.Messages[start:] {
		msgs = append(msgs, ollamaMessage{Role: m.Role, Content: m.Content})
	}

	// Pre-flight RAG: retrieve top semantic chunks for the user's last message
	// and prepend them as system context. Small models (qwen3:4b) struggle to
	// reliably emit tool calls; pre-feeding the data turns this into pure
	// summarisation, which they handle fine. The agentic tool loop below
	// still runs — the model can call additional tools if it wants.
	if s.rag != nil && s.rag.Available() && len(req.Messages) > 0 {
		lastUser := req.Messages[len(req.Messages)-1].Content
		if hits, err := s.rag.Query(lastUser, 5); err == nil && len(hits) > 0 {
			var ctx strings.Builder
			ctx.WriteString("Retrieved context (top semantic matches for the user's question — cite paths inline):\n\n")
			for i, h := range hits {
				fmt.Fprintf(&ctx, "[%d] %s (score=%.3f)\n%s\n\n", i+1, h.Path, h.Score, h.Text)
			}
			// Insert just before the final user message so the model sees it as
			// fresh context for the question, not as old history.
			ctxMsg := ollamaMessage{Role: "system", Content: ctx.String()}
			msgs = append(msgs[:len(msgs)-1], ctxMsg, msgs[len(msgs)-1])
		}
	}

	// Pre-flight structured SQL: a small LLM call decides whether the question
	// would benefit from a count/aggregate over the catalog DB. If so, the
	// query runs and the rows are injected as additional context. This turns
	// "how many databases" from a tool-call expectation (which qwen3:4b
	// fumbles) into pure summarisation over real data.
	if s.query != nil && len(req.Messages) > 0 {
		lastUser := req.Messages[len(req.Messages)-1].Content
		if sql := s.decidePreflightSQL(lastUser); sql != "" {
			if cols, rows, err := s.query.Select(sql); err == nil {
				var ctx strings.Builder
				fmt.Fprintf(&ctx, "Pre-run query result (`%s`):\n\n", sql)
				ctx.WriteString(formatTable(cols, rows))
				ctx.WriteString("\nUse these rows as ground truth for the user's count/list question. Cite the SQL inline.")
				ctxMsg := ollamaMessage{Role: "system", Content: ctx.String()}
				msgs = append(msgs[:len(msgs)-1], ctxMsg, msgs[len(msgs)-1])
			}
		}
	}

	// Agentic loop: max 5 tool-call rounds.
	// Every round streams thinking to the client so the UI stays responsive.
	for round := 0; round < 5; round++ {
		result, err := s.streamCollect(msgs, onChunk)
		if err != nil {
			return err
		}

		// If model called tools, execute them and continue
		if len(result.ToolCalls) > 0 {
			msgs = append(msgs, ollamaMessage{
				Role:      "assistant",
				Content:   result.Content,
				ToolCalls: result.ToolCalls,
			})

			for _, tc := range result.ToolCalls {
				toolResult := s.executeTool(tc.Function.Name, tc.Function.Arguments)
				msgs = append(msgs, ollamaMessage{
					Role:    "tool",
					Content: fmt.Sprintf("[%s result]\n%s", tc.Function.Name, toolResult),
				})
			}
			continue // next round
		}

		// No tool calls — content was already streamed, just signal done
		onChunk(ChunkDone, "")
		return nil
	}

	// Safety: if we exhaust rounds, do a final streaming response
	return s.streamOllama(msgs, onChunk)
}

// collectResult holds the accumulated response from a streaming call.
type collectResult struct {
	Content   string
	Thinking  string
	ToolCalls []ToolCall
}

// streamCollect streams thinking/content to the client via onChunk while
// accumulating the full response. Returns the collected result so the caller
// can check for tool calls.
func (s *ChatService) streamCollect(msgs []ollamaMessage, onChunk StreamFunc) (*collectResult, error) {
	body, _ := json.Marshal(ollamaRequest{
		Model:    s.model,
		Messages: msgs,
		Tools:    tools,
		Stream:   true,
	})

	resp, err := http.Post(s.ollamaURL+"/api/chat", "application/json", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("ollama connection failed: %w (is Ollama running?)", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		errBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("ollama error %d: %s", resp.StatusCode, string(errBody))
	}

	result := &collectResult{}
	// qwen3 sometimes emits <think>…</think> blocks inline in the `content`
	// channel rather than the separate `thinking` field, even with think:false.
	// Filter them out so users don't see internal reasoning prefixed to the
	// final answer.
	tf := newThinkFilter()
	emitContent := func(s string) {
		if s == "" {
			return
		}
		result.Content += s
		onChunk(ChunkContent, s)
	}
	emitThinking := func(s string) {
		if s == "" {
			return
		}
		result.Thinking += s
		onChunk(ChunkThinking, s)
	}

	decoder := json.NewDecoder(resp.Body)
	for decoder.More() {
		var chunk ollamaStreamChunk
		if err := decoder.Decode(&chunk); err != nil {
			if err == io.EOF {
				break
			}
			continue
		}

		if chunk.Message.Thinking != "" {
			emitThinking(chunk.Message.Thinking)
		}
		if chunk.Message.Content != "" {
			tf.push(chunk.Message.Content, emitContent, emitThinking)
		}

		if len(chunk.Message.ToolCalls) > 0 {
			result.ToolCalls = append(result.ToolCalls, chunk.Message.ToolCalls...)
		}

		if chunk.Done {
			break
		}
	}
	// Flush any trailing buffered text. If we were still inside a <think>,
	// drop it; otherwise emit as content.
	tf.flush(emitContent, emitThinking)

	return result, nil
}

// thinkFilter is a streaming-safe stripper for inline reasoning that qwen3
// (and other reasoners) leak into the `content` channel despite think:false.
//
// Behaviour:
//   - Starts in "uncertain" mode: text is buffered as potential thinking
//     until either (a) a `</think>` tag arrives, in which case everything
//     buffered is reasoning and dropped from content; or (b) the buffer
//     reaches `safetyFlush` bytes without ever seeing `</think>`, in which
//     case we assume the model never reasoned and flush the buffer as content.
//   - After leaving the initial uncertain mode (either path), any further
//     `<think>…</think>` pairs are treated as discrete thinking blocks.
//
// This handles the common qwen3 failure mode where it emits a closing
// `</think>` without a matching opening tag — observed even with think:false.
type thinkFilter struct {
	buf      strings.Builder
	state    thinkState
	pending  strings.Builder // uncertain text (treated as thinking until proven otherwise)
	safetyAt int             // flush pending as content once it exceeds this many bytes
}

type thinkState int

const (
	thinkUncertain thinkState = iota // start of stream — could be raw reasoning or a clean answer
	thinkInside                      // inside an explicit <think> block
	thinkOutside                     // committed to content mode
)

func newThinkFilter() *thinkFilter { return &thinkFilter{} }

func (f *thinkFilter) push(text string, emitContent, emitThinking func(string)) {
	f.buf.WriteString(text)
	s := f.buf.String()
	f.buf.Reset()
	for len(s) > 0 {
		switch f.state {
		case thinkUncertain:
			// In uncertain mode, stream text to the THINKING channel in
			// real time (so the UI shows a "thinking…" indicator) but also
			// keep a copy in `pending`. On `</think>` we drop pending (it
			// was indeed reasoning). On stream-end with no tag we flush
			// pending as CONTENT (the model never reasoned — what we
			// streamed was actually the answer, replay it).
			end := strings.Index(s, "</think>")
			start := strings.Index(s, "<think>")
			if end != -1 && (start == -1 || end < start) {
				emitThinking(s[:end])
				f.pending.Reset() // confirmed thinking, drop
				s = s[end+len("</think>"):]
				f.state = thinkOutside
				continue
			}
			if start != -1 {
				// Explicit <think> — anything before is content.
				before := s[:start]
				f.pending.WriteString(before)
				flushed := f.pending.String()
				f.pending.Reset()
				emitContent(flushed)
				s = s[start+len("<think>"):]
				f.state = thinkInside
				continue
			}
			// No tag yet. Keep partial-tag lookahead.
			tail := tailKeep(s, len("</think>")-1)
			head := s[:len(s)-len(tail)]
			f.pending.WriteString(head)
			emitThinking(head)
			f.buf.WriteString(tail)
			return
		case thinkInside:
			end := strings.Index(s, "</think>")
			if end == -1 {
				tail := tailKeep(s, len("</think>")-1)
				emitThinking(s[:len(s)-len(tail)])
				f.buf.WriteString(tail)
				return
			}
			emitThinking(s[:end])
			s = s[end+len("</think>"):]
			f.state = thinkOutside
		case thinkOutside:
			start := strings.Index(s, "<think>")
			if start == -1 {
				tail := tailKeep(s, len("<think>")-1)
				emitContent(s[:len(s)-len(tail)])
				f.buf.WriteString(tail)
				return
			}
			emitContent(s[:start])
			s = s[start+len("<think>"):]
			f.state = thinkInside
		}
	}
}

func (f *thinkFilter) flush(emitContent, emitThinking func(string)) {
	rest := f.buf.String()
	f.buf.Reset()
	switch f.state {
	case thinkUncertain:
		// Stream ended with no </think> tag ever seen. Everything we
		// streamed as thinking was actually the answer — replay it as
		// content so the client renders it normally.
		pending := f.pending.String() + rest
		f.pending.Reset()
		if pending != "" {
			emitContent(pending)
		}
	case thinkInside:
		if rest != "" {
			emitThinking(rest)
		}
	case thinkOutside:
		if rest != "" {
			emitContent(rest)
		}
	}
}

func tailKeep(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[len(s)-n:]
}

// streamOllama makes a streaming call and sends chunks via onChunk.
func (s *ChatService) streamOllama(msgs []ollamaMessage, onChunk StreamFunc) error {
	body, _ := json.Marshal(ollamaRequest{
		Model:    s.model,
		Messages: msgs,
		Tools:    tools,
		Stream:   true,
	})

	resp, err := http.Post(s.ollamaURL+"/api/chat", "application/json", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("ollama connection failed: %w (is Ollama running?)", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		errBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("ollama error %d: %s", resp.StatusCode, string(errBody))
	}

	decoder := json.NewDecoder(resp.Body)
	for decoder.More() {
		var chunk ollamaStreamChunk
		if err := decoder.Decode(&chunk); err != nil {
			if err == io.EOF {
				break
			}
			continue
		}
		if chunk.Message.Thinking != "" {
			if err := onChunk(ChunkThinking, chunk.Message.Thinking); err != nil {
				return err
			}
		}
		if chunk.Message.Content != "" {
			if err := onChunk(ChunkContent, chunk.Message.Content); err != nil {
				return err
			}
		}
		if chunk.Done {
			onChunk(ChunkDone, "")
			break
		}
	}

	return nil
}

// toolRAGSearch — semantic vector search via the RAG service. Returns
// top-k chunks with file paths + similarity scores formatted as a markdown
// table the LLM can cite.
func (s *ChatService) toolRAGSearch(args json.RawMessage) string {
	if s.rag == nil || !s.rag.Available() {
		return "rag_search unavailable: Ollama embedding model not running. Use search_docs as fallback."
	}
	var p struct {
		Query string `json:"query"`
		K     int    `json:"k"`
	}
	json.Unmarshal(args, &p)
	if p.Query == "" {
		return "Error: query is required"
	}
	if p.K <= 0 {
		p.K = 5
	}
	hits, err := s.rag.Query(p.Query, p.K)
	if err != nil {
		return fmt.Sprintf("rag_search error: %v", err)
	}
	if len(hits) == 0 {
		return "No semantic matches. The corpus may not be embedded yet (run `make index` after `ollama pull nomic-embed-text`)."
	}
	var out strings.Builder
	for i, h := range hits {
		fmt.Fprintf(&out, "### %d. %s (score=%.3f)\n%s\n\n", i+1, h.Path, h.Score, h.Text)
	}
	return out.String()
}

func JsonEscape(s string) string {
	b, _ := json.Marshal(s)
	return string(b)
}

// --- Pre-flight SQL decider (Option B from 2026-05-13 handover) ---

const preflightSQLPrompt = `You decide whether a SQL query against the Brain catalog DB would help answer a user's question. Default to NO. Only output SQL when the answer is clearly a count/list/group-by over the two populated tables below.

POPULATED TABLES (use these):

repos (171 rows) — one row per GitHub repository.
  Columns: name, domain, team, language, status, lifecycle, system, description, depends_on, provides_apis, consumes_apis, tags
  - domain ∈ {icc, ico, iot-backend, apps, embedded, identity, infrastructure, data, labs, legacy, recruiting, docs}
  - language is the PROGRAMMING language ('Go','TypeScript','C#','Python','C',…), NOT a category like 'database'
  - status ∈ {active, maintained, stale, dead, archived, unknown}
  - lifecycle ∈ {production, prototype, sunset, dead, unknown}

documents (1286 rows) — one row per indexed markdown file.
  Columns: path, name, description, domain, owner, status, system, tags, audience

EMPTY / DO NOT QUERY: services, protocols, tags. Catalog services/infra/external entries live as documents — search the corpus, do not COUNT(*) FROM services.

ONLY emit SQL if the question is unambiguously a count/list/group-by over repos or documents. If it asks about databases, services, infra, APIs, technology stacks, or anything not directly modelled in repos/documents columns → return {} (the RAG retrieval already handles those).

GOOD: "how many repos do we have", "how many repos per domain", "which repos use Go", "list active repos in iot-backend", "how many docs are stale".
BAD (return {}): "how many databases", "how many services", "what infra do we use", "how does X work", "where is Y handled", "what protocols", "list APIs".

Respond with strict JSON only. Either:
  {"sql": "SELECT …"}   — single SELECT, no semicolons, no DDL/DML
or:
  {}                    — no query applies (this is the common answer)

The user's question:`

type preflightDecision struct {
	SQL string `json:"sql"`
}

// decidePreflightSQL asks the LLM whether a SQL query would help. Returns the
// SQL string if yes, "" otherwise. Validates SELECT-only and no semicolons.
func (s *ChatService) decidePreflightSQL(userMsg string) string {
	if strings.TrimSpace(userMsg) == "" || len(userMsg) > 2000 {
		return ""
	}

	body, _ := json.Marshal(ollamaRequest{
		Model: s.model,
		Messages: []ollamaMessage{
			{Role: "system", Content: preflightSQLPrompt},
			{Role: "user", Content: userMsg},
		},
		Stream: false,
		Think:  false,
		Format: "json",
	})

	resp, err := http.Post(s.ollamaURL+"/api/chat", "application/json", bytes.NewReader(body))
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return ""
	}

	var out struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return ""
	}

	var decision preflightDecision
	if err := json.Unmarshal([]byte(out.Message.Content), &decision); err != nil {
		return ""
	}
	sql := strings.TrimSpace(decision.SQL)
	if sql == "" {
		return ""
	}
	// Strip trailing semicolon if present.
	sql = strings.TrimRight(sql, "; \t\n")
	// Reject if any inner semicolons (would allow statement chaining).
	if strings.Contains(sql, ";") {
		return ""
	}
	// Must be a single SELECT.
	upper := strings.ToUpper(sql)
	if !strings.HasPrefix(upper, "SELECT ") && !strings.HasPrefix(upper, "WITH ") {
		return ""
	}
	// Belt and braces — block obvious mutation keywords (Select() already
	// enforces SELECT-only but the user-visible SQL string is also injected
	// into the prompt, so keep it clean).
	for _, kw := range []string{" INSERT ", " UPDATE ", " DELETE ", " DROP ", " ALTER ", " CREATE ", " ATTACH ", " PRAGMA "} {
		if strings.Contains(" "+upper+" ", kw) {
			return ""
		}
	}
	return sql
}

// formatTable renders SQL result rows as a compact markdown table. Caps at 50
// rows to keep the prompt small; the LLM never needs more than that to answer
// a count/list question.
func formatTable(cols []string, rows [][]string) string {
	const maxRows = 50
	var out strings.Builder
	fmt.Fprintf(&out, "| %s |\n", strings.Join(cols, " | "))
	sep := make([]string, len(cols))
	for i := range sep {
		sep[i] = "---"
	}
	fmt.Fprintf(&out, "| %s |\n", strings.Join(sep, " | "))
	limit := len(rows)
	if limit > maxRows {
		limit = maxRows
	}
	for _, row := range rows[:limit] {
		fmt.Fprintf(&out, "| %s |\n", strings.Join(row, " | "))
	}
	if len(rows) > maxRows {
		fmt.Fprintf(&out, "\n(truncated to %d of %d rows)\n", maxRows, len(rows))
	} else {
		fmt.Fprintf(&out, "\n(%d rows)\n", len(rows))
	}
	return out.String()
}
