/**
 * Modal QR: abre la plataforma en celular vía URL LAN (misma Wi‑Fi).
 * No usa localhost en el código (los teléfonos no lo resuelven).
 */
const API = "/api";

function $(id) {
  return document.getElementById(id);
}

function buildQrImageUrl(text) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(text)}`;
}

async function loadShareUrl() {
  try {
    const res = await fetch(`${API}/share`);
    if (!res.ok) throw new Error("share");
    const data = await res.json();
    return data;
  } catch {
    const host = window.location.hostname;
    const fallback =
      host && host !== "localhost" && host !== "127.0.0.1"
        ? `${window.location.origin}/`
        : null;
    return {
      preferred: fallback,
      urls: fallback ? [fallback] : [],
      hint: fallback
        ? "Usa esta URL en el celular (misma red)."
        : "Abre el sitio desde la IP de red (ej. http://192.168.x.x:3000) y vuelve a abrir el QR.",
    };
  }
}

export function initQrModal() {
  const openBtn = $("btn-qr");
  const modal = $("qr-modal");
  const closeBtn = $("qr-modal-close");
  const backdrop = $("qr-modal-backdrop");
  const img = $("qr-img");
  const urlEl = $("qr-url");
  const hintEl = $("qr-hint");
  const copyBtn = $("qr-copy");

  if (!openBtn || !modal) return;

  async function open() {
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    hintEl.textContent = "Generando enlace de red…";
    img.removeAttribute("src");
    img.alt = "Generando código QR";

    const data = await loadShareUrl();
    const url = data.preferred;
    if (!url) {
      urlEl.textContent = "—";
      hintEl.textContent = data.hint || "Sin URL de red disponible.";
      return;
    }
    urlEl.textContent = url;
    hintEl.textContent = data.hint || "";
    img.src = buildQrImageUrl(url);
    img.alt = `Código QR hacia ${url}`;
  }

  function close() {
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
  }

  openBtn.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  backdrop?.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) close();
  });

  copyBtn?.addEventListener("click", async () => {
    const text = urlEl.textContent.trim();
    if (!text || text === "—") return;
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = "Copiado";
      setTimeout(() => {
        copyBtn.textContent = "Copiar enlace";
      }, 1600);
    } catch {
      copyBtn.textContent = "Selecciona el enlace";
    }
  });
}
