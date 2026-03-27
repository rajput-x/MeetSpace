import React, { useContext, useState } from "react";
import withAuth from "../utils/withAuth";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
import "../styles/home.css";

function HomeComponent() {
    const navigate = useNavigate();
    const [meetingCode, setMeetingCode] = useState("");
    const [error, setError] = useState("");
    const { addToUserHistory, handleLogout, userData } = useContext(AuthContext);

    const generateCode = () => {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        setMeetingCode(code);
    };

    const handleJoinVideoCall = async () => {
        const code = meetingCode.trim();
        if (!code) { setError("Please enter a meeting code"); return; }
        setError("");
        await addToUserHistory(code);
        navigate(`/${code}`);
    };

    return (
        <div className="home-root">
            <div className="home-bg">
                <div className="home-blob home-blob-1" />
                <div className="home-blob home-blob-2" />
            </div>

            <nav className="home-nav">
                <div className="home-nav-logo">
                    <div className="home-nav-logo-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                            <path d="M15 10l5-3v10l-5-3V10z"/><rect x="2" y="7" width="13" height="10" rx="2"/>
                        </svg>
                    </div>
                    <span>MeetSpace</span>
                </div>
                <div className="home-nav-actions">
                    {userData && <span className="home-greeting">👋 {userData.name || userData.username}</span>}
                    <button className="btn-nav-secondary" onClick={() => navigate("/schedule")}>📅 Schedule</button>
                    <button className="btn-nav-secondary" onClick={() => navigate("/history")}>📋 History</button>
                    <button className="btn-nav-logout" onClick={handleLogout}>Logout</button>
                </div>
            </nav>

            <main className="home-main">
                <div className="home-card">
                    <h1 className="home-title">Start or join a<br /><span className="home-highlight">meeting</span></h1>
                    <p className="home-subtitle">Enter a code to join, or create a new meeting instantly.</p>
                    <div className="home-input-row">
                        <input className="home-input" type="text" placeholder="Enter meeting code..."
                            value={meetingCode} onChange={e => setMeetingCode(e.target.value.toUpperCase())}
                            onKeyDown={e => e.key === "Enter" && handleJoinVideoCall()} />
                        <button className="btn-join" onClick={handleJoinVideoCall}>Join →</button>
                    </div>
                    {error && <p className="home-error">⚠️ {error}</p>}
                    <div className="home-divider"><span>or</span></div>
                    <button className="btn-new-meeting" onClick={generateCode}>✨ Generate New Code</button>
                    {meetingCode && (
                        <div className="home-generated">
                            <span>Generated code:</span>
                            <strong>{meetingCode}</strong>
                            <button onClick={() => navigator.clipboard.writeText(meetingCode)}>📋 Copy</button>
                        </div>
                    )}
                </div>

                <div className="home-tips">
                    <h3>Quick Tips</h3>
                    <ul>
                        <li>🎤 Make sure your microphone is allowed in browser</li>
                        <li>📷 Allow camera access for video calls</li>
                        <li>🔗 Share the meeting code with others to invite them</li>
                        <li>📅 Schedule future meetings from the Schedule page</li>
                        <li>💬 Use the chat and whiteboard during meetings</li>
                    </ul>
                </div>
            </main>
        </div>
    );
}

export default withAuth(HomeComponent);