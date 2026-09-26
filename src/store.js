import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Keeps short links in memory and, when given a file path, mirrors them to a JSON file.
 * Writes are serialized and atomic (write to a temp file, then rename).
 */
export class LinkStore {
  #links = new Map();
  #file;
  #pending = Promise.resolve();

  constructor(file = null) {
    this.#file = file;
  }

  /** Creates a store, loading existing links from `file` if it exists. Pass `null` for memory only. */
  static async open(file = null) {
    const store = new LinkStore(file);
    if (file) {
      try {
        for (const link of JSON.parse(await readFile(file, 'utf8'))) store.#links.set(link.code, link);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    return store;
  }

  has(code) {
    return this.#links.has(code);
  }

  get(code) {
    return this.#links.get(code) ?? null;
  }

  /** Most recent links first. */
  list(limit = 20) {
    return [...this.#links.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }

  async add(link) {
    this.#links.set(link.code, link);
    await this.#persist();
    return link;
  }

  async remove(code) {
    const removed = this.#links.delete(code);
    if (removed) await this.#persist();
    return removed;
  }

  async recordClick(code) {
    const link = this.#links.get(code);
    if (!link) return null;
    link.clicks += 1;
    link.lastClickedAt = new Date().toISOString();
    await this.#persist();
    return link;
  }

  #persist() {
    if (!this.#file) return Promise.resolve();
    const write = async () => {
      await mkdir(dirname(this.#file), { recursive: true });
      const temp = `${this.#file}.tmp`;
      await writeFile(temp, JSON.stringify([...this.#links.values()], null, 2));
      await rename(temp, this.#file);
    };
    // Chain after the previous write, even if it failed, so writes never interleave.
    this.#pending = this.#pending.then(write, write);
    return this.#pending;
  }
}
