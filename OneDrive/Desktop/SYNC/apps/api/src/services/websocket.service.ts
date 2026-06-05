import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

let io: Server;

export function initWebSocketServer(server: HttpServer) {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error: Token required'));
      }

      const jwtSecret = process.env.JWT_SECRET || 'default_secret';
      const decoded = jwt.verify(token, jwtSecret) as { userId: string };
      
      // Store userId in socket connection
      (socket as any).userId = decoded.userId;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket as any).userId;
    console.log(`📡 WebSocket client connected: User ${userId} [${socket.id}]`);

    // Join a room specific to this user to emit targeted events
    socket.join(userId);

    socket.on('disconnect', () => {
      console.log(`🔌 WebSocket client disconnected: User ${userId} [${socket.id}]`);
    });
  });

  return io;
}

/**
 * Broadcasts a new transaction event to the specific user's connected WebSocket clients
 */
export function broadcastTransactionUpdate(userId: string, transaction: any) {
  if (io) {
    // Emits specifically to the room named after the userId
    io.to(userId).emit('transaction_update', transaction);
  }
}

/**
 * Broadcasts a balance update to all connected clients
 */
export function broadcastBalanceUpdate(balance: number) {
  if (io) {
    io.emit('balance_update', { balance });
  }
}
