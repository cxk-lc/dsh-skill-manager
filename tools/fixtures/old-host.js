// Simulates a host that predates the current browser bundle: status reports
// 0.1.0 with a read-only agents root, and githubSearch does not exist.
(() => {
  const original = window.fetch
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input && input.url
    const response = await original(input, init)
    if (!url || url.indexOf('dsh-skill-manager/api') < 0) return response

    const body = init && typeof init.body === 'string' ? init.body : ''
    if (body.indexOf('"githubSearch"') >= 0) {
      return new Response(JSON.stringify({ ok: false, code: 'ENOMETHOD', error: '未知方法：githubSearch' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    const data = await response.clone().json()
    if (data && data.roots) {
      data.version = '0.1.0'
      delete data.capabilities
      data.roots = data.roots.map((root) => (root.id === 'agents' ? { ...root, writable: false } : root))
    }
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'content-type': 'application/json' },
    })
  }
})()
