# Brief: Storage panel — one list, swipe to delete (Mick chose this, Nov 25)

Port **8752**. Read `_common.md` first. Medium change.

## What Mick asked
Settings → Storage should show everything the app keeps on the device and let him delete what he chooses, down to a
single book.

## Design (decided)
- Replace `storageSheet` (`g_extra.js`) with one list of everything stored, **biggest first**, each row: name,
  small kind line, size (mono, right). Kinds:
  - each downloaded **book** (text, pictures, fonts — `bookBytes(id)`);
  - each book's **saved audio** (Listen offline, OPFS `audiobooks/<id>`; see `j_audiobook.js` `AB`, `abDelete`);
  - each downloaded **voice** (OPFS `piper`; group files by voice so one row = one voice; see `h_voice.js` `PIP_VOICES`);
  - one non-deletable row "Notes, highlights, settings and reading log" with its size (as today), shown last, no swipe.
- Above the list: one line with the phone's total (as `#storeUse` does) — nothing more.
- **Swipe left → Delete** on any row, exactly like Notes → Bookmarks: reuse `swipeRows` (`f_js3.js`). After delete
  the row collapses out (height to 0, ~220 ms) and a toast with **Undo** appears.
  - Undo must really work: delay the actual delete until the toast is gone (keep the row's data; delete on toast
    timeout/dismiss), or restore from a kept copy. Pick the simplest safe one; never lose data if he taps Undo.
  - **Book**: a starter-shelf book (one that can be fetched again, see `SHELF`/`fetchText`/`pending`) loses only its
    download: it stays on the shelf, shows as not downloaded, keeps highlights/bookmarks/progress, downloads again when
    opened. A book he added himself is removed from the library like the existing delete (`removeBook`) — that loses
    its highlights, so its toast says "Deleted <title>" and Undo must restore it fully.
  - **Saved audio**: deletes that book's audio only (stop playback first if it's playing that book).
  - **Voice**: deletes that voice's files; it downloads again next time it's used.
- Keep the existing "Remove all downloaded voices" / "remove all saved audio" buttons in Settings only if they still
  earn their place; if the new list covers them, remove them (less on screen). Settings → Storage keeps one entry
  that opens this list.
- Sheet title: "Storage".

## Done when
- Test `tests/feature/storage.js`: with two books (one shelf, one added), fake saved audio (write a small file into OPFS
  `audiobooks/<id>/`) and a fake voice file in OPFS `piper/`, the list shows all of them sorted by size; swipe-delete
  each kind; Undo restores; shelf book stays in `LIB` as not downloaded and reopens; added book is gone after the toast.
- `smoke.js`, `bmswipe.js`, `stgone.js` pass.
