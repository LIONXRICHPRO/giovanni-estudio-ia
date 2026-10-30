-- Base independiente de Giovanni Estudio IA.
create table public.giovanni_fase1_sessions (
  id uuid not null unique default gen_random_uuid(),
  access_hash bytea primary key,
  answers jsonb not null default '{}'::jsonb,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint giovanni_answers_object check (jsonb_typeof(answers) = 'object'),
  constraint giovanni_answers_size check (octet_length(answers::text) <= 200000)
);
alter table public.giovanni_fase1_sessions enable row level security;
revoke all on public.giovanni_fase1_sessions from anon, authenticated, public;
comment on table public.giovanni_fase1_sessions is 'Fase 1 del Dr. Giovanni Soto. Acceso por capacidad aleatoria de 256 bits; solo se guarda su hash. Sin lectura directa desde el cliente.';

create function public.giovanni_fase1_load(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid session token' using errcode = '22023';
  end if;
  select jsonb_build_object('id', s.id, 'answers', s.answers, 'revision', s.revision, 'updated_at', s.updated_at)
    into v_result from public.giovanni_fase1_sessions s
    where s.access_hash = pg_catalog.sha256(pg_catalog.convert_to(p_token, 'UTF8'));
  return v_result;
end;
$$;

create function public.giovanni_fase1_save(p_token text, p_answers jsonb, p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb; v_hash bytea;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid session token' using errcode = '22023';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' or octet_length(p_answers::text) > 200000 then
    raise exception 'Invalid questionnaire payload' using errcode = '22023';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Invalid revision' using errcode = '22023';
  end if;
  v_hash := pg_catalog.sha256(pg_catalog.convert_to(p_token, 'UTF8'));
  if p_expected_revision = 0 then
    insert into public.giovanni_fase1_sessions (access_hash, answers)
      values (v_hash, p_answers) on conflict (access_hash) do nothing
      returning jsonb_build_object('id', id, 'revision', revision, 'updated_at', updated_at) into v_result;
  else
    update public.giovanni_fase1_sessions s set answers = p_answers, revision = s.revision + 1, updated_at = now()
      where s.access_hash = v_hash and s.revision = p_expected_revision
      returning jsonb_build_object('id', s.id, 'revision', s.revision, 'updated_at', s.updated_at) into v_result;
  end if;
  if v_result is null then
    raise exception 'La sesión cambió en otro dispositivo. Recargue antes de guardar.' using errcode = 'PT409';
  end if;
  return v_result;
end;
$$;

create function public.giovanni_fase1_status()
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('status', 'ok', 'schema_version', 1);
$$;
revoke all on function public.giovanni_fase1_load(text) from public;
revoke all on function public.giovanni_fase1_save(text,jsonb,integer) from public;
revoke all on function public.giovanni_fase1_status() from public;
grant execute on function public.giovanni_fase1_load(text) to anon, authenticated;
grant execute on function public.giovanni_fase1_save(text,jsonb,integer) to anon, authenticated;
grant execute on function public.giovanni_fase1_status() to anon, authenticated;
