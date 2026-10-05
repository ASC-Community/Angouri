import { decimalTex, type Op, type Result, type State } from './types';

type MathMarkup=(latex:string)=>string;

/** Each spatial relationship reads only its own calculus step's kernel samples. */
export function stationScene(op:Op|undefined,stage:number,math:MathMarkup) {
  if(op==='S')return `<section class="station-scene wave-scene" data-station-stage="${stage}" aria-label="Circle height at step ${stage}"><h3>Circle → wave</h3><svg viewBox="0 0 224 116" role="img" data-station-picture><path class="wave-axis" d="M30 58H204M88 8V108"/><circle class="wave-circle" cx="88" cy="58" r="44"/><path class="wave-radius" data-wave-radius/><path class="wave-projection" data-wave-projection/><circle class="wave-dot" data-wave-dot r="4"/><circle class="wave-dot" data-wave-height cx="190" r="4"/></svg><div class="station-readings"><span>Input<output data-station-input></output></span><span>Height<output data-station-output></output></span></div><p>${math('1\\;\\mapsto\\;\\frac14\\text{ turn}')}</p><small>Read the height around the circle.</small></section>`;
  if(op!=='D'&&op!=='I')return '';
  const slope=op==='D';
  return `<section class="station-scene ${slope?'slope-scene':'amount-scene'}" data-station-stage="${stage}" aria-label="${slope?'Height and slope':'Signed area'} at step ${stage}">
    <h3>${slope?'Height → slope':'Height → signed area'}</h3>
    <svg viewBox="0 0 224 116" role="img" data-station-picture>
      ${slope?`<path class="slope-run" data-station-run/><path class="slope-rise" data-station-rise/><path class="slope-tangent" data-station-tangent/><circle class="slope-point" cx="112" cy="58" r="4"/>`:
      `<defs><pattern id="station-negative-${stage}" patternUnits="userSpaceOnUse" width="6" height="6"><path d="M0 6L6 0" stroke="#a86051" stroke-width="1.5"/></pattern></defs><path class="amount-pipe" d="M24 24H78M146 24H200"/><path class="station-arrow" data-station-arrow/><rect class="amount-vessel" x="22" y="49" width="180" height="36" rx="8"/><rect class="amount-positive" data-station-fill y="50" height="34"/><rect fill="url(#station-negative-${stage})" data-station-negative y="50" height="34"/><path class="amount-zero" data-station-origin/>`}
    </svg>
    <div class="station-readings"><span>Height<output data-station-input></output></span><span>${slope?'Slope':'Area'}<output data-station-output></output></span></div>
    <p>${slope?math('\\text{slope}=\\frac{\\text{rise}}{\\text{run}}'):'Above zero adds. Below zero subtracts.'}</p>
    <small>${slope?'Local tangent at the inspected position':'Signed area from zero to the inspected position'}</small>
  </section>`;
}

export function updateStationScene(root:HTMLElement,state:State,result:Result,index:number,math:MathMarkup) {
  for(const scene of root.querySelectorAll<HTMLElement>('[data-station-stage]')) {
    const at=Number(scene.dataset.stationStage),input=result.stages[at-1],output=result.stages[at];
    const value=input.points[index][1],change=output.points[index][1];
    const display=(value:number)=>`\\approx ${decimalTex(Number(value.toPrecision(3)))}`;
    scene.querySelector('[data-station-input]')!.innerHTML=math(display(value));
    scene.querySelector('[data-station-output]')!.innerHTML=math(display(change));
    const set=(selector:string,attrs:Record<string,string|number>)=>{const el=scene.querySelector(selector);for(const [key,value] of Object.entries(attrs))el?.setAttribute(key,String(value));};
    const arrow=(start:number,y:number,delta:number)=>Math.abs(delta)<.1?'':`M${start} ${y}h${delta}m${-Math.sign(delta)*5} -4l${Math.sign(delta)*5} 4l${-Math.sign(delta)*5} 4`;
    if(state.nodes[at-1].op==='S') {
      const projection=output.projection?.[index];
      if(projection){const [cx,cy]=[88+44*projection[0],58-44*projection[1]];set('[data-wave-radius]',{d:`M88 58L${cx} ${cy}`});set('[data-wave-projection]',{d:`M${cx} ${cy}H190`});set('[data-wave-dot]',{cx,cy});set('[data-wave-height]',{cy});}
      set('[data-station-picture]',{'aria-label':`Input ${value.toPrecision(4)} quarter-turns. The circle's height is ${change.toPrecision(4)}.`});
    } else if(state.nodes[at-1].op==='D') {
      // Fit a local tangent with equal horizontal/vertical units. Its rise/run
      // is the kernel's derivative, never the speed of the playback clock.
      const run=Math.min(144,80/Math.max(Math.abs(change),1e-12)),rise=change*run;
      const left=112-run/2,right=112+run/2,bottom=58+rise/2,top=58-rise/2;
      set('[data-station-run]',{d:`M${left} ${bottom}H${right}`});
      set('[data-station-rise]',{d:`M${right} ${bottom}V${top}`});
      set('[data-station-tangent]',{d:`M${left} ${bottom}L${right} ${top}`});
      scene.dataset.direction=change>1e-8?'rising':change< -1e-8?'falling':'flat';
      set('[data-station-picture]',{'aria-label':`Input height ${value.toPrecision(4)}; slope ${change.toPrecision(4)} at horizontal position ${input.points[index][0].toPrecision(4)}. The tangent is ${scene.dataset.direction}; its signed rise divided by its run is the slope.`});
    } else {
      const low=Math.min(0,...output.points.map(p=>p[1])),high=Math.max(0,...output.points.map(p=>p[1]));
      const place=(v:number)=>24+176*(v-low)/(high-low||1),zero=place(0),edge=place(change);
      const attrs={x:Math.min(zero,edge),width:Math.abs(edge-zero)};
      set('[data-station-origin]',{d:`M${zero} 43V91`});
      set('[data-station-fill]',{...attrs,class:change<0?'amount-negative':'amount-positive'});
      set('[data-station-negative]',{...attrs,opacity:change<0?1:0});
      const maximum=Math.max(1,...input.points.map(p=>Math.abs(p[1])));
      set('[data-station-arrow]',{d:arrow(112,24,value/maximum*40)});
      scene.dataset.direction=value>1e-8?'adding':value< -1e-8?'taking':'still';
      set('[data-station-picture]',{'aria-label':`Input height ${value.toPrecision(4)}; signed area from zero to horizontal position ${input.points[index][0].toPrecision(4)} is ${change.toPrecision(4)}. ${scene.dataset.direction}.`});
    }
  }
}
