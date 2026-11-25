# Brief: themes, app-wide (Mick chose "theme cards in Settings", Nov 25)

Port **8751**. Read `_common.md` first. Large change.

## What Mick asked
Themes apply across the whole app. Any theme, shipped or his, can have its accent colour customised; shipped themes
can be edited and deleted; he can create new ones; 5 themes max. Theme settings move into app Settings. "Switch theme
at night" picks from whatever themes exist.

## Design (decided)
- **Data.** Themes become a user list `S.themes` (in settings, so backup/restore carries it): up to 5 items
  `{id, label, bg, ink, accent}`. Everything else is derived: `dark` from bg luminance; page muted/line/link,
  highlight set (HL_DARK vs HL_LIGHT), and the app chrome tokens (`--paper --surface --raise --ink --muted --line
  --accent --accent-soft --accent-ink`) from bg/ink/accent (e.g. `--surface`=bg, `--paper`/`--raise` a few percent
  toward ink, `--accent-soft` accent mixed into surface, `--accent-ink` black or white by contrast). Shipped themes keep
  their exact existing page colours (muted/line/link as today) until edited; give them accents `#2244B5` (light) /
  `#8AA4FF` (dark) so today's look is unchanged except that the chrome now follows the page colours.
- **Defaults / migration.** Defaults: White, Paper, Sepia, Dark, Black (5). If the user's current `S.theme` or
  `S.nightTheme` is `gray`, put Gray in place of Paper. Old ids keep working. `THEMES` lookups go through one helper
  (e.g. `themeById(id)`) so nothing else breaks; `effectiveTheme()` falls back to the first theme if the id is gone.
- **"Match phone" (`auto`) stays**: light phone → the first light theme in the list, dark phone → the first dark one
  (if none of that kind, the first theme).
- **Night switch**: the night-theme picker lists the user's themes (not the fixed four). Deleting the night theme or
  current theme falls back to the first theme.
- **Settings → Themes** (new section in `renderSettings`, `f_js3.js`, near Light; move "Switch theme at night" and its
  times/picker into this section): up to 5 theme cards showing the theme (page colour, an "Aa" in ink, an accent dot,
  the name); the current one ringed. Tap a card → make it current. A small edit affordance on each card (pencil) opens
  the editor sheet. A "+" card shows while there are fewer than 5 (new theme starts as a copy of the current one).
- **Editor sheet** (`openSheet`): name field; three rows — Page, Text, Accent — each a row of ~8 quick colour dots plus
  one dot that opens a native `<input type=color>`; a live preview paragraph (a few lines of book text in the chosen
  colours with an accent-coloured word/button) that updates as he picks, and the whole app updates live too
  (applyLook) when editing the current theme. Delete button at the bottom (hidden when it's the last theme). No help
  text. If page/text contrast is under 4.5:1, the preview's text just looks bad — that's the signal; no warning text.
- **Aa panel** (`e_reader.js` ~line 1769): keeps the quick theme row, now built from `S.themes` (plus Phone). Remove
  the night-theme controls from Aa if they appear there (they're app-wide; they live in Settings → Themes).
- `#themeColor` meta keeps working (uses the theme bg in the reader, chrome paper outside).

## Done when
- Library, Notes, Stats, Settings and sheets take their colours from the current theme (e.g. Sepia → a warm library).
- Create, edit (incl. accent of a shipped theme), delete, max 5, night switch from his themes all work and survive a
  reload; backup includes them.
- New test `tests/feature/themes.js`: creates a theme, edits accent → `--accent` changes; 6th "+" not offered; delete
  current theme falls back; night theme list = user themes; reload keeps them; old `S.theme='gray'` migrates.
- `smoke.js`, `toast.js`, `delight.js` still pass. Screenshot library in Sepia and Dark to your scratch dir and look.
