import { beforeEach, describe, expect, it, vi } from "vitest";
import { lerAuditoria } from "../src/auditoria.js";
import { criarEvento, resetarDados } from "../src/eventos.js";
import { cancelarInscricao, inscrever } from "../src/inscricoes.js";
import { importarCsv } from "../src/importacao.js";
import { relogio } from "../src/relogio.js";
import { gerarRelatorio } from "../src/legado/relatorio.js";

const ana = { nome: "Ana", email: "ana@exemplo.com" };
const bia = { nome: "Bia", email: "bia@exemplo.com" };

beforeEach(() => {
  resetarDados();
  vi.spyOn(relogio, "agora").mockReturnValue(new Date("2026-03-01T12:00:00Z"));
});

function novoEvento(capacidade = 1) {
  return criarEvento({ nome: "Meetup", data: new Date("2026-04-01T19:00:00Z"), capacidade, preco: 1000 });
}

describe("inscrições", () => {
  it("inscreve e audita", () => {
    const e = novoEvento();
    inscrever(e.id, ana);
    expect(lerAuditoria()).toEqual([
      { acao: "inscricao.criada", dados: { eventoId: e.id, email: ana.email } },
    ]);
  });

  it("recusa inscrição duplicada", () => {
    const e = novoEvento();
    inscrever(e.id, ana);
    expect(() => inscrever(e.id, ana)).toThrowError(/já inscrito/);
  });

  it("cancela e audita", () => {
    const e = novoEvento();
    inscrever(e.id, ana);
    cancelarInscricao(e.id, ana.email);
    expect(lerAuditoria().map((r) => r.acao)).toEqual(["inscricao.criada", "inscricao.cancelada"]);
    expect(() => inscrever(e.id, ana)).not.toThrow();
  });
});

describe("importação e relatório", () => {
  it("importa CSV simples", () => {
    expect(importarCsv("nome,email\nAna,ana@exemplo.com\nBia,bia@exemplo.com\n")).toEqual([ana, bia]);
  });

  it("relatório soma receita", () => {
    const e = novoEvento(5);
    inscrever(e.id, ana);
    expect(gerarRelatorio().linhas).toEqual([{ evento: "Meetup", inscritos: 1, receita: "10.00" }]);
  });
});
