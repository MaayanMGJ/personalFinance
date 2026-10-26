import type { PGlite, Transaction } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';

import { asUser, createUser, freshDb, one } from './harness';

type Couple = {
  householdId: string;
  alex: { userId: string; memberId: string; cardId: string };
  sam: { userId: string; memberId: string; cardId: string };
  jointId: string;
};

let db: PGlite;

beforeEach(async () => {
  db = await freshDb();
});

async function makeCouple(): Promise<Couple> {
  const alexUser = await createUser(db);
  const samUser = await createUser(db);

  const householdId = await asUser(db, alexUser, async (tx) => {
    const { id } = await one<{ id: string }>(
      tx.query(`select public.create_household('Our place', 'Alex') as id`),
    );
    return id;
  });
  const code = await asUser(db, alexUser, async (tx) => {
    const r = await one<{ code: string }>(
      tx.query(`select public.create_invite($1) as code`, [householdId]),
    );
    return r.code;
  });
  await asUser(db, samUser, (tx) =>
    tx.query(`select public.join_household($1, 'Sam')`, [code.toLowerCase()]),
  );

  const member = async (userId: string) =>
    one<{ memberId: string; cardId: string }>(
      db.query(
        `select m.id as "memberId", a.id as "cardId"
           from members m join accounts a on a.owner_member_id = m.id
          where m.user_id = $1`,
        [userId],
      ),
    );
  const joint = await one<{ id: string }>(
    db.query(`select id from accounts where household_id = $1 and kind = 'joint'`, [householdId]),
  );

  return {
    householdId,
    alex: { userId: alexUser, ...(await member(alexUser)) },
    sam: { userId: samUser, ...(await member(samUser)) },
    jointId: joint.id,
  };
}

async function addExpense(
  tx: Transaction,
  c: Couple,
  accountId: string,
  amount: number,
  shares: Record<string, number>,
) {
  const { id } = await one<{ id: string }>(
    tx.query(
      `insert into expenses (household_id, title, amount_cents, paid_from_account_id)
       values ($1, 'Test', $2, $3) returning id`,
      [c.householdId, amount, accountId],
    ),
  );
  for (const [memberId, cents] of Object.entries(shares)) {
    await tx.query(
      `insert into expense_shares (expense_id, member_id, amount_cents) values ($1, $2, $3)`,
      [id, memberId, cents],
    );
  }
  return id;
}

async function balances(c: Couple) {
  const { rows } = await db.query<{ member_id: string; net_cents: number }>(
    `select member_id, net_cents from member_balances where household_id = $1`,
    [c.householdId],
  );
  return Object.fromEntries(rows.map((r) => [r.member_id, Number(r.net_cents)]));
}

describe('creating a household', () => {
  it('sets up a joint account, a card, a 50/50 rule and categories', async () => {
    const user = await createUser(db);
    const householdId = await asUser(db, user, async (tx) => {
      const r = await one<{ id: string }>(tx.query(`select create_household('Home', 'Alex') as id`));
      return r.id;
    });

    const counts = await one<Record<string, number>>(
      db.query(
        `select
           (select count(*) from members where household_id = $1)::int as members,
           (select count(*) from accounts where household_id = $1 and kind = 'joint')::int as joint,
           (select count(*) from accounts where household_id = $1 and kind = 'personal')::int as cards,
           (select count(*) from categories where household_id = $1)::int as categories`,
        [householdId],
      ),
    );
    expect(counts).toEqual({ members: 1, joint: 1, cards: 1, categories: 8 });

    const rule = await one<{ kind: string; name: string }>(
      db.query(
        `select r.kind, r.name from households h join split_rules r on r.id = h.default_split_rule_id
          where h.id = $1`,
        [householdId],
      ),
    );
    expect(rule).toEqual({ kind: 'equal', name: '50/50' });
  });
});

describe('pairing', () => {
  it('lets a partner join with an invite code', async () => {
    const c = await makeCouple();
    const { n } = await one<{ n: number }>(
      db.query(`select count(*)::int as n from members where household_id = $1`, [c.householdId]),
    );
    expect(n).toBe(2);
  });

  it('turns away a third person and reused codes', async () => {
    const c = await makeCouple();
    await expect(
      asUser(db, c.alex.userId, (tx) => tx.query(`select create_invite($1)`, [c.householdId])),
    ).rejects.toThrow(/already full/);

    const used = await one<{ code: string }>(db.query(`select code from invites`));
    const third = await createUser(db);
    await expect(
      asUser(db, third, (tx) => tx.query(`select join_household($1, 'Pat')`, [used.code])),
    ).rejects.toThrow(/not valid/);
  });

  it('rejects unknown codes', async () => {
    const user = await createUser(db);
    await expect(
      asUser(db, user, (tx) => tx.query(`select join_household('NOPE99', 'Pat')`)),
    ).rejects.toThrow(/not valid/);
  });
});

describe('privacy', () => {
  it('hides a household from people outside it', async () => {
    const c = await makeCouple();
    const outsider = await createUser(db);
    await asUser(db, outsider, async (tx) => {
      for (const table of ['households', 'members', 'accounts', 'categories', 'expenses']) {
        const { rows } = await tx.query(`select * from ${table}`);
        expect(rows, table).toHaveLength(0);
      }
    });
    await expect(
      asUser(db, outsider, (tx) => addExpense(tx, c, c.jointId, 100, { [c.alex.memberId]: 100 })),
    ).rejects.toThrow(/row-level security/);
  });

  it('lets both partners see shared data', async () => {
    const c = await makeCouple();
    await asUser(db, c.alex.userId, (tx) =>
      addExpense(tx, c, c.alex.cardId, 100, { [c.alex.memberId]: 50, [c.sam.memberId]: 50 }),
    );
    const { rows } = await asUser(db, c.sam.userId, (tx) => tx.query(`select * from expenses`));
    expect(rows).toHaveLength(1);
  });

  it('cannot create households or invites without signing in', async () => {
    await expect(db.query(`select create_household('x', 'y')`)).rejects.toThrow(/not signed in/);
  });
});

describe('expense shares', () => {
  it('must add up to the amount', async () => {
    const c = await makeCouple();
    await expect(
      asUser(db, c.alex.userId, (tx) =>
        addExpense(tx, c, c.alex.cardId, 100, { [c.alex.memberId]: 50, [c.sam.memberId]: 40 }),
      ),
    ).rejects.toThrow(/add up to 90 cents, expected 100/);
  });

  it('cannot include someone from another household', async () => {
    const c = await makeCouple();
    const stranger = await createUser(db);
    await asUser(db, stranger, (tx) => tx.query(`select create_household('Theirs', 'Pat')`));
    const pat = await one<{ id: string }>(
      db.query(`select id from members where user_id = $1`, [stranger]),
    );
    await expect(
      db.transaction((tx) => addExpense(tx, c, c.alex.cardId, 100, { [pat.id]: 100 })),
    ).rejects.toThrow(/outside its household/);
  });

  it('cannot be paid from another household’s account', async () => {
    const c = await makeCouple();
    const stranger = await createUser(db);
    await asUser(db, stranger, (tx) => tx.query(`select create_household('Theirs', 'Pat')`));
    const theirJoint = await one<{ id: string }>(
      db.query(`select a.id from accounts a join members m on m.household_id = a.household_id
                 where m.user_id = $1 and a.kind = 'joint'`, [stranger]),
    );
    await expect(
      db.transaction((tx) => addExpense(tx, c, theirJoint.id, 100, { [c.alex.memberId]: 100 })),
    ).rejects.toThrow(/foreign key/);
  });
});

describe('balances', () => {
  it('credits the payer and debits each share', async () => {
    const c = await makeCouple();
    await db.transaction((tx) =>
      addExpense(tx, c, c.alex.cardId, 10_000, { [c.alex.memberId]: 6000, [c.sam.memberId]: 4000 }),
    );
    expect(await balances(c)).toEqual({ [c.alex.memberId]: 4000, [c.sam.memberId]: -4000 });
  });

  it('ignores shared joint-account spending', async () => {
    const c = await makeCouple();
    await db.transaction((tx) =>
      addExpense(tx, c, c.jointId, 5000, { [c.alex.memberId]: 2500, [c.sam.memberId]: 2500 }),
    );
    expect(await balances(c)).toEqual({ [c.alex.memberId]: 0, [c.sam.memberId]: 0 });
    const { rows } = await db.query(`select owed_cents from joint_balances where owed_cents <> 0`);
    expect(rows).toHaveLength(0);
  });

  it('tracks personal purchases from the joint account', async () => {
    const c = await makeCouple();
    await db.transaction((tx) => addExpense(tx, c, c.jointId, 3000, { [c.sam.memberId]: 3000 }));
    const owed = await one<{ owed_cents: number }>(
      db.query(`select owed_cents from joint_balances where member_id = $1`, [c.sam.memberId]),
    );
    expect(Number(owed.owed_cents)).toBe(3000);

    await db.query(
      `insert into settlements (household_id, from_member_id, to_member_id, amount_cents)
       values ($1, $2, null, 3000)`,
      [c.householdId, c.sam.memberId],
    );
    const after = await one<{ owed_cents: number }>(
      db.query(`select owed_cents from joint_balances where member_id = $1`, [c.sam.memberId]),
    );
    expect(Number(after.owed_cents)).toBe(0);
  });

  it('settles up to zero', async () => {
    const c = await makeCouple();
    await db.transaction((tx) =>
      addExpense(tx, c, c.alex.cardId, 8400, { [c.alex.memberId]: 4200, [c.sam.memberId]: 4200 }),
    );
    await db.query(
      `insert into settlements (household_id, from_member_id, to_member_id, amount_cents, method)
       values ($1, $2, $3, 4200, 'venmo')`,
      [c.householdId, c.sam.memberId, c.alex.memberId],
    );
    expect(await balances(c)).toEqual({ [c.alex.memberId]: 0, [c.sam.memberId]: 0 });
  });

  it('skips deleted expenses', async () => {
    const c = await makeCouple();
    const id = await db.transaction((tx) =>
      addExpense(tx, c, c.alex.cardId, 1000, { [c.alex.memberId]: 500, [c.sam.memberId]: 500 }),
    );
    await db.query(`update expenses set deleted_at = now() where id = $1`, [id]);
    expect(await balances(c)).toEqual({ [c.alex.memberId]: 0, [c.sam.memberId]: 0 });
  });
});
