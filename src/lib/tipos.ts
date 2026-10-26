export type Papel = "admin" | "gestor" | "promotor";

export interface Empresa {
  id: string;
  nome: string;
  ativa: boolean;
  pago_ate: string | null;
  codigo_gestor: string;
  codigo_promotor: string;
  criado_em: string;
}

export interface Perfil {
  id: string;
  empresa_id: string | null;
  nome: string;
  email: string | null;
  papel: Papel;
  ativo: boolean;
  criado_em: string;
}

export interface Loja {
  id: string;
  empresa_id: string;
  nome: string;
  endereco: string | null;
  latitude: number;
  longitude: number;
  raio_m: number;
  ativa: boolean;
}

export type TipoPergunta = "sim_nao" | "texto" | "numero";

export interface Pergunta {
  id: string;
  empresa_id: string;
  texto: string;
  tipo: TipoPergunta;
  obrigatoria: boolean;
  ordem: number;
  ativa: boolean;
}

export interface Visita {
  id: string;
  empresa_id: string;
  promotor_id: string;
  loja_id: string;
  criado_em: string;
  latitude: number;
  longitude: number;
  precisao_m: number | null;
  distancia_m: number;
  na_loja: boolean;
  observacao: string | null;
}

export interface VisitaCompleta extends Visita {
  loja: Pick<Loja, "nome" | "endereco" | "latitude" | "longitude" | "raio_m"> | null;
  promotor: Pick<Perfil, "nome" | "email"> | null;
  visita_fotos: { id: string; caminho: string }[];
  visita_respostas: { id: string; pergunta_texto: string; resposta: string | null }[];
}
