/**
 * Приём вебхуков Calltouch → Firebase Realtime Database.
 *
 * URL после деплоя:
 *   https://nkh-sandbox.netlify.app/.netlify/functions/calltouch-webhook
 *
 * Env в Netlify (секреты задаёте сами в UI, агенту не присылать):
 *   FIREBASE_DATABASE_URL=https://first-7b348-default-rtdb.firebaseio.com
 *   FIREBASE_SERVICE_ACCOUNT  — JSON service account целиком (одна строка)
 *
 * Без service account функция отвечает 503 и не пишет в RTDB.
 */

const https = require("https");
const { URL } = require("url");

function readBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return { raw: raw };
  }
}

function getAccessToken(serviceAccount) {
  // Минимальный JWT для Google OAuth (без внешних зависимостей).
  const crypto = require("crypto");
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  };

  function b64url(obj) {
    return Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  }

  const unsigned = b64url(header) + "." + b64url(claim);
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(unsigned);
  const signature = sign
    .sign(serviceAccount.private_key, "base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const jwt = unsigned + "." + signature;

  return new Promise(function (resolve, reject) {
    const data = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    }).toString();

    const req = https.request(
      {
        hostname: "oauth2.googleapis.com",
        path: "/token",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(data)
        }
      },
      function (res) {
        let buf = "";
        res.on("data", function (c) {
          buf += c;
        });
        res.on("end", function () {
          try {
            const json = JSON.parse(buf);
            if (!json.access_token) {
              reject(new Error("token error: " + buf.slice(0, 200)));
              return;
            }
            resolve(json.access_token);
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function rtdbPush(databaseUrl, accessToken, path, payload) {
  const base = databaseUrl.replace(/\/$/, "");
  const url = new URL(base + path + ".json");
  url.searchParams.set("access_token", accessToken);

  return new Promise(function (resolve, reject) {
    const body = JSON.stringify(payload);
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body)
        }
      },
      function (res) {
        let buf = "";
        res.on("data", function (c) {
          buf += c;
        });
        res.on("end", function () {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(buf ? JSON.parse(buf) : {});
            return;
          }
          reject(new Error("RTDB " + res.statusCode + " " + buf.slice(0, 300)));
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const databaseUrl = process.env.FIREBASE_DATABASE_URL;
  const saRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!databaseUrl || !saRaw) {
    return {
      statusCode: 503,
      body: JSON.stringify({
        error:
          "Задайте FIREBASE_DATABASE_URL и FIREBASE_SERVICE_ACCOUNT в Netlify env"
      })
    };
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(saRaw);
  } catch (_) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "FIREBASE_SERVICE_ACCOUNT is not valid JSON" })
    };
  }

  const payload = readBody(event);
  const record = {
    received_at: new Date().toISOString(),
    headers: {
      "user-agent": event.headers["user-agent"] || event.headers["User-Agent"] || null
    },
    payload: payload
  };

  try {
    const token = await getAccessToken(serviceAccount);
    const saved = await rtdbPush(databaseUrl, token, "/webhook_deliveries", record);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, name: saved.name || null })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message })
    };
  }
};
