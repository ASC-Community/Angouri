import {test,expect} from '@playwright/test';

const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
async function ready(page,id,view='flight') {
  await page.goto('/about/');await page.goto(`/#level=${id}&view=${view}`);
  await page.waitForFunction(()=>window.angouri?.result&&document.querySelector('#playground')?.getAttribute('aria-busy')==='false');
  expect(await page.evaluate(()=>window.angouri.state.sourceId)).toBe(id);
}
async function add(page,op) {await page.locator(`[data-op="${op}"]`).click();await idle(page);}
async function recipe(page,ops) {for(const op of ops)await add(page,op);}

async function expectFlightRigs(page,count) {
  await expect(page.locator('[data-flight-stroke]')).toHaveCount(count);
  await expect(page.locator('[data-flight-stroke] > [id^="launcher"]:not([id*="front"])')).toHaveCount(count);
  await expect(page.locator('[data-flight-stroke] > [id^="cucumber"]')).toHaveCount(count);
  for(const pouch of await page.locator('.slingshot-pouch').all()) {
    await expect(pouch).toHaveCSS('fill','none');
    await expect(pouch).toHaveCSS('stroke','rgb(142, 103, 72)');
  }
}

async function relationTopology(page) {
  return page.evaluate(()=>{
    const {playback,flights}=window.angouri.result.relation;
    const pointKey=([x,y])=>`${x.toFixed(8)},${y.toFixed(8)}`;
    return {
      playbackLength:playback.length,
      ranges:flights,
      strokes:flights.map(([start,end])=>{
        const points=playback.slice(start,end+1),edges=new Set();let retraced=false,maxStep=0;
        for(let i=1;i<points.length;i++) {
          maxStep=Math.max(maxStep,Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));
          const ends=[pointKey(points[i-1]),pointKey(points[i])].sort(),edge=ends.join('|');
          if(edges.has(edge))retraced=true;else edges.add(edge);
        }
        return {length:points.length,maxStep,retraced};
      })
    };
  });
}

function expectContinuousEdgeDistinctFlights(topology,count) {
  expect(topology.ranges).toHaveLength(count);
  expect(topology.ranges[0][0]).toBe(0);
  expect(topology.ranges.at(-1)[1]).toBe(topology.playbackLength-1);
  for(let i=1;i<topology.ranges.length;i++)expect(topology.ranges[i][0]).toBe(topology.ranges[i-1][1]+1);
  for(const stroke of topology.strokes) {
    expect(stroke.length).toBeGreaterThan(2);
    expect(stroke.maxStep).toBeLessThan(.08);
    expect(stroke.retraced).toBe(false);
  }
}

test('discoveries report the chosen effect, keep Hints away, and lead into the loop capstone',async({page})=>{
  await ready(page,1);await expect(page.locator('#ideas-open')).toBeHidden();await expect(page.locator('#hints-open')).toBeHidden();
  await add(page,'H');await expect(page.locator('#feedback')).toHaveClass(/discovery-feedback/);await expect(page.locator('#feedback')).toContainText('Heights halve');
  await ready(page,2);await expect(page.locator('#ideas-open')).toBeHidden();await expect(page.locator('#hints-open')).toBeHidden();
  await add(page,'A');await expect(page.locator('#feedback')).toHaveClass(/discovery-feedback/);await expect(page.locator('#feedback')).toContainText('Every height rises equally');

  await ready(page,68);await expect(page.locator('#ideas-open')).toBeVisible();await expect(page.locator('#hints-open')).toBeHidden();
  await add(page,'A');await expect(page.locator('#feedback')).toContainText('The two heights move apart');
  await ready(page,69);await expect(page.locator('#ideas-open')).toBeVisible();await expect(page.locator('#hints-open')).toBeHidden();
  await add(page,'H');await expect(page.locator('#feedback')).toContainText('scales by');
  await add(page,'H');await expect(page.locator('#feedback')).toContainText('Two halves');
  await ready(page,70);await expect(page.locator('#ideas-open')).toBeVisible();await expect(page.locator('#hints-open')).toBeHidden();
  await add(page,'N');await expect(page.locator('#feedback')).toContainText('Real heights appear');

  await page.locator('#menu-open').click();await page.locator('#puzzles-open').click();
  const loops=page.locator('.chapter-group').filter({has:page.locator('summary',{hasText:'Loops'})});
  expect(await loops.locator('[data-level]').evaluateAll(options=>options.map(option=>Number(option.dataset.level)))).toEqual([43,44,48,68,69,70,66,49,71]);
});

test('independent open branches launch separately while a circle and oval fly once without retracing',async({page})=>{
  await ready(page,48);
  await expectFlightRigs(page,2);
  expectContinuousEdgeDistinctFlights(await relationTopology(page),2);

  await recipe(page,'QNA');
  await expectFlightRigs(page,1);
  expectContinuousEdgeDistinctFlights(await relationTopology(page),1);

  await ready(page,69);await recipe(page,'HH');
  await expectFlightRigs(page,1);
  expectContinuousEdgeDistinctFlights(await relationTopology(page),1);
});
