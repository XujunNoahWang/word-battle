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
        
        // 初始化图片优化器
        this.imageOptimizer = new ImageOptimizer();
        this.preloadProgress = { loaded: 0, total: 0, percent: 0 };
        
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
        this.setupLanguageSwitcher();
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

        // 浏览单词库按钮
        document.getElementById('browseWordsBtn').addEventListener('click', () => {
            this.showWordLibrary();
        });

        document.getElementById('closeWordLibrary').addEventListener('click', () => {
            document.getElementById('wordLibrary').classList.add('hidden');
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

    // 设置语言切换功能
    setupLanguageSwitcher() {
        const languageSwitcher = document.getElementById('languageSwitcher');
        if (languageSwitcher) {
            languageSwitcher.addEventListener('click', () => {
                this.switchLanguage();
            });
        }

        // 监听语言变化
        if (window.i18n) {
            window.i18n.addObserver((newLanguage) => {
                this.onLanguageChanged(newLanguage);
            });
        }
    }

    // 切换语言
    switchLanguage() {
        if (!window.i18n) return;
        
        const currentLang = window.i18n.getCurrentLanguage();
        const newLang = currentLang === 'zh' ? 'en' : 'zh';
        
        window.i18n.switchLanguage(newLang);
    }

    // 语言变化回调
    onLanguageChanged(newLanguage) {
        // 保存当前玩家名称
        const currentPlayer = this.gameState.players[this.playerId];
        const playerName = currentPlayer ? currentPlayer.name : this.playerId;
        
        // 更新动态内容
        this.updateDynamicContent();
        
        // 重新渲染玩家列表和房间列表
        this.updatePlayersDisplay();
        this.updateRoomsDisplay();
        
        // 如果在房间中，更新房间视图
        if (this.currentRoom) {
            this.updateRoomView();
        }
        
        // 确保玩家名称显示正确
        this.updatePlayerBadge(playerName);
    }

    // 更新动态内容
    updateDynamicContent() {
        // 更新玩家数量显示
        const playersCount = Object.keys(this.gameState.players).length;
        const playersCountElement = document.getElementById('playersCount');
        if (playersCountElement && window.i18n) {
            playersCountElement.textContent = window.i18n.t('lobby.playersCount', { count: playersCount });
        }

        // 更新预加载进度文本
        const preloadImageCount = document.getElementById('preloadImageCount');
        if (preloadImageCount && window.i18n) {
            preloadImageCount.textContent = window.i18n.t('preload.loadingImages');
        }

        // 更新创建房间按钮
        this.updateCreateRoomButton();

        // 更新玩家徽章的tooltip
        const playerBadge = document.getElementById('playerBadge');
        if (playerBadge && window.i18n) {
            playerBadge.title = window.i18n.t('tooltips.clickToEdit');
        }

        // 更新添加单词按钮的tooltip
        const addWordBtn = document.getElementById('addWordBtn');
        if (addWordBtn && window.i18n) {
            addWordBtn.title = window.i18n.t('tooltips.addWords');
        }
    }

    // 获取状态文本
    getStatusText(status) {
        // 将下划线格式转换为驼峰格式
        const camelCase = status.replace(/_([a-z])/g, g => g[1].toUpperCase());
        return i18n.t(`status.${camelCase}`);
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
            this.showNotification('common.error', 'modal.incorrectPassword', 'error');
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
        });

        this.socket.on('identity_assigned', (playerId) => {
            this.playerId = playerId;
            localStorage.setItem('word_battle_player_id', playerId);
            
            const currentPlayer = this.gameState.players[playerId];
            const displayName = currentPlayer ? currentPlayer.name : playerId;
            
            this.updatePlayerBadge(displayName);
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
            this.handleRoomDissolved(data);
        });

        this.socket.on('connect_error', (error) => {
            console.error('连接错误:', error);
            this.showNotification('notifications.connectionLost', 'notifications.connectionLost', 'error');
        });

        this.socket.on('disconnect', (reason) => {
            console.log('连接断开:', reason);
            this.showNotification('notifications.connectionLost', 'notifications.connectionLost', 'warning');
        });

        this.socket.on('reconnect', () => {
            console.log('重新连接成功');
            this.requestIdentity();
            this.showNotification('notifications.reconnected', 'notifications.reconnected', 'success');
        });

        this.socket.on('image_downloaded', (data) => {
            if (data.success) {
                this.showNotification('图片下载', `单词 "${data.word}" 的图片${data.message}`, 'success');
                this.loadWords();
            } else {
                this.showNotification('图片下载', `单词 "${data.word}" 的图片${data.message}`, 'warning');
            }
        });

        this.socket.on('game_completed', (results) => {
            this.showGameResults(results);
        });

        this.socket.on('all_players_completed', (results) => {
            this.showAllPlayersResults(results);
        });

        this.socket.on('game_start_error', (data) => {
            this.showNotification('无法开始游戏', data.message, 'error');
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
        document.getElementById('playerBadge').textContent = playerName;
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
        const currentPlayer = this.gameState.players[this.playerId];
        
        if (currentPlayer && currentPlayer.status === 'in_room') {
            createRoomBtn.disabled = true;
            const inRoomText = window.i18n ? window.i18n.t('status.inRoom') : '已在房间中';
            createRoomBtn.innerHTML = `<span>${inRoomText}</span>`;
            createRoomBtn.classList.add('disabled');
        } else {
            createRoomBtn.disabled = false;
            const createText = window.i18n ? window.i18n.t('lobby.createRoom') : '创建房间';
            createRoomBtn.innerHTML = `<span>${createText}</span>`;
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
            const emptyText = window.i18n ? window.i18n.t('lobby.noPlayers') : '暂无玩家在线';
            playersContainer.innerHTML = `
                <div class="empty-state">
                    <p>${emptyText}</p>
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
                        ${isCurrentPlayer ? (window.i18n && window.i18n.getCurrentLanguage() === 'en' ? ' (You)' : ' (你)') : ''}
                    </span>
                    <span class="player-status ${player.status}">
                        ${this.getStatusText(player.status)}
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
            const noRoomsText = window.i18n ? window.i18n.t('lobby.noRooms') : '暂无活动房间';
            const hintText = window.i18n ? window.i18n.t('lobby.noRoomsHint') : '点击"创建房间"开始游戏';
            roomsContainer.innerHTML = `
                <div class="empty-state">
                    <p>${noRoomsText}</p>
                    <p class="hint">${hintText}</p>
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
                        <span class="room-name">${window.i18n ? window.i18n.t('room.roomTitle', {name: hostPlayer.name}) : `${hostPlayer.name}的房间`}</span>
                        <span class="player-count">${room.players.length}人</span>
                    </div>
                    ${!isPlayerInRoom ? `
                        <button class="btn btn-primary join-room-btn" onclick="wordBattleClient.joinRoom('${room.id}').catch(console.error)">
                            ${window.i18n ? window.i18n.t('lobby.joinRoom') : '加入房间'}
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

        const hostName = this.gameState.players[room.host].name;
        document.getElementById('roomTitle').textContent = window.i18n ? 
            window.i18n.t('room.roomTitle', {name: hostName}) : 
            `${hostName}的房间`;
        
        const roomHostElement = document.getElementById('roomHostName');
        if (roomHostElement) {
            roomHostElement.textContent = window.i18n ? 
                window.i18n.t('room.roomHost', {name: hostName}) : 
                `房主：${hostName}`;
        }

        const playersList = document.getElementById('roomPlayersList');
        playersList.innerHTML = room.players.map(playerId => {
            const player = this.gameState.players[playerId];
            let statusText = '';
            
            statusText = this.getStatusText(player.status);
            
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
                    startGameBtn.title = window.i18n ? window.i18n.t('tooltips.startGame') : '开始游戏（需要至少2名玩家）';
                } else {
                    startGameBtn.disabled = true;
                    startGameBtn.title = window.i18n ? window.i18n.t('room.gameStartError') : '等待所有玩家准备';
                }
            } else {
                startGameBtn.classList.add('hidden');
            }
        }
    }

    // 创建房间
    async createRoom() {
        const currentPlayer = this.gameState.players[this.playerId];
        if (currentPlayer && currentPlayer.status === 'in_room') {
            this.showNotification('创建失败', '您已在房间中，请先退出当前房间', 'warning');
            return;
        }

        if (this.isMobileDevice() && !this.audioContextActivated) {
            console.log('📱 移动端在创建房间时激活音频上下文...');
            try {
                await this.activateAudioContext();
                this.showNotification('🔊 语音准备', '移动端语音功能已准备就绪！', 'success');
            } catch (error) {
                console.warn('音频上下文激活失败:', error);
            }
        }

        this.socket.emit('create_room', {
            playerId: this.playerId
        });

        this.showNotification(
            i18n.t('lobby.createRoom'),
            i18n.t('notifications.roomCreated'),
            'success'
        );
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

    // 处理房间解散事件
    handleRoomDissolved(data) {
        if (this.currentRoom) {
            this.currentRoom = null;
            this.showLobby();
            this.showNotification(
                i18n.t('notifications.roomDissolved'),
                data.message || i18n.t('notifications.roomDissolvedDetail', { roomName: data.roomName }),
                'warning'
            );
        }
    }

    // 离开房间
    leaveRoom() {
        if (!this.currentRoom) return;

        this.socket.emit('leave_room', this.playerId);
        this.currentRoom = null;
        this.showLobby();
        this.showNotification(
            i18n.t('room.leaveRoom'),
            i18n.t('notifications.returnToLobby'),
            'success'
        );
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
        document.body.style.overflow = '';
        document.body.style.height = '';
        document.body.style.touchAction = '';
        document.documentElement.style.overflow = '';
        document.documentElement.style.height = '';
        document.documentElement.style.touchAction = '';
        document.getElementById('lobby').classList.remove('hidden');
        document.getElementById('roomView').classList.add('hidden');
        document.getElementById('preloadView').classList.add('hidden');
        document.getElementById('gameView').classList.add('hidden');
    }

    // 显示房间
    showRoom() {
        document.body.style.overflow = '';
        document.body.style.height = '';
        document.body.style.touchAction = '';
        document.documentElement.style.overflow = '';
        document.documentElement.style.height = '';
        document.documentElement.style.touchAction = '';
        document.getElementById('lobby').classList.add('hidden');
        document.getElementById('roomView').classList.remove('hidden');
        document.getElementById('preloadView').classList.add('hidden');
        document.getElementById('gameView').classList.add('hidden');
    }

    // 显示游戏页面
    async showGameView(gameData) {
        document.body.style.overflow = 'hidden';
        document.body.style.height = '100vh';
        document.body.style.touchAction = 'none';
        document.documentElement.style.overflow = 'hidden';
        document.documentElement.style.height = '100vh';
        document.documentElement.style.touchAction = 'none';
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
        document.body.style.overflow = 'hidden';
        document.body.style.height = '100vh';
        document.body.style.touchAction = 'none';
        document.documentElement.style.overflow = 'hidden';
        document.documentElement.style.height = '100vh';
        document.documentElement.style.touchAction = 'none';
        const { word, images } = data;
        
        document.querySelector('.word-display h2').textContent = word;
        
        // 只在题目切换时重建重播按钮
        let replayButton = document.querySelector('.replay-button');
        if (!replayButton) {
            replayButton = document.createElement('button');
            replayButton.className = 'replay-button';
            replayButton.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><polygon points="7,5 20,12 7,19" fill="#fff"/></svg>`;
            document.querySelector('.word-display').appendChild(replayButton);
        }
        // 始终只绑定一次点击事件，点击时只播放语音
        replayButton.onclick = async () => {
            await this.speakWord(word);
        };
        
        const imageGrid = document.querySelector('.image-grid');
        imageGrid.innerHTML = images.map((image, index) => `
            <div class="image-item" data-index="${index}">
                <div class="image-bg" data-word="${image}" style="background-image: url('/data/images/${image.toLowerCase()}.webp');"></div>
            </div>
        `).join('');
        
        const imageItems = document.querySelectorAll('.image-item');
        let loadedImages = 0;
        
        imageItems.forEach((item, index) => {
            const imageBg = item.querySelector('.image-bg');
            // 兼容原有图片事件
            imageBg.setAttribute('draggable', 'false');
            imageBg.setAttribute('oncontextmenu', 'return false');
            imageBg.addEventListener('contextmenu', e => e.preventDefault());
            imageBg.addEventListener('touchstart', e => {
                if (e.touches.length === 1) {
                    e.preventDefault(); // 阻止长按弹出菜单
                }
            }, { passive: false });
            // 伪造图片加载完成事件（背景图无法直接监听加载）
            loadedImages++;
            if (loadedImages === images.length) {
                setTimeout(async () => {
                    await this.speakWord(word);
                    if (this.isMobileDevice()) {
                        console.log('📱 移动端自动播放语音完成:', word);
                    }
                }, 300);
            }
            // 移除原来的点击事件，使用触摸开始事件（方案B：Press Down + 短暂延迟）
            let touchTimer = null;
            
            // 处理触摸开始事件（移动端）
            const handleTouchStart = (e) => {
                e.preventDefault(); // 防止页面滚动和其他默认行为
                
                // 清除之前的定时器
                if (touchTimer) {
                    clearTimeout(touchTimer);
                }
                
                // 移动端立即选中，与PC端保持一致
                this.selectAnswer(images[index], item);
            };
            
            // 处理触摸结束和取消事件
            const handleTouchEnd = (e) => {
                // 如果手指在延迟期间离开，取消选择
                if (touchTimer) {
                    clearTimeout(touchTimer);
                    touchTimer = null;
                }
            };
            
            // 处理鼠标点击事件（PC端立即响应）
            const handleMouseClick = (e) => {
                e.preventDefault();
                this.selectAnswer(images[index], item);
            };
            
            // 添加触摸事件监听器（移动端）
            item.addEventListener('touchstart', handleTouchStart, { passive: false });
            item.addEventListener('touchend', handleTouchEnd);
            item.addEventListener('touchcancel', handleTouchEnd);
            
            // 添加鼠标点击事件监听器（PC端）
            item.addEventListener('click', handleMouseClick);
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
            
            // 保持图片放大状态0.5秒，然后进入下一题
            setTimeout(() => {
                // 不移除feedbackClass，保持放大状态
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
    showNotification(title, message, type = 'info') {
        const container = document.getElementById('notificationContainer');
        const notification = document.createElement('div');
        
        // 支持国际化的标题和消息
        const translatedTitle = window.i18n ? window.i18n.t(title) : title;
        const translatedMessage = window.i18n ? window.i18n.t(message) : message;
        
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-title">${translatedTitle}</div>
            <div class="notification-message">${translatedMessage}</div>
        `;

        container.appendChild(notification);

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
        
        if (newName) {
            this.socket.emit('update_name', {
                playerId: this.playerId,
                newName: newName
            });
            
            localStorage.setItem('word_battle_player_name', newName);
            
            this.hideEditNameModal();
        }
    }

    // 加载单词列表
    async loadWords() {
        try {
            const response = await fetch('/api/words');
            const words = await response.json();
            await this.displayWords(words);
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
                await this.displayWords(data.words);
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
                await this.displayWords(data.words);
                this.showNotification('成功', '单词删除成功', 'success');
            } else {
                this.showNotification('错误', data.error, 'error');
            }
        } catch (error) {
            this.showNotification('错误', '删除单词失败', 'error');
        }
    }

    // 显示单词列表
    async displayWords(words) {
        const wordList = document.getElementById('wordList');
        
        // 使用图片优化器获取URL
        const wordItems = await Promise.all(words.map(async word => {
            const imageUrl = await this.imageOptimizer.getImageUrl(word);
            return `
                <div class="word-item">
                    <div class="word-content">
                        <div class="word-image-container">
                            <img src="${imageUrl}" 
                                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" 
                                 alt="${word}"
                                 class="word-image" />
                            <div class="word-image-placeholder">⌛️</div>
                        </div>
                        <span>${word}</span>
                    </div>
                    <button onclick="wordBattleClient.deleteWord('${word}')">×</button>
                </div>
            `;
        }));
        
        wordList.innerHTML = wordItems.join('');
        this.updateWordCount(words.length);
    }

    // 更新单词数量显示
    updateWordCount(count) {
        const wordCountElement = document.getElementById('wordCount');
        if (wordCountElement) {
            wordCountElement.textContent = count;
        }
    }

    // 显示单词库浏览页面
    async showWordLibrary() {
        document.body.style.overflow = '';
        document.body.style.height = '';
        document.body.style.touchAction = '';
        document.documentElement.style.overflow = '';
        document.documentElement.style.height = '';
        document.documentElement.style.touchAction = '';
        try {
            document.body.style.overflow = '';
            document.getElementById('lobby').classList.add('hidden');
            document.getElementById('wordLibrary').classList.remove('hidden');
            
            // 初始化单词库数据
            if (!this.wordLibraryData) {
                await this.loadWordLibraryData();
            }
            
            this.setupAlphabetNavigation();
            await this.renderWordCards();
            this.setupInfiniteScroll();
            this.setupBackToTop();
            
        } catch (error) {
            console.error('显示单词库失败:', error);
            this.showNotification('错误', '加载单词库失败', 'error');
        }
    }

    // 加载单词库数据
    async loadWordLibraryData() {
        try {
            const response = await fetch('/api/words');
            const words = await response.json();
            
            // 按字母分组
            this.wordLibraryData = this.groupWordsByAlphabet(words);
            this.currentPage = 0;
            this.wordsPerPage = 20;
            this.isLoading = false;
            
        } catch (error) {
            console.error('加载单词库数据失败:', error);
            throw error;
        }
    }

    // 按字母分组单词
    groupWordsByAlphabet(words) {
        const grouped = {};
        const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
        
        // 初始化所有字母
        alphabet.forEach(letter => {
            grouped[letter] = [];
        });
        
        // 分组单词
        words.forEach(word => {
            const firstLetter = word.charAt(0).toLowerCase();
            if (grouped[firstLetter]) {
                grouped[firstLetter].push(word);
            }
        });
        
        // 排序每个字母组内的单词
        Object.keys(grouped).forEach(letter => {
            grouped[letter].sort();
        });
        
        return grouped;
    }

    // 设置字母导航
    setupAlphabetNavigation() {
        const container = document.querySelector('.alphabet-nav-container');
        const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
        
        container.innerHTML = alphabet.map(letter => {
            const hasWords = this.wordLibraryData[letter] && this.wordLibraryData[letter].length > 0;
            const className = hasWords ? 'alphabet-btn' : 'alphabet-btn disabled';
            
            return `<button class="${className}" data-letter="${letter}" ${!hasWords ? 'disabled' : ''}>${letter.toUpperCase()}</button>`;
        }).join('');
        
        // 添加点击事件
        container.addEventListener('click', (e) => {
            if (e.target.classList.contains('alphabet-btn') && !e.target.disabled) {
                this.scrollToLetter(e.target.dataset.letter);
                
                // 更新激活状态
                container.querySelectorAll('.alphabet-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
            }
        });
    }

    // 渲染单词卡片
    async renderWordCards() {
        const container = document.getElementById('wordCardsGrid');
        container.innerHTML = '';
        
        const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
        
        for (const letter of alphabet) {
            const words = this.wordLibraryData[letter];
            if (words && words.length > 0) {
                // 添加字母分组标题
                const sectionTitle = document.createElement('div');
                sectionTitle.className = 'alphabet-section';
                sectionTitle.id = `section-${letter}`;
                sectionTitle.innerHTML = `<h3>${letter.toUpperCase()}</h3>`;
                container.appendChild(sectionTitle);
                
                // 批量创建该字母的单词卡片
                const cardPromises = words.map(word => this.createWordCard(word));
                const cards = await Promise.all(cardPromises);
                
                cards.forEach(card => {
                    container.appendChild(card);
                });
            }
        }
    }

    // 创建单词卡片
    async createWordCard(word) {
        const card = document.createElement('div');
        card.className = 'word-card';
        
        const imageUrl = await this.imageOptimizer.getImageUrl(word);
        card.innerHTML = `
            <img class="word-card-image" 
                 src="${imageUrl}" 
                 alt="${word}"
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
            <div class="word-card-placeholder" style="display: none;">⌛️</div>
            <p class="word-card-text">${word}</p>
        `;
        
        // 添加点击发音功能
        card.addEventListener('click', async () => {
            await this.speakWord(word);
        });
        
        return card;
    }

    // 滚动到指定字母
    scrollToLetter(letter) {
        const section = document.getElementById(`section-${letter}`);
        if (section) {
            section.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }
    }

    // 设置无限滚动
    setupInfiniteScroll() {
        const container = document.getElementById('wordCardsContainer');
        
        container.addEventListener('scroll', () => {
            if (container.scrollTop + container.clientHeight >= container.scrollHeight - 100) {
                this.loadMoreWords();
            }
        });
    }

    // 加载更多单词（预留功能）
    loadMoreWords() {
        if (this.isLoading) return;
        
        // 当前实现是一次性加载所有单词，这里预留给未来优化
        console.log('已加载所有单词');
    }

    // 设置返回顶部按钮
    setupBackToTop() {
        const backToTopBtn = document.getElementById('backToTop');
        const container = document.getElementById('wordCardsContainer');
        
        container.addEventListener('scroll', () => {
            if (container.scrollTop > 300) {
                backToTopBtn.classList.remove('hidden');
            } else {
                backToTopBtn.classList.add('hidden');
            }
        });
        
        backToTopBtn.addEventListener('click', () => {
            container.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
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
                <h2>${i18n.t('game.gameOver')}</h2>
                <div class="personal-result">
                    <h3>${i18n.t('game.finalResults')}</h3>
                    <p>${i18n.t('game.totalTime', { time: results.totalTime.toFixed(1) })}</p>
                    <p>${i18n.t('game.accuracy', { accuracy: results.accuracy.toFixed(1) })}</p>
                    <p>${i18n.t('game.score', { score: `${results.correctAnswers}/${results.totalQuestions}` })}</p>
                </div>
            </div>
        `;
    }

    // 显示预加载页面
    showPreloadView(data) {
        document.body.style.overflow = '';
        document.body.style.height = '';
        document.body.style.touchAction = '';
        document.documentElement.style.overflow = '';
        document.documentElement.style.height = '';
        document.documentElement.style.touchAction = '';
        document.getElementById('lobby').classList.add('hidden');
        document.getElementById('roomView').classList.add('hidden');
        document.getElementById('gameView').classList.add('hidden');
        
        const preloadView = document.getElementById('preloadView');
        preloadView.classList.remove('hidden');
        
        // 使用国际化文本
        const preloadImageCount = document.getElementById('preloadImageCount');
        if (preloadImageCount && window.i18n) {
            preloadImageCount.textContent = window.i18n.t('preload.optimizingImages');
        }
        
        this.updatePreloadProgress({ players: data.players });
        
        this.startImagePreload(data.images);
    }

    // 更新预加载进度
    updatePreloadProgress(data) {
        // 处理玩家进度更新
        if (data.players) {
            const preloadPlayers = document.getElementById('preloadPlayers');
            
            preloadPlayers.innerHTML = data.players.map(player => {
                const statusClass = player.completed ? 'completed' : '';
                return `
                    <div class="preload-player ${player.completed ? 'completed' : ''}">
                        <div class="preload-player-header">
                            <span class="preload-player-name">${player.name}</span>
                            <span class="preload-player-status ${statusClass}">${player.progress}%</span>
                        </div>
                        <div class="preload-progress-bar">
                            <div class="preload-progress-fill ${player.completed ? 'completed' : ''}" 
                                 style="width: ${player.progress}%"></div>
                        </div>
                        <div class="preload-progress-text" id="preloadStepText"></div>
                    </div>
                `;
            }).join('');
        }
        // 处理图片加载进度更新
        if (data.loadedImages !== undefined && data.totalImages !== undefined) {
            const percent = data.percent || Math.round((data.loadedImages / data.totalImages) * 100);
            const preloadStepText = document.getElementById('preloadStepText');
            if (preloadStepText && window.i18n) {
                let progressText;
                if (percent < 25) {
                    progressText = window.i18n.t('preload.optimizingImages');
                } else if (percent < 50) {
                    progressText = window.i18n.t('preload.preloadingGame');
                } else if (percent < 75) {
                    progressText = window.i18n.t('preload.preparingAssets');
                } else if (percent < 100) {
                    progressText = window.i18n.t('preload.almostReady');
                } else {
                    progressText = window.i18n.t('preload.completed');
                }
                // 进度条下方始终显示当前阶段
                preloadStepText.textContent = progressText;
            }
        }
    }

    // 开始图片预加载
    async startImagePreload(images) {
        console.log('🚀 开始优化图片预加载...');
        
        try {
            // 使用图片优化器进行预加载
            const results = await this.imageOptimizer.preloadImages(images, (loaded, total, percent) => {
                this.preloadProgress = { loaded, total, percent };
                
                // 发送进度到服务器
                this.socket.emit('preload_progress', {
                    playerId: this.playerId,
                    roomId: this.currentRoom,
                    loadedImages: loaded,
                    totalImages: total,
                    percent: percent
                });
                
                // 更新UI显示
                this.updatePreloadProgress({ loadedImages: loaded, totalImages: total, percent: percent });
            });
            
            const successCount = results.filter(r => r.success).length;
            console.log(`✅ 预加载完成: ${successCount}/${images.length} 张图片`);
            
            // 缓存统计
            const stats = this.imageOptimizer.getCacheStats();
            console.log(`📊 缓存统计: ${stats.size} 张图片, 内存使用: ${(stats.memoryUsage / 1024 / 1024).toFixed(2)}MB`);
            
        } catch (error) {
            console.error('❌ 预加载过程中出现错误:', error);
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
        
        let allPlayersHtml = `<div class="all-players-results"><h3>${i18n.t('game.playerRanking')}</h3><table>`;
        allPlayersHtml += `<tr>
            <th>${i18n.t('common.player')}</th>
            <th>${i18n.t('game.timeColumn')}</th>
            <th>${i18n.t('game.accuracyColumn')}</th>
            <th>${i18n.t('game.scoreColumn')}</th>
        </tr>`;
        
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
        returnButton.textContent = i18n.t('game.returnToRoom');
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

// 禁止双指缩放
if (typeof window !== 'undefined') {
  document.addEventListener('touchmove', function (event) {
    if (event.touches.length > 1) {
      event.preventDefault();
    }
  }, { passive: false });
  // 禁止双击缩放
  let lastTouchEnd = 0;
  document.addEventListener('touchend', function (event) {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, false);
}

// 全局实例
let wordBattleClient;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 等待 i18n 系统初始化完成
    const initClient = () => {
        if (window.i18n) {
            wordBattleClient = new WordBattleClient();
        } else {
            // 如果 i18n 还没有准备好，稍后再试
            setTimeout(initClient, 100);
        }
    };
    
    initClient();
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
    if (wordBattleClient && wordBattleClient.socket) {
        wordBattleClient.socket.disconnect();
    }
}); 