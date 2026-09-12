# School Safe AI — Basic Competition Version

Phases 1–5 provide the foundation, database, responsive home page, student report
submission with a review step and receipt, and private reference-based status lookup.
Use fictional information for this competition demo. Teacher review, notifications,
authentication, and the dedicated security review remain scheduled for later phases.
[PLAN.md](PLAN.md) is the active progress tracker; [AGENTS.md](AGENTS.md) defines the scope.

## Stack

Next.js 16 App Router, React 19, strict TypeScript, Tailwind CSS 4,
shadcn/ui (new-york), Zod, Prisma 7.10, and PostgreSQL.

## Requirements

- Node.js matching `package.json#engines` (Node 24+ recommended) and npm.
- PostgreSQL installed locally, or a connection URL for your own PostgreSQL database.
- On Windows PowerShell, use `npm.cmd` instead of `npm` if execution policy blocks
  `npm.ps1`. The commands below also work from Command Prompt.

## Quick start with local PostgreSQL

```bash
npm ci
npm run db:start
npm run db:deploy
npm run db:seed
npm run db:check
npm run dev
```

Open http://localhost:3000. The home page links to `/report`, where students can
review and save a fictional report, and `/status`, where a saved reference reveals
only its current status and status history. Successful submission opens
`/report/success` with a reference number. This demo does not provide emergency
help or teacher review.

`db:start` finds PostgreSQL 18 under the standard Windows installation directory,
then checks PATH. Set `PG_BIN` to your PostgreSQL bin directory for another installation.
The command creates an isolated development cluster in `.local/postgres`, bound to
`127.0.0.1:55432`, and creates the `school_safe_ai` database. It does not change the
existing system PostgreSQL service.

On first setup, the helper generates a random password and creates `.env`.
Do not copy `.env.example` first when using this helper: it refuses to overwrite
existing `.env` or `.env.local` files. Credentials and cluster state are saved under
the ignored `.local/` directory. The cluster user is a superuser of this local
development cluster; use a separate appropriately restricted role for deployment.

Use `LOCAL_POSTGRES_PORT` before first setup if port 55432 is occupied.
Subsequent starts reuse the saved settings and preserve `.env`.
Stop the cluster with `npm run db:stop`; start it again with `npm run db:start`.
Both database files and credentials survive stop/start. The helper does not start
automatically after a computer reboot.

## Use an existing PostgreSQL database

Copy `.env.example` to `.env` and replace `DATABASE_URL` with your database URL:

```dotenv
DATABASE_URL="postgresql://USERNAME:PASSWORD@HOST:5432/DATABASE"
```

URL-encode special characters in credentials. Ensure the named database already exists,
then run `npm run db:deploy`, `npm run db:generate`, and `npm run db:check`.
Existing installations must apply the Phase 4 migration before accepting reports.
Skip `db:start` and `db:stop` for an external database.
Environment files are ignored; only `.env.example` is intended to be committed.
Database values are server-only and must not use the `NEXT_PUBLIC_` prefix.

Next.js, Prisma configuration, and the database check load environment files through
`@next/env`, including Next.js's `.env.local` precedence. CLI/database checks default to development mode; set `NODE_ENV=production` explicitly to check a production setup.
Client generation and the application build do not require a running database.
Database access validates the environment with Zod before creating a client.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development application |
| `npm run build` | Generate Prisma Client and build for production |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint with no warnings permitted |
| `npm run typecheck` | Generate Prisma and Next route types, then run TypeScript |
| `npm test` | Run unit and database integration tests against a migrated development database |
| `npm run db:validate` | Validate the Prisma schema |
| `npm run db:generate` | Regenerate the Prisma Client |
| `npm run db:check` | Run a read-only `SELECT 1` through the actual Prisma utility |
| `npm run db:start` | Initialize/start the managed local PostgreSQL cluster |
| `npm run db:stop` | Stop the managed cluster without deleting data |
| `npm run db:migrate` | Create/apply a development migration |
| `npm run db:deploy` | Apply committed migrations |
| `npm run db:status` | Check migration status |
| `npm run db:seed` | Add missing fictional demo fixtures |
| `npm run test:unit` | Run environment, report-input, and status-input validation tests without a database |
| `npm run test:db` | Run database, submission, status-service, and status-route tests with isolated fixtures |

`npm ci` generates Prisma Client through `postinstall`. Apply migrations separately;
Prisma 7 runs the seed only when explicitly invoked with `npm run db:seed`.

The database check uses Node's `react-server` condition so it can import the same
`server-only` Prisma utility used by the app without weakening that boundary.
Connection checks do not expose a public diagnostic endpoint or print credentials.

## Database model

| Model | Purpose |
| --- | --- |
| `User` | Student, teacher, or admin identity with a unique email |
| `Report` | Reference, submission key, incident details, anonymity, optional report-local name, and status |
| `ReportStatusHistory` | Ordered status records with an optional actor and internal staff note |
| `Notification` | Recipient/report links, notification type, generic message, and optional `readAt` |

The schema is in [prisma/schema.prisma](prisma/schema.prisma). Report status values
are `SUBMITTED`, `UNDER_REVIEW`, `ACTION_TAKEN`, `RESOLVED`, and `DISMISSED`.
Notification types are `NEW_REPORT` and `STATUS_UPDATED`.
Timestamps use PostgreSQL `TIMESTAMPTZ(3)`. Indexes support report filtering,
ordered histories, recipient notification lists, and unread queries.

Anonymous reports default to `isAnonymous: true` and must have both `reporterId`
and `reporterName` set to null. A database CHECK constraint enforces that rule.
Another rejects blank report references, descriptions, and locations. These custom
constraints live in SQL migrations: use migrations, not `prisma db push`, to reproduce them.

The additive Phase 4 migration adds nullable `reporterName` and unique UUID
`submissionKey` columns while preserving existing reports. Public submissions never
link a user account; a supplied name is unverified and belongs only to that report.

Deleting a user preserves their reports/history and clears the identity links;
their notifications are removed. Deleting a report removes its history and
notifications. A nonanonymous report may therefore have no reporter after user
deletion. History notes are internal and are never returned by public status
lookup. Future status updates should update the report and append history
in the same transaction; staff status updates remain a later-phase workflow.

## Migrations and demo seed

For a new development database, apply the committed migrations and add fixtures:

```bash
npm run db:deploy
npm run db:generate
npm run db:seed
npm run db:status
```

For future schema changes, use `npm run db:migrate -- --name descriptive_name`.
To review/customize SQL before applying it, add `--create-only`, edit the new
unapplied migration, then run `npm run db:deploy`. Generate the client explicitly
after schema changes. Do not edit migrations that have already been applied.

The fictional seed contains 4 users, 5 reports (one per status), 13 history entries,
and 7 notifications. Three reports are anonymous and two link to the demo student.
Both read and unread notifications are included. Fixture IDs start with `demo-`,
emails use `example.invalid`, and fixed references are only for demonstration.
New form submissions receive randomly generated references.

Seeding runs in one transaction. Stable IDs and create-only upserts make reruns
safe: missing fixtures are added without duplicating or overwriting existing
records. It never clears tables. The seed refuses `NODE_ENV=production`; these
records are demo data and do not provide authentication or login credentials.

`npm test` runs environment, report-validation, database integrity, submission,
status lookup, and HTTP route checks. The current suite has 61 passing tests.
Database tests require a running, migrated development database and use rollback-only
or exact random fixtures. Use `npm run test:unit` for validation without a database.

## Structure

```text
app/                  App Router home, reporting/receipt, status pages, and reports APIs
components/home/      Landing-page styles, mobile navigation, and school illustration
components/reports/   Interactive report form, receipt control, and status timeline
components/ui/        Reusable shadcn/ui components
lib/                  Shared utilities and server-only environment/Prisma access
lib/reports/          Shared validation plus server-only submission and status services
prisma/               Domain schema, versioned SQL migrations, and fictional demo seed
generated/prisma/     Generated client; ignored and recreated during installation
scripts/              Database lifecycle and connection validation
tests/                Validation, database, submission, status, and HTTP route tests
public/               Static assets from the initial scaffold
prisma.config.ts       Prisma CLI and environment configuration
components.json       shadcn/ui configuration
.env.example          Safe environment template
PLAN.md               Active implementation plan and validation record
```

Import the database client from `@/lib/prisma` only in server code. The client is
cached during development to avoid new pools on every hot reload; it does not log
queries. Import `cn` from `@/lib/utils` for Tailwind class composition.
Add UI primitives as needed with `npx shadcn@latest add <component>`.

## Home page

The landing page includes the project purpose, reporting workflow, safety guidance,
a report CTA, and footer links. Reporting CTAs open `/report`, while header, hero,
and footer links make `/status` discoverable. The page clearly identifies the
competition demo and the teacher workflow still to come.

The page uses server-rendered content, a small client navigation disclosure, scoped
responsive styles, local SVG art, and system fonts. It includes a skip link, visible
focus indicators, accessible navigation labels, and Escape-to-close menu behavior.
The narrow-screen CTA can wrap to accommodate small screens and enlarged text.

The Phase 3 text-contrast and responsive/accessibility source reviews are recorded
in PLAN.md. Browser rendering and actual keyboard/mobile interaction still need
verification because no browser was available in the development session.

## Student reporting

`/report` provides incident type, description (10–5,000 trimmed characters), location
(1–200), incident date, and an anonymous option selected by default. Turning anonymity
off requires a self-provided name of at most 100 characters; this does not create or
identify an account. The form offers a review/edit step before the final submission.

The shared Zod schema runs in the form and again on the server. It rejects unknown
fields, malformed values, impossible dates, and NUL characters that PostgreSQL cannot
store. Anonymous names are removed from validated output. Incident dates remain
`YYYY-MM-DD` calendar dates and are stored at UTC midnight. Dates must be on or after
1900-01-01 and no later than the current UTC date plus one day, allowing for students
ahead of UTC.

`POST /api/reports` accepts same-origin JSON with a 32 KiB (32,768-byte) body limit.
The service generates an `SSA-` reference with 112 random bits and saves the report
in `SUBMITTED` status together with its initial history entry in one atomic nested
write. Callers cannot supply account IDs, references, status, or history. Validation
and database failures return readable messages without exposing report content or
internal errors.

Each form receives a random UUID submission key. Retrying the same key and normalized
details returns the existing reference without creating another report or history
entry. Reusing that key with different details returns a conflict and preserves the
original report. After an uncertain response, keep the page open and retry the same
details; reloading starts a new form.

A successful response sets a one-hour `HttpOnly`, `SameSite=Strict` receipt cookie,
scoped to `/report/success` and marked `Secure` in production. It contains the
submission key, not report content. The receipt page reads only the reference number
and offers a copy control; refreshing it does not resubmit the report. An expired or
missing cookie cannot display a receipt. Save the reference privately.

Reports are stored and their public-safe status can be checked, but teacher review,
notification delivery, and authentication are not implemented. Those workflows and
the dedicated security review remain later phases. Use fictional demo data; this is
not an emergency service.

## Report status

`/status` accepts either a generated `SSA-` reference or one of the fixed fictional
`DEMO-*` references. Input is trimmed and normalized to uppercase. The client and
server both validate the exact supported formats, and stale results are cleared when
the reference changes. The page includes pending, validation, not-found, connection,
and unavailable states; a current-status card; the standard or dismissed timeline;
and a chronological history list.

`POST /api/reports/status` accepts same-origin JSON with a 1 KiB body limit. POST is
intentional: the private reference does not appear in a URL, browser history, or
referrer. Responses are marked `no-store`, `noindex`, and `no-referrer`. Database
lookup uses an explicit selection that returns only the reference, current status,
and ordered `{ status, changedAt }` events. Incident data, anonymity, reporter data,
submission keys, internal IDs, staff identities, history notes, and notifications
are never selected or serialized. Unknown references receive a generic response;
database failures are masked.

The reference acts like a private receipt: anyone who has it can view this limited
status information. Fixed `DEMO-*` references are intentionally guessable and contain
fictional data only. New reports remain `SUBMITTED` until the Phase 6 teacher workflow
can update the report and append a history entry atomically.

## Dependency maintenance

Prisma and its PostgreSQL adapter/client are aligned at 7.10.0. Two overrides are
scoped to that version to fix advisories in Prisma tooling: `deepmerge-ts@8.0.2`
for `@prisma/config` and `mysql2@3.24.4` for the CLI.
The deepmerge update matches [Prisma's upstream v7 fix](https://github.com/prisma/orm/pull/30189);
the [MySQL driver update](https://github.com/sidorares/node-mysql2/releases/tag/v3.24.4)
stays within major version 3. The app continues to use PostgreSQL only.
Reassess the overrides when upgrading Prisma.

## Validation

```bash
npm run lint
npm run typecheck
npm test
npm run db:validate
npm run db:check
npm run build
```

Phase 5 validation passed: lint, TypeScript, all 61 tests, Prisma validation and
connection checks, production build, and live HTTP status/success/not-found/origin
checks. Browser interaction and responsive rendering for Phases 4–5 remain pending
because no browser was available.

The relation-loading integration test currently emits a non-failing pg 8 warning
because Prisma issues included relation reads concurrently on a transaction client.
Application calls are awaited and all tests pass. The current dependency range
excludes pg 9; reassess this upstream warning when upgrading Prisma or the driver.

See [PLAN.md](PLAN.md) for the recorded results. Review uses Git diff for tracked
changes and direct inspection of newly created files and local planning documents.

Configuration references: [Prisma generation](https://docs.prisma.io/docs/cli/v7/generate),
[shadcn configuration](https://ui.shadcn.com/docs/components-json), and
[Next.js server/client boundaries](https://nextjs.org/docs/app/getting-started/server-and-client-components#preventing-environment-poisoning).
