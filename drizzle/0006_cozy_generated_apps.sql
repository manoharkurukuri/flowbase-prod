CREATE TABLE "generated_apps" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"prompt" text NOT NULL,
	"app_name" text NOT NULL,
	"description" text,
	"icon" text DEFAULT 'Sparkles' NOT NULL,
	"color" text DEFAULT '#8B5CF6' NOT NULL,
	"layout" text DEFAULT 'single-page' NOT NULL,
	"template_json" jsonb NOT NULL,
	"is_in_sidebar" boolean DEFAULT false NOT NULL,
	"sidebar_position" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generated_apps" ADD CONSTRAINT "generated_apps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generated_apps_user_id_idx" ON "generated_apps" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "generated_apps_user_created_idx" ON "generated_apps" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "generated_apps_user_sidebar_idx" ON "generated_apps" USING btree ("user_id","is_in_sidebar","sidebar_position");
