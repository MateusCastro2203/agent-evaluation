# Por que medir

Este ebook é a palestra "Como medir os seus agentes de IA" em texto corrido, mais o que você precisa para rodar e adaptar o repositório `agent-evaluation`. A palestra cabe em 50 minutos; aqui dá para ir com calma, ver o código e voltar quando for montar a sua própria eval.

## A aposta

A palestra começa com uma aposta. Eu escrevi um `CLAUDE.md` para um projeto pequeno, com as convenções da casa: que tipo de erro lançar, como lidar com dinheiro, de onde vem a hora atual, que pasta não se toca. Acho que ele ajuda o agente. Mas "acho" não é medida.

Então, no primeiro minuto, eu rodo:

```bash
pnpm eval
```

Esse comando põe o Claude Code para trabalhar **32 vezes**: 2 variantes × 8 tarefas × 2 repetições.

- **Variante A:** o repositório como está, sem `CLAUDE.md`.
- **Variante B:** o mesmo repositório, com o `CLAUDE.md`.

Enquanto o agente trabalha, a palestra explica o que está sendo medido e por quê. No minuto 40, o relatório diz se o `CLAUDE.md` presta. Ou diz que ainda não dá para saber, que é uma resposta tão útil quanto as outras (capítulo 5).

## "Parece que melhorou"

Todo mundo que usa agente de código já fez isto:

1. mudou o prompt, o `CLAUDE.md` ou o modelo;
2. pediu **uma** tarefa;
3. deu certo;
4. "melhorou!".

É o *vibe check*. Ele não é inútil: é como você descobre que vale a pena olhar para alguma coisa. O problema é parar nele, porque ficou muita coisa de fora:

- A tarefa era fácil ou difícil? Uma tarefa fácil passa com qualquer configuração.
- Se você pedisse de novo, daria certo de novo?
- Quanto custou? Quantos turnos o agente gastou?
- Ele mexeu em arquivo que não devia?
- Teria dado certo **antes** da mudança também?

A última pergunta é a mais esquecida. Sem rodar a configuração antiga nas mesmas tarefas, você não tem com o que comparar.

## O agente não é determinístico

Mesmo prompt, mesmo repositório, mesmo modelo: o agente não faz a mesma coisa duas vezes. O modelo sorteia cada token de uma distribuição de probabilidade, e o loop de ferramentas amplifica qualquer diferença pequena do começo. Um agente lê o arquivo A primeiro, o outro lê o B; um roda os testes, o outro não. No fim, um passa e o outro falha. Isso é o comportamento normal da ferramenta, não um defeito.

A consequência prática: **uma execução é uma amostra, não um resultado**. A pergunta certa não é "passou?", e sim "com que frequência passa?". Frequência se estima com várias execuções e se reporta com um intervalo de confiança.

## Quanto diz uma execução?

O repositório usa o **intervalo de Wilson** com 95% de confiança (explicado no capítulo 5). Dois números para calibrar a intuição:

| Observado | Taxa real compatível (Wilson, 95%) |
|---|---|
| 1 de 1 passou | entre **21% e 100%** |
| 16 de 16 passaram | entre **81% e 100%** |

Uma execução que passou é compatível com um agente que acerta uma vez a cada cinco. E mesmo 16 acertos em 16 tentativas não provam 100%. Esses números são conta, não opinião: é a mesma fórmula que o relatório do repositório usa.

## O que você leva deste ebook

Ao final, você consegue:

- dizer quais métricas definem "efetivo" para um agente de código: sucesso pelo critério de feito, custo e tokens, turnos, tempo, edição fora do escopo e consistência entre execuções (capítulo 2);
- montar um conjunto pequeno de tarefas com testes escondidos e rodar o seu agente contra ele (capítulos 3 e 4);
- comparar duas configurações, por exemplo com e sem `CLAUDE.md`, e ler o resultado com intervalo de confiança, sem se enganar com uma execução só (capítulo 5);
- transformar uma falha observada em tarefa nova do conjunto (capítulo 6).

O repositório roda o mesmo experimento da palestra com o login normal do Claude Code. Não precisa de chave de API.
