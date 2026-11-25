import { describe, expect, it } from 'vitest';
import { redactSensitiveText } from './OperationalLogger';

describe('OperationalLogger', () => {
  it('redacta URLs, usuarios, correo y números largos', () => {
    const text = 'Usuario @Viewer at https://example.com/a 12345678 test@example.com';
    const result = redactSensitiveText(text);
    expect(result).not.toContain('@Viewer');
    expect(result).not.toContain('https://');
    expect(result).not.toContain('test@example.com');
  });
});
