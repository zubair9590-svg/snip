<div align="center">

# ✂️ Snip

**A fast, minimal URL shortener with click analytics: REST API + web UI.**

![Node.js](https://img.shields.io/badge/Node.js-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express_5-000000?style=for-the-badge&logo=express&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![License: MIT](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)
<br />
[![CI](https://github.com/zubair9590-svg/snip/actions/workflows/ci.yml/badge.svg)](https://github.com/zubair9590-svg/snip/actions/workflows/ci.yml)

</div>

## ✨ Features

- **Shorten any link** into a 7-character code, or pick your own **custom alias**
- **Click analytics**: every redirect is counted, with the time of the last click
- **Clean REST API** with proper status codes (`201`, `400`, `404`, `409`) and JSON errors
- **Web interface** to create, copy and delete links
- **Input validation**: only `http(s)` links are accepted (`javascript:` and other schemes are rejected), and a missing `https://` is added for you
- **Persistent storage** in a JSON file with atomic, serialized writes, and no database to install
- **Tested** with Node's built-in test runner, and CI runs on every push

## 🚀 Getting started

```bash
git clone https://github.com/zubair9590-svg/snip.git
cd snip
npm install
npm start          # http://localhost:3000
npm test           # run the test suite
```

| Environment variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | Port the server listens on |
| `DATA_FILE` | `data/links.json` | Where links are stored |

## 📡 API

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/links` | Create a short link: `{ "url": "...", "alias": "optional" }` |
| `GET` | `/api/links` | List recent links (`?limit=20`) |
| `GET` | `/api/links/:code` | Stats for one link |
| `DELETE` | `/api/links/:code` | Delete a link |
| `GET` | `/:code` | Redirect to the original URL (and count the click) |

```bash
$ curl -X POST http://localhost:3000/api/links \
    -H "Content-Type: application/json" \
    -d '{"url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide", "alias": "js-guide"}'

{
  "code": "js-guide",
  "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide",
  "clicks": 0,
  "createdAt": "2026-09-26T14:02:11.482Z",
  "lastClickedAt": null,
  "shortUrl": "http://localhost:3000/js-guide"
}
```

## 📁 Project structure

```
snip/
├── server.js          # entry point
├── src/
│   ├── app.js         # Express app: routes, validation, error handling
│   └── store.js       # in-memory store mirrored to a JSON file
├── public/            # web UI (HTML, CSS, JS)
└── test/
    └── app.test.js    # API and storage tests (node:test)
```

## 📄 License

[MIT](LICENSE) © Zubair
