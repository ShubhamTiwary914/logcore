/**
 * @see https://redis.io/docs/latest/develop/data-types/streams/ (redis streams)
 * @fileoverview stream-worker process, middleman between broker & redis-stream
 * Devices --> MQTTbroker (buffer) --> stream-worker ---> redis-stream ---> main-workers(consumer group)
 */


import * as mqtt from "mqtt";
import * as redis from "ioredis";
import { configDotenv } from "dotenv";
import { assert } from "console";


configDotenv();
const BROKER_HOST = process.env.brokerHOST;
const BROKER_PORT = process.env.brokerPORT;
const MQTT_CONN_URI = `mqtt://${BROKER_HOST}:${BROKER_PORT}`
const QUEUE_TOPIC = 'stream'

const redisClient = new redis.Redis();
const STREAM = process.env.redis_key_group!;

//"redis_key_group" should be present in .env
assert(STREAM != undefined)


//>Connect
const mqttClient = mqtt.connect(MQTT_CONN_URI)
redisClient.on("connect", ()=>{
    console.log("Connedted to Redis (localhost)")
})


//>Consume (from broker)
mqttClient.on("connect", () => {
    console.log(`Connected to ${MQTT_CONN_URI}`)
    mqttClient.subscribe(QUEUE_TOPIC, (err) => {
        if(err) 
            throw err;    
    });
})


//>Publish (to redis-stream)
mqttClient.on("message", async (topic: string, msg: Buffer)=>{
    //only sibscribed to queue --> only receive from queue.
    assert(topic === QUEUE_TOPIC)
    try{
        await redisClient.xadd(STREAM, '*', 'data', msg)
    }
    catch(err){
        throw err;
    }
})


mqttClient.on('error', (err)=>{
    throw err;
})




