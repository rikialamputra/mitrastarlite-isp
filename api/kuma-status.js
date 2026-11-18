// Server-side proxy for Uptime Kuma. Never expose KUMA_API_KEY to the browser.
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
  } finally {
    clearTimeout(timer);
  }
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
  if (!kumaKey || !firebaseKey) {
    return res.status(503).json({ error: "Server environment is not configured" });
  }

  try {
    const idToken = req.body && req.body.idToken;
    if (typeof idToken !== "string" || !idToken) {
      return res.status(401).json({ error: "Firebase session token is required" });
    }

    // Verify the Firebase session and enforce the dashboard's @weave.co.id access policy.
    const identity = await fetchJson(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseKey)}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) }
    );
    const user = identity.users && identity.users[0];
    if (!user || !user.email || !user.email.toLowerCase().endsWith("@weave.co.id") || user.disabled) {
      return res.status(403).json({ error: "Dashboard access denied" });
    }

    const headers = { "X-API-Key": kumaKey };
    const monitorData = await fetchJson(`${KUMA_BASE}/v1/monitors`, { headers });
    const monitors = (monitorData.monitors || []).filter(m => String(m.type).toLowerCase() === "ping");
    const beatsById = {};

    // Kuma API Bridge accepts at most 200 IDs per bulk request.
    for (let i = 0; i < monitors.length; i += 200) {
      const batch = monitors.slice(i, i + 200);
      const ids = batch.map(m => m.id).join(",");
      const beatData = await fetchJson(
        `${KUMA_BASE}/v1/beats?ids=${encodeURIComponent(ids)}&hours=24&limit=1`,
        { headers }
      );
      Object.assign(beatsById, beatData.beats || {});
    }

    const result = monitors.map(m => {
      const beats = beatsById[String(m.id)] || [];
      const beat = beats.reduce((latest, item) =>
        !latest || String(item.time || "") > String(latest.time || "") ? item : latest, null);
      const code = beat ? Number(beat.status) : null;
      return {
        id: m.id,
        name: m.name || "",
        hostname: m.name || "",
        ip: m.hostname || "",
        parent: m.parent ?? null,
        status: ({ 1: "UP", 0: "DOWN", 2: "PENDING", 3: "MAINTENANCE" })[code] || "UNKNOWN",
        ping_ms: beat && beat.ping != null ? beat.ping : null,
        last_check: beat && beat.time || null,
        message: beat && beat.msg || ""
      };
    });

    return res.status(200).json({
      source: "Uptime Kuma heartbeat API",
      checked_at: new Date().toISOString(),
      count: result.length,
      summary: result.reduce((a, m) => { a[m.status] = (a[m.status] || 0) + 1; return a; }, {}),
      monitors: result
    });
  } catch (error) {
    console.error("Kuma status proxy:", error);
    const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 502;
    return res.status(status).json({ error: error.message || "Failed to retrieve Kuma status" });
  }
}

export const config = { maxDuration: 30 };
