// Money helpers shared by every screen. Amounts are always whole cents.

export type SplitKind = 'equal' | 'income' | 'custom';

export type SplitMember = {
  id: string;
  monthlyIncomeCents?: number | null;
  /** Used by custom rules. Any non-negative numbers, e.g. 70 and 30. */
  weight?: number | null;
};

/**
 * Splits an amount into whole-cent shares that always add up to the amount.
 * Leftover cents go to the members with the largest remainders, ties going to
 * the earlier member, so the result is stable for the same input.
 */
export function splitAmount(
  amountCents: number,
  kind: SplitKind,
  members: SplitMember[],
): Record<string, number> {
  if (!Number.isInteger(amountCents) || amountCents < 0) {
    throw new Error('Amount must be a whole number of cents');
  }
  if (members.length === 0) {
    throw new Error('Need at least one person to split with');
  }

  const weights = members.map((m) => {
    if (kind === 'equal') return 1;
    const w = kind === 'income' ? m.monthlyIncomeCents : m.weight;
    return w ?? 0;
  });
  if (weights.some((w) => w < 0)) {
    throw new Error('Split weights cannot be negative');
  }
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0) {
    throw new Error(
      kind === 'income'
        ? 'Add both incomes in Settings to split by income'
        : 'Split percentages add up to zero',
    );
  }

  const exact = weights.map((w) => (amountCents * w) / total);
  const shares = exact.map(Math.floor);
  let leftover = amountCents - shares.reduce((a, b) => a + b, 0);
  const byRemainder = exact
    .map((x, i) => ({ i, r: x - Math.floor(x) }))
    .sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of byRemainder) {
    if (leftover === 0) break;
    shares[i] += 1;
    leftover -= 1;
  }

  return Object.fromEntries(members.map((m, i) => [m.id, shares[i]]));
}

/** "$1,234.50". Drops ".00" for round amounts when `compact` is set. */
export function formatMoney(
  cents: number,
  currency = 'USD',
  { compact = false }: { compact?: boolean } = {},
): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: compact && whole ? 0 : 2,
    maximumFractionDigits: compact && whole ? 0 : 2,
  }).format(cents / 100);
}

/** Parses what someone typed ("12", "12.5", "$1,200.00") into cents. */
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const [whole, frac = ''] = cleaned.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}
