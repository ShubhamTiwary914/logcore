import { promises as fs } from 'fs'
import path from 'path'
import db from './conn'
import { Migrator, FileMigrationProvider } from 'kysely'


const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, 'migrations/'),
    }),
})


const migrationId = process.argv[2]
if (!migrationId) {
    console.error('migation id is required!')
    process.exit(1)
}

async function migrate() {
    console.log(`migrating to ${migrationId}`)
    const { error, results } = await migrator.migrateTo(migrationId);

    console.log(`Errors(if any): ${error}`);
    console.log(`Migration status: ${results}`);
}

migrate()