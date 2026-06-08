import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { fetchConfig } from '../api.js'
import { BRAND } from '../_instance/lib/branding.js'

const BASE = 'http://localhost:7613/api'

export default function ChatPanel({ activeView, selectedNode }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState(null)
  // Company / assistant name for placeholder copy — from /api/config, falling
  // back to the BRAND stub so the generic frontend reads naturally.
  const [orgLabel, setOrgLabel] = useState(BRAND.name)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    fetchConfig().then((cfg) => {
      if (cancelled || !cfg) return
      const label = cfg.chat?.assistantName || cfg.org?.name
      if (label) setOrgLabel(label)
    })
    return () => { cancelled = true }
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return

    setError(null)
    // Inject page context so the LLM knows what the user is looking at
    let contextPrefix = ''
    if (activeView) contextPrefix += `[User is viewing: ${activeView} tab] `
    if (selectedNode) contextPrefix += `[Selected node: ${selectedNode}] `

    const userMsg = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]

    // Messages sent to API include page context on first user message
    const apiMessages = newMessages.map((m, i) => {
      if (i === newMessages.length - 1 && m.role === 'user' && contextPrefix) {
        return { ...m, content: contextPrefix + m.content }
      }
      return m
    })
    setMessages(newMessages)
    setInput('')
    setStreaming(true)

    // Add empty assistant message for streaming
    const assistantIdx = newMessages.length
    setMessages(prev => [...prev, { role: 'assistant', content: '', thinking: '' }])

    try {
      const resp = await fetch(`${BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      })

      if (!resp.ok) {
        const err = await resp.json()
        throw new Error(err.error || `HTTP ${resp.status}`)
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            if (typeof parsed === 'object' && parsed.thinking) {
              // Thinking chunk
              setMessages(prev => {
                const updated = [...prev]
                updated[assistantIdx] = {
                  ...updated[assistantIdx],
                  thinking: (updated[assistantIdx].thinking || '') + parsed.thinking,
                }
                return updated
              })
            } else {
              // Content chunk (plain string)
              setMessages(prev => {
                const updated = [...prev]
                updated[assistantIdx] = {
                  ...updated[assistantIdx],
                  content: updated[assistantIdx].content + parsed,
                }
                return updated
              })
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
    } catch (err) {
      setError(err.message)
      // Remove empty assistant message on error
      setMessages(prev => prev.filter((_, i) => i !== assistantIdx))
    } finally {
      setStreaming(false)
    }
  }, [input, messages, streaming])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--background)', fontFamily: 'var(--font-sans)',
    }}>
      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '24px 20px',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {messages.length === 0 && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12,
            color: 'var(--text-muted)',
          }}>
            <div style={{ fontSize: 32 }}>🧠</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Brain Chat</div>
            <div style={{ fontSize: 12, maxWidth: 320, textAlign: 'center', lineHeight: 1.6 }}>
              Ask anything about {orgLabel}'s systems, repos, architecture, teams, or processes.
            </div>
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center',
              marginTop: 8, maxWidth: 400,
            }}>
              {[
                'How many databases do we have?',
                'What protocol does Eliza use?',
                'Who maintains ICC?',
                'List security findings',
              ].map(q => (
                <button
                  key={q}
                  onClick={() => { setInput(q); setTimeout(() => inputRef.current?.focus(), 0) }}
                  style={{
                    padding: '6px 12px', borderRadius: 16, border: '1px solid var(--border)',
                    background: 'var(--surface)', color: 'var(--text-muted)', fontSize: 11,
                    cursor: 'pointer', fontFamily: 'var(--font-sans)',
                    transition: 'border-color 120ms ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex', gap: 12,
            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
          }}>
            {/* Avatar */}
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13,
              background: msg.role === 'user' ? 'var(--accent)' : 'var(--surface-raised)',
              color: msg.role === 'user' ? '#fff' : 'var(--text-muted)',
              border: msg.role === 'user' ? 'none' : '1px solid var(--border)',
            }}>
              {msg.role === 'user' ? 'U' : '🧠'}
            </div>

            {/* Message bubble */}
            <div style={{
              maxWidth: '75%', padding: '10px 14px', borderRadius: 12,
              fontSize: 13, lineHeight: 1.6,
              background: msg.role === 'user' ? 'var(--accent)' : 'var(--surface)',
              color: msg.role === 'user' ? '#fff' : 'var(--text)',
              border: msg.role === 'user' ? 'none' : '1px solid var(--border)',
            }}>
              {msg.role === 'assistant' ? (
                <div className="chat-markdown">
                  {msg.thinking && (
                    <details style={{
                      marginBottom: 8, fontSize: 11, color: 'var(--text-muted)',
                      border: '1px solid var(--border)', borderRadius: 6,
                      padding: '4px 8px', background: 'var(--surface-raised)',
                    }}>
                      <summary style={{ cursor: 'pointer', userSelect: 'none', fontStyle: 'italic' }}>
                        Thinking{streaming && i === messages.length - 1 && !msg.content ? '...' : ''}
                      </summary>
                      <div style={{ marginTop: 4, whiteSpace: 'pre-wrap', opacity: 0.8 }}>
                        {msg.thinking}
                      </div>
                    </details>
                  )}
                  {msg.content ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    streaming && i === messages.length - 1 && !msg.thinking ? '...' : null
                  )}
                </div>
              ) : (
                <span>{msg.content}</span>
              )}
            </div>
          </div>
        ))}

        {error && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, fontSize: 12,
            background: 'hsl(0 84% 50% / 0.1)', color: 'var(--status-danger)',
            border: '1px solid hsl(0 84% 50% / 0.2)',
          }}>
            {error.includes('Failed to fetch') || error.includes('NetworkError') || error.includes('connection')
              ? 'Cannot reach Brain API at :7613. Start it with `make serve` (or `make serve-chat` for the chat panel).'
              : error.includes('model') && error.includes('not found')
              ? 'Ollama model missing. Run: ollama pull qwen3:4b (chat) or ollama pull nomic-embed-text (RAG).'
              : error.includes('connection refused') || error.includes('11434')
              ? 'Cannot reach Ollama at :11434. Run: ollama serve'
              : error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{
        padding: '12px 16px', borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
      }}>
        <div style={{
          display: 'flex', gap: 8, alignItems: 'flex-end',
          background: 'var(--surface-raised)', borderRadius: 12,
          border: '1px solid var(--border)', padding: '8px 12px',
          alignItems: 'center',
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Brain..."
            rows={1}
            style={{
              flex: 1, border: 'none', outline: 'none', resize: 'none',
              background: 'transparent', color: 'var(--text)',
              fontSize: 13, fontFamily: 'var(--font-sans)', lineHeight: 1.5,
              maxHeight: 120, overflow: 'auto',
              padding: 0, margin: 0, display: 'block',
            }}
            onInput={e => {
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || streaming}
            style={{
              width: 32, height: 32, borderRadius: 8, border: 'none',
              background: input.trim() && !streaming ? 'var(--accent)' : 'var(--surface-overlay)',
              color: input.trim() && !streaming ? '#fff' : 'var(--text-muted)',
              cursor: input.trim() && !streaming ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'all 120ms ease',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4z"/>
            </svg>
          </button>
        </div>
        <div style={{
          fontSize: 10, color: 'var(--text-muted)', textAlign: 'center',
          marginTop: 6, opacity: 0.6,
        }}>
          Powered by Ollama · qwen3:4b · Agentic RAG
        </div>
      </div>
    </div>
  )
}
