import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const path=JSON.parse(await readFile(new URL('content/learning-path.json',root),'utf8'));
const extended=JSON.parse(await readFile(new URL('content/extended-puzzles.json',root),'utf8'));
const bonus=[14,5,15,22,16,19,17,20,21,18,23,45,46,47,67];
const allSources=Array.from({length:85},(_,index)=>index+1);

test('learning path covers every source exactly once as main or bonus',()=>{
  assert.equal(path.chapters.length,10);
  const main=path.chapters.flat();
  assert.equal(main.length,70);
  assert.equal(new Set(main).size,70,'chapter source IDs must be unique');
  assert.deepEqual([...main,...bonus].toSorted((a,b)=>a-b),allSources);

  const lessonIds=path.lessons.map(lesson=>lesson.id);
  assert.equal(new Set(lessonIds).size,85,'lesson metadata IDs must be unique');
  assert.deepEqual(lessonIds.toSorted((a,b)=>a-b),allSources);
});

test('learning prerequisites form a DAG and every main dependency is taught earlier',()=>{
  const lessons=new Map(path.lessons.map(lesson=>[lesson.id,lesson]));
  for(const lesson of path.lessons){
    assert.equal(typeof lesson.idea,'string');
    assert.ok(lesson.idea.trim(),`lesson ${lesson.id} has an idea`);
    assert.ok(Array.isArray(lesson.prerequisites),`lesson ${lesson.id} has prerequisites`);
    assert.equal(new Set(lesson.prerequisites).size,lesson.prerequisites.length,`lesson ${lesson.id} prerequisites are unique`);
    for(const prerequisite of lesson.prerequisites){
      assert.ok(lessons.has(prerequisite),`lesson ${lesson.id} prerequisite ${prerequisite} exists`);
      assert.notEqual(prerequisite,lesson.id,`lesson ${lesson.id} cannot require itself`);
    }
  }

  const visiting=new Set(),visited=new Set();
  const visit=id=>{
    if(visited.has(id))return;
    assert.ok(!visiting.has(id),`prerequisite cycle reaches lesson ${id}`);
    visiting.add(id);
    for(const prerequisite of lessons.get(id).prerequisites)visit(prerequisite);
    visiting.delete(id);visited.add(id);
  };
  for(const id of lessons.keys())visit(id);
  assert.equal(visited.size,85);

  const main=path.chapters.flat(),position=new Map(main.map((id,index)=>[id,index]));
  for(const id of main){
    for(const prerequisite of lessons.get(id).prerequisites){
      assert.ok(position.has(prerequisite),`main lesson ${id} depends on bonus lesson ${prerequisite}`);
      assert.ok(position.get(prerequisite)<position.get(id),`main lesson ${id} must follow prerequisite ${prerequisite}`);
    }
  }
});

test('new authored lessons occupy their declared chapters and keep stable rules',()=>{
  const byId=new Map(extended.map(item=>[item.id,item]));
  const expected=new Map([
    [78,{chapter:7,source:'x-2',inventory:{A:2,N:1},limit:4,station:{id:'station',op:'Q',before:1,after:2}}],
    [79,{chapter:8,source:'x',inventory:{A:1,H:1},limit:3,station:{id:'station',op:'S',before:2,after:0}}],
    [80,{chapter:8,source:'sin(pi*x/2)^2',inventory:{Q:1,H:1,A:1},limit:1}],
    [81,{chapter:8,source:'x-2',inventory:{A:2,H:1,S:1},limit:4}],
    [82,{chapter:10,source:'x',inventory:{H:1,A:1},limit:1,outline:'x/2'}],
    [84,{chapter:8,source:'x',inventory:{Q:1},limit:3,station:{id:'station',op:'S',before:1,after:1}}],
    [85,{chapter:10,source:'x^2/2',inventory:{D:1,H:2,A:2,F:1,C:1,S:1,Q:2,N:1},limit:9,station:{id:'station',op:'I',before:5,after:3},relation:'height-squared'}],
    [83,{chapter:10,source:'1-(x-2)^2/4',inventory:{Q:1,H:1},limit:1,outline:'(1-(x-2)^2/4)^2',relation:'height-squared'}],
  ]);
  for(const [id,rules] of expected){
    const item=byId.get(id);assert.ok(item,`source ${id} exists`);
    for(const [key,value] of Object.entries(rules))assert.deepEqual(item[key],value,`source ${id} ${key}`);
    assert.ok(path.chapters[item.chapter-1].includes(id),`source ${id} appears in chapter ${item.chapter}`);
  }
});
