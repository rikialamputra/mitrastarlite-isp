// Secure inventory-to-Kuma synchronization. API credentials remain server-side.
const KUMA_BASE = "https://kuma-api.alamhost.com";

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { detail: text.slice(0, 500) }; }
    if (!response.ok) {
      const error = new Error(data.detail || data.message || `Upstream HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return data;
  } finally { clearTimeout(timer); }
}

function norm(value) {
  return String(value ?? "").normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Vary", "Authorization");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const kumaKey = process.env.KUMA_API_KEY;
  const firebaseKey = process.env.FIREBASE_API_KEY;
  if (!kumaKey || !firebaseKey) return res.status(503).json({ error: "Server environment is not configured" });

  try {
    const idToken = req.body && req.body.idToken;
    if (typeof idToken !== "string" || !idToken) return res.status(401).json({ error: "Firebase session token is required" });
    const identity = await fetchJson(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseKey)}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) }
    );
    const user = identity.users && identity.users[0];
    if (!user || !user.email || !user.email.toLowerCase().endsWith("@weave.co.id") || user.disabled) {
      return res.status(403).json({ error: "Dashboard access denied" });
    }

    const rows = req.body && req.body.devices;
    if (!Array.isArray(rows) || rows.length > 500) return res.status(400).json({ error: "devices must be an array with at most 500 rows" });
    const devices = [];
    const inventoryKeys = new Set();
    for (const row of rows) {
      const name = String(row && row.name || "").normalize("NFC").trim().replace(/\s+/g, " ");
      const ip = String(row && row.ip || "").trim();
      if (!name || !ip) continue;
      const key = norm(name) + "|" + norm(ip);
      if (inventoryKeys.has(key)) continue;
      inventoryKeys.add(key);
      devices.push({ name, ip });
    }

    const headers = { "X-API-Key": kumaKey };
    const listed = await fetchJson(`${KUMA_BASE}/v1/monitors`, { headers });
    const monitors = (listed.monitors || []).filter(m => String(m.type).toLowerCase() === "ping");
    const result = { source_count: rows.length, eligible_count: devices.length, added: 0, updated: 0, unchanged: 0, conflicts: 0, failed: 0, details: [] };

    // Index both identifiers. Ambiguous matches are reported rather than mutated.
    for (const device of devices) {
      const hn = norm(device.name), ip = norm(device.ip);
      const byName = monitors.filter(m => norm(m.name) === hn);
      const byIp = monitors.filter(m => norm(m.hostname) === ip);
      const candidates = [...new Map([...byName, ...byIp].map(m => [String(m.id), m])).values()];
      if (byName.length > 1 || byIp.length > 1 || (byName.length && byIp.length && byName[0].id !== byIp[0].id)) {
        result.conflicts++;
        result.details.push({ name: device.name, ip: device.ip, action: "conflict", message: "Hostname/IP cocok ke lebih dari satu monitor" });
        continue;
      }
      try {
        if (!candidates.length) {
          await fetchJson(`${KUMA_BASE}/v1/monitors`, {
            method: "POST", headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ type: "ping", name: device.name, hostname: device.ip, interval: 60, retryInterval: 60, maxretries: 1 })
          });
          result.added++;
          result.details.push({ name: device.name, ip: device.ip, action: "added" });
          monitors.push({ id: "new-" + result.added, type: "ping", name: device.name, hostname: device.ip });
        } else {
          const current = candidates[0];
          const patch = {};
          if (String(current.name || "") !== device.name) patch.name = device.name;
          if (String(current.hostname || "") !== device.ip) patch.hostname = device.ip;
          if (Object.keys(patch).length) {
            await fetchJson(`${KUMA_BASE}/v1/monitors/${encodeURIComponent(current.id)}`, {
              method: "PATCH", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(patch)
            });
            result.updated++;
            result.details.push({ name: device.name, ip: device.ip, action: "updated" });
            current.name = device.name; current.hostname = device.ip;
          } else {
            result.unchanged++;
            result.details.push({ name: device.name, ip: device.ip, action: "unchanged" });
          }
        }
      } catch (error) {
        result.failed++;
        result.details.push({ name: device.name, ip: device.ip, action: "failed", message: error.message });
      }
    }
    return res.status(200).json({ ...result, completed_at: new Date().toISOString() });
  } catch (error) {
    console.error("Kuma inventory sync:", error);
    const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 502;
    return res.status(status).json({ error: error.message || "Failed to synchronize monitors" });
  }
}

export const config = { maxDuration: 60 };
