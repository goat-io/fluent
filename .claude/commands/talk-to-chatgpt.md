---
name: chatgpt-browser
description: |
  Interact with OpenAI ChatGPT through browser automation. Use this skill when:
  - User asks to "talk to ChatGPT", "ask ChatGPT", or "consult ChatGPT"
  - User wants a second AI opinion or collaborative analysis
  - User wants to use ChatGPT for research, writing, or analysis tasks
  Requires: mcp__chrome-devtools__* tools and user logged into OpenAI account.
---

# ChatGPT Browser Interaction

Send prompts to OpenAI ChatGPT via browser and retrieve responses.

## Prerequisites

- Access to `mcp__chrome-devtools__*` MCP tools (Chrome DevTools)
- User must be logged into their OpenAI account in Chrome

## Step-by-Step Process

### 1. Navigate to ChatGPT

```yaml
Tool: mcp__chrome-devtools__navigate_page
Parameters:
  url: "https://chat.openai.com"
  type: "url"
```

### 2. Take Snapshot to Verify Page

```yaml
Tool: mcp__chrome-devtools__take_snapshot
```

Confirm user is logged in and the text input area is visible.

### 3. Enter Prompt Text

ChatGPT uses a ProseMirror contenteditable div (`#prompt-textarea`). Use JavaScript to set the text:

```yaml
Tool: mcp__chrome-devtools__evaluate_script
Parameters:
  function: |
    () => {
      // ChatGPT uses ProseMirror editor
      let input = document.querySelector('#prompt-textarea');

      // Fallback to any contenteditable div
      if (!input) {
        input = document.querySelector('div[contenteditable="true"]');
      }

      if (!input) return 'input not found';

      input.focus();

      // ProseMirror requires innerHTML with paragraph tags
      input.innerHTML = `<p>YOUR_PROMPT_HERE</p>`;
      input.dispatchEvent(new Event('input', { bubbles: true }));

      return 'success';
    }
```

### 4. Click Send Button

Use the snapshot to find the send button UID, then click it:

```yaml
Tool: mcp__chrome-devtools__click
Parameters:
  uid: [send button uid from snapshot]
```

Or via JavaScript:

```yaml
Tool: mcp__chrome-devtools__evaluate_script
Parameters:
  function: |
    () => {
      // Try data-testid selector
      let btn = document.querySelector('button[data-testid="send-button"]');

      // Fallback to aria-label
      if (!btn) {
        btn = document.querySelector('button[aria-label="Send prompt"]');
      }

      // Fallback to finding button near textarea
      if (!btn) {
        const form = document.querySelector('form');
        btn = form?.querySelector('button[type="submit"], button:last-of-type');
      }

      if (btn && !btn.disabled) {
        btn.click();
        return 'sent';
      }
      return 'button not found or disabled';
    }
```

### 5. Wait for Response Completion

**Check if ChatGPT is still generating:**

```yaml
Tool: mcp__chrome-devtools__evaluate_script
Parameters:
  function: |
    () => {
      // Stop button exists = still generating
      const stopBtn = document.querySelector('button[aria-label="Stop generating"]');
      if (stopBtn) return { status: 'generating' };

      // Alternative: check for streaming indicator
      const streaming = document.querySelector('[data-testid="stop-button"]');
      if (streaming) return { status: 'generating' };

      // Check if send button is back and enabled
      const sendBtn = document.querySelector('button[data-testid="send-button"]');
      if (sendBtn && !sendBtn.disabled) return { status: 'complete' };

      // Check for regenerate button
      const regenBtn = document.querySelector('button[aria-label*="Regenerate"]');
      if (regenBtn) return { status: 'complete' };

      return { status: 'unknown' };
    }
```

**Poll until complete** (wait 5-15 seconds between checks, max 120 seconds for complex prompts).

### 6. Extract Response Text (NO SCREENSHOTS NEEDED)

**Get the latest ChatGPT response as plain text:**

```yaml
Tool: mcp__chrome-devtools__evaluate_script
Parameters:
  function: |
    () => {
      // Find all assistant message containers
      const responses = document.querySelectorAll('[data-message-author-role="assistant"]');
      if (!responses.length) {
        // Fallback: try other selectors
        const altResponses = document.querySelectorAll('.agent-turn, .markdown.prose');
        if (altResponses.length) {
          const last = altResponses[altResponses.length - 1];
          return { text: last.innerText };
        }
        return { error: 'no responses found' };
      }

      // Get the last (most recent) response
      const lastResponse = responses[responses.length - 1];

      // Extract text content from markdown container
      const content = lastResponse.querySelector('.markdown.prose, .markdown');
      if (content) {
        return {
          text: content.innerText,
          html: content.innerHTML.substring(0, 500) + '...'
        };
      }

      // Fallback: get all text from the response
      return { text: lastResponse.innerText };
    }
```

**Alternative: Get ALL conversation turns:**

```yaml
Tool: mcp__chrome-devtools__evaluate_script
Parameters:
  function: |
    () => {
      const turns = [];

      // User prompts
      document.querySelectorAll('[data-message-author-role="user"]').forEach((q, i) => {
        turns.push({ role: 'user', index: i, text: q.innerText.trim() });
      });

      // ChatGPT responses
      document.querySelectorAll('[data-message-author-role="assistant"]').forEach((r, i) => {
        const content = r.querySelector('.markdown.prose, .markdown');
        turns.push({
          role: 'assistant',
          index: i,
          text: content ? content.innerText : r.innerText
        });
      });

      return turns;
    }
```

**Get response with code blocks preserved:**

```yaml
Tool: mcp__chrome-devtools__evaluate_script
Parameters:
  function: |
    () => {
      const responses = document.querySelectorAll('[data-message-author-role="assistant"]');
      if (!responses.length) return { error: 'no responses found' };

      const lastResponse = responses[responses.length - 1];
      const result = { sections: [] };

      // Extract headings
      lastResponse.querySelectorAll('h1, h2, h3, h4').forEach(h => {
        result.sections.push({ type: 'heading', level: h.tagName, text: h.innerText });
      });

      // Extract code blocks
      lastResponse.querySelectorAll('pre code').forEach(code => {
        const lang = code.className?.match(/language-(\w+)/)?.[1] || 'unknown';
        result.sections.push({ type: 'code', language: lang, text: code.innerText });
      });

      // Full text
      const content = lastResponse.querySelector('.markdown.prose, .markdown');
      result.fullText = content ? content.innerText : lastResponse.innerText;

      return result;
    }
```

### 7. Continue Conversation

Repeat steps 3-6 for follow-up messages. Context is maintained automatically.
It is important that you and ChatGPT get to an AGREEMENT without over complicating the solution.

## Complete Example Flow

```javascript
// 1. Set prompt (ChatGPT uses ProseMirror editor)
const input = document.querySelector('#prompt-textarea');
input.focus();
input.innerHTML = '<p>Explain the visitor pattern in TypeScript</p>';
input.dispatchEvent(new Event('input', { bubbles: true }));

// 2. Send
const sendBtn = document.querySelector('button[data-testid="send-button"]');
sendBtn.click();

// 3. Check completion (poll this)
const isComplete = () => !document.querySelector('button[aria-label="Stop generating"]') &&
                         !document.querySelector('[data-testid="stop-button"]');

// 4. Extract response
const getResponse = () => {
  const responses = document.querySelectorAll('[data-message-author-role="assistant"]');
  const last = responses[responses.length - 1];
  const content = last?.querySelector('.markdown.prose, .markdown');
  return content?.innerText || last?.innerText || 'No response';
};
```

## Troubleshooting

| Issue              | Solution                                           |
| ------------------ | -------------------------------------------------- |
| "input not found"  | Page not loaded yet, take snapshot first           |
| "button not found" | Input may be empty, check if text was entered      |
| Empty response     | Still generating, check completion status          |
| Login page appears | User needs to log into OpenAI account manually     |
| Rate limited       | Wait a few minutes before trying again             |

## Key Notes

- **No screenshots needed for reading responses** - use JavaScript extraction
- ChatGPT input is typically `#prompt-textarea` or a contenteditable div
- Send button: `button[data-testid="send-button"]` or `button[aria-label="Send prompt"]`
- Stop button (during generation): `button[aria-label="Stop generating"]`
- Response containers: `[data-message-author-role="assistant"]` elements
- User prompts: `[data-message-author-role="user"]` elements
- ChatGPT's DOM structure may change - if selectors fail, take a snapshot and inspect

## Differences from Gemini

| Aspect | Gemini | ChatGPT |
|--------|--------|---------|
| URL | gemini.google.com | chat.openai.com (redirects to chatgpt.com) |
| Input | contenteditable div | ProseMirror contenteditable (#prompt-textarea) |
| Send button | aria-label="Send message" | data-testid="send-button" |
| Stop button | aria-label="Stop response" | aria-label="Stop generating" |
| Responses | model-response elements | [data-message-author-role="assistant"] |
| User prompts | user-query elements | [data-message-author-role="user"] |
