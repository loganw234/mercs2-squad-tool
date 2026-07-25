/* 00_bridge.js -- thin per-app adapter over the vendored EssBridge client (lib/bridge-client.js).
 *
 * This is the "recommended consumption shape" documented in mercs2-tools-shared/README.md: own the one
 * EssBridge instance in exactly one place, re-broadcast its events through a small callback surface, and
 * let the rest of the app (10_app.js) only ever touch App.bridge -- never `new EssBridge(...)` anywhere
 * else. Swap this file's contents for a real pub-sub bus in a bigger app; for a tool this size, a plain
 * object with callback setters is all the indirection that's actually earned.
 */
window.App = window.App || {};
(function () {
  "use strict";
  var B = null;
  var state = "closed";
  var onStatus = function () {};
  var onLog = function () {};
  var onData = function () {};

  App.bridge = {
    state: function () { return state; },
    connected: function () { return state === "open"; },

    onStatus: function (fn) { onStatus = fn; },
    onLog: function (fn) { onLog = fn; },
    onData: function (fn) { onData = fn; },

    connect: function (url) {
      if (B) { try { B.close(); } catch (e) {} B = null; }
      if (typeof EssBridge === "undefined") {
        state = "error";
        onStatus(state);
        return;
      }
      B = new EssBridge(url || "ws://127.0.0.1:27050", {
        maxReconnectDelay: 4000,   // snappier than the 15s default -- this tool's own UI has no long-wait affordance
        onStatus: function (s) { state = s; onStatus(s); },
        onLog: function (l) { onLog(l); },
        onData: function (l) { onData(l); }
      });
      B.connect().catch(function () {});
    },

    disconnect: function () {
      if (B) { B.close(); B = null; }
      state = "closed";
      onStatus(state);
    },

    /* run(code, opts) -> Promise<{ ok, value, acked, timedOut, error? }> -- see lib/bridge-client.js for
       the full shape. Always resolves, never rejects, so callers never need a .catch(). */
    run: function (code, opts) {
      if (!B || state !== "open") return Promise.resolve({ ok: false, acked: false, error: "not connected" });
      return B.run(code, opts);
    }
  };
})();
