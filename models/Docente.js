import mongoose from "mongoose";

const docenteSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true },
    rol: { type: String, default: "docente" },
    pinHash: { type: String, default: "" },
    colorIdentidad: { type: String, default: "#5BC0BE" },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Docente = mongoose.model("Docente", docenteSchema);
