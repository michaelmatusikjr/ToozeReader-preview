# Brief: subtle motion with a job (Nov 24 backlog item 3)

Port **8754**. Read `_common.md` first. Small–medium change. Motion must have a job: show where something came from,
where to look, or what happens next. No decorative motion. Short (150–600 ms), ease-out, no bounce except where noted.

## Build exactly these
1. **Stats bars grow in when the chart comes into view** (`renderStats` in `f_js3.js`, `.bars` CSS in `a_head.html`):
   bars start at 0 height and grow to their value, staggered left→right ~40 ms, ~500 ms each, triggered by an
   IntersectionObserver the first time the chart is ≥40% visible after the Stats tab is shown (again each time the tab
   is opened). Number labels fade in as their bar finishes. Do the same for any bar/progress elements in `yearHTML`
   (`g_extra.js`) and the daily goal bar (`.goalbar i` fills from 0). Job: draws the eye to how the week went.
   Re-rendering because a goal chip was tapped animates from the old heights to the new ones, not from zero.
2. **Library rows leaving**: when a book is deleted or archived from the library, its card collapses (fade + height to
   0, ~250 ms) before the list re-renders, so he sees where it went. Find the delete/archive paths (`removeBook`
   callers, `archiveFlow` in `f_js3.js`).
3. **Bookmark button**: tapping `#rMark` to add a bookmark gives the icon a quick drop-in (translateY -6px → 0 with a
   tiny overshoot, ~260 ms) — the one place a little bounce is fine; removing it shrinks the fill out. Job: confirms
   which way the toggle went without reading the toast.
4. **Daily goal reached on the Stats tab**: if today's goal is met when Stats opens, the goal bar's fill gets the
   blob's accent glow once (reuse what `Drop.celebrate` / `.drop-buddy` in `k_blob.js` does visually, scaled down — a
   soft pulse of the bar, not a full celebration). Only the first time per day (`LS`).

Don't add anything else; list other ideas in your report instead.

## Done when
- Test `tests/feature/motion.js`: Stats tab — bars start at height 0 and end at the right % (read computed heights
  after ~1 s); with `reducedMotion: 'reduce'` they are at final height immediately; deleting a library book removes its
  card after the collapse; `#rMark` toggles still add/remove the bookmark.
- `smoke.js`, `lib.js`, `delight.js` pass.
