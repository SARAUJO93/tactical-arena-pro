import { readFile } from 'node:fs/promises';

const gameState = await readFile(new URL('../src/core/GameState.ts', import.meta.url), 'utf8');
const policy = await readFile(new URL('../PERSISTENCE_POLICY.md', import.meta.url), 'utf8');

if (!gameState.includes('PERSISTENCE_SCHEMA_VERSION')) {
  throw new Error('GameState no declara PERSISTENCE_SCHEMA_VERSION');
}
if (!gameState.includes('schemaVersion: PERSISTENCE_SCHEMA_VERSION')) {
  throw new Error('saveNow no escribe schemaVersion');
}
if (!gameState.includes('Unsupported persisted schema version')) {
  throw new Error('loadPersistentState no rechaza esquemas superiores');
}
if (!policy.includes('PERSISTENCE_SCHEMA_VERSION')) {
  throw new Error('PERSISTENCE_POLICY.md no declara el contrato');
}

console.log('Contrato de persistencia válido.');
