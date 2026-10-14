import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../shared/engine.js';
import {prepareRulesUpdate,RULES_UPDATE_ID} from '../shared/rules-update.js';
const now='2026-10-14T06:00:00.000Z';
const period=(start,end,source='2027')=>({id:crypto.randomUUID(),start,end,source});

test('policy notices have precisely the requested recipients and can only be applied once',()=>{
  const before=initialState(),saved=structuredClone(before);
  const update=prepareRulesUpdate(before,now);
  assert.deepEqual(before,saved);
  assert.equal(update.events.length,3);
  assert.deepEqual(update.events[0].to,before.doctors.map(d=>d.id).filter(id=>id!=='davydova'));
  assert.deepEqual(update.events[1].to,['khamatnurova']);
  assert.deepEqual(update.events[2].to,before.doctors.map(d=>d.id));
  assert.equal(update.events.reduce((n,e)=>n+e.to.length,0),16);
  assert.equal(new Set(update.events.map(e=>e.id)).size,3);
  assert(update.state.policyUpdates.includes(RULES_UPDATE_ID));
  assert.equal(update.state.version,before.version+1);
  const second=prepareRulesUpdate(update.state,'2026-10-15T06:00:00.000Z');
  assert.equal(second.events.length,0);
  assert.deepEqual(second.state,update.state);
});

test('only excessive non-exempt summer plans are reopened, with all dates and balances preserved',()=>{
  const s=initialState();
  const a=s.doctors.find(d=>d.id==='alekeshova'),d=s.doctors.find(d=>d.id==='davydova');
  a.periods=[period('2027-05-30','2027-06-13'),period('2027-08-02','2027-08-15')];
  a.carryover=0;a.carryConfirmed=true;a.submitted=true;a.submittedAt=now;
  d.periods=[period('2027-05-10','2027-05-23'),period('2027-07-05','2027-07-18'),period('2027-09-13','2027-09-26')];
  d.submitted=true;d.submittedAt=now;
  s.final={id:'prior-final',doctors:structuredClone(s.doctors)};
  const old=structuredClone(s),update=prepareRulesUpdate(s,now);
  assert.deepEqual(s,old);
  assert.deepEqual(update.affected,[{id:a.id,name:a.name,used:28,excess:7,wasSubmitted:true}]);
  assert.deepEqual(update.state.doctors.map(d=>d.periods),s.doctors.map(d=>d.periods));
  const changed=update.state.doctors.find(d=>d.id===a.id);
  assert.equal(changed.submitted,false);assert.equal(changed.submittedAt,null);
  assert.equal(changed.carryover,0);assert.equal(changed.carryConfirmed,true);
  assert.deepEqual(update.state.doctors.find(x=>x.id===d.id),d);
  assert.equal(update.state.final,null);
  assert.equal(update.events.length,4);
  assert.deepEqual(update.events.at(-1).to,[a.id]);
  assert.match(update.events.at(-1).text,/28 дн/);
  assert.match(update.events.at(-1).text,/не менее 7 дн/);
  assert.match(update.events.at(-1).text,/Пожалуйста/);
});

test('a compliant final and other submission states remain unchanged',()=>{
  const s=initialState();s.doctors[0].submitted=true;
  s.final={id:'valid-final',doctors:structuredClone(s.doctors)};
  const update=prepareRulesUpdate(s,now);
  assert.deepEqual(update.state.final,s.final);
  assert.deepEqual(update.state.doctors,s.doctors);
});
