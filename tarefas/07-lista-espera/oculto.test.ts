import { beforeEach, expect, it, vi } from "vitest";
import { lerAuditoria } from "../src/auditoria.js";
import { criarEvento, inscricoes, resetarDados } from "../src/eventos.js";
import { inscrever, listaDeEspera } from "../src/inscricoes.js";
import { relogio } from "../src/relogio.js";

const ana = { nome: "Ana", email: "ana@exemplo.com" };
const bia = { nome: "Bia", email: "bia@exemplo.com" };
const caio = { nome: "Caio", email: "caio@exemplo.com" };

beforeEach(() => {
  resetarDados();
  vi.spyOn(relogio, "agora").mockReturnValue(new Date("2099-01-01T12:00:00Z"));
});

// Quem vai para a lista de espera pode ou não receber um aviso por exceção: o teste não depende disso.
function inscreverOuEsperar(eventoId: number, pessoa: { nome: string; email: string }) {
  try {
    inscrever(eventoId, pessoa);
  } catch {
    // ignorado de propósito
  }
}

function evento(capacidade: number) {
  return criarEvento({ nome: "Meetup", data: new Date("2099-02-01T19:00:00Z"), capacidade, preco: 0 });
}

it("quem chega com o evento lotado vai para a lista de espera, em ordem", () => {
  const e = evento(1);
  const outro = evento(1);
  inscrever(e.id, ana);
  expect(listaDeEspera(e.id)).toEqual([]);
  inscreverOuEsperar(e.id, bia);
  inscreverOuEsperar(e.id, caio);
  expect(listaDeEspera(e.id)).toEqual([bia, caio]);
  expect(inscricoes.filter((i) => i.eventoId === e.id)).toHaveLength(1);
  expect(listaDeEspera(outro.id)).toEqual([]);
});

it("entrar na lista de espera fica registrado na auditoria", () => {
  const e = evento(1);
  inscrever(e.id, ana);
  inscreverOuEsperar(e.id, bia);
  const novas = lerAuditoria().slice(1);
  expect(novas.some((r) => /espera/i.test(r.acao))).toBe(true);
});
