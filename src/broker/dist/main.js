import mqtt from "mqtt";
import { config } from "dotenv";
import { cacheDeviceShadow, getTimestamp, initialiseConnections, streamPush } from "./utils.js";
import cliProgress from 'cli-progress';
config();
const HOST = process.env.BROKER_HOST;
const NODE_TOPICS = process.env.TOPICS;
const REGISTRY_PORT = process.env.REGISTRY_PORT;
const STREAM_PORT = process.env.STREAM_PORT;
const REGISTRY_HOST = process.env.REGISTRY_HOST;
const STREAM_HOST = process.env.STREAM_HOST;
assertDefined(HOST, NODE_TOPICS, REGISTRY_PORT, STREAM_PORT, REGISTRY_HOST, STREAM_HOST);
initialiseConnections(parseInt(REGISTRY_PORT), parseInt(STREAM_PORT), REGISTRY_HOST, STREAM_HOST);
const topics = NODE_TOPICS.split(',').map(topic => topic.trim());
var messageCounts;
var multibar;
var progressBars;
initialseCliProgress();
/** @description assumes port=1883 (default)  */
const client = mqtt.connect(`mqtt://${HOST}/`);
//connect & subscribe to all topics in process.env.TOPICS
client.on('connect', () => {
    console.log(`Connected to MQTT broker @${HOST}`);
    topics.forEach((topic) => {
        client.subscribe(topic, err => {
            if (err) {
                console.log(`Error subscribing to topic: ${topic}`);
                throw err;
            }
            else
                console.log(`subscribed to topic: ${topic}`);
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
    cacheDeviceShadow(deviceId, topic, timestamp);
    await streamPush(topic, message);
    messageCounts[topic]++;
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
function initialseCliProgress() {
    messageCounts = {};
    topics.forEach(topic => { messageCounts[topic] = 0; });
    multibar = new cliProgress.MultiBar({
        clearOnComplete: false,
        hideCursor: true,
        format: '\x1b[32m{topic}\x1b[0m : \x1b[36m{value}\x1b[0m messages'
    }, cliProgress.Presets.shades_classic);
    progressBars = {};
    topics.forEach(topic => {
        progressBars[topic] = multibar.create(100, 0, { topic });
    });
    setInterval(() => {
        topics.forEach(topic => {
            progressBars[topic].update(messageCounts[topic]);
        });
    }, 1000);
}
