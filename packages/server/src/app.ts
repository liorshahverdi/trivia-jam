import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import type { ClientToServerEvents, ServerToClientEvents } from '@trivia-jam/shared';
import { getFlagReport } from './game/questionFlags.js';

const allowedOrigins = [
  'https://liorshahverdi.github.io',
  'http://localhost:5173',
];

const app = express();
app.use(cors({ origin: allowedOrigins }));

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

/** Player-reported questions since this process started; promote to question-blocklist.json. */
app.get('/flags', (_req, res) => {
  res.json(getFlagReport());
});

export { app, httpServer, io };
