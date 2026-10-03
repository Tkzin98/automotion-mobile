const MB_URL='https://esm.sh/mediabunny@1.61.0?bundle';
let MB=null;
export async function loadMedia(){if(MB)return MB;MB=await import(MB_URL);return MB;}
export async function renderVideo({file,videoElement,edits,settings,test=false,onProgress}){
  if(!file)throw new Error('Vídeo não carregado.');
  if(!window.VideoEncoder)throw new Error('Seu navegador não oferece WebCodecs para render local.');
  const {ALL_FORMATS,BlobSource,BufferTarget,Conversion,Input,Mp4OutputFormat,Output,Quality,AudioBufferSink,AudioBufferSource}=await loadMedia();
  const input=new Input({formats:ALL_FORMATS,source:new BlobSource(file,{maxCacheSize:24*1024*1024,useStreamReader:true})});
  const duration=await input.computeDuration(); const end=test?Math.min(settings.testLength,duration):duration;
  const targetHeight=settings.res==='source'?undefined:Math.min(Number(settings.res),videoElement.videoHeight||Number(settings.res));
  const output=new Output({format:new Mp4OutputFormat({fastStart:'in-memory'}),target:new BufferTarget()});
  let ctx=null;
  const {drawMotion}=await import('./motionRenderer.js');
  const vopts={codec:'avc',quality:new Quality(settings.quality==='very-high'?'very-high':settings.quality==='high'?'high':'medium'),hardwareAcceleration:'prefer-hardware',forceTranscode:true,frameRate:Number(settings.fps),height:targetHeight,process:sample=>{
    if(!ctx||ctx.canvas.width!==sample.displayWidth||ctx.canvas.height!==sample.displayHeight){const can=new OffscreenCanvas(sample.displayWidth,sample.displayHeight);ctx=can.getContext('2d');}
    ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height); sample.draw(ctx,0,0);
    for(const edit of edits)drawMotion(ctx,edit,sample.timestamp,ctx.canvas.width,ctx.canvas.height,settings);
    return ctx.canvas;
  }};
  const conversion=await Conversion.init({input,output,tracks:'primary',trim:{end},video:vopts,audio:{discard:true},composable:true});
  if(!conversion.isValid)throw new Error('O navegador não conseguiu preparar o vídeo para codificação.');
  const audioTrack=await input.getPrimaryAudioTrack(); let audioSource=null;
  if(audioTrack){audioSource=new AudioBufferSource({codec:'aac',quality:new Quality({bitrate:128e3}),startTimestamp:0});output.addAudioTrack(audioSource);}
  await output.start(); conversion.onProgress=p=>onProgress?.(p);
  const audioFeed=(async()=>{if(!audioTrack||!audioSource)return;const sink=new AudioBufferSink(audioTrack);for await(const wrapped of sink.buffers(0,end))await audioSource.add(wrapped.buffer);audioSource.close();})();
  await Promise.all([conversion.execute(),audioFeed]); await output.finalize(); const buffer=output.target.buffer;
  if(!buffer)throw new Error('O render não produziu um arquivo.');
  return new Blob([buffer],{type:'video/mp4'});
}
