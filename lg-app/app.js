// Vision AI - LG webOS TV App
// Connects to Vision server on laptop and displays on TV

const LAPTOP_IP = '192.168.100.136'; // Your laptop IP
const API = 'http://' + LAPTOP_IP + ':5000';

let activated = false;
let synth = window.speechSynthesis;
let voice = null;
let msgs = [];

// Clock
function startClock() {
  setInterval(() => {
    const n = new Date();
    const cl = document.getElementById('clock');
    const dd = document.getElementById('dated');
    if (cl) cl.textContent = n.toLocaleTimeString('en-US', {hour12: false});
    if (dd) dd.textContent = n.toLocaleDateString('en-US', {weekday:'short', year:'numeric', month:'short', day:'numeric'}).toUpperCase();
  }, 1000);
}

// Load voices
function loadVoice() {
  const voices = synth.getVoices();
  const pref = ['Google UK English Female', 'Microsoft Zira', 'Samantha', 'Karen'];
  for (const n of pref) { const v = voices.find(v => v.name === n); if (v) { voice = v; return; } }
  voice = voices.find(v => v.lang && v.lang.startsWith('en')) || voices[0] || null;
}
synth.onvoiceschanged = loadVoice;
setTimeout(loadVoice, 500);

// Speak
function speak(text) {
  synth.cancel();
  setTimeout(() => {
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice; u.rate = 1.0; u.pitch = 1.05; u.volume = 1.0;
    synth.speak(u);
  }, 100);
}

// Send message to Vision
async function sendToVision(text) {
  addMsg('user', text);
  updateStatus('PROCESSING...');
  try {
    const res = await fetch(API + '/chat', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({message: text})
    });
    const data = await res.json();
    const reply = data.reply || 'No response.';
    addMsg('ai', reply);
    speak(reply);
    updateStatus('READY');
  } catch(e) {
    addMsg('system', 'Cannot reach Vision server at ' + LAPTOP_IP + '. Make sure server.py is running on your laptop.');
    updateStatus('OFFLINE');
  }
}

// Add message to chat
function addMsg(type, text) {
  msgs.push({type, text});
  if (msgs.length > 8) msgs.shift(); // Keep last 8 on TV
  renderMsgs();
}

function renderMsgs() {
  const el = document.getElementById('chatLog');
  if (!el) return;
  el.innerHTML = msgs.map(m => {
    const colors = {user: '#00ff88', ai: '#00eeff', system: '#ff8800'};
    const labels = {user: 'YOU', ai: 'VISION', system: 'SYSTEM'};
    return `<div style="margin-bottom:20px;padding:16px 20px;background:${m.type==='ai'?'rgba(0,40,100,.4)':m.type==='user'?'rgba(0,80,40,.4)':'rgba(255,136,0,.1)'};border-left:4px solid ${colors[m.type]};animation:fadeIn .3s ease-out">
      <div style="font-size:.75rem;letter-spacing:.15rem;color:${colors[m.type]};margin-bottom:8px;font-weight:700">${labels[m.type]}</div>
      <div style="font-size:1.1rem;color:#c0e0ff;line-height:1.7">${m.text}</div>
    </div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

function updateStatus(msg) {
  const el = document.getElementById('coreStatus');
  if (el) el.textContent = msg;
}

// Remote control navigation
let focusIndex = 0;
const focusItems = ['btnSpeak', 'btnTime', 'btnJoke', 'btnWeather', 'btnInspire', 'btnAbilities', 'inputBox'];

document.addEventListener('keydown', (e) => {
  // LG TV remote keys
  switch(e.keyCode) {
    case 13: // OK/Enter
      const focused = document.getElementById(focusItems[focusIndex]);
      if (focused) focused.click();
      break;
    case 37: // Left
      focusIndex = Math.max(0, focusIndex - 1);
      updateFocus();
      break;
    case 39: // Right
      focusIndex = Math.min(focusItems.length - 1, focusIndex + 1);
      updateFocus();
      break;
    case 38: // Up
      focusIndex = Math.max(0, focusIndex - 2);
      updateFocus();
      break;
    case 40: // Down
      focusIndex = Math.min(focusItems.length - 1, focusIndex + 2);
      updateFocus();
      break;
    case 461: // Back button on LG remote
      break;
  }
});

function updateFocus() {
  focusItems.forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) {
      el.style.border = i === focusIndex ? '2px solid #00eeff' : '1px solid rgba(0,200,255,.25)';
      el.style.boxShadow = i === focusIndex ? '0 0 20px rgba(0,200,255,.4)' : 'none';
    }
  });
}

// Build the TV UI
function buildUI() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <style>
      @keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
      @keyframes core-pulse {
        0%,100%{box-shadow:0 0 60px rgba(0,120,255,.4),inset 0 0 40px rgba(0,120,255,.15)}
        50%{box-shadow:0 0 100px rgba(0,180,255,.6),inset 0 0 60px rgba(0,180,255,.25)}
      }
      @keyframes ring-spin { to{transform:rotate(360deg)} }
      @keyframes bar-wave { 0%,100%{height:4px} 50%{height:20px} }
    </style>
    <div style="display:grid;grid-template-columns:380px 1fr;height:1000px;gap:0">
      <!-- LEFT: Vision Core -->
      <div style="background:linear-gradient(180deg,rgba(0,8,25,.97),rgba(0,4,15,.99));border-right:1px solid rgba(0,200,255,.25);display:flex;flex-direction:column;align-items:center;padding:40px 20px;gap:30px">
        <!-- Core circle -->
        <div style="position:relative;width:260px;height:260px;display:flex;align-items:center;justify-content:center;cursor:pointer" onclick="activateVision()">
          <div style="position:absolute;width:260px;height:260px;border-radius:50%;border:1px solid rgba(0,200,255,.15);border-top-color:#00eeff;animation:ring-spin 4s linear infinite;box-shadow:0 0 15px rgba(0,200,255,.2)"></div>
          <div style="position:absolute;width:300px;height:300px;border-radius:50%;border:1px solid rgba(0,200,255,.1);border-right-color:#aa00ff;animation:ring-spin 7s linear infinite reverse"></div>
          <div style="position:absolute;width:340px;height:340px;border-radius:50%;border:1px solid rgba(0,200,255,.08);border-bottom-color:rgba(0,200,255,.3);animation:ring-spin 12s linear infinite"></div>
          <div style="width:220px;height:220px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#001535,#000308);border:3px solid rgba(0,200,255,.6);box-shadow:0 0 60px rgba(0,120,255,.4),inset 0 0 40px rgba(0,120,255,.15);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;animation:core-pulse 4s ease-in-out infinite">
            <div style="display:flex;gap:16px">
              <div style="width:52px;height:52px;border-radius:50%;background:radial-gradient(circle at 40% 40%,#001228,#000208);border:2px solid rgba(0,200,255,.65);display:flex;align-items:center;justify-content:center;box-shadow:0 0 15px rgba(0,200,255,.4)">
                <div style="width:24px;height:24px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#00eeff,#0044aa);box-shadow:0 0 15px #00eeff"></div>
              </div>
              <div style="width:52px;height:52px;border-radius:50%;background:radial-gradient(circle at 40% 40%,#001228,#000208);border:2px solid rgba(0,200,255,.65);display:flex;align-items:center;justify-content:center;box-shadow:0 0 15px rgba(0,200,255,.4)">
                <div style="width:24px;height:24px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#00eeff,#0044aa);box-shadow:0 0 15px #00eeff"></div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:3px;height:20px" id="waveBars">
              ${Array(7).fill('<span style="display:block;width:4px;height:4px;background:rgba(0,200,255,.4);border-radius:1px"></span>').join('')}
            </div>
            <div style="font-size:.65rem;letter-spacing:.2rem;color:rgba(0,200,255,.7);text-shadow:0 0 8px #00eeff" id="coreStatus">CLICK TO WAKE</div>
          </div>
        </div>
        <!-- Quick buttons -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%">
          <button id="btnSpeak" onclick="startListening()" style="background:linear-gradient(135deg,rgba(0,80,200,.35),rgba(0,180,255,.2));border:1px solid #00eeff;color:#00eeff;font-family:'Courier New',monospace;font-size:.8rem;letter-spacing:.1rem;padding:14px;cursor:pointer;transition:all .2s">🎤 SPEAK</button>
          <button id="btnTime" onclick="sendToVision('What time is it?')" style="background:linear-gradient(135deg,rgba(0,15,45,.88),rgba(0,8,28,.92));border:1px solid rgba(0,200,255,.25);color:#3a8aaa;font-family:'Courier New',monospace;font-size:.8rem;letter-spacing:.1rem;padding:14px;cursor:pointer;transition:all .2s">🕐 TIME</button>
          <button id="btnJoke" onclick="sendToVision('Tell me a funny joke')" style="background:linear-gradient(135deg,rgba(0,15,45,.88),rgba(0,8,28,.92));border:1px solid rgba(0,200,255,.25);color:#3a8aaa;font-family:'Courier New',monospace;font-size:.8rem;letter-spacing:.1rem;padding:14px;cursor:pointer;transition:all .2s">😄 JOKE</button>
          <button id="btnWeather" onclick="sendToVision('What is the weather today?')" style="background:linear-gradient(135deg,rgba(0,15,45,.88),rgba(0,8,28,.92));border:1px solid rgba(0,200,255,.25);color:#3a8aaa;font-family:'Courier New',monospace;font-size:.8rem;letter-spacing:.1rem;padding:14px;cursor:pointer;transition:all .2s">🌤 WEATHER</button>
          <button id="btnInspire" onclick="sendToVision('Give me a motivational quote')" style="background:linear-gradient(135deg,rgba(0,15,45,.88),rgba(0,8,28,.92));border:1px solid rgba(0,200,255,.25);color:#3a8aaa;font-family:'Courier New',monospace;font-size:.8rem;letter-spacing:.1rem;padding:14px;cursor:pointer;transition:all .2s">💡 INSPIRE</button>
          <button id="btnAbilities" onclick="sendToVision('What can you do?')" style="background:linear-gradient(135deg,rgba(0,15,45,.88),rgba(0,8,28,.92));border:1px solid rgba(0,200,255,.25);color:#3a8aaa;font-family:'Courier New',monospace;font-size:.8rem;letter-spacing:.1rem;padding:14px;cursor:pointer;transition:all .2s">🤖 ABILITIES</button>
        </div>
        <!-- Type input -->
        <div style="width:100%;display:flex;gap:8px;background:rgba(0,12,40,.95);border:1px solid rgba(0,200,255,.4);padding:10px 14px">
          <input id="inputBox" type="text" placeholder="Type to Vision..." onkeydown="if(event.key==='Enter'){sendToVision(this.value);this.value='';}" style="flex:1;background:none;border:none;color:#00eeff;font-family:'Courier New',monospace;font-size:.9rem;outline:none"/>
          <button onclick="const i=document.getElementById('inputBox');sendToVision(i.value);i.value='';" style="background:linear-gradient(135deg,rgba(0,80,200,.4),rgba(0,180,255,.25));border:1px solid #00eeff;color:#00eeff;font-family:'Courier New',monospace;font-size:.8rem;padding:6px 16px;cursor:pointer">SEND</button>
        </div>
      </div>
      <!-- RIGHT: Chat -->
      <div style="display:flex;flex-direction:column;background:linear-gradient(180deg,rgba(0,3,12,.5),rgba(0,6,20,.7))">
        <div style="padding:20px 40px;border-bottom:1px solid rgba(0,200,255,.2);font-size:.65rem;letter-spacing:.2rem;color:#00eeff;text-shadow:0 0 8px #00eeff">◈ VISION RESPONSE</div>
        <div id="chatLog" style="flex:1;overflow-y:auto;padding:30px 40px;display:flex;flex-direction:column;gap:0"></div>
      </div>
    </div>
  `;

  updateFocus();
  addMsg('system', 'Vision AI is ready on your LG TV. Click SPEAK or press OK on your remote to talk to Vision.');
}

function activateVision() {
  if (!activated) {
    activated = true;
    speak('Vision online. Hello Tomilola. I am now running on your LG TV. How can I help you?');
    addMsg('ai', 'Vision online. Hello Tomilola! I am now running on your LG TV. How can I help you?');
    updateStatus('READY');
  } else {
    startListening();
  }
}

function startListening() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { addMsg('system', 'Voice not supported on this TV browser. Use the text input.'); return; }
  const rec = new SR();
  rec.lang = 'en-US'; rec.continuous = false; rec.interimResults = false;
  updateStatus('LISTENING...');
  rec.onresult = e => {
    const text = e.results[0][0].transcript;
    updateStatus('PROCESSING...');
    sendToVision(text);
  };
  rec.onerror = () => updateStatus('MIC ERROR');
  rec.onend = () => { if (activated) updateStatus('READY'); };
  rec.start();
}

// Check connection to laptop
async function checkConnection() {
  try {
    await fetch(API + '/health', {mode: 'cors'});
    const el = document.getElementById('connstat');
    if (el) { el.textContent = '📡 CONNECTED'; el.style.color = '#00cc77'; }
  } catch(e) {
    const el = document.getElementById('connstat');
    if (el) { el.textContent = '❌ OFFLINE'; el.style.color = '#ff4466'; }
  }
}

// Init
startClock();
buildUI();
checkConnection();
setInterval(checkConnection, 10000);
