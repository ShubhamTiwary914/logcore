import mqtt from "mqtt";
import cluster from "cluster";
import { availableParallelism } from "os";
import { config } from "dotenv";
import Table from "cli-table";
import readline from "readline";
import { cacheDeviceShadow, getTimestamp, initialiseConnections, streamPush } from "./utils.js";
config();
const HOST = process.env.BROKER_HOST;
const NODE_TOPICS = process.env.TOPICS;
const REGISTRY_PORT = process.env.REGISTRY_PORT;
const STREAM_PORT = process.env.STREAM_PORT;
const REGISTRY_HOST = process.env.REGISTRY_HOST;
const STREAM_HOST = process.env.STREAM_HOST;
const cpu_cores = availableParallelism();
assertDefined(HOST, NODE_TOPICS, REGISTRY_PORT, STREAM_PORT, REGISTRY_HOST, STREAM_HOST);
initialiseConnections(parseInt(REGISTRY_PORT), parseInt(STREAM_PORT), REGISTRY_HOST, STREAM_HOST);
const topics = NODE_TOPICS.split(',').map(topic => topic.trim());
const progress = Array.from({ length: cpu_cores }, () => Array(4).fill(0));
const topicsList = {
    "boiler": 1,
    "logistics": 2,
    "greenhouse": 3
};
/** @description assumes port=1883 (default)  */
const client = mqtt.connect(`mqtt://${HOST}/`);
let workers = 0;
function primaryWorker() {
    if (cluster.isPrimary) {
        setInterval(() => {
            readline.cursorTo(process.stdout, 0, 0);
            readline.clearScreenDown(process.stdout);
            var table = new Table({
                head: ["worker_id", "boiler", "logistics", "greenhouse"],
                chars: { 'top': '═', 'top-mid': '╤', 'top-left': '╔', 'top-right': '╗',
                    'bottom': '═', 'bottom-mid': '╧', 'bottom-left': '╚', 'bottom-right': '╝',
                    'left': '║', 'left-mid': '╟', 'mid': '─', 'mid-mid': '┼',
                    'right': '║', 'right-mid': '╢', 'middle': '│' }
            });
            table.push(...progress);
            console.log("Messages processed by Broker consumers:");
            console.log(table.toString());
        }, 1000);
        for (let i = 0; i < cpu_cores; i++) {
            let worker = cluster.fork();
            worker?.on('message', (msg) => {
                if (msg.type === 'msg') {
                    const { topic, wid } = msg;
                    updateProgress(topic, wid);
                }
            });
            worker.on('online', () => {
                progress[workers][0] = workers;
                console.log(`node-cluster: worker ${workers++} started!`);
            });
        }
    }
}
primaryWorker();
//connect & subscribe to all topics in process.env.TOPICS
client.on('connect', () => {
    // console.log(`Connected to MQTT broker @${HOST}`)
    topics.forEach((topic) => {
        client.subscribe(`$share/cluster/${topic}`, err => {
            if (err) {
                console.log(`Error subscribing to topic: $share/cluster/${topic}`);
                throw err;
            }
        });
    });
});
client.on('error', (error) => {
    throw error;
});
client.on('message', async (topic, message) => {
    let messageParsed = JSON.parse(message.toString());
    let deviceId = messageParsed['deviceId'];
    let timestamp = getTimestamp();
    if (topic != "") {
        cacheDeviceShadow(deviceId, topic, timestamp);
        await streamPush(topic, message);
        const wid = cluster.worker?.id ?? -1;
        if (cluster.isWorker)
            process.send?.({ type: 'msg', topic, wid });
        else
            updateProgress(topic, wid);
    }
});
/**
 * Checks if all given arguments are defined (not `undefined` or `null`).
 * Logs missing arguments and throws an error.
 */
export function assertDefined(...vars) {
    const undefinedIndexes = vars
        .map((value, index) => (value === undefined || value === null ? index : -1))
        .filter(index => index !== -1);
    if (undefinedIndexes.length > 0) {
        throw new Error(`Assertion failed: check environment variables, some are undefined`);
    }
}
//>stats & logging
function updateProgress(topic, id) {
    const col = topicsList[topic];
    id--;
    if (!progress[id]) {
        progress[id] = Array(4).fill(0);
        progress[id][0] = id;
    }
    progress[id][col]++;
}
