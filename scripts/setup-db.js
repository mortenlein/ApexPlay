const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const { resolveSQLiteUrl } = require('./resolve-sqlite-url');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db';

console.log('Preparing SQLite database');

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

function preflightLegacySqliteSchema(databaseFilePath) {
    if (!fs.existsSync(databaseFilePath) || fs.statSync(databaseFilePath).size === 0) {
        return;
    }

    const db = new DatabaseSync(databaseFilePath);

    try {
        if (tableExists(db, 'Player') && tableExists(db, 'Team') && !columnExists(db, 'Player', 'tournamentId')) {
            db.exec('ALTER TABLE "Player" ADD COLUMN "tournamentId" TEXT;');
            db.exec(`
                UPDATE "Player"
                SET "tournamentId" = (
                    SELECT "tournamentId"
                    FROM "Team"
                    WHERE "Team"."id" = "Player"."teamId"
                )
                WHERE "tournamentId" IS NULL;
            `);

            const missingTournamentIds = db
                .prepare('SELECT COUNT(*) as count FROM "Player" WHERE "tournamentId" IS NULL')
                .get().count;

            if (missingTournamentIds > 0) {
                throw new Error(`Unable to backfill tournamentId for ${missingTournamentIds} player rows.`);
            }
        }
    } finally {
        db.close();
    }
}

if (!databaseUrl.startsWith('file:')) {
    console.error(`Unsupported DATABASE_URL "${databaseUrl}". ApexPlay currently expects SQLite file URLs.`);
    process.exit(1);
}

const resolvedDatabaseUrl = resolveSQLiteUrl(databaseUrl);
const databaseFilePath = resolvedDatabaseUrl.slice('file:'.length);
preflightLegacySqliteSchema(databaseFilePath);
const hasExistingDatabase = fs.existsSync(databaseFilePath) && fs.statSync(databaseFilePath).size > 0;
const prismaCliPath = require.resolve('prisma/build/index.js');
const diffArgs = hasExistingDatabase
    ? [prismaCliPath, 'migrate', 'diff', '--from-url', resolvedDatabaseUrl, '--to-schema-datamodel', schemaPath, '--script']
    : [prismaCliPath, 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', schemaPath, '--script'];

const diffResult = spawnSync(process.execPath, diffArgs, {
    env: {
        ...process.env,
        DATABASE_URL: resolvedDatabaseUrl,
    },
    encoding: 'utf8',
});

if (diffResult.error || diffResult.status !== 0) {
    console.error(diffResult.stderr || diffResult.error);
    process.exit(diffResult.status || 1);
}

const migrationSql = diffResult.stdout.trim();
if (!migrationSql || migrationSql === 'No difference detected.') {
    console.log(`SQLite schema already up to date at ${resolvedDatabaseUrl}`);
} else {
    const executeResult = spawnSync(process.execPath, [prismaCliPath, 'db', 'execute', '--stdin', '--url', resolvedDatabaseUrl], {
        env: {
            ...process.env,
            DATABASE_URL: resolvedDatabaseUrl,
        },
        encoding: 'utf8',
        input: migrationSql,
    });

    if (executeResult.error || executeResult.status !== 0) {
        console.error(executeResult.stderr || executeResult.error);
        process.exit(executeResult.status || 1);
    }

    console.log(`Ensured SQLite schema at ${resolvedDatabaseUrl}`);
}
