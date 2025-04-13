const express = require('express');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 儲存所有房間的比分數據
const rooms = new Map();

// 允許跨域請求
app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    next();
});

// API：創建房間
app.post('/api/create-room', (req, res) => {
    let roomKey;
    do {
        roomKey = Math.floor(10000 + Math.random() * 90000).toString();
    } while (rooms.has(roomKey));

    rooms.set(roomKey, {
        teamAScore: 0,
        teamBScore: 0,
        gameScoreA: 0,
        gameScoreB: 0,
        clients: new Set(),
    });

    console.log(`Created room: ${roomKey}`);
    res.json({ roomKey });
});

// API：更新比分
app.post('/api/update-score', (req, res) => {
    const { roomKey, teamAScore, teamBScore, gameScoreA, gameScoreB } = req.body;

    console.log('Received update-score request:', req.body);

    // 如果房間不存在，自動創建（防止意外刪除）
    if (!rooms.has(roomKey)) {
        console.log(`Room ${roomKey} not found, creating new room`);
        rooms.set(roomKey, {
            teamAScore: 0,
            teamBScore: 0,
            gameScoreA: 0,
            gameScoreB: 0,
            clients: new Set(),
        });
    }

    const room = rooms.get(roomKey);
    room.teamAScore = teamAScore;
    room.teamBScore = teamBScore;
    room.gameScoreA = gameScoreA;
    room.gameScoreB = gameScoreB;

    console.log('Updated room data:', room);

    room.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            console.log('Broadcasting to client');
            client.send(JSON.stringify({
                teamAScore: room.teamAScore,
                teamBScore: room.teamBScore,
                gameScoreA: room.gameScoreA,
                gameScoreB: room.gameScoreB,
            }));
        }
    });

    res.json({ status: 'success' });
});

// WebSocket 連線處理
wss.on('connection', (ws, req) => {
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const roomKey = urlParams.get('room');

    // 如果房間不存在，自動創建
    if (!roomKey) {
        console.log('No room key provided');
        ws.close();
        return;
    }

    if (!rooms.has(roomKey)) {
        console.log(`Room ${roomKey} not found, creating new room`);
        rooms.set(roomKey, {
            teamAScore: 0,
            teamBScore: 0,
            gameScoreA: 0,
            gameScoreB: 0,
            clients: new Set(),
        });
    }

    const room = rooms.get(roomKey);
    room.clients.add(ws);

    console.log(`New client connected to room ${roomKey}`);

    ws.send(JSON.stringify({
        teamAScore: room.teamAScore,
        teamBScore: room.teamBScore,
        gameScoreA: room.gameScoreA,
        gameScoreB: room.gameScoreB,
    }));

    ws.on('close', () => {
        room.clients.delete(ws);
        console.log(`Client disconnected from room ${roomKey}`);
        // 暫時移除自動刪除房間的邏輯，防止房間被意外清理
        // if (room.clients.size === 0) {
        //   rooms.delete(roomKey);
        //   console.log(`Room ${roomKey} deleted`);
        // }
    });

    ws.on('error', (error) => {
        console.log('WebSocket error:', error);
    });
});

// 啟動服務器
const PORT = 3001;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});