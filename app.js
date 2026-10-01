const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

let videoFile = null;
let videoURL = null;
let edits = [];
let selectedType = "comparison";

const typeNames = {
  comparison:"Comparação", scale:"Escala", timeline:"Linha do tempo",
  distance:"Distância", speed:"Velocidade", percentage:"Porcentagem",
  trajectory:"Trajetória", counter:"Contador"
};

const icons = {
  comparison:"📊", scale:"📏", timeline:"⏳", distance:"🌌",
  speed:"🚀", percentage:"％", trajectory:"🪐", counter:"🔢"
};

$("#videoInput").addEventListener("change", e => {
  const f=e.target.files?.[0];
  if(f) setVideo(f);
});

$("#dropzone").addEventListener("dragover", e=>{e.preventDefault();$("#dropzone").classList.add("drag")});
$("#dropzone").addEventListener("dragleave", ()=>$("#dropzone").classList.remove("drag"));
$("#dropzone").addEventListener("drop", e=>{
  e.preventDefault(); $("#dropzone").classList.remove("drag");
  const f=e.dataTransfer.files?.[0]; if(f && f.type.startsWith("video/")) setVideo(f);
});

function setVideo(file){
  videoFile=file;
  if(videoURL) URL.revokeObjectURL(videoURL);
  videoURL=URL.createObjectURL(file);
  $("#previewVideo").src=videoURL;
  $("#previewWrap").classList.remove("hidden");
  $("#videoInfo").classList.remove("hidden");
  $("#videoInfo").innerHTML=`<b>${escapeHTML(file.name)}</b><span>${formatBytes(file.size)} • ${escapeHTML(file.type || "vídeo")}</span>`;
  $("#exportBtn").disabled=false;
  setStatus("Vídeo carregado • projeto pronto para edição","ok");
  toast("Vídeo adicionado");
}

$$(".tool").forEach(btn=>{
  btn.addEventListener("click",()=>{
    $$(".tool").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
    selectedType=btn.dataset.type;
  });
});

$("#addEdit").addEventListener("click",()=>{
  const item={
    id:crypto.randomUUID(),
    type:selectedType,
    title:typeNames[selectedType],
    start:0,
    end:5,
    instruction:$("#instruction").value.trim()
  };
  edits.push(item);
  renderEdits();
  toast("Visualização adicionada");
});

function renderEdits(){
  const box=$("#edits");
  $("#editCount").textContent=`${edits.length} ${edits.length===1?"item":"itens"}`;
  if(!edits.length){
    box.className="edits empty";
    box.innerHTML=`<div class="emptyIcon">✦</div><p>Nenhuma visualização adicionada</p><small>Escolha um tipo acima e adicione seu primeiro elemento.</small>`;
    return;
  }
  box.className="edits";
  box.innerHTML=edits.map((e,i)=>`
    <article class="editItem">
      <div class="editTop">
        <div class="editIcon">${icons[e.type]}</div>
        <div class="editName"><b>${escapeHTML(e.title)}</b><small>${escapeHTML(e.instruction || "Sem instrução específica")}</small></div>
        <button class="delete" data-id="${e.id}">×</button>
      </div>
      <div class="fields">
        <label>Início (s)<input class="editField" data-id="${e.id}" data-key="start" type="number" min="0" step=".1" value="${e.start}"></label>
        <label>Fim (s)<input class="editField" data-id="${e.id}" data-key="end" type="number" min="0" step=".1" value="${e.end}"></label>
      </div>
    </article>`).join("");

  $$(".delete").forEach(b=>b.onclick=()=>{
    edits=edits.filter(e=>e.id!==b.dataset.id); renderEdits();
  });
  $$(".editField").forEach(input=>input.onchange=()=>{
    const e=edits.find(x=>x.id===input.dataset.id);
    if(e) e[input.dataset.key]=Number(input.value)||0;
  });
}

$("#exportBtn").addEventListener("click", async()=>{
  if(!videoFile) return toast("Adicione um vídeo primeiro");
  if(typeof JSZip==="undefined") return toast("Biblioteca ZIP não carregou. Atualize a página.");
  try{
    setStatus("Preparando ZIP para o Colab…","loading");
    const project={
      automotion_version:"10.0",
      created_at:new Date().toISOString(),
      video:{name:videoFile.name,size:videoFile.size,type:videoFile.type},
      instruction:$("#instruction").value.trim(),
      edits:edits.map(e=>({...e})),
      render:{
        target:"google_colab",
        preview_only:true,
        source_resolution:"original",
        fps:"source",
        audio:"preserve"
      }
    };
    const zip=new JSZip();
    zip.file("video"+extension(videoFile.name),videoFile,{compression:"STORE"});
    zip.file("projeto.json",JSON.stringify(project,null,2));
    zip.file("LEIA-ME.txt",
`AutoMotion Mobile V10

1. Abra o notebook AutoMotion_Renderer.ipynb no Google Colab.
2. Execute as células na ordem.
3. Envie este arquivo ZIP quando o notebook solicitar.
4. O Colab localizará automaticamente video.* e projeto.json.
5. Ao final, baixe o MP4 renderizado.

O HTML é apenas o editor visual. A renderização pesada acontece no Colab.
`);
    const blob=await zip.generateAsync({type:"blob",compression:"STORE"});
    downloadBlob(blob,"AutoMotion_Projeto.zip");
    setStatus("Projeto exportado • envie o ZIP para o Colab","ok");
    $("#colabBtn").classList.remove("hidden");
    toast("ZIP pronto!");
  }catch(err){
    console.error(err); setStatus("Erro ao preparar o projeto","error"); toast("Não foi possível criar o ZIP");
  }
});

const COLAB_URL="https://colab.research.google.com/github/tkzin98/automotion-mobile/blob/main/colabora%C3%A7%C3%A3o/AutoMotion_Renderer.ipynb";
$("#colabBtn").href=COLAB_URL;

$("#helpBtn").onclick=()=>$("#modal").classList.remove("hidden");
$("#closeModal").onclick=()=>$("#modal").classList.add("hidden");
$("#modal").onclick=e=>{if(e.target.id==="modal") $("#modal").classList.add("hidden")};

function setStatus(text,state=""){
  $("#status").className="status "+state;
  $("#status span").textContent=text;
}
function toast(t){const x=$("#toast");x.textContent=t;x.classList.add("show");setTimeout(()=>x.classList.remove("show"),2200)}
function formatBytes(n){if(n<1024**2)return `${(n/1024).toFixed(0)} KB`;return `${(n/1024**2).toFixed(1)} MB`}
function extension(n){const m=n.match(/\.[a-z0-9]+$/i);return m?m[0]:".mp4"}
function downloadBlob(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
renderEdits();