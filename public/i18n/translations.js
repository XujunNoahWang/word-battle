const translations = {
    zh: {
        // 标题和通用文本
        'app.title': 'Word Battle - 多人在线游戏',
        'app.beta': 'beta',
        'app.connecting': '连接中...',
        
        // 大厅页面
        'lobby.onlinePlayers': '在线玩家',
        'lobby.noPlayers': '暂无其他玩家在线',
        'lobby.gameRooms': '游戏房间',
        'lobby.createRoom': '创建房间',
        'lobby.alreadyInRoom': '已在房间中',
        'lobby.joinRoom': '加入房间',
        'lobby.noRooms': '暂无活动房间',
        'lobby.createRoomHint': '点击"创建房间"开始游戏',
        'lobby.noActiveRooms': '暂无活动房间',
        'lobby.clickToCreate': '点击"创建房间"开始游戏',
        'lobby.playerCount': '{count}人',
        'lobby.roomName': '{name}的房间',
        'lobby.roomStatus.waiting': '等待中...',
        'lobby.roomStatus.playing': '游戏中...',
        'lobby.roomStatus.loading': '加载中...',
        'lobby.playerStatus.online': '在线',
        'lobby.playerStatus.offline': '离线',
        'lobby.playerStatus.inRoom': '在房间中',
        'lobby.playerStatus.playing': '游戏中',
        
        // 房间页面
        'room.waitingPlayers': '等待玩家加入...',
        'room.leaveRoom': '退出房间',
        'room.startGame': '开始游戏',
        'room.host': '房主：',
        'room.playerJoined': '{name} 加入了房间',
        'room.playerLeft': '{name} 离开了房间',
        'room.gameStarting': '游戏即将开始...',
        'room.waitingForPlayers': '等待其他玩家...',
        'room.playerReady': '{name} 已准备',
        'room.playerNotReady': '{name} 未准备',
        
        // 预加载页面
        'preload.loading': '正在加载游戏资源',
        'preload.waitingPlayers': '请等待所有玩家完成加载...',
        'preload.loadingImages': '正在加载图片...',
        'preload.progress': '已加载 {current}/{total} 张图片',
        'preload.playerProgress': '{name}: {progress}%',
        'preload.complete': '加载完成',
        'preload.starting': '游戏即将开始',
        
        // 游戏页面
        'game.score': '得分: {score}',
        'game.timeLeft': '剩余时间: {time}秒',
        'game.matchWord': '请选择与"{word}"匹配的图片',
        'game.correct': '回答正确！',
        'game.wrong': '回答错误',
        'game.roundComplete': '本轮结束',
        
        // 单词管理
        'wordManager.title': '单词管理',
        'wordManager.back': '返回',
        'wordManager.inputPlaceholder': '输入英语单词',
        'wordManager.add': '添加',
        'wordManager.wordList': '单词库',
        'wordManager.deleteConfirm': '确定要删除这个单词吗？',
        'wordManager.addSuccess': '单词添加成功',
        'wordManager.deleteSuccess': '单词删除成功',
        'wordManager.error': '操作失败，请重试',
        
        // 模态框
        'modal.editName': '修改用户名',
        'modal.editNamePlaceholder': '输入新的用户名',
        'modal.cancel': '取消',
        'modal.confirm': '确认',
        'modal.adminAuth': '管理员验证',
        'modal.passwordPlaceholder': '请输入4位数字密码',
        
        // 通知消息
        'notification.connected': '连接成功',
        'notification.disconnected': '连接断开',
        'notification.reconnecting': '正在重新连接...',
        'notification.roomCreated': '房间创建成功',
        'notification.roomJoined': '成功加入房间',
        'notification.roomLeft': '已离开房间',
        'notification.gameStarted': '游戏开始',
        'notification.gameEnded': '游戏结束',
        'notification.error': '错误: {message}',
        'notification.nameChanged': '用户名修改成功',
        'notification.alreadyInRoom': '你已经在房间中了'
    },
    en: {
        // Title and common text
        'app.title': 'Word Battle - Multiplayer Online Game',
        'app.beta': 'beta',
        'app.connecting': 'Connecting...',
        
        // Lobby page
        'lobby.onlinePlayers': 'Online Players',
        'lobby.noPlayers': 'No other players online',
        'lobby.gameRooms': 'Game Rooms',
        'lobby.createRoom': 'Create Room',
        'lobby.alreadyInRoom': 'Already in room',
        'lobby.joinRoom': 'Join Room',
        'lobby.noRooms': 'No active rooms',
        'lobby.createRoomHint': 'Click "Create Room" to start',
        'lobby.noActiveRooms': 'No Active Rooms',
        'lobby.clickToCreate': 'Click "Create Room" to start',
        'lobby.playerCount': '{count} Online',
        'lobby.roomName': '{name}\'s Room',
        'lobby.roomStatus.waiting': 'Waiting...',
        'lobby.roomStatus.playing': 'In Game...',
        'lobby.roomStatus.loading': 'Loading...',
        'lobby.playerStatus.online': 'Online',
        'lobby.playerStatus.offline': 'Offline',
        'lobby.playerStatus.inRoom': 'In Room',
        'lobby.playerStatus.playing': 'Playing',
        
        // Room page
        'room.waitingPlayers': 'Waiting for players...',
        'room.leaveRoom': 'Leave Room',
        'room.startGame': 'Start Game',
        'room.host': 'Host: ',
        'room.playerJoined': '{name} joined the room',
        'room.playerLeft': '{name} left the room',
        'room.gameStarting': 'Game starting...',
        'room.waitingForPlayers': 'Waiting for other players...',
        'room.playerReady': '{name} is ready',
        'room.playerNotReady': '{name} is not ready',
        
        // Preload page
        'preload.loading': 'Loading Game Resources',
        'preload.waitingPlayers': 'Please wait for all players to finish loading...',
        'preload.loadingImages': 'Loading images...',
        'preload.progress': 'Loaded {current}/{total} images',
        'preload.playerProgress': '{name}: {progress}%',
        'preload.complete': 'Loading Complete',
        'preload.starting': 'Game Starting Soon',
        
        // Game page
        'game.score': 'Score: {score}',
        'game.timeLeft': 'Time Left: {time}s',
        'game.matchWord': 'Match the image for "{word}"',
        'game.correct': 'Correct!',
        'game.wrong': 'Wrong',
        'game.roundComplete': 'Round Complete',
        
        // Word manager
        'wordManager.title': 'Word Manager',
        'wordManager.back': 'Back',
        'wordManager.inputPlaceholder': 'Enter English word',
        'wordManager.add': 'Add',
        'wordManager.wordList': 'Word List',
        'wordManager.deleteConfirm': 'Are you sure you want to delete this word?',
        'wordManager.addSuccess': 'Word added successfully',
        'wordManager.deleteSuccess': 'Word deleted successfully',
        'wordManager.error': 'Operation failed, please try again',
        
        // Modals
        'modal.editName': 'Edit Username',
        'modal.editNamePlaceholder': 'Enter new username',
        'modal.cancel': 'Cancel',
        'modal.confirm': 'Confirm',
        'modal.adminAuth': 'Admin Authentication',
        'modal.passwordPlaceholder': 'Enter 4-digit password',
        
        // Notifications
        'notification.connected': 'Connected',
        'notification.disconnected': 'Disconnected',
        'notification.reconnecting': 'Reconnecting...',
        'notification.roomCreated': 'Room created successfully',
        'notification.roomJoined': 'Joined room',
        'notification.roomLeft': 'Left room',
        'notification.gameStarted': 'Game started',
        'notification.gameEnded': 'Game ended',
        'notification.error': 'Error: {message}',
        'notification.nameChanged': 'Username changed successfully',
        'notification.alreadyInRoom': 'You are already in a room'
    }
};

// 如果在Node.js环境中
if (typeof module !== 'undefined' && module.exports) {
    module.exports = translations;
} 