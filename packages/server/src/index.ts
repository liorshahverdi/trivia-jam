import { httpServer, io } from './app.js';
import { setupSocketHandlers } from './socket/handler.js';

const PORT = parseInt(process.env.PORT || '3001', 10);

setupSocketHandlers(io);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 TriviaJam server running on http://0.0.0.0:${PORT}`);
});
