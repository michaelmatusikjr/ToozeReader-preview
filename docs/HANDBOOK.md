# Tooz handbook

Short working guide so a new session can start without re-reading the source. Keep it short and current: when you
learn where something lives or how it behaves, add a line here. Decisions go in `DECISIONS.md`, the spec in
`PRODUCT.md`.

## Where things live

All source is in `src/` and builds into one `index.html` (`cd src && python3 assemble.py`). Big files: `f_js3.js`
(~115 KB), `old.html` (~105 KB), `e_reader.js` (~100 KB). **Search them with grep for a name below; don't read them
whole.**

| Area | File | Names to grep for |
|---|---|---|
| CSS (all of it) | `a_head.html` | class names |
| Markup: library, notes, stats, settings, reader, sheets | `b_body.html` | element ids (`#v-reader`, `#sheet`) |
| Settings, themes, fonts, EPUB/PDF import | `c_js1.js` | `DEFAULTS`, `S`, `THEMES`, `applyLook`, `parseEpub`, `parseFile` |
| Reader core, open/close a book | `e_reader.js` | `R`, `openDoc`, `closeReader`, `goTo`, `switchMode`, `MODES` |
| Pages mode | `e_reader.js` | `P`, `pgLoad`, `pgSet`, `pgTurn`, `pgCheckAnchor`, `holdPlace` |
| Scroll mode, auto-scroll, tear | `e_reader.js` | `SC`, `scShow`, `scEnsure` (never trims/prepends above the screen mid-swipe: iOS ignores the scroll correction), `asStart`, `asStop`, `tearMark`, `tearShowOnReturn` |
| Speed mode | `e_reader.js` | `speedText`, `difficulty`, `hyphenSlow` |
| Contents/Notes sheet in a book (bookmarks in place, search, section filter) | `e_reader.js` | `openToc`, `tocList`, `hlList`, `placeLabel`, `tocSpan`, `R.tocShowNow`; the wheels (style 'spine'): `drawSpine`, `spineUse`, `versesIn`, `kidsOf`, `pageEntries`, `wheelLabel`, `fullTitle`, `refTarget`, `S.tocStyle` |
| Selection, highlights | `e_reader.js` | `SEL`, `hasSelection`, `decorate` |
| Reading clock / stats credit | `e_reader.js`, `f_js3.js` | `CLK`, `markActivity`, `creditFor`, `recordStats` |
| Word splitting migrations | `e_reader.js` | `dashSplitText`, `rangeJoinText`, `remapWords` |
| What read aloud says | `i_speech.js` | `speechChunk`, `refPhrase`, `acronymSpoken`, `ellipsisPause` |
| Natural voices (Piper), live playback | `h_voice.js` | `PIP_VOICES`, `natSpeakFrom`, `natChunkAt`, `natPauseFor` |
| Listen offline | `j_audiobook.js` | `AB`, `abStart`, `abPlayFrom`, `abShareSheet` |
| Where you were (ghost drop, same book); return link (other book) | `e_reader.js`, `k_blob.js` | `setBack`, `showGhost`, `Drop.ghost`, `#dropGhost`; `jumpDoc`, `RT`, `showReturnLink`, `endReturnLink`, `returnBack`, `#rCrumb`, `.crumbing` |
| A book's own preference switches (Crossway ESV) | `c_js1.js` import → `text.marks` {woc,xr,fn,vn: word ranges}, `text.acts` [[s,e,'crossrefs.hide']]; `e_reader.js` `loadMarks`, `R.mk`, `R.acts`, `tapBookPref`, per-book `meta.bp`; older copies repaired on open by `oldPrefs` (switches found by wording, marks from flags; no red letters); CSS `#v-reader.bp-no*` | 
| Scroll mode keeps a jump's word on screen while things settle | `e_reader.js` `scSettle` (called from `scShow`); lands below the back toast (`scGap`) |
| Where you were: "‹ Back to …" toast (replaced the hollow drop) | `e_reader.js` `setBack`, `showBackToast`, `clearBack`, `ghostBack`; re-shown in `setChrome`; swipe → `R.backGone` (`f_js3.js` toast swipe) |
| Verses tinted after Read it in context | `R.flash` {s,e} set in the peek's ctx handler, drawn in `decorate`, cleared by `clearFlash`/`openDoc`/closing |
| Toast placement (below the reader's controls) | `f_js3.js` `placeToast` |
| Scripture peek (tap a reference) | `e_reader.js` | `scanRefs`, `R.refMap`, `w.sref`, `openRefPeek`, `pickBible`, `findVerses` (→ `bibleBookSpan`, `textChapters`, `textVerses` when the contents don't list chapters; cached in `R.bibleCache`); `refsIn` finds references in any word range; note cards show only the tapped entry (`R.noteT`), take the book from the tapped verse (`bookAt`) so "ch. 3:28"/"ver. 33"/"Rev. 1:4, 8" work; import reads stylesheet-raised classes (`cssClasses` → `ctx.supCls`) as superscripts; note cards (`openFootnote`) make them tappable (`.nref` → `peekRef`) |
| Exact citations | `e_reader.js` | `citation`, `verseRef`, `placeCite` |
| Daily goal circle in the reader; goal celebration | `e_reader.js`, `f_js3.js`, `k_blob.js` | `goalRing`, `#goalRing`, `.goalpop`, `updateToday`, `todayMs`, `Drop.celebrate`, `.drop-buddy` |
| Reopen the book you were in | `e_reader.js`, `f_js3.js` | `LS 'resume'` (set in `openDoc`, cleared in `closeReader`, read in `boot`) |
| Toasts (top, themed, flick away) | `f_js3.js`, `a_head.html` | `toast`, `#toast`, `toastT` |
| Version, What's new, search, export, year stats | `g_extra.js` | `APP_VERSION`, `WHATSNEW`, `searchAllBooks`, `exportBook` |
| Library, filters, tags, archive | `f_js3.js` | `renderLibrary`, `openFilter`, `suggestTags`, `archiveFlow` |
| Settings screen, backup, erase | `f_js3.js` | `renderSettings`, `buildBackup`, `eraseAll` |
| Tutorial book, starter shelf, boot | `f_js3.js` | `SAMPLE_HTML`, `SAMPLE_V`, `SHELF` |
| The drop (accent guide), flowing `.seg` selections (a redrawn control with the same `id`/`data-set` slides from where the old one was; give new `.seg`s an id) | `k_blob.js` | `Drop`, `Drop.progress`, `#drop` |
| Offline cache | `src/site/sw.js` (root `sw.js` is generated) | `CACHE` |

Storage: `localStorage` keys start with `rf.`; IndexedDB via `Store` (books in `texts`) and `tooz-kv`; OPFS folders
`piper` (voices) and `audiobooks/<book id>`. Library metadata is the `LIB` array; save one with `touch(m)`.

## Release checklist (preview)

1. Batch the related work. Bump `APP_VERSION` (`YYYY.MM.DD.N`) and `CACHE` in `src/site/sw.js`; update `WHATSNEW` (everything
   since the last live release). Update the tutorial + `SAMPLE_V` if it explains something that changed.
2. Build (`sh tools/build.sh`), syntax check (see CLAUDE.md), run the feature tests for the areas touched plus `smoke.js`. Add a test for
   each bug fixed.
3. Commit and push to `main` of this repo (that's the preview).
4. Tell Mick: what changed (in feel terms), the version, how to try it ("open **Tooz Preview**, swipe it away and
   reopen"), and what couldn't be tested here.
5. Log the release in `DECISIONS.md`.

Live release only on his OK: `sh tools/release.sh` (CLAUDE.md "Shipping"); it logs to `RELEASES.md`. Then start a fresh `WHATSNEW`.

## Preview app notes

- Preview lives at https://michaelmatusikjr.github.io/ToozeReader-preview/, installed on his home screen as
  **Tooz Preview** (orange-tinted icon). It's built from this repo by `tools/build.sh`; the live app is only ever
  written by `tools/release.sh`.
- Both sites are on the same web origin (`michaelmatusikjr.github.io`). Home-screen web apps on iPhone normally get
  their own storage each, so the preview starts with an empty library and can't touch his real one. Not verified on
  his phone yet; if a change migrates stored data (like `dashSplitText`), keep this in mind and say so.

## Working with subagents

The main session is the director. Spawn a subagent only for genuinely parallel work, a fresh pair of eyes, or work
a cheaper model can do just as well. Every brief states: the role, the goal in delightful-usefulness terms, the exact
files/names to look at (from the table above), what "done" looks like, and when to stop and report back.

| Role | When | Model | Agent type |
|---|---|---|---|
| **Designer** | Drafting the 3 options for a new feature, interaction and motion design, "what can we take away?" | opus | main session |
| **Debugger** | Tricky bugs: timing, Safari quirks, audio, layout that only breaks sometimes | opus | main session |
| **Builder** | Implementing a chosen, well-specified design | sonnet | `builder` |
| **Fresh-eyes reviewer** | Only for large or risky changes: reviews for bugs and clutter, reports to the main session, doesn't fix | sonnet | `reviewer` |
| **Tester** | Writing a Playwright test for a fixed bug, running test batches, reporting PASS/FAIL | haiku | `tester` |
| **Mechanic** | Version/cache/What's new bumps, doc updates, renames, search-and-list chores | haiku | `mechanic` |

The agent types live in `.claude/agents/*.md`; each one's `model:` line fixes its model, so always pass
`subagent_type` (a bare Agent call inherits the main session's model). Standing permission (CLAUDE.md, "Delegate
by role"): the main session delegates work below its own tier itself. Briefs live in `docs/briefs/`. Order for a
normal change: build → `tester` → (`reviewer`, large/risky only) → main session's single final review → preview.
Very minor edits (typo, color, spacing, docs) skip tests and review entirely; see CLAUDE.md "Match the checking".

Small tasks (a one-line fix, a version bump) are faster done directly than briefed. Don't spawn a subagent to
re-read files you already have in context.

## Tests

Playwright against the built app on port 8750 (`tests/README.md`). Run one with `node tests/feature/<name>.js`; each
prints `PASS`/`FAIL`. `tests/README.md` lists which tests are out of date. Patterns: see CLAUDE.md "Tests".
