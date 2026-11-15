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

## Society page controls

The Software Administrator can open **Settings → Pages for each society**, select any society and choose its pages. **Basic pages** selects financial records, members, financial reports, weekly history and tax receipts; **All pages** enables every optional page. Neither preset is applied until **Save society pages** is pressed.

Class attendance controls both entry and attendance reports. The same page map filters the navigation and checks pages opened by shortcuts. Home, Settings and Manage Users remain available to their permitted administrator roles. Existing explicit feature choices are preserved; attendance defaults off for a smaller society when it has no saved choice. Newly created societies start with Basic pages.

## Tax receipt approval

Tax receipts start in draft mode for every society in the isolated preview. A Society Administrator or Software Administrator opens **Settings → Tax receipt approval**, enables **official tax receipts**, and saves settings for the current society. This approval is separate from the Tax Receipts page switch. Finance Chairs can read approval but cannot change it. The receipt page refreshes approval when opened, focused, and periodically; PDF downloads recheck the database and fall back to drafts when verification fails. A missing donor mailing address also keeps that donor's receipt in draft mode.

Draft screen and PDF copies use draft references, clearly say **DRAFT - NOT VALID FOR TAX PURPOSES**, omit signature images, and mark continued PDF breakdown pages. Enabling approval does not alter previously downloaded files; generate a new PDF after approval. `sql/cmms_tax_receipt_approval.sql` adds only the management settings flag and preserves the existing admin-only policies and redacted API view.

## Database setup history

The scripts are saved for review and reproducibility; do not rerun bootstrap on an initialized schema.

- `sql/cmms_bootstrap.sql`: isolated management tables and society directory.
- `sql/cmms_shared_auth_access.sql`: independent access assignments, RLS and prefixed API views.
- `sql/cmms_preview_compatibility.sql`: attendance and society settings compatibility.

The private credential compatibility tables are not exposed to browser clients. Management API views use `security_invoker`; database policies check the authenticated account, role, selected society and assigned class. Upserts use an invoker RPC with an allowlist of management tables and the underlying table primary key. Existing planner tables cannot be selected as an upsert target.

## Validation

```sh
node --test tests/preview-database.test.mjs tests/management-client.test.mjs tests/society-pages.test.mjs tests/tax-receipts.test.mjs
npm run build
```

`tests/cmms-access-verification.sql` checks planner separation, society isolation, upserts and blocked privilege escalation in a transaction that rolls back all test data and assignments.

`tests/cmms-tax-receipt-approval.sql` verifies administrator approval and revocation, finance read-only access, and society isolation with all changes rolled back.

The repository has pre-existing TypeScript errors outside the new management modules; Vite production builds and the targeted tests are the release checks for this preview.
