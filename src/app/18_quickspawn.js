/* 18_quickspawn.js -- "Quick Spawn": spawn a unit near the player and hand it straight into the roster, so
 * someone can play with Followers/Squad without already having a guid (a target reticle lock, a spawn from
 * another script, etc.) to type into the Roster panel's recruit box.
 *
 * Spawn AND recruit happen in ONE Lua chunk -- a uGuid never needs to leave Lua-land (there's no JS literal
 * for one, see 05_state.js's App.guidTableExprFromShortIds for the same constraint elsewhere), so this is
 * the simplest possible shape: spawn a local, act on it, done.
 *
 * FACTION TEMPLATES: "VZ Soldier" and "OC Heavy (Light MG)" are CONFIRMED LIVE this session (both spawn and
 * recruit successfully). Guerilla/Allied Nations/Chinese/Pirate/Civilian are corpus-sourced (decompiled
 * script + extracted template data, cross-confirmed against this repo's own MissionForge sample's
 * SQUAD_ROLES table) but NOT yet independently live-tested by this tool -- flagged in the dropdown label
 * rather than silently presented as equally confirmed. Relations are neutralized toward the player on EVERY
 * quick-spawn regardless of faction (not just the two known-hostile-by-default ones) so the feature stays
 * reliably usable for testing Followers/Squad no matter which faction is picked -- a faction with a
 * "dynamic" story-driven default relation could otherwise come in hostile unpredictably.
 */
(function () {
  "use strict";

  var FACTIONS = [
    { label: "VZ (Venezuela) -- confirmed live", template: "VZ Soldier" },
    { label: "OC (Oil Company) -- confirmed live", template: "OC Heavy (Light MG)" },
    { label: "Guerilla -- unverified", template: "Guerilla Soldier" },
    { label: "Allied Nations -- unverified", template: "Allied Soldier" },
    { label: "Chinese -- unverified", template: "Chinese Soldier" },
    { label: "Pirate -- unverified", template: "Pirate Thug" },
    { label: "Civilian -- unverified", template: "Civ Casual (male)" },
  ];

  var sel = document.getElementById("quickSpawnFaction");
  FACTIONS.forEach(function (f) {
    var opt = document.createElement("option");
    opt.value = f.template; opt.textContent = f.label;
    sel.appendChild(opt);
  });

  // spread multiple spawns out (golden-angle-ish stepping, same spirit as Ess.Followers' own marker-color
  // cycling) so clicking this several times in a row doesn't stack units on top of each other.
  var spawnCount = 0;

  function spawnAndRecruitCode(template, n) {
    return "(function()\n" +
      "  local px, py, pz, yaw = Ess.Player.pose(0)\n" +
      "  local plyr = Ess.Player.character(0)\n" +
      "  local ok = 0\n" +
      "  for i = 1, " + n + " do\n" +
      "    local ang = (yaw or 0) + ((" + spawnCount + " + i) * 137.508) % 360\n" +
      "    local dist = 8 + ((" + spawnCount + " + i) % 3) * 3\n" +
      "    local x, z = Ess.Math.pointAhead(px, pz, ang, dist)\n" +
      "    local u = Ess.Object.spawn(" + App.luaStringLiteral(template) + ", x, py, z)\n" +
      "    if u then\n" +
      "      Ess.Relations.setFeeling(u, plyr, 100)\n" +
      "      Ess.Relations.setFeeling(plyr, u, 100)\n" +
      "      if Ess.Followers.recruit(u) then ok = ok + 1 end\n" +
      "    end\n" +
      "  end\n" +
      "  return ok .. '/' .. " + n + " .. ' spawned+recruited'\n" +
      "end)()";
  }

  document.getElementById("btnQuickSpawn").addEventListener("click", function () {
    var template = sel.value;
    var n = Math.max(1, Math.min(8, parseInt(document.getElementById("quickSpawnCount").value, 10) || 1));
    var code = "return " + spawnAndRecruitCode(template, n);
    App.runAndLog(code, "quick-spawn " + n + "x " + template);
    spawnCount += n;
  });
})();
