import {test,expect} from '@playwright/test';

const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
const artifact=(ops='',extra={})=>({schema:1,rules:'vine-1',engine:'AngouriMath-2.5.0',type:'creation',sourceId:48,view:'flow',nodes:[...ops].map((op,i)=>({id:`presentation-${i}`,op})),...extra});
async function imported(page,value) {
  const encoded=Buffer.from(JSON.stringify(value)).toString('base64url');
  await page.goto('/about/');await page.goto(`/#v1=${encoded}`);
  await page.waitForFunction(()=>window.angouri?.result&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
  expect(await page.evaluate(()=>window.angouri.state.sourceId)).toBe(value.sourceId);
}
async function probe(page,x) {
  await page.locator('#flow-position').fill(String(x));await page.locator('#flow-position').dispatchEvent('input');
}
const marks=locator=>locator.evaluateAll(elements=>elements.map(element=>({x:Number(element.getAttribute('cx')),y:Number(element.getAttribute('cy')),closed:element.classList.contains('closed'),painted:Number(element.getAttribute('r'))>0&&getComputedStyle(element).display!=='none'&&getComputedStyle(element).fill!=='none'})));

test('a singleton real locus stays painted in Flight and away from the Flow probe',async({page})=>{
  await imported(page,artifact('QN',{view:'flight'}));
  expect(await page.evaluate(()=>window.angouri.result.relation.paths)).toEqual([{points:[[2,0]],startClosed:true,endClosed:true}]);
  const flight=page.locator('.flight-path-ends .path-end.closed');await expect(flight).toHaveCount(1);
  expect((await marks(flight))[0].painted).toBe(true);
  await page.locator('#tab-flow').click();await probe(page,0);
  await expect(page.locator('[data-relation-probe]:visible')).toHaveCount(0);
  const point=page.locator('.relation-machine .path-end.closed');await expect(point).toHaveCount(1);
  expect((await marks(point))[0]).toMatchObject({x:95,painted:true});
  await expect(page.locator('.katex-error')).toHaveCount(0);
});

test('rounded real branches keep ownership and isolated endpoint heights before and after Crop',async({page})=>{
  for(const [ops,x,openCount,closedCount] of [['F',3,3,5],['C',3,5,5],['FN',1,5,5],['CN',1,3,5]]) {
    await imported(page,artifact(ops,{crop:{from:'0',to:'4'}}));await probe(page,x);
    for(const selector of ['.relation-machine','.crop-machine']) {
      await expect(page.locator(`${selector} .path-end.open`)).toHaveCount(openCount);
      await expect(page.locator(`${selector} .path-end.closed`)).toHaveCount(closedCount);
      const endpoints=await marks(page.locator(`${selector} .path-end`));expect(endpoints.every(mark=>mark.painted)).toBe(true);
      const probes=await marks(page.locator(`${selector} .flow-point:visible`));expect(probes).toHaveLength(2);
      for(const point of probes)expect(endpoints.some(mark=>mark.closed&&Math.abs(mark.x-point.x)<1e-7&&Math.abs(mark.y-point.y)<1e-7)).toBe(true);
    }
    if(ops==='F') {
      // At x=3 the old zero is open; the final x=4 heights are permanent
      // singleton marks even though the slider is elsewhere.
      const endpoints=await marks(page.locator('.relation-machine .path-end'));
      expect(endpoints.filter(mark=>mark.x===164&&mark.closed)).toHaveLength(2);
      const zero=Number((await page.locator('.relation-machine .flow-zero-line').getAttribute('d')).match(/M26 ([^H]+)/)[1]);
      expect(endpoints.some(mark=>mark.x===129.5&&Math.abs(mark.y-zero)<1e-7&&!mark.closed)).toBe(true);
    }
  }
});

test('symbolic squared targets use the kernel exact expression and approximate aid',async({page})=>{
  await imported(page,artifact('',{type:'challenge',view:'function',goals:[{x:'3',y:'1+sqrt(2)'},{x:'2',y:'1'},{x:'1',y:'0'},{x:'2',y:'-1'}],inventory:{Q:1,N:1,A:1},limit:3}));
  const before=await page.evaluate(()=>window.angouri.result.checkpoints),first=before[0];
  expect(first.lhsLatex).toBeTruthy();expect(first.lhsNumber).toBeCloseTo(3+2*Math.SQRT2,10);expect(first.hit).toBe(false);
  const expected=page.locator('.value-table tbody tr').first().locator('td').nth(1);
  await expect(expected.locator('.exact-value annotation')).toHaveText(first.lhsLatex);
  await expect(expected.locator('.decimal-value annotation')).toHaveText('\\approx 5.828');
  await expect(expected).not.toContainText('unavailable');
  await page.locator('#tab-flow').click();await page.locator('#tab-function').click();
  expect(await page.evaluate(()=>window.angouri.result.checkpoints)).toEqual(before);
});

test('implicit Crop follows solved heights and reads the retained real branches',async({page})=>{
  await imported(page,artifact('Q',{crop:{from:'1',to:'3'}}));await probe(page,0);
  await expect(page.locator('[data-relation-values] annotation')).toHaveText('h \\approx 2.00,\\;-2.00');
  await expect(page.locator('[data-relation-probe]:visible')).toHaveCount(2);
  await expect(page.locator('[data-crop-reading]')).toContainText('outside');
  await expect(page.locator('[data-crop-probe]:visible')).toHaveCount(0);
  await probe(page,2.5);
  await expect(page.locator('[data-crop-reading] annotation')).toHaveText('h \\approx 0.50,\\;-0.50');
  await expect(page.locator('[data-crop-probe]:visible')).toHaveCount(2);
  await imported(page,artifact('',{crop:{from:'0',to:'4'}}));await probe(page,1);
  await expect(page.locator('[data-crop-reading] annotation')).toHaveText('\\nexists h\\in\\mathbb{R}');
  await expect(page.locator('[data-crop-probe]:visible')).toHaveCount(0);
  await probe(page,4);
  await expect(page.locator('[data-crop-reading] annotation')).toHaveText('h \\approx 1.41,\\;-1.41');
  await expect(page.locator('[data-crop-probe]:visible')).toHaveCount(2);
});

test('the optional source-67 sketch compares real-height branches with real-height targets',async({page})=>{
  test.setTimeout(120000);
  await page.goto('/about/');await page.goto('/#level=67');
  await page.waitForFunction(()=>window.angouri?.result&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
  await page.locator('#hints-open').click();await page.getByRole('button',{name:'Another hint',exact:true}).click();
  await page.getByRole('button',{name:'Show a sketch',exact:true}).click();await expect(page.locator('#hint-sketch')).toHaveAttribute('aria-busy','false');
  const sketch=page.locator('#hint-sketch > .note-relation');await expect(sketch).toHaveCount(1);
  const data=await sketch.evaluate(element=>{
    const goals=window.angouri.result.checkpoints,markers=[...element.querySelectorAll('[data-note-target]')];
    const zero=Number(element.querySelector('[data-zero-line]').getAttribute('d').match(/M17 ([^H]+)/)[1]);
    const index=goals.findIndex(goal=>goal.x==='3/2'&&goal.target==='3/4');
    const target=markers[index],x=Number(target.getAttribute('cx')),y=Number(target.getAttribute('cy'));
    const points=[...element.querySelectorAll('.note-curve')].flatMap(path=>[...path.getAttribute('d').matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(match=>[Number(match[1]),Number(match[2])]));
    const above=points.filter(point=>Math.abs(point[0]-x)<.02&&point[1]<zero);
    return {goals:goals.length,markers:markers.length,ratio:(zero-y)/(zero-above[0]?.[1]),hasBelow:points.some(point=>point[1]>zero),caption:element.querySelector('figcaption').textContent};
  });
  expect(data.markers).toBe(data.goals);expect(data.hasBelow).toBe(true);
  expect(data.ratio).toBeCloseTo(Math.SQRT1_2,3);expect(data.caption).toContain('real heights');
  await expect(page.locator('.katex-error')).toHaveCount(0);await idle(page);
});
