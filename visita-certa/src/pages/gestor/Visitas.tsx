import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { baixarCSV, fmtData, fmtDataHora, fmtHora, hojeISO } from "@/lib/formato";
import { linkMapa } from "@/lib/geo";
import type { Loja, Perfil, VisitaCompleta } from "@/lib/tipos";
import { Botao, Cartao, Entrada, Modal, Rotulo, Selecao, TelaCarregando, TituloPagina, Vazio, cx } from "@/components/ui";
import { DetalheVisita, SELECT_VISITA, SeloLocal } from "@/components/DetalheVisita";

const LIMITE = 1000;

export default function Visitas() {
  const [de, setDe] = useState(hojeISO(-6));
  const [ate, setAte] = useState(hojeISO());
  const [promotorId, setPromotorId] = useState("");
  const [lojaId, setLojaId] = useState("");
  const [situacao, setSituacao] = useState<"" | "na" | "fora">("");

  const [promotores, setPromotores] = useState<Perfil[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [visitas, setVisitas] = useState<VisitaCompleta[] | null>(null);
  const [aberta, setAberta] = useState<VisitaCompleta | null>(null);

  useEffect(() => {
    supabase.from("perfis").select("*").eq("papel", "promotor").order("nome").then(({ data }) => setPromotores((data as Perfil[]) ?? []));
    supabase.from("lojas").select("*").order("nome").then(({ data }) => setLojas((data as Loja[]) ?? []));
  }, []);

  const buscar = useCallback(async () => {
    setVisitas(null);
    let q = supabase
      .from("visitas")
      .select(SELECT_VISITA)
      .gte("criado_em", new Date(`${de}T00:00:00`).toISOString())
      .lt("criado_em", new Date(new Date(`${ate}T00:00:00`).getTime() + 86400000).toISOString())
      .order("criado_em", { ascending: false })
      .limit(LIMITE);
    if (promotorId) q = q.eq("promotor_id", promotorId);
    if (lojaId) q = q.eq("loja_id", lojaId);
    if (situacao) q = q.eq("na_loja", situacao === "na");
    const { data } = await q;
    setVisitas((data as unknown as VisitaCompleta[]) ?? []);
  }, [de, ate, promotorId, lojaId, situacao]);

  useEffect(() => { buscar(); }, [buscar]);

  const resumo = useMemo(() => {
    if (!visitas) return null;
    const naLoja = visitas.filter((v) => v.na_loja).length;
    const comVisita = new Set(visitas.map((v) => v.promotor_id));
    const semVisita = promotorId || lojaId || situacao
      ? []
      : promotores.filter((p) => p.ativo && !comVisita.has(p.id));
    return {
      total: visitas.length,
      pctNaLoja: visitas.length ? Math.round((naLoja / visitas.length) * 100) : 0,
      fora: visitas.length - naLoja,
      promotores: comVisita.size,
      lojas: new Set(visitas.map((v) => v.loja_id)).size,
      semVisita,
    };
  }, [visitas, promotores, promotorId, lojaId, situacao]);

  function exportar() {
    if (!visitas?.length) return;
    const perguntas = Array.from(new Set(visitas.flatMap((v) => v.visita_respostas.map((r) => r.pergunta_texto))));
    const linhas: (string | number | null)[][] = [[
      "Data", "Hora", "Promotor", "Loja", "Endereço", "Situação", "Distância (m)", "Precisão GPS (m)",
      "Latitude", "Longitude", "Mapa", "Qtd. fotos", ...perguntas, "Observação",
    ]];
    for (const v of visitas) {
      const resp = Object.fromEntries(v.visita_respostas.map((r) => [r.pergunta_texto, r.resposta]));
      linhas.push([
        fmtData(v.criado_em), fmtHora(v.criado_em), v.promotor?.nome ?? "", v.loja?.nome ?? "", v.loja?.endereco ?? "",
        v.na_loja ? "Na loja" : "Fora da loja", v.distancia_m, v.precisao_m ? Math.round(v.precisao_m) : "",
        v.latitude, v.longitude, linkMapa(v.latitude, v.longitude), v.visita_fotos.length,
        ...perguntas.map((p) => resp[p] ?? ""), v.observacao ?? "",
      ]);
    }
    baixarCSV(`visitas_${de}_a_${ate}.csv`, linhas);
  }

  const atalho = (dias: number) => { setDe(hojeISO(-dias)); setAte(hojeISO()); };

  return (
    <div>
      <TituloPagina
        titulo="Visitas"
        sub="Tudo o que os promotores enviaram"
        acao={<Botao variante="secundario" onClick={exportar} disabled={!visitas?.length}>⬇ Exportar Excel (CSV)</Botao>}
      />

      <Cartao className="mb-5 p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {[["Hoje", 0], ["7 dias", 6], ["30 dias", 29]].map(([r, d]) => (
            <button key={r} onClick={() => atalho(d as number)}
                    className={cx("rounded-full border px-3 py-1 text-sm font-medium",
                      de === hojeISO(-(d as number)) && ate === hojeISO() ? "border-marca-600 bg-marca-50 text-marca-700" : "border-stone-300 text-stone-600")}>
              {r}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Rotulo texto="De"><Entrada type="date" value={de} max={ate} onChange={(e) => setDe(e.target.value)} /></Rotulo>
          <Rotulo texto="Até"><Entrada type="date" value={ate} min={de} onChange={(e) => setAte(e.target.value)} /></Rotulo>
          <Rotulo texto="Promotor">
            <Selecao value={promotorId} onChange={(e) => setPromotorId(e.target.value)}>
              <option value="">Todos</option>
              {promotores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </Selecao>
          </Rotulo>
          <Rotulo texto="Loja">
            <Selecao value={lojaId} onChange={(e) => setLojaId(e.target.value)}>
              <option value="">Todas</option>
              {lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </Selecao>
          </Rotulo>
          <Rotulo texto="Situação">
            <Selecao value={situacao} onChange={(e) => setSituacao(e.target.value as "" | "na" | "fora")}>
              <option value="">Todas</option>
              <option value="na">Na loja</option>
              <option value="fora">Fora da loja</option>
            </Selecao>
          </Rotulo>
        </div>
      </Cartao>

      {resumo && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Indicador rotulo="Visitas" valor={String(resumo.total)} />
          <Indicador rotulo="Na loja" valor={`${resumo.pctNaLoja}%`} detalhe={resumo.fora ? `${resumo.fora} fora da loja` : "nenhuma fora"} alerta={resumo.fora > 0} />
          <Indicador rotulo="Promotores que enviaram" valor={String(resumo.promotores)} />
          <Indicador rotulo="Lojas visitadas" valor={String(resumo.lojas)} />
        </div>
      )}

      {resumo && resumo.semVisita.length > 0 && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <b>Sem nenhuma visita no período ({resumo.semVisita.length}):</b> {resumo.semVisita.map((p) => p.nome).join(", ")}
        </div>
      )}

      {!visitas ? <TelaCarregando /> : !visitas.length ? (
        <Vazio titulo="Nenhuma visita neste filtro" texto="Mude o período ou os filtros acima." />
      ) : (
        <>
          {/* celular: cartões */}
          <div className="space-y-2 md:hidden">
            {visitas.map((v) => (
              <Cartao key={v.id} className="p-0">
                <button onClick={() => setAberta(v)} className="w-full px-4 py-3 text-left">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-stone-900">{v.promotor?.nome}</p>
                    <SeloLocal v={v} />
                  </div>
                  <p className="text-sm text-stone-600">{v.loja?.nome}</p>
                  <p className="mt-1 text-xs text-stone-500">{fmtDataHora(v.criado_em)} · {v.visita_fotos.length} foto(s)</p>
                </button>
              </Cartao>
            ))}
          </div>

          {/* computador: tabela */}
          <Cartao className="hidden overflow-hidden md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Data / hora</th>
                  <th className="px-4 py-3 font-semibold">Promotor</th>
                  <th className="px-4 py-3 font-semibold">Loja</th>
                  <th className="px-4 py-3 font-semibold">Localização</th>
                  <th className="px-4 py-3 font-semibold">Fotos</th>
                  <th className="px-4 py-3 font-semibold">Checklist</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {visitas.map((v) => {
                  const nao = v.visita_respostas.filter((r) => r.resposta === "Não").length;
                  return (
                    <tr key={v.id} onClick={() => setAberta(v)} className="cursor-pointer hover:bg-stone-50">
                      <td className="whitespace-nowrap px-4 py-3 text-stone-700">{fmtDataHora(v.criado_em)}</td>
                      <td className="px-4 py-3 font-semibold text-stone-900">{v.promotor?.nome}</td>
                      <td className="px-4 py-3 text-stone-700">{v.loja?.nome}</td>
                      <td className="px-4 py-3"><SeloLocal v={v} /></td>
                      <td className="px-4 py-3 text-stone-700">{v.visita_fotos.length}</td>
                      <td className="px-4 py-3 text-stone-700">
                        {nao > 0 ? <span className="font-semibold text-red-700">{nao} “Não”</span> : <span className="text-marca-700">OK</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Cartao>
          {visitas.length === LIMITE && (
            <p className="mt-3 text-center text-xs text-stone-500">Mostrando as {LIMITE} visitas mais recentes. Diminua o período para ver todas.</p>
          )}
        </>
      )}

      <Modal aberto={!!aberta} aoFechar={() => setAberta(null)} titulo="Detalhe da visita" largo>
        {aberta && <DetalheVisita visita={aberta} />}
      </Modal>
    </div>
  );
}

function Indicador({ rotulo, valor, detalhe, alerta }: { rotulo: string; valor: string; detalhe?: string; alerta?: boolean }) {
  return (
    <Cartao className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{rotulo}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-stone-900">{valor}</p>
      {detalhe && <p className={cx("text-xs", alerta ? "text-red-700" : "text-stone-500")}>{detalhe}</p>}
    </Cartao>
  );
}

