CREATE TABLE "item_mentions" (
	"item_id" bigint NOT NULL,
	"source_id" text NOT NULL,
	"seen_on" date NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"url" text NOT NULL,
	"signals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "item_mentions_item_id_source_id_seen_on_pk" PRIMARY KEY("item_id","source_id","seen_on")
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"canonical_url" text NOT NULL,
	"url" text NOT NULL,
	"external_kind" text,
	"external_id" text,
	"first_source_id" text NOT NULL,
	"title" text NOT NULL,
	"authors" text[],
	"published_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sort_at" timestamp with time zone NOT NULL,
	"excerpt" text,
	"abstract" text,
	"domains" text[] NOT NULL,
	"layer" text NOT NULL,
	"kind" text NOT NULL,
	"tier" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', coalesce("items"."title", '') || ' ' || coalesce("items"."excerpt", '') || ' ' || coalesce("items"."abstract", ''))) STORED
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job" text NOT NULL,
	"trigger" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "source_state" (
	"source_id" text PRIMARY KEY NOT NULL,
	"cursor" jsonb,
	"etag" text,
	"last_modified" text,
	"last_run_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_error" text,
	"last_error_at" timestamp with time zone,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"last_fetched_count" integer,
	"last_new_count" integer,
	"next_due_at" timestamp with time zone DEFAULT now() NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean NOT NULL,
	"method" text NOT NULL,
	"kind" text NOT NULL,
	"layer" text NOT NULL,
	"domains" text[] NOT NULL,
	"frequency" text NOT NULL,
	"config" jsonb NOT NULL,
	"config_hash" text NOT NULL,
	"in_registry" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "item_mentions" ADD CONSTRAINT "item_mentions_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_mentions" ADD CONSTRAINT "item_mentions_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_first_source_id_sources_id_fk" FOREIGN KEY ("first_source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_state" ADD CONSTRAINT "source_state_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "item_mentions_source_idx" ON "item_mentions" USING btree ("source_id","seen_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "items_canonical_url_uq" ON "items" USING btree ("canonical_url");--> statement-breakpoint
CREATE UNIQUE INDEX "items_external_uq" ON "items" USING btree ("external_kind","external_id") WHERE "items"."external_id" is not null;--> statement-breakpoint
CREATE INDEX "items_sort_at_idx" ON "items" USING btree ("sort_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "items_domains_idx" ON "items" USING gin ("domains");--> statement-breakpoint
CREATE INDEX "items_search_idx" ON "items" USING gin ("search");--> statement-breakpoint
CREATE INDEX "items_first_source_idx" ON "items" USING btree ("first_source_id","sort_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "job_runs_job_idx" ON "job_runs" USING btree ("job","started_at" DESC NULLS LAST);