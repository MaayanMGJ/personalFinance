# Ours

Shared expenses for couples: an iPhone and web app built with Expo and Supabase.

The v1 plan (spec, screens, data model, milestones) lives in the project's
"Couples expense app: v1 plan" doc.

## What's here

| Path | What it is |
| --- | --- |
| `src/app/` | Screens (Expo Router: every file is a route). |
| `src/components/` | Shared UI building blocks. |
| `src/lib/` | Supabase client, session and household state, money helpers. |
| `src/theme.ts` | Colors, spacing and type scale. |
| `supabase/migrations/` | Database schema, privacy rules and sign-up/pairing functions. |
| `supabase/tests/` | Database tests that run the real migrations in an in-memory Postgres. |

## First-time setup

1. **Install:** `npm install`
2. **Create a Supabase project** at [supabase.com](https://supabase.com) (the free tier is enough).
3. **Apply the database schema:**
   ```sh
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
4. **Send sign-in codes instead of links.** In the Supabase dashboard, go to
   Authentication > Emails, and in both the "Magic Link" and "Confirm signup"
   templates include `{{ .Token }}`. `supabase/templates/magic_link.html` has a
   ready-made version.
5. **Connect the app:** copy `.env.example` to `.env` and fill in the project
   URL and publishable key from Project Settings > API.
6. **Run it:** `npm start`, then scan the QR code with the Expo Go app on your
   iPhone, or press `w` for the web version.

## Checks

```sh
npm test           # money math + database schema, privacy rules and balances
npm run typecheck
```

## Design notes

- **Money is whole cents** everywhere, in the database and in the app.
- **Shares are stored per expense** (`expense_shares`), so changing a split
  rule or an income never rewrites past expenses. The database refuses any
  expense whose shares don't add up to its amount.
- **Built to change:** categories, accounts and split rules are rows the
  couple can add to, rename or archive. Closed lists (account kinds, split
  kinds, bill cadences) are text columns with checks rather than enums, so
  adding a value is a one-line migration. Members are not hard-coded to two:
  `households.max_members` sets the limit.
- **Balances are computed, not stored** (`member_balances` and
  `joint_balances` views), so they can't drift.
- **Privacy:** row-level security limits every table to members of the
  household. Households and members are only created through the
  `create_household` and `join_household` functions.
