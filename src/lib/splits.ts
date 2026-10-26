import { splitAmount, type SplitKind } from './money';

export type SplitRule = {
  id: string;
  name: string;
  kind: SplitKind;
  sort_order: number;
  archived_at: string | null;
  split_rule_weights: { member_id: string; weight: number }[];
};

export type SplitMemberInfo = { id: string; monthly_income_cents: number | null };

/** Who an expense is for: everyone by a split rule, or one person alone. */
export type SplitChoice = { kind: 'rule'; ruleId: string } | { kind: 'member'; memberId: string };

export type Share = { member_id: string; amount_cents: number };

export function sharesFor(
  amountCents: number,
  choice: SplitChoice,
  members: SplitMemberInfo[],
  rules: SplitRule[],
): Share[] {
  if (choice.kind === 'member') {
    return members.map((m) => ({
      member_id: m.id,
      amount_cents: m.id === choice.memberId ? amountCents : 0,
    }));
  }
  const rule = rules.find((r) => r.id === choice.ruleId);
  if (!rule) throw new Error('That split rule no longer exists');
  const split = splitAmount(
    amountCents,
    rule.kind,
    members.map((m) => ({
      id: m.id,
      monthlyIncomeCents: m.monthly_income_cents,
      weight: rule.split_rule_weights.find((w) => w.member_id === m.id)?.weight ?? 0,
    })),
  );
  return members.map((m) => ({ member_id: m.id, amount_cents: split[m.id] }));
}

/** Works out which choice produced a saved expense, for the edit screen. */
export function choiceFor(
  expense: { split_rule_id: string | null; expense_shares: Share[] },
  fallbackRuleId: string | null,
): SplitChoice | null {
  if (expense.split_rule_id) return { kind: 'rule', ruleId: expense.split_rule_id };
  const paying = expense.expense_shares.filter((s) => s.amount_cents > 0);
  if (paying.length === 1) return { kind: 'member', memberId: paying[0].member_id };
  return fallbackRuleId ? { kind: 'rule', ruleId: fallbackRuleId } : null;
}

/** "50/50", "60/40" — the shares as whole percentages, in member order. */
export function describeShares(shares: Share[], memberOrder: string[]): string {
  const total = shares.reduce((s, x) => s + x.amount_cents, 0);
  if (total === 0) return '';
  return memberOrder
    .map((id) => Math.round((100 * (shares.find((s) => s.member_id === id)?.amount_cents ?? 0)) / total))
    .join('/');
}
