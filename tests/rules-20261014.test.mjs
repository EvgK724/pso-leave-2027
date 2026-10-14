import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../shared/engine.js';

const period=(start,end,source='2027')=>({id:crypto.randomUUID(),start,end,source});
function doctor(id,periods=[]){
  const d=E.initialState().doctors.find(d=>d.id===id);
  return {...d,periods,carryover:periods.filter(p=>p.source==='2026').reduce((n,p)=>n+E.leaveDays(p.start,p.end),0),carryConfirmed:true};
}
function stateWith(...doctors){
  const state=E.initialState();
  state.doctors=state.doctors.map(d=>doctors.find(q=>q.id===d.id)??doctor(d.id));
  return state;
}
const save=(state,id,p)=>E.applyCommand(state,id,{type:'save',period:p});

test('Davydova can fully overlap each colleague for every source combination, symmetrically',()=>{
  for(const [other] of E.PEOPLE.filter(([id])=>id!=='davydova'))for(const sourceA of ['2026','2027'])for(const sourceB of ['2026','2027']){
    const a=doctor('davydova',[period('2027-04-01','2027-04-14',sourceA)]);
    const b=doctor(other,[period('2027-04-01','2027-04-14',sourceB)]);
    for(const [existing,incoming] of [[a,b],[b,a]]){
      const state=stateWith(existing,{...incoming,periods:[]});
      const check=E.checkCandidate(state,incoming.id,incoming.periods[0]);
      assert.equal(check.error,null,`${existing.id}/${sourceA} with ${incoming.id}/${sourceB}`);
      assert.equal(check.overlapDays,14);
      assert.deepEqual(check.overlaps.map(p=>p.doctor),[existing.id]);
      assert.equal(save(state,incoming.id,incoming.periods[0]).doctors.find(d=>d.id===incoming.id).periods.length,1);
    }
  }
});

test('Khamatnurova fully overlaps Alekeshova and Leonard, in either direction and source',()=>{
  for(const other of ['alekeshova','leonard'])for(const sourceA of ['2026','2027'])for(const sourceB of ['2026','2027']){
    const a=doctor('khamatnurova',[period('2027-03-01','2027-03-15',sourceA)]);
    const b=doctor(other,[period('2027-03-01','2027-03-15',sourceB)]);
    for(const [existing,incoming] of [[a,b],[b,a]]){
      const check=E.checkCandidate(stateWith(existing,{...incoming,periods:[]}),incoming.id,incoming.periods[0]);
      assert.equal(check.error,null);assert.equal(check.overlapDays,15);
    }
  }
});

test('full-overlap exceptions do not allow self-overlap or three absent doctors, including holidays',()=>{
  const davydova=doctor('davydova',[period('2027-03-01','2027-03-08')]);
  assert.match(E.checkCandidate(stateWith(davydova),'davydova',period('2027-03-08','2027-03-09')).error,/одного врача не могут пересекаться/);
  for(const source of ['2026','2027']){
    const state=stateWith(davydova,doctor('leonard',[period('2027-03-08','2027-03-09')]),{...doctor('khamatnurova'),carryover:2});
    const check=E.checkCandidate(state,'khamatnurova',period('2027-03-08','2027-03-09',source));
    assert.match(check.error,/8 мар.*не более 2 врачей/);
    assert.deepEqual(check.conflicts.map(p=>p.doctor).sort(),['davydova','leonard']);
  }
});

test('two distinct colleagues can take turns overlapping Davydova, but cannot share their handoff day',()=>{
  const state=stateWith(doctor('davydova',[period('2027-04-01','2027-04-14')]),doctor('klepikov',[period('2027-04-01','2027-04-07')]));
  assert.equal(E.checkCandidate(state,'kardashina',period('2027-04-08','2027-04-14')).error,null);
  assert.match(E.checkCandidate(state,'kardashina',period('2027-04-07','2027-04-14')).error,/не более 2 врачей/);
});

test('Leonard permits five but not six calendar days for every ordinary pair and both sources',()=>{
  for(const [id] of E.PEOPLE.filter(([id])=>!['davydova','khamatnurova','leonard'].includes(id)))for(const sourceA of ['2026','2027'])for(const sourceB of ['2026','2027'])for(const count of [5,6]){
    const a=doctor('leonard',[period('2027-04-01','2027-04-14',sourceA)]);
    const b=doctor(id,[period(`2027-04-${String(15-count).padStart(2,'0')}`,'2027-04-14',sourceB)]);
    for(const [existing,incoming] of [[a,b],[b,a]]){
      const check=E.checkCandidate(stateWith(existing,{...incoming,periods:[]}),incoming.id,incoming.periods[0]);
      if(count===5){assert.equal(check.error,null);assert.equal(check.overlapDays,5);}
      else assert.match(check.error,/превышает 5 календарных дней/);
    }
  }
});

test('Leonard overlap counts a holiday as a calendar day',()=>{
  const state=stateWith(doctor('leonard',[period('2027-03-01','2027-03-15')]));
  assert.equal(E.checkCandidate(state,'klepikov',period('2027-03-06','2027-03-10')).error,null);
  assert.equal(E.leaveDays('2027-03-06','2027-03-11'),5);
  assert.match(E.checkCandidate(state,'klepikov',period('2027-03-06','2027-03-11')).error,/превышает 5 календарных дней/);
});

test('Leonard adjacent parts across both sources cannot split a continuous six-day intersection',()=>{
  for(const splitDoctor of ['leonard','klepikov']){
    const other=splitDoctor==='leonard'?'klepikov':'leonard';
    const first=period('2027-04-01','2027-04-03','2026'),second=period('2027-04-04','2027-04-06');
    const state=stateWith({...doctor(splitDoctor,[first]),carryover:6},doctor(other,[period('2027-04-01','2027-04-06')]));
    assert.equal(E.overlapCheck(state.doctors).error,null);
    assert.match(E.checkCandidate(state,splitDoctor,second).error,/превышает 5 календарных дней/);
  }
  const bothSplit=[doctor('leonard',[period('2027-04-01','2027-04-02'),period('2027-04-03','2027-04-06','2026')]),doctor('klepikov',[period('2027-04-01','2027-04-03','2026'),period('2027-04-04','2027-04-06')])];
  assert.match(E.overlapCheck(bothSplit).error,/превышает 5 календарных дней/);
});

test('a calendar gap resets Leonard allowance; editing a bridge rechecks the entire intersection',()=>{
  const first=period('2027-04-01','2027-04-05'),second=period('2027-04-07','2027-04-11');
  const state=stateWith(doctor('leonard',[period('2027-04-01','2027-04-14')]),doctor('klepikov',[first,second]));
  assert.equal(E.overlapCheck(state.doctors).error,null);
  assert.equal(E.overlapCheck(state.doctors).dates.length,10);
  assert.match(E.checkCandidate(state,'klepikov',{...second,start:'2027-04-06'},second.id).error,/превышает 5 календарных дней/);
  assert.match(E.checkCandidate(state,'klepikov',period('2027-04-06','2027-04-06')).error,/превышает 5 календарных дней/);
  assert.equal(state.doctors.find(d=>d.id==='klepikov').periods[1].start,'2027-04-07');
});

test('Leonard five-day allowance belongs to each doctor pair while the simultaneous-doctor cap remains',()=>{
  const state=stateWith(doctor('leonard',[period('2027-04-01','2027-04-14')]),doctor('klepikov',[period('2027-04-01','2027-04-05')]));
  assert.equal(E.checkCandidate(state,'kardashina',period('2027-04-06','2027-04-10')).error,null);
  assert.match(E.checkCandidate(state,'kardashina',period('2027-04-05','2027-04-09')).error,/не более 2 врачей/);
});

test('ordinary pairs retain same-source prohibition and a three-day carryover allowance',()=>{
  for(const source of ['2026','2027']){
    const a=doctor('klepikov',[period('2027-04-01','2027-04-14',source)]);
    const b={...doctor('kardashina'),carryover:14};
    assert.match(E.checkCandidate(stateWith(a,b),'kardashina',period('2027-04-12','2027-04-14',source)).error,/не могут пересекаться/);
    const otherSource=source==='2026'?'2027':'2026';
    assert.equal(E.checkCandidate(stateWith(a,b),'kardashina',period('2027-04-12','2027-04-14',otherSource)).error,null);
    assert.match(E.checkCandidate(stateWith(a,b),'kardashina',period('2027-04-11','2027-04-14',otherSource)).error,/не более 3 календарных дней/);
  }
});

test('full and Leonard exception dates do not consume an ordinary carryover overlap allowance',()=>{
  const periods=[period('2027-04-01','2027-04-14','2026')];
  const state=stateWith(doctor('klepikov',periods),doctor('davydova',[period('2027-04-01','2027-04-05')]),doctor('leonard',[period('2027-04-06','2027-04-10')]),doctor('kardashina',[period('2027-04-12','2027-04-14')]));
  assert.equal(E.overlapCheck(state.doctors).error,null);
  assert.equal(E.overlapCheck(state.doctors).dates.length,13);
  const ordinary=state.doctors.find(d=>d.id==='kardashina').periods[0];
  assert.match(E.checkCandidate(state,'kardashina',{...ordinary,start:'2027-04-11'},ordinary.id).error,/составляет 4.*не более 3 календарных дней/);
});

test('summer usage clips May and September boundaries, combines sources and excludes only statutory holidays',()=>{
  const d=doctor('klepikov',[
    period('2027-04-25','2027-05-05'),period('2027-05-08','2027-05-10','2026'),
    period('2027-06-11','2027-06-14'),period('2027-09-27','2027-10-04','2026'),
    period('2027-01-09','2027-01-22'),period('2027-12-01','2027-12-14')
  ]);
  assert.deepEqual(E.summerUsage(d),{used2027:7,used2026:6,used:13,limit:21,remaining:8,exempt:false});
  assert.equal(E.summerError(d),null);
  assert.equal(E.summerUsage(doctor('klepikov',[period('2027-05-01','2027-05-01')])).used,0);
  assert.equal(E.summerUsage(doctor('klepikov',[period('2027-09-30','2027-09-30')])).used,1);
});

test('summer cap is cumulative across separated 2027 and 2026 parts; 21 passes and 22 fails',()=>{
  const state=stateWith({...doctor('klepikov'),carryover:8});
  const fourteen=period('2027-06-01','2027-06-15'),seven=period('2027-08-01','2027-08-07','2026');
  let saved=save(save(state,'klepikov',fourteen),'klepikov',seven);
  assert.equal(E.summerUsage(saved.doctors[0]).used,21);
  for(const source of ['2026','2027'])assert.throws(()=>save(saved,'klepikov',period('2027-09-30','2027-09-30',source)),/не более 21 дня отпуска суммарно/);
  saved=save(saved,'klepikov',period('2027-10-01','2027-10-01'));
  assert.equal(E.summerUsage(saved.doctors[0]).used,21);
  assert.equal(E.checkCandidate(saved,'klepikov',seven,seven.id).error,null);
});

test('editing a winter period into summer cannot bypass cumulative limit',()=>{
  const winter=period('2027-02-01','2027-02-07');
  const state=stateWith(doctor('klepikov',[period('2027-05-16','2027-05-29'),period('2027-08-01','2027-08-07'),winter]));
  const before=structuredClone(state);
  assert.throws(()=>save(state,'klepikov',{...winter,start:'2027-09-01',end:'2027-09-07'}),/С 1 мая по 30 сентября/);
  assert.deepEqual(state,before);
});

test('Davydova alone is exempt from summer cap, while her continuous 21-day cap stays',()=>{
  for(const [id] of E.PEOPLE){
    const d=doctor(id,[period('2027-05-16','2027-05-29'),period('2027-08-01','2027-08-14')]);
    assert.equal(E.summerError(d)===null,id==='davydova');
  }
  let state=stateWith(doctor('davydova',[period('2027-05-16','2027-05-29')]));
  state=save(state,'davydova',period('2027-08-01','2027-08-14'));
  assert.equal(E.summerUsage(state.doctors.find(d=>d.id==='davydova')).used,28);
  state=stateWith(doctor('davydova',[period('2027-04-01','2027-04-14')]));
  assert.throws(()=>save(state,'davydova',period('2027-04-15','2027-04-22')),/больше 21 дня/);
});

test('an existing summer violation can be repaired incrementally but cannot increase or stay unchanged on save',()=>{
  const july=period('2027-07-01','2027-07-14'),september=period('2027-09-01','2027-09-07');
  const d=doctor('klepikov',[period('2027-05-16','2027-05-29'),july,september]);
  let state=stateWith(d);
  assert.equal(E.summerUsage(d).used,35);
  assert.throws(()=>save(state,'klepikov',{...september,start:'2027-09-02',end:'2027-09-08'}),/С 1 мая по 30 сентября/);
  assert.throws(()=>save(state,'klepikov',period('2027-09-15','2027-09-15')),/С 1 мая по 30 сентября/);
  state=save(state,'klepikov',{...september,start:'2027-10-01',end:'2027-10-07'});
  assert.equal(E.summerUsage(state.doctors[0]).used,28);
  assert.throws(()=>E.applyCommand(state,'klepikov',{type:'submit'}),/С 1 мая по 30 сентября/);
  state=save(state,'klepikov',{...july,start:'2027-11-01',end:'2027-11-15'});
  assert.equal(E.summerError(state.doctors[0]),null);
  assert.equal(E.summerUsage(state.doctors[0]).used,14);
});

test('other doctors summer violations do not block an unrelated compliant save; deletion remains possible',()=>{
  const first=period('2027-05-16','2027-05-29'),second=period('2027-08-01','2027-08-14');
  let state=stateWith(doctor('kardashina',[first,second]));
  state=save(state,'klepikov',period('2027-02-01','2027-02-14'));
  assert.equal(state.doctors[0].periods.length,1);
  state=E.applyCommand(state,'kardashina',{type:'delete',id:first.id});
  assert.equal(E.summerError(state.doctors.find(d=>d.id==='kardashina')),null);
});

test('summer violations block completion, submit and automatic final until corrected',()=>{
  const d=doctor('klepikov',[period('2027-01-09','2027-01-22'),period('2027-05-16','2027-05-29'),period('2027-07-01','2027-07-14')]);
  assert.equal(E.totals(d).remaining2027,0);
  assert.equal(E.completionIssues(d).length,1);
  const state={...E.initialState(),doctors:[d]};
  assert.throws(()=>E.applyCommand(state,'klepikov',{type:'submit'}),/С 1 мая по 30 сентября/);
  assert.equal(E.ready({...state,doctors:[{...d,submitted:true}]}),false);
  const moved={...d.periods[2],start:'2027-10-01',end:'2027-10-14'};
  const repaired=save(state,'klepikov',moved);
  assert.deepEqual(E.completionIssues(repaired.doctors[0]),[]);
  const submitted=E.applyCommand(repaired,'klepikov',{type:'submit'});
  assert.equal(E.ready(submitted),true);assert(submitted.final);
});

test('date suggestions observe Leonard and summer allowances while retaining charged length',()=>{
  const state=stateWith(doctor('leonard',[period('2027-04-01','2027-04-14')]),doctor('klepikov',[period('2027-05-16','2027-05-29'),period('2027-08-01','2027-08-07')]));
  const suggestions=E.suggestions(state,'klepikov',period('2027-09-01','2027-09-07'));
  assert.equal(suggestions.length,2);
  for(const p of suggestions){
    assert.equal(E.leaveDays(p.start,p.end),7);
    assert.equal(E.checkCandidate(state,'klepikov',p).error,null);
    assert.equal(E.summerUsage({...state.doctors[0],periods:[...state.doctors[0].periods,p]}).used,21);
  }
});
