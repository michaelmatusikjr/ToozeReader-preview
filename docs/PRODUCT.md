# Tooz eReader — what Mick wants (spec and decisions)

Collected from his requests, Nov 2026. "He" is Mick, the owner. Keep this up to date when he decides something new,
and move items out of **Pending changes** once they're built.

## Pending changes (not yet built)

- **The drop, stage 2 — the pull-up pool: on hold.** Mock-ups of four takes (Nov 24: quick actions, + speed dial, quick
  dials, fits-the-moment) left him unsure he likes the pool idea at all; he asked for other ideas instead and chose
  the Nov 25 batch below. Don't rebuild the pool unless he brings it back.
- **Not chosen (Nov 24 list):** a sleep timer for listening, and "Today's highlight" on the library. Also offered
  then and not picked yet: the chapter horizon (bottom drop shows what's left of the chapter).

## The app

- Started as a speed reader (ReadFast); pivoted in Nov 2026 to an eReader with a speed-reading option, renamed
  **Tooz eReader**. He wants other people to be able to use it too, from the same link.
- Installable web app on the iPhone home screen; works offline. No App Store build.
- All reading data stays on the phone. No account or sync to his Claude account.
- Visible progress whenever something is loading.
- Only text inside a book is selectable; app interface text is not. In books, the phone's own selection menu is
  suppressed; Tooz's **Define** gives access to the phone's lookup.

## Reading modes

- **Pages** (page by page), **Scroll** (one long column, with auto-scroll), **Speed** (one word at a time). Only the
  settings for the current mode show. Reading settings apply to every book (global, not per book).
- Firm rule: navigating anywhere (chapter, scroll-and-tap, bookmark, scrubber) lands **paused** and never auto-plays.
  Reading only starts when he presses play.
- Keeping place on rotation or any layout change: anchor on the top-left word, show the page containing it, keep that
  anchor until a page is turned.
- Auto-scroll: a tap pauses it; further taps only show/hide controls; only the play button resumes. Auto-scroll has
  its own footer button in Scroll, with its options under ⋯.
- Speed reader: word-start emphasis, adaptive pacing; hyphenated words stay up longer; en/em dashes attach to the
  word before with a comma-length pause. Speed options are under a gear on the Speed controls.
- **Scroll "previously read" tear** (built Nov 16): whenever he leaves the reader in Scroll mode (any time at all,
  even a few seconds in another app) or closes it, the text is shown torn apart just before the first line that was
  on screen: the last line read ends the top page, ragged torn edges, then the page continues (mid-paragraph if
  needed). The gap says "Previously read" with up-arrows on each side and is centred on screen on return. The tear
  stays while he reads on and moves on the next exit; if it's still on screen at exit it stays put. Scroll only.

## Look and settings

- Aa panel: mode, text size, theme, 4 quick fonts, plus folded "More text options" / "Word display", and
  "Pages" / "Scrolling". The **Book's font** tile shows only when a book has its own font.
- Fonts include dyslexia-friendly Lexend and OpenDyslexic. Paragraph styles: Indented, Spaced, Spaced and indented.
- **Light** settings (dim, warmth, night theme) are app-wide, so they live in app Settings, not Aa.
- App Settings holds only app-wide items: Reading (idle limit, what the bottom line shows, reset), Light, Backup and
  restore, Storage, Library, Adding books, Help (tutorial, version, What's new), Erase.
- Bottom bars (tab bar and in-book bar) are tall enough and fill the home-indicator area.
- The OpenDyslexic title must not overflow the font picker.

## Library

- One "Add to library" button. Input: paste text, open files (EPUB and PDF), iPhone share sheet. The file picker
  offers files only, no photo library or camera. Purchased/DRM Apple Books can't be imported, and that's fine.
- Edit title and author; tags instead of categories. Tag suggestions: the book's own subject labels first, then form
  (poetry, sermons, letters…) and topic keywords; "Your other tags" and the Settings tag list start collapsed.
- Sort (Recently read, Title A–Z, Author A–Z) and Filter (status/title/author/tag sections; multi-select; OR within a
  section, AND across; other sections narrow to matches). Search suggests titles/authors/tags. Active filters show as
  colour-coded pills grouped by type. "Continue reading" shows only with no filters. Filters clear when the app
  closes; sort is remembered.
- Starter shelf of public-domain books (Christian classics, literary classics, the Bible), tagged "Christian Classics"
  or "Literary Classics" plus one or two more tags each.
- Finished = reaching 100%. A book at 98%+ that isn't marked finished prompts "Have you finished this book?" on
  returning to the library; after "No", it stays quiet until he reads more. Archiving asks "Did you finish it?"
  unless at 100%.
- Archive keeps chosen progress/bookmarks/highlights/notes, DNF or finished status, optional 1–5 star rating and
  review, finish date. Re-adding an archived book restores its saved data.

## The Nov 25 batch (built 2026.11.25.1, revised 2026.11.25.3 after Mick's feedback)

- **Where you were (same book):** after any jump (contents, search, wheels, typed reference, footnote back-link), a
  hollow drop sits on the progress line (scrubber with controls up, bottom line with them hidden) at the spot you
  left. Tap: go back, and it moves to where you'd jumped to (back and forth). Fades after 3 minutes. Replaced the
  back pill.
- **Return link (another book):** when a link takes you into another book (scripture peek → the Bible), no hollow
  drop; a row under the header reads "‹ <book title>" in the link colour. It stays in the same place with the
  controls hidden, and the text starts below it (the page re-flows, keeping your exact spot). Tap → back to that
  book. Ends when you leave that book or after 10 minutes. The header's own back arrow stays the plain way to the
  library. (Mick, Nov 25: toast → back-arrow link → its own row, "so it's readable".)
- **Scripture peek:** references in any book that isn't itself a Bible (book name/abbreviation + ch:v, ranges,
  "1 Cor.", follow-on refs like "; 12:1") get a faint dotted underline; tap → a card with up to 8 verses from the
  Bible in the library (most recently read; downloaded first; the KJV by default; a not-yet-downloaded shelf Bible
  is fetched), titled "Psalm 63:8 · KJV", with **Read it in context**. Must work with any Bible EPUB he adds (e.g.
  his ESV Reference Bible): contents listing only the books, chapters marked by "3:1" or a big number, verse numbers
  that are styled rather than superscript, verse 1 unnumbered. References inside a note card (a study Bible's
  cross references) are tappable too. A bare "12:1" counts as a follow-on reference only after ";", ",", "and", "cf.".
- **Exact citations:** in a Bible, copy/share/quote cards cite "John 3:16–18 (KJV)" (across chapters
  "John 3:36–4:2"); other books "Author, Title, Book I, ch. XII". "Copy all highlights" adds each one's place.
- **Daily goal circle:** a small progress circle at the bottom right of the page, only with the controls hidden and
  only if a daily goal is set; no other context. Tap → "x minutes read today" / "Goal x minutes". (Mick rejected the
  tab-bar gauge and the touchable bottom drop, Nov 25.)
- **Goal celebration** (Mick, Nov 25; revised 2026.11.25.5): when the day's goal is reached, the drop swells into a
  small, faceless, amorphous blob at the bottom of the screen (no eyes, no mouth); vague limbs (upper left, upper
  right, a small one on top) stretch out twice with a gentle wobble, then it flattens back into the drop (~3.2 s).
  It barely rises; the page line and goal circle fade out while it's there. Message: "You've reached your reading
  goal of x minutes." for 7 seconds. Reduce Motion: message only.
  Tapping the goal circle once the goal is met plays the celebration again (with the minutes popup). (Nov 25.)
- **Opens where you left off:** leaving Tooz from inside a book reopens that book next launch; leaving from the
  library opens the library (the back button clears it). Not for the tutorial.
- **Rejected: haptic ticks** (borrowing iOS 18's switch tick) — didn't work on his iPhone; iOS only ticks for a real
  tap on a visible switch. Removed; don't retry.

## Notes, highlights, bookmarks

- Highlights (four colours) with notes; copy with citation; quote image cards; export per book.
- The tutorial book opens on first launch; leaving it asks whether to keep it in the library or tuck it in Settings.
- **In a book, one sheet for contents, bookmarks and notes** (built Nov 23, 2026.11.23.6, option A of three). The
  list icon (`#rToc`) opens it; the separate notes icon is gone. **Contents** tab: a search bar (chapter titles,
  bookmarks, then hits in the text) and a filter icon (a native picker) to narrow to one section; bookmarks sit in
  their place between chapters, naming their chapter, with page (Pages) or location (Scroll) numbers; a
  Both / Contents / Bookmarks switch shows only once the book has a bookmark (remembered). **Notes** tab: highlights
  and notes grouped by chapter, with their own search. The current chapter carries the drop. Deleting a bookmark
  offers Undo. The reader's magnifying glass is gone (Nov 23): the Contents search does its job.
- **Contents wheels** (2026.11.24.7; replaces the spine's drag; Aa → More text options → Contents: List | Wheels,
  stored as `S.tocStyle='spine'`, default List). Mick's design (Nov 24, option A of three): picker wheels with
  momentum (native scroll-snap), the band in the middle is the pick, wheels open on the current place; when a wheel
  lands (160 ms quiet) the wheels to its right refill (at the current place if it's inside, else the first); **Go**
  commits ("Go to Revelation 22:3", page/location under it). Levels follow the book: Bible Book | Chapter | Verse
  (verses = raised numbers in the text); Imitation Book | Chapter; Les Misérables Volume | Book | Chapter; plain
  novel Chapter | Page (Loc in Scroll mode). Pages only as a second wheel. The first wheel skips a wrapper heading
  that holds most of the book (front/back matter sits beside the real top level). Wheels show short names ("Book
  I", "XII"); Go shows the full title, and for chapters listed only as a number reads the subtitle under the
  heading ("I. Of the imitation of Christ…"), with the parents and page underneath (Nov 24, 2026.11.24.10). The thin spine on the left keeps the map: chapter ticks, highlight beads (tap for a card),
  bookmark flags, the drop at your place and a ring at the pick. **Drag the thin line** (40px strip) to run through the whole
  book (proportional to position): every wheel follows the thumb and Go targets the exact spot/page under it; turning a
  wheel afterwards goes back to that entry's start (Nov 24, 2026.11.24.11). Search swaps to the result list; the filter limits
  the wheels to one section. **Typed references** in the Contents search of a Bible ("jn 3:16", "rev 22 3",
  "1 cor 13", "ps 23", "jude") put "Go to …" first. Earlier spine versions (drag, step-sideways, pointer-style
  speed) are in DECISIONS.md.
- Notes tab → Bookmarks: **swipe left to delete**, with Undo (built Nov 16). In a book, bookmark lines in the contents have an ×.
- A highlight must be able to stop right before a dash (dash-joined words are separate words).

## Reading time and stats

- Idle limit (3/5/10 min, default 5) with partial credit; pages capped at about 2× normal time; touches, highlights,
  lookups and notes count as activity; the clock pauses on app switch/lock/close; "Still reading?" after 10 min
  untouched in auto-scroll/Speed; the last page counts on close.
- Daily reading goal; year-in-books stats with a yearly goal; tap the bottom line to switch what it shows (time left
  in chapter / book, location).

## Backup

- Dated safety-net copies are fine. Backups include reading settings and app settings (restore offers to apply them).

## Read aloud

- The speaker button opens an audio bar in place of the auto-scroll controls, **without playing**. Tap a word to
  choose where to start, then play; tap a word while playing to jump. Skip sentence back/forward, live speed, a Voice
  button. Controls stay on screen while voice mode is on. In Scroll, the spoken word stays in the middle of the screen.
- Two voice types: **Natural** (Piper, runs on the phone, each voice downloads once, about 60 MB; default Lessac)
  and **iPhone** (the system voices, de-duplicated). Settings → Storage has "Remove all downloaded voices".
- Goal: the most natural-sounding voice for free, usable by anyone with the link, without leaving the phone on for
  hours. Rejected: Kokoro (too slow on his iPhone, ~2× real time even with WebGPU), Supertonic (too slow),
  Kokoro on Modal (needs a credit card), anything needing a private GitHub setup for other users.
- What it says:
  - Scripture references in full: "Isaiah chapter 26 verse 8"; ranges "Philippians chapter 3 verses 7 through 8";
    book abbreviations expanded (Isa. → Isaiah); never says "colon"; never breaks a reference across sentences.
  - Initialisms letter by letter (NIV, NASB, KJV, NKJV, ESV, LSB, CIA, FBI, NSA…); acronyms said as words (NASA,
    FEMA, PETA…).
  - Footnote markers and footnotes are skipped.
- Pauses: a short pause before "(" and after ")"; en and em dashes pause like a comma; semicolons like a period; an
  ellipsis in any form (..., . . ., …) is one pause; longer pauses before/after headings and between paragraphs.
  Live reading has no added pause between sentences (the clip switch is the pause); he found 350 ms and 180 ms too
  long. Long sentences are split at a comma, semicolon, colon or dash, never mid-phrase. Speed is applied when the
  voice makes the speech (not by speeding up playback). He declined reducing Piper's natural variation.
- **Listen offline** (built Nov 13): download a book's audio with the chosen natural voice (made on the phone while
  Tooz is open; screen kept awake; resumes where it left off). Saved audio plays with the screen locked, with
  lock-screen controls, and highlights words. "Save as audio files" exports one MP3 per chapter through the share
  menu, to play in other apps even with Tooz closed. True "app closed" playback is only possible via those files.
