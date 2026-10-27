import { registrarAuditoria } from "./auditoria.js";
import { ErroDominio } from "./erros.js";
import { inscricoes, obterEvento, type Inscricao, type Pessoa } from "./eventos.js";
import { relogio } from "./relogio.js";

export { resetarDados } from "./eventos.js";

export type Cupom = { percentual: number };

export function inscrever(eventoId: number, pessoa: Pessoa, cupom?: Cupom): Inscricao {
  const evento = obterEvento(eventoId);
  const doEvento = inscricoes.filter((i) => i.eventoId === eventoId);
  if (doEvento.some((i) => i.pessoa.email === pessoa.email)) {
    throw new ErroDominio("INSCRICAO_DUPLICADA", `${pessoa.email} já inscrito`);
  }
  const percentual = cupom?.percentual ?? 0;
  if (percentual < 0 || percentual > 100) {
    throw new ErroDominio("CUPOM_INVALIDO", "Percentual do cupom deve estar entre 0 e 100");
  }
  const valorPago = Math.floor((evento.preco * (100 - percentual)) / 100);
  const inscricao = { eventoId, pessoa, criadaEm: relogio.agora(), valorPago };
  inscricoes.push(inscricao);
  registrarAuditoria("inscricao.criada", { eventoId, email: pessoa.email });
  return inscricao;
}

export function cancelarInscricao(eventoId: number, email: string): void {
  const indice = inscricoes.findIndex(
    (i) => i.eventoId === eventoId && i.pessoa.email === email,
  );
  if (indice === -1) {
    throw new ErroDominio("INSCRICAO_NAO_ENCONTRADA", `${email} não está inscrito`);
  }
  inscricoes.splice(indice, 1);
  registrarAuditoria("inscricao.cancelada", { eventoId, email });
}
