import { fitScoreboard } from "/scoreboard-size.mjs";

export function connectScoreboardSize(board, preview) {
  const query = new URLSearchParams(location.search);
  let options = {
    width: query.get("width"), height: query.get("height"),
    percent: query.get("scale"),
  };
  let applied;
  function resize() {
    const size = board.querySelector(".rank-row") ? options : { ...options, height: null };
    const { x, y } = fitScoreboard(size,
      document.documentElement.clientWidth, document.documentElement.clientHeight,
      board.offsetWidth, board.offsetHeight);
    const scale = `${x}, ${y}`;
    if (scale !== applied) {
      applied = scale;
      board.style.setProperty("--scoreboard-scale", scale);
    }
  }
  new ResizeObserver(resize).observe(board);
  window.addEventListener("resize", resize);
  if (preview) {
    window.addEventListener("message", event => {
      if (event.source !== window.parent || event.origin !== location.origin
        || event.data?.type !== "ff-scoreboard-size") return;
      options = {
        width: event.data.width,
        height: event.data.height,
      };
      resize();
    });
  }
  resize();
}
