ALTER TABLE "notes" ADD COLUMN "category" text DEFAULT 'general' NOT NULL;--> statement-breakpoint
CREATE TABLE "user_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#8B5CF6' NOT NULL,
	"icon" text DEFAULT 'Sparkles' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"theme_preference" text DEFAULT 'system' NOT NULL,
	"notifications_enabled" boolean DEFAULT true NOT NULL,
	"email_notifications" boolean DEFAULT true NOT NULL,
	"desktop_notifications" boolean DEFAULT false NOT NULL,
	"default_calendar_view" text DEFAULT 'month' NOT NULL,
	"default_task_priority" text DEFAULT 'Medium' NOT NULL,
	"auto_save_enabled" boolean DEFAULT true NOT NULL,
	"ai_model" text DEFAULT 'llama-3.3-70b-versatile' NOT NULL,
	"ai_behavior" text DEFAULT 'balanced' NOT NULL,
	"ai_tone" text DEFAULT 'warm' NOT NULL,
	"ai_refine_enabled" boolean DEFAULT true NOT NULL,
	"ai_assistant_enabled" boolean DEFAULT true NOT NULL,
	"ai_template_builder_enabled" boolean DEFAULT true NOT NULL,
	"ai_diagram_enabled" boolean DEFAULT true NOT NULL,
	"privacy_analytics_enabled" boolean DEFAULT false NOT NULL,
	"security_alerts_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"plan_name" text DEFAULT 'Free Plan' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"renewal_date" text,
	"usage_limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_categories" ADD CONSTRAINT "user_categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notes_user_category_idx" ON "notes" USING btree ("user_id","category");--> statement-breakpoint
CREATE UNIQUE INDEX "user_categories_user_scope_key_unique" ON "user_categories" USING btree ("user_id","scope","key");--> statement-breakpoint
CREATE INDEX "user_categories_user_scope_idx" ON "user_categories" USING btree ("user_id","scope");--> statement-breakpoint
CREATE INDEX "user_categories_user_position_idx" ON "user_categories" USING btree ("user_id","scope","position");--> statement-breakpoint
CREATE UNIQUE INDEX "user_settings_user_id_unique" ON "user_settings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_settings_user_id_idx" ON "user_settings" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_subscriptions_user_id_unique" ON "user_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_subscriptions_user_id_idx" ON "user_subscriptions" USING btree ("user_id");
