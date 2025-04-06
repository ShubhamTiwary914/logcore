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


const action = process.argv[2]
const migrationId = process.argv[3]


if(action == 'show'){
    (async()=>{
        console.log(await migrator.getMigrations())
    })().then(()=>{
        process.exit(0)
    });
}

else if(action == 'down'){
    (async()=>{
        await migrator.migrateDown();
        console.log(`Migration rollbacked!`);
    })()
}

else{
    if (!migrationId) {
        console.error('migation id is required!')
        process.exit(1)
    }
    migrate().then(()=>{
        process.exit(0)  
    })
}



async function migrate() { 
    console.log(`migrating to ${migrationId}`)
    const { error, results } = await migrator.migrateTo(migrationId);

    if(error != undefined)
        console.log(`Errors: ${error}`);
    console.log(`Migration status: `);
    console.log(results)
}