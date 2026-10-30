import {sections,groups,allFields,cleanAnswers,completion,validToken,escapeHtml as esc} from './model.js';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './config.js';

const $=selector=>document.querySelector(selector);
const params=new URLSearchParams(location.hash.slice(1));
let storedToken;try{storedToken=localStorage.getItem('giovanni-estudio-ia:last-session');}catch{}
const token=validToken(params.get('s'))?params.get('s'):validToken(storedToken)?storedToken:Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
const storageKey=`giovanni-estudio-ia:${token}`;
let cached;try{cached=JSON.parse(localStorage.getItem(storageKey)||'null');localStorage.setItem('giovanni-estudio-ia:last-session',token);}catch{}
let answers=cleanAnswers(cached?.answers),revision=Number.isInteger(cached?.revision)?cached.revision:0;
let dirty=Boolean(cached?.dirty),section=sections.some(s=>s.id===params.get('p'))?params.get('p'):'inicio';
let booting=true,saving=false,conflict=false,pendingSave=false,saveTimer,changeCounter=0,lastSavedAt=cached?.savedAt;
const labels={};

function setStatus(message,state='local'){$('#save-status').textContent=message;$('#save-status').dataset.state=state;}
function localDraft(){try{localStorage.setItem(storageKey,JSON.stringify({answers,revision,dirty,savedAt:lastSavedAt}));return true;}catch{toast('El navegador no permite guardar la copia local. Exporte sus respuestas para conservarlas.');return false;}}
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,6500);}
async function rpc(name,body){
 const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000),cache:'no-store'});
 const data=await response.json().catch(()=>null);
 if(!response.ok){const error=new Error(data?.message||'No se pudo conectar con el guardado en línea.');error.code=data?.code;throw error;}
 return data;
}
async function save(manual=false){
 clearTimeout(saveTimer);
 if(booting){if(manual)toast('Espere un momento mientras recuperamos su sesión.');return;}
 if(conflict){toast('Hay otra versión guardada. Exporte su copia y recargue la versión en línea antes de continuar.');return;}
 if(saving){pendingSave=true;return;}
 if(!dirty&&revision>0){if(manual)toast('Sus respuestas ya están guardadas en línea.');return;}
 saving=true;const counter=changeCounter;const snapshot=cleanAnswers(answers);setStatus('Guardando…');$('#save-button').disabled=true;
 try{
  const result=await rpc('giovanni_fase1_save',{p_token:token,p_answers:snapshot,p_expected_revision:revision});
  revision=result.revision;lastSavedAt=result.updated_at;dirty=changeCounter!==counter;localDraft();
  setStatus(dirty?'Cambios pendientes':'Guardado en línea',dirty?'local':'saved');
  if(manual)toast('Respuestas guardadas. Puede cerrar y volver a esta sesión.');
 }catch(error){
  if(error.code==='PT409'){conflict=true;setStatus('Conflicto entre versiones','error');render();}
  else{setStatus('Pendiente de guardar en línea','error');if(manual)toast('No pudimos guardar en línea. Conservamos la copia en este dispositivo; también puede exportarla.');}
  localDraft();
 }finally{saving=false;$('#save-button').disabled=false;if((pendingSave||dirty)&&!conflict){pendingSave=false;if(changeCounter!==counter)saveTimer=setTimeout(()=>save(),600);}}
}
async function boot(){
 try{
  const remote=await rpc('giovanni_fase1_load',{p_token:token});
  if(remote){
   if(dirty&&revision!==remote.revision){conflict=true;setStatus('Conflicto entre versiones','error');}
   else{if(!dirty)answers=cleanAnswers(remote.answers);revision=remote.revision;lastSavedAt=remote.updated_at;setStatus(dirty?'Cambios pendientes':'Guardado en línea',dirty?'local':'saved');}
  }else{setStatus(dirty?'Cambios pendientes':'Sesión lista');}
 }catch{setStatus(cached?'Copia de este dispositivo':'Sin conexión al guardado','error');}
 booting=false;localDraft();render();if(dirty&&!conflict)saveTimer=setTimeout(()=>save(),1000);
}
function updateProgress(){
 const progress=completion(answers);$('#progress-text').textContent=`${progress.percent} %`;$('#progress-fill').style.width=`${progress.percent}%`;
 $('#progress-caption').textContent=`${progress.filled} de ${progress.total} campos preparados. Puede dejar pendientes.`;
 document.querySelectorAll('.nav-item').forEach(button=>{const keys=groups[button.dataset.section];button.classList.toggle('done',Boolean(keys&&completion(answers,keys).filled===keys.length));});
}
function field(key,label,hint='',options={}){
 labels[key]=label;const value=esc(answers[key]||'');const tag=options.area?'textarea':'input';
 const input=tag==='textarea'?`<textarea id="${key}" name="${key}" data-field="${key}" rows="${options.rows||3}" maxlength="6000" placeholder="${esc(options.placeholder||'Escriba su respuesta o deje una nota para la reunión.')}" ${booting?'disabled':''} ${hint?`aria-describedby="hint-${key}"`:''}>${value}</textarea>`:`<input id="${key}" name="${key}" data-field="${key}" type="${options.type||'text'}" maxlength="6000" placeholder="${esc(options.placeholder||'Por completar durante la reunión')}" value="${value}" ${booting?'disabled':''} ${hint?`aria-describedby="hint-${key}"`:''}>`;
 return `<div class="field"><label for="${key}">${esc(label)}</label>${hint?`<p class="hint" id="hint-${key}">${hint}</p>`:''}${input}</div>`;
}
function heading(eyebrow,first,second,description){return `<div class="section-eyebrow"><span class="eyebrow">${eyebrow}</span><span class="section-tag">Fase 1 · Dirección editorial</span></div><h1 class="heading">${first}<span>${second}</span></h1>${description?`<p class="lede">${description}</p>`:''}`;}
function home(){return `<div class="section-eyebrow"><span class="eyebrow">GUÍA PREVIA A NUESTRA PRIMERA REUNIÓN</span><span class="section-tag">20–30 min de preparación</span></div>
 <div class="welcome-grid"><div><h1 class="heading">Su conocimiento.<span>Su manera<br>de explicar.</span></h1><p class="hero-subtitle">La base de su contenido con IA.</p><p class="lede">Doctor Giovanni, partimos de sus dos prioridades: conservar el respaldo científico y el estilo que ya construyó en Instagram. Esta guía reúne lo necesario para configurar la IA que preparará sus guiones.</p><div class="hero-actions"><button class="button" data-go="voz">Empezar la preparación <span class="icon-arrow" aria-hidden="true"></span></button><button class="text-button" data-go="reunion">Ver lo que necesitamos</button></div></div>
 <aside class="session-card"><div class="orbit" aria-hidden="true"></div><span class="eyebrow">NUESTRA PRIMERA REUNIÓN</span><div class="large-number" aria-hidden="true">01<span style="font-size:48px;letter-spacing:0">*</span></div><h2>Primero, su sello.<br>Después, la constancia.</h2><p>Su voz, sus fuentes y su criterio son el punto de partida.</p><div class="card-bottom"><span>DR. GIOVANNI SOTO</span><span>UROLOGÍA</span></div></aside></div>
 <hr class="section-divider"><p class="eyebrow">CÓMO PREPARARLA</p><div class="prep-grid">${[['01','Reserve 20–30 minutos.','Tiempo orientativo. Puede reunir enlaces y responder en notas o audios.'],['02','Empiece por sus propios ejemplos.','Sus publicaciones y explicaciones nos permiten reconocer su estilo.'],['03','Traiga lo que tenga disponible.','Los puntos pendientes los resolveremos juntos durante la reunión.']].map(([num,title,body])=>`<div class="prep-step"><span>${num}</span><h3>${title}</h3><p>${body}</p></div>`).join('')}</div>
 <div class="outcome"><span class="asterisk" aria-hidden="true">*</span><p><strong>Al terminar la fase 1:</strong> tendremos una guía de estilo compartida, prioridades temáticas y criterios para preparar las primeras muestras con su revisión.</p></div>`;}
function voice(){return heading('01 / SU VOZ Y SUS REFERENCIAS','Que suene a usted.','Empiece por ejemplos.','El estilo directo, coloquial y con humor que describió será nuestra referencia. Seleccione tres publicaciones propias que lo representen; puede usar las que ya hemos identificado en Instagram.')+
 [1,2,3].map(n=>`<div class="numbered-row"><span class="row-number">0${n}</span>${field(`reference${n}`,'Enlace o nombre del video',n===1?'Reel sobre cómo orinar (citado en la llamada).':'', {placeholder:'Pegue un enlace o identifique el video'})}${field(`preserve${n}`,'Qué debemos conservar','',{placeholder:'El lenguaje, el ritmo, la comparación…'})}</div>`).join('')+
 `<hr class="section-divider">`+field('avoidExample','Un ejemplo que prefiere evitar y el motivo','Puede ser propio o de otra cuenta. Indique si le incomoda el lenguaje, el humor, el ritmo o el enfoque.',{area:true})+
 `<h2 class="subheading">Tres respuestas breves para la reunión</h2>`+field('address','¿Cómo se dirige a su audiencia: usted, tú u otra forma?')+field('expressions','¿Qué expresiones coloquiales o explícitas permite y cuáles evita?','',{area:true})+field('humor','¿Qué humor le representa y en qué temas prefiere un tono serio?','',{area:true})+`<p class="hint">Puede responder estas preguntas por escrito o en un audio con ejemplos.</p>`;}
function sources(){return heading('02 / SU CRITERIO MÉDICO Y SUS FUENTES','Primero, el respaldo.','Después, el guion.','En la llamada nos contó que ya utiliza una herramienta propia de IA para buscar evidencia en bases médicas, resumirla y preparar guiones. Partiremos de ese proceso y de sus criterios de revisión.')+
 field('researchExample','Traiga un ejemplo completo de su investigación','Pregunta inicial, instrucciones o prompt que utiliza, fuentes recuperadas, resumen y guion final. Puede compartir un archivo o un enlace.',{area:true,rows:5,placeholder:'Pegue el proceso completo o el enlace al documento compartido.'})+
 `<h2 class="subheading">Comparta tres fuentes que utiliza o recomienda</h2><p class="hint">Nombre, enlace o archivo. Si corresponde: año, versión y tema al que aplica. Pueden ser guías, sociedades científicas, artículos o materiales propios.</p>`+[1,2,3].map(n=>field(`source${n}`,`0${n} / Fuente de referencia`,'',{placeholder:'Nombre, enlace, año o versión y tema'})).join('')+
 field('evidenceCriteria','Criterios que definiremos con usted','Qué bases y fuentes priorizar; cómo evaluar evidencia y actualidad; qué hacer si hay resultados contradictorios; y qué afirmaciones requieren su revisión antes de publicar.',{area:true})+`<div class="callout">Si ya tiene un protocolo o biblioteca, basta con traer el archivo o el enlace.</div>`;}
function audience(){return heading('03 / AUDIENCIA, TEMAS Y CANAL DE CONSULTA','A quién ayudar.','Qué explicar primero.','')+
 field('audience','¿A qué personas quiere llegar?','Describa su audiencia, las dudas que más escucha y, si aplica, su ciudad o zona de atención.',{area:true})+
 `<h2 class="subheading">Sus cinco prioridades para el primer ciclo</h2><p class="hint">Puede partir de dudas de consulta o de Google Trends, como ya lo hacía. Escriba cinco temas o preguntas y marque cuál debería ir primero.</p>`+[1,2,3,4,5].map(n=>`<div class="topic-row"><span>0${n}</span>${field(`topic${n}`,`Prioridad ${n}`,'',{placeholder:'Una pregunta de sus pacientes o un tema para explicar'})}</div>`).join('')+
 `<hr class="section-divider">`+field('consultation','¿Qué debe hacer una persona después de ver el reel?','Confirme la invitación a consultar y su destino: WhatsApp, enlace de agenda u otro canal. Traiga el enlace exacto y quién lo atiende.',{area:true,placeholder:'Invitación, enlace y persona que atiende el canal.'});}
function example(){return heading('04 / EJEMPLO PARA CALIBRAR EL ASISTENTE','Así lo explicaría usted.','Con sus propias palabras.','Prepare una explicación en texto o en un audio de 1–2 minutos. También sirve un guion original y su versión corregida por usted, indicando qué cambió y por qué.')+
 field('sampleQuestion','Tema o pregunta del paciente')+field('sampleAnswer','Su respuesta: ¿cómo lo explicaría en consulta?','Incluya una comparación, expresión o toque de humor solo si forma parte de su estilo.',{area:true,rows:8})+field('sampleEvidence','Fuente de respaldo y matiz que no debe perderse','',{area:true})+
 `<div class="callout"><strong>Para revisar las primeras muestras.</strong> Elegiremos con usted tres enfoques: una explicación, un mito y una pregunta frecuente. Puede traer un ejemplo de cada uno; con uno podremos empezar la conversación.</div><p class="hint">Estos ejemplos servirán de referencia para configurar y calibrar la IA de guiones.</p>`;}
function limits(){labels.voiceChoice='Voz en off / Opción inicial para conversar';return heading('05 / LÍMITES EDITORIALES, IDENTIDAD Y VOZ','Su criterio marca','los límites.','')+
 field('avoidTopics','¿Qué temas o enfoques prefiere evitar?','Por ejemplo: asuntos sensibles, bromas, imágenes o afirmaciones que no representan su práctica.',{area:true})+field('priorReview','¿Qué contenidos quiere revisar antes de publicar?','Indique los temas que requieren su aprobación y quién puede validar observaciones médicas.',{area:true})+
 `<fieldset class="radio-group"><legend class="subheading">Voz en off / Opción inicial para conversar</legend>${['Voz de narración a elegir con usted.','Evaluar una voz sintética basada en su voz.','Decidirlo durante la reunión.'].map(value=>`<label class="radio-option"><input type="radio" name="voiceChoice" data-field="voiceChoice" value="${value}" ${answers.voiceChoice===value?'checked':''}><span>${value}</span></label>`).join('')}</fieldset><div class="callout"><strong>Si desea clonación:</strong> la autorización expresa y escrita debe recibirse antes de producir contenido con ella. Marcar una preferencia en esta guía no sustituye esa autorización.</div>`+
 field('professionalIdentity','Identidad profesional y material disponible','Traiga su nombre profesional tal como debe aparecer, especialidad, logotipo y recursos visuales disponibles. Si ya usa colores o una identidad gráfica, compártalos.',{area:true})+
 `<p class="hint">Use ejemplos generales o anonimizados, sin datos que identifiquen pacientes.</p>`;}
const checklist=[['Tres referencias de estilo.','Enlaces a sus publicaciones y un ejemplo de lo que prefiere evitar.'],['Sus fuentes y su forma de investigar.','Tres referencias disponibles o su biblioteca actual.'],['Cinco temas y una explicación propia.','Preguntas frecuentes, prioridades y un texto o audio de ejemplo.'],['Límites, identidad y preferencia de voz.','Qué revisar, qué evitar y los recursos de marca disponibles.'],['Redes, reportes y enlace de consulta.','Usuarios o enlaces de Instagram, TikTok, YouTube y Facebook; correo de reportes y destino de la invitación a consultar.']];
function meeting(){return heading('06 / LISTA PARA NUESTRA REUNIÓN','Todo en un solo lugar.','El siguiente paso, juntos.','Puede reunir los materiales en una carpeta compartida o enviarlos en un único bloque por el canal habitual con Andrés. Si algo está pendiente, indíquelo para resolverlo en la sesión.')+
 `<div class="ready-list">${checklist.map(([title,body],i)=>`<label class="ready-item"><input type="checkbox" data-field="ready${i+1}" ${answers[`ready${i+1}`]?'checked':''}><div><strong>${title}</strong><span>${body}</span></div></label>`).join('')}</div><div class="callout"><strong>En la reunión de fase 1.</strong> Cerraremos tono, humor, fuentes, prioridades, límites y voz. Con esa base prepararemos la guía de estilo y la selección de temas para calendario y primeras muestras.</div>
 <h2 class="subheading">Redes y seguimiento</h2><div class="two-col">${field('instagram','Instagram','',{placeholder:'Usuario o enlace'})}${field('tiktok','TikTok','',{placeholder:'Usuario o enlace'})}${field('youtube','YouTube','',{placeholder:'Canal o enlace'})}${field('facebook','Facebook','',{placeholder:'Página o enlace'})}</div>`+field('reportEmail','Correo para recibir los reportes','',{type:'email',placeholder:'nombre@correo.com'})+field('meetingNotes','Notas y pendientes de nuestra reunión','',{area:true,rows:5})+
 `<div class="callout"><strong>Accesos a redes:</strong> se coordinarán mediante permisos delegados. No incluya contraseñas en esta guía.</div><h2 class="subheading">Conserve lo que definimos</h2><p class="hint">Las respuestas se guardan automáticamente. El enlace de esta sesión permite abrir la misma guía en otro dispositivo; compártalo únicamente con quienes participen en la preparación.</p><div class="export-actions"><button class="button" data-action="export">Exportar respuestas <span class="icon-arrow down" aria-hidden="true"></span></button><button class="button secondary" data-action="share">Copiar enlace de sesión <span class="icon-arrow" aria-hidden="true"></span></button><a class="button secondary" href="assets/guia-fase-1.pdf" download>Guía original en PDF <span class="icon-arrow down" aria-hidden="true"></span></a></div><div class="contact"><strong>Andrés León / Fundador de NODOTO Agency</strong><p><a href="https://wa.me/573246864736" target="_blank" rel="noopener noreferrer">WhatsApp +57 324 686 4736</a> · nodoto.com · @nodoto.agency</p></div>`;}
const renderers={inicio:home,voz:voice,fuentes:sources,audiencia:audience,ejemplo:example,limites:limits,reunion:meeting};
function render(){
 const index=sections.findIndex(s=>s.id===section),next=sections[index+1];
 $('#navigation').innerHTML=sections.map(s=>`<button class="nav-item ${section===s.id?'active':''}" data-section="${s.id}" ${section===s.id?'aria-current="step"':''}><span class="num">${s.number}</span><span>${s.name}</span><span class="nav-dot" aria-hidden="true"></span></button>`).join('');
 $('#content').innerHTML=`<div class="section-content">${conflict?`<div class="error-panel"><p>Esta sesión cambió en otro dispositivo. Exporte esta copia antes de recuperar la versión guardada.</p><button class="button secondary small" data-action="export">Exportar esta copia</button> <button class="button small" data-action="reload">Recuperar versión guardada</button></div>`:''}${renderers[section]()}<div class="nav-footer">${index>0?`<button class="button secondary" data-go="${sections[index-1].id}">← Anterior</button>`:'<span class="hint">A su ritmo. Los pendientes se resuelven juntos.</span>'}${next?`<div class="footer-next"><div><div class="next-label">SIGUIENTE</div><div class="next-name">${next.short}</div></div><button class="button" data-go="${next.id}">Continuar <span>→</span></button></div>`:'<button class="button" data-action="save">Guardar la preparación <span class="icon-arrow" aria-hidden="true"></span></button>'}</div></div>`;
 $('#content').querySelectorAll('[data-field]').forEach(input=>input.disabled=booting);
 $('#page-number').textContent=`${sections[index].number} / 07`;updateProgress();
 history.replaceState(null,'',`#s=${token}&p=${section}`);
}
function go(id){if(!sections.some(s=>s.id===id))return;section=id;render();window.scrollTo({top:0,behavior:'instant'});$('#workspace').focus({preventScroll:true});}
document.addEventListener('click',async event=>{
 const nav=event.target.closest('[data-section],[data-go],[data-home]');if(nav){event.preventDefault();go(nav.dataset.section||nav.dataset.go||'inicio');return;}
 const action=event.target.closest('[data-action]')?.dataset.action;
 if(action==='export')exportResponses();
 if(action==='share'){if(dirty&&!conflict)await save();if(dirty||conflict){toast('Guarde o exporte los cambios pendientes antes de compartir la sesión.');return;}try{await navigator.clipboard.writeText(`${location.origin}${location.pathname}#s=${token}&p=inicio`);toast('Enlace de la sesión copiado. Solo quienes tengan este enlace podrán recuperar sus respuestas.');}catch{toast('Puede copiar la dirección de esta página desde la barra de su navegador.');}}
 if(action==='save')save(true);
 if(action==='reload'){try{const remote=await rpc('giovanni_fase1_load',{p_token:token});if(!remote)throw new Error('No remote session');answers=cleanAnswers(remote.answers);revision=remote.revision;dirty=false;conflict=false;lastSavedAt=remote.updated_at;localDraft();setStatus('Guardado en línea','saved');render();}catch{toast('No pudimos recuperar la versión en línea. Su copia sigue en este dispositivo.');}}
});
function onInput(event){const input=event.target.closest('[data-field]');if(!input)return;answers[input.dataset.field]=input.type==='checkbox'?input.checked:input.value;dirty=true;changeCounter++;localDraft();updateProgress();setStatus(conflict?'Conflicto entre versiones':'Cambios pendientes',conflict?'error':'local');clearTimeout(saveTimer);saveTimer=setTimeout(()=>save(),900);}
document.addEventListener('input',onInput);
$('#save-button').addEventListener('click',()=>save(true));
window.addEventListener('online',()=>{if(dirty&&!conflict)save();});
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
function exportResponses(){
 const previous=section;for(const entry of sections)renderers[entry.id]();section=previous;
 const rows=['NODOTO · Fase 1 · Dr. Giovanni Soto','Preparación de dirección editorial',new Date().toLocaleString('es-CO'),''];
 for(const entry of sections){if(!groups[entry.id])continue;rows.push(entry.name.toUpperCase(),'');for(const key of groups[entry.id])rows.push(labels[key]||key,answers[key]?.trim()||'[Pendiente]','');}
 rows.push('LISTA PARA LA REUNIÓN',...checklist.map(([title],i)=>`${answers[`ready${i+1}`]?'[x]':'[ ]'} ${title}`),'','La preferencia de voz no sustituye una autorización expresa y escrita para clonación.');
 const blob=new Blob([rows.join('\n')],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='NODOTO_Fase_1_Giovanni_Soto_Respuestas.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Respuestas exportadas con sus pendientes.');
}
render();boot();
