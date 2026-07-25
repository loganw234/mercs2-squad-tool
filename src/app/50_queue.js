/* 50_queue.js -- Ess.Squad.queue step-sequence builder. Each row is a behavior + a raw Lua opts table (the
 * same shape Ess.AIOrders.command/Ess.Followers.order take) + a per-step timeout -- kept as free-text
 * rather than per-behavior dynamic fields (unlike 40_orders.js) since a queue step is already power-user
 * territory and reusing the Orders panel's own opts builder for N independent rows would be a lot of UI for
 * little payoff; a short placeholder per behavior shows the expected shape.
 *
 * Progress feedback comes from the ALREADY-running event stream in 15_live.js (Ess.Squad.on('onStepComplete'
 * /'onQueueComplete') pushed over the hidden WS channel) -- this file just renders whatever App.onQueueEvent
 * gets called with, it doesn't poll anything itself.
 */
(function () {
  "use strict";

  var OPTS_PLACEHOLDER = {
    move: "{at={0,0,0}}", patrol: "{points={{0,0,0},{10,0,10}}}", defend: "{at={0,0,0}, radius=12}",
    attack: "{target=Ess.Player.targetUnderReticle(0)}", hold: "{}", face: "{at={0,0,0}}",
    follow: "{}", flee: "{}", enter: "{target=someVehicleGuid, role='driver'}", deploy: "{}",
    animate: "{action='Cower'}",
  };

  var teamSelect = document.getElementById("queueTeamSelect");
  App.registerTeamSelect(teamSelect);
  var stepsEl = document.getElementById("queueSteps");
  var progressEl = document.getElementById("queueProgress");

  function addStepRow() {
    var row = document.createElement("div");
    row.className = "queueStep";

    var behavior = document.createElement("select");
    ["move", "patrol", "defend", "attack", "hold", "face", "follow", "flee", "enter", "deploy", "animate"].forEach(function (b) {
      var o = document.createElement("option"); o.value = b; o.textContent = b; behavior.appendChild(o);
    });

    var opts = document.createElement("input");
    opts.type = "text"; opts.className = "mono"; opts.value = OPTS_PLACEHOLDER.move;
    behavior.addEventListener("change", function () { opts.value = OPTS_PLACEHOLDER[behavior.value] || "{}"; });

    var timeout = document.createElement("input");
    timeout.type = "number"; timeout.value = 30; timeout.min = 1; timeout.title = "timeout (seconds)";
    timeout.style.width = "64px";

    var remove = document.createElement("button");
    remove.textContent = "×"; remove.title = "remove step";
    remove.addEventListener("click", function () { row.remove(); });

    row.appendChild(behavior); row.appendChild(opts); row.appendChild(timeout); row.appendChild(remove);
    stepsEl.appendChild(row);
  }
  document.getElementById("btnAddQueueStep").addEventListener("click", addStepRow);
  addStepRow();   // start with one row so the panel isn't empty

  function buildStepsLua() {
    var rows = stepsEl.querySelectorAll(".queueStep");
    var parts = [];
    rows.forEach(function (row) {
      var sels = row.querySelectorAll("select, input[type=text]");
      var behavior = sels[0].value, opts = sels[1].value || "{}";
      var timeout = row.querySelector("input[type=number]").value;
      parts.push("{behavior=" + App.luaStringLiteral(behavior) + ", opts=" + opts + ", timeout=" + (parseFloat(timeout) || 30) + "}");
    });
    return "{" + parts.join(", ") + "}";
  }

  document.getElementById("btnRunQueue").addEventListener("click", function () {
    var team = teamSelect.value;
    var target = team ? App.luaStringLiteral(team) : "Ess.Followers.list()";
    var code = "Ess.Squad.queue(" + target + ", " + buildStepsLua() + ")";
    App.runAndLog(code, "queue(" + (team || "whole roster") + ", " + stepsEl.children.length + " steps)");
    progressEl.textContent = "running…";
  });

  document.getElementById("btnCancelQueue").addEventListener("click", function () {
    var team = teamSelect.value;
    var target = team ? App.luaStringLiteral(team) : "Ess.Followers.list()";
    App.runAndLog("Ess.Squad.cancelQueue(" + target + ")", "cancelQueue(" + (team || "whole roster") + ")");
    progressEl.textContent = "cancelled";
  });

  App.onQueueEvent = function (kind, fields) {
    if (kind === "step") progressEl.textContent = "step " + fields[1] + " (" + fields[2] + ") complete";
    else if (kind === "queueDone") progressEl.textContent = "queue complete";
  };
})();
