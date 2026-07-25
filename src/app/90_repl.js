/* 90_repl.js -- the connect bar, the raw-Lua REPL escape hatch, and the initial log message. Loads last
 * (see build.py's sorted app/*.js order) since it's the one file that actually WIRES UP App.bridge.onLog
 * and kicks off the connection -- everything else (05_state.js's fan-outs, 15_live.js's stream setup)
 * needs to already be listening before Connect is ever clicked.
 */
(function () {
  "use strict";

  // ---- REPL --------------------------------------------------------------------------------------------
  var replInput = document.getElementById("replInput");
  document.getElementById("btnRun").addEventListener("click", runRepl);
  replInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runRepl(); }
  });
  function runRepl() {
    var code = replInput.value.trim();
    if (code) App.runAndLog(code, "repl");
  }

  // ---- connect bar ---------------------------------------------------------------------------------------
  var dot = document.getElementById("dot");
  var statusText = document.getElementById("statusText");
  var btnConnect = document.getElementById("btnConnect");
  var connected = false;

  App.onStatusChange(function (s) {
    dot.className = "dot " + s;
    statusText.textContent = s === "open" ? "connected" : s;
    connected = (s === "open");
    btnConnect.textContent = connected ? "Disconnect" : "Connect";
  });
  App.bridge.onLog(function (line) { App.log(line); });

  btnConnect.addEventListener("click", function () {
    if (connected) { App.bridge.disconnect(); return; }
    App.log("connecting to ws://127.0.0.1:27050 ...");
    App.bridge.connect();
  });

  App.log("Followers/Squad Tool loaded. Hit Connect once lua-bridge is up (see mercs2.tools/#s-start if you haven't set that up yet).");
})();
