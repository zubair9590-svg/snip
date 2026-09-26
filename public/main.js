const form = document.querySelector('#shorten-form');
const urlInput = document.querySelector('#url');
const aliasInput = document.querySelector('#alias');
const submitBtn = form.querySelector('button[type="submit"]');
const errorEl = document.querySelector('#error');
const resultEl = document.querySelector('#result');
const shortLinkEl = document.querySelector('#short-link');
const copyBtn = document.querySelector('#copy');
const linksEl = document.querySelector('#links');
const emptyEl = document.querySelector('#empty');

async function api(path, options = {}) {
  const res = await fetch(path, { headers: { 'content-type': 'application/json' }, ...options });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data;
}

function cell(content, className) {
  const td = document.createElement('td');
  if (className) td.className = className;
  td.append(content);
  return td;
}

function link(href, text) {
  const a = document.createElement('a');
  a.href = href;
  a.textContent = text;
  a.target = '_blank';
  a.rel = 'noopener';
  return a;
}

async function loadLinks() {
  const links = await api('/api/links');
  emptyEl.hidden = links.length > 0;
  linksEl.replaceChildren(
    ...links.map((item) => {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'ghost small';
      remove.textContent = 'Delete';
      remove.addEventListener('click', async () => {
        await api(`/api/links/${item.code}`, { method: 'DELETE' });
        loadLinks();
      });

      const row = document.createElement('tr');
      row.append(
        cell(link(item.shortUrl, `/${item.code}`)),
        cell(link(item.url, item.url), 'dest'),
        cell(String(item.clicks), 'num'),
        cell(remove, 'actions'),
      );
      return row;
    }),
  );
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submitBtn.disabled) return; // ignore double submits while a request is in flight
  errorEl.textContent = '';
  submitBtn.disabled = true;
  try {
    const created = await api('/api/links', {
      method: 'POST',
      body: JSON.stringify({ url: urlInput.value, alias: aliasInput.value }),
    });
    shortLinkEl.href = created.shortUrl;
    shortLinkEl.textContent = created.shortUrl.replace(/^https?:\/\//, '');
    resultEl.hidden = false;
    form.reset();
    loadLinks();
  } catch (error) {
    errorEl.textContent = error.message;
  } finally {
    submitBtn.disabled = false;
  }
});

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(shortLinkEl.href);
    copyBtn.textContent = 'Copied!';
  } catch {
    copyBtn.textContent = 'Copy failed';
  }
  setTimeout(() => {
    copyBtn.textContent = 'Copy';
  }, 1500);
});

document.querySelector('#refresh').addEventListener('click', loadLinks);

loadLinks();
