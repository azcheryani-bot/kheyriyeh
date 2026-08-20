import { Server } from 'socket.io';

let io: Server | null = null;

export function setIo(server: Server) {
  io = server;
}

export function broadcastDbChange(eventInfo: any = { timestamp: Date.now() }) {
  if (io) {
    io.emit('db_change', eventInfo);
  }
}
