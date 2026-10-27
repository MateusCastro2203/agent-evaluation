// Lê a saída do promptfoo, imprime a tabela A × B e escreve relatorio.html ao lado do JSON.
// Uso: pnpm relatorio [arquivo]   (padrão: resultados/ultimo.json)
// Sai com código 1 só quando A é claramente melhor que B (o portão do CI).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { analisarSaida, codigoDeSaida, gerarHtml, tabelaTerminal } from "../src/relatorio.js";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const entrada = resolve(process.argv[2] ?? join(raiz, "resultados", "ultimo.json"));

let saida: unknown;
try {
  saida = JSON.parse(readFileSync(entrada, "utf8"));
} catch (e) {
  console.error(`Não consegui ler ${entrada}: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(2);
}

const analise = analisarSaida(saida);
const destino = join(dirname(entrada), "relatorio.html");
mkdirSync(dirname(destino), { recursive: true });
writeFileSync(destino, gerarHtml(analise, { origem: `${basename(dirname(entrada))}/${basename(entrada)}`, geradoEm: new Date().toISOString() }));

console.log(tabelaTerminal(analise));
console.log(`\nrelatório: ${destino}`);
process.exit(codigoDeSaida(analise.veredito));
