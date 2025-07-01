// 游戏客户端类
class WordBattleClient {
    constructor() {
        this.socket = null;
        this.playerId = localStorage.getItem('word_battle_player_id') || null;
        this.currentRoom = null;
        this.gameState = {
            players: {},
            rooms: {}
        };
        this.audioContextActivated = false; // 跟踪移动端音频上下文状态
        
        // 移动端设备检测和初始化日志
        if (this.isMobileDevice()) {
            console.log('📱 检测到移动设备，将在游戏开始时激活语音功能');
            console.log('📱 User Agent:', navigator.userAgent);
        }
        
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
        document.getElementById('createRoomBtn').addEventListener('click', async () => {
            await this.createRoom();
        });

        document.getElementById('leaveRoomBtn').addEventListener('click', () => {
            this.leaveRoom();
        });

        document.getElementById('startGameBtn').addEventListener('click', async () => {
            await this.startGame();
        });

        document.getElementById('playerBadge').addEventListener('click', () => {
            this.showEditNameModal();
        });

        document.getElementById('cancelEditName').addEventListener('click', () => {
            this.hideEditNameModal();
        });

        document.getElementById('confirmEditName').addEventListener('click', () => {
            this.updatePlayerName();
        });

        document.getElementById('newNameInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.updatePlayerName();
            }
        });
    }

    // 单词管理相关
    setupWordManager() {
        document.getElementById('addWordBtn').addEventListener('click', () => {
            const passwordModal = document.getElementById('passwordModal');
            const passwordInput = document.getElementById('passwordInput');
            passwordModal.classList.remove('hidden');
            passwordModal.classList.add('show');
            passwordInput.value = '';
            passwordInput.focus();
        });

        document.getElementById('cancelPassword').addEventListener('click', () => {
            const passwordModal = document.getElementById('passwordModal');
            passwordModal.classList.add('hidden');
            passwordModal.classList.remove('show');
        });

        document.getElementById('confirmPassword').addEventListener('click', () => {
            this.verifyPassword();
        });

        document.getElementById('passwordInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.verifyPassword();
            }
        });

        document.getElementById('closeWordManager').addEventListener('click', () => {
            document.getElementById('wordManager').classList.add('hidden');
            document.getElementById('lobby').classList.remove('hidden');
        });

        document.getElementById('wordInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addWord();
            }
        });

        document.getElementById('addWordToList').addEventListener('click', () => {
            this.addWord();
        });
    }

    // 验证密码
    verifyPassword() {
        const ADMIN_PASSWORD = '0627';
        const passwordModal = document.getElementById('passwordModal');
        const passwordInput = document.getElementById('passwordInput');
        const password = passwordInput.value;

        if (password === ADMIN_PASSWORD) {
            passwordModal.classList.add('hidden');
            passwordModal.classList.remove('show');
            document.getElementById('wordManager').classList.remove('hidden');
            document.getElementById('lobby').classList.add('hidden');
            this.loadWords();
        } else {
            this.showNotification('error', 'wordManager.error');
            passwordInput.value = '';
            passwordInput.focus();
        }
    }

    // 连接到服务器
    connectToServer() {
        this.socket = io();

        this.socket.on('connect', () => {
            console.log('已连接到服务器');
            this.hideLoading();
            this.requestIdentity();
            
            // 如果已经有玩家ID和名字，立即更新显示
            const playerId = localStorage.getItem('word_battle_player_id');
            if (playerId && this.gameState.players[playerId]) {
                this.updatePlayerBadge(this.gameState.players[playerId].name);
            } else {
                // 如果没有，显示连接状态
                const playerBadge = document.getElementById('playerBadge');
                playerBadge.setAttribute('data-i18n', 'app.connecting');
                playerBadge.textContent = i18n.t('app.connecting');
            }
        });

        this.socket.on('identity_assigned', (playerId) => {
            this.playerId = playerId;
            localStorage.setItem('word_battle_player_id', playerId);
            
            const currentPlayer = this.gameState.players[playerId];
            if (currentPlayer) {
                this.updatePlayerBadge(currentPlayer.name);
            }
        });

        this.socket.on('game_state_update', (gameState) => {
            this.gameState = gameState;
            this.updateUI();
        });

        this.socket.on('players_update', (players) => {
            const oldName = this.gameState.players[this.playerId]?.name;
            this.gameState.players = players;
            
            const newName = players[this.playerId]?.name;
            if (oldName && newName && oldName !== newName) {
                this.updatePlayerBadge(newName);
            }
            
            this.updatePlayersDisplay();
        });

        this.socket.on('preload_started', (data) => {
            this.showPreloadView(data);
        });

        this.socket.on('preload_progress_update', (data) => {
            this.updatePreloadProgress(data);
        });

        this.socket.on('game_started', async (gameData) => {
            await this.showGameView(gameData);
        });

        this.socket.on('next_question', (data) => {
            this.updateGameView(data);
        });

        this.socket.on('game_over', (data) => {
            this.showGameOver(data);
        });

        this.socket.on('answer_result', (data) => {
            const { isCorrect, progress } = data;
            this.updateProgress(progress);
        });

        this.socket.on('room_created', (data) => {
            this.currentRoom = data.roomId;
            this.showRoom();
        });

        this.socket.on('room_dissolved', (data) => {
            if (this.gameState.rooms[this.currentRoom]) {
                delete this.gameState.rooms[this.currentRoom];
            }
            
            if (this.gameState.players[this.playerId]) {
                this.gameState.players[this.playerId].status = 'idle';
                this.gameState.players[this.playerId].room = null;
            }

            this.currentRoom = null;

            document.getElementById('lobby').classList.remove('hidden');
            document.getElementById('roomView').classList.add('hidden');
            document.getElementById('preloadView').classList.add('hidden');
            document.getElementById('gameView').classList.add('hidden');

            this.updateRoomsDisplay();
            this.updatePlayersDisplay();
            
            this.showNotification('warning', 'notification.roomLeft', { name: data.roomName });
        });

        this.socket.on('connect_error', (error) => {
            console.error('连接错误:', error);
            this.showNotification('error', 'notification.disconnected');
        });

        this.socket.on('disconnect', (reason) => {
            console.log('连接断开:', reason);
            this.showNotification('warning', 'notification.reconnecting');
        });

        this.socket.on('reconnect', () => {
            console.log('重新连接成功');
            this.requestIdentity();
            this.showNotification('success', 'notification.connected');
        });

        this.socket.on('image_downloaded', (data) => {
            if (data.success) {
                this.showNotification('success', 'wordManager.addSuccess', { word: data.word });
                this.loadWords();
            } else {
                this.showNotification('warning', 'wordManager.error', { word: data.word });
            }
        });

        this.socket.on('game_completed', (results) => {
            this.showGameResults(results);
        });

        this.socket.on('all_players_completed', (results) => {
            this.showAllPlayersResults(results);
        });

        this.socket.on('game_start_error', (data) => {
            this.showNotification('error', 'notification.error', { message: data.message });
        });
    }

    // 请求身份验证
    requestIdentity() {
        const savedId = localStorage.getItem('word_battle_player_id');
        const savedName = localStorage.getItem('word_battle_player_name');
        
        this.socket.emit('request_identity', { 
            savedId,
            savedName
        });
    }

    // 显示/隐藏加载状态
    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
    }

    // 更新玩家徽章
    updatePlayerBadge(playerName) {
        const playerBadge = document.getElementById('playerBadge');
        playerBadge.removeAttribute('data-i18n'); // 移除连接状态的i18n属性
        playerBadge.textContent = playerName;
        localStorage.setItem('word_battle_player_name', playerName);
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
        const createRoomText = createRoomBtn.querySelector('span');
        createRoomText.setAttribute('data-i18n', 'lobby.createRoom');
        createRoomText.textContent = i18n.t('lobby.createRoom');
        
        const currentPlayer = this.gameState.players[this.playerId];
        
        if (currentPlayer && currentPlayer.status === 'in_room') {
            createRoomBtn.disabled = true;
            createRoomBtn.innerHTML = `<span data-i18n="lobby.alreadyInRoom">${i18n.t('lobby.alreadyInRoom')}</span>`;
            createRoomBtn.classList.add('disabled');
        } else {
            createRoomBtn.disabled = false;
            createRoomBtn.innerHTML = `<span data-i18n="lobby.createRoom">${i18n.t('lobby.createRoom')}</span>`;
            createRoomBtn.classList.remove('disabled');
        }
    }

    // 更新玩家列表显示
    updatePlayersDisplay() {
        const playersContainer = document.getElementById('playersList');
        const playersCount = document.getElementById('playersCount');
        
        const onlinePlayers = Object.values(this.gameState.players).filter(p => p.status !== 'offline');
        
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
                    <p data-i18n="lobby.noActiveRooms">${i18n.t('lobby.noActiveRooms')}</p>
                    <p class="hint" data-i18n="lobby.clickToCreate">${i18n.t('lobby.clickToCreate')}</p>
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
                        <span class="room-name" data-i18n="lobby.roomName" data-i18n-params='${JSON.stringify({name: hostPlayer.name})}'>${i18n.t('lobby.roomName', {name: hostPlayer.name})}</span>
                        <span class="player-count" data-i18n="lobby.playerCount" data-i18n-params='${JSON.stringify({count: room.players.length})}'>${i18n.t('lobby.playerCount', {count: room.players.length})}</span>
                    </div>
                    ${!isPlayerInRoom ? `
                        <button class="btn btn-primary join-room-btn" onclick="wordBattleClient.joinRoom('${room.id}').catch(console.error)">
                            <span data-i18n="lobby.joinRoom">${i18n.t('lobby.joinRoom')}</span>
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

        document.getElementById('roomTitle').textContent = `${this.gameState.players[room.host].name}的房间`;
        document.getElementById('roomHostName').textContent = this.gameState.players[room.host].name;

        const playersList = document.getElementById('roomPlayersList');
        playersList.innerHTML = room.players.map(playerId => {
            const player = this.gameState.players[playerId];
            let statusText = '';
            
            switch(player.status) {
                case 'in_room':
                    statusText = '准备中';
                    break;
                case 'preloading':
                    statusText = '预加载中';
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

        const startGameBtn = document.getElementById('startGameBtn');
        if (startGameBtn) {
            if (isHost) {
                startGameBtn.classList.remove('hidden');
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
    async createRoom() {
        if (this.currentRoom) {
            this.showNotification('warning', 'notification.error', { message: i18n.t('notification.alreadyInRoom') });
            return;
        }
        
        this.socket.emit('create_room', { playerId: this.playerId });
        this.showNotification('success', 'notification.roomCreated');
    }

    // 加入房间
    async joinRoom(roomId) {
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

        if (this.isMobileDevice() && !this.audioContextActivated) {
            console.log('📱 移动端在加入房间时激活音频上下文...');
            try {
                await this.activateAudioContext();
                this.showNotification('🔊 语音准备', '移动端语音功能已准备就绪！', 'success');
            } catch (error) {
                console.warn('音频上下文激活失败:', error);
            }
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
    async startGame() {
        if (!this.currentRoom) return;
        
        if (this.isMobileDevice() && !this.audioContextActivated) {
            console.log('📱 移动端在用户交互时激活音频上下文...');
            try {
                await this.activateAudioContext();
                this.showNotification('🔊 语音功能', '移动端语音功能已激活！每题会自动播放英文发音', 'success');
            } catch (error) {
                console.warn('音频上下文激活失败:', error);
            }
        }
        
        this.socket.emit('start_game', {
            playerId: this.playerId,
            roomId: this.currentRoom
        });
    }

    // 显示大厅
    showLobby() {
        document.getElementById('lobby').classList.remove('hidden');
        document.getElementById('roomView').classList.add('hidden');
        document.getElementById('preloadView').classList.add('hidden');
        document.getElementById('gameView').classList.add('hidden');
    }

    // 显示房间
    showRoom() {
        document.getElementById('lobby').classList.add('hidden');
        document.getElementById('roomView').classList.remove('hidden');
        document.getElementById('preloadView').classList.add('hidden');
        document.getElementById('gameView').classList.add('hidden');
    }

    // 显示游戏页面
    async showGameView(gameData) {
        document.getElementById('lobby').classList.add('hidden');
        document.getElementById('roomView').classList.add('hidden');
        document.getElementById('preloadView').classList.add('hidden');
        
        const gameView = document.getElementById('gameView');
        gameView.classList.remove('hidden');
        
        if (this.isMobileDevice()) {
            console.log('🎮 移动端游戏开始，音频上下文状态:', this.audioContextActivated);
        }
        
        this.updateGameView(gameData);
    }

    // 更新游戏视图
    updateGameView(data) {
        const { word, images } = data;
        
        document.querySelector('.word-display h2').textContent = word;
        
        const existingButton = document.querySelector('.replay-button');
        if (existingButton) {
            existingButton.remove();
        }
        
        const replayButton = document.createElement('button');
        replayButton.className = 'replay-button';
        replayButton.innerHTML = '▶';
        replayButton.onclick = async () => {
            await this.speakWord(word);
        };
        document.querySelector('.word-display').appendChild(replayButton);
        
        const imageGrid = document.querySelector('.image-grid');
        imageGrid.innerHTML = images.map((image, index) => `
            <div class="image-item" data-index="${index}">
                <img src="/data/images/${image}.jpg" alt="选项${index + 1}">
            </div>
        `).join('');
        
        const imageItems = document.querySelectorAll('.image-item');
        let loadedImages = 0;
        
        imageItems.forEach((item, index) => {
            const img = item.querySelector('img');
            
            img.onload = () => {
                loadedImages++;
                if (loadedImages === images.length) {
                    setTimeout(async () => {
                        await this.speakWord(word);
                        if (this.isMobileDevice()) {
                            console.log('📱 移动端自动播放语音完成:', word);
                        }
                    }, 300);
                }
            };
            
            img.onerror = () => {
                console.error(`Failed to load image: ${image}`);
                item.innerHTML = `<div class="image-error">图片加载失败</div>`;
            };
            
            item.onclick = (e) => this.selectAnswer(images[index], item);
        });
    }

    // 检测是否为移动设备
    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
               ('ontouchstart' in window) || 
               (navigator.maxTouchPoints > 0);
    }

    // 激活音频上下文（移动端专用）
    async activateAudioContext() {
        if (this.isMobileDevice() && 'speechSynthesis' in window && !this.audioContextActivated) {
            try {
                const silentUtterance = new SpeechSynthesisUtterance('');
                silentUtterance.volume = 0;
                silentUtterance.rate = 10;
                silentUtterance.text = ' ';
                
                return new Promise((resolve) => {
                    silentUtterance.onend = () => {
                        console.log('📱 移动端音频上下文已激活');
                        this.audioContextActivated = true;
                        resolve();
                    };
                    silentUtterance.onerror = () => {
                        console.warn('⚠️ 音频上下文激活失败，但继续执行');
                        this.audioContextActivated = true;
                        resolve();
                    };
                    speechSynthesis.speak(silentUtterance);
                    
                    setTimeout(() => {
                        this.audioContextActivated = true;
                        resolve();
                    }, 500);
                });
            } catch (error) {
                console.warn('音频上下文激活失败:', error);
                this.audioContextActivated = true;
            }
        }
    }

    // 语音播报单词
    async speakWord(word) {
        if ('speechSynthesis' in window) {
            if (this.isMobileDevice() && !this.audioContextActivated) {
                console.log('📱 移动端音频上下文未激活，正在激活...');
                await this.activateAudioContext();
            }
            
            speechSynthesis.cancel();
            
            await new Promise(resolve => setTimeout(resolve, 50));
            
            const utterance = new SpeechSynthesisUtterance(word);
            utterance.lang = 'en-US';
            utterance.rate = 0.8;
            utterance.volume = 1;
            
            utterance.onstart = () => {
                if (this.isMobileDevice()) {
                    console.log('📱 移动端语音开始播放:', word);
                }
            };
            
            utterance.onend = () => {
                if (this.isMobileDevice()) {
                    console.log('📱 移动端语音播放完成:', word);
                }
            };
            
            utterance.onerror = (event) => {
                console.warn('语音播放失败:', event.error, '单词:', word);
                if (this.isMobileDevice()) {
                    console.log('📱 移动端语音播放失败，重置音频上下文状态');
                    this.audioContextActivated = false;
                }
            };
            
            speechSynthesis.speak(utterance);
        }
    }

    // 选择答案
    async selectAnswer(selectedImage, imageElement) {
        if (imageElement.classList.contains('correct') || imageElement.classList.contains('incorrect')) {
            return;
        }
        
        const allImages = document.querySelectorAll('.image-item');
        allImages.forEach(item => item.style.pointerEvents = 'none');
        
        this.socket.emit('answer_selected', {
            playerId: this.playerId,
            roomId: this.currentRoom,
            selectedImage: selectedImage
        });

        this.socket.once('answer_result', (data) => {
            const { isCorrect, progress } = data;
            
            const feedbackClass = isCorrect ? 'correct' : 'wrong';
            imageElement.classList.add(feedbackClass);
            
            if (progress) {
                this.updateProgress(progress);
            }
            
            setTimeout(() => {
                imageElement.classList.remove(feedbackClass);
                allImages.forEach(item => item.style.pointerEvents = 'auto');
                
                this.socket.emit('request_next_question', {
                    playerId: this.playerId,
                    roomId: this.currentRoom
                });
            }, 500);
        });
    }

    // 显示游戏结束
    showGameOver(data = {}) {
        const gameView = document.getElementById('gameView');
        const reason = data.reason ? `<p class="game-over-reason">${data.player}${data.reason}</p>` : '';
        
        gameView.innerHTML = `
            <div class="game-over">
                <h2>游戏结束！</h2>
                ${reason}
                <div class="return-room-button">
                    <button class="btn btn-primary" onclick="wordBattleClient.returnToRoom()">
                        返回房间
                    </button>
                </div>
            </div>
        `;
    }

    // 返回房间
    returnToRoom() {
        this.socket.emit('return_to_room', {
            playerId: this.playerId,
            roomId: this.currentRoom
        });

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
        
        this.showRoom();
    }

    // 显示通知
    showNotification(title, messageKey, type = 'info', params = {}) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const titleElement = document.createElement('div');
        titleElement.className = 'notification-title';
        titleElement.textContent = i18n.t(`notification.${title}`, params);
        
        const messageElement = document.createElement('div');
        messageElement.className = 'notification-message';
        messageElement.textContent = i18n.t(messageKey, params);
        
        notification.appendChild(titleElement);
        notification.appendChild(messageElement);
        
        const container = document.getElementById('notificationContainer');
        container.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
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
        
        if (newName) {
            this.socket.emit('update_name', {
                playerId: this.playerId,
                newName: newName
            });
            this.hideEditNameModal();
            this.showNotification('success', 'notification.nameChanged');
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
        
        this.updateWordCount(words.length);
    }

    // 更新单词数量显示
    updateWordCount(count) {
        const wordCountElement = document.getElementById('wordCount');
        if (wordCountElement) {
            wordCountElement.textContent = count;
        }
    }

    // 更新游戏进度显示
    updateProgress(progress) {
        if (!progress) return;
        
        const currentProgress = document.getElementById('current-progress');
        const totalQuestions = document.getElementById('total-questions');
        const correctAnswers = document.getElementById('correct-answers');
        
        if (currentProgress && progress.hasOwnProperty('current')) {
            currentProgress.textContent = progress.current;
        }
        if (totalQuestions && progress.hasOwnProperty('total')) {
            totalQuestions.textContent = progress.total;
        }
        if (correctAnswers && progress.hasOwnProperty('correct')) {
            correctAnswers.textContent = progress.correct;
        }
    }

    // 显示游戏结果
    showGameResults(results) {
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

    // 显示预加载页面
    showPreloadView(data) {
        document.getElementById('lobby').classList.add('hidden');
        document.getElementById('roomView').classList.add('hidden');
        document.getElementById('gameView').classList.add('hidden');
        
        const preloadView = document.getElementById('preloadView');
        preloadView.classList.remove('hidden');
        
        document.getElementById('preloadImageCount').textContent = 
            `正在加载 ${data.totalImages} 张图片...`;
        
        this.updatePreloadProgress({ players: data.players });
        
        this.startImagePreload(data.images);
    }

    // 更新预加载进度
    updatePreloadProgress(data) {
        const preloadPlayers = document.getElementById('preloadPlayers');
        
        preloadPlayers.innerHTML = data.players.map(player => {
            const statusText = player.completed ? '加载完成' : `${player.progress}%`;
            const statusClass = player.completed ? 'completed' : '';
            
            return `
                <div class="preload-player ${player.completed ? 'completed' : ''}">
                    <div class="preload-player-header">
                        <span class="preload-player-name">${player.name}</span>
                        <span class="preload-player-status ${statusClass}">${statusText}</span>
                    </div>
                    <div class="preload-progress-bar">
                        <div class="preload-progress-fill ${player.completed ? 'completed' : ''}" 
                             style="width: ${player.progress}%"></div>
                    </div>
                    <div class="preload-progress-text">${player.progress}% 完成</div>
                </div>
            `;
        }).join('');
    }

    // 开始图片预加载
    async startImagePreload(images) {
        let loadedCount = 0;
        const totalImages = images.length;
        const imageCache = [];

        const loadPromises = images.map((imageName, index) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    loadedCount++;
                    imageCache.push(img);
                    
                    this.socket.emit('preload_progress', {
                        playerId: this.playerId,
                        roomId: this.currentRoom,
                        loadedImages: loadedCount,
                        totalImages: totalImages
                    });
                    
                    resolve();
                };
                img.onerror = () => {
                    console.warn(`图片加载失败: ${imageName}`);
                    loadedCount++;
                    
                    this.socket.emit('preload_progress', {
                        playerId: this.playerId,
                        roomId: this.currentRoom,
                        loadedImages: loadedCount,
                        totalImages: totalImages
                    });
                    
                    resolve();
                };
                img.src = `/data/images/${imageName}.jpg`;
            });
        });

        try {
            await Promise.all(loadPromises);
            console.log(`预加载完成: ${loadedCount}/${totalImages} 张图片`);
            
            this.imageCache = imageCache;
        } catch (error) {
            console.error('预加载过程中出现错误:', error);
        }
    }

    // 显示所有玩家的最终成绩
    showAllPlayersResults(results) {
        let resultsContainer = document.querySelector('.results-container');
        if (!resultsContainer) {
            resultsContainer = document.createElement('div');
            resultsContainer.className = 'results-container';
            document.getElementById('gameView').appendChild(resultsContainer);
        }

        const existingResults = resultsContainer.querySelector('.all-players-results');
        if (existingResults) {
            existingResults.remove();
        }
        const existingButton = resultsContainer.querySelector('.restart-button');
        if (existingButton) {
            existingButton.remove();
        }
        
        let allPlayersHtml = '<div class="all-players-results"><h3>所有玩家成绩</h3><table>';
        allPlayersHtml += '<tr><th>玩家</th><th>用时(秒)</th><th>正确率</th><th>答对题数</th></tr>';
        
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
        resultsContainer.insertAdjacentHTML('beforeend', allPlayersHtml);
        
        const returnButton = document.createElement('button');
        returnButton.textContent = '返回房间';
        returnButton.className = 'restart-button';
        returnButton.onclick = () => {
            this.returnToRoom();
            this.socket.emit('leave_game');
        };
        resultsContainer.appendChild(returnButton);
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

// 语言切换功能
const languageSwitch = document.getElementById('languageSwitch');
const languageButtons = languageSwitch.querySelectorAll('.language-btn');

// 更新输入框的placeholder
function updatePlaceholders() {
    document.querySelectorAll('[data-i18n-placeholder]').forEach(input => {
        const key = input.getAttribute('data-i18n-placeholder');
        input.placeholder = i18n.t(key);
    });
}

// 初始化语言切换按钮状态
function initLanguageButtons() {
    languageButtons.forEach(btn => {
        if (btn.getAttribute('data-lang') === i18n.currentLang) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// 语言切换事件处理
languageButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const lang = btn.getAttribute('data-lang');
        if (lang === i18n.currentLang) return;

        // 更新按钮状态
        languageButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // 切换语言
        i18n.switchLanguage(lang);
        
        // 更新所有文本
        i18n.updateAllTexts();
        
        // 更新输入框placeholder
        updatePlaceholders();
    });
});

// 订阅语言变化
i18n.subscribe(() => {
    i18n.updateAllTexts();
    updatePlaceholders();
});

// 初始化语言设置
initLanguageButtons();
updatePlaceholders();

// 创建房间卡片
function createRoomCard(room) {
    const card = document.createElement('div');
    card.className = 'room-card';
    card.setAttribute('data-room-id', room.id);

    const roomName = document.createElement('h3');
    roomName.setAttribute('data-i18n', 'lobby.roomName');
    roomName.setAttribute('data-i18n-params', JSON.stringify({ name: room.host }));
    roomName.textContent = i18n.t('lobby.roomName', { name: room.host });

    const status = document.createElement('span');
    const statusKey = room.status === 'waiting' ? 'lobby.roomStatus.waiting' :
                     room.status === 'playing' ? 'lobby.roomStatus.playing' :
                     'lobby.roomStatus.loading';
    status.setAttribute('data-i18n', statusKey);
    status.textContent = i18n.t(statusKey);

    card.appendChild(roomName);
    card.appendChild(status);
    return card;
}

// 创建玩家列表项
function createPlayerListItem(player) {
    const item = document.createElement('div');
    item.className = 'player-item';
    item.setAttribute('data-player-id', player.id);

    const name = document.createElement('span');
    name.textContent = player.name;

    const status = document.createElement('span');
    const statusKey = player.status === 'online' ? 'lobby.playerStatus.online' :
                     player.status === 'offline' ? 'lobby.playerStatus.offline' :
                     player.status === 'inRoom' ? 'lobby.playerStatus.inRoom' :
                     'lobby.playerStatus.playing';
    status.setAttribute('data-i18n', statusKey);
    status.textContent = i18n.t(statusKey);

    item.appendChild(name);
    item.appendChild(status);
    return item;
}

// 更新空状态显示
function updateEmptyState(container, type) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';

    const message = document.createElement('p');
    if (type === 'rooms') {
        message.setAttribute('data-i18n', 'lobby.noActiveRooms');
        message.textContent = i18n.t('lobby.noActiveRooms');
        
        const hint = document.createElement('p');
        hint.className = 'hint';
        hint.setAttribute('data-i18n', 'lobby.clickToCreate');
        hint.textContent = i18n.t('lobby.clickToCreate');
        
        emptyState.appendChild(message);
        emptyState.appendChild(hint);
    } else {
        message.setAttribute('data-i18n', 'lobby.noPlayers');
        message.textContent = i18n.t('lobby.noPlayers');
        emptyState.appendChild(message);
    }

    container.innerHTML = '';
    container.appendChild(emptyState);
}

// 更新玩家数量显示
function updatePlayerCount(count) {
    const countBadge = document.getElementById('playersCount');
    countBadge.setAttribute('data-i18n', 'lobby.playerCount');
    countBadge.setAttribute('data-i18n-params', JSON.stringify({ count }));
    countBadge.textContent = i18n.t('lobby.playerCount', { count });
}

// 更新预加载进度
function updatePreloadProgress(current, total) {
    const progressText = document.getElementById('preloadImageCount');
    progressText.setAttribute('data-i18n', 'preload.progress');
    progressText.setAttribute('data-i18n-params', JSON.stringify({ current, total }));
    progressText.textContent = i18n.t('preload.progress', { current, total });
}

// 更新玩家预加载进度
function updatePlayerProgress(name, progress) {
    const playerProgress = document.createElement('div');
    playerProgress.className = 'player-progress';
    playerProgress.setAttribute('data-i18n', 'preload.playerProgress');
    playerProgress.setAttribute('data-i18n-params', JSON.stringify({ name, progress }));
    playerProgress.textContent = i18n.t('preload.playerProgress', { name, progress });
    return playerProgress;
} 