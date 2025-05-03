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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertDefined = assertDefined;
const redis = __importStar(require("ioredis"));
const async_1 = require("async");
const dotenv_1 = require("dotenv");
const queries_1 = require("./db/queries");
const cluster_1 = __importDefault(require("cluster"));
const cli_table_1 = __importDefault(require("cli-table"));
const readline_1 = __importDefault(require("readline"));
const os_1 = require("os");
(0, dotenv_1.config)();
//envs
const TOPICS = process.env.TOPICS;
const STREAM_HOST = process.env.STREAM_HOST;
const STREAM_PORT = process.env.STREAM_PORT;
//how much backlogs to clear: too much--> lot of wait, too less - entries drop
const BACKLOG_CLEAR_LIMIT = process.env.BACKLOG_LIMIT;
const STREAM_TOPIC = process.argv[2];
assertDefined(TOPICS, STREAM_HOST, STREAM_PORT, STREAM_TOPIC, BACKLOG_CLEAR_LIMIT);
const cursor = "0";
const MIN_IDLE_TIME = 0;
const GROUP = "workers";
const client = new redis.Redis({
    port: parseInt(STREAM_PORT),
    host: STREAM_HOST
});
const cpus = (0, os_1.availableParallelism)();
var progress = Array.from({ length: 1 }, () => Array(cpus + 1).fill(0));
var totall = 0;
var workers = 0;
if (cluster_1.default.isPrimary) {
    setInterval(() => {
        readline_1.default.cursorTo(process.stdout, 0, 0);
        readline_1.default.clearScreenDown(process.stdout);
        var table = new cli_table_1.default({
            head: [STREAM_TOPIC],
            chars: { 'top': '═', 'top-mid': '╤', 'top-left': '╔', 'top-right': '╗',
                'bottom': '═', 'bottom-mid': '╧', 'bottom-left': '╚', 'bottom-right': '╝',
                'left': '║', 'left-mid': '╟', 'mid': '─', 'mid-mid': '┼',
                'right': '║', 'right-mid': '╢', 'middle': '│' }
        });
        progress[0][0] = totall;
        table.push(...progress);
        console.log(`active workers: ${workers + 1}\n`);
        console.log("Writes to DB:");
        console.log(table.toString());
    }, 3000);
    for (let i = 0; i < cpus - 1; i++) {
        const worker = cluster_1.default.fork();
        worker.on('online', () => {
            console.log(`node-cluster: worker ${workers++} started!`);
        });
        worker.on('error', (err) => {
            workers--;
            throw err;
        });
        worker.on('disconnect', () => workers--);
        worker.on('exit', (code, signal) => {
            workers--;
        });
        worker?.on('message', (msg) => {
            if (msg.type === 'msg') {
                const { wid } = msg;
                updateProgress(wid);
                totall++;
            }
        });
    }
    console.log('\n');
}
async function main() {
    let wid = cluster_1.default.worker?.id ?? 0;
    var consumer_name = `worker-${STREAM_TOPIC}-${wid}`;
    console.log(`db:${consumer_name} has entered the arena!`);
    await setup_group();
    await clearBacklog(consumer_name);
    (0, async_1.forever)(async (next) => {
        const response = await client.call("XREADGROUP", "GROUP", GROUP, consumer_name, "COUNT", 1, "BLOCK", 0, "STREAMS", STREAM_TOPIC, ">");
        const parsedResponse = parseRedisStreamResponse(response);
        for (const stream of parsedResponse) {
            let topic = stream.streamName;
            let entry = JSON.parse(stream.entries[0].fields);
            entry['time'] = getCurrentTime();
            let id = stream.entries[0].id;
            await (0, queries_1.insertOne)(topic, entry);
            if (cluster_1.default.isWorker) {
                process.send?.({ type: 'msg', wid });
            }
            else {
                updateProgress(wid);
                totall++;
            }
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
/**
 * @function returns the current timestamp (ISO format)
 */
function getCurrentTime() {
    return new Date().toISOString();
}
function updateProgress(id) {
    progress[0][id + 1]++;
}
