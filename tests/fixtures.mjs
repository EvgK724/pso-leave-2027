import * as E from '../shared/engine.js';

export function fixture(now='2026-10-13T04:00:00.000Z') {
  let state=E.initialState();
  for(const d of state.doctors)state=E.applyCommand(state,d.id,{type:'carry',days:0},now);
  const allocate=(doctorId,start)=>{
    const end=E.endForDays(start,14);
    state=E.applyCommand(state,doctorId,{type:'save',period:{id:crypto.randomUUID(),start,end,source:'2027'}},now);
    return E.addDays(end,1);
  };
  // Keep 42 days in three parts for everyone, with at most 21 summer days
  // for non-exempt doctors and no overlaps in the baseline schedule.
  let start='2027-01-09';
  for(const [id] of E.PEOPLE.filter(([id])=>id!=='davydova'))start=allocate(id,start);
  start=allocate('klepikov',start);
  for(const id of ['kardashina','davydova','lekerova','khamatnurova','davydova','leonard','alekeshova','davydova','omutov','klepikov'])start=allocate(id,start);
  start='2027-10-01';
  for(const [id] of E.PEOPLE.filter(([id])=>!['davydova','klepikov'].includes(id)))start=allocate(id,start);
  return state;
}
