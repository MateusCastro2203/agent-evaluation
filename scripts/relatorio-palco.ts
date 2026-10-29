// Prepara resultados/relatorio.html, o arquivo que o slide do relatório ao vivo mostra.
// Uso: pnpm relatorio:aguardando   (antes da palestra: página "o run ainda está rodando")
//      pnpm relatorio:planob       (o run ao vivo falhou: mostra o relatório do ensaio)
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destino = join(raiz, "resultados", "relatorio.html");
mkdirSync(dirname(destino), { recursive: true });

if (process.argv[2] === "planob") {
  copyFileSync(join(raiz, "resultados", "ensaio", "relatorio.html"), destino);
  console.log(`relatório do ensaio copiado para ${destino}`);
} else {
  writeFileSync(
    destino,
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Aguardando o run</title>
<style>body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#fbfaf7;color:#1b1f2a;font:600 40px -apple-system,"Segoe UI",Helvetica,Arial,sans-serif;text-align:center}small{display:block;margin-top:16px;font-size:24px;font-weight:400;color:#5b6272}</style>
</head><body><div>O agente ainda está trabalhando…<small>O relatório aparece aqui quando o <code>pnpm eval</code> terminar.</small></div></body></html>\n`,
  );
  console.log(`página de espera gravada em ${destino}`);
}
