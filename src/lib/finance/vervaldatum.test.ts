import { describe, expect, it } from 'vitest';
import { dagenTeLaat } from './vervaldatum';

describe('Vervaldatum', () => {
  it('volgt de afgesproken vervaldatum, ook bij een korte of lange termijn', () => {
    expect(dagenTeLaat(new Date('2026-09-07'), new Date('2026-09-15'), 10000)).toBe(8);
    expect(dagenTeLaat(new Date('2026-10-01'), new Date('2026-09-15'), 10000)).toBe(0);
  });
  it('is op de vervaldag nog niet te laat en jaagt geen betaalde facturen of credits na', () => {
    expect(dagenTeLaat(new Date('2026-09-15'), new Date('2026-09-15'), 10000)).toBe(0);
    expect(dagenTeLaat(new Date('2026-09-01'), new Date('2026-09-15'), 0)).toBe(0);
    expect(dagenTeLaat(new Date('2026-09-01'), new Date('2026-09-15'), -10000)).toBe(0);
  });
});
