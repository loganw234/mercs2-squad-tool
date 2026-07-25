/* 40_orders.js -- the order builder: pick a target (a team, or the whole roster), a behavior (any of
 * Ess.AIOrders' 11), fill in whatever opts that behavior actually uses, and fire it via
 * Ess.Squad.orderTeam(name, behavior, opts) or Ess.Followers.order(behavior, opts) -- same call either way,
 * this panel just decides which one based on the team selector.
 *
 * "Use last map click" fills the at-fields from SquadMap.lastPick (10_map.js) -- click the live map, then
 * hit that button, instead of hand-typing coordinates.
 */
(function () {
  "use strict";
  var SM = window.SquadMap;

  var teamSelect = document.getElementById("orderTeamSelect");
  App.registerTeamSelect(teamSelect);

  var behaviorSelect = document.getElementById("orderBehavior");
  var FIELD_GROUPS = {
    move: ["at"], patrol: ["points"], defend: ["at", "radius"], attack: ["target"],
    hold: [], face: ["at"], follow: ["target"], flee: [], enter: ["target", "role"],
    deploy: [], animate: ["action"],
  };
  var allGroupEls = {
    at: document.getElementById("orderGroupAt"),
    radius: document.getElementById("orderGroupRadius"),
    target: document.getElementById("orderGroupTarget"),
    role: document.getElementById("orderGroupRole"),
    points: document.getElementById("orderGroupPoints"),
    action: document.getElementById("orderGroupAction"),
  };

  function syncFieldVisibility() {
    var shown = FIELD_GROUPS[behaviorSelect.value] || [];
    Object.keys(allGroupEls).forEach(function (key) {
      allGroupEls[key].hidden = shown.indexOf(key) === -1;
    });
  }
  behaviorSelect.addEventListener("change", syncFieldVisibility);
  syncFieldVisibility();

  document.getElementById("btnOrderUseMapClick").addEventListener("click", function () {
    if (!SM.lastPick) { App.log("No map click yet -- click a point on the live map first", "err"); return; }
    document.getElementById("orderAtX").value = SM.lastPick.x.toFixed(1);
    document.getElementById("orderAtY").value = SM.lastPick.y.toFixed(1);
    document.getElementById("orderAtZ").value = SM.lastPick.z.toFixed(1);
  });

  function num(id) { var v = parseFloat(document.getElementById(id).value); return isFinite(v) ? v : 0; }

  function buildOptsLua() {
    var b = behaviorSelect.value;
    var fields = FIELD_GROUPS[b] || [];
    var parts = [];
    if (fields.indexOf("at") !== -1) {
      parts.push("at={" + num("orderAtX") + "," + num("orderAtY") + "," + num("orderAtZ") + "}");
    }
    if (fields.indexOf("radius") !== -1) {
      parts.push("radius=" + num("orderRadius"));
    }
    if (fields.indexOf("target") !== -1) {
      var expr = document.getElementById("orderTargetExpr").value.trim();
      if (expr) parts.push("target=" + expr);
    }
    if (fields.indexOf("role") !== -1) {
      parts.push("role=" + App.luaStringLiteral(document.getElementById("orderRole").value));
    }
    if (fields.indexOf("action") !== -1) {
      parts.push("action=" + App.luaStringLiteral(document.getElementById("orderAction").value || "Cower"));
    }
    if (fields.indexOf("points") !== -1) {
      var lines = document.getElementById("orderPoints").value.split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
      var pts = lines.map(function (l) {
        var xyz = l.split(",").map(function (n) { return parseFloat(n) || 0; });
        return "{" + xyz[0] + "," + (xyz[1] || 0) + "," + xyz[2] + "}";
      });
      parts.push("points={" + pts.join(",") + "}");
    }
    return "{" + parts.join(", ") + "}";
  }

  document.getElementById("btnIssueOrder").addEventListener("click", function () {
    var team = teamSelect.value;
    var behavior = behaviorSelect.value;
    var opts = buildOptsLua();
    var code = team
      ? "Ess.Squad.orderTeam(" + App.luaStringLiteral(team) + ", " + App.luaStringLiteral(behavior) + ", " + opts + ")"
      : "Ess.Followers.order(" + App.luaStringLiteral(behavior) + ", " + opts + ")";
    App.runAndLog(code, (team ? team : "whole roster") + " -> " + behavior);
  });
})();
