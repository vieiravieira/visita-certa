import { useEffect, useState, type FormEvent } from "react";
import { supabase, mensagemErro } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { Pergunta, TipoPergunta } from "@/lib/tipos";
import { Aviso, Botao, Cartao, Entrada, Modal, Rotulo, Selecao, Selo, TelaCarregando, TituloPagina, Vazio } from "@/components/ui";

const tipos: Record<TipoPergunta, string> = { sim_nao: "Sim / Não", texto: "Texto livre", numero: "Número" };
const sugestoes = [
  "A gôndola está abastecida?",
  "Os preços estão corretos e visíveis?",
  "Há ruptura (produto em falta)?",
  "Material de ponto de venda está exposto?",
  "Quantas frentes o produto ocupa?",
];

interface Form { id?: string; texto: string; tipo: TipoPergunta; obrigatoria: boolean; ativa: boolean }

export default function Perguntas() {
  const { empresa } = useAuth();
  const [lista, setLista] = useState<Pergunta[] | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = () =>
    supabase.from("perguntas").select("*").order("ordem").order("criado_em").then(({ data }) => setLista((data as Pergunta[]) ?? []));
  useEffect(() => { carregar(); }, []);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!form || !empresa || !lista) return;
    setSalvando(true);
    setErro("");
    const dados = { texto: form.texto.trim(), tipo: form.tipo, obrigatoria: form.obrigatoria, ativa: form.ativa };
    const { error } = form.id
      ? await supabase.from("perguntas").update(dados).eq("id", form.id)
      : await supabase.from("perguntas").insert({ ...dados, empresa_id: empresa.id, ordem: (lista.at(-1)?.ordem ?? 0) + 1 });
    setSalvando(false);
    if (error) return setErro(mensagemErro(error));
    setForm(null);
    carregar();
  }

  async function mover(i: number, dir: -1 | 1) {
    if (!lista) return;
    const j = i + dir;
    if (j < 0 || j >= lista.length) return;
    const nova = [...lista];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    setLista(nova);
    await Promise.all(nova.map((p, idx) => supabase.from("perguntas").update({ ordem: idx + 1 }).eq("id", p.id)));
  }

  async function excluir(p: Pergunta) {
    if (!confirm(`Excluir a pergunta “${p.texto}”? As respostas antigas continuam no histórico.`)) return;
    await supabase.from("perguntas").delete().eq("id", p.id);
    setForm(null);
    carregar();
  }

  if (!lista) return <TelaCarregando />;

  return (
    <div className="max-w-3xl">
      <TituloPagina
        titulo="Checklist"
        sub="Perguntas que o promotor responde em cada visita"
        acao={<Botao onClick={() => { setErro(""); setForm({ texto: "", tipo: "sim_nao", obrigatoria: true, ativa: true }); }}>+ Nova pergunta</Botao>}
      />

      {!lista.length ? (
        <>
          <Vazio titulo="Nenhuma pergunta ainda" texto="Comece com uma destas sugestões:" />
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {sugestoes.map((s) => (
              <button key={s} onClick={() => setForm({ texto: s, tipo: s.startsWith("Quantas") ? "numero" : "sim_nao", obrigatoria: true, ativa: true })}
                      className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:border-marca-500">
                + {s}
              </button>
            ))}
          </div>
        </>
      ) : (
        <Cartao className="divide-y divide-stone-100">
          {lista.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex flex-col">
                <button onClick={() => mover(i, -1)} disabled={i === 0} className="px-1 text-stone-400 hover:text-stone-800 disabled:opacity-20" aria-label="Subir">▲</button>
                <button onClick={() => mover(i, 1)} disabled={i === lista.length - 1} className="px-1 text-stone-400 hover:text-stone-800 disabled:opacity-20" aria-label="Descer">▼</button>
              </div>
              <div className="min-w-0 flex-1">
                <p className={p.ativa ? "font-medium text-stone-900" : "font-medium text-stone-400 line-through"}>{p.texto}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Selo cor="azul">{tipos[p.tipo]}</Selo>
                  {p.obrigatoria && <Selo>Obrigatória</Selo>}
                  {!p.ativa && <Selo cor="amarelo">Desativada</Selo>}
                </div>
              </div>
              <Botao variante="fantasma" onClick={() => { setErro(""); setForm({ id: p.id, texto: p.texto, tipo: p.tipo, obrigatoria: p.obrigatoria, ativa: p.ativa }); }}>
                Editar
              </Botao>
            </div>
          ))}
        </Cartao>
      )}

      <Modal aberto={!!form} aoFechar={() => setForm(null)} titulo={form?.id ? "Editar pergunta" : "Nova pergunta"}>
        {form && (
          <form onSubmit={salvar} className="space-y-4">
            <Rotulo texto="Pergunta">
              <Entrada value={form.texto} onChange={(e) => setForm({ ...form, texto: e.target.value })} required autoFocus />
            </Rotulo>
            <Rotulo texto="Tipo de resposta">
              <Selecao value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoPergunta })}>
                {Object.entries(tipos).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </Selecao>
            </Rotulo>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" checked={form.obrigatoria} onChange={(e) => setForm({ ...form, obrigatoria: e.target.checked })} className="h-4 w-4 accent-marca-600" />
              Resposta obrigatória
            </label>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" checked={form.ativa} onChange={(e) => setForm({ ...form, ativa: e.target.checked })} className="h-4 w-4 accent-marca-600" />
              Ativa (aparece para os promotores)
            </label>
            {erro && <Aviso>{erro}</Aviso>}
            <div className="flex items-center justify-between gap-2 pt-2">
              {form.id ? <Botao type="button" variante="perigo" onClick={() => excluir(lista.find((x) => x.id === form.id)!)}>Excluir</Botao> : <span />}
              <div className="flex gap-2">
                <Botao type="button" variante="fantasma" onClick={() => setForm(null)}>Cancelar</Botao>
                <Botao type="submit" carregando={salvando}>Salvar</Botao>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
