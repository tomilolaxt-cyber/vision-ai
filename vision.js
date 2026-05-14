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
  const v = g('codeInput').value.trim();
  if(v===ACCESS_CODE){
    const lock=g('lockScreen');
    lock.style.opacity='0';lock.style.transition='opacity .7s';
    setTimeout(()=>{lock.style.display='none';g('app').style.display='grid';initApp();},700);
  } else {
    g('lockError').textContent='ACCESS DENIED';
    g('codeInput').value='';
    setTimeout(()=>g('lockError').textContent='',2500);
  }
}

document.addEventListener('DOMContentLoaded',()=>{const c=g('codeInput');if(c)c.focus();});

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
    u.onstart=()=>{setCoreState('speaking');g('core-bars')&&g('waveBars').classList.add('active');};
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

function showTab(name,btn){
  document.querySelectorAll('.ntab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  const tab=g('tab-'+name);if(tab)tab.classList.add('active');
  if(name==='memory')fetchMemory();
  if(name==='mainframe')initMainframe();
  log('Tab: '+name.toUpperCase());
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
