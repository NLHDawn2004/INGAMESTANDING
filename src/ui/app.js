(() => {
  // ============ API Config ============
  const API_BASE_URL = location.protocol === "file:" ? "http://localhost:4000" : location.origin;
  const API_ENDPOINTS = {
    MATCH_STATS: `${API_BASE_URL}/api/match-stats`,
    MATCH_STATS_BATCH: `${API_BASE_URL}/api/match-stats/batch`,
    HEALTH: `${API_BASE_URL}/api/health`
  };

  const STORAGE_KEY_GROUPS = "ff-debugger-group-list-v1";
  const STORAGE_KEY_MATCHES_LEGACY = "ff-debugger-match-list-v1";
  const STORAGE_KEY_PLAYERS = "ff-debugger-player-list-v1";

  // ============ DOM Elements - Matches ============
  const matchForm = document.getElementById("match-form");
  const groupInput = document.getElementById("group-id");
  const matchInput = document.getElementById("match-id");
  const noteInput = document.getElementById("match-note");
  const searchInput = document.getElementById("search");
  const sortSelect = document.getElementById("sort");
  const groupSelector = document.getElementById("group-selector");
  const groupEditor = document.getElementById("group-editor");
  const groupEditorEmpty = document.getElementById("group-editor-empty");
  const groupEditIdInput = document.getElementById("group-edit-id");
  const groupEditNoteInput = document.getElementById("group-edit-note");
  const btnGroupSave = document.getElementById("btn-group-save");
  const btnGroupDelete = document.getElementById("btn-group-delete");
  const btnOpenTeamPicker = document.getElementById("btn-open-team-picker");
  const groupMatchIdAddInput = document.getElementById("group-match-id-add");
  const groupMatchDescriptionAddInput = document.getElementById("group-match-description-add");
  const btnGroupAddMatch = document.getElementById("btn-group-add-match");
  const btnGroupCancelEditMatch = document.getElementById("btn-group-cancel-edit-match");
  const batchMatchModalEl = document.getElementById("batchMatchModal");
  const batchMatchTextarea = document.getElementById("batch-match-textarea");
  const btnConfirmBatchMatch = document.getElementById("btn-confirm-batch-match");
  const groupMatchTableBody = document.getElementById("group-match-table");
  const groupMatchEmpty = document.getElementById("group-match-empty");
  const groupMatchCount = document.getElementById("group-match-count");
  const groupTeamSelect = document.getElementById("group-team-select");
  const groupTeamCustomInput = document.getElementById("group-team-custom");
  const btnGroupAddTeam = document.getElementById("btn-group-add-team");
  const groupTeamList = document.getElementById("group-team-list");
  const groupTeamEmpty = document.getElementById("group-team-empty");
  const groupTeamCount = document.getElementById("group-team-count");
  const btnGroupOpenMatch = document.getElementById("btn-group-open-match");
  const matchTableBody = document.getElementById("match-table");
  const emptyState = document.getElementById("empty");
  const csvInput = document.getElementById("csv-file");
  const btnImport = document.getElementById("btn-import");
  const btnExport = document.getElementById("btn-export");
  const btnClear = document.getElementById("btn-clear");

  // ============ DOM Elements - Players ============
  const playerForm = document.getElementById("player-form");
  const playerIdInput = document.getElementById("player-id");
  const playerNameInput = document.getElementById("player-name");
  const teamNameInput = document.getElementById("team-name");
  const playerImageInput = document.getElementById("player-image");
  const teamImageInput = document.getElementById("team-image");
  const searchPlayerInput = document.getElementById("search-player");
  const sortPlayerSelect = document.getElementById("sort-player");
  const playerTableBody = document.getElementById("player-table");
  const emptyPlayerState = document.getElementById("empty-player");
  const playerCsvInput = document.getElementById("player-csv-file");
  const btnImportPlayer = document.getElementById("btn-import-player");
  const btnExportPlayer = document.getElementById("btn-export-player");
  const btnClearPlayer = document.getElementById("btn-clear-player");
  const editPlayerModalEl = document.getElementById("editPlayerModal");
  const editPlayerIdInput = document.getElementById("edit-player-id");
  const editPlayerNameInput = document.getElementById("edit-player-name");
  const editTeamNameInput = document.getElementById("edit-team-name");
  const editPlayerImageInput = document.getElementById("edit-player-image");
  const editTeamImageInput = document.getElementById("edit-team-image");
  const editPlayerImagePreview = document.getElementById("edit-player-image-preview");
  const editTeamImagePreview = document.getElementById("edit-team-image-preview");
  const btnSavePlayerEdit = document.getElementById("btn-save-player-edit");
  const btnRunTools = document.getElementById("btn-run-tools");
  const runToolsModalEl = document.getElementById("runToolsModal");
  const teamPickerModalEl = document.getElementById("teamPickerModal");
  const runToolsFilePathInput = document.getElementById("run-tools-file-path");
  const runToolsGroupIdSelect = document.getElementById("run-tools-group-id");
  const runToolsConfirmCheck = document.getElementById("run-tools-confirm-check");
  const btnConfirmRunTools = document.getElementById("btn-confirm-run-tools");

  // ============ DOM Elements - Modal ============
  const matchDetailsModal = document.getElementById("matchDetailsModal");
  const matchDetailsBody = document.getElementById("matchDetailsBody");
  const modalInstance = matchDetailsModal ? new bootstrap.Modal(matchDetailsModal) : null;
  const editPlayerModal = editPlayerModalEl ? new bootstrap.Modal(editPlayerModalEl) : null;
  const runToolsModal = runToolsModalEl ? new bootstrap.Modal(runToolsModalEl) : null;
  const teamPickerModal = teamPickerModalEl ? new bootstrap.Modal(teamPickerModalEl) : null;
  const batchMatchModal = batchMatchModalEl ? new bootstrap.Modal(batchMatchModalEl) : null;

  // ============ Toast ============
  const toastEl = document.getElementById("app-toast");
  const toastBody = document.getElementById("toast-content");
  const toast = window.bootstrap ? new bootstrap.Toast(toastEl) : null;

  function showToast(message) {
    if (!toast || !toastBody) return;
    toastBody.textContent = message;
    toast.show();
  }

  // ============ State ============
  let groups = loadGroups();
  let players = loadPlayers();
  let selectedGroupId = groups[0]?.groupId || "";
  let editingGroupMatchId = null;
  let editingPlayerOriginalId = null;

  function normalizeMatchId(value) {
    return String(value || "").trim();
  }

  function parseMatchIds(value) {
    return String(value || "")
      .split(/[\n,;]+/)
      .map((item) => normalizeMatchId(item))
      .filter(Boolean)
      .filter((id, index, arr) => arr.indexOf(id) === index);
  }

  function loadGroups() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_GROUPS);
      if (raw) {
        const data = JSON.parse(raw);
        if (!Array.isArray(data)) return [];

        return data
          .filter((item) => item && typeof item === "object")
          .map((item, index) => {
            const groupId = String(item.groupId || item.name || `group-${index + 1}`).trim();
            const note = String(item.note || "").trim();
            const createdAt = String(item.createdAt || nowText()).trim();
            const matches = Array.isArray(item.matches)
              ? item.matches
                .filter((entry) => entry && typeof entry === "object")
                .map((entry) => ({
                  matchId: normalizeMatchId(entry.matchId),
                  description: String(entry.description || "").trim(),
                  addTime: String(entry.addTime || nowText()).trim(),
                }))
                .filter((entry) => entry.matchId)
              : (Array.isArray(item.matchIds)
                ? item.matchIds.map((id) => ({
                  matchId: normalizeMatchId(id),
                  description: "",
                  addTime: createdAt,
                }))
                : parseMatchIds(item.matchId || "").map((id) => ({
                  matchId: id,
                  description: "",
                  addTime: createdAt,
                }))
              );

            return {
              groupId,
              note,
              createdAt,
              matches,
              teamNames: Array.isArray(item.teamNames)
                ? item.teamNames.map((name) => String(name || "").trim()).filter(Boolean)
                : [],
            };
          })
          .filter((item) => item.groupId);
      }

      const legacyRaw = localStorage.getItem(STORAGE_KEY_MATCHES_LEGACY);
      if (!legacyRaw) return [];

      const legacyData = JSON.parse(legacyRaw);
      if (!Array.isArray(legacyData)) return [];

      const migrated = legacyData
        .filter((item) => item && typeof item === "object")
        .map((item, index) => ({
          groupId: String(item.matchId || `group-${index + 1}`).trim(),
          matches: parseMatchIds(item.matchId || "").map((id) => ({
            matchId: id,
            description: "",
            addTime: String(item.createdAt || nowText()).trim(),
          })),
          note: String(item.note || "").trim(),
          createdAt: String(item.createdAt || nowText()).trim(),
          teamNames: [],
        }))
        .filter((item) => item.groupId);

      if (migrated.length > 0) {
        localStorage.setItem(STORAGE_KEY_GROUPS, JSON.stringify(migrated));
      }

      return migrated;
    } catch (_) {
      return [];
    }
  }

  function saveGroups() {
    localStorage.setItem(STORAGE_KEY_GROUPS, JSON.stringify(groups));
  }

  function loadPlayers() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PLAYERS);
      if (!raw) return [];
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch (_) {
      return [];
    }
  }

  function savePlayers() {
    localStorage.setItem(STORAGE_KEY_PLAYERS, JSON.stringify(players));
  }

  function nowText() {
    const d = new Date();
    return d.toLocaleString("vi-VN", { hour12: false });
  }

  // Accept Windows absolute/UNC paths and common relative paths, reject invalid filename chars.
  const FILE_PATH_REGEX = /^(?!.*[<>|?*\r\n])(?:[A-Za-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+[\\/]?|\.{1,2}[\\/]|[^<>:"|?*\r\n]+[\\/])?[^<>:"|?*\r\n]+(?:[\\/][^<>:"|?*\r\n]+)*$/;

  function normalizeFilePath(value) {
    return String(value || "")
      .trim()
      .replace(/^"+|"+$/g, "")
      .trim();
  }

  function isValidFilePath(value) {
    return FILE_PATH_REGEX.test(value);
  }

  // ============ File to Base64 ============
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ============ Groups Functions ============
  function normalizeGroupId(value) {
    return String(value || "").trim();
  }

  function addGroup(groupId, matchIdsText, note, createdAt) {
    const id = normalizeGroupId(groupId);
    if (!id) {
      showToast("Tên Group không được để trống");
      return false;
    }

    if (groups.some((r) => r.groupId === id)) {
      showToast("Group đã tồn tại");
      return false;
    }

    const matchIds = parseMatchIds(matchIdsText);
    const initialMatches = matchIds.map((matchId) => ({
      matchId,
      description: "",
      addTime: createdAt || nowText(),
    }));

    groups.unshift({
      groupId: id,
      matches: initialMatches,
      note: String(note || "").trim(),
      createdAt: createdAt || nowText(),
      teamNames: [],
    });
    saveGroups();
    selectedGroupId = id;
    renderMatches();
    return true;
  }

  function removeGroup(groupId) {
    const removingSelected = selectedGroupId === groupId;
    groups = groups.filter((r) => r.groupId !== groupId);
    if (removingSelected) {
      selectedGroupId = groups[0]?.groupId || "";
    }
    saveGroups();
    renderMatches();
  }

  function updateGroup(groupId, updates = {}) {
    const group = groups.find((r) => r.groupId === groupId);
    if (!group) return false;

    const nextGroupId = normalizeGroupId(
      typeof updates.groupId === "string" ? updates.groupId : group.groupId
    );
    const nextNote = String(
      typeof updates.note === "string" ? updates.note : group.note || ""
    ).trim();
    const nextMatches = Array.isArray(updates.matches)
      ? updates.matches
        .map((entry) => ({
          matchId: normalizeMatchId(entry.matchId),
          description: String(entry.description || "").trim(),
          addTime: String(entry.addTime || nowText()).trim(),
        }))
        .filter((entry) => entry.matchId)
      : group.matches;
    const nextTeamNames = Array.isArray(updates.teamNames)
      ? updates.teamNames.map((name) => String(name || "").trim()).filter(Boolean)
      : (Array.isArray(group.teamNames)
        ? group.teamNames.map((name) => String(name || "").trim()).filter(Boolean)
        : []);

    if (!nextGroupId) {
      showToast("Tên Group không được để trống");
      return false;
    }

    const duplicate = groups.some(
      (entry) => entry.groupId === nextGroupId && entry.groupId !== groupId
    );
    if (duplicate) {
      showToast("Tên Group đã tồn tại");
      return false;
    }

    group.groupId = nextGroupId;
    group.note = nextNote;
    group.matches = nextMatches;
    group.teamNames = nextTeamNames;

    if (selectedGroupId === groupId) {
      selectedGroupId = nextGroupId;
    }

    saveGroups();
    renderMatches();
    return true;
  }

  function getSelectedGroup() {
    if (!selectedGroupId) return null;
    return groups.find((group) => group.groupId === selectedGroupId) || null;
  }

  function setSelectedGroup(groupId) {
    const id = normalizeGroupId(groupId);
    editingGroupMatchId = null;
    if (groupMatchIdAddInput) groupMatchIdAddInput.value = "";
    if (groupMatchDescriptionAddInput) groupMatchDescriptionAddInput.value = "";
    if (btnGroupAddMatch) btnGroupAddMatch.textContent = "Thêm Match";
    if (btnGroupCancelEditMatch) btnGroupCancelEditMatch.classList.add("d-none");

    if (!id) {
      selectedGroupId = groups[0]?.groupId || "";
    } else {
      selectedGroupId = id;
    }

    if (groupSelector) {
      groupSelector.value = selectedGroupId;
    }

    renderMatches();
  }

  function addMatchIdToSelectedGroup(matchId) {
    const selectedGroup = getSelectedGroup();
    if (!selectedGroup) {
      showToast("Vui lòng chọn Group");
      return;
    }

    const normalized = normalizeMatchId(matchId);
    if (!normalized) {
      showToast("MatchID không được để trống");
      return;
    }

    if (selectedGroup.matches.some((entry) => entry.matchId === normalized)) {
      showToast("MatchID đã tồn tại trong Group");
      return;
    }

    selectedGroup.matches.push({
      matchId: normalized,
      description: String(groupMatchDescriptionAddInput?.value || "").trim(),
      addTime: nowText(),
    });

    if (groupMatchDescriptionAddInput) {
      groupMatchDescriptionAddInput.value = "";
    }

    saveGroups();
    renderMatches();
    showToast("Đã thêm MatchID vào Group");
  }

  function updateMatchInSelectedGroup(originalMatchId, nextMatchId, nextDescription) {
    const selectedGroup = getSelectedGroup();
    if (!selectedGroup) return false;

    const normalizedMatchId = normalizeMatchId(nextMatchId);
    if (!normalizedMatchId) {
      showToast("MatchID không được để trống");
      return false;
    }

    const target = selectedGroup.matches.find((entry) => entry.matchId === originalMatchId);
    if (!target) {
      showToast("Không tìm thấy match để cập nhật");
      return false;
    }

    const duplicate = selectedGroup.matches.some(
      (entry) => entry.matchId === normalizedMatchId && entry.matchId !== originalMatchId
    );
    if (duplicate) {
      showToast("MatchID đã tồn tại trong Group");
      return false;
    }

    target.matchId = normalizedMatchId;
    target.description = String(nextDescription || "").trim();
    saveGroups();
    renderMatches();
    return true;
  }

  function removeMatchIdFromSelectedGroup(matchId) {
    const selectedGroup = getSelectedGroup();
    if (!selectedGroup) return;

    selectedGroup.matches = selectedGroup.matches.filter((entry) => entry.matchId !== matchId);
    if (editingGroupMatchId === matchId) {
      editingGroupMatchId = null;
      if (groupMatchIdAddInput) groupMatchIdAddInput.value = "";
      if (groupMatchDescriptionAddInput) groupMatchDescriptionAddInput.value = "";
      if (btnGroupAddMatch) btnGroupAddMatch.textContent = "Thêm Match";
      if (btnGroupCancelEditMatch) btnGroupCancelEditMatch.classList.add("d-none");
    }
    saveGroups();
    renderMatches();
    showToast("Đã xóa MatchID khỏi Group");
  }

  function renderGroupSelector() {
    if (!groupSelector) return;

    const previous = String(selectedGroupId || groupSelector.value || "");
    groupSelector.innerHTML = '<option value="">-- Chưa có group --</option>';

    groups.forEach((group) => {
      const option = document.createElement("option");
      option.value = group.groupId;
      option.textContent = `${group.groupId} (${group.matches.length} match)`;
      groupSelector.appendChild(option);
    });

    if (previous && groups.some((group) => group.groupId === previous)) {
      groupSelector.value = previous;
      selectedGroupId = previous;
      return;
    }

    if (groups.length > 0) {
      selectedGroupId = groups[0].groupId;
      groupSelector.value = groups[0].groupId;
      return;
    }

    selectedGroupId = "";
    groupSelector.value = "";
  }

  function getAvailableTeamNames() {
    const names = players
      .map((player) => String(player.teamName || "").trim())
      .filter(Boolean);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b, "vi"));
  }

  function renderGroupTeamSelectOptions() {
    if (!groupTeamSelect) return;

    const previousSelected = new Set(
      Array.from(groupTeamSelect.selectedOptions || []).map((option) => String(option.value || "").trim())
    );
    const availableNames = getAvailableTeamNames();
    groupTeamSelect.innerHTML = "";

    availableNames.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      if (previousSelected.has(name)) {
        option.selected = true;
      }
      groupTeamSelect.appendChild(option);
    });
  }

  function addTeamToSelectedGroup(teamName, options = {}) {
    const selectedGroup = getSelectedGroup();
    const silent = !!options.silent;
    if (!selectedGroup) {
      if (!silent) showToast("Vui lòng chọn Group");
      return;
    }

    const normalized = String(teamName || "").trim();
    if (!normalized) {
      if (!silent) showToast("Tên đội không được để trống");
      return;
    }

    if (!Array.isArray(selectedGroup.teamNames)) {
      selectedGroup.teamNames = [];
    }

    if (selectedGroup.teamNames.some((name) => name.toLowerCase() === normalized.toLowerCase())) {
      if (!silent) showToast("Đội này đã có trong danh sách hôm nay");
      return;
    }

    selectedGroup.teamNames.push(normalized);
    selectedGroup.teamNames = [...new Set(selectedGroup.teamNames)].sort((a, b) => a.localeCompare(b, "vi"));
    saveGroups();
    renderMatches();
    if (!silent) showToast("Đã thêm đội vào danh sách thi đấu hôm nay");
  }

  function removeTeamFromSelectedGroup(teamName) {
    const selectedGroup = getSelectedGroup();
    if (!selectedGroup || !Array.isArray(selectedGroup.teamNames)) return;

    selectedGroup.teamNames = selectedGroup.teamNames.filter((name) => name !== teamName);
    saveGroups();
    renderMatches();
    showToast("Đã xóa đội khỏi danh sách thi đấu hôm nay");
  }

  function renderSelectedGroupEditor() {
    const selectedGroup = getSelectedGroup();
    const hasGroup = !!selectedGroup;

    if (groupEditor) {
      groupEditor.classList.toggle("d-none", !hasGroup);
    }
    if (groupEditorEmpty) {
      groupEditorEmpty.classList.toggle("d-none", hasGroup);
    }

    if (!selectedGroup) {
      if (groupMatchTableBody) {
        groupMatchTableBody.innerHTML = "";
      }
      if (groupMatchEmpty) groupMatchEmpty.classList.remove("d-none");
      if (groupMatchCount) {
        groupMatchCount.textContent = "0";
      }
      if (btnGroupOpenMatch) {
        btnGroupOpenMatch.disabled = true;
      }
      if (groupTeamList) {
        groupTeamList.innerHTML = "";
      }
      if (groupTeamEmpty) {
        groupTeamEmpty.classList.remove("d-none");
      }
      if (groupTeamCount) {
        groupTeamCount.textContent = "0";
      }
      return;
    }

    if (groupEditIdInput) {
      groupEditIdInput.value = selectedGroup.groupId;
    }
    if (groupEditNoteInput) {
      groupEditNoteInput.value = selectedGroup.note || "";
    }

    if (groupMatchCount) {
      groupMatchCount.textContent = String(selectedGroup.matches.length);
    }

    if (btnGroupOpenMatch) {
      btnGroupOpenMatch.disabled = selectedGroup.matches.length === 0;
    }

    const selectedTeamNames = Array.isArray(selectedGroup.teamNames)
      ? selectedGroup.teamNames
      : [];
    if (groupTeamCount) {
      groupTeamCount.textContent = String(selectedTeamNames.length);
    }
    if (groupTeamList) {
      if (selectedTeamNames.length === 0) {
        groupTeamList.innerHTML = "";
        if (groupTeamEmpty) {
          groupTeamEmpty.classList.remove("d-none");
        }
      } else {
        groupTeamList.innerHTML = selectedTeamNames
          .map((name) => `
            <div class="group-team-chip">
              <span class="group-team-name" title="${name}">${name}</span>
              <button class="group-team-remove" type="button" data-action="remove-group-team" data-team-name="${encodeURIComponent(name)}" aria-label="Xóa đội ${name}">
                ×
              </button>
            </div>
          `)
          .join("");
        if (groupTeamEmpty) {
          groupTeamEmpty.classList.add("d-none");
        }
      }
    }
    renderGroupTeamSelectOptions();

    if (!groupMatchTableBody) return;

    if (selectedGroup.matches.length === 0) {
      groupMatchTableBody.innerHTML = "";
      if (groupMatchEmpty) groupMatchEmpty.classList.remove("d-none");
      return;
    }

    if (groupMatchEmpty) groupMatchEmpty.classList.add("d-none");

    groupMatchTableBody.innerHTML = selectedGroup.matches
      .map((entry) => `
        <tr>
          <td class="match-id">${entry.matchId}</td>
          <td>${entry.description || ""}</td>
          <td>${entry.addTime || ""}</td>
          <td class="text-end">
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-secondary" data-action="edit-group-match" data-match-id="${entry.matchId}" type="button">Sửa</button>
              <button class="btn btn-outline-danger" data-action="remove-group-match" data-match-id="${entry.matchId}" type="button">Xóa</button>
            </div>
          </td>
        </tr>
      `)
      .join("");
  }

  async function fetchMatchStats(matchId) {
    try {
      const url = `${API_ENDPOINTS.MATCH_STATS}?matchId=${encodeURIComponent(matchId)}`;
      console.log("📤 Đang yêu cầu:", url);
      const response = await fetch(url);
      console.log("📥 Response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.message || `HTTP ${response.status}`;
        console.error("❌ API Error:", errorMsg);
        throw new Error(errorMsg);
      }
      const data = await response.json();
      console.log("✅ Dữ liệu nhận được:", data);
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("🔴 Lỗi khi lấy match stats:", msg);
      throw new Error(msg);
    }
  }

  async function fetchBatchMatchStats(matchIds) {
    try {
      const idsStr = matchIds.join(',');
      const url = `${API_ENDPOINTS.MATCH_STATS_BATCH}?matchIds=${encodeURIComponent(idsStr)}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Không thể lấy dữ liệu");
      }
      const data = await response.json();
      return data;
    } catch (err) {
      console.error("Lỗi khi lấy batch stats:", err);
      throw err;
    }
  }

  async function checkAPIHealth() {
    try {
      const response = await fetch(API_ENDPOINTS.HEALTH);
      if (!response.ok) {
        console.warn("⚠️ API không sẵn sàng");
        return false;
      }
      const data = await response.json();
      console.log("✅ API sẵn sàng:", data.timestamp);
      return true;
    } catch (err) {
      console.warn("⚠️ Không thể kết nối đến API:");
      console.warn("   URL:", API_ENDPOINTS.HEALTH);
      console.warn("   Lỗi:", err instanceof Error ? err.message : err);
      return false;
    }
  }

  function displayMatchDetails(matchId) {
    if (!matchDetailsBody) return;

    matchDetailsBody.innerHTML = `
      <div class="text-center py-4">
        <div class="spinner-border" role="status">
          <span class="visually-hidden">Đang tải...</span>
        </div>
      </div>
    `;

    if (modalInstance) {
      modalInstance.show();
    }

    renderMatchDetailsContent(matchId);
  }

  function renderMatchDetailsContent(matchId) {
    return `
      <div class="alert alert-info small">
        <strong>Ghi chú:</strong> Đây là dữ liệu tổng hợp. Nhấn nút bên dưới để xem chi tiết đầy đủ từng đội và Người chơi.
      </div>
      <div class="d-grid gap-2">
        <button class="btn btn-primary" onclick="if (window.parent !== window && window.parent.location.origin === location.origin) window.parent.dispatchEvent(new CustomEvent('ff-open-match', {detail:'${encodeURIComponent(matchId)}'})); else window.open('match-details.html?matchId=${encodeURIComponent(matchId)}', '_blank')">
          📊 Xem Chi Tiết Đầy Đủ
        </button>
      </div>
    `;
  }

  function displayMatchDetails(matchId) {
    if (!matchDetailsBody) return;

    matchDetailsBody.innerHTML = `
      <div class="text-center py-4">
        <div class="spinner-border" role="status">
          <span class="visually-hidden">Đang tải...</span>
        </div>
      </div>
    `;

    if (modalInstance) {
      modalInstance.show();
    }

    matchDetailsBody.innerHTML = renderMatchDetailsContent(matchId);
  }

  function parseMatchCsv(text) {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) return [];

    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const groupIdx = header.indexOf("groupid");
    const matchIdsIdx = header.indexOf("matchids");
    const singleMatchIdx = header.indexOf("matchid");
    const descriptionIdx = header.indexOf("description");
    const addTimeIdx = header.indexOf("addtime");
    const noteIdx = header.indexOf("note");

    if (groupIdx === -1) {
      throw new Error("CSV phải có cột groupId");
    }

    const byGroup = new Map();

    lines.slice(1).forEach((line) => {
      const parts = line.split(",");
      const groupId = normalizeGroupId(parts[groupIdx]);
      if (!groupId) return;

      if (!byGroup.has(groupId)) {
        byGroup.set(groupId, {
          groupId,
          note: noteIdx >= 0 ? String(parts[noteIdx] || "").trim() : "",
          matches: [],
        });
      }

      const group = byGroup.get(groupId);

      if (singleMatchIdx >= 0) {
        const matchId = normalizeMatchId(parts[singleMatchIdx]);
        if (matchId) {
          group.matches.push({
            matchId,
            description: descriptionIdx >= 0 ? String(parts[descriptionIdx] || "").trim() : "",
            addTime: addTimeIdx >= 0 ? String(parts[addTimeIdx] || nowText()).trim() : nowText(),
          });
        }
        return;
      }

      const parsedIds = parseMatchIds(matchIdsIdx >= 0 ? parts[matchIdsIdx] : "");
      parsedIds.forEach((matchId) => {
        group.matches.push({
          matchId,
          description: "",
          addTime: nowText(),
        });
      });
    });

    return [...byGroup.values()];
  }

  function exportMatchCsv() {
    if (groups.length === 0) {
      showToast("Không có dữ liệu để xuất");
      return;
    }

    const lines = ["groupId,matchId,description,addTime,note"];
    groups.forEach((group) => {
      const safeNote = String(group.note || "").replaceAll(",", " ");
      if (!Array.isArray(group.matches) || group.matches.length === 0) {
        lines.push(`${group.groupId},,,,${safeNote}`);
        return;
      }

      group.matches.forEach((entry) => {
        const safeDescription = String(entry.description || "").replaceAll(",", " ");
        lines.push(`${group.groupId},${entry.matchId},${safeDescription},${entry.addTime || ""},${safeNote}`);
      });
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `group-list-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Đã xuất CSV");
  }

  function applySortMatches(list) {
    const mode = sortSelect.value;
    const copy = [...list];

    if (mode === "oldest") return copy.reverse();
    if (mode === "group-asc") return copy.sort((a, b) => a.groupId.localeCompare(b.groupId));
    if (mode === "group-desc") return copy.sort((a, b) => b.groupId.localeCompare(a.groupId));
    return copy;
  }

  function renderMatches() {
    const q = String(searchInput.value || "").trim().toLowerCase();
    const filtered = groups.filter((r) => {
      if (!q) return true;
      return (
        r.groupId.toLowerCase().includes(q) ||
        (r.matches || []).some((entry) => String(entry.matchId).toLowerCase().includes(q) || String(entry.description || "").toLowerCase().includes(q)) ||
        String(r.note || "").toLowerCase().includes(q)
      );
    });

    const sorted = applySortMatches(filtered);
    matchTableBody.innerHTML = "";

    sorted.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="match-id">${r.groupId}${r.groupId === selectedGroupId ? ' <span class="badge text-bg-primary">đang chọn</span>' : ""}</td>
        <td>${r.note || ""}</td>
        <td>${r.createdAt}</td>
        <td class="text-end">
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-info" data-action="select" data-id="${r.groupId}">Chọn</button>
            <button class="btn btn-outline-secondary" data-action="view" data-id="${r.groupId}">Xem match</button>
            <button class="btn btn-outline-danger" data-action="delete" data-id="${r.groupId}">Xóa</button>
          </div>
        </td>
      `;
      matchTableBody.appendChild(tr);
    });

    emptyState.classList.toggle("d-none", sorted.length > 0);
    renderGroupSelector();
    renderSelectedGroupEditor();
    renderRunToolsGroupOptions();
  }

  function renderRunToolsGroupOptions(preferredGroupId = "") {
    if (!runToolsGroupIdSelect) return;

    const selected = String(runToolsGroupIdSelect.value || "");
    const preferred = String(preferredGroupId || "").trim();
    runToolsGroupIdSelect.innerHTML = '<option value="">-- Chọn group --</option>';

    groups.forEach((group) => {
      const option = document.createElement("option");
      option.value = group.groupId;
      option.textContent = `${group.groupId} (${(group.matches || []).length} match)`;
      runToolsGroupIdSelect.appendChild(option);
    });

    if (preferred && groups.some((g) => g.groupId === preferred)) {
      runToolsGroupIdSelect.value = preferred;
      return;
    }

    if (selected && groups.some((g) => g.groupId === selected)) {
      runToolsGroupIdSelect.value = selected;
      return;
    }

    if (selectedGroupId && groups.some((g) => g.groupId === selectedGroupId)) {
      runToolsGroupIdSelect.value = selectedGroupId;
      return;
    }

    if (groups.length > 0) {
      runToolsGroupIdSelect.value = groups[0].groupId;
    }
  }

  // ============ Players Functions ============
  function normalizePlayerId(value) {
    return String(value || "").trim();
  }

  function addPlayer(playerId, playerName, teamName, playerImage, teamImage, createdAt) {
    const id = normalizePlayerId(playerId);
    if (!id || !playerName || !teamName) {
      showToast("Các trường bắt buộc không được để trống");
      return false;
    }

    if (players.some((p) => p.playerId === id)) {
      showToast("Player ID đã tồn tại");
      return false;
    }

    players.unshift({
      playerId: id,
      playerName: String(playerName).trim(),
      teamName: String(teamName).trim(),
      playerImage: String(playerImage || "").trim(),
      teamImage: String(teamImage || "").trim(),
      createdAt: createdAt || nowText(),
    });
    savePlayers();
    renderPlayers();
    return true;
  }

  function removePlayer(playerId) {
    players = players.filter((p) => p.playerId !== playerId);
    savePlayers();
    renderPlayers();
  }

  function setImagePreview(el, src) {
    if (!el) return;
    if (src) {
      el.src = src;
      el.style.display = "inline-block";
    } else {
      el.removeAttribute("src");
      el.style.display = "none";
    }
  }

  function openEditPlayerModal(playerId) {
    const player = players.find((p) => p.playerId === playerId);
    if (!player || !editPlayerModal) return;

    editingPlayerOriginalId = player.playerId;

    editPlayerIdInput.value = player.playerId || "";
    editPlayerNameInput.value = player.playerName || "";
    editTeamNameInput.value = player.teamName || "";
    editPlayerImageInput.value = "";
    editTeamImageInput.value = "";
    setImagePreview(editPlayerImagePreview, player.playerImage || "");
    setImagePreview(editTeamImagePreview, player.teamImage || "");

    editPlayerModal.show();
  }

  async function savePlayerEdit() {
    if (!editingPlayerOriginalId) return;

    const current = players.find((p) => p.playerId === editingPlayerOriginalId);
    if (!current) {
      showToast("Không tìm thấy Người chơi để cập nhật");
      return;
    }

    const nextId = normalizePlayerId(editPlayerIdInput.value);
    const nextName = String(editPlayerNameInput.value || "").trim();
    const nextTeam = String(editTeamNameInput.value || "").trim();

    if (!nextId || !nextName || !nextTeam) {
      showToast("Các trường bắt buộc không được để trống");
      return;
    }

    const duplicated = players.some(
      (p) => p.playerId === nextId && p.playerId !== editingPlayerOriginalId
    );
    if (duplicated) {
      showToast("Player ID mới đã tồn tại");
      return;
    }

    try {
      let nextPlayerImage = current.playerImage || "";
      let nextTeamImage = current.teamImage || "";

      if (editPlayerImageInput.files && editPlayerImageInput.files[0]) {
        nextPlayerImage = await fileToBase64(editPlayerImageInput.files[0]);
      }
      if (editTeamImageInput.files && editTeamImageInput.files[0]) {
        nextTeamImage = await fileToBase64(editTeamImageInput.files[0]);
      }

      current.playerId = nextId;
      current.playerName = nextName;
      current.teamName = nextTeam;
      current.playerImage = nextPlayerImage;
      current.teamImage = nextTeamImage;

      savePlayers();
      renderPlayers();
      editPlayerModal.hide();
      showToast("Đã cập nhật đầy đủ thông tin Người chơi");
      editingPlayerOriginalId = null;
    } catch (err) {
      console.error(err);
      showToast("Lỗi khi xử lý ảnh chỉnh sửa");
    }
  }

  function parsePlayerCsv(text) {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) return [];

    const firstCols = lines[0].split(",").map((p) => p.trim().toLowerCase());
    const hasHeader =
      firstCols[0]?.includes("team") ||
      firstCols[1]?.includes("id") ||
      firstCols[2]?.includes("game") ||
      firstCols[2]?.includes("name");

    const dataLines = hasHeader ? lines.slice(1) : lines;

    return dataLines.map((line) => {
      const parts = line.split(",").map((p) => p.trim());
      return {
        teamName: String(parts[0] || "").trim(),
        playerId: normalizePlayerId(parts[1]),
        playerName: String(parts[2] || "").trim(),
        playerImage: String(parts[3] || "").trim(),
        teamImage: String(parts[4] || "").trim(),
      };
    }).filter((item) => item.teamName && item.playerId && item.playerName);
  }

  function exportPlayerCsv() {
    if (players.length === 0) {
      showToast("Không có Người chơi để xuất");
      return;
    }

    const lines = ["teamName,memberId,gameName,playerImage,teamImage,createdAt"];
    players.forEach((p) => {
      lines.push(`${p.teamName},${p.playerId},${p.playerName},${p.playerImage || ""},${p.teamImage || ""},${p.createdAt}`);
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `player-list-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Đã xuất danh sách Người chơi");
  }

  function applySortPlayers(list) {
    const mode = sortPlayerSelect.value;
    const copy = [...list];

    if (mode === "oldest") return copy.reverse();
    if (mode === "player-asc") return copy.sort((a, b) => a.playerName.localeCompare(b.playerName));
    if (mode === "player-desc") return copy.sort((a, b) => b.playerName.localeCompare(a.playerName));
    if (mode === "team-asc") return copy.sort((a, b) => a.teamName.localeCompare(b.teamName));
    return copy;
  }

  function renderPlayers() {
    const q = String(searchPlayerInput.value || "").trim().toLowerCase();
    const filtered = players.filter((p) => {
      if (!q) return true;
      return (
        p.playerId.toLowerCase().includes(q) ||
        String(p.playerName || "").toLowerCase().includes(q) ||
        String(p.teamName || "").toLowerCase().includes(q)
      );
    });

    const sorted = applySortPlayers(filtered);
    playerTableBody.innerHTML = "";

    sorted.forEach((p) => {
      const tr = document.createElement("tr");
      const hasImage = p.playerImage && p.playerImage.length > 0;
      const imagePreview = hasImage
        ? `<img src="${p.playerImage}" alt="${p.playerName}" style="max-width: 30px; max-height: 30px; border-radius: 3px;" title="Ảnh Người chơi" />`
        : "-";

      tr.innerHTML = `
        <td class="match-id">${p.playerId}</td>
        <td>${p.playerName}</td>
        <td>${p.teamName}</td>
        <td>${imagePreview}</td>
        <td class="text-end">
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-secondary" data-action="edit" data-id="${p.playerId}">Sửa</button>
            <button class="btn btn-outline-danger" data-action="delete" data-id="${p.playerId}">Xóa</button>
          </div>
        </td>
      `;
      playerTableBody.appendChild(tr);
    });

    emptyPlayerState.classList.toggle("d-none", sorted.length > 0);
  }

  // ============ Event Listeners - Matches ============
  matchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const ok = addGroup(groupInput?.value, matchInput.value, noteInput.value, nowText());
    if (!ok) return;

    matchForm.reset();
    if (groupInput) {
      groupInput.focus();
    }
    showToast("Đã thêm Group");
  });

  btnImport.addEventListener("click", async () => {
    const file = csvInput.files && csvInput.files[0];
    if (!file) {
      showToast("Hãy chọn file CSV trước");
      return;
    }

    try {
      const text = await file.text();
      const data = parseMatchCsv(text);
      let inserted = 0;
      data.forEach((r) => {
        if (addGroup(r.groupId, "", r.note, nowText())) {
          updateGroup(r.groupId, { matches: r.matches || [] });
          inserted += 1;
        }
      });
      showToast(`Nhập thành công ${inserted} dòng`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Nhập thất bại");
    }
  });

  btnExport.addEventListener("click", exportMatchCsv);

  btnClear.addEventListener("click", () => {
    if (!confirm("Bạn chắc chắn muốn xóa toàn bộ dữ liệu Group?")) return;
    groups = [];
    saveGroups();
    renderMatches();
    showToast("Đã xóa tất cả dữ liệu");
  });

  matchTableBody.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    const action = target.getAttribute("data-action");
    const groupId = target.getAttribute("data-id");
    if (!action || !groupId) return;

    if (action === "delete") {
      removeGroup(groupId);
      showToast("Đã xóa Group");
      return;
    }

    if (action === "select") {
      setSelectedGroup(groupId);
      showToast(`Đã chọn Group: ${groupId}`);
      return;
    }

    if (action === "view") {
      setSelectedGroup(groupId);
      const selectedGroup = groups.find((group) => group.groupId === groupId);
      const firstMatchId = selectedGroup?.matches?.[0]?.matchId;
      if (!firstMatchId) {
        showToast("Group này chưa có matchId để xem chi tiết");
        return;
      }
      displayMatchDetails(firstMatchId);
      return;
    }
  });

  searchInput.addEventListener("input", renderMatches);
  sortSelect.addEventListener("change", renderMatches);

  if (groupSelector) {
    groupSelector.addEventListener("change", () => {
      setSelectedGroup(groupSelector.value);
    });
  }

  if (groupTeamSelect) {
    groupTeamSelect.addEventListener("mousedown", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLOptionElement)) return;

      // Toggle selection on click so users can unselect without Ctrl/Shift.
      event.preventDefault();
      target.selected = !target.selected;
    });
  }

  if (btnGroupAddTeam) {
    btnGroupAddTeam.addEventListener("click", () => {
      const selectedTeamNames = Array.from(groupTeamSelect?.selectedOptions || [])
        .map((option) => String(option.value || "").trim())
        .filter(Boolean);
      const customTeamRaw = String(groupTeamCustomInput?.value || "").trim();
      const customTeamNames = customTeamRaw
        ? customTeamRaw
          .split(/\r?\n+/)
          .map((item) => String(item || "").trim())
          .filter(Boolean)
        : [];

      let insertedCount = 0;

      selectedTeamNames.forEach((teamName) => {
        const beforeCount = getSelectedGroup()?.teamNames?.length || 0;
        addTeamToSelectedGroup(teamName, { silent: true });
        const afterCount = getSelectedGroup()?.teamNames?.length || 0;
        if (afterCount > beforeCount) {
          insertedCount += 1;
        }
      });

      customTeamNames.forEach((customTeamName) => {
        const beforeCount = getSelectedGroup()?.teamNames?.length || 0;
        addTeamToSelectedGroup(customTeamName, { silent: true });
        const afterCount = getSelectedGroup()?.teamNames?.length || 0;
        if (afterCount > beforeCount) {
          insertedCount += 1;
        }
      });

      if (insertedCount > 1) {
        showToast(`Đã thêm ${insertedCount} đội vào danh sách hôm nay`);
      }

      if (insertedCount === 1) {
        showToast("Đã thêm 1 đội vào danh sách hôm nay");
      }

      if (insertedCount === 0 && customTeamNames.length === 0 && selectedTeamNames.length === 0) {
        showToast("Vui lòng chọn ít nhất 1 đội hoặc nhập danh sách đội");
      }

      if (groupTeamCustomInput) {
        groupTeamCustomInput.value = "";
      }
      if (groupTeamSelect) {
        Array.from(groupTeamSelect.options).forEach((option) => {
          option.selected = false;
        });
      }

      if (teamPickerModal && insertedCount > 0) {
        teamPickerModal.hide();
      }
    });
  }

  if (btnOpenTeamPicker) {
    btnOpenTeamPicker.addEventListener("click", () => {
      renderGroupTeamSelectOptions();
      teamPickerModal?.show();
    });
  }

  if (groupTeamCustomInput) {
    groupTeamCustomInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || !event.ctrlKey) return;
      event.preventDefault();
      btnGroupAddTeam?.click();
    });
  }

  if (groupTeamList) {
    groupTeamList.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const action = target.getAttribute("data-action");
      if (action !== "remove-group-team") return;

      const teamName = target.getAttribute("data-team-name");
      if (!teamName) return;
      removeTeamFromSelectedGroup(decodeURIComponent(teamName));
    });
  }

  if (btnGroupSave) {
    btnGroupSave.addEventListener("click", () => {
      const selectedGroup = getSelectedGroup();
      if (!selectedGroup) {
        showToast("Vui lòng chọn Group để lưu");
        return;
      }

      const ok = updateGroup(selectedGroup.groupId, {
        groupId: groupEditIdInput?.value,
        note: groupEditNoteInput?.value,
      });

      if (ok) {
        showToast("Đã lưu thông tin Group");
      }
    });
  }

  if (btnGroupDelete) {
    btnGroupDelete.addEventListener("click", () => {
      const selectedGroup = getSelectedGroup();
      if (!selectedGroup) {
        showToast("Vui lòng chọn Group để xóa");
        return;
      }

      if (!confirm(`Bạn chắc chắn muốn xóa group ${selectedGroup.groupId}?`)) {
        return;
      }

      removeGroup(selectedGroup.groupId);
      showToast("Đã xóa Group");
    });
  }

  if (btnGroupAddMatch) {
    btnGroupAddMatch.addEventListener("click", () => {
      const matchId = groupMatchIdAddInput?.value || "";
      const description = String(groupMatchDescriptionAddInput?.value || "").trim();

      if (editingGroupMatchId) {
        const ok = updateMatchInSelectedGroup(editingGroupMatchId, matchId, description);
        if (ok) {
          editingGroupMatchId = null;
          if (btnGroupAddMatch) btnGroupAddMatch.textContent = "Thêm Match";
          if (btnGroupCancelEditMatch) btnGroupCancelEditMatch.classList.add("d-none");
          if (groupMatchIdAddInput) groupMatchIdAddInput.value = "";
          if (groupMatchDescriptionAddInput) groupMatchDescriptionAddInput.value = "";
          showToast("Đã cập nhật match");
        }
        return;
      }

      addMatchIdToSelectedGroup(matchId);
      if (groupMatchIdAddInput) {
        groupMatchIdAddInput.value = "";
      }
    });
  }

  if (btnGroupCancelEditMatch) {
    btnGroupCancelEditMatch.addEventListener("click", () => {
      editingGroupMatchId = null;
      if (groupMatchIdAddInput) groupMatchIdAddInput.value = "";
      if (groupMatchDescriptionAddInput) groupMatchDescriptionAddInput.value = "";
      if (btnGroupAddMatch) btnGroupAddMatch.textContent = "Thêm Match";
      btnGroupCancelEditMatch.classList.add("d-none");
    });
  }

  if (groupMatchIdAddInput) {
    groupMatchIdAddInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      btnGroupAddMatch?.click();
    });
  }

  if (btnConfirmBatchMatch) {
    btnConfirmBatchMatch.addEventListener("click", () => {
      const textarea = batchMatchTextarea?.value || "";
      if (!textarea.trim()) {
        showToast("Vui lòng nhập ít nhất một Match");
        return;
      }

      const selectedGroup = getSelectedGroup();
      if (!selectedGroup) {
        showToast("Vui lòng chọn Group");
        return;
      }

      const lines = textarea
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      let addedCount = 0;
      let errorCount = 0;

      for (const line of lines) {
        const parts = line.split("|");
        const matchId = parts[0].trim();
        const description = parts[1]?.trim() || "";

        if (!matchId) {
          errorCount++;
          continue;
        }

        const normalized = normalizeMatchId(matchId);
        if (!normalized) {
          errorCount++;
          continue;
        }

        if (selectedGroup.matches.some((entry) => entry.matchId === normalized)) {
          errorCount++;
          continue;
        }

        selectedGroup.matches.push({
          matchId: normalized,
          description: description,
          addTime: nowText(),
        });

        addedCount++;
      }

      if (addedCount > 0) {
        saveGroups();
        renderMatches();
        showToast(`Đã thêm ${addedCount} match (${errorCount} lỗi, nếu có)`);
        if (batchMatchTextarea) batchMatchTextarea.value = "";
        batchMatchModal?.hide();
      } else {
        showToast("Không có match hợp lệ để thêm");
      }
    });
  }

  if (groupMatchTableBody) {
    groupMatchTableBody.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const action = target.getAttribute("data-action");
      const matchId = target.getAttribute("data-match-id");
      if (!matchId) return;

      if (action === "remove-group-match") {
        removeMatchIdFromSelectedGroup(matchId);
        return;
      }

      if (action === "edit-group-match") {
        const selectedGroup = getSelectedGroup();
        const targetMatch = selectedGroup?.matches?.find((entry) => entry.matchId === matchId);
        if (!targetMatch) return;

        editingGroupMatchId = targetMatch.matchId;
        if (groupMatchIdAddInput) groupMatchIdAddInput.value = targetMatch.matchId;
        if (groupMatchDescriptionAddInput) groupMatchDescriptionAddInput.value = targetMatch.description || "";
        if (btnGroupAddMatch) btnGroupAddMatch.textContent = "Lưu chỉnh sửa";
        if (btnGroupCancelEditMatch) btnGroupCancelEditMatch.classList.remove("d-none");
        groupMatchIdAddInput?.focus();
        return;
      }
    });
  }

  if (btnGroupOpenMatch) {
    btnGroupOpenMatch.addEventListener("click", () => {
      const selectedGroup = getSelectedGroup();
      const firstMatchId = selectedGroup?.matches?.[0]?.matchId;
      if (!firstMatchId) {
        showToast("Group này chưa có matchId để xem chi tiết");
        return;
      }
      displayMatchDetails(firstMatchId);
    });
  }

  // ============ Event Listeners - Players ============
  playerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    let playerImageBase64 = "";
    let teamImageBase64 = "";

    try {
      if (playerImageInput.files && playerImageInput.files[0]) {
        playerImageBase64 = await fileToBase64(playerImageInput.files[0]);
      }
      if (teamImageInput.files && teamImageInput.files[0]) {
        teamImageBase64 = await fileToBase64(teamImageInput.files[0]);
      }

      const ok = addPlayer(
        playerIdInput.value,
        playerNameInput.value,
        teamNameInput.value,
        playerImageBase64,
        teamImageBase64,
        nowText()
      );
      if (!ok) return;

      playerForm.reset();
      playerIdInput.focus();
      showToast("Đã thêm Người chơi");
    } catch (err) {
      showToast("Lỗi khi xử lý ảnh");
      console.error(err);
    }
  });

  btnImportPlayer.addEventListener("click", async () => {
    const file = playerCsvInput.files && playerCsvInput.files[0];
    if (!file) {
      showToast("Hãy chọn file CSV trước");
      return;
    }

    try {
      const text = await file.text();
      const data = parsePlayerCsv(text);
      let inserted = 0;
      data.forEach((p) => {
        if (addPlayer(p.playerId, p.playerName, p.teamName, "", "", nowText()))
          inserted += 1;
      });
      showToast(`Nhập thành công ${inserted} Người chơi`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Nhập thất bại");
    }
  });

  btnExportPlayer.addEventListener("click", exportPlayerCsv);

  btnClearPlayer.addEventListener("click", () => {
    if (!confirm("Bạn chắc chắn muốn xóa toàn bộ danh sách Người chơi?")) return;
    players = [];
    savePlayers();
    renderPlayers();
    showToast("Đã xóa tất cả danh sách");
  });

  playerTableBody.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    const action = target.getAttribute("data-action");
    const playerId = target.getAttribute("data-id");
    if (!action || !playerId) return;

    if (action === "delete") {
      removePlayer(playerId);
      showToast("Đã xóa Người chơi");
      return;
    }

    if (action === "edit") {
      openEditPlayerModal(playerId);
    }
  });

  if (btnSavePlayerEdit) {
    btnSavePlayerEdit.addEventListener("click", savePlayerEdit);
  }

  if (editPlayerImageInput) {
    editPlayerImageInput.addEventListener("change", async () => {
      if (!(editPlayerImageInput.files && editPlayerImageInput.files[0])) return;
      try {
        const image = await fileToBase64(editPlayerImageInput.files[0]);
        setImagePreview(editPlayerImagePreview, image);
      } catch (err) {
        console.error(err);
      }
    });
  }

  if (editTeamImageInput) {
    editTeamImageInput.addEventListener("change", async () => {
      if (!(editTeamImageInput.files && editTeamImageInput.files[0])) return;
      try {
        const image = await fileToBase64(editTeamImageInput.files[0]);
        setImagePreview(editTeamImagePreview, image);
      } catch (err) {
        console.error(err);
      }
    });
  }

  if (btnRunTools && runToolsModal) {
    btnRunTools.addEventListener("click", () => {
      if (runToolsFilePathInput) {
        runToolsFilePathInput.value = "";
      }
      renderRunToolsGroupOptions(selectedGroupId);
      if (runToolsConfirmCheck) {
        runToolsConfirmCheck.checked = false;
      }
      runToolsModal.show();
    });
  }

  if (btnConfirmRunTools) {
    btnConfirmRunTools.addEventListener("click", async () => {
      const filePath = normalizeFilePath(runToolsFilePathInput?.value || "");
      const selectedGroupId = String(runToolsGroupIdSelect?.value || "").trim();

      if (runToolsFilePathInput) {
        runToolsFilePathInput.value = filePath;
      }

      if (!filePath) {
        showToast("Vui lòng nhập đường dẫn file");
        return;
      }

      if (!isValidFilePath(filePath)) {
        showToast("Đường dẫn file không hợp lệ");
        return;
      }

      if (groups.length === 0) {
        showToast("Cần tạo ít nhất 1 group trước khi chạy tools");
        return;
      }

      if (!selectedGroupId) {
        showToast("Vui lòng chọn group để chạy tools");
        return;
      }

      if (!runToolsConfirmCheck?.checked) {
        showToast("Vui lòng xác nhận đã kiểm tra dữ liệu global và group");
        return;
      }

      showToast(`Đã xác nhận chạy tools với file: ${filePath}`);
      if (runToolsModal) {
        runToolsModal.hide();
      }

      const payload = {
        filePath,
        selectedGroupId,
        global: {
          players: players.map((p) => ({
            playerId: p.playerId,
            playerName: p.playerName,
            teamName: p.teamName,
          })),
        },
        groups: groups.map((group) => ({
          groupId: group.groupId,
          matchIds: Array.isArray(group.matches) ? group.matches.map((entry) => entry.matchId) : [],
          teamNames: Array.isArray(group.teamNames) ? group.teamNames : [],
          note: group.note,
        })),
      };

      const response = await fetch(`${API_BASE_URL}/create-listener`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.message || `HTTP ${response.status}`;
        showToast(`Lỗi khi tạo listener: ${errorMsg}`);
        return;
      }

      const result = await response.json();
      const targetUrl = `terminal.html?filePath=${encodeURIComponent(filePath)}&listenerID=${result.listenerID}`;

      window.location.href = targetUrl;
    });
  }

  searchPlayerInput.addEventListener("input", renderPlayers);
  sortPlayerSelect.addEventListener("change", renderPlayers);

  // Check API health
  checkAPIHealth();

  // Initial render
  renderMatches();
  renderRunToolsGroupOptions();
  renderGroupTeamSelectOptions();
  renderPlayers();
})();
