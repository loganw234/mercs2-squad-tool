/* 60_tactics_formation.js -- Ess.Squad.Tactics (mountUp/dismountAndSecure) and Ess.Squad's formation engine
 * (setFormation/clearFormation). Both share the "Use last map click" pattern from 40_orders.js for
 * position fields, and both target a team (never the whole roster directly -- mountUp/dismountAndSecure/
 * setFormation all take a targetGroup, which Ess.Squad._resolveGuids already accepts as EITHER a team name
 * or a raw guid list, so "(whole roster)" here just passes Ess.Followers.list() through).
 */
(function () {
  "use strict";
  var SM = window.SquadMap;

  var tacticsTeamSelect = document.getElementById("tacticsTeamSelect");
  App.registerTeamSelect(tacticsTeamSelect);

  function targetExpr(select) {
    var team = select.value;
    return team ? App.luaStringLiteral(team) : "Ess.Followers.list()";
  }

  // ---- Mount Up -----------------------------------------------------------------------------------------
  document.getElementById("btnMountUp").addEventListener("click", function () {
    var vehExpr = document.getElementById("mountUpVehicleExpr").value.trim();
    if (!vehExpr) { App.log("Mount Up: vehicle expression is required (e.g. a guid variable, or Ess.Object.spawnAhead(...))", "err"); return; }
    var code = "Ess.Squad.Tactics.mountUp(" + vehExpr + ", " + targetExpr(tacticsTeamSelect) + ")";
    App.runAndLog(code, "mountUp(" + vehExpr + ")");
  });

  // ---- Dismount And Secure --------------------------------------------------------------------------------
  document.getElementById("btnDismountUseMapClick").addEventListener("click", function () {
    if (!SM.lastPick) { App.log("No map click yet -- click a point on the live map first", "err"); return; }
    document.getElementById("dismountAtX").value = SM.lastPick.x.toFixed(1);
    document.getElementById("dismountAtY").value = SM.lastPick.y.toFixed(1);
    document.getElementById("dismountAtZ").value = SM.lastPick.z.toFixed(1);
  });
  document.getElementById("btnDismountAndSecure").addEventListener("click", function () {
    var x = parseFloat(document.getElementById("dismountAtX").value) || 0;
    var y = parseFloat(document.getElementById("dismountAtY").value) || 0;
    var z = parseFloat(document.getElementById("dismountAtZ").value) || 0;
    var radius = parseFloat(document.getElementById("dismountRadius").value) || 15;
    var code = "Ess.Squad.Tactics.dismountAndSecure(" + targetExpr(tacticsTeamSelect) + ", {" + x + "," + y + "," + z + "}, " + radius + ")";
    App.runAndLog(code, "dismountAndSecure(radius=" + radius + ")");
  });

  // ---- Formation ------------------------------------------------------------------------------------------
  var formationTeamSelect = document.getElementById("formationTeamSelect");
  App.registerTeamSelect(formationTeamSelect);

  document.getElementById("btnSetFormation").addEventListener("click", function () {
    var type = document.getElementById("formationType").value;
    var spacing = parseFloat(document.getElementById("formationSpacing").value) || 3;
    var code = "Ess.Squad.setFormation(" + targetExpr(formationTeamSelect) + ", " + App.luaStringLiteral(type) + ", {spacing=" + spacing + "})";
    App.runAndLog(code, "setFormation(" + type + ", spacing=" + spacing + ")");
  });
  document.getElementById("btnClearFormation").addEventListener("click", function () {
    App.runAndLog("Ess.Squad.clearFormation(" + targetExpr(formationTeamSelect) + ")", "clearFormation()");
  });
})();
