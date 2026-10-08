import './hints.css';
import { CHAPTERS, chapterIndex, escape, LEVELS, puzzleLabel, type Result, type State } from './types';
import { icon } from './icons';
import { heightGapFormula, rationalTex, tex } from './views';

// Puzzle-specific planning prompts. The reference diagrams live in Notes;
// hints never evaluate or alter a recipe, and never supply a complete sequence.
const clues:Record<number,[string,string]> = {
  25:['Fit the gap between the required heights, then work out how to place the curve.','Once the gap fits, think about each lift’s contribution. Halves shrink every lift before them, so the blocks may need to interleave.'],
  26:['This bowl starts above zero. Turning it over also turns that existing offset over.','Treat fitting the signed gap and placing the middle as two jobs. The fractional lifts from Height still work.'],
  4:['A roof contains a bowl turned over. This time you have to build the bowl.','Plan a useful intermediate shape before its final height. Reuse the line-to-bowl and bowl-to-roof ideas.'],
  28:['Locate the required peak before fitting the depth and final height.','Move the line’s zero before making the bowl. Then reuse the familiar fitting, turning and placement jobs.'],
  31:['Fit the provided bowl before squaring again. Heights above one would grow instead of flattening.','Keep its zero and one fitted, then compare what one square and another square do between them. Notes has that comparison.'],
  11:['Unlike the previous summit, this puzzle starts from a line. Build a bowl as an intermediate goal.','Fit that bowl and choose its power from the required heights. The largest available power is not automatically the right one.'],
  36:['Read the curve immediately after Find slope. Flat places in its input give zeros there.','Build the required changes before the station, then fit the output’s height afterward. A matching gap does not place every target.'],
  42:['Plan the input’s signs and zeros before placing the final result.','Use the input side to shape the accumulated change. Use the output side for what remains to be fitted or placed.'],
  45:['These opposite endpoints share the centre as their midpoint.','The diagonal radius has horizontal and vertical parts. Flow shows how their squared lengths combine.'],
  46:['Start with a pair of targets: their centre must be equally far from both.','One pair gives a perpendicular bisector, not a unique centre. A second pair narrows it to an intersection.'],
  47:['The final constellation needs the same equal-distance idea, applied to a new arrangement.','Inspect two different pairs in Flow. Find their shared centre before fitting the radius; the previous puzzle’s centre need not work.'],
  49:['Infer the circle’s centre and radius from the targets before shaping its squared height.','Translate the centre and radius into the roof’s zeros and maximum squared height, then use familiar transformations to build it.'],
  55:['Plan the repeating pattern’s phase and period before fitting its heights.','Move or scale the input before sine; fold, scale and place the output afterward.'],
  63:['Build the signed step area as an intermediate path before reshaping it.','Once the accumulated path has the right corners, decide how square, reflection and lift should change it.'],
  73:['Inspect the accumulated bowl before fitting the stroke.','Accumulation remains anchored at $x=0$. The fixed frame does not restart the area at its left edge.'],
  74:["Use the two zeros to read the loop's width, then compare the squared height at its middle.",'The required middle heights are $\\pm\\frac12$, so Equation compares their square with the right side.'],
  75:['Build a nonnegative roof from the line, with zeros at the leaf tips.','Square that roof on the right side so the solved positive and negative branches copy it and meet in pointed ends.'],
  76:['Compare the wave landmarks before changing a curve that almost fits.','If the ends and peak agree but the extra point misses, compare phase spacing and shoulder shape. A global lift would move the heights that already fit. Trace the input to sine in Flow; the drawing frame is fixed.'],
  77:["Separate the outline's length, thickness and flatness. The right-side roof's zeros name the two ends.",'Recall the flatter roofs from Flat tops, but keep the final right side as a roof rather than its square. Equation shows the square root that gives rounded caps and the scale that sets thickness.'],
  64:['The cubic hides a bowl in its slope. Shape that phase before sending it around sine’s circle.','Different phase heights wind around the circle at unequal intervals. Use the derivative to control that spacing, then fold and fit the output.'],
  65:['First isolate a positive step window with phase, rounding and sine.','What continuous shape does that finite pulse accumulate? Compare its midpoint and ends before choosing how to centre or fold it.'],
  67:['Find the zero outer regions and the positive inner window, then follow the accumulated total as its value goes from $0$ to $2$.','Its midpoint value is $1$ at the symmetry position $x=2$. Centre the values around $1$ and fold them; at the end, distinguish $h$ from $h^2$ so the relation supplies both sides.'],
  85:['The lobes reach the same height but take different horizontal distances. Which intermediate measurement controls that spacing?', 'Sine reads its incoming height as a phase. What should the accumulated value control next: the final height, or the advance around the circle? Compare the zero region and the two lobe widths in Flow.'],
  71:['A loop and its outer echoes can come from the same signed roof. Locate its middle and zero before choosing its scale.','The height beyond the zero belongs to a region where that roof has changed sign. Which operation makes both signs of its magnitude visible?'],
  15:['Look for the familiar shape in the S curve’s slope.','Once you have that bowl, reuse the turning and placement ideas.'],
  22:['Inspect what the first slope reveals before choosing the rest of the construction.','Break the target shape into a familiar bowl, its flattening and its final placement.'],
  18:['Find the familiar shape built by accumulating this input.','Treat forming that shape and its final fit, turn and placement as separate jobs.'],
  23:['Accumulating a bowl can build an S curve. Think about what folding that new curve would do.','Place the useful intermediate shape before folding, then fit its final orientation and height.']
};

export function puzzleHints(state:State,result:Result) {
  const id=state.sourceId,chapter=chapterIndex(id),level=LEVELS[id-1];
  const [first,more]=clues[id]??[level.hint,'Compare the current construction with the required targets, one relationship at a time.'];
  const view=[74,75,77,82,83].includes(id)?'function':id>=43||chapter>=4||[24,14,5,15,22,16,17,18,19,20,21,23].includes(id)?'flow':'function';
  const label=view==='function'?'Equation':'Flow',guide=result.heightGuide;
  const gap=guide&&[25,26,28,11].includes(id)?`<div class="hint-reading">${tex(`${heightGapFormula(guide)}=${rationalTex(guide.target)}`)}<span>Required height gap</span></div>`:'';
  const geometry=[45,46,47].includes(id),chapterName=chapter>=0?CHAPTERS[chapter].name:geometry?'Geometry':'Calculus';
  return `<p class="hint-level">${escape(puzzleLabel(id))} · ${escape(level.name)}</p><p class="hint-clue">${hintText(first)}</p>${gap}<div class="hint-actions"><button class="note-view-button hint-context-link" data-view="${view}">${icon(view,16)}<span><strong>${label}</strong><small>${escape(viewPurpose(id,view,!!guide))}</small></span></button><button class="note-view-button hint-context-link" id="hint-notes">${icon('book',16)}<span><strong>${escape(chapterName)} notes</strong><small>${escape(notesPurpose(id,chapter))}</small></span></button></div><div class="hint-more">${spoilerCard('hint-more-toggle','hint-extra','Another hint','Hint spoiler',`<p>${hintText(more)}</p>${spoilerCard('hint-sketch-toggle','hint-sketch','Show a sketch','Sketch spoiler','',true)}`)}</div>`;
}

function spoilerCard(buttonId:string,panelId:string,accessibleName:string,title:string,content:string,sketch=false) {
  const suffix=sketch?'sketch':'extra',description=`${buttonId}-description`;
  return `<section class="hint-spoiler${sketch?' hint-sketch-spoiler':''}"><button class="hint-spoiler-cover" id="${buttonId}" aria-label="${accessibleName}" aria-describedby="${description}" aria-expanded="false" aria-controls="${panelId}"><svg class="hint-spoiler-coating" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs><pattern id="hint-spoiler-pattern-${suffix}" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" class="hint-spoiler-base"/><path d="M-2 7L7-2M2 10L10 2" class="hint-spoiler-grain"/><circle cx="2" cy="2" r=".7" class="hint-spoiler-fleck"/></pattern><mask id="hint-spoiler-mask-${suffix}" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><rect width="100" height="100" fill="white"/><path class="hint-spoiler-scratch-path" pathLength="1" d="M3 8L97 8L3 22L97 22L3 36L97 36L3 50L97 50L3 64L97 64L3 78L97 78L3 92L97 92"/></mask></defs><rect x=".6" y=".6" width="98.8" height="98.8" rx="4" fill="url(#hint-spoiler-pattern-${suffix})" mask="url(#hint-spoiler-mask-${suffix})"/><rect x=".6" y=".6" width="98.8" height="98.8" rx="4" class="hint-spoiler-edge" mask="url(#hint-spoiler-mask-${suffix})"/></svg><span class="hint-spoiler-label"><span class="hint-spoiler-kicker">${title}</span><span class="hint-spoiler-reveal">Reveal</span></span><span class="sr-only" id="${description}">Covered content. Activate once to reveal it.</span></button><div class="hint-spoiler-content" id="${panelId}" role="region" aria-label="${accessibleName}" tabindex="-1" hidden>${content}</div></section>`;
}

function viewPurpose(id:number,view:string,hasGuide:boolean) {
  if(id===25)return 'Compare the current gap with the required gap.';
  if(hasGuide)return 'Compare the current signed gap with the required gap.';
  if([45,46,47].includes(id))return 'Check the exact centre and distance conditions.';
  if([74,75,77,82,83].includes(id))return 'Inspect the exact squared-height relation.';
  if(view==='flow'&&id>=32&&id<=42)return 'Trace what changes before and after the fixed station.';
  if(view==='flow')return 'Trace how each operation changes the curve.';
  return 'Compare the current exact readings with the targets.';
}

function notesPurpose(id:number,chapter:number) {
  if(id===25)return 'Recall how halves scale gaps and lift placement creates fractions.';
  if([45,46,47].includes(id))return 'Recall how equal distances locate a circle.';
  if(chapter<0)return 'Recall how slope or accumulation reveals an intermediate shape.';
  return [
    'Recall how lifts and halves change heights.',
    'Recall how reflection changes a signed gap.',
    'Recall how moving, squaring and reflection build arches.',
    'Recall how repeated powers flatten a fitted curve.',
    'Recall how slopes expose changes and flat places.',
    'Recall how signed area builds the next curve.',
    'Recall how squared height describes both sides.',
    'Recall how phase controls a repeating curve.',
    'Recall how rounding and accumulation shape steps.',
    'Reconnect the ideas used in this picture.'
  ][chapter];
}

export function revealHintSpoiler(button:HTMLButtonElement,panel:HTMLElement) {
  if(button.getAttribute('aria-expanded')==='true')return false;
  const card=button.closest<HTMLElement>('.hint-spoiler');
  button.setAttribute('aria-expanded','true');panel.hidden=false;card?.classList.add('is-revealing');
  let finished=false;
  const finish=()=>{
    if(finished)return;finished=true;
    card?.classList.remove('is-revealing');card?.classList.add('reveal-complete');button.hidden=true;
    if(panel.isConnected)panel.focus({preventScroll:true});
  };
  const reduced=document.body.classList.contains('reduced-motion')||matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduced)finish();
  else {
    button.querySelector('.hint-spoiler-scratch-path')?.addEventListener('animationend',finish,{once:true});
    window.setTimeout(finish,650);
  }
  return true;
}

function hintText(value:string) {
  return value.split('$').map((part,index)=>index%2?tex(part):escape(part)).join('');
}
