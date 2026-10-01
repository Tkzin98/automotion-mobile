const $ = (id) => document.getElementById(id);

const videoInput = $('videoInput');
const sourceVideo = $('sourceVideo');
const renderCanvas = $('renderCanvas');
const playCanvas = $('playCanvas');
const analyzeBtn = $('analyzeBtn');
const exportBtn = $('exportBtn');
const previewBtn = $('previewBtn');
const mp4Btn = $('mp4Btn');
const downloadWebm = $('downloadWebm');
const downloadMp4 = $('downloadMp4');
const statusPill = $('statusPill');
const progressArea = $('progressArea');
const progressBar = $('progressBar');
const progressLabel = $('progressLabel');
const progressValue = $('progressValue');
const resultCard = $('resultCard');
const segmentList = $('segmentList');
const segmentCount = $('segmentCount');
const topicTag = $('topicTag');
const videoMeta = $('videoMeta');
const stageHint = $('stageHint');
const styleSelect = $('styleSelect');
const positionSelect = $('positionSelect');

let videoURL = '';
let currentVideoFile = null;
let wordChunks = [];
let motionSegments = [];
let whisperPipe = null;
let whisperBackend = 'wasm';
let ffmpeg = null;
let recording = false;
let lastBlob = null;
let ffmpegLoadPromise = null;

const TOPICS = [
  { key:'finanças', icon:'₿', words:['dinheiro','financ','invest','salário','salario','lucro','renda','juros','ação','acoes','ações','bolsa','banco','milion','pobre','riqueza','orçamento','credito','crédito','dívida','divida'] },
  { key:'redes sociais', icon:'♥', words:['instagram','tiktok','youtube','whatsapp','twitter','x.com','seguidor','seguidores','viral','post','influenc','social','likes','curtidas'] },
  { key:'tecnologia', icon:'⌁', words:['tecnologia','program','código','codigo','software','app','aplicativo','ia ','inteligência artificial','inteligencia artificial','computador','celular','cpu','gpu','internet','site','web'] },
  { key:'games', icon:'◇', words:['jogo','games','game','gamer','godot','unity','minecraft','fortnite','playstation','xbox'] },
  { key:'música', icon:'♪', words:['música','musica','trap','beat','rap','cantor','artista','álbum','album','som'] },
  { key:'fitness', icon:'✚', words:['treino','academia','músculo','musculo','proteína','proteina','corrida','exercício','exercicio','fitness'] },
  { key:'educação', icon:'✎', words:['estudar','estudo','prova','escola','faculdade','aprender','curso','aula','professor','educação','educacao'] },
  { key:'viagem', icon:'✈', words:['viagem','viajar','viagem','hotel','avião','aviao','praia','cidade','turismo'] }
];

function setStatus(text){ statusPill.textContent = text; }
function setProgress(label, value){
  progressArea.classList.remove('hidden');
  progressLabel.textContent = label;
  const v = Math.max(0, Math.min(100, Math.round(value)));
  progressValue.textContent = `${v}%`;
  progressBar.style.width = `${v}%`;
}
function clearProgress(){ progressArea.classList.add('hidden'); progressBar.style.width='0%'; }
function fmtTime(s){
  s = Number.isFinite(s) ? s : 0;
  const m = Math.floor(s/60);
  const sec = Math.floor(s%60).toString().padStart(2,'0');
  return `${m}:${sec}`;
}
function escapeHTML(s){
  return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

videoInput.addEventListener('change', () => {
  const file = videoInput.files?.[0];
  if (!file) return;
  currentVideoFile = file;
  if (videoURL) URL.revokeObjectURL(videoURL);
  videoURL = URL.createObjectURL(file);
  sourceVideo.src = videoURL;
  $('previewWrap').classList.remove('hidden');
  analyzeBtn.disabled = false;
  resultCard.classList.add('hidden');
  downloadWebm.classList.add('hidden');
  mp4Btn.classList.add('hidden');
  downloadMp4.classList.add('hidden');
  videoMeta.textContent = `${file.name} • ${(file.size/1024/1024).toFixed(1)} MB`;
  setStatus('Vídeo carregado');
});

sourceVideo.addEventListener('loadedmetadata', () => {
  const w = sourceVideo.videoWidth, h = sourceVideo.videoHeight;
  const duration = sourceVideo.duration;
  videoMeta.textContent = `${currentVideoFile?.name ?? 'Vídeo'} • ${w}×${h} • ${fmtTime(duration)}`;
  if (Number.isFinite(duration) && duration > 180) {
    setStatus('Vídeo longo — pode exigir mais memória');
  }
});

analyzeBtn.addEventListener('click', analyzeVideo);
previewBtn.addEventListener('click', previewResult);
exportBtn.addEventListener('click', exportWebM);
mp4Btn.addEventListener('click', convertMp4);

async function analyzeVideo(){
  if (!currentVideoFile) return;
  analyzeBtn.disabled = true;
  exportBtn.disabled = true;
  setStatus('Analisando…');
  try{
    wordChunks = [];
    motionSegments = [];
    setProgress('Preparando áudio no celular…', 5);
    const wavBlob = await extractAudioLocal(currentVideoFile, (pct) => {
      setProgress('Preparando áudio no celular…', 5 + pct * 15);
    });
    setProgress('Carregando Whisper…', 25);
    const pipe = await getWhisper();
    setProgress(`Transcrevendo áudio (${whisperBackend.toUpperCase()})…`, 38);
    const result = await pipe(wavBlob, {
      language: 'pt',
      task: 'transcribe',
      return_timestamps: 'word',
      chunk_length_s: 30,
      stride_length_s: 5
    });
    wordChunks = normalizeChunks(result?.chunks || []);
    setProgress('Criando motions…', 88);
    motionSegments = buildMotionSegments(wordChunks);
    renderSegmentList();
    setupRenderCanvas();
    resultCard.classList.remove('hidden');
    setProgress('Finalizado', 100);
    setStatus(`${motionSegments.length} motions prontos • Whisper ${whisperBackend.toUpperCase()}`);
    setTimeout(clearProgress, 900);
    drawCurrentFrame();
  }catch(err){
    console.error(err);
    setStatus('Erro');
    alert(`Não foi possível analisar este vídeo.\n\n${err?.message || err}\n\nDica: teste primeiro um vídeo curto (10–30 s) no Chrome Android.`);
    clearProgress();
  }finally{
    analyzeBtn.disabled = false;
    exportBtn.disabled = false;
  }
}

function normalizeChunks(chunks){
  return chunks.map(c => {
    let [start,end] = c.timestamp || [0,0];
    if (!Number.isFinite(end)) end = start + 0.5;
    if (!Number.isFinite(start)) start = 0;
    return { start, end: Math.max(end,start+0.08), text: String(c.text || '').trim() };
  }).filter(c => c.text);
}

function classify(text){
  const t = ` ${text.toLowerCase()} `;
  let best = {key:'geral', icon:'✦', score:0};
  for(const topic of TOPICS){
    let score = 0;
    for(const w of topic.words){ if(t.includes(w)) score += w.length > 6 ? 2 : 1; }
    if(score > best.score) best = {key:topic.key, icon:topic.icon, score};
  }
  return best;
}

function buildMotionSegments(chunks){
  if (!chunks.length) return [];
  const result = [];
  let bucket = [];
  let bucketStart = chunks[0].start;
  for(let i=0;i<chunks.length;i++){
    const c = chunks[i];
    if (!bucket.length) bucketStart = c.start;
    bucket.push(c);
    const text = bucket.map(x=>x.text).join(' ').trim();
    const last = i === chunks.length-1;
    const longEnough = (c.end - bucketStart) >= 1.35;
    const manyWords = bucket.length >= 7;
    const punctuation = /[.!?]$/.test(c.text);
    if(last || longEnough || manyWords || punctuation){
      const topic = classify(text);
      result.push({start:bucketStart,end:Math.max(c.end,bucketStart+.9),text,topic,position:i%2===0?'left':'right'});
      bucket = [];
    }
  }
  return result.filter(x=>x.text.length>2).slice(0,120);
}

function renderSegmentList(){
  segmentList.innerHTML='';
  segmentCount.textContent = `${motionSegments.length} cards`;
  const top = classify(wordChunks.map(x=>x.text).join(' '));
  topicTag.textContent = top.key === 'geral' ? 'Analisado' : `Tema: ${top.key}`;
  motionSegments.forEach((s, idx)=>{
    const row = document.createElement('div');
    row.className='segment';
    row.innerHTML = `<div class="segment-time">${fmtTime(s.start)} → ${fmtTime(s.end)}</div><div class="segment-text">${escapeHTML(s.text)}</div><div class="segment-cat">${s.topic.icon} ${escapeHTML(s.topic.key)}</div>`;
    row.addEventListener('click',()=>{sourceVideo.currentTime=s.start; sourceVideo.pause(); drawCurrentFrame();});
    segmentList.appendChild(row);
  });
}

async function loadFFmpeg(onProgress){
  if(ffmpeg?.isLoaded()) return ffmpeg;
  if(ffmpegLoadPromise) return ffmpegLoadPromise;
  ffmpegLoadPromise = (async () => {
    setProgress('Baixando FFmpeg para conversão MP4…', 5);
    if(!window.FFmpeg){
      await loadScript('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js');
    }
    const {createFFmpeg} = window.FFmpeg;
    ffmpeg = createFFmpeg({
      log:false,
      corePath:'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.6/dist/ffmpeg-core.js',
      progress: ({ratio}) => {
        const pct = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) * 100 : 0;
        if(onProgress) onProgress(pct);
        else setProgress('Carregando FFmpeg…', pct);
      }
    });
    await ffmpeg.load();
    return ffmpeg;
  })();
  try { return await ffmpegLoadPromise; }
  catch (err) { ffmpegLoadPromise = null; ffmpeg = null; throw err; }
}

function loadScript(src){
  return new Promise((resolve,reject)=>{
    const s = document.createElement('script'); s.src=src; s.async=true;
    s.onload=resolve; s.onerror=()=>reject(new Error(`Falha ao carregar ${src}`));
    document.head.appendChild(s);
  });
}

async function extractAudioLocal(file, onProgress = () => {}){
  // Analysis does NOT need FFmpeg. Decode the video's audio using the browser's
  // native media codecs, then resample to 16 kHz mono WAV for Whisper.
  onProgress(10);
  const arrayBuffer = await file.arrayBuffer();
  onProgress(35);
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if(!AudioCtx) throw new Error('Seu navegador não oferece Web Audio para analisar o áudio.');
  const ctx = new AudioCtx();
  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    onProgress(65);
    const targetRate = 16000;
    const duration = decoded.duration;
    const frameCount = Math.max(1, Math.ceil(duration * targetRate));
    const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if(!OfflineCtx) throw new Error('Seu navegador não oferece OfflineAudioContext.');
    const offline = new OfflineCtx(1, frameCount, targetRate);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start(0);
    const rendered = await offline.startRendering();
    onProgress(85);
    const samples = new Float32Array(rendered.getChannelData(0));
    onProgress(100);
    return samples;
  } finally {
    try { await ctx.close(); } catch {}
  }
}

async function canUseWebGPU(){
  try{
    if(!navigator.gpu || typeof navigator.gpu.requestAdapter !== 'function') return false;
    const adapter = await navigator.gpu.requestAdapter({powerPreference:'low-power'});
    return !!adapter;
  }catch(e){
    console.warn('WebGPU indisponível; usando WASM/CPU.', e);
    return false;
  }
}

async function getWhisper(){
  if(whisperPipe) return whisperPipe;
  const mod = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm');
  const {pipeline, env} = mod;
  env.useBrowserCache = true;

  // No celular, navigator.gpu pode existir mesmo quando o Chrome não consegue
  // obter um adaptador. Por isso testamos requestAdapter() antes de selecionar WebGPU.
  const webgpu = await canUseWebGPU();

  const modelOptions = {
    dtype:'q4',
    device:'wasm',
    progress_callback: (info) => {
      if (info?.progress != null) {
        const pct = Number(info.progress);
        const value = Number.isFinite(pct) ? Math.max(26, Math.min(37, 26 + pct * 0.12)) : 30;
        setProgress('Baixando modelo Whisper…', value);
      } else if (info?.status) {
        setProgress(String(info.status), 30);
      }
    }
  };

  setProgress('Preparando Whisper (CPU)…', 26);
  try {
    whisperPipe = await pipeline('automatic-speech-recognition','Xenova/whisper-tiny', modelOptions);
    whisperBackend = 'wasm';
    return whisperPipe;
  } catch (cpuErr) {
    console.warn('Whisper em WASM falhou. Tentando WebGPU como fallback.', cpuErr);
    if (!webgpu) throw new Error(`O Whisper não conseguiu iniciar neste celular.

${cpuErr?.message || cpuErr}`);
    setProgress('Preparando Whisper (GPU)…', 30);
    try {
      whisperPipe = await pipeline('automatic-speech-recognition','Xenova/whisper-tiny',{
        dtype:'q4',
        device:'webgpu',
        progress_callback: (info) => {
          if (info?.progress != null) {
            const pct = Number(info.progress);
            if (Number.isFinite(pct)) setProgress('Baixando modelo Whisper…', 26 + Math.max(0, Math.min(1, pct)) * 12);
          }
        }
      });
      whisperBackend = 'webgpu';
      return whisperPipe;
    } catch (gpuErr) {
      throw new Error(`Não foi possível iniciar o Whisper.

CPU: ${cpuErr?.message || cpuErr}

GPU: ${gpuErr?.message || gpuErr}`);
    }
  }
}

function setupRenderCanvas(){
  const w = sourceVideo.videoWidth || 720, h = sourceVideo.videoHeight || 1280;
  const scale = Math.min(1, 960 / Math.max(w,h));
  const cw = Math.max(320, Math.round(w*scale));
  const ch = Math.max(320, Math.round(h*scale));
  renderCanvas.width=cw; renderCanvas.height=ch;
  playCanvas.width=cw; playCanvas.height=ch;
}

sourceVideo.addEventListener('timeupdate', drawCurrentFrame);
sourceVideo.addEventListener('seeked', drawCurrentFrame);

function getActiveSegment(t){ return motionSegments.find(s=>t>=s.start && t<=s.end) || null; }

function drawCurrentFrame(){
  if(!sourceVideo.videoWidth) return;
  if(!renderCanvas.width) setupRenderCanvas();
  const ctx = playCanvas.getContext('2d');
  const rw = renderCanvas.width, rh = renderCanvas.height;
  ctx.clearRect(0,0,rw,rh);
  ctx.drawImage(sourceVideo,0,0,rw,rh);
  drawMotions(ctx,rw,rh,sourceVideo.currentTime);
}

function drawMotions(ctx,w,h,t){
  const seg = getActiveSegment(t);
  if(!seg) return;
  let pos = positionSelect.value;
  if(pos==='auto') pos = seg.position;
  const style = styleSelect.value;
  const theme = {
    neon:{fill:'rgba(19,12,29,.92)',stroke:'rgba(192,132,252,.9)',text:'#fff',accent:'#c084fc'},
    clean:{fill:'rgba(8,8,10,.88)',stroke:'rgba(255,255,255,.62)',text:'#fff',accent:'#fff'},
    bold:{fill:'rgba(245,245,245,.96)',stroke:'rgba(245,245,245,.96)',text:'#0a0910',accent:'#0a0910'}
  }[style];
  const pad = Math.max(14,Math.round(w*.028));
  const cardW = Math.min(w*.74, 420);
  const cardH = Math.max(66, Math.min(90, h*.09));
  const x = pos==='left' ? pad : w-cardW-pad;
  const baseY = h*.20;
  const p = Math.min(1,Math.max(0,(t-seg.start)/0.35));
  const eased = 1 - Math.pow(1-p,3);
  const dx = (pos==='left'?-1:1) * (1-eased) * 40;
  const alpha = eased;
  ctx.save();
  ctx.globalAlpha=alpha;
  roundRect(ctx,x+dx,baseY,cardW,cardH,18,theme.fill,theme.stroke);
  // Icon badge
  const r = cardH*.31;
  ctx.fillStyle=theme.accent;
  ctx.beginPath();ctx.arc(x+dx+pad+r,baseY+cardH/2,r,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=style==='bold'?'#fff':'#10091a';
  ctx.font=`700 ${Math.round(r*1.0)}px system-ui`;
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(seg.topic.icon,x+dx+pad+r,baseY+cardH/2+1);
  // Text
  const tx = x+dx+pad+r*2+9;
  const maxW = cardW-pad-r*2-15;
  const label = compactLabel(seg.text);
  ctx.fillStyle=theme.text;
  ctx.textAlign='left';ctx.textBaseline='middle';ctx.font=`800 ${Math.max(13,Math.round(cardH*.22))}px system-ui`;
  ctx.fillText(label,tx,baseY+cardH*.43,maxW);
  ctx.fillStyle=theme.accent;ctx.font=`600 ${Math.max(9,Math.round(cardH*.12))}px system-ui`;
  ctx.fillText(seg.topic.key.toUpperCase(),tx,baseY+cardH*.70,maxW);
  // small pulse line
  const pulse = 0.5 + 0.5*Math.sin(t*7);
  ctx.globalAlpha = alpha*(.55+.45*pulse);
  ctx.fillStyle=theme.accent;
  ctx.fillRect(x+dx+cardW-22,baseY+cardH-12,8,3);
  ctx.restore();
}

function compactLabel(text){
  const clean=text.replace(/\s+/g,' ').trim();
  if(clean.length<=38) return clean;
  return `${clean.slice(0,35).trim()}…`;
}

function roundRect(ctx,x,y,w,h,r,fill,stroke){
  ctx.beginPath();
  ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
  ctx.fillStyle=fill;ctx.fill();ctx.lineWidth=1.4;ctx.strokeStyle=stroke;ctx.stroke();
}

async function previewResult(){
  if(!sourceVideo.src || recording) return;
  stageHint.classList.add('hidden');
  sourceVideo.currentTime=0;
  try{ await sourceVideo.play(); }catch{
    sourceVideo.controls=true;
  }
}

async function exportWebM(){
  if(!motionSegments.length){ alert('Analise o vídeo primeiro.'); return; }
  if(!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream){
    alert('Este navegador não oferece gravação do canvas. Use Chrome/Edge no Android.');
    return;
  }
  recording=true;
  exportBtn.disabled=true;
  previewBtn.disabled=true;
  mp4Btn.classList.add('hidden');
  downloadWebm.classList.add('hidden');
  setStatus('Renderizando…');
  setProgress('Renderizando vídeo no celular…',0);

  setupRenderCanvas();
  const ctx = playCanvas.getContext('2d');
  const canvasStream = playCanvas.captureStream(30);
  const mediaStream = sourceVideo.captureStream ? sourceVideo.captureStream() : null;
  if(mediaStream){ mediaStream.getAudioTracks().forEach(track=>canvasStream.addTrack(track)); }
  const mime = ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(x=>MediaRecorder.isTypeSupported(x));
  if(!mime){ alert('O navegador não consegue exportar WebM.'); recording=false; exportBtn.disabled=false; previewBtn.disabled=false; return; }
  const recorder = new MediaRecorder(canvasStream,{mimeType:mime,videoBitsPerSecond:5_000_000});
  const chunks=[];
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  const done = new Promise(resolve=>recorder.onstop=resolve);
  sourceVideo.currentTime=0;
  sourceVideo.muted=true;
  await sourceVideo.play();
  recorder.start(500);

  await new Promise(resolve=>{
    const tick=()=>{
      if(!recording){ sourceVideo.pause(); resolve(); return; }
      const t=sourceVideo.currentTime;
      ctx.clearRect(0,0,playCanvas.width,playCanvas.height);
      ctx.drawImage(sourceVideo,0,0,playCanvas.width,playCanvas.height);
      drawMotions(ctx,playCanvas.width,playCanvas.height,t);
      setProgress('Renderizando vídeo no celular…', sourceVideo.duration ? t/sourceVideo.duration*100 : 0);
      if(sourceVideo.ended || (sourceVideo.duration && t>=sourceVideo.duration-.05)){
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  recorder.stop();
  await done;
  sourceVideo.pause();
  sourceVideo.muted=false;
  recording=false;
  lastBlob = new Blob(chunks,{type:'video/webm'});
  const url = URL.createObjectURL(lastBlob);
  downloadWebm.href=url;
  downloadWebm.classList.remove('hidden');
  mp4Btn.classList.remove('hidden');
  setProgress('Concluído',100);
  setStatus('WebM pronto');
  exportBtn.disabled=false;previewBtn.disabled=false;
  setTimeout(clearProgress,900);
}

async function convertMp4(){
  if(!lastBlob) return;
  mp4Btn.disabled=true;
  setStatus('Convertendo para MP4…');
  setProgress('Carregando conversor…',5);
  try{
    const fm = await loadFFmpeg((pct) => setProgress('Baixando FFmpeg para conversão MP4…', pct));
    const {fetchFile} = window.FFmpeg;
    const inName='automotion.webm', outName='automotion.mp4';
    await fm.FS('writeFile',inName,await fetchFile(lastBlob));
    await fm.run('-i',inName,'-c:v','libx264','-preset','veryfast','-crf','28','-c:a','aac','-b:a','128k','-movflags','+faststart',outName);
    const data=fm.FS('readFile',outName);
    const blob=new Blob([data.buffer],{type:'video/mp4'});
    const url=URL.createObjectURL(blob);
    downloadMp4.href=url;
    downloadMp4.classList.remove('hidden');
    setProgress('MP4 pronto',100);
    setStatus('MP4 pronto');
    try{fm.FS('unlink',inName);fm.FS('unlink',outName);}catch{}
  }catch(err){
    console.error(err);
    alert('A conversão para MP4 falhou neste navegador. O WebM continua disponível e já está renderizado localmente.');
    setStatus('WebM pronto');
    clearProgress();
  }finally{
    mp4Btn.disabled=false;
  }
}

window.addEventListener('beforeunload',()=>{ if(videoURL) URL.revokeObjectURL(videoURL); });

if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
