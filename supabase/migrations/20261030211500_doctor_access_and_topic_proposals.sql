-- Acceso personal y propuestas del doctor en el proyecto independiente.
-- Se han respaldado los datos anteriores: solo pruebas y una sesión vacía.
do $$ begin
  if exists (
    select 1 from public.giovanni_fase1_sessions s
    where coalesce(s.answers->>'reference1','') not like 'QA-%'
      and exists (select 1 from jsonb_each(s.answers) e
                  where jsonb_typeof(e.value)='string' and length(trim(e.value #>> '{}')) > 0)
  ) then
    raise exception 'Hay respuestas nuevas que deben conservarse antes de limpiar.';
  end if;
end $$;
delete from public.giovanni_fase1_sessions;
revoke all on function public.giovanni_fase1_load(text) from anon, authenticated;
revoke all on function public.giovanni_fase1_save(text,jsonb,integer) from anon, authenticated;

create table public.giovanni_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers)='object' and octet_length(answers::text)<=200000),
  revision integer not null default 1 check (revision>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.giovanni_workspaces enable row level security;
revoke all on public.giovanni_workspaces from public, anon, authenticated;
grant select, insert, update on public.giovanni_workspaces to authenticated;
create policy giovanni_workspace_owner on public.giovanni_workspaces
  for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

create table public.giovanni_topic_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 2 and 240),
  details text not null default '' check (length(details)<=6000),
  priority text not null default 'normal' check (priority in ('alta','normal','baja')),
  status text not null default 'propuesto' check (status in ('propuesto','en_preparacion','listo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index giovanni_proposals_owner_created on public.giovanni_topic_proposals(user_id,created_at desc);
alter table public.giovanni_topic_proposals enable row level security;
revoke all on public.giovanni_topic_proposals from public, anon, authenticated;
grant select, insert, update, delete on public.giovanni_topic_proposals to authenticated;
create policy giovanni_topic_owner on public.giovanni_topic_proposals
  for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

create function public.giovanni_touch_updated_at()
returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); return new; end $$;
revoke all on function public.giovanni_touch_updated_at() from public;
create trigger giovanni_proposal_updated before update on public.giovanni_topic_proposals
  for each row execute function public.giovanni_touch_updated_at();

create function public.giovanni_workspace_load()
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Inicie sesión para continuar.' using errcode='PT401'; end if;
  select jsonb_build_object('answers',s.answers,'revision',s.revision,'updated_at',s.updated_at)
    into v_result from public.giovanni_workspaces s where s.user_id=auth.uid();
  return v_result;
end $$;

create function public.giovanni_workspace_save(p_answers jsonb,p_expected_revision integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Inicie sesión para continuar.' using errcode='PT401'; end if;
  if p_answers is null or jsonb_typeof(p_answers)<>'object' or octet_length(p_answers::text)>200000 then
    raise exception 'Las respuestas no tienen un formato válido.' using errcode='22023'; end if;
  if p_expected_revision is null or p_expected_revision<0 then
    raise exception 'Revisión inválida.' using errcode='22023'; end if;
  if p_expected_revision=0 then
    insert into public.giovanni_workspaces(user_id,answers) values(auth.uid(),p_answers)
      on conflict(user_id) do nothing
      returning jsonb_build_object('revision',revision,'updated_at',updated_at) into v_result;
  else
    update public.giovanni_workspaces s set answers=p_answers,revision=s.revision+1,updated_at=now()
      where s.user_id=auth.uid() and s.revision=p_expected_revision
      returning jsonb_build_object('revision',s.revision,'updated_at',s.updated_at) into v_result;
  end if;
  if v_result is null then
    raise exception 'Las respuestas cambiaron en otro dispositivo. Recupere la versión guardada.' using errcode='PT409'; end if;
  return v_result;
end $$;
revoke all on function public.giovanni_workspace_load() from public,anon;
revoke all on function public.giovanni_workspace_save(jsonb,integer) from public,anon;
grant execute on function public.giovanni_workspace_load() to authenticated;
grant execute on function public.giovanni_workspace_save(jsonb,integer) to authenticated;
