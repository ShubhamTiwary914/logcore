import cluster from "cluster";
import { availableParallelism } from "os";
import mqtt from "mqtt";


//>main worker
var workers = 0;
if(cluster.isPrimary){ 

    const cpu_cores = availableParallelism()
    console.log(`CPU cores available: ${cpu_cores}`)
    for(let i=0; i<cpu_cores; i++){
        let worker = cluster.fork();

        worker.on('online', ()=>{
            console.log(`node-cluster: worker ${workers++} started!`);
        })
        worker.on('error', (err)=>{
            throw err;
        })
        worker.on('disconnect', ()=>{
            console.log(`node-cluster: worker disconnected! remaining: ${--workers}`);
        })

        worker.on('exit', (code, signal) => {
            if (signal) {
                console.log(`worker was killed by signal: ${signal}`);
            } else if (code !== 0) {
                console.log(`worker exited with error code: ${code}`);
            } else {
                console.log('worker success!');
            }
        });
    }
}
