import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import "../styles/history.css";

export default function History() {
    const { getHistoryOfUser } = useContext(AuthContext);
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        getHistoryOfUser().then(h => setMeetings(h || [])).catch(() => {}).finally(() => setLoading(false));
    }, []);

    const formatDate = (ds) => new Date(ds).toLocaleDateString("en-GB", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    });

    return (
        <div className="hist-root">
            <div className="hist-bg">
                <div className="hist-blob hist-blob-1" />
                <div className="hist-blob hist-blob-2" />
            </div>
            <nav className="hist-nav">
                <button className="hist-back" onClick={() => navigate("/home")}>← Back to Home</button>
                <h2 className="hist-nav-title">Meeting History</h2>
            </nav>
            <main className="hist-main">
                {loading ? (
                    <div className="hist-loading"><div className="hist-spinner" /><p>Loading your history...</p></div>
                ) : meetings.length === 0 ? (
                    <div className="hist-empty">
                        <div className="hist-empty-icon">📋</div>
                        <h3>No meetings yet</h3>
                        <p>Your meeting history will appear here once you join your first call.</p>
                        <button onClick={() => navigate("/home")} className="hist-cta">Start a Meeting →</button>
                    </div>
                ) : (
                    <div className="hist-list">
                        <p className="hist-count">{meetings.length} meeting{meetings.length !== 1 ? "s" : ""}</p>
                        {meetings.map((m, i) => (
                            <div className="hist-card" key={i}>
                                <div className="hist-card-left">
                                    <div className="hist-card-icon">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                                            <path d="M15 10l5-3v10l-5-3V10z"/><rect x="2" y="7" width="13" height="10" rx="2"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <div className="hist-code">{m.meetingCode}</div>
                                        <div className="hist-date">{formatDate(m.date)}</div>
                                    </div>
                                </div>
                                <button className="hist-rejoin" onClick={() => navigate(`/${m.meetingCode}`)}>Rejoin →</button>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}