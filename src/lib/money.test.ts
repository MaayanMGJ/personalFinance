import { describe, expect, it } from 'vitest';

import { formatMoney, parseMoney, splitAmount } from './money';

const a = { id: 'a', monthlyIncomeCents: 600_000, weight: 70 };
const b = { id: 'b', monthlyIncomeCents: 400_000, weight: 30 };

describe('splitAmount', () => {
  it('splits evenly and gives the odd cent to the first person', () => {
    expect(splitAmount(1001, 'equal', [a, b])).toEqual({ a: 501, b: 500 });
  });

  it('splits by income', () => {
    expect(splitAmount(10_000, 'income', [a, b])).toEqual({ a: 6000, b: 4000 });
  });

  it('splits by custom weights', () => {
    expect(splitAmount(999, 'custom', [a, b])).toEqual({ a: 699, b: 300 });
  });

  it('always adds up to the amount', () => {
    const thirds = [{ id: 'x' }, { id: 'y' }, { id: 'z' }];
    for (const amount of [1, 2, 100, 101, 12_345, 99_999]) {
      const shares = splitAmount(amount, 'equal', thirds);
      expect(Object.values(shares).reduce((s, v) => s + v, 0)).toBe(amount);
    }
  });

  it('lets one person take the whole amount', () => {
    expect(splitAmount(500, 'custom', [{ id: 'a', weight: 100 }, { id: 'b', weight: 0 }])).toEqual({
      a: 500,
      b: 0,
    });
  });

  it('asks for incomes when they are missing', () => {
    expect(() => splitAmount(100, 'income', [{ id: 'a' }, { id: 'b' }])).toThrow(/incomes/);
  });

  it('rejects fractional cents', () => {
    expect(() => splitAmount(10.5, 'equal', [a, b])).toThrow();
  });
});

describe('parseMoney', () => {
  it.each([
    ['12', 1200],
    ['12.5', 1250],
    ['12.05', 1205],
    ['$1,200.00', 120_000],
    ['0.99', 99],
  ])('parses %s', (input, cents) => {
    expect(parseMoney(input)).toBe(cents);
  });

  it.each(['', 'abc', '1.234', '-5'])('rejects %s', (input) => {
    expect(parseMoney(input)).toBeNull();
  });
});

describe('formatMoney', () => {
  it('formats cents as dollars', () => {
    expect(formatMoney(123_450)).toBe('$1,234.50');
    expect(formatMoney(4200, 'USD', { compact: true })).toBe('$42');
  });
});
