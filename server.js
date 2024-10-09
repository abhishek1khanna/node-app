import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import userModel from './userModel.js';
import { createClient } from 'redis';
import amqp from 'amqplib';
import axios from 'axios';

dotenv.config();

const redisClient = createClient({
    url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
});
redisClient.connect().catch(err => console.error('Redis Client Error', err));

const port = process.env.PORT;
const app = express();

app.use(express.json());

let connections = {}; // Store connections and channels for each user

// Connect to RabbitMQ and manage channels for multiple users
const connectRabbitMQ = async (user) => {
  if (!connections[user]) {  // Check if the connection for the user exists
    try {
      const connection = await amqp.connect('amqp://rabbitmq');
      const channel = await connection.createChannel();
      const queue = `queue_${user}`; // Create a queue for each user

      await channel.assertQueue(queue, { durable: false });
      connections[user] = { channel, queue };  // Store the channel and queue for the user
      console.log(`Created queue ${queue} for user ${user}`);
    } catch (error) {
      console.error(`Failed to connect to RabbitMQ for user ${user}`, error);
    }
  }
};

// POST route to send messages to a specific user's queue
app.post('/send', async (req, res) => {
  const { user, message } = req.body;  // Get the user and message from the request body

  if (!user || !message) {
    return res.status(400).send({ error: 'User and message are required' });
  }

  // Connect to RabbitMQ for the specific user
  await connectRabbitMQ(user);

  const { channel, queue } = connections[user]; // Get the user's channel and queue

  // Send a message to the user's queue
  channel.sendToQueue(queue, Buffer.from(message));
  console.log(`Sent to ${queue}: ${message}`);
  res.send({ status: 'Message sent successfully to user', user, message });
});

// GET route to consume messages from a specific user's queue
app.post('/receive-old', async (req, res) => {
  const { user } = req.body;  // Get the user from the query parameters

  if (!user) {
    return res.status(400).send({ error: 'User is required' });
  }

  // Connect to RabbitMQ for the specific user
  await connectRabbitMQ(user);

  const { channel, queue } = connections[user]; // Get the user's channel and queue

  let messages = [];

  channel.consume(queue, (msg) => {
    if (msg !== null) {
      const messageContent = msg.content.toString();
      console.log(`Received from ${queue}: ${messageContent}`);
      messages.push(messageContent);
      channel.ack(msg);  // Acknowledge message
    }
  }, { noAck: false });

  // Give RabbitMQ some time to consume messages (1 second), then send the response
  setTimeout(() => {
    if (messages.length > 0) {
      res.send({ messages });
    } else {
      res.send({ message: 'No messages in queue' });
    }
  }, 1000);  // Wait for 1 second to collect messages
});


app.post('/receive', async (req, res) => {
  const { user } = req.body;   // Get the user from the query parameters

  if (!user) {
    return res.status(400).send({ error: 'User is required' });
  }

  const { channel, queue } = connections[user]; // Get the user's channel and queue

  if (!channel || !queue) {
    return res.status(404).send({ error: 'Queue not found for the user' });
  }

  let messages = [];
  
  // Promise to consume messages
  const consumeMessages = () => {
    return new Promise((resolve, reject) => {
      // Set a timeout to reject if no message is received within a specified time
      const timeoutId = setTimeout(() => {
        resolve(messages); // Resolve with empty messages if timeout occurs
      }, 5000); // Set timeout for 5 seconds

      channel.consume(queue, (msg) => {
        if (msg !== null) {
          const messageContent = msg.content.toString();
          console.log(`Received from ${queue}: ${messageContent}`);
          messages.push(messageContent);
          channel.ack(msg); // Acknowledge message
          clearTimeout(timeoutId); // Clear timeout if a message is received
          resolve(messages); // Resolve with the received messages
        }
      }, { noAck: false });
    });
  };

  try {
    const receivedMessages = await consumeMessages();

    if (receivedMessages.length > 0) {
      res.send({ messages: receivedMessages }); // Send messages to Postman
    } else {
      res.send({ message: 'No messages in queue' }); // No messages found
    }
  } catch (error) {
    console.error('Error receiving messages:', error);
    res.status(500).send({ error: 'Error receiving messages' });
  }
});



/* let channel;  // Declare the channel variable globally
const queue = 'hello';  // Declare queue globally

// Connect to RabbitMQ server using Promises API
const connectRabbitMQ = async () => {
  try {
    const connection = await amqp.connect('amqp://rabbitmq');
    channel = await connection.createChannel();  // Assign the created channel to the global variable

    await channel.assertQueue(queue, { durable: false });

    // POST route to send messages to RabbitMQ
    app.post('/send', async (req, res) => {
      const msg = req.body.message;  // Get message from the request body

      if (!msg) {
        return res.status(400).send({ error: 'Message is required' });
      }

      // Send a message to the queue
      channel.sendToQueue(queue, Buffer.from(msg));
      console.log(`Sent: ${msg}`);
      res.send({ status: 'Message sent successfully' });
    });

  } catch (error) {
    console.error('Failed to connect to RabbitMQ', error);
  }
};

connectRabbitMQ(); */

app.get('/', async (req, res) => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    if (conn) {
      const result = await userModel.find();
      res.send(`Connected to DB. Environment: ${process.env.NODE_ENV}, Port: ${process.env.PORT}, DB: ${process.env.MONGODB_URI}, User: ${result}`);
    }
  } catch (err) {
    res.send(`Environment: ${process.env.NODE_ENV}, Port: ${process.env.PORT}, DB: ${process.env.MONGODB_URI}, Error: ${err}`);
  }
});

const getRepos = async (req, res, next) => {
  try {
    console.log('Fetching Data from Github');

    const username = 'abhishek1khanna';
    const { data } = await axios.get(`https://api.github.com/users/${username}`);
    
    const repos = data;

    // Set data to Redis
    const reposString = JSON.stringify(repos);
    await redisClient.set(username, reposString, 'EX', 3600); // Set data with expiry time

    res.send({ repos: repos, username: username });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
};

const cache = async (req, res, next) => {
  const username = 'abhishek1khanna';
  console.log('From Redis cache');
  try {
    const data = await redisClient.get(username);
    if (data !== null) {
      res.send({ repos: JSON.parse(data), username: username });
    } else {
      next();
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
};

// GET route to consume messages
/* app.get('/receive', async (req, res) => {
  if (!channel) {
    return res.status(500).send('RabbitMQ channel is not initialized');
  }

  let messages = [];

  channel.consume(queue, (msg) => {
    if (msg !== null) {
      const messageContent = msg.content.toString();
      console.log(`Received: ${messageContent}`);
      messages.push(messageContent);
      channel.ack(msg);
    }
  }, { noAck: false });

  setTimeout(() => {
    if (messages.length > 0) {
      res.send({ messages });
    } else {
      res.send({ message: 'No messages in queue' });
    }
  }, 1000);
}); */

app.get('/repos', cache, getRepos);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
