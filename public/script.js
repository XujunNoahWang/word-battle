// 游戏客户端类
class WordBattleClient {
    constructor() {
        this.socket = null;
        this.playerId = null;
        this.currentRoom = null;
        this.gameState = {
            players: [],
            rooms: []
        };
        
        this.init();
    }

    // 初始化客户端
    init() {
        this.setupUI();
        this.connectToServer();
    }

    // 设置UI事件监听
    setupUI() {
        // 创建房间相关
        document.getElementById('createRoomBtn').addEventListener('click', () => {
            this.showCreateRoomModal();
        });

        document.getElementById('closeModalBtn').addEventListener('click', () => {
            this.hideCreateRoomModal();
        });

        document.getElementById('cancelCreateBtn').addEventListener('click', () => {
            this.hideCreateRoomModal();
        });

        document.getElementById('confirmCreateBtn').addEventListener('click', () => {
            this.createRoom();
        });

        // 房间操作
        document.getElementById('leaveRoomBtn').addEventListener('click', () => {
            this.leaveRoom();
        });

        document.getElementById('startGameBtn').addEventListener('click', () => {
            this.startGame();
        });

        // 模态框背景点击关闭
        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('modalOverlay')) {
                this.hideCreateRoomModal();
            }
        });

        // 回车键提交房间名称
        document.getElementById('roomNameInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.createRoom();
            }
        });
    }

    // 连接到服务器
    connectToServer() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.hostname}:3001`;
        
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
            localStorage.setItem('word_battle_player_id', playerId);
            this.updatePlayerBadge(playerId);
            this.showNotification('连接成功', `您的身份: ${playerId}`, 'success');
        });

        // 游戏状态更新
        this.socket.on('game_state_update', (gameState) => {
            this.gameState = gameState;
            this.updateUI();
        });

        // 玩家列表更新
        this.socket.on('players_update', (players) => {
            this.gameState.players = players;
            this.updatePlayersDisplay();
        });

        // 游戏开始
        this.socket.on('game_started', (data) => {
            this.showNotification('游戏开始', data.message, 'success');
            this.showGameStartedMessage(data.message);
        });

        // 房间解散
        this.socket.on('room_dissolved', (data) => {
            this.showNotification('房间解散', data.message, 'warning');
            this.currentRoom = null;
            this.showLobby();
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
    }

    // 请求身份验证
    requestIdentity() {
        const existingPlayerId = localStorage.getItem('word_battle_player_id');
        this.socket.emit('request_identity', existingPlayerId);
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
    }

    // 更新玩家列表显示
    updatePlayersDisplay() {
        const playersContainer = document.getElementById('playersList');
        const playersCount = document.getElementById('playersCount');
        
        // 显示所有在线玩家（包括自己），过滤掉离线玩家
        const onlinePlayers = this.gameState.players.filter(p => p.status !== 'offline');
        
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
        const rooms = this.gameState.rooms.filter(room => !room.gameStarted);

        if (rooms.length === 0) {
            roomsContainer.innerHTML = `
                <div class="empty-state">
                    <p>暂无活动房间</p>
                    <p class="hint">点击"创建房间"开始游戏</p>
                </div>
            `;
            return;
        }

        roomsContainer.innerHTML = rooms.map(room => `
            <div class="room-item" onclick="wordBattleClient.joinRoom('${room.id}')">
                <div class="room-header">
                    <span class="room-name">${room.name}</span>
                    <span class="room-players-count">${room.players.length} 人</span>
                </div>
                <div class="room-info">
                    房主: ${room.host} | 状态: ${room.gameStarted ? '游戏中' : '等待中'}
                </div>
            </div>
        `).join('');
    }

    // 更新房间视图
    updateRoomView() {
        if (!this.currentRoom) return;

        const room = this.gameState.rooms.find(r => r.id === this.currentRoom);
        if (!room) {
            this.currentRoom = null;
            this.showLobby();
            return;
        }

        // 更新房间标题
        document.getElementById('roomTitle').textContent = room.name;

        // 显示/隐藏开始游戏按钮
        const startBtn = document.getElementById('startGameBtn');
        if (room.host === this.playerId && !room.gameStarted) {
            startBtn.classList.remove('hidden');
        } else {
            startBtn.classList.add('hidden');
        }

        // 更新房间玩家列表
        const roomPlayersContainer = document.getElementById('roomPlayersList');
        roomPlayersContainer.innerHTML = room.players.map(playerId => {
            const player = this.gameState.players.find(p => p.id === playerId);
            const isHost = playerId === room.host;
            
            return `
                <div class="room-player-item">
                    <span class="room-player-name">${player ? player.name : playerId}</span>
                    ${isHost ? '<span class="host-badge">房主</span>' : ''}
                </div>
            `;
        }).join('');
    }

    // 显示创建房间模态框
    showCreateRoomModal() {
        document.getElementById('modalOverlay').classList.remove('hidden');
        document.getElementById('roomNameInput').focus();
    }

    // 隐藏创建房间模态框
    hideCreateRoomModal() {
        document.getElementById('modalOverlay').classList.add('hidden');
        document.getElementById('roomNameInput').value = '';
    }

    // 创建房间
    createRoom() {
        const roomName = document.getElementById('roomNameInput').value.trim();
        
        if (!roomName) {
            this.showNotification('输入错误', '请输入房间名称', 'error');
            return;
        }

        if (roomName.length > 20) {
            this.showNotification('输入错误', '房间名称不能超过20个字符', 'error');
            return;
        }

        this.socket.emit('create_room', {
            playerId: this.playerId,
            roomName: roomName
        });

        this.hideCreateRoomModal();
        this.showNotification('创建房间', `房间 "${roomName}" 创建成功`, 'success');
    }

    // 加入房间
    joinRoom(roomId) {
        const room = this.gameState.rooms.find(r => r.id === roomId);
        
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
        this.showNotification('加入房间', `已加入房间 "${room.name}"`, 'success');
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
    }

    // 显示房间
    showRoom() {
        document.getElementById('lobby').classList.add('hidden');
        document.getElementById('roomView').classList.remove('hidden');
    }

    // 显示游戏开始消息
    showGameStartedMessage(message) {
        const gameArea = document.querySelector('.game-area');
        gameArea.innerHTML = `
            <div class="game-started-message">
                <h2 style="color: var(--primary-color); margin-bottom: var(--spacing-md);">${message}</h2>
                <p style="color: var(--text-secondary);">游戏即将开始...</p>
            </div>
        `;
        
        // 5秒后恢复等待状态
        setTimeout(() => {
            if (gameArea.querySelector('.game-started-message')) {
                gameArea.innerHTML = `
                    <div class="waiting-message">
                        <p>等待房主开始游戏...</p>
                    </div>
                `;
            }
        }, 5000);
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