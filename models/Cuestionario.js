import mongoose from "mongoose";

const preguntaSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    enunciado: { type: String, required: true },
    opciones: [{ type: String, required: true }],
    // Nunca se proyecta al cliente público.
    respuesta_correcta: { type: Number, required: true, select: false },
    retroalimentacion: { type: String, default: "" },
  },
  { _id: false },
);

const cuestionarioSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    titulo: { type: String, required: true },
    autor: { type: String, required: true },
    tema: { type: String, required: true },
    ancla: { type: String, default: "" },
    descripcion: { type: String, default: "" },
    compromiso: { type: String, default: "" },
    theme: { type: String, required: true },
    colorIdentidad: { type: String, default: "#00FF9C" },
    preguntas: { type: [preguntaSchema], default: [] },
    publicado: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Cuestionario = mongoose.model("Cuestionario", cuestionarioSchema);
