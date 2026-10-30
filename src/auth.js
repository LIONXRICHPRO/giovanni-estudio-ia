import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './config.js';

const STORAGE='giovanni-estudio-ia:auth:v1';
const LOGIN_EMAIL='doctor.giovanni@acceso.nodoto.invalid';
let session=null,refreshing=null;
try{const cached=JSON.parse(localStorage.getItem(STORAGE)||'null');if(cached?.user?.id&&cached.access_token&&cached.refresh_token)session=cached;}catch{}
function remember(value){session=value;try{if(value)localStorage.setItem(STORAGE,JSON.stringify(value));else localStorage.removeItem(STORAGE);}catch{}}
async function authRequest(path,payload,bearer){
  const headers={apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'};
  if(bearer)headers.Authorization=`Bearer ${bearer}`;
  const response=await fetch(`${SUPABASE_URL}/auth/v1/${path}`,{method:'POST',headers,body:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(15000),cache:'no-store'});
  const data=response.status===204?null:await response.json().catch(()=>null);
  if(!response.ok){const error=new Error('No pudimos validar su acceso. Revise el usuario y la contraseña.');error.status=response.status;throw error;}
  return data;
}
export async function getSession(forceRefresh=false){
  if(!session)return null;
  const expires=session.expires_at||0;
  if(!forceRefresh&&Date.now()/1000<expires-60)return session;
  if(!refreshing)refreshing=(async()=>{
    try{const result=await authRequest('token?grant_type=refresh_token',{refresh_token:session.refresh_token});remember(result);return result;}
    catch(error){if(error.status===400||error.status===401){remember(null);return null;}throw error;}
    finally{refreshing=null;}
  })();
  return refreshing;
}
export async function signIn(username,password){
  const normalized=username.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s/g,'').toLowerCase();
  if(normalized!=='doctorgiovanni')throw new Error('Revise el usuario y la contraseña de su acceso personal.');
  const result=await authRequest('token?grant_type=password',{email:LOGIN_EMAIL,password});remember(result);return result;
}
export async function signOut(){
  const current=session;
  try{if(current)await authRequest('logout?scope=local',undefined,current.access_token);}catch{}
  remember(null);
}
export async function authenticatedRequest(path,{method='POST',body,headers={}}={},retry=true){
  const current=await getSession();
  if(!current){const error=new Error('Inicie sesión para continuar.');error.auth=true;throw error;}
  const response=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{method,headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${current.access_token}`,'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000),cache:'no-store'});
  if(response.status===401&&retry){if(await getSession(true))return authenticatedRequest(path,{method,body,headers},false);}
  const data=response.status===204?null:await response.json().catch(()=>null);
  if(!response.ok){const error=new Error(data?.message||'No pudimos guardar los cambios.');error.code=data?.code;error.auth=response.status===401;throw error;}
  return data;
}
