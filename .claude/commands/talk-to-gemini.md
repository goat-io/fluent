---
name: gemini-browser
description: |
  Interact with Google Gemini AI through browser automation. Use this skill when:
  - User asks to "talk to Gemini", "ask Gemini", or "consult Gemini"
  - User wants a second AI opinion or collaborative analysis
  - User wants to use Gemini for research, writing, or analysis tasks
  Requires: mcp__chrome-devtools__* tools and user logged into Google account.
---

# Gemini Browser Interaction

Send prompts to Google Gemini via browser and retrieve responses.

## Prerequisites

- Access to `mcp__chrome-devtools__*` MCP tools (Chrome DevTools)
- User must be logged into their Google account in Chrome

## Step-by-Step Process

### 1. Navigate to Gemini

```yaml
Tool: mcp__chrome-devtools__navigate_page
Parameters:
  url: "https://gemini.google.com"
  type: "url"
```

### 2. Take Snapshot to Verify Page

```yaml
Tool: mcp__chrome-devtools__take_snapshot
```

Confirm user is logged in and the text input area is visible.

### 3. Enter Prompt Text

Gemini uses a `contenteditable` div. Use JavaScript to set the text:

```yaml
Tool: mcp__chrome-devtools__evaluate_script
Parameters:
  function: |
    () => {
      const input = document.querySelector('div[contenteditable="true"]');
      if (!input) return 'input not found';
      input.focus();
      input.innerText = `YOUR_PROMPT_HERE`;
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
      const btn = document.querySelector('button[aria-label="Send message"]');
      if (btn) { btn.click(); return 'sent'; }
      return 'button not found';
    }
```

### 5. Wait for Response Completion

**Check if Gemini is still generating:**

```yaml
Tool: mcp__chrome-devtools__evaluate_script
Parameters:
  function: |
    () => {
      // Stop button exists = still generating
      const stopBtn = document.querySelector('button[aria-label="Stop response"]');
      if (stopBtn) return { status: 'generating' };

      // Microphone button exists = response complete
      const micBtn = document.querySelector('button[aria-label="Use microphone"]');
      if (micBtn) return { status: 'complete' };

      return { status: 'unknown' };
    }
```

**Poll until complete** (wait 10-20 seconds between checks, max 60 seconds for complex prompts).

### 6. Extract Response Text (NO SCREENSHOTS NEEDED)

**Get the latest Gemini response as plain text:**

```yaml
Tool: mcp__chrome-devtools__evaluate_script
Parameters:
  function: |
    () => {
      // Find all response containers (model turns)
      const responses = document.querySelectorAll('model-response');
      if (!responses.length) return { error: 'no responses found' };

      // Get the last (most recent) response
      const lastResponse = responses[responses.length - 1];

      // Extract text content, preserving structure
      const content = lastResponse.querySelector('.response-content, .markdown-main-panel');
      if (content) {
        return {
          text: content.innerText,
          html: content.innerHTML.substring(0, 500) + '...' // Preview of HTML structure
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
      document.querySelectorAll('user-query').forEach((q, i) => {
        turns.push({ role: 'user', index: i, text: q.innerText.trim() });
      });

      // Gemini responses
      document.querySelectorAll('model-response').forEach((r, i) => {
        const content = r.querySelector('.response-content, .markdown-main-panel');
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
      const responses = document.querySelectorAll('model-response');
      if (!responses.length) return { error: 'no responses found' };

      const lastResponse = responses[responses.length - 1];
      const result = { sections: [] };

      // Extract headings
      lastResponse.querySelectorAll('h1, h2, h3, h4').forEach(h => {
        result.sections.push({ type: 'heading', level: h.tagName, text: h.innerText });
      });

      // Extract code blocks
      lastResponse.querySelectorAll('pre code, code-block').forEach(code => {
        const lang = code.className?.match(/language-(\w+)/)?.[1] || 'unknown';
        result.sections.push({ type: 'code', language: lang, text: code.innerText });
      });

      // Full text
      result.fullText = lastResponse.innerText;

      return result;
    }
```

### 7. Continue Conversation

Repeat steps 3-6 for follow-up messages. Context is maintained automatically.
It is important that you and gemini get to an AGREEMENT without over complicating the solution.

## Complete Example Flow

```javascript
// 1. Set prompt
const input = document.querySelector('div[contenteditable="true"]');
input.focus();
input.innerText = 'Explain the visitor pattern in TypeScript';
input.dispatchEvent(new Event('input', { bubbles: true }));

// 2. Send
document.querySelector('button[aria-label="Send message"]').click();

// 3. Check completion (poll this)
const isComplete = () => !document.querySelector('button[aria-label="Stop response"]');

// 4. Extract response
const getResponse = () => {
  const responses = document.querySelectorAll('model-response');
  const last = responses[responses.length - 1];
  return last?.innerText || 'No response';
};
```

## Troubleshooting

| Issue              | Solution                                           |
| ------------------ | -------------------------------------------------- |
| "input not found"  | Page not loaded yet, take snapshot first           |
| "button not found" | Input may be empty, check if text was entered      |
| Empty response     | Still generating, check completion status          |
| Login page appears | User needs to log into Google account manually     |

## Key Notes

- **No screenshots needed for reading responses** - use JavaScript extraction
- Gemini input is `contenteditable`, NOT a standard input
- Send button: `button[aria-label="Send message"]`
- Stop button (during generation): `button[aria-label="Stop response"]`
- Microphone button (ready for input): `button[aria-label="Use microphone"]`
- Response containers: `model-response` elements
- User prompts: `user-query` elements
