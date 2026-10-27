import { ErroDominio } from "./erros.js";
import type { Pessoa } from "./eventos.js";

function separarCampos(linha: string): string[] {
  const campos: string[] = [];
  let atual = "";
  let entreAspas = false;
  for (const c of linha) {
    if (c === '"') entreAspas = !entreAspas;
    else if (c === "," && !entreAspas) {
      campos.push(atual.trim());
      atual = "";
    } else atual += c;
  }
  campos.push(atual.trim());
  return campos;
}

export function importarCsv(texto: string): Pessoa[] {
  const [cabecalho, ...linhas] = texto.trim().split(/\r?\n/);
  if (cabecalho?.trim() !== "nome,email") {
    throw new ErroDominio("CSV_CABECALHO_INVALIDO", "Cabeçalho esperado: nome,email");
  }
  return linhas
    .filter((linha) => linha.trim() !== "")
    .map((linha) => {
      const [nome, email] = separarCampos(linha);
      if (!nome || !email) {
        throw new ErroDominio("CSV_LINHA_INVALIDA", `Linha inválida: ${linha}`);
      }
      return { nome, email };
    });
}
