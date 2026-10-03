import {getPreset,clamp} from './designSystem.js';
const LABELS={timeline:'HISTÓRIA',process:'PROCESSO',headline:'CONTEXTO',editorial:'ANÁLISE',statement:'CONTEXTO',comparison:'COMPARAÇÃO',scale:'ESCALA',percentage:'PROPORÇÃO',distance:'DISTÂNCIA',speed:'VELOCIDADE',duration:'TEMPO'};
const ASSET_MAP={cloud:'cloud.png',collapse:'collapse.png',ignition:'sun.png',disk:'disk.png',formation:'planets.png',spacetime:'collapse.png',orbit:'solar.png'};
const IMG_CACHE=new Map();
export async function preloadAssets(base='./assets/'){
  await Promise.all(Object.entries(ASSET_MAP).map(([key,file])=>new Promise(resolve=>{const img=new Image();img.onload=()=>{IMG_CACHE.set(key,img);resolve();};img.onerror=resolve;img.src=base+file;})));
}
function easeOutCubic(x){return 1-Math.pow(1-x,3);}
function roundedRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function alphaColor(a){return `rgba(255,255,255,${a})`;}
function wrap(ctx,text,maxWidth,maxLines){
  const words=String(text||'').split(/\s+/), lines=[]; let line='';
  for(const word of words){const next=line?`${line} ${word}`:word;if(ctx.measureText(next).width<=maxWidth||!line)line=next;else{lines.push(line);line=word;if(lines.length===maxLines-1)break;}}
  if(line&&lines.length<maxLines)lines.push(line);
  if(words.length && lines.length===maxLines){const joined=lines[maxLines-1]; if(ctx.measureText(joined).width>maxWidth){let s=joined;while(s.length&&ctx.measureText(`${s}…`).width>maxWidth)s=s.slice(0,-1);lines[maxLines-1]=`${s}…`;}}
  return lines;
}
function panelBox(w,h,settings,e){
  const density=settings.density==='subtle'?0.88:settings.density==='cinematic'?1.08:1; const margin=Math.max(18,w*settings.safeMargin), bw=Math.min(w*0.365*density,520), bh=e.type==='process'?Math.min(h*0.34*density,310):Math.min(h*0.30*density,285);
  const x=w-bw-margin;
  let y=(h-bh)/2;
  if(settings.vertical==='top')y=h*0.12; if(settings.vertical==='bottom')y=h*0.88-bh;
  return {x,y,w:bw,h:bh};
}
function drawGhostAsset(ctx,e,box){
  const img=IMG_CACHE.get(e.processKind); if(!img)return;
  const maxW=Math.min(box.w*.48,240), scale=Math.min(maxW/img.naturalWidth,1), iw=img.naturalWidth*scale, ih=img.naturalHeight*scale;
  const x=box.x+box.w-iw-18, y=box.y+box.h*.34-ih*.5;
  ctx.save();ctx.globalAlpha=.13;ctx.filter='grayscale(1) contrast(.9)';ctx.drawImage(img,x,y,iw,ih);ctx.restore();
}
function titleData(e){
  if(e.type==='timeline'){const m=String(e.data||'').match(/Há\s+(.+?)\s+bilhões?\s+de\s+anos/i);if(m)return {big:m[1],sub:'bilhões de anos atrás'};const m2=String(e.data||'').match(/Há\s+(.+?)\s+milhões?\s+de\s+anos/i);if(m2)return {big:m2[1],sub:'milhões de anos atrás'};return {big:e.data,sub:'história cósmica'};}
  if(e.type==='percentage') return {big:e.data,sub:e.subtitle};
  if(e.type==='distance'||e.type==='speed'||e.type==='duration'||e.type==='comparison'||e.type==='scale') return {big:e.data,sub:e.subtitle};
  return {big:e.data||e.title,sub:e.subtitle||''};
}
export function drawMotion(ctx,e,time,w,h,settings){
  if(!e||e.enabled===false||time<e.start||time>e.end)return;
  const p=clamp((time-e.start)/Math.max(.16,e.end-e.start),0,1), enter=easeOutCubic(clamp(p/.18,0,1)), exit=clamp((e.end-time)/.20,0,1), alpha=Math.min(1,enter,exit);
  const preset=getPreset(settings.design); const box=panelBox(w,h,settings,e); const slide=settings.motion==='slide'?24:settings.motion==='focus'?10:16;
  ctx.save();ctx.globalAlpha=alpha;ctx.translate((1-enter)*slide,0);
  // right-side black gradient, not a card.
  const g=ctx.createLinearGradient(box.x-48,box.y,box.x+box.w+30,box.y);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(.22,`rgba(0,0,0,${clamp(settings.panelOpacity*.36,0,.42)})`);g.addColorStop(1,`rgba(0,0,0,${settings.panelOpacity})`);
  ctx.fillStyle=g;roundedRect(ctx,box.x-55,box.y-18,box.w+75,box.h+36,10);ctx.fill();
  const lineX=box.x+2;ctx.fillStyle=alphaColor(preset.line);ctx.fillRect(lineX,box.y+8,1.5,box.h-16);
  const tx=box.x+20,maxW=box.w-38;let y=box.y+28;
  if(settings.showTime){ctx.fillStyle=alphaColor(preset.muted);ctx.font=`500 ${Math.max(10,w*.006)}px ui-monospace,SFMono-Regular,Menlo,monospace`;ctx.fillText(formatVisualTime(e.start),tx,y);y+=22;}
  if(settings.showLabel){ctx.fillStyle=alphaColor(preset.line);ctx.font=`600 ${Math.max(9,w*.0045)}px Inter,system-ui,sans-serif`;ctx.letterSpacing='1.9px';ctx.fillText(LABELS[e.type]||'VISUAL',tx,y);ctx.letterSpacing='0';y+=26;}
  const data=titleData(e); const bigSize=Math.round(clamp(w*.019* preset.title,24,42));
  if(e.type==='timeline'){ctx.fillStyle='#fff';ctx.font=`650 ${bigSize}px Inter,system-ui,sans-serif`;const parts=data.big.split(' ');const lines=wrap(ctx,parts.join(' '),maxW,2);for(const line of lines){ctx.fillText(line,tx,y);y+=bigSize+3;}ctx.fillStyle=alphaColor(.52);ctx.font=`400 ${Math.max(10,w*.0052)}px Inter,system-ui,sans-serif`;ctx.fillText(data.sub,tx,y+3);}
  else{ctx.fillStyle='#fff';ctx.font=`650 ${bigSize}px Inter,system-ui,sans-serif`;const lines=wrap(ctx,data.big,maxW,e.type==='process'?2:2);for(const line of lines){ctx.fillText(line,tx,y);y+=bigSize+3;}if(data.sub){ctx.fillStyle=alphaColor(.55);ctx.font=`400 ${Math.max(10,w*.005)}px Inter,system-ui,sans-serif`;const subLines=wrap(ctx,data.sub,maxW,2);for(const line of subLines){ctx.fillText(line,tx,y+4);y+=15;}}}
  if(e.type==='process')drawGhostAsset(ctx,e,box);
  if(settings.showLine){const lineY=box.y+box.h-17, lx=tx, rx=box.x+box.w-18;ctx.strokeStyle=alphaColor(.16);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(lx,lineY);ctx.lineTo(rx,lineY);ctx.stroke();ctx.strokeStyle=alphaColor(.78);ctx.beginPath();ctx.moveTo(lx,lineY);ctx.lineTo(lx+(rx-lx)*p,lineY);ctx.stroke();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(lx+(rx-lx)*p,lineY,2.7,0,Math.PI*2);ctx.fill();}
  if(settings.motion==='focus'){ctx.strokeStyle=alphaColor(.06);ctx.beginPath();ctx.arc(box.x+box.w-48,box.y+48,28,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
}
function formatVisualTime(sec){sec=Math.max(0,Math.round(sec));return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;}
