import 'katex/dist/katex.min.css';
import './brand.css';

/** The wordmark itself is outlined into both HTML entries by Vite. */
export function renderBrand(element:HTMLElement) {
  element.setAttribute('aria-label','Angouri home');
  // Keep the source HTML's readable fallback when opened without Vite. Normal
  // dev and production HTML already contains the complete SVG at first paint.
  if(!element.querySelector('.brand-wordmark')&&!element.textContent?.trim())element.textContent='Angouri';
}
