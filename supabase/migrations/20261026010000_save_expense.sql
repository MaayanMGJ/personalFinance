-- Saves an expense and its shares in one call, so the two never disagree.
-- Runs with the caller's permissions: row-level security still decides
-- whether they may touch this household.
--
-- p_shares is a JSON array: [{"member_id": "...", "amount_cents": 1234}, ...]
-- Pass p_id to edit an existing expense; leave it null to create one.
create function public.save_expense(
  p_household_id uuid,
  p_title text,
  p_amount_cents bigint,
  p_paid_from_account_id uuid,
  p_shares jsonb,
  p_spent_on date default current_date,
  p_category_id uuid default null,
  p_split_rule_id uuid default null,
  p_note text default null,
  p_receipt_path text default null,
  p_id uuid default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid;
begin
  if p_id is null then
    insert into public.expenses (
      household_id, title, amount_cents, paid_from_account_id, spent_on,
      category_id, split_rule_id, note, receipt_path
    ) values (
      p_household_id, trim(p_title), p_amount_cents, p_paid_from_account_id, p_spent_on,
      p_category_id, p_split_rule_id, nullif(trim(p_note), ''), p_receipt_path
    ) returning id into v_id;
  else
    update public.expenses set
      title = trim(p_title),
      amount_cents = p_amount_cents,
      paid_from_account_id = p_paid_from_account_id,
      spent_on = p_spent_on,
      category_id = p_category_id,
      split_rule_id = p_split_rule_id,
      note = nullif(trim(p_note), ''),
      receipt_path = p_receipt_path
    where id = p_id and household_id = p_household_id and deleted_at is null
    returning id into v_id;
    if v_id is null then
      raise exception 'expense not found';
    end if;
    delete from public.expense_shares where expense_id = v_id;
  end if;

  insert into public.expense_shares (expense_id, member_id, amount_cents)
  select v_id, (s ->> 'member_id')::uuid, (s ->> 'amount_cents')::bigint
    from jsonb_array_elements(p_shares) as s;

  return v_id;
end $$;

-- The share check must see every member, not only the ones the caller can
-- see, so a share for someone in another household is always caught.
alter function public.check_expense_shares() security definer set search_path = '';
