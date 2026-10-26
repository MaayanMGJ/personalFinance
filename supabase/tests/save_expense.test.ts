import type { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';

import { asUser, createUser, freshDb, one } from './harness';

let db: PGlite;
let alex: string;
let sam: string;
let householdId: string;
let alexMember: string;
let samMember: string;
let alexCard: string;

beforeEach(async () => {
  db = await freshDb();
  alex = await createUser(db);
  sam = await createUser(db);
  householdId = await asUser(db, alex, async (tx) =>
    (await one<{ id: string }>(tx.query(`select create_household('Home', 'Alex') as id`))).id,
  );
  const code = await asUser(db, alex, async (tx) =>
    (await one<{ c: string }>(tx.query(`select create_invite($1) as c`, [householdId]))).c,
  );
  await asUser(db, sam, (tx) => tx.query(`select join_household($1, 'Sam')`, [code]));
  const rows = (
    await db.query<{ user_id: string; member_id: string; card_id: string }>(
      `select m.user_id, m.id as member_id, a.id as card_id
         from members m join accounts a on a.owner_member_id = m.id`,
    )
  ).rows;
  alexMember = rows.find((r) => r.user_id === alex)!.member_id;
  alexCard = rows.find((r) => r.user_id === alex)!.card_id;
  samMember = rows.find((r) => r.user_id === sam)!.member_id;
});

function shares(a: number, b: number) {
  return JSON.stringify([
    { member_id: alexMember, amount_cents: a },
    { member_id: samMember, amount_cents: b },
  ]);
}

async function save(userId: string, amount: number, s: string, id: string | null = null) {
  return asUser(db, userId, async (tx) =>
    (
      await one<{ id: string }>(
        tx.query(
          `select save_expense(
             p_household_id => $1, p_title => 'Groceries', p_amount_cents => $2,
             p_paid_from_account_id => $3, p_shares => $4::jsonb, p_id => $5) as id`,
          [householdId, amount, alexCard, s, id],
        ),
      )
    ).id,
  );
}

async function net(memberId: string) {
  const r = await one<{ net_cents: number }>(
    db.query(`select net_cents from member_balances where member_id = $1`, [memberId]),
  );
  return Number(r.net_cents);
}

describe('save_expense', () => {
  it('creates an expense with its shares', async () => {
    await save(alex, 6400, shares(3200, 3200));
    expect(await net(alexMember)).toBe(3200);
    expect(await net(samMember)).toBe(-3200);
  });

  it('lets the partner edit it and replaces the shares', async () => {
    const id = await save(alex, 6400, shares(3200, 3200));
    await save(sam, 1000, shares(0, 1000), id);
    expect(await net(samMember)).toBe(-1000);
    const { n } = await one<{ n: number }>(
      db.query(`select count(*)::int as n from expense_shares where expense_id = $1`, [id]),
    );
    expect(n).toBe(2);
  });

  it('rejects shares that do not add up', async () => {
    await expect(save(alex, 6400, shares(3200, 3000))).rejects.toThrow(/add up/);
  });

  it('keeps people outside the household out', async () => {
    const outsider = await createUser(db);
    await expect(save(outsider, 100, shares(50, 50))).rejects.toThrow(/row-level security/);
  });

  it('rejects a share for someone in another household', async () => {
    const pat = await createUser(db);
    await asUser(db, pat, (tx) => tx.query(`select create_household('Theirs', 'Pat')`));
    const patMember = (
      await one<{ id: string }>(db.query(`select id from members where user_id = $1`, [pat]))
    ).id;
    const sneaky = JSON.stringify([
      { member_id: alexMember, amount_cents: 100 },
      { member_id: patMember, amount_cents: 0 },
    ]);
    await expect(save(alex, 100, sneaky)).rejects.toThrow(/outside its household/);
  });

  it('cannot edit a deleted expense', async () => {
    const id = await save(alex, 500, shares(250, 250));
    await asUser(db, alex, (tx) => tx.query(`update expenses set deleted_at = now() where id = $1`, [id]));
    await expect(save(alex, 500, shares(250, 250), id)).rejects.toThrow(/not found/);
  });
});
