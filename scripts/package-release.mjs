import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const tag = process.env.GITHUB_REF_TYPE === 'tag'
  ? process.env.GITHUB_REF_NAME
  : `v${pkg.version}`;
const version = tag.startsWith('v') ? tag.slice(1) : tag;
const releaseDir = new URL('../release/', import.meta.url);

await mkdir(releaseDir, { recursive: true });

const htmlName = `tactical-arena-${tag}.html`;
await copyFile(new URL('../dist/index.html', import.meta.url), new URL(htmlName, releaseDir));

for (const [source, name] of [
  ['README.md', 'README.md'],
  ['TIKFINITY.md', 'TIKFINITY.md'],
  ['CHANGELOG.md', 'CHANGELOG.md'],
  ['LICENSE.md', 'LICENSE.md'],
]) {
  await copyFile(new URL(`../${source}`, import.meta.url), new URL(name, releaseDir));
}

const html = await readFile(new URL(htmlName, releaseDir));
const sha256 = createHash('sha256').update(html).digest('hex');
const manifest = {
  name: pkg.name,
  version,
  tag,
  commit: process.env.GITHUB_SHA || null,
  html: htmlName,
  sha256,
};

await writeFile(new URL('manifest.json', releaseDir), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`${htmlName}  ${sha256}`);
