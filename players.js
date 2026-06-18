// ---------- Config ----------
// AFTER — encoded, decoded silently at runtime
const _ref = "aHR0cHM6Ly9kb2NzLmdvb2dsZS5jb20vc3ByZWFkc2hlZXRzL2QvMUJJOXFXY1pvZkhRYTVBR3ZOMnlCVENuc3NYa2VBVTRXeEtyMnJQRHpMbGcvZXhwb3J0P2Zvcm1hdD1jc3YmZ2lkPTY4OTUwMzczMw==";
const G_SHEET_URL = atob(_ref);

const PAGE_SIZE = 24;

// ---------- State ----------
let allPlayers = [];   // [{ name, position, team, year, img?, _search }]
let filtered = [];     // current filtered list
let renderedCount = 0; // how many cards are in the DOM

// ---------- DOM ----------
const grid = document.getElementById("players_grid");
const loadMoreBtn = document.getElementById("loadMore");
const searchInput = document.getElementById("searchInput");
const resultsSummary = document.getElementById("results_summary");
const noResults = document.getElementById("no_results");

// ---------- Utils ----------
function debounce(fn, delay = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

function normalize(str = "") {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function toCsvUrl(input) {
  try {
    const u = new URL(input, window.location.href);

    // Already a CSV export or other CSV endpoint
    if (u.searchParams.get("output") === "csv" || u.pathname.endsWith(".csv")) {
      return u.href;
    }

    // Standard Sheets URL pattern -> convert to export CSV
    const isSheets = u.hostname.includes("docs.google.com") && u.pathname.includes("/spreadsheets/d/");
    if (isSheets) {
      const parts = u.pathname.split("/");
      const idIdx = parts.indexOf("d") + 1;
      const sheetId = parts[idIdx];

      // gid can be in hash (#gid=123) or query (?gid=123)
      let gid = "0";
      if (u.hash.startsWith("#gid=")) gid = u.hash.replace("#gid=", "");
      if (u.searchParams.has("gid")) gid = u.searchParams.get("gid") || gid;

      return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
    }

    // Fallback: return as-is (maybe it's a CDN CSV)
    return u.href;
  } catch {
    // Not a valid URL, treat it as given (could be relative CSV path)
    return input;
  }
}

// Normalize headers and map to expected keys
function normalizeHeaders(row) {
  const out = {};
  for (const k in row) {
    if (!Object.prototype.hasOwnProperty.call(row, k)) continue;
    const key = (k || "").toString().trim().toLowerCase(); // case-insensitive
    const val = row[k];

    // map common header variants to our expected keys
    const map = {
      name: ["name", "player", "player_name", "nombre"],
      position: ["position", "pos", "posición"],
      team: ["team", "club", "equipo"],
      year: ["year", "season", "anio", "año"],
      img: ["img", "image", "photo", "avatar", "url", "picture"]
    };

    let target = null;
    for (const t in map) {
      if (map[t].includes(key)) {
        target = t;
        break;
      }
    }
    out[target || key] = val;
  }
  return out;
}

function buildPlayerObject(rowRaw) {
  const row = normalizeHeaders(rowRaw);

  const name = (row.name || "").trim();
  const position = (row.position || "").trim();
  const team = (row.team || "").trim();
  const year = (row.year ?? "").toString().trim();
  const img = (row.img || "").trim(); // optional

  if (!name) return null;

  return {
    name,
    position,
    team,
    year,
    img,
    _search: normalize(`${name} ${position} ${team} ${year}`)
  };
}

// ---------- Lazy image loader ----------
const imageObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        const img = e.target;
        img.src = img.dataset.src;
        imageObserver.unobserve(img);
      }
    });
  },
  { rootMargin: "200px 0px", threshold: 0.01 }
);

// ---------- Card builder (team/year inline) ----------
function createCard(p) {
  const card = document.createElement("div");
  card.className = "p-4 text-center flex flex-col items-center";

  // IMG (lazy)
  const img = document.createElement("img");
  img.className = "h-16 w-16 rounded-full object-cover p-[0.1rem] ring-1 ring-yellow-500";
  img.alt = p.name;
  img.loading = "lazy";
  img.decoding = "async";
  img.dataset.src = p.img || "";

  const h2 = document.createElement("h2");
  h2.className = "font-semibold tracking-wide uppercase pt-2.5 text-md";
  h2.textContent = p.name;

  const pos = document.createElement("p");
  pos.className = "text-sm uppercase py-1";
  pos.textContent = p.position || "";

  const meta = document.createElement("div");
  meta.className = "flex space-x-1 text-xxs uppercase";
  meta.setAttribute("data-role", "team-info");

  const teamSpan = document.createElement("span");
  teamSpan.textContent = p.team || "";

  const yearSpan = document.createElement("span");
  yearSpan.textContent = p.year ? `(${p.year})` : "";

  meta.appendChild(teamSpan);
  meta.appendChild(yearSpan);

  card.appendChild(img);
  card.appendChild(h2);
  card.appendChild(pos);
  card.appendChild(meta);

  imageObserver.observe(img);
  return card;
}

// ---------- Render helpers ----------
function updateSummary() {
  resultsSummary.textContent = filtered.length ? `${filtered.length} jugadores` : "";
  noResults.classList.toggle("hidden", filtered.length !== 0);
}

function clearGrid() {
  grid.innerHTML = "";
  renderedCount = 0;
}

function updateLoadMoreVisibility() {
  loadMoreBtn.classList.toggle("hidden", renderedCount >= filtered.length);
}

function renderNextBatch() {
  const start = renderedCount;
  const end = Math.min(start + PAGE_SIZE, filtered.length);
  if (start >= end) {
    updateLoadMoreVisibility();
    return;
  }

  const frag = document.createDocumentFragment();
  for (let i = start; i < end; i++) {
    frag.appendChild(createCard(filtered[i]));
  }
  grid.appendChild(frag);

  renderedCount = end;
  updateLoadMoreVisibility();
}

// ---------- Search ----------
function applySearch() {
  const q = normalize(searchInput.value);
  filtered = q ? allPlayers.filter((p) => p._search.includes(q)) : allPlayers;

  updateSummary();
  clearGrid();
  renderNextBatch();
}

loadMoreBtn.addEventListener("click", renderNextBatch);
searchInput.addEventListener("input", debounce(applySearch, 200));

// ---------- Google Sheet load (fetch -> parse CSV text) ----------
async function loadPlayers() {
  try {
    const csvUrl = toCsvUrl(G_SHEET_URL);
    const res = await fetch(csvUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${csvUrl}`);

    const text = await res.text();

    Papa.parse(text, {
      header: true,
      worker: true,          // parse off the main thread
      skipEmptyLines: true,
      complete: ({ data }) => {
        allPlayers = data.map(buildPlayerObject).filter(Boolean);

        // Initial view: first 24
        filtered = allPlayers.slice();
        updateSummary();
        clearGrid();
        renderNextBatch();
      },
      error: (err) => {
        console.error("Papa parse error:", err);
        resultsSummary.textContent = "Error al procesar la lista de jugadores.";
      }
    });
  } catch (err) {
    console.error("Sheet fetch error:", err);
    resultsSummary.textContent = "No se pudo cargar la hoja (verifica el enlace y permisos).";
  }
}

loadPlayers();
