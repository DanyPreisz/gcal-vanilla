const grid = document.querySelector("#grid");
const label = document.querySelector("#label");
const now = new Date();
let y = now.getFullYear();
let m = now.getMonth();

document.querySelector("#prev").addEventListener("click", () => shift(-1));
document.querySelector("#next").addEventListener("click", () => shift(1));
document.querySelector("#form").addEventListener("submit", async (event) => {
  event.preventDefault();
  await fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: document.querySelector("#title").value,
      date: document.querySelector("#date").value,
    }),
  });
  document.querySelector("#title").value = "";
  load();
});

grid.addEventListener("click", async (event) => {
  const btn = event.target.closest("[data-id]");
  if (!btn) return;
  await fetch("/api/events/" + btn.dataset.id, { method: "DELETE" });
  load();
});

function shift(d) {
  m += d;
  if (m < 0) {
    m = 11;
    y -= 1;
  }
  if (m > 11) {
    m = 0;
    y += 1;
  }
  load();
}

function monthKey() {
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

async function load() {
  label.textContent = new Date(y, m, 1).toLocaleString("es-AR", { month: "long", year: "numeric" });
  const events = await (await fetch("/api/events?month=" + monthKey())).json();
  const first = new Date(y, m, 1).getDay();
  const start = (first + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < start; i += 1) cells.push({ day: "", out: true, date: "" });
  for (let d = 1; d <= days; d += 1) {
    const date = `${monthKey()}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, out: false, date, ev: events.filter((e) => e.date === date) });
  }
  grid.innerHTML = cells
    .map(
      (c) =>
        `<div class="day ${c.out ? "out" : ""}">${c.day}${(c.ev || [])
          .map((e) => `<button class="ev" data-id="${e.id}">${escapeHtml(e.title)}</button>`)
          .join("")}</div>`
    )
    .join("");
}

function escapeHtml(s) {
  return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;");
}

load();
