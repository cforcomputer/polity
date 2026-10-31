import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { DB } from "./types";
import { buildSeed } from "./seed";

const FILE = process.env.POLITY_DATA ?? path.join(process.cwd(), "data", "db.json");

// The store lives on globalThis so dev hot-reloads share one copy.
const g = globalThis as unknown as { __govDb?: DB; __govSaveTimer?: ReturnType<typeof setTimeout> };

export function db(): DB {
  if (!g.__govDb) {
    try {
      g.__govDb = JSON.parse(fs.readFileSync(FILE, "utf8")) as DB;
    } catch {
      g.__govDb = buildSeed();
      flush();
    }
  }
  return g.__govDb;
}

/** Persist soon; many mutations in one request collapse into one write. */
export function save(): void {
  if (g.__govSaveTimer) clearTimeout(g.__govSaveTimer);
  g.__govSaveTimer = setTimeout(flush, 150);
}

function flush(): void {
  if (!g.__govDb) return;
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(g.__govDb, null, 1));
}

/** Restore the seed while keeping accounts people registered and the demo-mode switch. */
export function resetDb(): void {
  const prev = g.__govDb;
  const fresh = buildSeed();
  if (prev) {
    fresh.users.push(...prev.users.filter((u) => !u.demo));
    fresh.settings.demoMode = prev.settings.demoMode;
    fresh.photon = prev.photon;
  }
  g.__govDb = fresh;
  flush();
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(5).toString("hex")}`;
}
