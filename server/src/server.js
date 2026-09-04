import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { initSocket } from './services/socketService.js';
import { errorHandler } from './middleware/errorHandler.js';

// Route Imports
import authRoutes from './routes/authRoutes.js';
import tournamentRoutes from './routes/tournamentRoutes.js';
import athleteRoutes from './routes/athleteRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import matchRoutes from './routes/matchRoutes.js';

dotenv.config();

// Connect to MongoDB Atlas
connectDB();

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  },
});

// Pass Socket.io instance to broadcaster service
initSocket(io);

// Core Middleware
app.use(cors());
app.use(express.json());

// API Health Check
app.get('/api/health', (req, res) => {
  return res.status(200).json({
    status: 'ok',
    service: 'ArmForge OS API',
    timestamp: new Date().toISOString(),
  });
});

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/athletes', athleteRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/matches', matchRoutes);

// Socket.io Real-Time Room Partitioning
io.on('connection', (socket) => {
  // Client joins tournament room
  socket.on('join_tournament', ({ tournamentId }) => {
    if (tournamentId) {
      socket.join(`tournament:${tournamentId}`);
    }
  });

  // Client leaves tournament room
  socket.on('leave_tournament', ({ tournamentId }) => {
    if (tournamentId) {
      socket.leave(`tournament:${tournamentId}`);
    }
  });
});

// Centralized Error Handling Middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`ArmForge OS Server running on port ${PORT}`);
});
