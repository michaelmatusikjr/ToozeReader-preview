# Decisions log

Newest first. One short entry per decision: date, what was decided, why, who decided (Mick or Claude). Mick's
feel-check feedback goes here too. Older history (before Nov 22) is summarized in `HISTORY.md` and `PRODUCT.md`.

## 2026-11-25

- **Mick — subagents must use the cheapest fitting model; very minor edits need no QA.** Added agent types in
  `.claude/agents/` (`mechanic`, `tester` on Haiku; `builder`, `reviewer` on Sonnet) so the model is fixed by the
  type, not remembered per call. Delegation now applies to any main session ("below its own tier"), not only Opus.
  Review happens once (main session); the Sonnet `reviewer` is only for large or risky changes. Typos, colors,
  spacing and doc-only edits skip tests and review: build + syntax check only. No app change, no preview release.
- **Mick — likes the way back, wants it on its own line under the header, readable, visible in the same place with
  the controls hidden, without overlapping the text.** Built 2026.11.25.8: `#rCrumb` row (32 px) under `#rTop`; in
  overlay (focus) mode it's absolutely placed at 49 px and the text area moves down (`.crumbing`); otherwise it's a
  normal flex row. The re-flow anchors on the exact jumped-to word (first try anchored on the page top and landed
  on verse 5 instead of 8). Header back arrow is plain again. Test: `delight.js`.
- **Mick — tapping the goal circle after the goal is met plays the celebration too** (2026.11.25.7; popup shows as
  well). Test: `delight.js`.
- **Mick — the "Return to …" toast didn't look tappable and covered the title; "move it or do it another way".**
  Claude's call (2026.11.25.6): the back arrow becomes "‹ <book>" in the link colour (iOS's "◀ Safari" pattern), plus
  a small "‹ <book>" at the top left of the page with the controls hidden. No toast, nothing to swipe. Same end
  rules (leave the book, 10 minutes). Test: `delight.js`.
- **Mick — the celebration creature should be amorphous:** no eyes or mouth, only vaguely apparent appendages that
  stretch a bit, subtle, at the bottom of the screen. Rebuilt (2026.11.25.5): the outline is computed each frame
  (12 points, smooth curve) so the blob flows; it stays within ~25 px of the bottom; the page line fades while it
  plays (in narrow bottom space it would otherwise sit on the text). No sparkles.
- **Mick — celebrate reaching the reading goal:** the drop comes alive as a little creature, plus a 7-second toast.
  Built 2026.11.25.4 (`Drop.celebrate` in `k_blob.js`, called from `recordStats`). Claude's calls: a drop-shaped
  body with eyes, smile and arms (the drop's own shape, so it reads as the drop waking up), two hops with waving
  arms, a sparkle burst, ~3.3 s, then it melts back; starts from the drop, else the goal circle; skipped with
  Reduce Motion. Test: `delight.js`.
- **Mick — feedback on the Nov 25 batch (2026.11.25.3).** (2) A link into another book: no hollow drop; a toast
  "Return to <title>" that lasts until he leaves the Bible, flicks it away, or 10 minutes. (3) He doesn't like the
  tab-bar fill; instead a small progress circle in the reader, visible with the controls hidden, nothing else on it,
  absent without a goal; tap → "x minutes read today" / "Goal x minutes". (4) Haptics didn't work → removed.
  Claude's calls: the whole toast is the way back (no extra button); another toast in the meantime is followed by the
  return toast again; the circle sits at the bottom right beside the page line; the same-book hollow drop stays.
  Test: `delight.js` updated.
- **Mick (screen recording) — Scroll mode glitch in The Imitation of Christ.** Past the "Book I" heading the page went
  blank and raced to chapter XX. Cause: Scroll mode keeps ~5 sections rendered and removes far ones above the screen
  with a scrollTop correction; iPhone Safari ignores that correction during a coasting swipe, and Imitation's
  preface is ~9,600 px, so the page jumped that far into unrendered text. Fix (2026.11.25.2): never remove or prepend
  above the screen while a swipe is moving (finger down, or a scroll event in the last 700 ms; auto-scroll exempt);
  tidy 800 ms after it stops. Test: `scrolljump.js` (old code: a 9,662 px jump; now 0).
- **Mick — drop stage 2: unsure about the pool.** Saw mock-ups of the four pool takes, wasn't sure he likes the idea,
  asked for other ways to make the app delightfully useful. Offered: where you were (A), today's reading (B),
  chapter horizon (C), then scripture peek, exact citations, open into your book, sleep timer, today's highlight,
  haptics. **He chose "all except 4 and 5" (read as: not the sleep timer, not today's highlight), all at once, and
  went to bed: "make any decisions you can on your own".** Built as 2026.11.25.1. Claude's calls:
  - Ghost: replaces the back pill; back-and-forth; 3-minute fade; cross-book ghost at the line's start with ‹.
  - Peek: never inside a Bible; Bible = most recently read, downloaded first, KJV default; ≤8 verses; position
    looked up again after opening (opening a book can renumber words — the first try landed a few words off).
  - Today's drop: 15-minute default goal when none is set (so the gauge means something); ripple once a day.
  - Haptics: best-effort borrowed iOS 18 switch tick; may not fire during momentum scrolling. Feel unverified.
  - Resume: only if you left from inside a book; the back button means "next time, the library".
  - Citations: verse ranges for Bibles, "Book I, ch. XII" style elsewhere.
  Tests: `delight.js` (all six), older tests switched from `#backPill` to `#dropGhost`.

## 2026-11-24

- **Mick — Aa drop works except going to Speed.** Switching to Speed rebuilds the panel twice within ~20 ms (Speed
  needs no layout), and the new control's first ResizeObserver callback moved the drop to the end before the
  queued slide ran. Fix (2026.11.24.12, `k_blob.js`): a `pending` flag blocks the ResizeObserver until the slide
  starts. Test: `aadrop.js` (scroll → speed, speed → pages, mid-slide).
- **Mick — the sidebar handle should scroll through all the pages, not just the first wheel** (Imitation: the bulk
  of the book is one section, pages 30–300+). Fix (2026.11.24.11): dragging the line seeks every wheel to the spot
  under the thumb and Go targets that exact spot (page shown under Go); moving a wheel clears it. Test: `spine.js`.
- **Mick (screenshot, Imitation of Christ) — three wheels hard to read; Go doesn't include the chapter title.**
  Causes: a wrapper heading ("The Imitation of Christ") took the first wheel, pushing Book I–IV to the second and
  chapters to the third; long names truncated; contents list names chapters only "I". Fix (2026.11.24.10): skip
  wrappers (level choice penalises a level where one entry holds >50% of the book; shallower leaves like Preface
  stay beside it), short wheel names (text before ":"), wheels sized by their names, pages only as a second wheel,
  and Go reads the subtitle under a numbered heading. Same fix tidies Les Misérables, Karamazov, Gatsby.
- **Mick — wheels: "drag and flick to scroll the wheels quickly"; and drag the sidebar to move through books
  faster.** Cause of the weak flick: `.spnmap` still had `touch-action:none` from the old drag spine; Safari applies
  ancestors' touch-action, Chrome doesn't (so tests passed here). Removed; `spine.js` now fails if any ancestor of
  a wheel says `none`. Momentum itself is native iOS scroll-snap and can't be checked headless (no WebKit here).
  New: dragging the thin left line spins the first wheel to that point of the book; wheels fill in at rest.
  (2026.11.24.9)
- **Mick — toasts: move to the top, match the theme, swipe away.** Built 2026.11.24.8: `#toast` sits under the
  top safe area, uses `--surface`/`--ink`/`--line` (in a book: `--page-bg`/`--page-ink`/`--page-link`, via
  `body:has(#v-reader:not([hidden]))`), drops in from the top, flicks away up (26px) or sideways (64px); a short
  drag springs back and stays 2.6 s more (progress toasts stay). Test: `toast.js`.
- **Mick — "the drop in the reading options still doesn't work right."** The mode/segmented controls slid after
  2026.11.24.6, but the theme swatches and font tiles (`.themes`, `.fontrow`, `.fontgrid`) weren't `.seg`, so their
  selection still jumped. Now they get a sliding accent **ring** (same stretch-and-settle motion; `.drop-ring`,
  `.lqr`). Test: `aadrop.js`.
- **Mick — "I can't even see all the books"; wants wheels.** His idea: a vertical wheel with momentum and an
  indicator on the current book; when it lands, a chapter wheel, then a verse wheel; commit with Go, not on
  release. Offered A (picker wheels, his idea + thin spine map kept), B (grids, Bible-app style), C (one zooming
  wheel). **He chose A, plus typed references in search, and said build it (no mock-up).** Built 2026.11.24.7:
  the spine's drag/step-sideways/pointer-speed code is gone; the setting reads List | Wheels (value still 'spine').
  Calls: native scroll-snap for momentum (feels like iOS pickers); wheels refill after 160 ms of quiet; single-
  chapter books (Jude) still get a chapter wheel ("Jude 1:3"); novels' third level is pages (Loc in Scroll mode).
  Test: `spine.js` (rewritten for wheels).
- **Mick — the drop didn't flow in the reading options (Aa) panel like in Settings.** Causes: switching mode
  rebuilds the panel (twice: before and after `switchMode`), so the mode control was new each time and the drop was
  placed, not slid; controls in folds only woke when ≥90% in view inside the scrolling sheet, so many never did.
  Fix in `k_blob.js` (2026.11.24.6), general for any screen: the drop remembers each control's last position (by
  `id`/`data-set`) and a redrawn control slides from there, continuing mid-slide if a second redraw lands during the
  slide (negative animation delay); a control woken by a tap slides; wake at 60% in view. Test: `aadrop.js`.
- **Mick — feel check on 2026.11.24.4: very sluggish, and it jumps at the top/bottom.** Fix (2026.11.24.5): slow
  step 22→14px per item and normal speeds count as fast (0.5 px/ms, was 0.8); the end-snap is replaced by a
  room-aware catch-up in the last stretch of the line (the last item arrives exactly at the end). Tried making the
  catch-up apply everywhere: that is just absolute tracking again and kills fine control, so it's only near the
  ends. Test: steady slide to the bottom never moves more than 3 books per 4px (old version: 42-book jump).
- **Mick — feel check: the spine is too sensitive; Jude is hard to get to.** Cause: the main line followed the
  thumb absolutely and is proportional to length, so Jude was ~1px and 66 books got ~6px each. Fix
  (2026.11.24.4): pointer-style selection — touch-down is absolute, then relative and speed-sensitive (slow ≈ a
  fingertip, 22px, per book; a quick swipe still covers the whole Bible); ends snap only when heading for them; a
  dot marks the pick on the line. Inner line the same. Test: `spine.js` (slow fingertip from Revelation → Jude and
  holds; quick swipe reaches the start).
- **Mick — spine for big books: step sideways (option 1 + a bit of 2).** His idea: slide to the book, slide right
  into its chapters, slide up/down to pick. He asked how Revelation 22 works at the bottom edge: the inner line is
  always full height and starts at the matching spot, so the bottom of Revelation lands on 22 and there's room to
  go up. Saw a mock-up first, then OK'd the build (2026.11.24.3). Claude's calls: inner chapters evenly spaced
  (short psalms as easy as long ones); plain novels step into pages; moving right freezes the item so a drift
  doesn't change it; further right is finer; the lens fits the big label to the width and hides the inner line's
  own labels near the thumb. Rejected: fine-tune-only (runs out of room at edges) and the swell (slippery).
- **Mick — the List | Spine switch belongs in the reader's Aa panel, not app Settings.** Moved (2026.11.24.2) to Aa →
  More text options → Contents (and Word display in Speed mode). Still one global setting.
- **Mick — feel check: the drop between Contents and Notes didn't travel** (it shrank on one tab and grew on the
  other). Cause: switching tabs redrew the whole sheet, so the tab control was a new element and the drop grew in
  fresh. Fix (2026.11.24.1): the Contents | Notes control (`#tocTabs`) stays put and only `#tocPane` below it is
  redrawn; the Both/Contents/Bookmarks switch also updates in place. Rule for the future: **to get the flowing drop
  on a `.seg`, flip `aria-pressed` on the existing buttons; never re-render the control.** Test: `sheet.js`
  checks the same element is kept and the drop is mid-stretch partway through.

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
- **Claude — the spine (2026.11.23.7).** Built option C as a Settings choice (Reading → Contents: List | Spine).
  Calls: release jumps to the chapter start (the big label says exactly where you'll land) rather than a raw
  position; releasing off the spine cancels (no cancel button); with a search typed the spine swaps to the same
  result list as List (one search behaviour to learn), rather than lighting beads; resting labels use the chapter
  level whose count best fits the height. Removed the magnifying glass and the old search sheet (`openSearch`).
  Gotcha: don't name an inner element class `spine` — `#sheet` carries `.spine` too. Test: `tests/feature/spine.js`.
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
