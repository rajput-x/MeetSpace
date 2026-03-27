import React, { useState, useEffect, useContext, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
import withAuth from "../utils/withAuth";
import "../styles/schedule.css";

const LOGO = (
    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
        <path d="M15 10l5-3v10l-5-3V10z"/>
        <rect x="2" y="7" width="13" height="10" rx="2"/>
    </svg>
);

/* ── Reminder checker: runs every 30s, shows browser notification or in-app toast ── */
function useReminderChecker(meetings) {
    const notifiedRef = useRef(new Set()); // "meetingId-60min" or "meetingId-30min"
    const [toast, setToast] = useState(null); // { title, msg, code }
    const toastTimer = useRef(null);

    // Request notification permission once
    useEffect(() => {
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }
    }, []);

    const showReminder = (meeting, minsLeft) => {
        const key = `${meeting.id}-${minsLeft}`;
        if (notifiedRef.current.has(key)) return;
        notifiedRef.current.add(key);

        const msg = `"${meeting.title}" starts in ${minsLeft} minutes`;

        // Browser notification
        if ("Notification" in window && Notification.permission === "granted") {
            const n = new Notification("⏰ MeetSpace Reminder", {
                body: msg,
                icon: "/favicon.ico",
                tag: key,
                requireInteraction: true,
            });
            n.onclick = () => { window.focus(); n.close(); };
        }

        // In-app toast (also shown as fallback)
        setToast({ title: "⏰ Meeting Reminder", msg, code: meeting.code, minsLeft });
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 12000);
    };

    useEffect(() => {
        const check = () => {
            const now = Date.now();
            meetings.forEach(m => {
                const dt = new Date(`${m.date}T${m.time}`).getTime();
                if (dt <= now) return; // already past
                const minsLeft = Math.round((dt - now) / 60000);
                if (minsLeft <= 60 && minsLeft > 55) showReminder(m, 60);
                if (minsLeft <= 30 && minsLeft > 25) showReminder(m, 30);
                if (minsLeft <= 5  && minsLeft > 0)  showReminder(m, minsLeft);
            });
        };
        check(); // run immediately
        const id = setInterval(check, 30000); // check every 30s
        return () => clearInterval(id);
    // eslint-disable-next-line
    }, [meetings]);

    return { toast, dismissToast: () => setToast(null) };
}

function SchedulePage() {
    const navigate = useNavigate();
    const { userData } = useContext(AuthContext);

    const [meetings, setMeetings] = useState(() => {
        const saved = localStorage.getItem("ms_scheduled");
        return saved ? JSON.parse(saved) : [];
    });
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({
        title: "", date: "", time: "", duration: "60", description: "", code: ""
    });
    const [editId, setEditId] = useState(null);
    const [copied, setCopied] = useState(null);

    useEffect(() => {
        localStorage.setItem("ms_scheduled", JSON.stringify(meetings));
    }, [meetings]);

    const { toast, dismissToast } = useReminderChecker(meetings);

    const genCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

    const openNew = () => {
        setForm({ title: "", date: "", time: "", duration: "60", description: "", code: genCode() });
        setEditId(null); setShowForm(true);
    };
    const openEdit = (m) => {
        setForm({ title: m.title, date: m.date, time: m.time, duration: m.duration, description: m.description, code: m.code });
        setEditId(m.id); setShowForm(true);
    };

    const saveMeeting = () => {
        if (!form.title.trim() || !form.date || !form.time) return;
        if (editId) {
            setMeetings(p => p.map(m => m.id === editId ? { ...m, ...form } : m));
        } else {
            setMeetings(p => [...p, { ...form, id: Date.now(), createdBy: userData?.name || "Host" }]);
        }
        setShowForm(false);
    };

    const deleteMeeting = (id) => {
        if (window.confirm("Delete this scheduled meeting?"))
            setMeetings(p => p.filter(m => m.id !== id));
    };

    const copyLink = (code) => {
        navigator.clipboard.writeText(`${window.location.origin}/${code}`);
        setCopied(code); setTimeout(() => setCopied(null), 2000);
    };

    const joinMeeting = (code) => navigate(`/${code}`);

    const isUpcoming = (date, time) => {
        const dt = new Date(`${date}T${time}`);
        return dt > new Date();
    };

    const sortedMeetings = [...meetings].sort((a, b) => {
        const da = new Date(`${a.date}T${a.time}`);
        const db = new Date(`${b.date}T${b.time}`);
        return da - db;
    });

    const upcoming = sortedMeetings.filter(m => isUpcoming(m.date, m.time));
    const past = sortedMeetings.filter(m => !isUpcoming(m.date, m.time));

    const fmtDate = (d, t) => {
        const dt = new Date(`${d}T${t}`);
        return dt.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }) +
            " at " + dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    const fmtDuration = (min) => {
        const m = parseInt(min);
        if (m < 60) return `${m} min`;
        return `${Math.floor(m / 60)}h ${m % 60 > 0 ? m % 60 + "m" : ""}`.trim();
    };

    const today = new Date().toISOString().split("T")[0];

    return (
        <div className="sc-root">
            <div className="sc-orb1" /><div className="sc-orb2" /><div className="sc-grid" />

            {/* ── REMINDER TOAST ── */}
            {toast && (
                <div className="sc-reminder-toast">
                    <div className="sc-reminder-icon">⏰</div>
                    <div className="sc-reminder-body">
                        <div className="sc-reminder-title">{toast.title}</div>
                        <div className="sc-reminder-msg">{toast.msg}</div>
                    </div>
                    <button className="sc-reminder-join" onClick={() => { navigate(`/${toast.code}`); dismissToast(); }}>
                        Join Now
                    </button>
                    <button className="sc-reminder-close" onClick={dismissToast}>✕</button>
                </div>
            )}

            {/* Navbar */}
            <nav className="sc-nav">
                <div className="sc-nav-logo">
                    <div className="sc-logo-icon">{LOGO}</div>
                    <span>MeetSpace</span>
                </div>
                <div className="sc-nav-actions">
                    <button className="sc-btn-ghost" onClick={() => navigate("/home")}>← Home</button>
                    <button className="sc-btn-ghost" onClick={() => navigate("/history")}>History</button>
                </div>
            </nav>

            <main className="sc-main">
                {/* Header */}
                <div className="sc-page-head">
                    <div>
                        <h1 className="sc-page-title">📅 Meeting Schedule</h1>
                        <p className="sc-page-sub">Plan and manage your upcoming meetings</p>
                    </div>
                    <button className="sc-btn-primary" onClick={openNew}>
                        + Schedule Meeting
                    </button>
                </div>

                {/* Upcoming */}
                <section className="sc-section">
                    <h2 className="sc-section-title">
                        <span className="sc-section-dot sc-dot-green" />
                        Upcoming ({upcoming.length})
                    </h2>
                    {upcoming.length === 0 ? (
                        <div className="sc-empty">
                            <div className="sc-empty-icon">📅</div>
                            <p>No upcoming meetings</p>
                            <span>Schedule one to get started</span>
                            <button className="sc-btn-primary" onClick={openNew} style={{ marginTop: 14 }}>
                                + Schedule Meeting
                            </button>
                        </div>
                    ) : upcoming.map(m => (
                        <MeetingCard key={m.id} m={m} fmtDate={fmtDate} fmtDuration={fmtDuration}
                            onJoin={joinMeeting} onCopy={copyLink} onEdit={openEdit} onDelete={deleteMeeting}
                            copied={copied} isPast={false} />
                    ))}
                </section>

                {/* Past */}
                {past.length > 0 && (
                    <section className="sc-section">
                        <h2 className="sc-section-title">
                            <span className="sc-section-dot sc-dot-gray" />
                            Past ({past.length})
                        </h2>
                        {past.map(m => (
                            <MeetingCard key={m.id} m={m} fmtDate={fmtDate} fmtDuration={fmtDuration}
                                onJoin={joinMeeting} onCopy={copyLink} onEdit={openEdit} onDelete={deleteMeeting}
                                copied={copied} isPast={true} />
                        ))}
                    </section>
                )}
            </main>

            {/* Schedule Form Modal */}
            {showForm && (
                <div className="sc-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
                    <div className="sc-modal">
                        <div className="sc-modal-head">
                            <h3>{editId ? "Edit Meeting" : "Schedule New Meeting"}</h3>
                            <button className="sc-modal-close" onClick={() => setShowForm(false)}>✕</button>
                        </div>
                        <div className="sc-modal-body">
                            <div className="sc-field">
                                <label>Meeting Title *</label>
                                <input className="sc-input" placeholder="e.g. Team Standup, Project Review..."
                                    value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
                            </div>
                            <div className="sc-field-row">
                                <div className="sc-field">
                                    <label>Date *</label>
                                    <input className="sc-input" type="date" min={today}
                                        value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                                </div>
                                <div className="sc-field">
                                    <label>Time *</label>
                                    <input className="sc-input" type="time"
                                        value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
                                </div>
                            </div>
                            <div className="sc-field">
                                <label>Duration</label>
                                <select className="sc-input" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}>
                                    {["15","30","45","60","90","120","180"].map(d => (
                                        <option key={d} value={d}>{fmtDuration(d)}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="sc-field">
                                <label>Description (optional)</label>
                                <textarea className="sc-input sc-textarea" placeholder="Meeting agenda, notes..."
                                    value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
                            </div>
                            <div className="sc-field">
                                <label>Meeting Code</label>
                                <div className="sc-code-row">
                                    <input className="sc-input" value={form.code}
                                        onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().slice(0, 8) }))} />
                                    <button className="sc-btn-ghost sc-regenerate" onClick={() => setForm(f => ({ ...f, code: genCode() }))}>
                                        🔄 Generate
                                    </button>
                                </div>
                                <span className="sc-field-hint">Participants will use this to join: {window.location.origin}/{form.code}</span>
                            </div>
                        </div>
                        <div className="sc-modal-footer">
                            <button className="sc-btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                            <button className="sc-btn-primary" onClick={saveMeeting}
                                disabled={!form.title.trim() || !form.date || !form.time}>
                                {editId ? "Save Changes" : "Schedule Meeting"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function MeetingCard({ m, fmtDate, fmtDuration, onJoin, onCopy, onEdit, onDelete, copied, isPast }) {
    const COLORS = ["#4f8ef7","#34a853","#f59e0b","#ec4899","#8b5cf6","#14b8a6"];
    const col = COLORS[Math.abs((m.title || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % COLORS.length];
    return (
        <div className={`sc-card ${isPast ? "sc-card-past" : ""}`} style={{ "--card-col": col }}>
            <div className="sc-card-left">
                <div className="sc-card-avatar" style={{ background: col + "22", borderColor: col + "44" }}>
                    <span style={{ color: col }}>📹</span>
                </div>
            </div>
            <div className="sc-card-body">
                <div className="sc-card-top">
                    <span className="sc-card-title">{m.title}</span>
                    <span className="sc-card-code" style={{ color: col }}>{m.code}</span>
                </div>
                <div className="sc-card-meta">
                    <span>🕐 {fmtDate(m.date, m.time)}</span>
                    <span>⏱ {fmtDuration(m.duration)}</span>
                    {m.createdBy && <span>👤 {m.createdBy}</span>}
                </div>
                {m.description && <p className="sc-card-desc">{m.description}</p>}
            </div>
            <div className="sc-card-actions">
                {!isPast && (
                    <button className="sc-btn-join" onClick={() => onJoin(m.code)}
                        style={{ background: col, boxShadow: `0 4px 16px ${col}44` }}>
                        Join →
                    </button>
                )}
                {isPast && (
                    <button className="sc-btn-rejoin" onClick={() => onJoin(m.code)}>
                        Rejoin
                    </button>
                )}
                <button className="sc-btn-ghost sc-btn-sm" onClick={() => onCopy(m.code)}
                    title="Copy link">
                    {copied === m.code ? "✓ Copied" : "🔗 Copy"}
                </button>
                {!isPast && (
                    <button className="sc-btn-ghost sc-btn-sm" onClick={() => onEdit(m)} title="Edit">✏️</button>
                )}
                <button className="sc-btn-delete sc-btn-sm" onClick={() => onDelete(m.id)} title="Delete">🗑</button>
            </div>
        </div>
    );
}

export default withAuth(SchedulePage);