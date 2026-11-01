"use strict";
let ADMIN = sessionStorage.getItem("iraca_admin") || null;
const $ = (id) => document.getElementById(id);

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function apiUrl(path) {
  return path;
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (ADMIN) headers["x-admin-token"] = ADMIN;
  const res = await fetch(apiUrl(path), { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error.");
  return data;
}

function filterQuery() {
  const params = new URLSearchParams();
  const text = $("f-q").value.trim();
  if (text) params.set("q", text);
  if ($("f-grado").value) params.set("grado", $("f-grado").value);
  if ($("f-momento").value) params.set("momento", $("f-momento").value);
  if ($("f-estado").value) params.set("estado", $("f-estado").value);
  const query = params.toString();
  return query ? "?" + query : "";
}

function fillGradeSelects(grados) {
  if (!grados || !grados.length) return;
  const currentGen = $("gen-grado").value;
  const currentFilter = $("f-grado").value;
  const options = grados.map((g) => `<option value="${esc(g)}">${esc(g)}</option>`).join("");
  $("gen-grado").innerHTML = options;
  if (currentGen) $("gen-grado").value = currentGen;
  $("f-grado").innerHTML = '<option value="">Todos</option>' + options;
  $("f-grado").value = currentFilter;
}

function showLogin(message) {
  ADMIN = null;
  sessionStorage.removeItem("iraca_admin");
  $("panel-view").classList.add("hidden");
  $("login-view").classList.remove("hidden");
  const msg = $("login-msg");
  if (message) {
    msg.textContent = message;
    msg.classList.remove("hidden");
  }
}

async function login() {
  const msg = $("login-msg");
  msg.classList.add("hidden");
  const pin = $("pin").value.trim();
  if (!pin) {
    msg.textContent = "Escribe 2026 en la casilla y pulsa Entrar.";
    msg.classList.remove("hidden");
    $("pin").focus();
    return;
  }
  try {
    const { token } = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ pin }),
    });
    ADMIN = token;
    sessionStorage.setItem("iraca_admin", token);
    $("login-view").classList.add("hidden");
    $("panel-view").classList.remove("hidden");
    await refreshAll();
  } catch (e) {
    const off = /failed to fetch|network|error\./i.test(e.message);
    msg.textContent = off
      ? "Live Server abre la pantalla, pero la clave la revisa el servidor del puerto 3000. En la terminal ejecuta npm start y vuelve a pulsar Entrar."
      : e.message;
    msg.classList.remove("hidden");
  }
}

function renderCompare(rows) {
  const box = $("compare-wrap");
  const withBoth = (rows || []).filter((r) => r.pre && r.post);
  if (!withBoth.length) {
    box.className = "muted";
    box.textContent = "Todavía no hay un pre y un post del mismo curso.";
    return;
  }
  box.className = "";
  box.innerHTML = `<table><thead><tr><th>Curso</th><th>Pre</th><th>Post</th><th>Diferencia</th></tr></thead><tbody>${withBoth
    .map((r) => {
      const dif = r.diferencia == null ? "—" : (r.diferencia > 0 ? "+" : "") + r.diferencia;
      return `<tr><td>${esc(r.grado)}</td><td>${esc(r.pre.promedio ?? "—")} / 10</td><td>${esc(r.post.promedio ?? "—")} / 10</td><td>${esc(dif)}</td></tr>`;
    })
    .join("")}</tbody></table>`;
}

function renderRetos(rows) {
  const box = $("retos-wrap");
  const usados = (rows || []).filter((r) => r.intentos > 0);
  if (!usados.length) {
    box.className = "muted";
    box.textContent = "Cuando haya respuestas de selección, aquí verás cuáles fallan más.";
    return;
  }
  box.className = "";
  box.innerHTML = `<table><thead><tr><th>Reto</th><th>Aciertos</th><th>% correcto</th><th>Enunciado</th></tr></thead><tbody>${usados
    .map(
      (r) =>
        `<tr><td>${esc(r.n + 1)}</td><td>${esc(r.aciertos)} / ${esc(r.intentos)}</td><td>${esc(r.pct)}%</td><td>${esc(r.enunciado || "—")}</td></tr>`,
    )
    .join("")}</tbody></table>`;
}

async function loadStats() {
  const data = await api("/api/admin/stats" + filterQuery());
  fillGradeSelects(data.grados);
  const t = data.total || {};
  $("totals").innerHTML =
    `Inscritos: <strong style="color:#FFCC00">${esc(t.inscritos || 0)}</strong> · ` +
    `Completaron: <strong style="color:#FFCC00">${esc(t.completos || 0)}</strong> · ` +
    `Promedio: <strong style="color:#FFCC00">${esc(t.promedio ?? "—")} / 10</strong>`;
  renderCompare(data.prePost || []);
  renderRetos(data.retos || []);
  const tb = $("stats-table").querySelector("tbody");
  const rows = (data.porCurso || []).filter((r) => r.inscritos > 0);
  if (!rows.length) {
    tb.innerHTML = '<tr><td colspan="7" class="muted">No hay participaciones con esos filtros.</td></tr>';
    return;
  }
  tb.innerHTML = rows
    .map((r) => {
      const pct = r.inscritos ? Math.round((r.completos / r.inscritos) * 100) : 0;
      return `<tr><td>${esc(r.grado)}</td><td>${esc(r.momento)}</td><td>${esc(r.inscritos)}</td><td>${esc(r.completos)}</td><td>${pct}%</td><td>${esc(r.promedio ?? "—")}</td><td>${esc(r.compromisos || 0)}</td></tr>`;
    })
    .join("");
}

async function loadPeople() {
  const data = await api("/api/admin/participants" + filterQuery());
  const tb = $("people-table").querySelector("tbody");
  const list = data.participantes || [];
  if (!list.length) {
    tb.innerHTML = '<tr><td colspan="8" class="muted">Nadie coincide con esa búsqueda.</td></tr>';
    return;
  }
  tb.innerHTML = list
    .map(
      (p) => `<tr class="clickable" data-folio="${esc(p.folio || p.id)}">
        <td>${esc(p.folio || p.id)}</td><td>${esc(p.nombre)}</td><td>${esc(p.grado)}</td>
        <td>${esc(p.momento)}</td><td>${esc(p.cuestionario || "—")}</td><td>${esc(p.estado)}</td>
        <td>${esc(p.score)}</td><td>${p.compromiso ? "Sí" : "No"}</td></tr>`,
    )
    .join("");
  tb.querySelectorAll("tr.clickable").forEach((row) => {
    row.addEventListener("click", () => {
      $("pid").value = row.getAttribute("data-folio") || "";
      consult();
    });
  });
}

function renderAnswers(p, respuestas) {
  let html = `<h3 style="color:var(--yellow)">${esc(p.nombre)} · ${esc(p.folio || "")}</h3>
    <p class="muted">${esc(p.grado)} · ${esc(p.momento)} · Cuestionario ${esc(p.cuestionario || "—")} · Sala ${esc(p.salaCodigo || "—")}<br>
    Puntaje ${esc(p.score)}/10 · Reflexiones ${esc(p.reflections)}/2 · ${esc(p.estado)}</p>`;
  if (!respuestas.length) html += '<p class="muted">Todavía no hay respuestas guardadas.</p>';
  for (const r of respuestas) {
    html += `<div style="margin:10px 0;padding:10px;border-left:4px solid var(--yellow)">
      <div class="muted">Reto ${esc(r.n + 1)} · ${esc(r.tipo)}</div>
      <div>${esc(r.enunciado)}</div>`;
    if (r.tipo === "mc") {
      html += `<div>Elegida <b>${esc(r.seleccionada)}</b> · Correcta <b>${esc(r.correcta)}</b></div>`;
    } else {
      const criterios =
        r.n === 10
          ? ["No revela el sitio", "Evita perturbar", "Busca un canal responsable"]
          : ["Corrige con respeto", "Aporta una fuente", "No amplifica el rumor"];
      const marcados = new Set((r.rubrica || []).filter((x) => x.valor).map((x) => x.criterio));
      html += `<div>“${esc(r.texto)}”</div><div style="margin-top:8px">${criterios
        .map(
          (c) =>
            `<button type="button" class="rubro${marcados.has(c) ? " on" : ""}" data-folio="${esc(p.folio || "")}" data-n="${esc(r.n)}" data-criterio="${esc(c)}">${esc(c)}</button>`,
        )
        .join(" ")}</div>`;
    }
    html += "</div>";
  }
  return html;
}

async function loadSalas() {
  const data = await api("/api/admin/salas");
  fillGradeSelects(data.grados);
  const box = $("salas-box");
  const salas = data.salas || [];
  if (!salas.length) {
    box.innerHTML = '<p class="muted">Aún no hay salas. Crea la primera para que el grupo pueda entrar.</p>';
    return;
  }
  box.innerHTML = `<table><thead><tr>
    <th>Cuestionario</th><th>Código</th><th>Curso</th><th>Momento</th>
    <th>Estado</th><th>Cierra</th><th>Entraron</th><th>Completaron</th><th></th>
  </tr></thead><tbody>${salas
    .map((s) => {
      const open = s.estado === "abierta";
      const hora = s.cierraEn
        ? new Date(s.cierraEn).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
        : "Manual";
      return `<tr>
        <td>${esc(s.cuestionario)}</td><td><strong>${esc(s.codigo)}</strong></td>
        <td>${esc(s.grado)}</td><td>${esc(s.momento)}</td>
        <td><span class="pill ${open ? "open" : "closed"}">${open ? "Abierta" : "Cerrada"}</span></td>
        <td>${esc(hora)}</td><td>${esc(s.estudiantes)}</td><td>${esc(s.completos)}</td>
        <td>${open ? `<button type="button" class="danger close-sala" data-id="${esc(s.id)}">Cerrar</button>` : "—"}</td>
      </tr>`;
    })
    .join("")}</tbody></table>`;
  box.querySelectorAll(".close-sala").forEach((btn) => {
    btn.addEventListener("click", () => closeSala(btn.getAttribute("data-id")));
  });
}

async function loadVivo() {
  const data = await api("/api/admin/vivo");
  const box = $("vivo-box");
  const salas = data.salas || [];
  if (!salas.length) {
    box.className = "muted";
    box.textContent = "No hay salas abiertas.";
    return;
  }
  box.className = "";
  box.innerHTML = salas
    .map((s) => {
      const gente = s.estudiantes.length
        ? `<table><thead><tr><th>Folio</th><th>Nombre</th><th>Avance</th><th>Estado</th><th>Puntaje</th></tr></thead><tbody>${s.estudiantes
            .map(
              (p) =>
                `<tr><td>${esc(p.folio)}</td><td>${esc(p.nombre)}</td><td>${esc(p.progreso)}/12</td><td>${esc(p.estado)}</td><td>${esc(p.score)}</td></tr>`,
            )
            .join("")}</tbody></table>`
        : '<p class="muted">Nadie ha entrado todavía.</p>';
      return `<h3 style="color:var(--yellow);font-size:.95rem">${esc(s.codigo)} · ${esc(s.grado)} · ${esc(s.cuestionario)}</h3>${gente}`;
    })
    .join("");
}

function kickedOut(error) {
  return /clave|pin|autoriz|401/i.test(error?.message || "");
}

async function refreshAll() {
  try {
    await loadStats();
  } catch (e) {
    if (kickedOut(e)) return showLogin("La sesión no sirve. Escribe 2026 y pulsa Entrar.");
    $("totals").textContent = e.message;
  }
  try {
    await loadPeople();
  } catch (e) {
    if (kickedOut(e)) return showLogin("La sesión no sirve. Escribe 2026 y pulsa Entrar.");
    $("people-table").querySelector("tbody").innerHTML = `<tr><td colspan="8">${esc(e.message)}</td></tr>`;
  }
  try {
    await loadSalas();
    await loadVivo();
  } catch (e) {
    if (kickedOut(e)) return showLogin("La sesión no sirve. Escribe 2026 y pulsa Entrar.");
    $("salas-box").textContent = e.message;
  }
}

async function createSala() {
  const box = $("codes-box");
  try {
    const data = await api("/api/admin/salas", {
      method: "POST",
      body: JSON.stringify({
        grado: $("gen-grado").value,
        momento: $("gen-momento").value,
        minutos: Number($("gen-minutos").value),
      }),
    });
    const s = data.sala;
    const cierre = s.cierraEn
      ? "Se cierra sola a las " + new Date(s.cierraEn).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
      : "Se cierra solo cuando pulses Cerrar";
    box.innerHTML = `<p class="muted">Cuestionario <strong style="color:#fff">${esc(s.cuestionario)}</strong> · ${esc(s.grado)} · ${esc(s.momento)}</p>
      <p class="muted">${esc(cierre)}.</p>
      <p class="sala-code">${esc(s.codigo)}</p>
      <div class="qr-card"><img alt="QR para entrar a la sala" src="${apiUrl("/api/sala/qr?codigo=" + encodeURIComponent(s.codigo))}"></div>`;
    await refreshAll();
  } catch (e) {
    box.innerHTML = `<div class="msg">${esc(e.message)}</div>`;
  }
}

async function closeSala(id) {
  if (!confirm("¿Cerrar esta sala? El código dejará de servir para entrar.")) return;
  await api("/api/admin/salas/" + id + "/cerrar", { method: "POST" });
  await refreshAll();
}

async function consult() {
  const box = $("consult-box");
  const text = $("pid").value.trim();
  if (!text) {
    box.innerHTML = '<div class="msg">Escribe un folio, un nombre o un ID.</div>';
    return;
  }
  try {
    const data = await api("/api/admin/lookup?q=" + encodeURIComponent(text));
    if (data.varios) {
      box.innerHTML = data.varios
        .map(
          (p) =>
            `<button type="button" class="pick" data-folio="${esc(p.folio || p.id)}">${esc(p.folio)} · ${esc(p.nombre)}</button>`,
        )
        .join(" ");
      box.querySelectorAll(".pick").forEach((btn) => {
        btn.addEventListener("click", () => {
          $("pid").value = btn.getAttribute("data-folio") || "";
          consult();
        });
      });
      return;
    }
    box.innerHTML = renderAnswers(data.participante, data.respuestas || []);
  } catch (e) {
    box.innerHTML = `<div class="msg">${esc(e.message)}</div>`;
  }
}

async function exportCsv() {
  const res = await fetch(apiUrl("/api/admin/export"), { headers: { "x-admin-token": ADMIN } });
  if (!res.ok) throw new Error("No se pudo exportar.");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "registro-campana-ecociudadano.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function wipe() {
  const c1 = prompt("Escribe ELIMINAR para confirmar. Primero se guarda una copia.");
  if (c1 !== "ELIMINAR") return;
  const data = await api("/api/admin/wipe", {
    method: "POST",
    body: JSON.stringify({ confirm: "ELIMINAR" }),
  });
  alert("Copia guardada: " + (data.respaldo || "data/backups") + ". Datos de la campaña eliminados.");
  $("codes-box").innerHTML = "";
  $("consult-box").innerHTML = "";
  await refreshAll();
}

$("login-btn").addEventListener("click", login);
$("pin").addEventListener("keydown", (e) => { if (e.key === "Enter") login(); });
$("logout-btn").addEventListener("click", () => {
  showLogin("");
  $("login-msg").classList.add("hidden");
  $("pin").focus();
});
$("gen-btn").addEventListener("click", createSala);
$("consult-btn").addEventListener("click", consult);
$("pid").addEventListener("keydown", (e) => { if (e.key === "Enter") consult(); });
$("search-btn").addEventListener("click", refreshAll);
$("f-q").addEventListener("keydown", (e) => { if (e.key === "Enter") refreshAll(); });
$("clear-btn").addEventListener("click", () => {
  $("f-q").value = "";
  $("f-grado").value = "";
  $("f-momento").value = "";
  $("f-estado").value = "";
  refreshAll();
});
$("export-btn").addEventListener("click", () => exportCsv().catch((e) => alert(e.message)));
$("refresh-btn").addEventListener("click", refreshAll);
$("wipe-btn").addEventListener("click", () => wipe().catch((e) => alert(e.message)));
$("consult-box").addEventListener("click", async (e) => {
  const btn = e.target.closest("button.rubro");
  if (!btn) return;
  const on = !btn.classList.contains("on");
  await api("/api/admin/rubrica", {
    method: "POST",
    body: JSON.stringify({
      folio: btn.getAttribute("data-folio"),
      n: Number(btn.getAttribute("data-n")),
      criterio: btn.getAttribute("data-criterio"),
      valor: on,
    }),
  });
  btn.classList.toggle("on", on);
});

setInterval(() => {
  if (ADMIN && !$("panel-view").classList.contains("hidden")) loadVivo().catch(() => {});
}, 5000);

if (location.protocol === "file:") {
  showLogin(
    "No abras este archivo con doble clic. Ejecuta npm run dev y entra por /admin.html en el mismo equipo que sirve la página.",
  );
} else if (ADMIN) {
  $("login-view").classList.add("hidden");
  $("panel-view").classList.remove("hidden");
  refreshAll();
} else {
  $("pin").focus();
}
