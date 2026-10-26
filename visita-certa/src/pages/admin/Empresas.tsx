import { useEffect, useState, type FormEvent } from "react";
import { supabase, mensagemErro } from "@/lib/supabase";
import { fmtData, hojeISO } from "@/lib/formato";
import type { Empresa } from "@/lib/tipos";
import { Aviso, Botao, Cartao, Entrada, Modal, Rotulo, Selo, TelaCarregando, TituloPagina, Vazio } from "@/components/ui";

interface Uso { promotores: number; visitasMes: number }

export default function Empresas() {
  const [empresas, setEmpresas] = useState<Empresa[] | null>(null);
  const [uso, setUso] = useState<Record<string, Uso>>({});
  const [form, setForm] = useState<{ id?: string; nome: string; pago_ate: string; ativa: boolean } | null>(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const { data } = await supabase.from("empresas").select("*").order("nome");
    const lista = (data as Empresa[]) ?? [];
    setEmpresas(lista);

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const { data: perfis } = await supabase.from("perfis").select("empresa_id").eq("papel", "promotor").eq("ativo", true);
    const contagens = await Promise.all(
      lista.map((e) =>
        supabase.from("visitas").select("id", { count: "exact", head: true })
          .eq("empresa_id", e.id).gte("criado_em", inicioMes.toISOString())
          .then(({ count }) => [e.id, count ?? 0] as const),
      ),
    );
    const u: Record<string, Uso> = {};
    for (const e of lista) u[e.id] = { promotores: 0, visitasMes: 0 };
    perfis?.forEach((p) => p.empresa_id && u[p.empresa_id] && u[p.empresa_id].promotores++);
    contagens.forEach(([id, n]) => (u[id].visitasMes = n));
    setUso(u);
  }
  useEffect(() => { carregar(); }, []);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSalvando(true);
    setErro("");
    const dados = { nome: form.nome.trim(), pago_ate: form.pago_ate || null, ativa: form.ativa };
    const { error } = form.id
      ? await supabase.from("empresas").update(dados).eq("id", form.id)
      : await supabase.from("empresas").insert(dados);
    setSalvando(false);
    if (error) return setErro(mensagemErro(error));
    setForm(null);
    carregar();
  }

  if (!empresas) return <TelaCarregando />;
  const hoje = hojeISO();

  return (
    <div>
      <TituloPagina
        titulo="Clientes"
        sub="Empresas que assinam o sistema"
        acao={<Botao onClick={() => { setErro(""); setForm({ nome: "", pago_ate: hojeISO(30), ativa: true }); }}>+ Novo cliente</Botao>}
      />

      {!empresas.length ? (
        <Vazio titulo="Nenhum cliente ainda" texto="Cadastre o primeiro cliente e envie a ele o código de gestor." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {empresas.map((e) => {
            const vencido = e.pago_ate && e.pago_ate < hoje;
            return (
              <Cartao key={e.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-bold text-stone-900">{e.nome}</p>
                    <p className="text-sm text-stone-500">
                      {uso[e.id]?.promotores ?? "…"} promotores ativos · {uso[e.id]?.visitasMes ?? "…"} visitas no mês
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {e.ativa ? <Selo cor="verde">Ativa</Selo> : <Selo cor="vermelho">Bloqueada</Selo>}
                    {e.pago_ate && <Selo cor={vencido ? "vermelho" : "cinza"}>{vencido ? "Venceu" : "Pago até"} {fmtData(e.pago_ate + "T12:00:00")}</Selo>}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-stone-50 p-3 text-sm">
                  <div><p className="text-xs text-stone-500">Código do gestor</p><p className="font-mono font-bold tracking-wider">{e.codigo_gestor}</p></div>
                  <div><p className="text-xs text-stone-500">Código dos promotores</p><p className="font-mono font-bold tracking-wider">{e.codigo_promotor}</p></div>
                </div>
                <div className="mt-3 flex justify-end">
                  <Botao variante="secundario" onClick={() => { setErro(""); setForm({ id: e.id, nome: e.nome, pago_ate: e.pago_ate ?? "", ativa: e.ativa }); }}>Editar</Botao>
                </div>
              </Cartao>
            );
          })}
        </div>
      )}

      <Modal aberto={!!form} aoFechar={() => setForm(null)} titulo={form?.id ? "Editar cliente" : "Novo cliente"}>
        {form && (
          <form onSubmit={salvar} className="space-y-4">
            <Rotulo texto="Nome da empresa">
              <Entrada value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required autoFocus />
            </Rotulo>
            <Rotulo texto="Mensalidade paga até" dica="Só para seu controle. Para cortar o acesso, desmarque “Empresa ativa”.">
              <Entrada type="date" value={form.pago_ate} onChange={(e) => setForm({ ...form, pago_ate: e.target.value })} />
            </Rotulo>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" checked={form.ativa} onChange={(e) => setForm({ ...form, ativa: e.target.checked })} className="h-4 w-4 accent-marca-600" />
              Empresa ativa (desmarque para bloquear gestor e promotores)
            </label>
            {erro && <Aviso>{erro}</Aviso>}
            <div className="flex justify-end gap-2 pt-2">
              <Botao type="button" variante="fantasma" onClick={() => setForm(null)}>Cancelar</Botao>
              <Botao type="submit" carregando={salvando}>Salvar</Botao>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
