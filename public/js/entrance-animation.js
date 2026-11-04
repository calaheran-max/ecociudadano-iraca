/**
 * Entrada cinematográfica: fondo → título → ruleta → interacción.
 * Se omite con ?campana=, prefers-reduced-motion o botón Saltar.
 */
export function startEntranceAnimation({ skip = false } = {}) {
  const body = document.body;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobile = matchMedia("(max-width: 860px)").matches;
  const factor = mobile ? 0.65 : 1;

  if (skip || reduce || sessionStorage.getItem("iraca_intro_done") === "1") {
    body.classList.add("intro-done");
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const finish = () => {
      body.classList.remove("intro-fase-0", "intro-fase-1", "intro-fase-2", "intro-fase-3", "intro-fase-4");
      body.classList.add("intro-done");
      overlay?.setAttribute("hidden", "");
      sessionStorage.setItem("iraca_intro_done", "1");
      resolve();
    };

    body.classList.add("intro-fase-0");

    const overlay = document.getElementById("intro-overlay");
    const titleEl = document.getElementById("intro-title");
    const subEl = document.getElementById("intro-sub");
    const skipBtn = document.getElementById("intro-skip");

    skipBtn?.addEventListener("click", finish, { once: true });

    const wait = (ms) => new Promise((r) => setTimeout(r, ms * factor));

    async function typeWriter(el, text) {
      if (!el) return;
      el.textContent = "";
      for (const ch of text) {
        el.textContent += ch;
        await wait(28);
      }
    }

    (async () => {
      await wait(700);
      if (body.classList.contains("intro-done")) return;
      body.classList.remove("intro-fase-0");
      body.classList.add("intro-fase-1");
      await typeWriter(titleEl, "EcoCiudadano Iracá");
      if (subEl) {
        subEl.hidden = false;
        subEl.textContent = "Grado 11° · Monitoreo ambiental y ciudadanía digital";
      }
      await wait(500);
      if (body.classList.contains("intro-done")) return;
      body.classList.remove("intro-fase-1");
      body.classList.add("intro-fase-2");
      await wait(900);
      if (body.classList.contains("intro-done")) return;
      body.classList.remove("intro-fase-2");
      body.classList.add("intro-fase-3");
      await wait(700);
      if (body.classList.contains("intro-done")) return;
      body.classList.remove("intro-fase-3");
      body.classList.add("intro-fase-4");
      await wait(500);
      overlay?.setAttribute("hidden", "");
      finish();
    })();
  });
}
