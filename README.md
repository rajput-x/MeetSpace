# 📹 MeetSpace - Video Conferencing Platform 

A full-stack real-time video conferencing platform built with React, Node.js, Socket.IO, and WebRTC.

## ✨ What's New 

### Security Upgrades
- ✅ **JWT Authentication** — replaced insecure random token with industry-standard JWT tokens
- ✅ **Helmet.js** — HTTP security headers on all responses
- ✅ **Rate Limiting** — prevents brute-force attacks (100 req/15min per IP)
- ✅ **Password validation** — minimum 6 characters enforced on registration
- ✅ **CORS configured** — properly scoped to your frontend URL
- ✅ **Auto-logout** — 401 responses automatically redirect to login

### Backend Improvements
- ✅ **dotenv** — environment variables via `.env` file
- ✅ **Global error handler** — consistent error responses across all routes
- ✅ **Protected routes** — history endpoints now require JWT auth
- ✅ **Better MongoDB schema** — meeting history uses `ObjectId` reference to user
- ✅ **Timestamps** on models (`createdAt`, `updatedAt`)
- ✅ **Socket typing indicators** — broadcasts typing state to room participants
- ✅ **Participant count** — emitted on join/leave
- ✅ **Message timestamps** — chat messages include ISO timestamp
- ✅ **Room cleanup** — chat history deleted when last participant leaves

### Frontend Improvements
- ✅ **Beautiful new UI** — dark glassmorphism design with animated blobs
- ✅ **New fonts** — Sora (headings) + DM Sans (body)
- ✅ **Landing page** redesigned with feature highlights and hero section
- ✅ **Auth page** — custom-built (no MUI form), password show/hide, better error handling
- ✅ **Home page** — meeting code generator, copy to clipboard, keyboard shortcut (Enter)
- ✅ **History page** — loading state, empty state, rejoin button, formatted dates
- ✅ **VideoMeet** — lobby preview, camera/mic state persisted via `.enabled`, chat bubbles, "waiting" screen, connection status
- ✅ **Chat** — scrolls to latest message, timestamps, self vs others styling
- ✅ **Auto token attachment** — Axios interceptor adds Bearer token to every request
- ✅ **Auto logout** — 401 interceptor clears token and redirects

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)

### 1. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret
npm install
npm run dev
```

**.env file:**
```
PORT=8000
MONGO_URI=mongodb+srv://<db_user>:<db_password>@<cluster-name>.mongodb.net/?retryWrites=true&w=majority&appName=MeetSpace
MONGO_DB_NAME=meetspace
JWT_SECRET=your_super_secret_key_change_this
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:3000
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm start
```

Set `REACT_APP_SERVER_URL=http://localhost:8000` in a `.env` file if needed.

---

## 🏗️ Project Structure

```
VideoConfrencePlatform/
├── backend/
│   ├── src/
│   │   ├── app.js                      # Express app, MongoDB, server
│   │   ├── controllers/
│   │   │   ├── socketManager.js        # Socket.IO: WebRTC signaling, chat
│   │   │   └── user.controller.js      # Login, register, history
│   │   ├── middleware/
│   │   │   └── auth.middleware.js      # JWT verification
│   │   ├── models/
│   │   │   ├── user.model.js
│   │   │   └── meeting.model.js
│   │   └── routes/
│   │       └── users.routes.js
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── App.js
    │   ├── environment.js
    │   ├── contexts/
    │   │   └── AuthContext.jsx         # Auth state, API calls, JWT
    │   ├── pages/
    │   │   ├── landing.jsx             # Homepage
    │   │   ├── authentication.jsx      # Login/Register
    │   │   ├── home.jsx                # Dashboard
    │   │   ├── history.jsx             # Meeting history
    │   │   └── VideoMeet.jsx           # Video call room
    │   ├── styles/
    │   │   ├── landing.css
    │   │   ├── auth.css
    │   │   ├── home.css
    │   │   ├── history.css
    │   │   └── videoComponent.module.css
    │   └── utils/
    │       └── withAuth.jsx            # Route protection HOC
    └── package.json
```

---

## 🔧 API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/users/register` | ❌ | Create account |
| POST | `/api/v1/users/login` | ❌ | Login, returns JWT |
| POST | `/api/v1/users/add_to_activity` | ✅ JWT | Save meeting to history |
| GET | `/api/v1/users/get_all_activity` | ✅ JWT | Get meeting history |
| GET | `/health` | ❌ | Health check |

---

## 🔌 Socket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `join-call` | Client → Server | Join a meeting room |
| `signal` | Bidirectional | WebRTC SDP/ICE signaling |
| `chat-message` | Client → Server | Send a chat message |
| `typing` | Client → Server | Typing indicator |
| `user-joined` | Server → Client | Someone joined the room |
| `user-left` | Server → Client | Someone left the room |
| `participant-count` | Server → Client | Current participant count |
