/// <reference types="node" />
// Runs the real migrations against an in-memory Postgres (PGlite) with small
// stand-ins for the parts of Supabase they rely on: auth.users, auth.uid(),
// the authenticated role and the storage tables. No Docker needed.
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS = join(__dirname, '..', 'migrations');

const SUPABASE_STUBS = `
  create role anon nologin;
  create role authenticated nologin;

  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;

  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;

  grant usage on schema auth, storage to anon, authenticated;
`;

const GRANTS = `
  grant usage on schema public to anon, authenticated;
  grant all on all tables in schema public to authenticated;
  grant select on all tables in schema public to anon;
  grant all on storage.objects to authenticated;
`;

export async function freshDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_STUBS);
  for (const file of readdirSync(MIGRATIONS).sort()) {
    if (file.endsWith('.sql')) {
      await db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'));
    }
  }
  await db.exec(GRANTS);
  return db;
}

let userCount = 0;

export async function createUser(db: PGlite): Promise<string> {
  userCount += 1;
  const id = `00000000-0000-4000-8000-${String(userCount).padStart(12, '0')}`;
  await db.query('insert into auth.users (id, email) values ($1, $2)', [id, `user${userCount}@test`]);
  return id;
}

/** Runs `fn` as a signed-in user, with row-level security applied. */
export async function asUser<T>(
  db: PGlite,
  userId: string,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId]);
    await tx.exec('set local role authenticated');
    return fn(tx);
  });
}

export async function one<T = Record<string, unknown>>(
  q: Promise<{ rows: unknown[] }>,
): Promise<T> {
  const { rows } = await q;
  return rows[0] as T;
}
