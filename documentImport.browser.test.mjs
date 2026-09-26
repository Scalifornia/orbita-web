/** Optional real-browser format checks: ORBITA_PLAYWRIGHT_PATH=/path/to/playwright/index.mjs node --test documentImport.browser.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, sep } from 'node:path';
import { zipSync, strToU8 } from './vendor/fflate.mjs';

const archive = (entries) => Array.from(zipSync(Object.fromEntries(Object.entries(entries).map(([name, text]) => [name, strToU8(text)]))));
function pdfFixture() {
  const stream = 'BT /F1 16 Tf 70 740 Td (A local document.) Tj 0 -24 Td (Read every word.) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let text = '%PDF-1.4\n', offsets = [0];
  objects.forEach((object, i) => { offsets.push(text.length); text += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = text.length;
  text += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Array.from(new TextEncoder().encode(text));
}

test('real browser locally imports PDF, DOCX and EPUB without fetching embedded resources', { skip: !process.env.ORBITA_PLAYWRIGHT_PATH }, async () => {
  const { chromium } = await import(pathToFileURL(process.env.ORBITA_PLAYWRIGHT_PATH).href);
  const root = fileURLToPath(new URL('.', import.meta.url));
  const server = createServer(async (request, response) => {
    try {
      if (request.url === '/') { response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><title>Document format tests</title>'); return; }
      const path = resolve(root, `.${new URL(request.url, 'http://localhost').pathname}`);
      if (!path.startsWith(root.endsWith(sep) ? root : root + sep)) { response.writeHead(403); response.end(); return; }
      response.setHeader('Content-Type', path.endsWith('.mjs') ? 'text/javascript' : 'text/plain');
      response.end(await readFile(path));
    } catch { response.writeHead(404); response.end(); }
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const browser = await chromium.launch({ headless: true, ...(process.env.ORBITA_CHROME_PATH ? { executablePath: process.env.ORBITA_CHROME_PATH } : {}) });
  try {
    const page = await browser.newPage();
    const externalRequests = [];
    page.on('request', (request) => { if (!request.url().startsWith('http://127.0.0.1:')) externalRequests.push(request.url()); });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const docx = archive({
      'word/document.xml': '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Capítulo 1</w:t></w:r></w:p><w:p><w:r><w:t>Olá, floresta!</w:t></w:r></w:p><w:p><w:r><w:t>A raposa &amp; o leão.</w:t></w:r><w:del><w:r><w:t>REMOVED</w:t></w:r></w:del></w:p></w:body></w:document>',
      'docProps/core.xml': '<core xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Livro local</dc:title></core>',
    });
    const epub = archive({
      mimetype: 'application/epub+zip',
      'META-INF/container.xml': '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>',
      'OPS/book.opf': '<package xmlns="http://www.idpf.org/2007/opf"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Aventura EPUB</dc:title></metadata><manifest><item id="b" href="b.xhtml" media-type="application/xhtml+xml"/><item id="a" href="a.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="a"/><itemref idref="b"/></spine></package>',
      'OPS/a.xhtml': '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Primeiro</title></head><body><h1>Capítulo I</h1><p>Primeiro parágrafo.</p><p>Segundo parágrafo, com emoção!</p><script>throw new Error("not executed")</script><img src="https://example.invalid/never-fetch.png"/></body></html>',
      'OPS/b.xhtml': '<html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Capítulo II</h1><p>O fim.</p><nav>Ignore navigation</nav></body></html>',
    });
    const result = await page.evaluate(async ({ docx, epub, pdf }) => {
      const { importDocument } = await import('/documentImport.mjs');
      const run = async (name, data) => importDocument(new File([new Uint8Array(data)], name));
      return { docx: await run('livro.docx', docx), epub: await run('livro.epub', epub), pdf: await run('livro.pdf', pdf) };
    }, { docx, epub, pdf: pdfFixture() });
    assert.equal(result.docx.title, 'Livro local');
    assert.equal(result.docx.sections[0].title, 'Capítulo 1');
    assert.equal(result.docx.sections[0].text, 'Olá, floresta!\n\nA raposa & o leão.');
    assert.deepEqual(result.epub.sections.map((section) => section.title), ['Capítulo I', 'Capítulo II']);
    assert.equal(result.epub.sections[0].text, 'Primeiro parágrafo.\n\nSegundo parágrafo, com emoção!');
    assert.equal(result.epub.title, 'Aventura EPUB');
    assert.match(result.pdf.text, /A local document\.\s+Read every word\./u);
    assert.equal(result.pdf.sections[0].kind, 'page');
    assert.deepEqual(externalRequests, []);
  } finally { await browser.close(); await new Promise((done) => server.close(done)); }
});
