/* 15_live.js -- live position/anchor overlay (PUSH model, not polling -- same reasoning as mercs2-webmap's
 * 30_live.js: one setup chunk starts an in-game Ess.Loop that streams everything over the hidden WS channel
 * (Loader.WsSend), the page just listens via App.onPush -- no per-tick chunk recompile).
 *
 * Streams TWO things every 0.25s in one line:
 *   - the player's own position (row id "PLAYER", team "__player__")
 *   - every CURRENT Ess.Followers.list() guid's position AND -- this is the actual point of streaming this
 *     at all -- its current waypoint anchor, if it has one (a vehicle-escort/on-foot-resume loop's anchor
 *     via Ess.Followers._followLoopAnchorOf, or a formation slot's via Ess.Squad._formationAnchorOf). That
 *     lets you literally watch a unit's dot and its target ring converge (or not) -- e.g. to debug a
 *     formation slot that isn't settling, or an escort loop stuck retargeting the wrong point.
 *
 * Wire format (one line, tag <<SQPOS>>, semicolon-separated rows, comma-separated fields):
 *   id,team,x,y,z,ax,ay,az; ...   -- ax/ay/az blank when there's no current anchor for that guid.
 *
 * Also hooks Ess.Squad's event bus (onRecruit/onDismiss/onStepComplete/onQueueComplete/onVehicleMounted)
 * the SAME way, tag <<SQEVT>>, so Queue/Tactics progress (50_queue.js/60_tactics_formation.js) is driven by
 * the game's own event firing, not a guess about timing. Guarded by a global flag so reconnecting doesn't
 * stack duplicate listeners the way Ess.Loop.start's own id-replace already prevents for the position loop.
 */
(function () {
  "use strict";
  var SM = window.SquadMap;
  var POS_LOOP_ID = "webtool_squad_pos";
  var POS_TAG = "<<SQPOS>>";
  var EVT_TAG = "<<SQEVT>>";

  var POS_SETUP =
    "if not (Ess and Ess.Loop and Ess.Followers) then return 'no-ess' end\n" +
    "Ess.Loop.start('" + POS_LOOP_ID + "', 0.25, function()\n" +
    "  local parts = {}\n" +
    "  local px, py, pz = Ess.Player.pose(0)\n" +
    "  if px then table.insert(parts, 'PLAYER,__player__,'..string.format('%.1f,%.1f,%.1f,,,', px, py, pz)) end\n" +
    "  for _, g in ipairs(Ess.Followers.list()) do\n" +
    "    local x, y, z = Ess.Object.pos(g)\n" +
    "    if x then\n" +
    "      local team = Ess.Squad.teamOf(g) or ''\n" +
    "      local ax, ay, az = '', '', ''\n" +
    "      local anchor = Ess.Followers._followLoopAnchorOf(g) or Ess.Squad._formationAnchorOf(g)\n" +
    "      if anchor then\n" +
    "        local axx, ayy, azz = Ess.Object.pos(anchor)\n" +
    "        if axx then ax, ay, az = string.format('%.1f', axx), string.format('%.1f', ayy), string.format('%.1f', azz) end\n" +
    "      end\n" +
    "      table.insert(parts, tostring(g)..','..team..','..string.format('%.1f,%.1f,%.1f', x, y, z)..','..ax..','..ay..','..az)\n" +
    "    end\n" +
    "  end\n" +
    "  Loader.WsSend('" + POS_TAG + "'..table.concat(parts, ';'))\n" +
    "  return true\n" +
    "end)\n" +
    "return 'started'";
  var POS_STOP = "if Ess and Ess.Loop then Ess.Loop.stop('" + POS_LOOP_ID + "') end return 'stopped'";

  var EVT_SETUP =
    "if not _G.__webtoolSquadEvents then\n" +
    "  _G.__webtoolSquadEvents = true\n" +
    "  Ess.Squad.on('onRecruit', function(g) Loader.WsSend('" + EVT_TAG + "recruit,'..tostring(g)) end)\n" +
    "  Ess.Squad.on('onDismiss', function(g, killed) Loader.WsSend('" + EVT_TAG + "dismiss,'..tostring(g)..','..(killed and '1' or '0')) end)\n" +
    "  Ess.Squad.on('onStepComplete', function(guids, idx, behavior) Loader.WsSend('" + EVT_TAG + "step,'..tostring(idx)..','..tostring(behavior)) end)\n" +
    "  Ess.Squad.on('onQueueComplete', function(guids) Loader.WsSend('" + EVT_TAG + "queueDone') end)\n" +
    "  Ess.Squad.on('onVehicleMounted', function(veh, guids) Loader.WsSend('" + EVT_TAG + "mounted,'..tostring(#guids)) end)\n" +
    "end\n" +
    "return 'events-hooked'";

  // ---- deterministic per-team color -- same team name always gets the same hue, "" (no team) is neutral
  var TEAM_COLOR_CACHE = {};
  function teamColor(team) {
    if (!team) return "#8b93a3";
    if (TEAM_COLOR_CACHE[team]) return TEAM_COLOR_CACHE[team];
    var h = 0;
    for (var i = 0; i < team.length; i++) h = (h * 31 + team.charCodeAt(i)) >>> 0;
    var hue = h % 360;
    var c = "hsl(" + hue + ", 70%, 55%)";
    TEAM_COLOR_CACHE[team] = c;
    return c;
  }

  var unitMarkers = {};    // id -> circleMarker (solid dot)
  var anchorMarkers = {};  // id -> circleMarker (hollow ring, same color, "where it's headed")
  var playerMarker = null;
  var seenThisTick = {};

  function ensureUnit(id, color) {
    if (unitMarkers[id]) return unitMarkers[id];
    var m = L.circleMarker([0, 0], { radius: 6, color: "#000", weight: 1.5, fillColor: color, fillOpacity: 1 });
    unitMarkers[id] = m;
    return m;
  }
  function ensureAnchor(id, color) {
    if (anchorMarkers[id]) return anchorMarkers[id];
    var m = L.circleMarker([0, 0], { radius: 9, color: color, weight: 2, fillOpacity: 0, dashArray: "3,3" });
    anchorMarkers[id] = m;
    return m;
  }

  function renderRow(id, team, x, y, z, ax, ay, az) {
    if (id === "PLAYER") {
      SM.lastY = y;
      var ll = SM.worldToLatLng(x, z);
      if (!playerMarker) {
        playerMarker = L.circleMarker([0, 0], { radius: 5, color: "#0b3b1e", weight: 2, fillColor: "#41d18b", fillOpacity: 1 });
      }
      if (!SM.map.hasLayer(playerMarker)) playerMarker.addTo(SM.map);
      playerMarker.setLatLng(ll);
      return;
    }
    seenThisTick[id] = true;
    var color = teamColor(team);
    var ll2 = SM.worldToLatLng(x, z);
    var um = ensureUnit(id, color);
    if (!SM.map.hasLayer(um)) um.addTo(SM.map);
    um.setLatLng(ll2);
    um.setStyle({ fillColor: color });
    um.bindTooltip(team ? (team + " / " + id.slice(-6)) : id.slice(-6), { direction: "top", offset: [0, -8] });

    if (ax !== "" && ay !== "" && az !== "") {
      var all = SM.worldToLatLng(parseFloat(ax), parseFloat(az));
      var am = ensureAnchor(id, color);
      if (!SM.map.hasLayer(am)) am.addTo(SM.map);
      am.setLatLng(all);
    } else if (anchorMarkers[id] && SM.map.hasLayer(anchorMarkers[id])) {
      SM.map.removeLayer(anchorMarkers[id]);
    }
  }

  function sweepStale() {
    // a guid that's dropped out of Ess.Followers.list() (dismissed/died) this tick -- remove its markers
    // rather than leaving a stale dot frozen on the map.
    Object.keys(unitMarkers).forEach(function (id) {
      if (seenThisTick[id]) return;
      if (SM.map.hasLayer(unitMarkers[id])) SM.map.removeLayer(unitMarkers[id]);
      delete unitMarkers[id];
      if (anchorMarkers[id]) {
        if (SM.map.hasLayer(anchorMarkers[id])) SM.map.removeLayer(anchorMarkers[id]);
        delete anchorMarkers[id];
      }
    });
  }

  function onPosLine(line) {
    if (line.indexOf(POS_TAG) !== 0) return;
    var body = line.slice(POS_TAG.length);
    seenThisTick = {};
    if (body) {
      body.split(";").forEach(function (row) {
        var f = row.split(",");
        if (f.length < 8) return;
        renderRow(f[0], f[1], parseFloat(f[2]), parseFloat(f[3]), parseFloat(f[4]), f[5], f[6], f[7]);
      });
    }
    sweepStale();
  }

  function onEvtLine(line) {
    if (line.indexOf(EVT_TAG) !== 0) return;
    var body = line.slice(EVT_TAG.length);
    var f = body.split(",");
    var kind = f[0];
    if (kind === "recruit") App.log("[event] recruited " + f[1].slice(-6));
    else if (kind === "dismiss") App.log("[event] dismissed " + f[1].slice(-6) + (f[2] === "1" ? " (killed)" : ""));
    else if (kind === "step") { App.log("[queue] step " + f[1] + " (" + f[2] + ") complete"); if (App.onQueueEvent) App.onQueueEvent(kind, f); }
    else if (kind === "queueDone") { App.log("[queue] complete"); if (App.onQueueEvent) App.onQueueEvent(kind, f); }
    else if (kind === "mounted") App.log("[event] vehicle mounted (" + f[1] + " aboard)");
  }

  App.onPush(function (line) { onPosLine(line); onEvtLine(line); });

  // ---- (re)start the streams + refresh team options on every open, including a reconnect --------------
  App.onStatusChange(function (s) {
    if (s === "open") {
      App.bridge.run(POS_SETUP);
      App.bridge.run(EVT_SETUP);
      App.refreshTeams();
    }
  });
})();
