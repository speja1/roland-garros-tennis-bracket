(function () {
  const STORAGE_KEY = "rg-bracket-challenge-v1";
  const ROUNDS = ["Round 1", "Round 2", "Round 3", "Round 4", "Quarterfinal", "Semifinal", "Final"];
  const TOTAL_ROUNDS = 7;
  const ESPN_SYNC_WINDOW = "20260524-20260607";
  const ACCESS_KEY = "rg-bracket-entry-access-v1";

  const state = loadState();
  let remoteReady = false;
  let remoteBackend = null;
  let activeEvent = "MS";
  let activeView = "bracket";
  let draftEntry = null;
  const isAdminMode = new URLSearchParams(window.location.search).get("admin") === "1";

  const $ = (id) => document.getElementById(id);

  function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return normalizeState(parsed);
      } catch (error) {
        console.warn("Could not parse saved state", error);
      }
    }

    return normalizeState({
      locked: false,
      currentEntryId: null,
      entries: [],
      draws: window.RG_SAMPLE_DRAWS,
      results: { MS: {}, WS: {} }
    });
  }

  function normalizeState(nextState, options = {}) {
    const normalized = {
      locked: Boolean(nextState.locked),
      currentEntryId: options.currentEntryId ?? nextState.currentEntryId ?? null,
      entries: Array.isArray(nextState.entries) ? nextState.entries : [],
      draws: nextState.draws || window.RG_SAMPLE_DRAWS,
      results: nextState.results || { MS: {}, WS: {} }
    };

    ["MS", "WS"].forEach((eventCode) => {
      if (!normalized.draws[eventCode]) normalized.draws[eventCode] = window.RG_SAMPLE_DRAWS[eventCode];
      if (!normalized.results[eventCode]) normalized.results[eventCode] = {};
    });

    normalized.entries.forEach((entry) => {
      if (!entry.editCode) entry.editCode = makeEditCode();
      if (!entry.picks) entry.picks = { MS: {}, WS: {} };
      if (!entry.picks.MS) entry.picks.MS = {};
      if (!entry.picks.WS) entry.picks.WS = {};
      if (entry.submitted === undefined) entry.submitted = true;
    });

    return normalized;
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    saveRemoteState();
  }

  function sharedState() {
    return {
      locked: state.locked,
      currentEntryId: null,
      entries: state.entries,
      draws: state.draws,
      results: state.results
    };
  }

  function saveRemoteState() {
    if (!remoteReady || !location.protocol.startsWith("http")) return;

    const save = remoteBackend === "supabase"
      ? saveSupabaseState()
      : saveNodeState();

    save.catch(() => {
      remoteReady = false;
    });
  }

  function supabaseConfig() {
    const config = window.RG_SUPABASE_CONFIG || {};
    if (!config.url || !config.anonKey) return null;
    return {
      url: config.url.replace(/\/$/, ""),
      anonKey: config.anonKey,
      stateId: config.stateId || "rg-2026"
    };
  }

  function supabaseHeaders(config) {
    return {
      "apikey": config.anonKey,
      "authorization": `Bearer ${config.anonKey}`,
      "content-type": "application/json"
    };
  }

  async function loadSupabaseState(config) {
    const response = await fetch(`${config.url}/rest/v1/app_state?id=eq.${encodeURIComponent(config.stateId)}&select=state&limit=1`, {
      headers: supabaseHeaders(config)
    });
    if (!response.ok) throw new Error("Supabase state load failed.");
    const rows = await response.json();
    return rows[0]?.state || null;
  }

  async function saveSupabaseState() {
    const config = supabaseConfig();
    if (!config) return;

    const response = await fetch(`${config.url}/rest/v1/app_state?on_conflict=id`, {
      method: "POST",
      headers: {
        ...supabaseHeaders(config),
        "prefer": "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify({
        id: config.stateId,
        state: sharedState(),
        updated_at: new Date().toISOString()
      })
    });

    if (!response.ok) throw new Error("Supabase state save failed.");
  }

  async function loadNodeState() {
    const response = await fetch("/api/state");
    if (!response.ok) throw new Error("Local state load failed.");
    const payload = await response.json();
    return payload.state || null;
  }

  async function saveNodeState() {
    const response = await fetch("/api/state", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sharedState())
    });
    if (!response.ok) throw new Error("Local state save failed.");
  }

  async function hydrateFromServer() {
    if (!location.protocol.startsWith("http")) return;

    try {
      const config = supabaseConfig();
      const incomingState = config ? await loadSupabaseState(config) : await loadNodeState();
      remoteBackend = config ? "supabase" : "node";
      remoteReady = true;

      if (incomingState) {
        Object.assign(state, normalizeState(incomingState, { currentEntryId: state.currentEntryId }));
        initializeEntryFromUrl();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        render();
      } else {
        saveState();
      }
    } catch (error) {
      remoteReady = false;
    }
  }

  function makeId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function makeEditCode() {
    return Math.random().toString(36).slice(2, 6).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  function getAccessMap() {
    try {
      return JSON.parse(localStorage.getItem(ACCESS_KEY) || "{}");
    } catch (error) {
      return {};
    }
  }

  function rememberEntryAccess(entry) {
    if (!entry?.id || !entry.editCode) return;
    const access = getAccessMap();
    access[entry.id] = entry.editCode;
    localStorage.setItem(ACCESS_KEY, JSON.stringify(access));
  }

  function canEditEntry(entry) {
    if (!entry) return false;
    if (isAdminMode) return true;
    if (!entry.editCode) return false;
    return getAccessMap()[entry.id] === entry.editCode;
  }

  function entryEditUrl(entry) {
    const url = new URL(window.location.href);
    url.searchParams.delete("admin");
    url.searchParams.set("entry", entry.id);
    url.searchParams.set("code", entry.editCode);
    return url.toString();
  }

  function createEntry(name) {
    return {
      id: makeId("entry"),
      name: name || "My Bracket",
      editCode: makeEditCode(),
      submitted: false,
      createdAt: new Date().toISOString(),
      picks: { MS: {}, WS: {} }
    };
  }

  function initializeEntryFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const entryId = params.get("entry");
    const editCode = params.get("code");
    if (!entryId || !editCode) return;

    const entry = state.entries.find((item) => item.id === entryId && item.editCode === editCode);
    if (!entry) return;
    state.currentEntryId = entry.id;
    rememberEntryAccess(entry);
  }

  function getCurrentEntry() {
    return state.entries.find((entry) => entry.id === state.currentEntryId) || null;
  }

  function ensureEntry() {
    let entry = getCurrentEntry();
    if (entry) return entry;

    if (!draftEntry) draftEntry = createEntry($("entryName")?.value.trim() || "My Bracket");
    return draftEntry;
  }

  function matchId(eventCode, round, index) {
    return `${eventCode}-R${round}-M${index}`;
  }

  function pointsForRound(round) {
    return 2 ** (round - 1);
  }

  function playerById(eventCode, playerId) {
    return state.draws[eventCode].players.find((player) => player.id === playerId) || null;
  }

  function initialPair(eventCode, index) {
    const players = state.draws[eventCode].players;
    return [players[index * 2] || null, players[index * 2 + 1] || null];
  }

  function participantFromPick(entry, eventCode, round, index, side) {
    if (round === 1) return initialPair(eventCode, index)[side];

    const previousIndex = index * 2 + side;
    const previousMatchId = matchId(eventCode, round - 1, previousIndex);
    const pickedId = entry.picks[eventCode][previousMatchId];
    return pickedId ? playerById(eventCode, pickedId) : null;
  }

  function participantFromResult(eventCode, round, index, side) {
    if (round === 1) return initialPair(eventCode, index)[side];

    const previousIndex = index * 2 + side;
    const previousMatchId = matchId(eventCode, round - 1, previousIndex);
    const winnerId = state.results[eventCode][previousMatchId];
    return winnerId ? playerById(eventCode, winnerId) : null;
  }

  function isValidParticipant(player, a, b) {
    return player && (player.id === a?.id || player.id === b?.id);
  }

  function clearInvalidDownstreamPicks(entry, eventCode) {
    for (let round = 2; round <= TOTAL_ROUNDS; round += 1) {
      const count = 128 / 2 ** round;
      for (let index = 0; index < count; index += 1) {
        const id = matchId(eventCode, round, index);
        const picked = playerById(eventCode, entry.picks[eventCode][id]);
        const a = participantFromPick(entry, eventCode, round, index, 0);
        const b = participantFromPick(entry, eventCode, round, index, 1);
        if (picked && !isValidParticipant(picked, a, b)) {
          delete entry.picks[eventCode][id];
        }
      }
    }
  }

  function choosePick(eventCode, round, index, playerId) {
    const entry = ensureEntry();
    if (state.locked) return;
    if (entry.submitted && !canEditEntry(entry)) return;

    const id = matchId(eventCode, round, index);
    entry.picks[eventCode][id] = playerId;
    clearInvalidDownstreamPicks(entry, eventCode);
    saveState();
    render();
  }

  function chooseResult(eventCode, round, index, playerId) {
    if (!isAdminMode) return;
    const id = matchId(eventCode, round, index);
    state.results[eventCode][id] = playerId;
    clearInvalidResults(eventCode);
    saveState();
    render();
  }

  function normalizeName(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function lastNameKey(value) {
    const normalized = normalizeName(value);
    const pieces = normalized.split(" ").filter(Boolean);
    if (!pieces.length) return normalized;
    const last = pieces.at(-1);
    const previous = pieces.at(-2);
    if (previous && ["de", "del", "van", "von"].includes(previous)) return `${previous} ${last}`;
    return last;
  }

  function samePlayerName(localName, sourceName) {
    const local = normalizeName(localName);
    const source = normalizeName(sourceName);
    if (!local || !source) return false;
    if (local === source) return true;
    return lastNameKey(local) === lastNameKey(source);
  }

  function matchSourcePlayers(localPlayers, sourcePlayers) {
    return localPlayers.every((localPlayer) => (
      localPlayer && sourcePlayers.some((sourcePlayer) => samePlayerName(localPlayer.name, sourcePlayer.name))
    ));
  }

  function applySourceResults(payload) {
    let applied = 0;

    for (const sourceMatch of payload.matches || []) {
      const eventCode = sourceMatch.eventCode;
      const round = sourceMatch.round;
      const count = 128 / 2 ** round;
      if (!state.draws[eventCode] || !round || !sourceMatch.completed || !sourceMatch.winnerName) continue;

      for (let index = 0; index < count; index += 1) {
        const id = matchId(eventCode, round, index);
        if (state.results[eventCode][id]) continue;

        const a = participantFromResult(eventCode, round, index, 0);
        const b = participantFromResult(eventCode, round, index, 1);
        if (!a || !b) continue;
        if (!matchSourcePlayers([a, b], sourceMatch.players || [])) continue;

        const winner = [a, b].find((player) => samePlayerName(player.name, sourceMatch.winnerName));
        if (winner) {
          state.results[eventCode][id] = winner.id;
          applied += 1;
        }
      }
    }

    if (applied) {
      clearInvalidResults("MS");
      clearInvalidResults("WS");
      saveState();
      render();
    }

    return applied;
  }

  function applySourceDraw(payload) {
    let imported = 0;

    ["MS", "WS"].forEach((eventCode) => {
      const currentDraw = state.draws[eventCode];
      if (currentDraw?.source === "espn") return;

      const roundOneMatches = (payload.matches || [])
        .filter((match) => match.eventCode === eventCode && match.round === 1 && match.players?.length >= 2)
        .sort((a, b) => String(a.sourceMatchId).localeCompare(String(b.sourceMatchId)));

      if (roundOneMatches.length < 64) return;

      const players = roundOneMatches.slice(0, 64).flatMap((match) => match.players.slice(0, 2)).map((player, slotIndex) => ({
        id: `${eventCode}-P${String(slotIndex + 1).padStart(3, "0")}`,
        name: player.name || `Slot ${slotIndex + 1}`,
        seed: null,
        slotIndex
      }));

      state.draws[eventCode] = {
        eventCode,
        name: eventCode === "MS" ? "Men's Singles" : "Women's Singles",
        source: "espn",
        sourceUrl: "https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard",
        players
      };
      state.results[eventCode] = {};
      state.entries.forEach((entry) => {
        entry.picks[eventCode] = {};
      });
      if (draftEntry) draftEntry.picks[eventCode] = {};
      imported += 1;
    });

    return imported;
  }

  async function syncEspnResults(showStatus = true) {
    const status = $("syncStatus");
    if (!location.protocol.startsWith("http")) {
      status.textContent = "ESPN sync needs the app server. Run npm start, then open the localhost URL.";
      return;
    }

    try {
      if (showStatus) status.textContent = "Checking ESPN for completed Roland-Garros matches...";
      const response = await fetch(`/api/sync/espn?dates=${ESPN_SYNC_WINDOW}&tournament=Roland%20Garros`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "ESPN sync failed.");
      const imported = applySourceDraw(payload);
      const applied = applySourceResults(payload);
      if (imported || applied) saveState();
      status.textContent = `ESPN sync checked ${payload.matches.length} matches, imported ${imported} draw${imported === 1 ? "" : "s"}, and applied ${applied} result${applied === 1 ? "" : "s"}.`;
    } catch (error) {
      status.textContent = `ESPN sync failed: ${error.message}`;
    }
  }

  function clearInvalidResults(eventCode) {
    for (let round = 2; round <= TOTAL_ROUNDS; round += 1) {
      const count = 128 / 2 ** round;
      for (let index = 0; index < count; index += 1) {
        const id = matchId(eventCode, round, index);
        const winner = playerById(eventCode, state.results[eventCode][id]);
        const a = participantFromResult(eventCode, round, index, 0);
        const b = participantFromResult(eventCode, round, index, 1);
        if (winner && !isValidParticipant(winner, a, b)) {
          delete state.results[eventCode][id];
        }
      }
    }
  }

  function scoreEntry(entry) {
    let total = 0;
    let possible = 0;
    let correct = 0;

    ["MS", "WS"].forEach((eventCode) => {
      for (let round = 1; round <= TOTAL_ROUNDS; round += 1) {
        const count = 128 / 2 ** round;
        for (let index = 0; index < count; index += 1) {
          const id = matchId(eventCode, round, index);
          const pick = entry.picks[eventCode][id];
          if (!pick) continue;

          const actual = state.results[eventCode][id];
          const value = pointsForRound(round);
          if (actual) {
            if (actual === pick) {
              total += value;
              correct += 1;
            }
          } else {
            possible += value;
          }
        }
      }
    });

    return { total, possible: total + possible, correct };
  }

  function render() {
    renderAdminVisibility();
    renderEntryControls();
    renderTabs();
    renderBracket();
    renderResults();
    renderLeaderboard();
  }

  function renderAdminVisibility() {
    document.querySelectorAll(".admin-only").forEach((element) => {
      element.hidden = !isAdminMode;
    });

    if (!isAdminMode && ["results", "import"].includes(activeView)) {
      activeView = "bracket";
    }
  }

  function renderEntryControls() {
    const entry = getCurrentEntry() || draftEntry;
    const canEdit = !entry || !entry.submitted || canEditEntry(entry);
    $("entryName").value = entry?.name || "";
    $("entryName").disabled = state.locked || !canEdit;
    $("saveEntryButton").disabled = state.locked || !canEdit;
    $("saveEntryButton").textContent = entry?.submitted ? "Update Picks" : "Submit Picks";
    $("autoPickButton").disabled = state.locked || !canEdit;

    $("entrySelect").innerHTML = [
      `<option value="">New entry</option>`,
      ...state.entries.map((item) => `<option value="${item.id}" ${item.id === state.currentEntryId ? "selected" : ""}>${escapeHtml(item.name)}</option>`)
    ].join("");

    const currentScore = entry ? scoreEntry(entry) : { total: 0, possible: 0 };
    $("currentScore").textContent = currentScore.total;
    $("possibleScore").textContent = currentScore.possible;
    $("lockStatus").textContent = state.locked ? "Entries locked" : "Entries open";
    $("toggleLockButton").textContent = state.locked ? "Unlock" : "Lock";

    const submittedEntry = getCurrentEntry();
    const editPanel = $("editLinkPanel");
    const editLink = $("editLink");
    if (submittedEntry && canEditEntry(submittedEntry)) {
      editPanel.hidden = false;
      editLink.value = entryEditUrl(submittedEntry);
      $("flowMessage").textContent = state.locked
        ? "Your bracket is locked. You can still view scores and the group leaderboard."
        : "Your bracket is submitted. Save this private edit link if you want to update picks before lock.";
    } else {
      editPanel.hidden = true;
      $("flowMessage").textContent = state.locked
        ? "Entries are locked. View the live bracket and group leaderboard."
        : "Enter a bracket name, pick winners, then submit. Your private edit link appears after submission.";
    }

    document.querySelectorAll(".segmented button").forEach((button) => {
      button.classList.toggle("active", button.dataset.event === activeEvent);
    });
  }

  function renderTabs() {
    document.querySelectorAll(".tabs button").forEach((button) => {
      button.classList.toggle("active", button.dataset.view === activeView);
    });

    document.querySelectorAll(".view").forEach((view) => {
      view.classList.remove("active");
    });
    const targetView = $(`${activeView}View`);
    if (targetView) targetView.classList.add("active");
  }

  function renderBracket() {
    const entry = ensureEntry();
    $("bracketTitle").textContent = state.draws[activeEvent].name;
    $("bracketHint").textContent = state.locked
      ? "Entries are locked. Results will update the score and leaderboard."
      : "Pick winners from left to right. Later rounds unlock as your picks advance.";

    $("pickBracket").innerHTML = renderBracketColumns({
      mode: "pick",
      entry,
      eventCode: activeEvent,
      onClickName: "pickWinner",
      editable: !state.locked && (!entry.submitted || canEditEntry(entry))
    });
  }

  function renderResults() {
    $("resultsBracket").innerHTML = renderBracketColumns({
      mode: "result",
      eventCode: activeEvent,
      onClickName: "resultWinner"
    });
  }

  function renderBracketColumns(options) {
    const { mode, entry, eventCode, onClickName } = options;
    const columns = [];

    for (let round = 1; round <= TOTAL_ROUNDS; round += 1) {
      const count = 128 / 2 ** round;
      const matches = [];

      for (let index = 0; index < count; index += 1) {
        const id = matchId(eventCode, round, index);
        const a = mode === "pick"
          ? participantFromPick(entry, eventCode, round, index, 0)
          : participantFromResult(eventCode, round, index, 0);
        const b = mode === "pick"
          ? participantFromPick(entry, eventCode, round, index, 1)
          : participantFromResult(eventCode, round, index, 1);
        const selectedId = mode === "pick" ? entry.picks[eventCode][id] : state.results[eventCode][id];
        const actualId = state.results[eventCode][id];

        matches.push(`
          <article class="match">
            <div class="match-meta">
              <span>${ROUNDS[round - 1]}</span>
              <span>${pointsForRound(round)} pt${pointsForRound(round) === 1 ? "" : "s"}</span>
            </div>
            ${renderPlayerButton({ player: a, id, selectedId, actualId, onClickName, eventCode, round, index, mode, editable: options.editable })}
            ${renderPlayerButton({ player: b, id, selectedId, actualId, onClickName, eventCode, round, index, mode, editable: options.editable })}
          </article>
        `);
      }

      columns.push(`
        <div class="round">
          <div class="round-title">${ROUNDS[round - 1]}</div>
          ${matches.join("")}
        </div>
      `);
    }

    return `<div class="bracket">${columns.join("")}</div>`;
  }

  function renderPlayerButton(context) {
    const { player, selectedId, actualId, onClickName, eventCode, round, index, mode, editable } = context;
    const disabled = !player || (mode === "pick" && !editable);
    const selected = player && selectedId === player.id;
    const actual = player && actualId === player.id;
    const wrong = mode === "pick" && selected && actualId && actualId !== player.id;
    const className = ["player-button", selected ? "selected" : "", actual ? "actual" : "", wrong ? "wrong" : ""].filter(Boolean).join(" ");
    const seed = player?.seed ? player.seed : "";
    const label = player?.name || "Pick previous match";
    const status = actual ? "Actual" : selected ? "Pick" : "";
    const click = player ? `${onClickName}('${eventCode}', ${round}, ${index}, '${player.id}')` : "";

    return `
      <button class="${className}" type="button" ${disabled ? "disabled" : ""} onclick="${click}">
        <span class="seed">${seed}</span>
        <span class="player-name">${escapeHtml(label)}</span>
        ${status ? `<span class="status-pill">${status}</span>` : "<span></span>"}
      </button>
    `;
  }

  function renderLeaderboard() {
    const rows = state.entries
      .filter((entry) => entry.submitted)
      .map((entry) => ({ entry, score: scoreEntry(entry) }))
      .sort((a, b) => b.score.total - a.score.total || b.score.possible - a.score.possible || a.entry.name.localeCompare(b.entry.name));

    $("leaderboard").innerHTML = rows.length
      ? rows.map((row, index) => `
          <div class="leader-row">
            <span class="rank">${index + 1}</span>
            <span class="leader-name">${escapeHtml(row.entry.name)}</span>
            <span class="leader-stat"><strong>${row.score.total}</strong><span class="muted">score</span></span>
            <span class="leader-stat possible"><strong>${row.score.possible}</strong><span class="muted">possible</span></span>
          </div>
        `).join("")
      : `<p class="muted">No submitted entries yet. Submit your picks to start the group.</p>`;
  }

  function saveEntryFromForm() {
    const name = $("entryName").value.trim() || "My Bracket";
    let entry = getCurrentEntry();

    if (state.locked) return;

    if (entry && entry.submitted && !canEditEntry(entry)) return;

    if (!entry || (isAdminMode && $("entrySelect").value === "")) {
      entry = draftEntry || createEntry(name);
      entry.name = name;
      entry.submitted = true;
      entry.submittedAt = new Date().toISOString();
      state.entries.push(entry);
      state.currentEntryId = entry.id;
      draftEntry = null;
      rememberEntryAccess(entry);
    } else {
      entry.name = name;
      entry.submitted = true;
      entry.submittedAt = entry.submittedAt || new Date().toISOString();
      entry.updatedAt = new Date().toISOString();
      rememberEntryAccess(entry);
    }

    saveState();
    render();
  }

  function autoPickEntry() {
    const entry = ensureEntry();
    for (let round = 1; round <= TOTAL_ROUNDS; round += 1) {
      const count = 128 / 2 ** round;
      for (let index = 0; index < count; index += 1) {
        const a = participantFromPick(entry, activeEvent, round, index, 0);
        const b = participantFromPick(entry, activeEvent, round, index, 1);
        if (!a || !b) continue;
        const pick = favoredPlayer(a, b, round + index);
        entry.picks[activeEvent][matchId(activeEvent, round, index)] = pick.id;
      }
    }
    clearInvalidDownstreamPicks(entry, activeEvent);
    saveState();
    render();
  }

  function simulateNextRound() {
    if (!isAdminMode) return;
    for (let round = 1; round <= TOTAL_ROUNDS; round += 1) {
      const count = 128 / 2 ** round;
      const pending = [];
      for (let index = 0; index < count; index += 1) {
        const id = matchId(activeEvent, round, index);
        if (state.results[activeEvent][id]) continue;
        const a = participantFromResult(activeEvent, round, index, 0);
        const b = participantFromResult(activeEvent, round, index, 1);
        if (a && b) pending.push({ round, index, a, b });
      }

      if (pending.length) {
        pending.forEach((match, offset) => {
          const pick = favoredPlayer(match.a, match.b, match.round + offset);
          state.results[activeEvent][matchId(activeEvent, match.round, match.index)] = pick.id;
        });
        clearInvalidResults(activeEvent);
        saveState();
        render();
        return;
      }
    }
  }

  function favoredPlayer(a, b, salt) {
    const aSeed = a.seed || 200;
    const bSeed = b.seed || 200;
    if (aSeed !== bSeed) return aSeed < bSeed ? a : b;
    return salt % 3 === 0 ? b : a;
  }

  function importDraw() {
    if (!isAdminMode) return;
    const message = $("importMessage");
    try {
      const data = JSON.parse($("importText").value);
      const eventCode = data.eventCode;
      if (!["MS", "WS"].includes(eventCode)) throw new Error("eventCode must be MS or WS.");
      if (!Array.isArray(data.slots)) throw new Error("slots must be an array.");

      const players = data.slots
        .slice()
        .sort((a, b) => a.slotIndex - b.slotIndex)
        .map((slot, index) => ({
          id: `${eventCode}-P${String(index + 1).padStart(3, "0")}`,
          name: slot.playerName || slot.name || `Slot ${index + 1}`,
          seed: slot.seed || null,
          slotIndex: index
        }));

      if (players.length !== 128) throw new Error(`Expected 128 slots, received ${players.length}.`);

      state.draws[eventCode] = {
        eventCode,
        name: eventCode === "MS" ? "Men's Singles" : "Women's Singles",
        source: data.source || "manual",
        sourceUrl: data.sourceUrl || "manual-import",
        players
      };
      state.results[eventCode] = {};
      state.entries.forEach((entry) => {
        entry.picks[eventCode] = {};
      });
      activeEvent = eventCode;
      saveState();
      message.textContent = `Imported ${players.length} ${state.draws[eventCode].name} slots. Existing picks/results for this draw were cleared.`;
      render();
    } catch (error) {
      message.textContent = `Import failed: ${error.message}`;
    }
  }

  function loadSampleImportJson() {
    const draw = state.draws[activeEvent];
    $("importText").value = JSON.stringify({
      eventCode: activeEvent,
      source: "manual",
      sourceUrl: "paste-or-parser-output",
      slots: draw.players.map((player) => ({
        slotIndex: player.slotIndex,
        playerName: player.name,
        seed: player.seed || undefined
      }))
    }, null, 2);
    $("importMessage").textContent = "Sample normalized draw JSON loaded.";
  }

  function exportState() {
    if (!isAdminMode) return;
    $("importText").value = JSON.stringify(state, null, 2);
    activeView = "import";
    $("importMessage").textContent = "Full local app state exported below.";
    render();
  }

  function resetState() {
    if (!isAdminMode) return;
    const confirmed = window.confirm("Reset all local entries, picks, results, and imported draws?");
    if (!confirmed) return;
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  }

  async function copyEditLink() {
    const link = $("editLink").value;
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      $("copyEditLinkButton").textContent = "Copied";
      window.setTimeout(() => {
        $("copyEditLinkButton").textContent = "Copy";
      }, 1600);
    } catch (error) {
      $("editLink").select();
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function bindEvents() {
    $("saveEntryButton").addEventListener("click", saveEntryFromForm);
    $("entryName").addEventListener("keydown", (event) => {
      if (event.key === "Enter") saveEntryFromForm();
    });
    $("entrySelect").addEventListener("change", (event) => {
      state.currentEntryId = event.target.value || null;
      saveState();
      render();
    });
    $("toggleLockButton").addEventListener("click", () => {
      if (!isAdminMode) return;
      state.locked = !state.locked;
      saveState();
      render();
    });
    $("autoPickButton").addEventListener("click", autoPickEntry);
    $("simulateRoundButton").addEventListener("click", () => {
      if (isAdminMode) simulateNextRound();
    });
    $("syncEspnButton").addEventListener("click", () => syncEspnResults(true));
    $("importDrawButton").addEventListener("click", () => {
      if (isAdminMode) importDraw();
    });
    $("loadSampleButton").addEventListener("click", () => {
      if (isAdminMode) loadSampleImportJson();
    });
    $("exportStateButton").addEventListener("click", () => {
      if (isAdminMode) exportState();
    });
    $("resetButton").addEventListener("click", resetState);
    $("copyEditLinkButton").addEventListener("click", copyEditLink);

    document.querySelectorAll(".segmented button").forEach((button) => {
      button.addEventListener("click", () => {
        activeEvent = button.dataset.event;
        render();
      });
    });

    document.querySelectorAll(".tabs button").forEach((button) => {
      button.addEventListener("click", () => {
        activeView = button.dataset.view;
        render();
      });
    });
  }

  window.pickWinner = choosePick;
  window.resultWinner = chooseResult;

  bindEvents();
  initializeEntryFromUrl();
  render();
  hydrateFromServer();
  window.setInterval(() => syncEspnResults(false), 5 * 60 * 1000);
})();
