import { limparAuditoria } from "./auditoria.js";
import type { Centavos } from "./dinheiro.js";
import { ErroDominio } from "./erros.js";
import { relogio } from "./relogio.js";

export type Evento = {
  id: number;
  nome: string;
  data: Date;
  capacidade: number;
  preco: Centavos;
};

export type Pessoa = { nome: string; email: string };

export type Inscricao = {
  eventoId: number;
  pessoa: Pessoa;
  criadaEm: Date;
};

export const eventos: Evento[] = [];
export const inscricoes: Inscricao[] = [];
let proximoId = 1;

export function resetarDados(): void {
  eventos.length = 0;
  inscricoes.length = 0;
  proximoId = 1;
  limparAuditoria();
}

export function criarEvento(dados: Omit<Evento, "id">): Evento {
  if (dados.capacidade <= 0) {
    throw new ErroDominio("CAPACIDADE_INVALIDA", "Capacidade deve ser positiva");
  }
  if (dados.data.getTime() <= relogio.agora().getTime()) {
    throw new ErroDominio("EVENTO_NO_PASSADO", "Evento deve ser no futuro");
  }
  const evento = { id: proximoId++, ...dados };
  eventos.push(evento);
  return evento;
}

export function obterEvento(id: number): Evento {
  const evento = eventos.find((e) => e.id === id);
  if (!evento) {
    throw new ErroDominio("EVENTO_NAO_ENCONTRADO", `Evento ${id} não existe`);
  }
  return evento;
}

export function listarProximos(limite: number): Evento[] {
  const agora = relogio.agora().getTime();
  return eventos
    .filter((e) => e.data.getTime() > agora)
    .sort((a, b) => a.data.getTime() - b.data.getTime())
    .slice(0, limite);
}
