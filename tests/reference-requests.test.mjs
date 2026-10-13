import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const dataModule=code=>`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
// Keep the production lesson selection and bodies. Diagram stubs expose which
// examples actually reach the returned page, independently of the request log.
const diagrams=dataModule(`
  const markers=value=>typeof value==='string'?value:!value?'':value.exampleKey?'<i data-example="'+value.exampleKey+'"></i>':Object.values(value).map(markers).join('');
  const sketch=(...values)=>'<sketch>'+values.map(markers).join('')+'</sketch>';
  export const circleSketch=sketch,compare=sketch,diagramChoices=sketch,relationSketch=sketch,strip=sketch;
  export const lesson=id=>String(id),move=op=>op,viewButton=view=>view;
  export const recall=(ids,title,body)=>'<section class="note-recall">'+title+body+'</section>';
`);
const views=dataModule(`export const tex=value=>value,rationalTex=value=>value,heightAtFormula=value=>'h|'+value;`);
const source=await readFile(new URL('../web/src/reference.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
  .replaceAll("'./note-diagrams'",JSON.stringify(diagrams)).replaceAll("'./views'",JSON.stringify(views));
const {renderReference}=await import(dataModule(code));
const path=JSON.parse(await readFile(new URL('../content/learning-path.json',import.meta.url),'utf8'));
const order=path.chapters.flat();
function examples() {
  const calls=[];
  const result=key=>{
    calls.push(key);
    const stages=Array.from({length:12},()=>({exampleKey:key,values:['0','1','2','3','4']}));
    return Promise.resolve({exampleKey:key,stages,points:[],checkpoints:[]});
  };
  return {calls,example:(source,ops)=>result(`${source}:${ops}`),circleExample:(x,y,radius)=>result(`circle:${x}:${y}:${radius}`)};
}
const used=html=>[...new Set([...html.matchAll(/data-example="([^"]+)"/g)].map(match=>match[1]))].sort();

test('every focused lesson requests only examples present in that lesson',async()=>{
  for(const [topic,chapter] of path.chapters.entries())for(const source of chapter) {
    const provider=examples(),known=new Set(order.slice(0,order.indexOf(source)+1));
    const html=await renderReference(topic,known,provider,{focused:true});
    assert.doesNotMatch(html,/class="note-recall"/,`source ${source} has separate prerequisite tabs`);
    assert.deepEqual([...new Set(provider.calls)].sort(),used(html),`source ${source} evaluated an unused sketch`);
  }
});

test('focused 1.5, 8.7 and 10.9 have bounded independent example plans',async()=>{
  for(const [source,expected] of [[25,['50:','50:A','50:H']],[54,['4:HS','4:HSA','4:HSH']],[64,['50:HQS','50:HS']]]) {
    const provider=examples(),known=new Set(order.slice(0,order.indexOf(source)+1)),topic=path.chapters.findIndex(chapter=>chapter.includes(source));
    await renderReference(topic,known,provider,{focused:true});
    assert.deepEqual([...new Set(provider.calls)].sort(),expected,`source ${source}`);
  }
});

test('complete chapter references keep recalls and evaluate only displayed examples',async()=>{
  const known=new Set([...order,45,46,47,67]);
  for(let topic=0;topic<path.chapters.length;topic++) {
    const provider=examples(),html=await renderReference(topic,known,provider);
    assert.match(html,/class="note-recall"/,`chapter ${topic+1} keeps the full reference`);
    assert.deepEqual([...new Set(provider.calls)].sort(),used(html),`chapter ${topic+1} evaluated an unused sketch`);
  }
});
