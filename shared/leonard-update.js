import {PEOPLE} from './engine.js';

export const LEONARD_UPDATE_ID='rules-2026-10-14-leonard-full-v1';
const OLD_NOTICE_ID='rules-2026-10-14-v2-leonard';

// Commit once through leave2027_commit so the notice and eight outbox jobs
// are saved atomically. Keep the superseded notice for the audit history.
export function prepareLeonardUpdate(original,now=new Date().toISOString()) {
  const state=structuredClone(original);
  if((state.policyUpdates??[]).includes(LEONARD_UPDATE_ID))return {state,events:[]};
  const notice={
    id:LEONARD_UPDATE_ID,type:'rules-update',at:now,to:PEOPLE.map(([id])=>id),
    text:'Всем привет! Правило пересечения с отпусками Леонард Т.В. обновлено: ограничение в 5 дней отменено. Теперь любой врач может полностью пересекаться с ней на все дни её отпуска, независимо от того, используются дни за 2027 год или перенесённые с 2026 года. На каждую дату вместе с Леонард может находиться в отпуске только один другой врач; одновременный отпуск трёх и более врачей не допускается. Спасибо! ЕЮ'
  };
  for(const event of state.events??[])if(event.id===OLD_NOTICE_ID)event.supersededBy=notice.id;
  state.events=[...(state.events??[]),notice].slice(-200);
  state.policyUpdates=[...(state.policyUpdates??[]),LEONARD_UPDATE_ID];
  state.version++;
  return {state,events:[notice]};
}
