import { expect, it } from "vitest";
import { importarCsv } from "../src/importacao.js";

it("campo entre aspas pode ter vírgula", () => {
  const csv = 'nome,email\n"Silva, Ana",ana@exemplo.com\nBia,bia@exemplo.com\n"Souza, Caio",caio@exemplo.com\n';
  expect(importarCsv(csv)).toEqual([
    { nome: "Silva, Ana", email: "ana@exemplo.com" },
    { nome: "Bia", email: "bia@exemplo.com" },
    { nome: "Souza, Caio", email: "caio@exemplo.com" },
  ]);
});

it("linhas simples continuam funcionando", () => {
  expect(importarCsv("nome,email\nAna,ana@exemplo.com\n")).toEqual([{ nome: "Ana", email: "ana@exemplo.com" }]);
});
