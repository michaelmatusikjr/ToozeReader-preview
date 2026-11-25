# Rules for every Nov 25 backlog brief

- You work in your own git worktree. Commit your work there (one or a few commits, clear messages). Don't push.
  (This overrides "don't commit" in the builder role.)
- Don't touch `APP_VERSION`, `CACHE`, `WHATSNEW`, `SAMPLE_HTML`/`SAMPLE_V` or the docs; the main session does those.
  Do add a short "Report" at the end of your reply: files changed, tests and results, what's left, and any line you'd
  add to `docs/HANDBOOK.md` (where your new code lives).
- Setup for tests: `ln -s /home/user/ToozeReader-preview/node_modules node_modules` in your worktree root, and copy
  fixtures if a test needs them: `cp -rn /home/user/ToozeReader-preview/tests/fixtures/* tests/fixtures/`.
  Serve your own build on **your port** (given in the brief): `python3 -m http.server <port> &` from the worktree root,
  and run tests with `TOOZ_PORT=<port> node tests/feature/<name>.js`. Other builders use other ports at the same time.
- Build with `sh tools/build.sh`, then the syntax check in CLAUDE.md. Run `smoke.js` plus the tests named in the brief.
- CSS: put new rules next to the related existing rules in `src/a_head.html`, **not at the end of the file** (other
  builders edit the same files; scattered edits merge cleanly).
- Respect `prefers-reduced-motion` for any new animation.
- The goal (CLAUDE.md): maximum usefulness, minimum on screen, no help text, show don't label, feels good under a
  thumb. If the brief seems wrong when you meet the code, stop and report instead of improvising.
