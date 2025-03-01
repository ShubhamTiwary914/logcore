/**
 * @see https://mosquitto.org/man/mosquitto-8.html
 * @fileoverview main-worker process, ingest, process & publish
 * @requires cli arguments:  --id <number> : worker-id (unique)
 * @example:  npx ts-node main.ts --id 23
 * 
 * ==== Use Cases ======
 * 1. Listen to redis stream (registry subscriber)
 * 2. Processing before sending (processor call)
 * 3. Publishing to topics needed (db/event/obj)
*/


import * as redis from "ioredis";
import { forever } from "async"
import minimist from "minimist"
import assert from "assert"
import { configDotenv } from "dotenv";
import pino from "pino";


//*Objects
configDotenv();
const logger = pino()
const cursor = "0";
const client = new redis.Redis();

//*Consts
const STREAM_KEY = process.env.redis_key_group!;
const GROUP = "main-workers";
//pending limit: claim entries upto this time in past (ms)
const MIN_IDLE_TIME = 0;
//how much backlogs to clear: too much--> lot of wait, too less - entries drop
const BACKLOG_CLEAR_LIMIT = 10000;



async function main(){
    var cli_args = minimist(process.argv.slice(2))
    var workerId : Number = Number(cli_args["id"])
    //must pass --id cli arg (number)
    assert(!Number.isNaN(workerId))
    //"redis_key_group" should be present in .env
    assert(STREAM_KEY != undefined);
    var consumer_name = `main-worker-${workerId}`;

    //setup & wait first clear backlog
    await setup_group();
    await clearBacklog(consumer_name);
    forever(async(next)=>{
        const response = await client.call(
            "XREADGROUP", "GROUP", GROUP, consumer_name, "COUNT", 1, "BLOCK", 0, "STREAMS", STREAM_KEY, ">"
        ) as any;
        //preprocess
        let msgArr = response[0][1]
        let id = msgArr[0][0]
        let dataList = msgArr[0][1][1]
        dataList = JSON.parse(dataList)
        
        await client.call("XACK", STREAM_KEY, GROUP, id);
    }, (err)=>{{
        throw err;
    }})
}
main();



/** 
 * @function process the PEL entries from stream on startup
 * @description  if consumer's main worker, it still runs on redis, takes in entries as PEL, but no process / ACK :  so restart worker then process PEL ending first.
 * @see https://redis.io/docs/latest/commands/xautoclaim/  (re-claim PEL entries)
*/
async function clearBacklog(consumer: string){
    const result = await client.call(
        "XAUTOCLAIM", STREAM_KEY, GROUP, consumer, MIN_IDLE_TIME, "0", "COUNT", BACKLOG_CLEAR_LIMIT
    ) as [string, any[]];

    const pendingEntry = result[1];
    if (pendingEntry.length > 0) {
        for (const entry of pendingEntry) {
            let [id, msg] = entry
            //processed entry
            let dataList = JSON.parse(msg[1]);
            await client.call("XACK", STREAM_KEY, GROUP, id);
        }
    }
}



async function setup_group(){
    try {
        await client.call(
            "XGROUP", "CREATE", STREAM_KEY, GROUP, cursor, "MKSTREAM"
        );
    }
    catch(err: any){
        //group already exists: ignore
        if(!err.message.includes("BUSYGROUP"))
            throw err
    }
}




/**
 * @param fields message received from redis (after taking out the data)
 * @description parse response from redis (ex:  [k1, v1, k2, v2] ==>  {k1: v1, k2: v2})  
 * @returns parsed object 
*/
function parseFields(fields: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      result[fields[i]] = fields[i + 1];
    }
    return result;
}