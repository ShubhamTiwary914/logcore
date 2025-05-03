import mqtt from "mqtt";
import schema from "./topics.json" with { type: 'json' };
import cluster from "cluster";
import { availableParallelism } from "os";
import Table from "cli-table";
import readline from "readline";


//topics' schema 
const schemas = schema

//generators 
const randomFloat = (min = 0, max = 100) =>
  Number((Math.random() * (max - min) + min).toFixed(2));
const randomStatus = () => (Math.random() > 0.5 ? "ON" : "OFF");
const randomGPS = () => ({
  lat: randomFloat(-90, 90),
  lon: randomFloat(-180, 180),
});
// generate random data based on a schema
function generateRandomData(schema: Record<string, string>): Record<string, any> {
  const data: Record<string, any> = {
    deviceId: getRandomDeviceId() 
  };
  
  for (const [key, type] of Object.entries(schema)) {
    if (type === "float") {
      data[key] = randomFloat();
    } else if (type === "string") {
      // For some fields we choose a status; for others, a generic string
      if (key.toLowerCase().includes("status") || key.toLowerCase().includes("position"))
        data[key] = randomStatus();
      else data[key] = "sample";
    } else if (type === "object" && key === "gps_location") {
      data[key] = randomGPS();
    } else {
      data[key] = null;
    }
  }
  return data;
}

const topic = process.argv[2]!;
const messagesPerInterval = 2004 //2004 / 12 = 167 msg(per node)
const numberOfIntervals = 180*3 //451 mins
const intervalMs = 5000 //2 secs




const cpus = availableParallelism();
var progress = Array.from({ length: 1 }, () => Array(cpus+1).fill(0));


var workers = 0;

if(cluster.isPrimary){
    setInterval(()=>{
        readline.cursorTo(process.stdout, 0, 0);
        readline.clearScreenDown(process.stdout);
        var table = new Table({
            head: [topic],
            chars: { 'top': '═' , 'top-mid': '╤' , 'top-left': '╔' , 'top-right': '╗'
                    , 'bottom': '═' , 'bottom-mid': '╧' , 'bottom-left': '╚' , 'bottom-right': '╝'
                    , 'left': '║' , 'left-mid': '╟' , 'mid': '─' , 'mid-mid': '┼'
                    , 'right': '║' , 'right-mid': '╢' , 'middle': '│' }
            },
        );
        var totall = 0
        for(let i=1; i<=12; i++)
          totall += progress[0][i]
        progress[0][0]= totall
        table.push(...progress)
        console.log(`active workers: ${workers+1}\n`)
        console.log("Messages processed by Broker producers:")
        console.log(table.toString())
    }, 3000);
  for(let i=0; i<cpus-1; i++){
    const worker = cluster.fork()
    worker.on('online', ()=>{ 
        console.log(`node-cluster: worker ${workers++} started!`);
    })

    worker.on('error', (err)=>{
      workers--;
      throw err;
    })

    worker.on('disconnect', ()=> workers--)
    worker.on('exit', (code, signal)=>{
      workers--;
    })

    worker?.on('message', (msg) => {
      if (msg.type === 'msg') {
          const { topic, wid, count } = msg;
          updateProgress(topic, wid, count)
        }
    });


  } 
}

const idRange = [100, 200];
const getRandomDeviceId = () => Math.floor(Math.random() * (idRange[1] - idRange[0] + 1)) + idRange[0];


// when connected, start publishing
const client = mqtt.connect("mqtt://10.10.10.2", {
  keepalive: 120,           
  reconnectPeriod: 1000,   
  connectTimeout: 10_000,  
  clean: true,             
  clientId: `dev-${Math.random().toString(16).slice(2)}`
});


client.on('connect', () => {
  let interval = 0;
  let counter = 0;
  let timer = setInterval(() => {
    //*single round
    for (let i = 0; i < messagesPerInterval/cpus; i++) {
      //@ts-ignore
      const payload = generateRandomData(schemas[topic]);
      client.publish(topic, JSON.stringify(payload));
      counter++;
    }

    const wid = cluster.worker?.id ?? 0;
    if (cluster.isWorker) {
      process.send?.({ type: 'msg', topic, wid, count: counter});
    }
    else{
      updateProgress(topic, wid, counter)
    }
    updateProgress(topic, wid, counter);
    interval++;
    
    if (interval >= numberOfIntervals) {
      clearInterval(timer);
      client.end();
    }
  }, intervalMs);
})

client.on('error', (error) => {
  console.error('MQTT Broker Error:', error.message);
  if (error.message.includes('connect ECONNREFUSED')) {
    console.error('MQTT Broker is offline. Please ensure the broker is running.');
  }
  throw error;
});

client.on('close', () => {
  console.log('MQTT connection closed');
  process.exit(0);
});

function updateProgress(topic: string, id: number, count: number){
    progress[0][id+1] = count;
}