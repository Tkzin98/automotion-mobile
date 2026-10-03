export function normalizeText(value=''){
  return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,"'").replace(/\s+/g,' ').trim();
}
export function cleanCueText(value=''){
  return String(value||'').replace(/<[^>]+>/g,' ').replace(/\{\\an\d+\}/g,'').replace(/\s+/g,' ').trim();
}
export function parseTime(value){
  if(typeof value==='number') return value;
  const s=String(value||'').trim().replace(',','.');
  if(/^\d+(?:\.\d+)?$/.test(s)) return Number(s);
  const p=s.split(':').map(Number);
  if(p.some(Number.isNaN)) return NaN;
  if(p.length===3) return p[0]*3600+p[1]*60+p[2];
  if(p.length===2) return p[0]*60+p[1];
  return NaN;
}
export function formatTime(seconds){
  const s=Math.max(0,Number(seconds)||0);
  const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=Math.floor(s%60);
  return h?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`:`${m}:${String(sec).padStart(2,'0')}`;
}
function parseSrtVtt(text){
  const blocks=String(text||'').replace(/\r/g,'').trim().split(/\n\s*\n+/);
  const out=[];
  for(const block of blocks){
    const lines=block.split('\n').map(x=>x.trim()).filter(Boolean);
    const i=lines.findIndex(x=>x.includes('-->')); if(i<0) continue;
    const match=lines[i].match(/(.+?)\s*-->\s*(.+?)(?:\s+.*)?$/); if(!match) continue;
    const start=parseTime(match[1]), end=parseTime(match[2]), cue=cleanCueText(lines.slice(i+1).join(' '));
    if(Number.isFinite(start)&&Number.isFinite(end)&&end>start&&cue) out.push({start,end,text:cue,words:[]});
  }
  return out;
}
function parseJson(text){
  let data=JSON.parse(text);
  if(data?.segments) data=data.segments;
  if(data?.cues) data=data.cues;
  if(!Array.isArray(data)) throw new Error('JSON deve ser um array ou conter segments/cues.');
  return data.map(item=>({
    start:parseTime(item.start??item.begin??item.from),
    end:parseTime(item.end??item.finish??item.to),
    text:cleanCueText(item.text??item.content??''),
    words:Array.isArray(item.words)?item.words.map(w=>({text:String(w.text||'').trim(),start:parseTime(w.start),end:parseTime(w.end)})).filter(w=>w.text&&Number.isFinite(w.start)&&Number.isFinite(w.end)):[]
  })).filter(x=>Number.isFinite(x.start)&&Number.isFinite(x.end)&&x.end>x.start&&x.text);
}
function parseMarkedText(text,mediaDuration=0){
  const raw=String(text||'').replace(/\r/g,'').trim();
  const marker=/\(\s*(\d{1,2}:\d{2}(?::\d{2}(?:[.,]\d{1,3})?)?)\s*\)/g;
  const hits=[...raw.matchAll(marker)];
  if(hits.length){
    const out=[];
    for(let i=0;i<hits.length;i++){
      const start=parseTime(hits[i][1]);
      const contentStart=(hits[i].index??0)+hits[i][0].length;
      const nextIndex=i+1<hits.length?(hits[i+1].index??raw.length):raw.length;
      const textPart=cleanCueText(raw.slice(contentStart,nextIndex));
      const end=i+1<hits.length?parseTime(hits[i+1][1]):(mediaDuration>start?mediaDuration:start+8);
      if(Number.isFinite(start)&&textPart&&Number.isFinite(end)&&end>start) out.push({start,end,text:textPart,words:[]});
    }
    return out;
  }
  const lines=raw.split('\n'), out=[];
  const re=/^\s*(\d{1,2}:\d{2}(?::\d{2}(?:[.,]\d{1,3})?)?)\s*(?:-->|-|→)\s*(\d{1,2}:\d{2}(?::\d{2}(?:[.,]\d{1,3})?)?)\s*\|?\s*(.*)$/;
  for(const line of lines){const m=line.match(re);if(m){const start=parseTime(m[1]),end=parseTime(m[2]);const cue=cleanCueText(m[3]);if(Number.isFinite(start)&&Number.isFinite(end)&&end>start&&cue)out.push({start,end,text:cue,words:[]});}}
  return out;
}
export function parseTranscript(text,name='',mediaDuration=0){
  const value=String(text||'').trim(); if(!value) throw new Error('A transcrição está vazia.');
  const ext=String(name||'').toLowerCase(); let cues=[];
  if(ext.endsWith('.json')||value.startsWith('[')||value.startsWith('{')) cues=parseJson(value);
  else if(ext.endsWith('.srt')||ext.endsWith('.vtt')||value.includes('-->')) cues=parseSrtVtt(value);
  else cues=parseMarkedText(value,mediaDuration);
  if(!cues.length) throw new Error('Não encontrei timestamps. Use (0:08) texto, SRT, VTT ou JSON.');
  return cues.sort((a,b)=>a.start-b.start);
}
export function wordFocus(cue,needle=cue.text){
  const words=cue.words||[], text=normalizeText(cue.text), target=normalizeText(needle); const idx=text.indexOf(target);
  if(idx<0||!words.length) return [cue.start,cue.end];
  let pos=0,start=cue.start,end=cue.end;
  for(const word of words){
    const w=normalizeText(word.text), next=pos+w.length;
    if(idx>=pos&&idx<=next) start=word.start;
    if(idx+target.length>=pos&&idx+target.length<=next){end=word.end;break;}
    pos=next+1;
  }
  return [start,end];
}
