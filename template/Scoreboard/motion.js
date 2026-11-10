const slideDuration = 300;
const stagger = 60;

export function connectScoreboardMotion(board, onCpr = () => {}) {
  const stream = new EventSource("/api/scoreboard-visibility/events");
  let receivedState = false;
  let motion;
  let completion;

  function setHidden(hidden) {
    board.classList.toggle("scoreboard-motion-hidden", hidden);
  }

  function cancelMotion() {
    clearTimeout(completion);
    motion?.animations.forEach(animation => animation.cancel());
    motion = undefined;
  }

  function animateRows() {
    if (!motion) return;
    const current = motion;
    const parts = Array.from(board.querySelectorAll(":scope > .top-item, :scope > .ranks > .rank-row, :scope > .footer"));
    if (!current.visible) parts.reverse();
    const offset = `${board.offsetWidth + 48}px 0px`;
    const shown = { translate: "0px 0px", opacity: 1 };
    const outside = { translate: offset, opacity: 0 };
    const elapsed = performance.now() - current.started;

    parts.forEach((part, index) => {
      if (current.animations.has(part)) return;
      const from = current.previous.get(part) ?? (current.visible ? outside : shown);
      const to = current.visible ? shown : outside;
      current.animations.set(part, part.animate([from, to], {
        duration: slideDuration,
        delay: index * stagger - elapsed,
        fill: "both",
        easing: current.visible ? "cubic-bezier(.16, 1, .3, 1)" : "cubic-bezier(.5, 0, .9, .35)",
      }));
    });

    clearTimeout(completion);
    const duration = slideDuration + Math.max(0, parts.length - 1) * stagger;
    completion = setTimeout(() => {
      if (motion !== current) return;
      setHidden(!current.visible);
      cancelMotion();
    }, Math.max(0, duration - elapsed));
  }

  function receive(visible, animate) {
    const previous = new Map();
    if (motion && animate) {
      motion.animations.forEach((_animation, part) => {
        const style = getComputedStyle(part);
        previous.set(part, { translate: style.translate === "none" ? "0px 0px" : style.translate, opacity: style.opacity });
      });
    }
    cancelMotion();
    if (!animate) {
      setHidden(!visible);
      return;
    }
    setHidden(false);
    motion = { visible, started: performance.now(), previous, animations: new Map() };
    animateRows();
  }

  new MutationObserver(animateRows).observe(board.querySelector(".ranks"), { childList: true });
  stream.addEventListener("message", event => {
    const { visible, animate } = JSON.parse(event.data);
    if (typeof visible !== "boolean") return;
    receivedState = true;
    receive(visible, animate === true);
  });
  stream.addEventListener("cpr", event => onCpr(JSON.parse(event.data)));
  stream.addEventListener("error", () => {
    if (!receivedState) setHidden(false);
  });
}
