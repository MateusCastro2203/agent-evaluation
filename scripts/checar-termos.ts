// Procura termos que não podem ser publicados (nomes internos, chaves de ticket, caminhos pessoais)
// em tudo o que iria para o repositório público: os arquivos de texto e o texto dos PDFs e PPTX.
// Uso: pnpm checar-termos   (TERMOS_ARQUIVO = lista, um termo por linha; padrão ../.termos-internos.txt)
// A lista fica FORA do projeto e nunca é commitada. Sai com 1 listando arquivo:linha se achar algo,
// com 2 se não conseguir ler a lista ou se algum PDF/PPTX não puder ser lido (sem pdftotext/unzip, o
// texto dele não foi checado). CHECAR_SEM_PDF=1 aceita pular esses arquivos (avisa e sai com 0).
// Palavras liberadas (LIBERADAS): uma ocorrência de termo só é ignorada quando cabe inteira dentro de
// uma delas; um termo que contém a palavra liberada, ou vai além dela, continua sendo achado.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { codigoDaChecagem, termosNaLinha } from "../src/termos.js";

const RAIZ = resolve(import.meta.dirname, "..");
const ARQUIVO_TERMOS = resolve(RAIZ, process.env.TERMOS_ARQUIVO ?? "../.termos-internos.txt");

/** Palavras liberadas por nome, mesmo que um termo case com parte delas. */
const LIBERADAS = ["Creditas", "KTLO"];

/**
 * Falsos positivos conhecidos, por arquivo: trechos apagados da linha antes de procurar. No lockfile,
 * nomes de pacote com escopo do npm (`@escopo/nome`): são pacotes públicos, dependências de
 * dependências (o promptfoo traz vários SDKs de observabilidade), não nomes internos.
 */
const FALSOS_POSITIVOS: Record<string, RegExp[]> = {
  "pnpm-lock.yaml": [/@[a-z0-9-]+\/[a-z0-9._-]+/gi],
};

/** Pastas que não vão para o repo (deps e caches), caso a lista venha do disco e não do git. */
const PULAR = new Set(["node_modules", ".git", ".lab-deps", ".corretor-deps", ".vitest", ".promptfoo"]);

function lerTermos(): string[] {
  let texto: string;
  try {
    texto = readFileSync(ARQUIVO_TERMOS, "utf8");
  } catch {
    console.error(`Não achei a lista de termos em ${ARQUIVO_TERMOS} (defina TERMOS_ARQUIVO).`);
    process.exit(2);
  }
  const termos = texto
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  if (termos.length === 0) {
    console.error(`A lista ${ARQUIVO_TERMOS} está vazia.`);
    process.exit(2);
  }
  return termos;
}

/** O que iria para o repo: arquivos rastreados + novos não ignorados (git); sem git, a árvore inteira. */
function listarArquivos(): string[] {
  const git = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    cwd: RAIZ,
    encoding: "utf8",
  });
  if (git.status === 0) {
    return git.stdout
      .split("\0")
      .filter(Boolean)
      .filter((f) => existsSync(join(RAIZ, f)) && statSync(join(RAIZ, f)).isFile());
  }
  const saida: string[] = [];
  const andar = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (PULAR.has(e.name)) continue;
      const abs = join(dir, e.name);
      if (e.isDirectory()) andar(abs);
      else if (e.isFile()) saida.push(relative(RAIZ, abs));
    }
  };
  andar(RAIZ);
  return saida;
}

/** PDF/PPTX que não deu para ler: o texto deles não foi checado. */
const ilegiveis: string[] = [];

/** Texto por "página" (para PDF) ou um bloco só. Binário que não é PDF/PPTX: null. */
function textoDe(arquivo: string): { rotulo: (pagina: number) => string; paginas: string[] } | null {
  const abs = join(RAIZ, arquivo);
  if (arquivo.endsWith(".pdf")) {
    const r = spawnSync("pdftotext", ["-layout", abs, "-"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    if (r.error || r.status !== 0) {
      ilegiveis.push(`${arquivo} (pdftotext${r.error ? ": " + r.error.message : ""})`);
      return null;
    }
    return { rotulo: (p) => `${arquivo}:p${p}`, paginas: r.stdout.split("\f") };
  }
  if (arquivo.endsWith(".pptx")) {
    const r = spawnSync("unzip", ["-p", abs, "ppt/slides/*.xml", "ppt/notesSlides/*.xml"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    // 11 = algum padrão sem arquivo (ex.: PPTX sem notas); vale se veio texto
    if (r.error || !(r.status === 0 || (r.status === 11 && r.stdout.length > 0))) {
      ilegiveis.push(`${arquivo} (unzip${r.error ? ": " + r.error.message : ""})`);
      return null;
    }
    // uma linha por parágrafo (<a:p>), sem as tags; entidades básicas desfeitas
    const texto = r.stdout
      .replace(/<\/a:p>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&");
    return { rotulo: () => `${arquivo}:texto`, paginas: [texto] };
  }
  const bruto = readFileSync(abs);
  if (bruto.includes(0)) return null; // binário (imagem etc.)
  return { rotulo: () => arquivo, paginas: [bruto.toString("utf8")] };
}

const termos = lerTermos();
const achados: string[] = [];
let arquivos = 0;

for (const arquivo of listarArquivos()) {
  const t = textoDe(arquivo);
  if (!t) continue;
  arquivos++;
  t.paginas.forEach((pagina, ip) => {
    pagina.split("\n").forEach((linha, il) => {
      const semFalsos = (FALSOS_POSITIVOS[arquivo] ?? []).reduce((l, re) => l.replace(re, " "), linha);
      for (const termo of termosNaLinha(semFalsos, termos, LIBERADAS)) {
        const onde = t.paginas.length > 1 ? `${t.rotulo(ip + 1)}:${il + 1}` : `${t.rotulo(1)}:${il + 1}`;
        achados.push(`${onde}: "${termo}" → ${linha.trim().slice(0, 140)}`);
      }
    });
  });
}

const semPdfPermitido = process.env.CHECAR_SEM_PDF === "1";
if (ilegiveis.length > 0) {
  console.error(`${semPdfPermitido ? "aviso" : "erro"}: o texto destes arquivos NÃO foi checado (instale o poppler para pdftotext; unzip para PPTX):`);
  for (const f of ilegiveis) console.error(`  ${f}`);
  if (!semPdfPermitido) console.error("Para pular esses arquivos de propósito: CHECAR_SEM_PDF=1 pnpm checar-termos");
}
if (achados.length > 0) {
  console.error(`Termos internos encontrados (${achados.length}):`);
  for (const a of achados) console.error(`  ${a}`);
}
const codigo = codigoDaChecagem(achados.length, ilegiveis.length, semPdfPermitido);
if (codigo === 0) {
  const pulados = ilegiveis.length > 0 ? ` (${ilegiveis.length} PDF/PPTX pulados com CHECAR_SEM_PDF=1)` : "";
  console.log(`checar-termos: ${arquivos} arquivos, ${termos.length} termos, nada encontrado${pulados}.`);
}
process.exit(codigo);
