# mercs2-squad-tool

A browser-based control panel + live debugger for [`Ess.Followers`/`Ess.Squad`](https://github.com/loganw234/mercs2-lua-essentials)
(Mercenaries 2 modding) -- recruit, team up, order, queue, and formation-march your AI followers from a
webpage, no Lua required, plus a live map so you can actually WATCH what's happening (a follower's dot
chasing its own waypoint ring is a much faster way to debug a stuck formation than staring at a log).

Forked from [`mercs2-webtool-template`](../mercs2-webtool-template) (the connect-bar/bridge/REPL scaffolding)
with the live-map engine ported in from [`mercs2-webmap`](../mercs2-webmap) (world<->map coordinate
transform, the push-not-poll live-position pattern).

## Try it

1. Get the game + lua-bridge running -- [mercs2.tools/#s-start](https://mercs2.tools/#s-start) if you
   haven't already -- with `Ess` (`mercs2-lua-essentials`, `Ess.Squad` or newer) loaded.
2. `python build.py`
3. Open `dist/index.html` (double-click it, or host it) and hit **Connect**.

## What's here

```
src/
  index.html          page shell -- Live Map + Roster/Teams/Orders/Queue/Tactics/Formation/REPL cards
  styles.css          this tool's own accent (cyan) + map/table/queue-step styling
  lib/
    tokens.css          vendored from mercs2-tools-shared -- the shared neutral palette
    bridge-client.js     vendored from mercs2-tools-shared -- the lua-bridge WebSocket client
    leaflet.js/.css       vendored from mercs2-webmap -- the map engine (circleMarkers only, no images needed)
  data/
    map-image.js          vendored from mercs2-webmap -- the embedded top-down map backdrop
  app/
    00_bridge.js         thin adapter: owns the one EssBridge instance (unchanged from the template)
    05_state.js          log viewer, runAndLog(), %q-unquote, and the onPush/onStatusChange FAN-OUTS every
                          panel below needs (App.bridge's own onData/onStatus are single-callback slots)
    10_map.js             Leaflet CRS.Simple init + world<->latLng transform + map-click "pick a point"
    15_live.js             the live position/anchor PUSH stream (Ess.Loop + Loader.WsSend) + Ess.Squad's
                            event bus, both hidden-channel, both compile-once not per-tick
    20_roster.js            the roster/debugger panel -- polls Ess.Followers.list() once a second
    30_teams.js              Ess.Squad.createTeam/assignRole/teams()
    40_orders.js              the order builder (any Ess.AIOrders behavior, whole roster or one team)
    50_queue.js                Ess.Squad.queue step-sequence builder
    60_tactics_formation.js    Ess.Squad.Tactics.mountUp/dismountAndSecure + setFormation/clearFormation
    90_repl.js                connect bar + raw-Lua REPL escape hatch (loads last -- see its own header)
build.py              inlines all of the above into one dist/index.html -- no external requests, no server
```

## Why this is built this way

**Everything gets inlined at build time, nothing loaded at runtime from another origin** -- same reasoning
as every tool in this ecosystem: the output needs to also run as a single, offline, double-clickable HTML
file, and some browsers won't open a WebSocket at all from a page loaded off a remote origin.

**The live map is a debugger, not just a pretty picture.** `Ess.Followers._followLoopAnchorOf(guid)` /
`Ess.Squad._formationAnchorOf(guid)` (small debug accessors added to `mercs2-lua-essentials` for this tool)
expose each follower's CURRENT waypoint anchor -- the position stream sends both a follower's own position
and its anchor's, so the map can draw a solid dot for the unit and a dashed ring for where it's actually
trying to go. When those two stop converging, that's a real bug to go look at, visible at a glance instead
of inferred from a log.

**A `uGuid` has no JS-side literal.** The roster table's checkboxes (used by Create Team / Assign Role /
Dismiss Selected) can't hand a real userdata back to a freshly generated Lua chunk -- there's no syntax for
"this specific object" outside Lua that's already holding the value. Selection instead ships the LAST 8
characters of each guid's own `tostring()` (already unique enough within one session) and the generated
chunk re-walks `Ess.Followers.list()` to match them back up (`App.guidTableExprFromShortIds`, `05_state.js`).

**Push, not poll, for anything moving every tick.** The live position/anchor stream and the Ess.Squad event
bus both start ONE persistent `Ess.Loop`/event hook and let the game push lines over the hidden WS channel
(`Loader.WsSend`) -- the same pattern `mercs2-webmap`'s own live-player overlay uses and for the same reason:
re-sending a `bridge.run()` chunk every tick means the game recompiles it every tick, which is the actual
cost: compile once, then just listen.

## License

[MIT](LICENSE) -- matching the rest of the Mercenaries 2 tooling.
