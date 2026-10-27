import { eventos, inscricoes } from "../eventos.js";

export function gerarRelatorio() {
  const linhas = eventos.map((e) => {
    const n = inscricoes.filter((i) => i.eventoId === e.id).length;
    return { evento: e.nome, inscritos: n, receita: ((n * e.preco) / 100).toFixed(2) };
  });
  return { geradoEm: new Date().toISOString(), linhas };
}
