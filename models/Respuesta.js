import mongoose from "mongoose";

const respuestaSchema = new mongoose.Schema(
  {
    cuestionarioId: { type: String, required: true, index: true },
    sesion: { type: String, required: true },
    puntaje: { type: Number, required: true },
    total: { type: Number, required: true },
    porcentaje: { type: Number, required: true },
    aciertos: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

export const Respuesta = mongoose.model("Respuesta", respuestaSchema);
