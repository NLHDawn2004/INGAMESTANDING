export function scoreboardPercent(value) {
  if (value === null || value === undefined || String(value).trim() === "") return 100;
  const percent = Number(value);
  return Number.isFinite(percent) ? Math.min(100, Math.max(25, Math.round(percent))) : 100;
}

export function scoreboardDimension(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 1 ? Math.min(4096, Math.round(number)) : null;
}

export function fitScoreboard(options, viewportWidth, viewportHeight, boardWidth, boardHeight) {
  const width = scoreboardDimension(options.width);
  const height = scoreboardDimension(options.height);
  const horizontalFit = Math.max(1, viewportWidth) / (Math.max(1, boardWidth) + 44);
  const verticalFit = Math.max(1, viewportHeight) / Math.max(1, boardHeight);
  if (width && height) {
    return {
      x: Math.min(width / boardWidth, horizontalFit),
      y: Math.min(height / boardHeight, verticalFit),
    };
  }
  const requested = width ? width / boardWidth : height ? height / boardHeight
    : scoreboardPercent(options.percent) / 100;
  const scale = Math.min(requested, horizontalFit, verticalFit);
  return { x: scale, y: scale };
}
