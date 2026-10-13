import { writeFile, mkdir, rm } from 'node:fs/promises';
import { BRAND_METRICS, brandFontLicense, brandWordmarkSvg } from './brand-wordmark.mjs';
import { launchChromium } from './browser.mjs';

// Website and community exports use one offline outline generator. Chromium
// renders both review previews from these exact SVGs; no server is needed.
const output=new URL('../artifacts/branding/',import.meta.url);
await mkdir(output,{recursive:true});
const variants=[
  {svg:'angouri.svg',preview:'angouri-light-preview.png',color:'rgb(42, 67, 52)',background:'#f4f7e9'},
  {svg:'angouri-dark.svg',preview:'angouri-dark-preview.png',color:'#edf3e2',background:'#16251c'}
];
// A failed export must not leave previews from a different artwork revision.
await Promise.all(variants.map(variant=>rm(new URL(variant.preview,output),{force:true})));
for(const variant of variants) {
  variant.source=`${await brandWordmarkSvg({color:variant.color,standalone:true})}\n`;
  await writeFile(new URL(variant.svg,output),variant.source);
}
await writeFile(new URL('NOTICE.md',output),`# Angouri wordmark

Generated offline from the same bundled KaTeX font and canonical cucumber drawing used by the website build, through \`scripts/brand-wordmark.mjs\` and \`scripts/export-brand.mjs\` in [ASC-Community/Angouri](https://github.com/ASC-Community/Angouri). The dark-background variant changes only the lettering and dot color. The SVGs contain paths, with no embedded font or external resources.

Letter outlines are derived from KaTeX_Main-Italic distributed with [KaTeX](https://github.com/KaTeX/KaTeX). The font's notice is:

${await brandFontLicense()}

To regenerate, run \`npm run export:brand\` with Playwright's Chromium installed. The command also renders fresh light/dark PNG previews from these SVGs. Review the files in \`artifacts/branding/\` and copy the SVGs and notice here.
`);
const browser=await launchChromium();
try {
  const page=await browser.newPage({viewport:{width:1800,height:600},deviceScaleFactor:1});
  for(const variant of variants) {
    const source=Buffer.from(variant.source).toString('base64');
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;background:${variant.background}}body{display:grid;place-items:center}img{display:block;width:1280px;height:auto}</style><img src="data:image/svg+xml;base64,${source}" alt="Angouri">`);
    await page.locator('img').evaluate(image=>image.decode());
    variant.image=await page.screenshot();
  }
  await Promise.all(variants.map(variant=>writeFile(new URL(variant.preview,output),variant.image)));
} finally {await browser.close();}
console.log(JSON.stringify({output:output.pathname,wordmark:BRAND_METRICS.word,width:BRAND_METRICS.width,height:BRAND_METRICS.height,externalResources:0,previews:variants.map(variant=>variant.preview),browser:'chromium'}));
