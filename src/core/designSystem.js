export const DESIGN_PRESETS={
  obsidian:{id:'obsidian',name:'Obsidian',desc:'Vidro preto + regra branca',panel:0.62,line:0.82,muted:0.50,title:1.0,soft:0.10,accent:'#F5F7F8'},
  aperture:{id:'aperture',name:'Aperture',desc:'Mais editorial + linha técnica',panel:0.54,line:0.70,muted:0.46,title:0.96,soft:0.08,accent:'#DDE3E7'},
  archive:{id:'archive',name:'Archive',desc:'Minimalista + tipografia compacta',panel:0.50,line:0.60,muted:0.44,title:0.90,soft:0.06,accent:'#EAEDEF'},
  eclipse:{id:'eclipse',name:'Eclipse',desc:'Mais dramático, ainda monocromático',panel:0.68,line:0.90,muted:0.52,title:1.04,soft:0.12,accent:'#FFFFFF'}
};
export const DEFAULT_SETTINGS={design:'obsidian',position:'right',vertical:'auto',density:'balanced',motion:'reveal',panelOpacity:0.62,showTime:true,showLabel:true,showLine:true,safeMargin:0.035,res:'1080',fps:60,quality:'high'};
export function getPreset(id){return DESIGN_PRESETS[id]||DESIGN_PRESETS.obsidian;}
export function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
