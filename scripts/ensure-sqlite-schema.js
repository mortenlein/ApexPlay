const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

function getSqliteFilePath(databaseUrl) {
  if (!databaseUrl || !databaseUrl.startsWith("file:")) {
    return null;
  }

  return databaseUrl.slice("file:".length);
}

function tableExists(db, tableName) {
  return Boolean(
    db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName)
  );
}

function columnExists(db, tableName, columnName) {
  return db
    .prepare(`PRAGMA table_info("${tableName}")`)
    .all()
    .some((column) => column.name === columnName);
}

function indexExists(db, indexName) {
  return Boolean(
    db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ?").get(indexName)
  );
}

function ensureTable(db, sql) {
  db.exec(sql);
}

function ensureColumn(db, tableName, columnName, sql) {
  if (!columnExists(db, tableName, columnName)) {
    db.exec(`ALTER TABLE "${tableName}" ADD COLUMN ${sql}`);
  }
}

function ensureIndex(db, indexName, sql) {
  if (!indexExists(db, indexName)) {
    db.exec(sql);
  }
}

function ensureSQLiteSchema(databaseUrl) {
  const databaseFilePath = getSqliteFilePath(databaseUrl);
  if (!databaseFilePath) {
    return;
  }

  fs.mkdirSync(path.dirname(databaseFilePath), { recursive: true });

  const db = new DatabaseSync(databaseFilePath);
  db.exec("PRAGMA foreign_keys = ON;");

  ensureTable(
    db,
    `CREATE TABLE IF NOT EXISTS "Tournament" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "game" TEXT NOT NULL DEFAULT 'CS2',
      "category" TEXT NOT NULL DEFAULT 'BRACKET',
      "type" TEXT NOT NULL,
      "format" TEXT NOT NULL DEFAULT 'SINGLE_ELIMINATION',
      "teamSize" INTEGER NOT NULL DEFAULT 5,
      "bo3StartRound" INTEGER,
      "bo5StartRound" INTEGER,
      "hasThirdPlace" BOOLEAN NOT NULL DEFAULT false,
      "steamSignupEnabled" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`
  );

  ensureTable(
    db,
    `CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT,
      "email" TEXT,
      "emailVerified" DATETIME,
      "image" TEXT,
      "steamId" TEXT
    );`
  );

  ensureTable(
    db,
    `CREATE TABLE IF NOT EXISTS "Team" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "logoUrl" TEXT,
      "seed" INTEGER,
      "tournamentId" TEXT NOT NULL,
      "inviteCode" TEXT,
      CONSTRAINT "Team_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );`
  );

  ensureTable(
    db,
    `CREATE TABLE IF NOT EXISTS "Player" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "nickname" TEXT,
      "countryCode" TEXT,
      "seating" TEXT,
      "steamId" TEXT,
      "isOnline" BOOLEAN NOT NULL DEFAULT false,
      "isLeader" BOOLEAN NOT NULL DEFAULT false,
      "teamId" TEXT NOT NULL,
      "tournamentId" TEXT,
      "userId" TEXT,
      CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "Player_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    );`
  );

  ensureTable(
    db,
    `CREATE TABLE IF NOT EXISTS "Account" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "provider" TEXT NOT NULL,
      "providerAccountId" TEXT NOT NULL,
      "refresh_token" TEXT,
      "access_token" TEXT,
      "expires_at" INTEGER,
      "token_type" TEXT,
      "scope" TEXT,
      "id_token" TEXT,
      "session_state" TEXT,
      CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );`
  );

  ensureTable(
    db,
    `CREATE TABLE IF NOT EXISTS "Session" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "sessionToken" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "expires" DATETIME NOT NULL,
      CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );`
  );

  ensureTable(
    db,
    `CREATE TABLE IF NOT EXISTS "VerificationToken" (
      "identifier" TEXT NOT NULL,
      "token" TEXT NOT NULL,
      "expires" DATETIME NOT NULL
    );`
  );

  ensureTable(
    db,
    `CREATE TABLE IF NOT EXISTS "Match" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "tournamentId" TEXT NOT NULL,
      "homeTeamId" TEXT,
      "awayTeamId" TEXT,
      "homeScore" INTEGER NOT NULL DEFAULT 0,
      "awayScore" INTEGER NOT NULL DEFAULT 0,
      "mapScores" TEXT NOT NULL DEFAULT '[]',
      "bestOf" INTEGER NOT NULL DEFAULT 1,
      "scoreLimit" INTEGER NOT NULL DEFAULT 1,
      "winnerId" TEXT,
      "bracketType" TEXT NOT NULL DEFAULT 'WINNERS',
      "round" INTEGER NOT NULL,
      "matchOrder" INTEGER NOT NULL,
      "nextMatchId" TEXT,
      "loserNextMatchId" TEXT,
      "serverIp" TEXT,
      "serverPort" TEXT,
      "serverPassword" TEXT,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      CONSTRAINT "Match_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "Match_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "Match_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    );`
  );

  ensureTable(
    db,
    `CREATE TABLE IF NOT EXISTS "ScoreboardEntry" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "tournamentId" TEXT NOT NULL,
      "teamId" TEXT NOT NULL,
      "kills" INTEGER NOT NULL DEFAULT 0,
      "placement" INTEGER NOT NULL DEFAULT 0,
      "points" INTEGER NOT NULL DEFAULT 0,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "ScoreboardEntry_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "ScoreboardEntry_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );`
  );

  ensureColumn(db, "Tournament", "game", `"game" TEXT NOT NULL DEFAULT 'CS2'`);
  ensureColumn(db, "Tournament", "category", `"category" TEXT NOT NULL DEFAULT 'BRACKET'`);
  ensureColumn(db, "Tournament", "steamSignupEnabled", `"steamSignupEnabled" BOOLEAN NOT NULL DEFAULT false`);

  ensureColumn(db, "Team", "inviteCode", `"inviteCode" TEXT`);

  ensureColumn(db, "Player", "nickname", `"nickname" TEXT`);
  ensureColumn(db, "Player", "countryCode", `"countryCode" TEXT`);
  ensureColumn(db, "Player", "steamId", `"steamId" TEXT`);
  ensureColumn(db, "Player", "isOnline", `"isOnline" BOOLEAN NOT NULL DEFAULT false`);
  ensureColumn(db, "Player", "isLeader", `"isLeader" BOOLEAN NOT NULL DEFAULT false`);
  ensureColumn(db, "Player", "userId", `"userId" TEXT`);
  ensureColumn(db, "Player", "tournamentId", `"tournamentId" TEXT`);

  ensureColumn(db, "Match", "serverIp", `"serverIp" TEXT`);
  ensureColumn(db, "Match", "serverPort", `"serverPort" TEXT`);
  ensureColumn(db, "Match", "serverPassword", `"serverPassword" TEXT`);

  if (tableExists(db, "Player") && tableExists(db, "Team")) {
    db.exec(`
      UPDATE "Player"
      SET "tournamentId" = (
        SELECT "tournamentId"
        FROM "Team"
        WHERE "Team"."id" = "Player"."teamId"
      )
      WHERE "tournamentId" IS NULL;
    `);
  }

  ensureIndex(db, "Team_inviteCode_key", `CREATE UNIQUE INDEX "Team_inviteCode_key" ON "Team"("inviteCode");`);
  ensureIndex(db, "Player_tournamentId_userId_key", `CREATE UNIQUE INDEX "Player_tournamentId_userId_key" ON "Player"("tournamentId", "userId");`);
  ensureIndex(db, "Account_provider_providerAccountId_key", `CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");`);
  ensureIndex(db, "Session_sessionToken_key", `CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");`);
  ensureIndex(db, "User_email_key", `CREATE UNIQUE INDEX "User_email_key" ON "User"("email");`);
  ensureIndex(db, "User_steamId_key", `CREATE UNIQUE INDEX "User_steamId_key" ON "User"("steamId");`);
  ensureIndex(db, "VerificationToken_token_key", `CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");`);
  ensureIndex(db, "VerificationToken_identifier_token_key", `CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");`);
  ensureIndex(db, "ScoreboardEntry_tournamentId_teamId_key", `CREATE UNIQUE INDEX "ScoreboardEntry_tournamentId_teamId_key" ON "ScoreboardEntry"("tournamentId", "teamId");`);

  db.close();
}

module.exports = {
  ensureSQLiteSchema,
};
