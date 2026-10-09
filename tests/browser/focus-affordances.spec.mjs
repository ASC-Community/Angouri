import {test,expect} from '@playwright/test';

const sizes=[{width:1146,height:850},{width:320,height:568},{width:844,height:390}];
async function ready(page,id=3,view='flight') {
  await page.goto('/about/');await page.evaluate(()=>localStorage.clear());
  await page.goto(`/#level=${id}&view=${view}`);
  await page.waitForFunction(()=>window.angouri?.result&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
}
const idle=page=>page.evaluate(()=>window.angouri.whenIdle());
const paint=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));

async function paintedReaderRing(page,reader,path) {
  const hide=await page.addStyleTag({content:'.keyboard-focus-cue{visibility:hidden!important}'});
  const rect=await reader.boundingBox(),clip={x:Math.floor(rect.x),y:Math.floor(rect.y),width:Math.ceil(rect.x+rect.width)-Math.floor(rect.x),height:Math.ceil(rect.y+rect.height)-Math.floor(rect.y)};
  const png=await page.screenshot({clip,path});await hide.evaluate(el=>el.remove());
  const coverage=await page.evaluate(async data=>{
    const image=new Image();image.src=`data:image/png;base64,${data}`;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext('2d');context.drawImage(image,0,0);
    const pixels=context.getImageData(0,0,image.width,image.height).data;
    const green=(x,y)=>[66,105,64].every((c,i)=>Math.abs(pixels[(y*image.width+x)*4+i]-c)<25);
    return ['left','right','top','bottom'].map(edge=>{
      const vertical=edge==='left'||edge==='right',length=vertical?image.height:image.width;let found=0,total=0;
      for(let at=12;at<length-12;at++) {
        total++;if([0,1,2,3].some(d=>green(vertical?(edge==='left'?d:image.width-1-d):at,vertical?at:(edge==='top'?d:image.height-1-d))))found++;
      }
      return total?found/total:1;
    });
  },png.toString('base64'));
  coverage.forEach((fraction,i)=>expect(fraction,`uncovered ${['left','right','top','bottom'][i]} reader edge`).toBeGreaterThan(.96));
}

async function ring(page,control,label,{pixels=false,outerEdge=false,testInfo}={}) {
  await control.focus();
  if(!await page.evaluate(()=>document.documentElement.dataset.focusModality==='keyboard'&&document.documentElement.dataset.shortcutLabels!=='hidden'))await page.keyboard.press('Shift');
  await paint(page);
  await expect(control,label).toBeFocused();
  const measured=await control.evaluate(element=>{
    const face=element.querySelector('.ingredient-surface')??element;
    const spoiler=face.matches('.hint-spoiler-cover'),style=getComputedStyle(face,spoiler?'::after':null);
    const rect=face.getBoundingClientRect(),width=parseFloat(spoiler?style.borderTopWidth:style.outlineWidth),offset=spoiler?-parseFloat(style.top)-width:parseFloat(style.outlineOffset);
    const spread=width+offset,clipped=[];
    for(let parent=face.parentElement;parent;parent=parent.parentElement){
      const s=getComputedStyle(parent),r=parent.getBoundingClientRect(),left=r.left+parent.clientLeft,top=r.top+parent.clientTop;
      if(/auto|scroll|hidden|clip/.test(s.overflowX)&&(rect.left-spread<left-1||rect.right+spread>left+parent.clientWidth+1))clipped.push(`${parent.id||parent.className}:x`);
      if(/auto|scroll|hidden|clip/.test(s.overflowY)&&(rect.top-spread<top-1||rect.bottom+spread>top+parent.clientHeight+1))clipped.push(`${parent.id||parent.className}:y`);
    }
    return {rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},width,offset,color:spoiler?style.borderTopColor:style.outlineColor,radius:getComputedStyle(face).borderTopLeftRadius,clipped};
  });
  expect(measured.width,`${label} visible outline`).toBeGreaterThan(0);
  expect(measured.clipped,`${label} clipped focus edges`).toEqual([]);
  if(!pixels)return;
  // Keycaps intentionally sit over portions of the ring. Audit the complete
  // painted outline separately; the shortcut tests inspect visible cap bounds.
  await page.addStyleTag({content:'.keyboard-focus-cue,.button-hotkey{visibility:hidden!important}'}).then(style=>style.evaluate(el=>el.id='ring-pixel-audit'));
  const r=measured.rect,clip={x:Math.max(0,Math.floor(r.x-8)),y:Math.max(0,Math.floor(r.y-8)),width:Math.ceil(r.width+16),height:Math.ceil(r.height+16)};
  const viewport=page.viewportSize();clip.width=Math.min(clip.width,viewport.width-clip.x);clip.height=Math.min(clip.height,viewport.height-clip.y);
  const png=await page.screenshot({clip,path:testInfo?.outputPath(`${label}.png`)});
  await page.locator('#ring-pixel-audit').evaluate(el=>el.remove());
  const counts=await page.evaluate(async({data,clip,measured,outerEdge})=>{
    const img=new Image();img.src=`data:image/png;base64,${data}`;await img.decode();
    const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;
    const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);const rgba=ctx.getImageData(0,0,img.width,img.height).data;
    const color=measured.color.match(/\d+/g).slice(0,3).map(Number),r=measured.rect,d=measured.offset+(outerEdge?measured.width-.75:measured.width/2);
    const centers=[[r.x-d,r.y+r.height/2],[r.x+r.width+d,r.y+r.height/2],[r.x+r.width/2,r.y-d],[r.x+r.width/2,r.y+r.height+d]];
    return centers.map(([cx,cy],edge)=>{let n=0;
      if(outerEdge){for(let offset=-5;offset<=5;offset++){
        const x=Math.floor(cx-clip.x)+(edge<2?0:offset),y=Math.floor(cy-clip.y)+(edge<2?offset:0),i=(y*img.width+x)*4;
        if(color.every((c,j)=>Math.abs(c-rgba[i+j])<35))n++;
      }return n;}
      for(let y=Math.round(cy-clip.y)-6;y<=Math.round(cy-clip.y)+6;y++)for(let x=Math.round(cx-clip.x)-6;x<=Math.round(cx-clip.x)+6;x++){
      if(x<0||y<0||x>=img.width||y>=img.height)continue;const i=(y*img.width+x)*4;if(color.every((c,j)=>Math.abs(c-rgba[i+j])<12))n++;
    }return n;});
  },{data:png.toString('base64'),clip,measured,outerEdge});
  counts.forEach((count,i)=>expect(count,`${label} painted edge ${['left','right','top','bottom'][i]}`).toBeGreaterThan(outerEdge?8:12));
}

test('history-button focus edges paint above the scrolling recipe',async({page},testInfo)=>{
  for(const size of sizes) {
    await page.setViewportSize(size);await ready(page,25);
    for(const op of ['A','H']){await page.locator(`#palette [data-op="${op}"]`).click();await idle(page);}
    await page.locator('#undo').click();await idle(page);
    for(const scroll of [0,10000]) {
      await page.locator('.recipe-content').evaluate((el,top)=>el.scrollTop=top,scroll);
      for(const id of ['undo','redo','reset'])await ring(page,page.locator(`#${id}`),`${id}-${size.width}-${scroll}`,{pixels:true,outerEdge:true,testInfo});
    }
  }
});

test('rounded block faces, scratch cards, notes and menu controls retain all four focus edges',async({page},testInfo)=>{
  test.setTimeout(180000);
  for(const size of sizes) {
    await page.setViewportSize(size);await ready(page,25);
    await page.locator('[data-op="A"]').click();await idle(page);
    for(const selector of ['#tab-flight','.part-body','.empty-slot','#palette [data-op="H"]','#undo','#reset','#launch','#hints-open','#ideas-open','#menu-open']) {
      const control=page.locator(selector).first();
      await ring(page,control,`${size.width}-${selector.replace(/[^a-z]/gi,'')}`,{pixels:['.part-body','#palette [data-op="H"]'].includes(selector),testInfo});
      if(selector==='.part-body')expect(await control.evaluate(el=>parseFloat(getComputedStyle(el).borderTopLeftRadius))).toBeGreaterThan(0);
    }
    await page.locator('#hints-open').click();
    await ring(page,page.locator('#hint-more-toggle'),`spoiler-${size.width}`,{pixels:true,testInfo});
    await page.locator('#hint-more-toggle').press('Enter');
    const sketch=page.locator('#hint-sketch-toggle');if(await sketch.count())await ring(page,sketch,`sketch-${size.width}`,{pixels:true,testInfo});
    await page.keyboard.press('Escape');await page.locator('#ideas-open').click();
    await expect(page.locator('#notes-content')).toHaveAttribute('aria-busy','false');
    for(const button of await page.locator('#notes-index button').all()){await button.click();await ring(page,button,`notes-${size.width}`);}
    for(const button of await page.locator('#notes-reading button').all())await ring(page,button,`notes-link-${size.width}`);
    await page.keyboard.press('Escape');
    for(const destination of [undefined,'library-open','puzzles-open','settings-open','help-open','menu-version','share-open']) {
      await page.locator('#menu-open').click();if(destination)await page.locator(`#${destination}`).click();
      const dialog=page.locator('dialog[open]');
      const controls=await dialog.locator('button:visible:not(:disabled),a:visible,input:visible,textarea:visible,select:visible,summary:visible').all();
      for(let i=0;i<controls.length;i++)await ring(page,controls[i],`${destination??'menu'}-${size.width}-${i}`);
      await expect(page.locator('.keyboard-arrows:visible')).toHaveCount(0);
      if(destination==='library-open') {
        await page.locator('#seed-name').fill('Focus audit');await page.locator('#favorite-save').click();await idle(page);
        for(const control of await page.locator('.favorite-actions button').all())await ring(page,control,`saved-${size.width}`);
        await page.locator('[data-rename-seed]').click();
        for(const control of await page.locator('.favorite-edit input,.favorite-edit button').all())await ring(page,control,`rename-${size.width}`);
        await page.locator('[data-cancel-rename]').click();await page.locator('[data-delete-seed]').click();
        await ring(page,page.locator('[data-restore-seed]'),`undo-delete-${size.width}`);await page.locator('[data-restore-seed]').click();
      }
      if(destination==='settings-open') {
        await page.locator('#reset-progress-open').click();
        for(const control of await page.locator('#reset-progress-dialog button').all())await ring(page,control,`reset-confirm-${size.width}`);
        await page.locator('#reset-progress-cancel').click();
      }
      await page.keyboard.press('Escape');
    }
  }
});

test('slider focus surrounds the current knob and arrows describe existing directional actions',async({page},testInfo)=>{
  for(const size of sizes) {
    await page.setViewportSize(size);await ready(page,3,'flow');
    await page.locator('#tab-flow').focus();await page.keyboard.press('Shift');await expect(page.locator('#tab-flow')).toBeFocused();
    await expect(page.locator('.keyboard-arrows:visible')).toHaveAttribute('data-directions','x');
    await page.keyboard.press('Tab');const slider=page.locator('#flow-position');await expect(slider).toBeFocused();
    await expect(page.locator('.keyboard-arrows.is-knob:visible')).toHaveCount(1);
    expect(await slider.evaluate(el=>getComputedStyle(el).outlineStyle)).toBe('none');
    for(const key of ['Home','ArrowRight','End']) {
      await page.keyboard.press(key);await paint(page);
      const error=await slider.evaluate(el=>{
        const rect=el.getBoundingClientRect(),cue=document.querySelector('.keyboard-arrows').getBoundingClientRect(),v=(el.valueAsNumber-Number(el.min))/(Number(el.max)-Number(el.min));
        return {x:Math.abs(cue.x+cue.width/2-(rect.x+9.5+v*(rect.width-19))),y:Math.abs(cue.y+cue.height/2-(rect.y+rect.height/2))};
      });expect(error.x).toBeLessThan(1);expect(error.y).toBeLessThan(1);
    }
    await page.screenshot({path:testInfo.outputPath(`slider-${size.width}.png`)});
    await slider.click();await expect(page.locator('.keyboard-arrows:visible')).toHaveCount(0);
    await page.locator('#tab-flight').click();await page.locator('[data-op="H"]').click();await idle(page);
    const block=page.locator('.part-body');await block.focus();await page.keyboard.press('Shift');
    await expect(page.locator('.keyboard-arrows:visible')).toHaveAttribute('data-directions','xdown');
    await page.keyboard.press('ArrowRight');await idle(page);await expect(block).toBeFocused();
  }
});

test('reading panes are keyboard scrollable only while overflowing and Flight uses its view button',async({page})=>{
  await ready(page,25,'function');
  for(const size of sizes) {
    await page.setViewportSize(size);await paint(page);
    for(const selector of ['.final-equation','.value-table tbody']) {
      const pane=page.locator(selector),metrics=await pane.evaluate(el=>({x:el.scrollWidth>el.clientWidth+1,y:el.scrollHeight>el.clientHeight+1,tabIndex:el.tabIndex}));
      expect(metrics.tabIndex).toBe(metrics.x||metrics.y?0:-1);
      if(metrics.x||metrics.y){await pane.focus();await page.keyboard.press(metrics.y?'ArrowDown':'ArrowRight');await expect.poll(()=>pane.evaluate(el=>el.scrollTop+el.scrollLeft)).toBeGreaterThan(0);}
    }
    expect(await page.locator('#scene').evaluate(el=>el.tabIndex)).toBe(-1);
  }
  await page.setViewportSize({width:1146,height:850});await ready(page,3,'flow');
  expect(await page.locator('.flow-line').evaluate(el=>el.tabIndex)).toBe(-1);
  await page.setViewportSize({width:320,height:400});await paint(page);
  const chain=page.locator('.flow-line');await expect(chain).toHaveAttribute('tabindex','0');
  await chain.focus();await page.keyboard.press('ArrowDown');await expect.poll(()=>chain.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
  await ready(page,54);await page.locator('#tab-flight').focus();
  await page.keyboard.press('PageDown');await expect.poll(()=>page.locator('#scene').evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight)).toBe(false);
});

test('the Flow chain focus ring follows the rounded frame at every scroll position',async({page},testInfo)=>{
  await ready(page,25,'flow');
  for(const op of ['A','H','A','H']){await page.locator(`#palette [data-op="${op}"]`).click();await idle(page);}
  for(const size of sizes) {
    await page.setViewportSize(size);const chain=page.locator('.flow-line');await expect(chain).toHaveAttribute('tabindex','0');
    await chain.focus();await page.keyboard.press('Home');await paint(page);
    const radii=await chain.evaluate(el=>({panel:parseFloat(getComputedStyle(el.parentElement).borderBottomLeftRadius),left:parseFloat(getComputedStyle(el).borderBottomLeftRadius),right:parseFloat(getComputedStyle(el).borderBottomRightRadius)}));
    expect(radii.left).toBe(radii.panel);expect(radii.right).toBe(radii.panel);expect(radii.left).toBeGreaterThan(8);
    for(const end of [false,true]) {
      if(end){await chain.evaluate(el=>{el.scrollLeft=el.scrollWidth;el.scrollTop=el.scrollHeight;});await paint(page);}
      await expect(chain).toBeFocused();
      const frame=await chain.evaluate(el=>{const css=getComputedStyle(el.parentElement,'::after'),rect=el.parentElement.getBoundingClientRect();return {border:css.borderTopWidth,color:css.borderTopColor,top:css.top,bottom:css.bottom,rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height}};});
      expect(frame.border).toBe('2px');expect(frame.color).toBe('rgb(66, 105, 64)');expect(frame.top).toBe('0px');expect(frame.bottom).toBe('0px');
      if(!end)await chain.evaluate((el,rect)=>el.dataset.frame=JSON.stringify(rect),frame.rect);
      else expect(frame.rect).toEqual(await chain.evaluate(el=>JSON.parse(el.dataset.frame)));
      await page.locator('#scene').screenshot({path:testInfo.outputPath(`flow-ring-${size.width}-${end?'end':'start'}.png`)});
      await paintedReaderRing(page,chain,testInfo.outputPath(`flow-ring-edges-${size.width}-${end?'end':'start'}.png`));
    }
  }
});

test('Equation reader borders stay above row separators and formulas while scrolling',async({page},testInfo)=>{
  await ready(page,25,'function');for(const op of ['A','H','A','H','A']){await page.locator(`#palette [data-op="${op}"]`).click();await idle(page);}
  const checked=new Set();
  for(const size of [sizes[1],sizes[2]]) {
    await page.setViewportSize(size);await paint(page);
    for(const selector of ['.final-equation','.value-table tbody']) {
      const reader=page.locator(selector);if(await reader.getAttribute('tabindex')!=='0')continue;
      checked.add(selector);await reader.focus();await page.keyboard.press('Home');await paint(page);
      for(const end of [false,true]) {
        if(end){await reader.evaluate(el=>{el.scrollTop=el.scrollHeight;el.scrollLeft=el.scrollWidth;});await paint(page);}
        await paintedReaderRing(page,reader,testInfo.outputPath(`equation-ring-${selector.includes('tbody')?'table':'formula'}-${size.width}-${end?'end':'start'}.png`));
      }
      await page.locator('#scene').screenshot({path:testInfo.outputPath(`equation-focus-${selector.includes('tbody')?'table':'formula'}-${size.width}.png`)});
    }
  }
  expect([...checked].sort()).toEqual(['.final-equation','.value-table tbody']);
});

test('circle handles, target choices and Create crop controls keep shaped focus inside their scrollers',async({page},testInfo)=>{
  test.setTimeout(90000);
  for(const size of sizes) {
    await page.setViewportSize(size);await ready(page,43);
    for(const control of await page.locator('[data-circle-handle],[data-circle-value]').all())await ring(page,control,`circle-${size.width}`);
    await page.locator('#tab-flow').click();
    for(const control of await page.locator('.circle-target-choice').all())await ring(page,control,`target-${size.width}`,{pixels:true,testInfo});
    await ready(page,3);await page.locator('#menu-open').click();await page.locator('#nav-create').click();await idle(page);
    await ring(page,page.locator('#source-choose'),`source-${size.width}`);
    await page.locator('#source-choose').click();
    for(const control of await page.locator('#curves-dialog button:visible').all())await ring(page,control,`curve-choice-${size.width}`);
    await page.keyboard.press('Escape');
    await page.locator('[data-crop-add]').click();await idle(page);
    for(const control of await page.locator('[data-crop-clear],[data-crop-exact]').all())await ring(page,control,`crop-${size.width}`);
    const crop=page.locator('[data-crop-range]').first();await crop.focus();await page.keyboard.press('ArrowRight');await idle(page);await paint(page);
    await expect(page.locator('.keyboard-arrows.is-knob:visible')).toHaveCount(1);
    await page.screenshot({path:testInfo.outputPath(`crop-slider-${size.width}.png`)});
  }
});
