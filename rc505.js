/* ====================================================
   RC-505mkII Loop Station — interaction + audio
   ==================================================== */

const TRACK_COUNT = 5;

const state = {
  tracks: [],
  bpm: 120,
  rhythm: false,
  toneStarted: false,
  inputBank:  { lit: ['A'] },   // which letters are lit in input-fx bank row
  trackBank:  { lit: ['A'] },
  toggles:    { menu: false, loop: false, exit: false, enter: false }
};

/* ---------- Tone setup ---------- */
let masterGain = null;
let metronome = null;
let lastTap = [];

function initAudio(){
  if(!window.Tone) return;
  Tone.Transport.bpm.value = state.bpm;
  const comp = new Tone.Compressor({ threshold: -18, ratio: 3 }).toDestination();
  masterGain = new Tone.Gain(0.85).connect(comp);
}

async function ensureToneStarted(){
  if(!state.toneStarted){
    await Tone.start();
    Tone.Transport.start();
    state.toneStarted = true;
  }
}

/* ---------- Track factory ---------- */
function makeTrackEl(idx){
  const id = idx + 1;
  const wrap = document.createElement('div');
  wrap.className = 'track-strip';
  wrap.dataset.id = id;
  wrap.innerHTML = `
    <div class="tr-controls">
      <button class="tr-fx-btn lit" data-fn="fx" data-id="${id}">FX</button>
      <button class="tr-track-btn lit" data-fn="track" data-id="${id}">TRACK</button>
      <div class="tr-clear-label">CLEAR: HOLD</div>
      <div class="tr-stop-wrap">
        <button class="tr-stop-btn" data-fn="stop" data-id="${id}" title="Click: stop · Hold: clear">
          <span class="stop-square"></span>
        </button>
      </div>
    </div>

    <div class="tr-fader-col">
      <div class="fader-track" data-fn="fader" data-id="${id}">
        <div class="fader-thumb" style="bottom: calc(80% - 13px);"></div>
      </div>
    </div>

    <div class="tr-number">${id}</div>

    <div class="tr-big-btn-wrap">
      <button class="tr-big-btn" data-fn="big" data-id="${id}" data-state="empty">
        <div class="ring-outer"></div>
        <div class="progress-sweep"></div>
        <div class="inner-button">
          <div class="inner-glyph">
            <span class="play-tri"></span>
            <span class="slash">/</span>
            <span class="rec-dot"></span>
          </div>
        </div>
      </button>
    </div>

    <div class="tr-status" data-id="${id}">EMPTY</div>
  `;
  return wrap;
}

function initTracks(){
  const row = document.getElementById('tracks-row');
  for(let i=0;i<TRACK_COUNT;i++){
    row.appendChild(makeTrackEl(i));
    state.tracks.push({
      id: i+1,
      state: 'empty',  // empty | recording | playing | overdubbing | stopped
      player: null,
      recorder: null,
      mediaStream: null,
      buffer: null,
      volume: 0.8,
      fxOn: true,
      trackBtnLit: true,
      length: 0,
      startTime: 0,
    });
  }
}

/* ---------- Big button state machine ---------- */
async function handleBigBtn(id){
  const t = state.tracks[id-1];
  await ensureToneStarted();

  switch(t.state){
    case 'empty':       await startRecording(t); break;
    case 'recording':   await finishRecAndPlay(t); break;
    case 'playing':     startOverdub(t); break;
    case 'overdubbing': stopOverdub(t); break;
    case 'stopped':     resumePlay(t); break;
  }
  renderTrack(t);
}

async function startRecording(t){
  try{
    if(!t.mediaStream){
      t.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation:false, noiseSuppression:false, autoGainControl:false }
      });
    }
    const ac = Tone.context;
    const src = ac.createMediaStreamSource(t.mediaStream);
    t.recorder = new Tone.Recorder();
    src.connect(t.recorder);
    t.recorder.start();
    t.state = 'recording';
    t.startTime = Tone.now();
  }catch(err){
    console.error(err);
    showToast('마이크 권한이 필요합니다. 데모 모드로 진행됩니다.');
    // demo: pretend record for 2 sec
    t.state = 'recording';
    t.startTime = Tone.now();
    t._demo = true;
    setTimeout(()=>{ if(t.state==='recording'){ finishRecAndPlay(t); renderTrack(t); } }, 2000);
  }
}

async function finishRecAndPlay(t){
  if(t.recorder){
    try{
      const blob = await t.recorder.stop();
      const ab = await blob.arrayBuffer();
      const decoded = await Tone.context.decodeAudioData(ab);
      t.buffer = decoded;
      t.length = decoded.duration;
      if(t.player) t.player.dispose();
      t.player = new Tone.Player({ url: decoded, loop: true, fadeIn:0.01, fadeOut:0.01 }).connect(masterGain);
      t.player.volume.value = Tone.gainToDb(t.volume);
      t.player.start();
    }catch(err){ console.error(err); }
    t.recorder = null;
  }else if(t._demo){
    t.length = 2; // demo length
  }
  t.state = 'playing';
  t.startTime = Tone.now();
}

function startOverdub(t){ if(t.state==='playing') t.state='overdubbing'; }
function stopOverdub(t){  if(t.state==='overdubbing') t.state='playing'; }
function stopTrack(t){
  if(t.player) t.player.stop();
  if(t.state !== 'empty') t.state = 'stopped';
}
function resumePlay(t){
  if(t.buffer && t.player){
    t.player.start();
    t.state = 'playing';
    t.startTime = Tone.now();
  }
}
function clearTrack(t){
  if(t.player){ t.player.dispose(); t.player=null; }
  t.buffer = null; t.length = 0;
  t.state = 'empty';
  t._demo = false;
  renderTrack(t);
}

/* ---------- Rendering ---------- */
function renderTrack(t){
  const btn = document.querySelector(`.tr-big-btn[data-id="${t.id}"]`);
  if(btn) btn.setAttribute('data-state', t.state);
  const status = document.querySelector(`.tr-status[data-id="${t.id}"]`);
  if(status){
    const map = {
      empty:       ['EMPTY',      ''],
      recording:   ['● REC',      'rec'],
      playing:     ['▶ PLAY',     'play'],
      overdubbing: ['◉ OVERDUB',  'over'],
      stopped:     ['■ STOPPED',  '']
    };
    const [text, cls] = map[t.state];
    status.textContent = text + (t.length ? ` · ${t.length.toFixed(1)}s` : '');
    status.className = 'tr-status ' + cls;
  }
  const stopBtn = document.querySelector(`.tr-stop-btn[data-id="${t.id}"]`);
  if(stopBtn){
    stopBtn.classList.toggle('lit', t.state==='playing' || t.state==='overdubbing');
    stopBtn.classList.toggle('recording', t.state==='recording');
  }
  const fxBtn = document.querySelector(`.tr-fx-btn[data-id="${t.id}"]`);
  if(fxBtn) fxBtn.classList.toggle('lit', t.fxOn);
  const tkBtn = document.querySelector(`.tr-track-btn[data-id="${t.id}"]`);
  if(tkBtn) tkBtn.classList.toggle('lit', t.state !== 'empty');
}

function renderAll(){ state.tracks.forEach(renderTrack); }

function renderBanks(){
  document.querySelectorAll('.abcd-bank').forEach(bank => {
    const which = bank.dataset.bank;
    const lit = state[which==='input' ? 'inputBank' : 'trackBank'].lit;
    bank.querySelectorAll('.bank-btn').forEach(b => {
      b.classList.toggle('lit', lit.includes(b.dataset.letter));
    });
  });
}

function updateLCD(){
  document.getElementById('lcd-bpm').textContent = state.bpm.toFixed(1);
}

/* ---------- Global controls ---------- */
function allStartStop(){
  const anyPlaying = state.tracks.some(t => t.state==='playing' || t.state==='overdubbing');
  state.tracks.forEach(t => {
    if(anyPlaying){
      stopTrack(t);
    }else if(t.buffer || t._demo){
      resumePlay(t);
    }
    renderTrack(t);
  });
  flashOval('all-start-stop');
}
function undoRedo(){
  flashOval('undo-redo');
  showToast('UNDO/REDO (시뮬레이션)');
}
function tapTempo(){
  const now = Date.now();
  lastTap.push(now);
  if(lastTap.length > 4) lastTap.shift();
  if(lastTap.length >= 2){
    let sum = 0;
    for(let i=1;i<lastTap.length;i++) sum += lastTap[i]-lastTap[i-1];
    const avg = sum / (lastTap.length-1);
    const bpm = Math.round(60000 / avg);
    if(bpm>40 && bpm<300){
      state.bpm = bpm;
      if(window.Tone) Tone.Transport.bpm.value = bpm;
      updateLCD();
    }
  }
  flashOval('tap-tempo');
}
function toggleRhythm(){
  state.rhythm = !state.rhythm;
  const btn = document.querySelector('[data-fn="rhythm-start-stop"]');
  btn.classList.toggle('active', state.rhythm);
  if(state.rhythm){
    ensureToneStarted();
    if(!metronome){
      metronome = new Tone.Loop(time => {
        const click = new Tone.MembraneSynth({
          pitchDecay: 0.008,
          octaves: 2,
          envelope: { attack:0.001, decay:0.1, sustain:0, release:0.1 }
        }).toDestination();
        click.triggerAttackRelease('C2', '32n', time);
      }, '4n').start(0);
    }
  }else if(metronome){
    metronome.stop();
    metronome.dispose();
    metronome = null;
  }
}

function flashOval(fn){
  const el = document.querySelector(`[data-fn="${fn}"]`);
  if(el){
    el.classList.add('flash');
    setTimeout(()=> el.classList.remove('flash'), 300);
  }
}

/* ---------- Toast ---------- */
let toastTimer = null;
function showToast(msg){
  let el = document.getElementById('rc-toast');
  if(!el){
    el = document.createElement('div');
    el.id = 'rc-toast';
    Object.assign(el.style, {
      position:'fixed', bottom:'24px', left:'50%', transform:'translateX(-50%)',
      background:'#16171b', color:'#e7e8ea', padding:'10px 18px',
      borderRadius:'8px', border:'1px solid #2a2b30',
      fontSize:'12px', letterSpacing:'0.04em', zIndex:200,
      boxShadow:'0 10px 30px rgba(0,0,0,0.4)'
    });
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> el.style.opacity = '0', 2400);
  el.style.transition = 'opacity 0.4s ease';
}

/* ---------- Knob drag ---------- */
// Three modes: vertical drag (sensitive), mouse wheel, rotational drag (drag in a circle).
// Hold Shift for fine control. Shows a value tooltip while interacting.
function makeKnobDraggable(el, onChange){
  const cap = el.querySelector('.big-knob-cap, .pk-cap, .mini-knob-cap');
  const MIN = -150, MAX = 150; // degrees
  const SENS = 2.2;            // px-to-deg multiplier for vertical drag
  const SENS_FINE = 0.5;       // Shift fine mode
  const WHEEL_STEP = 6;        // deg per wheel tick
  let value = parseFloat(el.dataset.value || 0);
  el.dataset.value = value;

  function setValue(v, animate=false){
    value = Math.max(MIN, Math.min(MAX, v));
    el.dataset.value = value;
    if(cap){
      cap.style.transition = animate ? 'transform 0.18s ease' : 'transform 0.05s linear';
      cap.style.transform = `rotate(${value}deg)`;
    }
    showKnobTip(el, value);
    if(onChange) onChange(value);
  }

  // -- vertical drag --
  let startY = 0, startVal = 0, mode = null, centerX=0, centerY=0, startAngle=0;
  function onDown(e){
    e.preventDefault();
    el.setPointerCapture?.(e.pointerId ?? 1);
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    startVal = value;
    // detect rotational mode: pointer further from center than 35% of knob radius
    const r = el.getBoundingClientRect();
    centerX = r.left + r.width/2;
    centerY = r.top + r.height/2;
    const x0 = e.touches ? e.touches[0].clientX : e.clientX;
    const y0 = e.touches ? e.touches[0].clientY : e.clientY;
    const dist = Math.hypot(x0-centerX, y0-centerY);
    if(dist > r.width*0.18){
      mode = 'rotate';
      startAngle = Math.atan2(y0-centerY, x0-centerX) * 180/Math.PI;
    }else{
      mode = 'vertical';
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, {passive:false});
    window.addEventListener('touchend', onUp);
  }
  function onMove(e){
    e.preventDefault();
    const fine = e.shiftKey ? SENS_FINE : SENS;
    if(mode === 'rotate'){
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      const y = e.touches ? e.touches[0].clientY : e.clientY;
      const ang = Math.atan2(y-centerY, x-centerX) * 180/Math.PI;
      let delta = ang - startAngle;
      // unwrap
      if(delta > 180) delta -= 360;
      if(delta < -180) delta += 360;
      setValue(startVal + delta * (e.shiftKey ? 0.4 : 1));
      startAngle = ang;
      startVal = value;
    }else{
      const y = e.touches ? e.touches[0].clientY : e.clientY;
      const dy = startY - y;
      setValue(startVal + dy * fine);
    }
  }
  function onUp(){
    mode = null;
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('touchend', onUp);
    setTimeout(hideKnobTip, 700);
  }
  el.addEventListener('mousedown', onDown);
  el.addEventListener('touchstart', onDown, {passive:false});

  // -- mouse wheel --
  el.addEventListener('wheel', e => {
    e.preventDefault();
    const fine = e.shiftKey ? 0.25 : 1;
    setValue(value - Math.sign(e.deltaY) * WHEEL_STEP * fine);
    setTimeout(hideKnobTip, 700);
  }, { passive: false });

  // -- double click resets to 0 --
  el.addEventListener('dblclick', e => {
    e.preventDefault();
    setValue(0, true);
    setTimeout(hideKnobTip, 700);
  });
}

/* knob tooltip */
let _knobTipEl = null, _knobTipTimer = null;
function showKnobTip(el, value){
  if(!_knobTipEl){
    _knobTipEl = document.createElement('div');
    _knobTipEl.id = 'knob-tip';
    Object.assign(_knobTipEl.style, {
      position:'fixed', zIndex:300, pointerEvents:'none',
      background:'#16171b', color:'#e7e8ea',
      border:'1px solid #2a2b30', borderRadius:'6px',
      padding:'4px 9px', fontFamily:"'Geist Mono', monospace",
      fontSize:'11px', letterSpacing:'0.04em',
      boxShadow:'0 6px 20px rgba(0,0,0,0.6)', opacity:'0',
      transition:'opacity 0.15s ease, transform 0.15s ease',
      transform:'translateY(4px)'
    });
    document.body.appendChild(_knobTipEl);
  }
  // map -150..150 to 0..100
  const pct = Math.round(((value + 150) / 300) * 100);
  _knobTipEl.textContent = pct + ' %';
  const r = el.getBoundingClientRect();
  _knobTipEl.style.left = (r.left + r.width/2 - 22) + 'px';
  _knobTipEl.style.top  = (r.top - 28) + 'px';
  _knobTipEl.style.opacity = '1';
  _knobTipEl.style.transform = 'translateY(0)';
  clearTimeout(_knobTipTimer);
}
function hideKnobTip(){
  if(_knobTipEl){
    _knobTipEl.style.opacity = '0';
    _knobTipEl.style.transform = 'translateY(4px)';
  }
}

/* ---------- Fader drag ---------- */
function makeFaderDraggable(trackEl, id){
  const thumb = trackEl.querySelector('.fader-thumb');
  let dragging = false;
  function setFromY(clientY){
    const rect = trackEl.getBoundingClientRect();
    const rel = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
    thumb.style.bottom = `calc(${rel*100}% - 13px)`;
    const t = state.tracks[id-1];
    t.volume = rel;
    if(t.player) t.player.volume.value = Tone.gainToDb(rel || 0.0001);
  }
  function onDown(e){
    e.preventDefault();
    dragging = true;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    setFromY(y);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, {passive:false});
    window.addEventListener('touchend', onUp);
  }
  function onMove(e){
    if(!dragging) return;
    e.preventDefault();
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    setFromY(y);
  }
  function onUp(){
    dragging = false;
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('touchend', onUp);
  }
  trackEl.addEventListener('mousedown', onDown);
  trackEl.addEventListener('touchstart', onDown, {passive:false});
}

/* ---------- Hold detection for STOP/CLEAR ---------- */
function makePressAndHold(el, onClick, onHold, ms=650){
  let timer = null, held = false;
  function down(e){
    held = false;
    timer = setTimeout(()=>{ held = true; onHold(); }, ms);
  }
  function up(e){
    clearTimeout(timer);
    if(!held) onClick();
  }
  function cancel(){ clearTimeout(timer); }
  el.addEventListener('mousedown', down);
  el.addEventListener('mouseup', up);
  el.addEventListener('mouseleave', cancel);
  el.addEventListener('touchstart', e => { e.preventDefault(); down(e); }, {passive:false});
  el.addEventListener('touchend', up);
}

/* ---------- Bank button toggles ---------- */
function toggleBankBtn(bank, letter){
  const key = bank==='input' ? 'inputBank' : 'trackBank';
  const lit = state[key].lit;
  const idx = lit.indexOf(letter);
  if(idx>=0) lit.splice(idx,1);
  else lit.push(letter);
  renderBanks();
}

/* ---------- Wiring ---------- */
function wire(){
  // Big button — click vs hold (stop on hold)
  document.querySelectorAll('.tr-big-btn').forEach(btn => {
    const id = parseInt(btn.dataset.id);
    makePressAndHold(btn,
      () => handleBigBtn(id),
      () => {
        const t = state.tracks[id-1];
        if(t.state !== 'empty'){ stopTrack(t); renderTrack(t); }
      },
      650
    );
    // right-click also stops
    btn.addEventListener('contextmenu', e => {
      e.preventDefault();
      const t = state.tracks[id-1];
      if(t.state !== 'empty'){ stopTrack(t); renderTrack(t); }
    });
  });

  // Stop button: click=stop, hold=clear
  document.querySelectorAll('.tr-stop-btn').forEach(btn => {
    const id = parseInt(btn.dataset.id);
    makePressAndHold(btn,
      () => {
        const t = state.tracks[id-1];
        if(t.state !== 'empty'){ stopTrack(t); renderTrack(t); }
      },
      () => {
        const t = state.tracks[id-1];
        clearTrack(t);
        showToast(`Track ${id} cleared`);
      },
      900
    );
  });

  // Track FX/TRACK buttons
  document.querySelectorAll('.tr-fx-btn').forEach(b => {
    b.addEventListener('click', () => {
      const id = parseInt(b.dataset.id);
      const t = state.tracks[id-1];
      t.fxOn = !t.fxOn;
      renderTrack(t);
    });
  });
  document.querySelectorAll('.tr-track-btn').forEach(b => {
    b.addEventListener('click', () => {
      const id = parseInt(b.dataset.id);
      flashOval(`track`);
      // visual feedback only; real RC-505 uses this for track select
      b.classList.add('lit');
    });
  });

  // Faders
  document.querySelectorAll('.fader-track').forEach(t => {
    const id = parseInt(t.dataset.id);
    makeFaderDraggable(t, id);
  });

  // Knobs
  const inputKnob = document.getElementById('input-fx-knob');
  const trackKnob = document.getElementById('track-fx-knob');
  const outputKnob = document.getElementById('output-knob');
  if(inputKnob)  makeKnobDraggable(inputKnob);
  if(trackKnob)  makeKnobDraggable(trackKnob);
  if(outputKnob) makeKnobDraggable(outputKnob, v => {
    if(masterGain) masterGain.gain.value = (v + 150) / 300; // map to 0..1
  });
  document.querySelectorAll('.param-knob').forEach(k => makeKnobDraggable(k));

  // Bank buttons
  document.querySelectorAll('.abcd-bank .bank-btn').forEach(b => {
    b.addEventListener('click', () => {
      const bank = b.parentElement.dataset.bank;
      toggleBankBtn(bank, b.dataset.letter);
    });
  });

  // Oval global buttons
  document.querySelector('[data-fn="all-start-stop"]').addEventListener('click', allStartStop);
  document.querySelector('[data-fn="undo-redo"]').addEventListener('click', undoRedo);
  document.querySelector('[data-fn="tap-tempo"]').addEventListener('click', tapTempo);
  document.querySelector('[data-fn="rhythm-start-stop"]').addEventListener('click', toggleRhythm);

  // Top small ovals — just toggle a tiny led
  document.querySelectorAll('.oval-btn.small').forEach(b => {
    b.addEventListener('click', () => {
      const led = b.querySelector('.ob-led');
      if(led){
        led.style.background = led.style.background === 'var(--led-green)' ? '' : 'var(--led-green)';
        led.style.boxShadow = led.style.boxShadow ? '' : '0 0 6px var(--led-green)';
      }
    });
  });

  // Edit pills
  document.querySelectorAll('.edit-pill').forEach(p => {
    p.addEventListener('click', () => p.classList.toggle('active'));
  });

  // Header buttons
  document.getElementById('reset-btn').addEventListener('click', () => {
    if(confirm('모든 트랙을 초기화할까요?')){
      state.tracks.forEach(t => clearTrack(t));
      state.bpm = 120;
      updateLCD();
    }
  });
  document.getElementById('hint-btn').addEventListener('click', () => {
    document.getElementById('shortcuts-modal').setAttribute('aria-hidden','false');
  });
  document.getElementById('sm-close').addEventListener('click', () => {
    document.getElementById('shortcuts-modal').setAttribute('aria-hidden','true');
  });
  document.getElementById('shortcuts-modal').addEventListener('click', e => {
    if(e.target.id==='shortcuts-modal') e.target.setAttribute('aria-hidden','true');
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if(['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) return;
    const stops = { q:1, w:2, e:3, r:4, t:5 };
    if(/^[1-5]$/.test(e.key)){
      handleBigBtn(parseInt(e.key));
    }else if(stops[e.key.toLowerCase()]){
      const id = stops[e.key.toLowerCase()];
      const t = state.tracks[id-1];
      if(t.state !== 'empty'){ stopTrack(t); renderTrack(t); }
    }else if(e.code === 'Space'){
      e.preventDefault(); allStartStop();
    }else if(e.key.toLowerCase()==='z'){ undoRedo(); }
    else if(e.key.toLowerCase()==='x'){ tapTempo(); }
    else if(e.key.toLowerCase()==='c'){ toggleRhythm(); }
  });
}

/* ---------- Boot overlay (iOS audio gesture requirement) ---------- */
function wireBoot(){
  const overlay = document.getElementById('boot-overlay');
  const btn = document.getElementById('boot-start');
  if(!btn) return;
  const start = async () => {
    try{
      if(window.Tone){
        await Tone.start();
        Tone.Transport.start();
        state.toneStarted = true;
      }
    }catch(e){ console.warn('Audio start deferred', e); }
    overlay.classList.add('hidden');
    setTimeout(() => overlay.remove(), 600);
    // pre-flight: ask mic permission early so first track-1 tap is instant
    try{
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      // park it on track 1 so the user doesn't get a 2nd permission prompt
      state.tracks[0].mediaStream = stream;
    }catch(e){ /* allowed to deny; demo mode covers it */ }
  };
  btn.addEventListener('click', start);
  btn.addEventListener('touchend', e => { e.preventDefault(); start(); });
}

/* ---------- Stage scaling ---------- */
function scaleStage(){
  const device = document.getElementById('device');
  const stage = document.getElementById('stage');
  if(!device || !stage) return;
  device.style.transform = '';
  const naturalW = 1560 + 14;
  const naturalH = device.offsetHeight;
  const availW = stage.clientWidth;
  const availH = window.innerHeight - stage.getBoundingClientRect().top - 60; // leave room for foot
  const scaleW = availW / naturalW;
  const scaleH = availH / naturalH;
  const scale = Math.min(1.05, Math.min(scaleW, scaleH));
  device.style.transform = `scale(${scale})`;
  device.style.transformOrigin = 'top center';
  stage.style.height = (naturalH * scale + 8) + 'px';
}

/* ---------- Service worker registration (PWA) ---------- */
function registerSW(){
  if('serviceWorker' in navigator){
    // Use relative path so it works regardless of where the file is hosted
    navigator.serviceWorker.register('sw.js').then(reg => {
      console.log('[PWA] Service worker registered:', reg.scope);
    }).catch(err => {
      console.warn('[PWA] SW registration failed (likely file:// — host to enable offline):', err.message);
    });
  }
}

/* ---------- iOS "Add to Home Screen" hint ---------- */
function maybeShowA2HSHint(){
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
  if(!isIOS || isStandalone) return;
  if(localStorage.getItem('rc505-a2hs-dismissed')) return;
  const tip = document.createElement('div');
  tip.id = 'a2hs-tip';
  tip.innerHTML = `
    <div class="a2hs-card">
      <div class="a2hs-icon">
        <img src="icons/icon-180.png" alt="" width="44" height="44">
      </div>
      <div class="a2hs-body">
        <div class="a2hs-title">홈 화면에 추가하면 진짜 앱처럼 동작해요</div>
        <div class="a2hs-steps">하단 <span class="ios-share">⬆︎</span> 공유 → <b>"홈 화면에 추가"</b></div>
      </div>
      <button class="a2hs-close" aria-label="dismiss">×</button>
    </div>
  `;
  document.body.appendChild(tip);
  tip.querySelector('.a2hs-close').addEventListener('click', () => {
    tip.remove();
    localStorage.setItem('rc505-a2hs-dismissed', '1');
  });
  setTimeout(() => tip.classList.add('show'), 100);
}

/* ---------- Boot ---------- */
window.addEventListener('load', () => {
  initAudio();
  initTracks();
  wire();
  wireBoot();
  renderAll();
  renderBanks();
  updateLCD();
  scaleStage();
  registerSW();
  setTimeout(maybeShowA2HSHint, 1200);
  // smooth progress sweep update
  setInterval(() => {
    state.tracks.forEach(t => {
      if(t.state === 'playing' || t.state === 'overdubbing'){
        const btn = document.querySelector(`.tr-big-btn[data-id="${t.id}"]`);
        if(!btn) return;
        const sweep = btn.querySelector('.progress-sweep');
        if(!sweep) return;
        const len = t.length || (t.player?.buffer?.duration) || 2;
        const elapsed = (Tone.now() - t.startTime) % len;
        const pct = (elapsed/len) * 360;
        sweep.style.background = `conic-gradient(from -90deg, rgba(255,255,255,0.45) ${pct}deg, transparent ${pct}deg)`;
      }
    });
  }, 60);
});
window.addEventListener('resize', scaleStage);
window.addEventListener('orientationchange', () => setTimeout(scaleStage, 200));
