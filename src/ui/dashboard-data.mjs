export function parseRoster(text, fileName = "") {
  text = text.replace(/^\uFEFF/, "");
  if (/\.csv$/i.test(fileName) || !text.trimStart().startsWith("{")) return parseRosterCsv(text);
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

function parseRosterCsv(text) {
  text = text.trim();
  const counts = new Map([[",", 0], [";", 0], ["\t", 0]]);
  let quoted = false;
  for (const character of text) {
    if (character === '"') quoted = !quoted;
    if (!quoted && /[\r\n]/.test(character)) break;
    if (!quoted && counts.has(character)) counts.set(character, counts.get(character) + 1);
  }
  const delimiter = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let cells = [];
  let value = "";
  let closed = false;
  quoted = false;
  let line = 1;
  let rowLine = 1;
  for (let index = 0; index <= text.length; index++) {
    const character = text[index];
    if (quoted) {
      if (character === undefined) throw new Error(`CSV chưa đóng dấu ngoặc kép ở dòng ${rowLine}.`);
      if (character === '"') {
        if (text[index + 1] === '"') { value += '"'; index++; }
        else { quoted = false; closed = true; }
      } else {
        value += character;
        if (character === "\n") line++;
      }
      continue;
    }
    if (character === delimiter || character === "\n" || character === "\r" || character === undefined) {
      cells.push(value.trim());
      value = "";
      closed = false;
      if (character === delimiter) continue;
      if (cells.some(cell => cell !== "")) rows.push({ cells, line: rowLine });
      cells = [];
      if (character === "\r" && text[index + 1] === "\n") index++;
      line++;
      rowLine = line;
    } else if (character === '"' && !value.trim() && !closed) {
      quoted = true;
      value = "";
    } else if (character === '"' || (closed && character.trim())) {
      throw new Error(`CSV có dấu ngoặc kép không hợp lệ ở dòng ${line}.`);
    } else if (!closed) {
      value += character;
    }
  }
  if (!rows.length) throw new Error("File CSV không có danh sách người chơi.");
  const normalize = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d").toLowerCase().replace(/[^a-z0-9]/g, "");
  const aliases = [
    ["tenteam", "teamname", "team"],
    ["idnguoichoi", "playerid", "id"],
    ["teningame", "ingame", "playername", "tennguoichoi"],
  ];
  let columns = [0, 1, 2];
  if (!/^\d+$/.test(rows[0].cells[1] ?? "")) {
    const headers = rows.shift().cells.map(normalize);
    const matches = aliases.map(names => headers.flatMap((header, index) => names.includes(header) ? [index] : []));
    columns = matches.map(indices => indices[0]);
    if (matches.some(indices => indices.length !== 1)) {
      throw new Error("CSV cần ba cột Tên Team, ID Người chơi, Tên INGAME.");
    }
  }
  if (!rows.length) throw new Error("File CSV chỉ có tiêu đề, chưa có người chơi.");
  const ids = new Set();
  return rows.map(({ cells, line }) => {
    const [teamName, playerId, playerName] = columns.map(column => cells[column] ?? "");
    if (!teamName || !playerName || !/^\d+$/.test(playerId)) {
      throw new Error(`CSV dòng ${line} cần tên đội, ID chỉ gồm chữ số và tên INGAME. Hãy lưu ID dưới dạng văn bản.`);
    }
    if (ids.has(playerId)) throw new Error(`Player ID bị trùng: ${playerId} (dòng ${line}).`);
    ids.add(playerId);
    return { teamName, playerId, playerName };
  });
}
