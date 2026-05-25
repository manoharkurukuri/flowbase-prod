CREATE TABLE "collaboration_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" integer NOT NULL,
	"user_id" integer,
	"email" text NOT NULL,
	"role" text DEFAULT 'editor' NOT NULL,
	"invited_by_user_id" integer,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kanban_boards" ALTER COLUMN "position" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "kanban_columns" ALTER COLUMN "position" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "kanban_tasks" ALTER COLUMN "position" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "kanban_tasks" ALTER COLUMN "sync_to_calendar" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "kanban_tasks" ALTER COLUMN "linked_to_notes" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "collaboration_members" ADD CONSTRAINT "collaboration_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaboration_members" ADD CONSTRAINT "collaboration_members_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "collaboration_members_resource_email_unique" ON "collaboration_members" USING btree ("resource_type","resource_id","email");--> statement-breakpoint
CREATE INDEX "collaboration_members_resource_idx" ON "collaboration_members" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "collaboration_members_user_id_idx" ON "collaboration_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "collaboration_members_email_idx" ON "collaboration_members" USING btree ("email");--> statement-breakpoint
INSERT INTO "collaboration_members" (
	"resource_type",
	"resource_id",
	"user_id",
	"email",
	"role",
	"invited_by_user_id",
	"accepted_at",
	"created_at",
	"updated_at"
)
SELECT
	'kanban_board',
	"kanban_boards"."id",
	"users"."id",
	lower("users"."email"),
	'owner',
	"users"."id",
	now(),
	now(),
	now()
FROM "kanban_boards"
INNER JOIN "users" ON "users"."id" = "kanban_boards"."user_id"
ON CONFLICT ("resource_type", "resource_id", "email") DO NOTHING;
