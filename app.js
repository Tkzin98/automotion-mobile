const $=id=>document.getElementById(id);
const videoInput=$('videoInput'),sourceVideo=$('sourceVideo'),renderCanvas=$('renderCanvas'),playCanvas=$('playCanvas');
const analyzeBtn=$('analyzeBtn'),exportBtn=$('exportBtn'),previewBtn=$('previewBtn'),mp4Btn=$('mp4Btn'),cancelExportBtn=$('cancelExportBtn');
const downloadWebm=$('downloadWebm'),downloadMp4=$('downloadMp4'),statusPill=$('statusPill'),progressArea=$('progressArea'),progressBar=$('progressBar'),progressLabel=$('progressLabel'),progressValue=$('progressValue');
const resultCard=$('resultCard'),segmentList=$('segmentList'),segmentCount=$('segmentCount'),claimTag=$('claimTag'),claimSummary=$('claimSummary'),videoMeta=$('videoMeta'),stageHint=$('stageHint'),styleSelect=$('styleSelect'),positionSelect=$('positionSelect');
let videoURL='',currentVideoFile=null,wordChunks=[],transcriptSegments=[],claimSegments=[],whisperPipe=null,whisperBackend='wasm',ffmpeg=null,ffmpegLoadPromise=null,recording=false,cancelRequested=false,lastBlob=null,lastWebmURL='',lastMp4URL='';
const MOBILE=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent); 
const RENDER_FPS=MOBILE?30:60;
const MAX_RENDER_DIM=MOBILE?1280:1920;
let lastProgressPaint=0;
let cachedThemeKey='';

function setStatus(t){statusPill.textContent=t}
function setProgress(l,v,force=false){const now=performance.now();if(!force&&now-lastProgressPaint<220)return;lastProgressPaint=now;progressArea.classList.remove('hidden');progressLabel.textContent=l;const n=Math.max(0,Math.min(100,Math.round(v)));progressValue.textContent=n+'%';progressBar.style.width=n+'%'}
function clearProgress(){progressArea.classList.add('hidden');progressBar.style.width='0%';lastProgressPaint=0}
function fmtTime(s){s=Number.isFinite(s)?s:0;return Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0')}
function esc(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function revokeURL(name){if(name&&name.startsWith('blob:'))URL.revokeObjectURL(name)}
function clearDownloads(){revokeURL(lastWebmURL);revokeURL(lastMp4URL);lastWebmURL='';lastMp4URL='';lastBlob=null;downloadWebm.classList.add('hidden');downloadMp4.classList.add('hidden');mp4Btn.classList.add('hidden')}

videoInput.addEventListener('change',()=>{
  const f=videoInput.files?.[0];if(!f)return;
  currentVideoFile=f;
  if(videoURL)URL.revokeObjectURL(videoURL);
  videoURL=URL.createObjectURL(f);
  sourceVideo.src=videoURL;
  sourceVideo.load();
  $('previewWrap').classList.remove('hidden');
  analyzeBtn.disabled=false;
  resultCard.classList.add('hidden');
  clearDownloads();
  claimSegments=[];transcriptSegments=[];wordChunks=[];
  videoMeta.textContent=`${f.name} • ${(f.size/1048576).toFixed(1)} MB`;
  setStatus('Vídeo carregado');
});

sourceVideo.addEventListener('loadedmetadata',()=>{videoMeta.textContent=`${currentVideoFile?.name??'Vídeo'} • ${sourceVideo.videoWidth}×${sourceVideo.videoHeight} • ${fmtTime(sourceVideo.duration)}`});
sourceVideo.addEventListener('timeupdate',drawCurrentFrame);
sourceVideo.addEventListener('seeked',drawCurrentFrame);
analyzeBtn.addEventListener('click',analyzeVideo);
previewBtn.addEventListener('click',previewResult);
exportBtn.addEventListener('click',exportWebM);
cancelExportBtn.addEventListener('click',()=>{cancelRequested=true;setStatus('Parando renderização…');});
mp4Btn.addEventListener('click',convertMp4);
styleSelect.addEventListener('change',()=>{cachedThemeKey='';drawCurrentFrame()});
positionSelect.addEventListener('change',()=>drawCurrentFrame());

async function analyzeVideo(){
  if(!currentVideoFile)return;
  analyzeBtn.disabled=true;exportBtn.disabled=true;
  setStatus('Analisando informação…');
  try{
    setProgress('Preparando áudio no celular…',5,true);
    let wav=await extractAudioLocal(currentVideoFile,p=>setProgress('Preparando áudio no celular…',5+p*.15));
    setProgress('Carregando Whisper…',25,true);
    const pipe=await getWhisper();
    setProgress(`Transcrevendo (${whisperBackend.toUpperCase()})…`,38,true);
    const result=await pipe(wav,{language:'pt',task:'transcribe',return_timestamps:'word',chunk_length_s:30,stride_length_s:5});
    wav=null;
    wordChunks=normalizeChunks(result?.chunks||[]);
    transcriptSegments=buildSentences(wordChunks);
    setProgress('Interpretando afirmações científicas…',78,true);
    claimSegments=extractClaims(transcriptSegments);
    renderSegmentList();
    setupRenderCanvas();
    resultCard.classList.remove('hidden');
    setProgress(`Encontradas ${claimSegments.length} visualizações`,100,true);
    setStatus(`${claimSegments.length} gráficos prontos • ${whisperBackend.toUpperCase()}`);
    setTimeout(clearProgress,900);
    drawCurrentFrame();
  }catch(err){
    console.error(err);setStatus('Erro');
    alert(`Não foi possível analisar este vídeo.\n\n${err?.message||err}\n\nTeste primeiro um vídeo curto (10–30 s) no Chrome Android.`);
    clearProgress();
  }finally{analyzeBtn.disabled=false;exportBtn.disabled=false}
}

function normalizeChunks(chunks){return chunks.map(c=>{let[start,end]=c.timestamp||[0,0];if(!Number.isFinite(start))start=0;if(!Number.isFinite(end))end=start+.45;return{start,end:Math.max(end,start+.08),text:String(c.text||'').trim()}}).filter(x=>x.text)}
function buildSentences(chunks){if(!chunks.length)return[];const out=[],bucket=[];let start=chunks[0].start;for(let i=0;i<chunks.length;i++){const c=chunks[i];if(!bucket.length)start=c.start;bucket.push(c);const txt=bucket.map(x=>x.text).join(' ').replace(/\s+/g,' ').trim();const endSentence=/[.!?…]$/.test(c.text),tooLong=c.end-start>=5.2&&bucket.length>=8,last=i===chunks.length-1;if(endSentence||tooLong||last){out.push({start,end:c.end,text:txt});bucket.length=0}}return out}
const PT_NUM={um:1,uma:1,dois:2,duas:2,três:3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9,dez:10,cem:100,mil:1000};
function parseNum(raw){let s=String(raw).toLowerCase().trim().replace(/\s/g,'').replace(/\.(?=\d{3}(\D|$))/g,'').replace(/,(?=\d{3}(\D|$))/g,'');if(PT_NUM[s]!=null)return PT_NUM[s];const n=Number(s.replace(',','.'));return Number.isFinite(n)?n:null}
function mult(w){const s=String(w||'').toLowerCase();if(s.startsWith('trilh'))return 1e12;if(s.startsWith('bilh'))return 1e9;if(s.startsWith('milh'))return 1e6;if(s.startsWith('mil'))return 1e3;return 1}
function trimNum(n){return Number.isInteger(n)?String(n):n.toFixed(2).replace(/0+$/,'').replace(/\.$/,'').replace('.',',')}
function formatScale(n){if(n>=1e12)return trimNum(n/1e12)+' trilhões';if(n>=1e9)return trimNum(n/1e9)+' bilhões';if(n>=1e6)return trimNum(n/1e6)+' milhões';if(n>=1e3)return trimNum(n/1e3)+' mil';return trimNum(n)}
function formatValue(n){if(Math.abs(n)>=1e9)return trimNum(n/1e9)+'B';if(Math.abs(n)>=1e6)return trimNum(n/1e6)+'M';if(Math.abs(n)>=1e3)return trimNum(n/1e3)+'k';return trimNum(n)}

function extractClaims(sentences){
  const out=[];
  for(const s of sentences){
    const text=s.text.replace(/\s+/g,' ').trim();let c=null,m=text.match(/([0-9]+(?:[.,][0-9]+)?)\s*%/);
    if(m)c={type:'percentage',value:parseNum(m[1]),unit:'%',label:'Percentual',headline:trimNum(parseNum(m[1]))+'%',detail:text};
    if(!c){m=text.match(/([0-9]+(?:[.,][0-9]+)?|um|uma|dois|duas|três|quatro|cinco|seis|sete|oito|nove|dez)\s+vezes(?:\s+mais)?/i);if(m){const low=text.toLowerCase(),v=parseNum(m[1]);let label='Comparação';if(/massa/.test(low))label='Massa';else if(/tamanho|diâmetro|diametro|raio/.test(low))label='Tamanho';c={type:'ratio',value:v,unit:'×',label,headline:trimNum(v)+'×',detail:text}}}
    if(!c){m=text.match(/([0-9]+(?:[.,][0-9]+)?)\s*(milhões?|milhõe?s|bilhões?|bilhõe?s)?\s*(?:de\s*)?(km|quilômetros|quilometros|ua|unidades astronômicas)/i);if(m){const base=parseNum(m[1]),v=base*mult(m[2]);c={type:'distance',value:v,unit:m[3].toLowerCase(),label:'Distância',headline:m[3].toLowerCase()==='ua'?trimNum(base)+' UA':formatScale(v)+' km',detail:text}}}
    if(!c){let tm=text.match(/([0-9]+(?:[.,][0-9]+)?)\s*minutos?(?:\s+e\s+([0-9]+(?:[.,][0-9]+)?)\s*segundos?)?/i);if(tm){const mins=parseNum(tm[1]),secs=tm[2]!=null?parseNum(tm[2]):0,total=mins*60+secs,headline=secs?`${trimNum(mins)}m ${trimNum(secs)}s`:`${trimNum(mins)} min`;c={type:'time',value:total,unit:'s',label:'Tempo',headline,detail:text}}}
    if(!c){m=text.match(/([0-9]+(?:[.,][0-9]+)?)\s*(milhões?|milhõe?s|bilhões?|bilhõe?s)?\s*(?:de\s*)?(anos|ano|segundos?|horas?|dias?)/i);if(m){const base=parseNum(m[1]),v=base*mult(m[2]),u=m[3].toLowerCase(),scale=/anos?/.test(u)&&mult(m[2])>1;c={type:scale?'timeScale':'time',value:v,unit:u,label:scale?'Escala de tempo':'Tempo',headline:scale?formatScale(v)+' anos':trimNum(base)+' '+u,detail:text}}}
    if(!c){m=text.match(/(-?[0-9]+(?:[.,][0-9]+)?)\s*(?:°\s*)?(C|F|K|graus Celsius|graus Fahrenheit|kelvin)/i);if(m){const v=parseNum(m[1]);c={type:'temperature',value:v,unit:m[2],label:'Temperatura',headline:trimNum(v)+'°'+m[2].toUpperCase().slice(0,1),detail:text}}}
    if(!c){m=text.match(/([0-9]+(?:[.,][0-9]+)?)\s*(mil|milhões?|bilhões?)?\s*(?:de\s*)?(km\/s|km\/h|quilômetros? por segundo|quilometros por segundo|quilômetros? por hora|quilometros por hora)/i);if(m){const v=parseNum(m[1])*mult(m[2]);c={type:'speed',value:v,unit:m[4],label:'Velocidade',headline:formatValue(v)+' '+(m[2]?m[2].toLowerCase():''),detail:text}}}
    if(!c&&/\b(?:vezes|vez|milhões?|milhoes|bilhões?|bilhoes|por cento|%|cerca de|aproximadamente|mais de|menos de)\b/i.test(text)){m=text.match(/([0-9]+(?:[.,][0-9]+)?)/);if(m){const v=parseNum(m[1]);c={type:'number',value:v,unit:'',label:'Quantidade',headline:trimNum(v),detail:text}}}
    if(c){c.start=Math.max(0,s.start);c.end=Math.max(s.end,c.start+.9);c.enabled=true;c.id='claim-'+(out.length+1);out.push(c)}
  }
  return dedupe(out).slice(0,80)
}
function dedupe(a){const o=[];for(const x of a){const p=o[o.length-1];if(p&&Math.abs(p.start-x.start)<.35&&p.type===x.type&&p.detail===x.detail)continue;o.push(x)}return o}
function typeLabel(s){return{ratio:s.label||'Comparação',percentage:'Percentual',distance:'Distância',time:'Tempo',timeScale:'Escala de tempo',temperature:'Temperatura',speed:'Velocidade',number:'Quantidade'}[s.type]||'Informação'}

function renderSegmentList(){
  segmentList.innerHTML='';segmentCount.textContent=`${claimSegments.length} afirmações`;claimTag.textContent=`${claimSegments.length} gráficos`;
  const counts=claimSegments.reduce((m,x)=>(m[x.type]=(m[x.type]||0)+1,m),{});
  claimSummary.innerHTML=[['Comparações',counts.ratio||0],['Tempo/distância',(counts.time||0)+(counts.timeScale||0)+(counts.distance||0)],['Temperatura/velocidade',(counts.temperature||0)+(counts.speed||0)],['Percentuais/quantidades',(counts.percentage||0)+(counts.number||0)]].map(([a,b])=>`<div class="stat"><strong>${b}</strong><span>${a}</span></div>`).join('');
  if(!claimSegments.length){segmentList.innerHTML='<div class="segment"><div class="segment-text">Nenhuma afirmação quantitativa clara foi encontrada. Isso é intencional: palavras comuns não ativam gráficos.</div></div>';return}
  const frag=document.createDocumentFragment();
  claimSegments.forEach(s=>{const row=document.createElement('div');row.className='segment';row.innerHTML=`<div class="segment-time">${fmtTime(s.start)} → ${fmtTime(s.end)}</div><div class="segment-text">${esc(s.detail)}</div><div class="segment-visual"><span class="segment-type">${esc(typeLabel(s))}</span><span class="toggle">${s.enabled?'VISUAL ATIVO':'DESATIVADO'}</span></div>`;row.addEventListener('click',()=>{sourceVideo.currentTime=s.start;sourceVideo.pause();drawCurrentFrame()});row.addEventListener('dblclick',()=>{s.enabled=!s.enabled;renderSegmentList();drawCurrentFrame()});frag.appendChild(row)});segmentList.appendChild(frag)
}

function setupRenderCanvas(){
  const w=sourceVideo.videoWidth||720,h=sourceVideo.videoHeight||1280;
  const scale=Math.min(1,MAX_RENDER_DIM/Math.max(w,h));
  const cw=Math.max(320,Math.round(w*scale)),ch=Math.max(320,Math.round(h*scale));
  renderCanvas.width=cw;renderCanvas.height=ch;playCanvas.width=cw;playCanvas.height=ch;
  const c=playCanvas.getContext('2d',{alpha:false,desynchronized:true});c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
}
function activeClaimsAt(t){
  const out=[];for(let i=0;i<claimSegments.length;i++){const s=claimSegments[i];if(!s.enabled)continue;if(t>=s.start-.05&&t<=s.end+.15)out.push(s);if(s.start>t+.15)break}return out
}
function drawCurrentFrame(){
  if(!sourceVideo.videoWidth)return;if(!playCanvas.width)setupRenderCanvas();
  const c=playCanvas.getContext('2d',{alpha:false,desynchronized:true}),w=playCanvas.width,h=playCanvas.height;
  c.drawImage(sourceVideo,0,0,w,h);
  const t=sourceVideo.currentTime;for(const s of activeClaimsAt(t))drawClaim(c,w,h,s,t);
}
function theme(){
  const key=styleSelect.value;
  if(cachedThemeKey===key&&window.__autoTheme)return window.__autoTheme;
  window.__autoTheme={cinematic:{panel:'rgba(4,9,19,.88)',line:'rgba(126,193,255,.45)',text:'#f3f8ff',accent:'#79c0ff',muted:'#9bb4cf'},minimal:{panel:'rgba(6,10,15,.9)',line:'rgba(255,255,255,.34)',text:'#fff',accent:'#fff',muted:'#b9c2ce'},hud:{panel:'rgba(2,9,18,.86)',line:'rgba(77,221,255,.72)',text:'#dffbff',accent:'#4ddfff',muted:'#83a7b5'}}[key];cachedThemeKey=key;return window.__autoTheme
}
function ease(p){p=Math.max(0,Math.min(1,p));return 1-Math.pow(1-p,3)}
function panel(c,x,y,w,h,r,fill,stroke){c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();c.strokeStyle=stroke;c.lineWidth=1.2;c.stroke()}
function drawClaim(c,w,h,s,t){
  const th=theme(),elapsed=t-s.start,dur=Math.max(.9,s.end-s.start);let p=ease(Math.min(1,elapsed/.55));
  const outP=Math.max(0,Math.min(1,(dur-elapsed+.2)/.45)),alpha=Math.min(p,outP);if(alpha<=0)return;
  c.save();c.globalAlpha=alpha;
  let pos=positionSelect.value==='auto'?((s.type==='ratio'||s.type==='percentage')?'right':'left'):positionSelect.value;
  const pw=Math.min(w*.72,Math.max(300,w*.54)),ph=Math.min(178,Math.max(112,h*.2));let x=w*.04;if(pos==='right')x=w-pw-w*.04;if(pos==='center')x=(w-pw)/2;
  const y=h*.12,dx=(pos==='right'?1:-1)*(1-p)*52;panel(c,x+dx,y,pw,ph,20,th.panel,th.line);
  c.fillStyle=th.accent;c.fillRect(x+dx+18,y+10,38,3);c.textAlign='left';c.textBaseline='alphabetic';
  c.fillStyle=th.muted;c.font=`700 ${Math.max(11,Math.round(h*.016))}px system-ui`;c.fillText(typeLabel(s).toUpperCase(),x+dx+18,y+28);
  c.fillStyle=th.text;c.font=`850 ${Math.max(26,Math.round(ph*.31))}px system-ui`;c.fillText(s.headline,x+dx+18,y+73);
  c.fillStyle=th.muted;c.font=`550 ${Math.max(10,Math.round(h*.014))}px system-ui`;c.fillText(s.detail.length>56?s.detail.slice(0,55).trim()+'…':s.detail,x+dx+18,y+99);
  drawViz(c,x+dx+18,y+112,pw-36,ph-124,s,th,p);
  c.restore();
}
function drawViz(c,x,y,w,h,s,th,p){
  const ly=y+h*.5;
  if(s.type==='ratio'){
    const bw=w-92,bx=x+46,max=Math.max(1,s.value),a=Math.max(18,bw*Math.min(1,1/max)),b=Math.max(26,bw*Math.min(1,s.value/max));
    c.fillStyle='rgba(255,255,255,.12)';c.fillRect(bx,ly-16,bw,10);c.fillRect(bx,ly+11,bw,10);
    c.fillStyle='rgba(255,255,255,.62)';c.fillRect(bx,ly-16,a*p,10);c.fillStyle=th.accent;c.fillRect(bx,ly+11,b*p,10);
    c.fillStyle=th.muted;c.font='600 11px system-ui';c.textAlign='right';c.fillText('1×',bx-8,ly-8);c.fillText(trimNum(s.value)+'×',Math.min(x+w,bx+b+8),ly+19)
  }else if(s.type==='percentage'){
    const r=Math.min(32,h*.42),cx=x+r+4,cy=y+h*.5;c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);c.strokeStyle='rgba(255,255,255,.12)';c.lineWidth=8;c.stroke();c.beginPath();c.arc(cx,cy,r,-Math.PI/2,-Math.PI/2+Math.PI*2*(s.value/100)*p);c.strokeStyle=th.accent;c.lineWidth=8;c.lineCap='round';c.stroke();c.fillStyle=th.muted;c.font='600 11px system-ui';c.textAlign='left';c.fillText('0%',cx+r+16,cy-5);c.fillText('100%',cx+r+16,cy+12)
  }else if(s.type==='distance'){
    const sy=ly,len=(w-32)*p;c.strokeStyle='rgba(255,255,255,.2)';c.lineWidth=2;c.beginPath();c.moveTo(x+8,sy);c.lineTo(x+w-8,sy);c.stroke();c.strokeStyle=th.accent;c.lineWidth=3;c.beginPath();c.moveTo(x+8,sy);c.lineTo(x+8+len,sy);c.stroke();c.fillStyle=th.accent;c.beginPath();c.arc(x+8+len,sy,5,0,Math.PI*2);c.fill();c.fillStyle=th.muted;c.font='600 10px system-ui';c.textAlign='left';c.fillText('ponto A',x+4,sy+19);c.textAlign='right';c.fillText('ponto B',x+w-5,sy+19)
  }else if(s.type==='temperature'){
    const min=-200,max=1200,v=Math.max(min,Math.min(max,s.value)),q=(v-min)/(max-min),len=(w-16)*q*p;c.fillStyle='rgba(255,255,255,.11)';c.fillRect(x+8,ly-5,w-16,10);c.fillStyle=th.accent;c.fillRect(x+8,ly-5,len,10);c.fillStyle=th.accent;c.beginPath();c.arc(x+8+len,ly,6,0,Math.PI*2);c.fill();c.fillStyle=th.muted;c.font='600 10px system-ui';c.textAlign='left';c.fillText(`${min}°`,x+8,ly+20);c.textAlign='right';c.fillText(`${max}°`,x+w-8,ly+20)
  }else if(s.type==='speed'){
    const r=Math.min(34,h*.45),cx=x+r+8,cy=ly;c.beginPath();c.arc(cx,cy,r,Math.PI,Math.PI*2);c.strokeStyle='rgba(255,255,255,.12)';c.lineWidth=8;c.stroke();c.beginPath();c.arc(cx,cy,r,Math.PI,Math.PI+Math.PI*p);c.strokeStyle=th.accent;c.lineWidth=8;c.stroke();c.fillStyle=th.muted;c.font='600 10px system-ui';c.textAlign='left';c.fillText('velocidade',x+r*2+16,cy+4)
  }else if(s.type==='time'||s.type==='timeScale'){
    const len=(w-28)*p;c.strokeStyle='rgba(255,255,255,.16)';c.lineWidth=2;c.beginPath();c.moveTo(x+8,ly);c.lineTo(x+w-8,ly);c.stroke();c.strokeStyle=th.accent;c.lineWidth=3;c.beginPath();c.moveTo(x+8,ly);c.lineTo(x+8+len,ly);c.stroke();
    c.fillStyle='rgba(255,255,255,.28)';for(let i=0;i<5;i++){const xx=x+8+(w-16)*i/4;c.fillRect(xx,ly-5,1,10)}c.fillStyle=th.muted;c.font='600 10px system-ui';c.textAlign='left';c.fillText('passado',x+8,ly+20);c.textAlign='right';c.fillText('presente',x+w-8,ly+20)
  }else{const len=Math.min(w-16,w*.65*p);c.fillStyle='rgba(255,255,255,.11)';c.fillRect(x+8,ly-5,w-16,10);c.fillStyle=th.accent;c.fillRect(x+8,ly-5,len,10)}
}

async function extractAudioLocal(file,onProgress=()=>{}){
  onProgress(10);const ab=await file.arrayBuffer();onProgress(35);const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw new Error('Seu navegador não oferece Web Audio.');const ctx=new AC();
  try{const decoded=await ctx.decodeAudioData(ab.slice(0));onProgress(65);const rate=16000,count=Math.max(1,Math.ceil(decoded.duration*rate)),OC=window.OfflineAudioContext||window.webkitOfflineAudioContext;if(!OC)throw new Error('Seu navegador não oferece OfflineAudioContext.');const off=new OC(1,count,rate),src=off.createBufferSource();src.buffer=decoded;src.connect(off.destination);src.start(0);const rendered=await off.startRendering();onProgress(90);return new Float32Array(rendered.getChannelData(0))}finally{try{await ctx.close()}catch{}}
}
async function canUseWebGPU(){try{return !!(navigator.gpu&&await navigator.gpu.requestAdapter({powerPreference:'low-power'}))}catch{return false}}
async function getWhisper(){
  if(whisperPipe)return whisperPipe;
  const mod=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm');const{pipeline,env}=mod;env.useBrowserCache=true;const webgpu=await canUseWebGPU();setProgress('Preparando Whisper (CPU)…',26,true);
  try{whisperPipe=await pipeline('automatic-speech-recognition','Xenova/whisper-tiny',{dtype:'q4',device:'wasm',progress_callback:i=>{if(i?.progress!=null){const p=Number(i.progress);if(Number.isFinite(p))setProgress('Baixando modelo Whisper…',26+Math.max(0,Math.min(1,p))*12)}}});whisperBackend='wasm';return whisperPipe}catch(cpuErr){if(!webgpu)throw new Error(`O Whisper não conseguiu iniciar neste celular.\n\n${cpuErr?.message||cpuErr}`);whisperPipe=await pipeline('automatic-speech-recognition','Xenova/whisper-tiny',{dtype:'q4',device:'webgpu'});whisperBackend='webgpu';return whisperPipe}
}

async function previewResult(){
  if(!sourceVideo.src||recording)return;
  stageHint.classList.add('hidden');
  sourceVideo.currentTime=0;
  try{sourceVideo.muted=false;await sourceVideo.play()}catch{sourceVideo.controls=true}
}

function nextVideoFrame(video,cb){
  if(typeof video.requestVideoFrameCallback==='function'){const id=video.requestVideoFrameCallback((_,meta)=>cb(meta.mediaTime));return()=>{try{video.cancelVideoFrameCallback?.(id)}catch{}}}
  const id=requestAnimationFrame(()=>cb(video.currentTime));return()=>cancelAnimationFrame(id)
}

async function exportWebM(){
  if(!claimSegments.length){alert('Nenhuma visualização foi detectada.');return}
  if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream){alert('Seu navegador não oferece gravação do canvas. Use Chrome/Edge no Android.');return}
  recording=true;cancelRequested=false;exportBtn.disabled=true;previewBtn.disabled=true;cancelExportBtn.classList.remove('hidden');mp4Btn.classList.add('hidden');downloadWebm.classList.add('hidden');
  setStatus('Renderizando em modo otimizado…');setProgress(`Renderizando a ${RENDER_FPS} FPS…`,0,true);setupRenderCanvas();
  const ctx=playCanvas.getContext('2d',{alpha:false,desynchronized:true});
  const stream=playCanvas.captureStream(RENDER_FPS);const ms=sourceVideo.captureStream?sourceVideo.captureStream():null;if(ms)ms.getAudioTracks().forEach(t=>stream.addTrack(t));
  const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(x=>MediaRecorder.isTypeSupported(x));
  if(!mime){stream.getTracks().forEach(t=>t.stop());recording=false;exportBtn.disabled=false;previewBtn.disabled=false;cancelExportBtn.classList.add('hidden');alert('Este navegador não consegue exportar WebM.');return}
  const area=playCanvas.width*playCanvas.height,bitrate=area>=1500000?9000000:6500000;
  let rec=null,parts=[];
  try{
    rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:bitrate,audioBitsPerSecond:128000});
    rec.ondataavailable=e=>{if(e.data.size)parts.push(e.data)};
    const done=new Promise(resolve=>{rec.onstop=resolve});
    sourceVideo.currentTime=0;sourceVideo.muted=true;
    try{await sourceVideo.play()}catch(e){throw new Error('O navegador bloqueou a reprodução para renderização. Toque em Pré-visualizar uma vez e tente exportar novamente.')}
    rec.start(1000);

    await new Promise(resolve=>{
      let lastDrawTime=-1,lastUi=0,finished=false;
      const finish=()=>{if(finished)return;finished=true;resolve()};
      const requestNext=cb=>{
        if(typeof sourceVideo.requestVideoFrameCallback==='function')sourceVideo.requestVideoFrameCallback((_,meta)=>cb(meta.mediaTime));
        else requestAnimationFrame(()=>cb(sourceVideo.currentTime));
      };
      const frame=(mediaTime)=>{
        if(!recording||cancelRequested||sourceVideo.ended){finish();return}
        const t=Number.isFinite(mediaTime)?mediaTime:sourceVideo.currentTime;
        const minStep=1/RENDER_FPS;
        if(lastDrawTime<0||t-lastDrawTime>=minStep-.002){
          ctx.drawImage(sourceVideo,0,0,playCanvas.width,playCanvas.height);
          for(const s of activeClaimsAt(t))drawClaim(ctx,playCanvas.width,playCanvas.height,s,t);
          lastDrawTime=t;
        }
        const now=performance.now();
        if(now-lastUi>250){lastUi=now;setProgress('Renderizando vídeo no celular…',sourceVideo.duration?Math.min(99.5,t/sourceVideo.duration*100):0,true)}
        if(sourceVideo.duration&&t>=sourceVideo.duration-.04){finish();return}
        requestNext(frame)
      };
      requestNext(frame);
    });

    if(rec.state==='recording')rec.stop();
    await done;
    sourceVideo.pause();sourceVideo.muted=false;
    stream.getTracks().forEach(t=>t.stop());
    recording=false;cancelExportBtn.classList.add('hidden');
    if(cancelRequested){setStatus('Renderização interrompida');setProgress('Renderização interrompida',0,true);return}
    setProgress('Finalizando arquivo…',99.7,true);
    await new Promise(r=>setTimeout(r,60));
    lastBlob=new Blob(parts,{type:'video/webm'});revokeURL(lastWebmURL);lastWebmURL=URL.createObjectURL(lastBlob);downloadWebm.href=lastWebmURL;downloadWebm.classList.remove('hidden');mp4Btn.classList.remove('hidden');setProgress('WebM pronto',100,true);setStatus('WebM pronto');
  }catch(e){
    console.error(e);cancelRequested=true;setStatus('Renderização falhou');alert(`A renderização não pôde ser concluída.\n\n${e?.message||e}`);
  }finally{
    if(rec&&rec.state==='recording'){try{rec.stop()}catch{}}
    stream.getTracks().forEach(t=>t.stop());
    try{sourceVideo.pause()}catch{}
    sourceVideo.muted=false;recording=false;cancelExportBtn.classList.add('hidden');exportBtn.disabled=false;previewBtn.disabled=false;
    if(!lastBlob&&cancelRequested&&statusPill.textContent!=='Renderização falhou')setStatus('Renderização interrompida');
    if(statusPill.textContent==='Renderização falhou')clearProgress();else setTimeout(clearProgress,900);
  }
}

async function loadFFmpeg(onProgress){
  if(ffmpeg?.isLoaded())return ffmpeg;if(ffmpegLoadPromise)return ffmpegLoadPromise;
  ffmpegLoadPromise=(async()=>{if(!window.FFmpeg)await loadScript('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js');const{createFFmpeg}=window.FFmpeg;ffmpeg=createFFmpeg({log:false,corePath:'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.6/dist/ffmpeg-core.js',progress:({ratio})=>onProgress?.((Number(ratio)||0)*100)});await ffmpeg.load();return ffmpeg})();
  try{return await ffmpegLoadPromise}catch(e){ffmpegLoadPromise=null;ffmpeg=null;throw e}
}
function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.async=true;s.onload=res;s.onerror=()=>rej(new Error('Falha ao carregar '+src));document.head.appendChild(s)})}
async function convertMp4(){
  if(!lastBlob)return;mp4Btn.disabled=true;setStatus('Convertendo para MP4…');setProgress('Carregando conversor…',5,true);
  try{const fm=await loadFFmpeg(p=>setProgress('Convertendo…',p,true)),F=window.FFmpeg;await fm.FS('writeFile','automotion.webm',await F.fetchFile(lastBlob));await fm.run('-i','automotion.webm','-c:v','libx264','-preset','ultrafast','-crf','29','-c:a','aac','-b:a','96k','-movflags','+faststart','automotion.mp4');const data=fm.FS('readFile','automotion.mp4');revokeURL(lastMp4URL);lastMp4URL=URL.createObjectURL(new Blob([data.buffer],{type:'video/mp4'}));downloadMp4.href=lastMp4URL;downloadMp4.classList.remove('hidden');setProgress('MP4 pronto',100,true);setStatus('MP4 pronto');try{fm.FS('unlink','automotion.webm');fm.FS('unlink','automotion.mp4')}catch{}}
  catch(e){console.error(e);alert('A conversão para MP4 falhou. O WebM continua disponível.');setStatus('WebM pronto');clearProgress()}
  finally{mp4Btn.disabled=false}
}

window.addEventListener('beforeunload',()=>{revokeURL(videoURL);revokeURL(lastWebmURL);revokeURL(lastMp4URL)});
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js?v=8').catch(()=>{});
