import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../shared/engine.js';
import {fixture} from './fixtures.mjs';
const now='2026-10-13T04:00:00.000Z';
const period=(start,end,source='2027')=>({id:crypto.randomUUID(),start,end,source});
test('exact roster contains all eight; no telephone data',()=>{assert.equal(E.PEOPLE.length,8);assert(E.PEOPLE.some(x=>x[1]==='Давыдова Н.В.'));assert(!/\d{10}/.test(JSON.stringify(E.PEOPLE)));});
test('Russia 2027 has 351 chargeable dates and 15 carryover days without overlaps',()=>{assert.equal(Object.keys(E.HOLIDAYS).length,14);assert.deepEqual(E.capacity(E.initialState()),{available:351,needed:336,carry:0,spare:15,unknown:8,overlapNeeded:0,overlapPlanned:0});});
test('holidays excluded, transferred days and ordinary weekends included',()=>{assert.equal(E.leaveDays('2027-01-01','2027-01-08'),0);assert.equal(E.endForDays('2027-03-01',14),'2027-03-15');assert.equal(E.leaveDays('2027-11-04','2027-11-07'),3);assert.equal(E.leaveDays('2027-05-01','2027-05-03'),2);assert.equal(E.isDayOff('2027-02-20'),false);assert.equal(E.isDayOff('2027-02-22'),true);});
test('calendar input validation rejects impossible dates and year overflow',()=>{assert.equal(E.isDate('2027-02-29'),false);assert.equal(E.endForDays('2027-12-25',14),null);assert(E.periodError(period('2027-12-25','2028-01-07')));assert(E.periodError(period('2027-03-01','2027-03-16')));assert(E.periodError(period('2027-01-01','2027-01-08')));});
test('whole absence including holidays blocks overlap with a colleague',()=>{let s=E.initialState();s=E.applyCommand(s,'klepikov',{type:'save',period:period('2027-03-01','2027-03-15')},now);assert.equal(E.collisions(s,'omutov',period('2027-03-08','2027-03-09')).length,1);assert.throws(()=>E.applyCommand(s,'omutov',{type:'save',period:period('2027-03-15','2027-03-20')},now),/заняты/);});
test('nearest earlier and later recommendations preserve charged length and avoid overlap',()=>{let s=E.initialState();s=E.applyCommand(s,'klepikov',{type:'save',period:period('2027-06-10','2027-06-24')},now);const p=period('2027-06-15','2027-06-28');const out=E.suggestions(s,'omutov',p);assert.equal(out.length,2);assert(out.some(p=>p.direction===-1));assert(out.some(p=>p.direction===1));for(const q of out){assert.equal(E.leaveDays(q.start,q.end),14);assert.equal(E.collisions(s,'omutov',q).length,0);assert(q.start>=E.START&&q.end<=E.END);}});
test('14 plus 7 adjacent days are allowed in either entry order, while each part stays at most 14',()=>{
 const parts=[period('2027-04-01','2027-04-14'),period('2027-04-15','2027-04-21')];
 for(const order of [parts,[...parts].reverse()]){
  let s=E.initialState();for(const p of order)s=E.applyCommand(s,'klepikov',{type:'save',period:p},now);
  assert.equal(s.doctors[0].periods.length,2);assert.equal(E.totals(s.doctors[0]).used2027,21);
  assert.throws(()=>E.applyCommand(s,'klepikov',{type:'save',period:period('2027-04-22','2027-04-22')},now),/больше 21 дня/);
 }
 assert.throws(()=>E.applyCommand(E.initialState(),'klepikov',{type:'save',period:period('2027-04-01','2027-04-15')},now),/Одна часть.*14/);
});
test('14 plus 8 or 14 adjacent days are rejected without changing saved wishes',()=>{
 const s=E.applyCommand(E.initialState(),'klepikov',{type:'save',period:period('2027-04-01','2027-04-14')},now),saved=structuredClone(s);
 for(const end of ['2027-04-22','2027-04-28'])assert.throws(()=>E.applyCommand(s,'klepikov',{type:'save',period:period('2027-04-15',end)},now),/больше 21 дня/);
 assert.deepEqual(s,saved);
});
test('whole adjacent chains are checked when inserting or editing a bridging part',()=>{
 let s=E.initialState();for(const p of [period('2027-04-16','2027-04-22'),period('2027-04-01','2027-04-07')])s=E.applyCommand(s,'klepikov',{type:'save',period:p},now);
 const middle=period('2027-04-08','2027-04-14');s=E.applyCommand(s,'klepikov',{type:'save',period:middle},now);
 assert.equal(E.totals(s.doctors[0]).used2027,21);
 assert.throws(()=>E.applyCommand(s,'klepikov',{type:'save',period:period('2027-04-15','2027-04-15')},now),/больше 21 дня/);
 assert.throws(()=>E.applyCommand(s,'klepikov',{type:'save',period:{...middle,end:'2027-04-15'}},now),/больше 21 дня/);
 let adjacent=E.initialState();for(const p of [period('2027-04-15','2027-04-21'),period('2027-04-01','2027-04-07'),period('2027-04-08','2027-04-14')])adjacent=E.applyCommand(adjacent,'klepikov',{type:'save',period:p},now);
 assert.equal(E.totals(adjacent.doctors[0]).used2027,21);
});
test('a calendar gap resets the run and recommendations preserve length under the 21 day cap',()=>{
 let s=E.initialState();for(const p of [period('2027-04-01','2027-04-14'),period('2027-04-15','2027-04-21')])s=E.applyCommand(s,'klepikov',{type:'save',period:p},now);
 const out=E.suggestions(s,'klepikov',period('2027-04-22','2027-04-28'));
 assert.equal(out.length,2);assert.equal(out.find(p=>p.direction===1).start,'2027-04-23');
 for(const p of out){assert.equal(E.leaveDays(p.start,p.end),7);assert.equal(E.checkCandidate(s,'klepikov',p).error,null);}
 s=E.applyCommand(s,'klepikov',{type:'save',period:period('2027-04-23','2027-05-07')},now);
 assert.equal(E.totals(s.doctors[0]).used2027,35);
});
test('2026 carryover joins 2027 days under the same continuous limit',()=>{
 let s=E.applyCommand(E.initialState(),'klepikov',{type:'carry',days:8},now);
 s=E.applyCommand(s,'klepikov',{type:'save',period:period('2027-04-01','2027-04-14')},now);
 const p=period('2027-04-15','2027-04-21','2026');s=E.applyCommand(s,'klepikov',{type:'save',period:p},now);
 assert.equal(E.totals(s.doctors[0]).used2027,14);assert.equal(E.totals(s.doctors[0]).used2026,7);
 assert.throws(()=>E.applyCommand(s,'klepikov',{type:'save',period:{...p,end:'2027-04-22'}},now),/больше 21 дня/);
});
test('holidays remain uncharged within the 21 day run while all absence dates stay reserved',()=>{
 let s=E.initialState();for(const p of [period('2027-03-01','2027-03-15'),period('2027-03-16','2027-03-22')])s=E.applyCommand(s,'klepikov',{type:'save',period:p},now);
 assert.equal(E.totals(s.doctors[0]).used2027,21);assert.equal(E.span('2027-03-01','2027-03-22'),22);
 assert.throws(()=>E.applyCommand(s,'klepikov',{type:'save',period:period('2027-03-23','2027-03-23')},now),/больше 21 дня/);
 assert.throws(()=>E.applyCommand(s,'omutov',{type:'save',period:period('2027-03-08','2027-03-09')},now),/заняты/);
});
test('doctor cannot mutate another doctor or confirm carryover',()=>{assert.throws(()=>E.applyCommand(E.initialState(),'leonard',{type:'carry',doctorId:'klepikov',days:3}),/только свои/);assert.throws(()=>E.applyCommand(E.initialState(),'leonard',{type:'confirmCarry'}),/ЕЮ/);});
test('carryover counted separately; positive carryover needs ЕЮ confirmation',()=>{let s=E.applyCommand(E.initialState(),'leonard',{type:'carry',days:5});assert.equal(s.doctors[4].carryConfirmed,false);s=E.applyCommand(s,'leonard',{type:'save',period:period('2027-04-01','2027-04-05','2026')});assert.equal(E.totals(s.doctors[4]).remaining2027,42);assert.equal(E.totals(s.doctors[4]).remaining2026,0);s=E.applyCommand(s,'klepikov',{type:'confirmCarry',doctorId:'leonard'});assert.equal(s.doctors[4].carryConfirmed,true);});
test('more than 15 carryover days requires overlaps but does not block another completed doctor',()=>{let s=E.applyCommand(fixture(),'leonard',{type:'carry',days:16});assert.equal(E.capacity(s).overlapNeeded,1);assert.equal(E.capacity(s).spare,-1);s=E.applyCommand(s,'klepikov',{type:'submit'});assert.equal(s.doctors[0].submitted,true);});
test('partial allocation cannot be submitted',()=>{assert.throws(()=>E.applyCommand(E.initialState(),'klepikov',{type:'submit'}),/распределить/);});
test('all eight complete with automatic final; final locks changes and reopen invalidates it',()=>{let s=fixture();for(const [i,d] of s.doctors.entries()){s=E.applyCommand(s,d.id,{type:'submit'},now);assert.equal(!!s.final,i===7);}assert.equal(E.rowsForExport(s).length,24);assert.equal(E.rowsForExport(s).reduce((n,r)=>n+r.days,0),336);assert.throws(()=>E.applyCommand(s,'leonard',{type:'withdraw'}),/сформирован/);s=E.applyCommand(s,'klepikov',{type:'reopen',doctorId:'leonard'});assert.equal(s.final,null);assert.equal(E.progress(s).left,1);});
test('remaining-doctor messages contain correct counts including ЕЮ',()=>{let s=fixture();s=E.applyCommand(s,'klepikov',{type:'submit'},now);assert.match(s.events.at(-1).text,/Готово 1 из 8; осталось 7/);});
test('same period is editable without colliding with itself',()=>{let s=E.initialState(),p=period('2027-04-01','2027-04-14');s=E.applyCommand(s,'klepikov',{type:'save',period:p});s=E.applyCommand(s,'klepikov',{type:'save',period:{...p,start:'2027-04-02',end:'2027-04-15'}});assert.equal(s.doctors[0].periods.length,1);});
test('ICS exclusive end date, stable UID, alarms, UTF8 line folding',()=>{const s=fixture(),ics=E.calendarICS(s,'klepikov',{now});assert(ics.includes('DTEND;VALUE=DATE:20270123'));assert(ics.includes('TRIGGER:-P14D'));assert(ics.includes('TRIGGER:-P1D'));assert.equal(ics.match(/BEGIN:VEVENT/g).length,3);for(const l of ics.split('\r\n'))assert(Buffer.byteLength(l)<=75);assert.equal(E.calendarICS(s,'klepikov',{now}),ics);});
test('polite reminders stop after submit, deadline and use a 3 day interval',()=>{const d=E.initialState().doctors[0];assert(E.reminderDue(d,null,new Date('2026-10-13T04:00:00Z')));assert(!E.reminderDue(d,'2026-10-13T04:00:00Z',new Date('2026-10-15T04:00:00Z')));assert(E.reminderDue(d,'2026-10-13T04:00:00Z',new Date('2026-10-16T04:00:00Z')));assert(!E.reminderDue(d,null,new Date('2026-10-31T19:00:00Z')));assert(!E.reminderDue({...d,submitted:true},null,new Date(now)));});
test('final exports are unavailable before completion',()=>{assert.throws(()=>E.csvExport(E.initialState()),/не сформирован/);});
export {fixture};

test('existing wishes and final dates survive adding initials to stored profiles',()=>{let legacy=fixture();for(const d of legacy.doctors)legacy=E.applyCommand(legacy,d.id,{type:'submit'},now);for(const list of [legacy.doctors,legacy.final.doctors])for(const d of list)d.name=d.name.split(' ')[0];const saved=structuredClone(legacy),updated=E.withDoctorNames(legacy);assert.deepEqual(legacy,saved);assert.equal(updated.version,legacy.version);assert.deepEqual(updated.doctors.map(d=>d.periods),legacy.doctors.map(d=>d.periods));assert.deepEqual(updated.final.doctors.map(d=>d.periods),legacy.final.doctors.map(d=>d.periods));assert.equal(updated.doctors.find(d=>d.id==='khamatnurova').name,'Хаматнурова А.А.');assert(E.csvExport(legacy).includes('Лекерова Д.С.'));assert(E.calendarICS(legacy,'klepikov',{now}).includes('Клепиков Е.Ю.'));});

