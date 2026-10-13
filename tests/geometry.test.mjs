import {test} from 'node:test';
import assert from 'node:assert/strict';
import {curveEndpointMarks} from '../web/src/geometry.ts';

const path=(points,startClosed=true,endClosed=true,extra={})=>({points,startClosed,endClosed,...extra});

test('closed singleton components remain painted independently of other paths',()=>{
  const singleton=path([[2,0]]);
  assert.deepEqual(curveEndpointMarks([singleton]),[{point:[2,0],closed:true}]);
  assert.ok(curveEndpointMarks([path([[0,1],[1,1]]),singleton]).some(mark=>mark.point[0]===2&&mark.closed));
  assert.deepEqual(curveEndpointMarks([path([[2,0]],false,true)]),[]);
  assert.deepEqual(curveEndpointMarks([path([[2,0]],true,true,{approximateEnds:true})]),[]);
});

test('endpoint ownership follows coincident coordinates through non-monotone and reordered paths',()=>{
  const upper=path([[0,0],[2,1],[0,2]]),lower=path([[0,2],[-1,1],[0,0]]);
  assert.deepEqual(curveEndpointMarks([upper,lower]),[]);
  assert.deepEqual(curveEndpointMarks([lower,upper]),[]);
  // Separate exact components must not merge merely because they are close.
  const nearby=curveEndpointMarks([path([[0,0]]),path([[0,1e-10]])]);
  assert.equal(nearby.length,2);
});

test('rounded relations keep both signs, open ends, and domain-end singleton heights',()=>{
  const paths=[path([[2,0],[3,0]],true,false),path([[3,-1],[4,-1]],true,false),path([[3,1],[4,1]],true,false),path([[4,-Math.SQRT2]]),path([[4,Math.SQRT2]])];
  const marks=curveEndpointMarks(paths);
  assert.equal(marks.length,8);
  assert.deepEqual(marks.filter(mark=>!mark.closed).map(mark=>mark.point),[[3,0],[4,-1],[4,1]]);
  assert.equal(marks.filter(mark=>mark.point[0]===4&&mark.closed).length,2);
  assert.deepEqual(curveEndpointMarks(paths.map(value=>({...value,approximateEnds:true}))),[]);
});
