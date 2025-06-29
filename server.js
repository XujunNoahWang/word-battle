const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 中间件
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// 游戏状态管理
const gameState = {
  players: {}, // playerId -> { id, socketId, name, status, room }
  rooms: {},   // roomId -> { id, name, players, host, gameStarted }
  playerCounter: 0
};

// 玩家状态枚举
const PLAYER_STATUS = {
  IDLE: 'idle',       // 大厅中
  IN_ROOM: 'in_room', // 房间中
  OFFLINE: 'offline'  // 离线状态
};

// WebSocket连接处理
io.on('connection', (socket) => {
  console.log('新用户连接:', socket.id);

  // 立即发送当前游戏状态
  socket.emit('game_state_update', {
    players: gameState.players,
    rooms: gameState.rooms
  });

  // 处理玩家身份验证/分配
  socket.on('request_identity', (existingPlayerId) => {
    let playerId;
    
    if (existingPlayerId && gameState.players[existingPlayerId]) {
      // 恢复现有身份
      playerId = existingPlayerId;
      gameState.players[playerId].socketId = socket.id;
      gameState.players[playerId].status = PLAYER_STATUS.IDLE;
      console.log(`玩家重新连接: ${playerId}`);
    } else if (existingPlayerId) {
      // 身份存在于本地存储但服务器中不存在，重新创建
      playerId = existingPlayerId;
      gameState.players[playerId] = {
        id: playerId,
        socketId: socket.id,
        name: playerId,
        status: PLAYER_STATUS.IDLE,
        room: null
      };
      console.log(`恢复玩家身份: ${playerId}`);
    } else {
      // 分配新身份
      gameState.playerCounter++;
      playerId = `player${gameState.playerCounter}`;
      gameState.players[playerId] = {
        id: playerId,
        socketId: socket.id,
        name: playerId,
        status: PLAYER_STATUS.IDLE,
        room: null
      };
      console.log(`新玩家分配身份: ${playerId}`);
    }

    // 发送身份给客户端
    socket.emit('identity_assigned', playerId);
    
    // 发送当前游戏状态
    socket.emit('game_state_update', {
      players: gameState.players,
      rooms: gameState.rooms
    });

    // 广播玩家列表更新
    broadcastPlayersUpdate();
  });

  // 创建房间
  socket.on('create_room', (data) => {
    const { playerId } = data;
    const player = gameState.players[playerId];
    
    if (!player) return;

    const roomId = `room_${Date.now()}`;
    gameState.rooms[roomId] = {
      id: roomId,
      name: player.name,
      players: [playerId],
      host: playerId,
      gameStarted: false
    };

    // 更新玩家状态
    player.status = PLAYER_STATUS.IN_ROOM;
    player.room = roomId;
    
    socket.join(roomId);
    
    console.log(`${playerId} 创建房间: ${player.name}`);
    
    // 向创建者发送房间创建成功事件
    socket.emit('room_created', {
      roomId: roomId,
      roomName: player.name
    });
    
    // 广播状态更新
    broadcastGameStateUpdate();
  });

  // 加入房间
  socket.on('join_room', (data) => {
    const { playerId, roomId } = data;
    const player = gameState.players[playerId];
    const room = gameState.rooms[roomId];
    
    if (!player || !room || room.gameStarted) return;

    // 如果玩家已在其他房间，先退出
    if (player.room) {
      leaveRoom(playerId);
    }

    // 加入新房间
    room.players.push(playerId);
    player.status = PLAYER_STATUS.IN_ROOM;
    player.room = roomId;
    
    socket.join(roomId);
    
    console.log(`${playerId} 加入房间: ${room.name}`);
    
    // 广播状态更新
    broadcastGameStateUpdate();
  });

  // 退出房间
  socket.on('leave_room', (playerId) => {
    leaveRoom(playerId);
    broadcastGameStateUpdate();
  });

  // 开始游戏
  socket.on('start_game', (data) => {
    const { playerId, roomId } = data;
    const room = gameState.rooms[roomId];
    
    if (!room || room.host !== playerId) return;

    room.gameStarted = true;
    
    // 向房间内所有玩家发送游戏开始消息
    io.to(roomId).emit('game_started', {
      message: 'Thank you',
      roomName: room.name
    });
    
    console.log(`游戏开始: ${room.name}`);
    broadcastGameStateUpdate();
  });

  // 断线处理
  socket.on('disconnect', () => {
    console.log('用户断线:', socket.id);
    
    // 查找断线的玩家
    const playerId = Object.keys(gameState.players).find(
      id => gameState.players[id].socketId === socket.id
    );
    
    if (playerId) {
      const player = gameState.players[playerId];
      
      // 如果玩家在房间中
      if (player.room) {
        const room = gameState.rooms[player.room];
        
        // 如果是房主断线，解散房间
        if (room && room.host === playerId) {
          dissolveRoom(player.room);
        } else if (room) {
          // 普通玩家离开房间
          leaveRoom(playerId);
        }
      }
      
      // 标记玩家为离线状态，延迟删除以允许重连
      player.socketId = null;
      player.status = PLAYER_STATUS.OFFLINE;
      
      // 30秒后如果还没重连，则删除玩家记录
      setTimeout(() => {
        if (gameState.players[playerId] && gameState.players[playerId].socketId === null) {
          delete gameState.players[playerId];
          broadcastGameStateUpdate();
          console.log(`玩家 ${playerId} 超时删除`);
        }
      }, 30000);
      
      broadcastGameStateUpdate();
    }
  });

  // 辅助函数：玩家离开房间
  function leaveRoom(playerId) {
    const player = gameState.players[playerId];
    if (!player || !player.room) return;

    const room = gameState.rooms[player.room];
    if (!room) return;

    // 从房间移除玩家
    room.players = room.players.filter(id => id !== playerId);
    
    // 更新玩家状态
    player.status = PLAYER_STATUS.IDLE;
    player.room = null;
    
    // 离开Socket房间
    const playerSocket = io.sockets.sockets.get(player.socketId);
    if (playerSocket) {
      playerSocket.leave(room.id);
    }

    // 如果房间空了或房主离开，解散房间
    if (room.players.length === 0 || room.host === playerId) {
      dissolveRoom(room.id);
    }
    
    console.log(`${playerId} 离开房间: ${room.name}`);
  }

  // 辅助函数：解散房间
  function dissolveRoom(roomId) {
    const room = gameState.rooms[roomId];
    if (!room) return;

    // 将房间内所有玩家踢出
    room.players.forEach(playerId => {
      const player = gameState.players[playerId];
      if (player) {
        player.status = PLAYER_STATUS.IDLE;
        player.room = null;
        
        const playerSocket = io.sockets.sockets.get(player.socketId);
        if (playerSocket) {
          playerSocket.leave(roomId);
        }
      }
    });

    // 广播房间解散消息
    io.to(roomId).emit('room_dissolved', {
      message: '房间已解散',
      roomName: room.name
    });

    // 删除房间
    delete gameState.rooms[roomId];
    
    console.log(`房间解散: ${room.name}`);
  }

  // 广播玩家列表更新
  function broadcastPlayersUpdate() {
    io.emit('players_update', gameState.players);
  }

  // 广播游戏状态更新
  function broadcastGameStateUpdate() {
    io.emit('game_state_update', {
      players: gameState.players,
      rooms: gameState.rooms
    });
  }
});

// 创建前端HTTP服务器
const frontendApp = express();
frontendApp.use(express.static(path.join(__dirname, 'public')));

// 处理所有路由，返回index.html
frontendApp.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动前端服务器 (3000端口)
const FRONTEND_PORT = 3000;
frontendApp.listen(FRONTEND_PORT, '0.0.0.0', () => {
  console.log(`前端服务器运行在端口 ${FRONTEND_PORT}`);
});

// 启动WebSocket服务器 (3001端口)
const WEBSOCKET_PORT = 3001;
server.listen(WEBSOCKET_PORT, '0.0.0.0', () => {
  console.log(`WebSocket服务器运行在端口 ${WEBSOCKET_PORT}`);
  console.log(`\n🎮 Word Battle 已启动！`);
  console.log(`📍 本地访问: http://localhost:${FRONTEND_PORT}`);
  console.log(`🌐 局域网访问: http://[你的IP]:${FRONTEND_PORT}`);
  console.log('服务器已准备好接受连接...\n');
}); 