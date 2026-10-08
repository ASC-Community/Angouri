import { writeFile, mkdir } from 'node:fs/promises';
import { BRAND_METRICS, brandFontLicense, brandWordmarkSvg } from './brand-wordmark.mjs';

// Website and community exports use one offline outline generator. No preview
// server, browser or font download is needed.
const output=new URL('../artifacts/branding/',import.meta.url);
await mkdir(output,{recursive:true});
await writeFile(new URL('angouri.svg',output),`${await brandWordmarkSvg({color:'rgb(42, 67, 52)',standalone:true})}\n`);
await writeFile(new URL('angouri-dark.svg',output),`${await brandWordmarkSvg({color:'#edf3e2',standalone:true})}\n`);
await writeFile(new URL('NOTICE.md',output),`# Angouri wordmark

Generated offline from the same bundled KaTeX font and canonical cucumber drawing used by the website build, through \`scripts/brand-wordmark.mjs\` and \`scripts/export-brand.mjs\` in [ASC-Community/Angouri](https://github.com/ASC-Community/Angouri). The dark-background variant changes only the lettering and dot color. The SVGs contain paths, with no embedded font or external resources.

Letter outlines are derived from KaTeX_Main-Italic distributed with [KaTeX](https://github.com/KaTeX/KaTeX). The font's notice is:

${await brandFontLicense()}

To regenerate, run \`npm run export:brand\`. Review the files in \`artifacts/branding/\` and copy them here.
`);
console.log(JSON.stringify({output:output.pathname,wordmark:BRAND_METRICS.word,width:BRAND_METRICS.width,height:BRAND_METRICS.height,externalResources:0,browser:false}));
