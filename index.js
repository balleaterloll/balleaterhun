const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');
const { pathfinder } = require('mineflayer-pathfinder');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

let activeBot = null;
let targetConfig = { ip: '', port: 25565, running: false };

// --- BOT LOGIC ---
function createBot() {
    if (!targetConfig.running) return;

    const username = `GojoKaBetaBoT`;
    const pass = `gojoontop`; 
    
    const bot = mineflayer.createBot({
        host: targetConfig.ip,
        port: parseInt(targetConfig.port),
        username: username,
        version: false 
    });

    bot.loadPlugin(pathfinder);

    bot.on('login', () => {
        io.emit('log', `<span class="text-blue-400">[${username}]</span> Connected to server. Waiting to spawn...`);
        io.emit('status', { user: username, state: 'Online' });
    });

    bot.on('spawn', () => {
        io.emit('log', `<span class="text-emerald-400">[${username}]</span> Spawned. Executing Auth...`);
        
        // Auth Logic: Register and Login
        setTimeout(() => {
            bot.chat(`/register ${pass} ${pass}`);
            io.emit('log', `<span class="text-slate-400">[Auth]</span> Sent /register`);
            
            // Short delay between register and login to ensure server processes it
            setTimeout(() => {
                bot.chat(`/login ${pass}`);
                io.emit('log', `<span class="text-slate-400">[Auth]</span> Sent /login`);
            }, 1000);
        }, 2000);

        // Anti-AFK Logic (Random movement every 10s)
        const moveInterval = setInterval(() => {
            if (!bot.entity) return;
            const keys = ['forward', 'back', 'left', 'right', 'jump'];
            const key = keys[Math.floor(Math.random() * keys.length)];
            bot.setControlState(key, true);
            setTimeout(() => bot.setControlState(key, false), 500);
        }, 10000);

        bot.once('end', () => clearInterval(moveInterval));
    });

    bot.on('kicked', (reason) => {
        io.emit('log', `<span class="text-red-400">[Kicked]</span> Reason: ${reason}`);
    });

    bot.on('end', () => {
        io.emit('log', `<span class="text-yellow-500">[System]</span> Connection lost. Rejoining in 5s...`);
        io.emit('status', { user: username, state: 'Reconnecting' });
        activeBot = null;
        
        // Persistent Rejoin Loop
        if (targetConfig.running) {
            setTimeout(() => {
                if (targetConfig.running) activeBot = createBot();
            }, 5000);
        }
    });

    bot.on('error', (err) => {
        io.emit('log', `<span class="text-red-500">[Error]</span> ${err.message}`);
    });

    return bot;
}

// --- WEB INTERFACE ---
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>GOJO BOT CONTROL</title>
        <script src="/socket.io/socket.io.js"></script>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
            body { background: #020617; color: #f8fafc; font-family: 'Inter', sans-serif; }
            .panel { background: rgba(15, 23, 42, 0.8); border: 1px solid #1e293b; border-radius: 1rem; }
            .log-box { height: 350px; overflow-y: auto; font-family: monospace; font-size: 0.85rem; }
        </style>
    </head>
    <body class="p-6">
        <div class="max-w-4xl mx-auto">
            <h1 class="text-3xl font-black mb-8 text-indigo-400 italic">GOJO BOT v1.0</h1>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="panel p-6">
                    <h2 class="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Controller</h2>
                    <input id="ip" type="text" placeholder="Server IP" class="w-full bg-slate-900 border border-slate-700 p-3 rounded mb-4 outline-none focus:border-indigo-500">
                    <input id="port" type="number" value="25565" class="w-full bg-slate-900 border border-slate-700 p-3 rounded mb-6 outline-none">
                    
                    <button onclick="start()" class="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded font-bold transition mb-3">DEPLOY BOT</button>
                    <button onclick="stop()" class="w-full bg-slate-800 hover:bg-red-600 py-3 rounded font-bold transition">TERMINATE</button>

                    <div id="status-card" class="mt-8 p-4 bg-slate-900 rounded-lg flex justify-between items-center">
                        <span class="font-bold">GojoKaBetaBoT</span>
                        <span id="state-text" class="text-slate-600">Offline</span>
                    </div>
                </div>

                <div class="panel p-6">
                    <h2 class="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Live Logs</h2>
                    <div id="logs" class="log-box space-y-1"></div>
                </div>
            </div>
        </div>

        <script>
            const socket = io();
            function start() {
                const ip = document.getElementById('ip').value;
                const port = document.getElementById('port').value;
                socket.emit('start-request', { ip, port });
            }
            function stop() { socket.emit('stop-request'); }

            socket.on('log', (msg) => {
                const logs = document.getElementById('logs');
                const div = document.createElement('div');
                div.innerHTML = \`[\${new Date().toLocaleTimeString()}] \${msg}\`;
                logs.appendChild(div);
                logs.scrollTop = logs.scrollHeight;
            });

            socket.on('status', (data) => {
                const state = document.getElementById('state-text');
                state.innerText = data.state;
                state.className = data.state === 'Online' ? 'text-green-400 font-bold' : 'text-yellow-400 font-bold';
            });
        </script>
    </body>
    </html>
    `);
});

// --- SOCKETS ---
io.on('connection', (socket) => {
    socket.on('start-request', (data) => {
        if (targetConfig.running) return;
        targetConfig = { ip: data.ip, port: data.port, running: true };
        io.emit('log', 'System Online. Deploying Gojo...');
        activeBot = createBot();
    });

    socket.on('stop-request', () => {
        targetConfig.running = false;
        if (activeBot) activeBot.quit();
        activeBot = null;
        io.emit('log', '<span class="text-red-500">System Shutdown. Bot removed.</span>');
        io.emit('status', { state: 'Offline' });
    });
});

server.listen(PORT, () => console.log(`Gojo Bot running on port ${PORT}`));
