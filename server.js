const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const SEED = path.join(ROOT, "data", "events.json");
const LOCAL_DB = process.env.DB_PATH || path.join("/tmp", "gcal-events.json");
const MONGO_URI = process.env.MONGODB_URI || "";
const MONGO_DB = process.env.MONGODB_DB || "gcal";
const MONGO_COL = process.env.MONGODB_COLLECTION || "events";

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

let colPromise = null;

async function collection() {
  if (!MONGO_URI) return null;
  if (!colPromise) {
    colPromise = (async () => {
      const { MongoClient } = require("mongodb");
      const client = new MongoClient(MONGO_URI);
      await client.connect();
      const col = client.db(MONGO_DB).collection(MONGO_COL);
      if ((await col.countDocuments()) === 0) {
        const seed = seedEvents();
        if (seed.length) await col.insertMany(seed);
      }
      return col;
    })();
  }
  return colPromise;
}

function publicEvent(doc) {
  return { id: doc.id, title: doc.title, date: doc.date };
}

function localRead() {
  try {
    if (fs.existsSync(LOCAL_DB)) return JSON.parse(fs.readFileSync(LOCAL_DB, "utf8"));
  } catch {}
  const seed = seedEvents();
  localWrite(seed);
  return seed;
}

function localWrite(rows) {
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
    const col = await collection();

    if (req.method === "GET" && (url.pathname === "/health" || url.pathname === "/healthz")) {
      return send(res, 200, { ok: true, store: col ? "mongodb" : "local" });
    }

    if (req.method === "GET" && url.pathname === "/api/events") {
      const month = url.searchParams.get("month");
      const rows = col
        ? (await col.find({}, { projection: { _id: 0 } }).toArray()).map(publicEvent)
        : localRead();
      const filtered = rows.filter((e) => !month || String(e.date).startsWith(month));
      return send(res, 200, filtered);
    }

    if (req.method === "POST" && url.pathname === "/api/events") {
      const data = await body(req);
      const title = String(data.title || "").trim().slice(0, 40);
      const date = String(data.date || "");
      if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return send(res, 400, { error: "datos" });
      const ev = { id: "e" + Date.now(), title, date };
      if (col) await col.insertOne({ ...ev });
      else {
        const rows = localRead();
        rows.push(ev);
        localWrite(rows);
      }
      return send(res, 201, ev);
    }

    const del = url.pathname.match(/^\/api\/events\/([^/]+)$/);
    if (req.method === "DELETE" && del) {
      const id = del[1];
      if (col) {
        const out = await col.deleteOne({ id });
        return out.deletedCount ? send(res, 200, { ok: true }) : send(res, 404, { error: "no" });
      }
      const rows = localRead();
      const next = rows.filter((e) => e.id !== id);
      if (next.length === rows.length) return send(res, 404, { error: "no" });
      localWrite(next);
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
  console.log(`listening on http://${HOST}:${PORT} store=${MONGO_URI ? "mongodb" : "local"}`);
});
