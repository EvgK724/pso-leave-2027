import {PEOPLE,summerUsage,withDoctorNames} from './engine.js';

export const RULES_UPDATE_ID='rules-2026-10-14-v2';

// One-time, deterministic campaign. The caller commits the result with
// leave2027_commit(expectedVersion, state), which atomically creates the outbox.
// This module never sends messages or changes dates itself.
export function prepareRulesUpdate(original,now=new Date().toISOString()) {
  const state=withDoctorNames(original);
  if((state.policyUpdates??[]).includes(RULES_UPDATE_ID))return {state,events:[],affected:[]};
  const events=[],affected=[];
  const add=(suffix,text,to)=>events.push({id:`${RULES_UPDATE_ID}-${suffix}`,type:'rules-update',text,to,at:now});
  add('davydova','Всем привет! Обновлены правила графика отпусков: ваши отпуска за 2027 год и перенесённые с 2026 года могут полностью пересекаться с отпусками Давыдовой Н.В., независимо от года списания её отпуска. На любую дату вместе с ней может отдыхать только один другой врач; одновременный отпуск трёх и более врачей не допускается. Спасибо! ЕЮ',PEOPLE.map(([id])=>id).filter(id=>id!=='davydova'));
  add('khamatnurova','Для вас разрешено полное пересечение отпусков за 2027 год и перенесённых с 2026 года с отпусками Алекешовой Г.Ж. или Леонард Т.В., независимо от года списания. Одновременно могут отсутствовать не более двух врачей, поэтому пересечение сразу с обеими коллегами на одну дату не допускается. Спасибо! ЕЮ',['khamatnurova']);
  add('leonard','Всем привет! С отпусками Леонард Т.В. теперь можно пересекаться до 5 календарных дней на каждое непрерывное пересечение, независимо от года списания отпуска. Праздники и выходные входят в эти 5 дней; соседние части не обнуляют лимит. На любую дату с ней может отдыхать только один другой врач. Для Хаматнуровой А.А. и Давыдовой Н.В. действует отдельное разрешение на полное пересечение. Спасибо! ЕЮ',PEOPLE.map(([id])=>id));
  for(const d of state.doctors){
    const summer=summerUsage(d);
    if(summer.exempt||summer.used<=summer.limit)continue;
    const wasSubmitted=d.submitted;
    affected.push({id:d.id,name:d.name,used:summer.used,excess:summer.used-summer.limit,wasSubmitted});
    d.submitted=false;d.submittedAt=null;
    add(`summer-${d.id}`,`Для равномерного распределения отпусков с 1 мая по 30 сентября установлен общий лимит 21 день отпуска на врача, суммарно за 2027 год и из остатка с 2026 года. Нерабочие праздничные дни в этот лимит не входят. В ваших пожеланиях на этот период сейчас ${summer.used} дн. Пожалуйста, когда будет удобно, перенесите не менее ${summer.used-summer.limit} дн. за пределы мая–сентября, чтобы осталось не более 21 дня. Все выбранные даты сохранены.${wasSubmitted?' Заявка возвращена к редактированию.':''} После исправления передайте пожелания повторно. Спасибо за понимание! ЕЮ`,[d.id]);
  }
  if(affected.length)state.final=null;
  state.events=[...(state.events??[]),...events].slice(-200);
  state.policyUpdates=[...(state.policyUpdates??[]),RULES_UPDATE_ID];
  state.version++;
  return {state,events,affected};
}
