import katex from 'katex';
import cucumberArtwork from '../public/cucumber.svg?raw';
import 'katex/dist/katex.min.css';
import './brand.css';

/** One wordmark for the game and community pages, using the in-game artwork. */
export function renderBrand(element:HTMLElement) {
  element.setAttribute('aria-label','Angouri home');
  const artwork=new DOMParser().parseFromString(cucumberArtwork,'image/svg+xml').documentElement;
  // Omit only the stalk. Cropping a rectangular image cuts the curved crown.
  artwork.querySelector('[data-cucumber-part="stem"]')?.remove();
  artwork.setAttribute('class','brand-cucumber');
  artwork.setAttribute('aria-hidden','true');
  artwork.querySelector('#skin')?.setAttribute('id','brand-cucumber-skin');
  artwork.querySelector('[fill="url(#skin)"]')?.setAttribute('fill','url(#brand-cucumber-skin)');
  element.innerHTML=`<span id="brand-math" aria-hidden="true">${katex.renderToString('\\mathit{angour}',{throwOnError:false})}</span><span class="brand-i" aria-hidden="true"><span class="brand-dot"></span>${artwork.outerHTML}</span>`;
}
