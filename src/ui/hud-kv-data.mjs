export const HUD_WIDTH = 330;
export const HUD_HEIGHT = 590;

const isCprIcon = file => /^(?:cpr(?:[\s_.-]|$)|champion[\s_.-]*rush(?:[\s_.-]|$))/i.test(file.name.replace(/\.[^.]+$/, ""));

export function pickKvFile(files) {
  const images = [...files].filter(file => /\.(png|jpe?g|webp)$/i.test(file.name) && !isCprIcon(file));
  const preferred = [
    /^ScoreboardBackground\.png$/i,
    /(?:scoreboard|standing|\bkv\b)/i,
  ];
  for (const pattern of preferred) {
    const matches = images.filter(file => pattern.test(file.name));
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) break;
  }
  if (images.length === 1) return images[0];
  throw new Error("Chọn ảnh KV cụ thể hoặc thư mục có một ảnh Scoreboard phù hợp.");
}

function sample(image, x, y) {
  const cx = Math.round(image.width * x);
  const cy = Math.round(image.height * y);
  const samples = [[], [], []];
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const offset = ((cy + dy) * image.width + cx + dx) * 4;
      if (image.data[offset + 3] < 128) continue;
      samples.forEach((values, channel) => values.push(image.data[offset + channel]));
    }
  }
  if (!samples[0].length) throw new Error("Vùng lấy màu trong KV không có nền.");
  return samples.map(values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]);
}

export function getHudRows(image) {
  const bands = [];
  const probe = Math.floor(image.width / 10);
  let start = -1;
  for (let y = 0; y <= image.height; y++) {
    const visible = y < image.height && image.data[(y * image.width + probe) * 4 + 3] > 10;
    if (visible && start < 0) start = y;
    if (!visible && start >= 0) {
      bands.push([start, y]);
      start = -1;
    }
  }
  return bands;
}

export function buildHudBackground(source, reference) {
  if (source.width === HUD_WIDTH && source.height === HUD_HEIGHT) {
    return new Uint8ClampedArray(source.data);
  }
  const ratio = source.width / source.height;
  if (source.width < 400 || ratio < 2 || ratio > 2.6) {
    throw new Error("Chọn KV Scoreboard hai cột hoặc ảnh HUD 330 × 590 px.");
  }
  const rows = getHudRows(reference);
  if (rows.length !== 12) throw new Error("Ảnh HUD gốc không có đủ 12 dải để chuyển KV.");

  // Sample unobstructed panels in the two-column KV, rather than copying its printed labels.
  const leaderTop = sample(source, 0.355, 0.064);
  const leaderBottom = sample(source, 0.355, 0.215);
  const left = sample(source, 0.337, 0.444);
  const right = sample(source, 0.71, 0.34);
  const result = new Uint8ClampedArray(reference.data);
  rows.forEach(([start, end], rank) => {
    for (let y = start; y < end; y++) {
      const progress = (y - start) / Math.max(1, end - start - 1);
      const color = rank === 0
        ? leaderTop.map((value, channel) => value + (leaderBottom[channel] - value) * progress)
        : rank < 7 ? left : right;
      for (let x = 0; x < reference.width; x++) {
        const offset = (y * reference.width + x) * 4;
        const [red, green, blue, alpha] = reference.data.subarray(offset, offset + 4);
        // Keep the transparent gaps and the neutral area used for game text.
        if (!alpha || Math.max(red, green, blue) - Math.min(red, green, blue) < 8) continue;
        result.set(color, offset);
      }
    }
  });
  return result;
}
