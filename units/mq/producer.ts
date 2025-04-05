import * as amqp from "amqplib"

const QUEUE = "test";



async function sendMessage() {
    try {
      const connection = await amqp.connect("amqp://localhost");
      const channel = await connection.createChannel();
      
      await channel.assertQueue(QUEUE, { durable: false });
  
      const message = "Hello from Node.js!";
      channel.sendToQueue(QUEUE, Buffer.from(message));
  
      console.log(`Sent: ${message}`);
  
      setTimeout(() => {
        connection.close();
        process.exit(0);
      }, 500);
    } catch (error) {
      console.error("Error:", error);
    }
  }
  
  sendMessage();