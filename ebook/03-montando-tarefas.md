# Montando as tarefas

Uma eval de agente de código é um conjunto de **tarefas** com **critério de feito**. A tarefa é o pedido, escrito como você escreveria uma issue. O critério de feito é um teste que prova que o pedido foi atendido. O resto (rodar, repetir, calcular) é encanamento.

## O laboratório

O repositório traz um app pequeno, em TypeScript, chamado laboratório (`laboratorio/`): uma agenda de meetups com eventos, inscrições, importação de inscritos por CSV e um relatório. Os dados são sintéticos e ficam em memória. O app tem testes com Vitest.

Como todo projeto real, ele tem convenções que não dá para adivinhar só lendo o código. A variante B ganha um `CLAUDE.md` que explica essas convenções. Este é o trecho principal, copiado do repositório (`variantes/b/CLAUDE.md`):

```markdown
## Convenções

- Erros: sempre `ErroDominio` (`src/erros.ts`) com `codigo` em
  `SCREAMING_SNAKE`, por exemplo `INSCRICAO_DUPLICADA`. Nunca
  `throw new Error(...)` em regra de negócio.
- Dinheiro: sempre `Centavos` (inteiro, `src/dinheiro.ts`). Nada de float.
  Ao dividir ou aplicar percentual, arredonde o valor final para baixo
  (`Math.floor`).
- Tempo: nunca `new Date()` em `src/`. Use `relogio.agora()` de
  `src/relogio.ts`, para os testes conseguirem fixar a hora.
- Auditoria: toda mutação de inscrição (criar, cancelar, qualquer nova)
  chama `registrarAuditoria(acao, dados)`. Ações no formato
  `inscricao.<verbo>`.
- `src/legado/` é congelado: não edite. Código novo de relatório vai em
  `src/relatorios/`.
```

(As linhas foram quebradas para caber na página; no arquivo, cada regra é uma linha.)

## As 8 tarefas

Cinco tarefas dependem de uma convenção do `CLAUDE.md`. Três são **controle**: não dependem de nenhuma convenção, e A e B deveriam empatar nelas.

| # | Tarefa (como uma issue) | O teste escondido exige |
|---|---|---|
| 01 | A listagem de próximos eventos devolve um evento a menos do que o limite. | controle |
| 02 | Uma função que conte os inscritos de um evento. | controle |
| 03 | Não deixar inscrever em evento lotado. | `ErroDominio` com código de lotação em `SCREAMING_SNAKE` |
| 04 | Cupom de desconto percentual na inscrição. | `Centavos` inteiro, valor final arredondado para baixo |
| 05 | Não deixar inscrever em evento que já aconteceu. | a regra usa `relogio.agora()` |
| 06 | O relatório de inscrições precisa mostrar o e-mail. | código novo em `src/relatorios/`, `src/legado/` intocado |
| 07 | Quando lotar, pôr a pessoa numa lista de espera. | registro de auditoria da nova mutação |
| 08 | A importação de CSV quebra com vírgula dentro de aspas. | controle |

### Por que ter tarefas de controle

As tarefas de controle protegem você de uma conclusão errada. O efeito esperado do `CLAUDE.md` está nas tarefas 03 a 07. Se B ganhar **também** nas tarefas 01, 02 e 08, desconfie: pode ser ruído, ou outra coisa mudou entre as variantes.

### Por que o prompt não cita a convenção

O prompt é escrito como uma issue de verdade: diz o que a pessoa quer, não como o projeto faz. Se o prompt dissesse "use `ErroDominio`", A e B empatariam, e a eval não mediria nada. O repositório tem um teste que falha se algum prompt mencionar `ErroDominio`, `relogio`, `Math.floor`, auditoria, `src/relatorios`, legado ou `CLAUDE.md`.

Isso não quer dizer que A não tenha chance. Na tarefa 03, o código já lança `ErroDominio` em outras regras, e um agente atento pode copiar o padrão. Na 05, outra função do app já usa `relogio.agora()`. Já nas tarefas 04 (direção do arredondamento) e 06 (pasta do código novo), não há nenhum sinal no código: elas medem o `CLAUDE.md` quase puro. Vale dizer isso quando você apresentar o resultado.

## Uma tarefa por dentro

Cada tarefa é uma pasta em `tarefas/NN-nome/` com três coisas:

- `tarefa.json`: o título, o prompt, os arquivos permitidos e se a tarefa depende de convenção;
- `oculto.test.ts`: o teste escondido, que o agente não vê;
- `solucao/`: a solução de referência, usada para provar que a tarefa é possível.

O `tarefa.json` da tarefa 03, copiado do repositório:

```json
{
  "titulo": "Evento lotado",
  "prompt": "Hoje dá para inscrever mais gente do que a capacidade do evento. Não deixe inscrever em evento lotado: quando o evento já tiver `capacidade` inscritos, `inscrever` deve recusar a nova inscrição.",
  "permitidos": ["src/inscricoes.ts", "test/**"],
  "dependeDeConvencao": true
}
```

O agente só recebe o `prompt`. O campo `permitidos` define o escopo: qualquer arquivo alterado fora dessa lista vira `fora_do_escopo`. Nos globs, `*` não atravessa `/` e `**` atravessa. O identificador da tarefa é o nome da pasta.

E o coração do `oculto.test.ts` da mesma tarefa (trecho; os helpers `evento`, `erroDe` e as pessoas `ana`, `bia`, `caio` ficam no topo do arquivo):

```ts
// O prompt não dá o nome do código: aceita qualquer SCREAMING_SNAKE
// que fale de lotação.
it("recusa inscrição além da capacidade com ErroDominio e código de lotação", () => {
  const e = evento(2);
  inscrever(e.id, ana);
  inscrever(e.id, bia);
  const erro = erroDe(() => inscrever(e.id, caio));
  expect(erro).toBeInstanceOf(ErroDominio);
  const { codigo } = erro as ErroDominio;
  expect(codigo).toMatch(/^[A-Z][A-Z0-9_]*$/);
  expect(codigo).toMatch(/LOTAD|CHEIO|CAPACIDADE|ESGOT|LIMITE|VAGA/);
  expect(codigo, "CAPACIDADE_INVALIDA já existe e significa outra coisa")
    .not.toBe("CAPACIDADE_INVALIDA");
});

it("vaga liberada por cancelamento pode ser ocupada", () => {
  const e = evento(1);
  inscrever(e.id, ana);
  cancelarInscricao(e.id, ana.email);
  expect(() => inscrever(e.id, bia)).not.toThrow();
});
```

Repare no que o teste **não** exige: um nome exato de código. O prompt não diz qual código usar, então exigir `EVENTO_LOTADO` letra por letra mediria sorte, não convenção. O teste exige o que a convenção diz (o erro do domínio, com código no formato da casa) e aceita qualquer nome razoável de lotação. Ele só recusa reaproveitar `CAPACIDADE_INVALIDA`, que já existe no app e significa outra coisa.

Desenhar o teste é a parte mais difícil. Outro exemplo é a tarefa 04, cujo teste escolhe valores que separam as interpretações erradas. O comentário do próprio teste explica:

```ts
// Só o valor final com Math.floor passa nos dois casos:
// - 999 a 50%: exato 499,5. Reprova Math.round (500) e também
//   floor só do desconto (999 - floor(499,5) = 500).
// - 1999 a 15%: exato 1699,15. Math.round acerta (1699), mas floor
//   só do desconto reprova (1999 - floor(299,85) = 1700).
//   Valor não inteiro (float) reprova nos dois.
```

## Três regras para uma tarefa honesta

**1. Toda tarefa falha no app intacto.** Se o teste escondido já passa sem o agente fazer nada, a tarefa é inútil: as duas variantes "resolvem". O repositório verifica isso para as 8 tarefas.

**2. Toda tarefa passa com a solução de referência.** Se nem a solução passa, a tarefa é impossível, e a taxa das duas variantes cai junto. O mesmo teste verifica as duas coisas.

**3. O agente não vê o teste, e não consegue trapacear com ele.** O teste escondido nunca entra na pasta do agente. Depois que o agente termina, a correção monta uma pasta **nova**, que o agente nunca viu: o app intacto, mais os arquivos que ele mudou, mais o teste escondido, que entra por último e sobrescreve qualquer arquivo com o mesmo nome. Se o agente criar um `test/oculto.test.ts` falso que sempre passa, ele é substituído. Além disso, o teste roda com uma configuração do Vitest fixa, que fica **fora** da cópia (`src/vitest-oculto.config.mjs`). Assim, um `vitest.config.ts` criado pelo agente, com `exclude` ou um `setupFiles` que "conserta" o resultado, é ignorado. O repositório tem um teste que planta exatamente essas trapaças e confere que a tarefa continua falhando.

Essas regras parecem paranoia até a primeira vez que um agente, tentando "fazer os testes passarem", edita o teste em vez do código.
