# Vercel Deployment

## Project

- Framework preset: Next.js
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: leave empty / Vercel default for Next.js
- Vercel project: `panloppim-8780s-projects/pcon-superapp`
- Production URL: `https://pcon-superapp.vercel.app`

## Required Environment Variables

Set these in Vercel Project Settings > Environment Variables for Production and Preview:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-publishable-or-anon-key
SUPABASE_SECRET_KEY=your-server-only-supabase-secret-key
# Optional legacy name; use this instead of SUPABASE_SECRET_KEY, not both.
# SUPABASE_SERVICE_ROLE_KEY=your-server-only-supabase-service-role-key
PCON_CLOUD_SYNC_TOKEN=change-this-long-random-sync-token
```

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are public browser config.
`SUPABASE_SECRET_KEY` or the legacy `SUPABASE_SERVICE_ROLE_KEY`, plus `PCON_CLOUD_SYNC_TOKEN`, are server-only values used by the Next.js API routes. Configure exactly one server key name.
Do not expose `SUPABASE_SECRET_KEY`, `service_role`, or any `sb_secret_...` value in client code.

## Local Setup

Create `.env.local` on your machine only:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-publishable-or-anon-key
SUPABASE_SECRET_KEY=your-server-only-supabase-secret-key
# Optional legacy name; use this instead of SUPABASE_SECRET_KEY, not both.
# SUPABASE_SERVICE_ROLE_KEY=your-server-only-supabase-service-role-key
PCON_CLOUD_SYNC_TOKEN=change-this-long-random-sync-token
```

Then verify before deploying:

```bash
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e
```

## Deploy Paths

## Supabase Setup

1. Open the new Supabase project.
2. In Settings > API Keys, copy:
   - Project URL
   - Publishable key or legacy anon key
   - Secret key `sb_secret_...`
3. Open SQL Editor.
4. Run the full SQL in `supabase/project-control-schema.sql`.
5. Run `supabase/20260716_storage_security_hardening.sql` to add company/member/project RLS policies, indexes, grants, and company-parent relationship guards. This migration is idempotent, keeps existing rows, and does not delete data (ไม่ลบข้อมูลเดิม). Relationship constraints are `NOT VALID` so legacy rows remain intact while new writes are protected.
6. If the existing database uses text IDs, run `supabase/cloud-sync-schema-compatibility-text-ids.sql` instead of UUID-only compatibility changes, then apply a matching text-ID security review before enabling direct client access.
7. Run `notify pgrst, 'reload schema'` in the SQL Editor after all DDL, then confirm these tables exist: `companies`, `company_members`, `projects`, `boq_categories`, `boq_items`, `daily_reports`, `daily_report_workers`, `daily_report_progress_updates`, `hr_crews`, `hr_labor_expenses`, and `buyin_entries`.

Cloud Sync remains local-first: the browser saves localStorage before calling `/api/cloud-sync/push`; a cloud error never removes the local snapshot. The migration protects authenticated direct access, while the server API continues using the server-only key. Admin member/project APIs are company-bound, and member sync/load is filtered by assigned projects and access sections.

The default Phase 1 company id is `local-company-owner`, which is a text id. A fresh local workspace therefore requires the text-id compatibility schema, or a separate UUID company-provisioning/mapping step, before syncing into UUID columns. Do not force a text id into a UUID table; the diagnostics will recommend the compatible patch when this mismatch is detected.

## Vercel Environment Setup

Vercel CLI prompts for the value after each command. Add production and preview values:

```powershell
$env:NODE_OPTIONS="--use-system-ca"

npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
npx vercel env add SUPABASE_SECRET_KEY production
npx vercel env add PCON_CLOUD_SYNC_TOKEN production

npx vercel env add NEXT_PUBLIC_SUPABASE_URL preview
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview
npx vercel env add SUPABASE_SECRET_KEY preview
npx vercel env add PCON_CLOUD_SYNC_TOKEN preview
```

Use a long random value for `PCON_CLOUD_SYNC_TOKEN`. The app asks for this token the first time a user runs Sync Cloud or Load Cloud, then stores it in localStorage.

Recommended Git deploy:

1. Push the repo to GitHub.
2. Import the repo in Vercel.
3. Select the Next.js framework preset.
4. Add the Supabase environment variables above.
5. Deploy.

Manual CLI deploy:

```bash
npx vercel
npx vercel --prod
```

On this Windows machine, if Vercel CLI reports `unable to verify the first certificate`,
run commands with:

```powershell
$env:NODE_OPTIONS="--use-system-ca"
npx vercel deploy --prod
```
