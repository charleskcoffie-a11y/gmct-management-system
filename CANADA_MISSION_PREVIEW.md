# Canada Mission Management preview

This preview uses `feature/multi-tenant-canada-mission` and the distinct Vercel project `canada-mission-management-preview`.

## Database and sign-in

- Supabase project: CANADA MISSION PLANNER (`wqdcxqnagftyshqxltec`).
- Management tables and access assignments are in the `cmms` schema.
- Existing planner, hymn, reading, calendar and letter-register tables are not repurposed.
- Supabase Auth handles email and password sign-in. Management permissions live in `cmms.user_access`, independently of planner permissions.
- The existing primary administrator receives the first management Software Administrator assignment. Other users need explicit management access.
- There are no default management passwords and no GMCT member or financial data is copied.

## Preview configuration

Set these variables only on the separate preview project, or in a git-ignored `.env.local` for local testing:

```dotenv
VITE_CANADA_MISSION_PREVIEW=true
VITE_SUPABASE_URL=https://wqdcxqnagftyshqxltec.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_KEY
```

Use the project publishable key, never a service-role or secret key. Management mode is the default on this feature branch. Missing configuration keeps the preview disconnected; starting locally without an environment file never falls back to GMCT. The preview rejects the live GMCT project and pins its connection to the configured project. Its content-security policy permits connections only to its own origin and the selected Supabase project.

```sh
npm ci
npm run dev
```

## Management access

1. Choose a society and sign in with a Canada Mission account.
2. A person can register from this sign-in page if they have no account yet.
3. A management administrator assigns their email, society, role and optional class under **Manage Users**.
4. Planner approval does not grant management access. Management approval does not activate a planner profile.
5. A Software Administrator can manage every society. A Society Administrator manages their own society and cannot grant Software Administrator access.

Management sessions use a separate browser storage key. Changing a password updates the shared account password. Signing out of management clears that management session.

## Database setup history

The scripts are saved for review and reproducibility; do not rerun bootstrap on an initialized schema.

- `sql/cmms_bootstrap.sql`: isolated management tables and society directory.
- `sql/cmms_shared_auth_access.sql`: independent access assignments, RLS and prefixed API views.
- `sql/cmms_preview_compatibility.sql`: attendance and society settings compatibility.

The private credential compatibility tables are not exposed to browser clients. Management API views use `security_invoker`; database policies check the authenticated account, role, selected society and assigned class. Upserts use an invoker RPC with an allowlist of management tables and the underlying table primary key. Existing planner tables cannot be selected as an upsert target.

## Validation

```sh
node --test tests/preview-database.test.mjs tests/management-client.test.mjs
npm run build
```

`tests/cmms-access-verification.sql` checks planner separation, society isolation, upserts and blocked privilege escalation in a transaction that rolls back all test data and assignments.

The repository has pre-existing TypeScript errors outside the new management modules; Vite production builds and the targeted tests are the release checks for this preview.
