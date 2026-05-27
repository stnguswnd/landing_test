import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const ignoredDirs = new Set([".git", ".next", "node_modules"]);
const textExtensions = new Set([
  ".css",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".sql",
  ".ts",
  ".tsx",
]);

const mojibakeTokens = [
  "\uFFFD",
  "\u8ADB",
  "\u6028",
  "\uC1E0",
  "\uC22D",
  "\uC824",
  "\uACE3",
  "\uC12C",
  "\uB4BF",
  "\uB358",
  "\uB5A1",
  "\u91AB",
  "\u75CD",
  "\u6E32",
  "\u313C",
  "\u315B",
];

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (!ignoredDirs.has(name)) files.push(...walk(path));
      continue;
    }
    if (textExtensions.has(path.slice(path.lastIndexOf(".")))) files.push(path);
  }
  return files;
}

const findings = [];

for (const file of walk(root)) {
  const buffer = readFileSync(file);
  const text = buffer.toString("utf8");
  const rel = relative(root, file);

  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    findings.push(`${rel}:1: UTF-8 BOM detected`);
  }

  text.split(/\r?\n/).forEach((line, index) => {
    if (mojibakeTokens.some((token) => line.includes(token))) {
      findings.push(`${rel}:${index + 1}: possible mojibake: ${line.trim().slice(0, 160)}`);
    }
  });
}

if (findings.length) {
  console.error("Encoding check failed. Possible broken Korean text found:\n");
  console.error(findings.join("\n"));
  process.exit(1);
}

console.log("Encoding check passed.");
