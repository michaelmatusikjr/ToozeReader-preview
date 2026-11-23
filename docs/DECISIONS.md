# Decisions log

Newest first. One short entry per decision: date, what was decided, why, who decided (Mick or Claude). Mick's
feel-check feedback goes here too. Older history (before Nov 22) is summarized in `HISTORY.md` and `PRODUCT.md`.

## 2026-11-23

- **Mick — the guide drop (Nov 23, 2026).** He wants one living drop of the accent colour as a calm guide: fun
  (personality, never in the way), a guide where accent colour already is (selections animate from old to new, plus
  a few non-obvious controls made noticeable), and an assistant (tap/hold/drag gestures replacing hidden controls).
  It must always be on screen: tab indicator, or the bottom base the app sits on. Of three takes he chose
  **1: Foundation** (bottom base). Stage 1 built (2026.11.23.2, `src/k_blob.js`): one fixed drop on the tab bar and
  as reading progress in the reader (controls hidden); `.seg` selections flow. **He asked to be reminded to come
  back and add Option 3 (the pull-up pool) if he likes it**; it's in Pending changes in `PRODUCT.md`. Not yet
  verified on a real iPhone (bottom-edge position vs the home indicator, how the stretch feels under a thumb).
  Rejected for now: "Offspring" (highlights as droplets; adds more than it removes) and edge-pull "Frame".
- **Mick — work happens in preview (Nov 23, 2026).** He wants the live app left alone while he tests: all source,
  tests and docs moved into `ToozeReader-preview`, which is now the working repo. Approved versions are released to
  `readfast-app` with `tools/release.sh`, and every release is logged in `docs/RELEASES.md` so it can be undone.
  `tools/ship-preview.sh` (readfast-app → preview) is retired; it would have overwritten preview work.
- **Fix — bottom info line overlapped text (2026.11.23.1).** With the bars hidden, the text area now ends above
  the "Page X of Y" line, whatever the home-indicator inset. Test: `tests/feature/runfoot.js`.
- **Mick — model workflow.** Haiku copies notes verbatim into Pending changes. Opus interprets, plans options and
  writes briefs (`docs/briefs/`), and reviews. Sonnet builds from briefs. Haiku tests and does chores. Mick runs the
  session on Opus; Opus delegates the cheaper work itself (standing permission in CLAUDE.md). Nothing ships to
  preview without an Opus review.

## 2026-11-22

- **Mick — overall direction.** The #1 goal is *delightful usefulness*: maximum usefulness with very little on
  screen, no feature that needs explaining, communication through color/size/position/motion rather than labels,
  and purposeful motion that feels good. Claude acts as "director of delightful usefulness", using subagents in
  specific roles only where they help. Written into `CLAUDE.md`.
- **Mick — new features start with 3 options** (2 proven, 1 boundary-pushing), each with feel, screen, risks and
  cost, plus a recommendation. Small things (implementation, polish, bug fixes) Claude decides alone.
- **Mick — test before release.** New work ships automatically to a preview app; it goes to the live app only after
  he tests it on his iPhone and approves. Replaces the Nov 12 rule of merging straight to `main`.
- **Mick — preview repo.** A new, separate repo `michaelmatusikjr/ToozeReader-preview` (GitHub Pages at
  /ToozeReader-preview/) starts as a copy of the live app. The older `tooz-preview` repo holds abandoned experiments
  and is left untouched. The new repo is a deploy target only: `tools/ship-preview.sh` copies the built site from
  `readfast-app`, so there is one source of truth and releasing is just merging `ereader` into `main`. The copy is
  named "Tooz Preview" with an orange-tinted icon and its own cache name.
- **Claude — What's new across previews.** `WHATSNEW` collects everything since the last live release, so the live
  release tells him (and other users) the whole story; it starts fresh after each live release.
- **Claude — model use.** opus for design options and tricky debugging; sonnet for building and review; haiku for
  tests, version bumps and docs. Roster in `HANDBOOK.md`.
