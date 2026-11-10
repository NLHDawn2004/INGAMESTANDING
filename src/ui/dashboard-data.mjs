export function parseRoster(text) {
  const { PlayerNameList: entries } = JSON.parse(text.replace(/^\uFEFF/, ""));
  if (!Array.isArray(entries) || !entries.length) {
    throw new Error("File PlayerName không có danh sách người chơi.");
  }

  const ids = new Set();
  return entries.map((entry, index) => {
    const rawId = entry?.PlayerID;
    const playerId = typeof rawId === "string" || Number.isSafeInteger(rawId)
      ? String(rawId).trim() : "";
    const playerName = String(entry?.PlayerNameOverwrite ?? "").trim();
    const separator = playerName.indexOf(".");
    const teamName = separator > 0 ? playerName.slice(0, separator).trim() : "";
    if (!/^\d+$/.test(playerId) || !teamName || !playerName.slice(separator + 1).trim()) {
      throw new Error(`Người chơi ở dòng ${index + 1} cần ID và tên dạng MÃ_ĐỘI.TÊN.`);
    }
    if (ids.has(playerId)) throw new Error(`Player ID bị trùng: ${playerId}.`);
    ids.add(playerId);
    return { playerId, playerName, teamName };
  });
}
