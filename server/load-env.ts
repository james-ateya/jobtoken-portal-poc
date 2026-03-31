import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

/**
 * Load .env files into process.env. Handles UTF-8 BOM (common on Windows),
 * tries project root and cwd, and applies .env.local over .env.
 */
export function loadProjectEnv(): { projectRoot: string; loadedFiles: string[] } {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const candidates = [
    path.join(projectRoot, ".env"),
    path.join(projectRoot, ".env.local"),
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), ".env.local"),
  ];

  const loadedFiles: string[] = [];
  const seen = new Set<string>();

  for (const filePath of candidates) {
    const norm = path.normalize(filePath);
    if (seen.has(norm)) continue;
    seen.add(norm);
    if (!fs.existsSync(filePath)) continue;

    let raw = fs.readFileSync(filePath, "utf8");
    if (raw.charCodeAt(0) === 0xfeff) {
      raw = raw.slice(1);
    }

    const parsed = dotenv.parse(raw);
    Object.assign(process.env, parsed);
    loadedFiles.push(filePath);
  }

  return { projectRoot, loadedFiles };
}
