import { Hono } from 'hono'
import { bearerAuth } from 'hono/bearer-auth'

type Bindings = CloudflareBindings & {
  ADMIN_TOKEN?: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', (c) => c.json({ message: 'Acortador con Workers, Hono y D1' }))
app.get('/health', (c) => c.json({ ok: true }))

app.use('/api/*', async (c, next) => {
  if (!c.env.ADMIN_TOKEN) {
    return c.json({ error: 'Falta configurar ADMIN_TOKEN' }, 503)
  }

  return bearerAuth<{ Bindings: Bindings }>({ token: c.env.ADMIN_TOKEN })(c, next)
})

app.post('/api/links', async (c) => {
  const body = await c.req.json<unknown>().catch(() => null)

  if (!body || typeof body !== 'object' || !('url' in body)
      || typeof body.url !== 'string' || body.url.length > 2048) {
    return c.json({ error: 'Envia una URL de hasta 2048 caracteres' }, 400)
  }

  let destination: URL
  try {
    destination = new URL(body.url)
  } catch {
    return c.json({ error: 'URL invalida' }, 400)
  }

  if (!['http:', 'https:'].includes(destination.protocol)) {
    return c.json({ error: 'Solo aceptamos http o https' }, 400)
  }

  const requestedSlug = 'slug' in body ? body.slug : undefined
  const slug = requestedSlug ?? crypto.randomUUID().slice(0, 8)

  if (typeof slug !== 'string' || !/^[a-z0-9-]{3,32}$/.test(slug)
      || ['api', 'health'].includes(slug)) {
    return c.json({ error: 'Slug: 3-32 caracteres a-z, 0-9 o guion; api y health estan reservados' }, 400)
  }

  const result = await c.env.DB.prepare(
    'INSERT INTO links (slug, url) VALUES (?, ?) ON CONFLICT(slug) DO NOTHING'
  ).bind(slug, destination.href).run()

  if (result.meta.changes === 0) {
    return c.json({ error: 'Ese slug ya existe; elige otro' }, 409)
  }

  return c.json({
    slug,
    url: destination.href,
    shortUrl: new URL(`/${slug}`, c.req.url).href
  }, 201)
})

app.get('/:slug', async (c) => {
  const link = await c.env.DB.prepare(
    'SELECT url FROM links WHERE slug = ?'
  ).bind(c.req.param('slug')).first<{ url: string }>()

  if (!link) {
    return c.json({ error: 'Enlace no encontrado' }, 404)
  }

  return c.redirect(link.url, 302)
})

app.notFound((c) => c.json({ error: 'No encontrado' }, 404))

export default app
