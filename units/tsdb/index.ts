import pg, { Pool } from "pg";
import pino from "pino";


const logger = pino.pino();

const dbport = 5432;
const pgPool = new pg.Pool({
    user: 'postgres',
    password: 'password',
    host: 'localhost',
    port: 5432,
    database: 'testdb'
});

pgPool.on('error', (err, client: pg.PoolClient) => {
    console.error('Unexpected error on idle client', err)
    process.exit(-1)
})


async function multiTransaction(){
    const client = await pgPool.connect();
    try {
        await client.query("BEGIN");
        //queries
        await pgPool.query('SELECT * FROM users', [1])
        await client.query("COMMIT");
    } catch (err) {
        await client.query("ROLLBACK"); 
        console.error("Transaction failed:", err);
    } finally {
        client.release();
    } 
}
        

async function singleQuery(){
    const res = await pgPool.query('SELECT * FROM users', [1])
    logger.debug(`Responses: ${res}`);
}
