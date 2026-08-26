import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    },
});

app.use(cors());
app.use(express.json());

// Socket room connection
io.on('connection', (socket) => {
    socket.on('join_tournament', ({ tournamentId }) => {
        socket.join(`tournament:${tournamentId}`);
    });

    socket.on('leave_tournament', ({ tournamentId }) => {
        socket.leave(`tournament:${tournamentId}`);
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`ArmForge OS Server running on port ${PORT}`);
});
