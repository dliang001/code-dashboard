import fs from "node:fs/promises";
import path from "node:path";

export async function extractReadmeFirstParagraph(dir: string): Promise<string | null> {
  for (const fn of ["README.md", "README.MD", "Readme.md", "readme.md"]) {
    try {
      const content = await fs.readFile(path.join(dir, fn), "utf-8");
      return parseFirstParagraph(content);
    } catch { /* try next */ }
  }
  return null;
}

export function parseFirstParagraph(md: string): string | null {
  const lines = md.split(/\r?\n/);
  let inFirstPara = false;
  const buf: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!inFirstPara) {
      if (line.startsWith("#")) continue;        // skip headings
      if (line.length === 0) continue;           // skip leading blank
      if (line.startsWith("![") || line.startsWith("[![")) continue; // skip badge lines
      inFirstPara = true;
      buf.push(line);
    } else {
      if (line.length === 0) break;
      if (line.startsWith("#")) break;
      buf.push(line);
    }
  }
  if (buf.length === 0) return null;
  const text = buf.join(" ").replace(/\s+/g, " ").trim();
  return text.length > 0 ? text : null;
}
