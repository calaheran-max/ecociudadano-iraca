import { mascotaDe } from "./mascotas.js";
import { createMoonRoulette } from "./moon-roulette.js";
import { initQrModal } from "./qr-modal.js";

const workspace = document.getElementById("workspace");
const toastEl = document.getElementById("toast");

if (window.location.port === "5500" || window.location.port === "5501") {
  document.body.innerHTML = `
    <div style="display:flex;justify-content:center;align-items:center;min-height:100vh;background:#0a0f0d;color:#fff;font-family:sans-serif;text-align:center;padding:20px;">
      <div>
        <h1 style="color:#00ff9c;">Error de conexión</h1>
        <p style="font-size:18px;margin:20px 0;">Este proyecto requiere el servidor Node.js. Live Server no ejecuta la API.</p>
        <p style="font-size:16px;color:#aaa;">Cierra Live Server y ejecuta:</p>
        <code style="display:block;background:#1a2a22;padding:15px;border-radius:8px;margin:20px auto;max-width:420px;font-size:16px;text-align:left;">
          cd proyecto-iraca<br>npm run dev
        </code>
        <p style="font-size:16px;color:#aaa;">Luego abre <strong style="color:#00ff9c;">http://localhost:3000</strong></p>
      </div>
    </div>`;
  throw new Error("Live Server detectado. Usa el servidor Node.js en el puerto 3000.");
}

let quizzes = [];
let activeId = "";
let quizLock = false;
let roulette;

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

function toast(text) {
  toastEl.textContent = text;
  toastEl.classList.add("is-on");
  window.setTimeout(() => toastEl.classList.remove("is-on"), 2200);
}

function quizById(id) {
  return quizzes.find((quiz) => quiz.id === id) || null;
}

function fichaValue(...candidates) {
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "Información en validación técnica";
}

function bentoCard(label, value, extraClass = "") {
  const card = document.createElement("article");
  card.className = "bento-card" + (extraClass ? " " + extraClass : "");
  const title = document.createElement("strong");
  title.textContent = label;
  const body = document.createElement("p");
  body.textContent = value;
  card.append(title, body);
  return card;
}

function showFicha(id) {
  if (quizLock) return;
  const quiz = quizById(id);
  if (!quiz) return;
  if (id === activeId && workspace.querySelector("#campaign-ficha")) return;
  if (id === activeId && workspace.querySelector("#gate-form")) return;
  activeId = id;
  const pet = mascotaDe(quiz.id);
  const ficha = quiz.ficha || {};
  document.body.className = `theme-${quiz.theme}`;
  workspace.replaceChildren();
  const section = document.createElement("section");
  section.className = "campaign-view";
  section.id = "campaign-ficha";
  const mascot = document.createElement("div");
  mascot.className = "campaign-mascot campaign-mascot-lg";
  mascot.setAttribute("aria-label", pet ? pet.nombre : quiz.autor);
  if (pet) mascot.innerHTML = pet.svg;
  const badge = document.createElement("div");
  badge.className = "holo-badge";
  badge.textContent = "Guía 8 · Ciudadanía digital y campaña social";
  const title = document.createElement("h2");
  title.textContent = quiz.titulo;
  const owner = document.createElement("p");
  owner.textContent = pet ? `${quiz.autor} · ${pet.nombre}, ${pet.rol}` : quiz.autor;
  const grid = document.createElement("div");
  grid.className = "bento-grid";
  grid.append(
    bentoCard("Problema identificado", fichaValue(ficha.problema, quiz.descripcion, quiz.tema)),
    bentoCard("Público objetivo", fichaValue(ficha.publico)),
    bentoCard("Comportamiento a promover", fichaValue(ficha.comportamiento)),
    bentoCard("Canal de difusión", fichaValue(ficha.canal)),
    bentoCard("Mensaje principal de impacto", fichaValue(ficha.mensaje, quiz.titulo), "span-2 is-mensaje"),
    bentoCard("Indicador de impacto", fichaValue(ficha.indicador), "span-2"),
  );
  const start = document.createElement("button");
  start.className = "btn";
  start.type = "button";
  start.id = "start-survey";
  start.textContent = "Iniciar encuesta y retos";
  start.addEventListener("click", () => showGateForm(quiz.id));
  section.append(mascot, badge, title, owner, grid, start);
  workspace.append(section);
  workspace.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showGateForm(id) {
  if (quizLock) return;
  const quiz = quizById(id);
  if (!quiz) return;
  if (id === activeId && workspace.querySelector("#gate-form")) return;
  activeId = id;
  const pet = mascotaDe(quiz.id);
  document.body.className = `theme-${quiz.theme}`;
  workspace.replaceChildren();
  const section = document.createElement("section");
  section.className = "campaign-view";
  const mascot = document.createElement("div");
  mascot.className = "campaign-mascot campaign-mascot-lg";
  mascot.setAttribute("aria-label", pet ? pet.nombre : quiz.autor);
  if (pet) mascot.innerHTML = pet.svg;
  const title = document.createElement("h2");
  title.textContent = quiz.titulo;
  const owner = document.createElement("p");
  owner.textContent = pet ? `${quiz.autor} · ${pet.nombre}, ${pet.rol}` : quiz.autor;
  const lead = document.createElement("p");
  lead.textContent = quiz.descripcion || quiz.tema;
  const form = document.createElement("form");
  form.id = "gate-form";
  form.className = "gate-form";
  form.innerHTML = `
    <label for="nombre">Nombre del estudiante</label>
    <input id="nombre" name="nombre" maxlength="80" autocomplete="name" required />
    <label for="grado">Grado</label>
    <select id="grado" name="grado" required>
      <option value="11°">11°</option>
      <option value="11-1">11-1</option>
      <option value="11-2">11-2</option>
      <option value="10-1">10-1</option>
      <option value="10-2">10-2</option>
    </select>
    <button class="btn" id="start-btn" type="submit" disabled>Comenzar evaluación</button>`;
  section.append(mascot, title, owner, lead, form);
  workspace.append(section);
  workspace.scrollIntoView({ behavior: "smooth", block: "start" });
  const nombre = form.querySelector("#nombre");
  const start = form.querySelector("#start-btn");
  const arm = () => {
    start.disabled = nombre.value.trim().length < 3;
  };
  nombre.addEventListener("input", arm);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (start.disabled) return;
    startQuiz(quiz, nombre.value.trim(), form.querySelector("#grado").value);
  });
}

async function startQuiz(quiz, nombre, grado) {
  roulette?.pause();
  quizLock = true;
  const detail = await fetch("/api/cuestionarios/" + quiz.id).then((r) => r.json());
  const current = detail.cuestionario;
  if (!current?.preguntas || current.preguntas.length !== 8) {
    quizLock = false;
    toast("Esta campaña no tiene 8 preguntas.");
    return;
  }
  const respuestas = {};
  let index = 0;

  function paint(i) {
    index = i;
    const pregunta = current.preguntas[i];
    workspace.replaceChildren();
    const view = document.createElement("section");
    view.className = "campaign-view";
    view.innerHTML = `
      <header class="hud">
        <div><div class="kicker">${esc(current.autor)}</div><b>Pregunta ${i + 1} de 8</b></div>
        <div>${esc(nombre)} · ${esc(grado)}</div>
      </header>
      <div class="hud-track" aria-hidden="true"><div class="hud-fill" style="width:${((i + 1) / 8) * 100}%"></div></div>
      <article class="question-card">
        <p><strong>${i + 1}.</strong> ${esc(pregunta.enunciado)}</p>
        <div class="opciones-grid">
          ${pregunta.opciones
            .map(
              (op, n) => `<label class="opcion-card">
                <input type="radio" name="opcion" value="${n}" ${respuestas[pregunta.id] === n ? "checked" : ""}>
                <span>${esc(op)}</span>
              </label>`,
            )
            .join("")}
        </div>
      </article>
      <div class="controls">
        <button class="btn" type="button" id="next-btn" ${respuestas[pregunta.id] == null ? "disabled" : ""}>${i === 7 ? "Ir al compromiso" : "Siguiente"}</button>
      </div>`;
    workspace.append(view);
    view.querySelectorAll('input[name="opcion"]').forEach((input) => {
      input.addEventListener("change", () => {
        respuestas[pregunta.id] = Number(input.value);
        view.querySelector("#next-btn").disabled = false;
      });
    });
    view.querySelector("#next-btn").addEventListener("click", () => {
      if (respuestas[pregunta.id] == null) return;
      if (i < 7) paint(i + 1);
      else showPledge();
    });
  }

  function showPledge() {
    workspace.replaceChildren();
    const view = document.createElement("section");
    view.className = "campaign-view";
    const title = document.createElement("h2");
    title.textContent = "Firma del compromiso ético";
    const text = document.createElement("p");
    text.textContent = current.compromiso;
    const form = document.createElement("form");
    form.className = "gate-form";
    form.innerHTML = `
      <label class="consent"><input type="checkbox" id="firma"> <span>Acepto el compromiso de esta campaña.</span></label>
      <button class="btn" id="send-btn" type="submit" disabled>Enviar evaluación</button>`;
    view.append(title, text, form);
    workspace.append(view);
    form.querySelector("#firma").addEventListener("change", (event) => {
      form.querySelector("#send-btn").disabled = !event.target.checked;
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      form.querySelector("#send-btn").disabled = true;
      const res = await fetch("/api/cuestionarios/" + current.id + "/calificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estudiante: nombre,
          grado,
          respuestas,
          aceptoCompromiso: true,
          puntaje: 100,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        form.querySelector("#send-btn").disabled = false;
        toast(data.error || "No se pudo calificar.");
        return;
      }
      showResult(current, nombre, grado, data);
    });
  }

  paint(0);
  workspace.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showResult(current, nombre, grado, data) {
  workspace.replaceChildren();
  const view = document.createElement("section");
  view.className = "campaign-view";
  const titulo = data.aprobado ? "Certificado de aprobación" : "Constancia de participación";
  const fecha = new Date().toLocaleDateString("es-CO");
  view.innerHTML = `
    <p class="score-pop" id="score-pop">0</p>
    <div class="cert-sheet">
      <p class="kicker">Institución Educativa Iracá · San Martín, Meta</p>
      <h2>${esc(titulo)}</h2>
      <p>Se reconoce a <strong>${esc(nombre)}</strong> (${esc(grado)}) por completar <strong>${esc(current.titulo)}</strong>, de ${esc(current.autor)}.</p>
      <p>Puntaje del servidor: <strong>${esc(data.aciertos)}/${esc(data.total)} · ${esc(data.puntaje)}/100</strong></p>
      <p>Código de verificación: <strong>${esc(data.codigo)}</strong></p>
      <p>Compromiso ético aceptado por ${esc(nombre)} · ${esc(fecha)}</p>
    </div>
    <ol class="detalle-list">
      ${(data.detalles || [])
        .map((row, i) => {
          const pregunta = current.preguntas.find((item) => item.id === row.pregunta);
          return `<li><strong>${i + 1}.</strong> ${esc(pregunta?.enunciado || "")}<br>${row.correcta ? "Acierto." : "No acertó."} ${esc(row.retroalimentacion || "")}</li>`;
        })
        .join("")}
    </ol>
    <div class="controls">
      <button class="btn" type="button" id="print-cert">Descargar certificado</button>
      <a class="btn" href="/verificar/${esc(data.codigo)}">Verificar código</a>
      <button class="btn" type="button" id="restart">Volver al inicio</button>
    </div>`;
  workspace.append(view);
  const pop = view.querySelector("#score-pop");
  const target = Number(data.puntaje) || 0;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) pop.textContent = String(target);
  else {
    const start = performance.now();
    const frame = (now) => {
      const t = Math.min(1, (now - start) / 700);
      pop.textContent = (target * (1 - Math.pow(1 - t, 3))).toFixed(1);
      if (t < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  view.querySelector("#print-cert").addEventListener("click", () => window.print());
  view.querySelector("#restart").addEventListener("click", () => location.reload());
}

function previewCampaign(quiz) {
  if (quizLock || !quiz) return;
  if (activeId === quiz.id && (workspace.querySelector("#campaign-ficha") || workspace.querySelector("#gate-form"))) {
    return;
  }
  activeId = "";
  document.body.className = `theme-${quiz.theme}`;
  const pet = mascotaDe(quiz.id);
  workspace.replaceChildren();
  const section = document.createElement("section");
  section.className = "campaign-view";
  const mascot = document.createElement("div");
  mascot.className = "campaign-mascot campaign-mascot-lg";
  if (pet) mascot.innerHTML = pet.svg;
  const title = document.createElement("h2");
  title.textContent = quiz.titulo;
  const owner = document.createElement("p");
  owner.textContent = pet ? `${quiz.autor} · ${pet.nombre}, ${pet.rol}` : quiz.autor;
  const hint = document.createElement("p");
  hint.textContent = "Pulsa la tarjeta o Enter para entrar a esta campaña.";
  section.append(mascot, title, owner, hint);
  workspace.append(section);
}

function toCampaign(quiz) {
  const pet = mascotaDe(quiz.id);
  return {
    ...quiz,
    mascotName: pet?.nombre || quiz.autor,
    student: quiz.autor,
    topic: quiz.tema,
  };
}

async function boot() {
  initQrModal();
  const res = await fetch("/api/cuestionarios");
  if (!res.ok) throw new Error("La API no respondió (" + res.status + ")");
  const data = await res.json();
  quizzes = Array.isArray(data) ? data : data.cuestionarios || [];
  if (!quizzes.length) throw new Error("El servidor no devolvió campañas");
  const campaigns = quizzes.map(toCampaign);
  const mascots = Object.fromEntries(campaigns.map((item) => [item.id, mascotaDe(item.id)?.svg || ""]));
  const stage = document.getElementById("moon-stage");
  roulette = createMoonRoulette({
    stage,
    campaigns,
    mascots,
    onFocus: (campaign) => {
      if (!quizLock) document.body.className = `theme-${campaign.theme}`;
      previewCampaign(campaign);
    },
    onEnter: (campaign) => showFicha(campaign.id),
  });
  window.addEventListener("keydown", (event) => {
    if (quizLock || stage.contains(document.activeElement)) return;
    if (workspace.querySelector("#campaign-ficha") || workspace.querySelector("#gate-form")) return;
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
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
  workspace.textContent = "No se pudieron cargar las campañas desde esta misma dirección. Deja el servidor encendido con npm run dev. " + (err.message || "");
});
