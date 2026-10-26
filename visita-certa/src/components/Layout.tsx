import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { cx } from "./ui";

export interface ItemMenu {
  para: string;
  rotulo: string;
  icone: JSX.Element;
}

export function Logo({ claro }: { claro?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <img src="/icon.svg" alt="" className="h-8 w-8" />
      <span className={cx("text-lg font-bold tracking-tight", claro ? "text-white" : "text-stone-900")}>Visita Certa</span>
    </div>
  );
}

export function Layout({ itens, inferiorNoCelular }: { itens: ItemMenu[]; inferiorNoCelular?: boolean }) {
  const { perfil, empresa, sair } = useAuth();
  return (
    <div className={cx("min-h-screen", inferiorNoCelular && "pb-24 sm:pb-0")}>
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Logo />
          <nav className={cx("hidden gap-1 sm:flex", !inferiorNoCelular && "!flex overflow-x-auto")}>
            {itens.map((i) => (
              <NavLink
                key={i.para}
                to={i.para}
                end
                className={({ isActive }) =>
                  cx(
                    "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition",
                    isActive ? "bg-marca-50 text-marca-700" : "text-stone-600 hover:bg-stone-100",
                  )
                }
              >
                <span className="hidden md:inline-flex">{i.icone}</span>
                {i.rotulo}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden text-right leading-tight lg:block">
              <p className="text-sm font-semibold text-stone-800">{perfil?.nome}</p>
              <p className="text-xs text-stone-500">{empresa?.nome ?? "Administração"}</p>
            </div>
            <button onClick={sair} className="rounded-lg px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100">
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>

      {inferiorNoCelular && (
        <nav className="fixed inset-x-0 bottom-0 z-30 grid border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden"
             style={{ gridTemplateColumns: `repeat(${itens.length}, 1fr)` }}>
          {itens.map((i) => (
            <NavLink
              key={i.para}
              to={i.para}
              end
              className={({ isActive }) =>
                cx("flex flex-col items-center gap-1 py-3 text-xs font-semibold", isActive ? "text-marca-700" : "text-stone-500")
              }
            >
              {i.icone}
              {i.rotulo}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}

const ic = "h-5 w-5";
const svg = (d: JSX.Element) => (
  <svg className={ic} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);

export const Icones = {
  camera: svg(<><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>),
  historico: svg(<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>),
  visitas: svg(<><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 9h8M8 13h8M8 17h5" /></>),
  loja: svg(<><path d="M4 9l1.5-4h13L20 9" /><path d="M5 9v10h14V9" /><path d="M4 9h16" /><path d="M10 19v-5h4v5" /></>),
  pergunta: svg(<><path d="M9 9a3 3 0 1 1 4.2 2.7c-.8.4-1.2 1-1.2 1.8V14" /><circle cx="12" cy="17.5" r=".6" fill="currentColor" /><circle cx="12" cy="12" r="9" /></>),
  pessoas: svg(<><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8" /><path d="M16 5.5a3 3 0 0 1 0 5.6M17.5 14.6c1.6.6 2.7 2.1 3 4.4" /></>),
  empresa: svg(<><path d="M4 20V6l8-3 8 3v14" /><path d="M9 20v-4h6v4M8 9h.01M12 9h.01M16 9h.01M8 13h.01M12 13h.01M16 13h.01" /></>),
};
