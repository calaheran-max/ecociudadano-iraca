import { mascotaDe } from "./mascotas.js";
import { createMoonRoulette } from "./moon-roulette.js";

const workspace = document.getElementById("workspace");

if (window.location.port === "5500" || window.location.port === "5501") {
  document.body.innerHTML = `
    <div style="display:flex;justify-content:center;align-items:center;min-height:100vh;background:#0a0f0d;color:#fff;font-family:sans-serif;text-align:center;padding:20px;">
      <div>
        <h1 style="color:#00ff9c;">Error de conexión</h1>
        <p style="font-size:18px;margin:20px 0;">El panel docente necesita el servidor Node.js. Live Server no ejecuta la API.</p>
        <p style="font-size:16px;color:#aaa;">Cierra Live Server y ejecuta:</p>
        <code style="display:block;background:#1a2a22;padding:15px;border-radius:8px;margin:20px auto;max-width:420px;font-size:16px;text-align:left;">
          cd proyecto-iraca<br>npm run dev
        </code>
        <p style="font-size:16px;color:#aaa;">Luego abre <strong style="color:#00ff9c;">http://localhost:3000/admin.html</strong></p>
      </div>
    </div>`;
  throw new Error("Live Server detectado. Usa el servidor Node.js en el puerto 3000.");
}

let token = sessionStorage.getItem("iraca_admin") || "";
let campañas = [];
let activeId = "";
let carga = 0;
let roulette;

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) {
    headers["x-admin-token"] = token;
    headers.Authorization = "Bearer " + token;
  }
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "No autorizado.");
  return data;
}

function paintShell(campana) {
  const pet = mascotaDe(campana.id);
  document.body.className = "theme-" + campana.theme;
  workspace.replaceChildren();
  const view = document.createElement("section");
  view.className = "campaign-view";
  const mascot = document.createElement("div");
  mascot.className = "campaign-mascot campaign-mascot-lg";
  if (pet) mascot.innerHTML = pet.svg;
  const title = document.createElement("h2");
  title.textContent = campana.titulo;
  const owner = document.createElement("p");
  owner.textContent = pet ? `${campana.autor} · ${pet.nombre}` : campana.autor;
  const form = document.createElement("form");
  form.className = "gate-form";
  form.id = "login";
  form.innerHTML = `
    <label for="pin">PIN docente</label>
    <input id="pin" type="password" autocomplete="current-password" />
    <button class="btn" type="submit">Abrir esta campaña</button>
    <p class="hint" id="login-msg"></p>`;
  const stats = document.createElement("div");
  stats.className = "stat-grid";
  stats.innerHTML = `
    <article><strong id="stat-total">—</strong><span>Intentos</span></article>
    <article><strong id="stat-promedio">—</strong><span>Promedio</span></article>
    <article><strong id="stat-ok">—</strong><span>Aprobados</span></article>
    <article><strong id="stat-bad">—</strong><span>Por debajo de 60</span></article>`;
  const tableWrap = document.createElement("div");
  tableWrap.style.overflow = "auto";
  tableWrap.innerHTML = `
    <table class="tabla-docente">
      <thead><tr><th>Estudiante</th><th>Grado</th><th>Puntaje</th><th>Compromiso</th><th>Fecha</th></tr></thead>
      <tbody id="tabla"><tr><td colspan="5">Cargando esta campaña.</td></tr></tbody>
    </table>`;
  const links = document.createElement("section");
  links.className = "links-panel";
  links.innerHTML = `<h3>Links inteligentes por campaña</h3>
    <p class="hint">Comparte el enlace: abre esa campaña y el formulario sin pasar por la ruleta.</p>
    <div class="links-table-wrap"><table class="tabla-docente" id="tabla-links">
      <thead><tr><th>Estudiante</th><th>Link</th><th>Acciones</th></tr></thead>
      <tbody></tbody>
    </table></div>`;
  view.append(mascot, title, owner, form, stats, tableWrap, links);
  workspace.append(view);
  form.addEventListener("submit", login);
  form.addEventListener("focusin", () => roulette?.pause());
  if (token) form.querySelector("#login-msg").textContent = "Sesión docente activa.";
  fillLinksTable(links.querySelector("tbody"));
}

function campaignPublicUrl(id) {
  const base = window.location.origin.replace(/\/$/, "");
  return `${base}/?campana=${encodeURIComponent(id)}`;
}

function fillLinksTable(tbody) {
  if (!tbody) return;
  tbody.innerHTML = campañas
    .map((c) => {
      const url = campaignPublicUrl(c.id);
      return `<tr>
        <td>${esc(c.autor)}</td>
        <td><code class="link-url">${esc(url)}</code></td>
        <td class="link-actions">
          <button type="button" class="btn btn-sm" data-copy="${esc(url)}">Copiar</button>
          <a class="btn btn-sm" href="${esc(url)}" target="_blank" rel="noopener">Abrir</a>
        </td>
      </tr>`;
    })
    .join("");
  tbody.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(btn.getAttribute("data-copy") || "");
        btn.textContent = "Copiado";
        setTimeout(() => {
          btn.textContent = "Copiar";
        }, 1400);
      } catch {
        btn.textContent = "Error";
      }
    });
  });
}

async function loadCampana(id) {
  const ticket = ++carga;
  const total = document.getElementById("stat-total");
  const promedio = document.getElementById("stat-promedio");
  const ok = document.getElementById("stat-ok");
  const bad = document.getElementById("stat-bad");
  const tabla = document.getElementById("tabla");
  if (!token) {
    total.textContent = "PIN";
    promedio.textContent = "—";
    ok.textContent = "—";
    bad.textContent = "—";
    tabla.innerHTML = '<tr><td colspan="5">Ingresa el PIN para ver solo los registros de esta campaña.</td></tr>';
    return;
  }
  try {
    const data = await api("/api/admin/campanas/" + encodeURIComponent(id) + "/resultados");
    if (ticket !== carga || data.campana.id !== activeId) return;
    const stats = data.estadisticas;
    total.textContent = String(stats.totalIntentos);
    promedio.textContent = stats.totalIntentos ? String(stats.promedioGeneral) : "—";
    ok.textContent = String(stats.aprobados);
    bad.textContent = String(stats.reprobados);
    if (!data.intentos.length) {
      tabla.innerHTML = '<tr><td colspan="5">Esta campaña todavía no tiene evaluaciones finales.</td></tr>';
      return;
    }
    tabla.innerHTML = data.intentos
      .map((row) => {
        const fecha = row.fecha ? new Date(row.fecha).toLocaleString("es-CO") : "—";
        return `<tr>
          <td>${esc(row.estudiante)}</td>
          <td>${esc(row.grado)}</td>
          <td>${esc(row.puntaje)}</td>
          <td>${row.aceptoCompromiso ? "Firmado" : "Sin firma"}</td>
          <td>${esc(fecha)}</td>
        </tr>`;
      })
      .join("");
  } catch (err) {
    if (ticket !== carga) return;
    tabla.innerHTML = `<tr><td colspan="5">${esc(err.message)}</td></tr>`;
  }
}

async function login(event) {
  event.preventDefault();
  const msg = document.getElementById("login-msg");
  try {
    const data = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ pin: document.getElementById("pin").value }),
    });
    token = data.token;
    sessionStorage.setItem("iraca_admin", token);
    msg.textContent = "Telemetría abierta para la campaña seleccionada.";
    if (activeId) await loadCampana(activeId);
  } catch (err) {
    msg.textContent = err.message;
  }
}

function openCampana(id) {
  const campana = campañas.find((item) => item.id === id);
  if (!campana || id === activeId) return;
  activeId = id;
  paintShell(campana);
  loadCampana(id);
}

function previewCampana(campana) {
  if (workspace.querySelector("#login") && activeId === campana.id) return;
  document.body.className = "theme-" + campana.theme;
  const pet = mascotaDe(campana.id);
  workspace.replaceChildren();
  const view = document.createElement("section");
  view.className = "campaign-view";
  const mascot = document.createElement("div");
  mascot.className = "campaign-mascot campaign-mascot-lg";
  if (pet) mascot.innerHTML = pet.svg;
  const title = document.createElement("h2");
  title.textContent = campana.titulo;
  const owner = document.createElement("p");
  owner.textContent = pet ? `${campana.autor} · ${pet.nombre}` : campana.autor;
  const hint = document.createElement("p");
  hint.textContent = "Pulsa la tarjeta o Enter para abrir solo esta auditoría.";
  view.append(mascot, title, owner, hint);
  workspace.append(view);
}

async function boot() {
  const res = await fetch("/api/cuestionarios");
  if (!res.ok) throw new Error("La API no respondió (" + res.status + ")");
  const data = await res.json();
  campañas = Array.isArray(data) ? data : data.cuestionarios || [];
  const campaigns = campañas.map((campana) => {
    const pet = mascotaDe(campana.id);
    return {
      ...campana,
      mascotName: pet?.nombre || campana.autor,
      student: campana.autor,
      topic: campana.tema,
    };
  });
  const mascots = Object.fromEntries(campaigns.map((item) => [item.id, mascotaDe(item.id)?.svg || ""]));
  const stage = document.getElementById("moon-stage");
  roulette = createMoonRoulette({
    stage,
    campaigns,
    mascots,
    onFocus: (campaign) => previewCampana(campaign),
    onEnter: (campaign) => openCampana(campaign.id),
  });
  window.addEventListener("keydown", (event) => {
    if (stage.contains(document.activeElement)) return;
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      roulette.center(roulette.index() + 1);
    }
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      roulette.center(roulette.index() - 1);
    }
    if (event.key === "Enter") {
      event.preventDefault();
      roulette.center(roulette.index(), true);
    }
  });
}

boot().catch((err) => {
  workspace.textContent = "No se pudieron cargar las campañas desde esta misma dirección. Deja el servidor encendido con npm run dev. " + err.message;
});
