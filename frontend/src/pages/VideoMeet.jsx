/**
 * MeetSpace — VideoMeet
 *
 * WebRTC Architecture (Zoom/Google Meet standard):
 *  - addTrack() only, NEVER addStream() — prevents double-negotiation blink
 *  - Only the NEW joiner creates offers; existing peers only answer
 *  - ontrack (not deprecated onaddstream)
 *  - track.enabled for cam/mic toggle — zero renegotiation, zero blink
 *  - replaceTrack() only for screen-share swap
 *  - Per-peer stable MediaStream stored in ref — no re-renders on track events
 *  - srcObject set once per <video> — ref guard prevents flicker
 *  - Full cleanup on unmount
 */
import React, { useEffect, useRef, useState, useCallback, useContext } from "react";
import io from "socket.io-client";
import styles from "../styles/videoComponent.module.css";
import server from "../environment";
import { useParams } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";

/* ─── ICE / peer config ─────────────────────────────────────── */
const PC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: "max-bundle",
  rtcpMuxPolicy: "require",
};

/* ─── Helpers ───────────────────────────────────────────────── */
const COLORS = ["#4f8ef7","#34a853","#f59e0b","#ec4899","#8b5cf6","#14b8a6","#f97316","#06b6d4"];
const colorOf  = id  => COLORS[Math.abs((id||"").split("").reduce((a,c)=>a+c.charCodeAt(0),0))%COLORS.length];
const initials = str => (str||"?").split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
const fmtSecs  = s   => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

/* silent 1×1 black canvas stream — used as fallback */
const makeDummy = () => {
  try {
    const c = Object.assign(document.createElement("canvas"),{width:2,height:2});
    c.getContext("2d").fillRect(0,0,2,2);
    const vt = c.captureStream(1).getVideoTracks()[0]; vt.enabled=false;
    const ac2 = new AudioContext();
    const at = ac2.createMediaStreamDestination().stream.getAudioTracks()[0];
    return new MediaStream([vt, ...(at?[at]:[])]);
  } catch { return new MediaStream(); }
};

/* ─── SVG Icons (inline, no external deps) ──────────────────── */
const Ico = {
  Cam:      ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>,
  CamOff:   ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  Mic:      ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  MicOff:   ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  Screen:   ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><polyline points="8 21 12 17 16 21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  Chat:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  People:   ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  Phone:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7 2 2 0 011.72 2v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.42 19.42 0 013.07 9.18 2 2 0 015.05 7h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11z"/></svg>,
  React:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>,
  Hand:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 00-4 0v5"/><path d="M14 10V4a2 2 0 00-4 0v6"/><path d="M10 10.5V6a2 2 0 00-4 0v8"/><path d="M18 8a2 2 0 014 0v6a8 8 0 01-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 012.83-2.82L7 15"/></svg>,
  CC:       ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></svg>,
  Shield:   ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Board:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 12l2 2 4-4"/></svg>,
  Copy:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>,
  Check:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Close:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Send:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  Logo:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 10l5-3v10l-5-3V10z"/><rect x="2" y="7" width="13" height="10" rx="2"/></svg>,
  Rec:      ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8" fill="currentColor" opacity="0.2"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>,
  RecStop:  ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" fill="currentColor" opacity="0.4"/></svg>,
  PiP:      ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><rect x="13" y="9" width="8" height="6" rx="1" fill="currentColor" opacity="0.3"/></svg>,
  Wait:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  MuteP:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  Remove:   ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg>,
};

/* ─── LiveClock ─────────────────────────────────────────────── */
function LiveClock() {
  const [t,setT] = useState("");
  useEffect(()=>{
    const f=()=>setT(new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}));
    f(); const id=setInterval(f,1000); return ()=>clearInterval(id);
  },[]);
  return <span className={styles.liveClock}>{t}</span>;
}

/* ─── Toggle switch ──────────────────────────────────────────── */
function Toggle({on,onChange}){
  return (
    <button className={`${styles.toggle} ${on?styles.toggleOn:""}`} onClick={onChange}>
      <div className={styles.toggleThumb}/>
    </button>
  );
}

/* ─── RemoteVideo — stable ref, only set srcObject when stream changes ── */
function RemoteVideo({ peerId, stream, name, color, isSpeaking, isMuted, reaction, handRaised }) {
  const vidRef = useRef(null);
  const [hasCam, setHasCam] = useState(false);

  /* Attach stream once */
  useEffect(()=>{
    const el = vidRef.current;
    if (!el || !stream) return;
    if (el.srcObject !== stream) el.srcObject = stream;
  },[stream]);

  /* Poll video track enabled state every 600 ms */
  useEffect(()=>{
    const check = () => {
      const vt = stream?.getVideoTracks()[0];
      setHasCam(!!(vt && vt.enabled && vt.readyState==="live"));
    };
    check();
    const id = setInterval(check, 600);
    return ()=>clearInterval(id);
  },[stream]);

  return (
    <div
      className={`${styles.videoTile} ${isSpeaking?styles.videoTileSpeaking:""}`}
      style={{"--tc":color}}
    >
      <video
        ref={vidRef}
        autoPlay playsInline
        className={styles.tileVideo}
        style={{display: hasCam ? "block" : "none"}}
      />
      {!hasCam && (
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#0d1020"}}>
          <div style={{width:56,height:56,borderRadius:"50%",background:color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,color:"#fff"}}>
            {initials(name)}
          </div>
        </div>
      )}
      {/* Floating reaction emoji on tile */}
      {reaction && (
        <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",fontSize:42,
          animation:"floatUp 3s ease forwards",pointerEvents:"none",zIndex:10,
          filter:"drop-shadow(0 2px 8px rgba(0,0,0,0.5))"}}>
          {reaction}
        </div>
      )}
      {/* Hand raised indicator on tile */}
      {handRaised && (
        <div style={{position:"absolute",top:8,right:8,background:"rgba(245,158,11,0.2)",
          border:"1px solid #f59e0b",borderRadius:20,padding:"2px 8px",display:"flex",
          alignItems:"center",gap:4,fontSize:12,color:"#f59e0b",fontWeight:600,zIndex:5}}>
          ✋ Raised
        </div>
      )}
      <div className={styles.tileBorder} style={{
        borderColor: isSpeaking ? color : color+"33",
        boxShadow: isSpeaking ? `0 0 0 2px ${color},0 0 16px ${color}55` : "none"
      }}/>
      {isSpeaking && <div className={styles.speakingRipple} style={{borderColor:color}}/>}
      <div className={styles.tileBottom}>
        <div className={styles.tileName} style={{background:color+"22",borderColor:color+"55"}}>
          <div className={styles.tileInitials} style={{background:color}}>{initials(name)}</div>
          <span style={{color}}>{name}</span>
          {handRaised && <span style={{marginLeft:4}}>✋</span>}
          {isSpeaking && (
            <div className={styles.speakingBars}>
              <div className={styles.speakingBar} style={{background:color}}/>
              <div className={styles.speakingBar} style={{background:color,animationDelay:"0.1s"}}/>
              <div className={styles.speakingBar} style={{background:color,animationDelay:"0.2s"}}/>
            </div>
          )}
        </div>
        {isMuted && <div style={{width:16,height:16,color:"#ea4335",display:"flex"}}><Ico.MicOff/></div>}
      </div>
    </div>
  );
}

/* ─── Whiteboard ─────────────────────────────────────────────── */
function Whiteboard({ roomId, socket }) {
  const cvs   = useRef(null);
  const draw  = useRef(false);
  const last  = useRef(null);
  const [tool,  setTool]  = useState("pen");
  const [color, setColor] = useState("#4f8ef7");
  const [size,  setSize]  = useState(3);
  const WCOLS = ["#4f8ef7","#34a853","#ea4335","#f59e0b","#ec4899","#fff","#888"];

  useEffect(()=>{
    const el=cvs.current; if(!el) return;
    const ctx=el.getContext("2d");
    ctx.fillStyle="#0d1020"; ctx.fillRect(0,0,el.width,el.height);
  },[]);

  useEffect(()=>{
    if(!socket) return;
    const onD=d=>{
      const ctx=cvs.current?.getContext("2d"); if(!ctx) return;
      ctx.beginPath(); ctx.moveTo(d.x,d.y); ctx.lineTo(d.x2,d.y2);
      ctx.strokeStyle=d.tool==="eraser"?"#0d1020":d.color;
      ctx.lineWidth=d.tool==="eraser"?d.size*4:d.size;
      ctx.lineCap="round"; ctx.stroke();
    };
    const onC=()=>{
      const ctx=cvs.current?.getContext("2d"); if(!ctx) return;
      ctx.fillStyle="#0d1020"; ctx.fillRect(0,0,cvs.current.width,cvs.current.height);
    };
    socket.on("wb-draw",onD); socket.on("wb-clear",onC);
    return ()=>{ socket.off("wb-draw",onD); socket.off("wb-clear",onC); };
  },[socket]);

  const pos=e=>{
    const r=cvs.current.getBoundingClientRect();
    const p=e.touches?.[0]||e;
    return {x:(p.clientX-r.left)*(cvs.current.width/r.width),y:(p.clientY-r.top)*(cvs.current.height/r.height)};
  };
  const line=(x,y,x2,y2)=>{
    const ctx=cvs.current.getContext("2d");
    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x2,y2);
    ctx.strokeStyle=tool==="eraser"?"#0d1020":color;
    ctx.lineWidth=tool==="eraser"?size*4:size;
    ctx.lineCap="round"; ctx.stroke();
    socket?.emit("wb-draw",{x,y,x2,y2,color,size,tool,roomId});
  };
  const dn=e=>{e.preventDefault();draw.current=true;last.current=pos(e);};
  const mv=e=>{
    e.preventDefault();
    if(!draw.current||!last.current) return;
    const p=pos(e); line(last.current.x,last.current.y,p.x,p.y); last.current=p;
  };
  const up=()=>{draw.current=false;last.current=null;};
  const clear=()=>{
    const ctx=cvs.current.getContext("2d");
    ctx.fillStyle="#0d1020"; ctx.fillRect(0,0,cvs.current.width,cvs.current.height);
    socket?.emit("wb-clear",{roomId});
  };
  const save=()=>{
    const a=document.createElement("a");
    a.href=cvs.current.toDataURL(); a.download=`wb-${roomId}.png`; a.click();
  };

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",background:"#0d1020"}}>
      <div style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",borderBottom:"1px solid rgba(255,255,255,0.08)",flexWrap:"wrap",flexShrink:0}}>
        {WCOLS.map(c=>(
          <button key={c} onClick={()=>{setColor(c);setTool("pen");}}
            style={{width:20,height:20,borderRadius:"50%",background:c,border:color===c&&tool==="pen"?"2.5px solid #fff":"2px solid transparent",cursor:"pointer",transform:color===c&&tool==="pen"?"scale(1.25)":"scale(1)",transition:"transform 0.15s"}}/>
        ))}
        <div style={{width:1,height:20,background:"rgba(255,255,255,0.1)"}}/>
        <button onClick={()=>setTool(t=>t==="eraser"?"pen":"eraser")}
          style={{background:tool==="eraser"?"rgba(79,142,247,0.2)":"rgba(255,255,255,0.06)",border:"1px solid",borderColor:tool==="eraser"?"#4f8ef7":"rgba(255,255,255,0.1)",color:tool==="eraser"?"#4f8ef7":"#9aa0a6",padding:"3px 9px",borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"inherit"}}>Eraser</button>
        <select value={size} onChange={e=>setSize(+e.target.value)}
          style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"#9aa0a6",padding:"3px 6px",borderRadius:6,fontSize:11,fontFamily:"inherit"}}>
          {[1,2,3,5,8,12].map(s=><option key={s} value={s}>{s}px</option>)}
        </select>
        <button onClick={clear} style={{background:"rgba(234,67,53,0.1)",border:"1px solid rgba(234,67,53,0.3)",color:"#ea4335",padding:"3px 9px",borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"inherit"}}>Clear</button>
        <button onClick={save}  style={{background:"rgba(52,168,83,0.1)",border:"1px solid rgba(52,168,83,0.3)",color:"#34a853",padding:"3px 9px",borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"inherit"}}>Save</button>
      </div>
      <canvas ref={cvs} width={900} height={680}
        style={{cursor:tool==="eraser"?"cell":"crosshair",flex:1,display:"block",touchAction:"none",width:"100%",height:"auto"}}
        onMouseDown={dn} onMouseMove={mv} onMouseUp={up} onMouseLeave={up}
        onTouchStart={dn} onTouchMove={mv} onTouchEnd={up}/>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function VideoMeetComponent() {
  const { url: roomId } = useParams();
  const { userData }    = useContext(AuthContext);

  /* ── Refs (never cause re-renders) ── */
  const sockRef    = useRef(null);
  const myId       = useRef(null);          // our socket id
  const localStream= useRef(null);          // camera+mic MediaStream
  const screenStrm = useRef(null);          // screen share MediaStream
  // peerMap: socketId → { pc: RTCPeerConnection, stream: MediaStream }
  const peerMap    = useRef({});
  const namesMap   = useRef({});            // socketId → display name
  const analysers  = useRef({});            // socketId → { ac, analyser }
  const localVidRef= useRef(null);          // <video> for self (grid/waiting)
  const pipVidRef  = useRef(null);          // <video> for PiP overlay box
  const chatEndRef = useRef(null);
  const meetTimer  = useRef(null);
  const recTimer   = useRef(null);
  const mediaRec   = useRef(null);
  const recChunks  = useRef([]);
  const recogRef   = useRef(null);

  /* ── UI state ── */
  const [lobby,      setLobby]      = useState(true);
  const [username,   setUsername]   = useState("");
  const [camOn,      setCamOn]      = useState(true);
  const [micOn,      setMicOn]      = useState(true);
  const [screenOn,   setScreenOn]   = useState(false);
  const [screenAvail,setScreenAvail]= useState(false);
  // remotes: array of { id, name, color, stream }
  const [remotes,    setRemotes]    = useState([]);
  const [speaking,   setSpeaking]   = useState(new Set());
  const [msgs,       setMsgs]       = useState([]);
  const [msgDraft,   setMsgDraft]   = useState("");
  const [unread,     setUnread]     = useState(0);
  const [showChat,   setShowChat]   = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [showWB,     setShowWB]     = useState(false);
  const [showHost,   setShowHost]   = useState(false);
  const [showReacts, setShowReacts] = useState(false);
  const [handUp,     setHandUp]     = useState(false);
  const [floatEmoji, setFloatEmoji] = useState(null);
  const [peerReacts, setPeerReacts] = useState({});   // socketId → emoji (clears after 3s)
  const [raisedHands,setRaisedHands]= useState(new Set()); // socketIds with raised hand
  const [peerStates, setPeerStates] = useState({});   // socketId → {micOn, camOn}
  const [ccOn,       setCcOn]       = useState(false);
  const [captLines,  setCaptLines]  = useState([]);
  const [liveCap,    setLiveCap]    = useState("");
  const [isRec,      setIsRec]      = useState(false);
  const [recSec,     setRecSec]     = useState(0);
  const [meetSec,    setMeetSec]    = useState(0);
  const [conn,       setConn]       = useState("connecting");
  const [pCount,     setPCount]     = useState(1);
  const [copied,     setCopied]     = useState(false);
  const [isHost,     setIsHost]     = useState(false);
  const [mutedSet,   setMutedSet]   = useState(new Set());
  const [waitList,   setWaitList]   = useState([]);
  const [showWait,   setShowWait]   = useState(false);
  const [hcMic,      setHcMic]      = useState(true);
  const [hcVideo,    setHcVideo]    = useState(true);
  const [hcScreen,   setHcScreen]   = useState(true);
  const [hcReact,    setHcReact]    = useState(true);
  const [isPiP,      setIsPiP]      = useState(false);

  const myColor = colorOf(myId.current || "self");
  const anyPanel = showChat||showPeople||showWB||showHost;

  /* Set local stream on both video elements (grid tile + pip overlay) */
  const setLocalSrc = useCallback((stream) => {
    if (localVidRef.current && localVidRef.current.srcObject !== stream)
      localVidRef.current.srcObject = stream;
    if (pipVidRef.current && pipVidRef.current.srcObject !== stream)
      pipVidRef.current.srcObject = stream;
  }, []);

  /* Broadcast our own mic/cam state to all peers */
  const broadcastState = useCallback((mic, cam) => {
    sockRef.current?.emit("peer-state", { micOn: mic, camOn: cam });
  }, []);

  /* ── Init ── */
  useEffect(()=>{ setScreenAvail(!!navigator.mediaDevices?.getDisplayMedia); },[]);
  useEffect(()=>{ chatEndRef.current?.scrollIntoView({behavior:"smooth"}); },[msgs]);
  useEffect(()=>{
    if (userData?.name) setUsername(userData.name);
    else if (userData?.username) setUsername(userData.username);
  },[userData]);

  /* ── Speaking detection (audio analyser poll) ── */
  useEffect(()=>{
    const id = setInterval(()=>{
      const buf = new Uint8Array(64);
      const next = new Set();
      for (const sid in analysers.current) {
        const { analyser } = analysers.current[sid];
        analyser.getByteFrequencyData(buf);
        if (buf.reduce((a,b)=>a+b,0)/buf.length > 10) next.add(sid);
      }
      setSpeaking(next);
    },150);
    return ()=>clearInterval(id);
  },[]);

  /* ── Full cleanup on unmount ── */
  useEffect(()=>{
    return ()=>{
      localStream.current?.getTracks().forEach(t=>t.stop());
      screenStrm.current?.getTracks().forEach(t=>t.stop());
      for (const {pc} of Object.values(peerMap.current)) pc.close();
      sockRef.current?.disconnect();
      clearInterval(meetTimer.current);
      clearInterval(recTimer.current);
      recogRef.current?.stop();
      for (const {ac} of Object.values(analysers.current)) ac?.close();
    };
  },[]);

  /* ══════════════════════════════════════════════
     PEER MANAGEMENT
  ══════════════════════════════════════════════ */
  const destroyPeer = useCallback((sid)=>{
    peerMap.current[sid]?.pc.close();
    delete peerMap.current[sid];
    analysers.current[sid]?.ac?.close();
    delete analysers.current[sid];
    delete namesMap.current[sid];
    setRemotes(p=>p.filter(r=>r.id!==sid));
  },[]);

  /**
   * createPeer — build RTCPeerConnection for one remote peer.
   * Uses addTrack() (not addStream), ontrack (not onaddstream).
   * Each peer gets its own dedicated MediaStream to receive into.
   */
  const createPeer = useCallback((sid)=>{
    if (peerMap.current[sid]) return peerMap.current[sid].pc;

    const pc = new RTCPeerConnection(PC_CONFIG);
    const remoteStream = new MediaStream();
    peerMap.current[sid] = { pc, stream: remoteStream };

    /* ICE */
    pc.onicecandidate = ev=>{
      if (ev.candidate)
        sockRef.current?.emit("signal", sid, JSON.stringify({ice:ev.candidate}));
    };

    /* Remote tracks arriving */
    pc.ontrack = ev=>{
      const track = ev.track;
      if (!remoteStream.getTrackById(track.id)) remoteStream.addTrack(track);

      const name  = namesMap.current[sid] || sid.slice(0,6);
      const color = colorOf(sid);

      setRemotes(prev=>{
        const idx = prev.findIndex(r=>r.id===sid);
        if (idx>=0) {
          // update name/stream in place — don't create new object if same stream
          const upd = [...prev];
          upd[idx] = {...upd[idx], name, color, stream:remoteStream};
          return upd;
        }
        return [...prev, {id:sid, name, color, stream:remoteStream}];
      });

      /* Audio analyser for speaking detection */
      if (track.kind==="audio" && !analysers.current[sid]) {
        try {
          const ac = new AudioContext();
          const src = ac.createMediaStreamSource(remoteStream);
          const analyser = ac.createAnalyser();
          analyser.fftSize = 512;
          src.connect(analyser);
          analysers.current[sid] = {ac, analyser};
        } catch {}
      }
    };

    pc.onconnectionstatechange = ()=>{
      if (["failed","disconnected","closed"].includes(pc.connectionState))
        destroyPeer(sid);
    };

    /* Add our local tracks to this new peer */
    const ls = localStream.current || makeDummy();
    ls.getTracks().forEach(track=>{
      /* If currently screen-sharing, send screen video instead of cam */
      if (track.kind==="video" && screenStrm.current) {
        const sv = screenStrm.current.getVideoTracks()[0];
        if (sv) { pc.addTrack(sv, ls); return; }
      }
      pc.addTrack(track, ls);
    });

    return pc;
  },[destroyPeer]);

  /* ══════════════════════════════════════════════
     SIGNAL HANDLER
  ══════════════════════════════════════════════ */
  const onSignal = useCallback((fromId, raw)=>{
    if (fromId===myId.current) return;
    const sig = JSON.parse(raw);
    // Ensure peer exists (handles out-of-order messages)
    const pc = peerMap.current[fromId]?.pc || createPeer(fromId);

    if (sig.sdp) {
      pc.setRemoteDescription(new RTCSessionDescription(sig.sdp))
        .then(()=>{
          if (sig.sdp.type==="offer") {
            return pc.createAnswer()
              .then(ans=>pc.setLocalDescription(ans))
              .then(()=>sockRef.current?.emit("signal", fromId, JSON.stringify({sdp:pc.localDescription})));
          }
        })
        .catch(console.warn);
    }
    if (sig.ice) {
      pc.addIceCandidate(new RTCIceCandidate(sig.ice)).catch(()=>{});
    }
  },[createPeer]);

  /* ══════════════════════════════════════════════
     SOCKET CONNECTION
  ══════════════════════════════════════════════ */
  const connectSocket = useCallback(()=>{
    const sock = io(server, {
      transports:["websocket","polling"],
      reconnectionAttempts: 5,
      timeout: 10000,
    });
    sockRef.current = sock;

    sock.on("connect",()=>{
      myId.current = sock.id;
      namesMap.current[sock.id] = username;
      setConn("connected");
      sock.emit("join-call", window.location.href, username);
      meetTimer.current = setInterval(()=>setMeetSec(s=>s+1),1000);
      // Broadcast our name after a short delay (room may not be ready yet)
      setTimeout(()=>sock.emit("user-name-broadcast", username), 400);
    });

    sock.on("you-are-host", ()=>setIsHost(true));

    /*
     * user-joined: server sends (newSocketId, allClientsArray, namesObject)
     * RULE: only the NEW JOINER creates offers.
     * Existing peers just build the RTCPeerConnection and wait for the offer.
     * This prevents the "double negotiation" blink.
     */
    sock.on("user-joined",(newId, clients, names)=>{
      // Merge names
      if (names) Object.entries(names).forEach(([sid,n])=>{ if(n) namesMap.current[sid]=n; });
      setPCount(clients.length);

      // Build peer connections for everyone except self
      clients.forEach(sid=>{
        if (sid===myId.current) return;
        createPeer(sid); // idempotent
      });

      // Only the new joiner sends offers
      if (newId===myId.current) {
        clients.forEach(sid=>{
          if (sid===myId.current) return;
          const pc = peerMap.current[sid]?.pc;
          if (!pc) return;
          pc.createOffer({offerToReceiveAudio:true,offerToReceiveVideo:true})
            .then(offer=>pc.setLocalDescription(offer))
            .then(()=>sock.emit("signal",sid,JSON.stringify({sdp:pc.localDescription})))
            .catch(console.warn);
        });
      }

      // Refresh names on existing remotes
      setRemotes(prev=>prev.map(r=>({
        ...r,
        name: namesMap.current[r.id]||r.name
      })));
    });

    sock.on("signal", onSignal);

    sock.on("user-left", sid=>{
      destroyPeer(sid);
      setPCount(c=>Math.max(1,c-1));
    });

    sock.on("participant-count", n=>setPCount(n));

    sock.on("user-name-receive",(sid,name)=>{
      if (!name) return;
      namesMap.current[sid]=name;
      setRemotes(prev=>prev.map(r=>r.id===sid?{...r,name}:r));
    });

    sock.on("chat-message",(data,sender)=>{
      setMsgs(p=>[...p,{sender,data,ts:Date.now()}]);
      setUnread(n=>n+1);
    });

    sock.on("host-mute-me",()=>{
      setMicOn(false);
      localStream.current?.getAudioTracks().forEach(t=>{t.enabled=false;});
    });
    sock.on("host-remove-me",()=>{
      localStream.current?.getTracks().forEach(t=>t.stop());
      sock.disconnect();
      window.location.href="/";
    });
    sock.on("waiting-join-request",(id,name)=>{
      setWaitList(p=>p.find(w=>w.id===id)?p:[...p,{id,name}]);
    });

    /* Reaction from remote peer */
    sock.on("receive-reaction",(fromId, emoji)=>{
      setPeerReacts(p=>({...p,[fromId]:emoji}));
      setTimeout(()=>setPeerReacts(p=>{ const n={...p}; delete n[fromId]; return n; }), 3000);
    });

    /* Hand raise from remote peer */
    sock.on("hand-raised",(fromId, isRaised)=>{
      setRaisedHands(p=>{ const n=new Set(p); isRaised?n.add(fromId):n.delete(fromId); return n; });
    });

    /* Remote peer mic/cam state */
    sock.on("peer-state-update",(fromId, state)=>{
      setPeerStates(p=>({...p,[fromId]:state}));
    });

    /* After connect, broadcast our initial state */
    setTimeout(()=>sock.emit("peer-state",{micOn:true,camOn:true}), 800);

    sock.on("disconnect", ()=>setConn("disconnected"));
    sock.on("connect_error",()=>setConn("error"));
  },[username, onSignal, createPeer, destroyPeer]);

  /* ══════════════════════════════════════════════
     LOBBY: preview camera before joining
  ══════════════════════════════════════════════ */
  useEffect(()=>{
    if (!lobby) return;
    navigator.mediaDevices.getUserMedia({video:true,audio:true})
      .then(s=>{
        localStream.current=s;
        if (localVidRef.current) localVidRef.current.srcObject=s;
      }).catch(()=>{});
    return ()=>{
      if (lobby) {
        localStream.current?.getTracks().forEach(t=>t.stop());
        localStream.current=null;
      }
    };
  // eslint-disable-next-line
  },[]);  // only on mount

  const handleJoin = async ()=>{
    if (!username.trim()) return;
    setLobby(false);
    // Stop lobby preview
    localStream.current?.getTracks().forEach(t=>t.stop());
    localStream.current=null;
    // Get proper media
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video:{width:{ideal:1280},height:{ideal:720},facingMode:"user"},
        audio:{echoCancellation:true,noiseSuppression:true,sampleRate:48000}
      });
      localStream.current=s;
      setLocalSrc(s);
      // Apply lobby toggles
      s.getVideoTracks().forEach(t=>{t.enabled=camOn;});
      s.getAudioTracks().forEach(t=>{t.enabled=micOn;});
    } catch {
      localStream.current=makeDummy();
      setLocalSrc(localStream.current);
    }
    connectSocket();
  };

  /* ══════════════════════════════════════════════
     CAM / MIC TOGGLE
     track.enabled — NO renegotiation, NO blink
  ══════════════════════════════════════════════ */
  const toggleCam = ()=>{
    const nv=!camOn; setCamOn(nv);
    localStream.current?.getVideoTracks().forEach(t=>{t.enabled=nv;});
    broadcastState(micOn, nv);
  };
  const toggleMic = ()=>{
    const nv=!micOn; setMicOn(nv);
    localStream.current?.getAudioTracks().forEach(t=>{t.enabled=nv;});
    broadcastState(nv, camOn);
  };

  /* ══════════════════════════════════════════════
     SCREEN SHARE
     replaceTrack() on each sender — one renegotiation,
     no stream teardown, minimal blink
  ══════════════════════════════════════════════ */
  const toggleScreen = async ()=>{
    if (screenOn) {
      screenStrm.current?.getTracks().forEach(t=>t.stop());
      screenStrm.current=null;
      setScreenOn(false);
      // Restore camera video track to all peers
      const camTrack = localStream.current?.getVideoTracks()[0];
      if (camTrack) {
        for (const {pc} of Object.values(peerMap.current)) {
          const sender = pc.getSenders().find(s=>s.track?.kind==="video");
          if (sender) sender.replaceTrack(camTrack).catch(()=>{});
        }
      }
      setLocalSrc(localStream.current);
    } else {
      try {
        const ss = await navigator.mediaDevices.getDisplayMedia({
          video:{cursor:"always",frameRate:{ideal:30,max:60}},
          audio:false
        });
        screenStrm.current=ss;
        setScreenOn(true);
        const st = ss.getVideoTracks()[0];
        // Replace on all existing peers
        for (const {pc} of Object.values(peerMap.current)) {
          const sender = pc.getSenders().find(s=>s.track?.kind==="video");
          if (sender) sender.replaceTrack(st).catch(()=>{});
        }
        setLocalSrc(ss);
        st.onended = ()=>{ if(screenOn||screenStrm.current) toggleScreen(); };
      } catch {}
    }
  };

  /* ── Captions ── */
  const toggleCC = ()=>{
    if (ccOn) {
      recogRef.current?.stop(); recogRef.current=null;
      setCcOn(false); setLiveCap("");
    } else {
      const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
      if (!SR) { alert("Live captions need Chrome."); return; }
      const r=new SR(); r.continuous=true; r.interimResults=true; r.lang="en-US";
      r.onresult=e=>{
        const txt=Array.from(e.results).map(x=>x[0].transcript).join(" ");
        setLiveCap(txt);
        if (e.results[e.results.length-1].isFinal) {
          setCaptLines(p=>[...p.slice(-3),{name:username,text:e.results[e.results.length-1][0].transcript}]);
          setTimeout(()=>setLiveCap(""),2500);
        }
      };
      r.onerror=()=>{}; r.start(); recogRef.current=r; setCcOn(true);
    }
  };

  /* ── Recording ── */
  const toggleRec = async ()=>{
    if (isRec) {
      mediaRec.current?.stop(); mediaRec.current=null;
      clearInterval(recTimer.current); setIsRec(false);
    } else {
      try {
        let rs;
        try { rs=await navigator.mediaDevices.getDisplayMedia({video:{displaySurface:"browser"},audio:true,preferCurrentTab:true}); }
        catch { rs=localStream.current||makeDummy(); }
        recChunks.current=[];
        const mime=MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")?"video/webm;codecs=vp9,opus":"video/webm";
        const mr=new MediaRecorder(rs,{mimeType:mime});
        mr.ondataavailable=e=>{ if(e.data.size>0) recChunks.current.push(e.data); };
        mr.onstop=()=>{
          const blob=new Blob(recChunks.current,{type:mime});
          const a=Object.assign(document.createElement("a"),{href:URL.createObjectURL(blob),download:`MeetSpace-${new Date().toISOString().slice(0,19)}.webm`});
          a.click(); setRecSec(0);
        };
        rs.getVideoTracks()[0]?.addEventListener("ended",()=>{ mr.stop(); clearInterval(recTimer.current); setIsRec(false); });
        mr.start(1000); mediaRec.current=mr; setIsRec(true);
        recTimer.current=setInterval(()=>setRecSec(s=>s+1),1000);
      } catch(e){ alert("Recording failed: "+e.message); }
    }
  };

  /* ── PiP ── */
  const togglePiP = async ()=>{
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture(); setIsPiP(false);
      } else if (localVidRef.current) {
        // Make sure video is playing before requesting PiP
        if (localVidRef.current.readyState >= 2) {
          await localVidRef.current.requestPictureInPicture();
        } else {
          await new Promise(r=>localVidRef.current.addEventListener("canplay",r,{once:true}));
          await localVidRef.current.requestPictureInPicture();
        }
        setIsPiP(true);
        localVidRef.current.addEventListener("leavepictureinpicture",()=>setIsPiP(false),{once:true});
      }
    } catch(e){ console.warn("PiP failed:",e.message); }
  };

  /* ── Leave ── */
  const handleLeave = ()=>{
    if (isRec) { mediaRec.current?.stop(); }
    clearInterval(meetTimer.current); clearInterval(recTimer.current);
    localStream.current?.getTracks().forEach(t=>t.stop());
    screenStrm.current?.getTracks().forEach(t=>t.stop());
    recogRef.current?.stop();
    for (const {pc} of Object.values(peerMap.current)) pc.close();
    sockRef.current?.disconnect();
    window.location.href="/";
  };

  /* ── Chat ── */
  const sendMsg = ()=>{
    if (!msgDraft.trim()) return;
    sockRef.current?.emit("chat-message",msgDraft,username);
    setMsgs(p=>[...p,{sender:username,data:msgDraft,ts:Date.now(),self:true}]);
    setMsgDraft("");
  };

  /* ── Host actions ── */
  const mutePeer   = sid=>{ sockRef.current?.emit("host-mute-participant",sid); setMutedSet(s=>new Set([...s,sid])); };
  const kickPeer   = sid=>{ if(window.confirm("Remove this participant?")) sockRef.current?.emit("host-remove-participant",sid); };
  const approveW   = id=>{ sockRef.current?.emit("approve-waiting",id); setWaitList(p=>p.filter(w=>w.id!==id)); };
  const denyW      = id=>{ sockRef.current?.emit("deny-waiting",id);    setWaitList(p=>p.filter(w=>w.id!==id)); };

  /* ── Misc ── */
  const copyLink = ()=>{ navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(()=>setCopied(false),2000); };
  const sendEmoji = e=>{
    setFloatEmoji(e);
    setShowReacts(false);
    sockRef.current?.emit("send-reaction", e);
    setTimeout(()=>setFloatEmoji(null),3000);
  };

  const toggleHand = ()=>{
    const nv = !handUp;
    setHandUp(nv);
    sockRef.current?.emit("raise-hand", nv);
  };

  /* ── Grid columns ── */
  const total = remotes.length+1;
  const cols  = total<=1?1:total<=2?2:total<=4?2:total<=9?3:4;

  /* ══════════════════════════════════════════════
     LOBBY
  ══════════════════════════════════════════════ */
  if (lobby) return (
    <div className={styles.lobbyRoot}>
      <div className={styles.lobbyOrb1}/><div className={styles.lobbyOrb2}/><div className={styles.lobbyGrid}/>
      <div className={styles.lobbyWrap}>
        <div className={styles.lobbyTopLine}/>
        {/* Camera preview side */}
        <div className={styles.lobbyCamSide}>
          {!camOn && (
            <div className={styles.lobbyCamOff}>
              <div className={styles.lobbyCamOffCircle}><Ico.CamOff/></div>
              <span>Camera is off</span>
            </div>
          )}
          <video ref={localVidRef} autoPlay muted playsInline className={styles.lobbyVideo}/>
          <div className={styles.lobbyNameTag}>{username||"Your Name"}</div>
          <div className={styles.lobbyCamCtrls}>
            <button className={`${styles.lobbyCamCtrl} ${!camOn?styles.lobbyCamCtrlOff:""}`}
              onClick={()=>{
                const nv=!camOn; setCamOn(nv);
                localStream.current?.getVideoTracks().forEach(t=>{t.enabled=nv;});
              }}>
              <div className={styles.lobbyCtrlIconBox}>{camOn?<Ico.Cam/>:<Ico.CamOff/>}</div>
              <span>{camOn?"Camera on":"Camera off"}</span>
            </button>
            <button className={`${styles.lobbyCamCtrl} ${!micOn?styles.lobbyCamCtrlOff:""}`}
              onClick={()=>{
                const nv=!micOn; setMicOn(nv);
                localStream.current?.getAudioTracks().forEach(t=>{t.enabled=nv;});
              }}>
              <div className={styles.lobbyCtrlIconBox}>{micOn?<Ico.Mic/>:<Ico.MicOff/>}</div>
              <span>{micOn?"Mic on":"Mic off"}</span>
            </button>
          </div>
        </div>
        {/* Form side */}
        <div className={styles.lobbyFormSide}>
          <div className={styles.lobbyBrand}>
            <div className={styles.lobbyBrandIcon}><Ico.Logo/></div>
            <span className={styles.lobbyBrandName}>MeetSpace</span>
          </div>
          <h2 className={styles.lobbyTitle}>Ready to join?</h2>
          <p className={styles.lobbySub}>Check your camera and mic before joining</p>
          <div className={styles.lobbyRoomChip}>
            <span className={styles.lobbyRoomLabel}>Room</span>
            <span className={styles.lobbyRoomCode}>{roomId}</span>
          </div>
          <div className={styles.lobbyLinkBox}>
            <span className={styles.lobbyLinkText}>{window.location.href}</span>
            <button className={styles.lobbyLinkCopy} onClick={copyLink}>{copied?"Copied!":"Copy"}</button>
          </div>
          <input className={styles.lobbyInput} type="text" placeholder="Enter your display name"
            value={username} onChange={e=>setUsername(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&handleJoin()} autoFocus/>
          <button className={styles.lobbyJoinBtn} onClick={handleJoin} disabled={!username.trim()}>
            <span>Join Now</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            <div className={styles.lobbyJoinShine}/>
          </button>
          <div className={styles.lobbyHint}><div className={styles.lobbyHintDot}/><span>Only visible to meeting participants</span></div>
        </div>
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════
     MEETING ROOM
  ══════════════════════════════════════════════ */
  return (
    <div className={styles.meetRoot}>

      {/* ── HEADER ── */}
      <header className={styles.meetHeader}>
        <div className={styles.meetHeaderL}>
          <div className={styles.meetLogoBox}><Ico.Logo/></div>
          <span className={styles.meetLogoText}>MeetSpace</span>
          <button className={styles.meetCodeBtn} onClick={copyLink} title="Copy link">
            <span>{roomId}</span>
            <span className={styles.meetCodeIco}>{copied?<Ico.Check/>:<Ico.Copy/>}</span>
          </button>
          <LiveClock/>
          <span className={styles.meetTimer}>{fmtSecs(meetSec)}</span>
          {isRec && (
            <div className={styles.recIndicator}>
              <div className={styles.recDot}/>
              <span>REC {fmtSecs(recSec)}</span>
            </div>
          )}
        </div>
        <div className={styles.meetHeaderR}>
          {handUp && <span className={styles.hBadge} style={{color:"#f59e0b",borderColor:"#f59e0b40",background:"#f59e0b12"}}>✋ Hand Raised</span>}
          {isHost && <span className={styles.hBadge} style={{color:"#4f8ef7",borderColor:"#4f8ef740",background:"#4f8ef712"}}>👑 Host</span>}
          {waitList.length>0 && (
            <button className={styles.waitingBadge} onClick={()=>setShowWait(true)}>
              <Ico.Wait/> {waitList.length} waiting
            </button>
          )}
          <button className={`${styles.hIconBtn} ${isPiP?styles.hIconBtnOn:""}`} onClick={togglePiP} title="Picture-in-Picture">
            <Ico.PiP/>
          </button>
          <button className={`${styles.hPeopleBtn} ${showPeople?styles.hPeopleBtnOn:""}`}
            onClick={()=>{ setShowPeople(p=>!p); setShowChat(false); setShowHost(false); setShowWB(false); }}>
            <span className={styles.hPeopleIco}><Ico.People/></span>
            <span className={styles.hPeopleCount}>{pCount}</span>
          </button>
          <div className={`${styles.connDot} ${conn==="connected"?styles.connOn:styles.connOff}`}/>
        </div>
      </header>

      {/* ── BODY ── */}
      <div className={styles.meetBody}>
        <div className={`${styles.meetVideoArea} ${anyPanel?styles.meetVideoAreaShrunk:""}`}>

          {/* Floating emoji reaction */}
          {floatEmoji && <div className={styles.floatReact}>{floatEmoji}</div>}

          {/* Live captions */}
          {ccOn && (captLines.length>0||liveCap) && (
            <div className={styles.captionsBar}>
              {captLines.slice(-2).map((c,i)=>(
                <div key={i} className={styles.captionRow}>
                  <span className={styles.captionSpeaker}>{c.name}:</span> {c.text}
                </div>
              ))}
              {liveCap && (
                <div className={styles.captionLive}>
                  <span className={styles.captionSpeaker}>{username}:</span> {liveCap}
                  <span className={styles.captionCursor}>|</span>
                </div>
              )}
            </div>
          )}

          {/* ── WAITING STATE (no remotes yet) ── */}
          {remotes.length===0 ? (
            <div className={styles.waitingWrap}>
              {/* Self preview while waiting */}
              <div style={{position:"relative",width:300,height:188,borderRadius:14,overflow:"hidden",background:"#0d1020",border:"1.5px solid rgba(255,255,255,0.08)",marginBottom:8}}>
                <video ref={localVidRef} autoPlay muted playsInline
                  style={{
                    width:"100%",height:"100%",objectFit:"cover",
                    transform: screenOn ? "none" : "scaleX(-1)",
                    display: (camOn || screenOn) ? "block" : "none"
                  }}/>
                {!camOn && !screenOn && (
                  <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <div style={{width:56,height:56,borderRadius:"50%",background:myColor,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,color:"#fff"}}>
                      {initials(username)}
                    </div>
                  </div>
                )}
                <div style={{position:"absolute",bottom:8,left:10,background:"rgba(0,0,0,0.6)",padding:"3px 10px",borderRadius:20,fontSize:12,color:"#e8eaed"}}>{username} (You)</div>
              </div>
              <div className={styles.waitingRing}><div className={styles.waitingRing2}><div className={styles.waitingRing3}>
                <div className={styles.waitingCenter}><Ico.People/></div>
              </div></div></div>
              <h3 className={styles.waitingTitle}>Waiting for others to join...</h3>
              <p className={styles.waitingSub}>Share the link to invite participants</p>
              <div className={styles.waitingLinkRow}>
                <span className={styles.waitingLinkVal}>{window.location.href}</span>
                <button className={styles.waitingCopyBtn} onClick={copyLink}>{copied?"✓ Copied":"Copy Link"}</button>
              </div>
            </div>
          ) : (
            /* ── VIDEO GRID ── */
            <div className={styles.videoGrid} style={{
              gridTemplateColumns:`repeat(${cols},1fr)`,
              position:"absolute", inset:10,
            }}>
              {/* Self tile */}
              <div className={styles.videoTile} style={{"--tc":myColor}}>
                <video ref={localVidRef} autoPlay muted playsInline className={styles.tileVideo}
                  style={{
                    transform: screenOn ? "none" : "scaleX(-1)",
                    display: (camOn || screenOn) ? "block" : "none"
                  }}/>
                {!camOn && !screenOn && (
                  <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#0d1020"}}>
                    <div style={{width:56,height:56,borderRadius:"50%",background:myColor,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,color:"#fff"}}>
                      {initials(username)}
                    </div>
                  </div>
                )}
                <div className={styles.tileBorder} style={{borderColor:myColor+"33"}}/>
                <div className={styles.tileBottom}>
                  <div className={styles.tileName} style={{background:myColor+"22",borderColor:myColor+"55"}}>
                    <div className={styles.tileInitials} style={{background:myColor}}>{initials(username)}</div>
                    <span style={{color:myColor}}>{username} (You)</span>
                  </div>
                  {!micOn && <div style={{width:16,height:16,color:"#ea4335",display:"flex"}}><Ico.MicOff/></div>}
                </div>
              </div>

              {/* Remote tiles */}
              {remotes.map(r=>(
                <RemoteVideo
                  key={r.id}
                  peerId={r.id}
                  stream={r.stream}
                  name={namesMap.current[r.id]||r.name||r.id.slice(0,6)}
                  color={r.color}
                  isSpeaking={speaking.has(r.id)}
                  isMuted={mutedSet.has(r.id)}
                  reaction={peerReacts[r.id]||null}
                  handRaised={raisedHands.has(r.id)}
                />
              ))}
            </div>
          )}

          {/* Local PiP overlay — only when others are present */}
          {remotes.length>0 && (
            <div className={styles.localPip}>
              {!camOn && !screenOn && (
                <div className={styles.pipOff}>
                  <div className={styles.pipAvatar} style={{background:myColor}}>{initials(username)}</div>
                </div>
              )}
              <video ref={pipVidRef} autoPlay muted playsInline className={styles.pipVideo}
                style={{transform: screenOn ? "none" : "scaleX(-1)"}}/>
              <div className={styles.pipBar}>
                <div className={styles.pipNameRow}>
                  <div className={styles.pipDot} style={{background:myColor}}/>
                  <span style={{fontSize:11,fontWeight:600,color:"#e8eaed"}}>{username}</span>
                </div>
                {!micOn && <div className={styles.pipMicOff}><Ico.MicOff/></div>}
              </div>
            </div>
          )}

          {/* Reaction picker */}
          {showReacts && (
            <div className={styles.reactPicker}>
              {["👍","❤️","😂","😮","👏","🎉","🔥","💯"].map(e=>(
                <button key={e} className={styles.reactPickerBtn} onClick={()=>sendEmoji(e)}>{e}</button>
              ))}
            </div>
          )}
        </div>

        {/* ── SIDE PANELS ── */}

        {/* Participants */}
        {showPeople && (
          <div className={styles.sidePanel}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>Participants ({pCount})</span>
              <button className={styles.panelClose} onClick={()=>setShowPeople(false)}><Ico.Close/></button>
            </div>
            <div className={styles.panelBody}>
              {/* Self row */}
              <div className={styles.pRow}>
                <div className={styles.pAv} style={{background:myColor}}>{initials(username)}</div>
                <div className={styles.pInfo}>
                  <span className={styles.pName}>{username}
                    <span className={styles.pTag}>You{isHost?" · Host":""}</span>
                  </span>
                </div>
                <div className={styles.pIcons}>
                  <span style={{color:micOn?"#34a853":"#ea4335",width:16,height:16,display:"flex"}}>
                    {micOn?<Ico.Mic/>:<Ico.MicOff/>}
                  </span>
                  <span style={{color:camOn?"#34a853":"#ea4335",width:16,height:16,display:"flex"}}>
                    {camOn?<Ico.Cam/>:<Ico.CamOff/>}
                  </span>
                </div>
              </div>
              {remotes.map(r=>{
                const n=namesMap.current[r.id]||r.name||r.id.slice(0,6);
                const muted=mutedSet.has(r.id);
                const rHand=raisedHands.has(r.id);
                // Use tracked socket state (updates in real-time via peer-state event)
                const ps = peerStates[r.id];
                const remoteMicOn  = ps ? ps.micOn  : true;  // default assume on until told otherwise
                const remoteCamOn2 = ps ? ps.camOn  : true;
                return (
                  <div key={r.id} className={styles.pRow}>
                    <div className={styles.pAv} style={{background:r.color}}>{initials(n)}</div>
                    <div className={styles.pInfo}>
                      <span className={styles.pName}>{n} {rHand && "✋"}</span>
                      {muted && <span className={styles.pMutedTag}>Muted by host</span>}
                    </div>
                    <div className={styles.pIcons}>
                      <span style={{color:(!remoteMicOn||muted)?"#ea4335":"#9aa0a6",width:16,height:16,display:"flex"}}>
                        {(!remoteMicOn||muted)?<Ico.MicOff/>:<Ico.Mic/>}
                      </span>
                      <span style={{color:remoteCamOn2?"#9aa0a6":"#ea4335",width:16,height:16,display:"flex"}}>
                        {remoteCamOn2?<Ico.Cam/>:<Ico.CamOff/>}
                      </span>
                    </div>
                    {isHost && (
                      <div className={styles.pHostActions}>
                        <button title="Mute" disabled={muted}
                          className={`${styles.pActionBtn} ${muted?styles.pActionBtnDim:""}`}
                          onClick={()=>mutePeer(r.id)}><Ico.MuteP/>
                        </button>
                        <button title="Remove"
                          className={`${styles.pActionBtn} ${styles.pActionBtnRed}`}
                          onClick={()=>kickPeer(r.id)}><Ico.Remove/>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {remotes.length===0 && <p className={styles.panelEmpty}>No other participants yet. Share the meeting link.</p>}
            </div>
          </div>
        )}

        {/* Chat */}
        {showChat && (
          <div className={styles.sidePanel}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>In-call messages</span>
              <button className={styles.panelClose} onClick={()=>setShowChat(false)}><Ico.Close/></button>
            </div>
            <div className={styles.chatMsgs}>
              {msgs.length===0 && (
                <div className={styles.chatEmpty}>
                  <div className={styles.chatEmptyIco}><Ico.Chat/></div>
                  <p>No messages yet</p>
                  <span>Messages visible to everyone in this call</span>
                </div>
              )}
              {msgs.map((m,i)=>{
                const self=m.self||(m.sender===username);
                const col=self?myColor:colorOf(m.sender);
                return (
                  <div key={i} className={`${styles.chatMsgRow} ${self?styles.chatMsgRowSelf:""}`}>
                    {!self && <div className={styles.chatAv} style={{background:col}}>{initials(m.sender)}</div>}
                    <div className={styles.chatBubbleGroup}>
                      {!self && <span className={styles.chatSender} style={{color:col}}>{m.sender}</span>}
                      <div className={`${styles.chatBubble} ${self?styles.chatBubbleSelf:""}`}>{m.data}</div>
                      <span className={styles.chatTs}>{new Date(m.ts).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef}/>
            </div>
            <div className={styles.chatInputRow}>
              <input className={styles.chatInput} value={msgDraft}
                onChange={e=>setMsgDraft(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendMsg()}
                placeholder="Send a message to everyone"/>
              <button className={styles.chatSendBtn} onClick={sendMsg} disabled={!msgDraft.trim()}>
                <Ico.Send/>
              </button>
            </div>
          </div>
        )}

        {/* Host Controls */}
        {showHost && (
          <div className={styles.sidePanel}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>Host controls</span>
              <button className={styles.panelClose} onClick={()=>setShowHost(false)}><Ico.Close/></button>
            </div>
            <div className={styles.panelBody}>
              <p className={styles.hostDesc}>Control what participants can do in this meeting. Only you can see this.</p>
              <div className={styles.hostSectionLabel}>LET PARTICIPANTS</div>
              {[
                {label:"Share their screen",        val:hcScreen, set:setHcScreen},
                {label:"Send reactions",            val:hcReact,  set:setHcReact},
                {label:"Turn on their microphone",  val:hcMic,    set:setHcMic},
                {label:"Turn on their video",       val:hcVideo,  set:setHcVideo},
              ].map((item,i)=>(
                <div key={i} className={styles.hostRow}>
                  <div className={styles.hostRowL}>
                    <span className={styles.hostRowLabel}>{item.label}</span>
                  </div>
                  <Toggle on={item.val} onChange={()=>item.set(p=>!p)}/>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Whiteboard */}
        {showWB && (
          <div className={styles.sidePanel} style={{width:440}}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>🖊 Shared Whiteboard</span>
              <button className={styles.panelClose} onClick={()=>setShowWB(false)}><Ico.Close/></button>
            </div>
            <Whiteboard roomId={roomId} socket={sockRef.current}/>
          </div>
        )}
      </div>

      {/* ── WAITING ROOM MODAL ── */}
      {showWait && waitList.length>0 && (
        <div className={styles.waitingModal}>
          <div className={styles.waitingModalBox}>
            <div className={styles.waitingModalHead}>
              <span>Waiting Room</span>
              <button className={styles.panelClose} onClick={()=>setShowWait(false)}><Ico.Close/></button>
            </div>
            <p className={styles.waitingModalSub}>{waitList.length} participant(s) waiting to join</p>
            {waitList.map(w=>(
              <div key={w.id} className={styles.waitingPersonRow}>
                <div className={styles.pAv} style={{background:colorOf(w.name)}}>{initials(w.name)}</div>
                <span className={styles.waitingName}>{w.name}</span>
                <button className={styles.waitApproveBtn} onClick={()=>approveW(w.id)}>Admit</button>
                <button className={styles.waitDenyBtn}    onClick={()=>denyW(w.id)}>Deny</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CONTROLS BAR ── */}
      <div className={styles.ctrlBar}>
        <div className={styles.ctrlGroup}>
          <button onClick={toggleCam} title={camOn?"Turn off camera":"Turn on camera"}
            className={`${styles.ctrl} ${!camOn?styles.ctrlOff:""}`}>
            <span className={styles.ctrlIco}>{camOn?<Ico.Cam/>:<Ico.CamOff/>}</span>
            <span className={styles.ctrlLbl}>{camOn?"Camera":"Cam off"}</span>
          </button>
          <button onClick={toggleMic} title={micOn?"Mute":"Unmute"}
            className={`${styles.ctrl} ${!micOn?styles.ctrlOff:""}`}>
            <span className={styles.ctrlIco}>{micOn?<Ico.Mic/>:<Ico.MicOff/>}</span>
            <span className={styles.ctrlLbl}>{micOn?"Mic":"Muted"}</span>
          </button>
          <button onClick={toggleRec} title={isRec?"Stop recording":"Record meeting"}
            className={`${styles.ctrl} ${isRec?styles.ctrlRec:""}`}>
            <span className={styles.ctrlIco}>{isRec?<Ico.RecStop/>:<Ico.Rec/>}</span>
            <span className={styles.ctrlLbl}>{isRec?fmtSecs(recSec):"Record"}</span>
          </button>
        </div>

        {/* Centre: leave */}

        <div className={styles.ctrlCenter}>
          <button onClick={handleLeave} className={styles.ctrlEnd} title="Leave call">
            <span className={styles.ctrlIco}><Ico.Phone/></span>
            <span className={styles.ctrlLbl}>Leave</span>
          </button>
        </div>

        {/* Right: tools */}
        <div className={styles.ctrlGroup}>
          <button onClick={()=>{setShowWB(p=>!p);setShowChat(false);setShowPeople(false);setShowHost(false);}}
            className={`${styles.ctrl} ${showWB?styles.ctrlActive:""}`} title="Whiteboard">
            <span className={styles.ctrlIco}><Ico.Board/></span>
            <span className={styles.ctrlLbl}>Board</span>
          </button>
          {screenAvail && (
            <button onClick={toggleScreen}
              className={`${styles.ctrl} ${screenOn?styles.ctrlActive:""}`}
              title={screenOn?"Stop sharing":"Share screen"}>
              <span className={styles.ctrlIco}><Ico.Screen/></span>
              <span className={styles.ctrlLbl}>{screenOn?"Stop":"Screen"}</span>
            </button>
          )}
          <button onClick={()=>setShowReacts(p=>!p)}
            className={`${styles.ctrl} ${showReacts?styles.ctrlActive:""}`} title="Reactions">
            <span className={styles.ctrlIco}><Ico.React/></span>
            <span className={styles.ctrlLbl}>React</span>
          </button>
          <button onClick={toggleHand}
            className={`${styles.ctrl} ${handUp?styles.ctrlActive:""}`}
            title={handUp?"Lower hand":"Raise hand"}>
            <span className={styles.ctrlIco}><Ico.Hand/></span>
            <span className={styles.ctrlLbl}>{handUp?"Lower":"Raise"}</span>
          </button>
          <button onClick={toggleCC}
            className={`${styles.ctrl} ${ccOn?styles.ctrlActive:""}`} title="Live captions">
            <span className={styles.ctrlIco}><Ico.CC/></span>
            <span className={styles.ctrlLbl}>CC</span>
          </button>
          {isHost && (
            <button onClick={()=>{setShowHost(p=>!p);setShowChat(false);setShowPeople(false);setShowWB(false);}}
              className={`${styles.ctrl} ${showHost?styles.ctrlActive:""}`} title="Host controls">
              <span className={styles.ctrlIco}><Ico.Shield/></span>
              <span className={styles.ctrlLbl}>Controls</span>
            </button>
          )}
          <button onClick={()=>{setShowChat(p=>!p);setUnread(0);setShowPeople(false);setShowHost(false);setShowWB(false);}}
            className={`${styles.ctrl} ${showChat?styles.ctrlActive:""}`} title="Chat">
            <span className={styles.ctrlIco}><Ico.Chat/></span>
            {unread>0 && !showChat && <span className={styles.ctrlBadge}>{unread}</span>}
            <span className={styles.ctrlLbl}>Chat</span>
          </button>
        </div>
      </div>
    </div>
  );
}