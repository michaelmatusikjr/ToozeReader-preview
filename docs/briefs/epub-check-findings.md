# ePub support check: findings

Test books: `tests/feature/mk_epubcheck.py` makes `epubcheck3.epub` (EPUB 3, nav), `epubcheck2.epub` (EPUB 2, NCX) and
`epubcheck_edge.epub` (odd file names, entities, soft hyphens, nav in a sub-folder, picture-only last chapter).
Checked in Pages and Scroll mode (screenshots looked at). Test: `tests/feature/epubcheck.js` (one PASS line per feature).

| Feature | Result |
|---|---|
| EPUB 3 nav and EPUB 2 NCX contents, nested levels | works (identical results for both) |
| Contents entry pointing mid-file (#fragment) | works |
| Contents entry whose id is percent-encoded (`#%E4%B8%80`) | gap, **fixed** (landed at start of the file) |
| Nav group heading with no link (`<span>` + nested `<ol>`) | gap, **fixed** (heading was dropped; children showed with no parent) |
| Last chapter that is only a picture: contents entry | gap, **fixed** (entry was dropped; its index equalled the word count) |
| Image-only chapter in the middle; cover image; image-only chapter shown | works |
| File and folder names with spaces / `%20`, nav in another folder | works |
| Entities (`&nbsp; &mdash; &copy;`, forces HTML fallback parse) | works |
| Headings h1 to h6 | works |
| Line break inside a title (`Part<br/>One`) | gap, **fixed** (became two headings; now one) |
| Unordered lists, nested lists: text and order | works (bullets; nesting shown flat, see below) |
| Blockquote | works |
| Poetry with `<br>`, indented lines | works for text and line order; indent lost (see below) |
| `<pre>` / `<code>` | works |
| sub / sup | works |
| Small caps, drop caps (span and `::first-letter`) | works as plain words (look not reproduced; drop-cap letter joins its word) |
| Ruby | works: base text kept, readings skipped |
| MathML | does not break; the formula is skipped (see below) |
| `lang`, `dir="rtl"` text | text kept; direction not applied (see below) |
| Pictures: png, jpg, svg file, inline `<svg><image>`, figure + figcaption | works (several in a row show in order) |
| Embedded font | works |
| Footnotes, endnotes (`epub:type` noteref/footnote, aside, in other file), number links back | works |
| Back-link arrow in a note body (`epub:type="backlink"`, `↩`) | gap, **fixed** (read as a word) |
| Printed page breaks with text (`<span epub:type="pagebreak">8</span>`) | gap, **fixed** (page number glued onto the next word: "8eight") |
| Page-list nav | works (ignored; the ids still work as link targets) |
| Soft hyphens (`&shy;`) | gap, **fixed** (stayed inside words: broke search and read aloud). Screen hyphenation is automatic anyway |
| Internal links to other chapters | text kept; cross-references were left alone as asked |
| Tables | text all kept, but see below |
| Non-linear spine items | read inline at their spine position (see below) |

## Fixed (all in `src/c_js1.js`: `walkHTML`, nav/NCX reading in `parseEpub`)
Page-break markers and back-link arrows skipped; soft hyphens stripped; `<br>` inside a heading joins it; percent-encoded
fragment ids found; group headings without a link kept; trailing picture-only chapter keeps its contents entry.

## Needs a decision (not fixed)
- **Ordered list numbers**: `<ol>` items show as bullets (1., 2., 3. lost), and nesting is flat. Small to medium (~30
  lines): store list type/level on the block, number with CSS counters; page breaks mid-list need care.
- **Tables**: every cell becomes its own line (row/column structure lost). Real layout is a new design: medium to large.
  A cheap middle path (join a row's cells with " | ") is small but still a choice about how it should look.
- **Poetry indent** and verse line spacing: lines become separate paragraphs with no indent. Small if a "verse" block
  type is wanted (indent from `margin-left`/class), but it needs a look decision.
- **Inline pictures** (a small glyph or math image in the middle of a sentence): the paragraph splits in two around a
  centered figure. Fixing needs image size detection (decode dimensions at import) and drawing inline: medium.
- **RTL** (`dir="rtl"`, Arabic/Hebrew): text is kept and shows, but right-to-left alignment and direction are not
  applied, and word-by-word modes assume left-to-right. Medium to large.
- **MathML**: skipped silently, so "x = 2" disappears from the sentence. Small if we read its text content
  (`<mi>x</mi><mo>=</mo>` gives "x = 2"); better rendering is large.
- **Non-linear spine items** (`linear="no"`): imported inline at their position. Correct for endnotes that are linked,
  but a cover/ad page marked non-linear shows up mid-flow. Small either way; needs a choice (hide unless linked to).
- **Small caps and drop caps** look: not reproduced. Not worth doing (matches "minimum on screen").
- **Scroll mode opening at word 0** hides a cover picture above the first word (Pages shows it). Reached by scrolling up;
  left as is.

## Follow-up (done)
- **Ordered lists**: each `<ol>` item gets its number as a real first word ("1.", honours `start`, `value`, `type` a/A/i/I).
  List items get a nesting level (block field `d`, 1 to 3) shown as a left margin; `<ol>` blocks carry `o:1` (no bullet).
- **MathML**: read as text in the sentence ("x = 2"); `annotation` duplicates skipped; no rendering.
- **Poetry**: lines split by `<br>` get `v:1` (no first-line indent, left aligned); inline `margin-left`/`padding-left`, class `i1`..`i3`
  and (on spans) `indent`/`indentN` give `d`. Classes only indent from the book's own stylesheet are not read.
- Block fields `d`, `o`, `v` are import-time only; rendered in `blockHTML` (`e_reader.js`), CSS next to `.bli` in `a_head.html`.
