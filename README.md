# EcoCiudadano Iracá

Evaluación de las 9 campañas ambientales del grado 11°, I.E. Iracá.

## Instalación

```bash
npm install
```

Copia `.env.example` a `.env` y completa `MONGO_URI` si vas a usar Atlas. Sin una URI real, el servidor guarda en `data/`.

## Comandos

```bash
npm run dev
```

Abre http://localhost:3000 para el estudiante y http://localhost:3000/admin.html para la auditoría docente. El PIN está en `ADMIN_PIN` (o `TOKEN_DOCENTE`).

## Flujo

1. La ruleta es la entrada, con mascota y señalador.
2. El formulario pide nombre y grado.
3. Hay 8 preguntas. La retroalimentación aparece al final.
4. El compromiso se firma después de la última pregunta.
5. El servidor compara las respuestas con la clave privada y emite un código `IRACA-2026-XXXX`.
6. El panel docente, con PIN, muestra solo la campaña elegida.

## API

- `GET /api/cuestionarios` — campañas y preguntas, sin `respuesta_correcta`.
- `POST /api/cuestionarios/:id/calificar` — cuerpo `{ estudiante, grado, respuestas, aceptoCompromiso }`. El puntaje que mande el navegador no se usa.
- `GET /verificar/:codigo` — comprueba un certificado.
- `POST /api/admin/login` — cuerpo `{ pin }`.
- `GET /api/admin/campanas/:id/resultados` — header `Authorization: Bearer TOKEN` o `x-admin-token`.
