-- Add a private login field separate from the public @username.
-- Existing v2 users keep their old username as the login after this migration.
ALTER TABLE "User" ADD COLUMN "login" TEXT;

UPDATE "User" SET "login" = "username" WHERE "login" IS NULL;

ALTER TABLE "User" ALTER COLUMN "login" SET NOT NULL;

CREATE UNIQUE INDEX "User_login_key" ON "User"("login");
CREATE INDEX "User_login_idx" ON "User"("login");
