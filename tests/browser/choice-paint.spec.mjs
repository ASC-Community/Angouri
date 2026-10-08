import {test,expect} from '@playwright/test';

test('both introductory block faces stay painted throughout hover and press transitions',async({page},testInfo)=>{
  test.setTimeout(90000);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto('/#level=1');
  await page.waitForFunction(()=>window.angouri?.result&&document.querySelector('#playground').getAttribute('aria-busy')==='false');
  // Stretch only the duration so protocol latency cannot skip an intermediate
  // paint. The actual transition properties and rendering layers stay intact.
  await page.addStyleTag({content:'.choice-game .ingredient-surface {transition-duration: 600ms!important}'});
  const frames=async(op,phase)=>{
    const button=page.locator(`[data-op="${op}"]`),face=button.locator('.ingredient-surface');
    await face.evaluate(el=>{for(const a of el.getAnimations()){a.pause();a.currentTime=0;}});
    const color=await face.evaluate(el=>getComputedStyle(el).backgroundColor.match(/\d+/g).slice(0,3).map(Number));
    for(const time of [0,150,300,450,600]){
      await face.evaluate(async(el,time)=>{
        for(const a of el.getAnimations())a.currentTime=time;
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      },time);
      const pixels=await button.screenshot({animations:'allow',path:testInfo.outputPath(`${op}-${phase}-${time}.png`)});
      const filled=await page.evaluate(async({data,color})=>{
        const image=new Image();image.src=`data:image/png;base64,${data}`;await image.decode();
        const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
        const context=canvas.getContext('2d');context.drawImage(image,0,0);
        const rgba=context.getImageData(0,0,image.width,image.height).data;let count=0;
        for(let i=0;i<rgba.length;i+=4)if(color.every((c,j)=>Math.abs(c-rgba[i+j])<=2))count++;
        return count/(image.width*image.height);
      },{data:pixels.toString('base64'),color});
      expect(filled,`${op} ${phase} at ${time}ms must retain its colored face`).toBeGreaterThan(.65);
    }
    await face.evaluate(el=>el.getAnimations().forEach(a=>a.finish()));
  };
  for(const op of ['H','A']){
    const button=page.locator(`[data-op="${op}"]`);
    await button.hover();await frames(op,'hover-in');
    await page.mouse.move(0,0);await frames(op,'hover-out');
    await button.hover();await button.locator('.ingredient-surface').evaluate(el=>el.getAnimations().forEach(a=>a.finish()));
    await page.mouse.down();await frames(op,'press');await page.mouse.up();
    await page.evaluate(()=>window.angouri.whenIdle());
    await button.click();await page.evaluate(()=>window.angouri.whenIdle());
  }
});
