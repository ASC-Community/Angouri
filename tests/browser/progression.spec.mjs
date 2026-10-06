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

test('connected open branches and loops fly once while an interior crossing launches separately',async({page})=>{
  await ready(page,48);
  await expectFlightRigs(page,1);
  expectContinuousEdgeDistinctFlights(await relationTopology(page),1);

  await recipe(page,'AQ');
  await expectFlightRigs(page,2);
  expectContinuousEdgeDistinctFlights(await relationTopology(page),2);

  await page.locator('#reset').click();await idle(page);
  await recipe(page,'QNA');
  await expectFlightRigs(page,1);
  expectContinuousEdgeDistinctFlights(await relationTopology(page),1);

  await ready(page,69);await recipe(page,'HH');
  await expectFlightRigs(page,1);
  expectContinuousEdgeDistinctFlights(await relationTopology(page),1);
});

test('squaring the 7.6 region sends two cucumbers along the smooth intersecting parabolas',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});
  await ready(page,70);await add(page,'Q');
  await expectFlightRigs(page,2);
  expectContinuousEdgeDistinctFlights(await relationTopology(page),2);

  const curves=await page.evaluate(()=>{
    const {playback,flights}=window.angouri.result.relation;
    const anchors=[0,1,2,3,4];
    return flights.map(([start,end])=>{
      const points=playback.slice(start,end+1);
      return anchors.map(x=>{
        const matches=points.filter(point=>Math.abs(point[0]-x)<1e-8);
        if(matches.length!==1)throw new Error(`expected one playback anchor at x=${x}`);
        return matches[0][1];
      });
    });
  });
  expect(curves.map(values=>values.map(value=>Math.round(value*1e8)/1e8)))
    .toEqual(expect.arrayContaining([[3,0,-1,0,3],[-3,0,1,0,-3]]));
  for(const values of curves) {
    const signs=values.filter(value=>Math.abs(value)>1e-8).map(Math.sign);
    expect(signs.slice(1).filter((sign,index)=>sign!==signs[index])).toHaveLength(2);
  }

  // Observe the rendered travellers through both crossings, independently of
  // playback's point order. Target centres give the fixed mathematical frame.
  await page.evaluate(()=>{
    const {relation,checkpoints}=window.angouri.result;
    const number=text=>{const [n,d='1']=text.split('/');return Number(n)/Number(d);};
    const targets=checkpoints.map((target,i)=>{
      const ring=document.querySelector(`[data-ring="${i}"] .ring-outer`);
      return {x:number(target.x),h:number(target.target),px:Number(ring.getAttribute('cx')),py:Number(ring.getAttribute('cy'))};
    });
    const a=targets[0],b=targets.find(point=>point.x!==a.x);
    const scale=(b.px-a.px)/(b.x-a.x),originX=a.px-a.x*scale,originY=a.py+a.h*scale;
    window.relationMotion=relation.flights.map(()=>[]);
    const sample=()=>{
      const {phase,position}=window.angouri.flight;
      if(phase==='flying')relation.flights.forEach(([start,end],i)=>{
        const first=start/(relation.playback.length-1),last=end/(relation.playback.length-1);
        if(position<first||position>last)return;
        const matrix=document.querySelector(i?`#cucumber-${i}`:'#cucumber').transform.baseVal.consolidate().matrix;
        window.relationMotion[i].push([(matrix.e-originX)/scale,(originY-matrix.f)/scale]);
      });
      if(phase!=='landed')requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.locator('#launch').click();
  await page.waitForFunction(()=>window.angouri.flight.phase==='landed');
  const motion=await page.evaluate(()=>window.relationMotion);
  for(const [index,points] of motion.entries()) {
    expect(points.length).toBeGreaterThan(8);
    const orientation=Math.sign(curves[index][0]);
    for(const [x,h] of points)expect(Math.abs(h-orientation*((x-2)**2-1))).toBeLessThan(.01);
    expect(points.some(([x])=>x<.9)).toBe(true);
    expect(points.some(([x])=>x>1.2&&x<2.8)).toBe(true);
    expect(points.some(([x])=>x>3.1)).toBe(true);
    for(let i=1;i<points.length;i++)expect(points[i][0]).toBeGreaterThanOrEqual(points[i-1][0]);
  }
});

test('disconnected real regions each get one complete nonteleporting flight',async({page})=>{
  await ready(page,49);await recipe(page,'HQNAN');
  await expectFlightRigs(page,2);
  const topology=await relationTopology(page);
  expectContinuousEdgeDistinctFlights(topology,2);
  const components=await page.evaluate(()=>{
    const {playback,flights,breaks}=window.angouri.result.relation;
    return {breaks,ends:flights.map(([start,end])=>[playback[start],playback[end]])};
  });
  expect(components.breaks).toHaveLength(1);
  expect(components.ends.map(([start])=>start[0]).sort((a,b)=>a-b)).toEqual([0,4]);
  for(const [start,end] of components.ends) {
    expect(start[0]).toBe(end[0]);
    expect(start[1]*end[1]).toBeLessThan(0);
  }
});
