import { obterEvento, inscricoes } from "../eventos.js";

export type LinhaInscrito = { evento: string; nome: string; email: string };

export function relatorioDeInscritos(): LinhaInscrito[] {
  return inscricoes.map((i) => ({
    evento: obterEvento(i.eventoId).nome,
    nome: i.pessoa.nome,
    email: i.pessoa.email,
  }));
}
