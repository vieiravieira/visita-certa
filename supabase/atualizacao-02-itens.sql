-- =====================================================================
-- VISITA CERTA — ATUALIZAÇÃO 02: vários itens por visita + novos tipos
-- Para quem JÁ rodou o schema.sql antes. Cole no SQL Editor e clique Run.
-- Pode rodar mais de uma vez sem problema.
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
