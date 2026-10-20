# Technology Frontier Radar — Requirements

Status: draft v0.5 (2026-10-20). v0.5 replaces Phase 1's triage-then-extract funnel with one assessment pass over every item (tags, scores, rank). v0.4 changes the goal from spotting commercial opportunities to a high-quality overview of recent discoveries, and replaces the starter sources with primary sources only. v0.3 dropped the daily brief. The current build is Phase 0 (sources + website) plus Phase 1's assessment and ranking. Turns the "Technology Frontier Intelligence" research brief into something buildable. The decisions from v0.1's open questions are recorded in §11.

---

## 1. Problem and goal

One person (the owner, a software engineer) wants a **high-quality overview of recent discoveries and developments** across technology: what became possible, how strong the evidence is, and how it builds on earlier work. Reading every journal, lab blog and release channel by hand doesn't scale, and general tech news buries the actual results under business and company coverage.

The site collects new items from a fixed set of primary sources, sorts them by domain and layer, and shows them as a browsable, filterable feed. Later phases add LLM enrichment, a weekly overview of developments and a monthly review of where each field stands.

**Source policy:** only primary sources — peer-reviewed journals, curated preprints, lab research posts and official release channels. No general tech news, commentary, business, funding or market coverage. Where a primary source mixes in other posts (customer stories, partnerships, policy), the registry filters them out by feed category or title.

**Success, measured after 4 weeks of real use:**
- The owner checks the site on at least 15 of 20 working days, and catching up on a domain takes ≤15 minutes.
- From Phase 1: at least 70% of assessed items in the Top lists are rated "worth seeing" (thumbs up/down on each item).
- At least 3 weekly overviews each produce one development the owner reads in full at the original source.
- Every claim in every output links to its original source.

**It is not:**
- A public news site, a social product, or a multi-user SaaS.
- A business, investment or market-intelligence tool. Scores rank what to read next; they are not forecasts.
- A news aggregator. Coverage *about* technology companies is out of scope; only the results and releases themselves.
- A scraper of sites that forbid it (X/Twitter, LinkedIn, paywalled journals).

## 2. Users

| User | Needs |
|---|---|
| Owner (only signed-in user) | Browse the site (often on a phone), browse the raw feed, rate items, add/disable sources, write notes on trends |
| Visitor (anonymous) | Read public pages only |
| Scheduler (system) | Run ingestion and report generation on a timer with no manual steps |

**Access model: public, read-only.**
- Anyone with the URL can read: the feed, domain/source/people pages, published reports, trends.
- Only the owner, signed in, can write: ratings, notes, trend merge/split/dismiss, score overrides, enabling sources. Anything written goes through an authenticated server action. Visitors have no write endpoints at all.
- Owner sign-in is a single password stored as an env var (hashed comparison) with a long-lived, `HttpOnly`, `Secure` session cookie. Failed attempts are rate-limited.
- Private to the owner (never rendered for visitors): owner notes, ratings, LLM cost figures, the source-usefulness report.
- Cron/job endpoints need a secret header. They are not reachable as public pages.
- Every page sends `noindex` by default, so the site doesn't get indexed as a news aggregator. Can be changed later.

**Content rule (because it's public):** never republish full article or paper text. Show the title, author/source, date, an excerpt of at most ~300 characters (or the abstract where the source licenses it, e.g. arXiv metadata), the LLM-written summary, and a prominent link to the original. Paywalled sources show only the title and link.

## 3. Core concepts (glossary)

| Term | Meaning |
|---|---|
| **Domain** | One of the 15 technology areas (AI, Computing infra, Software infra, Robotics, Biotech, Semiconductors, Energy generation, Energy storage, Materials, Quantum, Space, Neurotech, Security, Financial infra, Communications), plus the cross-domain tags (AI+bio, AI+robotics, …) |
| **Coverage tier** | `deep` (AI, Computing, Software, Robotics): reviewed daily. `regular` (Biotech, Semis, Energy gen, Storage, Security, Fintech): weekly. `broad` (Materials, Quantum, Space, Neuro, Comms): weekly summary plus monthly deep dive. Since v0.5 every tier is assessed (§4 Phase 1); tiers set how often a domain is reviewed in reports. |
| **Layer** | Where an item sits: `scientific` (newly possible), `engineering` (reproducible, open, practical to build on), `product` (released for people to use) |
| **Source** | One feed or endpoint, e.g. "arXiv cs.RO" |
| **Item** | One raw entry fetched from a source: paper, post, release, trial, repo |
| **Assessment** | The LLM's one-pass reading of an item: relevance, domains, topic tags, contribution type, the §7 scores and a one-line takeaway (§6.2) |
| **Topic** | A tag from the fixed list in `content/topics.yaml`, grouped by domain |
| **Development** | A top-ranked item enriched by the LLM with structured fields (§6.3) |
| **Trend** | A cluster of developments about the same capability, observed over time across several sources and layers |

## 4. Scope by phase

Each phase ships something usable on its own. Don't start a phase until the one before it meets its acceptance criteria.

### Phase 0 — Registry + feed reader (no LLM)
- Source registry stored in the repo as data (YAML/JSON), covering the starter sources in §5.1, each with an optional item filter.
- Reference pages built from the research brief: the 15 domains (subfields, signals to watch, research/product/people lists) and the people list with links.
- Scheduled ingestion for every starter source that has a working feed or API.
- **Page monitors** for the starter sources that have no feed: Anthropic (research and releases), Physical Intelligence and imec (ARPA-E needs JavaScript, so it stays manual). A monitor:
  - is set up per source in the registry: list-page URL, a CSS selector for item links, an optional selector for the date, and an allowed URL prefix.
  - fetches the page at most once a day and records links it hasn't seen before as new items. The item's own page is fetched once, to get its title, date and meta description.
  - fails loudly. If the selector matches 0 links, or the link count drops by more than 80% from the last run, it records a health error and creates no items (protects against markup changes).
  - fetches static HTML only, no headless browser. A site that needs JavaScript to render stays manual.
- Feed page: newest items first. Filter by domain, layer, source type and source. Text search over title and summary.
- Health page for each source: last successful fetch, last error, items fetched in the last 7 days.
- Owner sign-in (§2) is deferred to Phase 1: Phase 0 has nothing for the owner to write.

**Acceptance:**
- 20 of the 24 starter sources ingest automatically (16 feeds/APIs + 4 page monitors). The 4 manual ones show up as "manual check" links.
- Items a source's filter rejects are never stored.
- Adding a source means a data change and nothing else (no code).
- Items are deduplicated by canonical URL (and by DOI/arXiv ID where one exists).
- One failing source never blocks the others.

### Phase 1 — Assessment, ranking, extraction
- **Assessment (built):** every new item, in every tier, goes to Claude once, 20 items per request: title, source, first authors and the abstract (up to ~1500 characters) or excerpt. It returns, per item: relevant or not, 1–3 domains, 1–4 topics from `content/topics.yaml` (plus up to 2 proposed new topics, stored for the owner to review), contribution type, released artifacts, the five §7 scores, a takeaway of at most 25 words and a short rationale. The assessment's domains replace the source's on the item; the source's are kept.
  - At ~30 items/day one pass over everything is cheap, so the earlier small-model triage step is dropped and extraction only uses the rank.
- **Ranking (built):** quality (§7) plus corroboration, Hugging Face upvotes and source priority, minus a penalty for off-topic items (§7). Recomputed hourly for the last 60 days, since signals keep changing.
- **Extraction (not built yet):** the Development fields (§6.3) for the top ~15–25 ranked items per day.
- **Budget enforcement (built):** a hard cap of **$20/month**, enforced in code. Spend is recorded per call from the API's token usage. A call goes ahead only if, at its worst-case cost, the month stays under the cap and today stays under 1.5 × (remaining budget ÷ days left in the month). Otherwise LLM steps stop until the allowance resets; items stay in the feed unassessed, and the sources page shows how many. The 80% alert email is not built yet.
- Feed: Newest/Top sorting (Top within a week, a month or all time) and a topic filter. Not-relevant items stay visible, dimmed and ranked low.
- Thumbs up/down on each item, stored for tuning later. Owner only, so it waits for sign-in.

**Acceptance:**
- ≥95% of new items are assessed within 2 h of ingestion.
- Every enriched item shows its source link.
- A company's claim is always labelled as a claim unless an independent source backs it up.
- LLM spend for the month never goes over $20. A test with a simulated cap proves that LLM calls stop and the feed keeps updating.

### Phase 2 — Trends, scoring, weekly report
- Embed developments and cluster them into trends. A trend keeps a timeline of its developments, tagged by layer and source.
- Trend detection rules (to start with): ≥3 developments from ≥2 independent sources within 90 days, *or* a development has moved up a layer (for example a paper followed by a repo or product).
- Score with the rubric in §7 and rank trends by it.
- Weekly overview sections: top results, notable releases, emerging trends, surprises (results that contradict earlier ones), and what to read in full.
- The owner can merge, split, rename or dismiss trends, and add notes.

**Acceptance:**
- Hand-test on seeded history: the system links ≥3 items about the same capability that use different wording into one trend.
- The weekly overview generates on schedule and lists ≤5 developments to read in full.

### Phase 3 — Early-signal mechanisms + monthly state of the field
- **Acceleration tracking:** publication counts per concept over time (OpenAlex), new-repo and star/contributor growth (GitHub API), package downloads (PyPI Stats, npm). Ranked by growth rate, not absolute size.
- **Emerging researchers:** OpenAlex authors whose citations from independent groups are rising quickly in small concepts.
- **Replication tracking:** a flag on trends where a lab's claim has, or still hasn't, been reproduced by an independent group or benchmark.
- Monthly review per domain: the most significant developments, what changed compared with 6–12 months earlier, what is still unsolved, and which claims still lack independent evidence.
- A per-source usefulness report: which sources produced items the owner rated up. Used to prune or expand sources.

## 5. Sources

### 5.1 Starter set (Phase 0), checked on 2026-10-18

| # | Source | Domain | Layer | Method | Filter |
|---|---|---|---|---|---|
| 1 | Hugging Face Daily Papers | AI | scientific | JSON API | 20+ upvotes |
| 2 | OpenAI Research | AI | scientific | RSS (`openai.com/news/rss.xml`) | categories Research, Publication |
| 3 | OpenAI Releases | AI | product | RSS (same feed) | categories Product, Release, Engineering, API; drops ads, pricing, partnerships, sector editions |
| 4 | Anthropic Research | AI | scientific | Page monitor (`/research`) | drops team pages |
| 5 | Anthropic Releases | AI | product | Page monitor (`/news`) | only launch posts ("Introducing…", model names) |
| 6 | Google DeepMind | AI/Robotics | scientific | RSS | drops partnership and policy posts |
| 7 | Google Research | AI/Compute | scientific | RSS | — |
| 8 | Hugging Face Blog | AI | engineering | RSS | — |
| 9 | Artificial Analysis | AI | engineering | Manual | Independent model benchmarks |
| 10 | LWN.net | Software | engineering | RSS | drops routine security-update and admin posts |
| 11 | Google Project Zero | Security | scientific | Atom | — |
| 12 | Semiconductor Engineering — technical papers | Semis/Compute | scientific | RSS (technical-papers category) | — |
| 13 | imec | Semis | scientific | Page monitor (homepage `/en/press/` links) | drops business announcements |
| 14 | Nature Electronics | Semis | scientific | RSS | drops corrections |
| 15 | Science Robotics | Robotics | scientific | RSS | — |
| 16 | Physical Intelligence | Robotics | scientific | Page monitor | — |
| 17 | Robotics: Science and Systems | Robotics | scientific | Manual (yearly) | — |
| 18 | Nature Biotechnology | Biotech | scientific | RSS | drops corrections and regulatory news |
| 19 | Nature Biomedical Engineering | Biotech/Neuro | scientific | RSS | drops corrections |
| 20 | Nature Energy | Energy gen/storage | scientific | RSS | drops corrections and policy pieces |
| 21 | ARPA-E | Energy | scientific | Manual | List renders with JavaScript |
| 22 | Nature Materials | Materials | scientific | RSS | drops corrections |
| 23 | npj Quantum Information | Quantum | scientific | RSS | drops corrections |
| 24 | Stanford Emerging Tech Review | Broad | scientific | Manual (yearly) | — |

Totals: **16 feed/API**, **4 page monitor**, **4 manual**. Exact endpoints and filter patterns live in `content/sources.yaml`.

Also confirmed reachable, for Phase 3: OpenAlex API, GitHub API, PyPI Stats API, npm downloads API.

### 5.2 Source registry fields

| Field | Type | Example |
|---|---|---|
| `id` | slug | `arxiv-cs-ro` |
| `name` | string | arXiv cs.RO |
| `domains` | list | `[robotics]` |
| `layer` | enum | `scientific` |
| `kind` | enum | `research` / `release` / `benchmark` / `press` |
| `method` | enum | `rss` / `atom` / `json-api` / `page-monitor` / `manual` |
| `endpoint` | url | |
| `homepage` | url | |
| `frequency` | enum | `hourly` / `daily` / `weekly` / `yearly` |
| `config` | object | connector options (feed URL, page-monitor selectors, HF upvote floor) |
| `filter` | optional | `categories`, `includeTitle`, `excludeTitle`, `excludeUrl`; applied to every item before storage |
| `reliability` | note | "high provenance; claims vary" |
| `priority` | 1–3 | |
| `enabled` | bool | |

### 5.3 Later sources (not v1)
Other primary sources from the brief go into the registry with `enabled: false` and are switched on in batches, each checked first for how much of its output is actual results or releases. Collection rules:
- **People:** use the person's blog RSS if they have one (for example Simon Willison, Karpathy, Scott Aaronson, Martin Kleppmann, Matthew Green, Vitalik Buterin, Dwarkesh Patel). Otherwise follow their papers through their OpenAlex author ID (Phase 3). No X/Twitter ingestion.
- **Business data** (funding, hiring, startup databases, market news): out of scope.
- **Podcasts/video:** out of scope in v1. Maybe later via show-notes RSS.

## 6. Data model

### 6.1 Item (raw)
`id, source_id, url, canonical_url, external_id (DOI/arXiv/NCT), title, authors, published_at, fetched_at, summary/abstract, raw_payload, content_hash`

### 6.2 Assessment
`item_id, relevant (bool), domains[], topics[], proposed_topics[], contribution, artifacts[], novelty, magnitude, evidence, breadth, maturity (1–5 each), quality (0–100), takeaway, rationale, model, prompt_version, llm_call_id`

### 6.3 Development (enriched)
| Field | Notes |
|---|---|
| technology / subfield | from the domain taxonomy |
| claim | what supposedly changed, in one sentence |
| previous_limitation | |
| new_capability | |
| quantitative_improvement | number + unit + baseline, or null. Never invented |
| evidence_type | `paper` / `preprint` / `benchmark` / `code` / `independent-test` / `product` / `deployment` / `trial` |
| claim_status | `self-reported` / `independently-verified` |
| maturity | `research` / `prototype` / `product` / `deployment` |
| significance | what it makes possible that wasn't before, short text |
| confidence | 1–5, with a one-line reason |
| evidence_links | list of URLs, at least the source item |

### 6.4 Trend
`id, name, description, domains, development_ids (timeline), first_seen, last_seen, layer_progression, scores (§7), owner_notes, status (watching / reading / dismissed)`

### 6.5 Feedback
`target (item/development/trend), rating (+1/−1), note, created_at`

## 7. Scoring

Each dimension is scored 1–5 by the LLM for every item (§4 Phase 1), with one short rationale for all five. Owner overrides come with sign-in.

| Dimension | Weight |
|---|---|
| Novelty | 25% |
| Magnitude | 25% |
| Evidence | 25% |
| Breadth | 15% |
| Maturity | 10% |

`quality = Σ (weight × (s − 1) / 4) × 100`, which maps all-1s to 0 and all-5s to 100. Commercial potential is deliberately not a dimension.

**Rank** (what "Top" sorts by) = quality, or a neutral value before assessment, + a bonus per further source that reported the item (capped) + up to a fixed bonus from Hugging Face upvotes (log scale) + a source-priority adjustment − a penalty if the item isn't relevant. Weights and bonuses live in `content/config.yaml`, not code.

## 8. Pages

| Page | Phase | Contents |
|---|---|---|
| Home | 0 | Latest items per deep-tier domain, plus source health at a glance |
| Feed | 0 | All items, with filters (domain, layer, kind, source, date) and search |
| Domain `/d/{slug}` | 0 | Subfields, signals to watch, research/product/people lists, recent items, trends (P2) |
| Sources | 0 | Registry table plus health status |
| People | 0 | Specialists and cross-disciplinary thinkers, with links and feeds |
| Overviews archive | 2 | Weekly / monthly overviews by date |
| Trends | 2 | Ranked list, trend detail with timeline |

Must work at phone width (the owner reads it on a phone). Owner-only controls (ratings, notes, trend edits, cost figures) appear only when signed in. Visitors see the same pages without them.

## 9. Non-functional

- **Schedule** (all times Asia/Dubai, UTC+4):
  - Feed/API sources: hourly for `hourly`, otherwise once a day at 02:00.
  - Page monitors: once a day at 02:00.
  - Assessment and ranking run hourly after ingestion (Phase 1). Extraction, once built, is submitted once a day. Vercel Hobby cron fires anywhere in the scheduled hour; see ARCHITECTURE §9.
  - Weekly overview: Saturday 08:00. Monthly overview: 1st of the month at 08:00.
- **Politeness:** respect robots.txt and rate limits. Identify with a User-Agent. Back off on errors.
- **Traceability:** store the prompt version and model with every LLM output, so outputs can be re-run when prompts change.
- **Idempotent ingestion:** re-running a fetch never creates duplicates. A job that times out partway can be run again safely.
- **Serverless limits:** no single job invocation fetches every source. Ingestion processes a batch of sources per call and keeps a cursor, so each call fits inside the platform's function timeout.
- **Cost visibility:** LLM spend per day and month to date, shown to the owner on the health page.
- **Retention:** keep raw items forever. They're small, and keeping them makes the 6–12-month comparisons possible. The exception is a source removed from the registry: its items are pruned (ARCHITECTURE §5.5).
- **Secrets** (env vars only, never in the repo): DB URL, Anthropic API key, email API key, owner password hash, session secret, cron secret, GitHub token, owner email address.

## 10. Tech stack

- **App:** Next.js (TypeScript, App Router), server-rendered, deployed on **Vercel**.
- **DB:** **Neon** Postgres with the `pgvector` extension (embeddings are needed from Phase 2). Migrations live in the repo.
- **Jobs:**
  - Daily/weekly/monthly jobs: Vercel Cron calling protected route handlers.
  - Hourly ingestion: a scheduled GitHub Actions workflow calling the same protected endpoint. Vercel Cron's frequency limit depends on the plan, so check it when setting up. GitHub's scheduled runs can start several minutes late, so nothing time-critical depends on them.
- **LLM:** Claude API through the official TypeScript SDK. Claude Opus 5.5 at low effort for assessment (~$6–8/month at current volume); the model id is in `content/config.yaml`.
- **Email (alerts only):** a transactional email API (Resend proposed: it has a simple Node SDK and a free tier). Needs a verified sending domain or the provider's test sender.
- **Registry and domain content:** YAML files in the repo, so edits are reviewable in git. At deploy time they are validated against a schema.

## 11. Decisions (2026-10-18)

| # | Question | Decision |
|---|---|---|
| 1 | Hosted or local? | Hosted on Vercel + Neon, so the owner can read on a phone |
| 2 | LLM budget | Hard cap of $20/month, with the funnel and fallback in Phase 1 |
| 3 | Daily brief | Dropped (2026-10-18). Email is used only for alerts; times are Asia/Dubai |
| 4 | Feedless starter sources | Build page monitors (Anthropic, Physical Intelligence, imec). ARPA-E stays manual because it renders with JavaScript |
| 5 | bioRxiv / ClinicalTrials.gov | Dropped (2026-10-18): raw preprint and trial-registry streams were mostly noise. Peer-reviewed journals cover biotech instead |
| 6 | Broad-tier domains | Registry and feed only until Phase 2. No LLM triage. Superseded by #10: every tier is assessed |
| 7 | Access | Public, read-only. Owner signs in with a single password to write |
| 8 | Goal | (2026-10-18) A high-quality overview of recent discoveries and developments, not commercial opportunity spotting. The commercial layer, opportunity report and business-oriented scoring dimensions are removed |
| 9 | Sources | (2026-10-18) Primary sources only. Dropped: Hacker News, GitHub new repos, arXiv cs.LG/cs.RO firehoses, bioRxiv, ClinicalTrials.gov, Cloudflare, NVIDIA, SemiAnalysis, Stratechery, MIT Technology Review, IEEE Spectrum, IEA, YC Companies |
| 10 | Tagging and ranking | (2026-10-20) One assessment pass over every item with Claude Opus 5.5 instead of small-model triage plus extraction: real volume is ~30 items/day, not ~200. Topics come from a fixed list. The assessment's domains replace the source's. Off-topic items are ranked low, not hidden |

## 12. Open questions

1. Which domain sends alert emails? Using the provider's test sender is fine to start.
2. Space, communications and financial infrastructure have no automatic source yet. Candidates need a primary feed that isn't mostly company news.
