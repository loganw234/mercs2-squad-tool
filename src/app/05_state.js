/* 05_state.js -- shared app-level plumbing every panel below uses: the log viewer, a runAndLog() helper
 * (same shape as the webtool-template's own), a push-data FAN-OUT (App.bridge.onData only has ONE callback
 * slot -- see 00_bridge.js -- but this tool has THREE independent consumers of the hidden WS channel: the
 * live position/anchor stream, squad lifecycle events, and the raw REPL's own un-tagged output), and the
 * %q-unquote helper every delimited-string poll/stream needs (the bridge's serializer %q-quotes ANY string
 * return, structured or not -- see mercs2-webtool-template's 10_app.js for the same gotcha).
 *
 * Also owns the one shared "team options" refresh -- Teams/Orders/Queue/Tactics/Formation all need an
 * up-to-date `<select>` of current team names (Ess.Squad.teams()), so it lives here once instead of once
 * per panel.
 */
window.App = window.App || {};
(function () {
  "use strict";

  // ---- log viewer -----------------------------------------------------------------------------------
  var logEl = document.getElementById("log");
  App.log = function (text, cls) {
    var line = document.createElement("div");
    line.className = "line" + (cls ? " " + cls : "");
    line.textContent = text;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  };

  // ---- run a chunk, log the outcome ------------------------------------------------------------------
  App.runAndLog = function (code, label) {
    if (!App.bridge.connected()) { App.log("(" + (label || code) + ") not connected -- hit Connect first", "err"); return; }
    App.log("> " + (label || code), "repl");
    App.bridge.run(code).then(function (r) {
      if (r.timedOut) { App.log("  (sent -- no result line within the timeout, but it very likely ran)"); return; }
      if (!r.ok) { App.log("  ERROR: " + (r.error || r.value), "err"); return; }
      if (r.value != null && r.value !== "") App.log("  -> " + App.unquoteLuaString(r.value));
    });
  };

  // ---- Lua string literals from arbitrary user text (never string-concat raw input into a chunk) -----
  App.luaStringLiteral = function (s) {
    return "'" + String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n") + "'";
  };

  // ---- %q-decode: the bridge's serializer %q-quotes EVERY string return (see mercs2-webtool-template's
  // 10_app.js unquoteLuaString for the identical gotcha) -- one decode pass is enough for any payload built
  // from tostring()'d userdata/numbers and plain identifiers, none of which can contain a quote/backslash/
  // newline themselves.
  App.unquoteLuaString = function (s) {
    s = String(s);
    if (s.charAt(0) !== '"') return s;
    var n = s.length, i = 1, buf = "";
    while (i < n && s[i] !== '"') {
      if (s[i] === "\\") {
        var c = s[i + 1];
        if (c === '"' || c === "\\") { buf += c; i += 2; }
        else if (c === "\n") { buf += "\n"; i += 2; }
        else if (/[0-9]/.test(c)) {
          var m = s.slice(i + 1).match(/^[0-9]{1,3}/)[0];
          buf += String.fromCharCode(parseInt(m, 10));
          i += 1 + m.length;
        } else { buf += c; i += 2; }
      } else { buf += s[i]; i++; }
    }
    return buf;
  };

  // ---- push-data fan-out: App.bridge.onData(fn) only keeps the LAST registration (see 00_bridge.js) --
  // App.onPush(fn) registers an ADDITIONAL listener instead, all of which get every hidden-channel line.
  // Wired to App.bridge.onData exactly once, here.
  var pushListeners = [];
  App.onPush = function (fn) { pushListeners.push(fn); };
  App.bridge.onData(function (line) {
    for (var i = 0; i < pushListeners.length; i++) {
      try { pushListeners[i](line); } catch (e) { /* one bad listener shouldn't break the others */ }
    }
  });

  // ---- status fan-out: App.bridge.onStatus(fn) is ALSO a single-callback slot (00_bridge.js), but this
  // tool has multiple independent consumers of a status change (the connect-bar UI in 90_repl.js, the
  // live-stream setup + team refresh in 15_live.js) -- App.onStatusChange(fn) registers an ADDITIONAL
  // listener instead, same shape as App.onPush above.
  var statusListeners = [];
  App.onStatusChange = function (fn) { statusListeners.push(fn); };
  App.bridge.onStatus(function (s) {
    for (var i = 0; i < statusListeners.length; i++) {
      try { statusListeners[i](s); } catch (e) { /* one bad listener shouldn't break the others */ }
    }
  });

  // App.guidTableExprFromShortIds(ids) -> Lua expression string evaluating to {guid, guid, ...}.
  // A uGuid userdata has no literal syntax, so the only way to name "this specific follower" in a freshly
  // generated Lua chunk is to re-walk Ess.Followers.list() and match each guid's own tostring() tail
  // against the short id the roster table displayed (see 20_roster.js's App.selectedShortIds()) -- shared
  // here since both dismiss-selected and Teams' createTeam need exactly this resolution.
  App.guidTableExprFromShortIds = function (ids) {
    if (!ids.length) return "{}";
    var conds = ids.map(function (id) { return "s == " + App.luaStringLiteral(id); }).join(" or ");
    return "(function() local t = {} for _, g in ipairs(Ess.Followers.list()) do local s = tostring(g):sub(-8) " +
      "if (" + conds + ") then table.insert(t, g) end end return t end)()";
  };

  // ---- team options -- every panel that targets "a team" (not the whole roster) shares this list ------
  var teamSelects = [];   // <select> elements to keep in sync
  App.registerTeamSelect = function (sel) { teamSelects.push(sel); };
  App.refreshTeams = function () {
    if (!App.bridge.connected()) return;
    App.bridge.run("return table.concat(Ess.Squad.teams(), ',')").then(function (r) {
      if (!r.ok) return;
      var raw = App.unquoteLuaString(r.value || "");
      var names = raw ? raw.split(",") : [];
      teamSelects.forEach(function (sel) {
        var prev = sel.value;
        sel.innerHTML = "";
        var allOpt = document.createElement("option");
        allOpt.value = ""; allOpt.textContent = "(whole roster)";
        sel.appendChild(allOpt);
        names.forEach(function (n) {
          var opt = document.createElement("option");
          opt.value = n; opt.textContent = n;
          sel.appendChild(opt);
        });
        if (names.indexOf(prev) !== -1 || prev === "") sel.value = prev;
      });
    });
  };
})();
