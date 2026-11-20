import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

// D1 simulado sobre SQLite real y R2 en memoria, para pruebas y servidor local.
export class D1Statement {
  constructor(db, sql, params = []) { this.db = db; this.sql = sql; this.params = params; }
  bind(...params) { return new D1Statement(this.db, this.sql, params.map((p) => (p === undefined ? null : p))); }
  async first() { return this.db.prepare(this.sql).get(...this.params) ?? null; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.params).map((row) => ({ ...row })) }; }
  async run() {
    const info = this.db.prepare(this.sql).run(...this.params);
    return { success: true, meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) } };
  }
}
export class D1 {
  constructor() {
    this.db = new DatabaseSync(":memory:");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
  }
  prepare(sql) { return new D1Statement(this.db, sql); }
  async batch(statements) {
    this.db.exec("BEGIN");
    try {
      const out = [];
      for (const statement of statements) out.push(await statement.run());
      this.db.exec("COMMIT");
      return out;
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
}
export class R2 {
  constructor() { this.objects = new Map(); }
  async put(key, body, options) {
    const bytes = body instanceof ArrayBuffer ? new Uint8Array(body) : new Uint8Array(await new Response(body).arrayBuffer());
    this.objects.set(key, { bytes, contentType: options?.httpMetadata?.contentType });
  }
  async delete(key) { this.objects.delete(key); }
  async get(key, options = {}) {
    const stored = this.objects.get(key);
    if (!stored) return null;
    let range;
    const header = options.range?.get?.("Range");
    let bytes = stored.bytes;
    if (header) {
      const [, start, end] = header.match(/bytes=(\d+)-(\d*)/);
      const offset = Number(start);
      const last = end ? Number(end) : stored.bytes.length - 1;
      range = { offset, length: last - offset + 1 };
      bytes = stored.bytes.slice(offset, last + 1);
    }
    return {
      size: stored.bytes.length, range, httpEtag: '"etag"', body: new Blob([bytes]).stream(),
      writeHttpMetadata: (headers) => headers.set("Content-Type", stored.contentType)
    };
  }
}

