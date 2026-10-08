import { readFile } from 'node:fs/promises';
import opentype from 'opentype.js';

// Normalized measurements of the reviewed 30px KaTeX/CSS wordmark. Website
// builds and outlined exports share this baseline and optical cucumber layout.
export const BRAND_METRICS=Object.freeze({
  word:'angour',width:102.09375,height:38,fontSize:30,baseline:27,
  cucumber:{cx:95.6015625,cy:15,width:12.9844,height:24,rotation:[.987659,.156618,-.156618,.987659,0,0],x:-1.33938,y:8.09265,size:17.9531},
  dot:{cx:8.81478,cy:6.3072,r:1.5}
});

const fontUrl=new URL('../node_modules/katex/dist/fonts/KaTeX_Main-Italic.ttf',import.meta.url);
const cucumberUrl=new URL('../web/public/cucumber.svg',import.meta.url);

async function font() {
  const bytes=await readFile(fontUrl);
  return opentype.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
}

async function cucumberArtwork(idPrefix,{stem=true}={}) {
  const source=await readFile(cucumberUrl,'utf8');
  const contents=source.replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
  return (stem?contents:contents.replace(/\s*<path\b[^>]*data-cucumber-part=["']stem["'][^>]*\/>/,''))
    .replace('id="skin"',`id="${idPrefix}-skin"`)
    .replaceAll('url(#skin)',`url(#${idPrefix}-skin)`)
    .replace(/[ \t]+$/gm,'').trim();
}

const attribute=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');

/** Generate the reviewed wordmark from the bundled font and canonical art. */
export async function brandWordmarkSvg({color='currentColor',standalone=false}={}) {
  const [typeface,artwork]=await Promise.all([font(),cucumberArtwork('brand-cucumber',{stem:false})]);
  const m=BRAND_METRICS,c=m.cucumber,d=m.dot;
  const lettering=typeface.getPath(m.word,0,m.baseline,m.fontSize).toPathData(3);
  const accessible=standalone?'role="img" aria-labelledby="brand-title"':'aria-hidden="true" focusable="false"';
  const title=standalone?'\n  <title id="brand-title">Angouri</title>\n  <metadata>Generated from Angouri cucumber.svg and KaTeX_Main-Italic outlines. See NOTICE.md.</metadata>':'';
  const fit=standalone?'xMidYMid meet':'xMinYMin slice';
  return `<svg xmlns="http://www.w3.org/2000/svg" class="brand-wordmark" viewBox="0 0 ${m.width} ${m.height}" preserveAspectRatio="${fit}" ${accessible}>${title}
  <path class="brand-lettering" data-brand-text="${m.word}" d="${lettering}" fill="${attribute(color)}"/>
  <g class="brand-i" transform="translate(${c.cx} ${c.cy}) matrix(${c.rotation.join(' ')}) translate(${-c.width/2} ${-c.height/2})">
    <svg class="brand-cucumber" x="${c.x}" y="${c.y}" width="${c.size}" height="${c.size}" viewBox="0 0 64 64" overflow="visible">${artwork}</svg>
    <circle class="brand-dot" cx="${d.cx}" cy="${d.cy}" r="${d.r}" fill="${attribute(color)}"/>
  </g>
</svg>`;
}

/** Inline the canonical mascot so the initial loading state needs no image request. */
export async function loadingCucumberSvg() {
  const artwork=await cucumberArtwork('loading-cucumber');
  return `<svg xmlns="http://www.w3.org/2000/svg" class="loading-cucumber" width="56" height="56" viewBox="0 0 64 64" aria-hidden="true" focusable="false">${artwork}</svg>`;
}

export function injectBrandWordmark(html,wordmark) {
  const marker=/(<a class="brand"[^>]*>)Angouri(<\/a>)/;
  if(!marker.test(html))throw Error('Expected an Angouri brand anchor in the HTML entry');
  return html.replace(marker,`$1${wordmark}$2`);
}

export function injectLoadingCucumber(html,cucumber) {
  const marker='<!-- loading-cucumber -->';
  if(!html.includes(marker))throw Error('Expected a loading cucumber marker in the game entry');
  return html.replace(marker,cucumber);
}

export async function brandFontLicense() {
  const names=(await font()).names;
  return (names.windows||names.unicode).license.en;
}
