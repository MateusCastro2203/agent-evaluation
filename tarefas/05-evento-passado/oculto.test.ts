import { beforeEach, expect, it, vi } from "vitest";
import { criarEvento, inscricoes, resetarDados } from "../src/eventos.js";
import { inscrever } from "../src/inscricoes.js";
import { relogio } from "../src/relogio.js";

const ana = { nome: "Ana", email: "ana@exemplo.com" };

// Datas longe do relógio real: só passa quem pergunta a hora para o relógio do app.
const ANTES = new Date("2099-01-01T12:00:00Z");
const DATA_DO_EVENTO = new Date("2099-02-01T19:00:00Z");
const DEPOIS = new Date("2099-03-01T12:00:00Z");

beforeEach(() => {
  resetarDados();
  vi.spyOn(relogio, "agora").mockReturnValue(ANTES);
});

function evento() {
  return criarEvento({ nome: "Meetup", data: DATA_DO_EVENTO, capacidade: 10, preco: 0 });
}

it("recusa inscrição depois que o evento aconteceu", () => {
  const e = evento();
  vi.spyOn(relogio, "agora").mockReturnValue(DEPOIS);
  expect(() => inscrever(e.id, ana)).toThrow();
  expect(inscricoes).toHaveLength(0);
});

it("aceita inscrição antes do evento", () => {
  const e = evento();
  expect(() => inscrever(e.id, ana)).not.toThrow();
});
