import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import opentype from 'opentype.js';
import config from '../playwright.config.mjs';

// Export the actual built wordmark, including its CSS placement, as standalone
// paths. GitHub image rendering then needs neither KaTeX nor a font download.
const browser=await chromium.launch({...config.projects[0].use.launchOptions,headless:true});
const output=new URL('../artifacts/branding/',import.meta.url);
try {
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.goto(new URL('/about/',process.env.ANGOURI_PREVIEW_URL||'http://127.0.0.1:4174').href);
  await page.locator('.brand .mathit').waitFor();
  await page.evaluate(()=>document.fonts.ready);
  const layout=await page.locator('.brand').evaluate(brand=>{
    const rect=brand.getBoundingClientRect(),math=brand.querySelector('.mathit');
    const probe=document.createElement('span');
    probe.style.cssText='display:inline-block;width:0;height:0;vertical-align:baseline';
    math.append(probe);
    const baseline=probe.getBoundingClientRect().top-rect.top;
    probe.remove();
    const i=brand.querySelector('.brand-i'),iRect=i.getBoundingClientRect(),iStyle=getComputedStyle(i);
    const drawing=i.querySelector('.brand-cucumber'),img=getComputedStyle(drawing),dot=getComputedStyle(i.querySelector('.brand-dot'));
    return {
      width:rect.width,height:rect.height,text:math.textContent,x:math.getBoundingClientRect().left-rect.left,baseline,
      fontSize:parseFloat(getComputedStyle(math).fontSize),color:getComputedStyle(math).color,
      i:{cx:(iRect.left+iRect.right)/2-rect.left,cy:(iRect.top+iRect.bottom)/2-rect.top,width:parseFloat(iStyle.width),height:parseFloat(iStyle.height),transform:iStyle.transform},
      img:{x:parseFloat(img.left),y:parseFloat(img.top),width:parseFloat(img.width),height:parseFloat(img.height),artwork:drawing.innerHTML.replace(/[ \t]+$/gm,'')},
      dot:{x:parseFloat(dot.left),y:parseFloat(dot.top),width:parseFloat(dot.width),height:parseFloat(dot.height)}
    };
  });
  const bytes=await readFile(new URL('../node_modules/katex/dist/fonts/KaTeX_Main-Italic.ttf',import.meta.url));
  const font=opentype.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  const lettering=font.getPath(layout.text,layout.x,layout.baseline,layout.fontSize).toPathData(3);
  const {i,img,dot}=layout;
  const matrix=i.transform.replace(/^matrix\(|\)$/g,'');
  const svg=color=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-labelledby="title">
  <title id="title">Angouri</title>
  <metadata>Exported from Angouri's shared web wordmark and cucumber.svg. Lettering: KaTeX_Main-Italic (SIL Open Font License 1.1), converted to paths. See NOTICE.md.</metadata>
  <path d="${lettering}" fill="${color}"/>
  <g transform="translate(${i.cx} ${i.cy}) matrix(${matrix}) translate(${-i.width/2} ${-i.height/2})">
    <g transform="translate(${img.x} ${img.y}) scale(${img.width/64} ${img.height/64})">${img.artwork}</g>
    <ellipse cx="${dot.x+dot.width/2}" cy="${dot.y+dot.height/2}" rx="${dot.width/2}" ry="${dot.height/2}" fill="${color}"/>
  </g>
</svg>\n`;
  await mkdir(output,{recursive:true});
  await writeFile(new URL('angouri.svg',output),svg(layout.color));
  await writeFile(new URL('angouri-dark.svg',output),svg('#edf3e2'));
  const names=font.names.windows||font.names.unicode;
  await writeFile(new URL('NOTICE.md',output),`# Angouri wordmark\n\nGenerated from the shared website wordmark and canonical cucumber drawing by \`scripts/export-brand.mjs\` in [ASC-Community/Angouri](https://github.com/ASC-Community/Angouri). The dark-background variant changes only the lettering and dot color. The SVGs contain paths, with no embedded font or external resources.\n\nLetter outlines are derived from KaTeX_Main-Italic distributed with [KaTeX](https://github.com/KaTeX/KaTeX). The font's notice is:\n\n${names.license.en}\n\nTo regenerate, build and serve the Angouri website, then run \`npm run export:brand\`. Review the files in \`artifacts/branding/\` and copy them here.\n`);
  console.log(JSON.stringify({output:output.pathname,wordmark:layout.text,width:layout.width,height:layout.height,externalResources:0}));
} finally {await browser.close();}
