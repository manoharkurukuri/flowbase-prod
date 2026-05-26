CREATE TABLE "whiteboards" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#EC4899' NOT NULL,
	"scene" jsonb DEFAULT '{"type":"excalidraw","version":2,"source":"flowbase","elements":[],"appState":{"viewBackgroundColor":"#FFFDF7"},"files":{}}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "whiteboards" ADD CONSTRAINT "whiteboards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "whiteboards_user_id_idx" ON "whiteboards" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "whiteboards_user_updated_idx" ON "whiteboards" USING btree ("user_id","updated_at");
