const $ = (selector) => document.querySelector(selector);

const vendorEl = $("#vendor");
const modelEl = $("#model");
const modeEl = $("#mode");
const modeWrap = $("#mode-wrap");
const fieldsEl = $("#fields");
const outputEl = $("#output");
const lineNumbersEl = $("#line-numbers");
const generateBtn = $("#generate");
const copyBtn = $("#copy");
const noticeEl = $("#notice");
const lineCountEl = $("#line-count");
const copyStatusEl = $("#copy-status");
const descriptionEl = $("#preview-description");
const terminalTitleEl = $("#terminal-title");

const fieldDefinitions = {
  hostname: { label: "Hostname", placeholder: "OLT-POP-01", full: true },
  ip_address: { label: "IP Address", placeholder: "10.10.10.2" },
  gateway: { label: "Gateway", placeholder: "10.10.10.1" },
  vlan_stasiun: { label: "VLAN Stasiun", placeholder: "200" },
  CIDR: { label: "CIDR", placeholder: "24" },
  ex_ip_address: { label: "IP Existing", placeholder: "10.10.10.2", full: true },
  netmask: { label: "Netmask", placeholder: "255.255.255.0" }
};

const templates = {
  huawei: {
    pizza: (p) => `enable
config
sysname ${p.hostname}
system user password security mode basic
system user password security-length 8
dhcp option82 enable
y

pitp enable pmode
xpon port ont-auto-find all enable
gpon ont home-gateway config-method omci

sysman service telnet enable
sysman service ssh enable
sysman server source telnet any
sysman server source ssh any
sysman server source snmp any-interface
sysman server source web-proxy any-interface

link-aggregation 0/2 0 egress-ingress workmode lacp-static
link-aggregation add-member 0/2/0 0/2 1

lldp enable

lldp enable port 0/2

vlan 39,81,${p.vlan_stasiun} smart
y

port vlan 39,81,${p.vlan_stasiun} 0/2 0
y

interface vlanif39
ip address ${p.ip_address} ${p.CIDR}

quit

ip route-static 0.0.0.0 0.0.0.0 ${p.gateway}

timezone GMT+ 07:00
ntp-service unicast-server 103.172.24.230

snmp-agent sys-info version v2

sysman server source snmp any-interface

snmp-agent trap enable standard
snmp-agent trap-format private
snmp-agent trap source vlanif 39

snmp-agent community read St@rl1te

snmp-agent community write St@rl1te

snmp-agent target-host trap-hostname NCE-FAN1 address 10.96.6.35 trap-paramsname ABC
snmp-agent target-host trap-hostname NCE-FAN2 address 10.96.6.36 trap-paramsname ABD
snmp-agent target-host trap-paramsname ABC v2c securityname St@rl1te

snmp-agent target-host trap-paramsname ABD v2c securityname St@rl1te

terminal user name

adminstr
starlite123#
starlite123#
root
3
1
user
n

dba-profile add profile-name SURGE_INET type4 max 1024000

dba-profile add profile-name SURGE_TR069 type4 max 2048

ont-srvprofile gpon profile-name SURGE_SP_ALLVLAN

ont-port pots adaptive 32 eth adaptive 8

transparent enable

commit

quit

ont tr069-server-profile add profile-name SURGE_ACS url http://10.128.120.128:7547 user acsprod acsprod@weave

ont tr069-server-profile add profile-name YINET_ACS url https://acs.starliteindonesia.com:39925/ user ACS_Starl1te Starlit3ACS@25!

ont-lineprofile gpon profile-name SURGE_LP_ALLVLAN

omcc encrypt on
tr069-management enable
tr069-management ip-index 1
tcont 1 dba-profile-id 10
gem add 1 eth tcont 1 encrypt on

gem mapping 1 0 priority 0

gem mapping 1 1 priority 1

gem mapping 1 2 priority 2

gem mapping 1 3 priority 3

gem mapping 1 4 priority 4

gem mapping 1 5 priority 5

gem mapping 1 6 priority 6

gem mapping 1 7 priority 7

commit

quit

ont wan-profile profile-name pppoe_wan

nat enable

quit

ont policy-route-profile profile-name pppoe_policy

policy-route 0 port-based eth 1-4 wlan 1,5 wan 0

quit

ont-srvprofile gpon profile-id 100 profile-name "IOP_SP"
ont-port pots adaptive 32 eth adaptive 8

commit

quit

ont-lineprofile gpon profile-id 100 profile-name "IOP_NOKIA_LP"
omcc encrypt on
tr069-management enable
tr069-management ip-index 1
tcont 1 dba-profile-name "SURGE_INET"
gem add 1 eth tcont 1 encrypt off

gem mapping 1 0 vlan 81

gem mapping 1 1 vlan 200

gem mapping 1 2 vlan ${p.vlan_stasiun}

commit
quit

save`
  },
  fiberhome: {
    pizza: (p) => `config
card auto-auth
manage-vlan OAM svlan 40
manage-vlan ipv4 OAM ${p.ip_address}/${p.CIDR}
port vlan 40 tag 1/19 1
static-route destination-ip 0.0.0.0 mask 0.0.0.0 nexthop ${p.gateway}
service-vlan INTERNET ${p.vlan_stasiun} to ${p.vlan_stasiun} type data
port vlan ${p.vlan_stasiun} to ${p.vlan_stasiun} tag 1/19 1
port vlan ${p.vlan_stasiun} to ${p.vlan_stasiun} allslot
service-vlan ACS 81 to 81 type data
port vlan 81 to 81 tag 1/19 1
port vlan 81 to 81 allslot
interface eth 1/19/1
port type xfi
y
auto-neg disable
speed 10000M
exit
interface eth 1/19/2
port type xfi
y
auto-neg disable
speed 10000M
exit
link-aggregation 1/19/1 workmode lacp-static
link-aggregation add-member 1/19/1 1/19/2
lacp enable
hostname ${p.hostname}
terminal user name adminstr Starlite123#
lldp enable
lldp port 1/19/1 ena
lldp port 1/19/2 ena
save`
  },
  nokia: {
    pizzaNew: (p) => `interfaces interface sinband inline-frame-processing ingress-rule rule rule_1 flexible-match match-criteria tag 0 dot1q-tag vlan-id 4028
interfaces interface inband-l2term l2-termination egress-rewrite push-tag 0 vlan-id 4028
dhcp-client client disabled

interfaces interface inband ipv4 address ${p.ip_address} netmask ${p.netmask}
routing control-plane-protocols control-plane-protocol static inband static-routes ipv4 route 0.0.0.0/0 next-hop next-hop-address ${p.gateway}
system ntp enabled
system ntp server myNtpServer udp address 10.128.80.3 port 123
commit
yes`,
    pizzaChange: (p) => `1. Delete IP existing

config
no routing control-plane-protocols control-plane-protocol static inband static-routes ipv4 route 0.0.0.0/0
dhcp-client client enable
no interfaces interface inband ipv4 address ${p.ex_ip_address}
commit

2. Masukkan command ini dan ganti sesuai IP yang di OLT
config
dhcp-client client disabled
interfaces interface inband ipv4 address ${p.ip_address} netmask ${p.netmask}
routing control-plane-protocols control-plane-protocol static inband static-routes ipv4 route 0.0.0.0/0 next-hop next-hop-address ${p.gateway}
commit
yes
exit
exit`
  }
};

const requiredByConfig = () => {
  const vendor = vendorEl.value;
  const model = modelEl.value;
  const mode = modeEl.value;
  if (model === "chassis") return [];
  if (vendor === "huawei") return ["hostname", "ip_address", "gateway", "vlan_stasiun", "CIDR"];
  if (vendor === "fiberhome") return ["hostname", "ip_address", "gateway", "vlan_stasiun", "CIDR"];
  if (vendor === "nokia" && mode === "change-ip") return ["ex_ip_address", "ip_address", "netmask", "gateway"];
  if (vendor === "nokia") return ["ip_address", "netmask", "gateway"];
  return [];
};

function renderFields() {
  const required = requiredByConfig();
  fieldsEl.innerHTML = "";
  required.forEach((key) => {
    const def = fieldDefinitions[key];
    const wrapper = document.createElement("div");
    wrapper.className = `field${def.full ? " full" : ""}`;

    const label = document.createElement("label");
    label.className = "field-label";
    label.htmlFor = `field-${key}`;
    label.textContent = def.label;

    const input = document.createElement("input");
    input.id = `field-${key}`;
    input.name = key;
    input.placeholder = def.placeholder;
    input.autocomplete = "off";
    input.spellcheck = false;
    input.dataset.key = key;
    input.setAttribute("aria-label", def.label);

    wrapper.append(label, input);
    fieldsEl.append(wrapper);
  });

  const isNokiaPizza = vendorEl.value === "nokia" && modelEl.value === "pizza";
  modeWrap.hidden = !isNokiaPizza;
  if (!isNokiaPizza) modeEl.value = "new";

  const isComingSoon = modelEl.value === "chassis";
  noticeEl.textContent = isComingSoon
    ? "Generator chassis belum tersedia. Pilih Pizza untuk membuat script."
    : "";
  generateBtn.disabled = isComingSoon;
  generateBtn.style.opacity = isComingSoon ? ".5" : "1";
  generateBtn.style.cursor = isComingSoon ? "not-allowed" : "pointer";
}

function getValues() {
  const values = {};
  fieldsEl.querySelectorAll("input").forEach((input) => {
    values[input.dataset.key] = input.value.trim();
  });
  return values;
}

function validate(values) {
  const missing = requiredByConfig().filter((key) => !values[key]);
  if (missing.length) {
    const labels = missing.map((key) => fieldDefinitions[key].label);
    noticeEl.textContent = `Lengkapi parameter berikut: ${labels.join(", ")}.`;
    return false;
  }
  if (values.CIDR && (!/^\d{1,2}$/.test(values.CIDR) || Number(values.CIDR) < 0 || Number(values.CIDR) > 32)) {
    noticeEl.textContent = "CIDR harus berupa angka dari 0 sampai 32.";
    return false;
  }
  if (values.vlan_stasiun && (!/^\d+$/.test(values.vlan_stasiun) || Number(values.vlan_stasiun) < 1 || Number(values.vlan_stasiun) > 4094)) {
    noticeEl.textContent = "VLAN Stasiun harus berupa angka dari 1 sampai 4094.";
    return false;
  }
  noticeEl.textContent = "";
  return true;
}

function currentTemplate(values) {
  const vendor = vendorEl.value;
  const model = modelEl.value;
  const mode = modeEl.value;
  if (model === "chassis") return "";
  if (vendor === "huawei") return templates.huawei.pizza(values);
  if (vendor === "fiberhome") return templates.fiberhome.pizza(values);
  if (vendor === "nokia" && mode === "change-ip") return templates.nokia.pizzaChange(values);
  if (vendor === "nokia") return templates.nokia.pizzaNew(values);
  return "";
}

function updatePreview(script, generated = false) {
  outputEl.textContent = script;
  const count = script ? script.split("\n").length : 0;
  lineNumbersEl.textContent = count ? Array.from({ length: count }, (_, i) => i + 1).join("\n") : "1";
  lineCountEl.textContent = `${count} baris`;
  copyBtn.disabled = !generated || !script;
  copyStatusEl.textContent = generated ? "Script berhasil dibuat" : "Preview akan tampil di sini";
  const vendorName = vendorEl.options[vendorEl.selectedIndex].text;
  const modeName = vendorEl.value === "nokia" && modeEl.value === "change-ip" ? "Ganti IP" : "Konfigurasi";
  descriptionEl.textContent = `${vendorName} · ${modelEl.value === "pizza" ? "Pizza" : "Chassis"} · ${modeName}`;
  terminalTitleEl.textContent = `${vendorEl.value}-${modelEl.value}-${modeEl.value}.txt`;
}

function generate() {
  const values = getValues();
  if (modelEl.value === "chassis") {
    noticeEl.textContent = "Generator chassis belum tersedia. Pilih Pizza untuk membuat script.";
    return;
  }
  if (!validate(values)) return;
  const script = currentTemplate(values);
  updatePreview(script, true);
}

vendorEl.addEventListener("change", () => { renderFields(); updatePreview("Pilih parameter lalu klik “Generate Script”."); });
modelEl.addEventListener("change", () => { renderFields(); updatePreview("Pilih parameter lalu klik “Generate Script”."); });
modeEl.addEventListener("change", () => { renderFields(); updatePreview("Isi parameter lalu klik “Generate Script”."); });
generateBtn.addEventListener("click", generate);

copyBtn.addEventListener("click", async () => {
  const text = outputEl.textContent;
  try {
    await navigator.clipboard.writeText(text);
    copyStatusEl.textContent = "Script berhasil disalin ke clipboard";
    copyBtn.innerHTML = '<span aria-hidden="true">✓</span> Tersalin';
    window.setTimeout(() => { copyBtn.innerHTML = '<span aria-hidden="true">▢</span> Copy Script'; }, 1400);
  } catch {
    const range = document.createRange();
    range.selectNodeContents(outputEl);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    copyStatusEl.textContent = "Clipboard tidak tersedia. Script dipilih—salin secara manual.";
  }
});

renderFields();
updatePreview("Pilih vendor dan isi parameter, lalu klik “Generate Script”.");
