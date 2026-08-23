const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const config = require('./config');

const dataStore = require('./services/dataStore');
const mlService = require('./services/mlService');
const trafficSimulator = require('./services/trafficSimulator');

const predictRoutes = require('./routes/predict');
const trafficRoutes = require('./routes/traffic');
const statsRoutes = require('./routes/stats');
const networkRoutes = require('./routes/network');
const captureRoutes = require('./routes/capture');

const errorHandler = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '../frontend')));

app.use('/api/predict', predictRoutes);
app.use('/api/traffic', trafficRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/network', networkRoutes);
app.use('/api/capture', captureRoutes);

app.use(errorHandler);

io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);
  
  socket.emit('stats-update', dataStore.getStats());

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

global.io = io;

trafficSimulator.start(io, dataStore, mlService);

server.listen(config.PORT, () => {
  console.log(`
  _____  _____    _____                      _ _         
 |  ___|/ ____|  / ____|                    (_) |        
 | |__ | |  __  | (___   ___  ___ _   _ _ __ _| |_ _   _ 
 |  __|| | |_ |  \\___ \\ / _ \\/ __| | | | '__| | __| | | |
 | |___| |__| |  ____) |  __/ (__| |_| | |  | | |_| |_| |
 \\____/ \\_____| |_____/ \\___|\\___|\\__,_|_|  |_|\\__|\\__, |
                                                    __/ |
                                                   |___/ 
  Backend Server running on port ${config.PORT}
  `);
});
