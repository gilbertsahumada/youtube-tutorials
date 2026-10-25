import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => c.json({ message: 'Prueba /workers o /health' }))
app.get('/health', (c) => c.json({ ok: true }))

app.get('/:slug', (c) => {
  const slug = c.req.param('slug')

  if (slug === 'workers') {
    return c.redirect('https://developers.cloudflare.com/workers/', 302)
  }

  return c.json({ error: 'Enlace no encontrado' }, 404)
})

app.notFound((c) => c.json({ error: 'No encontrado' }, 404))

export default app
