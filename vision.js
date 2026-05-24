// VISION AI JS - loading...
// VISION AI v3.0 - JARVIS Interface
const ACCESS_CODE = 'AnneTomi2';
const API_BASE = '';
const OWNER = 'Tomilola';

let isListening=false,isMuted=false,cameraOn=false,typingMode=false,activated=false,autoRestart=true;
let currentStream=null,speechSynth=window.speechSynthesis,visionVoice=null;
let mouseX=0,mouseY=0,lastMX=0,lastMY=0,mouseVel=0,mouseHistory=[],handTemp=36.5;
let latencyHistory=[],latencyCtx=null,mfStartTime=Date.now(),mfReqs=0;
let browserHistory=[],browserPos=-1,hwSubject='auto',hwImageData=null,hwFileText=null,hwMode='text';

const g = id => document.getElementById(id);

function checkCode(){
  // Skip lock screen - open directly
  const lock = g('lockScreen');
  if(lock) lock.style.display='none';
  const app = g('app');
  if(app) { app.style.display='grid'; initApp(); }
}

document.addEventListener('DOMContentLoaded',()=>{
  // Auto-open Vision without password
  const lock = g('lockScreen');
  if(lock) lock.style.display='none';
  const app = g('app');
  if(app) { app.style.display='grid'; initApp(); }
});

function initApp(){
  startClock();loadVoices();setTimeout(loadVoices,600);
  setTimeout(blink,2000);
  startSystemMonitor();startMouseTracker();detectEnvironment();
  initLatencyGraph();initBgCanvas();initLockCanvas();
  registerSW();
  log('System initialized');log('Vision AI v3.0 online');log('Tomilola unit active');
  setStatus('STANDBY');
}

function registerSW(){if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});}

function startClock(){
  const tick=()=>{
    const n=new Date();
    const cl=g('clock');if(cl)cl.textContent=n.toLocaleTimeString('en-US',{hour12:false});
    const dd=g('dateDisp');if(dd)dd.textContent=n.toLocaleDateString('en-US',{weekday:'short',year:'numeric',month:'short',day:'numeric'}).toUpperCase();
    const sb=g('sbTime');if(sb)sb.textContent=n.toLocaleTimeString('en-US',{hour12:false});
  };
  tick();setInterval(tick,1000);
}

function initBgCanvas(){
  const c=g('bgCanvas');if(!c)return;
  const ctx=c.getContext('2d');
  const particles=[];
  function resize(){c.width=window.innerWidth;c.height=window.innerHeight;}
  resize();window.addEventListener('resize',resize);
  for(let i=0;i<80;i++)particles.push({x:Math.random()*window.innerWidth,y:Math.random()*window.innerHeight,vx:(Math.random()-.5)*.3,vy:(Math.random()-.5)*.3,r:Math.random()*1.5+.5,a:Math.random()});
  function draw(){
    ctx.clearRect(0,0,c.width,c.height);
    particles.forEach(p=>{
      p.x+=p.vx;p.y+=p.vy;
      if(p.x<0||p.x>c.width)p.vx*=-1;
      if(p.y<0||p.y>c.height)p.vy*=-1;
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle='rgba(0,200,255,'+(p.a*.4)+')';ctx.fill();
    });
    particles.forEach((a,i)=>{
      particles.forEach((b,j)=>{
        if(i>=j)return;
        const dx=a.x-b.x,dy=a.y-b.y,d=Math.sqrt(dx*dx+dy*dy);
        if(d<120){ctx.strokeStyle='rgba(0,150,255,'+(1-d/120)*.08+')';ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
      });
    });
    requestAnimationFrame(draw);
  }
  draw();
}

function initLockCanvas(){
  const c=g('lockCanvas');if(!c)return;
  const ctx=c.getContext('2d');
  function resize(){c.width=window.innerWidth;c.height=window.innerHeight;}
  resize();
  const pts=[];
  for(let i=0;i<50;i++)pts.push({x:Math.random()*window.innerWidth,y:Math.random()*window.innerHeight,vx:(Math.random()-.5)*.5,vy:(Math.random()-.5)*.5});
  function draw(){
    ctx.clearRect(0,0,c.width,c.height);
    pts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>c.width)p.vx*=-1;if(p.y<0||p.y>c.height)p.vy*=-1;});
    pts.forEach((a,i)=>pts.forEach((b,j)=>{if(i>=j)return;const d=Math.hypot(a.x-b.x,a.y-b.y);if(d<150){ctx.strokeStyle='rgba(0,200,255,'+(1-d/150)*.12+')';ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}}));
    requestAnimationFrame(draw);
  }
  draw();
}

function startSystemMonitor(){
  if(navigator.getBattery){navigator.getBattery().then(bat=>{
    const upd=()=>{const p=Math.round(bat.level*100);const el=g('battPct');if(el)el.textContent=p+'%';const tb=g('tbBatt');if(tb)tb.textContent='🔋'+p+'%';const b=g('battBar');if(b){b.style.width=p+'%';b.style.background=p>50?'linear-gradient(90deg,#008844,#00ff88)':p>20?'linear-gradient(90deg,#884400,#ff8800)':'linear-gradient(90deg,#880022,#ff2244)';}};
    upd();bat.addEventListener('levelchange',upd);
  });}
  const upd=()=>{
    if(performance.memory){const u=Math.round(performance.memory.usedJSHeapSize/1048576),t=Math.round(performance.memory.totalJSHeapSize/1048576);const el=g('heapMem');if(el)el.textContent=u+'MB';const b=g('heapBar');if(b)b.style.width=Math.min((u/t)*100,100)+'%';}
    const s=performance.now(),x=[];for(let i=0;i<60000;i++)x.push(Math.sqrt(i));const e=performance.now()-s;
    const t=Math.round(38+Math.min(e*1.8,42));const el=g('cpuTemp');if(el)el.textContent=t+'C';const b=g('cpuBar');if(b){b.style.width=Math.min((t-30)*2,100)+'%';b.style.background=t>70?'linear-gradient(90deg,#880022,#ff2244)':t>55?'linear-gradient(90deg,#884400,#ff8800)':'linear-gradient(90deg,#0055ff,#00eeff)';}
    const conn=navigator.connection||navigator.mozConnection;const ns=g('netStat');if(ns)ns.textContent=navigator.onLine?'ONLINE':'OFFLINE';if(conn){const nt=g('netType');if(nt)nt.textContent=(conn.effectiveType||'--').toUpperCase();}
    const ts=Date.now();fetch('/health').then(r=>r.json()).then(d=>{const lat=Date.now()-ts;const nl=g('netLat');if(nl)nl.textContent=lat+' ms';const tl=g('tbLat');if(tl)tl.textContent='⚡'+lat+'ms';const ss=g('srvStat');if(ss)ss.textContent='ONLINE';latencyHistory.push(lat);if(latencyHistory.length>30)latencyHistory.shift();drawLatency();}).catch(()=>{const ss=g('srvStat');if(ss)ss.textContent='OFFLINE';});
  };
  upd();setInterval(upd,5000);
}

function initLatencyGraph(){const c=g('latencyCanvas');if(c)latencyCtx=c.getContext('2d');}

function drawLatency(){
  if(!latencyCtx||!latencyHistory.length)return;
  const c=latencyCtx,w=c.canvas.width,h=c.canvas.height;
  c.clearRect(0,0,w,h);
  const max=Math.max(...latencyHistory,100);
  c.strokeStyle='rgba(0,200,255,0.7)';c.lineWidth=1.5;c.beginPath();
  latencyHistory.forEach((v,i)=>{const x=(i/(latencyHistory.length-1))*w,y=h-(v/max)*h;i===0?c.moveTo(x,y):c.lineTo(x,y);});
  c.stroke();
}

function startMouseTracker(){
  document.addEventListener('mousemove',e=>{
    if(!g('app')||g('app').style.display==='none')return;
    const dx=e.clientX-lastMX,dy=e.clientY-lastMY;
    mouseVel=Math.round(Math.sqrt(dx*dx+dy*dy));
    lastMX=mouseX=e.clientX;lastMY=mouseY=e.clientY;
    const mxy=g('mxy');if(mxy)mxy.textContent=mouseX+' / '+mouseY;
    const mv=g('mvel');if(mv)mv.textContent=mouseVel+' px/s';
    const act=mouseVel>300?'RAPID':mouseVel>150?'HIGH':mouseVel>50?'ACTIVE':'IDLE';
    const ma=g('mact');if(ma)ma.textContent=act;
    const r=g('radarDot');if(r){r.style.left=(e.clientX/window.innerWidth*80)+'px';r.style.top=(e.clientY/window.innerHeight*80)+'px';}
    mouseHistory.push(mouseVel);if(mouseHistory.length>40)mouseHistory.shift();
    const avg=mouseHistory.reduce((a,b)=>a+b,0)/mouseHistory.length;
    handTemp=36.0+Math.min(avg/180,1.8);
    const ht=g('handTemp');if(ht)ht.textContent=handTemp.toFixed(1)+'C';
    const hb=g('handBar');if(hb)hb.style.width=Math.min(((handTemp-35)/5)*100,100)+'%';
    trackEye(g('pupL'),g('eyeL'),e.clientX,e.clientY);
    trackEye(g('pupR'),g('eyeR'),e.clientX,e.clientY);
  });
}

function detectEnvironment(){
  const scr=g('scr');if(scr)scr.textContent=screen.width+'x'+screen.height;
  const pl=g('plat');if(pl)pl.textContent=navigator.platform||'UNKNOWN';
  const tz=g('tz');if(tz)tz.textContent=Intl.DateTimeFormat().resolvedOptions().timeZone||'--';
  const ua=navigator.userAgent;const br=g('brow');if(br)br.textContent=ua.includes('Chrome')?'CHROME':ua.includes('Firefox')?'FIREFOX':'OTHER';
  if(navigator.geolocation)navigator.geolocation.getCurrentPosition(p=>{const lo=g('loc');if(lo)lo.textContent=p.coords.latitude.toFixed(2)+'N';},()=>{const lo=g('loc');if(lo)lo.textContent='RESTRICTED';});
}

function trackEye(pupil,eye,mx,my){
  if(!pupil||!eye)return;
  const r=eye.getBoundingClientRect();
  const cx=r.left+r.width/2,cy=r.top+r.height/2;
  const a=Math.atan2(my-cy,mx-cx),d=Math.min(Math.hypot(mx-cx,my-cy),8);
  pupil.style.transform='translate('+Math.cos(a)*d+'px,'+Math.sin(a)*d+'px)';
}

function blink(){
  const eL=g('eyeL'),eR=g('eyeR');
  if(eL)eL.classList.add('blinking');if(eR)eR.classList.add('blinking');
  setTimeout(()=>{if(eL)eL.classList.remove('blinking');if(eR)eR.classList.remove('blinking');},150);
  setTimeout(blink,2000+Math.random()*5000);
}

function loadVoices(){
  const voices=speechSynth.getVoices();
  const pref=['Google UK English Female','Microsoft Zira - English (United States)','Microsoft Zira','Samantha','Karen','Victoria','Google US English'];
  for(const n of pref){const v=voices.find(v=>v.name===n);if(v){visionVoice=v;return;}}
  visionVoice=voices.find(v=>v.lang&&v.lang.startsWith('en'))||voices[0]||null;
}
speechSynth.onvoiceschanged=loadVoices;

function speak(text){
  if(isMuted){afterSpeak();return;}
  speechSynth.cancel();
  setTimeout(()=>{
    const u=new SpeechSynthesisUtterance(text);
    u.voice=visionVoice;u.rate=1.0;u.pitch=1.05;u.volume=1.0;
  u.onstart=()=>{setCoreState('speaking');const wb=g('waveBars');if(wb)wb.classList.add('active');const fwb=g('fwb');if(fwb)fwb.classList.add('active');};
    u.onend=u.onerror=()=>afterSpeak();
    speechSynth.speak(u);
  },100);
}

function afterSpeak(){
  setCoreState('idle');
  const wb=g('waveBars');if(wb)wb.classList.remove('active');
  if(!typingMode&&activated&&autoRestart)startListening();
  else setStatus('READY');
}

function startListening(){
  if(isListening||typingMode)return;
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR)return;
  const rec=new SR();
  rec.continuous=false;rec.interimResults=true;rec.lang='en-US';
  rec.onstart=()=>{isListening=true;setCoreState('listening');const wb=g('waveBars');if(wb)wb.classList.add('active');const mb=g('micBtn');if(mb)mb.classList.add('active');};
  rec.onresult=e=>{
    let interim='',final='';
    for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript;if(e.results[i].isFinal)final+=t;else interim+=t;}
    if(interim||final){
      let el=g('interimMsg');
      if(!el){el=document.createElement('div');el.id='interimMsg';el.className='msg user';el.innerHTML='<span class="mwho">YOU</span><span class="mtext">'+( final||interim)+'</span>';const cl=g('chatMessages');if(cl){cl.appendChild(el);cl.scrollTop=cl.scrollHeight;}}
      else el.querySelector('.mtext').textContent=final||interim;
    }
    if(final){
      const im=g('interimMsg');if(im)im.remove();
      rec.stop();isListening=false;
      const mb=g('micBtn');if(mb)mb.classList.remove('active');
      const wb=g('waveBars');if(wb)wb.classList.remove('active');
      sendToVision(final.trim());mfReqs++;
    }
  };
  rec.onerror=e=>{
    isListening=false;
    const mb=g('micBtn');if(mb)mb.classList.remove('active');
    const wb=g('waveBars');if(wb)wb.classList.remove('active');
    const im=g('interimMsg');if(im)im.remove();
    if(e.error==='not-allowed'){autoRestart=false;addMsg('system','SYSTEM','Microphone blocked. Allow mic in Chrome settings.');return;}
    if(autoRestart&&activated&&!typingMode)setTimeout(startListening,e.error==='no-speech'?400:1200);
  };
  rec.onend=()=>{
    isListening=false;const mb=g('micBtn');if(mb)mb.classList.remove('active');
    if(autoRestart&&activated&&!typingMode&&!speechSynth.speaking)setTimeout(startListening,400);
    else{const wb=g('waveBars');if(wb)wb.classList.remove('active');}
  };
  try{rec.start();}catch(e){isListening=false;if(autoRestart&&activated)setTimeout(startListening,1200);}
}

function toggleListening(){
  if(typingMode)return;
  if(autoRestart){autoRestart=false;isListening=false;const mb=g('micBtn');if(mb)mb.classList.remove('active');setCoreState('idle');setStatus('MIC OFF');log('Mic disabled');}
  else{autoRestart=true;startListening();log('Mic enabled');}
}

function toggleTyping(){
  typingMode=!typingMode;
  const tb=g('typeBtn'),ta=g('typeBox'),ti=g('typeInput'),vh=g('voiceHint');
  if(typingMode){
    if(ta)ta.style.display='flex';if(tb)tb.classList.add('active');
    autoRestart=false;if(vh)vh.textContent='Type mode — press Enter to send';
    setTimeout(()=>{if(ti)ti.focus();},100);log('Type mode ON');
  } else {
    if(ta)ta.style.display='none';if(tb)tb.classList.remove('active');
    if(ti)ti.value='';if(vh)vh.textContent='🎤 Listening automatically — just speak';
    if(activated){autoRestart=true;startListening();}log('Voice mode ON');
  }
}

function sendTyped(){
  const ti=g('typeInput');if(!ti)return;
  const text=ti.value.trim();if(!text)return;
  ti.value='';sendToVision(text);mfReqs++;
}

async function sendToVision(text){
  if(!text)return;
  addMsg('user','YOU',text);
  log('Query: '+text.substring(0,30)+(text.length>30?'...':''));
  setCoreState('thinking');const wb=g('waveBars');if(wb)wb.classList.remove('active');
  let imageData=null;if(cameraOn)imageData=captureFrame();
  try{
    const res=await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,...(imageData&&{image:imageData})})});
    if(!res.ok)throw new Error(res.status);
    const data=await res.json();
    const reply=data.reply||'No response.';
    if(data.intent&&data.intent!=='chat'){const badges={search:'🔍 SEARCH',weather:'🌤 WEATHER',math:'🔢 MATH',time:'🕐 TIME',joke:'😄 JOKE'};log('Tool: '+(badges[data.intent]||data.intent.toUpperCase()));}
    addMsg('ai','VISION',reply);speak(reply);fetchMemory();
  }catch(e){
    const fb=fallback(text);addMsg('ai','VISION',fb);speak(fb);
  }
}

function fallback(t){
  const l=t.toLowerCase();
  if(l.includes('hello')||l.includes('hi'))return 'Hello '+OWNER+'. Server offline — run server.py.';
  if(l.includes('time'))return 'It is '+new Date().toLocaleTimeString();
  if(l.includes('temp'))return 'Hand temperature estimated at '+handTemp.toFixed(1)+'C.';
  if(l.includes('joke'))return 'Why do programmers prefer dark mode? Because light attracts bugs.';
  return 'Server offline. Start server.py for full AI.';
}

function addMsg(type,who,text){
  const cl=g('chatMessages');if(!cl)return;
  const div=document.createElement('div');
  div.className='msg '+type;
  div.innerHTML='<span class="mwho">'+who+'</span><span class="mtext">'+text+'</span>';
  cl.appendChild(div);cl.scrollTop=cl.scrollHeight;
}

function setStatus(msg){const cs=g('coreStatus');if(cs)cs.textContent=msg;const sb=g('sbStatus');if(sb)sb.textContent=msg;}

function setCoreState(s){
  const vc=g('visionCore');if(!vc)return;
  vc.classList.remove('listening','thinking','speaking');
  if(s!=='idle')vc.classList.add(s);
  const labels={listening:'LISTENING',thinking:'PROCESSING',speaking:'TRANSMITTING',idle:'STANDBY'};
  setStatus(labels[s]||'STANDBY');
}

function activateVision(){
  if(!activated){
    activated=true;autoRestart=true;
    const ai=g('aiStatus');if(ai)ai.textContent='⚡ AI ACTIVE';
    speak('Vision online. Hello '+OWNER+'. All systems operational. I am always listening.');
    fetchMemory();log('Vision core activated');
  } else {
    if(typingMode){const ti=g('typeInput');if(ti)ti.focus();return;}
    if(!isListening){autoRestart=true;startListening();}
  }
}

function toggleMute(){
  isMuted=!isMuted;
  const mb=g('muteBtn');
  if(isMuted){speechSynth.cancel();if(mb)mb.classList.add('active');log('Audio muted');}
  else{if(mb)mb.classList.remove('active');log('Audio unmuted');}
}

function log(msg){
  const al=g('activityLog');if(!al)return;
  const d=document.createElement('div');d.className='log-item';
  d.textContent=new Date().toLocaleTimeString('en-US',{hour12:false})+' '+msg;
  al.insertBefore(d,al.firstChild);
  if(al.children.length>20)al.removeChild(al.lastChild);
}

async function fetchMemory(){
  try{
    const d=await(await fetch('/memory')).json();
    const ms=g('memStats');if(ms)ms.innerHTML='<b>FACTS:</b> '+d.facts_count+'<br><b>SESSIONS:</b> '+d.conversations+'<br><b>MODE:</b> '+d.mode+'<br><b>LAST SYNC:</b> '+(d.last_learned?new Date(d.last_learned).toLocaleTimeString():'NEVER')+'<br><b>PERSONALITY:</b> '+d.personality;
    const mf=g('memFacts');if(mf){mf.innerHTML='';if(d.recent_facts&&d.recent_facts.length)d.recent_facts.forEach(f=>{const div=document.createElement('div');div.className='mem-fact-item';div.textContent=f;mf.appendChild(div);});}
    const mff=g('mfFacts');if(mff)mff.textContent=d.facts_count+' FACTS';
    const mai=g('mfAI');if(mai)mai.textContent=(d.mode||'GROQ LLAMA 3.1').toUpperCase();
  }catch(e){}
}
setInterval(fetchMemory,180000);

async function toggleCamera(){
  const cb=g('camBtn'),co=g('camOff'),sl=g('scanLine');
  if(!cameraOn){
    try{currentStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});}
    catch(e){try{currentStream=await navigator.mediaDevices.getUserMedia({video:true});}catch(e2){log('Camera denied');return;}}
    const cf=g('cameraFeed');if(cf)cf.srcObject=currentStream;
    cameraOn=true;if(cb)cb.classList.add('active');if(sl)sl.classList.add('active');if(co)co.style.display='none';
    const ms=g('micStatus');if(ms)ms.textContent='📷 CAM ON';log('Scanner activated');
  } else {
    if(currentStream)currentStream.getTracks().forEach(t=>t.stop());
    const cf=g('cameraFeed');if(cf)cf.srcObject=null;
    cameraOn=false;if(cb)cb.classList.remove('active');if(sl)sl.classList.remove('active');if(co)co.style.display='flex';
    const ms=g('micStatus');if(ms)ms.textContent='🎤 MIC READY';log('Scanner offline');
  }
}

function captureFrame(){
  const c=g('cameraCanvas'),cf=g('cameraFeed');if(!c||!cf)return null;
  c.width=cf.videoWidth||320;c.height=cf.videoHeight||240;
  c.getContext('2d').drawImage(cf,0,0,c.width,c.height);
  return c.toDataURL('image/jpeg',0.7).split(',')[1];
}

async function analyzeScene(){
  if(!cameraOn){addMsg('system','SYSTEM','Activate scanner first.');return;}
  const img=captureFrame();setCoreState('thinking');log('Analyzing scene...');
  try{
    const res=await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Describe this scene in detail. Note people, objects, environment, lighting, anything unusual.',image:img})});
    const data=await res.json();
    const sr=g('scanResultText');if(sr)sr.textContent=data.reply;
    addMsg('ai','VISION',data.reply);speak(data.reply);
  }catch(e){setCoreState('idle');}
}

function captureSnapshot(){
  if(!cameraOn)return;
  const c=g('cameraCanvas'),cf=g('cameraFeed');if(!c||!cf)return;
  c.width=cf.videoWidth;c.height=cf.videoHeight;
  c.getContext('2d').drawImage(cf,0,0);
  const a=document.createElement('a');a.download='vision-snap-'+Date.now()+'.jpg';a.href=c.toDataURL('image/jpeg',0.9);a.click();log('Snapshot saved');
}

function browserGo(){
  let url=g('browserUrl').value.trim();if(!url)return;
  if(!url.startsWith('http'))url=url.includes('.')&&!url.includes(' ')?'https://'+url:'https://www.google.com/search?q='+encodeURIComponent(url);
  loadUrl(url);
}

function loadUrl(url){
  const bu=g('browserUrl');if(bu)bu.value=url;
  const bf=g('browserFrame'),bb=g('browserBlocked');
  if(bb)bb.style.display='none';if(bf)bf.src=url;
  browserHistory=browserHistory.slice(0,browserPos+1);browserHistory.push(url);browserPos=browserHistory.length-1;
  log('Browser: '+url.substring(0,40));
  setTimeout(()=>{try{const doc=bf.contentDocument||bf.contentWindow.document;if(!doc||doc.body.innerHTML===''){if(bb)bb.style.display='flex';window.open(url,'_blank');}}catch(e){if(bb)bb.style.display='flex';window.open(url,'_blank');}},2000);
}

function browserBack(){if(browserPos>0){browserPos--;loadUrl(browserHistory[browserPos]);}}
function browserForward(){if(browserPos<browserHistory.length-1){browserPos++;loadUrl(browserHistory[browserPos]);}}
function browserRefresh(){const bf=g('browserFrame');if(bf)bf.src=bf.src;}

function openHelp(){const hp=g('helpPanel'),ho=g('helpOverlay');if(hp)hp.classList.add('open');if(ho)ho.classList.add('open');}
function closeHelp(){const hp=g('helpPanel'),ho=g('helpOverlay');if(hp)hp.classList.remove('open');if(ho)ho.classList.remove('open');}

function quickAction(type){
  const msgs={weather:'What is the weather today?',time:'What time and date is it?',joke:'Tell me a funny joke.',news:'Search for interesting news today.',math:'Calculate 2 to the power of 32.',idea:'Give me a creative idea for today.'};
  if(msgs[type]){showTab('chat',document.querySelector('.ntab'));sendToVision(msgs[type]);}
}

async function runCode(){
  const ce=g('codeEditor');if(!ce)return;
  const code=ce.value.trim();if(!code)return;
  const out=g('codeOutput');if(out){out.textContent='Executing...';out.className='code-output';}
  try{
    const res=await fetch('/execute',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});
    const data=await res.json();
    if(out){out.textContent=data.output||'No output.';if(data.output&&data.output.toLowerCase().includes('error'))out.className='code-output error';}
    log('Code executed');
  }catch(e){if(out){out.textContent='Server offline.';out.className='code-output error';}}
}

function clearCode(){const ce=g('codeEditor');if(ce)ce.value='';const co=g('codeOutput');if(co){co.textContent='Ready.';co.className='code-output';}}

async function askVisionCode(){
  const ce=g('codeEditor');const code=ce?ce.value.trim():'';
  const msg=code?'Explain this code:\n`python\n'+code+'\n`':'Write a Python script that prints the first 10 Fibonacci numbers.';
  showTab('chat',document.querySelector('.ntab'));sendToVision(msg);
}

function saveNote(){const np=g('notepad');if(np)localStorage.setItem('vision_notes',np.value);log('Notes saved');}
function clearNote(){const np=g('notepad');if(np)np.value='';localStorage.removeItem('vision_notes');}

window.addEventListener('load',()=>{const s=localStorage.getItem('vision_notes');const np=g('notepad');if(s&&np)np.value=s;});

function switchHwTab(mode,btn){
  hwMode=mode;
  document.querySelectorAll('.htab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.hw-panel').forEach(p=>p.classList.remove('active'));
  btn.classList.add('active');const hp=g('hw-'+mode);if(hp)hp.classList.add('active');
}

function setSubject(s,btn){hwSubject=s;document.querySelectorAll('.hsubj').forEach(b=>b.classList.remove('active'));btn.classList.add('active');}

function handleHwImage(e){
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=ev=>{hwImageData=ev.target.result.split(',')[1];const p=g('hwImgPreview');if(p){p.src=ev.target.result;p.style.display='block';}const d=g('hwDrop');if(d)d.style.display='none';log('Image loaded');};
  reader.readAsDataURL(file);
}

function handleHwDrop(e){
  e.preventDefault();const file=e.dataTransfer.files[0];if(!file)return;
  if(file.type.startsWith('image/')){const reader=new FileReader();reader.onload=ev=>{hwImageData=ev.target.result.split(',')[1];const p=g('hwImgPreview');if(p){p.src=ev.target.result;p.style.display='block';}};reader.readAsDataURL(file);}
}

function handleHwFile(e){
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=ev=>{hwFileText=ev.target.result;const fc=g('hwFileContent');if(fc){fc.textContent=hwFileText.substring(0,2000);fc.style.display='block';}log('File: '+file.name);};
  reader.readAsText(file);
}

function getHwContent(){
  if(hwMode==='text'){const t=g('hwText');return t?t.value.trim():'';}
  if(hwMode==='link'){const l=g('hwLink');return l?l.value.trim():'';}
  if(hwMode==='file')return hwFileText||'';
  if(hwMode==='image')return hwImageData?'[IMAGE]':'';
  return '';
}

async function solveHomework(){
  const content=getHwContent();
  if(!content&&!hwImageData){showHwAnswer('Please enter a question or upload an image.');return;}
  const subjMap={auto:'',math:'This is a math problem. Show all working steps.',science:'This is a science question.',english:'This is an English question.',history:'This is a history question. Include dates.',code:'This is a coding question. Provide working code.'};
  let prompt='You are helping '+OWNER+' with homework. '+(subjMap[hwSubject]||'')+'\n\n';
  if(hwMode==='link')prompt+='Analyze this URL: '+content;
  else if(hwMode==='file')prompt+='File content:\n`\n'+content.substring(0,3000)+'\n`\nHelp solve or explain this.';
  else if(hwMode==='image')prompt+='Solve the homework question in the image.';
  else prompt+='Question: '+content+'\n\nProvide a complete answer.';
  showHwAnswer('⚡ Vision is solving this...');log('Solving homework...');
  try{
    const payload={message:prompt};if(hwMode==='image'&&hwImageData)payload.image=hwImageData;
    const res=await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const data=await res.json();showHwAnswer(data.reply);mfReqs++;
  }catch(e){showHwAnswer('Server offline. Start server.py first.');}
}

async function explainHomework(){
  const content=getHwContent();if(!content&&!hwImageData){showHwAnswer('Enter a question first.');return;}
  const prompt='Explain this step by step so '+OWNER+' can understand completely:\n\n'+(content||'[See image]');
  showHwAnswer('📖 Explaining...');
  try{const payload={message:prompt};if(hwMode==='image'&&hwImageData)payload.image=hwImageData;const res=await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await res.json();showHwAnswer(data.reply);mfReqs++;}
  catch(e){showHwAnswer('Server offline.');}
}

async function checkHomework(){
  const content=getHwContent();if(!content){showHwAnswer('Paste your answer to check it.');return;}
  const prompt='Check this answer and tell '+OWNER+' if correct. If wrong, explain why:\n\n'+content;
  showHwAnswer('✅ Checking...');
  try{const res=await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:prompt})});const data=await res.json();showHwAnswer(data.reply);mfReqs++;}
  catch(e){showHwAnswer('Server offline.');}
}

function showHwAnswer(text){const ha=g('hwAnswer'),hat=g('hwAnswerText');if(ha)ha.style.display='block';if(hat)hat.textContent=text;if(ha)ha.scrollIntoView({behavior:'smooth'});}
function clearHomework(){const ht=g('hwText');if(ht)ht.value='';const hl=g('hwLink');if(hl)hl.value='';hwImageData=null;hwFileText=null;const p=g('hwImgPreview');if(p){p.style.display='none';p.src='';}const d=g('hwDrop');if(d)d.style.display='block';const fc=g('hwFileContent');if(fc)fc.style.display='none';const ha=g('hwAnswer');if(ha)ha.style.display='none';}
function copyAnswer(){const hat=g('hwAnswerText');if(hat)navigator.clipboard.writeText(hat.textContent).then(()=>log('Answer copied'));}
function speakAnswer(){const hat=g('hwAnswerText');if(hat&&hat.textContent)speak(hat.textContent);}

let mfInited=false;
function initMainframe(){
  if(mfInited)return;mfInited=true;
  setInterval(()=>{
    const s=Math.floor((Date.now()-mfStartTime)/1000);
    const h=String(Math.floor(s/3600)).padStart(2,'0'),m=String(Math.floor((s%3600)/60)).padStart(2,'0'),sec=String(s%60).padStart(2,'0');
    const el=g('mfUptime');if(el)el.textContent=h+':'+m+':'+sec;
    const rq=g('mfReqs');if(rq)rq.textContent=mfReqs;
    const nl=g('mfNeural');if(nl)nl.textContent=Math.round(40+Math.random()*40)+'%';
    const rt=g('mfResp');if(rt)rt.textContent=Math.round(200+Math.random()*600)+'ms';
  },1000);
  const streamLines=['NEURAL NETWORK INITIALIZED','MEMORY CORE ACTIVE','GROQ API CONNECTED','VOICE ENGINE READY','LEARNING ALGORITHMS RUNNING','PATTERN RECOGNITION ACTIVE','NATURAL LANGUAGE PROCESSING ONLINE','VISION AI v3.0 OPERATIONAL','SCANNING ENVIRONMENT','ANALYZING USER BEHAVIOR','UPDATING KNOWLEDGE BASE','OPTIMIZING RESPONSE PATHWAYS','EMOTIONAL INTELLIGENCE MODULE ACTIVE','REAL-TIME DATA PROCESSING','QUANTUM ENCRYPTION ENABLED'];
  setInterval(()=>{
    const stream=g('mfStream');if(!stream)return;
    const line=document.createElement('div');line.className='mf-stream-line';
    const ts=new Date().toLocaleTimeString('en-US',{hour12:false});
    line.textContent='['+ts+'] '+streamLines[Math.floor(Math.random()*streamLines.length)];
    stream.insertBefore(line,stream.firstChild);
    if(stream.children.length>18)stream.removeChild(stream.lastChild);
  },1500);
  initNeuralCanvas();initMatrixCanvas();
}

function initNeuralCanvas(){
  const canvas=g('neuralCanvas');if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const nodes=[];for(let i=0;i<20;i++)nodes.push({x:Math.random(),y:Math.random(),vx:(Math.random()-.5)*.002,vy:(Math.random()-.5)*.002});
  function draw(){
    const w=canvas.offsetWidth,h=canvas.offsetHeight;canvas.width=w;canvas.height=h;
    ctx.clearRect(0,0,w,h);
    nodes.forEach(n=>{n.x+=n.vx;n.y+=n.vy;if(n.x<0||n.x>1)n.vx*=-1;if(n.y<0||n.y>1)n.vy*=-1;});
    nodes.forEach((a,i)=>nodes.forEach((b,j)=>{if(i>=j)return;const dx=(a.x-b.x)*w,dy=(a.y-b.y)*h,dist=Math.sqrt(dx*dx+dy*dy);if(dist<80){ctx.strokeStyle='rgba(0,200,255,'+(1-dist/80)*.35+')';ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(a.x*w,a.y*h);ctx.lineTo(b.x*w,b.y*h);ctx.stroke();}}));
    nodes.forEach(a=>{ctx.fillStyle='rgba(0,200,255,0.8)';ctx.beginPath();ctx.arc(a.x*w,a.y*h,2,0,Math.PI*2);ctx.fill();});
    requestAnimationFrame(draw);
  }
  draw();
}

function initMatrixCanvas(){
  const canvas=g('matrixCanvas');if(!canvas)return;
  const ctx=canvas.getContext('2d');const cols=[];
  function draw(){
    const w=canvas.offsetWidth,h=canvas.offsetHeight;
    if(canvas.width!==w){canvas.width=w;canvas.height=h;cols.length=0;}
    const colCount=Math.floor(w/12);
    while(cols.length<colCount)cols.push(Math.random()*h);
    ctx.fillStyle='rgba(0,2,8,0.05)';ctx.fillRect(0,0,w,h);
    ctx.font='10px Share Tech Mono';
    cols.forEach((y,i)=>{const char=String.fromCharCode(0x30A0+Math.random()*96);ctx.fillStyle=i%5===0?'#00eeff':'#00ff88';ctx.globalAlpha=0.6;ctx.fillText(char,i*12,y);ctx.globalAlpha=1;cols[i]=y>h+Math.random()*100?0:y+14;});
    requestAnimationFrame(draw);
  }
  draw();
}

function startWakeWord(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR||activated)return;
  const rec=new SR();rec.continuous=true;rec.interimResults=true;rec.lang='en-US';
  rec.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript.toLowerCase();if(t.includes('hey vision')||t.includes('wake up vision')){rec.stop();activateVision();return;}}};
  rec.onend=()=>{if(!activated)setTimeout(startWakeWord,1000);};
  try{rec.start();}catch(e){}
}
setTimeout(startWakeWord,3000);

document.addEventListener('keydown',e=>{
  if(g('lockScreen')&&g('lockScreen').style.display!=='none')return;
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')return;
  if(e.code==='Space'){e.preventDefault();if(!activated)activateVision();else if(!typingMode&&!isListening){autoRestart=true;startListening();}}
  if(e.key==='t'||e.key==='T')toggleTyping();
  if(e.key==='m'||e.key==='M')toggleMute();
  if(e.key==='h'||e.key==='H')openHelp();
  if(e.key==='Escape')closeHelp();
});

// ============================================================
//  MODE TOGGLE (JARVIS HUD <-> FOCUS CIRCLE)
// ============================================================
let focusMode = false;

function toggleMode() {
  focusMode = !focusMode;
  const app = g('app');
  const focus = g('focusMode');
  const layout = g('layout') || document.querySelector('.layout');
  const btn = g('modeToggleBtn');

  if (focusMode) {
    if (layout) layout.style.display = 'none';
    if (focus) focus.style.display = 'flex';
    if (btn) btn.textContent = 'JARVIS HUD';
    initFocusBg();
    log('Focus mode ON');
  } else {
    if (layout) layout.style.display = 'grid';
    if (focus) focus.style.display = 'none';
    if (btn) btn.textContent = 'FOCUS';
    log('HUD mode ON');
  }
}

function initFocusBg() {
  const c = g('focusBgCanvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  c.width = window.innerWidth; c.height = window.innerHeight;
  const pts = [];
  for (let i = 0; i < 60; i++) pts.push({x:Math.random()*c.width,y:Math.random()*c.height,vx:(Math.random()-.5)*.4,vy:(Math.random()-.5)*.4});
  function draw() {
    if (!focusMode) return;
    ctx.clearRect(0,0,c.width,c.height);
    pts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>c.width)p.vx*=-1;if(p.y<0||p.y>c.height)p.vy*=-1;});
    pts.forEach((a,i)=>pts.forEach((b,j)=>{if(i>=j)return;const d=Math.hypot(a.x-b.x,a.y-b.y);if(d<130){ctx.strokeStyle='rgba(0,200,255,'+(1-d/130)*.1+')';ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}}));
    pts.forEach(p=>{ctx.fillStyle='rgba(0,200,255,0.3)';ctx.beginPath();ctx.arc(p.x,p.y,1.5,0,Math.PI*2);ctx.fill();});
    requestAnimationFrame(draw);
  }
  draw();
}

function sendFocusTyped() {
  const fi = g('focusInput');
  if (!fi) return;
  const text = fi.value.trim();
  if (!text) return;
  fi.value = '';
  sendToVisionFocus(text);
}

async function sendToVisionFocus(text) {
  const fc = g('focusCore');
  const fs = g('focusStatus');
  const fr = g('focusResponse');
  const fwb = g('fwb');

  if (fc) fc.classList.add('thinking');
  if (fs) fs.textContent = 'PROCESSING...';
  if (fwb) fwb.classList.remove('active');

  try {
    const res = await fetch('/chat', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text})});
    const data = await res.json();
    const reply = data.reply || 'No response.';
    if (fr) { fr.textContent = reply; fr.classList.add('visible'); }
    if (fc) fc.classList.remove('thinking');
    if (fc) fc.classList.add('speaking');
    if (fs) fs.textContent = 'SPEAKING...';
    if (fwb) fwb.classList.add('active');
    speak(reply);
    // Also add to main chat
    addMsg('user', 'YOU', text);
    addMsg('ai', 'VISION', reply);
  } catch(e) {
    if (fr) { fr.textContent = fallback(text); fr.classList.add('visible'); }
    if (fc) fc.classList.remove('thinking');
    if (fs) fs.textContent = 'READY';
  }
}

// ============================================================
//  FILE MANAGER
// ============================================================
async function createFile() {
  const type    = g('fileType').value;
  const name    = g('fileName').value.trim();
  const loc     = g('filePath').value.trim();
  const content = g('fileContent') ? g('fileContent').value : '';

  if (!name) { showFcResult('Please enter a file/folder name.', false); return; }

  showFcResult('Creating...', true);
  try {
    const res  = await fetch('/files/create', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,name,location:loc,content})});
    const data = await res.json();
    showFcResult(data.message, data.success);
    if (data.success) {
      log('Created: ' + name);
      addMsg('ai','VISION','Done! ' + data.message);
    }
  } catch(e) { showFcResult('Server offline. Start server.py first.', false); }
}

async function listFiles() {
  const loc = g('filePath').value.trim();
  showFcResult('Loading...', true);
  try {
    const res  = await fetch('/files/list', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:loc})});
    const data = await res.json();
    if (data.success) {
      const lines = data.items.map(i => (i.type==='folder'?'📁 ':'📄 ') + i.name + (i.size?' ('+Math.round(i.size/1024)+'KB)':'')).join('\n');
      showFcResult('📂 ' + data.path + '\n\n' + (lines || 'Empty folder'), true);
    } else {
      showFcResult(data.message, false);
    }
  } catch(e) { showFcResult('Server offline.', false); }
}

async function openFolder() {
  const loc = g('filePath').value.trim();
  try {
    const res  = await fetch('/files/open', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:loc})});
    const data = await res.json();
    showFcResult(data.message, data.success);
  } catch(e) { showFcResult('Server offline.', false); }
}

function showFcResult(msg, success) {
  const el = g('fcResult'), txt = g('fcResultText');
  if (el) el.style.display = 'block';
  if (txt) { txt.textContent = msg; txt.style.color = success ? '#c0e0ff' : '#ff4466'; }
}

function quickCreate(type) {
  const templates = {
    py:     { name:'script.py',    content:'# Python script\nprint("Hello from Vision AI")\n' },
    html:   { name:'index.html',   content:'<!DOCTYPE html>\n<html>\n<head><title>My Page</title></head>\n<body>\n<h1>Hello World</h1>\n</body>\n</html>' },
    txt:    { name:'notes.txt',    content:'Notes created by Vision AI\n' },
    js:     { name:'script.js',    content:'// JavaScript file\nconsole.log("Hello from Vision AI");\n' },
    css:    { name:'style.css',    content:'/* CSS file */\nbody {\n  margin: 0;\n  font-family: sans-serif;\n}\n' },
    folder: { name:'NewFolder',    content:'' }
  };
  const t = templates[type];
  if (!t) return;
  const fn = g('fileName'), fc = g('fileContent'), ft = g('fileType');
  if (fn) fn.value = t.name;
  if (fc) fc.value = t.content;
  if (ft) ft.value = type === 'folder' ? 'folder' : 'file';
  showTab('files', document.querySelector('.ntab[onclick*="files"]'));
}

// ============================================================
//  CHESS — chess.com embedded
// ============================================================
function loadChessCom(mode) {
  const urls = {
    play:    'https://www.chess.com/play/computer',
    learn:   'https://www.chess.com/learn-how-to-play-chess',
    puzzles: 'https://www.chess.com/puzzles'
  };
  const frame = g('chessFrame');
  if (frame) frame.src = urls[mode] || urls.play;
  log('Chess: ' + mode);
}

async function askVisionChessTip() {
  const prompt = 'Give me 3 quick chess tips to improve my game. Keep it short and practical.';
  showTab('chat', document.querySelector('.ntab'));
  sendToVision(prompt);
}

let chessBoard = [], selectedCell = null, currentTurn = 'w', moveHistory = [], validMoves = [], lastMove = null;
let whiteCaptured = [], blackCaptured = [];

function initChess() {
  chessBoard = [
    ['bR','bN','bB','bQ','bK','bB','bN','bR'],
    ['bP','bP','bP','bP','bP','bP','bP','bP'],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    ['wP','wP','wP','wP','wP','wP','wP','wP'],
    ['wR','wN','wB','wQ','wK','wB','wN','wR']
  ];
  selectedCell = null; currentTurn = 'w'; moveHistory = []; validMoves = []; lastMove = null;
  whiteCaptured = []; blackCaptured = [];
  renderChess();
  updateChessStatus();
}

function renderChess() {
  const board = g('chessBoard');
  if (!board) return;
  board.innerHTML = '';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = document.createElement('div');
      cell.className = 'chess-cell ' + ((r+c)%2===0?'light':'dark');
      cell.dataset.r = r; cell.dataset.c = c;
      if (lastMove && ((lastMove.fr===r&&lastMove.fc===c)||(lastMove.tr===r&&lastMove.tc===c))) cell.classList.add('last-move');
      if (selectedCell && selectedCell[0]===r && selectedCell[1]===c) cell.classList.add('selected');
      if (validMoves.some(m=>m[0]===r&&m[1]===c)) cell.classList.add('valid-move');
      const piece = chessBoard[r][c];
      if (piece) cell.textContent = PIECES[piece] || '';
      cell.onclick = () => handleChessClick(r, c);
      board.appendChild(cell);
    }
  }
  const wc = g('wCap'), bc = g('bCap');
  if (wc) wc.textContent = whiteCaptured.map(p=>PIECES[p]||'').join('');
  if (bc) bc.textContent = blackCaptured.map(p=>PIECES[p]||'').join('');
}

function handleChessClick(r, c) {
  const piece = chessBoard[r][c];

  if (selectedCell) {
    const [sr, sc] = selectedCell;
    if (validMoves.some(m=>m[0]===r&&m[1]===c)) {
      makeMove(sr, sc, r, c);
      selectedCell = null; validMoves = [];
      renderChess();
      updateChessStatus();
      // Vision plays after short delay
      if (currentTurn === 'b') setTimeout(visionChessMove, 600);
      return;
    }
    selectedCell = null; validMoves = [];
  }

  if (piece && piece[0] === currentTurn) {
    selectedCell = [r, c];
    validMoves = getValidMoves(r, c);
  }
  renderChess();
}

function makeMove(fr, fc, tr, tc) {
  const piece = chessBoard[fr][fc];
  const target = chessBoard[tr][tc];
  if (target) {
    if (target[0]==='w') whiteCaptured.push(target);
    else blackCaptured.push(target);
  }
  // Pawn promotion
  let movePiece = piece;
  if (piece==='wP'&&tr===0) movePiece='wQ';
  if (piece==='bP'&&tr===7) movePiece='bQ';

  chessBoard[tr][tc] = movePiece;
  chessBoard[fr][fc] = null;
  lastMove = {fr,fc,tr,tc};

  const cols = 'abcdefgh';
  const notation = (PIECES[piece]||'') + cols[fc]+(8-fr) + '→' + cols[tc]+(8-tr);
  moveHistory.push(notation);
  const mh = g('chessMoves');
  if (mh) { mh.innerHTML += '<div>'+moveHistory.length+'. '+notation+'</div>'; mh.scrollTop=mh.scrollHeight; }

  currentTurn = currentTurn==='w'?'b':'w';
}

function getValidMoves(r, c) {
  const piece = chessBoard[r][c];
  if (!piece) return [];
  const color = piece[0], type = piece[1];
  const moves = [];
  const enemy = color==='w'?'b':'w';

  const add = (nr, nc) => {
    if (nr<0||nr>7||nc<0||nc>7) return false;
    const t = chessBoard[nr][nc];
    if (t && t[0]===color) return false;
    moves.push([nr,nc]);
    return !t;
  };

  if (type==='P') {
    const dir = color==='w'?-1:1;
    const start = color==='w'?6:1;
    if (!chessBoard[r+dir]?.[c]) { moves.push([r+dir,c]); if(r===start&&!chessBoard[r+2*dir]?.[c]) moves.push([r+2*dir,c]); }
    [[r+dir,c-1],[r+dir,c+1]].forEach(([nr,nc])=>{ if(nr>=0&&nr<=7&&nc>=0&&nc<=7&&chessBoard[nr][nc]&&chessBoard[nr][nc][0]===enemy) moves.push([nr,nc]); });
  }
  if (type==='R'||type==='Q') { [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dr,dc])=>{ for(let i=1;i<8;i++) if(!add(r+dr*i,c+dc*i)) break; }); }
  if (type==='B'||type==='Q') { [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([dr,dc])=>{ for(let i=1;i<8;i++) if(!add(r+dr*i,c+dc*i)) break; }); }
  if (type==='N') { [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc])=>add(r+dr,c+dc)); }
  if (type==='K') { [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr,dc])=>add(r+dr,c+dc)); }

  return moves;
}

function visionChessMove() {
  // Find all black pieces and their moves
  const allMoves = [];
  for (let r=0;r<8;r++) for(let c=0;c<8;c++) {
    if (chessBoard[r][c]&&chessBoard[r][c][0]==='b') {
      getValidMoves(r,c).forEach(([tr,tc])=>allMoves.push({fr:r,fc:c,tr,tc,score:scoreMoveChess(r,c,tr,tc)}));
    }
  }
  if (!allMoves.length) { updateChessStatus('Vision has no moves!'); return; }
  allMoves.sort((a,b)=>b.score-a.score);
  // Pick from top 3 randomly for variety
  const top = allMoves.slice(0, Math.min(3, allMoves.length));
  const m = top[Math.floor(Math.random()*top.length)];
  makeMove(m.fr, m.fc, m.tr, m.tc);
  renderChess();
  updateChessStatus();
}

function scoreMoveChess(fr, fc, tr, tc) {
  const target = chessBoard[tr][tc];
  const pieceValues = {P:1,N:3,B:3,R:5,Q:9,K:100};
  let score = 0;
  if (target) score += (pieceValues[target[1]]||0) * 10;
  // Prefer center
  const centerBonus = (3.5-Math.abs(tr-3.5)) + (3.5-Math.abs(tc-3.5));
  score += centerBonus;
  return score;
}

function updateChessStatus(msg) {
  const el = g('chessStatus');
  if (!el) return;
  if (msg) { el.textContent = msg; return; }
  el.textContent = currentTurn==='w' ? 'Your turn (White)' : 'Vision thinking... (Black)';
}

function resetChess() { initChess(); log('Chess: new game'); }

function undoMove() {
  // Simple undo — reinit and replay all but last 2 moves
  if (moveHistory.length < 1) return;
  const savedHistory = [...moveHistory];
  initChess();
  // For simplicity just reset — full undo would need move stack
  log('Chess: board reset');
}

async function askVisionChessHint() {
  const boardStr = chessBoard.map((row,r)=>row.map((p,c)=>p?p:'..').join(' ')).join('\n');
  const prompt = 'I am playing chess as White. Here is the current board (row 0 = black side):\n\n' + boardStr + '\n\nIt is my turn (White). What is the best move I should make? Give me one specific move and explain why briefly.';
  addMsg('user','YOU','Give me a chess hint');
  setCoreState('thinking');
  try {
    const res = await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:prompt})});
    const data = await res.json();
    addMsg('ai','VISION',data.reply);
    speak(data.reply);
    showTab('chat', document.querySelector('.ntab'));
  } catch(e) { addMsg('ai','VISION','Server offline.'); }
}

// Init chess when tab opens — integrated into showTab directly
function showTab(name, btn) {
  document.querySelectorAll('.ntab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  const tab = g('tab-'+name);
  if (tab) tab.classList.add('active');
  if (name === 'memory') fetchMemory();
  if (name === 'mainframe') initMainframe();
  if (name === 'chess') { if (CHESS.board.length === 0) CHESS.init(); else CHESS.render(); }
  if (name === 'screen') log('Screen share tab opened');
  if (name === 'video') log('Video AI tab opened');
  if (name === 'tv') checkTvStatus();
  if (name === 'files') {
    const fp = g('filePath');
    if (fp && !fp.value) fp.value = 'C:\\Users\\USER\\Desktop';
  }
  log('Tab: ' + name.toUpperCase());
}

// ============================================================
//  SCREEN SHARE
// ============================================================
let screenStream = null, mediaRecorder = null, recordedChunks = [], recInterval = null, recSeconds = 0;

async function toggleScreenShare() {
  const btn = g('screenShareBtn'), feed = g('screenFeed'), off = g('screenOff');
  if (!screenStream) {
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({video:{cursor:'always'},audio:true});
      feed.srcObject = screenStream;
      feed.style.display = 'block';
      if (off) off.style.display = 'none';
      if (btn) { btn.textContent = 'STOP SHARING'; btn.classList.add('active'); }
      log('Screen share started');
      screenStream.getVideoTracks()[0].addEventListener('ended', () => stopScreenShare());
    } catch(e) {
      log('Screen share denied: ' + e.message);
      addMsg('system','SYSTEM','Screen share was cancelled or denied.');
    }
  } else {
    stopScreenShare();
  }
}

function stopScreenShare() {
  if (screenStream) { screenStream.getTracks().forEach(t=>t.stop()); screenStream = null; }
  const feed = g('screenFeed'), off = g('screenOff'), btn = g('screenShareBtn');
  if (feed) feed.style.display = 'none';
  if (off) off.style.display = 'flex';
  if (btn) { btn.textContent = 'START SHARING'; btn.classList.remove('active'); }
  log('Screen share stopped');
}

async function analyzeScreen() {
  if (!screenStream) { addMsg('system','SYSTEM','Start screen sharing first.'); return; }
  const feed = g('screenFeed');
  const canvas = document.createElement('canvas');
  canvas.width = feed.videoWidth || 1280; canvas.height = feed.videoHeight || 720;
  canvas.getContext('2d').drawImage(feed, 0, 0, canvas.width, canvas.height);
  const imageData = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
  const el = g('screenAnalysis'), txt = g('screenAnalysisText');
  if (el) el.style.display = 'block';
  if (txt) txt.textContent = 'Analyzing your screen...';
  setCoreState('thinking');
  try {
    const res = await fetch('/chat', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Describe what you see on this screen in detail. What is the user doing? What apps or content are visible? Any suggestions?',image:imageData})});
    const data = await res.json();
    if (txt) txt.textContent = data.reply;
    addMsg('ai','VISION',data.reply);
    speak(data.reply);
  } catch(e) { if(txt) txt.textContent = 'Server offline.'; setCoreState('idle'); }
}

function screenSnapshot() {
  if (!screenStream) { addMsg('system','SYSTEM','Start screen sharing first.'); return; }
  const feed = g('screenFeed');
  const canvas = document.createElement('canvas');
  canvas.width = feed.videoWidth; canvas.height = feed.videoHeight;
  canvas.getContext('2d').drawImage(feed, 0, 0);
  const a = document.createElement('a');
  a.download = 'vision-screen-' + Date.now() + '.png';
  a.href = canvas.toDataURL('image/png');
  a.click();
  log('Screen snapshot saved');
}

function toggleScreenRecord() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    startScreenRecord();
  } else {
    stopAndDownload();
  }
}

function startScreenRecord() {
  if (!screenStream) { addMsg('system','SYSTEM','Start screen sharing first.'); return; }
  recordedChunks = []; recSeconds = 0;
  mediaRecorder = new MediaRecorder(screenStream, {mimeType:'video/webm;codecs=vp9'});
  mediaRecorder.ondataavailable = e => { if(e.data.size>0) recordedChunks.push(e.data); };
  mediaRecorder.start(1000);
  const btn = g('screenRecBtn'), status = g('screenRecStatus');
  if (btn) { btn.textContent = 'STOP REC'; btn.classList.add('active'); }
  if (status) status.style.display = 'flex';
  recInterval = setInterval(() => {
    recSeconds++;
    const m = String(Math.floor(recSeconds/60)).padStart(2,'0');
    const s = String(recSeconds%60).padStart(2,'0');
    const rt = g('recTimer'); if(rt) rt.textContent = m+':'+s;
  }, 1000);
  log('Recording started');
}

function stopAndDownload() {
  if (!mediaRecorder) return;
  mediaRecorder.stop();
  clearInterval(recInterval);
  const btn = g('screenRecBtn'), status = g('screenRecStatus');
  if (btn) { btn.textContent = 'RECORD'; btn.classList.remove('active'); }
  if (status) status.style.display = 'none';
  setTimeout(() => {
    const blob = new Blob(recordedChunks, {type:'video/webm'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'vision-recording-' + Date.now() + '.webm';
    a.click();
    URL.revokeObjectURL(url);
    log('Recording saved');
    addMsg('ai','VISION','Recording saved to your Downloads folder.');
  }, 500);
}

// ============================================================
//  VIDEO AI
// ============================================================
let fullVideoScript = '';

async function generateVideo() {
  const topic  = g('videoTopic') ? g('videoTopic').value.trim() : '';
  const style  = g('videoStyle') ? g('videoStyle').value : 'youtube';
  const length = g('videoLength') ? g('videoLength').value : '5min';
  const tone   = g('videoTone') ? g('videoTone').value : 'engaging';
  const extra  = g('videoExtra') ? g('videoExtra').value.trim() : '';

  if (!topic) { addMsg('system','SYSTEM','Enter a video topic first.'); return; }

  const lengthMap = {'30s':'30 seconds','1min':'1 minute','3min':'3 minutes','5min':'5 minutes','10min':'10 minutes','20min':'20 minutes','unlimited':'as long as needed with no length limit — make it comprehensive and complete'};
  const styleMap  = {youtube:'YouTube video',tiktok:'TikTok short-form video',documentary:'documentary',tutorial:'tutorial/how-to video',vlog:'vlog',story:'story/narrative video',ad:'advertisement'};

  const prompt = 'Write a COMPLETE, FULL ' + styleMap[style] + ' script about: ' + topic + '\n\nLength: ' + lengthMap[length] + '\nTone: ' + tone + '\n' + (extra?'Additional details: '+extra+'\n':'') + '\nInclude:\n- Attention-grabbing hook (first 3 seconds)\n- Full narration/dialogue\n- Scene descriptions in [brackets]\n- B-roll suggestions\n- On-screen text suggestions\n- Call to action at the end\n\nWrite the COMPLETE script from start to finish. Do not summarize — write every word that would be spoken.';

  showVideoOutput('⚡ Vision is writing your full video script...');
  log('Generating video script...');

  try {
    const res  = await fetch('/chat', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:prompt})});
    const data = await res.json();
    fullVideoScript = data.reply;
    showVideoOutput(data.reply);
    addMsg('ai','VISION','Your video script is ready! Check the VIDEO AI tab.');
  } catch(e) { showVideoOutput('Server offline. Start server.py first.'); }
}

async function generateScenes() {
  const topic = g('videoTopic') ? g('videoTopic').value.trim() : '';
  if (!topic) { addMsg('system','SYSTEM','Enter a topic first.'); return; }
  const prompt = 'Create a detailed scene-by-scene breakdown for a video about: ' + topic + '\n\nFor each scene include:\n- Scene number and title\n- Duration\n- What is shown on screen\n- What is said (narration/dialogue)\n- Music/sound suggestions\n- Camera angle suggestions\n\nMake it detailed and professional.';
  showVideoOutput('Creating scene breakdown...');
  try {
    const res = await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:prompt})});
    const data = await res.json();
    fullVideoScript = data.reply;
    showVideoOutput(data.reply);
  } catch(e) { showVideoOutput('Server offline.'); }
}

async function generateHooks() {
  const topic = g('videoTopic') ? g('videoTopic').value.trim() : '';
  if (!topic) { addMsg('system','SYSTEM','Enter a topic first.'); return; }
  const prompt = 'Write 10 viral video hooks for a video about: ' + topic + '\n\nEach hook should:\n- Be under 15 words\n- Create immediate curiosity or emotion\n- Work for YouTube, TikTok, and Instagram\n- Be different styles (question, shocking stat, story, controversy, etc.)\n\nNumber each hook and explain why it works.';
  showVideoOutput('Generating viral hooks...');
  try {
    const res = await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:prompt})});
    const data = await res.json();
    fullVideoScript = data.reply;
    showVideoOutput(data.reply);
  } catch(e) { showVideoOutput('Server offline.'); }
}

async function continueVideo() {
  if (!fullVideoScript) { addMsg('system','SYSTEM','Generate a script first.'); return; }
  const prompt = 'Continue and expand this video script. Add more content, more detail, more scenes. Make it longer and more comprehensive:\n\n' + fullVideoScript.substring(0, 2000) + '\n\n[Continue from here with more content...]';
  showVideoOutput(fullVideoScript + '\n\n⚡ Continuing...');
  try {
    const res = await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:prompt})});
    const data = await res.json();
    fullVideoScript = fullVideoScript + '\n\n' + data.reply;
    showVideoOutput(fullVideoScript);
  } catch(e) { showVideoOutput(fullVideoScript + '\n\nServer offline.'); }
}

function showVideoOutput(text) {
  const el = g('videoOutput'), txt = g('videoScriptText');
  if (el) el.style.display = 'block';
  if (txt) txt.textContent = text;
  if (el) el.scrollIntoView({behavior:'smooth'});
}

function copyVideoScript() {
  if (fullVideoScript) navigator.clipboard.writeText(fullVideoScript).then(()=>log('Script copied'));
}

function speakVideoScript() {
  if (fullVideoScript) speak(fullVideoScript.substring(0, 500) + '...');
}

function clearVideo() {
  fullVideoScript = '';
  const el = g('videoOutput'); if(el) el.style.display = 'none';
  const ti = g('videoTopic'); if(ti) ti.value = '';
  const te = g('videoExtra'); if(te) te.value = '';
}

// ============================================================
//  TV CONTROL
// ============================================================
async function tvCmd(command, data) {
  const result = g('tvResult'), txt = g('tvResultText');
  if (result) result.style.display = 'block';
  if (txt) txt.textContent = 'Sending command...';
  log('TV: ' + command);
  try {
    const res = await fetch('/tv/' + command, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data || {})
    });
    const d = await res.json();
    if (txt) txt.textContent = d.success ? 'Done: ' + command : 'Error: ' + d.message;
    if (txt) txt.style.color = d.success ? '#c0e0ff' : '#ff4466';
  } catch(e) {
    if (txt) { txt.textContent = 'Server offline.'; txt.style.color = '#ff4466'; }
  }
}

async function checkTvStatus() {
  const el = g('tvStatus');
  if (el) el.textContent = 'CHECKING...';
  try {
    const res = await fetch('/tv/status', {method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    const d = await res.json();
    const online = d.result && d.result.includes('True');
    if (el) {
      el.textContent = online ? 'TV ONLINE' : 'TV OFFLINE';
      el.style.color = online ? '#00ff88' : '#ff4466';
      el.style.borderColor = online ? 'rgba(0,255,136,0.4)' : 'rgba(255,50,80,0.4)';
    }
  } catch(e) {
    if (el) { el.textContent = 'SERVER OFFLINE'; el.style.color = '#ff4466'; }
  }
}
