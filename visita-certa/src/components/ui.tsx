import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type Variante = "primario" | "secundario" | "perigo" | "fantasma";

export function Botao({
  variante = "primario", carregando, className, children, disabled, ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; carregando?: boolean }) {
  const estilos: Record<Variante, string> = {
    primario: "bg-marca-600 text-white hover:bg-marca-700 active:bg-marca-800 shadow-sm",
    secundario: "bg-white text-stone-800 border border-stone-300 hover:bg-stone-50",
    perigo: "bg-white text-red-700 border border-red-200 hover:bg-red-50",
    fantasma: "text-stone-600 hover:bg-stone-100",
  };
  return (
    <button
      {...props}
      disabled={disabled || carregando}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
        "disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-marca-500 focus-visible:ring-offset-2",
        estilos[variante], className,
      )}
    >
      {carregando && <Girando className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function Rotulo({ texto, children, dica }: { texto: string; children: ReactNode; dica?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-stone-700">{texto}</span>
      {children}
      {dica && <span className="mt-1 block text-xs text-stone-500">{dica}</span>}
    </label>
  );
}

const campoBase =
  "w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-[15px] text-stone-900 placeholder:text-stone-400 " +
  "focus:border-marca-500 focus:outline-none focus:ring-2 focus:ring-marca-500/20 disabled:bg-stone-100";

export const Entrada = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => (
  <input {...p} className={cx(campoBase, className)} />
);
export const Selecao = ({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...p} className={cx(campoBase, "pr-8", className)} />
);
export const AreaTexto = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...p} className={cx(campoBase, "min-h-[88px]", className)} />
);

export function Cartao({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-2xl border border-stone-200 bg-white shadow-sm", className)}>{children}</div>;
}

export function Selo({ cor = "cinza", children }: { cor?: "verde" | "vermelho" | "amarelo" | "cinza" | "azul"; children: ReactNode }) {
  const cores = {
    verde: "bg-marca-50 text-marca-700 ring-marca-200",
    vermelho: "bg-red-50 text-red-700 ring-red-200",
    amarelo: "bg-amber-50 text-amber-800 ring-amber-200",
    cinza: "bg-stone-100 text-stone-700 ring-stone-200",
    azul: "bg-sky-50 text-sky-800 ring-sky-200",
  };
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", cores[cor])}>
      {children}
    </span>
  );
}

export function Aviso({ tipo = "erro", children }: { tipo?: "erro" | "sucesso" | "info"; children: ReactNode }) {
  const t = {
    erro: "border-red-200 bg-red-50 text-red-800",
    sucesso: "border-marca-200 bg-marca-50 text-marca-800",
    info: "border-sky-200 bg-sky-50 text-sky-900",
  };
  return <div role="alert" className={cx("rounded-xl border px-4 py-3 text-sm", t[tipo])}>{children}</div>;
}

export function Girando({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={cx("animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity=".25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function TelaCarregando() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-marca-600">
      <Girando className="h-8 w-8" />
    </div>
  );
}

export function Vazio({ titulo, texto }: { titulo: string; texto?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 px-6 py-10 text-center">
      <p className="font-semibold text-stone-800">{titulo}</p>
      {texto && <p className="mt-1 text-sm text-stone-500">{texto}</p>}
    </div>
  );
}

export function Modal({ aberto, aoFechar, titulo, children, largo }: {
  aberto: boolean; aoFechar: () => void; titulo: string; children: ReactNode; largo?: boolean;
}) {
  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
  }, [aberto, aoFechar]);
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/50 sm:items-center sm:p-4" onClick={aoFechar}>
      <div
        role="dialog" aria-modal="true" aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        className={cx("max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-xl sm:rounded-3xl", largo ? "sm:max-w-3xl" : "sm:max-w-lg")}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-100 bg-white px-5 py-4">
          <h2 className="text-base font-bold text-stone-900">{titulo}</h2>
          <button onClick={aoFechar} className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100" aria-label="Fechar">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function TituloPagina({ titulo, sub, acao }: { titulo: string; sub?: string; acao?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">{titulo}</h1>
        {sub && <p className="mt-0.5 text-sm text-stone-500">{sub}</p>}
      </div>
      {acao}
    </div>
  );
}

export { cx };
