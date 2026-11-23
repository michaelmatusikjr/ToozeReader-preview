# Decisions log

Newest first. One short entry per decision: date, what was decided, why, who decided (Mick or Claude). Mick's
feel-check feedback goes here too. Older history (before Nov 22) is summarized in `HISTORY.md` and `PRODUCT.md`.

## 2026-11-23

- **Mick — one sheet for contents, bookmarks and notes: build A and C, switchable in Settings.** Shown three
  mock-ups (A two tabs, B one list, C the spine), he chose to have both A and C, with a Settings switch. Claude: A
  first (2026.11.23.6) because C reuses its search, bookmark placement and drop; C next round. Claude's calls: the
  Contents search covers titles, bookmarks and the book's text (so it does what the magnifying glass does; the
  magnifying glass was kept, ask him whether to drop it); the filter is a native picker under the filter icon (no new
  UI to learn); the Both/Contents/Bookmarks switch only appears once a book has a bookmark; numbers are pages in
  Pages mode (estimated for sections not yet laid out) and locations in Scroll; the sheet keeps a steady height so
  switching tabs doesn't jump; in-sheet taps re-render in place (re-opening the sheet made the 420 ms ghost-tap
  guard eat quick taps). Test: `tests/feature/sheet.js`.
  Mick then OK'd removing the magnifying glass from the top bar (done with the spine round).
- **Mick — drop stage 1 feel check: "feels great" (Nov 23, 2026).** Stage 2 (pull-up pool) is a go in principle.
  Claude recommended building the contents/notes sheet first as its own round, then drop stage 2, so each feel
  check is about one change and the pool can include the new sheet as a bead.
- **Mick — the guide drop (Nov 23, 2026).** He wants one living drop of the accent colour as a calm guide: fun
  (personality, never in the way), a guide where accent colour already is (selections animate from old to new, plus
  a few non-obvious controls made noticeable), and an assistant (tap/hold/drag gestures replacing hidden controls).
  It must always be on screen: tab indicator, or the bottom base the app sits on. Of three takes he chose
  **1: Foundation** (bottom base). Stage 1 built (2026.11.23.2, `src/k_blob.js`): one fixed drop on the tab bar and
  as reading progress in the reader (controls hidden); `.seg` selections flow. **He asked to be reminded to come
  back and add Option 3 (the pull-up pool) if he likes it**; it's in Pending changes in `PRODUCT.md`. Not yet
  verified on a real iPhone (bottom-edge position vs the home indicator, how the stretch feels under a thumb).
  Mick (same day) couldn't see the reader drop (a progress-sized line was a 6px speck on page 11 of 5126, so 2026.11.23.4 makes it a 36px bead that rides along the bottom): it only showed with the controls hidden, so 2026.11.23.3 shows it in Pages and Scroll whether or not the controls are up, above the home indicator. Stage 1 has no touch response yet (press/hold/drag is stage 2). Mick then asked (2026.11.23.5) for the drop to be the scrubber itself while the controls are up, dripping down to the bottom edge when they hide, and travelling from the scrubber to whichever tab he goes to next; built (the native scrubber thumb is invisible, the drop is drawn over it). Rejected for now: "Offspring" (highlights as droplets; adds more than it removes) and edge-pull "Frame".
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
