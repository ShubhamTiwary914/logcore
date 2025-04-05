import * as redis from "ioredis";

//default: localhost:6379
const redisClient = new redis.Redis();
const STREAM = "TEST_STREAM";



//>Connect
redisClient.on("connect", ()=>{
    console.log("Connedted to Redis (localhost)")
})



sendMessageStream("{'temp': 23.7, 'pressure': 22.8}");

async function sendMessageStream(msg: string){
    try{
        await redisClient.xadd(STREAM, '*', 'data', msg)
    }
    catch(error){ throw error; }
}
  

