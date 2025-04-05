import * as redis from "ioredis";
import { forever } from "async"
import { config  } from "dotenv";


interface RedisStreamField {
    [key: string]: string;
}

interface RedisStreamEntry {
    id: string;
    fields: RedisStreamField;
}

interface RedisStreamResponse {
    streamName: string;
    entries: RedisStreamEntry[];
}


config()

    //envs
const TOPICS = process.env.TOPICS;
const STREAM_HOST = process.env.STREAM_HOST;
const STREAM_PORT = process.env.STREAM_PORT;
const WORKER_ID = process.env.WORKER_ID;
//how much backlogs to clear: too much--> lot of wait, too less - entries drop
const BACKLOG_CLEAR_LIMIT = process.env.BACKLOG_LIMIT!
const STREAM_TOPIC = process.argv[2]!;
assertDefined(TOPICS, STREAM_HOST, STREAM_PORT, WORKER_ID, STREAM_TOPIC, BACKLOG_CLEAR_LIMIT)


const cursor = "0";
const MIN_IDLE_TIME = 0;
const GROUP = "workers";

const client = new redis.Redis({
    port: parseInt(STREAM_PORT!),
    host: STREAM_HOST
});


async function main(){
    var consumer_name = `worker-${WORKER_ID}`;
    await setup_group();
    await clearBacklog(consumer_name);
    forever(
        async(next)=>{
            const response = await client.call(
                "XREADGROUP", "GROUP", GROUP, consumer_name, "COUNT", 1, "BLOCK", 0, "STREAMS", STREAM_TOPIC, ">"
            ) as any;
            const parsedResponse = parseRedisStreamResponse(response);

            for (const stream of parsedResponse) {
                let topic = stream.streamName;
                let entry = stream.entries[0].fields
                let id = stream.entries[0].id; 
                await client.call("XACK", STREAM_TOPIC, GROUP, id);
            }
        }, 
        (err)=>{
            throw err;
        })
}
main();




async function setup_group(){
    try {
        await client.call(
            "XGROUP", "CREATE", STREAM_TOPIC, GROUP, cursor, "MKSTREAM"
        );
        console.log(`[INFO]stream consumer_group(${GROUP}) created!`)
    }
    catch(err: any){
        //group already exists  console.log(id)
        if(err.message.includes("BUDYGROUP"))
            console.log(`[INFO]stream consumer_group(${GROUP}) already exists... skipping group creation!`)
        if(!err.message.includes("BUSYGROUP"))
            throw err
    }
}


/** 
 * @function process the PEL entries from stream on startup
 * @description  if consumer's main worker, it still runs on redis, takes in entries as PEL, but no process / ACK :  so restart worker then process PEL ending first.
 * @see https://redis.io/docs/latest/commands/xautoclaim/  (re-claim PEL entries)
*/
async function clearBacklog(consumer: string){
    const result = await client.call(
        "XAUTOCLAIM", STREAM_TOPIC, GROUP, consumer, MIN_IDLE_TIME, "0", "COUNT", BACKLOG_CLEAR_LIMIT
    ) as [string, any[]];

    const pendingEntry = result[1];
    if (pendingEntry.length > 0) {
        for (const entry of pendingEntry) {
            let [id, msg] = entry
            //processed entry
            let dataList = JSON.parse(msg[1]);
            await client.call("XACK", STREAM_TOPIC, GROUP, id);
        }
    }
}


/**
 * @function checks if all given arguments are defined (not `undefined` or `null`).
 */
export function assertDefined(...vars: any[]): void {
    const undefinedIndexes = vars
        .map((value, index) => ((value === undefined || value === null || Number.isNaN(value)) ? index : -1))
        .filter(index => index !== -1);

    if (undefinedIndexes.length > 0) { 
        throw new Error(`Assertion failed: check environment variables, some are undefined`);
    }
}

/** 
 * @function parses redis stream's buffer response into: id, fields
 * @param response - stream buffer received from redis-stream's xreadgroup (reading from stream consumer group)
 * @returns 
 */
function parseRedisStreamResponse(response: any): RedisStreamResponse[] {
    return response.map(([streamName, entries]: [string, any[]]) => {
        return {
            streamName,
            entries: entries.map(([id, fields]: [string, any[]]) => {
                //[k1,v1,k2,v2,...] ==> jsonify 
                const fieldObj: RedisStreamField = {};
                for (let i = 0; i < fields.length; i += 2) {
                    fieldObj[fields[i]] = fields[i + 1];
                }
                
                return {
                    id,
                    //"data" key from stream's entry
                    fields: fieldObj['data']
                };
            })
        };
    });
}