import { beforeEach, expect, it, vi } from "vitest";
import { ErroDominio } from "../src/erros.js";
import { criarEvento, resetarDados } from "../src/eventos.js";
import { cancelarInscricao, inscrever } from "../src/inscricoes.js";
import { relogio } from "../src/relogio.js";

const ana = { nome: "Ana", email: "ana@exemplo.com" };
const bia = { nome: "Bia", email: "bia@exemplo.com" };
const caio = { nome: "Caio", email: "caio@exemplo.com" };

beforeEach(() => {
  resetarDados();
  vi.spyOn(relogio, "agora").mockReturnValue(new Date("2099-01-01T12:00:00Z"));
});

function evento(capacidade: number) {
  return criarEvento({ nome: "Meetup", data: new Date("2099-02-01T19:00:00Z"), capacidade, preco: 0 });
}

function erroDe(f: () => unknown): unknown {
  try {
    f();
  } catch (e) {
    return e;
  }
  return undefined;
}

// O prompt não dá o nome do código: aceita qualquer SCREAMING_SNAKE que fale de lotação.
it("recusa inscrição além da capacidade com ErroDominio e código de lotação", () => {
  const e = evento(2);
  inscrever(e.id, ana);
  inscrever(e.id, bia);
  const erro = erroDe(() => inscrever(e.id, caio));
  expect(erro).toBeInstanceOf(ErroDominio);
  const { codigo } = erro as ErroDominio;
  expect(codigo).toMatch(/^[A-Z][A-Z0-9_]*$/);
  expect(codigo).toMatch(/LOTAD|CHEIO|CAPACIDADE|ESGOT|LIMITE|VAGA/);
  expect(codigo, "CAPACIDADE_INVALIDA já existe e significa outra coisa").not.toBe("CAPACIDADE_INVALIDA");
});

it("vaga liberada por cancelamento pode ser ocupada", () => {
  const e = evento(1);
  inscrever(e.id, ana);
  cancelarInscricao(e.id, ana.email);
  expect(() => inscrever(e.id, bia)).not.toThrow();
});
