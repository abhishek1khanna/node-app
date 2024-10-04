import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import userModel from './userModel.js';

dotenv.config();


const port = process.env.PORT;
const app = express();

app.use(express.json());



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


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
