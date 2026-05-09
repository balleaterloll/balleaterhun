const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');
const { pathfinder } = require('mineflayer-pathfinder');

// Configuration & Server Setup
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

let activeBots = {};
let targetConfig = { ip: '', port: 25565, running: false };

// --- BOT LOGIC ---
function createBot(slotId) {
    if (!targetConfig.running) return;

    const username = `GojoKaBetaBoT`;
    
    const bot = mineflayer.createBot({
        host: targetConfig.ip,
        port: parseInt(targetConfig.port),
        username: username,
        version: false // Auto-version detection
    });

    bot.loadPlugin(pathfinder);

    bot.on('login', () => {
        io.emit('log', `<span class="text-blue-400">[${username}]</span> Logging into server...`);
        io.emit('status', { slotId, user: username, state: 'Online' });
    });

    bot.on('spawn', () => {
        // Bypass Logic: Auto Register/Login
        setTimeout(() => {
            bot.chat(`/register gojoontop gojoontop`);
            bot.chat(`/login gojoontop`);
        }, 2000);

        // Bypass Logic: Anti-AFK Random Movement
        const moveInterval = setInterval(() => {
            if (!bot.entity) return;
            const keys = ['forward', 'back', 'left', 'right', 'jump'];
            const key = keys[Math.floor(Math.random() * keys.length)];
            bot.setControlState(key, true);
            setTimeout(() => bot.setControlState(key, false), 500);
        }, 12000);

        // Bypass Logic: Random Chatter
        const chatInterval = setInterval(() => {
            const msgs = ["Hello world", "Cool server!", "How is it going?", "...", "Nice"];
            bot.chat(msgs[Math.floor(Math.random() * msgs.length)]);
        }, 45000);

        bot.on('end', () => {
            clearInterval(moveInterval);
            clearInterval(chatInterval);
        });
    });

    bot.on('error', (err) => io.emit('log', `<span class="text-red-500">[Error]</span> ${err.message}`));

    bot.on('end', (reason) => {
        io.emit('log', `<span class="text-yellow-500">[${username}]</span> Disconnected: ${reason}`);
        io.emit('status', { slotId, user: 'None', state: 'Reconnecting...' });
        delete activeBots[slotId];
        
        // Auto-Rejoin logic
        if (targetConfig.running) {
            setTimeout(() => {
                activeBots[slotId] = createBot(slotId);
            }, 5000);
        }
    });

    return bot;
}

// --- WEB ROUTES ---
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Gojo Panel</title>
        <script src="/socket.io/socket.io.js"></script>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
            body { background: #0f172a; color: #e2e8f0; font-family: sans-serif; }
            .glass { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1); }
            ::-webkit-scrollbar { width: 5px; }
            ::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        </style>
    </head>
    <body class="p-4 md:p-10">
        <div class="max-w-5xl mx-auto">
            <header class="mb-8 flex justify-between items-center">
                <h1 class="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">GOJO PANEL</h1>
                <div class="text-xs text-slate-500 uppercase tracking-widest">Minecraft Bot Controller</div>
            </header>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Inputs -->
                <div class="glass p-6 rounded-2xl">
                    <h3 class="text-lg font-bold mb-4 border-b border-slate-700 pb-2">Configuration</h3>
                    <label class="block text-sm text-slate-400 mb-1">Server IP</label>
                    <input id="ip" type="text" placeholder="play.example.com" class="w-full mb-4 p-3 rounded-lg bg-slate-900 border border-slate-700 focus:border-blue-500 outline-none">
                    
                    <label class="block text-sm text-slate-400 mb-1">Port</label>
                    <input id="port" type="number" value="25565" class="w-full mb-6 p-3 rounded-lg bg-slate-900 border border-slate-700 outline-none">
                    
                    <button onclick="startBots()" class="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-lg font-bold mb-3 transition shadow-lg shadow-blue-900/20">SEND BOTS</button>
                    <button onclick="stopBots()" class="w-full bg-slate-700 hover:bg-red-600 py-3 rounded-lg font-bold transition">CANCEL EVERYTHING</button>
                </div>

                <!-- Status -->
                <div class="glass p-6 rounded-2xl">
                    <h3 class="text-lg font-bold mb-4 border-b border-slate-700 pb-2">Bot Status (3 Active)</h3>
                    <div id="status-container" class="space-y-4">
                        <div id="slot-1" class="flex justify-between items-center p-3 bg-slate-800/50 rounded-xl"><span>Bot 1</span> <span class="text-slate-500">Idle</span></div>
                        <div id="slot-2" class="flex justify-between items-center p-3 bg-slate-800/50 rounded-xl"><span>Bot 2</span> <span class="text-slate-500">Idle</span></div>
                        <div id="slot-3" class="flex justify-between items-center p-3 bg-slate-800/50 rounded-xl"><span>Bot 3</span> <span class="text-slate-500">Idle</span></div>
                    </div>
                </div>

                <!-- Logs -->
                <div class="glass p-6 rounded-2xl flex flex-col h-[400px]">
                    <h3 class="text-lg font-bold mb-4 border-b border-slate-700 pb-2">System Logs</h3>
                    <div id="logs" class="flex-grow overflow-y-auto text-sm font-mono space-y-1 pr-2"></div>
                </div>
            </div>
        </div>

        <script>
            const socket = io();
            const logs = document.getElementById('logs');

            function startBots() {
                const ip = document.getElementById('ip').value;
                const port = document.getElementById('port').value;
                if(!ip) return alert("Enter Server IP");
                socket.emit('start-request', { ip, port });
            }

            function stopBots() {
                socket.emit('stop-request');
            }

            socket.on('log', (txt) => {
                const div = document.createElement('div');
                div.innerHTML = \`[\${new Date().toLocaleTimeString()}] \${txt}\`;
                logs.appendChild(div);
                logs.scrollTop = logs.scrollHeight;
            });

            socket.on('status', (data) => {
                const slot = document.getElementById(\`slot-\${data.slotId}\`);
                const color = data.state === 'Online' ? 'text-green-400' : 'text-yellow-400';
                slot.innerHTML = \`<span>\${data.user}</span> <span class="\${color} font-bold">\${data.state}</span>\`;
            });
        </script>
    </body>
    </html>
    `);
});

// --- SOCKET EVENTS ---
io.on('connection', (socket) => {
    socket.on('start-request', (data) => {
        if (targetConfig.running) return;
        targetConfig = { ip: data.ip, port: data.port, running: true };
        io.emit('log', '<span class="text-emerald-400">Command received. Deploying 3 bots...</span>');
        
        for (let i = 1; i <= 3; i++) {
            activeBots[i] = createBot(i);
        }
    });

    socket.on('stop-request', () => {
        targetConfig.running = false;
        io.emit('log', '<span class="text-red-400">Emergency Stop Triggered.</span>');
        Object.values(activeBots).forEach(bot => bot.quit());
        activeBots = {};
        for (let i = 1; i <= 3; i++) {
            io.emit('status', { slotId: i, user: 'None', state: 'Idle' });
        }
    });
});

server.listen(PORT, () => {
    console.log(`Nebryx Control Panel active on port ${PORT}`);
});
