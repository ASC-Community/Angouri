import { test, expect } from '@playwright/test';

async function ready(page,path='/#level=3&view=flight') {
  await page.goto(path);
  await page.waitForFunction(()=>window.angouri?.state&&document.querySelector('#playground')?.getAttribute('aria-busy')==='false');
}

async function idle(page) {await page.evaluate(()=>window.angouri.whenIdle());}

test('view tabs follow the focused tab while Tab and Shift+Tab keep native order',async({page})=>{
  await ready(page);
  const flight=page.getByRole('tab',{name:'Flight',exact:true});
  const func=page.getByRole('tab',{name:'Equation',exact:true});
  const flow=page.getByRole('tab',{name:'Flow',exact:true});

  await func.focus();
  await page.keyboard.press('ArrowRight');
  await expect(flow).toBeFocused();
  await expect(flow).toHaveAttribute('aria-selected','true');
  await expect(page.locator('#scene')).toHaveAttribute('aria-labelledby','tab-flow');

  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#menu-open')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(flow).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#scene')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(flow).toBeFocused();

  await page.keyboard.press('Home');
  await expect(flight).toBeFocused();
  await expect(flight).toHaveAttribute('aria-selected','true');
});

test('undoing a focused block keeps focus in the recipe for continued editing',async({page})=>{
  await ready(page);
  await page.getByRole('button',{name:/Place Halve/}).focus();
  await page.keyboard.press('Enter');
  await idle(page);

  const placed=page.getByRole('button',{name:/Halve, slot 1/});
  await placed.focus();
  await page.keyboard.press('Control+z');
  await idle(page);
  await expect(page.getByRole('button',{name:'Empty slot 1'})).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(page.getByRole('button',{name:'Empty slot 2'})).toBeFocused();
  await page.keyboard.press('Control+Shift+z');
  await idle(page);
  await expect(page.getByRole('button',{name:'Empty slot 2'})).toBeFocused();
  await page.keyboard.press('Tab');
  const add=page.getByRole('button',{name:/Place Add one/});
  await expect(add).toBeFocused();
  await expect(add).toHaveAttribute('aria-describedby','block-tooltip');
  await expect(page.getByRole('tooltip')).toContainText('Add one');
});

test('native dialog Escape and menu Back restore the documented openers',async({page})=>{
  await ready(page);
  const menu=page.getByRole('button',{name:'Menu',exact:true});
  await menu.focus();
  await page.keyboard.press('Enter');
  const settings=page.getByRole('button',{name:'Settings',exact:true});
  await settings.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog',{name:'Settings'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();

  await page.keyboard.press('Enter');
  await settings.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button',{name:'Back to menu',exact:true}).press('Enter');
  await expect(page.getByRole('dialog',{name:'Menu'})).toBeVisible();
  await expect(settings).toBeFocused();
});
