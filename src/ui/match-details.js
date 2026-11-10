(() => {
  const API_BASE_URL = location.protocol === "file:" ? "http://localhost:4000" : location.origin;
  const API_ENDPOINTS = {
    MATCH_STATS: `${API_BASE_URL}/api/match-stats`
  };

  const loadingState = document.getElementById("loadingState");
  const errorState = document.getElementById("errorState");
  const contentState = document.getElementById("contentState");
  const headerSection = document.getElementById("headerSection");
  const matchInfoGrid = document.getElementById("matchInfoGrid");
  const rankingTable = document.getElementById("rankingTable");
  const teamsContainer = document.getElementById("teamsContainer");
  const playersContainer = document.getElementById("playersContainer");
  const playerSkillsModalEl = document.getElementById("playerSkillsModal");
  const playerSkillsTitle = document.getElementById("playerSkillsTitle");
  const playerSkillsBody = document.getElementById("playerSkillsBody");
  const playerSkillsModal = playerSkillsModalEl ? new bootstrap.Modal(playerSkillsModalEl) : null;
  const playerWeaponsModalEl = document.getElementById("playerWeaponsModal");
  const playerWeaponsTitle = document.getElementById("playerWeaponsTitle");
  const playerWeaponsBody = document.getElementById("playerWeaponsBody");
  const playerWeaponsModal = playerWeaponsModalEl ? new bootstrap.Modal(playerWeaponsModalEl) : null;

  const CHARACTER_DATA_URL = "assets/data/characters.json";
  const PET_DATA_URL = "assets/data/pets.json";
  const LOADOUT_DATA_URL = "assets/data/loadouts.json";

  let cachedPlayers = [];
  let characterMetaByName = {};
  let characterMetaByNormalizedName = {};
  let loadoutMetaByName = {};
  let loadoutMetaByNormalizedName = {};
  const HIDDEN_PLAYER_KEYS = new Set(["weapon", "__team_rank", "active_skills", "passive_skills", "pet_skills", "loadout_skills", "oil_kill"]);
  const PLAYER_COLUMN_LABELS = {
    player_name: "Tên Player",
    player_id: "Player ID",
    team_name: "Tên Đội",
    match_rank: "Hạng",
    kills: "Kills",
    assists: "Hỗ Trợ",
    damage: "Sát Thương",
    survival_time: "Thời Gian Sống",
    knock_down: "Knock Down",
    headshots: "Headshot",
    headshot_kill_rate: "Tỉ Lệ HS/Kill",
    headshot_accuracy_rate: "Độ Chính Xác HS",
    on_target: "Tỉ Lệ Trúng",
    max_kill_distance: "Khoảng Cách Kill Max",
    grenade_use: "Dùng Lựu Đạn",
    grenade_kills: "Kill Lựu Đạn",
    grenade_damage: "Damage Lựu Đạn",
    icewall_use: "Dùng Ice Wall",
    icewall_destroyed_times: "Phá Ice Wall",
    medkit_use: "Dùng Med Kit",
    revival: "Hồi Sinh",
    revival_members: "Hồi Sinh Đồng Đội",
    rescue_members: "Cứu Đồng Đội",
    moving_distance: "Khoảng Cách Di Chuyển",
    teammate_list: "Danh Sách Đồng Đội",
    vehicle_kill: "Kill Bằng Xe",
    oil_kill: "Kill Bằng Dầu",
    pos_change: "Thay Đổi Vị Trí",
    active_skills: "Kỹ Năng Chủ Động",
    passive_skills: "Kỹ Năng Bị Động",
    pet_skills: "Kỹ Năng Pet",
    loadout_skills: "Kỹ Năng Loadout"
  };

  const PLAYER_COLUMN_ORDER = [
    "player_name", "player_id", "team_name", "match_rank", "kills", "assists", "damage",
    "survival_time", "knock_down", "headshots", "headshot_kill_rate", "headshot_accuracy_rate",
    "on_target", "max_kill_distance", "grenade_use", "grenade_kills", "grenade_damage",
    "icewall_use", "icewall_destroyed_times", "medkit_use", "revival", "revival_members",
    "rescue_members", "moving_distance", "teammate_list", "vehicle_kill", "oil_kill",
    "pos_change", "active_skills", "passive_skills", "pet_skills", "loadout_skills"
  ];

  // Get matchId from URL query parameter
  function getMatchIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("matchId");
  }

  function getLoadout(loadoutName) {
    const key = normalizeText(loadoutName);
    return loadoutMetaByNormalizedName[key] || null;
  }

  function showError(message) {
    loadingState.classList.add("d-none");
    contentState.classList.add("d-none");
    errorState.classList.remove("d-none");
    errorState.textContent = `❌ ${message}`;
  }

  function showContent() {
    loadingState.classList.add("d-none");
    errorState.classList.add("d-none");
    contentState.classList.remove("d-none");
  }

  function normalizePayload(raw) {
    const level1 = raw?.data;
    const level2 = level1?.data;

    if (level2 && (level2.match_info || level2.team_stats || level2.total_stats)) {
      return level2;
    }
    if (level1 && (level1.match_info || level1.team_stats || level1.total_stats)) {
      return level1;
    }
    return raw || {};
  }

  function getFlattenedTeamStats(payload) {
    if (Array.isArray(payload.total_stats) && payload.total_stats.length > 0) {
      return payload.total_stats;
    }

    if (Array.isArray(payload.team_stats) && payload.team_stats.length > 0) {
      const firstMatch = payload.team_stats[0];
      if (Array.isArray(firstMatch?.team_stats)) {
        return firstMatch.team_stats;
      }
    }

    return [];
  }

  function getFlattenedPlayers(payload) {
    const teams = getFlattenedTeamStats(payload);
    const players = [];

    teams.forEach((team) => {
      const teamName = team.team_name || "N/A";
      const playerList = Array.isArray(team.player_data) ? team.player_data : [];

      playerList.forEach((player) => {
        players.push({
          ...player,
          weapon: normalizePlayerWeapons(player),
          team_name: player.team_name || teamName,
          __team_rank: team.match_rank || 0
        });
      });
    });

    return players;
  }

  function normalizePlayerWeapons(player) {
    if (Array.isArray(player.weapon)) {
      return player.weapon;
    }

    const merged = [];

    if (Array.isArray(player.primary_weapons)) {
      merged.push(...player.primary_weapons);
    }

    if (Array.isArray(player.secondary_weapons)) {
      merged.push(...player.secondary_weapons);
    }

    return merged;
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  }

  function indexCharacterMeta(metaByName) {
    characterMetaByName = metaByName && typeof metaByName === "object" ? metaByName : {};

    characterMetaByNormalizedName = Object.entries(characterMetaByName).reduce((acc, [name, meta]) => {
      acc[normalizeText(name)] = meta;
      return acc;
    }, {});
  }

  function indexLoadoutMeta(metaByName) {
    loadoutMetaByName = metaByName && typeof metaByName === "object" ? metaByName : {};

    loadoutMetaByNormalizedName = Object.entries(loadoutMetaByName).reduce((acc, [name, meta]) => {
      acc[normalizeText(name)] = meta;
      return acc;
    }, {});
  }

  async function loadCharacterMeta() {
    try {
      const ts = Date.now();
      const [characterResponse, petResponse, loadoutResponse] = await Promise.all([
        fetch(`${CHARACTER_DATA_URL}?t=${ts}`),
        fetch(`${PET_DATA_URL}?t=${ts}`),
        fetch(`${LOADOUT_DATA_URL}?t=${ts}`)
      ]);

      if (!characterResponse.ok) {
        throw new Error(`Character metadata HTTP ${characterResponse.status}`);
      }

      if (!petResponse.ok) {
        throw new Error(`Pet metadata HTTP ${petResponse.status}`);
      }

      if (!loadoutResponse.ok) {
        throw new Error(`Loadout metadata HTTP ${loadoutResponse.status}`);
      }

      const [characterData, petData, loadoutData] = await Promise.all([
        characterResponse.json(),
        petResponse.json(),
        loadoutResponse.json()
      ]);

      indexCharacterMeta({
        ...(characterData || {}),
        ...(petData || {})
      });

      indexLoadoutMeta(loadoutData || {});
    } catch (error) {
      console.warn("Không thể tải metadata character/pet:", error);
      indexCharacterMeta({});
      indexLoadoutMeta({});
    }
  }

  function getCharacterMetaByName(name) {
    const key = normalizeText(name);
    if (characterMetaByNormalizedName[key]) {
      return characterMetaByNormalizedName[key];
    }

    if (key.startsWith("awaken")) {
      const baseName = key.replace(/^awaken/, "");
      if (characterMetaByNormalizedName[baseName]) {
        return characterMetaByNormalizedName[baseName];
      }
    }

    return null;
  }

  function getSkillImageByName(name) {
    const meta = getCharacterMetaByName(name);
    return meta?.characterImage || meta?.skillImage || "";
  }

  function getLoadoutImageByName(name) {
    const meta = getLoadout(name);
    if (meta?.characterImage) return meta.characterImage;
    if (meta?.skillImage) return meta.skillImage;
    return `assets/loadout/${encodeURIComponent(name)}.png`;
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatStatValue(value, key) {
    if (Array.isArray(value)) {
      if (value.length === 0) return "[]";
      if (key === "teammate_list") return value.join(", ");
      if (["active_skills", "passive_skills", "pet_skills", "loadout_skills"].includes(key)) {
        return `${value.length} kỹ năng`;
      }
      return JSON.stringify(value);
    }

    if (value && typeof value === "object") {
      return JSON.stringify(value);
    }

    if (typeof value === "number" && !["player_id"].includes(key)) return formatNumber(value);
    if (typeof value === "boolean") return value ? "true" : "false";
    if (value === null || value === undefined || value === "") return "N/A";
    return String(value);
  }

  function prettifyColumnKey(key) {
    if (PLAYER_COLUMN_LABELS[key]) {
      return PLAYER_COLUMN_LABELS[key];
    }

    return key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function getPlayerColumns(players) {
    const set = new Set();

    players.forEach((player) => {
      Object.keys(player).forEach((key) => {
        if (!HIDDEN_PLAYER_KEYS.has(key)) {
          set.add(key);
        }
      });
    });

    const all = Array.from(set);
    const ordered = PLAYER_COLUMN_ORDER.filter((key) => set.has(key));
    const rest = all
      .filter((key) => !PLAYER_COLUMN_ORDER.includes(key))
      .sort((a, b) => a.localeCompare(b));

    return [...ordered, ...rest];
  }

  function renderPlayerStats(data) {
    const response = normalizePayload(data);
    cachedPlayers = getFlattenedPlayers(response).sort((a, b) => {
      const rankDiff = (a.match_rank || 999) - (b.match_rank || 999);
      if (rankDiff !== 0) return rankDiff;
      return (b.kills || 0) - (a.kills || 0);
    });

    if (!playersContainer) return;

    if (cachedPlayers.length === 0) {
      playersContainer.innerHTML = `
        <div class="team-section">
          <p class="text-muted text-center mb-0">Không có dữ liệu player</p>
        </div>
      `;
      return;
    }

    const columns = getPlayerColumns(cachedPlayers);

    const headerCells = columns.map((key) => {
      let stickyClass = "";
      if (key === "player_name") stickyClass = "sticky-col-2";
      if (key === "player_id") stickyClass = "sticky-col-3";
      if (key === "team_name") stickyClass = "sticky-col-4";

      return `<th class="${stickyClass}">${escapeHtml(prettifyColumnKey(key))}</th>`;
    }).join("");

    const bodyRows = cachedPlayers.map((player, index) => {
      const cells = columns.map((key) => {
        const value = formatStatValue(player[key], key);
        let stickyClass = "";
        if (key === "player_name") stickyClass = "sticky-col-2";
        if (key === "player_id") stickyClass = "sticky-col-3";
        if (key === "team_name") stickyClass = "sticky-col-4";

        return `<td class="${stickyClass}" title="${escapeHtml(value)}">${escapeHtml(value)}</td>`;
      }).join("");

      return `
        <tr>
          <td class="sticky-col-1">${index + 1}</td>
          ${cells}
          <td class="sticky-col-action">
            <button class="btn btn-sm btn-outline-primary btn-view-skills" data-player-index="${index}">Kỹ năng</button>
            <button class="btn btn-sm btn-outline-primary btn-view-weapons" data-player-index="${index}">Vũ khí</button>
          </td>
        </tr>
      `;
    }).join("");

    playersContainer.innerHTML = `
      <div class="players-table-panel">
        <div class="players-table-scroll">
          <table class="table table-bordered table-hover players-table">
            <thead>
              <tr>
                <th class="sticky-col-1">#</th>
                ${headerCells}
                <th class="sticky-col-action">Hành động</th>
              </tr>
            </thead>
            <tbody>
              ${bodyRows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderWeaponGroup(weapons, title) {
    if (!Array.isArray(weapons) || weapons.length === 0) {
      return `
        <div class="skill-group-title">${escapeHtml(title)}</div>
        <div class="skill-empty">Không có dữ liệu</div>
      `;
    }

    const cards = weapons.map((weapon) => {
      const weaponName = weapon.weapon || weapon.name || "Không rõ";
      const kills = Number(weapon.kills || 0);
      const headshots = Number(weapon.headshots || 0);
      const damage = Number(weapon.damage || 0);
      const onTarget = weapon.on_target || "0.00%";
      const hsAccuracy = weapon.headshot_accuracy_rate || "0.00%";
      const weaponImage = `assets/weapons/${encodeURIComponent(weaponName)}.png`;

      return `
        <div class="skill-card weapon-card">
          <img
            src="${weaponImage}"
            alt="${escapeHtml(weaponName)}"
            onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
          >
          <div class="skill-avatar-placeholder" style="display:none;">N/A</div>
          <div class="meta">
            <strong>${escapeHtml(weaponName)}</strong>
            <div class="weapon-stats-row">
              <span class="weapon-stat-badge">Kill: ${formatNumber(kills)}</span>
              <span class="weapon-stat-badge">HS: ${formatNumber(headshots)}</span>
              <span class="weapon-stat-badge">Damage: ${formatNumber(damage)}</span>
            </div>
            <div class="weapon-stats-row">
              <span class="weapon-stat-badge">Trúng đích: ${escapeHtml(onTarget)}</span>
              <span class="weapon-stat-badge">HS Accuracy: ${escapeHtml(hsAccuracy)}</span>
            </div>
          </div>
        </div>
      `;
    }).join("");

    return `
      <div class="skill-group-title">${escapeHtml(title)}</div>
      <div class="weapon-list vstack gap-3">${cards}</div>
    `;
  }

  function showPlayerWeapons(index) {
    const player = cachedPlayers[index];
    if (!player || !playerWeaponsModal || !playerWeaponsBody || !playerWeaponsTitle) return;

    const weapons = Array.isArray(player.weapon)
      ? [...player.weapon].sort((a, b) => Number(b.kills || 0) - Number(a.kills || 0))
      : [];

    playerWeaponsTitle.textContent = `Vũ khí: ${player.player_name || "N/A"}`;
    playerWeaponsBody.innerHTML = `
      ${renderWeaponGroup(weapons, "Danh sách vũ khí")}
    `;
    playerWeaponsModal.show();
  }

  function getSkillIdentity(skill) {
    const skillId = skill?.skill_id;
    if (skillId !== null && skillId !== undefined && skillId !== "") {
      return `id:${String(skillId)}`;
    }

    const nameKey = normalizeText(skill?.name || "");
    const skillKey = normalizeText(skill?.skill || "");

    if (!nameKey && !skillKey) return "";
    return `text:${nameKey}:${skillKey}`;
  }

  function getMatchSkillStatsByField(fieldName) {
    const pickBySkill = new Map();

    cachedPlayers.forEach((player) => {
      const list = Array.isArray(player?.[fieldName]) ? player[fieldName] : [];

      list.forEach((skill) => {
        const key = getSkillIdentity(skill);
        if (!key) return;

        pickBySkill.set(key, (pickBySkill.get(key) || 0) + 1);
      });
    });

    return {
      totalPlayers: cachedPlayers.length,
      pickBySkill
    };
  }

  function withMatchSkillTotals(skills, fieldName) {
    const list = Array.isArray(skills) ? skills : [];
    const stats = getMatchSkillStatsByField(fieldName);

    return list.map((skill) => {
      const key = getSkillIdentity(skill);
      const totalPick = key ? (stats.pickBySkill.get(key) || 0) : 0;
      const totalRate = stats.totalPlayers > 0 ? (totalPick * 100) / stats.totalPlayers : 0;

      return {
        ...skill,
        total_match_pick_times: totalPick,
        total_match_pick_rate: totalRate
      };
    });
  }

  function renderSkillGroup(skills, title, type = "skill") {
    if (!Array.isArray(skills) || skills.length === 0) {
      return `
        <div class="skill-group-title">${escapeHtml(title)}</div>
        <div class="skill-empty">Không có dữ liệu</div>
      `;
    }

    const cards = skills.map((skill) => {
      const charName = skill.name || skill.skill || "Không rõ";
      const pickTimes = Number(skill.total_match_pick_times ?? skill.pick_times ?? 0);
      const pickRate = Number(skill.total_match_pick_rate ?? skill.pick_rate ?? 0);
      const meta = type === "loadout"
        ? getLoadout(charName)
        : getCharacterMetaByName(charName);
      const skillTitle = meta?.skillTitle || charName;
      const skillName = meta?.skillName || "Chưa map skillName";
      const image = type === "loadout"
        ? getLoadoutImageByName(charName)
        : getSkillImageByName(charName);

      return `
        <div class="skill-card">
          ${image ? `<img src="${image}" alt="${escapeHtml(skillTitle)}">` : `<div class="skill-avatar-placeholder">N/A</div>`}
          <div class="meta">
            <strong>${escapeHtml(skillTitle)}</strong>
            <small>${escapeHtml(skillName)}</small>
            <small>Pick : ${formatNumber(pickTimes)} | Rate: ${pickRate.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}%</small>
          </div>
        </div>
      `;
    }).join("");

    return `
      <div class="skill-group-title">${escapeHtml(title)}</div>
      <div class="skills-grid">${cards}</div>
    `;
  }

  function showPlayerSkills(index) {
    const player = cachedPlayers[index];
    if (!player || !playerSkillsModal || !playerSkillsBody || !playerSkillsTitle) return;

    const activeSkills = withMatchSkillTotals(player.active_skills, "active_skills");
    const passiveSkills = withMatchSkillTotals(player.passive_skills, "passive_skills");
    const petSkills = withMatchSkillTotals(player.pet_skills, "pet_skills");
    const loadoutSkills = withMatchSkillTotals(player.loadout_skills, "loadout_skills");

    playerSkillsTitle.textContent = `Kỹ năng: ${player.player_name || "N/A"}`;
    playerSkillsBody.innerHTML = `
      ${renderSkillGroup(activeSkills, "Kỹ năng chủ động")}
      ${renderSkillGroup(passiveSkills, "Kỹ năng bị động")}
      ${renderSkillGroup(petSkills, "Kỹ năng pet", "pet")}
      ${renderSkillGroup(loadoutSkills, "Kỹ năng loadout", "loadout")}
    `;
    playerSkillsModal.show();
  }

  async function fetchMatchStats(matchId) {
    const url = `${API_ENDPOINTS.MATCH_STATS}?matchId=${encodeURIComponent(matchId)}&t=${Date.now()}`;
    const response = await fetch(url);

    // Handle 304 Not Modified 
    if (response.status === 304) {
      console.warn("⚠️ Nhận 304 - server không cập nhật dữ liệu");
      throw new Error("Cache hiệu lực - vui lòng Ctrl+F5 để refresh");
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  }

  function formatNumber(num) {
    return (num || 0).toLocaleString("vi-VN");
  }

  function getRankBadgeClass(rank) {
    rank = parseInt(rank);
    if (rank === 1) return "rank-1";
    if (rank === 2) return "rank-2";
    if (rank === 3) return "rank-3";
    return "rank-other";
  }

  function renderMatchInfo(data) {
    const response = normalizePayload(data);
    const matchInfo = Array.isArray(response.match_info) ? (response.match_info[0] || {}) : {};
    const grenadeStats = response.grenade_stats || matchInfo.grenade_stats || {};

    document.getElementById("matchIdDisplay").textContent = `Match ID: ${matchInfo.match_id || "N/A"}`;

    const infoHTML = `
      <div class="info-card">
        <label>Tên Trận</label>
        <div class="value">${matchInfo.match_name || "N/A"}</div>
      </div>
      <div class="info-card">
        <label>Chế Độ</label>
        <div class="value">${getGameMode(matchInfo.mode || 1)}</div>
      </div>
      <div class="info-card">
        <label>Tổng Số Đội</label>
        <div class="value">${formatNumber(matchInfo.number_of_team)}</div>
      </div>
      <div class="info-card">
        <label>Tổng Số Người chơi</label>
        <div class="value">${formatNumber(matchInfo.number_of_player)}</div>
      </div>
      <div class="info-card">
        <label>Sử Dụng Lựu Đạn</label>
        <div class="value">${formatNumber(grenadeStats.grenade_use || 0)}</div>
      </div>
      <div class="info-card">
        <label>Tổng Sát Thương</label>
        <div class="value">${formatNumber(grenadeStats.grenade_damage || 0)}</div>
      </div>
    `;
    matchInfoGrid.innerHTML = infoHTML;
  }

  function getGameMode(mode) {
    const modes = {
      1: "BR 100",
      2: "Squad",
      3: "Duo",
      4: "Solo"
    };
    return modes[mode] || `Mode ${mode}`;
  }

  function renderRanking(data) {
    const response = normalizePayload(data);
    const totalStats = getFlattenedTeamStats(response);

    const rows = totalStats.slice(0, 10).map(team => `
      <tr>
        <td>
          <span class="rank-badge ${getRankBadgeClass(team.match_rank)}">
            ${team.match_rank}
          </span>
        </td>
        <td><strong>${team.team_name || "N/A"}</strong></td>
        <td>${formatNumber(team.survival_score || 0)}</td>
        <td>${formatNumber(team.killing_score || 0)}</td>
        <td><strong class="text-primary">${formatNumber(team.total_score || 0)}</strong></td>
        <td>${formatNumber(team.kills || 0)}</td>
        <td>${Number(team.booyah) ? "✅" : "❌"}</td>
        <td>${formatNumber(team.damage || 0)}</td>
      </tr>
    `).join("");

    rankingTable.innerHTML = rows || `
      <tr>
        <td colspan="8" class="text-center text-muted">Không có dữ liệu</td>
      </tr>
    `;
  }

  function renderTeamDetails(data) {
    const response = normalizePayload(data);
    const teamStats = getFlattenedTeamStats(response);

    let html = "";
    teamStats.forEach((teamData, index) => {
      if (index >= 10) return; // Only show top 10

      const teamName = teamData.team_name || `Team ${index + 1}`;
      const players = teamData.player_data || [];
      const stats = teamData;

      html += `
        <div class="team-section">
          <div class="team-header">
            <div class="team-name">
              <span class="rank-badge ${getRankBadgeClass(stats?.match_rank || index + 1)}" style="margin-right: 10px;">
                ${stats?.match_rank || index + 1}
              </span>
              ${teamName}
            </div>
            <div>
              <span class="badge bg-primary">${players.length} Người chơi</span>
            </div>
          </div>

          <div class="team-stats-grid">
            <div class="stat-item">
              <div class="label">Tổng Điểm</div>
              <div class="value">${formatNumber(stats?.total_score || 0)}</div>
            </div>
            <div class="stat-item">
              <div class="label">Kill</div>
              <div class="value">${formatNumber(stats?.kills || 0)}</div>
            </div>
            <div class="stat-item">
              <div class="label">Sát Thương</div>
              <div class="value">${formatNumber(stats?.damage || 0)}</div>
            </div>
            <div class="stat-item">
              <div class="label">Booyah</div>
              <div class="value">${Number(stats?.booyah) ? "✅" : "❌"}</div>
            </div>
            <div class="stat-item">
              <div class="label">Ice Wall</div>
              <div class="value">${formatNumber(stats?.icewall_use || 0)}</div>
            </div>
            <div class="stat-item">
              <div class="label">Thời Gian Sống</div>
              <div class="value">${formatNumber(stats?.survival_time || 0)}s</div>
            </div>
            <div class="stat-item">
              <div class="label">Cứu Hộ</div>
              <div class="value">${formatNumber(stats?.revival || 0)}</div>
            </div>
            <div class="stat-item">
              <div class="label">Cứu Đồng Đội</div>
              <div class="value">${formatNumber(stats?.rescue_members || 0)}</div>
            </div>
          </div>

          <div class="player-list">
            <strong style="display: block; margin-bottom: 10px;">🎮 Danh Sách Người chơi:</strong>
            ${players.map((player, idx) => `
              <div class="player-item">
                <div class="player-name">${idx + 1}. ${player.player_name || "N/A"}</div>
                <div class="player-id">ID: ${player.player_id || "N/A"}</div>
                <small class="text-muted">
                  Kill: ${formatNumber(player.kills || 0)} | 
                  Sát Thương: ${formatNumber(player.damage || 0)} | 
                  Thời Gian: ${formatNumber(player.survival_time || 0)}s
                </small>
              </div>
            `).join("") || `<div class="text-muted">Không có dữ liệu Người chơi</div>`}
          </div>
        </div>
      `;
    });

    teamsContainer.innerHTML = html || `
      <div class="team-section">
        <p class="text-muted text-center">Không có dữ liệu chi tiết đội</p>
      </div>
    `;
  }

  function renderGrenadeStats(data) {
    const response = normalizePayload(data);
    const matchInfo = Array.isArray(response.match_info) ? (response.match_info[0] || {}) : {};
    const grenadeStats = response.grenade_stats || matchInfo.grenade_stats || {};

    document.getElementById("grenadeUse").textContent = formatNumber(grenadeStats.grenade_use);
    document.getElementById("grenadeKills").textContent = formatNumber(grenadeStats.grenade_kills);
    document.getElementById("grenadeDamage").textContent = formatNumber(grenadeStats.grenade_damage);
    document.getElementById("icewallUse").textContent = formatNumber(grenadeStats.icewall_use);
    document.getElementById("icewallDestroyed").textContent = formatNumber(grenadeStats.icewall_destroyed_times);
    document.getElementById("medkitUse").textContent = formatNumber(grenadeStats.medkit_use);
  }

  if (playersContainer) {
    playersContainer.addEventListener("click", (event) => {
      const button = event.target.closest(".btn-view-skills");
      if (!button) return;

      const index = Number(button.getAttribute("data-player-index"));
      if (Number.isNaN(index)) return;

      showPlayerSkills(index);
    });

    playersContainer.addEventListener("click", (event) => {
      const button = event.target.closest(".btn-view-weapons");
      if (!button) return;
      const index = Number(button.getAttribute("data-player-index"));
      if (Number.isNaN(index)) return;
      showPlayerWeapons(index);
    });
  }

  async function init() {
    const matchId = getMatchIdFromUrl();
    if (!matchId) {
      showError("Không tìm thấy Match ID. Vui lòng quay lại và chọn trận đấu.");
      return;
    }

    try {
      const [data] = await Promise.all([
        fetchMatchStats(matchId),
        loadCharacterMeta()
      ]);

      renderMatchInfo(data);
      renderRanking(data);
      renderTeamDetails(data);
      renderPlayerStats(data);
      renderGrenadeStats(data);

      showContent();
    } catch (err) {
      console.error("Error fetching match stats:", err);
      showError(`Lỗi: ${err instanceof Error ? err.message : "Không thể tải dữ liệu"}`);
    }
  }

  // Initialize on page load
  init();
})();
