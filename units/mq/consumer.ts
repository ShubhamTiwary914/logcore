import amqp from "amqplib" 

const QUEUE = "test";




async function connect(){
    try {
        const connection = await amqp.connect("amqp://localhost"); // RabbitMQ default port 5672
        const channel = await connection.createChannel();
        channel.assertQueue(QUEUE, {
            durable: false
        })
        console.log(`Consumer waiting for message from queue: ${QUEUE}`)

        channel.consume(QUEUE, (msg: amqp.ConsumeMessage | null)=>{
            console.log(`Message received from queue: ${msg!.content.toString()}`)
            channel.ack(msg!);
        })
    }
    catch(error){
        console.log(error);
        throw error;
    }
}

connect();

