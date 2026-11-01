/**
 * server.js — EcoCiudadano Iracá
 * Sirve public/, CORS, calificación segura en el servidor.
 * GET /api/cuestionarios nunca incluye respuesta_correcta.
 */
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import {
  closeDb,
  connectDb,
  appendResultado,
  getCertificado,
  getIntento,
  getQuizFull,
  listDocentes,
  listFullQuizzes,
  listIntentos,
  listPublicQuizzes,
  listResultadosCampana,
  listReflexiones,
  listResults,
  saveAnonymousResult,
  saveCertificado,
  saveReflexion,
  upsertIntento,
  upsertQuiz,
  usingMongo,
} from "./db.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PIN = String(process.env.ADMIN_PIN || "2026").trim();

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

function pinOk(value) {
  const token = String(value || "").trim();
  const docente = String(process.env.TOKEN_DOCENTE || ADMIN_PIN).trim();
  return token === ADMIN_PIN || token === docente;
}

function verifyAdmin(req, res, next) {
  const bearer = String(req.headers.authorization || "");
  const fromBearer = bearer.toLowerCase().startsWith("bearer ") ? bearer.slice(7).trim() : "";
  const token = req.headers["x-admin-token"] || fromBearer;
  if (!pinOk(token)) {
    return res.status(401).json({ error: "No autorizado. Ingresa el PIN docente." });
  }
  next();
}

function escHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

/** Quita respuesta_correcta de cualquier forma anidada. */
function stripAnswers(quiz) {
  const ficha = quiz.ficha && typeof quiz.ficha === "object"
    ? {
        problema: quiz.ficha.problema || "",
        publico: quiz.ficha.publico || "",
        comportamiento: quiz.ficha.comportamiento || "",
        mensaje: quiz.ficha.mensaje || "",
        canal: quiz.ficha.canal || "",
        indicador: quiz.ficha.indicador || "",
      }
    : null;
  return {
    id: quiz.slug || quiz.id,
    slug: quiz.slug || quiz.id,
    titulo: quiz.titulo,
    autor: quiz.autor,
    tema: quiz.tema,
    ancla: quiz.ancla,
    descripcion: quiz.descripcion,
    compromiso: quiz.compromiso || "",
    ficha,
    theme: quiz.theme,
    colorIdentidad: quiz.colorIdentidad,
    totalPreguntas: (quiz.preguntas || []).length,
    preguntas: (quiz.preguntas || []).map((p) => ({
      id: p.id,
      enunciado: p.enunciado,
      opciones: p.opciones,
    })),
  };
}

app.get("/verificar/:codigo", async (req, res) => {
  const row = await getCertificado(req.params.codigo);
  const ok = Boolean(row);
  const titulo = ok ? "Certificado verificado" : "Código no encontrado";
  const cuerpo = ok
    ? `<p><strong>${escHtml(row.nombre)}</strong> · ${escHtml(row.grado)}</p><p>${escHtml(row.campana)}</p><p>${escHtml(row.aciertos)}/${escHtml(row.total)} · ${escHtml(row.puntaje)}/100</p><p>Código ${escHtml(row.codigo)}</p>`
    : `<p>Ese código no corresponde a un certificado emitido por el servidor.</p>`;
  res.type("html").send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${titulo}</title></head><body style="font-family:sans-serif;background:#0f172a;color:#fff;padding:40px"><h1>${titulo}</h1>${cuerpo}<p><a href="/" style="color:#7dffa8">Volver</a></p></body></html>`);
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, storage: usingMongo ? "mongo" : "json" });
});

/** URLs para QR / celular en la misma Wi‑Fi (nunca localhost en el QR). */
app.get("/api/share", (_req, res) => {
  const ips = localIPv4s();
  const urls = ips.map((ip) => `http://${ip}:${PORT}/`);
  res.json({
    port: PORT,
    urls,
    preferred: urls[0] || `http://localhost:${PORT}/`,
    hint: urls.length
      ? "Escanea el QR con el celular conectado a la misma red Wi‑Fi."
      : "No se detectó IP de red. Conecta Wi‑Fi y reinicia el servidor.",
  });
});

app.get("/api/cuestionarios", async (_req, res) => {
  try {
    const list = await listPublicQuizzes();
    res.json({ cuestionarios: list.map(stripAnswers) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/cuestionarios/:id", async (req, res) => {
  try {
    const quiz = await getQuizFull(req.params.id);
    if (!quiz || quiz.publicado === false) {
      return res.status(404).json({ error: "Cuestionario no encontrado." });
    }
    res.json({ cuestionario: stripAnswers(quiz) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/cuestionarios/:id/calificar", async (req, res) => {
  try {
    const quiz = await getQuizFull(req.params.id);
    if (!quiz) return res.status(404).json({ error: "Cuestionario no encontrado." });

    const sesion = String(req.body?.sesion || crypto.randomBytes(6).toString("hex"));
    const nombre = String(req.body?.nombre || "").trim().slice(0, 80);
    const grado = String(req.body?.grado || "").trim().slice(0, 12);
    const preguntaId = req.body?.preguntaId ? String(req.body.preguntaId) : "";
    const mapa = req.body?.respuestas;
    if (mapa && typeof mapa === "object" && !Array.isArray(mapa)) {
      if (!req.body.aceptoCompromiso) {
        return res.status(400).json({ error: "Falta la firma del compromiso ético." });
      }
      const estudiante = String(req.body.estudiante || req.body.nombre || "").trim().slice(0, 80);
      if (estudiante.length < 3 || !grado) {
        return res.status(400).json({ error: "Nombre y grado son obligatorios." });
      }
      const preguntas = quiz.preguntas || [];
      if (preguntas.length !== 8) {
        return res.status(500).json({ error: "La campaña no tiene 8 preguntas." });
      }
      const detalles = [];
      let aciertos = 0;
      for (const pregunta of preguntas) {
        if (!Object.prototype.hasOwnProperty.call(mapa, pregunta.id)) {
          return res.status(400).json({ error: "Faltan respuestas de las 8 preguntas." });
        }
        const opcion = Number(mapa[pregunta.id]);
        if (!Number.isInteger(opcion) || opcion < 0 || opcion >= pregunta.opciones.length) {
          return res.status(400).json({ error: "Hay una respuesta fuera de rango." });
        }
        const correcta = opcion === Number(pregunta.respuesta_correcta);
        if (correcta) aciertos += 1;
        detalles.push({
          pregunta: pregunta.id,
          correcta,
          retroalimentacion: pregunta.retroalimentacion || "",
        });
      }
      const total = preguntas.length;
      const puntaje = Math.round((aciertos / total) * 1000) / 10;
      const campanaId = quiz.slug || quiz.id;
      const codigo = "IRACA-2026-" + crypto.randomBytes(2).toString("hex").toUpperCase();
      const fecha = new Date().toISOString();
      await appendResultado(campanaId, {
        estudiante,
        grado,
        puntaje,
        aciertos,
        total,
        fecha,
        aceptoCompromiso: true,
        codigo,
      });
      await saveCertificado({
        codigo,
        nombre: estudiante,
        grado,
        cuestionarioId: campanaId,
        campana: quiz.titulo,
        autor: quiz.autor,
        aciertos,
        total,
        puntaje,
        fecha,
      });
      return res.json({
        exito: true,
        puntaje,
        aprobado: puntaje >= 60,
        codigo,
        aciertos,
        total,
        detalles,
      });
    }

    if (req.body?.finalizar) {
      if (!req.body.aceptoCompromiso) {
        return res.status(400).json({ error: "Falta la firma del compromiso ético." });
      }
      if (nombre.length < 3 || !grado) {
        return res.status(400).json({ error: "Nombre y grado son obligatorios." });
      }
      const intento = await getIntento(sesion);
      const campanaId = quiz.slug || quiz.id;
      if (!intento || intento.cuestionarioId !== campanaId) {
        return res.status(400).json({ error: "No hay respuestas de esta campaña en el servidor." });
      }
      const total = quiz.preguntas.length;
      const guardadas = intento.respuestas || {};
      if (Object.keys(guardadas).length < total) {
        return res.status(400).json({ error: "Faltan preguntas por comprobar en el servidor." });
      }
      const aciertos = Object.values(guardadas).filter((row) => row.correcta).length;
      const porcentaje = Math.round((aciertos / total) * 100);
      const codigo = "IRACA-2026-" + crypto.randomBytes(2).toString("hex").toUpperCase();
      await saveCertificado({
        codigo,
        nombre,
        grado,
        cuestionarioId: campanaId,
        campana: quiz.titulo,
        autor: quiz.autor,
        aciertos,
        total,
        puntaje: porcentaje,
        fecha: new Date().toISOString(),
      });
      await saveReflexion({
        sesion,
        nombre,
        grado,
        cuestionarioId: campanaId,
        compromiso: quiz.compromiso || "Firmado",
        notas: String(req.body?.notas || "").slice(0, 2000),
        createdAt: new Date().toISOString(),
      });
      return res.json({
        exito: true,
        codigo,
        aciertos,
        total,
        puntajeTotal: porcentaje,
        aprobado: porcentaje >= 60,
        mensaje: `El servidor recalculó el puntaje de ${nombre}. El código ${codigo} permite verificar el certificado.`,
      });
    }

    if (preguntaId) {
      const pregunta = (quiz.preguntas || []).find((p) => p.id === preguntaId);
      if (!pregunta) return res.status(400).json({ error: "Pregunta no encontrada." });
      const opcion = Number(req.body?.opcion);
      if (!Number.isInteger(opcion) || opcion < 0 || opcion >= pregunta.opciones.length) {
        return res.status(400).json({ error: "Selecciona una opción antes de comprobar." });
      }
      const correcta = opcion === Number(pregunta.respuesta_correcta);
      const previo = (await getIntento(sesion)) || {
        sesion,
        nombre,
        grado,
        cuestionarioId: quiz.slug || quiz.id,
        respuestas: {},
        createdAt: new Date().toISOString(),
      };
      previo.respuestas[preguntaId] = { opcion, correcta };
      previo.nombre = nombre || previo.nombre;
      previo.grado = grado || previo.grado;
      const aciertos = Object.values(previo.respuestas).filter((r) => r.correcta).length;
      const total = quiz.preguntas.length;
      previo.aciertos = aciertos;
      previo.total = total;
      previo.porcentaje = Math.round((aciertos / total) * 100);
      previo.updatedAt = new Date().toISOString();
      await upsertIntento(previo);
      return res.json({
        sesion,
        preguntaId,
        correcta,
        retroalimentacion: pregunta.retroalimentacion || "",
        aciertos,
        total,
        porcentaje: previo.porcentaje,
      });
    }

    const enviadas = Array.isArray(req.body?.respuestas) ? req.body.respuestas : [];
    const byId = Object.fromEntries(
      enviadas.map((r) => [String(r.preguntaId), Number(r.opcion)]),
    );
    let aciertos = 0;
    const detalle = (quiz.preguntas || []).map((p) => {
      const ok = Number(byId[p.id]) === Number(p.respuesta_correcta);
      if (ok) aciertos += 1;
      return { preguntaId: p.id, correcta: ok };
    });
    const total = quiz.preguntas.length || 1;
    const porcentaje = Math.round((aciertos / total) * 100);
    await saveAnonymousResult({
      cuestionarioId: quiz.slug || quiz.id,
      sesion,
      nombre,
      grado,
      puntaje: aciertos,
      total,
      porcentaje,
      aciertos,
      createdAt: new Date().toISOString(),
    });
    res.json({ sesion, aciertos, total, porcentaje, detalle });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/reflexiones", async (req, res) => {
  try {
    const nombre = String(req.body?.nombre || "").trim();
    const grado = String(req.body?.grado || "").trim();
    const cuestionarioId = String(req.body?.cuestionarioId || "").trim();
    const compromiso = String(req.body?.compromiso || "").trim();
    const notas = String(req.body?.notas || "").trim().slice(0, 2000);
    if (nombre.length < 3) return res.status(400).json({ error: "Escribe tu nombre." });
    if (!grado) return res.status(400).json({ error: "Selecciona tu grado." });
    if (!compromiso) return res.status(400).json({ error: "Falta el compromiso ético." });
    const sesion = String(req.body?.sesion || crypto.randomBytes(6).toString("hex"));
    await saveReflexion({
      sesion,
      nombre,
      grado,
      cuestionarioId,
      compromiso,
      notas,
      createdAt: new Date().toISOString(),
    });
    res.json({ ok: true, sesion });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/login", (req, res) => {
  if (!pinOk(req.body?.pin)) {
    return res.status(401).json({ error: "PIN incorrecto." });
  }
  res.json({ token: ADMIN_PIN });
});

app.get("/api/admin/cuestionarios", verifyAdmin, async (_req, res) => {
  try {
    const rows = await listFullQuizzes();
    res.json({ cuestionarios: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/cuestionarios", verifyAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.titulo || !body.autor || !body.slug) {
      return res.status(400).json({ error: "Faltan título, autor o slug." });
    }
    if (!Array.isArray(body.preguntas) || !body.preguntas.length) {
      return res.status(400).json({ error: "Agrega al menos una pregunta." });
    }
    for (const p of body.preguntas) {
      if (!p.enunciado || !Array.isArray(p.opciones) || p.opciones.length < 2) {
        return res.status(400).json({ error: "Cada pregunta necesita enunciado y opciones." });
      }
      if (p.respuesta_correcta == null || p.respuesta_correcta < 0) {
        return res.status(400).json({ error: "Marca la respuesta correcta de cada ítem." });
      }
    }
    const saved = await upsertQuiz(body);
    res.json({ ok: true, cuestionario: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/preguntas", verifyAdmin, async (_req, res) => {
  try {
    const rows = await listFullQuizzes();
    const banco = [];
    for (const q of rows) {
      for (const p of q.preguntas || []) {
        banco.push({
          cuestionario: q.titulo || q.slug || q.id,
          autor: q.autor,
          theme: q.theme,
          ...p,
        });
      }
    }
    res.json({ banco });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/resultados", verifyAdmin, async (_req, res) => {
  try {
    const [resultados, intentos, reflexiones] = await Promise.all([
      listResults(),
      listIntentos(),
      listReflexiones(),
    ]);
    const porTema = {};
    for (const item of intentos) {
      const key = item.cuestionarioId || "sin-tema";
      if (!porTema[key]) porTema[key] = { cuestionarioId: key, sesiones: 0, suma: 0 };
      porTema[key].sesiones += 1;
      porTema[key].suma += Number(item.porcentaje) || 0;
    }
    const estadisticas = Object.values(porTema).map((row) => ({
      cuestionarioId: row.cuestionarioId,
      sesiones: row.sesiones,
      promedio: row.sesiones ? Math.round(row.suma / row.sesiones) : 0,
    }));
    res.json({ resultados, intentos, reflexiones, estadisticas });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/campanas/:id/resultados", verifyAdmin, async (req, res) => {
  try {
    const quiz = await getQuizFull(req.params.id);
    if (!quiz) return res.status(404).json({ error: "Campaña no encontrada." });
    const campanaId = quiz.slug || quiz.id;
    const intentos = await listResultadosCampana(campanaId);
    const notas = intentos.map((row) => Number(row.puntaje)).filter((n) => Number.isFinite(n));
    const aprobados = notas.filter((n) => n >= 60).length;
    const promedio = notas.length
      ? Math.round((notas.reduce((sum, n) => sum + n, 0) / notas.length) * 10) / 10
      : 0;
    res.json({
      campana: {
        id: campanaId,
        tema: quiz.tema || quiz.titulo,
        estudiante: quiz.autor,
      },
      estadisticas: {
        totalIntentos: intentos.length,
        promedioGeneral: promedio,
        aprobados,
        reprobados: intentos.length - aprobados,
      },
      intentos: intentos.map((row) => ({
        estudiante: row.estudiante,
        grado: row.grado,
        puntaje: row.puntaje,
        fecha: row.fecha,
        aceptoCompromiso: Boolean(row.aceptoCompromiso),
        codigo: row.codigo || "",
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/campana/:id", verifyAdmin, async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    const quiz = await getQuizFull(id);
    if (!quiz) return res.status(404).json({ error: "Campaña no encontrada." });

    const [intentos, reflexiones] = await Promise.all([listIntentos(), listReflexiones()]);
    const soloEsta = new Map();
    for (const row of reflexiones) {
      if (row.cuestionarioId !== id) continue;
      soloEsta.set(row.sesion, { ...row });
    }
    for (const row of intentos) {
      if (row.cuestionarioId !== id) continue;
      soloEsta.set(row.sesion, { ...(soloEsta.get(row.sesion) || {}), ...row });
    }

    const registros = [...soloEsta.values()].map((row) => ({
      sesion: row.sesion,
      nombre: row.nombre || "Sin nombre",
      grado: row.grado || "—",
      aciertos: row.aciertos ?? null,
      total: row.total ?? (quiz.preguntas || []).length,
      porcentaje: row.porcentaje ?? null,
      compromiso: row.compromiso ? "Firmado" : "Sin firma",
      notas: row.notas || "",
      fecha: row.updatedAt || row.createdAt || "",
    }));
    const medibles = registros.filter((row) => row.porcentaje != null);
    const promedio = medibles.length
      ? Math.round(medibles.reduce((sum, row) => sum + Number(row.porcentaje), 0) / medibles.length)
      : null;

    res.json({
      campana: {
        id: quiz.slug || quiz.id,
        autor: quiz.autor,
        titulo: quiz.titulo,
        tema: quiz.tema,
        theme: quiz.theme,
        compromiso: quiz.compromiso || "",
        totalPreguntas: (quiz.preguntas || []).length,
      },
      registros,
      resumen: { evaluados: registros.length, promedio },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/docentes", verifyAdmin, async (_req, res) => {
  try {
    res.json({ docentes: await listDocentes() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function localIPv4s() {
  const found = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list || []) {
      const v4 = net.family === "IPv4" || net.family === 4;
      if (v4 && !net.internal) found.push(net.address);
    }
  }
  return found;
}

async function start() {
  try {
    await connectDb();
    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`EcoCiudadano Iracá en http://localhost:${PORT}`);
      const ips = localIPv4s();
      if (!ips.length) console.log("Red local: IP no detectada");
      for (const ip of ips) console.log(`Red local: http://${ip}:${PORT}`);
    });
    const shutdown = async () => {
      server.close();
      await closeDb();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (err) {
    console.error("No se pudo iniciar el servidor:", err.message);
    process.exit(1);
  }
}

start();
