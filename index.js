const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');
const { pathfinder } = require('mineflayer-pathfinder');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

let activeBot = null; // Changed to single bot object
let targetConfig = { ip: '', port: 25565, running: false };

// --- BOT LOGIC ---
function createBot() {
    if (!targetConfig.running) return;

    const username = `GojoKaBetaBoT`;
    const password = `gojoontop`; // Static password
    
    const bot = mineflayer.createBot({
        host: targetConfig.ip,
        port: parseInt(targetConfig.port),
        username: username,
        version: false 
    });

    bot.loadPlugin(pathfinder);

    bot.on('login', () => {
        io.emit('log', `<span class="text-blue-400">[${username}]</span> Authenticating...`);
        io.emit('status', { slotId: 1, user: username, state: 'Online' });
    });

    bot.on('spawn', () => {
        io.emit('log', `<span class="text-emerald-400">[${username}]</span> Spawned in world.`);
        
        // Bypass Logic: Auto Register/Login
        setTimeout(() => {
            bot.chat(`/register gojoontop);
            bot.chat(`/login gojoontop`);
        }, 2000);

        // Anti-AFK Logic
        const moveInterval = setInterval(() => {
            if (!bot.entity) return;
            const keys = ['forward', 'back', 'left', 'right', 'jump'];
            const key = keys[Math.floor(Math.random() * keys.length)];
            bot.setControlState(key, true);
            setTimeout(() => bot.setControlState(key, false), 500);
        }, 10000);

        bot.once('end', () => clearInterval(moveInterval));
    });

    bot.on('error', (err) => {
        io.emit('log', `<span class="text-red-500">[Error]</span> ${err.message}`);
    });

    bot.on('kicked', (reason) => {
        io.emit('log', `<span class="text-orange-500">[Kicked]</span> Reason: ${reason}`);
    });

    bot.on('end', (reason) => {
        io.emit('log', `<span class="text-yellow-500">[System]</span> Connection lost. Retrying in 5 seconds...`);
        io.emit('status', { slotId: 1, user: username, state: 'Retrying...' });
        activeBot = null;
        
        // REJOIN LOOP: This will keep attempting to join forever as long as targetConfig.running is true
        if (targetConfig.running) {
            setTimeout(() => {
                io.emit('log', `<span class="text-slate-400">Attempting rejoin...</span>`);
                activeBot = createBot();
            }, 5000); // 5 second delay to prevent IP blacklisting/spam filters
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
        <title>GOJO BOT PANEL</title>
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
        <div class="max-w-4xl mx-auto">
            <header class="mb-8 flex justify-between items-center">
                <h1 class="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">GOJO CONTROL</h1>
                <div class="text-xs text-slate-500 uppercase tracking-widest">Single Bot Instance</div>
            </header>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="glass p-6 rounded-2xl">
                    <h3 class="text-lg font-bold mb-4 border-b border-slate-700 pb-2">Target Server</h3>
                    <input id="ip" type="text" placeholder="Server IP" class="w-full mb-4 p-3 rounded-lg bg-slate-900 border border-slate-700 focus:border-purple-500 outline-none">
                    <input id="port" type="number" value="25565" class="w-full mb-6 p-3 rounded-lg bg-slate-900 border border-slate-700 outline-none">
                    
                    <button onclick="startBot()" class="w-full bg-purple-600 hover:bg-purple-500 py-3 rounded-lg font-bold mb-3 transition">START BOT</button>
                    <button onclick="stopBot()" class="w-full bg-slate-700 hover:bg-red-600 py-3 rounded-lg font-bold transition">STOP</button>

                    <div id="slot-1" class="mt-6 p-4 bg-slate-800/50 rounded-xl flex justify-between">
                        <span>GojoKaBetaBoT</span>
                        <span class="text-slate-500">Offline</span>
                    </div>
                </div>

                <div class="glass p-6 rounded-2xl flex flex-col h-[400px]">
                    <h3 class="text-lg font-bold mb-4 border-b border-slate-700 pb-2">Logs</h3>
                    <div id="logs" class="flex-grow overflow-y-auto text-sm font-mono space-y-1 pr-2"></div>
                </div>
            </div>
        </div>

        <script>
            const socket = io();
            function startBot() {
                const ip = document.getElementById('ip').value;
                const port = document.getElementById('port').value;
                socket.emit('start-request', { ip, port });
            }
            function stopBot() { socket.emit('stop-request'); }

            socket.on('log', (txt) => {
                const div = document.createElement('div');
                div.innerHTML = \`[\${new Date().toLocaleTimeString()}] \${txt}\`;
                document.getElementById('logs').appendChild(div);
                document.getElementById('logs').scrollTop = document.getElementById('logs').scrollHeight;
            });

            socket.on('status', (data) => {
                const slot = document.getElementById('slot-1');
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
        io.emit('log', '<span class="text-purple-400">Initiating GojoKaBetaBoT...</span>');
        activeBot = createBot();
    });

    socket.on('stop-request', () => {
        targetConfig.running = false;
        io.emit('log', '<span class="text-red-400">Stopping...</span>');
        if (activeBot) activeBot.quit();
        activeBot = null;
        io.emit('status', { user: 'GojoKaBetaBoT', state: 'Offline' });
    });
});

server.listen(PORT, () => console.log(`Gojo Panel on port ${PORT}`));
