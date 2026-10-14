export const YEAR = 2027;
export const START = '2027-01-01', END = '2027-12-31';
export const DEADLINE = '2026-10-31';
export const BASE_DAYS = 42, MAX_PART = 14, MAX_CONTINUOUS = 21;
export const MAX_CARRYOVER_OVERLAP = 3, MAX_SIMULTANEOUS_DOCTORS = 2;
export const MAX_LEONARD_OVERLAP = 5, MAX_SUMMER_DAYS = 21;
export const SUMMER_START = '2027-05-01', SUMMER_END = '2027-09-30';
export const PEOPLE = [
  ['klepikov','Клепиков Е.Ю.'],['kardashina','Кардашина К.К.'],['lekerova','Лекерова Д.С.'],
  ['khamatnurova','Хаматнурова А.А.'],['leonard','Леонард Т.В.'],['alekeshova','Алекешова Г.Ж.'],
  ['davydova','Давыдова Н.В.'],['omutov','Омутов М.Ю.']
];
export const HOLIDAYS = Object.freeze({
  '2027-01-01':'Новогодние каникулы','2027-01-02':'Новогодние каникулы',
  '2027-01-03':'Новогодние каникулы','2027-01-04':'Новогодние каникулы',
  '2027-01-05':'Новогодние каникулы','2027-01-06':'Новогодние каникулы',
  '2027-01-07':'Рождество Христово','2027-01-08':'Новогодние каникулы',
  '2027-02-23':'День защитника Отечества','2027-03-08':'Международный женский день',
  '2027-05-01':'Праздник Весны и Труда','2027-05-09':'День Победы',
  '2027-06-12':'День России','2027-11-04':'День народного единства'
});
export const TRANSFERRED = Object.freeze({
  '2027-02-22':'Перенос с 20 февраля','2027-05-03':'Выходной за 1 мая',
  '2027-05-10':'Выходной за 9 мая','2027-06-14':'Выходной за 12 июня',
  '2027-11-05':'Перенос с 2 января','2027-12-31':'Перенос с 3 января'
});
export const WORKING_WEEKENDS = ['2027-02-20'];
const DAY = 86400000;
export function isDate(s) { return typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s+'T00:00:00Z')) && new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s; }
export function date(s) { if(!isDate(s)) throw new Error('Укажите корректную дату.'); return new Date(s+'T00:00:00Z'); }
export function addDays(s,n) { return new Date(date(s).getTime()+n*DAY).toISOString().slice(0,10); }
export function span(a,b) { return Math.round((date(b)-date(a))/DAY)+1; }
export function dates(a,b) { if(!isDate(a)||!isDate(b)||a>b||span(a,b)>740) return []; const out=[]; for(let s=a;s<=b;s=addDays(s,1)) out.push(s); return out; }
export function leaveDays(a,b) { return dates(a,b).filter(s=>!HOLIDAYS[s]).length; }
export function endForDays(start,n) {
  if(!isDate(start)||!Number.isInteger(n)||n<1||n>MAX_PART) return null;
  let s=start,remaining=n;
  for(let i=0;i<40;i++,s=addDays(s,1)) { if(s>END) return null; if(!HOLIDAYS[s]) remaining--; if(!remaining) return s; }
  return null;
}
export const formatDate=(s)=>isDate(s)?new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short',timeZone:'UTC'}).format(date(s)):'';
export const formatRange=(p)=>`${formatDate(p.start)} — ${formatDate(p.end)}`;
export const isDayOff=s=>!!HOLIDAYS[s]||!!TRANSFERRED[s]||(!WORKING_WEEKENDS.includes(s)&&[0,6].includes(date(s).getUTCDay()));
export const uid=()=>crypto.randomUUID();
export function initialState() {
  return {schema:1,version:0,doctors:PEOPLE.map(([id,name])=>({id,name,carryover:null,carryConfirmed:false,periods:[],submitted:false,submittedAt:null})),events:[],final:null};
}
export function withDoctorNames(original) {
  const state=structuredClone(original),names=new Map(PEOPLE);
  for(const list of [state.doctors,state.final?.doctors]) {
    for(const d of list??[]) if(names.has(d.id)) d.name=names.get(d.id);
  }
  return state;
}
export function totals(d) {
  const used2027=d.periods.filter(p=>p.source==='2027').reduce((n,p)=>n+leaveDays(p.start,p.end),0);
  const used2026=d.periods.filter(p=>p.source==='2026').reduce((n,p)=>n+leaveDays(p.start,p.end),0);
  return {used2027,used2026,remaining2027:BASE_DAYS-used2027,remaining2026:(d.carryover??0)-used2026,total:BASE_DAYS+(d.carryover??0),used:used2027+used2026};
}
export function summerUsage(d) {
  const usedFor=source=>d.periods.filter(p=>p.source===source).reduce((n,p)=>n+leaveDays(p.start>SUMMER_START?p.start:SUMMER_START,p.end<SUMMER_END?p.end:SUMMER_END),0);
  const used2027=usedFor('2027'),used2026=usedFor('2026'),used=used2027+used2026;
  return {used2027,used2026,used,limit:MAX_SUMMER_DAYS,remaining:MAX_SUMMER_DAYS-used,exempt:d.id==='davydova'};
}
export function summerError(d) {
  const usage=summerUsage(d);
  return !usage.exempt&&usage.used>MAX_SUMMER_DAYS?`С 1 мая по 30 сентября разрешено не более 21 дня отпуска суммарно за 2027 год и из остатка 2026 года. Сейчас запланировано ${usage.used} дн. Пожалуйста, перенесите не менее ${usage.used-MAX_SUMMER_DAYS} дн. за пределы этого периода, чтобы сохранить доступность отпусков для всех коллег.`:null;
}
export function capacity(state) {
  const available=leaveDays(START,END),carry=state.doctors.reduce((n,d)=>n+(d.carryover??0),0);
  const needed=state.doctors.length*BASE_DAYS+carry;
  const overlapPlanned=overlapCheck(state.doctors).dates.filter(s=>!HOLIDAYS[s]).length;
  return {available,needed,carry,spare:available-needed,unknown:state.doctors.filter(d=>d.carryover===null).length,overlapNeeded:Math.max(0,needed-available),overlapPlanned};
}
export function overlaps(a,b) { return a.start<=b.end&&b.start<=a.end; }
export function periodError(p) {
  if(!isDate(p.start)||!isDate(p.end)||p.start>p.end) return 'Проверьте начало и окончание отпуска.';
  if(p.start<START||p.end>END) return 'Весь период должен находиться в 2027 году.';
  if(!['2027','2026'].includes(p.source)) return 'Выберите, за какой год используется отпуск.';
  const n=leaveDays(p.start,p.end);
  if(n<1) return 'В периоде должны быть дни отпуска, а не только праздники.';
  if(n>MAX_PART) return `Получается ${n} дней отпуска. Одна часть — не более 14 дней.`;
  return null;
}
export function collisions(state,doctorId,p,excludeId=null) {
  return state.doctors.flatMap(d=>d.periods.filter(q=>q.id!==excludeId&&overlaps(p,q)).map(q=>({doctor:d.id,name:d.name,...q})));
}
export function overlapCheck(doctors,focus=null) {
  const entries=doctors.flatMap(d=>d.periods.map(p=>({doctor:d.id,name:d.name,period:p})));
  const groups=[],groupFor=new Map(),leonardPairs=new Map(),allDates=new Set(),focusDates=new Set(),focusOthers=new Set();
  const asConflicts=items=>[...new Set(items)].filter(e=>e.period!==focus).map(e=>({doctor:e.doctor,name:e.name,...e.period}));
  const result=(error=null,conflicts=[])=>({error,conflicts,overlapDays:focusDates.size,overlaps:asConflicts(focusOthers),dates:[...allDates].sort()});
  // The limit applies to simultaneous absence on each calendar date, including holidays.
  const byDay=new Map();
  for(const e of entries)for(const day of dates(e.period.start,e.period.end)){
    if(!byDay.has(day))byDay.set(day,[]);
    byDay.get(day).push(e);
  }
  for(const [day,people] of [...byDay].sort(([a],[b])=>a.localeCompare(b))){
    if(new Set(people.map(e=>e.doctor)).size>MAX_SIMULTANEOUS_DOCTORS)return result(`${formatDate(day)}: одновременно допускается не более 2 врачей. Даже при разрешённом полном пересечении третий врач не может отсутствовать в эти даты.`,asConflicts(people));
  }
  // Adjacent carryover parts share one overlap allowance; splitting a run cannot multiply it.
  for(const d of doctors){
    let group=null;
    for(const e of entries.filter(e=>e.doctor===d.id&&e.period.source==='2026').sort((a,b)=>a.period.start.localeCompare(b.period.start))){
      const p=e.period;
      if(!group||p.start>addDays(group.end,1)){group={name:d.name,end:p.end,entries:[],others:new Set(),dates:new Set()};groups.push(group);}
      else if(p.end>group.end)group.end=p.end;
      group.entries.push(e);groupFor.set(e,group);
    }
  }
  for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
    const a=entries[i],b=entries[j],p=a.period,q=b.period;
    if(!overlaps(p,q))continue;
    if(a.doctor===b.doctor)return result('Эти даты уже заняты вашим отпуском. Части одного врача не могут пересекаться.',asConflicts([a,b]));
    const shared=dates(p.start>q.start?p.start:q.start,p.end<q.end?p.end:q.end);
    for(const day of shared){allDates.add(day);if(p===focus||q===focus)focusDates.add(day);}
    if(p===focus)focusOthers.add(b);if(q===focus)focusOthers.add(a);
    const pair=[a.doctor,b.doctor];
    const full=pair.includes('davydova')||(pair.includes('khamatnurova')&&(pair.includes('alekeshova')||pair.includes('leonard')));
    if(full)continue;
    if(pair.includes('leonard')){
      const other=a.doctor==='leonard'?b:a;
      if(!leonardPairs.has(other.doctor))leonardPairs.set(other.doctor,{name:other.name,dates:new Set(),entries:new Set()});
      const overlap=leonardPairs.get(other.doctor);
      for(const day of shared)overlap.dates.add(day);
      overlap.entries.add(a);overlap.entries.add(b);
      continue;
    }
    if(p.source===q.source)return result(`Эти даты уже заняты. Отпуска за ${p.source} год этих врачей не могут пересекаться.`,asConflicts([a,b]));
    const carry=p.source==='2026'?a:b,other=carry===a?b:a,group=groupFor.get(carry);
    for(const day of shared)group.dates.add(day);
    group.others.add(other);
  }
  // Combine adjacent intersections across all parts and both sources for each doctor pair.
  for(const overlap of leonardPairs.values()){
    let previous=null,run=0;
    for(const day of [...overlap.dates].sort()){
      run=previous&&day===addDays(previous,1)?run+1:1;
      if(run>MAX_LEONARD_OVERLAP)return result(`${overlap.name}: непрерывное пересечение с Леонард Т.В. превышает 5 календарных дней. Соседние части за 2027 год и из остатка 2026 года считаются вместе.`,asConflicts(overlap.entries));
      previous=day;
    }
  }
  for(const g of groups)if(g.dates.size>MAX_CARRYOVER_OVERLAP)return result(`${g.name}: пересечение остатка с 2026 года составляет ${g.dates.size} календ. дн. Допустимо не более 3 календарных дней на непрерывный период остатка, включая соседние части.`,asConflicts([...g.entries,...g.others]));
  return result();
}
export function consecutiveError(periods) {
  const ordered=[...periods].sort((a,b)=>a.start.localeCompare(b.start));
  let run=null;
  for(const p of ordered) {
    if(run&&p.start<=addDays(run.end,1)) { run.end=p.end>run.end?p.end:run.end; }
    else run={start:p.start,end:p.end};
    if(leaveDays(run.start,run.end)>MAX_CONTINUOUS) return 'Соседние части образуют непрерывный отпуск больше 21 дня. Оставьте хотя бы один день разрыва между ними.';
  }
  return null;
}
export function checkCandidate(state,doctorId,p,excludeId=null) {
  const error=periodError(p); if(error) return {error,conflicts:[]};
  const d=state.doctors.find(d=>d.id===doctorId);
  const periods=[...d.periods.filter(q=>q.id!==excludeId),p];
  const check=overlapCheck(state.doctors.map(x=>x.id===doctorId?{...x,periods}:x),p);
  if(check.error)return check;
  const adjacent=consecutiveError(periods); if(adjacent) return {error:adjacent,conflicts:[]};
  const summer=summerError({...d,periods});
  // Existing wishes can be repaired in several edits, but their summer total cannot grow or stay above the cap unchanged.
  if(summer&&summerUsage({...d,periods}).used>=summerUsage(d).used)return {error:summer,conflicts:[]};
  const t=totals({...d,periods});
  if(t.remaining2027<0) return {error:'Превышены 42 дня за 2027 год.',conflicts:[]};
  if(p.source==='2026'&&d.carryover===null) return {error:'Сначала укажите остаток с 2026 года.',conflicts:[]};
  if(t.remaining2026<0) return {error:'Превышен указанный остаток с 2026 года.',conflicts:[]};
  return check;
}
export function suggestions(state,doctorId,p,excludeId=null) {
  if(periodError(p)) return [];
  const n=leaveDays(p.start,p.end),found=[];
  for(const direction of [-1,1]) {
    for(let shift=1;shift<365;shift++) {
      const start=addDays(p.start,direction*shift); if(start<START||start>END) break;
      const end=endForDays(start,n); if(!end) continue;
      const q={...p,start,end};
      if(!checkCandidate(state,doctorId,q,excludeId).error) {found.push({...q,direction,shift});break;}
    }
  }
  return found.sort((a,b)=>a.shift-b.shift);
}
export function completionIssues(d) {
  const t=totals(d),errors=[];
  const summer=summerError(d);if(summer)errors.push(summer);
  if(d.carryover===null) errors.push('Укажите остаток с 2026 года, в том числе нулевой.');
  if(t.remaining2027!==0) errors.push(`Нужно распределить ещё ${t.remaining2027} дн. за 2027 год.`);
  if(t.remaining2026!==0) errors.push(`Нужно распределить ещё ${t.remaining2026} дн. за 2026 год.`);
  if(!d.periods.some(p=>p.source==='2027'&&leaveDays(p.start,p.end)===14)) errors.push('Нужна хотя бы одна часть 14 дней за 2027 год.');
  return errors;
}
export function ready(state) {
  return state.doctors.every(d=>d.submitted&&d.carryConfirmed&&completionIssues(d).length===0)&&!overlapCheck(state.doctors).error;
}
export function status(d) { return d.submitted?(d.carryConfirmed?'Готово':'Остаток на согласовании'):(d.periods.length?'Заполняет':'Не заполнено'); }
export function progress(state) { const done=state.doctors.filter(d=>d.submitted).length;return {done,total:state.doctors.length,left:state.doctors.length-done,unconfirmed:state.doctors.filter(d=>d.carryover>0&&!d.carryConfirmed).length}; }
function event(state,type,text,to,now) { state.events.push({id:uid(),type,text,to,at:now});state.events=state.events.slice(-200); }
export function applyCommand(original,actor,cmd,now=new Date().toISOString()) {
  const state=withDoctorNames(original);
  const admin=actor==='klepikov';
  const own=state.doctors.find(d=>d.id===actor);
  if(!own) throw new Error('Откройте приложение по своей ссылке.');
  const target=cmd.doctorId??actor, d=state.doctors.find(d=>d.id===target);
  if(!d) throw new Error('Врач не найден.');
  if(target!==actor&&!admin) throw new Error('Можно изменять только свои пожелания.');
  if(state.final&&cmd.type!=='reopen') throw new Error('График сформирован. Для изменений обратитесь к ЕЮ.');
  if(d.submitted&&!['withdraw','confirmCarry','reopen'].includes(cmd.type)) throw new Error('Сначала верните пожелания к редактированию.');
  if(cmd.type==='carry') {
    if(!Number.isInteger(cmd.days)||cmd.days<0||cmd.days>366) throw new Error('Остаток должен быть целым числом от 0 до 366.');
    if(totals(d).used2026>cmd.days) throw new Error('Остаток меньше уже распределённых дней за 2026 год.');
    d.carryover=cmd.days;d.carryConfirmed=cmd.days===0||admin;
    if(cmd.days>0&&!admin) event(state,'carry',`${d.name}: заявлен остаток ${cmd.days} дн. за 2026 год.`,['klepikov'],now);
  } else if(cmd.type==='save') {
    const p={id:cmd.period.id??uid(),start:cmd.period.start,end:cmd.period.end,source:cmd.period.source};
    if(d.periods.length>=60&&!d.periods.some(q=>q.id===p.id)) throw new Error('Слишком много частей отпуска.');
    if(state.doctors.some(x=>x.id!==d.id&&x.periods.some(q=>q.id===p.id))) throw new Error('Некорректный идентификатор периода.');
    const check=checkCandidate(state,target,p,p.id); if(check.error) throw new Error(check.error);
    d.periods=[...d.periods.filter(q=>q.id!==p.id),p].sort((a,b)=>a.start.localeCompare(b.start));
  } else if(cmd.type==='delete') { d.periods=d.periods.filter(p=>p.id!==cmd.id);
  } else if(cmd.type==='submit') {
    const issues=completionIssues(d);if(issues.length) throw new Error(issues.join(' '));
    const overlap=overlapCheck(state.doctors);if(overlap.error)throw new Error(overlap.error);
    d.submitted=true;d.submittedAt=now;
    const count=progress(state);event(state,'submitted',`${d.name} завершил(а) пожелания. Готово ${count.done} из ${count.total}; осталось ${count.left}.`,['klepikov'],now);
  } else if(cmd.type==='withdraw') {
    d.submitted=false;d.submittedAt=null;
    event(state,'withdrawn',`${d.name} вернул(а) пожелания к редактированию.`,['klepikov'],now);
  } else if(cmd.type==='confirmCarry') {
    if(!admin) throw new Error('Остаток подтверждает ЕЮ.');
    if(d.carryover===null) throw new Error('Врач ещё не указал остаток.');
    d.carryConfirmed=true;event(state,'carry-confirmed','ЕЮ подтвердил остаток отпуска с 2026 года.',[d.id],now);
  } else if(cmd.type==='reopen') {
    if(!admin) throw new Error('Изменения в итоговом графике открывает ЕЮ.');
    state.final=null;d.submitted=false;d.submittedAt=null;
    event(state,'reopened',`ЕЮ открыл редактирование для ${d.name}. Итоговый график будет сформирован заново.`,state.doctors.map(x=>x.id),now);
  } else throw new Error('Неизвестное действие.');
  state.version++;
  if(ready(state)) {
    state.final={id:uid(),generatedAt:now,version:state.version,doctors:structuredClone(state.doctors)};
    event(state,'final','Все пожелания собраны. Итоговый график на 2027 год готов.',state.doctors.map(x=>x.id),now);
  }
  return state;
}
export function todayYekaterinburg(now=new Date()) { return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Yekaterinburg',year:'numeric',month:'2-digit',day:'2-digit'}).format(now); }
export function reminderDue(d,lastAt,now=new Date()) {
  const today=todayYekaterinburg(now);
  if(today<'2026-10-13'||today>DEADLINE||d.submitted) return false;
  return !lastAt||today>=addDays(lastAt.slice(0,10),3);
}
export const REMINDER='Коллега, пожалуйста, когда будет удобно, внесите пожелания по отпуску на 2027 год до 1 ноября. Спасибо! ЕЮ';
export function rowsForExport(state) {
  if(!state.final) throw new Error('Итоговый график ещё не сформирован.');
  return withDoctorNames(state).final.doctors.flatMap(d=>d.periods.map((p,i)=>({name:d.name,part:i+1,start:p.start,end:p.end,days:leaveDays(p.start,p.end),span:span(p.start,p.end),source:p.source}))).sort((a,b)=>a.name.localeCompare(b.name,'ru')||a.start.localeCompare(b.start));
}
const icsEscape=s=>String(s).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
function foldLine(s) {let lines=[],line='',length=0;for(const c of s){const n=new TextEncoder().encode(c).length;if(length+n>73){lines.push(line);line=' ';length=1;}line+=c;length+=n;}lines.push(line);return lines.join('\r\n');}
export function calendarICS(state,doctorId,{tasks=false,now=new Date().toISOString()}={}) {
  state=withDoctorNames(state);
  const d=state.doctors.find(x=>x.id===doctorId);if(!d) throw new Error('Врач не найден.');
  const stamp=now.replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const out=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//PSO//Leave 2027//RU','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:Мой отпуск · ПСО 2027','REFRESH-INTERVAL;VALUE=DURATION:PT6H','X-PUBLISHED-TTL:PT6H'];
  const list=state.final?state.final.doctors.find(x=>x.id===doctorId).periods:d.periods;
  for(const p of list) {
    out.push('BEGIN:VEVENT',`UID:${p.id}@pso-leave-2027`,`SEQUENCE:${state.version}`,`DTSTAMP:${stamp}`,`DTSTART;VALUE=DATE:${p.start.replaceAll('-','')}`,`DTEND;VALUE=DATE:${addDays(p.end,1).replaceAll('-','')}`,`SUMMARY:${icsEscape(`Отпуск · ${d.name}${state.final?'':' · пожелание'}`)}`,`DESCRIPTION:${icsEscape(`${leaveDays(p.start,p.end)} дней за ${p.source} год. ${state.final?'Итоговый график.':'Даты ещё не окончательные.'}`)}`,'TRANSP:OPAQUE','BEGIN:VALARM','TRIGGER:-P14D','ACTION:DISPLAY','DESCRIPTION:Отпуск через 14 дней','END:VALARM','BEGIN:VALARM','TRIGGER:-P1D','ACTION:DISPLAY','DESCRIPTION:Отпуск начинается завтра','END:VALARM','END:VEVENT');
  }
  if(tasks) out.push('BEGIN:VTODO',`UID:prepare-${d.id}-2027@pso-leave-2027`,`DTSTAMP:${stamp}`,'DUE;VALUE=DATE:20261031','SUMMARY:Внести пожелания по отпуску на 2027 год',`STATUS:${d.submitted?'COMPLETED':'NEEDS-ACTION'}`,'END:VTODO');
  return out.concat('END:VCALENDAR').map(foldLine).join('\r\n')+'\r\n';
}
export function csvExport(state) {
  const data=[['Врач','Часть','Начало','Окончание','Дней отпуска','Дней отсутствия','За какой год'],...rowsForExport(state).map(r=>[r.name,r.part,r.start,r.end,r.days,r.span,r.source])];
  return '\ufeff'+data.map(row=>row.map(x=>'"'+String(x).replaceAll('"','""')+'"').join(';')).join('\r\n');
}

