/**
 * db.js — Capa de datos EcoCiudadano Iracá
 * JSON local en data/ por defecto. Si existe MONGO_URI, usa Mongoose/Atlas.
 * Las respuestas correctas viven aquí; el cliente nunca las lee.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { Cuestionario } from "./models/Cuestionario.js";
import { Docente } from "./models/Docente.js";
import { Respuesta } from "./models/Respuesta.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");
const quizzesFile = path.join(dataDir, "cuestionarios.json");
const resultsFile = path.join(dataDir, "respuestas_estudiantes.json");
const reflexionesFile = path.join(dataDir, "reflexiones.json");
const certificadosFile = path.join(dataDir, "certificados.json");
const resultadosFile = path.join(dataDir, "resultados.json");
const intentosFile = path.join(dataDir, "intentos.json");

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "";

export let usingMongo = false;

async function readJson(file, fallback) {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2), "utf8");
}

function asPublic(doc) {
  const plain = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  const preguntas = (plain.preguntas || []).map((p) => ({
    id: p.id,
    enunciado: p.enunciado,
    opciones: p.opciones,
  }));
  const ficha = plain.ficha && typeof plain.ficha === "object"
    ? {
        problema: plain.ficha.problema || "",
        publico: plain.ficha.publico || "",
        comportamiento: plain.ficha.comportamiento || "",
        mensaje: plain.ficha.mensaje || "",
        canal: plain.ficha.canal || "",
        indicador: plain.ficha.indicador || "",
      }
    : null;
  return {
    id: plain.slug || plain.id,
    slug: plain.slug || plain.id,
    titulo: plain.titulo,
    autor: plain.autor,
    tema: plain.tema,
    ancla: plain.ancla,
    descripcion: plain.descripcion,
    compromiso: plain.compromiso || "",
    ficha,
    theme: plain.theme,
    colorIdentidad: plain.colorIdentidad,
    publicado: plain.publicado !== false,
    totalPreguntas: preguntas.length,
    preguntas,
  };
}

export async function connectDb() {
  if (!MONGO_URI || MONGO_URI.includes("USER:PASSWORD") || MONGO_URI.includes("cluster0.XXXX")) {
    usingMongo = false;
    console.log("Base local JSON activa (data/). Configura MONGO_URI en .env para Atlas.");
    return { mode: "json" };
  }

  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 8000,
    });
    usingMongo = true;
    console.log("Conexión exitosa a MongoDB Atlas.");
    await seedMongoIfEmpty();
    return { mode: "mongo" };
  } catch (err) {
    usingMongo = false;
    console.error("No se pudo conectar a Atlas:", err.message);
    console.log("Continuando con almacenamiento JSON local.");
    return { mode: "json", error: err.message };
  }
}

async function seedMongoIfEmpty() {
  const count = await Cuestionario.countDocuments();
  if (count > 0) return;
  const local = await readJson(quizzesFile, []);
  if (!local.length) return;
  await Cuestionario.insertMany(
    local.map((q) => ({
      slug: q.slug || q.id,
      titulo: q.titulo,
      autor: q.autor,
      tema: q.tema,
      ancla: q.ancla,
      descripcion: q.descripcion,
      compromiso: q.compromiso || "",
      theme: q.theme,
      colorIdentidad: q.colorIdentidad,
      preguntas: q.preguntas,
      publicado: q.publicado !== false,
    })),
  );
  const docentes = await Docente.countDocuments();
  if (!docentes) {
    await Docente.create({
      nombre: "Panel docente Iracá",
      rol: "coordinacion",
      colorIdentidad: "#5BC0BE",
    });
  }
  console.log("Semilla de cuestionarios cargada en Atlas.");
}

export async function listPublicQuizzes() {
  if (usingMongo) {
    const rows = await Cuestionario.find({ publicado: true }).lean();
    return rows.map(asPublic);
  }
  const rows = await readJson(quizzesFile, []);
  return rows.filter((q) => q.publicado !== false).map(asPublic);
}

export async function getQuizFull(id) {
  if (usingMongo) {
    const row = await Cuestionario.findOne({ slug: id }).select("+preguntas.respuesta_correcta");
    return row ? row.toObject() : null;
  }
  const rows = await readJson(quizzesFile, []);
  return rows.find((q) => q.id === id || q.slug === id) || null;
}

export async function listFullQuizzes() {
  if (usingMongo) {
    return Cuestionario.find().select("+preguntas.respuesta_correcta").lean();
  }
  return readJson(quizzesFile, []);
}

export async function upsertQuiz(payload) {
  const id = payload.slug || payload.id;
  if (!id) throw new Error("El cuestionario necesita un id/slug.");
  if (usingMongo) {
    const doc = await Cuestionario.findOneAndUpdate(
      { slug: id },
      {
        slug: id,
        titulo: payload.titulo,
        autor: payload.autor,
        tema: payload.tema,
        ancla: payload.ancla || "",
        descripcion: payload.descripcion || "",
        compromiso: payload.compromiso || "",
        theme: payload.theme || id,
        colorIdentidad: payload.colorIdentidad || "#00FF9C",
        preguntas: payload.preguntas || [],
        publicado: payload.publicado !== false,
      },
      { upsert: true, new: true, runValidators: true },
    );
    return doc.toObject();
  }
  const rows = await readJson(quizzesFile, []);
  const next = {
    id,
    slug: id,
    titulo: payload.titulo,
    autor: payload.autor,
    tema: payload.tema,
    ancla: payload.ancla || "",
    descripcion: payload.descripcion || "",
    compromiso: payload.compromiso || "",
    theme: payload.theme || id,
    colorIdentidad: payload.colorIdentidad || "#00FF9C",
    publicado: payload.publicado !== false,
    preguntas: payload.preguntas || [],
  };
  const i = rows.findIndex((q) => q.id === id || q.slug === id);
  if (i >= 0) rows[i] = { ...rows[i], ...next };
  else rows.push(next);
  await writeJson(quizzesFile, rows);
  return next;
}

export async function saveAnonymousResult(entry) {
  if (usingMongo) {
    const doc = await Respuesta.create(entry);
    return doc.toObject();
  }
  const rows = await readJson(resultsFile, []);
  rows.push(entry);
  await writeJson(resultsFile, rows);
  return entry;
}

export async function listResults() {
  if (usingMongo) {
    return Respuesta.find().sort({ createdAt: -1 }).lean();
  }
  const rows = await readJson(resultsFile, []);
  return rows.slice().reverse();
}

export async function saveReflexion(entry) {
  const rows = await readJson(reflexionesFile, []);
  const i = rows.findIndex((r) => r.sesion && r.sesion === entry.sesion);
  if (i >= 0) rows[i] = { ...rows[i], ...entry };
  else rows.push(entry);
  await writeJson(reflexionesFile, rows);
  return entry;
}

export async function saveCertificado(entry) {
  const rows = await readJson(certificadosFile, []);
  rows.push(entry);
  await writeJson(certificadosFile, rows);
  return entry;
}

export async function appendResultado(campaignId, entry) {
  const store = await readJson(resultadosFile, {});
  const key = String(campaignId);
  if (!Array.isArray(store[key])) store[key] = [];
  store[key].push(entry);
  await writeJson(resultadosFile, store);
  return entry;
}

export async function listResultadosCampana(campaignId) {
  const store = await readJson(resultadosFile, {});
  const key = String(campaignId);
  const rows = Array.isArray(store[key]) ? store[key].slice() : [];
  const certs = await readJson(certificadosFile, []);
  for (const cert of certs) {
    if (cert.cuestionarioId !== key) continue;
    if (rows.some((row) => row.codigo && row.codigo === cert.codigo)) continue;
    rows.push({
      estudiante: cert.nombre,
      grado: cert.grado,
      puntaje: cert.puntaje,
      fecha: cert.fecha,
      aceptoCompromiso: true,
      codigo: cert.codigo,
    });
  }
  return rows;
}

export async function getCertificado(codigo) {
  const rows = await readJson(certificadosFile, []);
  return rows.find((row) => row.codigo === String(codigo).toUpperCase()) || null;
}

export async function listReflexiones() {
  const rows = await readJson(reflexionesFile, []);
  return rows.slice().reverse();
}

export async function upsertIntento(entry) {
  const rows = await readJson(intentosFile, []);
  const i = rows.findIndex((r) => r.sesion === entry.sesion);
  if (i >= 0) rows[i] = { ...rows[i], ...entry, respuestas: entry.respuestas };
  else rows.push(entry);
  await writeJson(intentosFile, rows);
  return entry;
}

export async function getIntento(sesion) {
  const rows = await readJson(intentosFile, []);
  return rows.find((r) => r.sesion === sesion) || null;
}

export async function listIntentos() {
  const rows = await readJson(intentosFile, []);
  return rows.slice().reverse();
}

export async function listDocentes() {
  if (usingMongo) {
    return Docente.find({ activo: true }).lean();
  }
  return [{ nombre: "Panel docente Iracá", rol: "coordinacion", colorIdentidad: "#5BC0BE" }];
}

export async function closeDb() {
  if (usingMongo) await mongoose.disconnect();
}
