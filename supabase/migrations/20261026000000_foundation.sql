-- Foundation schema for the couples expense app.
--
-- Conventions:
--   * Money is stored as whole cents (bigint), never floats.
--   * Every row belongs to a household. Row-level security limits each
--     signed-in user to the households they are a member of.
--   * Closed sets (account kinds, split kinds, cadences, ...) are text columns
--     with check constraints rather than Postgres enums, so adding a value is
--     a one-line migration.
--   * Things people may want to rename, reorder or retire (categories,
--     accounts, split rules) are rows, not code, and are archived rather than
--     deleted so history keeps pointing at them.

-- ---------------------------------------------------------------------------
-- People and households
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  -- Two for couples. Kept as data so the limit can change without a rewrite.
  max_members int not null default 2 check (max_members >= 1),
  default_split_rule_id uuid, -- foreign key added below, after split_rules
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  display_name text not null check (length(trim(display_name)) > 0),
  -- Used by "by income" split rules. Null until the person enters it.
  monthly_income_cents bigint check (monthly_income_cents >= 0),
  color text,
  sort_order int not null default 0,
  joined_at timestamptz not null default now(),
  unique (household_id, user_id),
  unique (household_id, id)
);

create table public.invites (
  code text primary key,
  household_id uuid not null references public.households on delete cascade,
  created_by uuid not null references auth.users on delete cascade default auth.uid(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references auth.users on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Money sources, categories and split rules
-- ---------------------------------------------------------------------------

-- Where money came from: the shared joint account, or a member's own card.
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  kind text not null check (kind in ('joint', 'personal')),
  owner_member_id uuid,
  name text not null check (length(trim(name)) > 0),
  sort_order int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, owner_member_id)
    references public.members (household_id, id) on delete cascade,
  check ((kind = 'joint') = (owner_member_id is null))
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  name text not null check (length(trim(name)) > 0),
  emoji text,
  sort_order int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (household_id, id)
);

-- equal:  everyone pays the same.
-- income: shares follow members.monthly_income_cents.
-- custom: shares follow split_rule_weights (any positive numbers, e.g. 70/30).
create table public.split_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  name text not null check (length(trim(name)) > 0),
  kind text not null check (kind in ('equal', 'income', 'custom')),
  sort_order int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (household_id, id)
);

create table public.split_rule_weights (
  split_rule_id uuid not null references public.split_rules on delete cascade,
  member_id uuid not null references public.members on delete cascade,
  weight numeric not null check (weight >= 0),
  primary key (split_rule_id, member_id)
);

alter table public.households
  add foreign key (id, default_split_rule_id)
  references public.split_rules (household_id, id)
  deferrable initially deferred;

-- ---------------------------------------------------------------------------
-- Expenses
-- ---------------------------------------------------------------------------

create table public.recurring_bills (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  title text not null check (length(trim(title)) > 0),
  -- Null means the amount varies (electricity) and is asked for when due.
  amount_cents bigint check (amount_cents > 0),
  category_id uuid,
  paid_from_account_id uuid not null,
  split_rule_id uuid,
  cadence text not null default 'monthly' check (cadence in ('weekly', 'monthly', 'yearly')),
  interval_count int not null default 1 check (interval_count >= 1),
  next_due_on date not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, category_id) references public.categories (household_id, id),
  foreign key (household_id, paid_from_account_id) references public.accounts (household_id, id),
  foreign key (household_id, split_rule_id) references public.split_rules (household_id, id)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  title text not null check (length(trim(title)) > 0),
  amount_cents bigint not null check (amount_cents > 0),
  spent_on date not null default current_date,
  category_id uuid,
  paid_from_account_id uuid not null,
  -- The rule the shares were computed from. Informational: the shares
  -- themselves are the source of truth, so editing a rule never rewrites
  -- history.
  split_rule_id uuid,
  note text,
  receipt_path text,
  source text not null default 'manual' check (source in ('manual', 'recurring', 'shopping_list')),
  recurring_bill_id uuid,
  created_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (household_id, id),
  foreign key (household_id, category_id) references public.categories (household_id, id),
  foreign key (household_id, paid_from_account_id) references public.accounts (household_id, id),
  foreign key (household_id, split_rule_id) references public.split_rules (household_id, id),
  foreign key (household_id, recurring_bill_id) references public.recurring_bills (household_id, id)
);

create index expenses_household_spent_on on public.expenses (household_id, spent_on desc);

-- Who each expense is for, in cents. Shares must add up to the expense amount
-- (checked at commit by expense_shares_balanced below).
create table public.expense_shares (
  expense_id uuid not null references public.expenses on delete cascade,
  member_id uuid not null references public.members on delete cascade,
  amount_cents bigint not null check (amount_cents >= 0),
  primary key (expense_id, member_id)
);

-- ---------------------------------------------------------------------------
-- Shopping list, owned items, settlements
-- ---------------------------------------------------------------------------

create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  text text not null check (length(trim(text)) > 0),
  quantity text,
  added_by uuid references auth.users on delete set null default auth.uid(),
  checked_at timestamptz,
  checked_by uuid references auth.users on delete set null,
  -- Set when checked items are turned into an expense.
  expense_id uuid,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  foreign key (household_id, expense_id) references public.expenses (household_id, id)
);

create table public.owned_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  name text not null check (length(trim(name)) > 0),
  price_cents bigint check (price_cents >= 0),
  bought_on date,
  photo_path text,
  note text,
  expense_id uuid,
  created_at timestamptz not null default now(),
  foreign key (household_id, expense_id) references public.expenses (household_id, id)
);

-- Ownership percentages. One row at 100 = owned by that person alone.
create table public.owned_item_shares (
  owned_item_id uuid not null references public.owned_items on delete cascade,
  member_id uuid not null references public.members on delete cascade,
  percent numeric not null check (percent >= 0 and percent <= 100),
  primary key (owned_item_id, member_id)
);

-- A payment made outside the app (Venmo, Zelle, ...). to_member_id null means
-- the money went back into the joint account.
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  from_member_id uuid not null,
  to_member_id uuid,
  amount_cents bigint not null check (amount_cents > 0),
  method text not null default 'other' check (method in ('venmo', 'zelle', 'cash', 'other')),
  settled_on date not null default current_date,
  note text,
  created_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (household_id, from_member_id) references public.members (household_id, id),
  foreign key (household_id, to_member_id) references public.members (household_id, id),
  check (from_member_id is distinct from to_member_id)
);

-- ---------------------------------------------------------------------------
-- Integrity checks that a foreign key can't express
-- ---------------------------------------------------------------------------

create function public.check_expense_shares() returns trigger
language plpgsql as $$
declare
  v_expense_id uuid;
  v_expense public.expenses;
  v_total bigint;
  v_foreign int;
begin
  if tg_table_name = 'expenses' then
    v_expense_id := new.id;
  elsif tg_op = 'DELETE' then
    v_expense_id := old.expense_id;
  else
    v_expense_id := new.expense_id;
  end if;
  select * into v_expense from public.expenses where id = v_expense_id;
  if not found then
    return null; -- expense itself was deleted
  end if;

  select coalesce(sum(s.amount_cents), 0),
         count(*) filter (where m.household_id <> v_expense.household_id)
    into v_total, v_foreign
    from public.expense_shares s
    join public.members m on m.id = s.member_id
   where s.expense_id = v_expense_id;

  if v_foreign > 0 then
    raise exception 'expense % has a share for someone outside its household', v_expense_id;
  end if;
  if v_total <> v_expense.amount_cents then
    raise exception 'shares for expense % add up to % cents, expected %',
      v_expense_id, v_total, v_expense.amount_cents;
  end if;
  return null;
end $$;

create constraint trigger expense_shares_balanced
  after insert or update or delete on public.expense_shares
  deferrable initially deferred
  for each row execute function public.check_expense_shares();

create constraint trigger expense_amount_balanced
  after insert or update of amount_cents on public.expenses
  deferrable initially deferred
  for each row execute function public.check_expense_shares();

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger expenses_touch before update on public.expenses
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Balances
-- ---------------------------------------------------------------------------

-- What each member is owed by the others (positive) or owes them (negative).
-- Across a household the values always sum to zero.
--   * Paid from my card: I'm credited the full amount, and every member is
--     debited their share (including me).
--   * Paid from the joint account: no effect between members.
--   * Settlement from A to B: A is credited, B is debited.
create view public.member_balances with (security_invoker = true) as
with ledger as (
  select e.household_id, a.owner_member_id as member_id, e.amount_cents as delta
    from public.expenses e
    join public.accounts a on a.id = e.paid_from_account_id
   where e.deleted_at is null and a.kind = 'personal'
  union all
  select e.household_id, s.member_id, -s.amount_cents
    from public.expenses e
    join public.accounts a on a.id = e.paid_from_account_id
    join public.expense_shares s on s.expense_id = e.id
   where e.deleted_at is null and a.kind = 'personal'
  union all
  select household_id, from_member_id, amount_cents
    from public.settlements
   where deleted_at is null and to_member_id is not null
  union all
  select household_id, to_member_id, -amount_cents
    from public.settlements
   where deleted_at is null and to_member_id is not null
)
select m.household_id, m.id as member_id,
       coalesce(sum(l.delta), 0)::bigint as net_cents
  from public.members m
  left join ledger l on l.member_id = m.id
 group by m.household_id, m.id;

-- What each member owes back to the joint account. A joint-account expense
-- that is entirely one member's (a single non-zero share) is owed back in
-- full; a joint expense shared by several members is not.
create view public.joint_balances with (security_invoker = true) as
with personal_joint as (
  select e.household_id, s.member_id, s.amount_cents
    from public.expenses e
    join public.accounts a on a.id = e.paid_from_account_id
    join public.expense_shares s on s.expense_id = e.id and s.amount_cents > 0
   where e.deleted_at is null and a.kind = 'joint'
     and (select count(*) from public.expense_shares s2
           where s2.expense_id = e.id and s2.amount_cents > 0) = 1
),
ledger as (
  select household_id, member_id, amount_cents as delta from personal_joint
  union all
  select household_id, from_member_id, -amount_cents
    from public.settlements
   where deleted_at is null and to_member_id is null
)
select m.household_id, m.id as member_id,
       coalesce(sum(l.delta), 0)::bigint as owed_cents
  from public.members m
  left join ledger l on l.member_id = m.id
 group by m.household_id, m.id;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

create function public.is_household_member(p_household_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members
     where household_id = p_household_id and user_id = auth.uid()
  );
$$;

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.members enable row level security;
alter table public.invites enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.split_rules enable row level security;
alter table public.split_rule_weights enable row level security;
alter table public.recurring_bills enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_shares enable row level security;
alter table public.list_items enable row level security;
alter table public.owned_items enable row level security;
alter table public.owned_item_shares enable row level security;
alter table public.settlements enable row level security;

-- Profiles: you can see yourself and the people you share a household with.
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid() or exists (
      select 1 from public.members mine
      join public.members theirs on theirs.household_id = mine.household_id
     where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
  );
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Households and members are created through create_household and
-- join_household (below), so there are no insert policies here.
create policy households_select on public.households for select to authenticated
  using (public.is_household_member(id));
create policy households_update on public.households for update to authenticated
  using (public.is_household_member(id)) with check (public.is_household_member(id));

create policy members_select on public.members for select to authenticated
  using (public.is_household_member(household_id));
create policy members_update on public.members for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy invites_select on public.invites for select to authenticated
  using (public.is_household_member(household_id));

-- Everything else: full access for members of the row's household.
do $$
declare t text;
begin
  foreach t in array array[
    'accounts', 'categories', 'split_rules', 'recurring_bills', 'expenses',
    'list_items', 'owned_items', 'settlements'
  ] loop
    execute format(
      'create policy %1$s_all on public.%1$I for all to authenticated
         using (public.is_household_member(household_id))
         with check (public.is_household_member(household_id))', t);
  end loop;
end $$;

create policy split_rule_weights_all on public.split_rule_weights for all to authenticated
  using (exists (select 1 from public.split_rules r
                  where r.id = split_rule_id and public.is_household_member(r.household_id)))
  with check (exists (select 1 from public.split_rules r
                       where r.id = split_rule_id and public.is_household_member(r.household_id)));

create policy expense_shares_all on public.expense_shares for all to authenticated
  using (exists (select 1 from public.expenses e
                  where e.id = expense_id and public.is_household_member(e.household_id)))
  with check (exists (select 1 from public.expenses e
                       where e.id = expense_id and public.is_household_member(e.household_id)));

create policy owned_item_shares_all on public.owned_item_shares for all to authenticated
  using (exists (select 1 from public.owned_items i
                  where i.id = owned_item_id and public.is_household_member(i.household_id)))
  with check (exists (select 1 from public.owned_items i
                       where i.id = owned_item_id and public.is_household_member(i.household_id)));

-- ---------------------------------------------------------------------------
-- Sign-up, household creation and pairing
-- ---------------------------------------------------------------------------

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Gives a new member their own card so "paid from my card" works right away.
create function public.add_member(p_household_id uuid, p_display_name text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_member_id uuid;
  v_order int;
begin
  select coalesce(max(sort_order) + 1, 0) into v_order
    from public.members where household_id = p_household_id;

  insert into public.members (household_id, user_id, display_name, sort_order)
  values (p_household_id, auth.uid(), trim(p_display_name), v_order)
  returning id into v_member_id;

  insert into public.accounts (household_id, kind, owner_member_id, name, sort_order)
  values (p_household_id, 'personal', v_member_id, trim(p_display_name) || '''s card', v_order + 1);

  update public.profiles set display_name = trim(p_display_name)
   where id = auth.uid() and display_name = '';

  return v_member_id;
end $$;

revoke execute on function public.add_member(uuid, text) from public, anon, authenticated;

create function public.create_household(p_name text, p_display_name text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_household_id uuid;
  v_rule_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  insert into public.households (name, created_by)
  values (trim(p_name), auth.uid())
  returning id into v_household_id;

  insert into public.split_rules (household_id, name, kind)
  values (v_household_id, '50/50', 'equal')
  returning id into v_rule_id;

  update public.households set default_split_rule_id = v_rule_id where id = v_household_id;

  insert into public.accounts (household_id, kind, name, sort_order)
  values (v_household_id, 'joint', 'Joint account', 0);

  insert into public.categories (household_id, name, emoji, sort_order)
  select v_household_id, c.name, c.emoji, c.ord
    from (values
      ('Groceries', '🛒', 0), ('Home', '🏠', 1), ('Rent', '🔑', 2),
      ('Utilities', '💡', 3), ('Eating out', '🍝', 4), ('Transport', '🚗', 5),
      ('Fun', '🎉', 6), ('Other', '✨', 7)
    ) as c(name, emoji, ord);

  perform public.add_member(v_household_id, p_display_name);
  return v_household_id;
end $$;

-- Short, unambiguous codes (no 0/O, 1/I/L).
create function public.create_invite(p_household_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'not a member of this household';
  end if;
  if (select count(*) from public.members where household_id = p_household_id)
     >= (select max_members from public.households where id = p_household_id) then
    raise exception 'this household is already full';
  end if;

  loop
    select string_agg(substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1), '')
      into v_code from generate_series(1, 6);
    exit when not exists (select 1 from public.invites where code = v_code);
  end loop;

  insert into public.invites (code, household_id, created_by)
  values (v_code, p_household_id, auth.uid());
  return v_code;
end $$;

create function public.join_household(p_code text, p_display_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_invite public.invites;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  select * into v_invite from public.invites
   where code = upper(trim(p_code)) for update;

  if not found or v_invite.used_at is not null or v_invite.expires_at < now() then
    raise exception 'that invite code is not valid';
  end if;
  if exists (select 1 from public.members
              where household_id = v_invite.household_id and user_id = auth.uid()) then
    raise exception 'you are already in this household';
  end if;

  -- Lock the household row so two people can't both take the last spot.
  perform 1 from public.households where id = v_invite.household_id for update;
  if (select count(*) from public.members where household_id = v_invite.household_id)
     >= (select max_members from public.households where id = v_invite.household_id) then
    raise exception 'this household is already full';
  end if;

  perform public.add_member(v_invite.household_id, p_display_name);

  update public.invites set used_by = auth.uid(), used_at = now()
   where code = v_invite.code;

  return v_invite.household_id;
end $$;

-- ---------------------------------------------------------------------------
-- Live sync: both phones update when the other person changes something.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.members, public.expenses, public.expense_shares, public.list_items,
      public.settlements, public.recurring_bills, public.owned_items;
  end if;
end $$;
