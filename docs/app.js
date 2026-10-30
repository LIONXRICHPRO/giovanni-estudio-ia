import {sections,groups,allFields,cleanAnswers,completion,escapeHtml as esc} from './model.js';
import {getSession,signIn,signOut,authenticatedRequest} from './auth.js';

const $=selector=>document.querySelector(selector);
const params=new URLSearchParams(location.hash.slice(1));
let user=null,storageKey=null,cached=null,answers={},revision=0,dirty=false;
let section=sections.some(s=>s.id===params.get('p'))?params.get('p'):'inicio';
let booting=true,saving=false,conflict=false,pendingSave=false,saveTimer,changeCounter=0,lastSavedAt=cached?.savedAt;
let topics=[],topicDraft={title:'',details:'',priority:'normal'},editingTopic=null,topicBusy=false;
const labels={};

function setStatus(message,state='local'){$('#save-status').textContent=message;$('#save-status').dataset.state=state;}
function localDraft(){if(!storageKey)return false;try{localStorage.setItem(storageKey,JSON.stringify({answers,revision,dirty,savedAt:lastSavedAt,topics,topicDraft,editingTopic}));return true;}catch{toast('El navegador no permite guardar la copia local. Exporte sus respuestas para conservarlas.');return false;}}
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,6500);}
async function rpc(name,body){
 return authenticatedRequest(`rpc/${name}`,{body});
}
async function save(manual=false){
 clearTimeout(saveTimer);
 if(manual&&section==='propuestas'&&topicDraft.title.trim()){
  await submitTopic();if(topicDraft.title.trim())return;
  if(!dirty){toast('Su propuesta quedó guardada en su cuenta.');return;}
 }
 if(booting){if(manual)toast('Espere un momento mientras recuperamos su sesión.');return;}
 if(conflict){toast('Hay otra versión guardada. Exporte su copia y recargue la versión en línea antes de continuar.');return;}
 if(saving){pendingSave=true;return;}
 if(!dirty&&revision>0){if(manual)toast('Sus respuestas ya están guardadas en línea.');return;}
 saving=true;const counter=changeCounter;const snapshot=cleanAnswers(answers);setStatus('Guardando…');$('#save-button').disabled=true;
 try{
  const result=await rpc('giovanni_workspace_save',{p_answers:snapshot,p_expected_revision:revision});
  revision=result.revision;lastSavedAt=result.updated_at;dirty=changeCounter!==counter;localDraft();
  setStatus(dirty?'Cambios pendientes':'Guardado en línea',dirty?'local':'saved');
  if(manual)toast('Respuestas guardadas. Puede cerrar y volver a esta sesión.');
 }catch(error){
  if(error.auth){showLogin('Su sesión terminó. Ingrese de nuevo para continuar.');}
  else if(error.code==='PT409'){conflict=true;setStatus('Conflicto entre versiones','error');render();}
  else{setStatus('Pendiente de guardar en línea','error');if(manual)toast('No pudimos guardar en línea. Conservamos la copia en este dispositivo; también puede exportarla.');}
  localDraft();
 }finally{saving=false;$('#save-button').disabled=false;if((pendingSave||dirty)&&!conflict){pendingSave=false;if(changeCounter!==counter)saveTimer=setTimeout(()=>save(),600);}}
}
async function boot(){
 try{
  const [workspaceResult,topicResult]=await Promise.allSettled([rpc('giovanni_workspace_load',{}),loadTopics()]);
  if(workspaceResult.status==='rejected')throw workspaceResult.reason;
  const remote=workspaceResult.value;
  if(topicResult.status==='fulfilled')topics=topicResult.value;
  else toast('No pudimos actualizar sus propuestas. Conservamos la última copia en este dispositivo.');
  if(remote){
   if(dirty&&revision!==remote.revision){conflict=true;setStatus('Conflicto entre versiones','error');}
   else{if(!dirty)answers=cleanAnswers(remote.answers);revision=remote.revision;lastSavedAt=remote.updated_at;setStatus(dirty?'Cambios pendientes':'Guardado en línea',dirty?'local':'saved');}
  }else{setStatus(dirty?'Cambios pendientes':'Sesión lista');}
 }catch(error){if(error.auth){showLogin('Ingrese de nuevo para recuperar su espacio.');return;}setStatus(cached?'Copia de este dispositivo':'Sin conexión al guardado','error');}
 booting=false;localDraft();render();if(dirty&&!conflict)saveTimer=setTimeout(()=>save(),1000);
}
function updateProgress(){
 const progress=completion(answers);$('#progress-text').textContent=`${progress.percent} %`;$('#progress-fill').style.width=`${progress.percent}%`;
 $('#progress-caption').textContent=`${progress.filled} de ${progress.total} campos preparados. Puede dejar pendientes.`;
 document.querySelectorAll('.nav-item').forEach(button=>{const keys=groups[button.dataset.section];button.classList.toggle('done',button.dataset.section==='propuestas'?topics.length>0:Boolean(keys&&completion(answers,keys).filled===keys.length));});
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
function audience(){return heading('03 / AUDIENCIA Y CANAL DE CONSULTA','A quién ayudar.','Cómo dar el siguiente paso.','')+
 field('audience','¿A qué personas quiere llegar?','Describa su audiencia, las dudas que más escucha y, si aplica, su ciudad o zona de atención.',{area:true})+
 `<div class="callout"><strong>Sus temas tienen un espacio propio.</strong> En <button class="text-button" data-go="propuestas">Temas propuestos</button> puede dejarnos preguntas de consulta, ideas o asuntos que le gustaría explicar. Nosotros los convertiremos en contenido con sus criterios.</div>`+
 `<hr class="section-divider">`+field('consultation','¿Qué debe hacer una persona después de ver el reel?','Confirme la invitación a consultar y su destino: WhatsApp, enlace de agenda u otro canal. Traiga el enlace exacto y quién lo atiende.',{area:true,placeholder:'Invitación, enlace y persona que atiende el canal.'});}
function proposals(){
 const statusLabels={propuesto:'Propuesto',en_preparacion:'En preparación',listo:'Listo'};
 const cards=topics.map(topic=>`<article class="proposal-card"><div class="proposal-meta"><span class="proposal-status">${statusLabels[topic.status]||'Propuesto'}</span><span>Prioridad ${esc(topic.priority)}</span><time datetime="${esc(topic.created_at)}">${new Intl.DateTimeFormat('es-CO',{dateStyle:'medium',timeZone:'America/Bogota'}).format(new Date(topic.created_at))}</time></div><h3>${esc(topic.title)}</h3>${topic.details?`<p>${esc(topic.details).replaceAll('\n','<br>')}</p>`:''}<div class="proposal-actions"><button class="text-button" data-edit-topic="${esc(topic.id)}">Editar</button><button class="text-button" data-remove-topic="${esc(topic.id)}">Eliminar</button></div></article>`).join('');
 return heading('04 / TEMAS PROPUESTOS','Usted propone.','Nosotros lo hacemos.','Deje aquí los temas que le gustaría que produzcamos. Puede partir de una pregunta frecuente, una duda de consulta, un mito o una idea que quiera explicar. No necesita preparar el guion.')+
 `<form id="topic-form" class="proposal-form"><div class="field"><label for="topic-title">¿Qué tema le gustaría proponer?</label><input id="topic-title" data-topic-field="title" type="text" required minlength="2" maxlength="240" value="${esc(topicDraft.title)}" placeholder="Por ejemplo: una pregunta que escucha en consulta"></div><div class="field"><label for="topic-details">¿Qué le gustaría explicar sobre ese tema?</label><p class="hint">Puede añadir la pregunta, el enfoque que prefiere o un enlace de referencia. Nosotros desarrollaremos la pieza.</p><textarea id="topic-details" data-topic-field="details" rows="4" maxlength="6000" placeholder="Cuéntenos la idea con sus propias palabras.">${esc(topicDraft.details)}</textarea></div><div class="proposal-form-footer"><div class="field priority-field"><label for="topic-priority">Prioridad</label><select id="topic-priority" data-topic-field="priority">${['normal','alta','baja'].map(value=>`<option value="${value}" ${topicDraft.priority===value?'selected':''}>${value[0].toUpperCase()+value.slice(1)}</option>`).join('')}</select></div><div class="proposal-actions">${editingTopic?'<button class="button secondary" type="button" data-action="cancel-topic">Cancelar edición</button>':''}<button class="button" type="submit" ${topicBusy||booting?'disabled':''}>${topicBusy?'Guardando…':editingTopic?'Guardar cambios':'Agregar propuesta'} <span class="icon-arrow" aria-hidden="true"></span></button></div></div><p id="topic-error" class="login-error" role="alert" hidden></p></form><h2 class="subheading">Sus propuestas <span class="proposal-count">${topics.length}</span></h2>${cards||'<div class="proposal-empty"><span class="asterisk" aria-hidden="true">*</span><h3>El próximo contenido puede empezar con una idea suya.</h3><p>Agregue su primer tema cuando quiera. Lo encontrará aquí al volver a entrar.</p></div>'}`;
}
function example(){return heading('04 / EJEMPLO PARA CALIBRAR EL ASISTENTE','Así lo explicaría usted.','Con sus propias palabras.','Prepare una explicación en texto o en un audio de 1–2 minutos. También sirve un guion original y su versión corregida por usted, indicando qué cambió y por qué.')+
 field('sampleQuestion','Tema o pregunta del paciente')+field('sampleAnswer','Su respuesta: ¿cómo lo explicaría en consulta?','Incluya una comparación, expresión o toque de humor solo si forma parte de su estilo.',{area:true,rows:8})+field('sampleEvidence','Fuente de respaldo y matiz que no debe perderse','',{area:true})+
 `<div class="callout"><strong>Para revisar las primeras muestras.</strong> Elegiremos con usted tres enfoques: una explicación, un mito y una pregunta frecuente. Puede traer un ejemplo de cada uno; con uno podremos empezar la conversación.</div><p class="hint">Estos ejemplos servirán de referencia para configurar y calibrar la IA de guiones.</p>`;}
function limits(){labels.voiceChoice='Voz en off / Opción inicial para conversar';return heading('05 / LÍMITES EDITORIALES, IDENTIDAD Y VOZ','Su criterio marca','los límites.','')+
 field('avoidTopics','¿Qué temas o enfoques prefiere evitar?','Por ejemplo: asuntos sensibles, bromas, imágenes o afirmaciones que no representan su práctica.',{area:true})+field('priorReview','¿Qué contenidos quiere revisar antes de publicar?','Indique los temas que requieren su aprobación y quién puede validar observaciones médicas.',{area:true})+
 `<fieldset class="radio-group"><legend class="subheading">Voz en off / Opción inicial para conversar</legend>${['Voz de narración a elegir con usted.','Evaluar una voz sintética basada en su voz.','Decidirlo durante la reunión.'].map(value=>`<label class="radio-option"><input type="radio" name="voiceChoice" data-field="voiceChoice" value="${value}" ${answers.voiceChoice===value?'checked':''}><span>${value}</span></label>`).join('')}</fieldset><div class="callout"><strong>Si desea clonación:</strong> la autorización expresa y escrita debe recibirse antes de producir contenido con ella. Marcar una preferencia en esta guía no sustituye esa autorización.</div>`+
 field('professionalIdentity','Identidad profesional y material disponible','Traiga su nombre profesional tal como debe aparecer, especialidad, logotipo y recursos visuales disponibles. Si ya usa colores o una identidad gráfica, compártalos.',{area:true})+
 `<p class="hint">Use ejemplos generales o anonimizados, sin datos que identifiquen pacientes.</p>`;}
const checklist=[['Tres referencias de estilo.','Enlaces a sus publicaciones y un ejemplo de lo que prefiere evitar.'],['Sus fuentes y su forma de investigar.','Tres referencias disponibles o su biblioteca actual.'],['Sus temas propuestos y una explicación propia.','Preguntas, ideas y prioridades que nos deje en Temas propuestos; un texto o audio de ejemplo.'],['Límites, identidad y preferencia de voz.','Qué revisar, qué evitar y los recursos de marca disponibles.'],['Redes, reportes y enlace de consulta.','Usuarios o enlaces de Instagram, TikTok y YouTube; correo de reportes y destino de la invitación a consultar.']];
function meeting(){return heading('06 / LISTA PARA NUESTRA REUNIÓN','Todo en un solo lugar.','El siguiente paso, juntos.','Puede reunir los materiales en una carpeta compartida o enviarlos en un único bloque por el canal habitual con Andrés. Si algo está pendiente, indíquelo para resolverlo en la sesión.')+
 `<div class="ready-list">${checklist.map(([title,body],i)=>`<label class="ready-item"><input type="checkbox" data-field="ready${i+1}" ${answers[`ready${i+1}`]?'checked':''}><div><strong>${title}</strong><span>${body}</span></div></label>`).join('')}</div><div class="callout"><strong>En la reunión de fase 1.</strong> Cerraremos tono, humor, fuentes, prioridades, límites y voz. Con esa base prepararemos la guía de estilo y la selección de temas para calendario y primeras muestras.</div>
 <h2 class="subheading">Redes y seguimiento</h2><div class="two-col">${field('instagram','Instagram','',{placeholder:'Usuario o enlace'})}${field('tiktok','TikTok','',{placeholder:'Usuario o enlace'})}${field('youtube','YouTube','',{placeholder:'Canal o enlace'})}</div>`+field('reportEmail','Correo para recibir los reportes','',{type:'email',placeholder:'nombre@correo.com'})+field('meetingNotes','Notas y pendientes de nuestra reunión','',{area:true,rows:5})+
 `<div class="callout"><strong>Accesos a redes:</strong> se coordinarán mediante permisos delegados. No incluya contraseñas en esta guía.</div><h2 class="subheading">Conserve lo que definimos</h2><p class="hint">Las respuestas se guardan en su cuenta. Para retomarlas en otro dispositivo, abra esta dirección e ingrese con sus credenciales personales.</p><div class="export-actions"><button class="button" data-action="export">Exportar respuestas y temas <span class="icon-arrow down" aria-hidden="true"></span></button><button class="button secondary" data-action="share">Copiar dirección del espacio <span class="icon-arrow" aria-hidden="true"></span></button><a class="button secondary" href="assets/guia-fase-1.pdf" download>Guía en PDF <span class="icon-arrow down" aria-hidden="true"></span></a></div><div class="contact"><strong>Andrés León / Fundador de NODOTO Agency</strong><p><a href="https://wa.me/573246864736" target="_blank" rel="noopener noreferrer">WhatsApp +57 324 686 4736</a> · nodoto.com · @nodoto.agency</p></div>`;}
const renderers={inicio:home,voz:voice,fuentes:sources,audiencia:audience,propuestas:proposals,ejemplo:example,limites:limits,reunion:meeting};
function render(){
 const index=sections.findIndex(s=>s.id===section),next=sections[index+1];
 $('#navigation').innerHTML=sections.map(s=>`<button class="nav-item ${section===s.id?'active':''}" data-section="${s.id}" ${section===s.id?'aria-current="step"':''}><span class="num">${s.number}</span><span>${s.name}</span><span class="nav-dot" aria-hidden="true"></span></button>`).join('');
 $('#content').innerHTML=`<div class="section-content">${conflict?`<div class="error-panel"><p>Esta sesión cambió en otro dispositivo. Exporte esta copia antes de recuperar la versión guardada.</p><button class="button secondary small" data-action="export">Exportar esta copia</button> <button class="button small" data-action="reload">Recuperar versión guardada</button></div>`:''}${renderers[section]()}<div class="nav-footer">${index>0?`<button class="button secondary" data-go="${sections[index-1].id}">← Anterior</button>`:'<span class="hint">A su ritmo. Los pendientes se resuelven juntos.</span>'}${next?`<div class="footer-next"><div><div class="next-label">SIGUIENTE</div><div class="next-name">${next.short}</div></div><button class="button" data-go="${next.id}">Continuar <span>→</span></button></div>`:'<button class="button" data-action="save">Guardar la preparación <span class="icon-arrow" aria-hidden="true"></span></button>'}</div></div>`;
 $('#content').querySelectorAll('[data-field]').forEach(input=>input.disabled=booting);
 $('#content').querySelectorAll('#topic-form input,#topic-form textarea,#topic-form select').forEach(input=>input.disabled=booting||topicBusy);
 $('#page-number').textContent=`${sections[index].number} / 08`;updateProgress();
 history.replaceState(null,'',`#p=${section}`);
}
function go(id){if(!sections.some(s=>s.id===id))return;section=id;render();window.scrollTo({top:0,behavior:'instant'});$('#workspace').focus({preventScroll:true});}
document.addEventListener('click',async event=>{
 const nav=event.target.closest('[data-section],[data-go],[data-home]');if(nav){event.preventDefault();go(nav.dataset.section||nav.dataset.go||'inicio');return;}
 const action=event.target.closest('[data-action]')?.dataset.action;
 if(event.target.closest('#toggle-password')){const input=$('#login-password');input.type=input.type==='password'?'text':'password';$('#toggle-password').textContent=input.type==='password'?'Mostrar':'Ocultar';$('#toggle-password').setAttribute('aria-label',`${input.type==='password'?'Mostrar':'Ocultar'} contraseña`);return;}
 const editId=event.target.closest('[data-edit-topic]')?.dataset.editTopic;
 if(editId){const topic=topics.find(x=>x.id===editId);if(topic){editingTopic=editId;topicDraft={title:topic.title,details:topic.details,priority:topic.priority};localDraft();render();$('#topic-title').focus();}return;}
 const removeId=event.target.closest('[data-remove-topic]')?.dataset.removeTopic;
 if(removeId){await removeTopic(removeId);return;}
 if(action==='cancel-topic'){topicDraft={title:'',details:'',priority:'normal'};editingTopic=null;localDraft();render();}
 if(action==='logout'){if(topicDraft.title.trim()){toast('Agregue su propuesta o cancele la edición antes de salir.');return;}if(dirty)await save();if(dirty){toast('Guarde o exporte los cambios pendientes antes de salir.');return;}const previousKey=storageKey;await signOut();try{localStorage.removeItem(previousKey);}catch{}showLogin();}
 if(action==='export')exportResponses();
 if(action==='share'){try{await navigator.clipboard.writeText(`${location.origin}${location.pathname}`);toast('Dirección copiada. Sus respuestas requieren su usuario y contraseña.');}catch{toast('Puede copiar la dirección desde la barra de su navegador.');}}
 if(action==='save')save(true);
 if(action==='reload'){try{const remote=await rpc('giovanni_workspace_load',{});if(!remote)throw new Error('No remote session');answers=cleanAnswers(remote.answers);revision=remote.revision;dirty=false;conflict=false;lastSavedAt=remote.updated_at;localDraft();setStatus('Guardado en línea','saved');render();}catch{toast('No pudimos recuperar la versión en línea. Su copia sigue en este dispositivo.');}}
});
function onInput(event){const topicInput=event.target.closest('[data-topic-field]');if(topicInput){topicDraft[topicInput.dataset.topicField]=topicInput.value;localDraft();return;}const input=event.target.closest('[data-field]');if(!input)return;answers[input.dataset.field]=input.type==='checkbox'?input.checked:input.value;dirty=true;changeCounter++;localDraft();updateProgress();setStatus(conflict?'Conflicto entre versiones':'Cambios pendientes',conflict?'error':'local');clearTimeout(saveTimer);saveTimer=setTimeout(()=>save(),900);}
document.addEventListener('input',onInput);
$('#save-button').addEventListener('click',()=>save(true));
window.addEventListener('online',()=>{if(dirty&&!conflict)save();});
window.addEventListener('beforeunload',event=>{if(dirty||topicDraft.title.trim()){event.preventDefault();event.returnValue='';}});
function exportResponses(){
 const previous=section;for(const entry of sections)renderers[entry.id]();section=previous;
 const rows=['NODOTO · Fase 1 · Dr. Giovanni Soto','Preparación de dirección editorial',new Date().toLocaleString('es-CO',{timeZone:'America/Bogota'}),''];
 for(const entry of sections){if(!groups[entry.id])continue;rows.push(entry.name.toUpperCase(),'');for(const key of groups[entry.id])rows.push(labels[key]||key,answers[key]?.trim()||'[Pendiente]','');}
 rows.push('TEMAS PROPUESTOS','');for(const topic of topics)rows.push(topic.title,`Prioridad: ${topic.priority}`,topic.details||'[Sin notas adicionales]','');
 rows.push('LISTA PARA LA REUNIÓN',...checklist.map(([title],i)=>`${answers[`ready${i+1}`]?'[x]':'[ ]'} ${title}`),'','La preferencia de voz no sustituye una autorización expresa y escrita para clonación.');
 const blob=new Blob([rows.join('\n')],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='NODOTO_Fase_1_Giovanni_Soto_Respuestas.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Respuestas exportadas con sus pendientes.');
}
async function loadTopics(){let rows=[],offset=0;while(true){const batch=await authenticatedRequest(`giovanni_topic_proposals?select=id,title,details,priority,status,created_at,updated_at&order=created_at.desc&limit=100&offset=${offset}`,{method:'GET'});rows.push(...batch);if(batch.length<100)return rows;offset+=100;}}
async function submitTopic(){
 if(topicBusy||booting)return;
 const payload={title:topicDraft.title.trim(),details:topicDraft.details.trim(),priority:topicDraft.priority};
 if(payload.title.length<2||payload.title.length>240){$('#topic-error').textContent='Escriba un tema de entre 2 y 240 caracteres.';$('#topic-error').hidden=false;return;}
 topicBusy=true;render();
 try{
  const path=editingTopic?`giovanni_topic_proposals?id=eq.${encodeURIComponent(editingTopic)}`:'giovanni_topic_proposals';
  const result=await authenticatedRequest(path,{method:editingTopic?'PATCH':'POST',body:payload,headers:{Prefer:'return=representation'}});
  if(!result?.length)throw new Error('No encontramos esta propuesta. Actualice la página.');
  const updated=result[0];topics=[updated,...topics.filter(x=>x.id!==updated.id)].sort((a,b)=>b.created_at.localeCompare(a.created_at));
  topicDraft={title:'',details:'',priority:'normal'};editingTopic=null;localDraft();setStatus(dirty?'Cambios pendientes':'Guardado en línea',dirty?'local':'saved');toast('Su propuesta quedó guardada. La tendremos en cuenta para preparar el contenido.');
 }catch(error){if(error.auth){showLogin('Ingrese de nuevo para guardar su propuesta.');return;}topicBusy=false;render();$('#topic-error').textContent='No pudimos guardar la propuesta. Su idea sigue aquí; intente de nuevo cuando tenga conexión.';$('#topic-error').hidden=false;return;}
 finally{topicBusy=false;}
 render();
}
async function removeTopic(id){
 if(!confirm('¿Eliminar esta propuesta de temas?'))return;
 try{await authenticatedRequest(`giovanni_topic_proposals?id=eq.${encodeURIComponent(id)}`,{method:'DELETE'});topics=topics.filter(x=>x.id!==id);if(editingTopic===id){editingTopic=null;topicDraft={title:'',details:'',priority:'normal'};}localDraft();render();toast('Propuesta eliminada.');}
 catch{toast('No pudimos eliminar la propuesta. Intente de nuevo cuando tenga conexión.');}
}
function showLogin(message=''){
 clearTimeout(saveTimer);user=null;storageKey=null;answers={};topics=[];dirty=false;revision=0;conflict=false;booting=true;topicDraft={title:'',details:'',priority:'normal'};editingTopic=null;
 $('#application').hidden=true;$('#auth-screen').hidden=false;$('#login-password').value='';$('#login-error').textContent=message;$('#login-error').hidden=!message;
 $('#content').innerHTML='';$('#navigation').innerHTML='';
 history.replaceState(null,'',location.pathname);
}
async function openWorkspace(session){
 user=session.user;storageKey=`giovanni-estudio-ia:v2:${user.id}`;
 try{cached=JSON.parse(localStorage.getItem(storageKey)||'null');}catch{cached=null;}
 answers=cleanAnswers(cached?.answers);revision=Number.isInteger(cached?.revision)?cached.revision:0;dirty=Boolean(cached?.dirty);lastSavedAt=cached?.savedAt;
 topics=Array.isArray(cached?.topics)?cached.topics:[];topicDraft=cached?.topicDraft&&typeof cached.topicDraft.title==='string'?cached.topicDraft:{title:'',details:'',priority:'normal'};editingTopic=cached?.editingTopic||null;
 booting=true;$('#auth-screen').hidden=true;$('#application').hidden=false;render();await boot();
}
document.addEventListener('submit',async event=>{
 if(event.target.id==='topic-form'){event.preventDefault();await submitTopic();return;}
 if(event.target.id!=='login-form')return;event.preventDefault();$('#login-button').disabled=true;$('#login-error').hidden=true;
 try{const session=await signIn($('#login-username').value,$('#login-password').value);$('#login-password').value='';await openWorkspace(session);}
 catch(error){$('#login-error').textContent=error.status===429?'Hubo varios intentos de acceso. Espere un momento y vuelva a intentarlo.':error.message||'No pudimos conectar. Intente de nuevo.';$('#login-error').hidden=false;}
 finally{$('#login-button').disabled=false;}
});
(async()=>{try{const session=await getSession();if(session)await openWorkspace(session);else showLogin();}catch{showLogin('No pudimos recuperar su acceso. Ingrese de nuevo cuando tenga conexión.');}})();
