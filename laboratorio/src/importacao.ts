import { ErroDominio } from "./erros.js";
import type { Pessoa } from "./eventos.js";

export function importarCsv(texto: string): Pessoa[] {
  const [cabecalho, ...linhas] = texto.trim().split(/\r?\n/);
  if (cabecalho?.trim() !== "nome,email") {
    throw new ErroDominio("CSV_CABECALHO_INVALIDO", "Cabeçalho esperado: nome,email");
  }
  return linhas
    .filter((linha) => linha.trim() !== "")
    .map((linha) => {
      const [nome, email] = linha.split(",").map((campo) => campo.trim().replace(/^"|"$/g, ""));
      if (!nome || !email) {
        throw new ErroDominio("CSV_LINHA_INVALIDA", `Linha inválida: ${linha}`);
      }
      return { nome, email };
    });
}
