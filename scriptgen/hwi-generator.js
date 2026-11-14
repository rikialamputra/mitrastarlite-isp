// Huawei OLT CSV generator — standalone module for ScriptGen
let parsedData = [];
let globalConfig = {};

document.addEventListener("DOMContentLoaded", () => {
  const previewBtn = document.getElementById("previewBtn");
  const generateBtn = document.getElementById("generateBtn");
  const csvFileInput = document.getElementById("csvFile");
  const notice = document.getElementById("csvNotice");
  const summaryBox = document.getElementById("summaryBox");
  const emptyState = document.getElementById("csvEmptyState");

  const setNotice = (message) => { if (notice) notice.textContent = message; };
  if (previewBtn) previewBtn.addEventListener("click", () => {
    const hostname = document.getElementById("hostname").value.trim();
    const slotTujuan = document.getElementById("slotTujuan").value.trim();
    const vlanStasiun = document.getElementById("vlanStasiun").value.trim();
    const csvFile = csvFileInput.files[0];
    setNotice("");
    if (!hostname || !slotTujuan || !vlanStasiun || !csvFile) {
      setNotice("Lengkapi hostname, slot tujuan, VLAN stasiun, dan pilih file CSV.");
      return;
    }
    if (!/^\\d+$/.test(slotTujuan) || !/^\\d+$/.test(vlanStasiun) || Number(vlanStasiun)<1 || Number(vlanStasiun)>4094) {
      setNotice("Slot harus berupa angka dan VLAN harus berada pada rentang 1–4094.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        processAndPreviewCSV(event.target.result, hostname, slotTujuan, vlanStasiun);
        if (!parsedData.length) return;
        document.getElementById("csvFileName").textContent = csvFile.name;
        summaryBox.hidden = false;
        emptyState.hidden = true;
      } catch (error) {
        setNotice("Gagal memproses CSV: " + error.message);
      }
    };
    reader.onerror = () => setNotice("File CSV tidak dapat dibaca. Coba pilih file lain.");
    reader.readAsText(csvFile);
  });
  if (generateBtn) generateBtn.addEventListener("click", generateAndDownload);
});

function processAndPreviewCSV(csvText, hostname, slotTujuan, vlanStasiun) {
  parsedData = [];
  globalConfig = { hostname, slotTujuan, vlanStasiun };
  const lines = csvText.replace(/\\x00/g, "").replace(/\\r/g, "").split("\\n");
  let headerLineIdx = -1;
  let headers = [];
  for (let i=0;i<lines.length;i++) {
    if (!lines[i].trim()) continue;
    const cols = lines[i].replace(/"/g,"").split(",").map(c=>c.trim().toLowerCase());
    if (cols.includes("port") && (cols.includes("onu id") || cols.includes("onuid")) && cols.includes("sn")) {
      headerLineIdx=i; headers=cols; break;
    }
  }
  if(headerLineIdx===-1) { document.getElementById("csvNotice").textContent="Format CSV tidak dikenali. Pastikan tersedia kolom Port, ONU ID, dan SN."; return; }
  const portIdx=headers.indexOf("port");
  const onuIdIdx=headers.indexOf("onu id")!==-1?headers.indexOf("onu id"):headers.indexOf("onuid");
  const snIdx=headers.indexOf("sn");
  let aliasIdx=headers.indexOf("alias"); if(aliasIdx===-1) aliasIdx=headers.indexOf("name");
  let statusIdx=headers.indexOf("status"); if(statusIdx===-1) statusIdx=headers.indexOf("operation status");
  let online=0,offline=0;
  for(let i=headerLineIdx+1;i<lines.length;i++){
    if(!lines[i].trim()) continue;
    const row=lines[i].replace(/"/g,"").split(",").map(c=>c.trim());
    const port=row[portIdx]||"",onuId=row[onuIdIdx]||"",snFull=row[snIdx]||"";
    let alias=aliasIdx!==-1&&row[aliasIdx]?row[aliasIdx]:"";
    const status=statusIdx!==-1&&row[statusIdx]?row[statusIdx]:"";
    if(!snFull||!port||!onuId) continue;
    const sn=snFull.substring(0,16);
    if(!alias||alias.includes("--")) alias=sn;
    if(status.toLowerCase().includes("online")) online++; else offline++;
    parsedData.push({port,onuId,sn,alias});
  }
  if(!parsedData.length) { document.getElementById("csvNotice").textContent="Tidak ada baris ONU valid yang ditemukan pada CSV."; return; }
  document.getElementById("summaryText").innerHTML =
    '<div class="metric-card"><span>ONU Terdeteksi</span><strong>'+parsedData.length+'</strong></div>'+
    '<div class="metric-card online"><span>Online</span><strong>'+online+'</strong></div>'+
    '<div class="metric-card offline"><span>Offline / Lainnya</span><strong>'+offline+'</strong></div>'+
    '<div class="metric-card"><span>Header CSV di baris</span><strong>'+ (headerLineIdx+1) +'</strong></div>';
  document.getElementById("summaryBox").hidden=false;
}

function generateAndDownload() {
  if(!parsedData.length) { document.getElementById("csvNotice").textContent="Belum ada data ONU untuk dibuatkan script."; return; }
  let finalScript="";
  parsedData.forEach(data=>{
    finalScript += `interface gpon 0/${globalConfig.slotTujuan}
ont add ${data.port} ${data.onuId} sn-auth ${data.sn} omci ont-lineprofile-name SURGE_LP_ALLVLAN ont-srvprofile-name SURGE_SP_ALLVLAN desc ${data.alias}
ont ipconfig ${data.port} ${data.onuId} ip-index 1 dhcp vlan 81 priority 0
ont tr069-server-config ${data.port} ${data.onuId} profile-name YINET_ACS
ont internet-config ${data.port} ${data.onuId} ip-index 0
ont wan-config ${data.port} ${data.onuId} ip-index 0 profile-name pppoe_wan
ont policy-route-config ${data.port} ${data.onuId} profile-name pppoe_policy
ont port route ${data.port} ${data.onuId} eth 1-4 enable
quit
service-port vlan 81 gpon 0/${globalConfig.slotTujuan}/${data.port} ont ${data.onuId} gemport 1 multi-service user-vlan 81 tag-transform translate
service-port vlan ${globalConfig.vlanStasiun} gpon 0/${globalConfig.slotTujuan}/${data.port} ont ${data.onuId} gemport 1 multi-service user-vlan ${globalConfig.vlanStasiun} tag-transform translate
\n`;
  });
  downloadTextFile(finalScript, globalConfig.hostname+".txt");
}
function downloadTextFile(content,filename) {
  const blob=new Blob([content],{type:"text/plain;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url; link.download=filename; document.body.appendChild(link); link.click(); link.remove();
  URL.revokeObjectURL(url);
}
