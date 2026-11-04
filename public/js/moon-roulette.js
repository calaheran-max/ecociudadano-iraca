/**
 * Ruleta de campañas sobre el arco de una luna creciente.
 * El ángulo 0 es el punto más a la derecha, donde está el señalador.
 * --R, --anchor y --step viven en CSS para afinar la geometría sin tocar esta lógica.
 */
export function createMoonRoulette({ stage, campaigns, mascots, onFocus, onEnter }) {
  const style = getComputedStyle(stage);
  const R = parseFloat(style.getPropertyValue("--R")) || 520;
  const anchor = parseFloat(style.getPropertyValue("--anchor")) || 300;
  const step = parseFloat(style.getPropertyValue("--step")) || 28;
  const CARD_W = 280;
  const CARD_H = 92;
  const CX = anchor - R;
  const STEP = step;
  const SPAN = STEP * campaigns.length;
  const SPEED = 6;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wrap = (a) => ((((a + SPAN / 2) % SPAN) + SPAN) % SPAN) - SPAN / 2;

  let offset = 0;
  let last = 0;
  let paused = false;
  let engaged = false;
  let target = null;
  let pendingEnter = null;
  let focusedIdx = -1;
  let frameId = 0;

  const cards = campaigns.map((campaign, i) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "moon-card";
    el.setAttribute("role", "option");
    el.dataset.id = campaign.id;
    const art = document.createElement("span");
    art.innerHTML = mascots[campaign.id] ?? "";
    const text = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = campaign.mascotName;
    const sub = document.createElement("small");
    sub.textContent = `${campaign.student} · ${campaign.topic}`;
    text.append(name, sub);
    el.append(art, text);
    el.addEventListener("click", () => centerOn(i, true));
    stage.appendChild(el);
    return el;
  });

  function centerOn(i, enter = false) {
    const index = (i + campaigns.length) % campaigns.length;
    const next = -index * STEP;
    paused = true;
    if (enter && Math.abs(wrap(next - offset)) < 0.8) {
      offset = next;
      target = null;
      pendingEnter = null;
      engaged = true;
      onEnter?.(campaigns[index]);
      render();
      return;
    }
    target = next;
    pendingEnter = enter ? campaigns[index] : null;
  }

  function pause() {
    paused = true;
  }

  function resume() {
    if (target === null && !engaged) paused = false;
  }

  function render() {
    const cy = stage.clientHeight / 2;
    let best = 0;
    let bestDist = Infinity;
    cards.forEach((el, i) => {
      const angle = wrap(i * STEP + offset);
      const rad = (angle * Math.PI) / 180;
      const x = CX + R * Math.cos(rad);
      const y = cy + R * Math.sin(rad);
      const dist = Math.abs(angle);
      const visible = dist < 78;
      el.style.transform = `translate3d(${x - CARD_W / 2}px, ${y - CARD_H / 2}px, 0) rotate(${angle * 0.25}deg) scale(${1 - dist / 320})`;
      el.style.opacity = visible ? String(Math.max(0.28, 1 - dist / 100)) : "0";
      el.style.pointerEvents = visible ? "auto" : "none";
      el.style.zIndex = String(80 - Math.round(dist));
      el.tabIndex = -1;
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    if (best !== focusedIdx) {
      focusedIdx = best;
      cards.forEach((el, i) => {
        const on = i === best;
        el.classList.toggle("is-selected", on);
        if (on) el.setAttribute("aria-selected", "true");
        else el.removeAttribute("aria-selected");
      });
      onFocus?.(campaigns[best]);
    }
  }

  function tick(time) {
    const dt = Math.min((time - (last || time)) / 1000, 0.05);
    last = time;
    if (target !== null) {
      const delta = wrap(target - offset);
      offset += delta * Math.min(1, dt * 6);
      if (Math.abs(delta) < 0.05) {
        offset = target;
        target = null;
        if (pendingEnter) {
          engaged = true;
          paused = true;
          const chosen = pendingEnter;
          pendingEnter = null;
          onEnter?.(chosen);
        }
      }
    } else if (!paused && !engaged && !reduceMotion) {
      offset -= SPEED * dt;
    }
    render();
    frameId = requestAnimationFrame(tick);
  }

  stage.addEventListener("pointerdown", () => {
    paused = true;
  });
  stage.addEventListener("pointerenter", () => {
    paused = true;
  });
  stage.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "touch") return;
    if (target === null && !engaged) paused = false;
  });
  stage.addEventListener("focusin", () => {
    paused = true;
  });
  stage.addEventListener("focusout", () => {
    if (target === null && !engaged) paused = false;
  });
  stage.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      centerOn(focusedIdx + 1);
    }
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      centerOn(focusedIdx - 1);
    }
    if (event.key === "Enter") {
      event.preventDefault();
      centerOn(focusedIdx, true);
    }
  });

  function centerById(campanaId, enter = false) {
    const i = campaigns.findIndex((c) => c.id === campanaId || c.slug === campanaId);
    if (i < 0) return false;
    centerOn(i, enter);
    return true;
  }

  frameId = requestAnimationFrame(tick);
  return {
    destroy() {
      cancelAnimationFrame(frameId);
    },
    center: centerOn,
    centerById,
    pause,
    resume,
    index: () => focusedIdx,
  };
}
