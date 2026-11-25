# Brief: Notes tab at scale + bookmark marks (Mick's choices, Nov 25)

Port **8753**. Read `_common.md` first. Medium change.

## A. Notes tab — folded books + search (Mick chose this)
In `renderNotes` (`f_js3.js`) for the Highlights and Bookmarks segments (Words segment unchanged):
- Each book is **one folded row**: title, counts ("12 highlights · 3 notes" / "4 bookmarks"), and one line with the
  latest item (latest note if any, else latest highlight text / bookmark place), ellipsised. Most recently read first.
- Tap the row → it **unfolds** in place (animated height, ~250 ms, the chevron turns) to show the existing rows plus
  the book's Copy/Export buttons (move them inside the unfolded part). Tap again folds. Unfolded state is remembered
  for the session (not across launches). If only one book has items, it starts unfolded.
- A **search field** at the top (only once there are 2+ books or 10+ items): filters across highlight text, notes,
  bookmark names and book titles as he types (normalise quotes like `normQ` in `g_extra.js`). Matching books unfold
  automatically and only matching rows show, with matches marked (`<mark>`, existing `.ftrow mark` style). Empty result:
  "Nothing matches “…”". Clearing restores the folded view.
- Tapping a highlight/bookmark still opens the book there; bookmark swipe-to-delete still works (`swipeRows`).

## B. Bookmarks: a character and colour on the icon (Mick's own idea, replaces naming)
"Instead of names, keep the chapter as the name. Allow the user to add a single character to the inside of the
bookmark icon and change the bookmark's fill color."
- Bookmark objects get optional `ch` (one character — one grapheme, so an emoji or a digit or a letter; use
  `Intl.Segmenter` when available, else first code point) and `c` (a colour from `COLORS` in `c_js1.js`, stored as
  the hex). No `c` → today's look (accent outline/fill as now).
- One shared renderer, e.g. `bmIcon(b, size)`: the bookmark shape filled with `b.c` (or as today), with `b.ch` centred
  inside in a bold small font, text colour black/white by contrast. Use it everywhere a specific bookmark is drawn:
  Contents sheet rows (`bmRow`, `e_reader.js`), spine flags (`.sp-flag` in `drawSpine`), the spine card, Notes tab
  bookmark rows, and the reader's bookmark button `#rMark` when the current page has a bookmark.
- **Editing**: tap the bookmark icon in a Contents row or a Notes-tab bookmark row (the icon itself, not the row,
  which still jumps) → a small sheet: a big preview of the icon, a one-character field (auto-focused; typing a second
  character replaces the first), and the colour dots (COLORS + "none"). Changes apply live and save on close
  (`touch(meta)`). Also: the "Bookmarked" toast's action becomes "Mark" which opens this same sheet (keep "See all"
  only if the toast supports two actions; otherwise replace it with "Mark").
- Keep name = chapter (existing `name`) as the label everywhere; don't add renaming.

## Done when
- Test `tests/feature/notesfold.js`: 3 books with highlights → folded rows, tap unfolds, search finds a note's text in
  a folded book and unfolds it, clearing refolds.
- Test `tests/feature/bmmark.js`: set ch='★' and a colour on a bookmark via the sheet → stored on the meta; the icon in
  Contents, spine flag, Notes tab and `#rMark` shows the colour and character; survives reload.
- `smoke.js`, `bmswipe.js`, `notes.js`, `toc.js`, `spine.js` still pass (update a test only if it relied on the old
  unfolded Notes layout, and say so).
