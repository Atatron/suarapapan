# Local WebRTC VAD

`libfvad.js` embeds the **15,331-byte** `dist/libfvad.wasm` binary from the
published `@ozymandiasthegreat/vad@2.0.7` tarball. No upstream JavaScript wrapper
is copied; `wav.js` calls the exported libfvad API with one isolated instance per
recording. It compiles once, runs in browsers and Node, and requires no CDN.

- Primary source: <https://github.com/OzymandiasTheGreat/libfvad-wasm>
- Pinned artifact: <https://registry.npmjs.org/@ozymandiasthegreat/vad/-/vad-2.0.7.tgz>
- npm integrity: `sha512-a7MCJ/8ohhyjDFBAktVJsEA9tUwB7Le2+SpKrZp0sFhKyvdFyxZDI6G0PZHCxlFChHvyH+yK7PpKEdov7wEH8g==`
- WASM SHA-256: `3fadafc9c5c1c3117d0178ae631484c6dabc72e0f8742b95c370cd39f46cf171`
- BSD redistribution license and patent grant: `web/public/licenses/webrtc-vad.txt`

The upstream wrapper repository is archived. Updating the binary is a deliberate
dependency change requiring hash/license review and audio regressions.

WebRTC uses a statistical speech/noise classifier, not speech recognition or a
speaker identity check. It can accept sudden broadband noise. The application
therefore also rejects high zero-crossing broadband frames and retains minimum
energy and duration checks. This regression guard is **not a guarantee** that all
classroom noise is rejected; classroom recordings and browser/device testing are
still required. Live Web Speech captions are a separate vendor recognition path.
