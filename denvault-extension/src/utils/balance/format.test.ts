import { describe, it, expect } from 'vitest';
import { formatStxFromMicro } from './format';

describe('formatStxFromMicro', () => {
  it('never shows more than the account holds', () => {
    // The deploy on 2026-08-17 cost 0.004499 STX and left 499.995501.
    // Rounding turned that into "500.00": a balance the user does not
    // have, and a transaction that looked like it never happened.
    expect(formatStxFromMicro('499995501')).toBe('499.99');
  });

  it('truncates rather than rounding, in both directions', () => {
    expect(formatStxFromMicro('1999999')).toBe('1.99');
    expect(formatStxFromMicro('1990000')).toBe('1.99');
    expect(formatStxFromMicro('1900000')).toBe('1.90');
  });

  it('groups thousands', () => {
    expect(formatStxFromMicro('1234567890000')).toBe('1,234,567.89');
  });

  it('shows a plain zero for an empty account', () => {
    expect(formatStxFromMicro('0')).toBe('0.00');
  });

  it('keeps small amounts legible instead of flattening them to zero', () => {
    // Two decimals would render this as 0.00, which reads as empty when
    // it is not.
    expect(formatStxFromMicro('4499')).toBe('0.004499');
    expect(formatStxFromMicro('1')).toBe('0.000001');
  });

  it('handles amounts at the two-decimal boundary', () => {
    expect(formatStxFromMicro('10000')).toBe('0.01');
    expect(formatStxFromMicro('9999')).toBe('0.009999');
  });

  it('survives a value that is not a number', () => {
    expect(formatStxFromMicro('')).toBe('0.00');
    expect(formatStxFromMicro('not-a-number')).toBe('0.00');
  });

  it('accepts a bigint, which is what the chain deals in', () => {
    expect(formatStxFromMicro(499995501n)).toBe('499.99');
  });
});
