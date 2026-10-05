import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseCommunity, parseProjects, renderCommunity, renderMarkdown } from '../scripts/community.mjs';

test('the saved organization profile produces each shared project once, including HonkSharp',async()=>{
  const snapshot=JSON.parse(await readFile(new URL('../content/community.json',import.meta.url),'utf8'));
  const projects=parseProjects(snapshot.markdown);
  for(const name of ['AngouriMath','GenericTensor','Honk#','MxEngine','MonoBind','DotnetBenchmarks'])assert.ok(projects.some(project=>project.name===name),`preserved ${name}`);
  const sections=parseCommunity(snapshot.markdown);assert.ok(sections.people.length>0);assert.ok(sections.contributions.length>0);
  const html=await renderCommunity();
  assert.equal((html.match(/data-profile-project/g)||[]).length,projects.length);
  assert.equal((html.match(/data-profile-person/g)||[]).length,4);
  for(const person of ['WhiteBlackGoose','MomoDeve','Happypig375','TheSeems'])assert.ok(html.includes(person));
  assert.match(html,/mailto:hadrianwttang@outlook.com/);assert.match(html,/lang="el">αγγούρι/);
  assert.match(html,/projects\/honksharp\.png/);
  assert.match(html,/href="https:\/\/github.com\/ASC-Community\/HonkSharp"/);
  assert.equal((html.match(/class="project-stars"/g)||[]).length,projects.length);
  for(const project of projects)assert.ok(html.includes(`https://img.shields.io/github/stars/${new URL(project.repo).pathname.slice(1)}?style=social`));
  assert.doesNotMatch(html,/badgen|align="left"/);
});

test('a changed profile structure fails visibly rather than erasing the project list',()=>{
  assert.throws(()=>parseProjects('## People\n\nSomeone'),/no Projects section/);
  assert.throws(()=>parseProjects('## Projects\n\n### Example\n\nA project without a repository.'),/Incomplete/);
  assert.throws(()=>parseCommunity('# Angouri\n\nIntroduction\n\n## Projects\n\n### Example\n\nSome text.'),/Missing community section: people/);
});

test('shared markdown cannot inject active HTML, remote images or unsafe link protocols',()=>{
  const html=renderMarkdown('<script>alert(1)</script>\n\n<img src="bad" onerror="alert(1)">\n\n[bad](javascript:alert%281%29) ![badge](https://example.com/badge) [safe](https://github.com/asc-community)');
  assert.doesNotMatch(html,/<script|<img|onerror|href="javascript:/);
  assert.match(html,/href="https:\/\/github.com\/asc-community"/);
});

test('package, lockfile and player version log agree',async()=>{
  const root=new URL('../',import.meta.url);
  const pkg=JSON.parse(await readFile(new URL('package.json',root),'utf8'));
  const lock=JSON.parse(await readFile(new URL('package-lock.json',root),'utf8'));
  const changelog=await readFile(new URL('CHANGELOG.md',root),'utf8');
  assert.equal(lock.version,pkg.version);assert.equal(lock.packages[''].version,pkg.version);
  assert.match(pkg.version,/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/);
  assert.ok(changelog.includes(`## ${pkg.version} — `));
});
