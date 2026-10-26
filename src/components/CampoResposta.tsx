import type { Pergunta } from "@/lib/tipos";
import { AreaTexto, Entrada, cx } from "./ui";

/** Campo certo para cada tipo de pergunta (Sim/Não, texto, número, data, lista). */
export function CampoResposta({ pergunta, valor, aoMudar }: {
  pergunta: Pergunta;
  valor: string;
  aoMudar: (v: string) => void;
}) {
  const botao = (ativo: boolean, cor = "marca") =>
    cx(
      "rounded-xl border px-3 py-2.5 text-sm font-semibold transition",
      ativo
        ? cor === "vermelho" ? "border-red-600 bg-red-600 text-white" : "border-marca-600 bg-marca-600 text-white"
        : "border-stone-300 bg-white text-stone-700 hover:border-stone-400",
    );

  switch (pergunta.tipo) {
    case "sim_nao":
      return (
        <div className="grid grid-cols-2 gap-2">
          {["Sim", "Não"].map((op) => (
            <button key={op} type="button" onClick={() => aoMudar(valor === op ? "" : op)}
                    className={botao(valor === op, op === "Não" ? "vermelho" : "marca")}>
              {op}
            </button>
          ))}
        </div>
      );
    case "lista": {
      const opcoes = pergunta.opcoes ?? [];
      if (opcoes.length > 15) {
        return (
          <select value={valor} onChange={(e) => aoMudar(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-[15px] focus:border-marca-500 focus:outline-none focus:ring-2 focus:ring-marca-500/20">
            <option value="">Escolha…</option>
            {opcoes.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        );
      }
      return (
        <div className="flex flex-wrap gap-2">
          {opcoes.map((o) => (
            <button key={o} type="button" onClick={() => aoMudar(valor === o ? "" : o)} className={botao(valor === o)}>
              {o}
            </button>
          ))}
        </div>
      );
    }
    case "numero":
      return (
        <Entrada type="text" inputMode="decimal" value={valor} placeholder="0"
                 onChange={(e) => aoMudar(e.target.value.replace(/[^\d,.-]/g, ""))} />
      );
    case "data":
      return <Entrada type="date" value={valor} onChange={(e) => aoMudar(e.target.value)} />;
    default:
      return <AreaTexto className="min-h-[52px]" rows={2} value={valor} onChange={(e) => aoMudar(e.target.value)} />;
  }
}

export const nomesTipo: Record<Pergunta["tipo"], string> = {
  texto: "Texto livre",
  numero: "Número",
  data: "Data",
  lista: "Lista de opções",
  sim_nao: "Sim / Não",
};
