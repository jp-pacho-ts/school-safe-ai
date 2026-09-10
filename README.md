# School Safe AI — Basic Competition Version

Phases 1 and 2 provide the project foundation and database. Reporting, teacher dashboards,
notification delivery, status tracking, and the full home page are scheduled for later phases.
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

Open http://localhost:3000. The page is a development placeholder and does not accept reports.

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
then run `npm run db:check`. Skip `db:start` and `db:stop` for an external database.
Environment files are ignored; only `.env.example` is intended to be committed.
Database values are server-only and must not use the `NEXT_PUBLIC_` prefix.

Next.js, Prisma configuration, and the database check load environment files through
`@next/env`, including Next.js's `.env.local` precedence. CLI/database checks default to development mode; set `NODE_ENV=production` explicitly to check a production setup.
Client generation and the placeholder build do not require a running database.
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
| `npm run test:unit` | Run environment tests without a database |
| `npm run test:db` | Run rollback-only database integrity tests |

`npm ci` generates Prisma Client through `postinstall`. Apply migrations separately;
Prisma 7 runs the seed only when explicitly invoked with `npm run db:seed`.

The database check uses Node's `react-server` condition so it can import the same
`server-only` Prisma utility used by the app without weakening that boundary.
Connection checks do not expose a public diagnostic endpoint or print credentials.

## Database model

| Model | Purpose |
| --- | --- |
| `User` | Student, teacher, or admin identity with a unique email |
| `Report` | Unique reference, incident type/date, description, location, anonymity, and current status |
| `ReportStatusHistory` | Ordered status records with an optional actor and internal staff note |
| `Notification` | Recipient/report links, notification type, generic message, and optional `readAt` |

The schema is in [prisma/schema.prisma](prisma/schema.prisma). Report status values
are `SUBMITTED`, `UNDER_REVIEW`, `ACTION_TAKEN`, `RESOLVED`, and `DISMISSED`.
Notification types are `NEW_REPORT` and `STATUS_UPDATED`.
Timestamps use PostgreSQL `TIMESTAMPTZ(3)`. Indexes support report filtering,
ordered histories, recipient notification lists, and unread queries.

Anonymous reports default to `isAnonymous: true` and must have `reporterId: null`.
A database CHECK constraint enforces that rule. Another rejects blank report
references, descriptions, and locations. These custom constraints live in the SQL
migration: use migrations, not `prisma db push`, to reproduce the database.

Deleting a user preserves their reports/history and clears the identity links;
their notifications are removed. Deleting a report removes its history and
notifications. A nonanonymous report may therefore have no reporter after user
deletion. History notes are internal and must not be returned by future public
status lookup. Future status updates should update the report and append history
in the same transaction; that application workflow is not implemented in Phase 2.

## Migrations and demo seed

For a new development database, apply the committed migration and add fixtures:

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
emails use `example.invalid`, and fixed references are only for demonstration;
random, unguessable report reference generation belongs to Phase 4.

Seeding runs in one transaction. Stable IDs and create-only upserts make reruns
safe: missing fixtures are added without duplicating or overwriting existing
records. It never clears tables. The seed refuses `NODE_ENV=production`; these
records are demo data and do not provide authentication or login credentials.

`npm test` runs both unit and database integration checks. Database tests require
a running, migrated development database and roll back all their fixture changes.
Use `npm run test:unit` when checking only environment validation without a database.

## Structure

```text
app/                  App Router layout, global styles, and placeholder page
components/ui/        Reusable shadcn/ui components
lib/                  Shared utilities and server-only environment/Prisma access
prisma/               Domain schema, versioned SQL migration, and fictional demo seed
generated/prisma/     Generated client; ignored and recreated during installation
scripts/              Database lifecycle and connection validation
tests/                Foundation validation tests
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

The relation-loading integration test currently emits a non-failing pg 8 warning
because Prisma issues included relation reads concurrently on a transaction client.
Application calls are awaited and all tests pass. The current dependency range
excludes pg 9; reassess this upstream warning when upgrading Prisma or the driver.

See [PLAN.md](PLAN.md) for the recorded results. This workspace initially had no
`.git` metadata, so review uses direct file inspection until Git is initialized.

Configuration references: [Prisma generation](https://docs.prisma.io/docs/cli/v7/generate),
[shadcn configuration](https://ui.shadcn.com/docs/components-json), and
[Next.js server/client boundaries](https://nextjs.org/docs/app/getting-started/server-and-client-components#preventing-environment-poisoning).