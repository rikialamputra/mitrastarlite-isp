// Huawei OLT CSV migration generator — parses customer migration CSV.
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
  const oltAsal = document.getElementById("oltAsal");
  const slotWrap = document.getElementById("slotTujuanWrap");
  const slotInput = document.getElementById("slotTujuan");
  const syncSlotField = () => {
    const isPizza = oltAsal.value === "pizza";
    slotWrap.hidden = !isPizza;
    slotInput.required = isPizza;
    if (!isPizza) slotInput.value = "";
  };
  oltAsal.addEventListener("change", syncSlotField);
  syncSlotField();

  if (previewBtn) previewBtn.addEventListener("click", () => {
    const hostname = document.getElementById("hostname").value.trim();
    const oltType = oltAsal.value;
    const slotTujuan = slotInput.value.trim();
    const vlanStasiun = document.getElementById("vlanStasiun").value.trim();
    const csvFile = csvFileInput.files[0];
    setNotice("");
    if (!hostname || (oltType === "pizza" && !slotTujuan) || !vlanStasiun || !csvFile) {
      setNotice("Lengkapi hostname, VLAN Stasiun, file CSV" + (oltType === "pizza" ? ", dan Card Tujuan." : "."));
      return;
    }
    if ((oltType === "pizza" && !/^\d+$/.test(slotTujuan)) || !/^\d+$/.test(vlanStasiun) || Number(vlanStasiun) < 1 || Number(vlanStasiun) > 4094) {
      setNotice("Card tujuan harus berupa angka dan VLAN Stasiun harus 1–4094.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        processAndPreviewCSV(event.target.result, hostname, slotTujuan, vlanStasiun, oltType);
        if (!parsedData.length) return;
        document.getElementById("csvFileName").textContent = csvFile.name;
        summaryBox.hidden = false;
        emptyState.hidden = true;
      } catch (error) {
        setNotice("Gagal memproses CSV: " + error.message);
      }
    };
    reader.onerror = () => setNotice("File CSV tidak dapat dibaca. Coba pilih file lain.");
    reader.readAsText(csvFile, "UTF-8");
  });
  if (generateBtn) generateBtn.addEventListener("click", generateAndDownload);
});

// CSV reader that respects quoted fields containing commas, quotes, and line breaks.
function parseCsvRows(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field.trim()); field = ""; }
    else if (ch === "\n") { row.push(field.trim()); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r" && ch !== "\u0000") field += ch;
  }
  if (field.length || row.length) { row.push(field.trim()); rows.push(row); }
  return rows;
}

function processAndPreviewCSV(csvText, hostname, slotTujuan, vlanStasiun, oltType) {
  parsedData = [];
  globalConfig = { hostname, slotTujuan, vlanStasiun, oltType };
  const rows = parseCsvRows(String(csvText).replace(/^\uFEFF/, ""));
  const headerIdx = rows.findIndex(row => {
    const h = row.map(x => x.trim().toLowerCase());
    return ["pon","sn","vlan inet","vlan tr","ont description"].every(key => h.includes(key));
  });
  if (headerIdx < 0) {
    document.getElementById("csvNotice").textContent = "Format CSV tidak dikenali. Wajib ada kolom PON, SN, VLAN INET, VLAN TR, dan ONT Description.";
    return;
  }
  const headers = rows[headerIdx].map(x => x.trim().toLowerCase());
  const idx = key => headers.indexOf(key);
  const required = ["pon","sn","vlan inet","vlan tr", ...(oltType === "chassis" ? ["card"] : [])];
  const missing = required.filter(key => idx(key) < 0);
  if (missing.length) throw new Error("Kolom wajib tidak ditemukan: " + missing.join(", "));

  const nextOnuByPort = new Map();
  const seenSn = new Set();
  let duplicateSn = 0, invalid = 0, online = 0;
  const ponCounts = new Map();

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(cell => !String(cell || "").trim())) continue;
    const ponRaw = String(row[idx("pon")] || "").trim();
    const cardRaw = oltType === "chassis" ? String(row[idx("card")] || "").trim() : slotTujuan;
    const sn = String(row[idx("sn")] || "").trim().substring(0, 16);
    const vlanInet = String(row[idx("vlan inet")] || "").trim();
    const vlanTr = String(row[idx("vlan tr")] || "").trim();
    const description = String(row[idx("ont description")] || row[idx("nama")] || "").trim();
    const pppoeUsername = String(row[idx("user ppoe")] || "").trim();
    const pppoePassword = String(row[idx("password ppoe")] || "").trim();
    if (!/^\d+$/.test(ponRaw) || Number(ponRaw) < 1 || !sn || !/^\d+$/.test(vlanInet) || Number(vlanInet) < 1 || Number(vlanInet) > 4094 || !/^\d+$/.test(vlanTr) || Number(vlanTr) < 1 || Number(vlanTr) > 4094) {
      invalid++;
      continue;
    }
    const slot = Number(cardRaw);
    const port = Number(ponRaw) - 1;
    if (seenSn.has(sn.toUpperCase())) { duplicateSn++; continue; }
    seenSn.add(sn.toUpperCase());
    const portKey = slot + ":" + port;
    const onuId = nextOnuByPort.get(portKey) || 0;
    nextOnuByPort.set(portKey, onuId + 1);
    const safeDescription = (description || sn).replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
    parsedData.push({ slot, port, onuId, sn, vlanInet, vlanTr, description: safeDescription, pppoeUsername, pppoePassword });
    ponCounts.set(port, (ponCounts.get(port) || 0) + 1);
    const status = String(row[idx("status")] || "").toLowerCase();
    if (status.includes("online")) online++;
  }

  if (!parsedData.length) {
    document.getElementById("csvNotice").textContent = "Tidak ada baris ONU valid. Periksa PON, SN, VLAN INET, dan VLAN TR.";
    return;
  }
  const ponSummary = [...ponCounts.entries()].sort((a,b)=>a[0]-b[0]).map(([port,count]) => "PON " + (port+1) + ": " + count).join(" · ");
  document.getElementById("summaryText").innerHTML =
    '<div class="metric-card"><span>ONU Valid</span><strong>'+parsedData.length.toLocaleString("id-ID")+'</strong></div>'+
    '<div class="metric-card"><span>PON Terpakai</span><strong>'+ponCounts.size+'</strong></div>'+
    '<div class="metric-card offline"><span>SN Duplikat Dilewati</span><strong>'+duplicateSn+'</strong></div>'+
    '<div class="metric-card"><span>Baris Tidak Valid</span><strong>'+invalid+'</strong></div>'+
    '<div class="metric-card"><span>Header CSV di Baris</span><strong>'+(headerIdx+1)+'</strong></div>'+
    '<div class="metric-card"><span>ONU per PON</span><strong style="font-size:12px;line-height:1.5">'+ponSummary+'</strong></div>';
  document.getElementById("summaryBox").hidden = false;
  const notice = document.getElementById("csvNotice");
  notice.textContent = duplicateSn || invalid
    ? "Perhatian: " + duplicateSn + " SN duplikat dilewati dan " + invalid + " baris tidak valid dilewati. Periksa ringkasan sebelum generate."
    : "CSV berhasil dibaca. ONU ID dibuat mulai 0 pada setiap PON.";
}

function generateAndDownload() {
  if (!parsedData.length) {
    document.getElementById("csvNotice").textContent = "Belum ada data ONU untuk dibuatkan script.";
    return;
  }
  const ordered = [...parsedData].sort((a,b) => a.slot-b.slot || a.port-b.port || a.onuId-b.onuId);
  const slots = [...new Set(ordered.map(d => d.slot))].sort((a,b) => a-b);
  const pppoeVlan = globalConfig.vlanStasiun;
  const translateEnabled = document.getElementById("enableVlanTranslation")?.checked === true;
  const quote = value => String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  let script = "";

  // BLOK 1: ONT ADD, dikelompokkan per card.
  for (const slot of slots) {
    script += "interface gpon 0/" + slot + "\n";
    for (const d of ordered.filter(x => x.slot === slot)) {
      script += "ont add " + d.port + " " + d.onuId + " sn-auth " + d.sn +
        " omci ont-lineprofile-name SURGE_LP_ALLVLAN ont-srvprofile-name SURGE_SP_ALLVLAN desc \"" + quote(d.description) + "\"\n";
    }
    script += "\n";
  }

  // BLOK 2: DHCP dan TR-069.
  for (const slot of slots) {
    script += "interface gpon 0/" + slot + "\n";
    for (const d of ordered.filter(x => x.slot === slot)) {
      script += "ont ipconfig " + d.port + " " + d.onuId + " ip-index 1 dhcp vlan " + d.vlanTr + " priority 0\n" +
        "ont tr069-server-config " + d.port + " " + d.onuId + " profile-name YINET_ACS\n";
    }
    script += "\n";
  }

  // BLOK 3: WAN PPPoE.
  for (const slot of slots) {
    script += "interface gpon 0/" + slot + "\n";
    for (const d of ordered.filter(x => x.slot === slot)) {
      script += "ont ipconfig " + d.port + " " + d.onuId + " pppoe vlan " + pppoeVlan +
        " priority 0 user-account username " + d.pppoeUsername + " password " + d.pppoePassword + "\n" +
        "ont internet-config " + d.port + " " + d.onuId + " ip-index 0\n" +
        "ont wan-config " + d.port + " " + d.onuId + " ip-index 0 profile-name pppoe_wan\n" +
        "ont policy-route-config " + d.port + " " + d.onuId + " profile-name pppoe_policy\n" +
        "ont port route " + d.port + " " + d.onuId + " eth 1-4 enable\n\n";
    }
  }

  // Satu kali quit sebelum service-port.
  script += "quit\n\n";

  // BLOK 4: SERVICE-PORT.
  for (const d of ordered) {
    const path = "gpon 0/" + d.slot + "/" + d.port;
    script += "service-port vlan " + d.vlanTr + " " + path + " ont " + d.onuId +
      " gemport 1 multi-service user-vlan " + d.vlanTr + " tag-transform translate\n" +
      "service-port vlan " + (translateEnabled ? pppoeVlan : d.vlanInet) + " " + path + " ont " + d.onuId +
      " gemport 1 multi-service user-vlan " + d.vlanInet + " tag-transform translate\n";
  }

  // BLOK 5: VLAN TRANSLATION diletakkan paling bawah, setelah seluruh service-port.
  if (translateEnabled) {
    const translations = new Map();
    for (const d of ordered) {
      const currentVlan = String(d.vlanInet);
      if (currentVlan === String(pppoeVlan)) continue;
      const key = d.slot + ":" + d.port + ":" + currentVlan;
      if (!translations.has(key)) translations.set(key, {slot:d.slot, port:d.port, currentVlan});
    }
    if (translations.size) script += "\\n";
    for (const item of translations.values()) {
      script += "service-port modify-vlan port 0/" + item.slot + "/" + item.port +
        " current-vlan " + item.currentVlan + " to-vlan " + pppoeVlan + "\\n" + "y\\n";
    }
  }
  downloadTextFile(script, globalConfig.hostname + ".txt");
}

function downloadTextFile(content, filename) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
