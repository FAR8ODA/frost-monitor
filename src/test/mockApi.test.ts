import { describe, it, expect } from 'vitest';
import { addDays, AS_OF_DATE } from '../api/mockApi';

describe('addDays', () => {
  it('gives a 7-day window ending on AS_OF_DATE when going back 6 days', () => {
    expect(addDays(AS_OF_DATE, -6)).toBe('2027-01-09');
  });

  it('crosses month boundaries correctly', () => {
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });
});