import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigurado = Boolean(url && chave);

export const supabase = createClient(
  url ?? "https://exemplo.supabase.co",
  chave ?? "chave-nao-configurada",
  { auth: { persistSession: true, autoRefreshToken: true } },
);

/** Converte erros do Supabase em mensagens legíveis. */
export function mensagemErro(erro: unknown): string {
  const msg =
    typeof erro === "object" && erro && "message" in erro
      ? String((erro as { message: unknown }).message)
      : String(erro);
  if (msg.includes("Invalid login credentials")) return "E-mail ou senha incorretos.";
  if (msg.includes("User already registered")) return "Este e-mail já tem cadastro. Faça login.";
  if (msg.includes("Password should be")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (msg.includes("Email not confirmed")) return "Confirme seu e-mail antes de entrar (veja sua caixa de entrada).";
  if (msg.includes("Database error saving new user")) return "Código de acesso inválido.";
  if (msg.includes("Failed to fetch")) return "Sem conexão com a internet. Tente de novo.";
  return msg;
}
