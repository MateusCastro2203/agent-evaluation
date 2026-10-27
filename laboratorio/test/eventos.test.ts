import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErroDominio } from "../src/erros.js";
import { criarEvento, obterEvento, resetarDados } from "../src/eventos.js";
import { relogio } from "../src/relogio.js";
import { formatarCentavos } from "../src/dinheiro.js";

const HOJE = new Date("2026-03-01T12:00:00Z");
const DEPOIS = new Date("2026-04-01T19:00:00Z");

beforeEach(() => {
  resetarDados();
  vi.spyOn(relogio, "agora").mockReturnValue(HOJE);
});

describe("eventos", () => {
  it("cria e obtém evento", () => {
    const e = criarEvento({ nome: "Meetup TS", data: DEPOIS, capacidade: 10, preco: 2500 });
    expect(obterEvento(e.id).nome).toBe("Meetup TS");
  });

  it("rejeita evento no passado", () => {
    expect(() =>
      criarEvento({ nome: "Velho", data: new Date("2026-01-01"), capacidade: 5, preco: 0 }),
    ).toThrowError(ErroDominio);
  });

  it("evento inexistente lança ErroDominio", () => {
    expect(() => obterEvento(99)).toThrowError(/não existe/);
  });

  it("formata centavos", () => {
    expect(formatarCentavos(2505)).toBe("R$ 25,05");
  });
});
