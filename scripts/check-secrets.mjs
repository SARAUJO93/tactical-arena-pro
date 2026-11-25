import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const roots = ['src', 'scripts', '.github'];
const extensions = new Set(['.ts', '.mjs', '.js', '.json', '.yml', '.yaml', '.html']);
const patterns = [
  { name: 'GitHub token', regex: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g },
  { name: 'Private key', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'AWS access key', regex: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { name: 'Generic password assignment', regex: /(?:password|client_secret)\s*[:=]\s*['"][^'"]{8,}['"]/gi },
];

async function walk(dir, files = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', 'release', 'pilot-output', 'test-results'].includes(entry.name)) {
        await walk(path, files);
      }
    } else if (extensions.has(extname(entry.name))) {
      files.push(path);
    }
  }
  return files;
}

const findings = [];
for (const root of roots) {
  for (const file of await walk(root)) {
    const content = await readFile(file, 'utf8');
    for (const pattern of patterns) {
      if (pattern.regex.test(content)) findings.push(`${pattern.name}: ${file}`);
    }
  }
}

if (findings.length) {
  throw new Error(`Credenciales potenciales detectadas:\n- ${[...new Set(findings)].join('\n- ')}`);
}

console.log('Secret scan limpio.');
