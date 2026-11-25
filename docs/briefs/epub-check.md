# Brief: full ePub support check (Nov 24 backlog item 6)

Port **8755**. Read `_common.md` first. Investigation first, then small fixes. Cross-references are done (don't
touch them).

## Task
1. Make a set of small test EPUBs (extend `tests/feature/mk_rich.py` or write `tests/feature/mk_epubcheck.py`, commit
   the generated `.epub`s under `tests/feature/`) covering common ePub features: EPUB 2 (NCX) and EPUB 3 (nav) contents
   incl. nested levels and a nav that points mid-file (#fragment); ordered/unordered/nested lists; tables; images
   (jpg/png/svg, inline `<svg><image>`, cover image); figure/figcaption; blockquote and poetry (line breaks `<br>`,
   indented lines); headings h1–h6; footnotes/endnotes (epub:type noteref/footnote, aside, back-links); internal links
   to other chapters; sub/sup; small caps; drop caps (`::first-letter` / span); `<pre>`/code; ruby; `dir="rtl"` /
   `lang`; non-linear spine items (`linear="no"`); embedded fonts (already supported — just confirm); page-list /
   page breaks (`epub:type="pagebreak"`); MathML (just shouldn't break); a chapter with only an image.
2. Import each in the app (see `parseEpub`/`parseFile` in `c_js1.js`; tests show how to add a file, e.g.
   `tests/feature/fn.js`) and check text, structure, contents, links, pictures in Pages and Scroll mode. Screenshot
   anything doubtful to your scratch dir and look.
3. Write the findings to `docs/briefs/epub-check-findings.md`: a table of feature → works / gap (what goes wrong) /
   fixed. 
4. **Fix gaps that are clearly bugs and small** (roughly ≤40 lines each, in import or rendering, no new UI): e.g. text
   lost, wrong order, broken link, missing contents entry. Add each to a test `tests/feature/epubcheck.js`
   (one PASS line per feature). **Don't fix** anything that needs new UI or big work (e.g. tables layout redesign,
   RTL layout); list it under "Needs a decision" with a one-line size estimate.

## Done when
- Findings file written, small fixes committed with `epubcheck.js` passing; `smoke.js`, `fn.js`, `bibles.js`,
  `toc.js` pass.
