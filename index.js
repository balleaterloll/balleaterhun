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

const USERNAME = "GojoKaBetaBoT";
const PASSWORD = "gojoontop";

// --- BOT LOGIC ---
function createBot() {
    if (!targetConfig.running) return;

    const bot = mineflayer.createBot({
        host: targetConfig.ip,
        port: parseInt(targetConfig.port),
        username: USERNAME,
        version: false
    });

    bot.loadPlugin(pathfinder);

    bot.on('login', () => {
        io.emit('log', `<span class="text-blue-400">[${USERNAME}]</span> Logging in...`);
        io.emit('status', { user: USERNAME, state: 'Online' });
    });

    bot.on('spawn', () => {
        io.emit('log', `<span class="text-emerald-400">[${USERNAME}]</span> Spawned! Starting auth...`);

        // === IMPROVED REGISTER / LOGIN ===
        let authAttempted = false;

        const tryAuth = () => {
            if (authAttempted) return;
            authAttempted = true;

            setTimeout(() => {
                bot.chat(`/register ${PASSWORD} ${PASSWORD}`);
                io.emit('log', `<span class="text-purple-400">[Auth]</span> Register command sent`);
            }, 1500);

            setTimeout(() => {
                bot.chat(`/login ${PASSWORD}`);
                io.emit('log', `<span class="text-purple-400">[Auth]</span> Login command sent`);
            }, 3000);
        };

        // Listen for server messages (most reliable method)
        bot.on('message', (message) => {
            const msg = message.toString().toLowerCase();

            if (msg.includes('register') || msg.includes('create password') || msg.includes('account not found')) {
                tryAuth();
            }
            if (msg.includes('login') || msg.includes('logged in') || msg.includes('successfully')) {
                io.emit('log', `<span class="text-green-400">[Auth]</span> Authentication successful`);
            }
        });

        // Initial auth attempt
        setTimeout(tryAuth, 2000);

        // === ANTI-AFK + RANDOM CHAT ===
        const moveInterval = setInterval(() => {
            if (!bot.entity) return;
            const keys = ['forward', 'back', 'left', 'right', 'jump', 'sprint'];
            const key = keys[Math.floor(Math.random() * keys.length)];
            bot.setControlState(key, true);
            setTimeout(() => bot.setControlState(key, false), 600);
        }, 13000);

        const chatInterval = setInterval(() => {
            const messages = [
                "Hey everyone!",
                "This server is crazy",
                "Gojo supremacy",
                "Anyone online?",
                "LFG",
                "..."
            ];
            bot.chat(messages[Math.floor(Math.random() * messages.length)]);
        }, 45000);

        bot.on('end', () => {
            clearInterval(moveInterval);
            clearInterval(chatInterval);
        });
    });

    bot.on('error', (err) => {
        io.emit('log', `<span class="text-red-500">[Error]</span> ${err.message}`);
    });

    bot.on('end', (reason) => {
        io.emit('log', `<span class="text-yellow-500">[${USERNAME}]</span> Disconnected: ${reason}`);
        io.emit('status', { user: USERNAME, state: 'Reconnecting...' });

        if (targetConfig.running) {
            setTimeout(() => {
                if (targetConfig.running) activeBot = createBot();
            }, 3000);
        }
    });

    return bot;
}

// --- WEB INTERFACE ---
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>GOJO PANEL</title>
        <script src="/socket.io/socket.io.js"></script>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
            body { background: #020617; color: #e2e8f0; font-family: sans-serif; }
            .glass { background: rgba(30, 41, 59, 0.4); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.05); }
        </style>
    </head>
    <body class="p-10">
        <div class="max-w-4xl mx-auto">
            <header class="mb-10 text-center">
                <h1 class="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-blue-500 italic">GOJO REJOINER</h1>
            </header>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div class="glass p-8 rounded-3xl">
                    <input id="ip" type="text" placeholder="Server IP (e.g. play.example.com)" 
                           class="w-full bg-slate-900 border border-slate-700 p-4 rounded-xl mb-4 outline-none focus:border-purple-500">
                    <button onclick="start()" 
                            class="w-full bg-purple-600 hover:bg-purple-500 py-4 rounded-xl font-black text-xl transition mb-4">
                        DEPLOY GOJO
                    </button>
                    <button onclick="stop()" 
                            class="w-full bg-slate-800 hover:bg-red-600 py-4 rounded-xl font-black transition">
                        STOP BOT
                    </button>
                    
                    <div id="stat-box" class="mt-10 p-6 bg-black/50 rounded-2xl border border-purple-500/20 text-center">
                        <span id="bot-name" class="block text-slate-500">Waiting...</span>
                        <span id="bot-state" class="text-2xl font-bold">OFFLINE</span>
                    </div>
                </div>

                <div class="glass p-6 rounded-3xl flex flex-col h-[450px]">
                    <div id="logs" class="flex-grow overflow-y-auto text-[11px] font-mono space-y-1 text-slate-400"></div>
                </div>
            </div>
        </div>

        <script>
            const socket = io();

            function start() {
                const ip = document.getElementById('ip').value.trim();
                if (!ip) return alert("Please enter server IP");
                socket.emit('start', { ip });
            }

            function stop() {
                socket.emit('stop');
            }

            socket.on('log', (txt) => {
                const div = document.createElement('div');
                div.innerHTML = \`[\${new Date().toLocaleTimeString()}] \${txt}\`;
                const logs = document.getElementById('logs');
                logs.appendChild(div);
                logs.scrollTop = logs.scrollHeight;
            });

            socket.on('status', (data) => {
                document.getElementById('bot-name').innerText = data.user;
                const stateEl = document.getElementById('bot-state');
                stateEl.innerText = data.state;
                stateEl.className = "text-2xl font-bold " + 
                    (data.state === 'Online' ? 'text-green-400' : 'text-yellow-400');
            });
        </script>
    </body>
    </html>
    `);
});

// --- SOCKET EVENTS ---
io.on('connection', (socket) => {
    socket.on('start', (data) => {
        if (targetConfig.running) return;

        targetConfig = { ip: data.ip, port: 25565, running: true };
        io.emit('log', '<span class="text-emerald-400">System Initialized. Deploying Gojo...</span>');

        activeBot = createBot();
    });

    socket.on('stop', () => {
        targetConfig.running = false;
        if (activeBot) {
            activeBot.quit();
            activeBot = null;
        }
        io.emit('log', '<span class="text-red-400">Emergency Stop Triggered.</span>');
        io.emit('status', { user: USERNAME, state: 'OFFLINE' });
    });
});

server.listen(PORT, () => {
    console.log(`Gojo Panel running on port ${PORT}`);
});
