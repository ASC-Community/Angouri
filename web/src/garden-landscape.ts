import type { Point } from './types';

/** A landscaped lake, seen from a close planted corner. The far path and tree
 * groups share one shore; nothing in this scenery is a construction target. */
export function lakeLandscape() {
  const trees=`<path d="M-24 231C-39 209-16 185 4 190C-2 163 22 149 43 164C51 142 80 146 86 163C106 150 131 165 127 184C151 180 171 202 159 220C134 239 102 232 78 237C39 248 7 240-24 231Z"/>
    <path d="M95 238C81 222 95 204 114 211C111 189 132 179 149 189C163 174 183 185 184 202C210 195 224 216 212 234C182 243 143 242 95 238Z"/>
    <path d="M419 242C409 224 426 211 440 216C434 197 453 182 470 192C479 174 504 177 511 197C531 188 552 207 547 224C568 223 575 241 558 250Z"/>
    <path d="M625 264C606 248 618 226 638 224C622 200 641 181 660 185C647 164 666 146 685 153C694 130 727 134 737 151C757 135 783 155 776 176C807 178 808 207 790 222C807 246 787 270 762 270Z"/>`;
  return `<path fill="url(#garden-sky)" d="M0 0H760V424H0Z"/>
    <path fill="#a9c0ba" opacity=".045" d="M12 136Q69 121 127 132T259 144Q172 139 116 145Q65 135 12 143ZM273 71Q337 54 389 66T476 80Q414 74 374 81Q326 74 273 80Z"/>
    <path fill="#335760" opacity=".65" d="M0 221Q42 199 92 216Q148 201 209 221Q262 211 311 225Q368 207 423 221Q470 194 528 220Q583 209 624 221Q698 183 760 198V280H0Z"/>
    <path fill="#24473f" d="M0 234C81 230 147 246 219 237S351 244 410 236C470 224 515 241 561 253C626 273 693 254 760 276V424H0Z"/>
    <g fill="#264c50">${trees}</g>
    <g fill="none" stroke="#1b3d40" stroke-linecap="round" stroke-linejoin="round">
      <path stroke-width="6" d="M60 248Q60 219 46 196M61 229Q78 211 95 204M62 222Q44 211 31 213M715 268Q707 228 710 184M711 229Q692 208 673 202M710 217Q729 204 743 202"/>
      <path stroke-width="3.5" d="M151 255Q153 229 145 211M152 236L170 221M489 259Q486 229 476 215M487 235L506 218"/>
    </g>
    <path class="garden-distant-path" d="M468 246C529 239 552 257 602 265C657 276 707 265 760 282V295C697 279 648 287 599 277C544 266 528 248 468 249Z"/>
    <path fill="#193e38" d="M456 250Q463 235 476 243Q484 231 499 245Q511 238 520 251Q498 258 456 255ZM610 279Q620 264 632 272Q642 257 657 270Q675 262 683 278L681 287Z"/>
    <path fill="url(#garden-water)" d="M0 253C80 246 154 263 225 257S353 258 414 252C477 245 516 266 569 282C635 301 697 279 760 307V424H0Z"/>
    <defs><clipPath id="garden-lake-water"><path d="M0 253C80 246 154 263 225 257S353 258 414 252C477 245 516 266 569 282C635 301 697 279 760 307V424H0Z"/></clipPath></defs>
    <g clip-path="url(#garden-lake-water)"><g fill="#163942" opacity=".3" transform="translate(0 324) scale(1 -.28)">${trees}</g></g>
    <path fill="#a5bab2" opacity=".035" d="M15 265Q173 252 284 267T501 267Q377 280 254 274T15 271Z"/>
    <g class="garden-water-glints"><path d="M15 270h33m15 1h33m129 4h33m12-1h21m111-8h32M18 303h24m213-6h40m18 2h13m76 17h33M20 349h43m192-23h22m136-4h29M28 386h39m152 17h28m38-7h27"/></g>
    <path fill="#17392f" d="M0 381C29 382 47 396 58 404Q83 399 109 424H0Z"/>
    <path fill="#254633" d="M0 407Q29 400 56 409Q82 410 91 424H0Z"/>`;
}

function edgeAt(points:Point[],x:number) {
  const next=points.findIndex(point=>point[0]>=x);
  if(next<=0)return points[0][1];
  const a=points[next-1],b=points[next],t=(x-a[0])/(b[0]-a[0]||1);
  return a[1]+(b[1]-a[1])*t;
}

/** Ground contacts come from the earned shore, rather than independent artwork
 * coordinates that can strand grass and rocks when the bank changes. */
export function bankDetails(points:Point[],silhouette:string) {
  const grass=(x:number,scale:number)=>{
    const y=edgeAt(points,x)+11;
    return `<g class="garden-bank-grass" data-bank-root="${x} ${y}" transform="translate(${x} ${y}) scale(${scale})"><path class="garden-grass-blades" d="M0 1C-8-5-8-20-19-29C-7-24-2-10 0-4C-1-18 7-30 8-39C12-25 6-11 2-2C9-13 18-17 24-18C13-10 10-3 4 2Z"/><path class="garden-grass-light" d="M0-3Q-3-20-15-26M2-3Q8-23 8-33"/><ellipse class="garden-root-contact" cx="1" cy="2" rx="10" ry="2.5"/></g>`;
  };
  const stone=(x:number,scale:number)=>{
    const y=edgeAt(points,x)+12;
    return `<g class="garden-bank-stone" data-bank-root="${x} ${y}" transform="translate(${x} ${y}) scale(${scale})"><ellipse class="garden-ground-shadow" cx="2" cy="3" rx="17" ry="4"/><path class="garden-stone" d="M-16 1L-12-8L-2-13L9-10L16-2L12 3Q-3 7-16 1Z"/><path class="garden-stone-rim" d="M-11-8L-2-11L7-9"/></g>`;
  };
  return `<g class="garden-bank-details"><defs><clipPath id="garden-bank-surface"><path d="${silhouette}"/></clipPath></defs>
    <g clip-path="url(#garden-bank-surface)">
      <path class="garden-bank-soil" d="M324 424Q392 404 431 389Q486 366 544 370Q591 374 629 360Q693 355 760 397V424Z"/>
      <path class="garden-planting-pocket" d="M614 388L621 380Q630 376 641 379L654 376L668 382L677 384L682 392L674 398L660 396L647 399L638 397L624 398L614 393Z"/>
      <path class="garden-earth-cuts" d="M620 385q6-3 12-2m-2 12 7 1m29-8 8 4"/>
      <path class="garden-earth-clods" d="M621 391q4-5 10-2l2 4-11 1ZM664 394q5-5 10-1l-2 3-8-1Z"/>
    </g>
    ${grass(405,.69)}${grass(504,.58)}${grass(714,.88)}
    ${stone(437,.8)}${stone(524,.58)}${stone(740,.92)}
    <g clip-path="url(#garden-bank-surface)"><path class="garden-stone" d="M479 414L484 406L498 404L510 413Q493 421 479 414ZM696 413L700 402L713 399L727 410L725 415Z"/><path class="garden-stone-rim" d="M485 408L497 406M701 404L712 402"/></g>
  </g>`;
}
