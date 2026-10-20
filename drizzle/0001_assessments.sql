CREATE TABLE "item_assessments" (
	"item_id" bigint PRIMARY KEY NOT NULL,
	"prompt_version" text NOT NULL,
	"model" text NOT NULL,
	"assessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"relevant" boolean NOT NULL,
	"domains" text[] NOT NULL,
	"topics" text[] NOT NULL,
	"proposed_topics" text[] NOT NULL,
	"contribution" text NOT NULL,
	"artifacts" text[] NOT NULL,
	"novelty" smallint NOT NULL,
	"magnitude" smallint NOT NULL,
	"evidence" smallint NOT NULL,
	"breadth" smallint NOT NULL,
	"maturity" smallint NOT NULL,
	"quality" smallint NOT NULL,
	"takeaway" text NOT NULL,
	"rationale" text NOT NULL,
	"llm_call_id" integer
);
--> statement-breakpoint
CREATE TABLE "llm_calls" (
	"id" serial PRIMARY KEY NOT NULL,
	"purpose" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"status" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cache_read_tokens" integer DEFAULT 0 NOT NULL,
	"cache_write_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(10, 6) DEFAULT 0 NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "source_domains" text[];--> statement-breakpoint
UPDATE "items" SET "source_domains" = "domains";--> statement-breakpoint
ALTER TABLE "items" ALTER COLUMN "source_domains" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "quality" smallint;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "rank" real;--> statement-breakpoint
ALTER TABLE "item_assessments" ADD CONSTRAINT "item_assessments_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_assessments" ADD CONSTRAINT "item_assessments_llm_call_id_llm_calls_id_fk" FOREIGN KEY ("llm_call_id") REFERENCES "public"."llm_calls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "item_assessments_version_idx" ON "item_assessments" USING btree ("prompt_version");--> statement-breakpoint
CREATE INDEX "llm_calls_created_idx" ON "llm_calls" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "items_tags_idx" ON "items" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "items_rank_idx" ON "items" USING btree ("rank" DESC NULLS LAST);