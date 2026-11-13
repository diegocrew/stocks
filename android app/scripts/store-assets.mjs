import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { POLICY_DATE, SUPPORT_EMAIL, privacySections } from '../src/privacy.ts';

await mkdir(new URL('../store/', import.meta.url), { recursive: true });

for (const [file, size] of [['assets/stock-atlas-icon.png', 1024], ['store/play-icon.png', 512]]) {
  const image = await sharp(await readFile(new URL('../assets/stock-atlas.svg', import.meta.url)))
    .resize(size, size).png().toBuffer();
  await writeFile(new URL(`../${file}`, import.meta.url), image);
}
await writeFile(new URL('../store/feature.png', import.meta.url),
  await sharp(await readFile(new URL('../store/feature.svg', import.meta.url))).png().toBuffer());

const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const sections = privacySections.map(section => `<section><h2>${escape(section.title)}</h2><p>${escape(section.text)}</p></section>`).join('\n');
await writeFile(new URL('../store/privacy.html', import.meta.url), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Stock Atlas Privacy Policy</title>
<style>body{max-width:760px;margin:40px auto;padding:0 20px;font:18px/1.6 system-ui;color:#172131;background:#fff}h1,h2{line-height:1.2}a{color:#0645ad}</style>
</head><body><main><h1>Stock Atlas Privacy Policy</h1><p>Effective ${POLICY_DATE}</p>
${sections}
<p>Contact: <a href="mailto:${escape(SUPPORT_EMAIL)}">${escape(SUPPORT_EMAIL)}</a></p>
</main></body></html>\n`);

const listing = await readFile(new URL('../store/listing.txt', import.meta.url), 'utf8');
const short = listing.match(/^Short description: (.+)$/m)?.[1];
if (!short || short.length > 80) throw new Error('Store short description must be 1-80 characters.');
console.log('Generated app icon, 512px store icon and privacy page; store short description fits the 80-character limit.');
