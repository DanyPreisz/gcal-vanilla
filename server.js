const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const SEED = path.join(ROOT, "data", "events.json");
const LOCAL_DB = process.env.DB_PATH || path.join("/tmp", "gcal-events.json");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function seedEvents() {
  try {
    return JSON.parse(fs.readFileSync(SEED, "utf8"));
  } catch {
    return [];
  }
}

function read() {
  try {
    if (fs.existsSync(LOCAL_DB)) return JSON.parse(fs.readFileSync(LOCAL_DB, "utf8"));
  } catch {}
  const seed = seedEvents();
  write(seed);
  return seed;
}

function write(rows) {
  fs.writeFileSync(LOCAL_DB, JSON.stringify(rows, null, 2));
}

function send(res, status, body, type = TYPES[".json"]) {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function body(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function file(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, "No encontrado", "text/plain; charset=utf-8");
    send(res, 200, data, TYPES[path.extname(filePath)] || "application/octet-stream");
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");

    if (req.method === "GET" && (url.pathname === "/health" || url.pathname === "/healthz")) {
      return send(res, 200, { ok: true, store: "local" });
    }

    if (req.method === "GET" && url.pathname === "/api/events") {
      const month = url.searchParams.get("month");
      const rows = read().filter((e) => !month || String(e.date).startsWith(month));
      return send(res, 200, rows);
    }

    if (req.method === "POST" && url.pathname === "/api/events") {
      const data = await body(req);
      const title = String(data.title || "").trim().slice(0, 40);
      const date = String(data.date || "");
      if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return send(res, 400, { error: "datos" });
      const ev = { id: "e" + Date.now(), title, date };
      const rows = read();
      rows.push(ev);
      write(rows);
      return send(res, 201, ev);
    }

    const del = url.pathname.match(/^\/api\/events\/([^/]+)$/);
    if (req.method === "DELETE" && del) {
      const rows = read();
      const next = rows.filter((e) => e.id !== del[1]);
      if (next.length === rows.length) return send(res, 404, { error: "no" });
      write(next);
      return send(res, 200, { ok: true });
    }

    const rel = url.pathname === "/" ? "/index.html" : url.pathname;
    const safe = path.normalize(rel).replace(/^(\.\.[/\\])+/, "");
    file(res, path.join(PUBLIC, safe));
  } catch (err) {
    console.error(err);
    send(res, 500, { error: "store", detail: String(err.message || err) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`listening on http://${HOST}:${PORT}`);
});
