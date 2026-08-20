import 'dotenv/config';
import path from 'path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { app } from './express-server.js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { setIo } from './socket.js';
import { startXrayProxy } from './xray-manager.js';

const PORT = 3000;

async function startServer() {
  // Start Xray proxy asynchronously in background without blocking server boot
  startXrayProxy().catch((error) => {
    console.warn('Note: Xray proxy background start:', error?.message || error);
  });

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });
  setIo(io);

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
