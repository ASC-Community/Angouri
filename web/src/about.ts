import { renderBrand } from './brand';

renderBrand(document.querySelector<HTMLElement>('.brand')!,'../cucumber.svg');

const brands:Record<string,string>={
  'github.com':'github','discord.gg':'discord','twitter.com':'twitter',
  'www.reddit.com':'reddit','t.me':'telegram','habr.com':'habr'
};
for(const link of document.querySelectorAll<HTMLAnchorElement>('main a[href]')) {
  if(link.classList.contains('project-stars'))continue;
  const url=new URL(link.href),brand=brands[url.hostname];
  if(!brand&&url.protocol!=='mailto:'&&link.textContent?.trim()!=='Website')continue;
  const drawing=brand
    ?`<use href="../social.svg#${brand}"/>`
    :url.protocol==='mailto:'
      ?'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>'
      :'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>';
  link.classList.add('social-link');
  link.insertAdjacentHTML('afterbegin',`<svg class="social-icon ${brand?'brand-icon':'line-icon'}" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">${drawing}</svg>`);
}
