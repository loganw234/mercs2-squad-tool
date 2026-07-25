#!/usr/bin/env python3
"""build.py -- merge src/ into ONE standalone dist/index.html.

Same shape as mercs2-webtool-template's build.py, extended with mercs2-webmap's Leaflet + map-image
placeholders (this tool needs both the bridge-client control surface AND the live map). Inlines everything
-- CSS, vendored Leaflet, the vendored bridge client, the embedded map image, every app/*.js -- so the
output is a single self-contained file with zero external requests. That one file works the same three ways
every other tool in this ecosystem does:
  * hosted on GitHub Pages (open the URL),
  * downloaded and opened straight off disk (file://),
  * served by the lua-bridge itself at http://127.0.0.1:27050/ (the bulletproof, all-browsers path -- some
    browsers are picky about a WebSocket from a page loaded off a different origin).

Edit files under src/, then re-run: python build.py
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "src"


def guard(s):
    # never let inlined content close the <script>/<style> early
    return s.replace("</script", "<\\/script").replace("</style", "<\\/style")


def read(*parts):
    return (SRC.joinpath(*parts)).read_text(encoding="utf-8")


def main():
    html = read("index.html")

    leaflet_css = read("lib", "leaflet.css")
    # tokens.css (vendored from mercs2-tools-shared) first, so this tool's own styles.css can override
    # anything it needs to -- last declaration wins in plain CSS.
    css = read("lib", "tokens.css") + "\n" + read("styles.css")

    leaflet_js = read("lib", "leaflet.js")
    bridge = read("lib", "bridge-client.js")

    map_js = SRC / "data" / "map-image.js"
    if not map_js.exists():
        raise SystemExit("missing src/data/map-image.js -- vendor it from mercs2-webmap's tools/gen_map_image.py output")
    data = map_js.read_text(encoding="utf-8")

    # the vendored bridge client + map image data first, then every app/*.js in NN_ order (00_bridge.js
    # before 05_state.js before 10_map.js before 15_live.js before everything else, same numbered-file
    # convention as Ess's own src/ and every other tool in this ecosystem).
    app_files = sorted((SRC / "app").glob("*.js"))
    app = "\n".join("/* ==== %s ==== */\n%s" % (p.name, p.read_text(encoding="utf-8")) for p in app_files)

    html = (html
            .replace("/*__LEAFLET_CSS__*/", guard(leaflet_css))
            .replace("/*__CSS__*/", guard(css))
            .replace("/*__APP__*/", guard(leaflet_js + "\n" + bridge + "\n" + data + "\n" + app)))

    out = ROOT / "dist" / "index.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print("[build] wrote %s (%d KB, %d app modules + leaflet + bridge + map image)" % (out, out.stat().st_size // 1024, len(app_files)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
