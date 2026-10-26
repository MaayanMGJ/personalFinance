import type { Share } from './splits';
import { supabase } from './supabase';

export type Expense = {
  id: string;
  title: string;
  amount_cents: number;
  spent_on: string;
  note: string | null;
  receipt_path: string | null;
  category_id: string | null;
  paid_from_account_id: string;
  split_rule_id: string | null;
  created_by: string | null;
  created_at: string;
  expense_shares: Share[];
};

const COLUMNS =
  'id, title, amount_cents, spent_on, note, receipt_path, category_id, paid_from_account_id, split_rule_id, created_by, created_at, expense_shares (member_id, amount_cents)';

export async function listExpenses(householdId: string, limit = 200): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select(COLUMNS)
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .order('spent_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as unknown as Expense[];
}

export async function getExpense(id: string): Promise<Expense | null> {
  const { data, error } = await supabase
    .from('expenses')
    .select(COLUMNS)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as Expense | null;
}

export type ExpenseInput = {
  id?: string;
  householdId: string;
  title: string;
  amountCents: number;
  paidFromAccountId: string;
  shares: Share[];
  spentOn: string;
  categoryId: string | null;
  splitRuleId: string | null;
  note: string | null;
  receiptPath: string | null;
};

export async function saveExpense(input: ExpenseInput): Promise<string> {
  const { data, error } = await supabase.rpc('save_expense', {
    p_id: input.id ?? null,
    p_household_id: input.householdId,
    p_title: input.title,
    p_amount_cents: input.amountCents,
    p_paid_from_account_id: input.paidFromAccountId,
    p_shares: input.shares,
    p_spent_on: input.spentOn,
    p_category_id: input.categoryId,
    p_split_rule_id: input.splitRuleId,
    p_note: input.note,
    p_receipt_path: input.receiptPath,
  });
  if (error) throw error;
  return data as string;
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase
    .from('expenses')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/** Uploads a photo to the household's private receipts folder. */
export async function uploadReceipt(householdId: string, uri: string): Promise<string> {
  const body = await (await fetch(uri)).arrayBuffer();
  const path = `${householdId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage
    .from('receipts')
    .upload(path, body, { contentType: 'image/jpeg' });
  if (error) throw error;
  return path;
}

export async function receiptUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('receipts').createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

/** Today's date as YYYY-MM-DD in the phone's own time zone. */
export function localDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "Today", "Yesterday", or "Mon, Oct 20". */
export function friendlyDate(isoDate: string): string {
  if (isoDate === localDate()) return 'Today';
  if (isoDate === localDate(-1)) return 'Yesterday';
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
