/* 10_map.js -- Leaflet CRS.Simple init + the world<->map coordinate transform. Ported from mercs2-webmap's
 * 00_state.js + 10_map.js (combined into one file here since this tool doesn't need webmap's other
 * datasets/layers machinery) -- see that repo for the original. The map is a fixed game image, not the
 * Earth: CRS.Simple treats it as a plain plane, latLng is just (y, x) in "map units".
 *
 * Calibration is VERBATIM from mercs2-tools/missionforge.html (confirmed pixel-perfect) via mercs2-webmap --
 * do not retune these numbers without re-deriving them the same way that repo did.
 */
window.SquadMap = window.SquadMap || {};
(function () {
  "use strict";
  var SM = window.SquadMap;
  SM.MAP = { W: 8204, H: 8204, leftX: 4102, rightX: -4102, topZ: 4102, botZ: -4102, offX: -50, offZ: -50 };
  var M = SM.MAP;

  function worldToPixel(x, z) {
    var spanW = Math.abs(M.rightX - M.leftX) || 1, spanH = Math.abs(M.botZ - M.topZ) || 1;
    var px = (x - M.leftX) / (M.rightX - M.leftX) * spanW + (M.offX || 0);
    var py = (z - M.topZ) / (M.botZ - M.topZ) * spanH + (M.offZ || 0);
    return [px, py];
  }
  function worldToLatLng(x, z) { var p = worldToPixel(x, z); return L.latLng(M.H - p[1], p[0]); }
  function latLngToWorld(ll) {
    var spanW = Math.abs(M.rightX - M.leftX) || 1, spanH = Math.abs(M.botZ - M.topZ) || 1;
    var px = ll.lng, py = M.H - ll.lat;
    var x = (px - (M.offX || 0)) / spanW * (M.rightX - M.leftX) + M.leftX;
    var z = (py - (M.offZ || 0)) / spanH * (M.botZ - M.topZ) + M.topZ;
    return { x: x, z: z };
  }
  SM.worldToPixel = worldToPixel;
  SM.worldToLatLng = worldToLatLng;
  SM.latLngToWorld = latLngToWorld;

  // onMapClick(fn) -- fn(x,y,z) fires whenever the map is clicked, y defaulting to the player's own last
  // known height (SM.lastY, updated by 15_live.js) since a 2D map click has no Y of its own -- good enough
  // for "give me a ground-level point to order a team to," not pixel-perfect elevation.
  var clickListeners = [];
  SM.onMapClick = function (fn) { clickListeners.push(fn); };

  SM.initMap = function () {
    var map = L.map("squadMap", {
      crs: L.CRS.Simple,
      minZoom: -6, maxZoom: 3, zoomSnap: 0.25, wheelPxPerZoomLevel: 120,
      attributionControl: false, zoomControl: true,
      preferCanvas: true,   // one canvas for every marker -- cheap even with a dozen+ moving squad dots
    });
    SM.map = map;

    var bounds = [[0, 0], [M.H, M.W]];
    var img = window.MERCS_MAP_IMAGE;
    if (img) {
      if (!map.getPane("basemap")) map.createPane("basemap").style.zIndex = 250;
      L.imageOverlay(img, bounds, { pane: "basemap" }).addTo(map);
    } else {
      L.rectangle(bounds, { color: "#33362a", weight: 1, fill: false }).addTo(map);
    }
    map.fitBounds(bounds);
    map.setMaxBounds(L.latLngBounds(bounds).pad(0.35));

    var bar = document.getElementById("mapCoordBar");
    map.on("mousemove", function (e) {
      if (!bar) return;
      var w = latLngToWorld(e.latlng);
      bar.textContent = "world   x " + Math.round(w.x) + "    z " + Math.round(w.z);
    });
    map.on("mouseout", function () { if (bar) bar.textContent = ""; });

    var pickMarker = null;
    map.on("click", function (e) {
      var w = latLngToWorld(e.latlng);
      var y = SM.lastY != null ? SM.lastY : 0;
      SM.lastPick = { x: w.x, y: y, z: w.z };
      if (!pickMarker) {
        pickMarker = L.circleMarker(e.latlng, { radius: 8, color: "#fbbf24", weight: 2, fillOpacity: 0, dashArray: "2,3" }).addTo(map);
      } else {
        pickMarker.setLatLng(e.latlng);
      }
      clickListeners.forEach(function (fn) { fn(w.x, y, w.z); });
    });
    return map;
  };

  SM.initMap();   // the map is always shown (not gated behind Connect -- static, offline-usable like the
                   // rest of this ecosystem's map tools), so it initializes as soon as this file loads.
})();
