import pg from "pg";
import { PostgresDialect, Kysely } from "kysely";
import { DatabaseSchema } from "./schemas";
import { config } from "dotenv";


config();

var pgPool : PostgresDialect

pgPool = new PostgresDialect({
    pool: new pg.Pool({
        user: process.env.TSDB_USER,
        password: process.env.TSDB_PASSWORD,
        host: process.env.TSDB_HOST,
        port: parseInt(process.env.TSDB_PORT!),
        database: process.env.TSDB_DATABASE,
        max: 20,
    })
}) 

console.log(`User: ${process.env.TSDB_USER}`)


export default new Kysely<DatabaseSchema>({
    dialect: pgPool
});
