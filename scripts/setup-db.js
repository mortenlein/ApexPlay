const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

const databaseUrl = process.env.DATABASE_URL || '';
let provider = 'sqlite';

if (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')) {
    provider = 'postgresql';
}

console.log(`Detected database provider: ${provider}`);

// Replace the provider in the schema file
const updatedSchema = schema.replace(/provider\s*=\s*"sqlite"/, `provider = "${provider}"`);

if (schema !== updatedSchema) {
    fs.writeFileSync(schemaPath, updatedSchema);
    console.log(`Updated prisma/schema.prisma to use ${provider}`);
} else {
    console.log(`prisma/schema.prisma already uses ${provider} or no change needed.`);
}
