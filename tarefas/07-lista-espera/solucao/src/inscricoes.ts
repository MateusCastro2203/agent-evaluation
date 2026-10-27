import { registrarAuditoria } from "./auditoria.js";
import { ErroDominio } from "./erros.js";
import { inscricoes, listaEspera, obterEvento, type Inscricao, type Pessoa } from "./eventos.js";
import { relogio } from "./relogio.js";

export { resetarDados } from "./eventos.js";

/** Inscreve a pessoa; com o evento lotado, ela vai para a lista de espera e o retorno é `null`. */
export function inscrever(eventoId: number, pessoa: Pessoa): Inscricao | null {
  const evento = obterEvento(eventoId);
  const doEvento = inscricoes.filter((i) => i.eventoId === eventoId);
  const jaEsta = [...doEvento.map((i) => i.pessoa), ...listaDeEspera(eventoId)];
  if (jaEsta.some((p) => p.email === pessoa.email)) {
    throw new ErroDominio("INSCRICAO_DUPLICADA", `${pessoa.email} já inscrito`);
  }
  if (doEvento.length >= evento.capacidade) {
    listaEspera.push({ eventoId, pessoa });
    registrarAuditoria("inscricao.lista_espera", { eventoId, email: pessoa.email });
    return null;
  }
  const inscricao = { eventoId, pessoa, criadaEm: relogio.agora() };
  inscricoes.push(inscricao);
  registrarAuditoria("inscricao.criada", { eventoId, email: pessoa.email });
  return inscricao;
}

export function listaDeEspera(eventoId: number): Pessoa[] {
  return listaEspera.filter((e) => e.eventoId === eventoId).map((e) => e.pessoa);
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
