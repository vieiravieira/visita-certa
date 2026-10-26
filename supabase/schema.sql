-- =====================================================================
-- VISITA CERTA — banco de dados (Supabase / Postgres)
-- Cole este arquivo inteiro no Supabase > SQL Editor > New query > Run.
-- Pode rodar de novo sem quebrar (usa "if not exists" / "or replace").
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. TABELAS
-- ---------------------------------------------------------------------

-- Cada cliente que paga a mensalidade é uma "empresa".
create table if not exists public.empresas (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,
  ativa            boolean not null default true,      -- desligue se não pagar
  pago_ate         date,                                -- controle da mensalidade
  codigo_gestor    text not null unique default ('G' || upper(substr(md5(random()::text), 1, 6))),
  codigo_promotor  text not null unique default ('P' || upper(substr(md5(random()::text), 1, 6))),
  criado_em        timestamptz not null default now()
);

-- Um perfil para cada usuário (admin = você, gestor = cliente, promotor).
create table if not exists public.perfis (
  id          uuid primary key references auth.users (id) on delete cascade,
  empresa_id  uuid references public.empresas (id) on delete cascade,
  nome        text not null,
  email       text,
  papel       text not null check (papel in ('admin', 'gestor', 'promotor')),
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

create table if not exists public.lojas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas (id) on delete cascade,
  nome        text not null,
  endereco    text,
  latitude    double precision not null,
  longitude   double precision not null,
  raio_m      integer not null default 200 check (raio_m between 20 and 5000),
  ativa       boolean not null default true,
  criado_em   timestamptz not null default now()
);

create table if not exists public.perguntas (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas (id) on delete cascade,
  texto        text not null,
  tipo         text not null default 'sim_nao' check (tipo in ('sim_nao', 'texto', 'numero')),
  obrigatoria  boolean not null default true,
  ordem        integer not null default 0,
  ativa        boolean not null default true,
  criado_em    timestamptz not null default now()
);

create table if not exists public.visitas (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas (id) on delete cascade,
  promotor_id  uuid not null references public.perfis (id) on delete cascade,
  loja_id      uuid not null references public.lojas (id) on delete restrict,
  criado_em    timestamptz not null default now(),   -- hora do SERVIDOR, não do celular
  latitude     double precision not null,
  longitude    double precision not null,
  precisao_m   double precision,
  distancia_m  integer not null,
  na_loja      boolean not null,
  observacao   text
);

create table if not exists public.visita_fotos (
  id          uuid primary key default gen_random_uuid(),
  visita_id   uuid not null references public.visitas (id) on delete cascade,
  empresa_id  uuid not null references public.empresas (id) on delete cascade,
  caminho     text not null,
  criado_em   timestamptz not null default now()
);

create table if not exists public.visita_respostas (
  id              uuid primary key default gen_random_uuid(),
  visita_id       uuid not null references public.visitas (id) on delete cascade,
  empresa_id      uuid not null references public.empresas (id) on delete cascade,
  pergunta_id     uuid references public.perguntas (id) on delete set null,
  pergunta_texto  text not null,   -- cópia do texto, para o histórico não mudar
  resposta        text
);

create index if not exists visitas_empresa_data_idx on public.visitas (empresa_id, criado_em desc);
create index if not exists visitas_promotor_idx     on public.visitas (promotor_id, criado_em desc);
create index if not exists fotos_visita_idx         on public.visita_fotos (visita_id);
create index if not exists respostas_visita_idx     on public.visita_respostas (visita_id);
create index if not exists perfis_empresa_idx       on public.perfis (empresa_id);
create index if not exists lojas_empresa_idx        on public.lojas (empresa_id);
create index if not exists perguntas_empresa_idx    on public.perguntas (empresa_id);

-- ---------------------------------------------------------------------
-- 2. FUNÇÕES DE APOIO (quem é o usuário logado)
-- ---------------------------------------------------------------------

create or replace function public.eh_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and papel = 'admin' and ativo);
$$;

-- Empresa do usuário logado (só se o usuário e a empresa estiverem ativos).
create or replace function public.minha_empresa()
returns uuid language sql stable security definer set search_path = public as $$
  select p.empresa_id
    from perfis p join empresas e on e.id = p.empresa_id
   where p.id = auth.uid() and p.ativo and e.ativa;
$$;

create or replace function public.meu_papel()
returns text language sql stable security definer set search_path = public as $$
  select papel from perfis where id = auth.uid() and ativo;
$$;

create or replace function public.eh_gestor()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.meu_papel() = 'gestor', false) and public.minha_empresa() is not null;
$$;

-- Distância em metros entre dois pontos (fórmula de Haversine).
create or replace function public.distancia_metros(lat1 double precision, lon1 double precision,
                                                   lat2 double precision, lon2 double precision)
returns double precision language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(
           power(sin(radians(lat2 - lat1) / 2), 2) +
           cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)
         ));
$$;

-- ---------------------------------------------------------------------
-- 3. CADASTRO: o código digitado define empresa e papel
-- ---------------------------------------------------------------------

-- Usado pela tela de cadastro para conferir o código antes de criar a conta.
create or replace function public.validar_codigo(p_codigo text)
returns table (empresa text, papel text)
language sql stable security definer set search_path = public as $$
  select e.nome, 'gestor' from empresas e
   where e.codigo_gestor = upper(trim(p_codigo)) and e.ativa
  union all
  select e.nome, 'promotor' from empresas e
   where e.codigo_promotor = upper(trim(p_codigo)) and e.ativa
  union all
  select 'Administração', 'admin'
   where upper(trim(p_codigo)) = 'ADMIN'
     and not exists (select 1 from perfis where papel = 'admin');
$$;

create or replace function public.criar_perfil_novo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_codigo  text := upper(trim(coalesce(new.raw_user_meta_data ->> 'codigo', '')));
  v_nome    text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1));
  v_empresa uuid;
begin
  -- Primeiro administrador do sistema (só funciona uma vez).
  if v_codigo = 'ADMIN' and not exists (select 1 from perfis where papel = 'admin') then
    insert into perfis (id, empresa_id, nome, email, papel) values (new.id, null, v_nome, new.email, 'admin');
    return new;
  end if;

  select id into v_empresa from empresas where codigo_gestor = v_codigo and ativa;
  if found then
    insert into perfis (id, empresa_id, nome, email, papel) values (new.id, v_empresa, v_nome, new.email, 'gestor');
    return new;
  end if;

  select id into v_empresa from empresas where codigo_promotor = v_codigo and ativa;
  if found then
    insert into perfis (id, empresa_id, nome, email, papel) values (new.id, v_empresa, v_nome, new.email, 'promotor');
    return new;
  end if;

  raise exception 'Código de acesso inválido';
end;
$$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil_novo_usuario();

-- ---------------------------------------------------------------------
-- 4. REGISTRAR VISITA (tudo de uma vez, com foto obrigatória)
-- ---------------------------------------------------------------------
-- O app primeiro sobe as fotos para o Storage em
--   fotos/<empresa_id>/<promotor_id>/<visita_id>/<arquivo>.jpg
-- e depois chama esta função. Ela confere tudo no servidor:
--   - usuário é promotor ativo de empresa ativa
--   - loja pertence à empresa
--   - pelo menos 1 foto, e as fotos existem de verdade no Storage
--   - perguntas obrigatórias respondidas
--   - calcula distância e se estava na loja (o celular não decide isso)
--   - grava data/hora do servidor

create or replace function public.registrar_visita(
  p_visita_id   uuid,
  p_loja_id     uuid,
  p_latitude    double precision,
  p_longitude   double precision,
  p_precisao_m  double precision,
  p_observacao  text,
  p_fotos       text[],
  p_respostas   jsonb   -- [{"pergunta_id": "...", "resposta": "..."}]
)
returns public.visitas
language plpgsql security definer set search_path = public as $$
declare
  v_empresa  uuid := public.minha_empresa();
  v_loja     lojas%rowtype;
  v_dist     double precision;
  v_visita   visitas%rowtype;
  v_foto     text;
  v_prefixo  text;
  v_perg     perguntas%rowtype;
  v_resp     text;
begin
  if v_empresa is null or public.meu_papel() <> 'promotor' then
    raise exception 'Acesso negado: usuário não é promotor ativo';
  end if;

  if p_latitude is null or p_longitude is null then
    raise exception 'Localização obrigatória';
  end if;

  select * into v_loja from lojas where id = p_loja_id and empresa_id = v_empresa and ativa;
  if not found then
    raise exception 'Loja não encontrada';
  end if;

  if p_fotos is null or coalesce(array_length(p_fotos, 1), 0) = 0 then
    raise exception 'Envie pelo menos uma foto';
  end if;

  v_prefixo := v_empresa::text || '/' || auth.uid()::text || '/' || p_visita_id::text || '/';
  foreach v_foto in array p_fotos loop
    if left(v_foto, length(v_prefixo)) <> v_prefixo then
      raise exception 'Foto em local inválido';
    end if;
    if not exists (select 1 from storage.objects where bucket_id = 'fotos' and name = v_foto) then
      raise exception 'Foto não encontrada no armazenamento';
    end if;
  end loop;

  v_dist := public.distancia_metros(p_latitude, p_longitude, v_loja.latitude, v_loja.longitude);

  insert into visitas (id, empresa_id, promotor_id, loja_id, criado_em,
                       latitude, longitude, precisao_m, distancia_m, na_loja, observacao)
  values (p_visita_id, v_empresa, auth.uid(), v_loja.id, now(),
          p_latitude, p_longitude, p_precisao_m, round(v_dist)::int, v_dist <= v_loja.raio_m,
          nullif(trim(p_observacao), ''))
  returning * into v_visita;

  insert into visita_fotos (visita_id, empresa_id, caminho)
  select v_visita.id, v_empresa, f from unnest(p_fotos) f;

  for v_perg in
    select * from perguntas where empresa_id = v_empresa and ativa order by ordem, criado_em
  loop
    select nullif(trim(r ->> 'resposta'), '') into v_resp
      from jsonb_array_elements(coalesce(p_respostas, '[]'::jsonb)) r
     where r ->> 'pergunta_id' = v_perg.id::text
     limit 1;

    if v_perg.obrigatoria and v_resp is null then
      raise exception 'Responda a pergunta: %', v_perg.texto;
    end if;

    insert into visita_respostas (visita_id, empresa_id, pergunta_id, pergunta_texto, resposta)
    values (v_visita.id, v_empresa, v_perg.id, v_perg.texto, v_resp);
  end loop;

  return v_visita;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. SEGURANÇA (RLS): cada empresa só enxerga o que é dela
-- ---------------------------------------------------------------------

alter table public.empresas         enable row level security;
alter table public.perfis           enable row level security;
alter table public.lojas            enable row level security;
alter table public.perguntas        enable row level security;
alter table public.visitas          enable row level security;
alter table public.visita_fotos     enable row level security;
alter table public.visita_respostas enable row level security;

-- EMPRESAS
drop policy if exists empresas_ver on public.empresas;
create policy empresas_ver on public.empresas for select
  using (public.eh_admin() or id = (select empresa_id from public.perfis where id = auth.uid()));

drop policy if exists empresas_admin on public.empresas;
create policy empresas_admin on public.empresas for all
  using (public.eh_admin()) with check (public.eh_admin());

-- PERFIS
drop policy if exists perfis_ver on public.perfis;
create policy perfis_ver on public.perfis for select
  using (id = auth.uid() or public.eh_admin()
         or (public.eh_gestor() and empresa_id = public.minha_empresa()));

drop policy if exists perfis_gestor_editar on public.perfis;
create policy perfis_gestor_editar on public.perfis for update
  using (public.eh_gestor() and empresa_id = public.minha_empresa() and papel = 'promotor')
  with check (empresa_id = public.minha_empresa() and papel = 'promotor');

drop policy if exists perfis_admin on public.perfis;
create policy perfis_admin on public.perfis for all
  using (public.eh_admin()) with check (public.eh_admin());

-- LOJAS e PERGUNTAS: todos da empresa veem, só o gestor altera
drop policy if exists lojas_ver on public.lojas;
create policy lojas_ver on public.lojas for select
  using (public.eh_admin() or empresa_id = public.minha_empresa());

drop policy if exists lojas_gestor on public.lojas;
create policy lojas_gestor on public.lojas for all
  using (public.eh_admin() or (public.eh_gestor() and empresa_id = public.minha_empresa()))
  with check (public.eh_admin() or (public.eh_gestor() and empresa_id = public.minha_empresa()));

drop policy if exists perguntas_ver on public.perguntas;
create policy perguntas_ver on public.perguntas for select
  using (public.eh_admin() or empresa_id = public.minha_empresa());

drop policy if exists perguntas_gestor on public.perguntas;
create policy perguntas_gestor on public.perguntas for all
  using (public.eh_admin() or (public.eh_gestor() and empresa_id = public.minha_empresa()))
  with check (public.eh_admin() or (public.eh_gestor() and empresa_id = public.minha_empresa()));

-- VISITAS: gravação só pela função registrar_visita (não há policy de insert)
drop policy if exists visitas_ver on public.visitas;
create policy visitas_ver on public.visitas for select
  using (public.eh_admin()
         or (empresa_id = public.minha_empresa() and (public.eh_gestor() or promotor_id = auth.uid())));

drop policy if exists visitas_admin_apagar on public.visitas;
create policy visitas_admin_apagar on public.visitas for delete using (public.eh_admin());

drop policy if exists fotos_ver on public.visita_fotos;
create policy fotos_ver on public.visita_fotos for select
  using (exists (select 1 from public.visitas v where v.id = visita_id));   -- herda a regra de visitas

drop policy if exists respostas_ver on public.visita_respostas;
create policy respostas_ver on public.visita_respostas for select
  using (exists (select 1 from public.visitas v where v.id = visita_id));

-- Permissões das funções
revoke all on function public.registrar_visita(uuid, uuid, double precision, double precision, double precision, text, text[], jsonb) from public;
grant execute on function public.registrar_visita(uuid, uuid, double precision, double precision, double precision, text, text[], jsonb) to authenticated;
grant execute on function public.validar_codigo(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. ARMAZENAMENTO DAS FOTOS (bucket privado, máx. 5 MB, só imagem)
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Promotor só envia para a pasta dele: <empresa>/<promotor>/...
drop policy if exists fotos_enviar on storage.objects;
create policy fotos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos'
              and public.meu_papel() = 'promotor'
              and (storage.foldername(name))[1] = public.minha_empresa()::text
              and (storage.foldername(name))[2] = auth.uid()::text);

-- Gestor vê fotos da empresa; promotor vê as dele; admin vê tudo.
drop policy if exists fotos_ler on storage.objects;
create policy fotos_ler on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and (
           public.eh_admin()
           or ((storage.foldername(name))[1] = public.minha_empresa()::text
               and (public.eh_gestor() or (storage.foldername(name))[2] = auth.uid()::text))));


-- =====================================================================
-- 7. ITENS POR VISITA E NOVOS TIPOS (atualização 02 já incluída)
-- =====================================================================

-- 1. Novos tipos de resposta: data e lista de opções
alter table public.perguntas drop constraint if exists perguntas_tipo_check;
alter table public.perguntas add constraint perguntas_tipo_check
  check (tipo in ('sim_nao', 'texto', 'numero', 'data', 'lista'));

alter table public.perguntas add column if not exists opcoes text[];

-- 2. Onde a pergunta aparece: em cada item, ou uma vez por visita
alter table public.perguntas add column if not exists escopo text not null default 'item';
alter table public.perguntas drop constraint if exists perguntas_escopo_check;
alter table public.perguntas add constraint perguntas_escopo_check
  check (escopo in ('visita', 'item'));

-- 3. Número do item em cada resposta (vazio = resposta da visita)
alter table public.visita_respostas add column if not exists item_num integer;
create index if not exists respostas_visita_item_idx on public.visita_respostas (visita_id, item_num);

-- 4. Conferência de cada resposta conforme o tipo
create or replace function public.validar_resposta(p perguntas, r text, p_onde text)
returns text language plpgsql stable set search_path = public as $$
declare
  v text := nullif(trim(r), '');
begin
  if v is null then
    if p.obrigatoria then
      raise exception '%Responda: %', p_onde, p.texto;
    end if;
    return null;
  end if;

  if p.tipo = 'sim_nao' and v not in ('Sim', 'Não') then
    raise exception '%Resposta inválida em: %', p_onde, p.texto;
  elsif p.tipo = 'numero' then
    v := replace(v, ',', '.');
    if v !~ '^-?[0-9]+(\.[0-9]+)?$' then
      raise exception '%Digite só números em: %', p_onde, p.texto;
    end if;
  elsif p.tipo = 'data' then
    if v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception '%Data inválida em: %', p_onde, p.texto;
    end if;
    begin
      perform v::date;
    exception when others then
      raise exception '%Data inválida em: %', p_onde, p.texto;
    end;
  elsif p.tipo = 'lista' and not (v = any (coalesce(p.opcoes, '{}'))) then
    raise exception '%Escolha uma das opções em: %', p_onde, p.texto;
  end if;

  return v;
end;
$$;

-- 5. Registrar visita com vários itens
-- p_respostas = {"visita": [{"pergunta_id","resposta"}...],
--                "itens":  [[{"pergunta_id","resposta"}...], [...]]}
create or replace function public.registrar_visita(
  p_visita_id   uuid,
  p_loja_id     uuid,
  p_latitude    double precision,
  p_longitude   double precision,
  p_precisao_m  double precision,
  p_observacao  text,
  p_fotos       text[],
  p_respostas   jsonb
)
returns public.visitas
language plpgsql security definer set search_path = public as $$
declare
  v_empresa  uuid := public.minha_empresa();
  v_loja     lojas%rowtype;
  v_dist     double precision;
  v_visita   visitas%rowtype;
  v_foto     text;
  v_prefixo  text;
  v_perg     perguntas%rowtype;
  v_resp     text;
  v_geral    jsonb;
  v_itens    jsonb;
  v_item     jsonb;
  v_qtd      int;
  i          int;
begin
  if v_empresa is null or coalesce(public.meu_papel(), '') <> 'promotor' then
    raise exception 'Acesso negado: usuário não é promotor ativo';
  end if;

  if p_latitude is null or p_longitude is null then
    raise exception 'Localização obrigatória';
  end if;

  select * into v_loja from lojas where id = p_loja_id and empresa_id = v_empresa and ativa;
  if not found then
    raise exception 'Loja não encontrada';
  end if;

  if p_fotos is null or coalesce(array_length(p_fotos, 1), 0) = 0 then
    raise exception 'Envie pelo menos uma foto';
  end if;

  v_prefixo := v_empresa::text || '/' || auth.uid()::text || '/' || p_visita_id::text || '/';
  foreach v_foto in array p_fotos loop
    if left(v_foto, length(v_prefixo)) <> v_prefixo then
      raise exception 'Foto em local inválido';
    end if;
    if not exists (select 1 from storage.objects where bucket_id = 'fotos' and name = v_foto) then
      raise exception 'Foto não encontrada no armazenamento';
    end if;
  end loop;

  -- aceita o formato antigo (lista simples) e o novo (visita + itens)
  if jsonb_typeof(p_respostas) = 'array' then
    v_geral := p_respostas;
    v_itens := '[]'::jsonb;
  else
    v_geral := coalesce(p_respostas -> 'visita', '[]'::jsonb);
    v_itens := coalesce(p_respostas -> 'itens', '[]'::jsonb);
  end if;
  v_qtd := jsonb_array_length(v_itens);

  if v_qtd = 0 and exists (select 1 from perguntas where empresa_id = v_empresa and ativa and escopo = 'item') then
    raise exception 'Adicione pelo menos um item';
  end if;
  if v_qtd > 100 then
    raise exception 'Máximo de 100 itens por visita';
  end if;

  v_dist := public.distancia_metros(p_latitude, p_longitude, v_loja.latitude, v_loja.longitude);

  insert into visitas (id, empresa_id, promotor_id, loja_id, criado_em,
                       latitude, longitude, precisao_m, distancia_m, na_loja, observacao)
  values (p_visita_id, v_empresa, auth.uid(), v_loja.id, now(),
          p_latitude, p_longitude, p_precisao_m, round(v_dist)::int, v_dist <= v_loja.raio_m,
          nullif(trim(p_observacao), ''))
  returning * into v_visita;

  insert into visita_fotos (visita_id, empresa_id, caminho)
  select v_visita.id, v_empresa, f from unnest(p_fotos) f;

  -- perguntas da visita (uma vez só)
  for v_perg in
    select * from perguntas where empresa_id = v_empresa and ativa and escopo = 'visita' order by ordem, criado_em
  loop
    select r ->> 'resposta' into v_resp
      from jsonb_array_elements(v_geral) r where r ->> 'pergunta_id' = v_perg.id::text limit 1;
    v_resp := public.validar_resposta(v_perg, v_resp, '');
    insert into visita_respostas (visita_id, empresa_id, pergunta_id, pergunta_texto, resposta, item_num)
    values (v_visita.id, v_empresa, v_perg.id, v_perg.texto, v_resp, null);
  end loop;

  -- perguntas de cada item
  for i in 0 .. v_qtd - 1 loop
    v_item := v_itens -> i;
    for v_perg in
      select * from perguntas where empresa_id = v_empresa and ativa and escopo = 'item' order by ordem, criado_em
    loop
      select r ->> 'resposta' into v_resp
        from jsonb_array_elements(v_item) r where r ->> 'pergunta_id' = v_perg.id::text limit 1;
      v_resp := public.validar_resposta(v_perg, v_resp, 'Item ' || (i + 1) || ': ');
      insert into visita_respostas (visita_id, empresa_id, pergunta_id, pergunta_texto, resposta, item_num)
      values (v_visita.id, v_empresa, v_perg.id, v_perg.texto, v_resp, i + 1);
    end loop;
  end loop;

  return v_visita;
end;
$$;

revoke all on function public.registrar_visita(uuid, uuid, double precision, double precision, double precision, text, text[], jsonb) from public;
grant execute on function public.registrar_visita(uuid, uuid, double precision, double precision, double precision, text, text[], jsonb) to authenticated;
