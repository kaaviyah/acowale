CREATE TYPE "public"."feedback_status" AS ENUM('new', 'in_progress', 'resolved');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" "smallserial" PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" smallint NOT NULL,
	"rating" smallint,
	"comment" text NOT NULL,
	"email" text,
	"status" "feedback_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_rating_range" CHECK ("feedback"."rating" IS NULL OR "feedback"."rating" BETWEEN 1 AND 5),
	CONSTRAINT "feedback_comment_length" CHECK (char_length("feedback"."comment") BETWEEN 3 AND 2000),
	CONSTRAINT "feedback_email_length" CHECK ("feedback"."email" IS NULL OR char_length("feedback"."email") BETWEEN 3 AND 320)
);
--> statement-breakpoint
CREATE TABLE "rate_limit_hits" (
	"bucket_key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"hits" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limit_hits_bucket_key_window_start_pk" PRIMARY KEY("bucket_key","window_start")
);
--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_feedback_created_at" ON "feedback" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_feedback_category_created" ON "feedback" USING btree ("category_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_feedback_status_created" ON "feedback" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_rate_limit_window_start" ON "rate_limit_hits" USING btree ("window_start");