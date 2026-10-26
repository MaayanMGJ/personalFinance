import { describe, expect, it } from 'vitest';

import { choiceFor, describeShares, sharesFor, type SplitRule } from './splits';

const members = [
  { id: 'a', monthly_income_cents: 600_000 },
  { id: 'b', monthly_income_cents: 400_000 },
];

const rule = (kind: SplitRule['kind'], weights: [number, number] = [0, 0]): SplitRule => ({
  id: kind,
  name: kind,
  kind,
  sort_order: 0,
  archived_at: null,
  split_rule_weights: [
    { member_id: 'a', weight: weights[0] },
    { member_id: 'b', weight: weights[1] },
  ],
});

const rules = [rule('equal'), rule('income'), rule('custom', [70, 30])];

describe('sharesFor', () => {
  it('uses the chosen rule', () => {
    expect(sharesFor(1000, { kind: 'rule', ruleId: 'equal' }, members, rules)).toEqual([
      { member_id: 'a', amount_cents: 500 },
      { member_id: 'b', amount_cents: 500 },
    ]);
    expect(sharesFor(1000, { kind: 'rule', ruleId: 'income' }, members, rules)[0].amount_cents).toBe(600);
    expect(sharesFor(1000, { kind: 'rule', ruleId: 'custom' }, members, rules)[0].amount_cents).toBe(700);
  });

  it('puts everything on one person', () => {
    expect(sharesFor(1000, { kind: 'member', memberId: 'b' }, members, rules)).toEqual([
      { member_id: 'a', amount_cents: 0 },
      { member_id: 'b', amount_cents: 1000 },
    ]);
  });

  it('complains about a missing rule', () => {
    expect(() => sharesFor(1000, { kind: 'rule', ruleId: 'gone' }, members, rules)).toThrow();
  });
});

describe('choiceFor', () => {
  it('prefers the saved rule', () => {
    expect(choiceFor({ split_rule_id: 'income', expense_shares: [] }, 'equal')).toEqual({
      kind: 'rule',
      ruleId: 'income',
    });
  });

  it('recognises a one-person expense', () => {
    const shares = [
      { member_id: 'a', amount_cents: 0 },
      { member_id: 'b', amount_cents: 900 },
    ];
    expect(choiceFor({ split_rule_id: null, expense_shares: shares }, 'equal')).toEqual({
      kind: 'member',
      memberId: 'b',
    });
  });
});

describe('describeShares', () => {
  it('shows percentages in member order', () => {
    const shares = [
      { member_id: 'b', amount_cents: 400 },
      { member_id: 'a', amount_cents: 600 },
    ];
    expect(describeShares(shares, ['a', 'b'])).toBe('60/40');
  });
});
