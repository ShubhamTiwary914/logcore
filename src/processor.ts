/**
 * @fileoverview main-worker process, ingest, process & publish
*/



/**
 * @description map <topic, function>: processes' to pass before push to topic
*/
const procesStore : Record<string, Function> = {
    "db": (params: object) => process_timeScale(params),
    "obj": (params: object) => process_S3(params),
    "event": (params: object) => process_lambda(params)
} 


function process_timeScale(params: object){
    
}


function process_S3(params: object){

}

function process_lambda(params: object){

}