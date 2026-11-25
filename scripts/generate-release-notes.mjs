import { mkdir, readFile, writeFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const requestedVersion = process.argv[2] || pkg.version;
const version = requestedVersion.startsWith('v') ? requestedVersion.slice(1) : requestedVersion;
const changelog = await readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8');

const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const headingPattern = new RegExp(`^## ${escapedVersion}(?:\\s+-.*)?$`, 'm');
const heading = headingPattern.exec(changelog);
if (!heading) throw new Error(`No existe la sección ${version} en CHANGELOG.md`);

const remainder = changelog.slice(heading.index + heading[0].length);
const nextHeading = remainder.search(/^## /m);
const body = (nextHeading >= 0 ? remainder.slice(0, nextHeading) : remainder).trim();

await mkdir(new URL('../release/', import.meta.url), { recursive: true });
await writeFile(
  new URL('../release/RELEASE_NOTES.md', import.meta.url),
  `# Tactical Arena ${version}\n\n${body}\n`,
  'utf8'
);

console.log(`Notas de release generadas para ${version}.`);
