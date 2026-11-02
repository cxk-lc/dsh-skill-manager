/**
 * Outbound HTTP helpers: one place for timeouts, user agents, size ceilings and
 * error normalization, so every source reports failures the same way.
 * @module dsh-skill-manager/http
 */

export const DEFAULT_UA = 'Mozilla/5.0 (compatible; dsh-skill-manager/0.1)'
export const DEFAULT_TIMEOUT_MS = 20_000
export const DEFAULT_MAX_BYTES = 50 * 1024 * 1024

/** A failure that already carries a message fit for the UI. */
export class SourceError extends Error {
  constructor(message, options = {}) {
    super(message)
    this.name = 'SourceError'
    this.code = options.code || 'EUPSTREAM'
    this.status = options.status
  }
}

function describeStatus(status, url) {
  const host = safeHost(url)
  if (status === 401 || status === 403) {
    return `${host} 拒绝了请求（HTTP ${status}）。可能是额度用尽或凭证无效，可在「设置」里补充 Token / API Key 后重试。`
  }
  if (status === 404) return `${host} 上找不到该资源（HTTP 404）。`
  if (status === 429) return `${host} 触发限流（HTTP 429）。请稍后再试，或到「设置」补充 Token / API Key。`
  if (status >= 500) return `${host} 服务异常（HTTP ${status}）。`
  return `${host} 返回异常状态（HTTP ${status}）。`
}

function safeHost(url) {
  try {
    return new URL(url).host
  } catch {
    return '上游服务'
  }
}

function isAbort(err) {
  return err && (err.name === 'AbortError' || err.code === 'ABORT_ERR')
}

/**
 * Perform one request and buffer the body under a hard byte ceiling.
 * @param {string} url
 * @param {{headers?: Record<string,string>, timeoutMs?: number, maxBytes?: number, method?: string, body?: string}} options
 * @returns {Promise<{status: number, headers: Headers, body: Buffer}>}
 */
export async function request(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs)
  let response
  try {
    response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'user-agent': DEFAULT_UA,
        accept: '*/*',
        ...(options.headers || {}),
      },
      body: options.body,
      redirect: 'follow',
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timer)
    if (isAbort(err)) {
      throw new SourceError(`${safeHost(url)} 请求超时（${Math.round(timeoutMs / 1000)}s）。请检查网络或稍后重试。`, {
        code: 'ETIMEDOUT',
      })
    }
    throw new SourceError(`无法连接 ${safeHost(url)}：${err instanceof Error ? err.message : String(err)}`, {
      code: 'ENETWORK',
    })
  }

  try {
    if (!response.ok) {
      throw new SourceError(describeStatus(response.status, url), {
        code: response.status === 429 ? 'ERATELIMIT' : 'EHTTP',
        status: response.status,
      })
    }
    const declared = Number(response.headers.get('content-length') || 0)
    if (declared > maxBytes) {
      throw new SourceError(`上游文件过大（${Math.round(declared / 1024 / 1024)} MiB），已超过 ${Math.round(maxBytes / 1024 / 1024)} MiB 上限。`, {
        code: 'ETOOLARGE',
      })
    }
    const body = Buffer.from(await response.arrayBuffer())
    if (body.length > maxBytes) {
      throw new SourceError(`上游文件过大（${Math.round(body.length / 1024 / 1024)} MiB），已超过上限。`, {
        code: 'ETOOLARGE',
      })
    }
    return { status: response.status, headers: response.headers, body }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Request JSON with a readable failure for non-JSON bodies.
 * @param {string} url
 * @param {object} [options]
 * @returns {Promise<any>}
 */
export async function fetchJson(url, options = {}) {
  const { body } = await request(url, { ...options, headers: { accept: 'application/json', ...(options.headers || {}) } })
  const text = body.toString('utf8')
  try {
    return JSON.parse(text)
  } catch {
    throw new SourceError(`${safeHost(url)} 返回了非 JSON 内容，接口可能已变更。`, { code: 'EBADJSON' })
  }
}

/**
 * Request bytes (zip downloads).
 * @param {string} url
 * @param {object} [options]
 * @returns {Promise<Buffer>}
 */
export async function fetchBytes(url, options = {}) {
  const { body } = await request(url, options)
  return body
}
