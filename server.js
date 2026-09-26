import { createApp } from './src/app.js';
import { LinkStore } from './src/store.js';

const port = Number(process.env.PORT) || 3000;
const store = await LinkStore.open(process.env.DATA_FILE ?? 'data/links.json');

createApp({ store }).listen(port, () => {
  console.log(`Snip is running at http://localhost:${port}`);
});
