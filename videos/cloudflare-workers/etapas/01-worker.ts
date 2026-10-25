export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'GET' && url.pathname === '/') {
      return Response.json({ message: 'Prueba /workers o /health' })
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ ok: true })
    }

    if (request.method === 'GET' && url.pathname === '/workers') {
      return Response.redirect('https://developers.cloudflare.com/workers/', 302)
    }

    return Response.json({ error: 'No encontrado' }, { status: 404 })
  }
} satisfies ExportedHandler<CloudflareBindings>
