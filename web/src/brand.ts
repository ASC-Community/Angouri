import katex from 'katex';
import 'katex/dist/katex.min.css';
import './brand.css';

/** One wordmark for the game and community pages, using the in-game artwork. */
export function renderBrand(element:HTMLElement, cucumber:string) {
  element.setAttribute('aria-label','Angouri home');
  element.innerHTML=`<span id="brand-math" aria-hidden="true">${katex.renderToString('\\mathit{angour}',{throwOnError:false})}</span><span class="brand-i" aria-hidden="true"><span class="brand-dot"></span><img src="${cucumber}" width="24" height="24" alt=""></span>`;
}
