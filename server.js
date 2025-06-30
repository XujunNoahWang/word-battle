const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const app = express();
const server = http.createServer(app);

// Unsplash API配置
const UNSPLASH_API_KEY = 'GBayXIrx01WPNmvZGein21eq_e1SQPk-m5lH6xddfGI';
const UNSPLASH_API_URL = 'https://api.unsplash.com';

// 中间件
app.use(cors());
app.use(express.json());

// 确保data目录存在
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// 确保images目录存在
const imagesDir = path.join(dataDir, 'images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir);
}

// 确保wordlist.json文件存在
const wordlistPath = path.join(dataDir, 'wordlist.json');
if (!fs.existsSync(wordlistPath)) {
  fs.writeFileSync(wordlistPath, JSON.stringify({ words: [] }));
}

// 从Unsplash获取图片
async function getImageFromUnsplash(word) {
  try {
    const response = await axios.get(`${UNSPLASH_API_URL}/search/photos`, {
      headers: {
        'Authorization': `Client-ID ${UNSPLASH_API_KEY}`
      },
      params: {
        query: word,
        per_page: 1
      }
    });

    if (response.data.results && response.data.results.length > 0) {
      return response.data.results[0].urls.regular;
    }
    return null;
  } catch (error) {
    console.error('获取Unsplash图片失败:', error.message);
    return null;
  }
}

// 下载图片
async function downloadImage(url, word) {
  try {
    const response = await axios({
      url,
      responseType: 'arraybuffer'
    });

    const imagePath = path.join(imagesDir, `${word}.jpg`);
    fs.writeFileSync(imagePath, response.data);
    return true;
  } catch (error) {
    console.error('下载图片失败:', error.message);
    return false;
  }
}

// API路由：获取单词列表
app.get('/api/words', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(wordlistPath, 'utf8'));
    res.json(data.words);
  } catch (error) {
    res.status(500).json({ error: '读取单词列表失败' });
  }
});

// API路由：添加新单词
app.post('/api/words', async (req, res) => {
  try {
    const { word } = req.body;
    if (!word || typeof word !== 'string') {
      return res.status(400).json({ error: '无效的单词' });
    }

    const data = JSON.parse(fs.readFileSync(wordlistPath, 'utf8'));
    const normalizedWord = word.toLowerCase();
    
    if (!data.words.includes(normalizedWord)) {
      // 保存单词
      data.words.push(normalizedWord);
      data.words.sort();
      fs.writeFileSync(wordlistPath, JSON.stringify(data, null, 2));
      
      // 发送单词保存成功的响应
      res.json({ 
        success: true, 
        words: data.words,
        message: '单词添加成功',
        imageStatus: 'pending'
      });

      // 异步下载图片
      const imageUrl = await getImageFromUnsplash(normalizedWord);
      if (imageUrl) {
        const downloaded = await downloadImage(imageUrl, normalizedWord);
        // 通过WebSocket通知客户端图片下载状态
        if (downloaded) {
          io.emit('image_downloaded', {
            word: normalizedWord,
            success: true,
            message: '图片下载成功'
          });
        } else {
          io.emit('image_downloaded', {
            word: normalizedWord,
            success: false,
            message: '图片下载失败'
          });
        }
      } else {
        io.emit('image_downloaded', {
          word: normalizedWord,
          success: false,
          message: '未找到相关图片'
        });
      }
    } else {
      res.status(400).json({ error: '单词已存在' });
    }
  } catch (error) {
    res.status(500).json({ error: '添加单词失败' });
  }
});

// API路由：删除单词
app.delete('/api/words/:word', (req, res) => {
  try {
    const wordToDelete = req.params.word.toLowerCase();
    const data = JSON.parse(fs.readFileSync(wordlistPath, 'utf8'));
    const index = data.words.indexOf(wordToDelete);
    
    if (index > -1) {
      // 删除单词
      data.words.splice(index, 1);
      fs.writeFileSync(wordlistPath, JSON.stringify(data, null, 2));
      
      // 删除对应的图片
      const imagePath = path.join(imagesDir, `${wordToDelete}.jpg`);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
      
      res.json({ success: true, words: data.words });
    } else {
      res.status(404).json({ error: '单词不存在' });
    }
  } catch (error) {
    res.status(500).json({ error: '删除单词失败' });
  }
});

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));
app.use('/data/images', express.static(path.join(__dirname, 'data', 'images')));

// 处理所有其他路由，返回index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 设置Socket.IO
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 读取单词列表
const wordlist = JSON.parse(fs.readFileSync('data/wordlist.json', 'utf8')).words;

// 玩家状态枚举
const PLAYER_STATUS = {
  IDLE: 'idle',           // 空闲（在大厅中）
  IN_ROOM: 'in_room',     // 在房间中（准备状态）
  IN_GAME: 'in_game',     // 在游戏中
  IN_RESULT: 'in_result', // 在结果页面中
  OFFLINE: 'offline'      // 离线
};

// 游戏状态管理
const gameState = {
  players: {},
  rooms: {},
  playerCounter: 0  // 添加玩家计数器
};

// 获取随机单词和图片选项
function getRandomWordAndImages(usedWords) {
  // 过滤掉已使用的单词
  const availableWords = wordlist.filter(word => !usedWords.includes(word));
  if (availableWords.length === 0) return null;

  // 随机选择一个单词
  const word = availableWords[Math.floor(Math.random() * availableWords.length)];
  
  // 准备图片选项（1个正确，3个干扰）
  const otherWords = wordlist.filter(w => w !== word);
  const distractors = otherWords.sort(() => Math.random() - 0.5).slice(0, 3);
  const images = [...distractors, word].sort(() => Math.random() - 0.5);

  return { word, images };
}

// 生成题目列表
function generateQuestions(roomId) {
  const room = gameState.rooms[roomId];
  const questions = [];
  const roundUsedWords = [];
  const QUESTIONS_PER_ROUND = 10;
  
  // 获取可用的单词（排除本房间已使用的单词）
  const availableWords = wordlist.filter(word => !room.usedWords.includes(word));
  
  // 如果可用单词不足10个，重置已使用单词列表
  if (availableWords.length < QUESTIONS_PER_ROUND) {
    console.log(`可用单词不足${QUESTIONS_PER_ROUND}个，重置单词池`);
    room.usedWords = [];
  }
  
  while (questions.length < QUESTIONS_PER_ROUND) {
    const gameData = getRandomWordAndImages(roundUsedWords);
    if (!gameData) break;
    
    // 如果这个单词已经在房间使用过，跳过
    if (room.usedWords.includes(gameData.word)) continue;
    
    questions.push(gameData);
    roundUsedWords.push(gameData.word);
  }
  
  // 将本轮使用的单词添加到房间的已使用单词列表中
  room.usedWords.push(...roundUsedWords);
  room.roundCount++;
  
  return questions;
}

// WebSocket连接处理
io.on('connection', (socket) => {
  console.log('新用户连接:', socket.id);

  // 立即发送当前游戏状态
  socket.emit('game_state_update', {
    players: gameState.players,
    rooms: gameState.rooms
  });

  // 处理身份请求
  socket.on('request_identity', (data) => {
    const { savedId, savedName } = data;
    let playerId;
    
    // 检查是否是同一设备的重连
    const existingPlayer = Object.values(gameState.players).find(
        player => player.socketId === socket.id || 
                 (savedId && player.id === savedId && !player.socketId) // 断线的玩家
    );
    
    if (existingPlayer) {
        // 如果是同一设备重连
        playerId = existingPlayer.id;
        existingPlayer.socketId = socket.id;
        existingPlayer.status = existingPlayer.status === PLAYER_STATUS.OFFLINE ? 
                              PLAYER_STATUS.IDLE : existingPlayer.status;
        
        console.log(`玩家重连: ${playerId}, 名字: ${existingPlayer.name}`);
    } else {
        // 生成新的玩家ID
        gameState.playerCounter++;
        playerId = `player${gameState.playerCounter}`;
        
        // 创建新玩家
        gameState.players[playerId] = {
            id: playerId,
            name: savedName || playerId,
            socketId: socket.id,
            status: PLAYER_STATUS.IDLE,
            room: null,
            deviceId: socket.handshake.address // 记录设备IP地址
        };
        
        console.log(`新玩家分配身份: ${playerId}, 名字: ${gameState.players[playerId].name}`);
    }
    
    // 发送身份信息给客户端
    socket.emit('identity_assigned', playerId);
    
    // 广播更新
    broadcastGameStateUpdate();
  });

  // 更新用户名
  socket.on('update_name', (data) => {
    const { playerId, newName } = data;
    const player = gameState.players[playerId];
    
    if (!player) return;

    // 更新玩家名称
    player.name = newName;
    
    // 如果玩家在房间中且是房主，更新房间名称
    if (player.room && gameState.rooms[player.room] && gameState.rooms[player.room].host === playerId) {
      console.log(`房主 ${playerId} 更新名称为: ${newName}`);
    }

    // 广播游戏状态更新
    broadcastGameStateUpdate();
    
    // 发送成功通知
    socket.emit('name_updated', {
      success: true,
      message: '用户名更新成功'
    });
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
      gameStarted: false,
      originalPlayers: [playerId],  // 记录原始玩家
      usedWords: [],  // 记录已使用的单词
      roundCount: 0   // 记录游戏轮数
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
    
    // 检查是否是新玩家（不在原始玩家列表中）
    if (!room.originalPlayers.includes(playerId)) {
      console.log(`新玩家 ${playerId} 加入房间，重置单词池`);
      room.usedWords = [];  // 重置已使用单词列表
      room.originalPlayers = [...room.players];  // 更新原始玩家列表
    }
    
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

  // 处理游戏开始
  socket.on('start_game', (data) => {
    const { playerId, roomId } = data;
    const room = gameState.rooms[roomId];
    
    if (!room || room.host !== playerId) return;

    // 检查是否所有玩家都已准备（在房间中）
    const allReady = room.players.every(pid => {
      const player = gameState.players[pid];
      return player && player.status === PLAYER_STATUS.IN_ROOM;
    });

    if (!allReady) {
      // 如果有玩家未准备好，发送错误消息
      const playerSocket = io.sockets.sockets.get(socket.id);
      if (playerSocket) {
        playerSocket.emit('game_start_error', {
          message: '有玩家尚未准备好，请等待所有玩家返回房间'
        });
      }
      return;
    }

    // 重置房间游戏状态
    room.gameStarted = true;
    room.questions = generateQuestions(roomId);
    room.playerProgress = {};
    
    // 初始化每个玩家的进度并更新状态
    room.players.forEach(pid => {
      const player = gameState.players[pid];
      if (player) {
        player.status = PLAYER_STATUS.IN_GAME;
      }
      room.playerProgress[pid] = {
        currentQuestion: 0,
        correctAnswers: 0,
        startTime: Date.now(),
        endTime: null
      };
    });
    
    // 向房间内所有玩家发送游戏开始消息
    io.to(roomId).emit('game_started', room.questions[0]);
    
    console.log(`游戏开始: ${room.name}`);
    broadcastGameStateUpdate();
  });

  // 处理答题
  socket.on('answer_selected', (data) => {
    const { playerId, roomId, selectedImage } = data;
    const room = gameState.rooms[roomId];
    
    if (!room || !room.gameStarted) return;

    const progress = room.playerProgress[playerId];
    if (!progress || progress.currentQuestion >= room.questions.length) return;

    const currentQuestion = room.questions[progress.currentQuestion];
    const isCorrect = selectedImage === currentQuestion.word;
    
    // 更新玩家进度
    if (isCorrect) {
      progress.correctAnswers++;
    }
    
    // 发送答题结果，但不自动发送下一题
    socket.emit('answer_result', {
      isCorrect,
      progress: {
        current: progress.currentQuestion + 1,
        total: room.questions.length,
        correct: progress.correctAnswers
      }
    });
  });

  // 处理请求下一题
  socket.on('request_next_question', (data) => {
    const { playerId, roomId } = data;
    const room = gameState.rooms[roomId];
    
    if (!room || !room.gameStarted) return;

    const progress = room.playerProgress[playerId];
    if (!progress) return;

    // 更新题目计数
    progress.currentQuestion++;
    
    // 检查是否完成所有题目
    if (progress.currentQuestion >= room.questions.length) {
      progress.endTime = Date.now();
      const totalTime = (progress.endTime - progress.startTime) / 1000; // 转换为秒
      const accuracy = (progress.correctAnswers / room.questions.length) * 100;
      
      // 发送个人游戏结果
      socket.emit('game_completed', {
        totalTime,
        accuracy,
        correctAnswers: progress.correctAnswers,
        totalQuestions: room.questions.length
      });
      
      // 更新玩家状态
      const player = gameState.players[playerId];
      if (player) {
        player.status = PLAYER_STATUS.IN_RESULT;
      }
      
      // 检查是否所有玩家都完成了游戏
      const allCompleted = room.players.every(pid => {
        const playerProgress = room.playerProgress[pid];
        return playerProgress && playerProgress.endTime;
      });
      
      if (allCompleted) {
        // 准备所有玩家的结果
        const results = {};
        room.players.forEach(pid => {
          const playerProgress = room.playerProgress[pid];
          const player = gameState.players[pid];
          results[pid] = {
            name: player.name,
            totalTime: (playerProgress.endTime - playerProgress.startTime) / 1000,
            accuracy: (playerProgress.correctAnswers / room.questions.length) * 100,
            correctAnswers: playerProgress.correctAnswers
          };
        });
        
        // 发送所有玩家的结果
        io.to(roomId).emit('all_players_completed', results);
      }
    } else {
      // 发送下一题
      socket.emit('next_question', room.questions[progress.currentQuestion]);
    }
    
    broadcastGameStateUpdate();
  });

  // 处理游戏完成
  socket.on('game_completed', (data) => {
    const { playerId, roomId } = data;
    const room = gameState.rooms[roomId];
    const player = gameState.players[playerId];
    
    if (!room || !player) return;
    
    // 更新玩家状态
    player.status = PLAYER_STATUS.IN_RESULT;
    
    // 检查是否所有玩家都完成了游戏
    const allCompleted = room.players.every(pid => {
      const playerProgress = room.playerProgress[pid];
      return playerProgress && playerProgress.endTime;
    });
    
    if (allCompleted) {
      // 准备所有玩家的结果
      const results = {};
      room.players.forEach(pid => {
        const playerProgress = room.playerProgress[pid];
        const player = gameState.players[pid];
        results[pid] = {
          name: player.name,
          totalTime: (playerProgress.endTime - playerProgress.startTime) / 1000,
          accuracy: (playerProgress.correctAnswers / room.questions.length) * 100,
          correctAnswers: playerProgress.correctAnswers
        };
      });
      
      // 发送所有玩家的结果
      io.to(roomId).emit('all_players_completed', results);
      
      // 重置房间状态
      room.gameStarted = false;
      room.questions = null;
      room.playerProgress = {};
    }
    
    broadcastGameStateUpdate();
  });

  // 处理玩家返回房间
  socket.on('return_to_room', (data) => {
    const { playerId, roomId } = data;
    const player = gameState.players[playerId];
    const room = gameState.rooms[roomId];

    if (!player || !room) return;

    // 更新玩家状态为"在房间中"
    player.status = PLAYER_STATUS.IN_ROOM;

    // 广播状态更新
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
            
            if (room) {
                // 如果游戏正在进行中，结束游戏
                if (room.gameStarted) {
                                            // 通知房间内所有玩家游戏结束
                        io.to(room.id).emit('game_over', {
                            reason: '离开游戏',
                            player: player.name
                        });
                    
                    // 重置房间游戏状态
                    room.gameStarted = false;
                    room.questions = null;
                    room.playerProgress = {};
                    
                    // 更新房间内所有玩家状态为"在房间中"
                    room.players.forEach(pid => {
                        if (pid !== playerId && gameState.players[pid]) {
                            gameState.players[pid].status = PLAYER_STATUS.IN_ROOM;
                        }
                    });
                }
                
                // 如果是房主断线，解散房间
                if (room.host === playerId) {
                    dissolveRoom(player.room);
                } else {
                    // 普通玩家离开房间
                    leaveRoom(playerId);
                }
            }
        }
        
        // 标记玩家为离线状态
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

    // 如果是房主退出，直接解散房间
    if (room.host === playerId) {
      dissolveRoom(room.id);
      return;
    }

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

    // 如果房间空了，解散房间
    if (room.players.length === 0) {
      dissolveRoom(room.id);
    }
    
    console.log(`${playerId} 离开房间: ${room.name}`);
  }

  // 辅助函数：解散房间
  function dissolveRoom(roomId) {
    const room = gameState.rooms[roomId];
    if (!room) return;

    // 保存房间信息用于广播
    const roomInfo = {
      message: '房间已解散',
      roomName: room.name,
      roomId: room.id
    };

    // 将房间内所有玩家踢出
    room.players.forEach(playerId => {
      const player = gameState.players[playerId];
      if (player) {
        player.status = PLAYER_STATUS.IDLE;
        player.room = null;
        
        // 获取玩家的socket并发送解散消息
        const playerSocket = io.sockets.sockets.get(player.socketId);
        if (playerSocket) {
          playerSocket.leave(roomId);
          playerSocket.emit('room_dissolved', roomInfo);
        }
      }
    });

    // 删除房间
    delete gameState.rooms[roomId];
    
    // 广播游戏状态更新
    broadcastGameStateUpdate();
    
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

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在端口 ${PORT}`);
  console.log('\n🎮 Word Battle 已启动！');
  // console.log(`📍 本地访问: http://localhost:${PORT}`);
  // console.log('🌐 局域网访问: http://[你的IP]:${PORT}');
  // console.log('服务器已准备好接受连接...\n');
});