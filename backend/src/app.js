import "dotenv/config";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import { connectToSocket } from "./controllers/socketManager.js";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import userRoutes from "./routes/users.routes.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

const PORT = process.env.PORT || 8000;
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const MONGO_DB_NAME = process.env.MONGO_DB_NAME || "meetspace";
const hasMongoPlaceholders = (uri = "") => /<db_user>|<db_password>|<cluster-name>/i.test(uri);
const normalizeOrigin = (value = "") => value.trim().replace(/\/+$/, "");

const allowedOrigins = [
    ...(process.env.CLIENT_URLS || "").split(",").map(normalizeOrigin).filter(Boolean),
    ...(process.env.CLIENT_URL ? [normalizeOrigin(process.env.CLIENT_URL)] : []),
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173"
].map(normalizeOrigin).filter((value, index, arr) => arr.indexOf(value) === index);

const allowAllOrigins = allowedOrigins.includes("*");

const corsOriginHandler = (origin, callback) => {
    // allow server-to-server calls and same-origin calls without Origin header
    if (!origin) return callback(null, true);
    if (allowAllOrigins || allowedOrigins.includes(normalizeOrigin(origin))) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
};

// For same-port setup: frontend and backend on port 8000
// Socket.IO accepts connections from same origin
const io = connectToSocket(server, allowedOrigins);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // disable for React app compatibility
}));

app.use(cors({
    origin: corsOriginHandler,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

// Rate limiting on API only
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { message: "Too many requests, please try again later." }
});
app.use("/api/", limiter);

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ limit: "10kb", extended: true }));

// ── API Routes ──
app.use("/api/v1/users", userRoutes);

app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Serve React Frontend Build ──
// The built React app is in ../frontend/build
const frontendBuild = path.join(__dirname, "../../frontend/build");
app.use(express.static(frontendBuild));

// All non-API routes → serve React's index.html (handles React Router)
app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) {
        return res.status(404).json({ message: "API route not found" });
    }
    res.sendFile(path.join(frontendBuild, "index.html"));
});

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({ message: err.message || "Internal Server Error" });
});

const start = async () => {
    try {
        if (!MONGO_URI) {
            throw new Error("MONGO_URI (or MONGODB_URI) is missing. Add it in backend/.env or your hosting environment variables.");
        }

        if (hasMongoPlaceholders(MONGO_URI)) {
            throw new Error("MONGO_URI still contains placeholders like <db_password>. Put your real Atlas password in backend/.env.");
        }

        await mongoose.connect(MONGO_URI, {
            dbName: MONGO_DB_NAME,
            serverSelectionTimeoutMS: 10000,
            autoIndex: true
        });

        console.log(`✅ MongoDB Connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
    } catch (err) {
        console.error("❌ MongoDB connection failed:", err.message);
        console.error("   1) Check MONGO_URI credentials");
        console.error("   2) Atlas Network Access must allow your IP (or 0.0.0.0/0 for testing)");
        console.error("   3) Atlas DB user must have readWrite permissions");
        process.exit(1);
    }

    server.listen(PORT, () => {
        console.log(`🚀 MeetSpace running on http://localhost:${PORT}`);
        console.log(`   Frontend + Backend both on port ${PORT}`);
    });
};

start();