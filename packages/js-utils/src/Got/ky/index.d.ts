type Primitive = null | undefined | string | number | boolean | symbol | bigint
type LiteralUnion<LiteralType extends BaseType, BaseType extends Primitive> =
  | LiteralType
  | (BaseType & {
      _?: never
    })

type KyResponse<T = unknown> = {
  json: <J = T>() => Promise<J>
} & Response

/**
Returns a `Response` object with `Body` methods added for convenience. So you can, for example, call `ky.get(input).json()` directly without having to await the `Response` first. When called like that, an appropriate `Accept` header will be set depending on the body method used. Unlike the `Body` methods of `window.Fetch`; these will throw an `HTTPError` if the response status is not in the range of `200...299`. Also, `.json()` will return an empty string if body is empty or the response status is `204` instead of throwing a parse error due to an empty body.
*/

type ResponsePromise<T = unknown> = {
  arrayBuffer: () => Promise<ArrayBuffer>
  blob: () => Promise<Blob>
  formData: () => Promise<FormData>
  /**
    Get the response body as raw bytes.

    Note: This shortcut is only available when the runtime supports `Response.prototype.bytes()`.
    */
  bytes: () => Promise<Uint8Array>
  /**
    Get the response body as JSON.

    @example
    ```
    import ky from 'ky';

    const json = await ky(…).json();
    ```

    @example
    ```
    import ky from 'ky';

    interface Result {
        value: number;
    }

    const result1 = await ky(…).json<Result>();
    // or
    const result2 = await ky<Result>(…).json();
    ```
    */
  json: <J = T>() => Promise<J>
  text: () => Promise<string>
} & Promise<KyResponse<T>>

type KyRequest<T = unknown> = {
  json: <J = T>() => Promise<J>
} & Request

declare class HTTPError<T = unknown> extends Error {
  response: KyResponse<T>
  request: KyRequest
  options: NormalizedOptions
  constructor(response: Response, request: Request, options: NormalizedOptions)
}

declare class TimeoutError extends Error {
  request: KyRequest
  constructor(request: Request)
}

/**
Internal error used to signal a forced retry from afterResponse hooks.
This is thrown when a user returns ky.retry() from an afterResponse hook.
*/
declare class ForceRetryError extends Error {
  name: 'ForceRetryError'
  customDelay: number | undefined
  code: string | undefined
  customRequest: Request | undefined
  constructor(options?: ForceRetryOptions)
}

/**
Type guard to check if an error is a Ky error.

@param error - The error to check
@returns `true` if the error is a Ky error, `false` otherwise

@example
```
import ky, {isKyError} from 'ky';
try {
    const response = await ky.get('/api/data');
} catch (error) {
    if (isKyError(error)) {
        // Handle Ky-specific errors
        console.log('Ky error occurred:', error.message);
    } else {
        // Handle other errors
        console.log('Unknown error:', error);
    }
}
```
*/
declare function isKyError(
  error: unknown,
): error is HTTPError | TimeoutError | ForceRetryError
/**
Type guard to check if an error is an HTTPError.

@param error - The error to check
@returns `true` if the error is an HTTPError, `false` otherwise

@example
```
import ky, {isHTTPError} from 'ky';
try {
    const response = await ky.get('/api/data');
} catch (error) {
    if (isHTTPError(error)) {
        console.log('HTTP error status:', error.response.status);
    }
}
```
*/
declare function isHTTPError<T = unknown>(error: unknown): error is HTTPError<T>
/**
Type guard to check if an error is a TimeoutError.

@param error - The error to check
@returns `true` if the error is a TimeoutError, `false` otherwise

@example
```
import ky, {isTimeoutError} from 'ky';
try {
    const response = await ky.get('/api/data', { timeout: 1000 });
} catch (error) {
    if (isTimeoutError(error)) {
        console.log('Request timed out:', error.request.url);
    }
}
```
*/
declare function isTimeoutError(error: unknown): error is TimeoutError
/**
Type guard to check if an error is a ForceRetryError.

@param error - The error to check
@returns `true` if the error is a ForceRetryError, `false` otherwise

@example
```
import ky, {isForceRetryError} from 'ky';

const api = ky.extend({
    hooks: {
        beforeRetry: [
            ({error, retryCount}) => {
                if (isForceRetryError(error)) {
                    console.log(`Forced retry #${retryCount}: ${error.code}`);
                }
            }
        ]
    }
});
```
*/
declare function isForceRetryError(error: unknown): error is ForceRetryError

type BeforeRequestState = {
  /**
    The number of retries attempted. `0` for the initial request, increments with each retry.

    This allows you to distinguish between initial requests and retries, which is useful when you need different behavior for retries (e.g., avoiding overwriting headers set in `beforeRetry`).
    */
  retryCount: number
}
type BeforeRequestHook = (
  request: KyRequest,
  options: NormalizedOptions,
  state: BeforeRequestState,
) => Request | Response | void | Promise<Request | Response | void>
type BeforeRetryState = {
  request: KyRequest
  options: NormalizedOptions
  error: Error
  /**
    The number of retries attempted. Always `>= 1` since this hook is only called during retries, not on the initial request.
    */
  retryCount: number
}
type BeforeRetryHook = (
  options: BeforeRetryState,
) =>
  | Request
  | Response
  | typeof stop
  | void
  | Promise<Request | Response | typeof stop | void>
type AfterResponseState = {
  /**
    The number of retries attempted. `0` for the initial request, increments with each retry.

    This allows you to distinguish between initial requests and retries, which is useful when you need different behavior for retries (e.g., showing a notification only on the final retry).
    */
  retryCount: number
}
type AfterResponseHook = (
  request: KyRequest,
  options: NormalizedOptions,
  response: KyResponse,
  state: AfterResponseState,
) => Response | RetryMarker | void | Promise<Response | RetryMarker | void>
type BeforeErrorState = {
  /**
    The number of retries attempted. `0` for the initial request, increments with each retry.

    This allows you to distinguish between the initial request and retries, which is useful when you need different error handling based on retry attempts (e.g., showing different error messages on the final attempt).
    */
  retryCount: number
}
type BeforeErrorHook = (
  error: HTTPError,
  state: BeforeErrorState,
) => HTTPError | Promise<HTTPError>
type Hooks = {
  /**
    This hook enables you to modify the request right before it is sent. Ky will make no further changes to the request after this. The hook function receives the normalized request, options, and a state object. You could, for example, modify `request.headers` here.

    The `state.retryCount` is `0` for the initial request and increments with each retry. This allows you to distinguish between initial requests and retries, which is useful when you need different behavior for retries (e.g., avoiding overwriting headers set in `beforeRetry`).

    A [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) can be returned from this hook to completely avoid making an HTTP request. This can be used to mock a request, check an internal cache, etc. An **important** consideration when returning a `Response` from this hook is that all the following hooks will be skipped, so **ensure you only return a `Response` from the last hook**.

    @example
    ```
    import ky from 'ky';

    const response = await ky('https://example.com', {
        hooks: {
            beforeRequest: [
                (request, options, {retryCount}) => {
                    // Only set default auth header on initial request, not on retries
                    // (retries may have refreshed token set by beforeRetry)
                    if (retryCount === 0) {
                        request.headers.set('Authorization', 'token initial-token');
                    }
                }
            ]
        }
    });
    ```

    @default []
    */
  beforeRequest?: BeforeRequestHook[]
  /**
    This hook enables you to modify the request right before retry. Ky will make no further changes to the request after this. The hook function receives an object with the normalized request and options, an error instance, and the retry count. You could, for example, modify `request.headers` here.

    The hook can return a [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) to replace the outgoing retry request, or return a [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) to skip the retry and use that response instead. **Note:** Returning a request or response skips remaining `beforeRetry` hooks.

    If the request received a response, the error will be of type `HTTPError` and the `Response` object will be available at `error.response`. Be aware that some types of errors, such as network errors, inherently mean that a response was not received. In that case, the error will not be an instance of `HTTPError`.

    You can prevent Ky from retrying the request by throwing an error. Ky will not handle it in any way and the error will be propagated to the request initiator. The rest of the `beforeRetry` hooks will not be called in this case. Alternatively, you can return the [`ky.stop`](#ky.stop) symbol to do the same thing but without propagating an error (this has some limitations, see `ky.stop` docs for details).

    **Modifying headers:**

    @example
    ```
    import ky from 'ky';

    const response = await ky('https://example.com', {
        hooks: {
            beforeRetry: [
                async ({request, options, error, retryCount}) => {
                    const token = await ky('https://example.com/refresh-token');
                    request.headers.set('Authorization', `token ${token}`);
                }
            ]
        }
    });
    ```

    **Modifying the request URL:**

    @example
    ```
    import ky from 'ky';

    const response = await ky('https://example.com/api', {
        hooks: {
            beforeRetry: [
                async ({request, error}) => {
                    // Add query parameters based on error response
                    if (error.response) {
                        const body = await error.response.json();
                        const url = new URL(request.url);
                        url.searchParams.set('processId', body.processId);
                        return new Request(url, request);
                    }
                }
            ]
        }
    });
    ```

    **Returning a cached response:**

    @example
    ```
    import ky from 'ky';

    const response = await ky('https://example.com/api', {
        hooks: {
            beforeRetry: [
                ({error, retryCount}) => {
                    // Use cached response instead of retrying
                    if (retryCount > 1 && cachedResponse) {
                        return cachedResponse;
                    }
                }
            ]
        }
    });
    ```

    @default []
    */
  beforeRetry?: BeforeRetryHook[]
  /**
    This hook enables you to read and optionally modify the response. The hook function receives normalized request, options, a clone of the response, and a state object. The return value of the hook function will be used by Ky as the response object if it's an instance of [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response).

    You can also force a retry by returning `ky.retry()` or `ky.retry(options)`. This is useful when you need to retry based on the response body content, even if the response has a successful status code. The retry will respect the retry limit and be observable in `beforeRetry` hooks.

    @default []

    @example
    ```
    import ky from 'ky';

    const response = await ky('https://example.com', {
        hooks: {
            afterResponse: [
                (_request, _options, response) => {
                    // You could do something with the response, for example, logging.
                    log(response);

                    // Or return a `Response` instance to overwrite the response.
                    return new Response('A different response', {status: 200});
                },

                // Or retry with a fresh token on a 401 error
                async (request, _options, response, state) => {
                    if (response.status === 401 && state.retryCount === 0) {
                        // Only refresh on first 401, not on subsequent retries
                        const {token} = await ky.post('https://example.com/auth/refresh').json();

                        const headers = new Headers(request.headers);
                        headers.set('Authorization', `Bearer ${token}`);

                        return ky.retry({
                            request: new Request(request, {headers}),
                            code: 'TOKEN_REFRESHED'
                        });
                    }
                },

                // Or force retry based on response body content
                async (request, options, response) => {
                    if (response.status === 200) {
                        const data = await response.clone().json();
                        if (data.error?.code === 'RATE_LIMIT') {
                            // Force retry with custom delay from API response
                            return ky.retry({
                                delay: data.error.retryAfter * 1000,
                                code: 'RATE_LIMIT'
                            });
                        }
                    }
                },

                // Or show a notification only on the last retry for 5xx errors
                (request, options, response, {retryCount}) => {
                    if (response.status >= 500 && response.status <= 599) {
                        if (retryCount === options.retry.limit) {
                            showNotification('Request failed after all retries');
                        }
                    }
                }
            ]
        }
    });
    ```
    */
  afterResponse?: AfterResponseHook[]
  /**
    This hook enables you to modify the `HTTPError` right before it is thrown. The hook function receives an `HTTPError` and a state object as arguments and should return an instance of `HTTPError`.

    @default []

    @example
    ```
    import ky from 'ky';

    await ky('https://example.com', {
        hooks: {
            beforeError: [
                async error => {
                    const {response} = error;
                    if (response) {
                        const body = await response.json();
                        error.name = 'GitHubError';
                        error.message = `${body.message} (${response.status})`;
                    }

                    return error;
                },

                // Or show different message based on retry count
                (error, {retryCount}) => {
                    if (retryCount === error.options.retry.limit) {
                        error.message = `${error.message} (failed after ${retryCount} retries)`;
                    }

                    return error;
                }
            ]
        }
    });
    ```
    */
  beforeError?: BeforeErrorHook[]
}

type ShouldRetryState = {
  /**
    The error that caused the request to fail.
    */
  error: Error
  /**
    The number of retries attempted. Starts at 1 for the first retry.
    */
  retryCount: number
}
type RetryOptions = {
  /**
    The number of times to retry failed requests.

    @default 2
    */
  limit?: number
  /**
    The HTTP methods allowed to retry.

    @default ['get', 'put', 'head', 'delete', 'options', 'trace']
    */
  methods?: HttpMethod[]
  /**
    The HTTP status codes allowed to retry.

    @default [408, 413, 429, 500, 502, 503, 504]
    */
  statusCodes?: number[]
  /**
    The HTTP status codes allowed to retry with a `Retry-After` header.

    @default [413, 429, 503]
    */
  afterStatusCodes?: number[]
  /**
    If the `Retry-After` header is greater than `maxRetryAfter`, the request will be canceled.

    @default Infinity
    */
  maxRetryAfter?: number
  /**
    The upper limit of the delay per retry in milliseconds.
    To clamp the delay, set `backoffLimit` to 1000, for example.

    By default, the delay is calculated in the following way:

    ```
    0.3 * (2 ** (attemptCount - 1)) * 1000
    ```

    The delay increases exponentially.

    @default Infinity
    */
  backoffLimit?: number
  /**
    A function to calculate the delay between retries given `attemptCount` (starts from 1).

    @default attemptCount => 0.3 * (2 ** (attemptCount - 1)) * 1000
    */
  delay?: (attemptCount: number) => number
  /**
    Add random jitter to retry delays to prevent thundering herd problems.

    When many clients retry simultaneously (e.g., after hitting a rate limit), they can overwhelm the server again. Jitter adds randomness to break this synchronization.

    Set to `true` to use full jitter, which randomizes the delay between 0 and the computed delay.

    Alternatively, pass a function to implement custom jitter strategies.

    @default undefined (no jitter)

    @example
    ```
    import ky from 'ky';

    const json = await ky('https://example.com', {
        retry: {
            limit: 5,

            // Full jitter (randomizes delay between 0 and computed value)
            jitter: true

            // Percentage jitter (80-120% of delay)
            // jitter: delay => delay * (0.8 + Math.random() * 0.4)

            // Absolute jitter (±100ms)
            // jitter: delay => delay + (Math.random() * 200 - 100)
        }
    }).json();
    ```
    */
  jitter?: boolean | ((delay: number) => number) | undefined
  /**
    Whether to retry when the request times out.

    @default false

    @example
    ```
    import ky from 'ky';

    const json = await ky('https://example.com', {
        retry: {
            limit: 3,
            retryOnTimeout: true
        }
    }).json();
    ```
    */
  retryOnTimeout?: boolean
  /**
    A function to determine whether a retry should be attempted.

    This function takes precedence over all other retry checks and is called first, before any other retry validation.

    **Note:** This is different from the `beforeRetry` hook:
    - `shouldRetry`: Controls WHETHER to retry (called before the retry decision is made)
    - `beforeRetry`: Called AFTER retry is confirmed, allowing you to modify the request

    Should return:
    - `true` to force a retry (bypasses `retryOnTimeout`, status code checks, and other validations)
    - `false` to prevent a retry (no retry will occur)
    - `undefined` to use the default retry logic (`retryOnTimeout`, status codes, etc.)

    @example
    ```
    import ky, {HTTPError} from 'ky';

    const json = await ky('https://example.com', {
        retry: {
            limit: 3,
            shouldRetry: ({error, retryCount}) => {
                // Retry on specific business logic errors from API
                if (error instanceof HTTPError) {
                    const status = error.response.status;

                    // Retry on 429 (rate limit) but only for first 2 attempts
                    if (status === 429 && retryCount <= 2) {
                        return true;
                    }

                    // Don't retry on 4xx errors except rate limits
                    if (status >= 400 && status < 500) {
                        return false;
                    }
                }

                // Use default retry logic for other errors
                return undefined;
            }
        }
    }).json();
    ```
    */
  shouldRetry?: (
    state: ShouldRetryState,
  ) => boolean | undefined | Promise<boolean | undefined>
}

type SearchParamsInit =
  | string
  | string[][]
  | Record<string, string>
  | URLSearchParams
  | undefined
type SearchParamsOption =
  | SearchParamsInit
  | Record<string, string | number | boolean | undefined>
  | Array<Array<string | number | boolean>>
type RequestHttpMethod = 'get' | 'post' | 'put' | 'patch' | 'head' | 'delete'
type HttpMethod = LiteralUnion<RequestHttpMethod | 'options' | 'trace', string>
type Input = string | URL | Request
type Progress = {
  percent: number
  transferredBytes: number
  /**
    Note: If it's not possible to retrieve the body size, it will be `0`.
    */
  totalBytes: number
}
type KyHeadersInit =
  | NonNullable<RequestInit['headers']>
  | Record<string, string | undefined>
/**
Custom Ky options
*/
type KyOptions = {
  /**
    Shortcut for sending JSON. Use this instead of the `body` option.

    Accepts any plain object or value, which will be `JSON.stringify()`'d and sent in the body with the correct header set.
    */
  json?: unknown
  /**
    User-defined JSON-parsing function.

    Use-cases:
    1. Parse JSON via the [`bourne` package](https://github.com/hapijs/bourne) to protect from prototype pollution.
    2. Parse JSON with [`reviver` option of `JSON.parse()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse).

    @default JSON.parse()

    @example
    ```
    import ky from 'ky';
    import bourne from '@hapijs/bourne';

    const json = await ky('https://example.com', {
        parseJson: text => bourne(text)
    }).json();
    ```
    */
  parseJson?: (text: string) => unknown
  /**
    User-defined JSON-stringifying function.

    Use-cases:
    1. Stringify JSON with a custom `replacer` function.

    @default JSON.stringify()

    @example
    ```
    import ky from 'ky';
    import {DateTime} from 'luxon';

    const json = await ky('https://example.com', {
        stringifyJson: data => JSON.stringify(data, (key, value) => {
            if (key.endsWith('_at')) {
                return DateTime.fromISO(value).toSeconds();
            }

            return value;
        })
    }).json();
    ```
    */
  stringifyJson?: (data: unknown) => string
  /**
    Search parameters to include in the request URL. Setting this will override all existing search parameters in the input URL.

    Accepts any value supported by [`URLSearchParams()`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams/URLSearchParams).

    When passing an object, `undefined` values are automatically filtered out, while `null` values are preserved and converted to the string `'null'`.
    */
  searchParams?: SearchParamsOption
  /**
    A prefix to prepend to the `input` URL when making the request. It can be any valid URL, either relative or absolute. A trailing slash `/` is optional and will be added automatically, if needed, when it is joined with `input`. Only takes effect when `input` is a string. The `input` argument cannot start with a slash `/` when using this option.

    Useful when used with [`ky.extend()`](#kyextenddefaultoptions) to create niche-specific Ky-instances.

    Notes:
     - After `prefixUrl` and `input` are joined, the result is resolved against the [base URL](https://developer.mozilla.org/en-US/docs/Web/API/Node/baseURI) of the page (if any).
     - Leading slashes in `input` are disallowed when using this option to enforce consistency and avoid confusion about how the `input` URL is handled, given that `input` will not follow the normal URL resolution rules when `prefixUrl` is being used, which changes the meaning of a leading slash.

    @example
    ```
    import ky from 'ky';

    // On https://example.com

    const response = await ky('unicorn', {prefixUrl: '/api'});
    //=> 'https://example.com/api/unicorn'

    const response = await ky('unicorn', {prefixUrl: 'https://cats.com'});
    //=> 'https://cats.com/unicorn'
    ```
    */
  prefixUrl?: URL | string
  /**
    An object representing `limit`, `methods`, `statusCodes`, `afterStatusCodes`, and `maxRetryAfter` fields for maximum retry count, allowed methods, allowed status codes, status codes allowed to use the [`Retry-After`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After) time, and maximum [`Retry-After`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After) time.

    If `retry` is a number, it will be used as `limit` and other defaults will remain in place.

    If the response provides an HTTP status contained in `afterStatusCodes`, Ky will wait until the date or timeout given in the [`Retry-After`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After) header has passed to retry the request. If `Retry-After` is missing, the non-standard [`RateLimit-Reset`](https://www.ietf.org/archive/id/draft-polli-ratelimit-headers-02.html#section-3.3) header is used in its place as a fallback. If the provided status code is not in the list, the [`Retry-After`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After) header will be ignored.

    If `maxRetryAfter` is set to `undefined`, it will use `options.timeout`. If [`Retry-After`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After) header is greater than `maxRetryAfter`, it will cancel the request.

    By default, delays between retries are calculated with the function `0.3 * (2 ** (attemptCount - 1)) * 1000`, where `attemptCount` is the attempt number (starts from 1), however this can be changed by passing a `delay` function.

    Retries are not triggered following a timeout.

    @example
    ```
    import ky from 'ky';

    const json = await ky('https://example.com', {
        retry: {
            limit: 10,
            methods: ['get'],
            statusCodes: [413]
        }
    }).json();
    ```
    */
  retry?: RetryOptions | number
  /**
    Timeout in milliseconds for getting a response, including any retries. Can not be greater than 2147483647.
    If set to `false`, there will be no timeout.

    @default 10000
    */
  timeout?: number | false
  /**
    Hooks allow modifications during the request lifecycle. Hook functions may be async and are run serially.
    */
  hooks?: Hooks
  /**
    Throw an `HTTPError` when, after following redirects, the response has a non-2xx status code. To also throw for redirects instead of following them, set the [`redirect`](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch#Parameters) option to `'manual'`.

    Setting this to `false` may be useful if you are checking for resource availability and are expecting error responses.

    You can also pass a function that accepts the HTTP status code and returns a boolean for selective error handling. Note that this can violate the principle of least surprise, so it's recommended to use the boolean form unless you have a specific use case like treating 404 responses differently.

    Note: If `false`, error responses are considered successful and the request will not be retried.

    @default true
    */
  throwHttpErrors?: boolean | ((status: number) => boolean)
  /**
    Download progress event handler.

    @param progress - Object containing download progress information.
    @param chunk - Data that was received. Note: It's empty for the first call.

    @example
    ```
    import ky from 'ky';

    const response = await ky('https://example.com', {
        onDownloadProgress: (progress, chunk) => {
            // Example output:
            // `0% - 0 of 1271 bytes`
            // `100% - 1271 of 1271 bytes`
            console.log(`${progress.percent * 100}% - ${progress.transferredBytes} of ${progress.totalBytes} bytes`);
        }
    });
    ```
    */
  onDownloadProgress?: (progress: Progress, chunk: Uint8Array) => void
  /**
    Upload progress event handler.

    @param progress - Object containing upload progress information.
    @param chunk - Data that was sent. Note: It's empty for the last call.

    @example
    ```
    import ky from 'ky';

    const response = await ky.post('https://example.com/upload', {
        body: largeFile,
        onUploadProgress: (progress, chunk) => {
            // Example output:
            // `0% - 0 of 1271 bytes`
            // `100% - 1271 of 1271 bytes`
            console.log(`${progress.percent * 100}% - ${progress.transferredBytes} of ${progress.totalBytes} bytes`);
        }
    });
    ```
    */
  onUploadProgress?: (progress: Progress, chunk: Uint8Array) => void
  /**
    User-defined `fetch` function.
    Has to be fully compatible with the [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) standard.

    Use-cases:
    1. Use custom `fetch` implementations like [`isomorphic-unfetch`](https://www.npmjs.com/package/isomorphic-unfetch).
    2. Use the `fetch` wrapper function provided by some frameworks that use server-side rendering (SSR).

    @default fetch

    @example
    ```
    import ky from 'ky';
    import fetch from 'isomorphic-unfetch';

    const json = await ky('https://example.com', {fetch}).json();
    ```
    */
  fetch?: (input: Input, init?: RequestInit) => Promise<Response>
  /**
    User-defined data passed to hooks.

    This option allows you to pass arbitrary contextual data to hooks without polluting the request itself. The context is available in all hooks and is **guaranteed to always be an object** (never `undefined`), so you can safely access properties without optional chaining.

    Use cases:
    - Pass authentication tokens or API keys to hooks
    - Attach request metadata for logging or debugging
    - Implement conditional logic in hooks based on the request context
    - Pass serverless environment bindings (e.g., Cloudflare Workers)

    **Note:** Context is shallow merged. Top-level properties are merged, but nested objects are replaced. Only enumerable properties are copied.

    @example
    ```
    import ky from 'ky';

    // Pass data to hooks
    const api = ky.create({
        hooks: {
            beforeRequest: [
                (request, options) => {
                    const {token} = options.context;
                    if (token) {
                        request.headers.set('Authorization', `Bearer ${token}`);
                    }
                }
            ]
        }
    });

    await api('https://example.com', {
        context: {
            token: 'secret123'
        }
    }).json();

    // Shallow merge: only top-level properties are merged
    const instance = ky.create({
        context: {
            a: 1,
            b: {
                nested: true
            }
        }
    });

    const extended = instance.extend({
        context: {
            b: {
                updated: true
            },
            c: 3
        }
    });
    // Result: {a: 1, b: {updated: true}, c: 3}
    // Note: The original `b.nested` is gone (shallow merge)
    ```
    */
  context?: Record<string, unknown>
}
/**
Options are the same as `window.fetch`, except for the KyOptions
*/
interface Options extends KyOptions, Omit<RequestInit, 'headers'> {
  /**
    HTTP method used to make the request.

    Internally, the standard methods (`GET`, `POST`, `PUT`, `PATCH`, `HEAD` and `DELETE`) are uppercased in order to avoid server errors due to case sensitivity.
    */
  method?: LiteralUnion<HttpMethod, string>
  /**
    HTTP headers used to make the request.

    You can pass a `Headers` instance or a plain object.

    You can remove a header with `.extend()` by passing the header with an `undefined` value.

    @example
    ```
    import ky from 'ky';

    const url = 'https://sindresorhus.com';

    const original = ky.create({
        headers: {
            rainbow: 'rainbow',
            unicorn: 'unicorn'
        }
    });

    const extended = original.extend({
        headers: {
            rainbow: undefined
        }
    });

    const response = await extended(url).json();

    console.log('rainbow' in response);
    //=> false

    console.log('unicorn' in response);
    //=> true
    ```
    */
  headers?: KyHeadersInit
}
/**
Normalized options passed to the `fetch` call and the `beforeRequest` hooks.
*/
interface NormalizedOptions extends RequestInit {
  method: NonNullable<RequestInit['method']>
  credentials?: NonNullable<RequestInit['credentials']>
  retry: RetryOptions
  prefixUrl: string
  onDownloadProgress: Options['onDownloadProgress']
  onUploadProgress: Options['onUploadProgress']
  context: Record<string, unknown>
}

declare const stop: unique symbol
/**
Options for forcing a retry via `ky.retry()`.
*/
type ForceRetryOptions = {
  /**
    Custom delay in milliseconds before retrying.

    If not provided, uses the default retry delay calculation based on `retry.delay` configuration.

    **Note:** Custom delays bypass jitter and `backoffLimit`. This is intentional, as custom delays often come from server responses (e.g., `Retry-After` headers) and should be respected exactly as specified.
    */
  delay?: number
  /**
    Error code for the retry.

    This machine-readable identifier will be included in the error message passed to `beforeRetry` hooks, allowing you to distinguish between different types of forced retries.

    @example
    ```
    return ky.retry({code: 'RATE_LIMIT'});
    // Resulting error message: 'Forced retry: RATE_LIMIT'
    ```
    */
  code?: string
  /**
    Original error that caused the retry.

    This allows you to preserve the error chain when forcing a retry based on caught exceptions. The error will be set as the `cause` of the `ForceRetryError`, enabling proper error chain traversal.

    @example
    ```
    try {
        const data = await response.clone().json();
        validateBusinessLogic(data);
    } catch (error) {
        return ky.retry({
            code: 'VALIDATION_FAILED',
            cause: error  // Preserves original error in chain
        });
    }
    ```
    */
  cause?: Error
  /**
    Custom request to use for the retry.

    This allows you to modify or completely replace the request during a forced retry. The custom request becomes the starting point for the retry - `beforeRetry` hooks can still further modify it if needed.

    **Note:** The custom request's `signal` will be replaced with Ky's managed signal to handle timeouts and user-provided abort signals correctly. If the original request body has been consumed, you must provide a new body or clone the request before consuming.

    @example
    ```
    // Fallback to a different endpoint
    return ky.retry({
        request: new Request('https://backup-api.com/endpoint', {
            method: request.method,
            headers: request.headers,
        }),
        code: 'BACKUP_ENDPOINT'
    });

    // Retry with refreshed authentication token
    const data = await response.clone().json();
    return ky.retry({
        request: new Request(request, {
            headers: {
                ...Object.fromEntries(request.headers),
                'Authorization': `Bearer ${data.newToken}`
            }
        }),
        code: 'TOKEN_REFRESHED'
    });
    ```
    */
  request?: Request
}
/**
Marker returned by ky.retry() to signal a forced retry from afterResponse hooks.
*/
declare class RetryMarker {
  options?: ForceRetryOptions | undefined
  constructor(options?: ForceRetryOptions | undefined)
}
/**
Force a retry from an `afterResponse` hook.

This allows you to retry a request based on the response content, even if the response has a successful status code. The retry will respect the `retry.limit` option and skip the `shouldRetry` check. The forced retry is observable in `beforeRetry` hooks, where the error will be a `ForceRetryError`.

@param options - Optional configuration for the retry.

@example
```
import ky, {isForceRetryError} from 'ky';

const api = ky.extend({
    hooks: {
        afterResponse: [
            async (request, options, response) => {
                // Retry based on response body content
                if (response.status === 200) {
                    const data = await response.clone().json();

                    // Simple retry with default delay
                    if (data.error?.code === 'TEMPORARY_ERROR') {
                        return ky.retry();
                    }

                    // Retry with custom delay from API response
                    if (data.error?.code === 'RATE_LIMIT') {
                        return ky.retry({
                            delay: data.error.retryAfter * 1000,
                            code: 'RATE_LIMIT'
                        });
                    }

                    // Retry with a modified request (e.g., fallback endpoint)
                    if (data.error?.code === 'FALLBACK_TO_BACKUP') {
                        return ky.retry({
                            request: new Request('https://backup-api.com/endpoint', {
                                method: request.method,
                                headers: request.headers,
                            }),
                            code: 'BACKUP_ENDPOINT'
                        });
                    }

                    // Retry with refreshed authentication
                    if (data.error?.code === 'TOKEN_REFRESH' && data.newToken) {
                        return ky.retry({
                            request: new Request(request, {
                                headers: {
                                    ...Object.fromEntries(request.headers),
                                    'Authorization': `Bearer ${data.newToken}`
                                }
                            }),
                            code: 'TOKEN_REFRESHED'
                        });
                    }

                    // Retry with cause to preserve error chain
                    try {
                        validateResponse(data);
                    } catch (error) {
                        return ky.retry({
                            code: 'VALIDATION_FAILED',
                            cause: error
                        });
                    }
                }
            }
        ],
        beforeRetry: [
            ({error, retryCount}) => {
                // Observable in beforeRetry hooks
                if (isForceRetryError(error)) {
                    console.log(`Forced retry #${retryCount}: ${error.message}`);
                    // Example output: "Forced retry #1: Forced retry: RATE_LIMIT"
                }
            }
        ]
    }
});

const response = await api.get('https://example.com/api');
```
*/
declare const retry: (options?: ForceRetryOptions) => RetryMarker

type KyInstance = {
  /**
    Fetch the given `url`.

    @param url - `Request` object, `URL` object, or URL string.
    @returns A promise with `Body` method added.

    @example
    ```
    import ky from 'ky';

    const json = await ky('https://example.com', {json: {foo: true}}).json();

    console.log(json);
    //=> `{data: '🦄'}`
    ```
    */
  <T>(url: Input, options?: Options): ResponsePromise<T>
  /**
    Fetch the given `url` using the option `{method: 'get'}`.

    @param url - `Request` object, `URL` object, or URL string.
    @returns A promise with `Body` methods added.
    */
  get: <T>(url: Input, options?: Options) => ResponsePromise<T>
  /**
    Fetch the given `url` using the option `{method: 'post'}`.

    @param url - `Request` object, `URL` object, or URL string.
    @returns A promise with `Body` methods added.
    */
  post: <T>(url: Input, options?: Options) => ResponsePromise<T>
  /**
    Fetch the given `url` using the option `{method: 'put'}`.

    @param url - `Request` object, `URL` object, or URL string.
    @returns A promise with `Body` methods added.
    */
  put: <T>(url: Input, options?: Options) => ResponsePromise<T>
  /**
    Fetch the given `url` using the option `{method: 'delete'}`.

    @param url - `Request` object, `URL` object, or URL string.
    @returns A promise with `Body` methods added.
    */
  delete: <T>(url: Input, options?: Options) => ResponsePromise<T>
  /**
    Fetch the given `url` using the option `{method: 'patch'}`.

    @param url - `Request` object, `URL` object, or URL string.
    @returns A promise with `Body` methods added.
    */
  patch: <T>(url: Input, options?: Options) => ResponsePromise<T>
  /**
    Fetch the given `url` using the option `{method: 'head'}`.

    @param url - `Request` object, `URL` object, or URL string.
    @returns A promise with `Body` methods added.
    */
  head: (url: Input, options?: Options) => ResponsePromise
  /**
    Create a new Ky instance with complete new defaults.

    @returns A new Ky instance.
    */
  create: (defaultOptions?: Options) => KyInstance
  /**
    Create a new Ky instance with some defaults overridden with your own.

    In contrast to `ky.create()`, `ky.extend()` inherits defaults from its parent.

    You can also refer to parent defaults by providing a function to `.extend()`.

    @example
    ```
    import ky from 'ky';

    const api = ky.create({prefixUrl: 'https://example.com/api'});

    const usersApi = api.extend((options) => ({prefixUrl: `${options.prefixUrl}/users`}));

    const response = await usersApi.get('123');
    //=> 'https://example.com/api/users/123'

    const response = await api.get('version');
    //=> 'https://example.com/api/version'
    ```

    @returns A new Ky instance.
    */
  extend: (
    defaultOptions: Options | ((parentOptions: Options) => Options),
  ) => KyInstance
  /**
    A `Symbol` that can be returned by a `beforeRetry` hook to stop the retry. This will also short circuit the remaining `beforeRetry` hooks.

    Note: Returning this symbol makes Ky abort and return with an `undefined` response. Be sure to check for a response before accessing any properties on it or use [optional chaining](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining). It is also incompatible with body methods, such as `.json()` or `.text()`, because there is no response to parse. In general, we recommend throwing an error instead of returning this symbol, as that will cause Ky to abort and then throw, which avoids these limitations.

    A valid use-case for `ky.stop` is to prevent retries when making requests for side effects, where the returned data is not important. For example, logging client activity to the server.

    @example
    ```
    import ky from 'ky';

    const options = {
        hooks: {
            beforeRetry: [
                async ({request, options, error, retryCount}) => {
                    const shouldStopRetry = await ky('https://example.com/api');
                    if (shouldStopRetry) {
                        return ky.stop;
                    }
                }
            ]
        }
    };

    // Note that response will be `undefined` in case `ky.stop` is returned.
    const response = await ky.post('https://example.com', options);

    // Using `.text()` or other body methods is not supported.
    const text = await ky('https://example.com', options).text();
    ```
    */
  readonly stop: typeof stop
  /**
    Force a retry from an `afterResponse` hook.

    This allows you to retry a request based on the response content, even if the response has a successful status code. The retry will respect the `retry.limit` option and skip the `shouldRetry` check. The forced retry is observable in `beforeRetry` hooks, where the error will be a `ForceRetryError`.

    @example
    ```
    import ky, {isForceRetryError} from 'ky';

    const api = ky.extend({
        hooks: {
            afterResponse: [
                async (request, options, response) => {
                    // Retry based on response body content
                    if (response.status === 200) {
                        const data = await response.clone().json();

                        // Simple retry with default delay
                        if (data.error?.code === 'TEMPORARY_ERROR') {
                            return ky.retry();
                        }

                        // Retry with custom delay from API response
                        if (data.error?.code === 'RATE_LIMIT') {
                            return ky.retry({
                                delay: data.error.retryAfter * 1000,
                                code: 'RATE_LIMIT'
                            });
                        }
                    }
                }
            ],
            beforeRetry: [
                ({error, retryCount}) => {
                    // Observable in beforeRetry hooks
                    if (isForceRetryError(error)) {
                        console.log(`Forced retry #${retryCount}: ${error.message}`);
                        // Example output: "Forced retry #1: Forced retry: RATE_LIMIT"
                    }
                }
            ]
        }
    });

    const response = await api.get('https://example.com/api');
    ```
    */
  readonly retry: typeof retry
}

/*! MIT License © Sindre Sorhus */

declare const ky: KyInstance

export {
  type AfterResponseHook,
  type AfterResponseState,
  type BeforeErrorHook,
  type BeforeErrorState,
  type BeforeRequestHook,
  type BeforeRequestState,
  type BeforeRetryHook,
  type BeforeRetryState,
  ForceRetryError,
  HTTPError,
  type Hooks,
  type Input,
  type KyInstance,
  type KyRequest,
  type KyResponse,
  type NormalizedOptions,
  type Options,
  type Progress,
  type ResponsePromise,
  type RetryOptions,
  type SearchParamsOption,
  type ShouldRetryState,
  TimeoutError,
  ky as default,
  isForceRetryError,
  isHTTPError,
  isKyError,
  isTimeoutError,
}
