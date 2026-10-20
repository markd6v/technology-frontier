# technology-frontier

Frontier Radar: an overview of recent discoveries and releases across 15 technology domains, taken only from primary sources (journals, curated preprints, lab research posts, official release channels) listed in `content/sources.yaml`. Claude tags each item with topics from `content/topics.yaml` and scores it, and the site ranks items by that score plus how many sources reported them. Scope and design live in [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Local setup

Needs Node 22 and a Postgres 16 install on `PATH` (e.g. `brew install postgresql@16`). The DB runs as a project-local cluster in `.data/pg` on port 54329, so a system Postgres is left alone.

```bash
npm install
cp .env.example .env.local
npm run db:start      # db:stop to shut it down
npm run db:migrate
npm run job ingest -- --force
npm run job assess    # needs ANTHROPIC_API_KEY in .env.local
npm run dev
```

| Command | Does |
|---|---|
| `npm run job hourly` | What the hourly trigger runs: `ingest`, then `assess`, then `rank` |
| `npm run job ingest` | Fetch sources whose `next_due_at` has passed. `-- --force` ignores it; `-- --source=a,b` limits to some ids |
| `npm run job assess` | Tag and score unassessed items with Claude (needs `ANTHROPIC_API_KEY`). `-- --limit=N`; `-- --dry-run` prints results and writes nothing (still billed); `-- --retag` also redoes items from an older prompt version |
| `npm run job rank` | Recompute rank for the last 60 days |
| `npm run job maintenance` | Sync `content/sources.yaml` into the DB and delete items of sources removed from it |
| `npm run validate:content` | Validate all YAML in `content/` |
| `npm test` | Unit and connector tests (recorded fixtures, no network) |
| `npm run db:generate` | New migration after editing `src/lib/db/schema.ts` |

## Adding a source

Add an entry to `content/sources.yaml` (the header comment lists the allowed values and the optional `filter`), then run `npm run validate:content`. Before adding a feed, read its last few dozen titles: if company news, customer stories or commentary outnumber results and releases, filter it by category or title, or leave it out. Connector options are the zod `config` schema in `src/lib/connectors/<method>.ts`. For a `page-monitor`, check that the listing page has the links in its static HTML (`curl` it). Pages that render with JavaScript stay `manual`.

## Deploying

1. Create a Neon project and copy the **pooled** connection string.
2. Import the repo in Vercel. Set `DATABASE_URL`, `CRON_SECRET` and `ANTHROPIC_API_KEY`. The build runs migrations (`vercel.json` → `npm run vercel-build`) and registers the daily crons.
3. In GitHub → Settings → Secrets → Actions, add `APP_URL` (the Vercel URL) and the same `CRON_SECRET`. This enables `.github/workflows/hourly.yml`, which triggers hourly ingestion. Run it once by hand with `force` to fill the database. Each run assesses only as many items as its time budget allows, so the first fill takes a few runs, or run `npm run job assess` locally against the production `DATABASE_URL`.
