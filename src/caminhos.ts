import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";

export const RAIZ = join(import.meta.dirname, "..");

/**
 * Dependências só do lab (vitest + @types/node, nas versões da raiz), fora do node_modules do projeto.
 * Ficam somente leitura: o agente não consegue adulterar o vitest que roda o teste oculto.
 */
export const DEPS = join(RAIZ, ".lab-deps");
export const DEPS_NODE_MODULES = join(DEPS, "node_modules");

/** Dependências do corretor: o sandbox-runtime (`srt`) que isola o vitest da correção. Também só leitura. */
export const DEPS_CORRETOR = join(RAIZ, ".corretor-deps");
export const SRT_CLI = join(DEPS_CORRETOR, "node_modules", "@anthropic-ai", "sandbox-runtime", "dist", "cli.js");
export const VERSAO_SRT = "0.0.81";

/**
 * Onde as cópias ficam. Fora do $TMPDIR de propósito: o sandbox do Claude Code deixa escrever no
 * $TMPDIR, e lá um agente alcançaria as cópias paralelas. Fora de qualquer repo (o Claude Code sobe
 * as pastas-pai procurando CLAUDE.md).
 */
export const BASE_COPIAS = process.env.MEDINDO_COPIAS ?? join(realpathSync("/tmp"), "medindo-agentes");

/**
 * O prefixo do node (e o do pnpm) entra no `allowRead` dos sandboxes. Se ele for o home (ou um pai
 * dele) ou contiver o projeto, liberaria a leitura dos testes ocultos e das soluções: falha alto.
 */
export function validarPrefixoNode(prefixo: string, home: string, raiz: string, nome = "do node"): string {
  const contem = (pai: string, filho: string) => filho === pai || filho.startsWith(pai.endsWith(sep) ? pai : pai + sep);
  if (contem(prefixo, home) || contem(prefixo, raiz)) {
    throw new Error(
      `Instalação ${nome} em ${prefixo} contém ${contem(prefixo, raiz) ? `o projeto (${raiz})` : `o home (${home})`}: ` +
        "liberar a leitura dela nos sandboxes exporia os testes ocultos. Use uma instalação em pasta própria " +
        "(ex.: ~/.nvm/versions/node/vX, ~/Library/pnpm, /opt/homebrew, /usr/local).",
    );
  }
  return prefixo;
}

/** Instalação do node em uso (ex.: ~/.nvm/versions/node/vX): o sandbox precisa ler o binário e a lib. */
export const PREFIXO_NODE = validarPrefixoNode(
  dirname(dirname(realpathSync(process.execPath))),
  realpathSync(homedir()),
  realpathSync(RAIZ),
);
/** `PNPM_HOME` (ou ~/Library/pnpm), absoluto e sem link quando existe, validado como o prefixo do node. */
export function resolverPnpmHome(valor: string | undefined, home: string, raiz: string): string {
  const bruto = resolve(valor || join(home, "Library", "pnpm"));
  let real = bruto;
  try {
    real = realpathSync(bruto);
  } catch {
    // ainda não existe: vale o caminho como está
  }
  return validarPrefixoNode(real, home, raiz, "do pnpm (PNPM_HOME)");
}

/** Instalação do pnpm (binário e o node que ele traz). */
export const PNPM_HOME = resolverPnpmHome(process.env.PNPM_HOME, realpathSync(homedir()), realpathSync(RAIZ));

/**
 * Leitura nos sandboxes (agente e correção): o home inteiro bloqueado (projeto, testes ocultos,
 * ~/.claude, chaves), e as outras cópias também. Liberados: a própria cópia, as deps do lab, o node,
 * o pnpm e o que mais for passado.
 */
export function leituraRestrita(pasta: string, extras: string[] = []): { denyRead: string[]; allowRead: string[] } {
  return {
    denyRead: [homedir(), RAIZ, BASE_COPIAS],
    allowRead: [DEPS, pasta, PREFIXO_NODE, PNPM_HOME, ...extras],
  };
}
