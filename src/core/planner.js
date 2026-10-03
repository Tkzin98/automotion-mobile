import {normalizeText,wordFocus} from './parser.js';
const ENT=[['via lactea','Via Láctea'],['andromeda','Andrômeda'],['buraco de minhoca','Buraco de minhoca'],['buraco negro','Buraco negro'],['sistema solar','Sistema Solar'],['universo','Universo'],['nebulosa','Nebulosa'],['estrela','Estrela'],['sol','Sol'],['jupiter','Júpiter'],['saturno','Saturno'],['urano','Urano'],['netuno','Netuno'],['marte','Marte'],['terra','Terra'],['venus','Vênus'],['mercurio','Mercúrio'],['lua','Lua'],['galaxia','Galáxia'],['planeta','Planeta']];
function entities(text){const n=normalizeText(text), out=[];for(const [k,v] of ENT)if(n.includes(k)&&!out.includes(v))out.push(v);return out;}
function numberWithUnit(text){const n=normalizeText(text),m=n.match(/(\d+(?:[.,]\d+)?)\s*(bilhoes?|bilhao|milhoes?|milhao|mil)?/);return m?{value:parseFloat(m[1].replace(',','.')),unit:m[2]||''}:null;}
function scaledNumber(obj){if(!obj)return NaN; if(/bilhao/.test(obj.unit))return obj.value*1e9; if(/milhao/.test(obj.unit))return obj.value*1e6; if(/\bmil\b/.test(obj.unit))return obj.value*1e3; return obj.value;}
function prettyBillions(value){return (value/1e9).toLocaleString('pt-BR',{maximumFractionDigits:2});}
function make(cue,base,needle=cue.text){const [a,b]=wordFocus(cue,needle);const maxSpan=base.type==='process'?7.5:base.type==='headline'||base.type==='editorial'||base.type==='statement'?5.5:6.2;return {...base,start:Math.max(cue.start,a-.06),end:Math.min(cue.end,b+.24,cue.start+maxSpan),enabled:true,position:'right',vertical:'auto',id:crypto.randomUUID(),source:cue.text};}
function detectTimeline(cue){
  const n=normalizeText(cue.text), m=n.match(/(?:ha|a)\s+(\d+(?:[.,]\d+)?)\s*(bilhoes?|bilhao|milhoes?|milhao)\s+e\s+(\d+(?:[.,]\d+)?)\s*(milhoes?|milhao)\s+de\s+anos?/);
  if(m){const value=parseFloat(m[1].replace(',','.'))*1e9+parseFloat(m[3].replace(',','.'))*1e6;return make(cue,{type:'timeline',value,title:'Escala temporal',data:`Há ${prettyBillions(value)} bilhões de anos`,subtitle:entities(cue.text)[0]||'História cósmica'},m[0]);}
  const s=n.match(/(?:ha|a)\s+(\d+(?:[.,]\d+)?)\s*(bilhoes?|bilhao|milhoes?|milhao)\s+de\s+anos?/);
  if(s){const value=scaledNumber({value:parseFloat(s[1].replace(',','.')),unit:s[2]});return make(cue,{type:'timeline',value,title:'Escala temporal',data:value>=1e9?`Há ${(value/1e9).toLocaleString('pt-BR',{maximumFractionDigits:2})} bilhões de anos`:`Há ${(value/1e6).toLocaleString('pt-BR',{maximumFractionDigits:2})} milhões de anos`,subtitle:entities(cue.text)[0]||'História cósmica'},s[0]);}
  return null;
}
function detectNumeric(cue){
  const n=normalizeText(cue.text), e=entities(cue.text); let m;
  m=n.match(/(\d+(?:[.,]\d+)?)\s*(?:%|por\s+cento)/); if(m)return make(cue,{type:'percentage',value:parseFloat(m[1].replace(',','.')),title:'Proporção',data:`${m[1].replace('.',',')}%`,subtitle:e[0]||'Percentual'},m[0]);
  m=n.match(/(\d+(?:[.,]\d+)?)\s*vez(?:es)?\s+(?:a\s+)?(massa|tamanho|diametro|raio|volume|energia|peso)\s+(?:da|do|de)\s+([a-zà-ÿ* ]{2,32})/); if(m){const v=parseFloat(m[1].replace(',','.'));return make(cue,{type:/massa/.test(m[2])?'comparison':'scale',value:v,title:/massa/.test(m[2])?'Massa relativa':'Escala relativa',data:`${v.toLocaleString('pt-BR',{maximumFractionDigits:2})}×`,subtitle:e.slice(0,2).join(' → ')||m[3].trim()},m[0]);}
  m=n.match(/(\d+(?:[.,]\d+)?)\s*(massas?\s+solares?)/); if(m){const v=parseFloat(m[1].replace(',','.'));return make(cue,{type:'comparison',value:v,title:'Massa estelar',data:`${v.toLocaleString('pt-BR',{maximumFractionDigits:2})} massas solares`,subtitle:e[0]||'Comparação de massa'},m[0]);}
  m=n.match(/(\d+(?:[.,]\d+)?)\s*(km\s*\/\s*s|km\/s|quilometros\s+por\s+segundo|metros\s+por\s+segundo)/); if(m)return make(cue,{type:'speed',value:parseFloat(m[1].replace(',','.')),title:'Velocidade',data:`${m[1].replace('.',',')} km/s`,subtitle:e[0]||'Movimento'},m[0]);
  m=n.match(/(\d+(?:[.,]\d+)?)\s*(milhoes?|milhao|bilhoes?|bilhao)?\s*(?:de\s*)?(km|quilometros|anos-luz|anos\s+luz|ua|unidades\s+astronomicas?)/); if(m){const value=scaledNumber({value:parseFloat(m[1].replace(',','.')),unit:m[2]||''}); const unit=/ano/.test(m[3])?'anos-luz':/ua|astronom/.test(m[3])?'UA':'km';return make(cue,{type:'distance',value,title:'Distância',data:`${m[1].replace('.',',')}${m[2]?' '+m[2].replace(/s$/,''):''} ${unit}`,subtitle:e.slice(0,2).join(' → ')||'Escala espacial'},m[0]);}
  m=n.match(/(?:leva|levam|demora|demoram)\s+(\d+(?:[.,]\d+)?)(?:\s*e\s*(\d+(?:[.,]\d+)?))?\s*(segundos?|minutos?|horas?|dias?|anos?)/); if(m){let a=parseFloat(m[1].replace(',','.')),b=m[2]?parseFloat(m[2].replace(',','.')):0,u=m[3];const factor=/ano/.test(u)?31557600:/dia/.test(u)?86400:/hora/.test(u)?3600:/min/.test(u)?60:1;return make(cue,{type:'duration',value:a*factor+b,title:'Tempo de percurso',data:`${m[1]}${m[2]?` e ${m[2]}`:''} ${u}`,subtitle:e[0]||'Escala temporal'},m[0]);}
  return null;
}
function detectProcess(cue){
  const n=normalizeText(cue.text), e=entities(cue.text); const rules=[
    [/nuvem\s+escura|nuvem\s+molecular|gas\s+e\s+poeira/,'cloud','Nuvem molecular','Gás e poeira antes da formação','Nuvem de gás e poeira'],
    [/perturb|onda\s+de\s+choque|supernova.*ating/,'collapse','Perturbação gravitacional','Algo desencadeia o colapso','Colapso'],
    [/colaps|sob\s+a\s+propria\s+gravidade|materia.*conver/,'collapse','Colapso gravitacional','A matéria converge sob a gravidade','Colapso'],
    [/denso.*quente|acende|nasce\s+o\s+sol/,'ignition','Nascimento do Sol','O núcleo aquece até iniciar a estrela','Ignição'],
    [/disco\s+giratorio|disco\s+protoplanetario|disco\s+de\s+poeira/,'disk','Disco protoplanetário','Material se achata e gira ao redor da estrela','Disco'],
    [/planetas?\s+se\s+form|gr[aã]o\s+por\s+gr[aã]o/,'formation','Formação dos planetas','Acúmulo gradual de material','Formação'],
    [/buraco\s+de\s+minhoca|dobra\s+no\s+espaco|espaco-tempo/,'spacetime','Espaço-tempo','Uma geometria extrema do espaço','Espaço-tempo'],
    [/orbita|girando|ao\s+redor/,'orbit','Órbita','Movimento ao redor de um centro','Órbita']
  ];
  for(const [re,kind,title,sub,label] of rules) if(re.test(n)) return make(cue,{type:'process',processKind:kind,title,data:label,subtitle:e[0]||sub},cue.text);
  if(/de\s+onde\s+veio|por\s+que\s+a\s+resposta/.test(n)) return make(cue,{type:'headline',title:'Pergunta central',data:'A origem do Sistema Solar',subtitle:cue.text},cue.text);
  if(/versao\s+tradicional|aprendemos\s+na\s+escola/.test(n)) return make(cue,{type:'editorial',title:'Modelo tradicional',data:'Uma explicação simples — e incompleta',subtitle:cue.text},cue.text);
  if(/nao\s+havia\s+sol|nao\s+havia\s+terra/.test(n)) return make(cue,{type:'statement',title:'Antes do Sistema Solar',data:'Ainda não havia Sol nem Terra',subtitle:cue.text},cue.text);
  return null;
}
export function planCue(cue,index=0){
  const timeline=detectTimeline(cue); if(timeline)return timeline;
  const numeric=detectNumeric(cue); if(numeric)return numeric;
  return detectProcess(cue,index);
}
export function buildPlan(cues){
  const found=[]; for(let i=0;i<cues.length;i++){const item=planCue(cues[i],i);if(item)found.push(item);}
  const result=[]; for(const item of found.sort((a,b)=>a.start-b.start)){const prev=result.at(-1);if(prev&&item.start<prev.end-.18){if((item.end-item.start)>(prev.end-prev.start)+.45)result[result.length-1]=item;}else result.push(item);}
  return result.slice(0,120);
}
