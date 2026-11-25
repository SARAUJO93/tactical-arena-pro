import { describe, expect, it } from 'vitest';
import { buildSanitizedPayload, sanitizeExternalEndpoint } from './ExternalObservability';

describe('ExternalObservability', () => {
  it('permite HTTPS y HTTP local', () => {
    expect(sanitizeExternalEndpoint('https://collector.example.com/events')).toBe(
      'https://collector.example.com/events'
    );
    expect(sanitizeExternalEndpoint('http://localhost:8080/events')).toBe(
      'http://localhost:8080/events'
    );
  });

  it('rechaza HTTP remoto y credenciales en URL', () => {
    expect(sanitizeExternalEndpoint('http://collector.example.com/events')).toBeNull();
    expect(sanitizeExternalEndpoint('https://user:pass@collector.example.com/events')).toBeNull();
  });

  it('rechaza URLs invalidas', () => {
    expect(sanitizeExternalEndpoint('')).toBeNull();
    expect(sanitizeExternalEndpoint('not-a-url')).toBeNull();
  });

  it('incluye solo métricas agregadas y rendimiento', () => {
    const payload = buildSanitizedPayload('2.7.0');
    expect(payload.appVersion).toBe('2.7.0');
    expect(payload).toHaveProperty('quality.roundCount');
    expect(payload).toHaveProperty('performance.fps');
    expect(payload).not.toHaveProperty('user');
    expect(payload).not.toHaveProperty('chat');
  });
});
