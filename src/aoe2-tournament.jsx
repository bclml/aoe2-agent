import { useState, useEffect, useCallback, useRef } from "react";

// ── PALETTE ────────────────────────────────────────────────────────────────────
const C = {
  obsidian:"#0E0B06", forge:"#1C1508", parch:"#251A09", stone:"#3A2E1A",
  dim:"#8A7A5A", light:"#D8C89A", gold:"#C8A84A",
  ember:"#8B2A0A", moss:"#2A5218", steel:"#2A4060", purple:"#4A2070",
  teal:"#1A5050", blue:"#1A3A5A",
};

// ── GLOBAL UX POLISH (pure CSS — no behavior changes) ──────────────────────────
// Injected once per top-level view via <style>. Every rule here is purely
// cosmetic: hover/focus feedback, smoother transitions, themed scrollbars,
// and a mobile-responsive collapse for the grid layouts already used
// throughout the app. Nothing here touches state, data, or event handlers.
const GLOBAL_CSS = `
  *{ box-sizing:border-box; }
  ::selection{ background:${C.gold}55; color:${C.light}; }
  ::-webkit-scrollbar{ width:10px; height:10px; }
  ::-webkit-scrollbar-track{ background:${C.obsidian}; }
  ::-webkit-scrollbar-thumb{ background:${C.stone}; border-radius:6px; border:2px solid ${C.obsidian}; }
  ::-webkit-scrollbar-thumb:hover{ background:${C.gold}66; }

  button{ transition: transform .12s ease, filter .12s ease, box-shadow .12s ease, opacity .12s ease; }
  button:hover:not(:disabled){ filter:brightness(1.10); transform:translateY(-1px); }
  button:active:not(:disabled){ transform:translateY(0); filter:brightness(0.96); }
  button:disabled{ cursor:not-allowed; }

  a{ transition: filter .12s ease, transform .12s ease, border-color .15s ease; }
  a:hover{ filter:brightness(1.08); }

  input,select,textarea{ transition: border-color .15s ease, box-shadow .15s ease; }
  input:focus,select:focus,textarea:focus{
    border-color:${C.gold}99 !important;
    box-shadow:0 0 0 3px ${C.gold}22;
    outline:none;
  }

  .aoe2-card-link:hover{
    border-color:${C.gold}88 !important;
    transform:translateY(-2px);
    box-shadow:0 6px 18px #00000055;
  }

  @keyframes aoe2FadeIn{ from{opacity:0; transform:translateY(6px);} to{opacity:1; transform:translateY(0);} }
  .aoe2-fade-in{ animation:aoe2FadeIn .25s ease-out; }

  @keyframes aoe2ToastIn{ from{opacity:0; transform:translateX(16px);} to{opacity:1; transform:translateX(0);} }
  .aoe2-toast{ animation:aoe2ToastIn .2s ease-out; }

  @media (max-width: 680px){
    [style*="grid-template-columns: 1fr 1fr"],
    [style*="grid-template-columns:1fr 1fr"],
    [style*="grid-template-columns: 1fr auto 1fr"],
    [style*="grid-template-columns:1fr auto 1fr"],
    [style*="grid-template-columns: repeat(2,1fr)"],
    [style*="grid-template-columns:repeat(2,1fr)"],
    [style*="grid-template-columns: repeat(6,1fr)"],
    [style*="grid-template-columns:repeat(6,1fr)"]{
      grid-template-columns: 1fr !important;
    }
  }
`;

function GlobalStyle(){ return <style>{GLOBAL_CSS}</style>; }

// ── CONSTANTS ──────────────────────────────────────────────────────────────────
const TIMEZONES = [
  {label:"Pacific (PT)",   value:"America/Vancouver", abbr:"PT"  },
  {label:"Mountain (MT)",  value:"America/Denver",    abbr:"MT"  },
  {label:"Central (CT)",   value:"America/Chicago",   abbr:"CT"  },
  {label:"Eastern (ET)",   value:"America/Toronto",   abbr:"ET"  },
  {label:"UK (GMT/BST)",   value:"Europe/London",     abbr:"GMT" },
  {label:"Central EU",     value:"Europe/Paris",      abbr:"CET" },
  {label:"Eastern EU",     value:"Europe/Athens",     abbr:"EET" },
  {label:"China (CST)",    value:"Asia/Shanghai",     abbr:"CST" },
  {label:"Japan (JST)",    value:"Asia/Tokyo",        abbr:"JST" },
  {label:"Australia East", value:"Australia/Sydney",  abbr:"AEST"},
];

const MAPS = ["Arabia","Arena","Black Forest","Four Lakes","Gold Rush","Highland",
  "Islands","Mediterranean","Mongolia","Nomad","Rivers","Team Islands","Acropolis",
  "Baltic","Budapest","Cenotes","Continental","Crater Lake","Fortress","Ghost Lake",
  "Kilimanjaro","King of the Hill","Lombardia","Megarandom","Mountain Pass","Oasis",
  "Scandinavia","Serengeti","Socotra","Steppe","Valley","Yucatan"];
const RESOURCES  = ["Standard","High Resources","Ultra High Resources","Low Resources"];
const SPEEDS     = ["Normal","Fast","Fastest"];
const GAME_MODES = ["Random Map","Death Match","Regicide","King of the Hill","Wonder Race"];
const MAP_SIZES  = ["Tiny (2p)","Small (3p)","Medium (4p)","Normal (6p)","Large (8p)","Gigantic"];
const CIVS = ["Any (Random)","Armenians","Aztecs","Bengalis","Berbers","Bohemians","Britons",
  "Bulgarians","Burgundians","Burmese","Byzantines","Celts","Chinese","Cumans","Dravidians",
  "Ethiopians","Franks","Georgians","Goths","Gurjaras","Hindustanis","Huns","Incas","Italians",
  "Japanese","Jurchens","Khitans","Khmer","Koreans","Lithuanians","Magyars","Malay","Malians",
  "Mapuche","Mayans","Mongols","Muisca","Persians","Poles","Portuguese","Romans","Saracens",
  "Shu","Sicilians","Slavs","Spanish","Tatars","Teutons","Turks","Tupi","Vietnamese","Vikings",
  "Wei","Wu"];

const STORAGE_KEY    = "aoe2_v5_master";
const SUPER_PW_KEY   = "aoe2_v5_superpw";
const SUPER_DEFAULT  = "Wireless";

// ── JSONBIN CLOUD STORAGE ──────────────────────────────────────────────────
// JSONBin.io free tier — stores JSON data in the cloud, accessible from any browser
// Players/admins on ANY device see the same tournaments
// Set VITE_JSONBIN_KEY and VITE_JSONBIN_BIN in Railway environment variables
const JSONBIN_KEY = import.meta.env?.VITE_JSONBIN_KEY || null;
const JSONBIN_BIN = import.meta.env?.VITE_JSONBIN_BIN || null;
const JSONBIN_URL = JSONBIN_BIN ? `https://api.jsonbin.io/v3/b/${JSONBIN_BIN}` : null;

let _saveDebounce = null;
let _pendingCloudData = null;

async function cloudLoad() {
  if (!JSONBIN_KEY || !JSONBIN_URL) return null;
  try {
    const r = await fetch(`${JSONBIN_URL}/latest`, {
      headers: { "X-Master-Key": JSONBIN_KEY, "X-Bin-Meta": "false" }
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function cloudPut(data){
  try {
    await fetch(JSONBIN_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Master-Key": JSONBIN_KEY },
      body: JSON.stringify(data),
      keepalive: true, // lets the request finish even if the page is being unloaded
    });
  } catch(e) { console.warn("Cloud save failed", e); }
}

function cloudSave(data) {
  if (!JSONBIN_KEY || !JSONBIN_URL) return;
  _pendingCloudData = data;
  clearTimeout(_saveDebounce);
  _saveDebounce = setTimeout(() => {
    const toSend=_pendingCloudData;
    _pendingCloudData=null;
    cloudPut(toSend);
  }, 600); // short debounce to avoid hammering the API while still saving promptly
}

// Flush any pending cloud save immediately — called on tab close/refresh so a
// quick refresh right after an edit can't lose that change.
function flushCloudSave(){
  if(_pendingCloudData){
    clearTimeout(_saveDebounce);
    const toSend=_pendingCloudData;
    _pendingCloudData=null;
    cloudPut(toSend);
  }
}
if(typeof window!=="undefined"){
  window.addEventListener("pagehide",flushCloudSave);
  window.addEventListener("beforeunload",flushCloudSave);
}
const PLACEMENT_GAMES = 5;
const SWISS_ROUNDS    = 7;
const TOP8_CUT        = 8;

// ── UTILS ──────────────────────────────────────────────────────────────────────
const uid    = () => Math.random().toString(36).slice(2,9).toUpperCase();
const nowStr = () => new Date().toLocaleTimeString();
const pwHash = pw => pw.split("").reduce((h,c)=>((h<<5)-h+c.charCodeAt(0))|0,0).toString(36);

function fmtDate(iso, tz="UTC"){
  if(!iso) return "—";
  try{ return new Date(iso).toLocaleString("en-CA",{timeZone:tz,
    weekday:"short",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit",timeZoneName:"short"}); }
  catch{ return iso; }
}

function getTierForElo(elo, tiers){
  return [...tiers].reverse().find(t=>elo>=t.min) || tiers[0];
}

function calcElo(myElo, oppElo, result, k=32){
  return Math.round(myElo + k*(result - 1/(1+Math.pow(10,(oppElo-myElo)/400))));
}

function makeLobbyName(prefix, round, p1, p2){
  const r = String(round).replace(/\D/g,"").padStart(2,"0");
  const a = (p1||"P1").replace(/\s/g,"").toUpperCase().slice(0,4);
  const b = (p2||"P2").replace(/\s/g,"").toUpperCase().slice(0,4);
  return `${(prefix||"AOE2").toUpperCase()}-R${r}-${a}v${b}`;
}
function makeLobbyPw(seed){
  const words=["sword","arrow","castle","knight","monk","siege","trade","farm","forge","stone","lance","vault"];
  const idx=Math.abs(seed.split("").reduce((h,c)=>((h<<5)-h+c.charCodeAt(0))|0,0))%words.length;
  const num=Math.abs((seed.charCodeAt(0)||1)*(seed.charCodeAt(1)||1))%90+10;
  return words[idx]+num;
}

function swissPair(players, prevMatches=[]){
  const rematches=new Set(prevMatches.map(m=>[m.p1,m.p2].sort().join("-")));
  const sorted=[...players].sort((a,b)=>
    b.swissWins!==a.swissWins?b.swissWins-a.swissWins:b.buchholz-a.buchholz||b.elo-a.elo);
  const paired=[],used=new Set();
  for(let i=0;i<sorted.length;i++){
    if(used.has(sorted[i].id)) continue;
    let found=false;
    for(let j=i+1;j<sorted.length;j++){
      if(used.has(sorted[j].id)) continue;
      const key=[sorted[i].id,sorted[j].id].sort().join("-");
      if(!rematches.has(key)){
        paired.push({id:uid(),p1:sorted[i].id,p2:sorted[j].id,
          winner:null,p1Reported:null,p2Reported:null,disputed:false,reported:false,
          vetoes:[],pickedMap:null,scheduledTime:null,
          lobbyName:"",lobbyPw:makeLobbyPw(uid()),
          spectatorDelay:10,recordingRequired:true,messages:[]});
        used.add(sorted[i].id);used.add(sorted[j].id);found=true;break;
      }
    }
    if(!found&&!used.has(sorted[i].id)){
      paired.push({id:uid(),p1:sorted[i].id,p2:"BYE",
        winner:sorted[i].id,p1Reported:"win",p2Reported:null,
        disputed:false,reported:true,vetoes:[],pickedMap:null,scheduledTime:null,
        lobbyName:"BYE",lobbyPw:"",spectatorDelay:10,recordingRequired:false,messages:[]});
      used.add(sorted[i].id);
    }
  }
  return paired;
}

function calcBuchholz(playerId, allPlayers, allMatches){
  return allMatches.filter(m=>m.p1===playerId||m.p2===playerId)
    .reduce((s,m)=>s+(allPlayers.find(p=>p.id===(m.p1===playerId?m.p2:m.p1))?.swissWins||0),0);
}

function buildTop8(players, lobbyPrefix){
  const seeded=[...players].sort((a,b)=>
    b.swissWins!==a.swissWins?b.swissWins-a.swissWins:b.buchholz-a.buchholz).slice(0,TOP8_CUT);
  while(seeded.length<8) seeded.push(null);
  const mk=(p1,p2,rnd,mi)=>({
    id:uid(),p1:p1?.id||null,p2:p2?.id||null,
    winner:null,p1Reported:null,p2Reported:null,disputed:false,reported:false,
    vetoes:[],pickedMap:null,scheduledTime:null,
    lobbyName:makeLobbyName(lobbyPrefix,`${rnd}${mi+1}`,p1?.name,p2?.name),
    lobbyPw:makeLobbyPw(uid()),spectatorDelay:10,recordingRequired:true,messages:[]
  });
  return [
    [mk(seeded[0],seeded[7],"QF",0),mk(seeded[3],seeded[4],"QF",1),
     mk(seeded[1],seeded[6],"QF",2),mk(seeded[2],seeded[5],"QF",3)],
    [mk(null,null,"SF",0),mk(null,null,"SF",1)],
    [mk(null,null,"GF",0)],
  ];
}

// ── TIME WINDOW SCHEDULER ─────────────────────────────────────────────────────
// Spreads matches evenly across admin-defined time windows.
// No timezone bias — windows are set by admin explicitly.
function buildSlots(windows, count){
  // windows: [{day:"sat",startHour:14,endHour:22}, ...]  (UTC)
  // Returns up to count ISO slot strings
  if(!windows||!windows.length){
    // No windows: just spread evenly — 2hr gaps starting from now+1h
    const base=Date.now()+3600000;
    return Array.from({length:count},(_,i)=>new Date(base+i*7200000).toISOString());
  }
  const DAY_MAP={sun:0,mon:1,tue:2,wed:3,thu:4,fri:5,sat:6};
  const slots=[];
  // Scan 60 days forward to fill enough slots
  const start=new Date();start.setUTCHours(0,0,0,0);
  for(let d=0;d<60&&slots.length<count*3;d++){
    const date=new Date(start.getTime()+d*86400000);
    const dow=date.getUTCDay();
    windows.forEach(w=>{
      if(DAY_MAP[w.day]!==dow) return;
      for(let h=w.startHour;h<w.endHour;h++){
        if(slots.length>=count*3) return;
        const slot=new Date(date);slot.setUTCHours(h,0,0,0);
        if(slot.getTime()>Date.now()+3600000) slots.push(slot.toISOString());
      }
    });
  }
  // Pick evenly spaced slots
  if(slots.length===0) return Array.from({length:count},(_,i)=>new Date(Date.now()+i*7200000+3600000).toISOString());
  const step=Math.max(1,Math.floor(slots.length/count));
  return Array.from({length:count},(_,i)=>slots[Math.min(i*step,slots.length-1)]);
}

function generatePlacementSchedule(players, placementGames, windows, lobbyPrefix, placementSettings){
  if(!players||players.length<2) return [];
  const matches=[];
  const playCount={};
  const rematches=new Set();
  players.forEach(p=>{playCount[p.id]=0;});
  let attempts=0;
  const shuffled=[...players].sort(()=>Math.random()-0.5);
  while(Object.values(playCount).some(c=>c<placementGames)&&attempts<20000){
    attempts++;
    const p1=shuffled.filter(p=>playCount[p.id]<placementGames)
      .sort((a,b)=>playCount[a.id]-playCount[b.id])[0];
    if(!p1) break;
    const candidates=shuffled.filter(p=>
      p.id!==p1.id&&playCount[p.id]<placementGames&&
      !rematches.has([p1.id,p.id].sort().join("-"))
    ).sort((a,b)=>(playCount[a.id]-playCount[b.id])*3+Math.abs(a.elo-p1.elo)*0.01-Math.abs(b.elo-p1.elo)*0.01);
    if(!candidates.length) break;
    const p2=candidates[0];
    rematches.add([p1.id,p2.id].sort().join("-"));
    playCount[p1.id]++;playCount[p2.id]++;
    matches.push({p1:p1.id,p2:p2.id});
  }
  const slots=buildSlots(windows,matches.length);
  return matches.map((m,i)=>{
    const p1=players.find(p=>p.id===m.p1);
    const p2=players.find(p=>p.id===m.p2);
    const id=uid();
    return{
      id,p1:m.p1,p2:m.p2,winner:null,
      p1Reported:null,p2Reported:null,disputed:false,reported:false,
      scheduledTime:slots[i]||null,
      lobbyName:makeLobbyName(lobbyPrefix||"PLC",`P${i+1}`,p1?.name,p2?.name),
      lobbyPw:makeLobbyPw(id),
      spectatorDelay:placementSettings?.spectatorDelay||10,
      recordingRequired:placementSettings?.recordingRequired!==false,
      pickedMap:null,isPlacement:true,messages:[],
    };
  });
}

// ── DEFAULT TEMPLATES ──────────────────────────────────────────────────────────
const DEFAULT_TIERS=[
  {id:"t1",name:"Bronze",  min:0,    max:499,  color:"#8B7355",icon:"🪨",prizeFee:0},
  {id:"t2",name:"Silver",  min:500,  max:799,  color:"#9A9A9A",icon:"⚔️",prizeFee:5},
  {id:"t3",name:"Gold",    min:800,  max:1099, color:"#C8A84A",icon:"🛡️",prizeFee:5},
  {id:"t4",name:"Diamond", min:1100, max:9999, color:"#6A9ACA",icon:"💎",prizeFee:10},
];
const DEFAULT_PLACEMENT_SETTINGS={
  map:"Random Map",resources:"Standard",speed:"Normal",
  gameMode:"Random Map",mapSize:"Normal (6p)",civs:"Any (Random)",
  spectatorDelay:10,recordingRequired:true,
  notes:"Standard 1v1 placement match. Random map selected by the game.",
};

// A Tournament object (one per Discord server / community)
function makeTournament(code, name, hostName){
  return{
    id:uid(),
    code:code.toUpperCase().replace(/\s/g,"-"),
    name, hostName,
    hostEmail:"",          // PayPal email for receiving prize fees — REQUIRED before launch
    adminPassword:pwHash("changeme"),
    adminPasswordPlain:"changeme",
    lobbyPrefix:code.toUpperCase().slice(0,6),
    season:{
      name:"Season 1",
      tiers:[...DEFAULT_TIERS.map(t=>({...t,id:uid(),prizeSplit:{first:60,second:25,third:15}}))],
      swissRounds:SWISS_ROUNDS,
      top8Cut:TOP8_CUT,
      placementGames:PLACEMENT_GAMES,
      adminFee:5,
      prizeFee:10,
      kickbackPercent:0,    // % of platform admin fee paid back to this tournament's host — set by platform organiser only
      feeNote:"",
      paymentInfo:"",
      registrationOpen:false,
      timeline:null,
      timeWindows:[],
      placementSettings:{...DEFAULT_PLACEMENT_SETTINGS},
    },
    players:[],
    bannedEmails:[],
    reports:[],
    placementMatches:[],
    tournaments:{},
    log:[],
    feeCollected:[],       // [{playerId,name,type,amount,paidAt}] — historical record, never reset
    kickbackPayouts:[],    // [{id,amount,paidAt,note}] — manual record of kickback paid out to host by platform admin
    createdAt:new Date().toISOString(),
  };
}

// ── MASTER STATE ───────────────────────────────────────────────────────────────
const DEFAULT_MASTER={
  tournaments:{},          // code -> Tournament object
  tournamentRequests:[],   // [{id,email,desiredName,desiredCode,hostName,message,status,createdAt,resolvedAt}]
  superAdminPassword:SUPER_DEFAULT,
  totalAdminFeesCollected:0,
  log:[],
};

// ── STYLES ─────────────────────────────────────────────────────────────────────
const S={
  btn:(v="gold",dis=false)=>({
    padding:"9px 18px",border:"none",borderRadius:6,
    cursor:dis?"not-allowed":"pointer",
    fontFamily:"Georgia,serif",fontSize:12,fontWeight:"bold",
    letterSpacing:1,textTransform:"uppercase",opacity:dis?.4:1,
    transition:"all .15s",
    background:v==="gold"?`linear-gradient(135deg,${C.gold},#A07830)`:
               v==="green"?C.moss:v==="red"?C.ember:v==="steel"?C.steel:
               v==="purple"?C.purple:v==="teal"?C.teal:C.stone,
    color:v==="gold"?C.obsidian:C.light,
    boxShadow:v==="gold"?`0 2px 10px ${C.gold}44`:"0 2px 8px #00000033",
  }),
  inp:{background:C.obsidian,border:`1px solid ${C.stone}`,color:C.light,
    padding:"9px 12px",borderRadius:6,fontFamily:"Georgia,serif",
    fontSize:13,width:"100%",boxSizing:"border-box",outline:"none",
    transition:"border-color .15s ease, box-shadow .15s ease"},
  lbl:{display:"block",color:C.dim,fontSize:11,letterSpacing:1,
       textTransform:"uppercase",marginBottom:5},
  card:{background:`linear-gradient(160deg,${C.parch},${C.forge})`,
    border:`1px solid ${C.gold}33`,borderRadius:10,padding:"22px",marginBottom:18,
    boxShadow:"0 4px 16px #00000038"},
  cardT:{color:C.gold,fontSize:14,fontWeight:"bold",letterSpacing:2,
    textTransform:"uppercase",marginBottom:14,
    borderBottom:`1px solid ${C.gold}22`,paddingBottom:8},
  badge:(c)=>({display:"inline-flex",alignItems:"center",gap:4,
    padding:"3px 10px",borderRadius:12,fontSize:11,fontWeight:"bold",letterSpacing:.3,
    background:c+"22",border:`1px solid ${c}55`,color:c}),
  grid:(cols,gap=14)=>({display:"grid",gridTemplateColumns:cols,gap}),
  row:(gap=12,align="center")=>({display:"flex",gap,alignItems:align}),
  modal:{position:"fixed",inset:0,background:"#000000B0",zIndex:300,
    display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(3px)"},
};

// ── LOBBY BOX ──────────────────────────────────────────────────────────────────
function LobbyBox({match,p1Name,p2Name,settings,isPlacement=false,maskPassword=false}){
  const [copied,setCopied]=useState("");
  const [revealed,setRevealed]=useState(false);
  const cp=(text,key)=>{navigator.clipboard.writeText(text);setCopied(key);setTimeout(()=>setCopied(""),2000);};
  if(!match||match.p2==="BYE"||!match.lobbyName||match.lobbyName==="BYE") return null;
  const s=settings||DEFAULT_PLACEMENT_SETTINGS;
  const showPw=!maskPassword||revealed;
  const info=`🏰 LOBBY: ${match.lobbyName}\n🔑 PASSWORD: ${match.lobbyPw}\n🗺️ Map: ${isPlacement?"Random Map":(match.pickedMap||s.map||"Arabia")}\n⚡ Speed: ${s.speed||"Normal"}\n💰 Resources: ${s.resources||"Standard"}\n⏱️ Spectator delay: ${match.spectatorDelay||10} min minimum\n🎥 Recording: ${match.recordingRequired?"REQUIRED":"Optional"}`;
  return(
    <div style={{background:C.obsidian,border:`2px solid ${C.gold}33`,borderRadius:8,padding:"14px",marginTop:10}}>
      <div style={{color:C.gold,fontSize:12,fontWeight:"bold",letterSpacing:1,marginBottom:10}}>🏰 GAME LOBBY{maskPassword&&!revealed?" — 🔒 Streaming Privacy":""}</div>
      <div style={S.grid("1fr 1fr",8)}>
        <div>
          <div style={{color:C.dim,fontSize:10,letterSpacing:1,marginBottom:3}}>LOBBY NAME</div>
          <div style={S.row(6)}>
            <span style={{fontFamily:"monospace",fontSize:12,color:C.light,background:C.stone,padding:"4px 8px",borderRadius:3}}>{match.lobbyName}</span>
            <button onClick={()=>cp(match.lobbyName,"name")} style={{...S.btn("stone"),padding:"3px 8px",fontSize:10}}>{copied==="name"?"✓":"📋"}</button>
          </div>
        </div>
        <div>
          <div style={{color:C.dim,fontSize:10,letterSpacing:1,marginBottom:3}}>LOBBY PASSWORD</div>
          <div style={S.row(6)}>
            {showPw?(
              <>
                <span style={{fontFamily:"monospace",fontSize:13,color:C.gold,background:C.stone,padding:"4px 8px",borderRadius:3}}>{match.lobbyPw}</span>
                <button onClick={()=>cp(match.lobbyPw,"pw")} style={{...S.btn("stone"),padding:"3px 8px",fontSize:10}}>{copied==="pw"?"✓":"📋"}</button>
              </>
            ):(
              <>
                <span style={{fontFamily:"monospace",fontSize:13,color:C.dim,background:C.stone,padding:"4px 8px",borderRadius:3,letterSpacing:2}}>••••••••</span>
                <button onClick={()=>setRevealed(true)} style={{...S.btn("steel"),padding:"3px 8px",fontSize:10}}>👁️ Reveal</button>
              </>
            )}
          </div>
        </div>
      </div>
      <div style={{marginTop:10,display:"flex",flexWrap:"wrap",gap:6}}>
        {[
          ["🗺️",isPlacement?"Random Map":(match.pickedMap||s.map||"Arabia")],
          ["⚡",s.speed||"Normal"],["💰",s.resources||"Standard"],
          ["⏱️",`${match.spectatorDelay||10}min spectator delay min`],
          ...(match.recordingRequired?[["🎥","Recording REQUIRED"]]:[]),
        ].map(([icon,val])=>(
          <span key={val} style={{...S.badge(C.steel),fontSize:10}}>{icon} {val}</span>
        ))}
      </div>
      <div style={{marginTop:10,color:C.dim,fontSize:11,lineHeight:1.6}}>
        <strong style={{color:C.light}}>{p1Name}</strong> creates the lobby.{" "}
        <strong style={{color:C.light}}>{p2Name}</strong> joins.
        Set spectator delay to <strong style={{color:C.gold}}>{match.spectatorDelay||10} minutes minimum</strong>.
        {match.recordingRequired&&<> <strong style={{color:C.gold}}>Both players must record the game.</strong></>}
      </div>
      {showPw&&(
        <button onClick={()=>cp(info,"full")} style={{...S.btn("gold"),fontSize:10,padding:"5px 12px",marginTop:8}}>
          {copied==="full"?"✓ Copied!":"📋 Copy Lobby Info"}
        </button>
      )}
    </div>
  );
}

// Reusable "Save Changes" bar shown at the bottom of editable settings panels.
// `dirty` controls whether the button is highlighted/enabled; shows a clear
// confirmation state once saved so the admin knows it actually stuck.
function SaveBar({dirty,onSave,label="Save Changes"}){
  return(
    <div style={{...S.row(12),marginTop:18,paddingTop:16,borderTop:`1px solid ${C.stone}`}}>
      <button style={S.btn(dirty?"gold":"stone",!dirty)} disabled={!dirty} onClick={onSave}>
        💾 {label}
      </button>
      <span style={{color:dirty?C.gold:C.dim,fontSize:12}}>
        {dirty?"● Unsaved changes":"✓ All changes saved"}
      </span>
    </div>
  );
}

// In-platform messaging between two matched opponents — replaces needing to
// coordinate over Discord. Messages persist with the match itself, so they're
// visible to both players whenever they check their portal.
function MatchChat({messages,currentPlayerId,opponentName,onSend}){
  const [text,setText]=useState("");
  const send=()=>{ if(text.trim()){ onSend(text); setText(""); } };
  return(
    <div style={{marginTop:10,background:C.obsidian,border:`1px solid ${C.stone}`,borderRadius:6,padding:"12px"}}>
      <div style={{color:C.gold,fontSize:11,fontWeight:"bold",letterSpacing:1,marginBottom:8}}>
        💬 MESSAGE {opponentName?.toUpperCase()||"OPPONENT"}
      </div>
      {(!messages||messages.length===0)?(
        <div style={{color:C.dim,fontSize:12,marginBottom:8}}>
          No messages yet — say hello or suggest a time to play!
        </div>
      ):(
        <div style={{maxHeight:180,overflowY:"auto",marginBottom:10,display:"flex",flexDirection:"column",gap:6,paddingRight:4}}>
          {messages.map(m=>{
            const mine=m.senderId===currentPlayerId;
            return(
              <div key={m.id} style={{
                alignSelf:mine?"flex-end":"flex-start",maxWidth:"82%",
                background:mine?C.gold+"22":C.steel+"33",
                border:`1px solid ${mine?C.gold:C.steel}55`,
                borderRadius:8,padding:"7px 10px",
              }}>
                <div style={{fontSize:10,color:C.dim,marginBottom:2}}>
                  {m.senderName} · {new Date(m.sentAt).toLocaleString([],{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}
                </div>
                <div style={{fontSize:13,color:C.light,wordBreak:"break-word"}}>{m.text}</div>
              </div>
            );
          })}
        </div>
      )}
      <div style={{display:"flex",gap:6}}>
        <input style={{...S.inp,flex:1}} placeholder="Type a message…" value={text}
          onChange={e=>setText(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter") send();}}/>
        <button style={{...S.btn("gold"),padding:"9px 16px"}} onClick={send} disabled={!text.trim()}>Send</button>
      </div>
      <div style={{color:C.dim,fontSize:10,marginTop:6}}>
        Messages save instantly. Your opponent may need to refresh their portal to see new ones.
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════════════════
export default function App(){
  // ── MASTER STATE ──────────────────────────────────────────────────────────
  const [master,setMaster] = useState(DEFAULT_MASTER);

  // ── ROUTING ───────────────────────────────────────────────────────────────
  // URL slug: /#/t/CODE  → player view for that tournament
  // /#/admin             → super-admin
  // /                    → landing page
  const [route,setRoute] = useState(()=>{
    const hash=window.location.hash||"";
    if(hash.startsWith("#/t/")) return {type:"tournament",code:hash.slice(4).toUpperCase()};
    if(hash.startsWith("#/admin")) return {type:"superadmin"};
    return {type:"landing"};
  });

  // Active tournament (resolved from route)
  const activeTournament = route.type==="tournament"
    ? master.tournaments[route.code]||null
    : null;

  // ── AUTH ──────────────────────────────────────────────────────────────────
  const [superUnlocked,setSuperUnlocked] = useState(false);
  const [superPwInput,setSuperPwInput]   = useState("");
  const [superPwError,setSuperPwError]   = useState(false);

  // Per-tournament admin auth
  const [tAdminUnlocked,setTAdminUnlocked] = useState(false);
  const [tAdminPwInput,setTAdminPwInput]   = useState("");
  const [tAdminPwError,setTAdminPwError]   = useState(false);

  // Player auth (per tournament)
  const [loggedInPlayer,setLoggedInPlayer] = useState(null);
  const [loginForm,setLoginForm]   = useState({email:"",password:""});
  const [loginError,setLoginError] = useState("");
  const [loginShowPw,setLoginShowPw] = useState(false);

  // ── TABS ──────────────────────────────────────────────────────────────────
  const [tab,setTab]           = useState("home");
  const [superTab,setSuperTab] = useState("dashboard");
  const [tAdminTab,setTAdminTab] = useState("season");
  const [portalTab,setPortalTab] = useState("dashboard");
  const [activeTier,setActiveTier] = useState(null);

  // ── EXPLICIT-SAVE DRAFTS ──────────────────────────────────────────────────
  // These tabs have several text/number inputs. Instead of persisting on every
  // keystroke, edits are held in local draft state and only written with saveTour
  // when the admin clicks the Save button — fewer writes, and a clear confirmation.
  const [seasonDraft,setSeasonDraft]       = useState(null);
  const [windowsDraft,setWindowsDraft]     = useState(null);
  const [placementDraft,setPlacementDraft] = useState(null);
  const [tiersDraft,setTiersDraft]         = useState(null);
  const [profileDraft,setProfileDraft]     = useState(null);
  const [pwChangeForm,setPwChangeForm]     = useState({newPw:"",confirmPw:""});

  // Sync the player's editable-profile draft only when a DIFFERENT player logs
  // in — not on every refresh of loggedInPlayer (which updates reactively as
  // match results, payments, etc. come in) so we don't clobber in-progress edits.
  useEffect(()=>{
    if(!loggedInPlayer){ setProfileDraft(null); return; }
    setProfileDraft({
      name:loggedInPlayer.name,
      discord:loggedInPlayer.discord,
      email:loggedInPlayer.email,
      civ:loggedInPlayer.civ,
      timezone:loggedInPlayer.timezone,
    });
  },[loggedInPlayer?.id]);

  // ── MODALS ────────────────────────────────────────────────────────────────
  const [toast,setToast]             = useState(null);
  const [streamPrivacy,setStreamPrivacy] = useState(false);
  const [disputeModal,setDisputeModal] = useState(null);
  const [reportModal,setReportModal]   = useState(null);
  const [changePwModal,setChangePwModal] = useState(null);
  const [kickbackPayoutModal,setKickbackPayoutModal] = useState(null); // {code, suggested}
  const [vetoMatch,setVetoMatch]       = useState(null);
  const [schedModal,setSchedModal]     = useState(null);
  const [newTourModal,setNewTourModal] = useState(false);
  const [contactModal,setContactModal] = useState(false);
  const [contactForm,setContactForm] = useState({email:"",desiredName:"",desiredCode:"",hostName:"",message:""});
  const [contactSent,setContactSent] = useState(false);
  const [newTourForm,setNewTourForm]   = useState({code:"",name:"",hostName:"",adminPassword:"",adminFee:5,kickbackPercent:0});
  const [regForm,setRegForm]           = useState({name:"",discord:"",email:"",password:"",confirmPw:"",civ:CIVS[0],startElo:800,timezone:TIMEZONES[0].value});
  const [showRegPw,setShowRegPw]       = useState(false);
  const [regSuccess,setRegSuccess]     = useState(false);

  // ── STORAGE ───────────────────────────────────────────────────────────────
  useEffect(()=>{
    const load=async()=>{
      try{
        // 1. Try cloud storage first (works across all browsers/devices)
        const cloud=await cloudLoad();
        if(cloud&&cloud.tournaments!==undefined){
          setMaster(cloud);
          try{localStorage.setItem(STORAGE_KEY,JSON.stringify(cloud));}catch{}
          return;
        }
        // 2. Fall back to localStorage (single browser)
        if(window.storage){
          const r=await window.storage.get(STORAGE_KEY).catch(()=>null);
          if(r?.value){setMaster(JSON.parse(r.value));return;}
        }
        const s=localStorage.getItem(STORAGE_KEY)||sessionStorage.getItem(STORAGE_KEY);
        if(s){
          const parsed=JSON.parse(s);
          setMaster(parsed);
          try{sessionStorage.setItem(STORAGE_KEY,s);}catch{}
        }
      }catch(e){console.warn("Load failed",e);}
    };
    load();
    const onHash=()=>{
      const hash=window.location.hash||"";
      if(hash.startsWith("#/t/")) setRoute({type:"tournament",code:hash.slice(4).toUpperCase()});
      else if(hash.startsWith("#/admin")) setRoute({type:"superadmin"});
      else setRoute({type:"landing"});
    };
    window.addEventListener("hashchange",onHash);
    return()=>window.removeEventListener("hashchange",onHash);
  },[]);

  const masterRef=useRef(master);
  useEffect(()=>{ masterRef.current=master; },[master]);

  const saveMaster=useCallback((next)=>{
    // `next` can be either a plain object OR a functional updater (prev=>newState).
    // We must resolve functions to a real object BEFORE persisting, otherwise
    // JSON.stringify(function) silently produces `undefined` and corrupts storage.
    const resolved=typeof next==="function"?next(masterRef.current):next;
    masterRef.current=resolved;
    setMaster(resolved);
    const s=JSON.stringify(resolved);
    // Save to cloud (works across all devices/browsers)
    cloudSave(resolved);
    // Also save locally as fallback
    if(window.storage) window.storage.set(STORAGE_KEY,s).catch(()=>{});
    try{localStorage.setItem(STORAGE_KEY,s);}catch{}
    try{sessionStorage.setItem(STORAGE_KEY,s);}catch{}
  },[]);

  // Shorthand: update a specific tournament
  const saveTour=useCallback((code,updater,logMsg)=>{
    saveMaster(prev=>{
      const tour=prev.tournaments[code];
      if(!tour) return prev;
      const updated=typeof updater==="function"?updater(tour):{...tour,...updater};
      const withLog=logMsg
        ?{...updated,log:[`[${nowStr()}] ${logMsg}`,...(updated.log||[])].slice(0,200)}
        :updated;
      return{...prev,tournaments:{...prev.tournaments,[code]:withLog}};
    });
  },[saveMaster]);

  const toast$=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),3500);};
  const addMasterLog=(msg,base=master)=>({...base,log:[`[${nowStr()}] ${msg}`,...(base.log||[])].slice(0,200)});

  // Keep loggedInPlayer fresh
  useEffect(()=>{
    if(loggedInPlayer&&activeTournament){
      const fresh=activeTournament.players.find(p=>p.id===loggedInPlayer.id);
      if(fresh) setLoggedInPlayer(fresh);
    }
  },[activeTournament?.players]);

  // ── SUPER ADMIN ───────────────────────────────────────────────────────────
  function trySuper(){
    if(superPwInput===master.superAdminPassword){
      setSuperUnlocked(true);setSuperPwInput("");setSuperPwError(false);
    } else {setSuperPwError(true);setSuperPwInput("");}
  }

  function createTournament(){
    const{code,name,hostName,adminPassword,adminFee,kickbackPercent}=newTourForm;
    if(!code.trim()||!name.trim()) return toast$("Code and name required","error");
    const clean=code.trim().toUpperCase().replace(/\s/g,"-");
    if(master.tournaments[clean]) return toast$("Tournament code already exists","error");
    const tour=makeTournament(clean,name,hostName);
    tour.season.adminFee=Number(adminFee)||0;
    tour.season.kickbackPercent=Number(kickbackPercent)||0;
    if(adminPassword.trim()) tour.adminPassword=pwHash(adminPassword.trim());
    tour.adminPasswordPlain=adminPassword.trim()||"changeme";
    saveMaster(addMasterLog(`✅ Tournament created: ${clean} — ${name}`,
      {...master,tournaments:{...master.tournaments,[clean]:tour}}));
    setNewTourModal(false);
    setNewTourForm({code:"",name:"",hostName:"",adminPassword:"",adminFee:5,kickbackPercent:0});
    toast$(`Tournament ${clean} created!`);
  }

  function deleteTournament(code){
    if(!confirm(`Delete tournament ${code} and ALL its data?`)) return;
    const{[code]:_,...rest}=master.tournaments;
    saveMaster(addMasterLog(`🗑️ Tournament deleted: ${code}`,{...master,tournaments:rest}));
    toast$(`${code} deleted`);
  }

  // ── HOST KICKBACK PAYOUTS ─────────────────────────────────────────────────
  // Platform organiser records a manual payout once they've sent the host
  // their share of admin fees (e.g. via PayPal to the host's email on file).
  function markKickbackPaid(code,amount,note){
    const amt=Number(amount);
    if(!amt||amt<=0) return toast$("Enter a valid amount","error");
    saveTour(code,t=>({...t,kickbackPayouts:[...(t.kickbackPayouts||[]),
      {id:uid(),amount:amt,paidAt:new Date().toISOString(),note:note||""}]}),
      `💸 Kickback payout recorded: $${amt} to ${master.tournaments[code]?.hostName||code}`);
    toast$(`$${amt} kickback payout recorded`);
  }

  function deleteKickbackPayout(code,payoutId){
    saveTour(code,t=>({...t,kickbackPayouts:(t.kickbackPayouts||[]).filter(p=>p.id!==payoutId)}),
      `🗑️ Kickback payout entry removed`);
    toast$("Payout entry removed");
  }

  // ── TOURNAMENT REQUEST TICKETS ────────────────────────────────────────────
  // Approving a ticket opens the New Tournament modal prefilled with the
  // requester's details so the admin can review/adjust before creating it.
  function approveTicket(ticketId){
    const ticket=master.tournamentRequests?.find(t=>t.id===ticketId);
    if(!ticket) return;
    setNewTourForm({
      code:ticket.desiredCode||"",
      name:ticket.desiredName||"",
      hostName:ticket.hostName||"",
      adminPassword:"",
      adminFee:5,
      kickbackPercent:0,
    });
    setNewTourModal(true);
    saveMaster(prev=>({...prev,tournamentRequests:prev.tournamentRequests.map(t=>
      t.id!==ticketId?t:{...t,status:"approved",resolvedAt:new Date().toISOString()})}));
    toast$("Ticket approved — review and create the tournament below");
  }

  function rejectTicket(ticketId){
    if(!confirm("Reject this tournament request? The requester won't be notified automatically.")) return;
    saveMaster(addMasterLog(`🎫 Ticket rejected: ${master.tournamentRequests?.find(t=>t.id===ticketId)?.email}`,
      {...master,tournamentRequests:master.tournamentRequests.map(t=>
        t.id!==ticketId?t:{...t,status:"rejected",resolvedAt:new Date().toISOString()})}));
    toast$("Ticket rejected");
  }

  function deleteTicket(ticketId){
    saveMaster({...master,tournamentRequests:master.tournamentRequests.filter(t=>t.id!==ticketId)});
    toast$("Ticket removed");
  }

  // ── TOURNAMENT ADMIN AUTH ─────────────────────────────────────────────────
  function tryTAdmin(){
    const tour=activeTournament;if(!tour) return;
    if(tAdminPwInput===master.superAdminPassword||pwHash(tAdminPwInput)===tour.adminPassword){
      setTAdminUnlocked(true);setTAdminPwInput("");setTAdminPwError(false);
    } else {setTAdminPwError(true);setTAdminPwInput("");}
  }

  // ── PLAYER REGISTRATION (per tournament) ─────────────────────────────────
  function selfRegister(){
    const tour=activeTournament;if(!tour) return;
    const{name,discord,email,password,confirmPw,civ,startElo,timezone}=regForm;
    if(!name.trim()||!discord.trim()) return toast$("Name and Discord required","error");
    if(!email.trim()||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast$("Valid email required","error");
    if(!password||password.length<6) return toast$("Password min 6 characters","error");
    if(password!==confirmPw) return toast$("Passwords do not match","error");
    if(tour.bannedEmails?.includes(email.toLowerCase())) return toast$("Account banned","error");
    if(tour.players.find(p=>p.discord.toLowerCase()===discord.toLowerCase())) return toast$("Discord already registered","error");
    if(tour.players.find(p=>p.email?.toLowerCase()===email.toLowerCase())) return toast$("Email already registered","error");
    const elo=Number(startElo)||800;
    const tier=getTierForElo(elo,tour.season.tiers);
    const p={
      id:uid(),name:name.trim(),discord:discord.trim(),
      email:email.trim().toLowerCase(),pwHash:pwHash(password),
      civ,elo,timezone,tierId:tier.id,tier,
      placementsDone:0,placementsNeeded:tour.season.placementGames,
      classified:false,banned:false,
      // paymentStatus: "none" | "submitted" | "received"
      paymentStatus:"none",
      swissWins:0,swissLosses:0,buchholz:0,wins:0,losses:0,
      registeredAt:new Date().toISOString(),
    };
    saveTour(tour.code,t=>({...t,
      players:[...t.players,p],
      log:[`[${nowStr()}] ✅ ${p.name} registered (${p.email})`,...t.log].slice(0,200)
    }));
    setRegSuccess(true);
    setRegForm({name:"",discord:"",email:"",password:"",confirmPw:"",civ:CIVS[0],startElo:800,timezone:TIMEZONES[0].value});
    toast$(`Welcome, ${p.name}!`);
  }

  // ── PLAYER LOGIN ─────────────────────────────────────────────────────────
  function loginPlayer(){
    const tour=activeTournament;if(!tour) return;
    setLoginError("");
    const{email,password}=loginForm;
    if(!email.trim()||!password) return setLoginError("Enter email and password.");
    const match=tour.players.find(p=>p.email?.toLowerCase()===email.trim().toLowerCase());
    if(!match) return setLoginError("No account found.");
    if(match.banned) return setLoginError("Account suspended. Contact the organiser.");
    if(match.pwHash!==pwHash(password)) return setLoginError("Incorrect password.");
    setLoggedInPlayer(match);
    setLoginForm({email:"",password:""});
    setTab("portal");
    toast$(`Welcome back, ${match.name}! ⚔️`);
  }
  function logoutPlayer(){setLoggedInPlayer(null);setTab("home");setPortalTab("dashboard");}

  // ── PLAYER SELF-DELETE ────────────────────────────────────────────────────
  // A player can remove their own registration, but only while it's safe to do so:
  // not yet classified into a division, and no payment submitted/received.
  // Once they're in a bracket or have money in flight, only the admin should
  // handle removal (forfeits, refunds, bracket integrity, etc.).
  function canPlayerSelfDelete(player){
    if(!player) return false;
    if(player.classified) return false;
    if(player.paymentStatus&&player.paymentStatus!=="none") return false;
    return true;
  }

  function playerDeleteOwnAccount(code,playerId){
    const tour=master.tournaments[code];if(!tour) return;
    const player=tour.players.find(p=>p.id===playerId);if(!player) return;
    if(!canPlayerSelfDelete(player)){
      return toast$("You can't self-delete after being classified or paying — contact the tournament admin.","error");
    }
    if(!confirm(`Permanently delete your registration for ${tour.name}? This cannot be undone. You can register again afterward with the same or a different email.`)) return;
    saveTour(code,t=>({...t,
      players:t.players.filter(p=>p.id!==playerId),
      placementMatches:(t.placementMatches||[]).filter(m=>m.p1!==playerId&&m.p2!==playerId),
    }),`🗑️ ${player.name} deleted their own registration`);
    toast$("Your registration has been deleted.");
    logoutPlayer();
  }

  // ── PLAYER PROFILE SELF-EDIT ──────────────────────────────────────────────
  // Lets a logged-in player update their own name/Discord/email/civ/timezone.
  // ELO, division, payment status, and match history stay system-managed.
  function playerUpdateProfile(code,playerId,updates){
    const tour=master.tournaments[code];if(!tour) return;
    const player=tour.players.find(p=>p.id===playerId);if(!player) return;
    const name=updates.name?.trim();
    const discord=updates.discord?.trim();
    const email=updates.email?.trim().toLowerCase();
    if(!name) return toast$("Name is required","error");
    if(!discord) return toast$("Discord tag is required","error");
    if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast$("Enter a valid email address","error");
    if(tour.players.some(p=>p.id!==playerId&&p.email?.toLowerCase()===email))
      return toast$("That email is already used by another player in this tournament","error");
    if(tour.players.some(p=>p.id!==playerId&&p.discord?.toLowerCase()===discord.toLowerCase()))
      return toast$("That Discord tag is already used by another player in this tournament","error");
    saveTour(code,t=>({...t,players:t.players.map(p=>p.id!==playerId?p:{
      ...p,name,discord,email,civ:updates.civ,timezone:updates.timezone,
    })}),`✏️ ${name} updated their profile`);
    toast$("Profile updated!");
  }

  function playerChangeOwnPassword(code,playerId,newPw,confirmPw){
    if(!newPw||newPw.length<6) return toast$("Password must be at least 6 characters","error");
    if(newPw!==confirmPw) return toast$("Passwords don't match","error");
    saveTour(code,t=>({...t,players:t.players.map(p=>p.id!==playerId?p:{...p,pwHash:pwHash(newPw)})}),
      "🔑 Password changed by player");
    setPwChangeForm({newPw:"",confirmPw:""});
    toast$("Password changed!");
  }

  // ── HELPERS ───────────────────────────────────────────────────────────────
  const T=activeTournament; // shorthand
  const tierPs   =(tid)=>T?.players.filter(p=>p.classified&&p.tierId===tid&&!p.banned)||[];
  const tierStand=(tid)=>[...tierPs(tid)].sort((a,b)=>b.swissWins!==a.swissWins?b.swissWins-a.swissWins:b.buchholz-a.buchholz||b.elo-a.elo);
  const getTour  =(tid)=>T?.tournaments?.[tid];

  function convertTime(iso,tz){
    if(!iso) return "—";
    try{return new Date(iso).toLocaleString("en-CA",{timeZone:tz,weekday:"short",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});}
    catch{return iso;}
  }

  // Formats a plain "YYYY-MM-DD" date string (from a <input type="date">) into
  // a readable form like "Friday, July 3" — used for tournament start/deadline display.
  function formatDateLong(dateStr){
    if(!dateStr) return "";
    try{
      const [y,m,d]=dateStr.split("-").map(Number);
      const dt=new Date(y,m-1,d); // local, avoids UTC off-by-one on date-only strings
      return dt.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
    }catch{return dateStr;}
  }

  // ── PAYMENT STATUS MANAGEMENT ────────────────────────────────────────────
  // Player marks their own payment as "submitted" after paying via PayPal
  function playerSubmitPayment(code,playerId){
    saveTour(code,t=>({...t,
      players:t.players.map(p=>p.id!==playerId?p:{...p,paymentStatus:"submitted"})
    }),`💳 ${master.tournaments[code]?.players.find(p=>p.id===playerId)?.name} submitted payment`);
    toast$("Payment marked as submitted! Waiting for organiser to confirm receipt.");
  }

  // Tournament admin confirms full receipt of both admin fee + prize fee
  function adminConfirmPaymentReceived(code,playerId){
    const tour=master.tournaments[code];if(!tour) return;
    const player=tour.players.find(p=>p.id===playerId);if(!player) return;
    const already=tour.feeCollected?.some(f=>f.playerId===playerId&&f.seasonName===tour.season.name);
    const playerPrizeFee=getTierPrizeFee(tour,player.tierId);
    saveTour(code,t=>{
      const players=t.players.map(p=>p.id!==playerId?p:{...p,paymentStatus:"received"});
      if(already) return{...t,players};
      const entries=[
        {id:uid(),playerId,name:player.name,email:player.email,discord:player.discord,
         type:"adminFee",amount:t.season.adminFee||0,paidAt:new Date().toISOString(),seasonName:t.season.name},
        {id:uid(),playerId,name:player.name,email:player.email,discord:player.discord,
         type:"prizeFee",amount:playerPrizeFee,paidAt:new Date().toISOString(),seasonName:t.season.name,tierId:player.tierId},
      ];
      return{...t,players,feeCollected:[...(t.feeCollected||[]),...entries]};
    },`✅ Payment confirmed received for ${player.name}`);
    toast$(`${player.name}'s payment confirmed — they can now play!`);
  }

  // Admin reverts a payment status (e.g. mistake correction)
  function adminRevertPayment(code,playerId,newStatus){
    saveTour(code,t=>({...t,
      players:t.players.map(p=>p.id!==playerId?p:{...p,paymentStatus:newStatus})
    }),`🔄 Payment status reverted to "${newStatus}" for ${master.tournaments[code]?.players.find(p=>p.id===playerId)?.name}`);
    toast$("Payment status updated");
  }

  // After a tournament/season ends, reset everyone's payment status for the next season
  function resetAllPayments(code){
    if(!confirm("Reset ALL player payment statuses to 'No Payment Submitted'? This prepares the tournament for its next season. Historical fee records are kept.")) return;
    saveTour(code,t=>({...t,
      players:t.players.map(p=>({...p,paymentStatus:"none"}))
    }),`🔄 All player payments reset for new season`);
    toast$("All payments reset — ready for next season!");
  }

  // ── DRAFT SYNC ────────────────────────────────────────────────────────────
  // Re-initialise each draft whenever the active tournament changes, so a fresh
  // copy of the server data is always the starting point (any unsaved edits
  // made while on this tournament persist across tab switches until Saved or
  // until you switch to a different tournament).
  useEffect(()=>{
    if(!T) return;
    setSeasonDraft({
      hostEmail:T.hostEmail||"",
      name:T.season.name,
      placementGames:T.season.placementGames,
      swissRounds:T.season.swissRounds,
      top8Cut:T.season.top8Cut,
      prizeFee:T.season.prizeFee||0,
      paymentInfo:T.season.paymentInfo||"",
      startDate:T.season.startDate||"",
      registrationDeadline:T.season.registrationDeadline||"",
    });
    setWindowsDraft(T.season.timeWindows?[...T.season.timeWindows.map(w=>({...w}))]:[]);
    setPlacementDraft({...DEFAULT_PLACEMENT_SETTINGS,...T.season.placementSettings});
    setTiersDraft(T.season.tiers.map(t=>({...t,prizeSplit:{...(t.prizeSplit||{first:60,second:25,third:15})}})));
  },[T?.code]);

  function saveSeasonSettings(){
    if(!seasonDraft) return;
    saveTour(T.code,t=>({...t,
      hostEmail:seasonDraft.hostEmail,
      season:{...t.season,
        name:seasonDraft.name,
        placementGames:Number(seasonDraft.placementGames)||1,
        swissRounds:Number(seasonDraft.swissRounds)||1,
        top8Cut:Number(seasonDraft.top8Cut)||2,
        prizeFee:Number(seasonDraft.prizeFee)||0,
        paymentInfo:seasonDraft.paymentInfo,
        startDate:seasonDraft.startDate,
        registrationDeadline:seasonDraft.registrationDeadline,
      }
    }),"⚙️ Season settings updated");
    toast$("Season settings saved!");
  }

  function saveTimeWindows(){
    if(!windowsDraft) return;
    saveTour(T.code,t=>({...t,season:{...t.season,timeWindows:windowsDraft}}),"📅 Time windows updated");
    toast$("Time windows saved!");
  }

  function savePlacementSettings(){
    if(!placementDraft) return;
    saveTour(T.code,t=>({...t,season:{...t.season,placementSettings:placementDraft}}),"🎮 Placement settings updated");
    toast$("Placement settings saved!");
  }

  function saveTiers(){
    if(!tiersDraft) return;
    if(tiersDraft.length<2) return toast$("Need at least 2 tiers","error");
    saveTour(T.code,t=>({...t,season:{...t.season,tiers:tiersDraft}}),"🏅 Divisions & prize fees updated");
    toast$("Divisions saved!");
  }

  // Generate a PayPal.me / checkout URL with tracking note
  function buildPaypalUrl(payeeEmail,amount,note){
    // PayPal doesn't support pre-filled "note" via simple link for all account types,
    // but the amount + a copy-paste note covers tracking needs reliably.
    const base=`https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${encodeURIComponent(payeeEmail)}&amount=${amount}&currency_code=USD&item_name=${encodeURIComponent(note)}`;
    return base;
  }

  // ── REGISTRATION OPEN/CLOSE ───────────────────────────────────────────────
  function openRegistration(code){
    saveTour(code,t=>({...t,season:{...t.season,registrationOpen:true}}),"📋 Registration opened");
    toast$("Registration is now open!");
  }

  function closeAndSchedule(code){
    const tour=master.tournaments[code];if(!tour) return;
    const eligible=tour.players.filter(p=>!p.banned);
    if(eligible.length<2) return toast$("Need at least 2 players","error");
    const schedule=generatePlacementSchedule(
      eligible,tour.season.placementGames,
      tour.season.timeWindows||[],
      tour.season.lobbyPrefix||tour.code,
      tour.season.placementSettings
    );
    const resetPlayers=tour.players.map(p=>({...p,
      placementsDone:0,classified:false,wins:0,losses:0,
      swissWins:0,swissLosses:0,buchholz:0}));
    saveTour(code,t=>({...t,
      players:resetPlayers,
      placementMatches:schedule,
      season:{...t.season,registrationOpen:false}
    }),`🔒 Registration closed · ${eligible.length} players · ${schedule.length} placement matches auto-scheduled`);
    toast$(`Registration closed! ${schedule.length} placement matches scheduled.`);
  }

  // ── PLACEMENT ELO ────────────────────────────────────────────────────────
  function applyPlacementElo(code,winnerId,loserId){
    saveTour(code,t=>{
      const w=t.players.find(p=>p.id===winnerId);
      const l=t.players.find(p=>p.id===loserId);
      if(!w||!l) return t;
      const newWElo=calcElo(w.elo,l.elo,1);
      const newLElo=calcElo(l.elo,w.elo,0);
      const players=t.players.map(p=>{
        if(p.id===winnerId){
          const done=p.placementsDone+1;
          const classified=done>=t.season.placementGames;
          const tier=classified?getTierForElo(newWElo,t.season.tiers):p.tier;
          return{...p,elo:newWElo,placementsDone:done,wins:p.wins+1,
            classified,tierId:classified?tier.id:p.tierId,tier:classified?tier:p.tier};
        }
        if(p.id===loserId){
          const done=p.placementsDone+1;
          const classified=done>=t.season.placementGames;
          const tier=classified?getTierForElo(newLElo,t.season.tiers):p.tier;
          return{...p,elo:newLElo,placementsDone:done,losses:p.losses+1,
            classified,tierId:classified?tier.id:p.tierId,tier:classified?tier:p.tier};
        }
        return p;
      });
      return{...t,players};
    });
  }

  function reportPlacementMatch(code,matchId,reportingPlayerId,claimedWinnerId){
    const tour=master.tournaments[code];if(!tour) return;
    const m=tour.placementMatches?.find(x=>x.id===matchId);
    if(!m||m.reported) return toast$("Match not found or already reported","error");
    const isP1=m.p1===reportingPlayerId;
    const field=isP1?"p1Reported":"p2Reported";
    const otherField=isP1?"p2Reported":"p1Reported";
    const otherReport=m[otherField];
    const updated={...m,[field]:claimedWinnerId};
    let finalMatch=updated;
    let agreed=false;
    if(otherReport!==null&&otherReport!==undefined){
      if(otherReport===claimedWinnerId){
        finalMatch={...updated,winner:claimedWinnerId,reported:true,disputed:false};
        agreed=true;
      } else {
        finalMatch={...updated,disputed:true};
      }
    }
    const newMatches=tour.placementMatches.map(x=>x.id!==matchId?x:finalMatch);
    saveTour(code,t=>({...t,placementMatches:newMatches}),
      agreed?`✅ Placement result confirmed: ${tour.players.find(p=>p.id===claimedWinnerId)?.name} wins`
            :`📌 Placement report by ${tour.players.find(p=>p.id===reportingPlayerId)?.name}`);
    if(agreed){
      applyPlacementElo(code,claimedWinnerId,claimedWinnerId===m.p1?m.p2:m.p1);
      toast$("Result confirmed!");
    } else if(otherReport!==undefined&&otherReport!==null){
      toast$("⚠️ Conflict — admin will review","error");
    } else {
      toast$("Result submitted — waiting for opponent.");
    }
  }

  // ── MATCH CHAT — PLACEMENT ────────────────────────────────────────────────
  // Lets the two players in a placement match talk to each other right inside
  // the app, instead of needing Discord, to coordinate a time/lobby etc.
  function sendPlacementMessage(code,matchId,senderId,senderName,text){
    if(!text?.trim()) return;
    const tour=master.tournaments[code];if(!tour) return;
    const m=tour.placementMatches?.find(x=>x.id===matchId);if(!m) return;
    const newMsg={id:uid(),senderId,senderName,text:text.trim(),sentAt:new Date().toISOString()};
    saveTour(code,t=>({...t,placementMatches:t.placementMatches.map(x=>
      x.id!==matchId?x:{...x,messages:[...(x.messages||[]),newMsg]})}));
  }

  function adminResolvePlacement(code,matchId,winnerId){
    const tour=master.tournaments[code];if(!tour) return;
    const m=tour.placementMatches?.find(x=>x.id===matchId);if(!m) return;
    const newMatches=tour.placementMatches.map(x=>x.id!==matchId?x:
      {...x,winner:winnerId,reported:true,disputed:false,adminResolved:true});
    saveTour(code,t=>({...t,placementMatches:newMatches}),
      `✅ Admin resolved placement: ${tour.players.find(p=>p.id===winnerId)?.name} wins`);
    applyPlacementElo(code,winnerId,winnerId===m.p1?m.p2:m.p1);
    setDisputeModal(null);toast$("Dispute resolved");
  }

  // ── OPEN DIVISION BRACKETS ────────────────────────────────────────────────
  function autoOpenBrackets(code){
    const tour=master.tournaments[code];if(!tour) return;
    const anyTierHasFee=tour.season.tiers.some(t=>getTierTotalFee(tour,t.id)>0);
    if(anyTierHasFee&&!tour.hostEmail?.trim()){
      return toast$("Add your PayPal email in Admin → Season before launching a paid tournament","error");
    }
    // Players are eligible if classified, not banned, AND (their tier is free OR payment received)
    const classified=tour.players.filter(p=>p.classified&&!p.banned&&
      (getTierTotalFee(tour,p.tierId)===0||p.paymentStatus==="received"));
    if(classified.length<2) return toast$("Not enough eligible players (check payment status)","error");
    let newTournaments={...tour.tournaments};let opened=0;
    tour.season.tiers.forEach(tier=>{
      if(newTournaments[tier.id]) return;
      const eligible=classified.filter(p=>p.tierId===tier.id);
      if(eligible.length<2) return;
      const round1=swissPair(eligible.map(p=>({...p,swissWins:0,swissLosses:0,buchholz:0})));
      const labeled=round1.map(m=>{
        const p1=tour.players.find(p=>p.id===m.p1);
        const p2=tour.players.find(p=>p.id===m.p2);
        return{...m,lobbyName:makeLobbyName(tour.code,`1`,p1?.name,p2?.name)};
      });
      newTournaments[tier.id]={
        tierId:tier.id,tierName:tier.name,phase:"settings",
        currentRound:0,totalRounds:tour.season.swissRounds,
        swissRounds:[],allMatches:[],top8:[],champion:null,
        settings:{map:"Arabia",resources:"Standard",speed:"Normal",locked:false},
        settingVotes:{},pendingRound1:labeled,
        created:new Date().toLocaleString(),
      };
      opened++;
    });
    saveTour(code,t=>({...t,tournaments:newTournaments}),
      `⚔️ ${opened} bracket${opened!==1?"s":""} opened for settings vote`);
    toast$(`${opened} division${opened!==1?"s":""} opened!`);
  }

  // ── SETTINGS VOTE ─────────────────────────────────────────────────────────
  function castVote(code,tierId,cat,value,playerId){
    saveTour(code,t=>{
      const tour=t.tournaments[tierId]||{settingVotes:{}};
      const votes={...tour.settingVotes,[cat]:{...tour.settingVotes?.[cat],[playerId]:value}};
      return{...t,tournaments:{...t.tournaments,[tierId]:{...tour,settingVotes:votes}}};
    });
    toast$("Vote cast!");
  }
  function tallyVotes(code,tierId,cat){
    const v=master.tournaments[code]?.tournaments?.[tierId]?.settingVotes?.[cat]||{};
    const t={};Object.values(v).forEach(x=>{t[x]=(t[x]||0)+1;});
    return Object.entries(t).sort((a,b)=>b[1]-a[1]);
  }
  function lockSettings(code,tierId){
    const tour=master.tournaments[code];if(!tour) return;
    const s={
      map:tallyVotes(code,tierId,"map")[0]?.[0]||"Arabia",
      resources:tallyVotes(code,tierId,"resources")[0]?.[0]||"Standard",
      speed:tallyVotes(code,tierId,"speed")[0]?.[0]||"Normal",
      locked:true,
    };
    saveTour(code,t=>({...t,tournaments:{...t.tournaments,[tierId]:{...t.tournaments[tierId],settings:s}}}),
      `🔒 ${tierId} settings locked: ${s.map} · ${s.resources} · ${s.speed}`);
    toast$("Settings locked!");
  }
  function beginSwiss(code,tierId){
    const tour=master.tournaments[code];if(!tour) return;
    const bracket=tour.tournaments[tierId];if(!bracket) return;
    const labeled=bracket.pendingRound1.map(m=>{
      const p1=tour.players.find(p=>p.id===m.p1);
      const p2=tour.players.find(p=>p.id===m.p2);
      return{...m,lobbyName:makeLobbyName(tour.code,"1",p1?.name,p2?.name)};
    });
    saveTour(code,t=>({...t,tournaments:{...t.tournaments,[tierId]:{
      ...bracket,phase:"swiss",currentRound:1,
      swissRounds:[labeled],allMatches:[...labeled]}}}),
      `▶️ ${bracket.tierName} Swiss Round 1 started`);
    toast$("Swiss Round 1 started!");
  }

  // ── PLAYER SELF-REPORT TOURNAMENT MATCH ──────────────────────────────────
  function playerReport(code,tierId,roundIdx,matchId,isTop8,reportingPlayerId,claimedWinnerId){
    const tour=master.tournaments[code];if(!tour) return;
    const bracket=tour.tournaments[tierId];if(!bracket) return;
    const rounds=isTop8?bracket.top8:bracket.swissRounds;
    const m=rounds[roundIdx]?.find(x=>x.id===matchId);if(!m||m.reported) return;
    if(m.p1!==reportingPlayerId&&m.p2!==reportingPlayerId) return toast$("Not your match","error");
    const isP1=m.p1===reportingPlayerId;
    const field=isP1?"p1Reported":"p2Reported";
    const otherField=isP1?"p2Reported":"p1Reported";
    const otherReport=m[otherField];
    const updated={...m,[field]:claimedWinnerId};
    let finalMatch=updated,agreed=false;
    if(otherReport!==null&&otherReport!==undefined){
      if(otherReport===claimedWinnerId){finalMatch={...updated,winner:claimedWinnerId,reported:true,disputed:false};agreed=true;}
      else finalMatch={...updated,disputed:true};
    }
    const upd=rounds=>rounds.map((round,ri)=>ri!==roundIdx?round:round.map(x=>x.id!==matchId?x:finalMatch));
    const newBracket=isTop8?{...bracket,top8:upd(bracket.top8)}:{...bracket,swissRounds:upd(bracket.swissRounds)};
    saveTour(code,t=>({...t,tournaments:{...t.tournaments,[tierId]:newBracket}}),
      agreed?`✅ ${tierId} R${roundIdx+1}: ${tour.players.find(p=>p.id===claimedWinnerId)?.name} wins`
            :`📌 ${tour.players.find(p=>p.id===reportingPlayerId)?.name} reported`);
    if(agreed) finalizeMatchResult(code,tierId,roundIdx,matchId,isTop8,claimedWinnerId,finalMatch);
    else if(otherReport!==undefined&&otherReport!==null) toast$("⚠️ Conflict — admin will review","error");
    else toast$("Result submitted — waiting for opponent.");
  }

  // ── MATCH CHAT — TOURNAMENT (SWISS / TOP 8) ──────────────────────────────
  function sendTournamentMessage(code,tierId,roundIdx,matchId,isTop8,senderId,senderName,text){
    if(!text?.trim()) return;
    const tour=master.tournaments[code];if(!tour) return;
    const bracket=tour.tournaments[tierId];if(!bracket) return;
    const newMsg={id:uid(),senderId,senderName,text:text.trim(),sentAt:new Date().toISOString()};
    const upd=rounds=>rounds.map((round,ri)=>ri!==roundIdx?round:round.map(x=>
      x.id!==matchId?x:{...x,messages:[...(x.messages||[]),newMsg]}));
    const newBracket=isTop8?{...bracket,top8:upd(bracket.top8)}:{...bracket,swissRounds:upd(bracket.swissRounds)};
    saveTour(code,t=>({...t,tournaments:{...t.tournaments,[tierId]:newBracket}}));
  }

  function finalizeMatchResult(code,tierId,roundIdx,matchId,isTop8,winnerId,match){
    const tour=master.tournaments[code];if(!tour) return;
    const bracket=tour.tournaments[tierId];if(!bracket) return;
    const loserId=match.p1===winnerId?match.p2:match.p1;
    if(isTop8){
      const matchIdx=bracket.top8[roundIdx]?.findIndex(x=>x.id===matchId);
      let top8=bracket.top8.map((round,ri)=>ri!==roundIdx?round:round.map(x=>x.id!==matchId?x:{...x,winner:winnerId,reported:true}));
      if(roundIdx+1<top8.length&&matchIdx!==-1){
        const nmi=Math.floor(matchIdx/2),slot=matchIdx%2===0?"p1":"p2";
        top8[roundIdx+1]=top8[roundIdx+1].map((x,mi)=>mi!==nmi?x:{...x,[slot]:winnerId});
      }
      const isFinal=roundIdx===top8.length-1;
      const champ=isFinal?winnerId:bracket.champion;
      const wName=tour.players.find(p=>p.id===winnerId)?.name;
      saveTour(code,t=>({...t,tournaments:{...t.tournaments,[tierId]:{
        ...bracket,top8,champion:champ,phase:isFinal?"done":bracket.phase}}}),
        isFinal?`👑 ${bracket.tierName} CHAMPION: ${wName}!`:`🏅 Top8: ${wName} advances`);
    } else {
      saveTour(code,t=>{
        let players=[...t.players];
        players=players.map(p=>{
          if(p.id===winnerId) return{...p,swissWins:p.swissWins+1,wins:p.wins+1};
          if(p.id===loserId) return{...p,swissLosses:(p.swissLosses||0)+1,losses:p.losses+1};
          return p;
        });
        const tp=players.filter(p=>p.classified&&p.tierId===tierId);
        const allM=[...bracket.allMatches.filter(x=>x.id!==matchId),{...match,winner:winnerId}];
        players=players.map(p=>tp.find(x=>x.id===p.id)?{...p,buchholz:calcBuchholz(p.id,tp,allM)}:p);
        const newRounds=bracket.swissRounds.map((round,ri)=>ri!==roundIdx?round:round.map(x=>x.id!==matchId?x:{...x,winner:winnerId,reported:true}));
        return{...t,players,tournaments:{...t.tournaments,[tierId]:{...bracket,swissRounds:newRounds,allMatches:allM}}};
      });
    }
  }

  function adminResolveDispute(code,tierId,roundIdx,matchId,isTop8,winnerId){
    const tour=master.tournaments[code];if(!tour) return;
    const bracket=tour.tournaments[tierId];if(!bracket) return;
    const rounds=isTop8?bracket.top8:bracket.swissRounds;
    const m=rounds[roundIdx]?.find(x=>x.id===matchId);if(!m) return;
    const resolved={...m,winner:winnerId,reported:true,disputed:false,adminResolved:true};
    const upd=rounds=>rounds.map((round,ri)=>ri!==roundIdx?round:round.map(x=>x.id!==matchId?x:resolved));
    const newBracket=isTop8?{...bracket,top8:upd(bracket.top8)}:{...bracket,swissRounds:upd(bracket.swissRounds)};
    saveTour(code,t=>({...t,tournaments:{...t.tournaments,[tierId]:newBracket}}),`✅ Admin resolved dispute`);
    finalizeMatchResult(code,tierId,roundIdx,matchId,isTop8,winnerId,resolved);
    setDisputeModal(null);toast$("Dispute resolved");
  }

  function nextSwissRound(code,tierId){
    const tour=master.tournaments[code];if(!tour) return;
    const bracket=tour.tournaments[tierId];if(!bracket) return;
    const curr=bracket.swissRounds[bracket.currentRound-1]||[];
    if(!curr.every(m=>m.reported||m.p2==="BYE")) return toast$("Complete all matches first","error");
    if(bracket.currentRound>=tour.season.swissRounds){
      const tp=tour.players.filter(p=>p.classified&&p.tierId===tierId&&!p.banned);
      const top8=buildTop8(tp,tour.code);
      saveTour(code,t=>({...t,tournaments:{...t.tournaments,[tierId]:{...bracket,phase:"top8",top8}}}),
        `🎯 ${bracket.tierName} Swiss complete → Top 8 generated`);
      toast$("Top 8 generated!");
    } else {
      const tp=tour.players.filter(p=>p.classified&&p.tierId===tierId&&!p.banned);
      const newRound=swissPair(tp,bracket.allMatches);
      const nextR=bracket.currentRound+1;
      const labeled=newRound.map(m=>{
        const p1=tour.players.find(p=>p.id===m.p1);
        const p2=tour.players.find(p=>p.id===m.p2);
        return{...m,lobbyName:makeLobbyName(tour.code,`${nextR}`,p1?.name,p2?.name)};
      });
      saveTour(code,t=>({...t,tournaments:{...t.tournaments,[tierId]:{
        ...bracket,currentRound:nextR,
        swissRounds:[...bracket.swissRounds,labeled],
        allMatches:[...bracket.allMatches,...labeled]}}}),
        `🔁 ${bracket.tierName} Round ${nextR} paired`);
      toast$(`Round ${nextR} paired!`);
    }
  }

  function finalizeVeto(code,tierId,roundIdx,matchId,isTop8,map){
    const tour=master.tournaments[code];if(!tour) return;
    const bracket=tour.tournaments[tierId];if(!bracket) return;
    const upd=rounds=>rounds.map((round,ri)=>ri!==roundIdx?round:round.map(m=>m.id!==matchId?m:{...m,pickedMap:map}));
    const newBracket=isTop8?{...bracket,top8:upd(bracket.top8)}:{...bracket,swissRounds:upd(bracket.swissRounds)};
    saveTour(code,t=>({...t,tournaments:{...t.tournaments,[tierId]:newBracket}}));
    setVetoMatch(null);toast$(`Map set: ${map}`);
  }

  function reportPlayer(code,reportedId,reason,reporterId){
    saveTour(code,t=>({...t,
      reports:[...(t.reports||[]),{id:uid(),reportedId,reporterId,reason,timestamp:new Date().toISOString(),resolved:false}]
    }),`🚨 Player report: ${master.tournaments[code]?.players.find(p=>p.id===reportedId)?.name}`);
    setReportModal(null);toast$("Report submitted");
  }

  function banPlayer(code,playerId){
    const p=master.tournaments[code]?.players.find(x=>x.id===playerId);if(!p) return;
    saveTour(code,t=>({...t,
      players:t.players.map(x=>x.id!==playerId?x:{...x,banned:true}),
      bannedEmails:[...(t.bannedEmails||[]),p.email]
    }),`🚫 ${p.name} banned`);
    if(loggedInPlayer?.id===playerId) logoutPlayer();
    toast$(`${p.name} banned`);
  }
  function unbanPlayer(code,playerId){
    const p=master.tournaments[code]?.players.find(x=>x.id===playerId);if(!p) return;
    saveTour(code,t=>({...t,
      players:t.players.map(x=>x.id!==playerId?x:{...x,banned:false}),
      bannedEmails:(t.bannedEmails||[]).filter(e=>e!==p.email)
    }),`✅ ${p.name} unbanned`);
    toast$(`${p.name} unbanned`);
  }

  // Player matches helper
  function getPlayerMatches(tour,playerId){
    const results=[];
    Object.entries(tour.tournaments||{}).forEach(([tierId,bracket])=>{
      const tier=tour.season.tiers.find(t=>t.id===tierId);
      bracket.swissRounds?.forEach((round,ri)=>round.forEach(m=>{
        if(m.p1!==playerId&&m.p2!==playerId) return;
        const oppId=m.p1===playerId?m.p2:m.p1;
        const opp=tour.players.find(p=>p.id===oppId);
        results.push({...m,tierId,tierName:tier?.name,tierIcon:tier?.icon,
          roundLabel:`Swiss Round ${ri+1}`,roundIdx:ri,isTop8:false,
          oppName:opp?.name||"BYE",oppId,
          outcome:m.winner===null?"pending":m.winner===playerId?"win":"loss",
          myReport:m.p1===playerId?m.p1Reported:m.p2Reported,
          settings:bracket.settings});
      }));
      bracket.top8?.forEach((round,ri)=>round.forEach((m,mi)=>{
        if(m.p1!==playerId&&m.p2!==playerId) return;
        const oppId=m.p1===playerId?m.p2:m.p1;
        const opp=tour.players.find(p=>p.id===oppId);
        const labels=["Quarterfinals","Semifinals","Grand Final"];
        results.push({...m,tierId,tierName:tier?.name,tierIcon:tier?.icon,
          roundLabel:labels[ri]||`Playoff R${ri+1}`,roundIdx:ri,matchIdx:mi,isTop8:true,
          oppName:opp?.name||"TBD",oppId,
          outcome:m.winner===null?"pending":m.winner===playerId?"win":"loss",
          myReport:m.p1===playerId?m.p1Reported:m.p2Reported,
          settings:bracket.settings});
      }));
    });
    return results.sort((a,b)=>a.outcome==="pending"?-1:1);
  }

  // Disputes
  const allDisputes=T?[
    ...(T.placementMatches||[]).filter(m=>m.disputed&&!m.reported).map(m=>({...m,isPlacement:true})),
    ...Object.entries(T.tournaments||{}).flatMap(([tierId,b])=>[
      ...(b.swissRounds||[]).flatMap((round,ri)=>round.filter(m=>m.disputed&&!m.reported).map(m=>({...m,tierId,roundIdx:ri,isTop8:false}))),
      ...(b.top8||[]).flatMap((round,ri)=>round.filter(m=>m.disputed&&!m.reported).map((m,mi)=>({...m,tierId,roundIdx:ri,matchIdx:mi,isTop8:true}))),
    ])
  ]:[];

  // ── MODALS ────────────────────────────────────────────────────────────────
  function VetoModal(){
    if(!vetoMatch||!T) return null;
    const{tierId,roundIdx,matchId,isTop8,md}=vetoMatch;
    const pool0=MAPS.slice(0,12);
    const [pool,setPool]=useState([...pool0]);
    const [bans,setBans]=useState([]);
    const [pickPhase,setPick]=useState(false);
    const [turn,setTurn]=useState(0);
    const p1=T.players.find(p=>p.id===md?.p1);
    const p2=T.players.find(p=>p.id===md?.p2);
    function ban(m){const nb=[...bans,m];const np=pool.filter(x=>x!==m);setBans(nb);setPool(np);if(nb.length>=4)setPick(true);else setTurn(t=>1-t);}
    return(
      <div style={S.modal}>
        <div style={{...S.card,maxWidth:520,width:"90%",maxHeight:"80vh",overflowY:"auto"}}>
          <div style={S.cardT}>🗺️ Map Veto — {p1?.name} vs {p2?.name}</div>
          {!pickPhase?(
            <><p style={{color:C.dim,fontSize:13,marginBottom:12}}><strong style={{color:C.gold}}>{[p1?.name,p2?.name][turn]}</strong> bans ({bans.length}/4)</p>
              <div style={S.grid("1fr 1fr 1fr",8)}>{pool.map(m=><button key={m} onClick={()=>ban(m)} style={{...S.btn("red"),width:"100%",fontSize:11,padding:"8px"}}>🚫 {m}</button>)}</div>
              {bans.length>0&&<p style={{color:C.dim,fontSize:12,marginTop:10}}>Banned: {bans.join(", ")}</p>}</>
          ):(
            <><p style={{color:C.dim,fontSize:13,marginBottom:12}}><strong style={{color:C.gold}}>{p1?.name}</strong> picks the map</p>
              <div style={S.grid("1fr 1fr",8)}>{pool.map(m=><button key={m} onClick={()=>finalizeVeto(T.code,tierId,roundIdx,matchId,isTop8,m)} style={{...S.btn("green"),width:"100%",padding:"10px",fontSize:12}}>✅ {m}</button>)}</div></>
          )}
          <button style={{...S.btn("stone"),marginTop:14}} onClick={()=>setVetoMatch(null)}>Cancel</button>
        </div>
      </div>
    );
  }

  function DisputeModal(){
    if(!disputeModal||!T) return null;
    if(disputeModal.isPlacement){
      const m=T.placementMatches?.find(x=>x.id===disputeModal.matchId);if(!m) return null;
      const p1=T.players.find(p=>p.id===m.p1),p2=T.players.find(p=>p.id===m.p2);
      return(
        <div style={S.modal}><div style={{...S.card,maxWidth:440,width:"90%"}}>
          <div style={S.cardT}>⚠️ Resolve Placement Dispute</div>
          <p style={{color:C.dim,fontSize:13,marginBottom:12}}>
            {p1?.name} reported: <strong>{T.players.find(p=>p.id===m.p1Reported)?.name||"?"}</strong><br/>
            {p2?.name} reported: <strong>{T.players.find(p=>p.id===m.p2Reported)?.name||"?"}</strong>
          </p>
          <div style={S.row(10)}>
            <button style={S.btn("gold")} onClick={()=>adminResolvePlacement(T.code,m.id,m.p1)}>🏆 {p1?.name}</button>
            <button style={S.btn("gold")} onClick={()=>adminResolvePlacement(T.code,m.id,m.p2)}>🏆 {p2?.name}</button>
          </div>
          <button style={{...S.btn("stone"),marginTop:10}} onClick={()=>setDisputeModal(null)}>Cancel</button>
        </div></div>
      );
    }
    const{tierId,roundIdx,matchId,isTop8}=disputeModal;
    const b=T.tournaments[tierId];
    const rounds=isTop8?b?.top8:b?.swissRounds;
    const m=rounds?.[roundIdx]?.find(x=>x.id===matchId);if(!m) return null;
    const p1=T.players.find(p=>p.id===m.p1),p2=T.players.find(p=>p.id===m.p2);
    return(
      <div style={S.modal}><div style={{...S.card,maxWidth:440,width:"90%"}}>
        <div style={S.cardT}>⚠️ Resolve Dispute</div>
        <p style={{color:C.dim,fontSize:13,marginBottom:12}}>
          {p1?.name} reported: <strong>{T.players.find(p=>p.id===m.p1Reported)?.name||"?"}</strong><br/>
          {p2?.name} reported: <strong>{T.players.find(p=>p.id===m.p2Reported)?.name||"?"}</strong>
        </p>
        <div style={S.row(10)}>
          <button style={S.btn("gold")} onClick={()=>adminResolveDispute(T.code,tierId,roundIdx,matchId,isTop8,m.p1)}>🏆 {p1?.name}</button>
          <button style={S.btn("gold")} onClick={()=>adminResolveDispute(T.code,tierId,roundIdx,matchId,isTop8,m.p2)}>🏆 {p2?.name}</button>
        </div>
        <button style={{...S.btn("stone"),marginTop:10}} onClick={()=>setDisputeModal(null)}>Cancel</button>
      </div></div>
    );
  }

  function ChangePwModal(){
    if(!changePwModal) return null;
    const[np,setNp]=useState("");const[cp,setCp]=useState("");const[show,setShow]=useState(false);
    return(
      <div style={S.modal}><div style={{...S.card,maxWidth:380,width:"90%"}}>
        <div style={S.cardT}>🔑 {changePwModal.label||"Change Password"}</div>
        <div style={{marginBottom:12}}>
          <label style={S.lbl}>New Password <span onClick={()=>setShow(s=>!s)} style={{color:C.dim,fontSize:10,marginLeft:8,cursor:"pointer",textTransform:"none"}}>{show?"🙈":"👁️"}</span></label>
          <input style={S.inp} type={show?"text":"password"} placeholder="Min 6 characters" value={np} onChange={e=>setNp(e.target.value)}/>
        </div>
        <div style={{marginBottom:14}}>
          <label style={S.lbl}>Confirm</label>
          <input style={{...S.inp,borderColor:cp&&cp!==np?C.ember:cp&&cp===np?C.moss:C.stone}} type={show?"text":"password"} placeholder="Repeat" value={cp} onChange={e=>setCp(e.target.value)}/>
          {cp&&cp===np&&<div style={{color:C.moss,fontSize:11,marginTop:3}}>✓ Match</div>}
        </div>
        <div style={S.row(10)}>
          <button style={S.btn("gold",np!==cp||np.length<6)} disabled={np!==cp||np.length<6}
            onClick={()=>{changePwModal.onSave(np);setChangePwModal(null);}}>Save</button>
          <button style={S.btn("stone")} onClick={()=>setChangePwModal(null)}>Cancel</button>
        </div>
      </div></div>
    );
  }

  function KickbackPayoutModal(){
    if(!kickbackPayoutModal) return null;
    const[amount,setAmount]=useState(kickbackPayoutModal.suggested?kickbackPayoutModal.suggested.toFixed(2):"");
    const[note,setNote]=useState("");
    const tour=master.tournaments[kickbackPayoutModal.code];
    return(
      <div style={S.modal}><div style={{...S.card,maxWidth:400,width:"90%"}}>
        <div style={S.cardT}>💸 Record Kickback Payout</div>
        <p style={{color:C.dim,fontSize:12,marginBottom:12,lineHeight:1.6}}>
          Record that you've sent this amount to <strong style={{color:C.gold}}>{tour?.hostName||tour?.name}</strong> (e.g. via PayPal to their email on file). This is a manual log only — it does not send any payment itself.
        </p>
        <div style={{marginBottom:12}}>
          <label style={S.lbl}>Amount Paid ($)</label>
          <input style={S.inp} type="number" min={0} step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} autoFocus/>
          {kickbackPayoutModal.suggested>0&&(
            <div style={{color:C.dim,fontSize:11,marginTop:4}}>Outstanding balance: ${kickbackPayoutModal.suggested.toFixed(2)}</div>
          )}
        </div>
        <div style={{marginBottom:14}}>
          <label style={S.lbl}>Note (optional)</label>
          <input style={S.inp} placeholder="e.g. PayPal transaction ID" value={note} onChange={e=>setNote(e.target.value)}/>
        </div>
        <div style={S.row(10)}>
          <button style={S.btn("gold",!amount||Number(amount)<=0)} disabled={!amount||Number(amount)<=0}
            onClick={()=>{markKickbackPaid(kickbackPayoutModal.code,amount,note);setKickbackPayoutModal(null);}}>
            Record Payout
          </button>
          <button style={S.btn("stone")} onClick={()=>setKickbackPayoutModal(null)}>Cancel</button>
        </div>
      </div></div>
    );
  }

  function ReportModal(){
    if(!reportModal||!T) return null;
    const[reason,setReason]=useState("");
    const target=T.players.find(p=>p.id===reportModal);
    return(
      <div style={S.modal}><div style={{...S.card,maxWidth:440,width:"90%"}}>
        <div style={S.cardT}>🚨 Report Player</div>
        <p style={{color:C.dim,fontSize:13,marginBottom:12}}>Reporting: <strong style={{color:C.gold}}>{target?.name}</strong></p>
        <textarea style={{...S.inp,minHeight:100,resize:"vertical",lineHeight:1.6}}
          placeholder="Describe the issue..." value={reason} onChange={e=>setReason(e.target.value)}/>
        <div style={{...S.row(10),marginTop:14}}>
          <button style={S.btn("red",!reason.trim())} disabled={!reason.trim()}
            onClick={()=>reportPlayer(T.code,reportModal,reason,loggedInPlayer?.id)}>Submit</button>
          <button style={S.btn("stone")} onClick={()=>setReportModal(null)}>Cancel</button>
        </div>
      </div></div>
    );
  }

  // ── MATCH CARD ────────────────────────────────────────────────────────────
  function MatchCard({match,tierId,roundIdx,isTop8,isCurrent,tourCode}){
    const tour=master.tournaments[tourCode];if(!tour) return null;
    const gn=id=>tour.players.find(p=>p.id===id)?.name||(id==="BYE"?"BYE":"TBD");
    const ge=id=>tour.players.find(p=>p.id===id)?.elo||"";
    const gtz=id=>tour.players.find(p=>p.id===id)?.timezone;
    const done=match.winner!==null&&match.winner!==undefined;
    const settings=tour.tournaments[tierId]?.settings||DEFAULT_PLACEMENT_SETTINGS;
    const canAdmin=isCurrent&&!done&&match.p2!=="BYE"&&tAdminUnlocked&&!streamPrivacy;
    const p1tz=gtz(match.p1),p2tz=gtz(match.p2);
    return(
      <div style={{padding:"12px",borderRadius:6,background:C.obsidian,
        border:`1px solid ${match.disputed?"#C84A4A":done?C.stone+"66":C.stone}`,marginBottom:0}}>
        {match.disputed&&!done&&(
          <div style={{background:C.ember+"33",border:`1px solid ${C.ember}`,borderRadius:4,
            padding:"6px 10px",marginBottom:8,fontSize:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span>⚠️ DISPUTED</span>
            {tAdminUnlocked&&<button onClick={()=>setDisputeModal({tierId,roundIdx,matchId:match.id,isTop8})}
              style={{...S.btn("red"),fontSize:10,padding:"3px 8px"}}>Resolve</button>}
          </div>
        )}
        <div style={{...S.row(8,"flex-start"),marginBottom:8,flexWrap:"wrap",gap:6}}>
          {match.pickedMap&&<span style={S.badge(C.steel)}>🗺️ {match.pickedMap}</span>}
          {match.lobbyName&&match.lobbyName!=="BYE"&&<span style={S.badge(C.teal)}>🏰 {match.lobbyName}</span>}
          {canAdmin&&!match.pickedMap&&(
            <button onClick={()=>setVetoMatch({tierId,roundIdx,matchId:match.id,isTop8,md:match})}
              style={{fontSize:10,padding:"3px 8px",background:C.steel+"44",border:`1px solid ${C.steel}`,color:C.light,borderRadius:3,cursor:"pointer"}}>
              🗺️ Veto
            </button>
          )}
        </div>
        <div style={S.grid("1fr auto 1fr",8)}>
          {[{id:match.p1,tz:p1tz,rep:match.p1Reported},{id:match.p2,tz:p2tz,rep:match.p2Reported}].map(({id,tz,rep},si)=>(
            <div key={si} style={{padding:"8px 10px",borderRadius:4,
              background:match.winner===id?C.moss+"44":C.parch,
              border:`1px solid ${match.winner===id?C.moss:rep?C.gold+"66":C.stone}`}}>
              <div style={{fontSize:13,fontWeight:"bold"}}>{gn(id)}</div>
              <div style={{fontSize:10,color:C.dim}}>{ge(id)} ELO{tz?` · ${TIMEZONES.find(t=>t.value===tz)?.abbr}`:""}</div>
              {rep&&!done&&<div style={{fontSize:10,color:C.gold,marginTop:2}}>Reported ✓</div>}
              {si===1&&<div/>}
            </div>
          ))}
          <div style={{display:"flex",alignItems:"center",color:C.dim,fontSize:11}}>vs</div>
        </div>
        {canAdmin&&(
          <div style={{...S.row(6),marginTop:8}}>
            <button style={{...S.btn("green"),flex:1,fontSize:11,padding:"6px"}}
              onClick={()=>playerReport(tourCode,tierId,roundIdx,match.id,isTop8,match.p1,match.p1)}>
              🏆 {gn(match.p1)}
            </button>
            <button style={{...S.btn("green"),flex:1,fontSize:11,padding:"6px"}}
              onClick={()=>playerReport(tourCode,tierId,roundIdx,match.id,isTop8,match.p2,match.p2)}>
              🏆 {gn(match.p2)}
            </button>
          </div>
        )}
        {done&&<div style={{marginTop:6,fontSize:12,color:C.gold}}>🏆 {gn(match.winner)}{match.adminResolved?<span style={{color:C.ember,fontSize:10}}> (admin)</span>:""}</div>}
        {match.p2==="BYE"&&<div style={{fontSize:12,color:C.dim,marginTop:6}}>BYE</div>}
        {!done&&match.p2!=="BYE"&&(
          <LobbyBox match={match} p1Name={gn(match.p1)} p2Name={gn(match.p2)} settings={settings} maskPassword={streamPrivacy}/>
        )}
      </div>
    );
  }

  // ── DISCORD EXPORT ────────────────────────────────────────────────────────
  function makeDiscord(code,tierId){
    const tour=master.tournaments[code];if(!tour) return "";
    const bracket=tour.tournaments[tierId];if(!bracket) return "";
    const tier=tour.season.tiers.find(t=>t.id===tierId);
    const gn=id=>tour.players.find(p=>p.id===id)?.name||(id==="BYE"?"BYE":"TBD");
    const lines=[`📣 **${tier?.name} Division ${tier?.icon}** · ${tour.name} · ${tour.season.name}`,
      `> ${bracket.settings?.map||"TBD"} · ${bracket.settings?.resources||"Standard"} · ${bracket.settings?.speed||"Normal"}`,``];
    if(bracket.phase==="swiss"){
      lines.push(`**Standings after Round ${bracket.currentRound}**`);
      tierStand(tierId).slice(0,16).forEach((p,i)=>{
        lines.push(`${i+1}. \`${p.name}\` ${p.swissWins}W-${p.swissLosses}L BH:${p.buchholz} (${p.elo})`);
      });
    }
    if(bracket.phase==="top8"||bracket.phase==="done"){
      lines.push(`\n🏆 **Top 8 Playoff**`);
      ["Quarterfinals","Semifinals","Grand Final 🏆"].forEach((label,ri)=>{
        if(!bracket.top8[ri]) return;
        lines.push(`\n**${label}**`);
        bracket.top8[ri].forEach((m,mi)=>{
          lines.push(`  ${mi+1}. \`${gn(m.p1)}\` vs \`${gn(m.p2)}\` ${m.winner?`→ 🏆 **${gn(m.winner)}**`:"→ TBD"}${m.pickedMap?` [${m.pickedMap}]`:""}`);
        });
      });
    }
    if(bracket.champion) lines.push(`\n👑 **CHAMPION: ${gn(bracket.champion)}**`);
    const totalFee=getTierTotalFee(tour,tierId);
    const tierPrizeFee=getTierPrizeFee(tour,tierId);
    if(totalFee>0) lines.push(`\n💰 Entry: $${totalFee} total (admin $${tour.season.adminFee||0} + prize $${tierPrizeFee})`);
    else lines.push(`\n🆓 This division is FREE to enter.`);
    return lines.join("\n");
  }

  // ── URL HELPER ────────────────────────────────────────────────────────────
  const baseUrl=`${window.location.origin}${window.location.pathname}`;
  const tourUrl=(code)=>`${baseUrl}#/t/${code}`;

  // ── TOURNAMENT STATUS ─────────────────────────────────────────────────────
  // Derives a human status from tournament data: upcoming / open / underway / ended
  // ── PER-TIER PRIZE FEE HELPERS ───────────────────────────────────────────
  // Each tier can have its own prize fee (0 = free for that division).
  // Admin fee stays season-wide (set by the platform organiser).
  function getTierPrizeFee(tour,tierId){
    const tier=tour?.season?.tiers?.find(t=>t.id===tierId);
    return tier?.prizeFee??tour?.season?.prizeFee??0;
  }
  function getPlayerTotalFee(tour,player){
    const adminFee=tour?.season?.adminFee||0;
    const prizeFee=player?.tierId?getTierPrizeFee(tour,player.tierId):(tour?.season?.prizeFee||0);
    return adminFee+prizeFee;
  }
  function getTierTotalFee(tour,tierId){
    return (tour?.season?.adminFee||0)+getTierPrizeFee(tour,tierId);
  }

  // ── HOST KICKBACK HELPERS ─────────────────────────────────────────────────
  // The platform organiser can give a % of collected admin fees back to the
  // tournament's host, as a thank-you/incentive for running their community.
  function getKickbackOwed(tour){
    const pct=tour?.season?.kickbackPercent||0;
    if(pct<=0) return 0;
    const totalAdminFees=(tour?.feeCollected||[]).filter(f=>f.type==="adminFee").reduce((s,f)=>s+f.amount,0);
    return Math.round(totalAdminFees*pct)/100;
  }
  function getKickbackPaid(tour){
    return (tour?.kickbackPayouts||[]).reduce((s,p)=>s+p.amount,0);
  }
  function getKickbackOutstanding(tour){
    return Math.max(0,getKickbackOwed(tour)-getKickbackPaid(tour));
  }

  function getTourStatus(tour){
    const brackets=Object.values(tour.tournaments||{});
    const anyBracketStarted=brackets.length>0;
    const allBracketsDone=anyBracketStarted&&brackets.every(b=>b.phase==="done");
    if(allBracketsDone) return{key:"ended",label:"🏁 Ended",color:C.dim};
    if(anyBracketStarted) return{key:"underway",label:"⚔️ Underway",color:C.gold};
    if(tour.placementMatches?.length>0) return{key:"underway",label:"⚔️ Underway — Placements",color:C.gold};
    if(tour.season.registrationOpen) return{key:"open",label:"📋 Open for Registration",color:C.moss};
    return{key:"upcoming",label:"🕐 Upcoming",color:C.steel};
  }

  // ── HOST CONTACT FORM ─────────────────────────────────────────────────────
  // Sends an email to mlandry2011@gmail.com via Formspree (no backend needed).
  // The sender's email is included as the reply-to and in the message body.
  // Creates a pending ticket in master.tournamentRequests for the platform admin to review,
  // AND sends an email alert via Formspree so the admin is notified immediately.
  async function sendContactRequest(){
    if(!contactForm.email.trim()||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactForm.email)){
      return toast$("Enter a valid email address","error");
    }
    if(!contactForm.desiredName.trim()) return toast$("Enter a tournament/community name","error");
    if(!contactForm.message.trim()) return toast$("Enter a message","error");

    const ticket={
      id:uid(),
      email:contactForm.email.trim(),
      desiredName:contactForm.desiredName.trim(),
      desiredCode:contactForm.desiredCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g,""),
      hostName:contactForm.hostName.trim(),
      message:contactForm.message.trim(),
      status:"pending", // pending | approved | rejected
      createdAt:new Date().toISOString(),
      resolvedAt:null,
    };

    // Save the ticket immediately so it's never lost, even if the email fails
    saveMaster(addMasterLog(`🎫 New tournament request from ${ticket.email} — "${ticket.desiredName}"`,
      {...master,tournamentRequests:[...(master.tournamentRequests||[]),ticket]}));

    // Best-effort email alert — ticket is already saved regardless of this outcome
    try{
      await fetch("https://formspree.io/f/mjgqkpav",{
        method:"POST",
        headers:{"Content-Type":"application/json",Accept:"application/json"},
        body:JSON.stringify({
          email:ticket.email,
          message:`New tournament request ticket!\n\nRequester email: ${ticket.email}\nDesired tournament name: ${ticket.desiredName}\nDesired code: ${ticket.desiredCode||"(not specified)"}\nHost/Discord server name: ${ticket.hostName||"(not specified)"}\n\nMessage:\n${ticket.message}\n\nReview and approve/reject this request in your Platform Admin → Requests tab.`,
          _subject:"AOE2",
          _replyto:ticket.email,
        }),
      });
    } catch{
      // Email alert failed, but the ticket itself is safely saved — admin will still see it in Requests tab
    }

    setContactSent(true);
    toast$("Request submitted!");
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  // ── LANDING PAGE ──────────────────────────────────────────────────────────
  if(route.type==="landing"){
    return(
      <div className="aoe2-fade-in" style={{minHeight:"100vh",background:`radial-gradient(ellipse at top,#1A0E00,${C.obsidian})`,
        color:C.light,fontFamily:"Georgia,serif",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 20px"}}>
        <GlobalStyle/>
        <div style={{fontSize:60,marginBottom:16,filter:`drop-shadow(0 0 20px ${C.gold}33)`}}>⚔️</div>
        <h1 style={{color:C.gold,fontSize:30,letterSpacing:4,textTransform:"uppercase",margin:"0 0 8px",textAlign:"center",
          textShadow:`0 0 30px ${C.gold}44`}}>
          AoE2 Tournament Agent
        </h1>
        <p style={{color:C.dim,fontSize:14,textAlign:"center",maxWidth:500,lineHeight:1.7,marginBottom:24}}>
          One platform hosting AoE2 community tournaments for multiple Discord servers worldwide. Each community gets their own tournament with custom divisions, entry fees, and prize pools.
        </p>
        {/* Host CTA */}
        <div style={{background:C.gold+"18",border:`1px solid ${C.gold}55`,borderRadius:8,
          padding:"14px 24px",marginBottom:28,textAlign:"center",maxWidth:480,boxShadow:`0 4px 18px #00000033`}}>
          <div style={{color:C.gold,fontWeight:"bold",fontSize:14,marginBottom:6}}>
            🏆 Want to host a tournament for your Discord server?
          </div>
          <div style={{color:C.dim,fontSize:13,lineHeight:1.6,marginBottom:10}}>
            Submit a request and we'll review it and follow up by email.
          </div>
          <button onClick={()=>{setContactModal(true);setContactSent(false);}} style={{...S.btn("gold"),fontSize:12}}>
            🎫 Request a Tournament
          </button>
        </div>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",justifyContent:"center",marginBottom:40}}>
          <a href="#/admin" style={{...S.btn("stone"),textDecoration:"none",display:"inline-block",fontSize:11}}>
            ⚙️ Platform Admin
          </a>
        </div>
        {Object.keys(master.tournaments).length>0&&(
          <div style={{width:"100%",maxWidth:760}}>
            <div style={{color:C.dim,fontSize:11,letterSpacing:2,textTransform:"uppercase",textAlign:"center",marginBottom:16}}>
              Active Tournaments
            </div>
            <div style={S.grid("1fr 1fr",12)}>
              {Object.values(master.tournaments).map(tour=>{
                const tourPrizePaid=(tour.feeCollected||[]).filter(f=>f.type==="prizeFee").reduce((s,f)=>s+f.amount,0);
                const status=getTourStatus(tour);
                return(
                  <a key={tour.code} href={`#/t/${tour.code}`} className="aoe2-card-link" style={{
                    ...S.card,textDecoration:"none",color:C.light,
                    border:`1px solid ${C.gold}44`,cursor:"pointer",
                    transition:"border-color .2s, transform .2s, box-shadow .2s",display:"block",marginBottom:0,
                  }}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:4}}>
                      <div style={{color:C.gold,fontSize:16,fontWeight:"bold"}}>{tour.name}</div>
                      <span style={S.badge(status.color)}>{status.label}</span>
                    </div>
                    <div style={{color:C.dim,fontSize:12,marginBottom:8}}>{tour.season.name} · {tour.hostName||"Community"}</div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      <span style={S.badge(C.teal)}>⚔️ {tour.players.filter(p=>!p.banned).length} players</span>
                      <span style={S.badge(C.gold)}>🏅 {tour.season.tiers.length} divisions</span>
                      {tour.season.tiers.some(t=>(t.prizeFee??tour.season.prizeFee??0)>0)&&(
                        <span style={S.badge(C.moss)}>🏆 ${tourPrizePaid} prize pool</span>
                      )}
                    </div>
                    <div style={{color:C.teal,fontSize:11,marginTop:10}}>{tourUrl(tour.code)}</div>
                  </a>
                );
              })}
            </div>
          </div>
        )}
        {toast&&(
          <div className="aoe2-toast" style={{position:"fixed",top:16,right:16,zIndex:400,padding:"12px 20px",borderRadius:6,
            fontSize:13,fontWeight:"bold",background:toast.type==="error"?C.ember:C.moss,color:C.light}}>
            {toast.msg}
          </div>
        )}

        {/* Contact modal */}
        {contactModal&&(
          <div style={S.modal}>
            <div style={{...S.card,maxWidth:480,width:"90%",maxHeight:"85vh",overflowY:"auto"}}>
              {contactSent?(
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:40,marginBottom:10}}>✅</div>
                  <div style={{color:C.gold,fontWeight:"bold",fontSize:16,marginBottom:8}}>Request Submitted!</div>
                  <p style={{color:C.dim,fontSize:13,marginBottom:16}}>
                    Your tournament request has been received and is pending review. We'll get back to you at {contactForm.email}.
                  </p>
                  <button style={S.btn("gold")} onClick={()=>{setContactModal(false);setContactForm({email:"",desiredName:"",desiredCode:"",hostName:"",message:""});}}>Close</button>
                </div>
              ):(
                <>
                  <div style={S.cardT}>🎫 Request a Tournament</div>
                  <p style={{color:C.dim,fontSize:12,marginBottom:14,lineHeight:1.6}}>
                    Submit a request to host a tournament for your Discord community. We'll review it and follow up by email.
                  </p>
                  <div style={{marginBottom:12}}>
                    <label style={S.lbl}>Your Email Address</label>
                    <input style={S.inp} type="email" placeholder="your@email.com"
                      value={contactForm.email} onChange={e=>setContactForm(f=>({...f,email:e.target.value}))}/>
                  </div>
                  <div style={S.grid("1fr 1fr",10)}>
                    <div>
                      <label style={S.lbl}>Desired Tournament Name</label>
                      <input style={S.inp} placeholder="e.g. North America Kings"
                        value={contactForm.desiredName} onChange={e=>setContactForm(f=>({...f,desiredName:e.target.value}))}/>
                    </div>
                    <div>
                      <label style={S.lbl}>Desired Code (optional)</label>
                      <input style={S.inp} placeholder="e.g. NA-KINGS"
                        value={contactForm.desiredCode} onChange={e=>setContactForm(f=>({...f,desiredCode:e.target.value.toUpperCase()}))}/>
                    </div>
                  </div>
                  <div style={{marginTop:12,marginBottom:12}}>
                    <label style={S.lbl}>Discord Server / Community Name</label>
                    <input style={S.inp} placeholder="e.g. NA AoE2 Community"
                      value={contactForm.hostName} onChange={e=>setContactForm(f=>({...f,hostName:e.target.value}))}/>
                  </div>
                  <div style={{marginBottom:14}}>
                    <label style={S.lbl}>Message</label>
                    <textarea style={{...S.inp,minHeight:100,resize:"vertical",lineHeight:1.6}}
                      placeholder="Tell us about your Discord community and what you're looking for..."
                      value={contactForm.message} onChange={e=>setContactForm(f=>({...f,message:e.target.value}))}/>
                  </div>
                  <div style={{color:C.dim,fontSize:11,marginBottom:14}}>
                    This will be submitted as a request for review, and an email alert with subject line <strong style={{color:C.light}}>AOE2</strong> will be sent including your address so we can reply.
                  </div>
                  <div style={S.row(10)}>
                    <button style={S.btn("gold")} onClick={sendContactRequest}>Submit Request</button>
                    <button style={S.btn("stone")} onClick={()=>setContactModal(false)}>Cancel</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── SUPER ADMIN VIEW ──────────────────────────────────────────────────────
  if(route.type==="superadmin"){
    return(
      <div className="aoe2-fade-in" style={{minHeight:"100vh",background:`radial-gradient(ellipse at top,#1A0E00,${C.obsidian})`,
        color:C.light,fontFamily:"Georgia,serif",paddingBottom:60}}>
        <GlobalStyle/>
        <div style={{position:"sticky",top:0,zIndex:50,background:`linear-gradient(180deg,${C.obsidian},${C.parch})`,
          borderBottom:`2px solid ${C.gold}`,padding:"16px 24px",display:"flex",alignItems:"center",gap:16,
          boxShadow:"0 4px 14px #00000044"}}>
          <div style={{flex:1}}>
            <div style={{fontSize:22,color:C.gold,fontWeight:"bold",letterSpacing:3}}>⚔️ PLATFORM ADMIN</div>
            <div style={{color:C.dim,fontSize:11,marginTop:2}}>
              {Object.keys(master.tournaments).length} tournaments
            </div>
          </div>
          <a href="#/" style={{...S.btn("stone"),fontSize:11,textDecoration:"none"}}>← Back to Landing</a>
        </div>

        {!superUnlocked?(
          <div style={{maxWidth:380,margin:"80px auto 0"}}>
            <div style={{...S.card,textAlign:"center"}}>
              <div style={{fontSize:44,marginBottom:12}}>🔒</div>
              <div style={S.cardT}>Platform Admin Login</div>
              <input style={{...S.inp,textAlign:"center",letterSpacing:4,fontSize:16,marginBottom:superPwError?8:14}}
                type="password" placeholder="Master password" value={superPwInput} autoFocus
                onChange={e=>{setSuperPwInput(e.target.value);setSuperPwError(false);}}
                onKeyDown={e=>e.key==="Enter"&&trySuper()}/>
              {superPwError&&<div style={{color:C.ember,fontSize:12,marginBottom:12}}>✕ Incorrect</div>}
              <button style={S.btn("gold")} onClick={trySuper}>Unlock</button>
            </div>
          </div>
        ):(
          <div style={{maxWidth:1100,margin:"0 auto",padding:"24px 16px"}}>
            <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
              {[["dashboard","📊 Dashboard"],["requests",`🎫 Requests${(master.tournamentRequests||[]).filter(t=>t.status==="pending").length>0?` (${(master.tournamentRequests||[]).filter(t=>t.status==="pending").length})`:""}`],["tournaments","🏆 Tournaments"],["fees","💰 Fees"],["settings","⚙️ Settings"],["log","📜 Log"]].map(([k,l])=>(
                <button key={k} style={S.btn(superTab===k?"gold":"stone")} onClick={()=>setSuperTab(k)}>{l}</button>
              ))}
              <div style={{flex:1}}/>
              <button style={S.btn("green")} onClick={()=>{
                setNewTourForm({code:"",name:"",hostName:"",adminPassword:"",adminFee:5,kickbackPercent:0});
                setNewTourModal(true);
              }}>+ New Tournament</button>
              <button style={{...S.btn("stone"),fontSize:11}} onClick={()=>setSuperUnlocked(false)}>🔒 Lock</button>
            </div>

            {/* DASHBOARD */}
            {superTab==="dashboard"&&(()=>{
              const totalAdminFees=Object.values(master.tournaments).reduce((s,t)=>
                s+(t.feeCollected||[]).filter(f=>f.type==="adminFee").reduce((ss,f)=>ss+f.amount,0),0);
              const totalPrizePools=Object.values(master.tournaments).reduce((s,t)=>
                s+(t.feeCollected||[]).filter(f=>f.type==="prizeFee").reduce((ss,f)=>ss+f.amount,0),0);
              const pendingRequests=(master.tournamentRequests||[]).filter(t=>t.status==="pending").length;
              return(
              <div>
                <div style={S.grid("repeat(6,1fr)",14)}>
                  {[
                    ["🏆",Object.keys(master.tournaments).length,"Tournaments",null],
                    ["🎫",pendingRequests,"Pending Requests","requests"],
                    ["👥",Object.values(master.tournaments).reduce((s,t)=>s+t.players.filter(p=>!p.banned).length,0),"Total Players",null],
                    ["🏆",`$${totalPrizePools}`,"Total Prize Pools",null],
                    ["💰",`$${totalAdminFees}`,"Your Profit (private)",null],
                    ["⚠️",Object.values(master.tournaments).reduce((s,t)=>s+(t.placementMatches||[]).filter(m=>m.disputed&&!m.reported).length+Object.values(t.tournaments||{}).reduce((ss,b)=>ss+(b.swissRounds||[]).flatMap(r=>r).filter(m=>m.disputed&&!m.reported).length,0),0),"Open Disputes",null],
                  ].map(([icon,val,label,jumpTo])=>(
                    <div key={label} onClick={jumpTo?()=>setSuperTab(jumpTo):undefined}
                      style={{...S.card,textAlign:"center",marginBottom:0,cursor:jumpTo?"pointer":"default",
                        border:jumpTo&&pendingRequests>0?`1px solid ${C.gold}66`:undefined}}>
                      <div style={{fontSize:24,marginBottom:4}}>{icon}</div>
                      <div style={{color:C.gold,fontSize:20,fontWeight:"bold"}}>{val}</div>
                      <div style={{color:C.dim,fontSize:10,marginTop:2}}>{label}</div>
                    </div>
                  ))}
                </div>
                <div style={{...S.card,marginTop:14}}>
                  <div style={S.cardT}>📊 Tournament Overview</div>
                  {Object.values(master.tournaments).map(tour=>(
                    <div key={tour.code} style={{...S.row(12),padding:"12px",borderRadius:6,
                      background:C.obsidian,border:`1px solid ${C.stone}`,marginBottom:8,flexWrap:"wrap"}}>
                      <div style={{flex:1,minWidth:200}}>
                        <div style={{fontWeight:"bold",color:C.gold}}>{tour.name}
                          <span style={{...S.badge(C.steel),marginLeft:8,fontSize:10}}>{tour.code}</span>
                        </div>
                        <div style={{color:C.dim,fontSize:11,marginTop:2}}>
                          {tour.hostName||"No host"} · {tour.players.filter(p=>!p.banned).length} players · {tour.season.name}
                        </div>
                        <div style={{color:C.teal,fontSize:11,marginTop:2,cursor:"pointer"}}
                          onClick={()=>navigator.clipboard.writeText(tourUrl(tour.code)).then(()=>toast$("URL copied!"))}>
                          📋 {tourUrl(tour.code)}
                        </div>
                      </div>
                      <div style={S.row(8)}>
                        <a href={`#/t/${tour.code}`} style={{...S.btn("gold"),textDecoration:"none",fontSize:11,padding:"6px 12px"}}>Open →</a>
                        <button style={{...S.btn("red"),fontSize:11,padding:"6px 12px"}} onClick={()=>deleteTournament(tour.code)}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              );
            })()}

            {/* REQUESTS */}
            {superTab==="requests"&&(()=>{
              const requests=[...(master.tournamentRequests||[])].sort((a,b)=>
                new Date(b.createdAt)-new Date(a.createdAt));
              const pending=requests.filter(t=>t.status==="pending");
              const resolved=requests.filter(t=>t.status!=="pending");
              return(
              <div>
                <div style={S.card}>
                  <div style={S.cardT}>🎫 Tournament Requests
                    <span style={{...S.badge(C.gold),marginLeft:10,fontSize:11}}>{pending.length} pending</span>
                  </div>
                  {requests.length===0&&<p style={{color:C.dim}}>No requests yet. They'll appear here when someone submits the "Request a Tournament" form on the landing page.</p>}

                  {pending.length>0&&(
                    <div style={{marginBottom:20}}>
                      <div style={{color:C.gold,fontSize:12,letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>Pending Review</div>
                      {pending.map(t=>(
                        <div key={t.id} style={{padding:"14px",borderRadius:6,background:C.gold+"0F",
                          border:`1px solid ${C.gold}44`,marginBottom:10}}>
                          <div style={{...S.row(10,"flex-start"),flexWrap:"wrap",marginBottom:8}}>
                            <div style={{flex:1}}>
                              <div style={{color:C.gold,fontWeight:"bold",fontSize:15}}>{t.desiredName}</div>
                              <div style={{color:C.dim,fontSize:12,marginTop:2}}>
                                {t.email} {t.hostName&&`· ${t.hostName}`} {t.desiredCode&&`· Code: ${t.desiredCode}`}
                              </div>
                              <div style={{color:C.dim,fontSize:11,marginTop:2}}>{new Date(t.createdAt).toLocaleString()}</div>
                            </div>
                            <div style={S.row(8)}>
                              <button style={S.btn("green")} onClick={()=>approveTicket(t.id)}>✓ Approve</button>
                              <button style={S.btn("red")} onClick={()=>rejectTicket(t.id)}>✕ Reject</button>
                            </div>
                          </div>
                          <div style={{color:C.light,fontSize:13,lineHeight:1.6,padding:"10px",background:C.obsidian,borderRadius:4}}>
                            {t.message}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {resolved.length>0&&(
                    <div>
                      <div style={{color:C.dim,fontSize:12,letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>Resolved</div>
                      {resolved.map(t=>(
                        <div key={t.id} style={{...S.row(10),padding:"10px 12px",borderRadius:6,
                          background:C.obsidian,border:`1px solid ${C.stone}`,marginBottom:6,flexWrap:"wrap"}}>
                          <span style={S.badge(t.status==="approved"?C.moss:C.ember)}>
                            {t.status==="approved"?"✓ Approved":"✕ Rejected"}
                          </span>
                          <div style={{flex:1,minWidth:160}}>
                            <div style={{fontSize:13,fontWeight:"bold"}}>{t.desiredName}</div>
                            <div style={{color:C.dim,fontSize:11}}>{t.email}</div>
                          </div>
                          <span style={{color:C.dim,fontSize:11}}>{new Date(t.resolvedAt||t.createdAt).toLocaleDateString()}</span>
                          <button style={{...S.btn("stone"),fontSize:10,padding:"4px 8px"}} onClick={()=>deleteTicket(t.id)}>🗑️</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              );
            })()}

            {/* TOURNAMENTS */}
            {superTab==="tournaments"&&(
              <div>
                {Object.values(master.tournaments).map(tour=>(
                  <div key={tour.code} style={S.card}>
                    <div style={{...S.row(10),marginBottom:12,flexWrap:"wrap"}}>
                      <div style={{flex:1}}>
                        <div style={{color:C.gold,fontSize:18,fontWeight:"bold"}}>{tour.name}
                          <span style={{...S.badge(C.steel),marginLeft:8}}>{tour.code}</span>
                        </div>
                        <div style={{color:C.dim,fontSize:12,marginTop:2}}>Host: {tour.hostName||"—"} · Created {new Date(tour.createdAt).toLocaleDateString()}</div>
                      </div>
                      <div style={S.row(8)}>
                        <a href={`#/t/${tour.code}`} style={{...S.btn("gold"),textDecoration:"none",fontSize:11}}>Open Tournament</a>
                        <button style={S.btn("red")} onClick={()=>deleteTournament(tour.code)}>Delete</button>
                      </div>
                    </div>
                    <div style={S.grid("1fr 1fr 1fr",10)}>
                      <div style={{padding:"10px",background:C.obsidian,borderRadius:6}}>
                        <div style={{color:C.dim,fontSize:10,marginBottom:4}}>TOURNAMENT URL</div>
                        <div style={{color:C.teal,fontSize:11,wordBreak:"break-all",cursor:"pointer"}}
                          onClick={()=>navigator.clipboard.writeText(tourUrl(tour.code)).then(()=>toast$("Copied!"))}>
                          {tourUrl(tour.code)}
                        </div>
                        <button style={{...S.btn("teal"),fontSize:10,padding:"4px 8px",marginTop:6}}
                          onClick={()=>navigator.clipboard.writeText(tourUrl(tour.code)).then(()=>toast$("URL copied!"))}>
                          📋 Copy URL
                        </button>
                      </div>
                      <div style={{padding:"10px",background:C.obsidian,borderRadius:6}}>
                        <div style={{color:C.dim,fontSize:10,marginBottom:4}}>TOURNAMENT ADMIN PASSWORD</div>
                        <div style={{fontFamily:"monospace",color:C.gold,fontSize:14}}>{tour.adminPasswordPlain||"(hashed)"}</div>
                        <button style={{...S.btn("steel"),fontSize:10,padding:"4px 8px",marginTop:6}}
                          onClick={()=>setChangePwModal({
                            label:`Change ${tour.name} Admin Password`,
                            onSave:(pw)=>saveTour(tour.code,t=>({...t,adminPassword:pwHash(pw),adminPasswordPlain:pw}),`🔑 Admin password changed`)
                          })}>
                          🔑 Change Password
                        </button>
                      </div>
                      <div style={{padding:"10px",background:C.obsidian,borderRadius:6}}>
                        <div style={{color:C.dim,fontSize:10,marginBottom:4}}>PLATFORM ADMIN FEE (your cut)</div>
                        <div style={{display:"flex",gap:8,alignItems:"center"}}>
                          <span style={{color:C.gold,fontSize:18,fontWeight:"bold"}}>${tour.season.adminFee||0}</span>
                          <span style={{color:C.dim,fontSize:11}}>per player</span>
                        </div>
                        <div style={{display:"flex",gap:6,marginTop:8,alignItems:"center"}}>
                          <input type="number" min={0} defaultValue={tour.season.adminFee||0}
                            style={{...S.inp,width:80,padding:"5px 8px",fontSize:12}}
                            onBlur={e=>{
                              const v=Number(e.target.value)||0;
                              saveTour(tour.code,t=>({...t,season:{...t.season,adminFee:v}}),`💰 Admin fee updated to $${v}`);
                              toast$(`Admin fee set to $${v}`);
                            }}/>
                          <span style={{color:C.dim,fontSize:11}}>$ — edit &amp; click away to save</span>
                        </div>
                        <div style={{color:C.dim,fontSize:10,marginTop:4}}>Only you (super admin) can change this.</div>
                      </div>
                    </div>

                    {/* Host kickback */}
                    {(()=>{
                      const owed=getKickbackOwed(tour);
                      const paid=getKickbackPaid(tour);
                      const outstanding=getKickbackOutstanding(tour);
                      return(
                        <div style={{marginTop:10,padding:"12px",background:C.purple+"14",border:`1px solid ${C.purple}44`,borderRadius:6}}>
                          <div style={{color:C.purple,fontSize:11,letterSpacing:1,textTransform:"uppercase",marginBottom:8,fontWeight:"bold"}}>
                            💸 Host Kickback — Profit Share
                          </div>
                          <div style={S.grid("1fr 1fr 1fr 1fr",10)}>
                            <div>
                              <label style={S.lbl}>Kickback %</label>
                              <input type="number" min={0} max={100} defaultValue={tour.season.kickbackPercent||0}
                                style={{...S.inp,padding:"6px 8px",fontSize:12}}
                                onBlur={e=>{
                                  const v=Number(e.target.value)||0;
                                  saveTour(tour.code,t=>({...t,season:{...t.season,kickbackPercent:v}}),`💸 Kickback % updated to ${v}%`);
                                  toast$(`Kickback set to ${v}%`);
                                }}/>
                            </div>
                            <div>
                              <div style={{color:C.dim,fontSize:10,marginBottom:5}}>OWED TOTAL</div>
                              <div style={{color:C.gold,fontSize:15,fontWeight:"bold"}}>${owed.toFixed(2)}</div>
                            </div>
                            <div>
                              <div style={{color:C.dim,fontSize:10,marginBottom:5}}>PAID SO FAR</div>
                              <div style={{color:C.moss,fontSize:15,fontWeight:"bold"}}>${paid.toFixed(2)}</div>
                            </div>
                            <div>
                              <div style={{color:C.dim,fontSize:10,marginBottom:5}}>OUTSTANDING</div>
                              <div style={{color:outstanding>0?C.ember:C.dim,fontSize:15,fontWeight:"bold"}}>${outstanding.toFixed(2)}</div>
                            </div>
                          </div>
                          {outstanding>0&&(
                            <button style={{...S.btn("purple"),marginTop:10,fontSize:11}}
                              onClick={()=>setKickbackPayoutModal({code:tour.code,suggested:outstanding})}>
                              💸 Record Payout to Host
                            </button>
                          )}
                          {(tour.kickbackPayouts||[]).length>0&&(
                            <div style={{marginTop:10}}>
                              <div style={{color:C.dim,fontSize:10,letterSpacing:1,marginBottom:4}}>PAYOUT HISTORY</div>
                              {tour.kickbackPayouts.map(p=>(
                                <div key={p.id} style={{...S.row(8),fontSize:11,padding:"4px 0",color:C.dim}}>
                                  <span style={{color:C.light,fontWeight:"bold"}}>${p.amount.toFixed(2)}</span>
                                  <span>{new Date(p.paidAt).toLocaleDateString()}</span>
                                  {p.note&&<span>· {p.note}</span>}
                                  <span style={{flex:1}}/>
                                  <button style={{...S.btn("stone"),fontSize:9,padding:"2px 6px"}}
                                    onClick={()=>deleteKickbackPayout(tour.code,p.id)}>✕</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            )}

            {/* FEES */}
            {superTab==="fees"&&(()=>{
              const totalAdminFees=Object.values(master.tournaments).reduce((s,t)=>
                s+(t.feeCollected||[]).filter(f=>f.type==="adminFee").reduce((ss,f)=>ss+f.amount,0),0);
              const totalPrizeFees=Object.values(master.tournaments).reduce((s,t)=>
                s+(t.feeCollected||[]).filter(f=>f.type==="prizeFee").reduce((ss,f)=>ss+f.amount,0),0);
              const totalKickbackOwed=Object.values(master.tournaments).reduce((s,t)=>s+getKickbackOwed(t),0);
              const totalKickbackPaid=Object.values(master.tournaments).reduce((s,t)=>s+getKickbackPaid(t),0);
              const netProfit=totalAdminFees-totalKickbackOwed;
              return(
              <div>
                <div style={S.card}>
                  <div style={S.cardT}>💰 Platform Revenue — Confidential</div>
                  <div style={{background:C.ember+"18",border:`1px solid ${C.ember}44`,borderRadius:6,
                    padding:"10px 14px",marginBottom:16,fontSize:12,color:C.light}}>
                    🔒 This data is only visible behind your super admin password. Tournament admins and players never see your profit figures.
                  </div>
                  <div style={{...S.grid("1fr 1fr 1fr",14),marginBottom:14}}>
                    {[
                      ["Gross Admin Fee Revenue",`$${totalAdminFees}`,C.gold],
                      ["Total Prize Fees (hosts' money)",`$${totalPrizeFees}`,C.moss],
                      ["Tournaments with Fees",Object.values(master.tournaments).filter(t=>(t.season.adminFee||0)>0).length,C.teal],
                    ].map(([label,val,color])=>(
                      <div key={label} style={{padding:"14px",background:C.obsidian,borderRadius:6,border:`1px solid ${color}44`}}>
                        <div style={{color,fontSize:22,fontWeight:"bold"}}>{val}</div>
                        <div style={{color:C.dim,fontSize:11,marginTop:4}}>{label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{...S.grid("1fr 1fr 1fr",14),marginBottom:20}}>
                    {[
                      ["Kickback Owed to Hosts",`$${totalKickbackOwed.toFixed(2)}`,C.purple],
                      ["Kickback Paid Out",`$${totalKickbackPaid.toFixed(2)}`,C.moss],
                      ["Your Net Profit (after kickback)",`$${netProfit.toFixed(2)}`,C.gold],
                    ].map(([label,val,color])=>(
                      <div key={label} style={{padding:"14px",background:C.obsidian,borderRadius:6,border:`1px solid ${color}44`}}>
                        <div style={{color,fontSize:22,fontWeight:"bold"}}>{val}</div>
                        <div style={{color:C.dim,fontSize:11,marginTop:4}}>{label}</div>
                      </div>
                    ))}
                  </div>
                  {Object.values(master.tournaments).map(tour=>{
                    const tourAdminTotal=(tour.feeCollected||[]).filter(f=>f.type==="adminFee").reduce((s,f)=>s+f.amount,0);
                    const tourPrizeTotal=(tour.feeCollected||[]).filter(f=>f.type==="prizeFee").reduce((s,f)=>s+f.amount,0);
                    const tourKickbackOwed=getKickbackOwed(tour);
                    const tourKickbackOutstanding=getKickbackOutstanding(tour);
                    return(
                    <div key={tour.code} style={{marginBottom:20}}>
                      <div style={{...S.row(10),marginBottom:8,flexWrap:"wrap"}}>
                        <span style={{color:C.gold,fontWeight:"bold"}}>{tour.name} ({tour.code})</span>
                        <span style={S.badge(C.gold)}>${tourAdminTotal} your profit</span>
                        <span style={S.badge(C.moss)}>${tourPrizeTotal} prize pool</span>
                        {tour.season.kickbackPercent>0&&(
                          <span style={S.badge(C.purple)}>
                            💸 {tour.season.kickbackPercent}% kickback — ${tourKickbackOwed.toFixed(2)} owed
                            {tourKickbackOutstanding>0?` ($${tourKickbackOutstanding.toFixed(2)} unpaid)`:" (paid in full)"}
                          </span>
                        )}
                      </div>
                      {(tour.feeCollected||[]).length===0
                        ?<div style={{color:C.dim,fontSize:12}}>No fees collected yet</div>
                        :(tour.feeCollected||[]).map(f=>(
                          <div key={f.id} style={{...S.row(10),padding:"8px 10px",borderRadius:4,
                            background:C.obsidian,border:`1px solid ${C.stone}`,marginBottom:4}}>
                            <span style={S.badge(f.type==="adminFee"?C.gold:C.moss)}>
                              {f.type==="adminFee"?"Admin Fee":"Prize Fee"}
                            </span>
                            <span style={{flex:1,fontSize:12}}>{f.name} {f.discord?`(${f.discord})`:""}</span>
                            <span style={{color:C.gold,fontWeight:"bold"}}>${f.amount}</span>
                            <span style={{color:C.dim,fontSize:11}}>{new Date(f.paidAt).toLocaleDateString()}</span>
                          </div>
                        ))
                      }
                    </div>
                    );
                  })}
                </div>
              </div>
              );
            })()}

            {/* SETTINGS */}
            {superTab==="settings"&&(
              <div style={S.card}>
                <div style={S.cardT}>⚙️ Platform Settings</div>

                {/* Cloud storage status */}
                <div style={{padding:"14px",background:JSONBIN_KEY?C.moss+"22":C.ember+"22",
                  border:`1px solid ${JSONBIN_KEY?C.moss:C.ember}`,borderRadius:6,marginBottom:16}}>
                  <div style={{fontWeight:"bold",color:JSONBIN_KEY?C.moss:C.ember,marginBottom:6}}>
                    {JSONBIN_KEY?"☁️ Cloud Storage: CONNECTED":"⚠️ Cloud Storage: NOT CONFIGURED"}
                  </div>
                  {JSONBIN_KEY?(
                    <div style={{color:C.dim,fontSize:12,lineHeight:1.7}}>
                      Tournament data saves to JSONBin cloud. All browsers and devices see the same data.
                      Bin ID: <code style={{color:C.light}}>{JSONBIN_BIN}</code>
                    </div>
                  ):(
                    <div style={{color:C.dim,fontSize:12,lineHeight:1.7}}>
                      Data is only saved in this browser's localStorage. Other browsers and devices cannot see your tournaments.
                      <br/><strong style={{color:C.light}}>To fix:</strong> Add <code>VITE_JSONBIN_KEY</code> and <code>VITE_JSONBIN_BIN</code> environment variables in Railway (see setup guide below).
                    </div>
                  )}
                </div>

                {/* JSONBin setup guide */}
                {!JSONBIN_KEY&&(
                  <div style={{padding:"14px",background:C.obsidian,border:`1px solid ${C.stone}`,borderRadius:6,marginBottom:16,fontSize:12,lineHeight:1.8}}>
                    <div style={{color:C.gold,fontWeight:"bold",marginBottom:8}}>📋 How to set up cloud storage (5 minutes, free):</div>
                    {[
                      <>Go to <strong style={{color:C.gold}}>https://jsonbin.io</strong> and create a free account.</>,
                      <>Click <strong>API Keys</strong> in the top menu. Copy your <strong>Master Key</strong>.</>,
                      <>Click <strong>Bins</strong> → <strong>Create Bin</strong>. Paste <code style={{background:C.stone,padding:"1px 4px",borderRadius:2}}>{"{ }"}</code> as the content. Click Create. Copy the <strong>Bin ID</strong> from the URL.</>,
                      <>In Railway: open your service → <strong>Variables</strong> tab → Add Variable:</>,
                      <><code style={{background:C.stone,padding:"2px 6px",borderRadius:2}}>VITE_JSONBIN_KEY</code> = your Master Key</>,
                      <><code style={{background:C.stone,padding:"2px 6px",borderRadius:2}}>VITE_JSONBIN_BIN</code> = your Bin ID</>,
                      <>Click <strong>Deploy</strong>. Railway rebuilds automatically. Refresh this page — cloud status turns green.</>,
                    ].map((step,i)=>(
                      <div key={i} style={{display:"flex",gap:10,marginBottom:4}}>
                        <span style={{color:C.gold,minWidth:20,fontWeight:"bold"}}>{i+1}.</span>
                        <span style={{color:C.light}}>{step}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{padding:"14px",background:C.obsidian,borderRadius:6,marginBottom:14}}>
                  <div style={{color:C.gold,fontWeight:"bold",marginBottom:8}}>Master (Super Admin) Password</div>
                  <button style={S.btn("gold")} onClick={()=>setChangePwModal({
                    label:"Change Master Admin Password",
                    onSave:(pw)=>{
                      saveMaster({...master,superAdminPassword:pw});
                      try{localStorage.setItem(SUPER_PW_KEY,pw);}catch{}
                      toast$("Master password changed");
                    }
                  })}>Change Master Password</button>
                </div>
                <div style={{padding:"14px",background:C.obsidian,borderRadius:6,marginBottom:14}}>
                  <div style={{color:C.gold,fontWeight:"bold",marginBottom:8}}>💾 Backup & Restore</div>
                  <div style={S.row(10)}>
                    <button style={S.btn("steel")} onClick={()=>{
                      const blob=new Blob([JSON.stringify(master,null,2)],{type:"application/json"});
                      const url=URL.createObjectURL(blob);
                      const a=document.createElement("a");a.href=url;
                      a.download=`aoe2-master-backup-${Date.now()}.json`;a.click();
                      toast$("Master backup downloaded!");
                    }}>💾 Export Master Backup</button>
                    <button style={S.btn("steel")} onClick={()=>{
                      const input=document.createElement("input");input.type="file";input.accept=".json";
                      input.onchange=e=>{
                        const file=e.target.files[0];if(!file) return;
                        const reader=new FileReader();
                        reader.onload=ev=>{try{saveMaster(JSON.parse(ev.target.result));toast$("Restored!");}catch{toast$("Invalid file","error");}};
                        reader.readAsText(file);
                      };input.click();
                    }}>📂 Restore Backup</button>
                  </div>
                </div>
              </div>
            )}

            {/* LOG */}
            {superTab==="log"&&(
              <div style={S.card}>
                <div style={S.cardT}>📜 Platform Log</div>
                {(master.log||[]).map((e,i)=>(
                  <div key={i} style={{padding:"7px 10px",fontSize:12,borderBottom:`1px solid ${C.stone}22`,color:i===0?C.light:C.dim}}>{e}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* New Tournament Modal */}
        {newTourModal&&(
          <div style={S.modal}>
            <div style={{...S.card,maxWidth:480,width:"90%"}}>
              <div style={S.cardT}>+ Create New Tournament</div>
                <div style={S.grid("1fr 1fr",12)}>
                <div><label style={S.lbl}>Tournament Code (URL slug)</label>
                  <input style={S.inp} placeholder="e.g. NA-KINGS" value={newTourForm.code}
                    onChange={e=>setNewTourForm(f=>({...f,code:e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g,"")}))}/></div>
                <div><label style={S.lbl}>Tournament Name</label>
                  <input style={S.inp} placeholder="e.g. North America Kings" value={newTourForm.name}
                    onChange={e=>setNewTourForm(f=>({...f,name:e.target.value}))}/></div>
                <div><label style={S.lbl}>Host / Discord Server Name</label>
                  <input style={S.inp} placeholder="e.g. NA AoE2 Community" value={newTourForm.hostName}
                    onChange={e=>setNewTourForm(f=>({...f,hostName:e.target.value}))}/></div>
                <div><label style={S.lbl}>Tournament Admin Password</label>
                  <input style={S.inp} type="password" placeholder="Leave blank for 'changeme'" value={newTourForm.adminPassword}
                    onChange={e=>setNewTourForm(f=>({...f,adminPassword:e.target.value}))}/></div>
                <div>
                  <label style={S.lbl}>Platform Admin Fee ($ per player)</label>
                  <input style={S.inp} type="number" min={0} value={newTourForm.adminFee}
                    onChange={e=>setNewTourForm(f=>({...f,adminFee:e.target.value}))}/>
                  <div style={{color:C.dim,fontSize:10,marginTop:3}}>This is your cut per player. Only you can set this.</div>
                </div>
                <div>
                  <label style={S.lbl}>Host Kickback (% of admin fee)</label>
                  <input style={S.inp} type="number" min={0} max={100} value={newTourForm.kickbackPercent}
                    onChange={e=>setNewTourForm(f=>({...f,kickbackPercent:e.target.value}))}/>
                  <div style={{color:C.dim,fontSize:10,marginTop:3}}>% of your admin fee paid back to this host as a hosting bonus. 0 = none.</div>
                </div>
                </div>
              {newTourForm.code&&(
                <div style={{color:C.teal,fontSize:12,marginTop:8}}>
                  URL: {tourUrl(newTourForm.code||"CODE")}
                </div>
              )}
              <div style={{...S.row(10),marginTop:14}}>
                <button style={S.btn("gold")} onClick={createTournament}>Create Tournament</button>
                <button style={S.btn("stone")} onClick={()=>setNewTourModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {toast&&(
          <div className="aoe2-toast" style={{position:"fixed",top:16,right:16,zIndex:400,padding:"12px 20px",borderRadius:6,
            fontSize:13,fontWeight:"bold",background:toast.type==="error"?C.ember:C.moss,color:C.light}}>
            {toast.msg}
          </div>
        )}
        <ChangePwModal/>
        <KickbackPayoutModal/>
      </div>
    );
  }

  // ── TOURNAMENT VIEW (per-server) ──────────────────────────────────────────
  if(!T){
    return(
      <div className="aoe2-fade-in" style={{minHeight:"100vh",background:`radial-gradient(ellipse at top,#1A0E00,${C.obsidian})`,
        color:C.light,fontFamily:"Georgia,serif",display:"flex",flexDirection:"column",
        alignItems:"center",justifyContent:"center",padding:"40px 20px",textAlign:"center"}}>
        <GlobalStyle/>
        <div style={{fontSize:52,marginBottom:12}}>⚔️</div>
        <div style={{color:C.gold,fontSize:20,fontWeight:"bold",marginBottom:8}}>Tournament Not Found</div>
        <div style={{color:C.dim,fontSize:13,marginBottom:20}}>The tournament code "{route.code}" does not exist.</div>
        <a href="#/" style={{...S.btn("gold"),textDecoration:"none"}}>← Back to Home</a>
      </div>
    );
  }

  // Full tournament view
  const tierStandLocal=(tid)=>[...T.players.filter(p=>p.classified&&p.tierId===tid&&!p.banned)]
    .sort((a,b)=>b.swissWins!==a.swissWins?b.swissWins-a.swissWins:b.buchholz-a.buchholz||b.elo-a.elo);
  const tournamentDisputes=[
    ...(T.placementMatches||[]).filter(m=>m.disputed&&!m.reported).map(m=>({...m,isPlacement:true})),
    ...Object.entries(T.tournaments||{}).flatMap(([tierId,b])=>[
      ...(b.swissRounds||[]).flatMap((round,ri)=>round.filter(m=>m.disputed&&!m.reported).map(m=>({...m,tierId,roundIdx:ri,isTop8:false}))),
      ...(b.top8||[]).flatMap((round,ri)=>round.filter(m=>m.disputed&&!m.reported).map((m,mi)=>({...m,tierId,roundIdx:ri,matchIdx:mi,isTop8:true}))),
    ])
  ];

  return(
    <div className="aoe2-fade-in" style={{minHeight:"100vh",background:`radial-gradient(ellipse at top,#1A0E00,${C.obsidian})`,
      color:C.light,fontFamily:"Georgia,serif",paddingBottom:60}}>
      <GlobalStyle/>

      <div style={{position:"sticky",top:0,zIndex:50,boxShadow:"0 4px 14px #00000044"}}>
        {/* HEADER */}
        <div style={{background:`linear-gradient(180deg,${C.obsidian},${C.parch})`,
          borderBottom:`2px solid ${C.gold}`,padding:"14px 24px",display:"flex",alignItems:"center",gap:12}}>
          <div style={{flex:1}}>
            <div style={{fontSize:20,color:C.gold,fontWeight:"bold",letterSpacing:3}}>{T.name} ⚔️</div>
            <div style={{color:C.dim,fontSize:10,marginTop:2}}>
              {T.season.name} · {T.players.filter(p=>!p.banned).length} players · {T.players.filter(p=>p.classified&&!p.banned).length} classified
              {tournamentDisputes.length>0&&<span style={{color:C.ember}}> · ⚠️ {tournamentDisputes.length} dispute{tournamentDisputes.length!==1?"s":""}</span>}
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            {loggedInPlayer?(
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:11,color:C.gold,fontWeight:"bold"}}>{loggedInPlayer.name}</div>
                <div style={{fontSize:10,color:C.dim,marginBottom:4}}>{loggedInPlayer.tier?.icon} {loggedInPlayer.tier?.name} · {loggedInPlayer.elo} ELO</div>
                <div style={S.row(6)}>
                  <button onClick={()=>setTab("portal")} style={{...S.btn("gold"),fontSize:10,padding:"5px 10px"}}>My Portal</button>
                  <button onClick={logoutPlayer} style={{...S.btn("stone"),fontSize:10,padding:"5px 10px"}}>Log Out</button>
                </div>
              </div>
            ):(
              <button onClick={()=>setTab("login")} style={{...S.btn("gold"),fontSize:11}}>🔑 Player Login</button>
            )}
            <button onClick={()=>setStreamPrivacy(s=>!s)} style={{...S.btn(streamPrivacy?"gold":"stone"),fontSize:10,padding:"5px 10px"}}
              title="Hides lobby passwords and admin report buttons — safe for screen sharing or streaming">
              {streamPrivacy?"🔒 Streaming Privacy ON":"📺 Streaming Privacy"}
            </button>
            <a href="#/" style={{...S.btn("stone"),fontSize:10,padding:"5px 10px",textDecoration:"none"}}>⚔️ All Tournaments</a>
          </div>
        </div>

        {/* NAV */}
        <div style={{display:"flex",background:C.parch,borderBottom:`1px solid ${C.stone}`,overflowX:"auto"}}>
          {[["home","🏰 Home"],["guides","📖 Guides"],["register","📋 Register"],["tiers","🏆 Divisions"],
            ["bracket","📊 Bracket"],["schedule","📅 Schedule"],["discord","💬 Discord"],
            ["tadmin","⚙️ Admin"],
            ...(loggedInPlayer?[["portal","🎮 My Portal"]]:
                [["login","🔑 Login"]])
          ].map(([k,l])=>(
            <button key={k} onClick={()=>{setTab(k);if(k!=="tadmin"){setTAdminUnlocked(false);setTAdminPwInput("");setTAdminPwError(false);}}}
              style={{padding:"10px 14px",background:"none",border:"none",
                color:tab===k?C.gold:C.dim,cursor:"pointer",whiteSpace:"nowrap",
                borderBottom:tab===k?`2px solid ${C.gold}`:"2px solid transparent",
                fontFamily:"Georgia,serif",fontSize:11,letterSpacing:1,textTransform:"uppercase"}}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* TOAST */}
      {toast&&(
        <div className="aoe2-toast" style={{position:"fixed",top:16,right:16,zIndex:400,padding:"12px 20px",borderRadius:6,
          fontSize:13,fontWeight:"bold",background:toast.type==="error"?C.ember:C.moss,color:C.light,boxShadow:"0 4px 20px #00000066"}}>
          {toast.msg}
        </div>
      )}

      <VetoModal/><DisputeModal/><ChangePwModal/><ReportModal/>

      <div style={{maxWidth:1100,margin:"0 auto",padding:"24px 14px"}}>

        {/* ── HOME ────────────────────────────────────────────────────────── */}
        {tab==="home"&&(()=>{
          const anyFee=T.season.tiers.some(t=>getTierTotalFee(T,t.id)>0);
          const totalPrizePool=T.season.tiers.reduce((sum,t)=>{
            const paidInTier=T.players.filter(p=>p.tierId===t.id&&p.paymentStatus==="received"&&!p.banned).length;
            return sum+paidInTier*getTierPrizeFee(T,t.id);
          },0);
          return(
          <div>
            <div style={{...S.card,textAlign:"center",border:`2px solid ${C.gold}44`}}>
              <div style={{fontSize:48,marginBottom:8}}>⚔️</div>
              <h2 style={{color:C.gold,fontSize:22,margin:"0 0 8px",letterSpacing:3}}>{T.name}</h2>
              <p style={{color:C.dim,fontSize:13,maxWidth:500,margin:"0 auto 16px",lineHeight:1.7}}>
                {T.season.name} · Hosted by {T.hostName||"Community"}
              </p>
              {(T.season.startDate||T.season.registrationDeadline)&&(
                <div style={{...S.row(8,"center"),flexWrap:"wrap",marginBottom:14}}>
                  {T.season.registrationDeadline&&(
                    <span style={{...S.badge(C.ember),fontSize:12,padding:"6px 14px"}}>
                      📋 Register before {formatDateLong(T.season.registrationDeadline)}
                    </span>
                  )}
                  {T.season.startDate&&(
                    <span style={{...S.badge(C.gold),fontSize:12,padding:"6px 14px"}}>
                      ⚔️ Starts {formatDateLong(T.season.startDate)}
                    </span>
                  )}
                </div>
              )}
              {anyFee&&(
                <div style={{...S.badge(C.gold),fontSize:12,padding:"6px 16px",margin:"0 auto 10px"}}>
                  💰 Entry fee varies by division — see below
                </div>
              )}
              {totalPrizePool>0&&(
                <div style={{...S.badge(C.moss),fontSize:14,padding:"8px 18px",margin:"0 auto 16px"}}>
                  🏆 Live Prize Pool: ${totalPrizePool}
                </div>
              )}
              <div style={{...S.row(12,"center"),flexWrap:"wrap"}}>
                <button style={{...S.btn("gold"),fontSize:13,padding:"10px 24px"}} onClick={()=>setTab("register")}>📋 Register</button>
                {!loggedInPlayer&&<button style={{...S.btn("stone"),fontSize:13,padding:"10px 24px"}} onClick={()=>setTab("login")}>🔑 Login</button>}
              </div>
            </div>

            <div style={S.card}>
              <div style={S.cardT}>🏅 Divisions</div>
              <div style={S.grid("repeat(2,1fr)",12)}>
                {T.season.tiers.map(t=>{
                  const tierPaid=T.players.filter(p=>p.tierId===t.id&&p.paymentStatus==="received"&&!p.banned).length;
                  const tierFee=getTierTotalFee(T,t.id);
                  const tierPrizeFee=getTierPrizeFee(T,t.id);
                  const tierPrize=tierPaid*tierPrizeFee;
                  const tierRegistered=T.players.filter(p=>p.tierId===t.id&&!p.banned).length;
                  const tierClassified=T.players.filter(p=>p.classified&&p.tierId===t.id&&!p.banned).length;
                  return(
                    <div key={t.id} style={{padding:"14px",borderRadius:6,background:t.color+"18",border:`1px solid ${t.color}44`}}>
                      <div style={{fontSize:26,marginBottom:4}}>{t.icon}</div>
                      <div style={{color:t.color,fontWeight:"bold",fontSize:15}}>{t.name}</div>
                      <div style={{color:C.dim,fontSize:12,marginTop:2}}>{t.min}–{t.max===9999?"∞":t.max} ELO</div>
                      <div style={{color:C.light,fontSize:12,marginTop:6,fontWeight:"bold"}}>
                        {tierClassified} classified
                      </div>
                      <div style={{color:C.dim,fontSize:11,marginTop:2}}>
                        {tierRegistered} registered
                      </div>
                      <div style={{marginTop:6}}>
                        {tierFee>0
                          ?<span style={S.badge(C.gold)}>${tierFee} entry</span>
                          :<span style={S.badge(C.moss)}>🆓 Free</span>}
                      </div>
                      {tierPrize>0&&(
                        <div style={{color:C.moss,fontSize:13,marginTop:4,fontWeight:"bold"}}>
                          🏆 ${tierPrize} prize pool
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{marginTop:14,padding:"12px",background:C.obsidian+"88",borderRadius:6,fontSize:12,color:C.dim,lineHeight:1.7}}>
                <strong style={{color:C.light}}>How it works:</strong> Register → play {T.season.placementGames} auto-scheduled placement games → get assigned to your division → vote on settings → {T.season.swissRounds}-round Swiss → Top {T.season.top8Cut} playoff.
                <strong style={{color:C.gold}}> No scheduling needed — everything is auto-generated.</strong>
              </div>
            </div>

            {Object.keys(T.tournaments||{}).length>0&&(
              <div style={S.card}>
                <div style={S.cardT}>📊 Live Standings</div>
                {T.season.tiers.filter(t=>T.tournaments[t.id]).map(tier=>(
                  <div key={tier.id} style={{marginBottom:16}}>
                    <div style={{color:tier.color,fontSize:12,fontWeight:"bold",marginBottom:6}}>{tier.icon} {tier.name}</div>
                    {tierStandLocal(tier.id).slice(0,5).map((p,i)=>(
                      <div key={p.id} style={{display:"flex",gap:10,padding:"5px 8px",
                        borderLeft:`3px solid ${i<3?tier.color:C.stone}`,marginBottom:3,
                        background:i===0?tier.color+"11":"transparent",borderRadius:"0 4px 4px 0"}}>
                        <span style={{color:i===0?C.gold:C.dim,width:20,fontSize:12,fontWeight:"bold"}}>{i+1}</span>
                        <span style={{flex:1,fontSize:12}}>{p.name}</span>
                        <span style={{fontSize:12}}>{p.swissWins}W-{p.swissLosses}L</span>
                        <span style={{fontSize:11,color:C.gold}}>{p.elo}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
          );
        })()}

        {/* ── GUIDES ──────────────────────────────────────────────────────── */}
        {tab==="guides"&&(
          <div>
            <div style={{...S.card,textAlign:"center",border:`2px solid ${C.gold}44`}}>
              <div style={{fontSize:40,marginBottom:8}}>📖</div>
              <h2 style={{color:C.gold,fontSize:20,margin:"0 0 8px",letterSpacing:2}}>Guides</h2>
              <p style={{color:C.dim,fontSize:13,maxWidth:480,margin:"0 auto"}}>
                Step-by-step PDF guides for both players and tournament hosts — no login required to download.
              </p>
            </div>

            <div style={S.grid("1fr 1fr",16)}>
              <div style={{...S.card,border:`1px solid ${C.gold}44`}}>
                <div style={S.cardT}>📘 Player Guide</div>
                <div style={S.row(14,"flex-start")}>
                  <div style={{fontSize:32}}>📘</div>
                  <div style={{flex:1}}>
                    <div style={{color:C.light,fontSize:13,lineHeight:1.6,marginBottom:14}}>
                      A complete step-by-step guide covering registration, placement matches, setting up game lobbies, reporting results, voting on settings, the Swiss bracket, Top 8 playoff, messaging your opponent, and how to pay your entry fee via PayPal.
                    </div>
                    <a href="/AoE2-Guide-Player.pdf" download style={{...S.btn("gold"),display:"inline-block",textDecoration:"none"}}>
                      ⬇️ Download Player Guide (PDF)
                    </a>
                  </div>
                </div>
              </div>

              <div style={{...S.card,border:`1px solid ${C.gold}44`}}>
                <div style={S.cardT}>📗 Discord Server Admin Guide</div>
                <div style={S.row(14,"flex-start")}>
                  <div style={{fontSize:32}}>📗</div>
                  <div style={{flex:1}}>
                    <div style={{color:C.light,fontSize:13,lineHeight:1.6,marginBottom:14}}>
                      For tournament hosts — covers season setup, time windows, per-division fees, PayPal/prize configuration, running every phase, and distributing prizes.
                    </div>
                    <a href="/AoE2-Guide-ServerAdmin.pdf" download style={{...S.btn("gold"),display:"inline-block",textDecoration:"none"}}>
                      ⬇️ Download Admin Guide (PDF)
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── REGISTER ────────────────────────────────────────────────────── */}
        {tab==="register"&&(()=>{
          const anyFee=T.season.tiers.some(t=>getTierTotalFee(T,t.id)>0);
          return(
          <div style={{maxWidth:600,margin:"0 auto"}}>
            {regSuccess?(
              <div style={{...S.card,textAlign:"center"}}>
                <div style={{fontSize:48,marginBottom:12}}>🎉</div>
                <div style={{color:C.gold,fontSize:20,fontWeight:"bold",marginBottom:8}}>Registered!</div>
                <p style={{color:C.dim,fontSize:13,lineHeight:1.7,marginBottom:20}}>
                  Your account is created. Log in to see your placement match schedule.
                  {anyFee?" Once you're classified into a division, your entry fee (if any) will be shown in your portal.":""}
                </p>
                <div style={S.row(10,"center")}>
                  <button style={S.btn("gold")} onClick={()=>{setRegSuccess(false);setTab("login");}}>🔑 Log In</button>
                  <button style={S.btn("stone")} onClick={()=>setRegSuccess(false)}>Register Another</button>
                </div>
              </div>
            ):(
              <div style={S.card}>
                <div style={S.cardT}>📋 Register for {T.name}</div>
                {(T.season.startDate||T.season.registrationDeadline)&&(
                  <div style={{background:C.steel+"18",border:`1px solid ${C.steel}44`,borderRadius:6,padding:"10px 14px",marginBottom:14,fontSize:13}}>
                    {T.season.registrationDeadline&&(
                      <div style={{color:C.ember,fontWeight:"bold"}}>📋 Register before {formatDateLong(T.season.registrationDeadline)}</div>
                    )}
                    {T.season.startDate&&(
                      <div style={{color:C.gold,fontWeight:"bold",marginTop:T.season.registrationDeadline?4:0}}>⚔️ Tournament starts {formatDateLong(T.season.startDate)}</div>
                    )}
                  </div>
                )}
                {anyFee&&(
                  <div style={{background:C.gold+"18",border:`1px solid ${C.gold}44`,borderRadius:6,padding:"12px",marginBottom:16,fontSize:13,lineHeight:1.6}}>
                    💰 <strong style={{color:C.gold}}>Entry fee varies by division:</strong>
                    <div style={{marginTop:8,display:"flex",flexWrap:"wrap",gap:8}}>
                      {T.season.tiers.map(t=>{
                        const fee=getTierTotalFee(T,t.id);
                        return(
                          <span key={t.id} style={S.badge(fee>0?C.gold:C.moss)}>
                            {t.icon} {t.name}: {fee>0?`$${fee}`:"Free"}
                          </span>
                        );
                      })}
                    </div>
                    <div style={{marginTop:8}}>Placement games are always free, regardless of division.</div>
                    {T.season.paymentInfo&&<div style={{marginTop:6,color:C.dim}}>Payment: {T.season.paymentInfo}</div>}
                  </div>
                )}
                <div style={S.grid("1fr 1fr",14)}>
                  <div><label style={S.lbl}>Player Name</label>
                    <input style={S.inp} placeholder="In-game name" value={regForm.name} onChange={e=>setRegForm(f=>({...f,name:e.target.value}))}/></div>
                  <div><label style={S.lbl}>Discord Tag</label>
                    <input style={S.inp} placeholder="Player#1234" value={regForm.discord} onChange={e=>setRegForm(f=>({...f,discord:e.target.value}))}/></div>
                  <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Email</label>
                    <input style={{...S.inp,borderColor:regForm.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regForm.email)?C.ember:C.stone}}
                      type="email" placeholder="your@email.com" value={regForm.email} onChange={e=>setRegForm(f=>({...f,email:e.target.value}))}/></div>
                  <div><label style={S.lbl}>Password <span onClick={()=>setShowRegPw(s=>!s)} style={{color:C.dim,fontSize:10,marginLeft:6,cursor:"pointer",textTransform:"none"}}>{showRegPw?"🙈":"👁️"}</span></label>
                    <input style={S.inp} type={showRegPw?"text":"password"} placeholder="Min 6 chars" value={regForm.password} onChange={e=>setRegForm(f=>({...f,password:e.target.value}))}/></div>
                  <div><label style={S.lbl}>Confirm Password</label>
                    <input style={{...S.inp,borderColor:regForm.confirmPw&&regForm.confirmPw!==regForm.password?C.ember:regForm.confirmPw&&regForm.confirmPw===regForm.password?C.moss:C.stone}}
                      type={showRegPw?"text":"password"} placeholder="Repeat" value={regForm.confirmPw} onChange={e=>setRegForm(f=>({...f,confirmPw:e.target.value}))}/>
                    {regForm.confirmPw&&regForm.confirmPw===regForm.password&&<div style={{color:C.moss,fontSize:11,marginTop:3}}>✓</div>}</div>
                  <div><label style={S.lbl}>Favourite Civ</label>
                    <select style={S.inp} value={regForm.civ} onChange={e=>setRegForm(f=>({...f,civ:e.target.value}))}>
                      {CIVS.map(c=><option key={c}>{c}</option>)}</select></div>
                  <div><label style={S.lbl}>Known ELO (800 if unsure)</label>
                    <input style={S.inp} type="number" min={0} max={3500} value={regForm.startElo} onChange={e=>setRegForm(f=>({...f,startElo:e.target.value}))}/></div>
                  <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Timezone</label>
                    <select style={S.inp} value={regForm.timezone} onChange={e=>setRegForm(f=>({...f,timezone:e.target.value}))}>
                      {TIMEZONES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
                </div>
                <div style={{marginTop:16}}>
                  <button style={S.btn("gold")} onClick={selfRegister}>Create Account ⚔️</button>
                </div>
                <div style={{marginTop:12,color:C.dim,fontSize:12}}>Already registered? <span style={{color:C.gold,cursor:"pointer"}} onClick={()=>setTab("login")}>Log in →</span></div>
              </div>
            )}
          </div>
          );
        })()}

        {/* ── LOGIN ───────────────────────────────────────────────────────── */}
        {tab==="login"&&(
          <div style={{maxWidth:420,margin:"40px auto 0"}}>
            {loggedInPlayer?(
              <div style={{...S.card,textAlign:"center"}}>
                <div style={{fontSize:44,marginBottom:8}}>{loggedInPlayer.tier?.icon||"⚔️"}</div>
                <div style={{color:C.gold,fontSize:20,fontWeight:"bold"}}>{loggedInPlayer.name}</div>
                <div style={{color:C.dim,fontSize:13,marginTop:4,marginBottom:16}}>{loggedInPlayer.tier?.name} · {loggedInPlayer.elo} ELO</div>
                <div style={S.row(10,"center")}>
                  <button style={S.btn("gold")} onClick={()=>setTab("portal")}>My Portal →</button>
                  <button style={S.btn("stone")} onClick={logoutPlayer}>Log Out</button>
                </div>
              </div>
            ):(
              <div style={{...S.card,border:`1px solid ${C.gold}55`}}>
                <div style={{textAlign:"center",marginBottom:20}}>
                  <div style={{fontSize:44,marginBottom:8}}>🔑</div>
                  <div style={{color:C.gold,fontSize:18,fontWeight:"bold",letterSpacing:2}}>Player Login</div>
                </div>
                <div style={{marginBottom:14}}>
                  <label style={S.lbl}>Email</label>
                  <input style={S.inp} type="email" placeholder="your@email.com" value={loginForm.email} autoFocus
                    onChange={e=>{setLoginForm(f=>({...f,email:e.target.value}));setLoginError("");}}
                    onKeyDown={e=>e.key==="Enter"&&loginPlayer()}/>
                </div>
                <div style={{marginBottom:8}}>
                  <label style={S.lbl}>Password <span onClick={()=>setLoginShowPw(s=>!s)} style={{color:C.dim,fontSize:10,marginLeft:6,cursor:"pointer",textTransform:"none"}}>{loginShowPw?"🙈":"👁️"}</span></label>
                  <input style={S.inp} type={loginShowPw?"text":"password"} placeholder="Your password" value={loginForm.password}
                    onChange={e=>{setLoginForm(f=>({...f,password:e.target.value}));setLoginError("");}}
                    onKeyDown={e=>e.key==="Enter"&&loginPlayer()}/>
                </div>
                {loginError&&<div style={{color:C.ember,fontSize:12,marginBottom:10,padding:"8px",background:C.ember+"18",borderRadius:4}}>{loginError}</div>}
                <button style={{...S.btn("gold"),width:"100%",marginTop:10,padding:"12px"}} onClick={loginPlayer}>Sign In ⚔️</button>
                <div style={{textAlign:"center",marginTop:12,color:C.dim,fontSize:12}}>
                  No account? <span style={{color:C.gold,cursor:"pointer"}} onClick={()=>setTab("register")}>Register →</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── DIVISIONS ───────────────────────────────────────────────────── */}
        {tab==="tiers"&&(
          <div>
            {T.season.tiers.map(tier=>{
              const players=T.players.filter(p=>p.classified&&p.tierId===tier.id&&!p.banned);
              const registered=T.players.filter(p=>p.tierId===tier.id&&!p.banned).length;
              const bracket=T.tournaments[tier.id];
              const stand=tierStandLocal(tier.id);
              return(
                <div key={tier.id} style={{...S.card,border:`1px solid ${tier.color}44`}}>
                  <div style={{...S.row(14,"flex-start"),marginBottom:14}}>
                    <div style={{fontSize:32}}>{tier.icon}</div>
                    <div style={{flex:1}}>
                      <div style={{color:tier.color,fontWeight:"bold",fontSize:18}}>{tier.name}</div>
                      <div style={{color:C.dim,fontSize:12}}>{tier.min}–{tier.max===9999?"∞":tier.max} ELO · {players.length} classified · {registered} registered</div>
                    </div>
                    <div style={S.row(8)}>
                      {!bracket?
                        (tAdminUnlocked&&<button style={S.btn("gold",players.length<2)} disabled={players.length<2} onClick={()=>autoOpenBrackets(T.code)}>Open Bracket ⚔️</button>)
                      :(
                        <>
                          <span style={S.badge(bracket.phase==="done"?C.gold:bracket.phase==="top8"?C.purple:bracket.phase==="settings"?C.steel:tier.color)}>
                            {bracket.phase==="settings"?"⚙️ Settings Vote":bracket.phase==="swiss"?`Swiss R${bracket.currentRound}/${bracket.totalRounds}`:bracket.phase==="top8"?"Top 8":"🏆 Done"}
                          </span>
                          <button style={S.btn("stone")} onClick={()=>{setActiveTier(tier.id);setTab("bracket");}}>View →</button>
                        </>
                      )}
                    </div>
                  </div>
                  {bracket?.phase==="settings"&&(
                    <div style={{background:C.steel+"18",border:`1px solid ${C.steel}44`,borderRadius:6,padding:"14px",marginBottom:14}}>
                      <div style={{color:C.steel,fontSize:12,letterSpacing:1,textTransform:"uppercase",marginBottom:10,fontWeight:"bold"}}>⚙️ Settings Vote</div>
                      <div style={S.grid("1fr 1fr 1fr",12)}>
                        {[["map","🗺️ Map",MAPS.slice(0,10)],["resources","💰 Resources",RESOURCES],["speed","⚡ Speed",SPEEDS]].map(([cat,label,opts])=>{
                          const tally=tallyVotes(T.code,tier.id,cat);
                          return(
                            <div key={cat}>
                              <div style={{color:C.dim,fontSize:11,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>{label}</div>
                              <select style={S.inp} defaultValue="" onChange={e=>{
                                const pid=T.players.find(p=>p.tierId===tier.id&&p.classified)?.id;
                                if(pid) castVote(T.code,tier.id,cat,e.target.value,pid);
                              }}>
                                <option value="">Vote…</option>
                                {opts.map(o=><option key={o}>{o}</option>)}
                              </select>
                              {tally.length>0&&<div style={{fontSize:11,color:C.dim,marginTop:6}}>Leading: <strong style={{color:C.gold}}>{tally[0]?.[0]}</strong> ({tally[0]?.[1]})</div>}
                            </div>
                          );
                        })}
                      </div>
                      {tAdminUnlocked&&(
                        <div style={{...S.row(10),marginTop:14}}>
                          <button style={S.btn("gold")} onClick={()=>lockSettings(T.code,tier.id)}>🔒 Lock Settings</button>
                          {bracket.settings?.locked&&<button style={S.btn("green")} onClick={()=>beginSwiss(T.code,tier.id)}>▶️ Start Swiss R1</button>}
                        </div>
                      )}
                      {bracket.settings?.locked&&<div style={{marginTop:10,fontSize:13,color:C.gold}}>✅ {bracket.settings.map} · {bracket.settings.resources} · {bracket.settings.speed}</div>}
                    </div>
                  )}
                  {bracket&&stand.length>0&&(
                    <div>
                      <div style={{color:C.dim,fontSize:11,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>Standings</div>
                      {stand.slice(0,8).map((p,i)=>(
                        <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 10px",
                          borderRadius:4,background:i<T.season.top8Cut?tier.color+"11":"transparent",
                          borderLeft:i<T.season.top8Cut?`3px solid ${tier.color}66`:"3px solid transparent",marginBottom:3}}>
                          <span style={{color:i<3?C.gold:C.dim,width:20,fontSize:12,fontWeight:"bold"}}>{i+1}</span>
                          <span style={{flex:1,fontSize:13}}>{p.name}</span>
                          <span style={{fontSize:12,fontWeight:"bold"}}>{p.swissWins}W-{p.swissLosses}L</span>
                          <span style={{color:C.dim,fontSize:11}}>BH:{p.buchholz}</span>
                          <span style={{color:C.gold,fontSize:12}}>{p.elo}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── BRACKET ─────────────────────────────────────────────────────── */}
        {tab==="bracket"&&(
          <div>
            <div style={{...S.card,padding:14}}>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <span style={{color:C.dim,fontSize:11,letterSpacing:1,alignSelf:"center"}}>DIVISION:</span>
                {T.season.tiers.filter(t=>T.tournaments[t.id]).map(t=>(
                  <button key={t.id} style={S.btn(activeTier===t.id?"gold":"stone")} onClick={()=>setActiveTier(t.id)}>
                    {t.icon} {t.name}
                  </button>
                ))}
                {!Object.keys(T.tournaments||{}).length&&<span style={{color:C.dim,fontSize:13}}>No brackets yet.</span>}
              </div>
            </div>

            {tournamentDisputes.length>0&&tAdminUnlocked&&(
              <div style={{...S.card,background:C.ember+"18",border:`1px solid ${C.ember}`,padding:"14px"}}>
                <div style={{color:C.ember,fontWeight:"bold",fontSize:14,marginBottom:8}}>⚠️ {tournamentDisputes.length} Disputes</div>
                {tournamentDisputes.map(m=>{
                  if(m.isPlacement){
                    const p1=T.players.find(p=>p.id===m.p1),p2=T.players.find(p=>p.id===m.p2);
                    return(<div key={m.id} style={{...S.row(10),padding:"8px 10px",background:C.obsidian,borderRadius:4,marginBottom:6}}>
                      <span style={{...S.badge(C.steel),fontSize:10}}>Placement</span>
                      <span style={{flex:1,fontSize:13}}>{p1?.name} vs {p2?.name}</span>
                      <button style={S.btn("red")} onClick={()=>setDisputeModal({isPlacement:true,matchId:m.id})}>Resolve</button>
                    </div>);
                  }
                  const tier=T.season.tiers.find(t=>t.id===m.tierId);
                  const p1=T.players.find(p=>p.id===m.p1),p2=T.players.find(p=>p.id===m.p2);
                  return(<div key={m.id} style={{...S.row(10),padding:"8px 10px",background:C.obsidian,borderRadius:4,marginBottom:6}}>
                    <span style={{flex:1,fontSize:13}}>{tier?.icon} {tier?.name} — {p1?.name} vs {p2?.name}</span>
                    <button style={S.btn("red")} onClick={()=>setDisputeModal({tierId:m.tierId,roundIdx:m.roundIdx,matchId:m.id,isTop8:m.isTop8})}>Resolve</button>
                  </div>);
                })}
              </div>
            )}

            {activeTier&&T.tournaments[activeTier]&&(()=>{
              const bracket=T.tournaments[activeTier];
              const tierData=T.season.tiers.find(t=>t.id===activeTier);
              const currRound=bracket.swissRounds[bracket.currentRound-1]||[];
              const roundDone=currRound.every(m=>m.reported||m.p2==="BYE");
              return(
                <>
                  <div style={{...S.card,background:`linear-gradient(135deg,${tierData?.color}18,${C.parch})`,border:`1px solid ${tierData?.color}44`}}>
                    <div style={S.row(16)}>
                      <div style={{fontSize:36}}>{tierData?.icon}</div>
                      <div style={{flex:1}}>
                        <div style={{color:tierData?.color,fontSize:18,fontWeight:"bold"}}>{tierData?.name} Division</div>
                        <div style={{color:C.dim,fontSize:12}}>
                          {bracket.phase==="settings"?"⚙️ Settings vote in progress"
                            :bracket.phase==="swiss"?`Swiss Round ${bracket.currentRound}/${bracket.totalRounds}`
                            :bracket.phase==="top8"?"Top 8 Playoff":"✅ Complete"}
                        </div>
                        {bracket.settings?.locked&&<div style={{fontSize:12,color:C.gold,marginTop:4}}>🗺️ {bracket.settings.map} · {bracket.settings.resources} · {bracket.settings.speed}</div>}
                      </div>
                      {bracket.phase==="swiss"&&tAdminUnlocked&&(
                        <button style={S.btn(roundDone?"gold":"stone",!roundDone)} disabled={!roundDone}
                          onClick={()=>nextSwissRound(T.code,activeTier)}>
                          {bracket.currentRound>=T.season.swissRounds?"Cut to Top 8 →":"Next Round →"}
                        </button>
                      )}
                    </div>
                  </div>

                  {bracket.phase==="swiss"&&bracket.swissRounds.map((round,ri)=>(
                    <div key={ri} style={S.card}>
                      <div style={S.cardT}>Round {ri+1}
                        {ri===bracket.currentRound-1&&<span style={{...S.badge(C.gold),marginLeft:8,fontSize:10}}>Current</span>}
                        {round.every(m=>m.reported||m.p2==="BYE")&&<span style={{...S.badge(C.moss),marginLeft:8,fontSize:10}}>Complete ✓</span>}
                      </div>
                      <div style={S.grid("1fr 1fr",10)}>
                        {round.map(m=>(
                          <MatchCard key={m.id} match={m} tierId={activeTier} roundIdx={ri}
                            isTop8={false} isCurrent={ri===bracket.currentRound-1} tourCode={T.code}/>
                        ))}
                      </div>
                    </div>
                  ))}

                  {(bracket.phase==="top8"||bracket.phase==="done")&&bracket.top8.length>0&&(
                    <div style={S.card}>
                      <div style={S.cardT}>🏆 Top 8 Playoff</div>
                      <div style={{display:"flex",gap:16,overflowX:"auto",paddingBottom:12}}>
                        {bracket.top8.map((round,ri)=>{
                          const labels=["Quarterfinals","Semifinals","Grand Final"];
                          return(
                            <div key={ri} style={{minWidth:240,flexShrink:0}}>
                              <div style={{color:C.dim,fontSize:11,letterSpacing:1,textTransform:"uppercase",marginBottom:8,textAlign:"center"}}>{labels[ri]||`R${ri+1}`}</div>
                              <div style={{display:"flex",flexDirection:"column",gap:ri===0?8:ri===1?48:96}}>
                                {round.map(m=>(
                                  <MatchCard key={m.id} match={m} tierId={activeTier} roundIdx={ri}
                                    isTop8={true} isCurrent={true} tourCode={T.code}/>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {bracket.champion&&(()=>{
                    const champ=T.players.find(p=>p.id===bracket.champion);
                    return(
                      <div style={{...S.card,textAlign:"center",background:`linear-gradient(135deg,${C.gold}18,${C.parch})`,border:`2px solid ${C.gold}`}}>
                        <div style={{fontSize:52}}>👑</div>
                        <div style={{color:C.gold,fontSize:24,fontWeight:"bold"}}>{champ?.name}</div>
                        <div style={{color:C.dim}}>{tierData?.name} Champion · {champ?.elo} ELO · {champ?.civ}</div>
                      </div>
                    );
                  })()}

                  {bracket.phase!=="settings"&&(
                    <div style={S.card}>
                      <div style={S.cardT}>📊 Swiss Standings</div>
                      {tierStandLocal(activeTier).map((p,i)=>(
                        <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 10px",borderRadius:4,marginBottom:3,
                          background:i<T.season.top8Cut?tierData?.color+"0F":"transparent",
                          borderLeft:i<T.season.top8Cut?`3px solid ${tierData?.color}66`:"3px solid transparent"}}>
                          <span style={{color:i<3?C.gold:C.dim,width:22,fontSize:12,fontWeight:"bold"}}>{i+1}</span>
                          <span style={{flex:1,fontSize:13}}>{p.name}</span>
                          <span style={{color:C.dim,fontSize:11}}>{TIMEZONES.find(t=>t.value===p.timezone)?.abbr}</span>
                          <span style={{fontSize:12,fontWeight:"bold"}}>{p.swissWins}W–{p.swissLosses}L</span>
                          <span style={{color:C.dim,fontSize:11}}>BH:{p.buchholz}</span>
                          <span style={{color:C.gold,fontSize:12}}>{p.elo}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* ── SCHEDULE ────────────────────────────────────────────────────── */}
        {tab==="schedule"&&(
          <div>
            {(T.placementMatches||[]).length>0?(
              <div style={S.card}>
                <div style={S.cardT}>⚔️ Placement Schedule
                  <span style={{...S.badge(C.gold),marginLeft:10,fontSize:10}}>
                    {T.placementMatches.filter(m=>m.reported).length}/{T.placementMatches.length} complete
                  </span>
                </div>
                {(()=>{
                  const byDay={};
                  T.placementMatches.forEach(m=>{
                    const day=m.scheduledTime?new Date(m.scheduledTime).toISOString().slice(0,10):"Unscheduled";
                    if(!byDay[day]) byDay[day]=[];
                    byDay[day].push(m);
                  });
                  return Object.entries(byDay).map(([day,matches])=>(
                    <div key={day} style={{marginBottom:16}}>
                      <div style={{color:C.gold,fontSize:12,fontWeight:"bold",letterSpacing:1,marginBottom:8,
                        paddingBottom:4,borderBottom:`1px solid ${C.stone}44`}}>
                        📅 {day==="Unscheduled"?day:new Date(day).toLocaleDateString("en-CA",{weekday:"long",month:"long",day:"numeric"})}
                      </div>
                      <div style={S.grid("1fr 1fr",8)}>
                        {matches.map(m=>{
                          const p1=T.players.find(p=>p.id===m.p1),p2=T.players.find(p=>p.id===m.p2);
                          const sc=m.disputed?C.ember:m.reported?C.moss:C.stone;
                          return(
                            <div key={m.id} style={{padding:"10px",borderRadius:6,background:C.obsidian,border:`1px solid ${sc}66`}}>
                              <div style={{...S.row(6),marginBottom:6,flexWrap:"wrap"}}>
                                <span style={{...S.badge(sc),fontSize:10}}>{m.disputed?"⚠️ Disputed":m.reported?"✓ Done":"⏳ Pending"}</span>
                                {m.scheduledTime&&<span style={{color:C.dim,fontSize:10}}>
                                  {new Date(m.scheduledTime).toLocaleTimeString("en-CA",{hour:"2-digit",minute:"2-digit",timeZone:"UTC"})} UTC
                                </span>}
                                <span style={{...S.badge(C.teal),fontSize:10}}>🏰 {m.lobbyName}</span>
                              </div>
                              <div style={{fontSize:13}}>
                                <strong style={{color:m.winner===m.p1?C.gold:C.light}}>{p1?.name||"?"}</strong>
                                <span style={{color:C.dim}}> vs </span>
                                <strong style={{color:m.winner===m.p2?C.gold:C.light}}>{p2?.name||"?"}</strong>
                              </div>
                              {m.winner&&<div style={{fontSize:11,color:C.gold,marginTop:3}}>🏆 {T.players.find(p=>p.id===m.winner)?.name}</div>}
                              {m.disputed&&tAdminUnlocked&&(
                                <button style={{...S.btn("red"),fontSize:10,padding:"3px 8px",marginTop:6}}
                                  onClick={()=>setDisputeModal({isPlacement:true,matchId:m.id})}>Resolve</button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            ):(
              <div style={{...S.card,textAlign:"center",color:C.dim,padding:"40px"}}>
                Placement schedule will appear here once registration is closed.
              </div>
            )}
            <div style={S.card}>
              <div style={S.cardT}>🌍 Timezone Reference</div>
              <div style={S.grid("1fr 1fr 1fr",10)}>
                {TIMEZONES.map(tz=>{
                  const now=new Date().toLocaleString("en-CA",{timeZone:tz.value,hour:"2-digit",minute:"2-digit",weekday:"short"});
                  return(<div key={tz.value} style={{padding:"10px",borderRadius:6,background:C.obsidian,border:`1px solid ${C.stone}`}}>
                    <div style={{color:C.gold,fontSize:13,fontWeight:"bold"}}>{tz.abbr}</div>
                    <div style={{color:C.light,fontSize:14,marginTop:2}}>{now}</div>
                    <div style={{color:C.dim,fontSize:11}}>{tz.label}</div>
                    <div style={{color:C.dim,fontSize:11,marginTop:4}}>{T.players.filter(p=>p.timezone===tz.value&&!p.banned).length} players</div>
                  </div>);
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── DISCORD ─────────────────────────────────────────────────────── */}
        {tab==="discord"&&(
          <div>
            <div style={S.card}>
              <div style={S.cardT}>📣 Announcement</div>
              {(()=>{
                const anyFee=T.season.tiers.some(t=>getTierTotalFee(T,t.id)>0);
                const divisionLines=T.season.tiers.map(t=>{
                  const fee=getTierTotalFee(T,t.id);
                  return `${t.icon} **${t.name}**: ${t.min}–${t.max===9999?"∞":t.max} ELO${fee>0?` · $${fee} entry`:" · Free"}`;
                }).join("\n");
                const dateLines=`${T.season.registrationDeadline?`📋 Register before: ${formatDateLong(T.season.registrationDeadline)}\n`:""}${T.season.startDate?`⚔️ Tournament starts: ${formatDateLong(T.season.startDate)}\n`:""}`;
                const text=`@everyone\n\n⚔️ **${T.name} — ${T.season.name}**\n\n🏰 Register at: ${tourUrl(T.code)}\n${dateLines}🆓 ${T.season.placementGames} free placement games → auto-scheduled\n🎮 Players self-report results — no scheduling needed\n🏆 ${T.season.swissRounds}-round Swiss → Top ${T.season.top8Cut} playoff per division\n${anyFee?`💰 Entry fee varies by division (see below) — placement games are always free\n`:""}\n**Divisions:**\n${divisionLines}\n${T.season.paymentInfo?`\n💰 Payment: ${T.season.paymentInfo}`:""}\n🌍 All timezones welcome · Games played on weekends`;
                return(<>
                  <div style={{background:"#36393F",border:"1px solid #4F545C",borderRadius:8,padding:16,fontFamily:"monospace",fontSize:12,color:"#DCDDDE",whiteSpace:"pre-wrap",marginBottom:10,lineHeight:1.6,maxHeight:340,overflow:"auto"}}>{text}</div>
                  <button style={S.btn("gold")} onClick={()=>{navigator.clipboard.writeText(text);toast$("Copied!");}}>📋 Copy</button>
                </>);
              })()}
            </div>
            {T.season.tiers.filter(t=>T.tournaments[t.id]).map(tier=>{
              const text=makeDiscord(T.code,tier.id);
              return(<div key={tier.id} style={S.card}>
                <div style={S.cardT}>{tier.icon} {tier.name} Export</div>
                <div style={{background:"#36393F",border:"1px solid #4F545C",borderRadius:8,padding:16,fontFamily:"monospace",fontSize:12,color:"#DCDDDE",whiteSpace:"pre-wrap",maxHeight:280,overflow:"auto",marginBottom:10,lineHeight:1.6}}>{text}</div>
                <button style={S.btn("gold")} onClick={()=>{navigator.clipboard.writeText(text);toast$("Copied!");}}>📋 Copy</button>
              </div>);
            })}
          </div>
        )}

        {/* ── TOURNAMENT ADMIN ────────────────────────────────────────────── */}
        {tab==="tadmin"&&!tAdminUnlocked&&(
          <div style={{maxWidth:380,margin:"60px auto 0"}}>
            <div style={{...S.card,textAlign:"center",border:`1px solid ${C.gold}66`}}>
              <div style={{fontSize:44,marginBottom:12}}>🔒</div>
              <div style={S.cardT}>Tournament Admin</div>
              <input style={{...S.inp,textAlign:"center",letterSpacing:4,fontSize:16,marginBottom:tAdminPwError?8:14}}
                type="password" placeholder="Admin password" value={tAdminPwInput} autoFocus
                onChange={e=>{setTAdminPwInput(e.target.value);setTAdminPwError(false);}}
                onKeyDown={e=>e.key==="Enter"&&tryTAdmin()}/>
              {tAdminPwError&&<div style={{color:C.ember,fontSize:12,marginBottom:12}}>✕ Incorrect</div>}
              <button style={S.btn("gold")} onClick={tryTAdmin}>Unlock</button>
            </div>
          </div>
        )}

        {tab==="tadmin"&&tAdminUnlocked&&(
          <div>
            <div style={{...S.row(10),marginBottom:16,justifyContent:"space-between",flexWrap:"wrap"}}>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {[["season","⚙️ Season"],["windows","📅 Time Windows"],["placement","🎮 Placement"],
                  ["tiers","🏅 Tiers"],["players","👥 Players"],["payments","💰 Payments"],
                  ["reports","🚨 Reports"],["passwords","🔑 Passwords"],
                  ["log","📜 Log"],["danger","⚠️ Data"]
                ].map(([k,l])=>(
                  <button key={k} style={S.btn(tAdminTab===k?"gold":"stone")} onClick={()=>setTAdminTab(k)}>{l}</button>
                ))}
              </div>
              <button style={{...S.btn("stone"),fontSize:11}} onClick={()=>{setTAdminUnlocked(false);setTAdminPwInput("");}}>🔒 Lock</button>
            </div>

            {/* SEASON */}
            {tAdminTab==="season"&&seasonDraft&&(()=>{
              const currentComparable=JSON.stringify({
                hostEmail:T.hostEmail||"",name:T.season.name,placementGames:T.season.placementGames,
                swissRounds:T.season.swissRounds,top8Cut:T.season.top8Cut,prizeFee:T.season.prizeFee||0,
                paymentInfo:T.season.paymentInfo||"",startDate:T.season.startDate||"",
                registrationDeadline:T.season.registrationDeadline||"",
              });
              const dirty=JSON.stringify(seasonDraft)!==currentComparable;
              return(
              <div style={S.card}>
                <div style={S.cardT}>⚙️ Season Settings</div>

                {/* Tournament dates — shown publicly on the home page and Discord announcement */}
                <div style={{background:C.steel+"18",border:`1px solid ${C.steel}55`,borderRadius:6,
                  padding:"14px",marginBottom:16}}>
                  <div style={{color:C.gold,fontWeight:"bold",fontSize:13,marginBottom:10}}>📅 Tournament Dates</div>
                  <div style={S.grid("1fr 1fr",14)}>
                    <div>
                      <label style={S.lbl}>Tournament Start Date</label>
                      <input style={S.inp} type="date" value={seasonDraft.startDate}
                        onChange={e=>setSeasonDraft(d=>({...d,startDate:e.target.value}))}/>
                      <div style={{color:C.dim,fontSize:10,marginTop:3}}>When the bracket is expected to kick off — shown to players as "Tournament starts".</div>
                    </div>
                    <div>
                      <label style={S.lbl}>Registration Deadline</label>
                      <input style={S.inp} type="date" value={seasonDraft.registrationDeadline}
                        onChange={e=>setSeasonDraft(d=>({...d,registrationDeadline:e.target.value}))}/>
                      <div style={{color:C.dim,fontSize:10,marginTop:3}}>Last day to register — shown to players as "Register before". You still close registration manually below when ready.</div>
                    </div>
                  </div>
                  {(seasonDraft.startDate||seasonDraft.registrationDeadline)&&(
                    <div style={{marginTop:10,color:C.light,fontSize:12}}>
                      Preview:{" "}
                      {seasonDraft.registrationDeadline&&<span style={S.badge(C.ember)}>📋 Register before {formatDateLong(seasonDraft.registrationDeadline)}</span>}
                      {" "}
                      {seasonDraft.startDate&&<span style={S.badge(C.gold)}>⚔️ Starts {formatDateLong(seasonDraft.startDate)}</span>}
                    </div>
                  )}
                </div>

                {/* PayPal email — REQUIRED before launching a paid tournament */}
                <div style={{background:seasonDraft.hostEmail?.trim()?C.moss+"18":C.ember+"18",
                  border:`1px solid ${seasonDraft.hostEmail?.trim()?C.moss:C.ember}55`,borderRadius:6,
                  padding:"14px",marginBottom:16}}>
                  <label style={S.lbl}>Your PayPal Email — Required to receive prize fees</label>
                  <input style={S.inp} type="email" placeholder="your-paypal@email.com"
                    value={seasonDraft.hostEmail}
                    onChange={e=>setSeasonDraft(d=>({...d,hostEmail:e.target.value}))}/>
                  {!seasonDraft.hostEmail?.trim()?(
                    <div style={{color:C.ember,fontSize:11,marginTop:6}}>
                      ⚠️ Required before you can open division brackets for a paid tournament. Players send your prize fee share directly to this PayPal address.
                    </div>
                  ):(
                    <div style={{color:C.moss,fontSize:11,marginTop:6}}>
                      ✓ Prize fees will be sent to this PayPal address by players.
                    </div>
                  )}
                </div>

                <div style={S.grid("1fr 1fr",14)}>
                  {[
                    ["Season Name","name","text"],
                    ["Placement Games","placementGames","number"],
                    ["Swiss Rounds","swissRounds","number"],
                    ["Top N Playoff Cutoff","top8Cut","number"],
                    ["Default Prize Fee ($) for NEW divisions","prizeFee","number"],
                  ].map(([label,field,type])=>(
                    <div key={field}><label style={S.lbl}>{label}</label>
                      <input style={S.inp} type={type} value={seasonDraft[field]}
                        onChange={e=>setSeasonDraft(d=>({...d,[field]:type==="number"?Number(e.target.value):e.target.value}))}/>
                      {field==="prizeFee"&&<div style={{color:C.dim,fontSize:10,marginTop:3}}>Each division has its own prize fee — set those in Admin → Tiers. This value is only the starting default for divisions you add later.</div>}
                    </div>
                  ))}
                  {/* Admin fee is READ-ONLY here — only the platform super admin can set it */}
                  <div>
                    <label style={S.lbl}>Platform Admin Fee ($) — set by platform organiser</label>
                    <div style={{...S.inp,background:C.stone,color:C.dim,cursor:"not-allowed",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <span>${T.season.adminFee||0} per player</span>
                      <span style={{fontSize:10,letterSpacing:1}}>🔒 LOCKED</span>
                    </div>
                    <div style={{color:C.dim,fontSize:10,marginTop:3}}>Contact the platform organiser to change this amount. This applies to every division.</div>
                  </div>
                  <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Additional Payment Notes (public, optional)</label>
                    <input style={S.inp} placeholder="e.g. Include your Discord tag in the PayPal note" value={seasonDraft.paymentInfo}
                      onChange={e=>setSeasonDraft(d=>({...d,paymentInfo:e.target.value}))}/></div>
                </div>

                <SaveBar dirty={dirty} onSave={saveSeasonSettings} label="Save Season Settings"/>

                {/* Host's own kickback earnings — read-only, builds trust */}
                {(T.season.kickbackPercent||0)>0&&(()=>{
                  const owed=getKickbackOwed(T);
                  const paid=getKickbackPaid(T);
                  const outstanding=getKickbackOutstanding(T);
                  return(
                    <div style={{marginTop:16,padding:"14px",background:C.purple+"14",border:`1px solid ${C.purple}44`,borderRadius:6}}>
                      <div style={{color:C.purple,fontSize:12,letterSpacing:1,textTransform:"uppercase",marginBottom:8,fontWeight:"bold"}}>
                        💸 Your Hosting Bonus
                      </div>
                      <p style={{color:C.dim,fontSize:12,marginBottom:10,lineHeight:1.6}}>
                        The platform organiser shares <strong style={{color:C.gold}}>{T.season.kickbackPercent}%</strong> of the platform admin fee back with you as a thank-you for hosting this tournament.
                      </p>
                      <div style={S.grid("1fr 1fr 1fr",10)}>
                        <div>
                          <div style={{color:C.dim,fontSize:10,marginBottom:4}}>EARNED SO FAR</div>
                          <div style={{color:C.gold,fontSize:16,fontWeight:"bold"}}>${owed.toFixed(2)}</div>
                        </div>
                        <div>
                          <div style={{color:C.dim,fontSize:10,marginBottom:4}}>PAID TO YOU</div>
                          <div style={{color:C.moss,fontSize:16,fontWeight:"bold"}}>${paid.toFixed(2)}</div>
                        </div>
                        <div>
                          <div style={{color:C.dim,fontSize:10,marginBottom:4}}>STILL OWED TO YOU</div>
                          <div style={{color:outstanding>0?C.ember:C.dim,fontSize:16,fontWeight:"bold"}}>${outstanding.toFixed(2)}</div>
                        </div>
                      </div>
                      <div style={{color:C.dim,fontSize:11,marginTop:10}}>
                        The platform organiser sends this directly to your PayPal email on file as players' fees are confirmed.
                      </div>
                    </div>
                  );
                })()}
                <div style={{marginTop:16}}>
                  <button style={S.btn("ember")} onClick={()=>resetAllPayments(T.code)}>
                    🔄 Reset All Payments for Next Season
                  </button>
                  <div style={{color:C.dim,fontSize:10,marginTop:4}}>
                    Use this after a tournament ends to prepare for the next season. Historical fee records are kept.
                  </div>
                </div>
                <div style={{marginTop:20,paddingTop:16,borderTop:`1px solid ${C.stone}`}}>
                  <div style={{color:C.gold,fontSize:13,fontWeight:"bold",letterSpacing:1,textTransform:"uppercase",marginBottom:12}}>🚦 Registration Controls</div>
                  <div style={S.row(10,{flexWrap:"wrap"})}>
                    {!T.season.registrationOpen&&!(T.placementMatches?.length)&&(
                      <button style={S.btn("green")} onClick={()=>openRegistration(T.code)}>📋 Open Registration</button>
                    )}
                    {T.season.registrationOpen&&(
                      <div style={S.row(10)}>
                        <span style={S.badge(C.moss)}>📋 Open · {T.players.filter(p=>!p.banned).length} players</span>
                        <button style={S.btn("gold")} onClick={()=>closeAndSchedule(T.code)}>🔒 Close & Generate Schedule</button>
                      </div>
                    )}
                    {(T.placementMatches?.length>0)&&!Object.keys(T.tournaments||{}).length&&(
                      <div style={S.row(10)}>
                        <span style={S.badge(C.steel)}>
                          ⚔️ {T.placementMatches.filter(m=>m.reported).length}/{T.placementMatches.length} placements done
                        </span>
                        <button style={S.btn("gold")} onClick={()=>autoOpenBrackets(T.code)}>⚔️ Open Division Brackets</button>
                      </div>
                    )}
                    {Object.values(T.tournaments||{}).some(b=>b.phase==="settings"&&b.settings?.locked)&&(
                      <button style={S.btn("green")} onClick={()=>{
                        T.season.tiers.forEach(tier=>{
                          const b=T.tournaments[tier.id];
                          if(b?.phase==="settings"&&b?.settings?.locked) beginSwiss(T.code,tier.id);
                        });
                      }}>▶️ Start All Swiss</button>
                    )}
                  </div>
                  <div style={{color:C.dim,fontSize:11,marginTop:10,lineHeight:1.7}}>
                    Flow: Open Reg → Close & Generate → (players play) → Open Brackets → (players vote) → Lock Settings → Start Swiss → Next Round (×{T.season.swissRounds}) → Top 8
                  </div>
                </div>
              </div>
              );
            })()}

            {/* TIME WINDOWS */}
            {tAdminTab==="windows"&&windowsDraft&&(()=>{
              const dirty=JSON.stringify(windowsDraft)!==JSON.stringify(T.season.timeWindows||[]);
              return(
              <div style={S.card}>
                <div style={S.cardT}>📅 Placement Time Windows</div>
                <p style={{color:C.dim,fontSize:13,marginBottom:16,lineHeight:1.6}}>
                  Define when placement matches are scheduled. The agent spreads matches evenly across these windows only.
                  Leave empty to spread across 2-hour gaps with no day preference.
                  All times are UTC — tell players to check the Schedule tab for their local time.
                </p>
                {windowsDraft.map((w,i)=>(
                  <div key={i} style={{...S.row(10,"flex-start"),padding:"12px",borderRadius:6,background:C.obsidian,border:`1px solid ${C.stone}`,marginBottom:8,flexWrap:"wrap"}}>
                    <div><label style={S.lbl}>Day (UTC)</label>
                      <select style={{...S.inp,width:120}}
                        value={w.day}
                        onChange={e=>setWindowsDraft(d=>d.map((x,j)=>j!==i?x:{...x,day:e.target.value}))}>
                        {["sun","mon","tue","wed","thu","fri","sat"].map(d=><option key={d} value={d}>{d.charAt(0).toUpperCase()+d.slice(1)}</option>)}
                      </select>
                    </div>
                    <div><label style={S.lbl}>Start Hour (UTC 0-23)</label>
                      <input style={{...S.inp,width:80}} type="number" min={0} max={23} value={w.startHour}
                        onChange={e=>setWindowsDraft(d=>d.map((x,j)=>j!==i?x:{...x,startHour:Number(e.target.value)}))}/>
                    </div>
                    <div><label style={S.lbl}>End Hour (UTC 0-23)</label>
                      <input style={{...S.inp,width:80}} type="number" min={0} max={23} value={w.endHour}
                        onChange={e=>setWindowsDraft(d=>d.map((x,j)=>j!==i?x:{...x,endHour:Number(e.target.value)}))}/>
                    </div>
                    <div><label style={S.lbl}>Label</label>
                      <input style={{...S.inp,flex:1,minWidth:120}} placeholder="e.g. Saturday afternoon" value={w.label||""}
                        onChange={e=>setWindowsDraft(d=>d.map((x,j)=>j!==i?x:{...x,label:e.target.value}))}/>
                    </div>
                    <button style={{...S.btn("red"),alignSelf:"flex-end"}}
                      onClick={()=>setWindowsDraft(d=>d.filter((_,j)=>j!==i))}>✕</button>
                  </div>
                ))}
                <button style={S.btn("gold")} onClick={()=>setWindowsDraft(d=>[...d,{day:"sat",startHour:14,endHour:22,label:""}])}>
                  + Add Time Window
                </button>

                <SaveBar dirty={dirty} onSave={saveTimeWindows} label="Save Time Windows"/>

                <div style={{marginTop:16,padding:"12px",background:C.obsidian+"88",borderRadius:6,fontSize:12,color:C.dim,lineHeight:1.7}}>
                  <strong style={{color:C.light}}>Examples:</strong><br/>
                  <strong>USA only:</strong> Sat 18:00–23:00 UTC + Sun 18:00–23:00 UTC (covers ET noon–5pm, PT 10am–3pm)<br/>
                  <strong>UK only:</strong> Sat 12:00–21:00 UTC + Sun 12:00–21:00 UTC (covers GMT noon–9pm)<br/>
                  <strong>China only:</strong> Sat 08:00–15:00 UTC + Sun 08:00–15:00 UTC (covers CST 4pm–11pm)<br/>
                  <strong>USA + UK:</strong> Sat 16:00–21:00 UTC (covers ET noon–5pm AND GMT 4pm–9pm simultaneously)<br/>
                  <strong>USA + Australia:</strong> Difficult overlap — consider separate weekday windows
                </div>
              </div>
              );
            })()}

            {/* PLACEMENT SETTINGS */}
            {tAdminTab==="placement"&&placementDraft&&(()=>{
              const dirty=JSON.stringify(placementDraft)!==JSON.stringify({...DEFAULT_PLACEMENT_SETTINGS,...T.season.placementSettings});
              return(
              <div style={S.card}>
                <div style={S.cardT}>🎮 Placement Match Settings</div>
                <div style={S.grid("1fr 1fr",14)}>
                  {[
                    ["map","Map",["Random Map",...MAPS]],
                    ["resources","Starting Resources",RESOURCES],
                    ["speed","Game Speed",SPEEDS],
                    ["gameMode","Game Mode",GAME_MODES],
                    ["mapSize","Map Size",MAP_SIZES],
                    ["civs","Civilizations",["Any (Random)","All civs allowed","Draft pick"]],
                  ].map(([field,label,opts])=>(
                    <div key={field}><label style={S.lbl}>{label}</label>
                      <select style={S.inp} value={placementDraft[field]||opts[0]}
                        onChange={e=>setPlacementDraft(d=>({...d,[field]:e.target.value}))}>
                        {opts.map(o=><option key={o}>{o}</option>)}</select></div>
                  ))}
                  <div><label style={S.lbl}>Spectator Delay (minutes, min 10)</label>
                    <input style={S.inp} type="number" min={10} max={60}
                      value={placementDraft.spectatorDelay||10}
                      onChange={e=>setPlacementDraft(d=>({...d,spectatorDelay:Math.max(10,Number(e.target.value))}))}/>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10,paddingTop:20}}>
                    <input type="checkbox" id="recReq" checked={placementDraft.recordingRequired!==false}
                      onChange={e=>setPlacementDraft(d=>({...d,recordingRequired:e.target.checked}))}
                      style={{width:18,height:18,cursor:"pointer"}}/>
                    <label htmlFor="recReq" style={{...S.lbl,margin:0,cursor:"pointer"}}>Recording Required</label>
                  </div>
                  <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Notes / Special Rules</label>
                    <textarea style={{...S.inp,minHeight:80,resize:"vertical"}}
                      value={placementDraft.notes||""}
                      onChange={e=>setPlacementDraft(d=>({...d,notes:e.target.value}))}/></div>
                </div>

                <SaveBar dirty={dirty} onSave={savePlacementSettings} label="Save Placement Settings"/>
              </div>
              );
            })()}

            {/* TIERS */}
            {tAdminTab==="tiers"&&tiersDraft&&(()=>{
              const currentComparable=JSON.stringify(T.season.tiers);
              const dirty=JSON.stringify(tiersDraft)!==currentComparable;
              return(
              <div style={S.card}>
                <div style={S.cardT}>🏅 Division Configuration, Entry Fees & Prize Splits</div>
                <p style={{color:C.dim,fontSize:12,marginBottom:16,lineHeight:1.6}}>
                  Set a prize fee per division — make some divisions free (e.g. low ELO) and others paid (e.g. higher ELO).
                  Set the cash prize percentage for 1st, 2nd, and 3rd place in each division. Percentages should total 100%.
                  The live prize pool shown updates automatically as more players' payments are confirmed received.
                </p>
                {tiersDraft.map((tier,tIdx)=>{
                  const tierPrizeFee=tier.prizeFee??T.season.prizeFee??0;
                  const tierTotalFee=(T.season.adminFee||0)+tierPrizeFee;
                  // Live pool uses ACTUAL saved player data (not draft) — players' payment status
                  // is tracked against the saved tier.id, which never changes while editing.
                  const paidInTier=T.players.filter(p=>p.tierId===tier.id&&p.paymentStatus==="received"&&!p.banned).length;
                  const tierPrizePool=paidInTier*tierPrizeFee;
                  const split=tier.prizeSplit||{first:60,second:25,third:15};
                  const splitTotal=(split.first||0)+(split.second||0)+(split.third||0);
                  const updateTier=(patch)=>setTiersDraft(d=>d.map((x,i)=>i!==tIdx?x:{...x,...patch}));
                  return(
                  <div key={tier.id} style={{padding:"14px",borderRadius:6,background:C.obsidian,border:`1px solid ${tier.color}55`,marginBottom:10}}>
                    <div style={S.grid("1fr 1fr 1fr 1fr auto",10)}>
                      {[["Name","name","text"],["Min ELO","min","number"],["Max ELO (blank=∞)","max","number"],["Icon","icon","text"]].map(([lbl,field,type])=>(
                        <div key={field}><label style={S.lbl}>{lbl}</label>
                          <input style={S.inp} type={type} value={field==="max"&&tier.max===9999?"":tier[field]}
                            placeholder={field==="max"?"∞":""}
                            onChange={e=>{
                              const val=field==="max"?(e.target.value===""?9999:Number(e.target.value)):
                                type==="number"?Number(e.target.value):e.target.value;
                              updateTier({[field]:val});
                            }}/></div>
                      ))}
                      <button style={{...S.btn("red"),alignSelf:"flex-end"}} onClick={()=>{
                        if(tiersDraft.length<=2) return toast$("Need at least 2 tiers","error");
                        setTiersDraft(d=>d.filter((_,i)=>i!==tIdx));
                      }}>✕</button>
                    </div>

                    {/* Prize fee for this division */}
                    <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.stone}`}}>
                      <div style={S.grid("1fr 1fr",10)}>
                        <div>
                          <label style={S.lbl}>Prize Fee for {tier.name} ($, 0 = free)</label>
                          <input style={S.inp} type="number" min={0} value={tierPrizeFee}
                            onChange={e=>updateTier({prizeFee:Number(e.target.value)||0})}/>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",justifyContent:"center"}}>
                          <label style={S.lbl}>Total Entry (admin + prize)</label>
                          {tierTotalFee>0?(
                            <span style={S.badge(C.gold)}>${tierTotalFee} (${T.season.adminFee||0} admin + ${tierPrizeFee} prize)</span>
                          ):(
                            <span style={S.badge(C.moss)}>🆓 Free Division</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Prize split + live pool */}
                    <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.stone}`}}>
                      <div style={{...S.row(10),flexWrap:"wrap",marginBottom:8}}>
                        <span style={{color:C.gold,fontSize:12,fontWeight:"bold"}}>🏆 Live Prize Pool:</span>
                        <span style={{color:C.moss,fontSize:16,fontWeight:"bold"}}>${tierPrizePool}</span>
                        <span style={{color:C.dim,fontSize:11}}>({paidInTier} paid player{paidInTier!==1?"s":""} × ${tierPrizeFee})</span>
                      </div>
                      <div style={S.grid("1fr 1fr 1fr",10)}>
                        {[["first","🥇 1st Place %"],["second","🥈 2nd Place %"],["third","🥉 3rd Place %"]].map(([key,label])=>(
                          <div key={key}>
                            <label style={S.lbl}>{label}</label>
                            <input style={S.inp} type="number" min={0} max={100} value={split[key]||0}
                              onChange={e=>updateTier({prizeSplit:{...split,[key]:Number(e.target.value)}})}/>
                            <div style={{color:C.dim,fontSize:10,marginTop:3}}>
                              ${Math.round(tierPrizePool*(split[key]||0)/100)}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{color:splitTotal===100?C.moss:C.ember,fontSize:11,marginTop:6}}>
                        {splitTotal===100?"✓":"⚠️"} Total: {splitTotal}% {splitTotal!==100&&"(should equal 100%)"}
                      </div>
                    </div>
                  </div>
                  );
                })}
                <button style={S.btn("gold")} onClick={()=>{
                  const last=tiersDraft[tiersDraft.length-1];
                  const newT={id:uid(),name:"New Division",min:(last?.max||999)+1,max:9999,color:C.steel,icon:"🎯",prizeFee:T.season.prizeFee||0,prizeSplit:{first:60,second:25,third:15}};
                  setTiersDraft(d=>[...d.map(x=>x.max===9999?{...x,max:newT.min-1}:x),newT]);
                }}>+ Add Division</button>

                <SaveBar dirty={dirty} onSave={saveTiers} label="Save Divisions"/>
              </div>
              );
            })()}

            {/* PLAYERS */}
            {tAdminTab==="players"&&(
              <div style={S.card}>
                <div style={S.cardT}>👥 Player Management</div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr style={{color:C.dim,fontSize:10,letterSpacing:1,textTransform:"uppercase",borderBottom:`1px solid ${C.stone}`}}>
                      {["Name","Email","ELO","Division","Status","Actions"].map(h=>(
                        <th key={h} style={{padding:"7px 9px",textAlign:"left",fontWeight:"normal"}}>{h}</th>))}
                    </tr></thead>
                    <tbody>{T.players.map(p=>(
                      <tr key={p.id} style={{borderBottom:`1px solid ${C.stone}22`,opacity:p.banned?.7:1}}>
                        <td style={{padding:"7px 9px",fontWeight:"bold",color:p.banned?C.ember:C.light}}>{p.name}</td>
                        <td style={{padding:"7px 9px",color:C.dim,fontSize:11}}>{p.email}</td>
                        <td style={{padding:"7px 9px",color:C.gold,fontWeight:"bold"}}>{p.elo}</td>
                        <td style={{padding:"7px 9px"}}><span style={S.badge(p.tier?.color||C.dim)}>{p.tier?.icon} {p.tier?.name}</span></td>
                        <td style={{padding:"7px 9px",fontSize:11,color:p.banned?C.ember:C.dim}}>
                          {p.banned?"🚫 Banned":p.classified?"✅":p.placementsDone+"/"+p.placementsNeeded}
                        </td>
                        <td style={{padding:"7px 9px"}}>
                          <div style={S.row(4)}>
                            {p.banned
                              ?<button style={{...S.btn("green"),fontSize:10,padding:"3px 7px"}} onClick={()=>unbanPlayer(T.code,p.id)}>Unban</button>
                              :<button style={{...S.btn("red"),fontSize:10,padding:"3px 7px"}} onClick={()=>{if(confirm(`Ban ${p.name}?`))banPlayer(T.code,p.id);}}>Ban</button>}
                            {!p.classified&&<button style={{...S.btn("gold"),fontSize:10,padding:"3px 7px"}} onClick={()=>{
                              const tier=getTierForElo(p.elo,T.season.tiers);
                              saveTour(T.code,t=>({...t,players:t.players.map(x=>x.id!==p.id?x:{...x,classified:true,placementsDone:t.season.placementGames,tierId:tier.id,tier})}),`✅ ${p.name} manually classified`);
                            }}>Classify</button>}
                          </div>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PAYMENTS */}
            {tAdminTab==="payments"&&(()=>{
              const anyFee=T.season.tiers.some(t=>getTierTotalFee(T,t.id)>0);
              // Eligible = classified into a tier that actually has a fee
              const eligible=T.players.filter(p=>!p.banned&&p.tierId&&getTierTotalFee(T,p.tierId)>0);
              const noneCount=eligible.filter(p=>p.paymentStatus==="none"||!p.paymentStatus).length;
              const submittedCount=eligible.filter(p=>p.paymentStatus==="submitted").length;
              const receivedCount=eligible.filter(p=>p.paymentStatus==="received").length;
              const totalPrizeCollected=(T.feeCollected||[]).filter(f=>f.type==="prizeFee"&&f.seasonName===T.season.name).reduce((s,f)=>s+f.amount,0);
              return(
              <div style={S.card}>
                <div style={S.cardT}>💰 Payment Tracking
                  <span style={{...S.badge(C.gold),marginLeft:10,fontSize:11}}>
                    ${totalPrizeCollected} prize pool collected this season
                  </span>
                </div>
                {/* Status summary */}
                <div style={S.grid("1fr 1fr 1fr",10)}>
                  <div style={{padding:"10px",background:C.ember+"18",border:`1px solid ${C.ember}44`,borderRadius:6,textAlign:"center"}}>
                    <div style={{color:C.ember,fontSize:22,fontWeight:"bold"}}>{noneCount}</div>
                    <div style={{color:C.dim,fontSize:11}}>No Payment Submitted</div>
                  </div>
                  <div style={{padding:"10px",background:C.gold+"18",border:`1px solid ${C.gold}44`,borderRadius:6,textAlign:"center"}}>
                    <div style={{color:C.gold,fontSize:22,fontWeight:"bold"}}>{submittedCount}</div>
                    <div style={{color:C.dim,fontSize:11}}>Submitted — Awaiting Confirmation</div>
                  </div>
                  <div style={{padding:"10px",background:C.moss+"18",border:`1px solid ${C.moss}44`,borderRadius:6,textAlign:"center"}}>
                    <div style={{color:C.moss,fontSize:22,fontWeight:"bold"}}>{receivedCount}</div>
                    <div style={{color:C.dim,fontSize:11}}>Received — Can Play</div>
                  </div>
                </div>

                <div style={{background:C.steel+"18",border:`1px solid ${C.steel}44`,borderRadius:6,
                  padding:"10px 14px",margin:"16px 0",fontSize:12,color:C.light,lineHeight:1.6}}>
                  <strong style={{color:C.gold}}>How payments work:</strong><br/>
                  Each division can have a different fee. Players pay via PayPal — admin fee to the platform, prize fee to your PayPal email — then click "I've Paid" themselves.
                  When you confirm receipt in your PayPal account, click <strong>Confirm Received</strong> below to unlock their tournament access.
                  Only "Received" players can play in paid divisions. Free divisions and placement games never require payment.
                </div>

                {!anyFee&&<p style={{color:C.dim}}>No division has an entry fee — all classified players can play for free.</p>}
                {anyFee&&eligible.length===0&&<p style={{color:C.dim}}>No players are currently classified into a paid division.</p>}

                {eligible.map(p=>{
                  const status=p.paymentStatus||"none";
                  const statusColor=status==="received"?C.moss:status==="submitted"?C.gold:C.ember;
                  const playerFee=getPlayerTotalFee(T,p);
                  return(<div key={p.id} style={{...S.row(10),padding:"10px 12px",borderRadius:6,
                    background:statusColor+"18",border:`1px solid ${statusColor}44`,marginBottom:8,flexWrap:"wrap"}}>
                    <div style={{flex:1,minWidth:180}}>
                      <div style={{fontWeight:"bold",fontSize:13}}>{p.name}
                        <span style={{...S.badge(p.tier?.color||C.dim),marginLeft:8,fontSize:10}}>{p.tier?.icon} {p.tier?.name}</span>
                      </div>
                      <div style={{color:C.dim,fontSize:11}}>{p.email} · {p.discord} · ${playerFee} owed</div>
                    </div>
                    <span style={S.badge(statusColor)}>
                      {status==="received"?"✓ Received":status==="submitted"?"⏳ Submitted":"✕ No Payment"}
                    </span>
                    {status==="submitted"&&(
                      <button style={S.btn("gold")} onClick={()=>adminConfirmPaymentReceived(T.code,p.id)}>
                        ✓ Confirm Received
                      </button>
                    )}
                    {status==="received"&&(
                      <button style={{...S.btn("stone"),fontSize:10,padding:"5px 10px"}} onClick={()=>adminRevertPayment(T.code,p.id,"submitted")}>
                        Revert to Submitted
                      </button>
                    )}
                    {status==="none"&&(
                      <button style={{...S.btn("stone"),fontSize:10,padding:"5px 10px"}} onClick={()=>adminConfirmPaymentReceived(T.code,p.id)}>
                        Mark Received Manually
                      </button>
                    )}
                  </div>);
                })}
              </div>
              );
            })()}

            {/* REPORTS */}
            {tAdminTab==="reports"&&(
              <div style={S.card}>
                <div style={S.cardT}>🚨 Player Reports
                  <span style={{...S.badge(C.ember),marginLeft:10,fontSize:11}}>{(T.reports||[]).filter(r=>!r.resolved).length} open</span>
                </div>
                {!(T.reports||[]).length&&<p style={{color:C.dim}}>No reports.</p>}
                {(T.reports||[]).map(rpt=>{
                  const reported=T.players.find(p=>p.id===rpt.reportedId);
                  const reporter=T.players.find(p=>p.id===rpt.reporterId);
                  return(<div key={rpt.id} style={{padding:"14px",borderRadius:6,background:C.obsidian,border:`1px solid ${rpt.resolved?C.stone:C.ember}`,marginBottom:10}}>
                    <div style={{...S.row(10),marginBottom:8}}>
                      <span style={S.badge(rpt.resolved?C.moss:C.ember)}>{rpt.resolved?"Resolved":"Open"}</span>
                      <span style={{color:C.dim,fontSize:11}}>{new Date(rpt.timestamp).toLocaleDateString()}</span>
                    </div>
                    <div style={{fontSize:13}}><strong style={{color:C.gold}}>{reported?.name}</strong> reported by <strong>{reporter?.name}</strong></div>
                    <div style={{color:C.dim,fontSize:12,marginTop:6,lineHeight:1.6}}>"{rpt.reason}"</div>
                    {!rpt.resolved&&(
                      <div style={{...S.row(8),marginTop:12}}>
                        <button style={S.btn("red")} onClick={()=>banPlayer(T.code,rpt.reportedId)}>🚫 Ban</button>
                        <button style={S.btn("stone")} onClick={()=>saveTour(T.code,t=>({...t,reports:t.reports.map(r=>r.id!==rpt.id?r:{...r,resolved:true})}))}>Resolve</button>
                      </div>
                    )}
                  </div>);
                })}
              </div>
            )}

            {/* PASSWORDS */}
            {tAdminTab==="passwords"&&(
              <div style={S.card}>
                <div style={S.cardT}>🔑 Password Management</div>
                <div style={{padding:"12px",background:C.gold+"18",border:`1px solid ${C.gold}44`,borderRadius:6,marginBottom:14}}>
                  <strong style={{color:C.gold}}>Tournament Admin Password</strong>
                  <div style={{marginTop:8}}>
                    <button style={S.btn("gold")} onClick={()=>setChangePwModal({
                      label:"Change Tournament Admin Password",
                      onSave:(pw)=>saveTour(T.code,t=>({...t,adminPassword:pwHash(pw),adminPasswordPlain:pw}),"🔑 Admin password changed")
                    })}>Change Admin Password</button>
                  </div>
                </div>
                {T.players.filter(p=>!p.banned).map(p=>(
                  <div key={p.id} style={{...S.row(10),padding:"8px 12px",borderRadius:4,background:C.obsidian,border:`1px solid ${C.stone}`,marginBottom:6}}>
                    <div style={S.badge(p.tier?.color||C.dim)}>{p.tier?.icon} {p.tier?.name}</div>
                    <div style={{flex:1}}><div style={{fontSize:13,fontWeight:"bold"}}>{p.name}</div><div style={{color:C.dim,fontSize:11}}>{p.email}</div></div>
                    <button style={{...S.btn("steel"),fontSize:11,padding:"5px 12px"}}
                      onClick={()=>setChangePwModal({
                        label:`Reset ${p.name}'s Password`,
                        onSave:(pw)=>saveTour(T.code,t=>({...t,players:t.players.map(x=>x.id!==p.id?x:{...x,pwHash:pwHash(pw)})}),`🔑 Password reset for ${p.name}`)
                      })}>🔑 Reset</button>
                  </div>
                ))}
              </div>
            )}

            {/* LOG — moved here from the public nav so only the admin can view/clear it */}
            {tAdminTab==="log"&&(
              <div style={S.card}>
                <div style={{...S.row(0,"center"),marginBottom:14}}>
                  <div style={{...S.cardT,flex:1,marginBottom:0}}>📜 Activity Log</div>
                  <button style={S.btn("red")} onClick={()=>saveTour(T.code,t=>({...t,log:[]}))}>Clear</button>
                </div>
                {!(T.log||[]).length&&<p style={{color:C.dim}}>No activity yet.</p>}
                {(T.log||[]).map((e,i)=>(
                  <div key={i} style={{padding:"7px 10px",fontSize:12,borderBottom:`1px solid ${C.stone}22`,color:i===0?C.light:C.dim}}>{e}</div>
                ))}
              </div>
            )}

            {/* DANGER */}
            {tAdminTab==="danger"&&(
              <div style={S.card}>
                <div style={S.cardT}>⚠️ Data Management</div>
                <div style={S.row(10,{flexWrap:"wrap"})}>
                  <button style={S.btn("red")} onClick={()=>{if(confirm("Reset all brackets? Players kept."))saveTour(T.code,t=>({...t,tournaments:{},placementMatches:[]}),`⚠️ All brackets reset`);}}>Reset Brackets</button>
                  <button style={S.btn("steel")} onClick={()=>{
                    const blob=new Blob([JSON.stringify(T,null,2)],{type:"application/json"});
                    const a=document.createElement("a");a.href=URL.createObjectURL(blob);
                    a.download=`${T.code}-backup-${Date.now()}.json`;a.click();
                    toast$("Backup downloaded!");
                  }}>💾 Export Backup</button>
                  <button style={S.btn("steel")} onClick={()=>{
                    const input=document.createElement("input");input.type="file";input.accept=".json";
                    input.onchange=e=>{
                      const file=e.target.files[0];if(!file) return;
                      const reader=new FileReader();
                      reader.onload=ev=>{try{
                        const data=JSON.parse(ev.target.result);
                        saveTour(T.code,()=>data,`📂 Backup restored`);
                        toast$("Restored!");
                      }catch{toast$("Invalid file","error");}};
                      reader.readAsText(file);
                    };input.click();
                  }}>📂 Restore Backup</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PLAYER PORTAL ───────────────────────────────────────────────── */}
        {tab==="portal"&&(()=>{
          if(!loggedInPlayer) return(<div style={{textAlign:"center",padding:"60px 20px"}}>
            <div style={{fontSize:44,marginBottom:12}}>🔒</div>
            <button style={S.btn("gold")} onClick={()=>setTab("login")}>🔑 Log In</button>
          </div>);
          const p=loggedInPlayer;
          const myMatches=getPlayerMatches(T,p.id);
          const pending=myMatches.filter(m=>m.outcome==="pending");
          const completed=myMatches.filter(m=>m.outcome!=="pending");
          const myBracket=p.tierId?T.tournaments[p.tierId]:null;
          const myStand=tierStandLocal(p.tierId||"");
          const myRank=myStand.findIndex(x=>x.id===p.id)+1;
          const tierData=T.season.tiers.find(t=>t.id===p.tierId);
          const myPlacementMatches=(T.placementMatches||[]).filter(m=>m.p1===p.id||m.p2===p.id)
            .sort((a,b)=>(a.scheduledTime||"").localeCompare(b.scheduledTime||""));
          const totalFee=p.tierId?getPlayerTotalFee(T,p):0;
          const myPrizeFee=p.tierId?getTierPrizeFee(T,p.tierId):0;

          return(
            <div>
              <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap"}}>
                {[["dashboard","🏠 Dashboard"],["matches","⚔️ Matches"],["standings","📊 Standings"],["profile","👤 Profile"]].map(([k,l])=>(
                  <button key={k} style={S.btn(portalTab===k?"gold":"stone")} onClick={()=>setPortalTab(k)}>{l}</button>
                ))}
              </div>

              {/* DASHBOARD */}
              {portalTab==="dashboard"&&(
                <div>
                  {/* Player card */}
                  <div style={{...S.card,background:`linear-gradient(135deg,${tierData?.color||C.gold}18,${C.parch})`,border:`1px solid ${tierData?.color||C.gold}55`}}>
                    <div style={{display:"flex",gap:20,alignItems:"center",flexWrap:"wrap"}}>
                      <div style={{fontSize:52}}>{tierData?.icon||"⚔️"}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:22,fontWeight:"bold",color:C.gold}}>{p.name}</div>
                        <div style={{color:C.dim,fontSize:13,marginTop:2}}>{p.discord} · {p.civ} · {TIMEZONES.find(t=>t.value===p.timezone)?.label}</div>
                        <div style={{marginTop:10,display:"flex",gap:16,flexWrap:"wrap"}}>
                          {[[p.elo,"ELO",C.gold],[p.wins,"WINS",C.moss],[p.losses,"LOSSES",C.ember],
                            ...(myBracket&&myRank>0?[[`#${myRank}`,"RANK",C.gold]]:[]),
                            [`${p.swissWins||0}–${p.swissLosses||0}`,"SWISS",C.light]
                          ].map(([val,label,color])=>(
                            <div key={label} style={{textAlign:"center"}}>
                              <div style={{color,fontSize:22,fontWeight:"bold"}}>{val}</div>
                              <div style={{color:C.dim,fontSize:10,letterSpacing:1}}>{label}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <span style={S.badge(tierData?.color||C.gold)}>{tierData?.icon} {tierData?.name||"Unclassified"}</span>
                        {!p.classified&&<div style={{color:C.dim,fontSize:11,marginTop:8}}>{p.placementsDone}/{p.placementsNeeded} placements</div>}
                        {totalFee>0&&(()=>{
                          const status=p.paymentStatus||"none";
                          const sc=status==="received"?C.moss:status==="submitted"?C.gold:C.ember;
                          const label=status==="received"?`✓ Payment Received ($${totalFee})`:
                            status==="submitted"?`⏳ Payment Submitted — Awaiting Confirmation`:
                            `✕ Payment Required ($${totalFee})`;
                          return(
                            <div style={{marginTop:8}}>
                              <span style={S.badge(sc)}>{label}</span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* PAYMENT SECTION — shown if player is classified into a paid division and hasn't fully paid */}
                  {p.classified&&totalFee>0&&p.paymentStatus!=="received"&&(()=>{
                    const note=`${p.email} | ${T.name} | ${p.discord}`;
                    const adminPaypalUrl=buildPaypalUrl("mlandry2011@gmail.com",T.season.adminFee||0,`Admin Fee - ${note}`);
                    const prizePaypalUrl=T.hostEmail?buildPaypalUrl(T.hostEmail,myPrizeFee,`Prize Fee - ${note}`):null;
                    return(
                      <div style={{...S.card,border:`1px solid ${C.gold}55`}}>
                        <div style={S.cardT}>💳 Pay Your Entry Fee</div>
                        <p style={{color:C.dim,fontSize:13,marginBottom:14,lineHeight:1.7}}>
                          Your <strong style={{color:tierData?.color||C.gold}}>{tierData?.name}</strong> division entry fee is split into two PayPal payments. Send both, then click "I've Paid Both Fees" below.
                          The organiser will confirm receipt and unlock your tournament access.
                        </p>
                        <div style={S.grid("1fr 1fr",12)}>
                          <div style={{padding:"14px",background:C.obsidian,borderRadius:6,border:`1px solid ${C.stone}`}}>
                            <div style={{color:C.gold,fontWeight:"bold",fontSize:13,marginBottom:6}}>1. Platform Admin Fee</div>
                            <div style={{color:C.light,fontSize:18,fontWeight:"bold",marginBottom:8}}>${T.season.adminFee||0}</div>
                            <a href={adminPaypalUrl} target="_blank" rel="noopener noreferrer"
                              style={{...S.btn("gold"),display:"inline-block",textDecoration:"none",fontSize:11,padding:"8px 14px"}}>
                              Pay via PayPal →
                            </a>
                          </div>
                          <div style={{padding:"14px",background:C.obsidian,borderRadius:6,border:`1px solid ${C.stone}`}}>
                            <div style={{color:C.moss,fontWeight:"bold",fontSize:13,marginBottom:6}}>2. Prize Pool Fee</div>
                            <div style={{color:C.light,fontSize:18,fontWeight:"bold",marginBottom:8}}>${myPrizeFee}</div>
                            {prizePaypalUrl?(
                              <a href={prizePaypalUrl} target="_blank" rel="noopener noreferrer"
                                style={{...S.btn("green"),display:"inline-block",textDecoration:"none",fontSize:11,padding:"8px 14px"}}>
                                Pay via PayPal →
                              </a>
                            ):(
                              <div style={{color:C.ember,fontSize:11}}>Organiser hasn't set up PayPal yet — contact them directly.</div>
                            )}
                          </div>
                        </div>
                        <div style={{marginTop:12,padding:"10px 12px",background:C.steel+"18",borderRadius:6,fontSize:11,color:C.dim,lineHeight:1.6}}>
                          <strong style={{color:C.light}}>Payment note (auto-included):</strong> {note}
                          <br/>This helps the organiser match your payment to your account.
                        </div>
                        {T.season.paymentInfo&&(
                          <div style={{marginTop:8,color:C.dim,fontSize:12}}>📋 {T.season.paymentInfo}</div>
                        )}
                        {(p.paymentStatus||"none")==="none"&&(
                          <button style={{...S.btn("gold"),marginTop:14}} onClick={()=>playerSubmitPayment(T.code,p.id)}>
                            ✓ I've Paid Both Fees
                          </button>
                        )}
                        {p.paymentStatus==="submitted"&&(
                          <div style={{marginTop:14,...S.badge(C.gold),display:"inline-block",padding:"8px 16px"}}>
                            ⏳ Waiting for organiser to confirm receipt
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {!p.classified&&(
                    <div style={S.card}>
                      <div style={S.cardT}>🎮 Placement Matches
                        <span style={{...S.badge(C.gold),marginLeft:10,fontSize:10}}>
                          {p.placementsDone}/{p.placementsNeeded} done
                        </span>
                      </div>
                      {!T.placementMatches?.length&&(
                        <div style={{color:C.dim,fontSize:13,lineHeight:1.7}}>
                          {T.season.registrationOpen
                            ?"Registration is open. Your placement matches will be auto-scheduled once the organiser closes registration."
                            :"Placement matches will appear here soon."}
                        </div>
                      )}
                      {myPlacementMatches.length>0&&(
                        <>
                          <div style={{marginBottom:12}}>
                            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:C.dim,marginBottom:4}}>
                              <span>{p.placementsDone} of {p.placementsNeeded} done</span>
                              <span>{p.placementsNeeded-p.placementsDone} remaining</span>
                            </div>
                            <div style={{height:8,background:C.stone,borderRadius:4,overflow:"hidden"}}>
                              <div style={{height:"100%",borderRadius:4,transition:"width .4s",
                                width:`${Math.min(100,(p.placementsDone/p.placementsNeeded)*100)}%`,
                                background:p.placementsDone>=p.placementsNeeded?C.moss:C.gold}}/>
                            </div>
                          </div>
                          {myPlacementMatches.filter(m=>!m.reported).map(m=>{
                            const oppId=m.p1===p.id?m.p2:m.p1;
                            const opp=T.players.find(x=>x.id===oppId);
                            const myReport=m.p1===p.id?m.p1Reported:m.p2Reported;
                            const alreadyReported=myReport!==null&&myReport!==undefined;
                            return(
                              <div key={m.id} style={{padding:"14px",borderRadius:6,background:C.obsidian,
                                border:`1px solid ${m.disputed?C.ember:C.gold}44`,marginBottom:10}}>
                                <div style={{color:C.gold,fontSize:11,letterSpacing:1,marginBottom:6}}>
                                  ⚔️ PLACEMENT MATCH
                                  {m.scheduledTime&&<span style={{color:C.purple,marginLeft:10}}>
                                    📅 {convertTime(m.scheduledTime,p.timezone)} ({TIMEZONES.find(t=>t.value===p.timezone)?.abbr})
                                  </span>}
                                </div>
                                {m.disputed&&<div style={{color:C.ember,fontSize:12,marginBottom:6}}>⚠️ Disputed — admin reviewing</div>}
                                <div style={{fontSize:15,fontWeight:"bold",marginBottom:10}}>
                                  vs <span style={{color:C.gold}}>{opp?.name||"?"}</span>
                                  <span style={{color:C.dim,fontSize:12}}> ({opp?.elo||"?"} ELO · {TIMEZONES.find(t=>t.value===opp?.timezone)?.abbr||"?"})</span>
                                </div>
                                <LobbyBox match={m}
                                  p1Name={T.players.find(x=>x.id===m.p1)?.name||"P1"}
                                  p2Name={opp?.name||"P2"}
                                  settings={T.season.placementSettings} isPlacement={true}/>
                                {opp&&(
                                  <MatchChat messages={m.messages} currentPlayerId={p.id} opponentName={opp.name}
                                    onSend={(text)=>sendPlacementMessage(T.code,m.id,p.id,p.name,text)}/>
                                )}
                                {!alreadyReported&&!m.disputed&&opp&&(
                                  <div style={{marginTop:10}}>
                                    <div style={{color:C.dim,fontSize:11,marginBottom:6}}>Report result:</div>
                                    <div style={S.row(8)}>
                                      <button style={{...S.btn("green"),flex:1}} onClick={()=>reportPlacementMatch(T.code,m.id,p.id,p.id)}>🏆 I Won</button>
                                      <button style={{...S.btn("red"),flex:1}} onClick={()=>reportPlacementMatch(T.code,m.id,p.id,oppId)}>✕ I Lost</button>
                                    </div>
                                  </div>
                                )}
                                {alreadyReported&&!m.reported&&<div style={{...S.badge(C.gold),marginTop:8,fontSize:11}}>⏳ Waiting for {opp?.name}</div>}
                                {opp&&!m.disputed&&<button style={{...S.btn("stone"),fontSize:10,padding:"4px 10px",marginTop:8}} onClick={()=>setReportModal(oppId)}>🚨 Report {opp?.name}</button>}
                              </div>
                            );
                          })}
                          {myPlacementMatches.filter(m=>m.reported).map(m=>{
                            const oppId=m.p1===p.id?m.p2:m.p1;
                            const opp=T.players.find(x=>x.id===oppId);
                            const won=m.winner===p.id;
                            return(<div key={m.id} style={{...S.row(10),padding:"8px 10px",borderRadius:4,
                              background:won?C.moss+"22":C.ember+"18",border:`1px solid ${won?C.moss:C.ember}44`,marginBottom:4}}>
                              <span style={{fontSize:16}}>{won?"🏆":"💀"}</span>
                              <span style={{flex:1,fontSize:12}}>vs {opp?.name||"?"}</span>
                              <span style={S.badge(won?C.moss:C.ember)}>{won?"WIN":"LOSS"}</span>
                            </div>);
                          })}
                        </>
                      )}
                    </div>
                  )}

                  {/* Tournament pending matches */}
                  {pending.length>0&&(
                    <div style={{...S.card,background:C.gold+"0F",border:`1px solid ${C.gold}44`}}>
                      <div style={{color:C.gold,fontWeight:"bold",fontSize:14,marginBottom:12}}>⚔️ {pending.length} Match{pending.length!==1?"es":""} to Play</div>
                      {pending.map(m=>{
                        const opp=T.players.find(x=>x.id===m.oppId);
                        const alreadyReported=m.myReport!==null&&m.myReport!==undefined;
                        return(
                          <div key={m.id} style={{padding:"14px",borderRadius:6,background:C.obsidian,border:`1px solid ${m.disputed?C.ember:C.stone}`,marginBottom:10}}>
                            {m.disputed&&<div style={{color:C.ember,fontSize:12,marginBottom:8}}>⚠️ Disputed — admin reviewing</div>}
                            <div style={{...S.row(10,"flex-start"),marginBottom:8,flexWrap:"wrap"}}>
                              <div style={{flex:1}}>
                                <div style={{color:C.gold,fontSize:11,letterSpacing:1,marginBottom:4}}>{m.tierIcon} {m.tierName} · {m.roundLabel}</div>
                                <div style={{fontSize:15,fontWeight:"bold"}}>vs <span style={{color:C.gold}}>{m.oppName}</span>{m.oppElo&&<span style={{color:C.dim,fontSize:12}}> ({m.oppElo})</span>}</div>
                              </div>
                              {!alreadyReported&&!m.disputed&&opp&&(
                                <div style={S.row(6)}>
                                  <button style={{...S.btn("green"),fontSize:11,padding:"7px 14px"}}
                                    onClick={()=>playerReport(T.code,m.tierId,m.roundIdx,m.id,m.isTop8,p.id,p.id)}>🏆 I Won</button>
                                  <button style={{...S.btn("red"),fontSize:11,padding:"7px 14px"}}
                                    onClick={()=>playerReport(T.code,m.tierId,m.roundIdx,m.id,m.isTop8,p.id,m.oppId)}>✕ I Lost</button>
                                </div>
                              )}
                              {alreadyReported&&!m.winner&&<span style={S.badge(C.gold)}>⏳ Waiting for opponent</span>}
                            </div>
                            <LobbyBox match={m} p1Name={p.name} p2Name={m.oppName} settings={m.settings}/>
                            {opp&&(
                              <MatchChat messages={m.messages} currentPlayerId={p.id} opponentName={m.oppName}
                                onSend={(text)=>sendTournamentMessage(T.code,m.tierId,m.roundIdx,m.id,m.isTop8,p.id,p.name,text)}/>
                            )}
                            {opp&&!m.disputed&&<button style={{...S.btn("stone"),fontSize:10,padding:"4px 10px",marginTop:8}} onClick={()=>setReportModal(m.oppId)}>🚨 Report {m.oppName}</button>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Settings vote */}
                  {p.tierId&&myBracket?.phase==="settings"&&(
                    <div style={{...S.card,border:`1px solid ${C.steel}66`}}>
                      <div style={S.cardT}>⚙️ Vote on {tierData?.name} Settings</div>
                      <div style={S.grid("1fr 1fr 1fr",12)}>
                        {[["map","🗺️ Map",MAPS.slice(0,12)],["resources","💰 Resources",RESOURCES],["speed","⚡ Speed",SPEEDS]].map(([cat,label,opts])=>{
                          const myVote=myBracket?.settingVotes?.[cat]?.[p.id];
                          const tally=tallyVotes(T.code,p.tierId,cat);
                          return(<div key={cat}>
                            <div style={{color:C.dim,fontSize:11,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>{label}</div>
                            {opts.map(o=>(
                              <button key={o} onClick={()=>castVote(T.code,p.tierId,cat,o,p.id)}
                                style={{...S.btn(myVote===o?"gold":"stone"),width:"100%",marginBottom:4,fontSize:11,padding:"7px 8px",textAlign:"left",textTransform:"none",letterSpacing:0}}>
                                {myVote===o?"✓ ":""}{o}
                              </button>
                            ))}
                            {tally.length>0&&<div style={{fontSize:11,color:C.dim,marginTop:6}}>Leading: <strong style={{color:C.gold}}>{tally[0]?.[0]}</strong></div>}
                          </div>);
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* MATCHES */}
              {portalTab==="matches"&&(
                <div>
                  {myMatches.length===0&&<div style={{...S.card,textAlign:"center",color:C.dim,padding:"40px"}}>No matches yet.</div>}
                  {pending.length>0&&(
                    <div style={S.card}>
                      <div style={S.cardT}>⚔️ Upcoming ({pending.length})</div>
                      {pending.map(m=>{
                        const opp=T.players.find(x=>x.id===m.oppId);
                        const alreadyReported=m.myReport!==null&&m.myReport!==undefined;
                        return(<div key={m.id} style={{padding:"12px",borderRadius:6,background:C.obsidian,border:`1px solid ${C.gold}44`,marginBottom:8}}>
                          <div style={{...S.row(10,"flex-start"),flexWrap:"wrap",gap:8}}>
                            <div style={{flex:1}}>
                              <div style={{color:C.dim,fontSize:11,marginBottom:3}}>{m.tierIcon} {m.tierName} · {m.roundLabel}</div>
                              <div style={{fontWeight:"bold"}}>vs {m.oppName}{m.oppElo&&<span style={{color:C.dim,fontSize:12}}> ({m.oppElo})</span>}</div>
                              {m.disputed&&<div style={{color:C.ember,fontSize:12,marginTop:3}}>⚠️ Disputed</div>}
                            </div>
                            {!alreadyReported&&!m.disputed&&opp&&(
                              <div style={S.row(6)}>
                                <button style={{...S.btn("green"),fontSize:11,padding:"6px 12px"}}
                                  onClick={()=>playerReport(T.code,m.tierId,m.roundIdx,m.id,m.isTop8,p.id,p.id)}>🏆 Won</button>
                                <button style={{...S.btn("red"),fontSize:11,padding:"6px 12px"}}
                                  onClick={()=>playerReport(T.code,m.tierId,m.roundIdx,m.id,m.isTop8,p.id,m.oppId)}>✕ Lost</button>
                              </div>
                            )}
                            {alreadyReported&&!m.winner&&<span style={S.badge(C.gold)}>⏳ Waiting</span>}
                          </div>
                          <LobbyBox match={m} p1Name={p.name} p2Name={m.oppName} settings={m.settings}/>
                          {opp&&(
                            <MatchChat messages={m.messages} currentPlayerId={p.id} opponentName={m.oppName}
                              onSend={(text)=>sendTournamentMessage(T.code,m.tierId,m.roundIdx,m.id,m.isTop8,p.id,p.name,text)}/>
                          )}
                        </div>);
                      })}
                    </div>
                  )}
                  {completed.length>0&&(
                    <div style={S.card}>
                      <div style={S.cardT}>📋 Completed ({completed.length})</div>
                      {completed.map(m=>(
                        <div key={m.id} style={{...S.row(12),padding:"10px 12px",borderRadius:6,marginBottom:6,
                          background:m.outcome==="win"?C.moss+"22":C.ember+"18",
                          border:`1px solid ${m.outcome==="win"?C.moss:C.ember}44`}}>
                          <div style={{fontSize:18}}>{m.outcome==="win"?"🏆":"💀"}</div>
                          <div style={{flex:1}}><div style={{fontSize:12,color:C.dim}}>{m.tierIcon} {m.tierName} · {m.roundLabel}</div><div style={{fontSize:13}}>vs <strong>{m.oppName}</strong></div></div>
                          <span style={S.badge(m.outcome==="win"?C.moss:C.ember)}>{m.outcome==="win"?"WIN":"LOSS"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* STANDINGS */}
              {portalTab==="standings"&&(
                <div style={S.card}>
                  <div style={S.cardT}>{tierData?.icon} {tierData?.name} Standings</div>
                  {!myStand.length&&<p style={{color:C.dim}}>Tournament not started yet.</p>}
                  {myStand.map((pl,i)=>(
                    <div key={pl.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:4,marginBottom:4,
                      background:pl.id===p.id?C.gold+"18":i<(T.season.top8Cut||8)?tierData?.color+"0F":"transparent",
                      border:pl.id===p.id?`1px solid ${C.gold}66`:"1px solid transparent",
                      borderLeft:i<(T.season.top8Cut||8)?`3px solid ${tierData?.color}66`:"3px solid transparent"}}>
                      <span style={{color:i<3?C.gold:C.dim,width:24,fontSize:13,fontWeight:"bold"}}>{i+1}</span>
                      <span style={{flex:1,fontSize:13,fontWeight:pl.id===p.id?"bold":"normal",color:pl.id===p.id?C.gold:C.light}}>
                        {pl.name}{pl.id===p.id?" (You)":""}
                      </span>
                      <span style={{fontSize:12}}>{pl.swissWins}W–{pl.swissLosses}L</span>
                      <span style={{color:C.dim,fontSize:11}}>BH:{pl.buchholz}</span>
                      <span style={{color:C.gold,fontSize:12}}>{pl.elo}</span>
                    </div>
                  ))}
                  {myRank>0&&myRank<=(T.season.top8Cut||8)&&(
                    <div style={{marginTop:12,padding:"10px 14px",background:C.moss+"22",borderRadius:6,border:`1px solid ${C.moss}44`,fontSize:13}}>
                      🎉 You are in the <strong style={{color:C.gold}}>Top {T.season.top8Cut||8}</strong>!
                    </div>
                  )}
                </div>
              )}

              {/* PROFILE */}
              {portalTab==="profile"&&profileDraft&&(()=>{
                const dirty=JSON.stringify(profileDraft)!==JSON.stringify({
                  name:p.name,discord:p.discord,email:p.email,civ:p.civ,timezone:p.timezone,
                });
                return(
                <div>
                  {/* EDITABLE PROFILE */}
                  <div style={S.card}>
                    <div style={S.cardT}>✏️ Edit Profile</div>
                    <div style={S.grid("1fr 1fr",14)}>
                      <div><label style={S.lbl}>Name</label>
                        <input style={S.inp} value={profileDraft.name}
                          onChange={e=>setProfileDraft(d=>({...d,name:e.target.value}))}/></div>
                      <div><label style={S.lbl}>Discord Tag</label>
                        <input style={S.inp} value={profileDraft.discord}
                          onChange={e=>setProfileDraft(d=>({...d,discord:e.target.value}))}/></div>
                      <div><label style={S.lbl}>Email</label>
                        <input style={S.inp} type="email" value={profileDraft.email}
                          onChange={e=>setProfileDraft(d=>({...d,email:e.target.value}))}/>
                        <div style={{color:C.dim,fontSize:10,marginTop:3}}>This is also your login.</div>
                      </div>
                      <div><label style={S.lbl}>Favourite Civ</label>
                        <select style={S.inp} value={profileDraft.civ}
                          onChange={e=>setProfileDraft(d=>({...d,civ:e.target.value}))}>
                          {CIVS.map(c=><option key={c}>{c}</option>)}
                        </select></div>
                      <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Timezone</label>
                        <select style={S.inp} value={profileDraft.timezone}
                          onChange={e=>setProfileDraft(d=>({...d,timezone:e.target.value}))}>
                          {TIMEZONES.map(tz=><option key={tz.value} value={tz.value}>{tz.label}</option>)}
                        </select>
                        <div style={{color:C.dim,fontSize:10,marginTop:3}}>Your match times are shown in this timezone.</div>
                      </div>
                    </div>
                    <SaveBar dirty={dirty} onSave={()=>playerUpdateProfile(T.code,p.id,profileDraft)} label="Save Profile"/>
                  </div>

                  {/* CHANGE PASSWORD */}
                  <div style={S.card}>
                    <div style={S.cardT}>🔑 Change Password</div>
                    <div style={S.grid("1fr 1fr",14)}>
                      <div><label style={S.lbl}>New Password</label>
                        <input style={S.inp} type="password" placeholder="Min 6 characters" value={pwChangeForm.newPw}
                          onChange={e=>setPwChangeForm(f=>({...f,newPw:e.target.value}))}/></div>
                      <div><label style={S.lbl}>Confirm New Password</label>
                        <input style={{...S.inp,borderColor:pwChangeForm.confirmPw&&pwChangeForm.confirmPw!==pwChangeForm.newPw?C.ember:undefined}}
                          type="password" placeholder="Repeat" value={pwChangeForm.confirmPw}
                          onChange={e=>setPwChangeForm(f=>({...f,confirmPw:e.target.value}))}/></div>
                    </div>
                    <button style={{...S.btn("gold"),marginTop:14}}
                      disabled={!pwChangeForm.newPw||pwChangeForm.newPw!==pwChangeForm.confirmPw}
                      onClick={()=>playerChangeOwnPassword(T.code,p.id,pwChangeForm.newPw,pwChangeForm.confirmPw)}>
                      Update Password
                    </button>
                  </div>

                  {/* READ-ONLY STATS */}
                  <div style={S.card}>
                    <div style={S.cardT}>📊 My Stats</div>
                    <div style={S.grid("1fr 1fr",14)}>
                      {[["Current ELO",p.elo],
                        ["Division",`${tierData?.icon||""} ${tierData?.name||"Unclassified"}`],
                        ["Swiss Record",`${p.swissWins||0}W–${p.swissLosses||0}L`],
                        ["All-time W/L",`${p.wins}W–${p.losses}L`],
                        ["Placements",`${p.placementsDone}/${p.placementsNeeded}${p.classified?" ✅":""}`],
                        ...(totalFee>0?[["Payment Status",
                          p.paymentStatus==="received"?"✅ Received":
                          p.paymentStatus==="submitted"?"⏳ Submitted":"❌ No Payment Submitted"]]:[]),
                      ].map(([label,value])=>(
                        <div key={label} style={{padding:"12px",background:C.obsidian,borderRadius:6,border:`1px solid ${C.stone}`}}>
                          <div style={{color:C.dim,fontSize:10,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>{label}</div>
                          <div style={{fontSize:14,fontWeight:"bold"}}>{value}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{color:C.dim,fontSize:10,marginTop:10}}>These are system-managed and update automatically as you play.</div>
                  </div>

                  <div style={{marginTop:4,marginBottom:16,display:"flex",gap:10,flexWrap:"wrap"}}>
                    <button style={S.btn("red")} onClick={logoutPlayer}>🚪 Log Out</button>
                  </div>

                  {/* Delete registration */}
                  <div style={S.card}>
                    <div style={{color:C.ember,fontSize:12,letterSpacing:1,textTransform:"uppercase",fontWeight:"bold",marginBottom:8}}>
                      ⚠️ Danger Zone
                    </div>
                    {canPlayerSelfDelete(p)?(
                      <>
                        <p style={{color:C.dim,fontSize:12,marginBottom:10,lineHeight:1.6}}>
                          Permanently delete your registration for this tournament. This removes your account and any scheduled placement matches. You can register again afterward.
                        </p>
                        <button style={S.btn("red")} onClick={()=>playerDeleteOwnAccount(T.code,p.id)}>
                          🗑️ Delete My Registration
                        </button>
                      </>
                    ):(
                      <p style={{color:C.dim,fontSize:12,lineHeight:1.6}}>
                        You can't delete your own registration anymore — you've either been classified into a division or have a payment on file.
                        Contact the tournament admin if you need to withdraw.
                      </p>
                    )}
                  </div>
                </div>
                );
              })()}
            </div>
          );
        })()}

      </div>
    </div>
  );
}
