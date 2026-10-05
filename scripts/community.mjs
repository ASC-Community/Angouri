import { readFile } from 'node:fs/promises';
import { Marked, Renderer } from 'marked';

export const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const renderer=new Renderer();
// The README supplies prose. Badges use one site-owned template per repository.
renderer.html=({text})=>/^<span lang="el">$|^<\/span>$/.test(text)?text:'';
renderer.image=()=>'';
renderer.link=function({href,tokens}) {
  const label=this.parser.parseInline(tokens);
  if(!label.trim())return '';
  try {if(['https:','http:','mailto:'].includes(new URL(href).protocol))return `<a href="${escapeHtml(href)}">${label}</a>`;}catch{}
  return label;
};
const markdown=new Marked({renderer});
export const renderMarkdown=text=>markdown.parse(text);

export function parseCommunity(text) {
  const sections={intro:[],projects:[],people:[],contributions:[]};
  let section='intro';
  for(const token of markdown.lexer(text)) {
    if(token.type==='heading'&&token.depth===1)continue;
    if(token.type==='heading'&&token.depth===2) {
      section=token.text.toLowerCase();
      if(!(section in sections))throw Error(`Unknown community section: ${token.text}`);
    } else sections[section].push(token);
  }
  for(const key of Object.keys(sections))if(!sections[key].some(token=>token.type!=='space'&&token.type!=='html'))throw Error(`Missing community section: ${key}`);
  return sections;
}

export function parseProjects(text) {
  const tokens=markdown.lexer(text),projects=[];
  let inside=false,current;
  for(const token of tokens) {
    if(token.type==='heading'&&token.depth===2) {
      if(inside)break;
      inside=token.text.trim()==='Projects';continue;
    }
    if(!inside)continue;
    if(token.type==='heading'&&token.depth===3) {
      const name=token.text.replace(/!\[[^\]]*\]\([^)]*\)/g,'').trim();
      current={name,tokens:[]};projects.push(current);
    } else if(current)current.tokens.push(token);
  }
  if(!projects.length)throw Error('The organization README has no Projects section with project headings.');
  for(const project of projects) {
    markdown.walkTokens(project.tokens,token=>{
      if(!project.repo&&token.type==='link'&&/^https:\/\/github\.com\/[^/]+\/[^/#?]+\/?$/i.test(token.href))project.repo=token.href;
    });
    if(!project.name||!project.repo||!project.tokens.some(token=>token.type==='paragraph'))throw Error(`Incomplete community project: ${project.name}`);
  }
  if(new Set(projects.map(project=>project.name)).size!==projects.length)throw Error('Duplicate community project names.');
  return projects;
}

export async function renderCommunity() {
  const snapshot=JSON.parse(await readFile(new URL('../content/community.json',import.meta.url),'utf8'));
  const sections=parseCommunity(snapshot.markdown);
  const artwork={AngouriMath:'angourimath',GenericTensor:'generictensor','Honk#':'honksharp',MonoBind:'monobind'};
  const prose=tokens=>markdown.parser(tokens).replace(/<p>\s*<\/p>/g,'');
  const projects=parseProjects(snapshot.markdown).map(project=>{
    const image=artwork[project.name];
    const id=project.name.toLowerCase().replace(/#/g,'sharp').replace(/[^a-z0-9-]/g,'');
    const wordmark=project.name==='MonoBind';
    const repository=new URL(project.repo).pathname.split('/').filter(Boolean).map(encodeURIComponent).join('/');
    const badge=`<a class="project-stars" href="${escapeHtml(project.repo)}/stargazers" aria-label="${escapeHtml(project.name)} stars on GitHub"><img src="https://img.shields.io/github/stars/${repository}?style=social" height="20" loading="lazy" alt="GitHub stars"></a>`;
    return `<section class="block" id="${id}" data-profile-project><div class="project-top"><h3 class="project-heading">${image?`<img class="${wordmark?'project-wordmark':'project-icon'}" src="../projects/${image}.png" width="${wordmark?180:40}" height="40" alt="">`:''}${wordmark?`<span class="sr-only">${escapeHtml(project.name)}</span>`:escapeHtml(project.name)}</h3>${badge}</div>${prose(project.tokens)}</section>`;
  }).join('\n');
  const people=[];let person;
  for(const token of sections.people) {
    if(token.type==='heading'&&token.depth===3){person={name:token.text,tokens:[]};people.push(person);}
    else if(person)person.tokens.push(token);
  }
  if(!people.length)throw Error('The community profile has no people entries.');
  const intro=prose(sections.intro).replace('<p>','<p class="name-origin">');
  return `<div class="about-intro">${intro}</div><nav class="page-contents" aria-label="On this page"><span>On this page</span><a href="#projects">Projects</a><a href="#people">People</a><a href="#contributions">Contributions</a></nav><h2 class="section-header" id="projects">Our projects</h2>${projects}<h2 class="section-header" id="people">About Angouri’s people</h2>${people.map(person=>`<section class="block" id="${escapeHtml(person.name.toLowerCase().replace(/[^a-z0-9-]/g,''))}" data-profile-person><h3>${escapeHtml(person.name)}</h3>${prose(person.tokens)}</section>`).join('')}<h2 class="section-header" id="contributions">Contributions</h2><div class="block">${prose(sections.contributions)}</div>`;
}
