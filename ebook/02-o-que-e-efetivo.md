# O que é "efetivo"

"O agente está bom?" não tem resposta enquanto "bom" não estiver definido. Para um agente de código, "bom" são seis números, não um.

## As seis métricas

| O que medir | Pergunta | Como o repositório mede |
|---|---|---|
| **Sucesso** | deu certo? | o teste escondido da tarefa passou (o critério de feito) |
| Custo | quanto gastou? | tokens e custo estimado, que o Claude Code informa no fim |
| Voltas (turnos) | quantas idas e vindas deu? | o número de turnos que o Claude Code informa |
| Tempo | quanto demorou? | a duração que o Claude Code informa |
| **Mexeu onde não devia** (fora do escopo) | alterou arquivo que a tarefa não permitia? | arquivos alterados fora da lista `permitidos` da tarefa |
| **Resolve sempre?** (consistência, pass^k) | acerta em todas as tentativas? | a tarefa deu certo em todas as repetições |

Algumas definições:

- **Critério de feito:** a regra objetiva que diz se a tarefa foi resolvida. Aqui é sempre um teste automático que o agente não vê, o teste escondido (capítulo 3).
- **Voltas (turnos):** uma volta é, mais ou menos, uma ida e volta entre o modelo e uma ferramenta: ler um arquivo, editar, rodar os testes. Mais voltas costumam significar mais tokens e mais tempo.
- **Token:** o pedacinho de texto que o modelo lê ou escreve. É a unidade de consumo. Tokens de entrada (o que o modelo lê), de saída (o que ele escreve) e de cache (texto que ele já tinha lido e reaproveita) são contados separados.

### Por que "deu certo" sozinho engana

Dois agentes com a mesma taxa de acerto podem ser muito diferentes. Um pode gastar o dobro de voltas. Outro pode resolver a tarefa mexendo num arquivo que ninguém podia tocar. Se você olhar só a taxa, os dois parecem iguais.

Por isso "mexeu onde não devia" é uma métrica separada, de propósito. "Resolveu, mas editou o código antigo que ninguém podia tocar" não é sucesso. Num time de verdade, esse PR volta na revisão.

### Resolve sempre?

Acertar uma vez pode ser sorte. Acertar todas as vezes é saber. "Resolve sempre?" conta quantas tarefas deram certo em **todas** as tentativas. No jargão, essa métrica se chama **pass^k** (lê-se "pass hat k"), em que k é o número de tentativas. No run da palestra, k = 2: o relatório diz quantas das 8 tarefas deram certo nas duas repetições, por variante.

### Custo em US$: leia como esforço

O Claude Code informa, no fim de cada execução, um custo em dólares (o campo `total_cost_usd`). A documentação dele ("Run Claude Code programmatically") avisa que esse valor é uma **estimativa** calculada no seu computador. Se você usa assinatura, ele não é fatura. Leia como "tamanho do esforço" da execução e compare entre variantes, não como dinheiro gasto.

## Desfecho, não "funcionou?"

Cada execução do repositório termina com **um** rótulo. No jargão, esse rótulo é o **desfecho**:

| Desfecho | Quando |
|---|---|
| `passou` | o teste escondido passou e nada foi alterado fora do permitido |
| `falhou` | o teste escondido falhou |
| `fora_do_escopo` | mexeu onde não devia: algum arquivo alterado não está em `permitidos` (mesmo que o teste passe) |
| `erro_agente` | o agente nem terminou (estourou o tempo, o login expirou, bateu no limite de voltas, devolveu uma resposta ilegível) ou mexeu nas peças que rodam o teste |

A ordem de decisão é: primeiro `erro_agente`, depois `fora_do_escopo`, depois `passou` ou `falhou` pelo teste.

O ponto mais importante é o último rótulo. **Erro do agente é contado à parte**, fora da taxa de acerto. Se a sua internet caiu no meio do run, isso não diz nada sobre o `CLAUDE.md`. Se você contasse como falha, a variante que teve o azar de rodar durante a queda pareceria pior. O relatório mostra quantos erros do agente cada variante teve, e você decide se o run vale ou se precisa rodar de novo.

Essa ideia vem direto do caso real do capítulo 7: sem rótulo explícito, "funcionou?" vira discussão.

## Quem confere: código ou IA como juiz?

Em todas as tarefas deste repositório, quem confere é código: o teste escondido. Existe outra opção, muito usada: pedir para um modelo de IA dar nota ao trabalho de outro. É a **IA como juiz** (LLM-as-judge; LLM é o "modelo de linguagem grande", o tipo de modelo por trás desses agentes).

- **Ajuda** quando o critério não cabe num teste: clareza de um texto, qualidade da descrição de um PR, estilo.
- **Atrapalha** porque o juiz também varia. É como um corretor de redação que, no mesmo texto, às vezes dá 7 e às vezes dá 9. Um juiz que varia avaliando um agente que varia **soma incerteza**.

A regra prática: se dá para conferir com código, confira com código. Se não dá, meça o juiz também, comparando as notas dele com as de uma pessoa. O capítulo 7 conta por que o juiz foi rejeitado num caso real.

## Para quem quer ir fundo: pass@k × pass^k

Com várias repetições por tarefa, aparecem duas maneiras de resumir:

- **pass@k:** a tarefa deu certo em **pelo menos uma** de k tentativas.
- **pass^k:** a tarefa deu certo em **todas** as k tentativas.

Quando k cresce, pass@k sobe (mais chances de acertar uma vez) e pass^k desce (mais chances de errar uma vez). pass@k faz sentido quando uma pessoa olha as tentativas e escolhe a melhor. Um agente que trabalha sozinho não vai ser chamado de novo até dar certo: o que importa é se ele acerta **sempre**. Por isso o relatório mostra pass^k.

A métrica pass^k foi proposta no τ-bench (Yao et al., 2024), e o post da Anthropic "Demystifying evals for AI agents" (2026) usa a mesma definição: a chance de **todas** as k tentativas darem certo.

Os campos exatos que o repositório lê do Claude Code (`usage`, `total_cost_usd`, `num_turns`, `duration_ms`) estão no capítulo 4.
