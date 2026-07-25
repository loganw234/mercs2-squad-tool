/* 20_roster.js -- the roster/debugger panel: polls whatever is CURRENTLY registered in the running game
 * (Ess.Followers.list() + Ess.Squad.teamOf/roleOf + vehicle occupancy) once a second, same polling shape as
 * mercs2-webtool-template's Loop Monitor. This is the tool's actual "debugger" surface -- nothing here is
 * remembered client-side; every row is re-derived from live game state on every poll, so it stays correct
 * even if teams/followers were created by a totally different script or REPL session.
 *
 * Also owns the roster table's row checkboxes, which 30_teams.js reads via App.selectedGuids() to build a
 * new team without hand-typing a guid list.
 */
(function () {
  "use strict";

  var ROSTER_POLL_CODE =
    "return (function()\n" +
    "  local plyr = Ess.Player.character(0)\n" +
    "  local o = {}\n" +
    "  for _, g in ipairs(Ess.Followers.list()) do\n" +
    "    local team = Ess.Squad.teamOf(g) or ''\n" +
    "    local role = Ess.Squad.roleOf(g) or ''\n" +
    "    local status = 'onfoot'\n" +
    "    local veh = Ess.Object.vehicleOf(g)\n" +
    "    if veh then\n" +
    "      local ok, drv = pcall(Vehicle.GetDriver, veh)\n" +
    "      status = (ok and drv == g) and 'driver' or 'passenger'\n" +
    "    end\n" +
    "    local alive = Object.IsAlive(g) and '1' or '0'\n" +
    "    table.insert(o, tostring(g)..'|'..team..'|'..role..'|'..status..'|'..alive)\n" +
    "  end\n" +
    "  return table.concat(o, ';')\n" +
    "end)()";

  var tbody = document.querySelector("#rosterTable tbody");
  var pollTimer = null;
  var btn = document.getElementById("btnRosterMonitor");
  var lastRows = [];   // [{id, team, role, status, alive}] -- last poll, for App.selectedGuids()

  function addCell(row, text, cls) {
    var td = document.createElement("td");
    td.textContent = text;
    if (cls) td.className = cls;
    row.appendChild(td);
  }

  function render(rows) {
    tbody.innerHTML = "";
    if (!rows.length) {
      var empty = document.createElement("tr");
      empty.className = "empty";
      var td = document.createElement("td");
      td.colSpan = 6;
      td.textContent = "no followers currently recruited";
      empty.appendChild(td);
      tbody.appendChild(empty);
      return;
    }
    rows.forEach(function (row) {
      var tr = document.createElement("tr");
      var tdc = document.createElement("td");
      var cb = document.createElement("input");
      cb.type = "checkbox"; cb.value = row.id; cb.className = "rosterPick";
      tdc.appendChild(cb);
      tr.appendChild(tdc);
      addCell(tr, row.id.slice(-8));
      addCell(tr, row.team || "--");
      addCell(tr, row.role || "--");
      addCell(tr, row.status);
      addCell(tr, row.alive === "1" ? "alive" : "dead", row.alive === "1" ? "" : "load-bad");
      tbody.appendChild(tr);
    });
  }

  function poll() {
    if (!App.bridge.connected()) return;
    App.bridge.run(ROSTER_POLL_CODE).then(function (r) {
      if (!r.ok) { App.log("Roster: " + (r.error || r.value), "err"); return; }
      var raw = App.unquoteLuaString(r.value || "");
      var rows = raw ? raw.split(";").filter(Boolean).map(function (row) {
        var f = row.split("|");
        return { id: f[0], team: f[1], role: f[2], status: f[3], alive: f[4] };
      }) : [];
      lastRows = rows;
      render(rows);
    });
  }

  btn.addEventListener("click", function () {
    if (pollTimer) {
      clearInterval(pollTimer); pollTimer = null;
      btn.textContent = "Start monitoring"; btn.classList.remove("on");
      return;
    }
    if (!App.bridge.connected()) { App.log("Roster: not connected -- hit Connect first", "err"); return; }
    btn.textContent = "Stop monitoring"; btn.classList.add("on");
    poll();
    pollTimer = setInterval(poll, 1000);
  });

  // App.selectedGuids() -> [uGuid-as-lua-expr, ...] -- every checked roster row, as raw Lua expressions
  // (Ess.Guid-free -- the roster poll already gave us a live userdata's tostring(), which is NOT re-usable
  // as a Lua literal (a userdata has no literal syntax), so selection instead builds a small lookup chunk:
  // "Ess.Probe.allByName(...)" doesn't apply here either. See 30_teams.js for how selection is actually
  // consumed -- it re-resolves guids by asking Ess.Followers.list() again inside the SAME Lua chunk it
  // sends, filtering to just the picked short-ids, since a uGuid can only ever be named INSIDE a Lua chunk
  // that's holding the real userdata value, never reconstructed from a JS string.
  App.selectedShortIds = function () {
    var out = [];
    document.querySelectorAll(".rosterPick:checked").forEach(function (cb) { out.push(cb.value.slice(-8)); });
    return out;
  };

  // ---- recruit / dismiss quick actions ------------------------------------------------------------------
  document.getElementById("btnRecruit").addEventListener("click", function () {
    var expr = document.getElementById("recruitGuidExpr").value.trim() || "Ess.Player.targetUnderReticle(0)";
    App.runAndLog("Ess.Followers.recruit(" + expr + ")", "recruit(" + expr + ")");
  });
  document.getElementById("btnDismissAll").addEventListener("click", function () {
    App.runAndLog("Ess.Followers.dismissAll()", "dismissAll()");
  });
  document.getElementById("btnDismissSelected").addEventListener("click", function () {
    var ids = App.selectedShortIds();
    if (!ids.length) { App.log("Dismiss selected: nothing checked in the roster table", "err"); return; }
    var code = "for _, g in ipairs(" + App.guidTableExprFromShortIds(ids) + ") do Ess.Followers.dismiss(g) end";
    App.runAndLog(code, "dismiss selected (" + ids.length + ")");
  });
})();
