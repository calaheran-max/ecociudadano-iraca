/**
 * Ruleta vertical infinita. La tarjeta bajo la flecha es la selección.
 * El movimiento usa translate3d y requestAnimationFrame, a 22 px/s.
 */
export function mountRoulette({ track, roulette, items, onSelect }) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const speed = 22;
  let offset = 0;
  let lastTime = 0;
  let paused = reduced;
  let pinned = false;
  let frameId = 0;
  let selectedId = "";

  function stampSvg(svg, mark) {
    return String(svg || "")
      .replace(/id="([^"]+)"/g, (_, id) => `id="${id}-${mark}"`)
      .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${id}-${mark})`);
  }

  track.replaceChildren();
  const copies = reduced ? [0] : [0, 1];
  for (const copy of copies) {
    for (const item of items) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "campaign-card";
      btn.dataset.campaignId = item.id;
      btn.dataset.copy = String(copy);
      btn.setAttribute("aria-label", `${item.student}. ${item.topic}`);
      const mascot = document.createElement("span");
      mascot.className = "campaign-mascot";
      mascot.innerHTML = stampSvg(item.svg, `${item.id}-${copy}`);
      const text = document.createElement("span");
      const strong = document.createElement("strong");
      strong.textContent = item.student;
      const small = document.createElement("small");
      small.textContent = item.topic;
      text.append(strong, small);
      btn.append(mascot, text);
      btn.addEventListener("click", () => choose(item.id, btn));
      track.append(btn);
    }
  }

  function loopHeight() {
    return reduced ? 0 : track.scrollHeight / 2;
  }

  function wrap(value) {
    const loop = loopHeight();
    if (loop <= 0) return 0;
    let next = value % loop;
    if (next < 0) next += loop;
    return next;
  }

  function apply() {
    offset = wrap(offset);
    track.style.transform = `translate3d(0, ${-offset}px, 0)`;
  }

  function nearest() {
    const box = roulette.getBoundingClientRect();
    const y = box.top + box.height / 2;
    let best = null;
    let bestDist = Infinity;
    for (const card of track.querySelectorAll(".campaign-card")) {
      const rect = card.getBoundingClientRect();
      const dist = Math.abs(rect.top + rect.height / 2 - y);
      if (dist < bestDist) {
        bestDist = dist;
        best = card;
      }
    }
    return best;
  }

  function mark(id) {
    for (const card of track.querySelectorAll(".campaign-card")) {
      const on = card.dataset.campaignId === id;
      card.classList.toggle("is-selected", on);
      if (on) card.setAttribute("aria-current", "true");
      else card.removeAttribute("aria-current");
    }
  }

  function emit(id, reason) {
    if (!id || (id === selectedId && reason === "scroll")) return;
    selectedId = id;
    mark(id);
    onSelect(id, { pinned, reason });
  }

  function choose(id, card) {
    pinned = true;
    paused = true;
    const box = roulette.getBoundingClientRect();
    const y = box.top + box.height / 2;
    const rect = card.getBoundingClientRect();
    offset += rect.top + rect.height / 2 - y;
    apply();
    emit(id, "click");
  }

  function tick(time) {
    if (!lastTime) lastTime = time;
    const delta = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    if (!paused && !pinned) {
      offset += speed * delta;
      apply();
      const card = nearest();
      if (card) emit(card.dataset.campaignId, "scroll");
    }
    frameId = requestAnimationFrame(tick);
  }

  roulette.addEventListener("pointerenter", () => {
    paused = true;
  });
  roulette.addEventListener("pointerleave", () => {
    if (!pinned && !reduced) paused = false;
  });
  track.addEventListener("focusin", () => {
    paused = true;
  });
  track.addEventListener("focusout", () => {
    if (!pinned && !reduced) paused = false;
  });

  function step(dir) {
    const cards = [...track.querySelectorAll('.campaign-card[data-copy="0"]')];
    const i = Math.max(0, cards.findIndex((card) => card.dataset.campaignId === selectedId));
    const next = cards[(i + dir + cards.length) % cards.length];
    if (next) choose(next.dataset.campaignId, next);
  }

  apply();
  requestAnimationFrame(() => {
    const first = nearest();
    if (first) emit(first.dataset.campaignId, "scroll");
  });
  if (!reduced) frameId = requestAnimationFrame(tick);

  return {
    pause() {
      paused = true;
      pinned = true;
    },
    step,
    destroy() {
      cancelAnimationFrame(frameId);
    },
  };
}
