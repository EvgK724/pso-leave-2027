import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../shared/engine.js';
import {prepareLeonardUpdate,LEONARD_UPDATE_ID} from '../shared/leonard-update.js';

test('Leonard rule update notifies all eight exactly once and preserves the saved schedule',()=>{
  const before=initialState();
  before.doctors[0].periods=[{id:'saved',start:'2027-04-01',end:'2027-04-14',source:'2027'}];
  before.doctors[0].submitted=true;before.doctors[0].submittedAt='2026-10-14T06:00:00Z';
  before.final={id:'saved-final',doctors:structuredClone(before.doctors)};
  before.policyUpdates=['rules-2026-10-14-v2'];
  before.events=[{id:'rules-2026-10-14-v2-leonard',text:'Previous five-day notice',to:before.doctors.map(d=>d.id)},
    {id:'other-message',text:'Another message',to:['klepikov']}];
  const saved=structuredClone(before),result=prepareLeonardUpdate(before,'2026-10-14T07:00:00Z');
  assert.deepEqual(before,saved);
  assert.deepEqual(result.state.doctors,before.doctors);
  assert.deepEqual(result.state.final,before.final);
  assert.equal(result.state.version,before.version+1);
  assert.equal(result.events.length,1);
  assert.deepEqual(result.events[0].to,before.doctors.map(d=>d.id));
  assert.equal(new Set(result.events[0].to).size,8);
  assert.match(result.events[0].text,/ограничение в 5 дней отменено/);
  assert.match(result.events[0].text,/только один другой врач/);
  assert.equal(result.state.events[0].supersededBy,LEONARD_UPDATE_ID);
  assert.equal(result.state.events[0].text,before.events[0].text);
  assert.deepEqual(result.state.events[1],before.events[1]);
  assert.deepEqual(result.state.policyUpdates,['rules-2026-10-14-v2',LEONARD_UPDATE_ID]);
  const repeated=prepareLeonardUpdate(result.state,'2026-10-15T07:00:00Z');
  assert.deepEqual(repeated.state,result.state);
  assert.deepEqual(repeated.events,[]);
});

test('new notice also works when the historical notice has already left the retained history',()=>{
  const before=initialState();
  before.events=Array.from({length:200},(_,i)=>({id:`event-${i}`,text:'Existing message',to:['klepikov']}));
  const result=prepareLeonardUpdate(before);
  assert.equal(result.state.events.length,200);
  assert.equal(result.state.events.at(-1).id,LEONARD_UPDATE_ID);
  assert.equal(result.events.length,1);
});
