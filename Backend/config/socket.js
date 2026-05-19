import { Server } from 'socket.io';

let io;

export const initSocketServer = (server) => {
  io = new Server(server, {
    cors: {
      origin: 'http://localhost:3000',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    socket.on('joinEventRoom', (eventId) => {
      if (typeof eventId === 'string' && eventId.length) {
        socket.join(`event:${eventId}`);
      }
    });

    socket.on('leaveEventRoom', (eventId) => {
      if (typeof eventId === 'string' && eventId.length) {
        socket.leave(`event:${eventId}`);
      }
    });

    socket.on('disconnect', () => {
      // client disconnected
    });
  });
};

export const emitSeatUpdate = (eventId, seatId, payload) => {
  if (!io) return;
  io.to(`event:${eventId}`).emit('seat:update', {
    eventId,
    seatId,
    ...payload
  });
};
