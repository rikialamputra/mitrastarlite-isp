// --- 1. CONFIG FIREBASE KAMU ---
// (JANGAN LUPA ISI SESUAI FIREBASE KAMU)
const firebaseConfig = {
    apiKey: "AIzaSyBDXdFrGmoX-qWVMyPC9Bj61KTTJOaoVrM",
    authDomain: "mitrastarlite-isp.vercel.app",
    projectId: "olt-isp",
    storageBucket: "olt-isp.firebasestorage.app",
    messagingSenderId: "239840188680",
    appId: "1:239840188680:web:4359bc41ba142b078074bd",
    measurementId: "G-90NQQR0B7K"
};
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// --- 2. URL API APPS SCRIPT ---
// (JANGAN LUPA PASTE URL WEB APP TERBARU KAMU DI SINI)
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzFHIRNRhYoki7GlCXDR50mP9m91jw0EHi29Rm76vW7EzNecnRV1518nc4c4Fgwfrn5/exec';

let globalData = [];

// --- 3. SISTEM LOGIN (Passwordless Khusus @weave.co.id) ---
const actionCodeSettings = {
    url: window.location.href,
    handleCodeInApp: true,
};

const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('emailInput').value;
        const messageDiv = document.getElementById('login-message');

        if (!email.endsWith("@weave.co.id")) {
            messageDiv.className = "text-danger mt-3 text-center";
            messageDiv.innerText = "Akses Ditolak! Gunakan email @weave.co.id";
            messageDiv.style.display = 'block';
            return;
        }

        messageDiv.className = "text-info mt-3 text-center";
        messageDiv.innerText = "Mengirim link login...";
        messageDiv.style.display = 'block';

        firebase.auth().sendSignInLinkToEmail(email, actionCodeSettings)
            .then(() => {
                window.localStorage.setItem('emailForSignIn', email);
                messageDiv.className = "text-success mt-3 text-center";
                messageDiv.innerText = "Link login berhasil dikirim! Silakan cek Inbox/Spam.";
            })
            .catch((error) => {
                messageDiv.className = "text-danger mt-3 text-center";
                messageDiv.innerText = "Gagal mengirim link: " + error.message;
            });
    });
}

if (firebase.auth().isSignInWithEmailLink(window.location.href)) {
    let email = window.localStorage.getItem('emailForSignIn');
    if (!email) email = window.prompt('Tolong konfirmasi email kamu untuk verifikasi:');

    if (email) {
        firebase.auth().signInWithEmailLink(email, window.location.href)
            .then(() => {
                window.localStorage.removeItem('emailForSignIn');
                window.history.replaceState(null, null, window.location.pathname);
            }).catch((error) => alert("Link login tidak valid atau sudah kedaluwarsa."));
    }
}

const logoutButton = document.getElementById('btn-logout');
if (logoutButton) logoutButton.addEventListener('click', () => firebase.auth().signOut());

firebase.auth().onAuthStateChanged((user) => {
    if (user && user.email.endsWith("@weave.co.id")) {
        document.getElementById('login-page').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        document.getElementById('user-email').innerText = user.email;
        fetchData();
    } else {
        document.getElementById('login-page').style.display = 'block';
        document.getElementById('dashboard').style.display = 'none';
    }
});

// --- 4. AMBIL DATA DARI SHEET & RENDER ---
async function fetchData() {
    try {
        const response = await fetch(SCRIPT_URL);
        if (!response.ok) throw new Error("Gagal terhubung ke server Google");
        globalData = await response.json();

        renderTable();
        renderCharts();
        renderOperationalModules();
    } catch (error) {
        console.error("Error fetching data: ", error);
        const tableBody = document.getElementById('tableBody');
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="7" class="text-danger fw-bold">Gagal mengambil data. Cek URL Web App.</td></tr>';
        throw error;
    }
}

// --- 5. RENDER TABEL & FUNGSI BADGE WARNA ---
function getBadge(statusText) {
    if (!statusText) return '<span class="badge bg-secondary">-</span>';
    let text = statusText.toString().trim().toLowerCase();
    if (text === 'up' || text === 'done') return `<span class="badge bg-success">${statusText}</span>`;
    if (text === 'down') return `<span class="badge bg-danger">${statusText}</span>`;
    if (text === 'ny') return `<span class="badge bg-warning text-dark">${statusText}</span>`;
    return `<span class="badge bg-info text-dark">${statusText}</span>`;
}

function renderTable(dataToRender = globalData) {
    const tableBody = document.getElementById('tableBody');
    if (!tableBody) return;
    let tbody = '';
    if (dataToRender.length === 0) {
        tbody = '<tr><td colspan="7" class="text-center text-muted">Data tidak ditemukan.</td></tr>';
    } else {
        dataToRender.forEach((row) => {
            let originalIndex = globalData.indexOf(row); // Cari index asli untuk tombol detail/edit
            tbody += `
                <tr>
                    <td>${row['Nama ISP']}</td>
                    <td>${row['POP']}</td>
                    <td>${row['Brand OLT']}</td>
                    <td>${row['IP']}</td>
                    <td>${getBadge(row['Status NMS'])}</td>
                    <td>${getBadge(row['Traffic(migrasi/belum)'])}</td>
                    <td>
                        <button class="btn btn-primary btn-sm mb-1" onclick="showDetail(${originalIndex})">Detail</button>
                        <!-- INI TOMBOL EDITNYA BRO -->
                        <button class="btn btn-warning btn-sm mb-1" onclick="showForm(true, ${originalIndex})">Edit</button>
                        <button class="btn btn-danger btn-sm mb-1" onclick="deleteData(${row.row_index})">Hapus</button>
                    </td>
                </tr>
            `;
        });
    }
    tableBody.innerHTML = tbody;
}

// Menampilkan Detail di Modal
function showDetail(index) {
    const data = globalData[index];
    const modalBody = `
        <div class="row">
            <div class="col-md-6">
                <p><strong>Nama ISP:</strong> ${data['Nama ISP']}</p>
                <p><strong>POP:</strong> ${data['POP']}</p>
                <p><strong>Alamat:</strong> ${data['Alamat']}</p>
                <p><strong>Koordinat:</strong> <a href="https://maps.google.com/?q=${data['Koordinat longlat']}" target="_blank">${data['Koordinat longlat']}</a></p>
                <p><strong>Hostname:</strong> ${data['Hostname']}</p>
                <p><strong>IP:</strong> ${data['IP']}</p>
                <p><strong>Nama Stasiun:</strong> ${data['Nama stasiun']} (${data['Kode stasiun']})</p>
            </div>
            <div class="col-md-6">
                <p><strong>Tipe OLT:</strong> ${data['Tipe OLT']} (${data['Brand OLT']})</p>
                <p><strong>Jumlah Card:</strong> ${data['Jumlah Card']}</p>
                <p><strong>Status NMS:</strong> ${getBadge(data['Status NMS'])}</p>
                <p><strong>Billing:</strong> ${getBadge(data['Billing'])}</p>
                <p><strong>Traffic:</strong> ${getBadge(data['Traffic(migrasi/belum)'])}</p>
                <p><strong>Jumlah ONT Regist:</strong> ${data['Jumlah ont regist']}</p>
                <p><strong>Remarks:</strong> ${data['Remarks']}</p>
            </div>
        </div>
        ${data['Link Foto Perangkat'] ? `<hr><a href="${data['Link Foto Perangkat']}" target="_blank" class="btn btn-outline-info w-100">Lihat Foto Perangkat 📸</a>` : ''}
    `;
    document.getElementById('modalBody').innerHTML = modalBody;
    document.getElementById('modalTitle').innerText = `Detail IP: ${data['IP']}`;
    new bootstrap.Modal(document.getElementById('detailModal')).show();
}

// --- 6. RENDER GRAFIK ANALISA ---
let chartISPInstance = null;
let chartNMSInstance = null;
let chartBillingInstance = null;

function renderCharts() {
    let ispCount = {}, nmsCount = {}, billingCount = {};
    globalData.forEach(row => {
        let isp = row['Nama ISP'] || 'Unknown'; ispCount[isp] = (ispCount[isp] || 0) + 1;
        let nms = row['Status NMS'] || 'Unknown'; nmsCount[nms] = (nmsCount[nms] || 0) + 1;
        let bill = row['Billing'] || 'Unknown'; billingCount[bill] = (billingCount[bill] || 0) + 1;
    });

    if (chartISPInstance) chartISPInstance.destroy();
    if (chartNMSInstance) chartNMSInstance.destroy();
    if (chartBillingInstance) chartBillingInstance.destroy();

    const ispCanvas = document.getElementById('chartISP');
    const nmsCanvas = document.getElementById('chartNMS');
    const billingCanvas = document.getElementById('chartBilling');
    if (ispCanvas) chartISPInstance = new Chart(ispCanvas, {
        type: 'doughnut',
        data: { labels: Object.keys(ispCount), datasets: [{ data: Object.values(ispCount), backgroundColor: ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#0dcaf0'] }] }
    });
    if (nmsCanvas) chartNMSInstance = new Chart(nmsCanvas, {
        type: 'pie',
        data: { labels: Object.keys(nmsCount), datasets: [{ data: Object.values(nmsCount), backgroundColor: ['#198754', '#dc3545'] }] }
    });
    if (billingCanvas) chartBillingInstance = new Chart(billingCanvas, {
        type: 'bar',
        data: { labels: Object.keys(billingCount), datasets: [{ label: 'Jumlah', data: Object.values(billingCount), backgroundColor: '#0d6efd' }] },
        options: { scales: { y: { beginAtZero: true } } }
    });
}

// --- 7. LOGIC HAPUS DATA ---
async function deleteData(rowIndex) {
    if (confirm("Yakin ingin menghapus data ini dari database sheet?")) {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `action=delete&row_index=${rowIndex}`
        });
        fetchData();
    }
}

// --- 8. FITUR LIVE SEARCH ---
const searchInput = document.getElementById('searchInput');
if (searchInput) {
    searchInput.addEventListener('input', function () {
        const keyword = this.value.toLowerCase();
        const filteredData = globalData.filter(row => {
            return Object.values(row).some(val => String(val).toLowerCase().includes(keyword));
        });
        renderTable(filteredData);
    });
}

// --- 9. FUNGSI TAMBAH DAN EDIT DATA ---
let formModalInstance;

window.showForm = function (isEdit = false, index = null) {
    if (!formModalInstance) {
        formModalInstance = new bootstrap.Modal(document.getElementById('formModal'));
    }

    const form = document.getElementById('dataForm');
    form.reset();

    if (isEdit) {
        document.getElementById('formModalTitle').innerText = "Edit Data Perangkat";
        document.getElementById('formAction').value = "update";
        document.getElementById('btnSubmitForm').innerText = "Update Data";

        const data = globalData[index];
        document.getElementById('formRowIndex').value = data.row_index;

        document.getElementById('f_nama_isp').value = data['Nama ISP'] || '';
        document.getElementById('f_pop').value = data['POP'] || '';
        document.getElementById('f_brand_olt').value = data['Brand OLT'] || '';
        document.getElementById('f_tipe_olt').value = data['Tipe OLT'] || '';
        document.getElementById('f_hostname').value = data['Hostname'] || '';
        document.getElementById('f_ip').value = data['IP'] || '';
        document.getElementById('f_nama_stasiun').value = data['Nama stasiun'] || '';
        document.getElementById('f_kode_stasiun').value = data['Kode stasiun'] || '';

        if (data['Status NMS']) document.getElementById('f_status_nms').value = data['Status NMS'];
        if (data['Billing']) document.getElementById('f_billing').value = data['Billing'];
        if (data['Traffic(migrasi/belum)']) document.getElementById('f_traffic').value = data['Traffic(migrasi/belum)'];

        document.getElementById('f_jumlah_card').value = data['Jumlah Card'] || '';
        document.getElementById('f_jumlah_ont').value = data['Jumlah ont regist'] || '';
        document.getElementById('f_koordinat').value = data['Koordinat longlat'] || '';
        document.getElementById('f_alamat').value = data['Alamat'] || '';
        document.getElementById('f_remarks').value = data['Remarks'] || '';
        document.getElementById('f_link_foto').value = data['Link Foto Perangkat'] || '';
    } else {
        document.getElementById('formModalTitle').innerText = "Tambah Data Baru";
        document.getElementById('formAction').value = "insert";
        document.getElementById('btnSubmitForm').innerText = "Simpan Data";
    }

    formModalInstance.show();
}

const dataForm = document.getElementById('dataForm');
if (dataForm) {
    dataForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSubmit = document.getElementById('btnSubmitForm');
        const originalText = btnSubmit.innerText;
        btnSubmit.innerText = "Menyimpan...";
        btnSubmit.disabled = true;

        const formData = new URLSearchParams();
        formData.append('action', document.getElementById('formAction').value);
        formData.append('row_index', document.getElementById('formRowIndex').value);

        formData.append('nama_isp', document.getElementById('f_nama_isp').value);
        formData.append('pop', document.getElementById('f_pop').value);
        formData.append('brand_olt', document.getElementById('f_brand_olt').value);
        formData.append('tipe_olt', document.getElementById('f_tipe_olt').value);
        formData.append('hostname', document.getElementById('f_hostname').value);
        formData.append('ip', document.getElementById('f_ip').value);
        formData.append('nama_stasiun', document.getElementById('f_nama_stasiun').value);
        formData.append('kode_stasiun', document.getElementById('f_kode_stasiun').value);
        formData.append('status_nms', document.getElementById('f_status_nms').value);
        formData.append('billing', document.getElementById('f_billing').value);
        formData.append('traffic', document.getElementById('f_traffic').value);
        formData.append('jumlah_card', document.getElementById('f_jumlah_card').value);
        formData.append('jumlah_ont', document.getElementById('f_jumlah_ont').value);
        formData.append('koordinat', document.getElementById('f_koordinat').value);
        formData.append('alamat', document.getElementById('f_alamat').value);
        formData.append('remarks', document.getElementById('f_remarks').value);
        formData.append('link_foto', document.getElementById('f_link_foto').value);

        try {
            await fetch(SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData.toString()
            });
            formModalInstance.hide();
            fetchData();
            alert("Data berhasil disimpan!");
        } catch (error) {
            console.error("Error saving data:", error);
            alert("Gagal menyimpan data.");
        } finally {
            btnSubmit.innerText = originalText;
            btnSubmit.disabled = false;
        }
    });
}

// --- 10. FITUR SINKRONISASI DATABASE ---
const btnSync = document.getElementById('btn-sync');
if (btnSync) {
    btnSync.addEventListener('click', async function () {
        const btn = this;
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳ Menarik Data...';
        btn.disabled = true;
        if (document.getElementById('searchInput')) document.getElementById('searchInput').value = '';

        try {
            await fetchData();
            btn.innerHTML = '✅ Berhasil!';
            btn.classList.replace('btn-info', 'btn-success');
        } catch (error) {
            btn.innerHTML = '❌ Gagal!';
            btn.classList.replace('btn-info', 'btn-danger');
        } finally {
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
                btn.className = 'btn btn-info btn-sm text-white me-2';
            }, 1500);
        }
    });
}

// --- 11. FITUR TO DO LIST LAPANGAN ---
let todos = JSON.parse(localStorage.getItem('weave_todos')) || [];

function renderTodos() {
    const list = document.getElementById('todoList');
    if (!list) return;
    list.innerHTML = '';
    let pendingCount = 0;

    todos.forEach((todo, index) => {
        if (!todo.done) pendingCount++;
        list.innerHTML += `
            <li class="list-group-item d-flex justify-content-between align-items-center ${todo.done ? 'bg-light' : ''}">
                <div class="d-flex align-items-center">
                    <input class="form-check-input me-3" type="checkbox" ${todo.done ? 'checked' : ''} onchange="toggleTodo(${index})">
                    <span style="${todo.done ? 'text-decoration: line-through; color: #adb5bd;' : ''}">
                        ${todo.text}
                    </span>
                </div>
                <button class="btn btn-sm btn-outline-danger border-0" onclick="deleteTodo(${index})">🗑️</button>
            </li>
        `;
    });
    if (document.getElementById('todoCount')) document.getElementById('todoCount').innerText = `${pendingCount} Sisa`;
}

const btnTodoAdd = document.getElementById('btnTodoAdd');
if (btnTodoAdd) {
    btnTodoAdd.addEventListener('click', () => {
        const input = document.getElementById('todoInput');
        if (input.value.trim() !== '') {
            todos.push({ text: input.value.trim(), done: false });
            localStorage.setItem('weave_todos', JSON.stringify(todos));
            input.value = '';
            renderTodos();
        }
    });
}

const todoInput = document.getElementById('todoInput');
if (todoInput) {
    todoInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') document.getElementById('btnTodoAdd').click();
    });
}

window.toggleTodo = function (index) {
    todos[index].done = !todos[index].done;
    localStorage.setItem('weave_todos', JSON.stringify(todos));
    renderTodos();
}

window.deleteTodo = function (index) {
    if (confirm("Hapus tugas ini?")) {
        todos.splice(index, 1);
        localStorage.setItem('weave_todos', JSON.stringify(todos));
        renderTodos();
    }
}
// --- 12. GENERATOR SCRIPT HWI ---

let parsedData = [];
let globalConfig = {};

document.addEventListener('DOMContentLoaded', () => {
    const previewBtn = document.getElementById('previewBtn');
    const generateBtn = document.getElementById('generateBtn');

    if (previewBtn) {
        previewBtn.addEventListener('click', function () {
            const hostname = document.getElementById('hostname').value.trim();
            const slotTujuan = document.getElementById('slotTujuan').value.trim();
            const vlanStasiun = document.getElementById('vlanStasiun').value.trim();
            const csvFile = document.getElementById('csvFile').files[0];

            if (!hostname || !slotTujuan || !vlanStasiun || !csvFile) {
                alert("Harap lengkapi form 1-3 dan pilih file CSV!");
                return;
            }

            const reader = new FileReader();
            reader.onload = function (event) {
                const text = event.target.result;
                processAndPreviewCSV(text, hostname, slotTujuan, vlanStasiun);
            };
            reader.readAsText(csvFile);
        });
    }

    if (generateBtn) {
        generateBtn.addEventListener('click', function () {
            generateAndDownload();
        });
    }
});

function processAndPreviewCSV(csvText, hostname, slotTujuan, vlanStasiun) {
    parsedData = [];
    globalConfig = { hostname, slotTujuan, vlanStasiun };

    // 1. Bersihkan karakter null dan ganti baris (format sistem)
    csvText = csvText.replace(/\x00/g, '').replace(/\r/g, '');
    const lines = csvText.split('\n');

    if (lines.length < 2) {
        alert("File CSV kosong atau format tidak sesuai.");
        return;
    }

    let headerLineIdx = -1;
    let headers = [];

    // 2. TEKNIK BARBAR: Hapus paksa SEMUA tanda kutip ("), lalu potong pakai koma
    for (let i = 0; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        // Buang kutip, pisah koma, ubah ke huruf kecil semua
        let cleanCols = lines[i].replace(/"/g, '').split(',').map(c => c.trim().toLowerCase());

        // Cari baris yang punya kolom wajib
        if (cleanCols.includes('port') && (cleanCols.includes('onu id') || cleanCols.includes('onuid')) && cleanCols.includes('sn')) {
            headerLineIdx = i;
            headers = cleanCols;
            break;
        }
    }

    // Jika error ini masih muncul, berarti kamu belum hapus Cache!
    if (headerLineIdx === -1) {
        alert("Gagal membaca CSV! Wajib hapus Cache: Tekan Ctrl + F5 di keyboard kamu, lalu coba upload lagi.");
        return;
    }

    // Pemetaan Index
    const portIdx = headers.indexOf('port');
    const onuIdIdx = headers.indexOf('onu id') !== -1 ? headers.indexOf('onu id') : headers.indexOf('onuid');
    const snIdx = headers.indexOf('sn');

    let aliasIdx = headers.indexOf('alias');
    if (aliasIdx === -1) aliasIdx = headers.indexOf('name');

    let statusIdx = headers.indexOf('status');
    if (statusIdx === -1) statusIdx = headers.indexOf('operation status');

    let totalOnline = 0;
    let totalOffline = 0;
    let totalProcessed = 0;

    // 3. Proses Data
    for (let i = headerLineIdx + 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        // Terapkan teknik barbar ke baris data
        let row = lines[i].replace(/"/g, '').split(',').map(c => c.trim());

        const port = row[portIdx] || '';
        const onuId = row[onuIdIdx] || '';
        let snFull = row[snIdx] || '';
        let alias = aliasIdx !== -1 && row[aliasIdx] ? row[aliasIdx] : '';
        let status = statusIdx !== -1 && row[statusIdx] ? row[statusIdx] : '';

        // Abaikan baris yang tidak lengkap
        if (!snFull || !port || !onuId) continue;

        const sn16 = snFull.substring(0, 16);

        // Antisipasi kolom alias yang berisi strip-strip dari Huawei
        if (!alias || alias === "" || alias.includes("--")) {
            alias = sn16;
        }

        if (status.toLowerCase().includes('online')) {
            totalOnline++;
        } else {
            totalOffline++;
        }

        parsedData.push({ port, onuId, sn: sn16, alias });
        totalProcessed++;
    }

    const summaryText = document.getElementById('summaryText');
    if (summaryText) {
        summaryText.innerHTML = `
            <strong>Mulai Baca CSV dari Baris :</strong> ${headerLineIdx + 1}<br>
            <strong>Total ONU Terdeteksi :</strong> ${totalProcessed} perangkat<br>
            <span style="color: #27ae60;"><strong>Status (Online) :</strong> ${totalOnline} ONU</span><br>
            <span style="color: #e74c3c;"><strong>Status (Offline/Lainnya) :</strong> ${totalOffline} ONU</span>
        `;
        document.getElementById('summaryBox').style.display = 'block';
    }
}

// Generate & Download Script
function generateAndDownload() {
    if (parsedData.length === 0) {
        alert("Tidak ada data untuk di-generate!");
        return;
    }

    let finalScript = "";

    parsedData.forEach(data => {
        const scriptBlock = `
interface gpon 0/${globalConfig.slotTujuan}
ont add ${data.port} ${data.onuId} sn-auth ${data.sn} omci ont-lineprofile-name SURGE_LP_ALLVLAN ont-srvprofile-name SURGE_SP_ALLVLAN desc ${data.alias}
ont ipconfig ${data.port} ${data.onuId} ip-index 1 dhcp vlan 81 priority 0
ont tr069-server-config ${data.port} ${data.onuId} profile-name YINET_ACS
 ont internet-config ${data.port} ${data.onuId} ip-index 0
 ont wan-config ${data.port} ${data.onuId} ip-index 0 profile-name pppoe_wan
 ont policy-route-config ${data.port} ${data.onuId} profile-name pppoe_policy
 ont port route ${data.port} ${data.onuId} eth 1-4  enable
quit
service-port vlan 81 gpon 0/${globalConfig.slotTujuan}/${data.port} ont ${data.onuId} gemport 1 multi-service user-vlan 81 tag-transform translate
service-port vlan ${globalConfig.vlanStasiun} gpon 0/${globalConfig.slotTujuan}/${data.port} ont ${data.onuId} gemport 1 multi-service user-vlan ${globalConfig.vlanStasiun} tag-transform translate

`;
        finalScript += scriptBlock + '\n';
    });

    downloadTextFile(finalScript, `${globalConfig.hostname}.txt`);
}

function downloadTextFile(content, filename) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// --- 13. OPERATIONAL MODULES: MONITORING, POP & ANALYTICS ---
let analyticsPopChart=null, analyticsBrandChart=null, inventoryFiltersBound=false;
function opsText(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function opsStatus(v){const s=String(v??'').trim().toLowerCase();if(['up','online','connected','ok'].includes(s))return'up';if(['down','offline','disconnected'].includes(s))return'down';return'other';}
function opsNumber(v){const n=Number(String(v??'').replace(/[^0-9.-]/g,''));return Number.isFinite(n)?n:0;}
function opsGroups(rows,field){return rows.reduce((o,r)=>{const k=String(r[field]||'Belum ditentukan').trim();(o[k]||(o[k]=[])).push(r);return o;},{});}
function renderOperationalModules(){
 const rows=globalData||[], online=rows.filter(r=>opsStatus(r['Status NMS'])==='up').length, offline=rows.filter(r=>opsStatus(r['Status NMS'])==='down').length, pops=opsGroups(rows,'POP'), ont=rows.reduce((s,r)=>s+opsNumber(r['Jumlah ont regist']),0);
 const put=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
 put('kpiTotalOlt',rows.length.toLocaleString('id-ID'));put('kpiOnline',online.toLocaleString('id-ID'));put('kpiOffline',offline.toLocaleString('id-ID'));put('kpiPop',Object.keys(pops).filter(x=>x!=='Belum ditentukan').length.toLocaleString('id-ID'));put('kpiOnt',ont.toLocaleString('id-ID'));
 put('monitoringUpdated','Snapshot · '+new Date().toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'}));
 renderPopTable(pops);renderInventoryPopOptions(pops);renderAnalyticsCharts(pops);
 if(!inventoryFiltersBound){
  const search=document.getElementById('searchInput'), pop=document.getElementById('inventoryPopFilter'), status=document.getElementById('inventoryStatusFilter');
  const apply=()=>{const q=(search?.value||'').trim().toLowerCase(),p=pop?.value||'',st=status?.value||'';renderTable(rows.filter(r=>(!q||Object.values(r).some(v=>String(v??'').toLowerCase().includes(q)))&&(!p||String(r['POP']||'').trim()===p)&&(!st||(st==='other'?opsStatus(r['Status NMS'])==='other':opsStatus(r['Status NMS'])===st))));};
  search?.addEventListener('input',apply);pop?.addEventListener('change',apply);status?.addEventListener('change',apply);inventoryFiltersBound=true;
 }
}
function renderInventoryPopOptions(groups){const el=document.getElementById('inventoryPopFilter');if(!el)return;const old=el.value;el.innerHTML='<option value="">Semua POP</option>'+Object.keys(groups).sort((a,b)=>a.localeCompare(b,'id')).map(n=>'<option value="'+opsText(n)+'">'+opsText(n)+'</option>').join('');el.value=old;}
function renderPopTable(groups){
 const body=document.getElementById('popTableBody');if(!body)return;const names=Object.keys(groups).sort((a,b)=>a.localeCompare(b,'id'));const label=document.getElementById('popCountLabel');if(label)label.textContent=names.length+' lokasi';
 if(!names.length){body.innerHTML='<tr><td colspan="7" class="text-center text-muted">Belum ada data POP.</td></tr>';return;}
 body.innerHTML=names.map(n=>{const d=groups[n],up=d.filter(r=>opsStatus(r['Status NMS'])==='up').length,down=d.filter(r=>opsStatus(r['Status NMS'])==='down').length,ont=d.reduce((s,r)=>s+opsNumber(r['Jumlah ont regist']),0),isp=[...new Set(d.map(r=>r['Nama ISP']).filter(Boolean))].join(', ')||'-',ips=d.map(r=>r['IP']).filter(Boolean).join(', ')||'-';return '<tr><td class="fw-semibold">'+opsText(n)+'</td><td>'+opsText(isp)+'</td><td>'+d.length+'</td><td><span class="ops-status-up">'+up+'</span></td><td><span class="ops-status-down">'+down+'</span></td><td>'+ont.toLocaleString('id-ID')+'</td><td class="ops-ip-list">'+opsText(ips)+'</td></tr>';}).join('');
}
function renderAnalyticsCharts(groups){
 if(typeof Chart==='undefined')return;const pc=document.getElementById('chartAnalyticsPop'),bc=document.getElementById('chartAnalyticsBrand');const pn=Object.keys(groups).sort((a,b)=>groups[b].length-groups[a].length).slice(0,12),pv=pn.map(n=>groups[n].length),brands=opsGroups(globalData,'Brand OLT'),bn=Object.keys(brands).sort((a,b)=>brands[b].length-brands[a].length),bv=bn.map(n=>brands[n].length),tc=document.documentElement.dataset.theme==='light'?'#52657a':'#a9bed1';
 if(analyticsPopChart)analyticsPopChart.destroy();if(analyticsBrandChart)analyticsBrandChart.destroy();
 if(pc)analyticsPopChart=new Chart(pc,{type:'bar',data:{labels:pn,datasets:[{label:'Jumlah perangkat',data:pv,backgroundColor:'#27bfd0',borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,ticks:{precision:0,color:tc},grid:{color:'rgba(140,160,180,.12)'}},y:{ticks:{color:tc},grid:{display:false}}}}});
 if(bc)analyticsBrandChart=new Chart(bc,{type:'doughnut',data:{labels:bn,datasets:[{data:bv,backgroundColor:['#28c5d5','#83d65a','#638cf5','#f2b84b','#a77cf4','#ef7c86','#5eabb4'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:tc,padding:14,usePointStyle:true}}}}});
}
// Render ToDo List
if (typeof renderTodos === "function") {
    renderTodos();
}
