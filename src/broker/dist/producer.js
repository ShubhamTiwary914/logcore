import mqtt from "mqtt";
import assert from "assert";
import schema from "./topics.json" with { type: 'json' };
//topics' schema 
const schemas = schema;
//generators 
const randomFloat = (min = 0, max = 100) => Number((Math.random() * (max - min) + min).toFixed(2));
const randomStatus = () => (Math.random() > 0.5 ? "ON" : "OFF");
const randomGPS = () => ({
    lat: randomFloat(-90, 90),
    lon: randomFloat(-180, 180),
});
// generate random data based on a schema
function generateRandomData(schema) {
    const data = {
        deviceId: getRandomDeviceId()
    };
    for (const [key, type] of Object.entries(schema)) {
        if (type === "float") {
            data[key] = randomFloat();
        }
        else if (type === "string") {
            // For some fields we choose a status; for others, a generic string
            if (key.toLowerCase().includes("status") || key.toLowerCase().includes("position"))
                data[key] = randomStatus();
            else
                data[key] = "sample";
        }
        else if (type === "object" && key === "gps_location") {
            data[key] = randomGPS();
        }
        else {
            data[key] = null;
        }
    }
    return data;
}
// read CLI args 
if (process.argv.length < 4) {
    console.error("Usage: node ./test.ts <topic> <messages> <interval-count> <intervalgap>");
    process.exit(1);
}
const topic = process.argv[2];
const messagesPerInterval = parseInt(process.argv[3], 10);
const numberOfIntervals = parseInt(process.argv[4], 10);
const intervalMs = parseInt(process.argv[5], 10);
assert(topic != undefined);
assert(!Number.isNaN(messagesPerInterval));
assert(!Number.isNaN(numberOfIntervals));
assert(!Number.isNaN(intervalMs));
console.log(`Received args: 
  \ntopic: ${topic}
  \nmessages(per interval):${messagesPerInterval}
  \ninterval-count: ${numberOfIntervals}
  \ninterval gap(ms): ${intervalMs}
`);
// device ID range
const idRange = [100, 200];
const getRandomDeviceId = () => Math.floor(Math.random() * (idRange[1] - idRange[0] + 1)) + idRange[0];
// when connected, start publishing
const client = mqtt.connect("mqtt://localhost");
client.on('connect', () => {
    let counter = 0;
    let totalCount = 0;
    let timer = setInterval(() => {
        //*single round
        for (let i = 0; i < messagesPerInterval; i++) {
            //@ts-ignore
            const payload = generateRandomData(schemas[topic]);
            client.publish(topic, JSON.stringify(payload));
            totalCount++;
        }
        console.log(`[Interval ${counter}]: sent ${totalCount} messages`);
        counter++;
        if (counter >= numberOfIntervals) {
            console.log(`\nFinished publishing messages`);
            clearInterval(timer);
            client.end();
        }
    }, intervalMs);
});
client.on('error', (error) => {
    console.error('MQTT Broker Error:', error.message);
    if (error.message.includes('connect ECONNREFUSED')) {
        console.error('MQTT Broker is offline. Please ensure the broker is running.');
    }
    process.exit(1);
});
client.on('close', () => {
    console.log('MQTT connection closed');
    process.exit(0);
});
