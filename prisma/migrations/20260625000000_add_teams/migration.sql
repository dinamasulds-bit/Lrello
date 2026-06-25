-- CreateTable: Team
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");
CREATE UNIQUE INDEX "Team_slug_key" ON "Team"("slug");

-- CreateTable: TeamMembership
CREATE TABLE "TeamMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    CONSTRAINT "TeamMembership_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TeamMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamMembership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TeamMembership_userId_teamId_key" ON "TeamMembership"("userId", "teamId");
CREATE INDEX "TeamMembership_userId_idx" ON "TeamMembership"("userId");

-- AlterTable: Column add teamId
ALTER TABLE "Column" ADD COLUMN "teamId" TEXT;
ALTER TABLE "Column" ADD CONSTRAINT "Column_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Column_teamId_idx" ON "Column"("teamId");

-- Seed teams
INSERT INTO "Team" ("id", "name", "slug", "order", "createdAt") VALUES
    ('tm_all', '全体管理', 'all',      0, NOW()),
    ('tm_mgr', '役職者',   'manager',  1, NOW()),
    ('tm_t1',  '1課',      'team1',    2, NOW()),
    ('tm_t2',  '2課',      'team2',    3, NOW()),
    ('tm_tr',  '研修',     'training', 4, NOW());

-- Assign existing columns to 全体管理 (admin team)
UPDATE "Column" SET "teamId" = 'tm_all' WHERE "teamId" IS NULL;
