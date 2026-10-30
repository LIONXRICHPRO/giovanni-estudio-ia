export const sections = [
  { id: 'inicio', name: 'Antes de empezar', short: 'Bienvenida', number: '01' },
  { id: 'voz', name: 'Su voz y sus referencias', short: 'Su voz', number: '02' },
  { id: 'fuentes', name: 'Su criterio médico', short: 'Sus fuentes', number: '03' },
  { id: 'audiencia', name: 'Audiencia y prioridades', short: 'Sus temas', number: '04' },
  { id: 'propuestas', name: 'Temas propuestos', short: 'Sus propuestas', number: '05' },
  { id: 'ejemplo', name: 'Así lo explicaría usted', short: 'Su explicación', number: '06' },
  { id: 'limites', name: 'Límites, identidad y voz', short: 'Sus límites', number: '07' },
  { id: 'reunion', name: 'Listos para la reunión', short: 'Nuestra reunión', number: '08' },
];
export const groups = {
  voz: ['reference1','preserve1','reference2','preserve2','reference3','preserve3','avoidExample','address','expressions','humor'],
  fuentes: ['researchExample','source1','source2','source3','evidenceCriteria'],
  audiencia: ['audience','consultation'],
  ejemplo: ['sampleQuestion','sampleAnswer','sampleEvidence'],
  limites: ['avoidTopics','priorReview','voiceChoice','professionalIdentity'],
  reunion: ['instagram','tiktok','youtube','reportEmail','meetingNotes'],
};
export const allFields = Object.values(groups).flat();
export function cleanAnswers(value) {
  const clean = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return clean;
  for (const key of allFields) if (typeof value[key] === 'string') clean[key] = value[key].slice(0,6000);
  for (let n=1;n<=5;n++) if (typeof value[`ready${n}`] === 'boolean') clean[`ready${n}`] = value[`ready${n}`];
  return clean;
}
export function completion(answers, keys=allFields) {
  const filled = keys.filter(key=>typeof answers[key] === 'string' && answers[key].trim()).length;
  return { filled, total:keys.length, percent:Math.round(filled/keys.length*100) };
}
export function escapeHtml(value='') { return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
