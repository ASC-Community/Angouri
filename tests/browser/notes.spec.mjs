import {test,expect} from '@playwright/test';

async function open(page,id,view='flight') {
  await page.goto('/about/');await page.goto(`/#level=${id}&view=${view}`);
  await page.waitForFunction(()=>window.angouri?.result&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
  await page.locator('#hints-open').click();await page.getByRole('button',{name:'Another hint',exact:true}).click();
  await page.getByRole('button',{name:'Show a sketch',exact:true}).click();await expect(page.locator('#hint-sketch')).toHaveAttribute('aria-busy','false');
  await expect(page.locator('#hints-dialog')).toHaveAccessibleName('Hints');
  await expect(page.locator('[data-retry-notes]')).toHaveCount(0);
}
const construction=page=>page.evaluate(()=>({state:window.angouri.state,history:window.angouri.history,slots:window.angouri.slots,save:localStorage.getItem('angouri:vine:v1:progress')}));
const visiblePanel=box=>box.locator('[data-note-panel]:visible');

test('an explicit 4.5 hint sketch compares fourth and eighth powers with exact anchors and preserves the player workspace',async({page})=>{
  await open(page,31,'flow');
  await expect(page.locator('.hint-level')).toHaveText('4.5 · Hold a wider summit');
  const before=await construction(page),box=page.getByRole('region',{name:'What changes when you square again?'});
  await expect(page.locator('#hint-sketch h3')).toHaveText('Fit first. Then square again.');
  await expect(box).toBeVisible();
  const zero=await visiblePanel(box).locator('[data-zero-line]').getAttribute('d');
  let curve='';
  for(const [label,value] of [['Fitted bowl','\\frac{1}{4}'],['Square once','\\frac{1}{16}'],['Square again','\\frac{1}{256}']]) {
    const button=box.getByRole('button',{name:label,exact:true});await button.focus();await page.keyboard.press('Enter');
    await expect(button).toBeFocused();await expect(button).toHaveAttribute('aria-pressed','true');
    await expect(visiblePanel(box).locator('.note-reading annotation')).toHaveText(['\\left.h\\right|_{x=0}=1',`\\left.h\\right|_{x=1}=${value}`]);
    expect(await visiblePanel(box).locator('[data-zero-line]').getAttribute('d')).toBe(zero);
    const next=await visiblePanel(box).locator('.note-curve').getAttribute('d');expect(next).not.toBe(curve);curve=next;
    expect(await construction(page)).toEqual(before);
  }
  await expect(page.locator('#hint-sketch')).not.toContainText('construct and fit the bowl');
  await expect(page.locator('#hint-sketch .note-recall')).toHaveCount(0);
  await page.keyboard.press('Escape');expect(await construction(page)).toEqual(before);await expect(page.locator('#tab-flow')).toHaveAttribute('aria-selected','true');
});

test('explicit calculus hint sketches connect shifted zeros and signed input through to the station output',async({page})=>{
  await open(page,34);
  const slopes=page.getByRole('region',{name:'Where does the slope change sign?'});
  await expect(visiblePanel(slopes).locator('.note-reading annotation')).toHaveText(['\\left.h\\right|_{x=1}=-2','\\left.h\\right|_{x=2}=0']);
  await slopes.getByRole('button',{name:'Moved fold'}).click();
  await expect(visiblePanel(slopes).locator('.note-reading annotation')).toHaveText(['\\left.h\\right|_{x=1}=0','\\left.h\\right|_{x=2}=2']);
  await open(page,35);await expect(page.locator('#hint-sketch>.note-strip figcaption')).toHaveText(['Roof','Three flat places','Three zero slopes']);
  await open(page,39);await expect(page.locator('#hint-sketch>.note-strip figcaption')).toHaveText(['Bowl','Negative, positive, negative','Fall, rise, fall']);
  await open(page,40);
  const before=await construction(page),half=page.getByRole('region',{name:'Does this order change the amount?'});
  const original=await visiblePanel(half).locator('.note-curve').getAttribute('d');
  await half.getByRole('button',{name:'Halve the output'}).click();expect(await visiblePanel(half).locator('.note-curve').getAttribute('d')).toBe(original);
  await expect(visiblePanel(half).locator('.note-reading annotation')).toHaveText(['\\left.h\\right|_{x=0}=0','\\left.h\\right|_{x=2}=1']);
  const lift=page.getByRole('region',{name:'More incoming, or more at the start?'}).first();
  await expect(visiblePanel(lift).locator('.note-reading annotation')).toHaveText(['\\left.h\\right|_{x=0}=0','\\left.h\\right|_{x=2}=4']);
  await lift.getByRole('button',{name:'Lift the output'}).click();
  await expect(visiblePanel(lift).locator('.note-reading annotation')).toHaveText(['\\left.h\\right|_{x=0}=1','\\left.h\\right|_{x=2}=3']);
  expect(await construction(page)).toEqual(before);
  for(const id of [36,42]){await open(page,id);await expect(page.locator('#hint-sketch>.note-strip [data-note-target]')).toHaveCount(5);}
});

test('explicit circle hint sketches compare the missing geometric relationships without completing the final construction',async({page})=>{
  await open(page,43);
  const radius=page.getByRole('region',{name:'One centre. Two different reaches.'});
  const centre=await visiblePanel(radius).locator('.note-midpoint').evaluate(el=>[el.getAttribute('cx'),el.getAttribute('cy')]);
  await radius.getByRole('button',{name:'Larger radius'}).click();
  expect(await visiblePanel(radius).locator('.note-midpoint').evaluate(el=>[el.getAttribute('cx'),el.getAttribute('cy')])).toEqual(centre);await expect(visiblePanel(radius).locator('.note-previous')).toHaveCount(1);
  await expect(page.locator('#hint-sketch')).not.toContainText('Move the centre.');
  await open(page,44);const translation=page.getByRole('region',{name:'Move the centre, or change the radius?'});
  const oldRadius=await visiblePanel(translation).locator('.note-radius').evaluate(el=>el.getTotalLength());
  await translation.getByRole('button',{name:'Moved centre'}).click();expect(await visiblePanel(translation).locator('.note-radius').evaluate(el=>el.getTotalLength())).toBeCloseTo(oldRadius,2);
  await open(page,45);await expect(page.locator('#hint-sketch>.note-circle-diagram .note-leg-x')).toHaveCount(1);await expect(page.locator('#hint-sketch>.note-circle-diagram .note-leg-h')).toHaveCount(1);
  await expect(page.locator('.note-distance-example annotation')).toHaveText('(\\frac{3}{4})^2+(1)^2=\\frac{25}{16}=r^2');
  await open(page,46);const pairs=page.getByRole('region',{name:'One pair narrows it down. Two pairs locate it.'});const before=await construction(page);
  await expect(visiblePanel(pairs).locator('[data-note-pair]')).toHaveCount(1);await pairs.getByRole('button',{name:'Two pairs'}).click();await expect(visiblePanel(pairs).locator('[data-note-pair]')).toHaveCount(2);expect(await construction(page)).toEqual(before);
  await open(page,47);await expect(page.locator('#hint-sketch h3').first()).toHaveText('Find the second line.');
  const sketch=page.locator('#hint-sketch>.note-circle-diagram');await expect(sketch.locator('[data-note-pair]')).toHaveCount(1);await expect(sketch.locator('.note-required')).toHaveCount(3);await expect(sketch.locator('.note-curve,.note-radius')).toHaveCount(0);
});

test('bonus calculus hints use the current starting curve and targets',async({page})=>{
  for(const id of [14,16]) {
    await open(page,id);const before=await construction(page);
    const input=await page.evaluate(()=>window.angouri.result.stages[0].latex);
    await expect(page.locator('#hint-sketch .note-stage').first().locator('annotation').last()).toHaveText(input);
    await expect(page.locator('#hint-sketch [data-note-target]')).toHaveCount(await page.evaluate(()=>window.angouri.result.checkpoints.length));
    await expect(page.locator('#hint-sketch')).not.toContainText('fixed station');
    await expect(page.locator('#hint-sketch .note-recall')).toHaveCount(0);
    expect(await construction(page)).toEqual(before);
  }
});

test('hint sketch math labels stay on their zero lines through narrow reflow and comparison changes',async({page})=>{
  for(const id of [31,46,66]) {
    await open(page,id);
    for(const viewport of [{width:1440,height:900},{width:320,height:568},{width:844,height:390}]) {
      await page.setViewportSize(viewport);
      if(id!==66){const button=page.getByRole('button',{name:id===31?'Square again':'Two pairs',exact:true});await button.click();}
      await expect(page.locator('#hint-sketch foreignObject')).toHaveCount(0);
      const offsets=await page.locator('.note-plot-frame:visible,.note-circle-diagram:visible').evaluateAll(frames=>frames.map(frame=>{
        const svg=frame.querySelector('svg'),axis=svg.querySelector('.note-zero-line'),m=svg.getScreenCTM(),point=axis.getPointAtLength(0),label=frame.querySelector('.note-zero .katex-html,.circle-note-zero .katex-html').getBoundingClientRect();
        return Math.abs(label.top+label.height/2-(m.f+point.y*m.d));
      }));
      expect(offsets.length).toBeGreaterThan(0);for(const offset of offsets)expect(offset).toBeLessThan(4);
      expect(await page.locator('#hints-dialog').evaluate(el=>el.scrollWidth-el.clientWidth)).toBe(0);
      const overflows=await page.locator('.note-formula:visible,.note-reading:visible,.note-solutions .solution-heights:visible').evaluateAll(nodes=>nodes.filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>el.textContent));expect(overflows).toEqual([]);
    }
  }
});
