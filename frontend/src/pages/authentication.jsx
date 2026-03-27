import React, { useState, useContext, useEffect, useRef } from "react";
import { AuthContext } from "../contexts/AuthContext";
import "../styles/auth.css";

function ParticleBg() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current, ctx = c.getContext("2d");
    let W, H, pts = [], mouse = { x: -999, y: -999 }, raf;
    const resize = () => {
      W = c.width = window.innerWidth; H = c.height = window.innerHeight;
      pts = [];
      for (let x = 50; x < W; x += 58)
        for (let y = 50; y < H; y += 58)
          pts.push({ ox: x, oy: y, x, y, r: Math.random() * 1.1 + 0.5 });
    };
    const onMove = e => { mouse.x = e.clientX; mouse.y = e.clientY; };
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove);
    resize();
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      pts.forEach(p => {
        const dx = mouse.x - p.ox, dy = mouse.y - p.oy;
        const d = Math.sqrt(dx*dx + dy*dy), pull = Math.max(0, 1 - d/200) * 0.2;
        p.x += (p.ox + dx*pull - p.x) * 0.1;
        p.y += (p.oy + dy*pull - p.y) * 0.1;
        const g = Math.max(0, 1 - d/200);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
        ctx.fillStyle = `rgba(${110+g*80},${130+g*50},255,${0.06+g*0.44})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); window.removeEventListener("mousemove", onMove); };
  }, []);
  return <canvas ref={ref} className="auth-ptc" />;
}

export default function Authentication() {
  const [tab, setTab] = useState(0);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const { handleRegister, handleLogin } = useContext(AuthContext);

  const switchTab = t => { setTab(t); setError(""); setSuccess(""); };

  const handleAuth = async e => {
    e.preventDefault(); setError(""); setSuccess(""); setLoading(true);
    try {
      if (tab === 0) {
        await handleLogin(username, password);
      } else {
        if (password.length < 6) { setError("Password must be at least 6 characters."); setLoading(false); return; }
        const res = await handleRegister(name, username, password);
        setSuccess(res || "Account created! Please sign in.");
        setTab(0); setName(""); setUsername(""); setPassword("");
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Something went wrong.");
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-root">
      <ParticleBg />
      <div className="auth-orb auth-orb1" />
      <div className="auth-orb auth-orb2" />
      <div className="auth-grid" />

      <div className="auth-card">
        <div className="auth-top-line" />

        <div className="auth-brand">
          <div className="auth-brand-icon">
            {/* Video camera SVG */}
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 10l5-3v10l-5-3V10z"/>
              <rect x="2" y="7" width="13" height="10" rx="2"/>
            </svg>
          </div>
          <span className="auth-brand-name">MeetSpace</span>
        </div>

        <h1 className="auth-h1">{tab === 0 ? "Welcome back" : "Create account"}</h1>
        <p className="auth-sub">{tab === 0 ? "Sign in to continue your meetings" : "Join thousands of users worldwide"}</p>

        <div className="auth-tabs">
          <div className={`auth-tab-track ${tab === 1 ? "right" : ""}`} />
          <button className={`auth-tab ${tab === 0 ? "on" : ""}`} onClick={() => switchTab(0)}>Sign In</button>
          <button className={`auth-tab ${tab === 1 ? "on" : ""}`} onClick={() => switchTab(1)}>Sign Up</button>
        </div>

        <form onSubmit={handleAuth}>
          {tab === 1 && (
            <div className="afield">
              <label>Full Name</label>
              <div className="ainput">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ainput-ico">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                <input type="text" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} required autoFocus />
              </div>
            </div>
          )}
          <div className="afield">
            <label>Username</label>
            <div className="ainput">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ainput-ico">
                <circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 006 0v-1a10 10 0 10-3.92 7.94"/>
              </svg>
              <input type="text" placeholder="johndoe" value={username} onChange={e => setUsername(e.target.value)} required autoFocus={tab === 0} />
            </div>
          </div>
          <div className="afield">
            <label>Password</label>
            <div className="ainput">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ainput-ico">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              <input type={showPw ? "text" : "password"} placeholder={tab === 1 ? "Min. 6 characters" : "••••••••"} value={password} onChange={e => setPassword(e.target.value)} required />
              <button type="button" className="pw-eye" onClick={() => setShowPw(p => !p)}>
                {showPw ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && <div className="auth-msg err"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{error}</div>}
          {success && <div className="auth-msg ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>{success}</div>}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? <span className="auth-spin" /> : <>{tab === 0 ? "Sign In" : "Create Account"}<svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></>}
            <div className="auth-shine" />
          </button>
        </form>

        <p className="auth-foot">
          {tab === 0 ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => switchTab(tab === 0 ? 1 : 0)}>{tab === 0 ? "Sign Up" : "Sign In"}</button>
        </p>
      </div>
    </div>
  );
}