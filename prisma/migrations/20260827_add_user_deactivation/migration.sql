-- Blocks login without touching role — see the User model comment in
-- schema.prisma for the full rationale.
ALTER TABLE "User" ADD COLUMN "deactivatedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "deactivatedByUserId" TEXT;
