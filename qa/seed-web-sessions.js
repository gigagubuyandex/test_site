/**
 * Посев planned-сессий на https://nkh-sandbox.netlify.app/
 * Запуск (из test_site, с NODE_PATH на AppData node_modules):
 *   node qa/seed-web-sessions.js
 *   node qa/seed-web-sessions.js --limit=5
 */
const path = require("path");
const Module = require("module");
const https = require("https");

const localModules = path.join(
  process.env.LOCALAPPDATA || "",
  "nkh-sandbox-qa",
  "node_modules"
);
process.env.NODE_PATH = [localModules, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
Module._initPaths();

const { chromium } = require("playwright");
const { db } = require("../server/db");

const BASE = process.env.SEED_BASE || "https://nkh-sandbox.netlify.app";
const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Number(limitArg.split("=")[1]) : null;
const ONLY_ID = (() => {
  const a = args.find((x) => x.startsWith("--id="));
  return a ? Number(a.split("=")[1]) : null;
})();

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36 Edg/118.0.0.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
];

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let buf = "";
        res.on("data", (c) => (buf += c));
        res.on("end", () => resolve(buf.trim()));
      })
      .on("error", reject);
  });
}

function parseAudienceParams(raw) {
  try {
    return typeof raw === "string" ? JSON.parse(raw || "{}") : raw || {};
  } catch (_) {
    return {};
  }
}

function buildUrl(row, meta) {
  const baseEntry = row.entry_url || `${BASE}/entry-2026-10-08`;
  let u;
  try {
    u = new URL(baseEntry);
  } catch (_) {
    u = new URL(baseEntry, BASE);
  }
  // всегда веб-хост
  u.protocol = "https:";
  u.host = new URL(BASE).host;

  u.searchParams.set("fp", meta.fingerprint);
  u.searchParams.set("product", meta.productSuffix);
  u.searchParams.set("price", String(meta.price));
  u.searchParams.set("brand", meta.brand);
  u.searchParams.set("cohort", row.cohort || "session_main");
  u.searchParams.set("sid", String(row.id));

  if (row.role === "control" || /\/control-/i.test(u.pathname)) {
    u.searchParams.set("ecom", "none");
  } else if (row.cohort === "session_multi") {
    const idx = Number(meta.sessionIndex || 1);
    u.searchParams.set("ecom", idx === 1 ? "detail" : "detail,addToCart");
    u.searchParams.set("multi", String(idx));
  } else {
    u.searchParams.set("ecom", "all");
  }

  return u.toString();
}

function waitMsForEcom(row) {
  if (row.role === "control") return 8000;
  if (row.cohort === "session_multi") {
    const params = parseAudienceParams(row.audience_params);
    return Number(params.session_index) === 1 ? 12000 : 18000;
  }
  // 5 events × 3s + ct load
  return 25000;
}

async function main() {
  let sql = `SELECT * FROM sessions WHERE status = 'planned'`;
  const params = [];
  if (ONLY_ID) {
    sql += ` AND id = ?`;
    params.push(ONLY_ID);
  }
  sql += ` ORDER BY id ASC`;
  let rows = db.prepare(sql).all(...params);
  if (LIMIT) rows = rows.slice(0, LIMIT);

  if (!rows.length) {
    console.log("Нет planned-сессий");
    return;
  }

  let publicIp = "unknown";
  try {
    publicIp = await fetchText("https://api.ipify.org");
  } catch (e) {
    console.warn("ipify failed:", e.message);
  }
  console.log("Public IP (один на все):", publicIp);
  console.log("К посеву:", rows.length, "BASE=", BASE);

  const update = db.prepare(
    `UPDATE sessions SET
      tested_at = @tested_at,
      fingerprint = @fingerprint,
      user_agent = @user_agent,
      ip = @ip,
      entry_url = @entry_url,
      ecom_events = @ecom_events,
      status = @status,
      audience_params = @audience_params,
      updated_at = datetime('now')
    WHERE id = @id`
  );

  const browser = await chromium.launch({ headless: true });
  let ok = 0;
  let fail = 0;

  // session_multi: один fingerprint на client_index
  const multiFp = new Map();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const params = parseAudienceParams(row.audience_params);
    const ua = USER_AGENTS[i % USER_AGENTS.length];

    let fingerprint;
    if (row.cohort === "session_multi" && params.client_index != null) {
      const key = String(params.client_index);
      if (!multiFp.has(key)) {
        multiFp.set(key, `fp_multi_${key}_${Date.now().toString(36)}`);
      }
      fingerprint = multiFp.get(key);
    } else {
      fingerprint = `fp_${row.id}_${Date.now().toString(36)}_${i}`;
    }

    const meta = {
      fingerprint,
      productSuffix: String(row.id),
      price: 80 + (row.id % 40),
      brand: `brand_${row.id}`,
      sessionIndex: params.session_index || 1
    };

    const url = buildUrl(row, meta);
    const timeout = waitMsForEcom(row);
    console.log(`[${i + 1}/${rows.length}] #${row.id} ${row.role}/${row.cohort} → ${url}`);

    const context = await browser.newContext({
      userAgent: ua,
      viewport: { width: 1280, height: 800 },
      locale: "ru-RU"
    });
    const page = await context.newPage();

    let status = "done";
    let ecomEvents = [];
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForFunction(
        () => document.documentElement.getAttribute("data-ecom-done") === "1" ||
          document.documentElement.getAttribute("data-ecom-done") === "error",
        { timeout }
      );
      const done = await page.getAttribute("html", "data-ecom-done");
      if (done === "error") status = "error";

      ecomEvents = await page.evaluate(() => {
        const box = document.getElementById("ecom-log");
        return box ? box.textContent.split("\n").filter(Boolean).slice(-12) : [];
      });
      ok += 1;
    } catch (err) {
      console.error("  FAIL", err.message);
      status = "error";
      fail += 1;
    } finally {
      await context.close();
    }

    const nextParams = Object.assign({}, params, {
      seeded: true,
      product: meta.productSuffix,
      price: meta.price,
      brand: meta.brand,
      public_ip_note: "single_ip_no_proxy"
    });

    update.run({
      id: row.id,
      tested_at: new Date().toISOString(),
      fingerprint,
      user_agent: ua,
      ip: publicIp,
      entry_url: url,
      ecom_events: JSON.stringify(ecomEvents),
      status,
      audience_params: JSON.stringify(nextParams)
    });

    // небольшая пауза между визитами
    await new Promise((r) => setTimeout(r, 500));
  }

  await browser.close();
  console.log("Готово. ok=", ok, "fail=", fail);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
