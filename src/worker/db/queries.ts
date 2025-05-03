import db from './conn'
import { topicTables } from './schemas'


/** @function insert = 1 rows at once*/
export async function insertOne(topic: topicTables, payload: any){ 
    try{
        await db.insertInto(topic).values(payload).execute();
    }
    catch(err){
        throw err;
    }
}


/** @function insert > 1 rows at once (array of payloads)*/
export async function insertMany(topic: topicTables, payload: [any]){
    await db.insertInto(topic).values(payload).execute();
}

/** @function fetch rows from topic with match deeviceId */
export async function getBydeviceId(topic: topicTables,deviceId: number){
    return await db.selectFrom(topic).where('deviceId','=',deviceId).execute();
}


