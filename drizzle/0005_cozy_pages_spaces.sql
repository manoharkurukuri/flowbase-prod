CREATE TABLE "spaces" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text DEFAULT '#8B5CF6' NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp,
	"last_opened_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"space_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"updated_by_user_id" integer,
	"name" text NOT NULL,
	"description" text,
	"template" text DEFAULT 'blank' NOT NULL,
	"content" jsonb DEFAULT '{"type":"doc","content":[]}'::jsonb NOT NULL,
	"plain_text" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp,
	"last_opened_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"page_id" integer NOT NULL,
	"user_id" integer,
	"body" text NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_task_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"page_id" integer NOT NULL,
	"task_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_comments" ADD CONSTRAINT "page_comments_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_comments" ADD CONSTRAINT "page_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_task_links" ADD CONSTRAINT "page_task_links_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_task_links" ADD CONSTRAINT "page_task_links_task_id_kanban_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."kanban_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "spaces_user_id_idx" ON "spaces" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "spaces_user_archive_idx" ON "spaces" USING btree ("user_id","archived_at");--> statement-breakpoint
CREATE INDEX "spaces_user_favorite_idx" ON "spaces" USING btree ("user_id","is_favorite");--> statement-breakpoint
CREATE INDEX "spaces_user_updated_idx" ON "spaces" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "pages_space_id_idx" ON "pages" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "pages_user_id_idx" ON "pages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pages_space_archive_idx" ON "pages" USING btree ("space_id","archived_at");--> statement-breakpoint
CREATE INDEX "pages_space_favorite_idx" ON "pages" USING btree ("space_id","is_favorite");--> statement-breakpoint
CREATE INDEX "pages_space_updated_idx" ON "pages" USING btree ("space_id","updated_at");--> statement-breakpoint
CREATE INDEX "page_comments_page_id_idx" ON "page_comments" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "page_comments_user_id_idx" ON "page_comments" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "page_task_links_page_task_unique" ON "page_task_links" USING btree ("page_id","task_id");--> statement-breakpoint
CREATE INDEX "page_task_links_page_id_idx" ON "page_task_links" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "page_task_links_task_id_idx" ON "page_task_links" USING btree ("task_id");
