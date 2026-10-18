# Technology Frontier Radar — Requirements

Status: draft v0.2 (2026-10-18). Turns the "Technology Frontier Intelligence" research brief into something buildable. The decisions from v0.1's open questions are recorded in §11.

---

## 1. Problem and goal

One person (the owner, a software engineer) wants to spot technologies at the **economic inflection** stage: technically possible, becoming cheap and reliable, but not yet widely adopted. Doing this by reading ~100 websites by hand doesn't scale.

The site collects new items from a fixed set of sources, sorts them by domain and frontier layer, and turns them into three reviewable outputs: a daily brief, a weekly trends report, and a monthly opportunity report.

**Success, measured after 4 weeks of real use:**
- The owner reads the daily brief on at least 15 of 20 working days, and it takes ≤15 minutes.
- At least 70% of brief items are rated "worth seeing" (thumbs up/down on each item).
- At least 3 weekly reports each produce one deep-dive topic that the owner actually researches.
- Every claim in every output links to its original source.

**It is not:**
- A public news site, a social product, or a multi-user SaaS.
- An investment-advice or prediction engine. Scores rank what to investigate next; they are not forecasts.
- A scraper of sites that forbid it (X/Twitter, LinkedIn, paywalled journals).

## 2. Users

| User | Needs |
|---|---|
| Owner (only signed-in user) | Read briefs (mostly on a phone), browse the raw feed, rate items, add/disable sources, write notes on trends |
| Visitor (anonymous) | Read public pages only |
| Scheduler (system) | Run ingestion and report generation on a timer with no manual steps |

**Access model: public, read-only.**
- Anyone with the URL can read: the feed, domain/source/people pages, published briefs and reports, trends.
- Only the owner, signed in, can write: ratings, notes, trend merge/split/dismiss, score overrides, enabling sources. Anything written goes through an authenticated server action. Visitors have no write endpoints at all.
- Owner sign-in is a single password stored as an env var (hashed comparison) with a long-lived, `HttpOnly`, `Secure` session cookie. Failed attempts are rate-limited.
- Private to the owner (never rendered for visitors): owner notes, ratings, LLM cost figures, the source-usefulness report.
- Cron/job endpoints need a secret header. They are not reachable as public pages.
- Every page sends `noindex` by default, so the site doesn't get indexed as a news aggregator. Can be changed later.

**Content rule (because it's public):** never republish full article or paper text. Show the title, author/source, date, an excerpt of at most ~300 characters (or the abstract where the source licenses it, e.g. arXiv metadata), the LLM-written summary, and a prominent link to the original. Paywalled sources (SemiAnalysis, Stratechery) show only the title and link.

## 3. Core concepts (glossary)

| Term | Meaning |
|---|---|
| **Domain** | One of the 15 technology areas (AI, Computing infra, Software infra, Robotics, Biotech, Semiconductors, Energy generation, Energy storage, Materials, Quantum, Space, Neurotech, Security, Financial infra, Communications), plus the cross-domain tags (AI+bio, AI+robotics, …) |
| **Coverage tier** | `deep` (AI, Computing, Software, Robotics): reviewed daily. `regular` (Biotech, Semis, Energy gen, Storage, Security, Fintech): weekly. `broad` (Materials, Quantum, Space, Neuro, Comms): weekly summary plus monthly deep dive. **Until Phase 2, broad-tier items are ingested and shown in the feed and on domain pages, but they skip LLM triage.** They reach the weekly report only as a rule-based "new this week" list. |
| **Layer** | Where an item sits: `scientific` (newly possible), `engineering` (reproducible, affordable), `product` (people can use it), `commercial` (adoption, people paying) |
| **Source** | One feed or endpoint, e.g. "arXiv cs.RO" |
| **Item** | One raw entry fetched from a source: paper, post, release, trial, repo |
| **Development** | An item that passed triage, enriched by the LLM with structured fields (§6.3) |
| **Trend** | A cluster of developments about the same capability, observed over time across several sources and layers |
| **Opportunity** | A trend the owner has promoted for a structured commercial assessment |

## 4. Scope by phase

Each phase ships something usable on its own. Don't start a phase until the one before it meets its acceptance criteria.

### Phase 0 — Registry + feed reader (no LLM)
- Source registry stored in the repo as data (YAML/JSON), covering the 25 starter sources in §5.1.
- Reference pages built from the research brief: the 15 domains (subfields, signals to watch, research/product/people lists) and the people list with links.
- Scheduled ingestion for every starter source that has a working feed or API.
- **Page monitors** for the starter sources that have no feed: Anthropic News and Physical Intelligence first, then IEA, ARPA-E and imec. A monitor:
  - is set up per source in the registry: list-page URL, a CSS selector for item links, an optional selector for the date, and an allowed URL prefix.
  - fetches the page at most once a day and records links it hasn't seen before as new items. The item's own page is fetched once, to get its title, date and meta description.
  - fails loudly. If the selector matches 0 links, or the link count drops by more than 80% from the last run, it records a health error and creates no items (protects against markup changes).
  - fetches static HTML only, no headless browser. A site that needs JavaScript to render stays manual.
- Feed page: newest items first. Filter by domain, layer, source type and source. Text search over title and summary.
- Health page for each source: last successful fetch, last error, items fetched in the last 7 days.
- Owner sign-in (§2).

**Acceptance:**
- 22 of the 26 starter sources ingest automatically (17 feeds/APIs + 5 page monitors). The 4 manual ones show up as "manual check" links.
- Adding a source means a data change and nothing else (no code).
- Items are deduplicated by canonical URL (and by DOI/arXiv ID where one exists).
- One failing source never blocks the others.

### Phase 1 — Triage, extraction, daily brief
- **Funnel**: items get cheaper checks first, and the LLM only sees what survives:
  1. **Rule pre-filter (free):** dedupe; drop broad-tier items (§4 tiers); keyword/category rules per source. For example, arXiv cs.LG/cs.RO items go straight through if they also appear in HF Daily Papers. Otherwise they need a match on a keyword list kept in config. HN items need a score of at least 100.
  2. **Batch triage (small model):** titles plus the first ~300 characters only, 20–50 items per request. Returns relevant or not, domain, layer, and a 1–5 novelty guess.
  3. **Extraction (stronger model):** only for the top ~15–25 triaged items per day, producing the Development fields (§6.3).
  4. **Brief writing (stronger model):** one call per day, working from the extracted developments only.
- **Budget enforcement:** a hard cap of **$20/month**, enforced in code. Spend is tracked per call from the API's token usage. Daily allowance = (remaining budget) ÷ (days left in the month). When the allowance runs out, LLM steps stop for the day, the brief falls back to "top items by rules, unsummarized", and the health page says so. At 80% of the monthly cap the owner gets an email.
- Daily brief, generated at a fixed time: 5 research items, 5 product/engineering items, 3 adoption/commercial signals. Each one answers *what changed, why it matters, what the evidence is, what it could make possible*, and links to the source. If a day has fewer good items, the brief shows fewer rather than padding.
- **Email delivery:** after the brief is generated, a short email goes to the owner's address. It has a 1-line headline per item and links to the brief page. Sent through a transactional email API (§10).
- Thumbs up/down on each brief item, stored for tuning later. Owner only.

**Acceptance:**
- The brief is generated and the email sent with no manual step on ≥95% of days, by 07:15 Asia/Dubai.
- No brief item lacks a source link.
- A company's claim is always labelled as a claim unless an independent source backs it up.
- LLM spend for the month never goes over $20. A test with a simulated cap proves the fallback works.

### Phase 2 — Trends, scoring, weekly report
- Embed developments and cluster them into trends. A trend keeps a timeline of its developments, tagged by layer and source.
- Trend detection rules (to start with): ≥3 developments from ≥2 independent sources within 90 days, *or* a development has moved up a layer (for example a paper followed by a repo or product).
- Score with the 6-dimension rubric (§7). Keep two separate rankings: scientific significance and entrepreneurial opportunity.
- Weekly report sections: top breakthroughs, product developments, emerging trends, surprises, commercial implications, deep-dive candidates.
- The owner can merge, split, rename or dismiss trends, and add notes.
- Broad-tier domains join LLM triage if the last 30 days of Phase 1 spend left at least 30% of the budget unused. Otherwise they stay rule-only and the owner decides whether to raise the cap.

**Acceptance:**
- Hand-test on seeded history: the system links ≥3 items about the same capability that use different wording into one trend.
- The weekly report generates on schedule and lists ≤5 deep-dive candidates.

### Phase 3 — Early-signal mechanisms + monthly opportunity report
- **Acceleration tracking:** publication counts per concept over time (OpenAlex), new-repo and star/contributor growth (GitHub API), package downloads (PyPI Stats, npm). Ranked by growth rate, not absolute size.
- **Emerging researchers:** OpenAlex authors whose citations from independent groups are rising quickly in small concepts.
- **Expert/market disagreement:** a flag for trends where technical signals are strong but commercial signals are weak, or the reverse.
- Monthly report: about 5 opportunities, each with what changed, what is still hard, potential customers, businesses it enables, evidence still needed, and a next cheap experiment. Each also compares the capability now with 6–12 months earlier.
- A per-source usefulness report: which sources produced items the owner rated up. Used to prune or expand sources.

## 5. Sources

### 5.1 Starter set (Phase 0), checked on 2026-10-18

| # | Source | Domain | Layer | Method | Endpoint | Status |
|---|---|---|---|---|---|---|
| 1 | arXiv cs.LG | AI | scientific | arXiv API | `export.arxiv.org/api/query?search_query=cat:cs.LG&sortBy=submittedDate` | OK. The RSS at `rss.arxiv.org/rss/cs.LG` is empty on weekends, so use the API |
| 2 | Hugging Face Daily Papers | AI | scientific | JSON API | `huggingface.co/api/daily_papers` | OK |
| 3 | OpenAI News | AI | product | RSS | `openai.com/news/rss.xml` | OK |
| 4 | Anthropic News | AI | product | Page monitor | `anthropic.com/news` | No RSS (404). Page monitor, priority 1 |
| 5 | Google DeepMind Blog | AI | scientific/product | RSS | `deepmind.google/blog/rss.xml` | OK |
| 6 | Artificial Analysis | AI | engineering | Manual | `artificialanalysis.ai` | No feed. Manual link in v1 |
| 7 | GitHub Trending | Software | engineering | GitHub Search API (stand-in) | `api.github.com/search/repositories?q=created:>DATE&sort=stars` | No official Trending API. Use "fast-starred new repos" via search |
| 8 | Hacker News | Software | engineering | RSS / Firebase API | `hnrss.org/best` | OK |
| 9 | Cloudflare Blog | Software/Compute | engineering | RSS | `blog.cloudflare.com/rss/` | OK |
| 10 | NVIDIA Developer Blog | Compute | engineering | Atom | `developer.nvidia.com/blog/feed` | OK |
| 11 | SemiAnalysis | Compute/Semis | commercial | RSS | `newsletter.semianalysis.com/feed` | OK (paywalled bodies, titles only) |
| 12 | arXiv cs.RO | Robotics | scientific | arXiv API | as #1 with `cat:cs.RO` | OK |
| 13 | Robotics: Science and Systems | Robotics | scientific | Manual (yearly) | `roboticsconference.org` | Conference. Yearly manual import of proceedings |
| 14 | Physical Intelligence | Robotics | product | Page monitor | `physicalintelligence.company/blog` | No RSS found. Page monitor, priority 1 |
| 15 | bioRxiv | Biotech | scientific | bioRxiv API | `api.biorxiv.org/details/biorxiv/{from}/{to}/{cursor}` | OK (~1,800/week). Filtered to categories: synthetic biology, bioengineering, bioinformatics, genomics |
| 16 | Nature Biotechnology | Biotech | scientific | RSS | `nature.com/nbt.rss` | OK |
| 17 | ClinicalTrials.gov | Biotech/Neuro | commercial | API v2 | `clinicaltrials.gov/api/v2/studies` | OK. Filtered to gene therapy/editing, cell therapy, BCI/neurostimulation, Phase 1–3 only, new or updated in the last 7 days. Exact query terms kept in the registry `filter` |
| 18 | IEA | Energy | commercial | Page monitor | `iea.org/news` | No RSS (404). Page monitor, priority 2 |
| 19 | ARPA-E | Energy | scientific | Page monitor | `arpa-e.energy.gov/news-and-events/news-and-insights` | No RSS found. Page monitor, priority 2 |
| 20 | imec | Semis | scientific | Page monitor | TBD | Press URL guessed wrong (404). Find the right one, then page monitor, priority 2 |
| 21 | Semiconductor Engineering | Semis | engineering | RSS | `semiengineering.com/feed/` | OK |
| 22 | MIT Technology Review | Broad | product | RSS | `technologyreview.com/feed/` | OK |
| 23 | IEEE Spectrum | Broad | engineering | RSS | `spectrum.ieee.org/feeds/feed.rss` | OK |
| 24 | Stanford Emerging Tech Review | Broad | — | Manual (yearly) | `setr.stanford.edu` | Periodic review, not a feed |
| 25 | Y Combinator Companies | Commercial | commercial | Manual / TBD | `ycombinator.com/companies` | No public API. Check per batch by hand in v1 |
| 26 | Stratechery | Commercial | commercial | RSS | `stratechery.com/feed/` | OK (free posts only) |

Totals: **17 feed/API** (GitHub Trending counts here, approximated by the Search API), **5 page monitor**, **4 manual** (Artificial Analysis, RSS conference, Stanford ETR, YC Companies).

Also confirmed reachable, for Phase 3: OpenAlex API, GitHub API, PyPI Stats API, npm downloads API, HN Firebase API.

### 5.2 Source registry fields

| Field | Type | Example |
|---|---|---|
| `id` | slug | `arxiv-cs-ro` |
| `name` | string | arXiv cs.RO |
| `domains` | list | `[robotics]` |
| `layer` | enum | `scientific` |
| `kind` | enum | `research` / `product` / `person` / `newsletter` / `commercial-data` |
| `method` | enum | `rss` / `atom` / `json-api` / `page-monitor` / `manual` |
| `endpoint` | url | |
| `homepage` | url | |
| `frequency` | enum | `hourly` / `daily` / `weekly` / `yearly` |
| `filter` | optional | arXiv categories, bioRxiv categories, CT.gov query |
| `reliability` | note | "high provenance; claims vary" |
| `priority` | 1–3 | |
| `enabled` | bool | |

### 5.3 Later sources (not v1)
All other research, product and newsletter sources from the brief go into the registry with `enabled: false` and are switched on in batches. Collection rules:
- **People:** use the person's blog RSS if they have one (for example Simon Willison, Karpathy, Scott Aaronson, Martin Kleppmann, Matthew Green, Vitalik Buterin, Dwarkesh Patel). Otherwise follow their papers through their OpenAlex author ID (Phase 3). No X/Twitter ingestion.
- **Paid data** (PitchBook, Crunchbase, Dealroom, LinkedIn Jobs): out of scope unless the owner buys access.
- **Podcasts/video:** out of scope in v1. Maybe later via show-notes RSS.

## 6. Data model

### 6.1 Item (raw)
`id, source_id, url, canonical_url, external_id (DOI/arXiv/NCT), title, authors, published_at, fetched_at, summary/abstract, raw_payload, content_hash`

### 6.2 Triage result
`item_id, relevant (bool), domains[], cross_domain_tags[], layer, novelty (1–5), model, prompt_version, cost`

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
| commercial_implications | short text |
| confidence | 1–5, with a one-line reason |
| evidence_links | list of URLs, at least the source item |

### 6.4 Trend
`id, name, description, domains, development_ids (timeline), first_seen, last_seen, layer_progression, scores (§7), owner_notes, status (watching / deep-dive / opportunity / dismissed)`

### 6.5 Feedback
`target (item/development/trend), rating (+1/−1), note, created_at`

## 7. Scoring

Each dimension is scored 1–5 by the LLM, with a one-line reason. The owner can override any score.

| Dimension | Weight |
|---|---|
| Magnitude | 20% |
| Evidence | 20% |
| Economic impact | 20% |
| Adoption | 15% |
| Timing | 15% |
| Competitive gap | 10% |

`score = Σ (weight × (s − 1) / 4) × 100`, which maps all-1s to 0 and all-5s to 100. Scientific significance is a separate 1–5 score and never gets merged into this one. Weights live in config, not code.

## 8. Pages

| Page | Phase | Contents |
|---|---|---|
| Home / Today | 0→1 | Phase 0: latest items per deep-tier domain. Phase 1 and later: today's brief |
| Feed | 0 | All items, with filters (domain, layer, kind, source, date) and search |
| Domain `/d/{slug}` | 0 | Subfields, signals to watch, research/product/people lists, recent items, trends (P2) |
| Sources | 0 | Registry table plus health status |
| People | 0 | Specialists and cross-disciplinary thinkers, with links and feeds |
| Briefs archive | 1 | Daily / weekly / monthly reports by date |
| Trends | 2 | Ranked list (two rankings), trend detail with timeline |
| Opportunities | 3 | Monthly assessments |

Must work at phone width (the daily brief gets read on a phone). Owner-only controls (ratings, notes, trend edits, cost figures) appear only when signed in. Visitors see the same pages without them.

## 9. Non-functional

- **Schedule** (all times Asia/Dubai, UTC+4):
  - Feed/API sources: hourly for `hourly`, otherwise once a day at 02:00.
  - Page monitors: once a day at 02:00.
  - Triage runs hourly after ingestion. Extraction is submitted at 04:00, and the brief is generated and emailed between 06:00 and 07:00. Vercel Hobby cron fires anywhere in the scheduled hour; see ARCHITECTURE §9.
  - Weekly report: Saturday 08:00. Monthly report: 1st of the month at 08:00.
- **Politeness:** respect robots.txt and rate limits. Identify with a User-Agent. Back off on errors.
- **Traceability:** store the prompt version and model with every LLM output, so outputs can be re-run when prompts change.
- **Idempotent ingestion:** re-running a fetch never creates duplicates. A job that times out partway can be run again safely.
- **Serverless limits:** no single job invocation fetches every source. Ingestion processes a batch of sources per call and keeps a cursor, so each call fits inside the platform's function timeout.
- **Cost visibility:** LLM spend per day and month to date, shown to the owner on the health page.
- **Retention:** keep raw items forever. They're small, and keeping them makes the 6–12-month comparisons possible.
- **Secrets** (env vars only, never in the repo): DB URL, Anthropic API key, email API key, owner password hash, session secret, cron secret, GitHub token, owner email address.

## 10. Tech stack

- **App:** Next.js (TypeScript, App Router), server-rendered, deployed on **Vercel**.
- **DB:** **Neon** Postgres with the `pgvector` extension (embeddings are needed from Phase 2). Migrations live in the repo.
- **Jobs:**
  - Daily/weekly/monthly jobs: Vercel Cron calling protected route handlers.
  - Hourly ingestion: a scheduled GitHub Actions workflow calling the same protected endpoint. Vercel Cron's frequency limit depends on the plan, so check it when setting up. GitHub's scheduled runs can start several minutes late, so the 07:00 brief must not depend on them.
- **LLM:** Claude API through the official TypeScript SDK. A small model for triage, a stronger one for extraction and reports. Pick the exact models in Phase 1 by checking current pricing against the $20/month cap.
- **Email:** a transactional email API (Resend proposed: it has a simple Node SDK and a free tier). Needs a verified sending domain or the provider's test sender.
- **Registry and domain content:** YAML files in the repo, so edits are reviewable in git. At deploy time they are validated against a schema.

## 11. Decisions (2026-10-18)

| # | Question | Decision |
|---|---|---|
| 1 | Hosted or local? | Hosted on Vercel + Neon, so the owner can read on a phone |
| 2 | LLM budget | Hard cap of $20/month, with the funnel and fallback in Phase 1 |
| 3 | Brief time and delivery | 07:00 Asia/Dubai. Published on the site, plus an email to the owner |
| 4 | Feedless starter sources | Build page monitors (Anthropic and Physical Intelligence first, then IEA, ARPA-E, imec) |
| 5 | bioRxiv / ClinicalTrials.gov | Narrow categories from the start (§5.1) |
| 6 | Broad-tier domains | Registry and feed only until Phase 2. No LLM triage |
| 7 | Access | Public, read-only. Owner signs in with a single password to write |

## 12. Open questions

1. Which domain sends the brief email? Using the provider's test sender is fine to start.
2. Keyword lists for the arXiv pre-filter: draft them from the "signals to monitor" in the research brief, then the owner reviews them before Phase 1.
