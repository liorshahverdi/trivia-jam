import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: [
      'https://liorshahverdi.github.io',
      'http://localhost:5173',
    ],
    methods: ['GET', 'POST'],
  },
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export { app, httpServer, io };
