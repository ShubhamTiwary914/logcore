"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertDefined = assertDefined;
const redis = __importStar(require("ioredis"));
const async_1 = require("async");
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)({
    path: './.worker.env'
});
//envs
const TOPICS = process.env.TOPICS;
const STREAM_HOST = process.env.STREAM_HOST;
const STREAM_PORT = process.env.STREAM_PORT;
const WORKER_ID = process.env.WORKER_ID;
//how much backlogs to clear: too much--> lot of wait, too less - entries drop
const BACKLOG_CLEAR_LIMIT = process.env.BACKLOG_LIMIT;
const STREAM_TOPIC = process.argv[2];
assertDefined(TOPICS, STREAM_HOST, STREAM_PORT, WORKER_ID, STREAM_TOPIC, BACKLOG_CLEAR_LIMIT);
const cursor = "0";
const MIN_IDLE_TIME = 0;
const GROUP = "workers";
const client = new redis.Redis({
    port: parseInt(STREAM_PORT),
    host: STREAM_HOST
});
async function main() {
    var consumer_name = `worker-${WORKER_ID}`;
    await setup_group();
    await clearBacklog(consumer_name);
    (0, async_1.forever)(async (next) => {
        const response = await client.call("XREADGROUP", "GROUP", GROUP, consumer_name, "COUNT", 1, "BLOCK", 0, "STREAMS", STREAM_TOPIC, ">");
        const parsedResponse = parseRedisStreamResponse(response);
        for (const stream of parsedResponse) {
            let topic = stream.streamName;
            let entry = stream.entries[0].fields;
            let id = stream.entries[0].id;
            await client.call("XACK", STREAM_TOPIC, GROUP, id);
        }
    }, (err) => {
        throw err;
    });
}
main();
async function setup_group() {
    try {
        await client.call("XGROUP", "CREATE", STREAM_TOPIC, GROUP, cursor, "MKSTREAM");
        console.log(`[INFO]stream consumer_group(${GROUP}) created!`);
    }
    catch (err) {
        //group already exists  console.log(id)
        if (err.message.includes("BUDYGROUP"))
            console.log(`[INFO]stream consumer_group(${GROUP}) already exists... skipping group creation!`);
        if (!err.message.includes("BUSYGROUP"))
            throw err;
    }
}
/**
 * @function process the PEL entries from stream on startup
 * @description  if consumer's main worker, it still runs on redis, takes in entries as PEL, but no process / ACK :  so restart worker then process PEL ending first.
 * @see https://redis.io/docs/latest/commands/xautoclaim/  (re-claim PEL entries)
*/
async function clearBacklog(consumer) {
    const result = await client.call("XAUTOCLAIM", STREAM_TOPIC, GROUP, consumer, MIN_IDLE_TIME, "0", "COUNT", BACKLOG_CLEAR_LIMIT);
    const pendingEntry = result[1];
    if (pendingEntry.length > 0) {
        for (const entry of pendingEntry) {
            let [id, msg] = entry;
            //processed entry
            let dataList = JSON.parse(msg[1]);
            await client.call("XACK", STREAM_TOPIC, GROUP, id);
        }
    }
}
/**
 * @function checks if all given arguments are defined (not `undefined` or `null`).
 */
function assertDefined(...vars) {
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
function parseRedisStreamResponse(response) {
    return response.map(([streamName, entries]) => {
        return {
            streamName,
            entries: entries.map(([id, fields]) => {
                //[k1,v1,k2,v2,...] ==> jsonify 
                const fieldObj = {};
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
