// MLB Draft Duel — game engine
"use strict";

// ---- lineup template: 13 slots per side ----
const SLOTS = ["C","1B","2B","SS","3B","OF","OF","OF","UTL","DH","SP","SP","SP","RP","RP"];
const INF = ["1B","2B","SS","3B"];
// What positions each slot accepts. Flags (broadInf/broadOf/lenientRp) come from
// game state S; falls back to strict when S is absent (e.g. standalone tests).
function slotAccepts(slot, pos, player){
  const broadInf = (typeof S!=="undefined" && S && S.broadInf);
  const broadOf  = (typeof S!=="undefined" && S && S.broadOf);
  const lenientRp= (typeof S==="undefined" || !S || S.lenientRp!==false); // default lenient
  const isPitcher = (pos === "P");
  if (slot === "SP"){
    if (!isPitcher) return false;
    // SP prefers starters; a reliever may fill only if lenient (handled by ranking)
    return true;
  }
  if (slot === "RP"){
    return isPitcher; // lenient: any pitcher; real RP preferred via ranking
  }
  if (slot === "UTL" || slot === "DH") return !isPitcher;         // any hitter
  if (slot === "OF"){
    if (pos === "OF") return true;
    return broadOf && !isPitcher;                                  // broad: any hitter in OF
  }
  // infield slots C,1B,2B,SS,3B
  if (slot === pos) return true;
  if (broadInf && INF.includes(slot) && INF.includes(pos)) return true; // any INF fills any INF
  return false;
}
// Preference score for ranking a candidate into a slot (higher = better fit).
// Used so SP/RP and broad slots prefer the natural position before the flex fallback.
function slotFit(slot, pl){
  if (slot === "SP") return pl.ptype === "SP" ? 2 : 1;   // prefer real starters
  if (slot === "RP") return pl.ptype === "RP" ? 2 : 1;   // prefer real relievers
  if (slot === "OF") return pl.pos === "OF" ? 2 : 1;
  if (INF.includes(slot)) return pl.pos === slot ? 2 : 1;
  return 2;
}

const el = (id)=>document.getElementById(id);
function toast(msg){
  const t=document.createElement("div"); t.className="toast"; t.textContent=msg;
  document.body.appendChild(t); setTimeout(()=>t.remove(),1400);
}

// ---- fuzzy name matching ----
// Normalize: lowercase, strip accents, drop punctuation (periods, apostrophes,
// hyphens, Jr./Sr./II/III suffixes) so "O'Neill", "oneill", "Paul ONeil" align.
function normName(s){
  return s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")   // strip accents
    .replace(/\b(jr|sr|ii|iii|iv)\b/g,"")              // drop generational suffixes
    .replace(/[^a-z0-9 ]/g,"")                          // drop punctuation
    .replace(/\s+/g," ").trim();
}
function levenshtein(a,b){
  const m=a.length,n=b.length;
  if(!m) return n; if(!n) return m;
  let prev=Array.from({length:n+1},(_,i)=>i), cur=new Array(n+1);
  for(let i=1;i<=m;i++){
    cur[0]=i;
    for(let j=1;j<=n;j++){
      const cost=a[i-1]===b[j-1]?0:1;
      cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+cost);
    }
    [prev,cur]=[cur,prev];
  }
  return prev[n];
}
// How close two names are, 0..1 (1 = identical after normalization).
function nameSimilarity(input,target){
  const a=normName(input), b=normName(target);
  if(!a) return 0;
  if(a===b) return 1;
  // last-name-only match counts strongly (people type "jeter")
  const bLast=b.split(" ").pop();
  if(a===bLast) return 0.95;
  // substring (typed a subset like "derek jet")
  if(b.includes(a)||a.includes(b)) return 0.9;
  const d=levenshtein(a,b);
  const sim=1 - d/Math.max(a.length,b.length);
  // also test against last name alone for typos like "jetter"
  const dLast=levenshtein(a,bLast);
  const simLast=1 - dLast/Math.max(a.length,bLast.length);
  return Math.max(sim,simLast);
}
// Find the best roster match for a typed name. Returns {player,score} or null.
const MATCH_THRESHOLD=0.72;
function matchPlayer(input, roster){
  let best=null;
  roster.forEach(pl=>{
    const sc=nameSimilarity(input,pl.name);
    if(!best||sc>best.score) best={player:pl,score:sc};
  });
  return (best && best.score>=MATCH_THRESHOLD) ? best : null;
}

// ---------- game state ----------
let S = null;
function newState(opts){
  return {
    opp: opts.oppType, eras: opts.eras, hideRatings: opts.hideRatings, cpuDiff: parseFloat(opts.cpuDiff),
    rerollOn: opts.rerollOn, hintOn: opts.hintOn, draftMode: opts.draftMode,
    broadInf: opts.broadInf, broadOf: opts.broadOf, lenientRp: opts.lenientRp,
    round: 0, total: SLOTS.length,
    you:  { slots: SLOTS.map(s=>({slot:s,player:null})), score:0, rerolls: opts.rerollCount, hints: opts.hintCount },
    cpu:  { slots: SLOTS.map(s=>({slot:s,player:null})), score:0, rerolls: opts.rerollCount, hints: opts.hintCount },
    turn: "you", roll: null, usedTeamEra: {}, awaitingPick:false
  };
}

// ---------- team / era roll ----------
const TEAM_ABBRS = Object.keys(PLAYERS);
function pickEra(){
  // draw only from the decades the player selected at setup
  const pool = (S.eras && S.eras.length) ? S.eras : ["2020s"];
  return pool[Math.floor(Math.random()*pool.length)];
}
function rollTeam(){
  // choose a team+era that still has at least one player for an open slot of the current side
  const openSlots = S[S.turn].slots.filter(x=>!x.player).map(x=>x.slot);
  for (let tries=0; tries<40; tries++){
    const team = TEAM_ABBRS[Math.floor(Math.random()*TEAM_ABBRS.length)];
    const era = pickEra();
    const roster = (PLAYERS[team]||{})[era] || [];
    const canFill = roster.some(pl => openSlots.some(sl => slotAccepts(sl, pl.pos)));
    if (canFill) return {team, era, roster};
  }
  // fallback: any team/era
  const team = TEAM_ABBRS[0], era="2020s";
  return {team, era, roster:(PLAYERS[team][era]||[])};
}

// candidate players from the rolled roster that fit any open slot of `side`
function candidates(side){
  const open = S[side].slots.filter(x=>!x.player).map(x=>x.slot);
  const taken = new Set(S[side].slots.filter(x=>x.player).map(x=>x.player.name+"|"+x.player.era));
  const list = S.roll.roster
    .filter(pl => open.some(sl=>slotAccepts(sl,pl.pos)))
    .filter(pl => !taken.has(pl.name+"|"+S.roll.era));
  // dedupe by name, keep best rating
  const byName={};
  list.forEach(pl=>{ if(!byName[pl.name]||pl.rating>byName[pl.name].rating) byName[pl.name]={...pl, era:S.roll.era, team:S.roll.team}; });
  return Object.values(byName).sort((a,b)=>b.rating-a.rating);
}

// place a player into the best open slot that accepts them (preference-ranked)
function placePlayer(side, pl){
  const openAccept = S[side].slots.filter(s => !s.player && slotAccepts(s.slot, pl.pos, pl));
  if (!openAccept.length) return false;
  // choose the slot with the highest fit (exact position / real SP|RP before flex)
  openAccept.sort((a,b)=> slotFit(b.slot,pl) - slotFit(a.slot,pl));
  const target = openAccept[0];
  target.player = pl; S[side].score += pl.rating;
  return true;
}

// ---------- rendering ----------
const TEAMNAME = (ab)=> (typeof TEAMS!=="undefined" && TEAMS[ab]) ? TEAMS[ab] : ab;

// Original colored roundel for a team (team colors + abbreviation). NOT an
// official MLB logo — our own simple badge so teams are visually distinct.
function teamBadge(ab, cls){
  const c = (typeof TEAM_COLORS!=="undefined" && TEAM_COLORS[ab]) ? TEAM_COLORS[ab] : ["#334","#99a"];
  const [bg, ring] = c;
  const extra = cls ? " "+cls : "";
  return `<span class="badge${extra}" style="background:${bg};color:${ring};border-color:${ring}">${ab}</span>`;
}

function renderRoster(side, mountId){
  const mount=el(mountId); mount.innerHTML="";
  S[side].slots.forEach(s=>{
    const d=document.createElement("div");
    d.className="slot "+(s.player?"filled":"open");
    const hide = S.hideRatings;
    const nm = s.player ? `${teamBadge(s.player.team,"sm")} ${s.player.name} <span class="muted">(${s.player.era})</span>` : "<span class='muted'>— open —</span>";
    d.innerHTML=`<span class="pos">${s.slot}</span><span class="nm">${nm}</span><span class="rt">${s.player?(hide?'·':s.player.rating):""}</span>`;
    mount.appendChild(d);
  });
  const tot=S[side].slots.reduce((a,s)=>a+(s.player?s.player.rating:0),0);
  const t=document.createElement("div"); t.className="muted"; t.style.marginTop="6px";
  t.innerHTML=`Lineup total: <b>${S.hideRatings?'hidden until final':tot}</b>`; mount.appendChild(t);
}
function updateScores(){
  el("scoreYou").textContent=S.you.score;
  el("scoreOpp").textContent=S.cpu.score;
}
function renderTurn(){
  el("turnPill").textContent = S.turn==="you" ? "Your pick" : (S.opp==="cpu"?"CPU pick":"Player 2 pick");
  el("roundPill").textContent = `Round ${Math.min(S.round+1,S.total)} / ${S.total}`;
}

// ---------- flow ----------
function startGame(){
  const eras = Array.from(document.querySelectorAll(".eraBox:checked")).map(b=>b.value);
  if (eras.length === 0){ toast("Pick at least one decade"); return; }
  S = newState({
    oppType: el("oppType").value, eras: eras,
    hideRatings: el("hideRatings").checked, cpuDiff: el("cpuDiff").value,
    rerollOn: el("rerollOn").checked, rerollCount: parseInt(el("rerollCount").value,10),
    hintOn: el("hintOn").checked, hintCount: parseInt(el("hintCount").value,10),
    broadInf: el("broadInf").checked, broadOf: el("broadOf").checked, lenientRp: el("lenientRp").checked,
    draftMode: el("draftMode").value
  });
  el("oppLabel").textContent = S.opp==="cpu" ? "CPU" : "P2";
  el("oppRosterTitle").textContent = (S.opp==="cpu"?"CPU":"Player 2")+" lineup";
  el("setup").classList.add("hidden");
  el("result").classList.add("hidden");
  el("trivia").classList.add("hidden");
  el("game").classList.remove("hidden");
  renderRoster("you","youRoster"); renderRoster("cpu","oppRoster");
  updateScores(); renderTurn();
  el("pickArea").classList.add("hidden");
  el("cpuBanner").classList.add("hidden");
  el("teamRoll").innerHTML='—<small></small>';
  if (S.opp==="cpu"){
    // vs Computer: no manual roll — the game auto-rolls each turn.
    el("rollBtn").style.display="none";
    el("rollBtn").disabled=true;
    setTimeout(doRoll, 500);
  } else {
    // pass-and-play: manual roll each turn
    el("rollBtn").style.display="";
    el("rollBtn").disabled=false;
  }
}

function doRoll(){
  if (S.round >= S.total){ return; }
  S.roll = rollTeam();
  el("teamRoll").innerHTML = `${teamBadge(S.roll.team)}<small>${TEAMNAME(S.roll.team)} · ${S.roll.era}</small>`;
  el("rollBtn").disabled=true;
  el("cpuBanner").classList.add("hidden");
  if (S.turn==="you" || (S.turn==="cpu" && S.opp==="human")){
    showChoices();
  } else {
    cpuPick();
  }
}

function showChoices(){
  const side = S.turn==="you" ? "you" : "cpu";
  const cands = candidates(side);
  const area=el("pickArea");
  if (cands.length===0){ // no player on this team fits an open slot — re-roll automatically
    toast("No fit on this team — rolling again"); el("rollBtn").disabled=false; setTimeout(doRoll,600); return;
  }
  // list open slots so the player knows what positions they still need
  const open = S[side].slots.filter(x=>!x.player).map(x=>x.slot);
  const counts={};
  open.forEach(s=>counts[s]=(counts[s]||0)+1);
  const openTxt = Object.entries(counts).map(([s,n])=>n>1?`${s}×${n}`:s).join(", ");
  el("openSlots").textContent = `Open slots: ${openTxt}`;
  el("pickFeedback").textContent="";
  const inp=el("nameInput"); inp.value=""; inp.disabled=false;
  el("submitName").disabled=false;
  // reroll / hint buttons (only for a human-controlled turn)
  const human = (S.turn==="you") || (S.opp==="human");
  const sd = S[side];
  const rb=el("rerollBtn"), hb=el("hintBtn");
  rb.style.display = (S.rerollOn && human) ? "" : "none";
  // hints are redundant in multiple-choice mode (it's already a choice list)
  hb.style.display = (S.hintOn && human && S.draftMode!=="choice") ? "" : "none";
  el("rerollLeft").textContent = sd.rerolls>=999 ? "∞" : sd.rerolls;
  el("hintLeft").textContent   = sd.hints>=999 ? "∞" : sd.hints;
  rb.disabled = sd.rerolls<=0;
  hb.disabled = sd.hints<=0;
  el("hintChoices").classList.add("hidden"); el("hintChoices").innerHTML="";

  if (S.draftMode==="choice"){
    // MULTIPLE-CHOICE mode: hide text entry, render up to 6 eligible players to click
    el("pickPrompt").textContent="Pick a player from this team to fill an open slot:";
    el("nameInput").style.display="none"; el("submitName").style.display="none";
    const box=el("mcChoices");
    const offer = cands.slice(0, Math.min(6, cands.length));
    // shuffle so the best isn't always first
    for(let i=offer.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [offer[i],offer[j]]=[offer[j],offer[i]]; }
    box.innerHTML="";
    offer.forEach(pl=>{
      const b=document.createElement("button"); b.className="btn choice";
      const rt = S.hideRatings ? "" : `<span class="rt">${pl.rating}</span>`;
      b.innerHTML=`<span>${pl.name} <span class="muted">${pl.pos}</span></span>${rt}`;
      b.onclick=()=>pickChoice(pl);
      box.appendChild(b);
    });
    box.classList.remove("hidden");
  } else {
    el("pickPrompt").textContent="Type the name of a player from this team to fill an open slot:";
    el("nameInput").style.display=""; el("submitName").style.display="";
    el("mcChoices").classList.add("hidden"); el("mcChoices").innerHTML="";
    inp.focus();
  }
  area.classList.remove("hidden");
}

// Multiple-choice draft: place the clicked player directly.
function pickChoice(pl){
  const side = S.turn==="you" ? "you" : "cpu";
  if(!placePlayer(side, {...pl})){ toast("No open slot for that position"); return; }
  toast(`Drafted ${pl.name}`);
  el("mcChoices").classList.add("hidden"); el("mcChoices").innerHTML="";
  el("pickArea").classList.add("hidden");
  afterPick();
}

// Reroll the current team for this side, consuming one reroll.
function doReroll(){
  const side = S.turn==="you" ? "you" : "cpu";
  const sd = S[side];
  if (!S.rerollOn || sd.rerolls<=0) return;
  if (sd.rerolls < 999) sd.rerolls--;
  el("pickArea").classList.add("hidden");
  el("teamRoll").innerHTML='—<small></small>';
  toast("Rerolling team…");
  setTimeout(doRoll, 400);
}

// Hint: show 4 random candidate players (one is a strong pick), ratings hidden,
// consuming one hint. Clicking a hint name fills it into the text box.
function doHint(){
  const side = S.turn==="you" ? "you" : "cpu";
  const sd = S[side];
  if (!S.hintOn || sd.hints<=0) return;
  const cands = candidates(side);
  if (!cands.length) return;
  if (sd.hints < 999) sd.hints--;
  el("hintLeft").textContent = sd.hints>=999 ? "∞" : sd.hints;
  if (sd.hints<=0) el("hintBtn").disabled=true;
  // 4 choices: include the top candidate, then 3 random others; shuffle; ratings hidden
  const top = cands[0];
  const rest = cands.slice(1);
  const picks=[top];
  while(picks.length<4 && rest.length){
    const i=Math.floor(Math.random()*rest.length);
    picks.push(rest.splice(i,1)[0]);
  }
  picks.sort(()=>Math.random()-0.5);
  const box=el("hintChoices"); box.innerHTML="";
  picks.forEach(pl=>{
    const b=document.createElement("button");
    b.className="btn choice";
    b.innerHTML=`<span>${pl.name} <span class="muted">${pl.pos}</span></span>`; // points hidden
    b.onclick=()=>{ el("nameInput").value=pl.name; el("nameInput").focus(); };
    box.appendChild(b);
  });
  box.classList.remove("hidden");
}

// Validate a typed name for the current side against the rolled team's roster.
function submitTypedName(){
  const side = S.turn==="you" ? "you" : "cpu";
  const raw = el("nameInput").value.trim();
  const fb = el("pickFeedback");
  if(!raw){ fb.innerHTML='<span class="tie">Type a name first.</span>'; return; }

  // match against the FULL rolled roster (so we can tell "not on team" from "already taken/doesn't fit")
  const onTeam = matchPlayer(raw, S.roll.roster);
  if(!onTeam){
    fb.innerHTML=`<span class="lose">❌ No player like "<b>${escapeHtml(raw)}</b>" on the ${TEAMNAME(S.roll.team)} (${S.roll.era}). Try again.</span>`;
    return;
  }
  // the matched player must still be able to fill one of this side's open slots
  const cands = candidates(side);
  const fit = cands.find(c => c.name === onTeam.player.name);
  if(!fit){
    // player exists but either already drafted this round-set or no open slot accepts the position
    const taken = S[side].slots.some(s=>s.player && s.player.name===onTeam.player.name && s.player.era===S.roll.era);
    if(taken){
      fb.innerHTML=`<span class="lose">You already have ${onTeam.player.name}. Pick someone else.</span>`;
    } else {
      fb.innerHTML=`<span class="lose">${onTeam.player.name} is a ${onTeam.player.pos}, and you have no open ${onTeam.player.pos} slot. Try another player.</span>`;
    }
    return;
  }
  // accepted
  if(!placePlayer(side, {...fit})){ fb.innerHTML='<span class="lose">No open slot for that position.</span>'; return; }
  const note = onTeam.score < 0.999 ? ` <span class="muted">(matched "${escapeHtml(raw)}")</span>` : "";
  toast(`Drafted ${fit.name}`);
  el("nameInput").disabled=true; el("submitName").disabled=true;
  el("pickArea").classList.add("hidden");
  afterPick();
}

function escapeHtml(s){ return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function cpuPick(){
  const cands = candidates("cpu");
  if (cands.length===0){ el("rollBtn").disabled=false; setTimeout(doRoll,400); return; }
  // CPU skill: diff=1 picks best; lower diff picks from a wider, weaker band
  const band = Math.max(1, Math.round(cands.length*(1-S.cpuDiff)) + 1);
  const pool = cands.slice(0, Math.min(cands.length, band));
  const pick = pool[Math.floor(Math.random()*pool.length)];
  setTimeout(()=>{
    placePlayer("cpu",pick);
    // banner: rolled team + what the CPU drafted
    const b=el("cpuBanner"); b.className="cpuBanner";
    b.innerHTML=`${teamBadge(S.roll.team)}<div class="pickline">`+
      `<div class="muted">${S.opp==='cpu'?'CPU':'Player 2'} rolled <b style="color:var(--text)">${TEAMNAME(S.roll.team)}</b> · ${S.roll.era}</div>`+
      `<div>drafted <b>${pick.name}</b> <span class="muted">${pick.pos}${S.hideRatings?'':' · rating '+pick.rating}</span></div></div>`;
    afterPick();
  }, 800);
}

function afterPick(){
  renderRoster("you","youRoster"); renderRoster("cpu","oppRoster");
  updateScores();
  // advance turn: you -> opp (same round), opp -> next round
  if (S.turn==="you"){ S.turn="cpu"; }
  else { S.turn="you"; S.round++; }
  renderTurn();
  if (S.round>=S.total){ finishGame(); return; }
  el("teamRoll").innerHTML='—<small></small>';
  if (S.opp==="cpu"){
    // vs Computer: both turns roll automatically.
    el("rollBtn").disabled=true;
    // CPU's turn auto-picks; your turn auto-rolls then drops you into the text box.
    setTimeout(doRoll, S.turn==="cpu" ? 900 : 650);
  } else {
    // pass-and-play (vs Player 2): wait for a manual roll each turn
    el("rollBtn").disabled=false;
  }
}

function finishGame(){
  el("game").classList.add("hidden");
  const r=el("result"); r.classList.remove("hidden");
  const you=S.you.score, opp=S.cpu.score;
  const verdict = you>opp ? `<span class="win">You win! 🏆</span>` :
                  you<opp ? `<span class="lose">${S.opp==='cpu'?'CPU':'Player 2'} wins</span>` :
                  `<span class="tie">It's a tie</span>`;
  let rows="";
  for(let i=0;i<SLOTS.length;i++){
    const y=S.you.slots[i].player, o=S.cpu.slots[i].player;
    const yr=y?y.rating:0, or=o?o.rating:0;
    const cls = yr>or?"win":yr<or?"lose":"tie";
    rows+=`<tr><td><b>${SLOTS[i]}</b></td>
      <td>${y?teamBadge(y.team,"sm")+" "+y.name:"—"} <span class="muted">${y?y.rating:""}</span></td>
      <td class="${cls}">${yr>or?"▲":yr<or?"▼":"="}</td>
      <td>${o?teamBadge(o.team,"sm")+" "+o.name:"—"} <span class="muted">${o?o.rating:""}</span></td></tr>`;
  }
  r.innerHTML=`<h2 style="margin-top:0">Final — ${verdict}</h2>
    <div class="row" style="gap:30px;margin-bottom:10px">
      <div><div class="score you">${you}</div><div class="muted">You</div></div>
      <div><div class="score opp">${opp}</div><div class="muted">${S.opp==='cpu'?'CPU':'Player 2'}</div></div>
    </div>
    <table><tr><th>Slot</th><th>You</th><th></th><th>${S.opp==='cpu'?'CPU':'Player 2'}</th></tr>${rows}</table>
    <div class="row" style="margin-top:14px">
      <button class="btn primary" onclick="startGame()">Rematch</button>
      <button class="btn" onclick="showSetup()">New Setup</button>
    </div>`;
}

function showSetup(){
  el("game").classList.add("hidden"); el("result").classList.add("hidden");
  el("trivia").classList.add("hidden"); el("setup").classList.remove("hidden");
}

// ---------- trivia mode ----------
let TR={score:0,asked:0,answer:null};
function trEras(){
  const sel = Array.from(document.querySelectorAll(".trEraBox:checked")).map(b=>b.value);
  return sel.length ? sel : ERAS;  // fall back to all if none checked
}
function allRealPlayers(){
  // flatten curated players, scoped to the trivia decade toggles
  const eras = trEras();
  const out=[];
  for(const team of TEAM_ABBRS){
    for(const era of eras){
      for(const pl of (PLAYERS[team][era]||[])){
        out.push({...pl, team, era});
      }
    }
  }
  return out;
}
function startTrivia(){
  el("setup").classList.add("hidden"); el("game").classList.add("hidden");
  el("result").classList.add("hidden"); el("trivia").classList.remove("hidden");
  TR={score:0,asked:0,answer:null}; updateTrScore(); nextTrivia();
}
function updateTrScore(){ el("trScore").textContent=`Score ${TR.score} / ${TR.asked}`; }
function nextTrivia(){
  el("trFeedback").textContent="";
  const all=allRealPlayers();
  const q = all[Math.floor(Math.random()*all.length)];
  TR.answer=q.name;
  el("trQ").innerHTML=`Which player: <span style="color:var(--accent2)">${TEAMNAME(q.team)}</span>, <b>${q.era}</b>, position <b>${q.pos}</b>?`;
  // distractors: same position, different name
  const pool = all.filter(p=>p.pos===q.pos && p.name!==q.name);
  const picks=[]; const seen=new Set([q.name]);
  while(picks.length<3 && pool.length){
    const c=pool[Math.floor(Math.random()*pool.length)];
    if(!seen.has(c.name)){ seen.add(c.name); picks.push(c.name); }
    if(seen.size>pool.length+1) break;
  }
  const options=[q.name,...picks].sort(()=>Math.random()-0.5);
  const box=el("trChoices"); box.innerHTML="";
  options.forEach(name=>{
    const b=document.createElement("button"); b.className="btn choice"; b.textContent=name;
    b.onclick=()=>answerTrivia(name,b); box.appendChild(b);
  });
}
function answerTrivia(name,btn){
  TR.asked++;
  if(name===TR.answer){ TR.score++; btn.style.borderColor="var(--ok)"; el("trFeedback").innerHTML='<span class="win">Correct! ✓</span>'; }
  else{ btn.style.borderColor="var(--danger)"; el("trFeedback").innerHTML=`<span class="lose">Nope.</span> It was <b>${TR.answer}</b>.`; }
  updateTrScore();
  Array.from(el("trChoices").children).forEach(b=>b.disabled=true);
}

// ---------- wiring ----------
el("startBtn").onclick=startGame;
el("rollBtn").onclick=doRoll;
el("modeDraft").onclick=showSetup;
el("modeTrivia").onclick=startTrivia;
el("trNext").onclick=nextTrivia;
el("submitName").onclick=submitTypedName;
el("rerollBtn").onclick=doReroll;
el("hintBtn").onclick=doHint;
el("nameInput").addEventListener("keydown",(e)=>{ if(e.key==="Enter"){ e.preventDefault(); submitTypedName(); } });
el("oppType").onchange=()=>{ el("cpuDiffWrap").style.display = el("oppType").value==="cpu"?"":"none"; };
