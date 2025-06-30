// 游戏客户端类
class WordBattleClient {
    constructor() {
        this.socket = null;
        this.playerId = null;
        this.currentRoom = null;
        this.gameState = {
            players: {},
            rooms: {}
        };
        
        this.init();
    }

    // 初始化客户端
    init() {
        this.setupUI();
        this.setupWordManager();
        this.connectToServer();
    }

    // 设置UI事件监听
    setupUI() {
        // 创建房间 - 直接创建，使用用户名作为房间名
        document.getElementById('createRoomBtn').addEventListener('click', () => {
            this.createRoom();
        });

        // 房间操作
        document.getElementById('leaveRoomBtn').addEventListener('click', () => {
            this.leaveRoom();
        });

        document.getElementById('startGameBtn').addEventListener('click', () => {
            this.startGame();
        });

        // 用户名编辑
        document.getElementById('playerBadge').addEventListener('click', () => {
            this.showEditNameModal();
        });

        document.getElementById('cancelEditName').addEventListener('click', () => {
            this.hideEditNameModal();
        });

        document.getElementById('confirmEditName').addEventListener('click', () => {
            this.updatePlayerName();
        });

        // 按Enter键确认修改用户名
        document.getElementById('newNameInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.updatePlayerName();
            }
        });
    }

    // 单词管理相关
    setupWordManager() {
        // 显示/隐藏单词管理页面
        document.getElementById('addWordBtn').addEventListener('click', () => {
            document.getElementById('wordManager').classList.remove('hidden');
            document.getElementById('lobby').classList.add('hidden');
            this.loadWords();
        });

        document.getElementById('closeWordManager').addEventListener('click', () => {
            document.getElementById('wordManager').classList.add('hidden');
            document.getElementById('lobby').classList.remove('hidden');
        });

        // 添加单词
        document.getElementById('wordInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addWord();
            }
        });

        document.getElementById('addWordToList').addEventListener('click', () => {
            this.addWord();
        });
    }

    // 连接到服务器
    connectToServer() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.hostname}:${window.location.port || '3000'}`;
        
        this.socket = io(wsUrl);

        // 连接成功
        this.socket.on('connect', () => {
            console.log('已连接到服务器');
            this.hideLoading();
            this.requestIdentity();
        });

        // 身份分配
        this.socket.on('identity_assigned', (playerId) => {
            this.playerId = playerId;
            
            // 获取当前玩家的名称
            const currentPlayer = this.gameState.players[playerId];
            const displayName = currentPlayer ? currentPlayer.name : playerId;
            
            this.updatePlayerBadge(displayName);
        });

        // 游戏状态更新
        this.socket.on('game_state_update', (gameState) => {
            this.gameState = gameState;
            this.updateUI();
        });

        // 玩家列表更新
        this.socket.on('players_update', (players) => {
            const oldName = this.gameState.players[this.playerId]?.name;
            this.gameState.players = players;
            
            // 如果当前玩家的名字发生变化，更新显示（不再显示提示框）
            const newName = players[this.playerId]?.name;
            if (oldName && newName && oldName !== newName) {
                this.updatePlayerBadge(newName);
            }
            
            this.updatePlayersDisplay();
        });

        // 游戏开始
        this.socket.on('game_started', (gameData) => {
            this.showGameView(gameData);
        });

        // 下一题
        this.socket.on('next_question', (data) => {
            this.updateGameView(data);
        });

        // 游戏结束
        this.socket.on('game_over', () => {
            this.showGameOver();
        });

        // 答题结果
        this.socket.on('answer_result', (data) => {
            const { isCorrect, progress } = data;
            // 只更新进度，不显示提示框
            this.updateProgress(progress);
        });

        // 房间创建成功
        this.socket.on('room_created', (data) => {
            this.currentRoom = data.roomId;
            this.showRoom();
        });

        // 房间解散
        this.socket.on('room_dissolved', (data) => {
            // 立即更新游戏状态
            if (this.gameState.rooms[this.currentRoom]) {
                delete this.gameState.rooms[this.currentRoom];
            }
            
            // 更新当前玩家状态
            if (this.gameState.players[this.playerId]) {
                this.gameState.players[this.playerId].status = 'idle';
                this.gameState.players[this.playerId].room = null;
            }

            this.currentRoom = null;

            // 强制更新UI
            document.getElementById('lobby').classList.remove('hidden');
            document.getElementById('roomView').classList.add('hidden');
            document.getElementById('gameView').classList.add('hidden');

            // 更新房间和玩家列表显示
            this.updateRoomsDisplay();
            this.updatePlayersDisplay();
            
            // 显示通知
            this.showNotification('房间解散', `${data.roomName}房间已解散`, 'warning');
        });

        // 连接错误
        this.socket.on('connect_error', (error) => {
            console.error('连接错误:', error);
            this.showNotification('连接失败', '无法连接到服务器，请检查网络', 'error');
        });

        // 断线重连
        this.socket.on('disconnect', (reason) => {
            console.log('连接断开:', reason);
            this.showNotification('连接断开', '正在尝试重新连接...', 'warning');
        });

        this.socket.on('reconnect', () => {
            console.log('重新连接成功');
            this.requestIdentity();
            this.showNotification('重新连接', '连接已恢复', 'success');
        });

        // 图片下载完成事件
        this.socket.on('image_downloaded', (data) => {
            if (data.success) {
                this.showNotification('图片下载', `单词 "${data.word}" 的图片${data.message}`, 'success');
                // 刷新显示以更新图片
                this.loadWords();
            } else {
                this.showNotification('图片下载', `单词 "${data.word}" 的图片${data.message}`, 'warning');
            }
        });

        // 游戏完成
        this.socket.on('game_completed', (results) => {
            this.showGameResults(results);
        });

        // 所有玩家完成
        this.socket.on('all_players_completed', (results) => {
            this.showAllPlayersResults(results);
        });

        // 游戏开始错误
        this.socket.on('game_start_error', (data) => {
            this.showNotification('无法开始游戏', data.message, 'error');
        });
    }

    // 请求身份验证
    requestIdentity() {
        // 获取会话中保存的名字
        const savedName = sessionStorage.getItem('word_battle_player_name');
        this.socket.emit('request_identity', { savedName });
    }

    // 显示/隐藏加载状态
    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
    }

    // 更新玩家徽章
    updatePlayerBadge(playerId) {
        document.getElementById('playerBadge').textContent = playerId;
    }

    // 更新UI
    updateUI() {
        this.updatePlayersDisplay();
        this.updateRoomsDisplay();
        this.updateRoomView();
        this.updateCreateRoomButton();
    }

    // 更新创建房间按钮状态
    updateCreateRoomButton() {
        const createRoomBtn = document.getElementById('createRoomBtn');
        const currentPlayer = this.gameState.players[this.playerId];
        
        if (currentPlayer && currentPlayer.status === 'in_room') {
            createRoomBtn.disabled = true;
            createRoomBtn.innerHTML = '<span>已在房间中</span>';
            createRoomBtn.classList.add('disabled');
        } else {
            createRoomBtn.disabled = false;
            createRoomBtn.innerHTML = '<span>创建房间</span>';
            createRoomBtn.classList.remove('disabled');
        }
    }

    // 更新玩家列表显示
    updatePlayersDisplay() {
        const playersContainer = document.getElementById('playersList');
        const playersCount = document.getElementById('playersCount');
        
        // 显示所有在线玩家（包括自己），过滤掉离线玩家
        const onlinePlayers = Object.values(this.gameState.players).filter(p => p.status !== 'offline');
        
        // 更新header右上角的用户名显示
        const currentPlayer = this.gameState.players[this.playerId];
        if (currentPlayer) {
            this.updatePlayerBadge(currentPlayer.name);
        }
        
        playersCount.textContent = onlinePlayers.length;

        if (onlinePlayers.length === 0) {
            playersContainer.innerHTML = `
                <div class="empty-state">
                    <p>暂无玩家在线</p>
                </div>
            `;
            return;
        }

        playersContainer.innerHTML = onlinePlayers.map(player => {
            const isCurrentPlayer = player.id === this.playerId;
            return `
                <div class="player-item ${isCurrentPlayer ? 'current-player' : ''}">
                    <span class="player-name">
                        ${player.name}
                        ${isCurrentPlayer ? ' (你)' : ''}
                    </span>
                    <span class="player-status ${player.status}">
                        ${player.status === 'idle' ? '空闲' : '游戏中'}
                    </span>
                </div>
            `;
        }).join('');
    }

    // 更新房间列表显示
    updateRoomsDisplay() {
        const roomsContainer = document.getElementById('roomsList');
        const rooms = Object.values(this.gameState.rooms).filter(room => !room.gameStarted);
        const currentPlayer = this.gameState.players[this.playerId];
        const isPlayerInRoom = currentPlayer && currentPlayer.status === 'in_room';

        if (rooms.length === 0) {
            roomsContainer.innerHTML = `
                <div class="empty-state">
                    <p>暂无活动房间</p>
                    <p class="hint">点击"创建房间"开始游戏</p>
                </div>
            `;
            return;
        }

        roomsContainer.innerHTML = rooms.map(room => {
            const isCurrentRoom = room.id === this.currentRoom;
            const hostPlayer = this.gameState.players[room.host];
            return `
                <div class="room-item ${isCurrentRoom ? 'current-room' : ''}">
                    <div class="room-info">
                        <span class="room-name">${hostPlayer.name}的房间</span>
                        <span class="player-count">${room.players.length}人</span>
                    </div>
                    ${!isPlayerInRoom ? `
                        <button class="btn btn-primary join-room-btn" onclick="wordBattleClient.joinRoom('${room.id}')">
                            加入房间
                        </button>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    // 更新房间视图
    updateRoomView() {
        if (!this.currentRoom || !this.gameState.rooms[this.currentRoom]) return;

        const room = this.gameState.rooms[this.currentRoom];
        const currentPlayer = this.gameState.players[this.playerId];
        const isHost = room.host === this.playerId;

        // 更新房间标题
        document.getElementById('roomTitle').textContent = `${this.gameState.players[room.host].name}的房间`;
        document.getElementById('roomHostName').textContent = this.gameState.players[room.host].name;

        // 更新玩家列表
        const playersList = document.getElementById('roomPlayersList');
        playersList.innerHTML = room.players.map(playerId => {
            const player = this.gameState.players[playerId];
            let statusText = '';
            
            // 根据玩家状态显示不同的文本
            switch(player.status) {
                case 'in_room':
                    statusText = '准备中';
                    break;
                case 'in_game':
                    statusText = '游戏中';
                    break;
                case 'in_result':
                    statusText = '查看结果中';
                    break;
                default:
                    statusText = '未知状态';
            }
            
            return `
                <div class="room-player">
                    <span class="player-name">${player.name}</span>
                    <span class="player-status ${player.status}">${statusText}</span>
                </div>
            `;
        }).join('');

        // 更新开始游戏按钮
        const startGameBtn = document.getElementById('startGameBtn');
        if (startGameBtn) {
            if (isHost) {
                startGameBtn.classList.remove('hidden');
                // 检查是否所有玩家都已准备
                const allReady = room.players.every(pid => 
                    this.gameState.players[pid].status === 'in_room'
                );
                
                if (allReady) {
                    startGameBtn.disabled = false;
                    startGameBtn.title = '开始新一轮游戏';
                } else {
                    startGameBtn.disabled = true;
                    startGameBtn.title = '等待所有玩家准备';
                }
            } else {
                startGameBtn.classList.add('hidden');
            }
        }
    }

    // 创建房间
    createRoom() {
        // 检查是否已在房间中
        const currentPlayer = this.gameState.players[this.playerId];
        if (currentPlayer && currentPlayer.status === 'in_room') {
            this.showNotification('创建失败', '您已在房间中，请先退出当前房间', 'warning');
            return;
        }

        this.socket.emit('create_room', {
            playerId: this.playerId
        });

        this.showNotification('创建房间', '房间创建成功', 'success');
    }

    // 加入房间
    joinRoom(roomId) {
        // 检查是否已在房间中
        const currentPlayer = this.gameState.players[this.playerId];
        if (currentPlayer && currentPlayer.status === 'in_room') {
            this.showNotification('加入失败', '您已在房间中，请先退出当前房间', 'warning');
            return;
        }

        const room = this.gameState.rooms[roomId];
        
        if (!room) {
            this.showNotification('加入失败', '房间不存在', 'error');
            return;
        }

        if (room.gameStarted) {
            this.showNotification('加入失败', '游戏已开始，无法加入', 'error');
            return;
        }

        this.socket.emit('join_room', {
            playerId: this.playerId,
            roomId: roomId
        });

        this.currentRoom = roomId;
        this.showRoom();
        
        const hostPlayer = this.gameState.players[room.host];
        this.showNotification('加入房间', `已加入${hostPlayer.name}的房间`, 'success');
    }

    // 离开房间
    leaveRoom() {
        if (!this.currentRoom) return;

        this.socket.emit('leave_room', this.playerId);
        this.currentRoom = null;
        this.showLobby();
        this.showNotification('离开房间', '已返回游戏大厅', 'success');
    }

    // 开始游戏
    startGame() {
        if (!this.currentRoom) return;

        this.socket.emit('start_game', {
            playerId: this.playerId,
            roomId: this.currentRoom
        });
    }

    // 显示大厅
    showLobby() {
        document.getElementById('lobby').classList.remove('hidden');
        document.getElementById('roomView').classList.add('hidden');
        document.getElementById('gameView').classList.add('hidden');
    }

    // 显示房间
    showRoom() {
        document.getElementById('lobby').classList.add('hidden');
        document.getElementById('roomView').classList.remove('hidden');
        document.getElementById('gameView').classList.add('hidden');
    }

    // 显示游戏页面
    showGameView(gameData) {
        // 隐藏其他视图
        document.getElementById('lobby').classList.add('hidden');
        document.getElementById('roomView').classList.add('hidden');
        
        // 显示游戏视图
        const gameView = document.getElementById('gameView');
        gameView.classList.remove('hidden');
        
        this.updateGameView(gameData);
    }

    // 更新游戏视图
    updateGameView(data) {
        const { word, images } = data;
        
        // 显示单词
        document.getElementById('currentWord').textContent = word;
        
        // 显示图片选项
        const imageGrid = document.querySelector('.image-grid');
        imageGrid.innerHTML = images.map(image => `
            <div class="image-item" onclick="wordBattleClient.selectAnswer('${image}')">
                <img src="/data/images/${image}.jpg" alt="选项">
            </div>
        `).join('');
    }

    // 处理答题选择
    selectAnswer(selectedImage) {
        this.socket.emit('answer_selected', {
            playerId: this.playerId,
            roomId: this.currentRoom,
            selectedImage: selectedImage
        });
    }

    // 显示游戏结束
    showGameOver() {
        const gameView = document.getElementById('gameView');
        gameView.innerHTML = `
            <div class="game-over">
                <h2>游戏结束！</h2>
                <button class="btn btn-primary" onclick="wordBattleClient.returnToRoom()">
                    返回房间
                </button>
            </div>
        `;
    }

    // 返回房间
    returnToRoom() {
        // 通知服务器玩家返回房间
        this.socket.emit('return_to_room', {
            playerId: this.playerId,
            roomId: this.currentRoom
        });

        // 重置游戏视图
        const gameView = document.getElementById('gameView');
        gameView.innerHTML = `
            <main class="game-content">
                <div class="game-container">
                    <div class="word-display">
                        <h2 id="currentWord"></h2>
                    </div>
                    <div class="image-grid">
                        <!-- 图片会通过JavaScript动态添加 -->
                    </div>
                </div>
            </main>
        `;
        
        // 返回房间视图
        this.showRoom();
    }

    // 显示通知
    showNotification(title, message, type = 'info') {
        const container = document.getElementById('notificationContainer');
        const notification = document.createElement('div');
        
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
        `;

        container.appendChild(notification);

        // 3秒后自动移除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease-out';
                setTimeout(() => {
                    if (notification.parentNode) {
                        container.removeChild(notification);
                    }
                }, 300);
            }
        }, 3000);
    }

    // 显示用户名编辑弹窗
    showEditNameModal() {
        const modal = document.getElementById('editNameModal');
        const input = document.getElementById('newNameInput');
        const currentPlayer = this.gameState.players[this.playerId];
        
        input.value = currentPlayer.name;
        modal.classList.remove('hidden');
        modal.classList.add('show');
        input.focus();
        input.select();
    }

    // 隐藏用户名编辑弹窗
    hideEditNameModal() {
        const modal = document.getElementById('editNameModal');
        modal.classList.remove('show');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }

    // 更新用户名
    updatePlayerName() {
        const newNameInput = document.getElementById('newNameInput');
        const newName = newNameInput.value.trim();
        
        if (newName && newName.length <= 10) {
            this.socket.emit('update_name', {
                playerId: this.playerId,
                newName: newName
            });
            
            // 保存名字到会话存储中
            sessionStorage.setItem('word_battle_player_name', newName);
            
            this.hideEditNameModal();
        } else {
            this.showNotification('修改失败', '名字不能为空且不能超过10个字符', 'error');
        }
    }

    // 加载单词列表
    async loadWords() {
        try {
            const response = await fetch('/api/words');
            const words = await response.json();
            this.displayWords(words);
        } catch (error) {
            this.showNotification('错误', '加载单词列表失败', 'error');
        }
    }

    // 添加新单词
    async addWord() {
        const input = document.getElementById('wordInput');
        const word = input.value.trim();
        
        if (!word) {
            this.showNotification('提示', '请输入单词', 'warning');
            return;
        }

        try {
            const response = await fetch('/api/words', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ word })
            });

            const data = await response.json();
            
            if (response.ok) {
                input.value = '';
                this.displayWords(data.words);
                this.showNotification('成功', data.message, 'success');
            } else {
                this.showNotification('错误', data.error, 'error');
            }
        } catch (error) {
            this.showNotification('错误', '添加单词失败', 'error');
        }
    }

    // 删除单词
    async deleteWord(word) {
        try {
            const response = await fetch(`/api/words/${encodeURIComponent(word)}`, {
                method: 'DELETE'
            });

            const data = await response.json();
            
            if (response.ok) {
                this.displayWords(data.words);
                this.showNotification('成功', '单词删除成功', 'success');
            } else {
                this.showNotification('错误', data.error, 'error');
            }
        } catch (error) {
            this.showNotification('错误', '删除单词失败', 'error');
        }
    }

    // 显示单词列表
    displayWords(words) {
        const wordList = document.getElementById('wordList');
        wordList.innerHTML = words.map(word => `
            <div class="word-item">
                <div class="word-content">
                    <div class="word-image-container">
                        <img src="/data/images/${word}.jpg" 
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" 
                             alt="${word}"
                             class="word-image" />
                        <div class="word-image-placeholder">⌛️</div>
                    </div>
                    <span>${word}</span>
                </div>
                <button onclick="wordBattleClient.deleteWord('${word}')">×</button>
            </div>
        `).join('');
    }

    // 更新游戏进度显示
    updateProgress(progress) {
        document.getElementById('current-progress').textContent = progress.current;
        document.getElementById('total-questions').textContent = progress.total;
        document.getElementById('correct-answers').textContent = progress.correct;
    }

    // 显示游戏结果
    showGameResults(results) {
        // 通知服务器玩家已完成游戏
        this.socket.emit('game_completed', {
            playerId: this.playerId,
            roomId: this.currentRoom
        });

        const gameView = document.getElementById('gameView');
        gameView.innerHTML = `
            <div class="results-container">
                <h2>游戏结束</h2>
                <div class="personal-result">
                    <h3>你的成绩</h3>
                    <p>用时: ${results.totalTime.toFixed(1)} 秒</p>
                    <p>正确率: ${results.accuracy.toFixed(1)}%</p>
                    <p>答对题数: ${results.correctAnswers}/${results.totalQuestions}</p>
                </div>
            </div>
        `;
    }

    // 显示所有玩家的最终成绩
    showAllPlayersResults(results) {
        const resultsDiv = document.querySelector('.results-container');
        
        let allPlayersHtml = '<div class="all-players-results"><h3>所有玩家成绩</h3><table>';
        allPlayersHtml += '<tr><th>玩家</th><th>用时(秒)</th><th>正确率</th><th>答对题数</th></tr>';
        
        // 按完成时间排序
        const sortedPlayers = Object.entries(results).sort((a, b) => a[1].totalTime - b[1].totalTime);
        
        sortedPlayers.forEach(([playerId, data]) => {
            allPlayersHtml += `
                <tr>
                    <td>${data.name}</td>
                    <td>${data.totalTime.toFixed(1)}</td>
                    <td>${data.accuracy.toFixed(1)}%</td>
                    <td>${data.correctAnswers}</td>
                </tr>
            `;
        });
        
        allPlayersHtml += '</table></div>';
        resultsDiv.innerHTML += allPlayersHtml;
        
        // 添加返回房间按钮
        const returnButton = document.createElement('button');
        returnButton.textContent = '返回房间';
        returnButton.className = 'restart-button';
        returnButton.onclick = () => {
            this.returnToRoom();  // 使用已有的returnToRoom方法
            this.socket.emit('leave_game');
        };
        resultsDiv.appendChild(returnButton);
    }
}

// 添加滑出动画
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOutRight {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100%);
        }
    }
`;
document.head.appendChild(style);

// 全局实例
let wordBattleClient;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    wordBattleClient = new WordBattleClient();
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
    if (wordBattleClient && wordBattleClient.socket) {
        wordBattleClient.socket.disconnect();
    }
}); 