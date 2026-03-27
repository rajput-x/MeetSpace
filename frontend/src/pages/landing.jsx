import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/landing.css";

/* ── Particle dot grid ──────────────────────────── */
function ParticleBg() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let W, H, dots = [], mouse = { x: -999, y: -999 }, raf;
    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      dots = [];
      const gapX = 52, gapY = 52;
      for (let x = gapX / 2; x < W; x += gapX)
        for (let y = gapY / 2; y < H; y += gapY)
          dots.push({ ox: x, oy: y, x, y, s: Math.random() * 1.2 + 0.6 });
    };
    const onMove = e => { mouse.x = e.clientX; mouse.y = e.clientY; };
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove);
    resize();
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      dots.forEach(d => {
        const dx = mouse.x - d.ox, dy = mouse.y - d.oy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const pull = Math.max(0, 1 - dist / 220) * 0.22;
        d.x += (d.ox + dx * pull - d.x) * 0.12;
        d.y += (d.oy + dy * pull - d.y) * 0.12;
        const glow = Math.max(0, 1 - dist / 200);
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.s, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${110 + glow * 80},${120 + glow * 60},${255},${0.07 + glow * 0.5})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); window.removeEventListener("mousemove", onMove); };
  }, []);
  return <canvas ref={canvasRef} className="particle-canvas" />;
}

/* ── 3D Tilt wrapper ────────────────────────────── */
function Tilt3D({ children, intensity = 16, className = "" }) {
  const ref = useRef(null);
  const onMove = e => {
    const r = ref.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5);
    const y = ((e.clientY - r.top) / r.height - 0.5);
    ref.current.style.transform = `perspective(900px) rotateY(${x * intensity}deg) rotateX(${-y * intensity * 0.7}deg) scale3d(1.04,1.04,1.04)`;
    ref.current.style.setProperty("--shine-x", `${(x + 0.5) * 100}%`);
    ref.current.style.setProperty("--shine-y", `${(y + 0.5) * 100}%`);
  };
  const onLeave = () => { ref.current.style.transform = "perspective(900px) rotateY(0) rotateX(0) scale3d(1,1,1)"; };
  return (
    <div ref={ref} className={`tilt3d ${className}`} onMouseMove={onMove} onMouseLeave={onLeave}>
      {children}
    </div>
  );
}

/* ── Mock 3D Video UI ───────────────────────────── */
function VideoMock3D() {
  const wrapRef = useRef(null);
  const [activeBar, setActiveBar] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    const onMove = e => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) / r.width;
      const y = (e.clientY - r.top - r.height / 2) / r.height;
      el.style.transform = `perspective(1400px) rotateY(${x * 20}deg) rotateX(${-y * 14}deg)`;
    };
    const onLeave = () => { el.style.transform = "perspective(1400px) rotateY(-10deg) rotateX(7deg)"; };
    el.style.transform = "perspective(1400px) rotateY(-10deg) rotateX(7deg)";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseleave", onLeave); };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setActiveBar(p => (p + 1) % 5), 600);
    return () => clearInterval(t);
  }, []);

  const peers = [
    { name: "Alice", color: "#10b981" },
    { name: "Bob",   color: "#f59e0b" },
    { name: "Carol", color: "#ec4899" },
  ];

  return (
    <div ref={wrapRef} className="mock3d-wrap">
      {/* Glow underneath */}
      <div className="mock3d-glow" />

      <div className="mock3d-card">
        {/* Window chrome */}
        <div className="mock-chrome">
          <div className="chrome-dots">
            <span style={{ background: "#ef4444" }} />
            <span style={{ background: "#f59e0b" }} />
            <span style={{ background: "#22c55e" }} />
          </div>
          <span className="chrome-title">MeetSpace · Room #A9F3</span>
          <div className="chrome-live"><span className="live-dot" />LIVE</div>
        </div>

        {/* Main speaker */}
        <div className="mock-main-video">
          <div className="mock-avatar-wrap" style={{ borderColor: "#6366f1" }}>
            <div className="mock-avatar-ring" style={{ background: "#6366f122", borderColor: "#6366f144" }}>
              <span style={{ fontSize: 28 }}>👤</span>
            </div>
          </div>
          <div className="mock-name-tag" style={{ background: "#6366f122", borderColor: "#6366f144", color: "#818cf8" }}>
            You · Host
          </div>
          {/* Sound bars */}
          <div className="mock-bars">
            {[5, 9, 6, 12, 7].map((h, i) => (
              <div key={i} className="mock-bar"
                style={{ height: i === activeBar ? h * 2.2 : h, background: "#6366f1", opacity: i === activeBar ? 1 : 0.45 }} />
            ))}
          </div>
          {/* Shimmer */}
          <div className="mock-main-shimmer" />
        </div>

        {/* Peer grid */}
        <div className="mock-peer-grid">
          {peers.map(p => (
            <div key={p.name} className="mock-peer" style={{ borderColor: p.color + "44" }}>
              <div className="mock-peer-avatar" style={{ background: p.color + "18", borderColor: p.color + "44" }}>
                <span style={{ fontSize: 16 }}>👤</span>
              </div>
              <span className="mock-peer-name">{p.name}</span>
              <div className="mock-peer-shimmer" style={{ background: `radial-gradient(circle at 50% 100%, ${p.color}15, transparent)` }} />
            </div>
          ))}
        </div>

        {/* Controls row */}
        <div className="mock-ctrl-row">
          {[
            { icon: "🎤", color: "#6366f1", on: true },
            { icon: "📵", color: "#ef4444", on: false, active: true },
            { icon: "📷", color: "#6366f1", on: true },
            { icon: "🖥️", color: "#6366f1", on: true },
            { icon: "💬", color: "#6366f1", on: true },
          ].map((b, i) => (
            <div key={i} className="mock-ctrl-btn"
              style={{ background: b.active ? "#ef444422" : "rgba(255,255,255,0.06)", borderColor: b.active ? "#ef444444" : "rgba(255,255,255,0.1)" }}>
              <span>{b.icon}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Feature Card ───────────────────────────────── */
function FeatureCard({ icon, title, desc, color, glow, stat, statLabel, delay }) {
  return (
    <Tilt3D className="feat-tilt" intensity={12}>
      <div className="feat-card" style={{ animationDelay: `${delay}s` }}>
        <div className="feat-top-line" style={{ background: `linear-gradient(90deg, transparent, ${color}88, transparent)` }} />
        <div className="feat-icon-wrap" style={{ background: `${color}18`, borderColor: `${color}33`, boxShadow: `0 8px 28px ${glow}` }}>
          <span>{icon}</span>
        </div>
        <div className="feat-stat-badge" style={{ background: `${color}14`, borderColor: `${color}30` }}>
          <div className="feat-stat-val" style={{ color }}>{stat}</div>
          <div className="feat-stat-lbl">{statLabel}</div>
        </div>
        <h3 className="feat-title">{title}</h3>
        <p className="feat-desc">{desc}</p>
        <div className="feat-floor" style={{ background: `radial-gradient(ellipse at 50% 160%, ${color}20, transparent)` }} />
      </div>
    </Tilt3D>
  );
}

/* ── Main Page ──────────────────────────────────── */
export default function LandingPage() {
  const navigate = useNavigate();
  const guestCode = useRef(Math.random().toString(36).substr(2, 6).toUpperCase()).current;

  const features = [
    { icon: "🎬", title: "Crystal HD Video", desc: "Adaptive 1080p with AI-enhanced quality. Zero lag, zero compromise on any device.", color: "#6366f1", glow: "rgba(99,102,241,0.28)", stat: "1080p", statLabel: "Max Quality" },
    { icon: "⚡", title: "Real-Time Chat", desc: "Instant messaging with reactions, replies, and file sharing — while you're in call.", color: "#10b981", glow: "rgba(16,185,129,0.28)", stat: "<50ms", statLabel: "Latency" },
    { icon: "🖥️", title: "Screen Sharing", desc: "Share any tab, window, or your full screen in one click. 60fps smooth presentation.", color: "#f59e0b", glow: "rgba(245,158,11,0.28)", stat: "60fps", statLabel: "Share Quality" },
    { icon: "🔐", title: "End-to-End Secure", desc: "256-bit encryption on every call. Your conversations are private — always.", color: "#ec4899", glow: "rgba(236,72,153,0.28)", stat: "256-bit", statLabel: "Encryption" },
  ];

  return (
    <div className="lp-root">
      <ParticleBg />

      {/* Ambient orbs */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
      <div className="grid-overlay" />

      {/* ── NAVBAR ── */}
      <nav className="lp-nav">
        <div className="lp-logo">
          <div className="lp-logo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                <path d="M15 10l5-3v10l-5-3V10z"/>
                <rect x="2" y="7" width="13" height="10" rx="2"/>
              </svg>
            </div>
          <span>MeetSpace</span>
        </div>
        <div className="lp-nav-links">
          <a href="#features" className="lp-nav-link">Features</a>
          <button type="button" className="lp-nav-link lp-nav-link-btn">Pricing</button>
        </div>
        <div className="lp-nav-actions">
          <button className="lp-btn-ghost" onClick={() => navigate("/auth")}>Sign In</button>
          <button className="lp-btn-primary" onClick={() => navigate("/auth")}>
            Get Started <span className="btn-arrow">→</span>
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="lp-hero">
        <div className="hero-left">
          <div className="hero-badge">
            <span className="badge-star">✦</span>
            Free &amp; Open Source — No downloads needed
          </div>

          <h1 className="hero-h1">
            Connect with<br />
            <span className="hero-gradient">anyone,</span><br />
            <span className="hero-gradient-2">anywhere</span>
          </h1>

          <p className="hero-para">
            Crystal-clear HD video calls, real-time collaboration tools, and AI-powered noise cancellation — all in one beautiful platform.
          </p>

          <div className="hero-btns">
            <button className="hero-cta" onClick={() => navigate("/auth")}>
              <span>Start for Free</span>
              <span className="cta-arrow">→</span>
              <div className="cta-shine" />
            </button>
            <button className="hero-ghost" onClick={() => navigate(`/${guestCode}`)}>
              <span>🎭</span> Join as Guest
            </button>
          </div>

          <div className="hero-stats">
            {[
              { v: "HD", l: "VIDEO QUALITY" },
              { v: "∞", l: "MEETING LENGTH" },
              { v: "Free", l: "ALWAYS" },
              { v: "0ms*", l: "SETUP TIME" },
            ].map((s, i) => (
              <React.Fragment key={i}>
                {i > 0 && <div className="stats-sep" />}
                <div className="stat-item">
                  <div className="stat-val">{s.v}</div>
                  <div className="stat-lbl">{s.l}</div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="hero-right">
          <VideoMock3D />
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="lp-features">
        <div className="section-eyebrow">Everything you need</div>
        <h2 className="section-h2">Built for modern teams</h2>
        <p className="section-sub">All the tools you need, none of the complexity</p>

        <div className="feat-grid">
          {features.map((f, i) => (
            <FeatureCard key={f.title} {...f} delay={i * 0.08} />
          ))}
        </div>

        {/* ── CTA Banner ── */}
        <div className="cta-banner">
          <div className="cta-banner-grid" />
          <div className="cta-banner-content">
            <div className="cta-banner-orb" />
            <h2 className="cta-banner-h2">
              Ready to meet <span className="shimmer-span">better?</span>
            </h2>
            <p className="cta-banner-sub">Join thousands of teams already using MeetSpace for daily standups, client demos, and collaboration.</p>
            <div className="cta-banner-btns">
              <button className="hero-cta" onClick={() => navigate("/auth")}>
                Start Free Today <div className="cta-shine" />
              </button>
              <button className="hero-ghost" onClick={() => navigate(`/${guestCode}`)}>
                Try Demo →
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        Built with <span className="footer-heart">♥</span> · Open Source · No login required to join
      </footer>
    </div>
  );
}