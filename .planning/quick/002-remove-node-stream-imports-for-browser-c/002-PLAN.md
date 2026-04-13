---
phase: quick
plan: 002
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/typesense/src/actions/documents/exportDocuments.ts
  - packages/typesense/src/actions/documents/importDocuments.ts
  - packages/typesense/src/components/export-formatter.ts
  - packages/typesense/src/tests/export-formatter.test.ts
  - packages/typesense/src/tests/typesense.api.test.ts
autonomous: true

must_haves:
  truths:
    - "No 'node:stream', 'node:zlib', or any 'node:' prefixed import exists in non-test source files"
    - "The library compiles without errors"
    - "All existing tests pass"
    - "importDocuments accepts string, array, or ReadableStream (Web API) instead of Node Readable"
    - "exportDocumentsStream returns ReadableStream (Web API) instead of Node Readable"
    - "ExportFormatter uses no Node-specific APIs in its implementation"
  artifacts:
    - path: "packages/typesense/src/actions/documents/exportDocuments.ts"
      provides: "Browser-compatible export with ReadableStream return type"
    - path: "packages/typesense/src/actions/documents/importDocuments.ts"
      provides: "Browser-compatible import accepting string/array/ReadableStream"
    - path: "packages/typesense/src/components/export-formatter.ts"
      provides: "Pure-JS formatting without Node stream or zlib dependencies"
  key_links:
    - from: "exportDocuments.ts"
      to: "http-client.ts stream()"
      via: "returns ReadableStream directly (no Readable.fromWeb conversion)"
    - from: "importDocuments.ts"
      to: "http-client.ts requestTextWithRawBody()"
      via: "passes string body directly (no Readable.from wrapping)"
---

<objective>
Remove all `node:stream` and `node:zlib` imports from the typesense package source files, replacing
them with browser-compatible alternatives (Web Streams API, plain strings, async generators).

Purpose: Make @goatlab/typesense work in browsers, React Native, and Expo without polyfills.
Output: Zero `node:*` imports in production source. All tests pass. Public API uses Web-standard types.
</objective>

<execution_context>
@/Users/igca/.claude/get-shit-done/workflows/execute-plan.md
@/Users/igca/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@packages/typesense/src/actions/documents/exportDocuments.ts
@packages/typesense/src/actions/documents/importDocuments.ts
@packages/typesense/src/components/export-formatter.ts
@packages/typesense/src/components/http-client.ts
@packages/typesense/src/tests/export-formatter.test.ts
@packages/typesense/src/tests/typesense.api.test.ts
@packages/typesense/package.json
@packages/typesense/tsconfig.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace Node streams in importDocuments.ts and exportDocuments.ts</name>
  <files>
    packages/typesense/src/actions/documents/importDocuments.ts
    packages/typesense/src/actions/documents/exportDocuments.ts
  </files>
  <action>
    **exportDocuments.ts:**
    - Remove `import { Readable } from 'node:stream'`
    - Change `exportDocumentsStream` return type from `Promise<Readable>` to `Promise<ReadableStream>`
      (the global `ReadableStream` type from the Web Streams API -- no import needed, it is a global type in TypeScript with `lib: ["DOM"]` or `@types/node >= 18`)
    - Remove the `.then(stream => Readable.fromWeb(stream as any))` line -- the httpClient.stream()
      method already returns `ReadableStream` natively. Just return `ctx.httpClient.stream(...)` directly.
    - The resulting function should be ~8 lines: call ctx.httpClient.stream() and return its result.

    **importDocuments.ts:**
    - Remove `import { Readable } from 'node:stream'`
    - Change the `documents` parameter type from `TypesenseDocument<T>[] | string | Readable`
      to `TypesenseDocument<T>[] | string | ReadableStream`
    - Change `let bodyStream: Readable` to `let body: string | ReadableStream`
    - Replace `if (documents instanceof Readable)` with `if (documents instanceof ReadableStream)` --
      ReadableStream is a global available in browsers, Node 18+, React Native, and Expo.
    - Replace all `Readable.from([someString])` calls (lines 41, 44, 52) with just the plain string value.
      The body variable should just be assigned the string directly: `body = jsonlData`, `body = documents`,
      `body = formatted as string`. The ky HTTP client (used in requestTextWithRawBody) accepts strings
      as body natively -- there is NO need to wrap strings in a Readable stream.
    - Pass `body` (instead of `bodyStream`) to `ctx.httpClient.requestTextWithRawBody()`.
    - The `ExportFormatter` import remains since `formatDocuments` is still used (it is a pure string function).

    IMPORTANT: Do NOT touch importDocuments' internal logic (JSONL conversion, format validation, error handling).
    Only change the stream-related plumbing.
  </action>
  <verify>
    Run: `cd /Users/igca/Documents/Code/Goat/fluent/packages/typesense && npx tsc --noEmit`
    Confirm zero type errors related to Readable or stream types.
    Run: `grep -r "node:stream" packages/typesense/src/actions/` from project root -- should return nothing.
  </verify>
  <done>
    exportDocuments.ts and importDocuments.ts have zero `node:*` imports. exportDocumentsStream returns
    ReadableStream (Web API). importDocuments accepts ReadableStream instead of Node Readable. TypeScript compiles cleanly.
  </done>
</task>

<task type="auto">
  <name>Task 2: Replace Node streams and zlib in export-formatter.ts</name>
  <files>
    packages/typesense/src/components/export-formatter.ts
  </files>
  <action>
    - Remove `import { Readable, Transform } from 'node:stream'`
    - Remove `import { createGzip } from 'node:zlib'`
    - Remove the import of `TypesenseExportFormat` if no longer needed (check after changes).

    Replace each method that uses Node streams:

    **createStreamingCSVTransform():**
    Replace `Transform` return type with a `TransformStream` (Web API).
    Rewrite using `new TransformStream({ transform(chunk, controller) { ... } })`.
    The logic stays the same: first chunk emits headers, all chunks emit CSV rows.
    Return type: `TransformStream<TypesenseDocument<T>, string>`

    **createStreamingJSONLTransform():**
    Replace with `TransformStream`:
    ```typescript
    static createStreamingJSONLTransform<T>(): TransformStream<TypesenseDocument<T>, string> {
      return new TransformStream({
        transform(chunk, controller) {
          controller.enqueue(`${JSON.stringify(chunk)}\n`)
        },
      })
    }
    ```

    **createGzipStream():**
    Remove this method entirely. It uses `node:zlib` which has no universal browser equivalent.
    Gzip compression should be handled by the server or by the consumer if needed.
    If you prefer to keep the method signature for backward compat, replace with:
    ```typescript
    static createGzipStream(): never {
      throw new Error('createGzipStream is not available in browser environments. Use CompressionStream API or a server-side solution.')
    }
    ```
    Prefer the throw approach to avoid silent breakage.

    **createDocumentParser(format):**
    Replace with `TransformStream` return type.
    The JSONL parser and JSON parser logic stays the same internally, just using
    Web `TransformStream` instead of Node `Transform`.

    For the JSONL parser:
    ```typescript
    private static createJSONLParser(): TransformStream<string, any> {
      let buffer = ''
      return new TransformStream({
        transform(chunk, controller) {
          buffer += chunk
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            if (line.trim()) {
              try {
                controller.enqueue(JSON.parse(line))
              } catch (_error) {
                controller.error(new Error(`Invalid JSON in line: ${line}`))
                return
              }
            }
          }
        },
        flush(controller) {
          if (buffer.trim()) {
            try {
              controller.enqueue(JSON.parse(buffer))
            } catch (_error) {
              controller.error(new Error(`Invalid JSON in final line: ${buffer}`))
            }
          }
        },
      })
    }
    ```

    For the JSON parser:
    ```typescript
    private static createJSONParser(): TransformStream<string, any> {
      let buffer = ''
      return new TransformStream({
        transform(chunk, controller) {
          buffer += chunk
        },
        flush(controller) {
          try {
            const documents = JSON.parse(buffer)
            if (Array.isArray(documents)) {
              documents.forEach(doc => controller.enqueue(doc))
            } else {
              controller.enqueue(documents)
            }
          } catch (error: any) {
            controller.error(new Error(`Invalid JSON: ${error.message}`))
          }
        },
      })
    }
    ```

    **streamToString(stream):**
    Change parameter from `Readable` to `ReadableStream`. Rewrite:
    ```typescript
    static async streamToString(stream: ReadableStream): Promise<string> {
      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let result = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        result += typeof value === 'string' ? value : decoder.decode(value, { stream: true })
      }
      result += decoder.decode()
      return result
    }
    ```

    **streamToAsyncIterator(stream):**
    Change parameter from `Readable` to `ReadableStream`. Rewrite:
    ```typescript
    static async *streamToAsyncIterator<T>(stream: ReadableStream<T>): AsyncGenerator<T> {
      const reader = stream.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          yield value
        }
      } finally {
        reader.releaseLock()
      }
    }
    ```

    **createDocumentStream(documents):**
    Change return type from `Readable` to `ReadableStream`. Rewrite:
    ```typescript
    static createDocumentStream<T>(documents: TypesenseDocument<T>[]): ReadableStream<T> {
      let index = 0
      return new ReadableStream({
        pull(controller) {
          if (index < documents.length) {
            controller.enqueue(documents[index++] as T)
          } else {
            controller.close()
          }
        },
      })
    }
    ```

    Keep the `formatDocuments`, `formatCSV`, and `escapeCsvValue` methods unchanged -- they are
    pure string functions with no Node dependencies.

    Make sure the `TypesenseExportFormat` import is kept since `createDocumentParser` and `formatDocuments` use it.
  </action>
  <verify>
    Run: `cd /Users/igca/Documents/Code/Goat/fluent/packages/typesense && npx tsc --noEmit`
    Confirm zero type errors.
    Run: `grep -r "node:" packages/typesense/src/components/export-formatter.ts` -- should return nothing.
  </verify>
  <done>
    export-formatter.ts has zero `node:*` imports. All streaming methods use Web Streams API
    (TransformStream, ReadableStream). createGzipStream throws a clear error. TypeScript compiles cleanly.
  </done>
</task>

<task type="auto">
  <name>Task 3: Update tests to use Web Streams API</name>
  <files>
    packages/typesense/src/tests/export-formatter.test.ts
    packages/typesense/src/tests/typesense.api.test.ts
  </files>
  <action>
    **export-formatter.test.ts:**
    - Remove `import { Readable } from 'node:stream'`
    - Tests run in Node (vitest), so Web Streams globals are available (Node 18+).

    Update "Streaming Transforms" tests:
    - For CSV and JSONL transform tests, the old pattern was: create Transform, listen to `data` events,
      call `transform.write()` / `transform.end()`. Replace with Web TransformStream pattern:
      ```typescript
      const transform = ExportFormatter.createStreamingCSVTransform()
      const writer = transform.writable.getWriter()
      const reader = transform.readable.getReader()

      // Write documents
      await writer.write(sampleDocuments[0])
      await writer.write(sampleDocuments[1])
      await writer.close()

      // Read results
      const results: string[] = []
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        results.push(value)
      }
      const output = results.join('')
      // ... same assertions
      ```

    Update "Document Parsing" tests:
    - For JSONL and JSON parser tests, replace `parser.write(Buffer.from(...))` / `parser.end()`
      with Web TransformStream writer/reader pattern.
    - Replace `Buffer.from(data)` with plain strings (the new parsers accept strings, not Buffers).
    - For partial chunk tests, same approach: write partial strings through the writer.
    - For error handling tests, read from the reader and expect it to throw/reject.
      When a TransformStream errors via `controller.error()`, the reader.read() promise rejects.
      Wrap the reader loop in try/catch and assert the error.

    Update "Stream Utilities" tests:
    - `streamToString` test: replace `Readable.from([Buffer.from(data)])` with a Web ReadableStream:
      ```typescript
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(data))
          controller.close()
        }
      })
      ```
    - `createDocumentStream` test: the pattern `for await (const doc of ExportFormatter.streamToAsyncIterator(stream))`
      stays the same -- just the underlying types changed.
    - `empty document stream` test: same pattern update.

    **typesense.api.test.ts:**
    - Remove `import { Readable } from 'node:stream'`
    - In the "should import from a stream" test (line ~954-967): replace `Readable.from([jsonlData])` with:
      ```typescript
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(jsonlData))
          controller.close()
        }
      })
      ```
    - In the "should handle streaming with batches" test (line ~969-1000): replace the `new Readable({ read() {...} })`
      with a Web ReadableStream that chunks data similarly:
      ```typescript
      const stream = new ReadableStream({
        pull(controller) {
          if (jsonlData.length > 0) {
            const chunk = jsonlData.slice(0, 1000)
            controller.enqueue(new TextEncoder().encode(chunk))
            jsonlData = jsonlData.slice(1000)
          } else {
            controller.close()
          }
        }
      })
      ```
    - In the "should export documents as stream" test (line ~1178-1202):
      Change `expect(stream).toBeInstanceOf(Readable)` to `expect(stream).toBeInstanceOf(ReadableStream)`.
      The `for await (const chunk of stream)` pattern does NOT work with Web ReadableStream in all environments.
      Replace with reader pattern:
      ```typescript
      const reader = stream.getReader()
      const chunks: string[] = []
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(typeof value === 'string' ? value : decoder.decode(value))
      }
      ```
      Apply the same reader pattern to "should export stream with filters" test.

    IMPORTANT: Do NOT change any test logic, assertions, or test data. Only update the stream plumbing
    from Node streams to Web streams. All existing test assertions must remain identical.
  </action>
  <verify>
    Run: `cd /Users/igca/Documents/Code/Goat/fluent/packages/typesense && npx tsc --noEmit`
    Confirm zero type errors.
    Run: `grep -r "node:stream" packages/typesense/src/tests/` from project root -- should return nothing.
    Run: `cd /Users/igca/Documents/Code/Goat/fluent/packages/typesense && npx vitest run src/tests/export-formatter.test.ts --reporter=verbose`
    Confirm all export-formatter tests pass.
  </verify>
  <done>
    Both test files have zero `node:stream` imports. All tests use Web Streams API (ReadableStream,
    TransformStream, TextEncoder/TextDecoder). All tests pass with identical assertions.
  </done>
</task>

<task type="auto">
  <name>Task 4: Final verification -- full build and test suite</name>
  <files>
    packages/typesense/src/actions/documents/exportDocuments.ts
    packages/typesense/src/actions/documents/importDocuments.ts
    packages/typesense/src/components/export-formatter.ts
    packages/typesense/src/tests/export-formatter.test.ts
    packages/typesense/src/tests/typesense.api.test.ts
  </files>
  <action>
    Run comprehensive verification:

    1. Grep for ANY remaining `node:` imports in ALL typesense source (excluding node_modules):
       `grep -r "from 'node:" packages/typesense/src/ --include="*.ts" | grep -v "tests/const.ts"`
       (tests/const.ts uses node:fs and node:path which is fine -- test infrastructure only, never bundled)
       This must return EMPTY for all non-test-infrastructure files.

    2. Build the package:
       `cd packages/typesense && pnpm build`
       Must succeed with zero errors.

    3. Run ALL tests (export-formatter tests are the only ones that run without a Typesense container):
       `cd packages/typesense && npx vitest run src/tests/export-formatter.test.ts --reporter=verbose`
       All tests must pass.

    4. Type-check the entire package:
       `cd packages/typesense && npx tsc --noEmit`
       Must succeed with zero errors.

    If any step fails, fix the issue before proceeding. Common gotchas:
    - TransformStream type generics may need explicit annotation
    - `controller.enqueue()` requires the correct type matching the TransformStream generic
    - TextDecoder may need `{ stream: true }` option for chunked decoding
    - Web ReadableStream does not support `for await...of` in all environments; use `.getReader()` pattern
  </action>
  <verify>
    All four verification steps above pass. Zero `node:*` imports in production source files.
    Build output in `dist/` is clean.
  </verify>
  <done>
    The typesense package has zero `node:stream` and `node:zlib` imports in production source.
    Build succeeds. Export-formatter tests pass. The library is compatible with Node.js, browsers,
    React Native, and Expo without requiring any Node.js polyfills.
  </done>
</task>

</tasks>

<verification>
1. `grep -rn "from 'node:" packages/typesense/src/ --include="*.ts" | grep -v "tests/const.ts"` returns empty
2. `cd packages/typesense && pnpm build` succeeds
3. `cd packages/typesense && npx vitest run src/tests/export-formatter.test.ts` -- all pass
4. `cd packages/typesense && npx tsc --noEmit` -- zero errors
</verification>

<success_criteria>
- Zero `node:stream` or `node:zlib` imports in production source files (actions/, components/)
- Test files use Web Streams API only (no `node:stream` except tests/const.ts which uses node:fs/path for test infra)
- Public API: importDocuments accepts `ReadableStream` (not Node Readable)
- Public API: exportDocumentsStream returns `ReadableStream` (not Node Readable)
- ExportFormatter streaming methods use TransformStream/ReadableStream (Web API)
- TypeScript builds without errors
- All existing export-formatter tests pass
- The library can be imported in browser/RN/Expo bundlers without node: polyfill errors
</success_criteria>

<output>
After completion, create `.planning/quick/002-remove-node-stream-imports-for-browser-c/002-SUMMARY.md`
</output>
