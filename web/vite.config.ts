import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { posix } from 'node:path';
import { renderCommunity, renderMarkdown } from '../scripts/community.mjs';
import { brandWordmarkSvg, injectBrandWordmark, injectLoadingCucumber, loadingCucumberSvg } from '../scripts/brand-wordmark.mjs';

// The former live KaTeX wordmark started the main fonts as soon as the app ran.
// The outlined wordmark no longer does, so preload those plus the math italic
// used by the opening formulas instead of making the first notation wait.
const openingKatexFonts=['KaTeX_Main-Italic','KaTeX_Main-Regular','KaTeX_AMS-Regular','KaTeX_Math-Italic'];
const fontPreloads=(html:string,fonts:string[])=>html.replace('</head>',`${fonts.map(href=>`  <link rel="preload" href="${href}" as="font" type="font/woff2" crossorigin>`).join('\n')}\n</head>`);
const webRoot=fileURLToPath(new URL('.',import.meta.url));
export default defineConfig({
  root: webRoot,
  base: './',
  logLevel: 'warn',
  plugins:[{
    name:'angouri-content',
    transformIndexHtml:{
      order:'post',
      async handler(html,context) {
        const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
        const changelog=await readFile(new URL('../CHANGELOG.md',import.meta.url),'utf8');
        if(!changelog.includes(`## ${pkg.version} — `))throw Error(`CHANGELOG.md needs an entry for ${pkg.version}`);
        html=html.replaceAll('%ANGOURI_VERSION%',pkg.version);
        html=injectBrandWordmark(html,await brandWordmarkSvg());
        const htmlFile=posix.relative(webRoot.replaceAll('\\','/'),context.filename.replaceAll('\\','/'));
        if(htmlFile==='index.html')html=injectLoadingCucumber(html,await loadingCucumberSvg());
        if(htmlFile==='index.html'&&context.server)html=fontPreloads(html,openingKatexFonts.map(name=>encodeURI(`/@fs${fileURLToPath(new URL(`../node_modules/katex/dist/fonts/${name}.woff2`,import.meta.url))}`)));
        else if(htmlFile==='index.html'&&context.bundle) {
          const fonts=openingKatexFonts.map(name=>{
            const file=Object.keys(context.bundle!).find(candidate=>candidate.endsWith('.woff2')&&candidate.includes(name));
            if(!file)throw Error(`Vite did not emit the expected ${name} font`);
            return file;
          });
          const directory=posix.dirname(htmlFile);
          html=fontPreloads(html,fonts.map(file=>{
            const href=posix.relative(directory,file);return href.startsWith('.')?href:`./${href}`;
          }));
        }
        if(html.includes('<!-- community-about -->'))html=html.replace('<!-- community-about -->',await renderCommunity());
        return html.replace('<!-- release-notes -->',renderMarkdown(changelog.replace(/^# Version log\s*/,'')));
      }
    }
  }],
  build: {
    outDir: '../dist', emptyOutDir: true, target: 'es2022',
    rollupOptions: { input: {
      game: fileURLToPath(new URL('index.html',import.meta.url)),
      about: fileURLToPath(new URL('about/index.html',import.meta.url))
    } }
  }
});
