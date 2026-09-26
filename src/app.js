import { randomInt } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';

// No look-alike characters (0/O, 1/l/I) so codes are easy to read and type.
const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ALIAS_PATTERN = /^[A-Za-z0-9_-]{3,32}$/;
const RESERVED = new Set(['api', 'index.html', 'styles.css', 'main.js', 'favicon.ico']);
const DEFAULT_PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));

const NOT_FOUND_PAGE = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Link not found · Snip</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#0f1117;color:#e8eaf0;text-align:center}a{color:#8b7bff}</style></head>
<body><main><h1>404: link not found</h1><p>This short link doesn't exist or was deleted.</p><p><a href="/">Create a new one &rarr;</a></p></main></body>
</html>`;

export function generateCode(length = 7) {
  let code = '';
  for (let i = 0; i < length; i += 1) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

/** Returns a normalized http(s) URL, or null if the input isn't a usable web address. */
export function normalizeUrl(input) {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  if (!value || value.length > 2048) return null;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`);
    const isWeb = url.protocol === 'http:' || url.protocol === 'https:';
    return isWeb && url.hostname.includes('.') ? url.href : null;
  } catch {
    return null;
  }
}

export function createApp({ store, publicDir = DEFAULT_PUBLIC_DIR }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));
  app.use(express.static(publicDir));

  const withShortUrl = (req, link) => ({ ...link, shortUrl: `${req.protocol}://${req.get('host')}/${link.code}` });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/links', (req, res) => {
    const limit = Math.min(Number.parseInt(req.query.limit, 10) || 20, 100);
    res.json(store.list(limit).map((link) => withShortUrl(req, link)));
  });

  app.post('/api/links', async (req, res) => {
    const url = normalizeUrl(req.body?.url);
    if (!url) {
      return res.status(400).json({ error: 'Please enter a valid http(s) URL.' });
    }

    let code = typeof req.body?.alias === 'string' ? req.body.alias.trim() : '';
    if (code) {
      if (!ALIAS_PATTERN.test(code) || RESERVED.has(code.toLowerCase())) {
        return res.status(400).json({ error: 'Aliases must be 3-32 characters: letters, numbers, "-" or "_".' });
      }
      if (store.has(code)) {
        return res.status(409).json({ error: `The alias "${code}" is already taken.` });
      }
    } else {
      do code = generateCode();
      while (store.has(code));
    }

    const link = await store.add({
      code,
      url,
      clicks: 0,
      createdAt: new Date().toISOString(),
      lastClickedAt: null,
    });
    res.status(201).location(`/api/links/${code}`).json(withShortUrl(req, link));
  });

  app.get('/api/links/:code', (req, res) => {
    const link = store.get(req.params.code);
    if (!link) return res.status(404).json({ error: 'Link not found.' });
    res.json(withShortUrl(req, link));
  });

  app.delete('/api/links/:code', async (req, res) => {
    if (!(await store.remove(req.params.code))) {
      return res.status(404).json({ error: 'Link not found.' });
    }
    res.status(204).end();
  });

  app.get('/:code', async (req, res, next) => {
    const link = await store.recordClick(req.params.code);
    if (!link) return next();
    res.redirect(302, link.url);
  });

  app.use((req, res) => {
    res.status(404);
    if (req.path.startsWith('/api/')) return res.json({ error: 'Not found.' });
    res.type('html').send(NOT_FOUND_PAGE);
  });

  // Express recognizes error handlers by their four arguments.
  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) => {
    const status = error.status ?? error.statusCode ?? 500;
    if (status >= 500) console.error(error);
    let message = 'Something went wrong.';
    if (error.type === 'entity.parse.failed') message = 'Request body must be valid JSON.';
    else if (status < 500 && error.expose) message = error.message;
    res.status(status).json({ error: message });
  });

  return app;
}
