# technology-frontier

Frontier Radar: an overview of recent discoveries and releases across 15 technology domains, taken only from primary sources (journals, curated preprints, lab research posts, official release channels) listed in `content/sources.yaml`. Scope and design live in [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Local setup

Needs Node 22 and a Postgres 16 install on `PATH` (e.g. `brew install postgresql@16`). The DB runs as a project-local cluster in `.data/pg` on port 54329, so a system Postgres is left alone.

```bash
npm install
cp .env.example .env.local
npm run db:start      # db:stop to shut it down
npm run db:migrate
npm run job ingest -- --force
npm run dev
```

| Command | Does |
|---|---|
| `npm run job ingest` | Fetch sources whose `next_due_at` has passed. `-- --force` ignores it; `-- --source=a,b` limits to some ids |
| `npm run job maintenance` | Sync `content/sources.yaml` into the DB and delete items of sources removed from it |
| `npm run validate:content` | Validate all YAML in `content/` |
| `npm test` | Unit and connector tests (recorded fixtures, no network) |
| `npm run db:generate` | New migration after editing `src/lib/db/schema.ts` |

## Adding a source

Add an entry to `content/sources.yaml` (the header comment lists the allowed values and the optional `filter`), then run `npm run validate:content`. Before adding a feed, read its last few dozen titles: if company news, customer stories or commentary outnumber results and releases, filter it by category or title, or leave it out. Connector options are the zod `config` schema in `src/lib/connectors/<method>.ts`. For a `page-monitor`, check that the listing page has the links in its static HTML (`curl` it). Pages that render with JavaScript stay `manual`.

## Deploying

1. Create a Neon project and copy the **pooled** connection string.
2. Import the repo in Vercel. Set `DATABASE_URL` and `CRON_SECRET`. The build runs migrations (`vercel.json` → `npm run vercel-build`) and registers the daily crons.
3. In GitHub → Settings → Secrets → Actions, add `APP_URL` (the Vercel URL) and the same `CRON_SECRET`. This enables `.github/workflows/hourly.yml`, which triggers hourly ingestion. Run it once by hand with `force` to fill the database.
