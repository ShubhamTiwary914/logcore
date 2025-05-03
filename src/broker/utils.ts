import ioredis from "ioredis";


export var registryConn : ioredis.Redis;
export var streamConn: ioredis.Redis;


export function connectRedis(id : string, port : number= 6379, host : string ='localhost') : ioredis.Redis {
    var redisSock : ioredis.Redis;
    try{
        redisSock = new ioredis.Redis({ 
            port: port, host: host
        });
        
        redisSock.on('error', (err) => {
            console.error("Redis connection error:", err);
            process.exit(1);
        });
        console.log(`connected ${id}(redis) @${host}:${port}`)
        return redisSock;
    }
    catch(err){
        console.error("Failed to connect to Redis:", err);
        process.exit(1);
    }
}

export function initialiseConnections(registryPort : number, streamPort : number, regHost: string, streamHost: string) : void{
    registryConn = connectRedis("registry", registryPort, regHost)
    streamConn = connectRedis("stream", streamPort, streamHost)
}



/** push mqtt message buffer onto redis-stream (group-by: topic)
*/
export async function streamPush(topic: string, message: Buffer) : Promise<void>{
    //* = auto-gen new id
    await streamConn.xadd(topic, '*', 'data', message)
}




/** mark device's active status: last topic + timestamp of last active, any requests <= 1 min = active
 * @param deviceId (attached with the payload)
 * @param topic of the message
 * @param timestamp when message was received
 */
export async function cacheDeviceShadow(deviceId: number, topic: string, timestamp: string){
    const baseKey = `shadow:device-${deviceId}`; 
    registryConn.set(`${baseKey}:topic`, topic);
    registryConn.set(`${baseKey}:timestamp`, timestamp);
}

export function getTimestamp() : string{
    return new Date().toISOString()
}