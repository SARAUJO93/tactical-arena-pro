import { readFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const changelog = await readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8');

const tag = process.env.GITHUB_REF_TYPE === 'tag'
  ? process.env.GITHUB_REF_NAME
  : process.argv[2];
const version = tag?.startsWith('v') ? tag.slice(1) : tag;
const expectedVersion = version || pkg.version;

const errors = [];
if (pkg.version !== expectedVersion) {
  errors.push(`package.json es ${pkg.version}, pero el release esperado es ${expectedVersion}`);
}
if (!indexHtml.includes(expectedVersion)) {
  errors.push(`index.html no contiene la versión ${expectedVersion}`);
}
if (!changelog.includes(`## ${expectedVersion}`)) {
  errors.push(`CHANGELOG.md no contiene la sección ${expectedVersion}`);
}

if (errors.length) {
  throw new Error(`Validación de release fallida:\n- ${errors.join('\n- ')}`);
}

console.log(`Release ${expectedVersion} válido.`);
