import { Server } from "socket.io";

let connections = {};   // path → [socketId, ...]
let messages    = {};   // path → [{sender, data, ...}]
let timeOnline  = {};   // socketId → Date
let usernames   = {};   // socketId → name

export const connectToSocket = (server) => {
    const io = new Server(server, {
        cors: { origin: "*", methods: ["GET","POST"] },
        pingTimeout: 60000,
        pingInterval: 25000,
    });

    io.on("connection", socket => {
        console.log(`🔌 Connected: ${socket.id}`);

        /* ── JOIN CALL ── */
        socket.on("join-call", (path, username) => {
            if (!connections[path]) connections[path] = [];
            if (!connections[path].includes(socket.id)) connections[path].push(socket.id);

            timeOnline[socket.id] = new Date();
            if (username) usernames[socket.id] = username;

            const clients = connections[path];

            // First person in room = host
            if (clients.length === 1) {
                io.to(socket.id).emit("you-are-host");
            }

            // Build names map for all clients in room
            const names = {};
            clients.forEach(sid => { if (usernames[sid]) names[sid] = usernames[sid]; });

            // Notify everyone: who joined, all clients, all names
            clients.forEach(sid => {
                io.to(sid).emit("user-joined", socket.id, clients, names);
            });

            // Send chat history to new joiner
            if (messages[path]) {
                messages[path].forEach(msg => {
                    io.to(socket.id).emit("chat-message", msg.data, msg.sender);
                });
            }

            // Broadcast participant count
            io.to(socket.id).emit("participant-count", clients.length);
            clients.forEach(sid => {
                if (sid !== socket.id) io.to(sid).emit("participant-count", clients.length);
            });

            console.log(`👥 Room ${path}: ${clients.length} participant(s)`);
        });

        /* ── SIGNAL (WebRTC) ── */
        socket.on("signal", (toId, message) => {
            io.to(toId).emit("signal", socket.id, message);
        });

        /* ── CHAT ── */
        socket.on("chat-message", (data, sender) => {
            const room = Object.entries(connections).find(([,clients])=>clients.includes(socket.id));
            if (!room) return;
            const [path, clients] = room;
            if (!messages[path]) messages[path] = [];
            messages[path].push({ data, sender, time: new Date().toISOString() });
            // Send to everyone EXCEPT the sender (sender adds locally to avoid duplicate)
            clients.forEach(sid => { if (sid !== socket.id) io.to(sid).emit("chat-message", data, sender); });
        });

        /* ── PEER STATE (mic/cam status broadcast) ── */
        socket.on("peer-state", (state) => {
            const room = Object.entries(connections).find(([,clients])=>clients.includes(socket.id));
            if (!room) return;
            room[1].forEach(sid => { if (sid !== socket.id) io.to(sid).emit("peer-state-update", socket.id, state); });
        });

        /* ── REACTION BROADCAST ── */
        socket.on("send-reaction", (emoji) => {
            const room = Object.entries(connections).find(([,clients])=>clients.includes(socket.id));
            if (!room) return;
            room[1].forEach(sid => { if (sid !== socket.id) io.to(sid).emit("receive-reaction", socket.id, emoji); });
        });

        /* ── HAND RAISE BROADCAST ── */
        socket.on("raise-hand", (isRaised) => {
            const room = Object.entries(connections).find(([,clients])=>clients.includes(socket.id));
            if (!room) return;
            room[1].forEach(sid => { if (sid !== socket.id) io.to(sid).emit("hand-raised", socket.id, isRaised); });
        });

        /* ── NAME BROADCAST (if client sends name update) ── */
        socket.on("user-name-broadcast", username => {
            if (username) usernames[socket.id] = username;
            const room = Object.entries(connections).find(([,clients])=>clients.includes(socket.id));
            if (!room) return;
            const [, clients] = room;
            clients.forEach(sid => {
                if (sid !== socket.id) io.to(sid).emit("user-name-receive", socket.id, username);
            });
        });

        /* ── HOST CONTROLS ── */
        socket.on("host-mute-participant", targetId => {
            io.to(targetId).emit("host-mute-me");
        });
        socket.on("host-remove-participant", targetId => {
            io.to(targetId).emit("host-remove-me");
        });

        /* ── WHITEBOARD ── */
        socket.on("wb-draw", data => {
            const room = Object.entries(connections).find(([,clients])=>clients.includes(socket.id));
            if (!room) return;
            room[1].forEach(sid => { if (sid!==socket.id) io.to(sid).emit("wb-draw", data); });
        });
        socket.on("wb-clear", data => {
            const room = Object.entries(connections).find(([,clients])=>clients.includes(socket.id));
            if (!room) return;
            room[1].forEach(sid => { if (sid!==socket.id) io.to(sid).emit("wb-clear"); });
        });

        /* ── DISCONNECT ── */
        socket.on("disconnect", () => {
            const duration = Math.round((new Date()-timeOnline[socket.id])/1000);
            console.log(`❌ Disconnected: ${socket.id} (${duration}s online)`);
            delete timeOnline[socket.id];
            delete usernames[socket.id];

            for (const [path, clients] of Object.entries(connections)) {
                const idx = clients.indexOf(socket.id);
                if (idx === -1) continue;
                clients.splice(idx, 1);
                clients.forEach(sid => {
                    io.to(sid).emit("user-left", socket.id);
                    io.to(sid).emit("participant-count", clients.length);
                });
                if (clients.length === 0) {
                    delete connections[path];
                    delete messages[path];
                }
                break;
            }
        });
    });

    return io;
};