export type View = 'flight' | 'function' | 'flow';
export type Op = 'H' | 'A' | 'N' | 'Q' | 'D' | 'I';
export interface Part { id: string; op: Op }
export interface Goal { x: string; y: string }
export interface State {
  schema: 1; rules: 'vine-1'; engine: 'AngouriMath-2.5.0'; sourceId: number;
  mode: 'puzzle' | 'remix' | 'challenge'; nodes: Part[]; goals: Goal[];
  inventory: Partial<Record<Op, number>>; limit: number;
}
export interface Stage { id: string; expression: string; latex: string; values: string[]; points: [number, number][] }
export interface Checkpoint { x: string; target: string; actual: string; hit: boolean; y: number }
export interface HeightGuide { fromX:string; toX:string; target:string; actual:string; hit:boolean; stages:{from:string;to:string;gap:string}[] }
export interface Result { stages: Stage[]; checkpoints: Checkpoint[]; points: [number, number][]; startSlope: number; solved: boolean; heightGuide?:HeightGuide }
export interface Artifact { schema: number; rules: string; engine: string; type: string; sourceId: number; view: View; nodes?: Part[]; goals?: Goal[]; inventory?: Partial<Record<Op,number>>; limit?: number }
export interface Response { status: 'ok' | 'invalid' | 'error'; state?: State; result?: Result; message?: string; artifact?: Artifact }
export type Action = { type: string; [key: string]: unknown };
export const OPS: Record<Op, { name: string; formula: string; description: string; color: string }> = {
  H: { name: 'Half height', formula: '\\frac{h}{2}', description: 'A little less tall.', color: 'sage' },
  A: { name: 'Raise by one', formula: 'h + 1', description: 'A little higher up.', color: 'peach' },
  N: { name: 'Reflect vertically', formula: '-h', description: 'Turn the flight path upside down.', color: 'blue' },
  Q: { name: 'Square the height', formula: 'h^{2}', description: 'Multiply each height by itself.', color: 'lilac' },
  D: { name: 'Slope curve', formula: '\\frac{\\mathrm{d}h}{\\mathrm{d}x}', description: 'The old slope becomes the new height.', color: 'gold' },
  I: { name: 'Area so far', formula: '\\int_0^x\\!h', description: 'Add up signed area from zero to this position. The new curve starts at zero.', color: 'teal' }
};
export const LEVELS = [
  { name: 'Lower the arc', hint: 'Which move keeps the ends at zero?', y: [-0.8,5.2] },
  { name: 'Lift the path', hint: 'The ends need to rise with the middle.', y: [-1,5] },
  { name: 'Order matters', hint: 'Which order leaves the ends halfway up?', y: [-1,6] },
  { name: 'Build an arch', hint: 'What could turn this line into a useful bowl?', y: [-3,5] },
  { name: 'The slope machine', hint: 'Use the old curve’s slope as the new height.', y: [-1.5,10] },
  { name: 'Turn it over', hint: 'Keep the zeros. Change which side is above them.', y: [-3,3] },
  { name: 'Fold the line', hint: 'Opposite heights can meet at the same height.', y: [-3,5] },
  { name: 'From bowl to roof', hint: 'Turn the bowl over. Where should its middle finish?', y: [-2,3] },
  { name: 'Keep the peak', hint: 'Set the bowl’s depth. Then place its peak.', y: [-3,5] },
  { name: 'Fit the bowl', hint: 'Halve then square, or square then halve?', y: [-3,5] },
  { name: 'Hold the summit', hint: 'Which smaller shapes could build this summit?', y: [-3,3] },
  { name: 'Flatten the middle', hint: 'Keep zero and one. What happens between them?', y: [-0.5,1.5] },
  { name: 'Round the roof', hint: 'Flatten the bowl, then use a familiar pair of moves.', y: [-0.5,1.5] },
  { name: 'Read the slope', hint: 'Where the bowl is flat, its slope is zero.', y: [-1.5,2] },
  { name: 'Find the arch', hint: 'What familiar shape is hidden in this curve’s slope?', y: [-1.5,5] },
  { name: 'Area so far', hint: 'More distance under a positive height means more area.', y: [-1,5] },
  { name: 'Fit the area', hint: 'The shape is right. How tall should it be?', y: [-2.5,3] },
  { name: 'From area to arch', hint: 'What shape does this curve’s area build? Then fit, turn and place it.', y: [-5,5] },
  { name: 'Back to zero', hint: 'Area below zero takes away what area above zero added.', y: [-2.5,3] },
  { name: 'Place the new path', hint: 'Area starts at zero. Where should the new path begin?', y: [-1,6] },
  { name: 'Recover the arc', hint: 'Slopes remember changes in height. Area builds them back from zero.', y: [-1,4] },
  { name: 'Shape the change', hint: 'Find a familiar shape in the slope. What would flatten its middle further?', y: [-1.5,5] },
  { name: 'Bring it together', hint: 'What does this bowl build with area? Where should its middle be before folding?', y: [-0.5,2] },
  { name: 'Lifts in pieces', hint: 'A lift can become a half or a quarter. Where does each halve go?', y: [-0.5,4.5] },
  { name: 'A smaller perch', hint: 'Fit the gap from the ends to the peak. Then decide where the lifts belong.', y: [-0.5,4.5] },
  { name: 'Turn a raised bowl', hint: 'The bowl’s middle is already above zero. Account for it when placing the roof.', y: [-1,5.5] },
  { name: 'Move the fold', hint: 'Squaring folds around zero. Which move changes where that zero is?', y: [-2.5,10] },
  { name: 'An off-center arch', hint: 'Choose where the fold belongs. Then fit, turn and place the arch.', y: [-2.5,2.5] }
];
// Stable source ids keep creations and links independent of the teaching order.
export const CHAPTERS = [
  { name:'Height', idea:'Lift and scale', color:'sage', zero:29, before:'M3 29Q18-13 33 29', after:'M3 29Q18 9 33 29', levels:[1,2,3,24,25] },
  { name:'Reflection', idea:'Turn, then place', color:'blue', zero:18, before:'M3 18Q18 46 33 18', after:'M3 18Q18-10 33 18', levels:[6,8,9,26] },
  { name:'Squaring', idea:'Build in parts', color:'lilac', zero:23, before:'M3 33L33 13', after:'M3 3Q18 43 33 3', levels:[7,10,4,27,28] },
  { name:'Flatter tops', idea:'Reshape and combine', color:'peach', zero:30, before:'M3 4Q18 56 33 4', after:'M3 4C7 29 11 30 18 30C25 30 29 29 33 4', levels:[12,13,11] },
  { name:'Slopes', idea:'Read change as a shape', color:'gold', zero:23, before:'M3 3Q18 43 33 3', after:'M3 32L33 14', levels:[14,5,15,22] },
  { name:'Area', idea:'Build change into a curve', color:'teal', zero:29, before:'M3 18H33', after:'M3 29L33 7', levels:[16,19,17,20,21,18,23] }
];
export const PUZZLE_ORDER = CHAPTERS.flatMap(chapter=>chapter.levels);
export const chapterIndex=(sourceId:number)=>CHAPTERS.findIndex(chapter=>chapter.levels.includes(sourceId));
export const isCapstone=(sourceId:number)=>CHAPTERS.some(chapter=>chapter.levels.at(-1)===sourceId);
export const CURVES = [
  { id:1, name:'Arch', latex:'x(4-x)', path:'M3 29Q18-16 33 29' },
  { id:2, name:'Low arch', latex:'\\frac{x(4-x)}{2}', path:'M3 29Q18 6 33 29' },
  { id:4, name:'Line', latex:'x-2', path:'M3 32L33 4' },
  { id:6, name:'Inverted arch', latex:'-\\frac{x(4-x)}{2}', path:'M3 8Q18 43 33 8' },
  { id:8, name:'Shallow bowl', latex:'\\frac{(x-2)^2}{4}', path:'M3 13Q18 45 33 13' },
  { id:9, name:'Bowl', latex:'(x-2)^2', path:'M3 3Q18 55 33 3' },
  { id:5, name:'Cubic', latex:'x^3', path:'M3 31C23 31 29 27 33 3' },
  { id:15, name:'S curve', latex:'\\frac{(x-2)^3}{3}+2', path:'M3 31C13 7 23 29 33 5' },
  { id:16, name:'Flat height', latex:'1', path:'M3 18H33' },
  { id:17, name:'Falling line', latex:'2-x', path:'M3 4L33 32' },
  { id:18, name:'Centered S', latex:'\\frac{(x-2)^3}{2}', path:'M3 32C13 5 23 31 33 4' },
  { id:21, name:'Raised arch', latex:'1+\\frac{x(4-x)}{2}', path:'M3 25Q18-4 33 25' },
  { id:23, name:'Wide bowl', latex:'\\frac{3(x-2)^2}{8}', path:'M3 8Q18 48 33 8' },
  { id:26, name:'Raised bowl', latex:'(x-2)^2+1', path:'M3 3Q18 43 33 3' }
];
export const curveId=(sourceId:number)=>[3,24,25].includes(sourceId)?1:[7,10,11,27,28].includes(sourceId)?4:[12,13,14].includes(sourceId)?8:sourceId===19?17:sourceId===20?16:sourceId===22?15:sourceId;
export const fraction = (s: string) => { const [n,d] = s.split('/').map(Number); return n / (d ?? 1); };
export const escape = (s: unknown) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
