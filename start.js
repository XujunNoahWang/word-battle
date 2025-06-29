const { exec } = require('child_process');
const os = require('os');

// 获取本机IP地址
function getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // 跳过内部地址和IPv6地址
            if (iface.family === 'IPv4' && !iface.internal) {
                ips.push(iface.address);
            }
        }
    }
    
    return ips;
}

// 清理可能占用端口的进程
function cleanupPorts() {
    return new Promise((resolve) => {
        if (process.platform === 'win32') {
            exec('for /f "tokens=5" %a in (\'netstat -aon ^| findstr :3000\') do taskkill /F /PID %a 2>nul', () => {
                setTimeout(resolve, 1000);
            });
        } else {
            exec('lsof -ti:3000 | xargs kill -9', () => {
                setTimeout(resolve, 1000);
            });
        }
    });
}

// 启动服务器
async function startServer() {
    console.log('🎮 Word Battle 多人在线游戏平台');
    console.log('=====================================\n');
    
    console.log('📋 清理端口占用...');
    await cleanupPorts();
    
    console.log('🚀 启动服务器...\n');
    
    // 启动主服务器
    require('./server.js');
    
    // 等待服务器启动
    setTimeout(() => {
        const ips = getLocalIPs();
        
        console.log('✅ 服务器启动成功！\n');
        console.log('📍 访问地址:');
        console.log('   本地访问: http://localhost:3000');
        console.log('   本地访问: http://127.0.0.1:3000');
        
        if (ips.length > 0) {
            console.log('\n🌐 局域网访问地址:');
            ips.forEach(ip => {
                console.log(`   http://${ip}:3000`);
            });
            
            console.log('\n📱 移动设备访问:');
            console.log('   请确保设备在同一局域网内');
            console.log('   如无法访问，请检查防火墙设置');
        }
        
        console.log('\n🔧 服务端口:');
        console.log('   前端服务: 3000');
        console.log('   WebSocket: 3001');
        
        console.log('\n📖 使用说明:');
        console.log('   - 每个设备会自动分配玩家身份');
        console.log('   - 可创建房间或加入现有房间');
        console.log('   - 房主可以开始游戏');
        console.log('   - 支持多设备同时在线');
        
        console.log('\n⚠️  注意事项:');
        console.log('   - 页面刷新不会丢失身份');
        console.log('   - 房主退出会解散房间');
        console.log('   - 按 Ctrl+C 停止服务器');
        
        console.log('\n=====================================');
        console.log('🎯 Word Battle 已就绪，开始游戏吧！');
        console.log('=====================================\n');
        
    }, 2000);
}

// 处理退出信号
process.on('SIGINT', () => {
    console.log('\n\n🛑 正在关闭服务器...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n\n🛑 正在关闭服务器...');
    process.exit(0);
});

// 启动应用
startServer().catch(console.error); 