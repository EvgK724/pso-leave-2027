import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../shared/engine.js';
import {fixture} from './fixtures.mjs';
const period=(start,end,source='2027')=>({id:crypto.randomUUID(),start,end,source});
const save=(s,actor,p)=>E.applyCommand(s,actor,{type:'save',period:p});
const withCarry=(actor,days)=>E.applyCommand(E.initialState(),actor,{type:'carry',days});

test('one to three calendar days of 2026/2027 overlap work in either entry order; four fail',()=>{
 for(const count of [1,2,3,4])for(const carryFirst of [false,true]){
  let s=withCarry('omutov',4);
  const start=`2027-04-${15-count}`,carry=period(start,E.addDays(start,3),'2026'),annual=period('2027-04-01','2027-04-14');
  const first=carryFirst?['omutov',carry]:['klepikov',annual],second=carryFirst?['klepikov',annual]:['omutov',carry];
  s=save(s,...first);
  if(count===4)assert.throws(()=>save(s,...second),/не более 3 календарных дней/);
  else{
   const check=E.checkCandidate(s,...second);assert.equal(check.error,null);assert.equal(check.overlapDays,count);
   s=save(s,...second);assert.equal(E.overlapCheck(s.doctors).dates.length,count);
  }
 }
});
test('same-year overlaps and self-overlaps remain forbidden',()=>{
 let s=withCarry('omutov',4);s=save(s,'klepikov',period('2027-04-01','2027-04-14'));s=save(s,'omutov',period('2027-04-12','2027-04-15','2026'));
 s=E.applyCommand(s,'lekerova',{type:'carry',days:3});
 for(const [actor,p] of [
  ['lekerova',period('2027-04-15','2027-04-15','2026')],
  ['lekerova',period('2027-04-01','2027-04-02')],
  ['omutov',period('2027-04-15','2027-04-15')],
  ['klepikov',period('2027-04-01','2027-04-02')]
 ])assert.throws(()=>save(s,actor,p),/заняты/);
});
test('a third doctor is rejected for either source year, even for one shared day or a holiday',()=>{
 for(const holiday of [false,true])for(const source of ['2026','2027']){
  let s=withCarry('omutov',4);
  const annual=holiday?period('2027-03-01','2027-03-08'):period('2027-04-01','2027-04-14');
  const carry=holiday?period('2027-03-08','2027-03-09','2026'):period('2027-04-12','2027-04-15','2026');
  s=save(s,'klepikov',annual);s=save(s,'omutov',carry);
  s=E.applyCommand(s,'lekerova',{type:'carry',days:3});
  const before=structuredClone(s),p=holiday?period('2027-03-08','2027-03-09',source):period('2027-04-13','2027-04-13',source);
  const check=E.checkCandidate(s,'lekerova',p);
  assert.match(check.error,/одновременно допускается не более 2 врачей/);
  assert(check.error.startsWith(E.formatDate(p.start)));
  assert.deepEqual(check.conflicts.map(c=>c.doctor).sort(),['klepikov','omutov']);
  assert.throws(()=>save(s,'lekerova',p),/не более 2 врачей/);
  assert.deepEqual(s,before);
 }
});
test('recommendations for a third doctor retain the source year and all previous overlap limits',()=>{
 let s=withCarry('omutov',4);s=save(s,'klepikov',period('2027-04-01','2027-04-14'));s=save(s,'omutov',period('2027-04-12','2027-04-15','2026'));
 s=E.applyCommand(s,'lekerova',{type:'carry',days:3});
 for(const source of ['2026','2027']){
  const p=period('2027-04-13','2027-04-15',source),out=E.suggestions(s,'lekerova',p);
  assert.equal(out.length,2);assert.deepEqual(out.map(q=>q.direction).sort(),[-1,1]);
  for(const q of out){
   assert.equal(q.source,source);assert.equal(E.leaveDays(q.start,q.end),3);
   assert.equal(E.checkCandidate(s,'lekerova',q).error,null);
   const next=save(s,'lekerova',q);
   for(const day of E.dates(q.start,q.end))assert(next.doctors.filter(d=>d.periods.some(r=>r.start<=day&&day<=r.end)).length<=2);
  }
 }
});
test('overlaps at both ends with different colleagues share the three-day allowance',()=>{
 let s=withCarry('omutov',7);s=save(s,'omutov',period('2027-04-10','2027-04-16','2026'));
 s=save(s,'klepikov',period('2027-04-09','2027-04-11'));
 assert.throws(()=>save(s,'kardashina',period('2027-04-15','2027-04-17')),/составляет 4.*не более 3/);
 s=save(s,'kardashina',period('2027-04-16','2027-04-17'));assert.equal(E.overlapCheck(s.doctors).dates.length,3);
});
test('adjacent carryover parts share one allowance and cannot bypass it by splitting',()=>{
 let s=withCarry('omutov',6);s=save(s,'klepikov',period('2027-04-01','2027-04-14'));
 s=save(s,'omutov',period('2027-04-12','2027-04-14','2026'));
 s=save(s,'omutov',period('2027-04-15','2027-04-17','2026'));
 assert.throws(()=>save(s,'kardashina',period('2027-04-15','2027-04-16')),/составляет 5.*не более 3/);
 let reverse=withCarry('omutov',6);reverse=save(reverse,'klepikov',period('2027-04-01','2027-04-14'));
 reverse=save(reverse,'kardashina',period('2027-04-15','2027-04-16'));
 reverse=save(reverse,'omutov',period('2027-04-12','2027-04-14','2026'));
 assert.throws(()=>save(reverse,'omutov',period('2027-04-15','2027-04-17','2026')),/составляет 5.*не более 3/);
});
test('separate carryover runs each have an allowance; joining them rechecks the total',()=>{
 let s=withCarry('omutov',7);s=save(s,'klepikov',period('2027-04-01','2027-04-14'));
 s=save(s,'kardashina',period('2027-04-16','2027-04-18'));
 s=save(s,'omutov',period('2027-04-12','2027-04-14','2026'));
 s=save(s,'omutov',period('2027-04-16','2027-04-18','2026'));
 assert.equal(E.overlapCheck(s.doctors).dates.length,6);
 assert.throws(()=>save(s,'omutov',period('2027-04-15','2027-04-15','2026')),/составляет 6.*не более 3/);
});
test('editing dates or the source year rechecks both sides without mutating the saved state on failure',()=>{
 let s=withCarry('omutov',7),annual=period('2027-04-01','2027-04-14'),carry=period('2027-04-12','2027-04-15','2026');
 s=save(s,'klepikov',annual);s=save(s,'omutov',carry);const before=structuredClone(s);
 assert.throws(()=>save(s,'omutov',{...carry,start:'2027-04-11'}),/не более 3 календарных дней/);
 assert.throws(()=>save(s,'klepikov',{...annual,start:'2027-04-02',end:'2027-04-15'}),/не более 3 календарных дней/);
 assert.throws(()=>save(s,'omutov',{...carry,source:'2027'}),/за 2027 год.*не могут пересекаться/);
 assert.deepEqual(s,before);
 s=save(s,'omutov',{...carry,start:'2027-04-13'});assert.equal(E.overlapCheck(s.doctors).dates.length,2);
});
test('holidays count toward the overlap limit even though they do not spend vacation days',()=>{
 let s=withCarry('omutov',3);s=save(s,'klepikov',period('2027-03-01','2027-03-15'));
 assert.throws(()=>save(s,'omutov',period('2027-03-07','2027-03-10','2026')),/составляет 4.*не более 3/);
 s=save(s,'omutov',period('2027-03-07','2027-03-09','2026'));
 assert.equal(E.totals(s.doctors.find(d=>d.id==='omutov')).used2026,2);assert.equal(E.overlapCheck(s.doctors).dates.length,3);assert.equal(E.capacity(s).overlapPlanned,2);
});
test('recommendations preserve length and may use a permitted three-day overlap',()=>{
 let s=withCarry('omutov',4);s=save(s,'klepikov',period('2027-04-01','2027-04-14'));
 const out=E.suggestions(s,'omutov',period('2027-04-11','2027-04-14','2026'));
 assert.equal(out.length,2);assert.equal(out.find(q=>q.direction===1).start,'2027-04-12');
 for(const q of out){assert.equal(E.leaveDays(q.start,q.end),4);assert.equal(E.checkCandidate(s,'omutov',q).error,null);}
});
test('the final schedule and exports support more than 15 carryover days with valid overlaps',()=>{
 let s=fixture();
 // Eight free September dates and seven December dates remain. The first
 // December carryover overlaps Omutov's annual leave by exactly three days.
 for(const [id,start] of [['klepikov','2027-09-23'],['kardashina','2027-09-27'],['lekerova','2027-12-22'],['khamatnurova','2027-12-26']]){
  s=E.applyCommand(s,id,{type:'carry',days:4});const end=E.endForDays(start,4);s=save(s,id,period(start,end,'2026'));
  s=E.applyCommand(s,'klepikov',{type:'confirmCarry',doctorId:id});
 }
 assert.equal(E.capacity(s).carry,16);assert.equal(E.capacity(s).overlapNeeded,1);assert.equal(E.capacity(s).overlapPlanned,3);
 for(const d of s.doctors)s=E.applyCommand(s,d.id,{type:'submit'});
 assert(s.final);assert.equal(E.rowsForExport(s).length,28);assert.equal(E.rowsForExport(s).reduce((n,r)=>n+r.days,0),352);
 assert(E.csvExport(s).includes('2026'));assert.equal((E.calendarICS(s,'klepikov').match(/BEGIN:VEVENT/g)||[]).length,4);
});

