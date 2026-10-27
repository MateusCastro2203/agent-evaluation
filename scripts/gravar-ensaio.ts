// Grava o último run como ensaio: copia resultados/ultimo.json para resultados/ensaio/resultado.json
// sem caminhos pessoais e gera o relatório. Uso: pnpm ensaio:gravar
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { sanitizarCaminhos } from "../src/sanitizar.js";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destino = join(raiz, "resultados", "ensaio", "resultado.json");
mkdirSync(dirname(destino), { recursive: true });
writeFileSync(destino, sanitizarCaminhos(readFileSync(join(raiz, "resultados", "ultimo.json"), "utf8"), raiz));
console.log(`gravado: resultados/ensaio/resultado.json`);
process.exit(spawnSync("pnpm", ["relatorio:ensaio"], { cwd: raiz, stdio: "inherit" }).status ?? 1);
