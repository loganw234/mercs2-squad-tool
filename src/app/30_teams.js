/* 30_teams.js -- Ess.Squad team/role management: create a team from the roster table's checked rows,
 * assign a free-form role to a selected follower, and a live list of currently-defined teams (populated
 * from Ess.Squad.teams(), the debugger-facing enumeration -- reflects teams created by ANY script or REPL
 * session, not just this page).
 */
(function () {
  "use strict";

  document.getElementById("btnCreateTeam").addEventListener("click", function () {
    var name = document.getElementById("newTeamName").value.trim();
    if (!name) { App.log("Create team: name is required", "err"); return; }
    var ids = App.selectedShortIds();
    if (!ids.length) { App.log("Create team: check at least one roster row first", "err"); return; }
    var code = "Ess.Squad.createTeam(" + App.luaStringLiteral(name) + ", " + App.guidTableExprFromShortIds(ids) + ")";
    App.runAndLog(code, "createTeam(" + name + ", " + ids.length + " guids)");
    setTimeout(App.refreshTeams, 300);
    setTimeout(refreshTeamList, 300);
  });

  document.getElementById("btnAssignRole").addEventListener("click", function () {
    var ids = App.selectedShortIds();
    var role = document.getElementById("roleInput").value.trim();
    if (!ids.length) { App.log("Assign role: check at least one roster row first", "err"); return; }
    if (!role) { App.log("Assign role: role name is required", "err"); return; }
    var code = "for _, g in ipairs(" + App.guidTableExprFromShortIds(ids) + ") do Ess.Squad.assignRole(g, " + App.luaStringLiteral(role) + ") end";
    App.runAndLog(code, "assignRole(" + ids.length + " guids, " + role + ")");
  });

  // ---- team list (debugger view: reflects Ess.Squad.teams(), not what this page happens to remember) ----
  var teamListEl = document.getElementById("teamList");
  var TEAM_LIST_CODE =
    "return (function()\n" +
    "  local o = {}\n" +
    "  for _, name in ipairs(Ess.Squad.teams()) do\n" +
    "    table.insert(o, name..'|'..#Ess.Squad.team(name))\n" +
    "  end\n" +
    "  return table.concat(o, ';')\n" +
    "end)()";

  function refreshTeamList() {
    if (!App.bridge.connected()) return;
    App.bridge.run(TEAM_LIST_CODE).then(function (r) {
      if (!r.ok) return;
      var raw = App.unquoteLuaString(r.value || "");
      var rows = raw ? raw.split(";").filter(Boolean) : [];
      teamListEl.innerHTML = "";
      if (!rows.length) {
        teamListEl.innerHTML = '<span class="hint">no teams defined yet</span>';
        return;
      }
      rows.forEach(function (row) {
        var f = row.split("|");
        var span = document.createElement("span");
        span.className = "pill";
        span.textContent = f[0] + " (" + f[1] + ")";
        teamListEl.appendChild(span);
      });
    });
  }
  App.refreshTeamList = refreshTeamList;

  var teamListTimer = null;
  document.getElementById("btnTeamListMonitor").addEventListener("click", function (e) {
    var btn = e.target;
    if (teamListTimer) {
      clearInterval(teamListTimer); teamListTimer = null;
      btn.textContent = "Start monitoring"; btn.classList.remove("on");
      return;
    }
    if (!App.bridge.connected()) { App.log("Teams: not connected -- hit Connect first", "err"); return; }
    btn.textContent = "Stop monitoring"; btn.classList.add("on");
    refreshTeamList();
    teamListTimer = setInterval(refreshTeamList, 1500);
  });
})();
