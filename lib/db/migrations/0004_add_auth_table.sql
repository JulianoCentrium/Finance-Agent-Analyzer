-- Migration: Add auth table for local authentication
-- Replaces Clerk with local user/email authentication

CREATE TABLE IF NOT EXISTS "auth" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL UNIQUE,
	"password" text NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add user_id to users table to link auth to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auth_id" integer REFERENCES "auth"("id") ON DELETE SET NULL;

-- Drop clerkUserId requirement
ALTER TABLE "users" ALTER COLUMN "clerk_user_id" DROP NOT NULL;
