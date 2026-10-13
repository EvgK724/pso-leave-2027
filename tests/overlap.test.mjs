import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../shared/engine.js';
const period=(start,end,source='2027')=>({id:crypto.randomUUID(),start,end,source});
const save=(s,actor,p)=>E.applyCommand(s,actor,{type:'save',period:p});
const withCarry=(actor,days)=>E.applyCommand(E.initialState(),actor,{type:'carry',days});

test('one to three calendar days of 2026/2027 overlap work in either entry order; four fail',()=>{
 for(const count of [1,2,3,4])for(const carryFirst of [false,true]){
  let s=withCarry('leonard',4);
  const start=`2027-04-${15-count}`,carry=period(start,E.addDays(start,3),'2026'),annual=period('2027-04-01','2027-04-14');
  const first=carryFirst?['leonard',carry]:['klepikov',annual],second=carryFirst?['klepikov',annual]:['leonard',carry];
  s=save(s,...first);
  if(count===4)assert.throws(()=>save(s,...second),/не более 3 календарных дней/);
  else{
   const check=E.checkCandidate(s,...second);assert.equal(check.error,null);assert.equal(check.overlapDays,count);
   s=save(s,...second);assert.equal(E.overlapCheck(s.doctors).dates.length,count);
  }
 }
});
test('same-year overlaps, self-overlaps and a third doctor on the same date remain forbidden',()=>{
 let s=withCarry('leonard',4);s=save(s,'klepikov',period('2027-04-01','2027-04-14'));s=save(s,'leonard',period('2027-04-12','2027-04-15','2026'));
 s=E.applyCommand(s,'lekerova',{type:'carry',days:3});
 for(const [actor,p] of [
  ['lekerova',period('2027-04-13','2027-04-15','2026')],
  ['lekerova',period('2027-04-13','2027-04-15')],
  ['leonard',period('2027-04-15','2027-04-15')],
  ['klepikov',period('2027-04-01','2027-04-02')]
 ])assert.throws(()=>save(s,actor,p),/заняты/);
});
test('overlaps at both ends with different colleagues share the three-day allowance',()=>{
 let s=withCarry('leonard',7);s=save(s,'leonard',period('2027-04-10','2027-04-16','2026'));
 s=save(s,'klepikov',period('2027-04-09','2027-04-11'));
 assert.throws(()=>save(s,'kardashina',period('2027-04-15','2027-04-17')),/составляет 4.*не более 3/);
 s=save(s,'kardashina',period('2027-04-16','2027-04-17'));assert.equal(E.overlapCheck(s.doctors).dates.length,3);
});
test('adjacent carryover parts share one allowance and cannot bypass it by splitting',()=>{
 let s=withCarry('leonard',6);s=save(s,'klepikov',period('2027-04-01','2027-04-14'));
 s=save(s,'leonard',period('2027-04-12','2027-04-14','2026'));
 s=save(s,'leonard',period('2027-04-15','2027-04-17','2026'));
 assert.throws(()=>save(s,'kardashina',period('2027-04-15','2027-04-16')),/составляет 5.*не более 3/);
 let reverse=withCarry('leonard',6);reverse=save(reverse,'klepikov',period('2027-04-01','2027-04-14'));
 reverse=save(reverse,'kardashina',period('2027-04-15','2027-04-16'));
 reverse=save(reverse,'leonard',period('2027-04-12','2027-04-14','2026'));
 assert.throws(()=>save(reverse,'leonard',period('2027-04-15','2027-04-17','2026')),/составляет 5.*не более 3/);
});
test('separate carryover runs each have an allowance; joining them rechecks the total',()=>{
 let s=withCarry('leonard',7);s=save(s,'klepikov',period('2027-04-01','2027-04-14'));
 s=save(s,'kardashina',period('2027-04-16','2027-04-18'));
 s=save(s,'leonard',period('2027-04-12','2027-04-14','2026'));
 s=save(s,'leonard',period('2027-04-16','2027-04-18','2026'));
 assert.equal(E.overlapCheck(s.doctors).dates.length,6);
 assert.throws(()=>save(s,'leonard',period('2027-04-15','2027-04-15','2026')),/составляет 6.*не более 3/);
});
test('editing dates or the source year rechecks both sides without mutating the saved state on failure',()=>{
 let s=withCarry('leonard',7),annual=period('2027-04-01','2027-04-14'),carry=period('2027-04-12','2027-04-15','2026');
 s=save(s,'klepikov',annual);s=save(s,'leonard',carry);const before=structuredClone(s);
 assert.throws(()=>save(s,'leonard',{...carry,start:'2027-04-11'}),/не более 3 календарных дней/);
 assert.throws(()=>save(s,'klepikov',{...annual,start:'2027-04-02',end:'2027-04-15'}),/не более 3 календарных дней/);
 assert.throws(()=>save(s,'leonard',{...carry,source:'2027'}),/за 2027 год.*не могут пересекаться/);
 assert.deepEqual(s,before);
 s=save(s,'leonard',{...carry,start:'2027-04-13'});assert.equal(E.overlapCheck(s.doctors).dates.length,2);
});
test('holidays count toward the overlap limit even though they do not spend vacation days',()=>{
 let s=withCarry('leonard',3);s=save(s,'klepikov',period('2027-03-01','2027-03-15'));
 assert.throws(()=>save(s,'leonard',period('2027-03-07','2027-03-10','2026')),/составляет 4.*не более 3/);
 s=save(s,'leonard',period('2027-03-07','2027-03-09','2026'));
 assert.equal(E.totals(s.doctors[4]).used2026,2);assert.equal(E.overlapCheck(s.doctors).dates.length,3);assert.equal(E.capacity(s).overlapPlanned,2);
});
test('recommendations preserve length and may use a permitted three-day overlap',()=>{
 let s=withCarry('leonard',4);s=save(s,'klepikov',period('2027-04-01','2027-04-14'));
 const out=E.suggestions(s,'leonard',period('2027-04-11','2027-04-14','2026'));
 assert.equal(out.length,2);assert.equal(out.find(q=>q.direction===1).start,'2027-04-12');
 for(const q of out){assert.equal(E.leaveDays(q.start,q.end),4);assert.equal(E.checkCandidate(s,'leonard',q).error,null);}
});
test('the final schedule and exports support more than 15 carryover days with valid overlaps',()=>{
 let s=E.initialState();for(const d of s.doctors)s=E.applyCommand(s,d.id,{type:'carry',days:0});
 let start='2027-01-09',lastEnd;
 for(let round=0;round<3;round++)for(const d of s.doctors){lastEnd=E.endForDays(start,14);s=save(s,d.id,period(start,lastEnd));start=E.addDays(lastEnd,1);}
 start=E.addDays(lastEnd,-2);
 for(const [id] of E.PEOPLE.slice(0,4)){
  s=E.applyCommand(s,id,{type:'carry',days:4});const end=E.endForDays(start,4);s=save(s,id,period(start,end,'2026'));
  s=E.applyCommand(s,'klepikov',{type:'confirmCarry',doctorId:id});start=E.addDays(end,1);
 }
 assert.equal(E.capacity(s).carry,16);assert.equal(E.capacity(s).overlapNeeded,1);assert.equal(E.capacity(s).overlapPlanned,3);
 for(const d of s.doctors)s=E.applyCommand(s,d.id,{type:'submit'});
 assert(s.final);assert.equal(E.rowsForExport(s).length,28);assert.equal(E.rowsForExport(s).reduce((n,r)=>n+r.days,0),352);
 assert(E.csvExport(s).includes('2026'));assert.equal((E.calendarICS(s,'klepikov').match(/BEGIN:VEVENT/g)||[]).length,4);
});
