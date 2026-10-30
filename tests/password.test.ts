import { describe, expect, it } from 'vitest';
import { hashPassword, passwordProblem, verifyPassword } from '@/lib/password';

describe('passwords', () => {
  it('hashes with a random salt and verifies', async () => {
    const a = await hashPassword('correct horse 42');
    const b = await hashPassword('correct horse 42');
    expect(a).not.toBe(b);
    expect(a.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('correct horse 42', a)).toBe(true);
    expect(await verifyPassword('correct horse 43', a)).toBe(false);
  });

  it('rejects missing or malformed hashes', async () => {
    expect(await verifyPassword('anything', null)).toBe(false);
    expect(await verifyPassword('anything', 'plain-text')).toBe(false);
  });

  it('enforces a basic policy', () => {
    expect(passwordProblem('short1')).toMatch(/at least/);
    expect(passwordProblem('onlyletterslong')).toMatch(/letters and numbers/);
    expect(passwordProblem('jeevan12345', 'jeevan@x.com')).toMatch(/email/);
    expect(passwordProblem('blue-river-2026')).toBeNull();
  });
});
