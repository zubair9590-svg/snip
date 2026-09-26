import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { createApp, generateCode, normalizeUrl } from '../src/app.js';
import { LinkStore } from '../src/store.js';

describe('normalizeUrl', () => {
  test('accepts http(s) URLs and adds a missing scheme', () => {
    assert.equal(normalizeUrl('https://example.com/docs?page=2'), 'https://example.com/docs?page=2');
    assert.equal(normalizeUrl('  example.com  '), 'https://example.com/');
  });

  test('rejects anything that is not a web address', () => {
    for (const input of ['', '   ', 'ftp://example.com', 'javascript:alert(1)', 'not a url', 'localhost', 42, null]) {
      assert.equal(normalizeUrl(input), null, `expected ${JSON.stringify(input)} to be rejected`);
    }
  });
});

test('generateCode returns 7 unambiguous characters', () => {
  for (let i = 0; i < 100; i += 1) {
    assert.match(generateCode(), /^[a-km-zA-HJ-NP-Z2-9]{7}$/);
  }
});

describe('HTTP API', () => {
  let server;
  let base;

  before(async () => {
    server = createApp({ store: await LinkStore.open(null) }).listen(0);
    await once(server, 'listening');
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => {
    server.closeAllConnections();
    server.close();
  });

  const createLink = (body) =>
    fetch(`${base}/api/links`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  test('creates a short link, redirects and counts clicks', async () => {
    const res = await createLink({ url: 'https://example.com/docs' });
    assert.equal(res.status, 201);
    const link = await res.json();
    assert.equal(link.url, 'https://example.com/docs');
    assert.equal(link.clicks, 0);
    assert.equal(link.shortUrl, `${base}/${link.code}`);

    const redirect = await fetch(`${base}/${link.code}`, { redirect: 'manual' });
    assert.equal(redirect.status, 302);
    assert.equal(redirect.headers.get('location'), 'https://example.com/docs');

    const stats = await (await fetch(`${base}/api/links/${link.code}`)).json();
    assert.equal(stats.clicks, 1);
    assert.ok(stats.lastClickedAt);
  });

  test('supports custom aliases and rejects duplicates or invalid ones', async () => {
    assert.equal((await createLink({ url: 'https://example.com', alias: 'my-link' })).status, 201);
    assert.equal((await createLink({ url: 'https://example.org', alias: 'my-link' })).status, 409);
    assert.equal((await createLink({ url: 'https://example.com', alias: 'no' })).status, 400);
    assert.equal((await createLink({ url: 'https://example.com', alias: 'API' })).status, 400);
  });

  test('rejects invalid URLs and malformed JSON', async () => {
    const res = await createLink({ url: 'javascript:alert(1)' });
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /valid/);

    const malformed = await fetch(`${base}/api/links`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{oops',
    });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).error, 'Request body must be valid JSON.');
  });

  test('lists and deletes links', async () => {
    const { code } = await (await createLink({ url: 'https://example.net' })).json();
    const links = await (await fetch(`${base}/api/links`)).json();
    assert.ok(links.some((link) => link.code === code));

    assert.equal((await fetch(`${base}/api/links/${code}`, { method: 'DELETE' })).status, 204);
    assert.equal((await fetch(`${base}/api/links/${code}`)).status, 404);
    assert.equal((await fetch(`${base}/${code}`, { redirect: 'manual' })).status, 404);
  });
});

test('LinkStore persists links to disk', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'snip-'));
  try {
    const file = join(dir, 'links.json');
    const store = await LinkStore.open(file);
    await store.add({ code: 'abc', url: 'https://example.com/', clicks: 0, createdAt: new Date().toISOString(), lastClickedAt: null });
    await store.recordClick('abc');

    const reopened = await LinkStore.open(file);
    assert.equal(reopened.get('abc').clicks, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
