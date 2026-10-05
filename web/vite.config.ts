import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { renderCommunity, renderMarkdown } from '../scripts/community.mjs';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  logLevel: 'warn',
  plugins:[{
    name:'angouri-content',
    async transformIndexHtml(html) {
      const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
      const changelog=await readFile(new URL('../CHANGELOG.md',import.meta.url),'utf8');
      if(!changelog.includes(`## ${pkg.version} — `))throw Error(`CHANGELOG.md needs an entry for ${pkg.version}`);
      html=html.replaceAll('%ANGOURI_VERSION%',pkg.version);
      if(html.includes('<!-- community-about -->'))html=html.replace('<!-- community-about -->',await renderCommunity());
      return html.replace('<!-- release-notes -->',renderMarkdown(changelog.replace(/^# Version log\s*/,'')));
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
