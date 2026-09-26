# Browser-local document readers

These pinned, unmodified browser distributions are loaded only when their format is imported. Documents stay in the browser; there is no CDN dependency or document upload.

- Mozilla **PDF.js / pdfjs-dist 6.3.289**, Apache-2.0. `pdf.mjs` and `pdf.worker.mjs` from [the official npm package](https://www.npmjs.com/package/pdfjs-dist). [Project and API](https://mozilla.github.io/pdf.js/).
- **fflate 0.8.3**, MIT. `esm/browser.js`, renamed `fflate.mjs`, from [the official npm package](https://www.npmjs.com/package/fflate). [Project and API](https://github.com/101arrowz/fflate).

The prefixed LICENSE and PACKAGE.json files include upstream licenses, pinned versions, source tarball URLs and SHA-512 integrity. The source tarball integrity was verified before extracting these files.

PDF import extracts existing selectable text; it does not perform OCR. Encrypted PDFs/EPUB text are unsupported. DOCX/EPUB markup is parsed as inert XML and only plain text is used by the game.
