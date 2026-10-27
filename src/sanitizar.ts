import { homedir } from "node:os";

/**
 * Tira caminhos pessoais de um texto (o JSON do promptfoo): a raiz do projeto vira `.`, o home vira
 * `~` e pastas temporárias (`/private/tmp`, `/tmp`, `/var/folders`) viram `<tmp>`.
 */
export function sanitizarCaminhos(texto: string, raiz: string, home: string = homedir()): string {
  const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let saida = texto;
  const troca = (prefixo: string, por: string) => {
    if (prefixo.length > 1) saida = saida.replace(new RegExp(escapar(prefixo.replace(/\/+$/, "")), "g"), por);
  };
  troca(raiz, ".");
  troca(home, "~");
  saida = saida.replace(/\/private\/tmp|\/var\/folders|\/tmp/g, "<tmp>");
  return saida;
}
