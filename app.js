const MB_URL="https://esm.sh/mediabunny@1.61.0?bundle";
const HF_URLS=["https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0","https://esm.sh/@huggingface/transformers@4.3.0?bundle"];
const ORT_WASM="https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/";
let MB=null, HF=null;
async function loadMedia(){if(MB)return MB;status("Carregando motor de mídia",8,"Preparando o renderizador no navegador…");MB=await import(MB_URL);return MB}
async function loadAI(){
  if(HF)return HF;
  status("Preparando IA",22,"Carregando o motor Whisper no navegador…");
  let last=null;
  for(const src of HF_URLS){
    try{
      const mod=await import(src);
      const env=mod.env;
      env.allowLocalModels=false;
      env.allowRemoteModels=true;
      try{env.backends.onnx.wasm.wasmPaths=ORT_WASM}catch{}
      HF=mod;
      return HF;
    }catch(e){
      last=e;
      console.warn("Falha ao carregar Transformers.js:",src,e);
    }
  }
  throw last||new Error("Não foi possível carregar o motor de IA.");
}
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],MODEL="onnx-community/whisper-tiny";
let file=null,url=null,audioUrl=null,autoEdits=[],theme="cosmic",transcriber=null,currentRun=0;
const ICON={comparison:"↔",scale:"◉",percentage:"%",distance:"⌁",speed:"➜",duration:"◷",timeline:"╱",count:"#",temperature:"°",fact:"✦"};
const ENT=["sagitario a*","via lactea","andromeda","buraco negro","sistema solar","universo","supernova","nebulosa","estrela de neutrons","estrela","sol","jupiter","saturno","urano","netuno","marte","terra","venus","mercurio","lua","plutao","galaxia"];
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const norm=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim();
const tm=s=>{s=Math.max(0,Number(s)||0);return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`};
const toast=t=>{const x=$("#toast");x.textContent=t;x.classList.add("show");clearTimeout(x._t);x._t=setTimeout(()=>x.classList.remove("show"),2500)};
function num(s){const t=norm(s),m=t.match(/-?\d+(?:[.,]\d+)?/);if(!m)return null;let n=parseFloat(m[0].replace(",","."));if(/bilh(?:ao|oes)/.test(t))n*=1e9;else if(/milh(?:ao|oes)/.test(t))n*=1e6;else if(/\bmil\b/.test(t))n*=1e3;return n}
function showNum(n){if(!Number.isFinite(n))return"";if(Math.abs(n)>=1e9)return `${(n/1e9).toLocaleString("pt-BR",{maximumFractionDigits:2})} bi`;if(Math.abs(n)>=1e6)return `${(n/1e6).toLocaleString("pt-BR",{maximumFractionDigits:2})} mi`;if(Math.abs(n)>=1e3)return `${(n/1e3).toLocaleString("pt-BR",{maximumFractionDigits:2})} mil`;return n.toLocaleString("pt-BR",{maximumFractionDigits:2})}
function entities(t){const n=norm(t),f=[];for(const e of ENT)if(n.includes(e)&&!f.includes(e))f.push(e);return f.map(x=>x.replace(/(^|\s)\S/g,c=>c.toUpperCase()))}
function dur(s){if(s>=86400)return `${(s/86400).toLocaleString("pt-BR",{maximumFractionDigits:1})} dias`;if(s>=3600)return `${(s/3600).toLocaleString("pt-BR",{maximumFractionDigits:1})} h`;if(s>=60)return `${Math.floor(s/60)}m ${Math.round(s%60)}s`;return `${s.toLocaleString("pt-BR",{maximumFractionDigits:1})}s`}
function sentenceChunks(chunks){const out=[];for(const c of chunks||[]){const text=String(c?.text||"").trim();if(!text)continue;const ts=c.timestamp||[0,0],st=Number(ts[0])||0,en=Number.isFinite(Number(ts[1]))?Number(ts[1]):st+6;const re=/[^.!?]+[.!?]?/g;let m;while((m=re.exec(text))){const raw=m[0].trim();if(!raw)continue;const a=Math.max(0,st+(m.index/text.length)*(en-st)),b=Math.min(en,st+((m.index+raw.length)/text.length)*(en-st));out.push({text:raw,start:a,end:Math.max(a+1.1,b)})}}return out}
function claim(t){const raw=t.trim(),n=norm(raw),es=entities(raw);let m;
m=n.match(/(-?\d+(?:[.,]\d+)?)\s*%/);if(m)return{type:"percentage",value:num(m[1]),title:"Percentual",data:`${num(m[1])}%`,subtitle:es[0]||"Proporção"};
m=n.match(/(\d+(?:[.,]\d+)?)\s*vez(?:es)?\s*(?:maior|menor|o\s+tamanho|a\s+massa|mais|menos)?\s*(?:que|do que|da|de)?/);if(m){const v=num(m[1]),small=/menor|menos/.test(n.slice(m.index,m.index+m[0].length+10)),before=n.slice(0,m.index),after=n.slice(m.index+m[0].length),first=es[0]||entities(before)[0]||"Objeto",second=es[1]||entities(after)[0]||"Referência";return{type:"comparison",value:v,title:"Escala relativa",data:`${first}=${small?1:v};${second}=${small?v:1}`,subtitle:`${showNum(v)}×`}}
m=n.match(/(-?\d+(?:[.,]\d+)?)\s*(?:km\/s|km\s*\/\s*s|quilometros por segundo|metros por segundo|m\/s)/);if(m)return{type:"speed",value:num(m[1]),title:"Velocidade",data:`${showNum(num(m[1]))} km/s`,subtitle:es[0]||"Movimento"};
m=n.match(/(-?\d+(?:[.,]\d+)?)\s*(?:°\s*c|graus?\s*celsius|graus?)/);if(m&&(/temper|quente|frio|celsius/.test(n)))return{type:"temperature",value:num(m[1]),title:"Temperatura",data:`${num(m[1]).toLocaleString("pt-BR")} °C`,subtitle:es[0]||"Temperatura"};
m=n.match(/(-?\d+(?:[.,]\d+)?)\s*(milhoes?|milhao|bilhoes?|bilhao|mil)?\s*(?:de\s*)?(km|quilometros|anos-luz|anos luz)/);if(m){const v=num(`${m[1]} ${m[2]||""}`),u=/ano/.test(m[3])?"anos-luz":"km";return{type:"distance",value:v,title:"Distância",data:`${showNum(v)} ${u}`,subtitle:es.slice(0,2).join(" → ")||"Distância"}}
m=n.match(/leva(?:m)?\s+([\d.,]+)(?:\s*e\s*([\d.,]+))?\s*(segundos?|minutos?|horas?|dias?|anos?)/);if(m){const a=num(m[1])||0,b=m[2]?num(m[2]):0,u=norm(m[3]);const sec=a*(u.startsWith("ano")?31557600:u.startsWith("dia")?86400:u.startsWith("hora")?3600:u.startsWith("min")?60:1)+b;return{type:"duration",value:sec,title:"Tempo",data:dur(sec),subtitle:raw.slice(0,90)}}
m=n.match(/ha\s+(-?\d+(?:[.,]\d+)?)\s*(milhoes?|milhao|bilhoes?|bilhao|mil)?\s*de\s*anos?/);if(m){const v=num(`${m[1]} ${m[2]||""}`);return{type:"timeline",value:v,title:"Escala de tempo",data:`Há ${showNum(v)} anos`,subtitle:es[0]||"Universo"}}
m=n.match(/(?:tem|possui|cont(?:a|em)|cerca de|aproximadamente)\s+(\d+(?:[.,]\d+)?)\s*(milhoes?|milhao|bilhoes?|bilhao|mil)?\s*(luas?|planetas?|estrelas?|galaxias?|satelites?|objetos?)/);if(m){const v=num(`${m[1]} ${m[2]||""}`);return{type:"count",value:v,title:"Quantidade",data:`${showNum(v)} ${m[3]}`,subtitle:es[0]||"Quantidade"}}
m=n.match(/(-?\d+(?:[.,]\d+)?)\s*(massas?\s+solares?)/);if(m){const v=num(m[1]);return{type:"comparison",value:v,title:"Massa relativa",data:`Sol=1;${es[0]||"Objeto"}=${v}`,subtitle:`${showNum(v)} massas solares`}}
m=n.match(/\b\d+(?:[.,]\d+)?\b/);if(m&&es.length)return{type:"fact",value:num(m[0]),title:"Fato em destaque",data:m[0],subtitle:raw.slice(0,90)};return null}
function dedupe(xs){const o=[];for(const x of [...xs].sort((a,b)=>a.start-b.start)){const l=o[o.length-1];if(l&&norm(l.text)===norm(x.text))continue;if(l&&x.start<l.end+.45&&x.type!=="comparison"&&x.type!=="percentage")continue;o.push(x)}return o.slice(0,80)}
function setTheme(t){theme=t;$$('.theme-card').forEach(b=>b.classList.toggle("on",b.dataset.theme===t));document.documentElement.dataset.theme=t;drawPreview()}$$('.theme-card').forEach(b=>b.onclick=()=>setTheme(b.dataset.theme));
function status(label,p=0,detail=""){$("#aiStatus").classList.remove("hide");$("#aiLabel").textContent=label;$("#aiPct").textContent=`${Math.round(p)}%`;$("#aiBar").value=Math.max(0,Math.min(1,p/100));$("#aiDetail").textContent=detail}
function results(){const list=$("#autoList");$("#autoCount").textContent=`${autoEdits.length} visuais automáticos`;if(!autoEdits.length){list.innerHTML='<div class="empty big"><div class="emptyIcon">∿</div><b>Nenhum dado objetivo encontrado ainda.</b><small>O motor procura números, relações, distâncias, velocidades, temperaturas, tempos e quantidades na narração.</small></div>';return}list.innerHTML=autoEdits.map((e,i)=>`<article class="auto-item ${e.enabled===false?'off':''}"><button class="auto-toggle" data-i="${i}">${e.enabled===false?'○':'✓'}</button><div class="auto-icon">${ICON[e.type]}</div><div class="auto-main"><div class="auto-top"><b>${esc(e.title)}</b><span>${tm(e.start)} → ${tm(e.end)}</span></div><strong>${esc(e.data)}</strong><small>${esc(e.subtitle||e.text||"")}</small></div></article>`).join("");$$('.auto-toggle').forEach(b=>b.onclick=()=>{const e=autoEdits[+b.dataset.i];e.enabled=e.enabled===false;results();drawPreview()})}
async function decodeAudio(f,run){
  status("Preparando o áudio",5,"Lendo a faixa de áudio diretamente no navegador…");
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC)throw Error("Seu navegador não oferece Web Audio API para analisar o áudio.");
  const raw=await f.arrayBuffer();
  let probe,decoded;
  try{
    probe=new AC();
    decoded=await probe.decodeAudioData(raw.slice(0));
  }catch(e){
    throw Error("Não consegui decodificar o áudio deste vídeo. Tente MP4/H.264 com AAC ou escolha outro arquivo.");
  }finally{try{await probe?.close()}catch{}}
  if(run!==currentRun)return null;
  const frames=Math.max(1,Math.ceil(decoded.duration*16000));
  if(frames>16000*1800)throw Error("O vídeo tem mais de 30 minutos. Para a análise local, use clipes menores.");
  status("Convertendo áudio",14,"Mono 16 kHz — formato ideal para o Whisper…");
  const off=new OfflineAudioContext(1,frames,16000);
  const mono=off.createBuffer(1,decoded.length,decoded.sampleRate);
  const md=mono.getChannelData(0);
  const n=decoded.numberOfChannels;
  for(let c=0;c<n;c++){
    const ch=decoded.getChannelData(c);
    for(let i=0;i<ch.length;i++)md[i]+=ch[i]/n;
  }
  const src=off.createBufferSource();src.buffer=mono;src.connect(off.destination);src.start();
  const rendered=await off.startRendering();
  const data=rendered.getChannelData(0).slice();
  let sum=0,peak=0;for(let i=0;i<data.length;i++){const v=data[i];sum+=v*v;if(Math.abs(v)>peak)peak=Math.abs(v)}
  const rms=Math.sqrt(sum/Math.max(1,data.length));
  if(peak<0.003||rms<0.0008)throw Error("O vídeo parece não ter uma faixa de voz audível. Verifique se a narração realmente está no arquivo.");
  status("Áudio pronto",20,`${(decoded.duration/60).toFixed(1)} min • ${decoded.numberOfChannels} canais → 16 kHz mono`);
  return {data,duration:decoded.duration};
}
async function model(run){
  if(transcriber)return transcriber;
  const {pipeline}=await loadAI();
  const progress_callback=info=>{
    if(run!==currentRun)return;
    const p=Number.isFinite(info?.progress)?info.progress:0;
    const fileName=String(info?.file||info?.name||"").split("/").pop();
    const pct=Math.max(20,Math.min(78,20+p*.58));
    status("Baixando modelo de transcrição",pct,fileName?`${fileName} • ${Math.round(p)}%`:"Preparando Whisper…");
  };
  try{
    status("Preparando Whisper",23,"Modo compatível WASM — sem dependência do WebGPU…");
    transcriber=await pipeline("automatic-speech-recognition",MODEL,{device:"wasm",dtype:"q8",progress_callback});
    return transcriber;
  }catch(e){
    transcriber=null;
    throw Error(`Não foi possível carregar o Whisper. ${e?.message||e}`);
  }
}
async function analyze(){
  if(!file)return;
  const run=++currentRun;autoEdits=[];results();
  $("#analyzeBtn").disabled=true;$("#autoBadge").textContent="ANALISANDO";$("#transcript").textContent="Preparando narração…";
  try{
    const audio=await decodeAudio(file,run);if(run!==currentRun||!audio)return;
    const pipe=await model(run);if(run!==currentRun)return;
    status("Transcrevendo a narração",32,"Whisper está entendendo a fala em português…");
    const opts={language:"portuguese",task:"transcribe",return_timestamps:true,chunk_length_s:29,stride_length_s:5,do_sample:false};
    let out;
    try{out=await pipe(audio.data,opts)}catch(first){
      console.warn("timestamped transcription failed",first);
      status("Tentando transcrição compatível",40,"Ajustando o processamento de trechos…");
      out=await pipe(audio.data,{language:"portuguese",task:"transcribe",return_timestamps:true,chunk_length_s:29,stride_length_s:4,do_sample:false});
    }
    if(run!==currentRun)return;
    const full=String(out?.text||"").trim();
    $("#transcript").textContent=full||"Nenhuma fala reconhecível foi encontrada.";
    if(!full){throw Error("O Whisper terminou, mas não reconheceu fala. Confira o volume da narração.")}
    status("Extraindo fatos",82,"Transformando números e relações em visualizações…");
    const chunks=Array.isArray(out?.chunks)?out.chunks:[];
    const found=[];
    if(chunks.length){
      for(const s of sentenceChunks(chunks)){
        const c=claim(s.text);if(!c)continue;
        found.push({...c,id:crypto.randomUUID(),start:Math.max(0,s.start-.18),end:Math.min($("#video").duration||s.end,s.end+.32),text:s.text,enabled:true})
      }
    }else{
      const words=full.split(/\s+/).filter(Boolean);const total=$("#video").duration||audio.duration;const step=Math.max(1,total/Math.max(1,Math.ceil(words.length/10)));
      for(let i=0;i<words.length;i+=10){const text=words.slice(i,i+10).join(" "),c=claim(text);if(c){const st=Math.min(total-.5,i/Math.max(1,words.length)*total);found.push({...c,id:crypto.randomUUID(),start:Math.max(0,st-.1),end:Math.min(total,st+step+.15),text,enabled:true})}}
    }
    autoEdits=dedupe(found);
    status("Projeto automático pronto",100,`${autoEdits.length} visualizações criadas a partir da narração.`);
    results();drawPreview();toast(`${autoEdits.length} visualizações criadas automaticamente`)
  }catch(e){
    console.error(e);status("Não foi possível analisar",0,e?.message||"Erro desconhecido");
    $("#transcript").textContent=e?.message||"A análise automática falhou.";toast("Falha na análise automática")
  }finally{
    $("#analyzeBtn").disabled=false;$("#autoBadge").textContent="AUTOMÁTICO";
    if($("#video").duration){$("#test").disabled=false;$("#render").disabled=false}
  }
}
function setFile(f){if(!f)return;file=f;autoEdits=[];results();$("#transcript").textContent="Aguardando análise…";if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(f);const v=$("#video");v.src=url;v.onloadedmetadata=()=>{$("#seek").max=v.duration||1;$("#test").disabled=false;$("#render").disabled=false;drawPreview();toast("Vídeo carregado • iniciando análise automática");setTimeout(analyze,300)};$("#stage").classList.remove("hide");$("#controls").classList.remove("hide");$("#fileInfo").classList.remove("hide");$("#fileInfo").innerHTML=`<b>${esc(f.name)}</b><span>${(f.size/1048576).toFixed(1)} MB</span>`}
$("#file").onchange=e=>{setFile(e.target.files?.[0]);e.target.value=""};$("#drop").ondragover=e=>e.preventDefault();$("#drop").ondrop=e=>{e.preventDefault();setFile(e.dataTransfer.files?.[0])};$("#analyzeBtn").onclick=analyze;
$("#video").ontimeupdate=()=>{$("#seek").value=$("#video").currentTime||0;$("#clock").textContent=`${tm($("#video").currentTime)} / ${tm($("#video").duration)}`;drawPreview()};$("#seek").oninput=()=>{$("#video").currentTime=+$("#seek").value;drawPreview()};$("#play").onclick=()=>{const v=$("#video");if(v.paused){v.play();$("#play").textContent="❚❚"}else{v.pause();$("#play").textContent="▶"}};
function ctx(){const r=$("#stage").getBoundingClientRect(),c=$("#overlay"),d=Math.min(2.2,devicePixelRatio||1);c.width=Math.max(2,Math.floor(r.width*d));c.height=Math.max(2,Math.floor(r.height*d));const g=c.getContext("2d");g.setTransform(d,0,0,d,0,0);return[g,r.width,r.height]}
function ease(p){return p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2}function box(g,x,y,w,h,r){g.beginPath();g.roundRect(x,y,w,h,r)}function pal(){return theme==="editorial"?{bg:"rgba(245,247,252,.94)",fg:"#0b101a",muted:"#657087",a:"#3645d8",b:"#7d57d9",grid:"rgba(13,18,30,.12)"}:theme==="aurora"?{bg:"rgba(7,15,24,.91)",fg:"#f2ffff",muted:"#9bb3c3",a:"#55e0ff",b:"#9b7cff",grid:"rgba(115,224,255,.15)"}:theme==="mono"?{bg:"rgba(9,11,14,.95)",fg:"#f7f7f5",muted:"#9da0a6",a:"#fff",b:"#8e949f",grid:"rgba(255,255,255,.13)"}:{bg:"rgba(8,12,22,.92)",fg:"#f7f9ff",muted:"#99a8bf",a:"#6fd4ff",b:"#9f81ff",grid:"rgba(130,160,255,.16)"}}
function draw(g,e,t,w,h){if(e.enabled===false||t<e.start||t>e.end)return;const p=ease(Math.max(0,Math.min(1,(t-e.start)/Math.max(.08,e.end-e.start)))),al=Math.min(1,p/.16,(1-p)/.16),c=pal(),x=24,wide=Math.min(w-48,680);g.save();g.globalAlpha=al;g.shadowBlur=22;g.shadowColor=c.a;box(g,x,22,wide,96,20);g.fillStyle=c.bg;g.shadowBlur=0;g.fill();g.strokeStyle=c.grid;g.stroke();g.fillStyle=c.muted;g.font="700 10px system-ui";g.fillText(`${ICON[e.type]}  ${e.title.toUpperCase()}`,x+18,45);
if(e.type==="comparison"||e.type==="scale"){const parts=String(e.data||"").split(";").map(z=>{const[a,b]=z.split("=");return{label:a||"",value:Number(b)||0}}).filter(q=>q.label),A=parts[0]||{label:"A",value:1},B=parts[1]||{label:"B",value:2},mx=Math.max(1,Math.abs(A.value),Math.abs(B.value));[A,B].forEach((d,i)=>{const yy=67+i*25,r=Math.max(.03,Math.abs(d.value)/mx)*p;g.fillStyle=c.muted;g.font="700 9px system-ui";g.fillText(d.label.slice(0,18),x+18,yy+3);g.fillStyle="rgba(255,255,255,.10)";g.fillRect(x+95,yy-5,wide-145,8);g.fillStyle=i?c.b:c.a;g.fillRect(x+95,yy-5,(wide-145)*r,8);g.fillStyle=c.fg;g.font="900 11px system-ui";g.fillText(showNum(d.value),x+wide-44,yy+3)})}
else if(e.type==="percentage"){const pct=Math.max(0,Math.min(100,e.value||0))*p,cx=x+wide-63,cy=70,r=25;g.lineWidth=7;g.strokeStyle="rgba(255,255,255,.11)";g.beginPath();g.arc(cx,cy,r,0,7);g.stroke();g.strokeStyle=c.b;g.beginPath();g.arc(cx,cy,r,-Math.PI/2,-Math.PI/2+Math.PI*2*pct/100);g.stroke();g.fillStyle=c.fg;g.font="900 15px system-ui";g.textAlign="center";g.fillText(`${Math.round(pct)}%`,cx,75);g.textAlign="left";g.font="900 18px system-ui";g.fillText(e.subtitle||"Proporção",x+18,76)}
else if(e.type==="distance"||e.type==="speed"){g.fillStyle=c.fg;g.font="900 22px system-ui";g.fillText(e.data||"",x+18,77);g.fillStyle=c.muted;g.font="600 9px system-ui";g.fillText(e.subtitle||"",x+18,95);g.strokeStyle=c.a;g.lineWidth=2;g.setLineDash([3,6]);g.beginPath();g.moveTo(x+230,78);g.lineTo(x+wide-22,78);g.stroke();g.setLineDash([]);g.fillStyle=c.a;g.beginPath();g.arc(x+wide-30,78,5,0,7);g.fill()}
else if(e.type==="duration"||e.type==="timeline"){g.fillStyle=c.fg;g.font="900 22px system-ui";g.fillText(e.data||"",x+18,78);g.fillStyle=c.muted;g.font="600 9px system-ui";g.fillText(e.subtitle||"",x+18,96);g.strokeStyle=c.a;g.lineWidth=2;g.beginPath();g.moveTo(x+240,84);g.lineTo(x+wide-20,84);g.stroke();const dot=x+240+(wide-260)*p;g.fillStyle=c.b;g.beginPath();g.arc(dot,84,5+3*p,0,7);g.fill()}
else if(e.type==="count"||e.type==="temperature"){g.fillStyle=c.fg;g.font="900 24px system-ui";g.fillText(e.data||"",x+18,80);g.fillStyle=c.muted;g.font="600 9px system-ui";g.fillText(e.subtitle||"",x+18,98)}
else{g.fillStyle=c.fg;g.font="900 17px system-ui";g.fillText(e.data||e.subtitle||e.text||"",x+18,76)}g.restore()}
function drawPreview(){if(!file||$("#stage").classList.contains("hide"))return;const[g,w,h]=ctx();g.clearRect(0,0,w,h);autoEdits.forEach(e=>draw(g,e,$("#video").currentTime||0,w,h))}addEventListener("resize",drawPreview);
async function render(test){
  if(!file||!autoEdits.some(e=>e.enabled!==false)){toast("Nenhuma visualização ativa para renderizar");return}
  if(!("VideoEncoder" in window)){toast("WebCodecs não está disponível neste navegador");return}
  $("#render").disabled=true;
  $("#test").disabled=true;
  $("#progress").classList.remove("hide");
  try{
    const {ALL_FORMATS,BlobSource,BufferTarget,Conversion,Input,Mp4OutputFormat,Output,Quality}=await loadMedia();
    const input=new Input({formats:ALL_FORMATS,source:new BlobSource(file,{maxCacheSize:16*1024*1024,useStreamReader:true})});
    const duration=await input.computeDuration();
    const end=test?Math.min(10,duration):duration;
    let target=new BufferTarget();
    let output=new Output({format:new Mp4OutputFormat(),target});
    let cc=null;
    const opts={
      codec:"avc",
      quality:new Quality("medium"),
      hardwareAcceleration:"prefer-hardware",
      forceTranscode:true,
      process:s=>{
        if(!cc){
          const can=new OffscreenCanvas(s.displayWidth,s.displayHeight);
          cc=can.getContext("2d");
        }
        cc.clearRect(0,0,cc.canvas.width,cc.canvas.height);
        s.draw(cc,0,0);
        autoEdits.forEach(e=>draw(cc,e,s.timestamp,cc.canvas.width,cc.canvas.height));
        return cc.canvas;
      }
    };
    let conv;
    try{
      conv=await Conversion.init({input,output,tracks:"primary",trim:{end},video:opts});
      if(!conv.isValid)throw Error("Conversão inválida");
    }catch(first){
      target=new BufferTarget();
      output=new Output({format:new Mp4OutputFormat(),target});
      conv=await Conversion.init({input,output,tracks:"primary",trim:{end},video:{...opts,hardwareAcceleration:"no-preference"}});
    }
    conv.onProgress=(p)=>{
      $("#bar").value=p;
      $("#ppct").textContent=`${Math.round(p*100)}%`;
    };
    await conv.execute();
    const buf=output.target.buffer;
    if(!buf)throw Error("Arquivo final não foi gerado");
    const href=URL.createObjectURL(new Blob([buf],{type:"video/mp4"}));
    $("#result").classList.remove("hide");
    $("#result").innerHTML=`<div class="success"><b>✓ Render concluído</b><a href="${href}" download="AutoMotion_${test?"teste_10s":"final"}.mp4">⬇️ Salvar MP4</a></div>`;
    toast("Render concluído");
  }catch(e){
    console.error(e);
    status("Falha na renderização",0,e?.message||"Erro desconhecido");
    toast("Falha ao renderizar");
  }finally{
    $("#render").disabled=false;
    $("#test").disabled=false;
  }
}
$("#render").onclick=()=>render(false);$("#test").onclick=()=>render(true);$("#help").onclick=()=>$("#modal").classList.remove("hide");$("#close").onclick=()=>$("#modal").classList.add("hide");results();setTheme("cosmic");


// Atualiza o Service Worker sem bloquear o editor.
// Service Worker disabled in V12.2 to prevent stale editor code from being served on GitHub Pages.
