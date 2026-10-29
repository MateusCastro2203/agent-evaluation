# Por que medir

Este ebook acompanha a palestra "Como medir os seus agentes de IA". A palestra tem 40 minutos, com as perguntas. Aqui dá para ir com calma, ver o código e voltar quando for montar a sua própria medição.

Você não precisa saber estatística nem ter rodado uma eval antes. Os capítulos para quem está começando usam palavras do dia a dia. Quando aparece um termo técnico, ele vem entre parênteses na primeira vez: é o termo que você vai digitar no buscador se quiser ir mais fundo. O glossário, no fim, junta todos.

## "Parece que melhorou"

Um **agente de código** é um programa que usa um modelo de IA para mexer no seu projeto: ele lê arquivos, edita, roda os testes e decide o próximo passo sozinho. O Claude Code, que a palestra usa, é um deles: roda no terminal e trabalha no seu repositório.

Todo mundo que usa um agente assim já fez isto:

1. mudou alguma coisa: o prompt, o modelo ou o `CLAUDE.md` (um arquivo de texto com as regras da casa, que o Claude Code lê antes de começar);
2. pediu **uma** tarefa;
3. deu certo;
4. "melhorou!".

Esse "avaliar no olho" tem nome: *vibe check*. Ele não é inútil. É como você descobre que vale a pena olhar para alguma coisa. O problema é parar nele, porque muita coisa ficou de fora:

- A tarefa era fácil? Uma tarefa fácil dá certo com qualquer configuração.
- Se você pedisse de novo, daria certo de novo?
- Quanto custou? Quantas idas e vindas o agente deu?
- Ele mexeu onde não devia?
- Teria dado certo **antes** da mudança também?

A última pergunta é a mais esquecida. Sem rodar a configuração antiga nas mesmas tarefas, você não tem com o que comparar.

## O que é uma eval

**Eval** vem de *evaluation*, avaliação. Em uma frase: um conjunto de tarefas em que "deu certo" é conferido por código, repetidas várias vezes, para comparar o antes e o depois de uma mudança.

São três ingredientes. Cada um tem uma analogia.

**1. "Deu certo" conferido por código.** Pense numa prova com gabarito. O aluno recebe o enunciado, mas não vê o gabarito, que fica com o professor. Aqui, o enunciado é o pedido ao agente, escrito como uma issue (o pedido de trabalho que se abre no GitHub ou no Jira). O gabarito é um teste automático: um pequeno programa que confere se o código faz o que devia. O agente nunca vê esse teste. Por isso a palestra o chama de **teste escondido**.

**2. Repetidas várias vezes.** O agente não faz a mesma coisa duas vezes (próxima seção). Jogue uma moeda 4 vezes e tire 3 caras: isso não prova que a moeda é viciada. Jogue 400 vezes e tire 300: agora prova. Com o agente é igual. Uma execução que deu certo diz pouco. Muitas execuções dizem bastante.

**3. Antes × depois de uma mudança.** Você roda as mesmas tarefas com a configuração antiga e com a nova, e compara. Neste ebook, cada versão comparada se chama **variante**: a A é o "antes", a B é o "depois".

## O agente não faz a mesma coisa duas vezes

Mesmo pedido, mesmo repositório, mesmo modelo: o resultado muda de uma execução para outra. O modelo escreve o texto um pedacinho por vez. Cada pedacinho se chama **token** e é sorteado entre as opções mais prováveis. Uma diferença pequena no começo vira uma diferença grande no fim. Um agente lê o arquivo A primeiro, o outro lê o B; um roda os testes, o outro não. No fim, um dá certo e o outro não.

Isso é o comportamento normal da ferramenta, não um defeito. No jargão, o agente **não é determinístico**.

A consequência prática: **uma execução é uma amostra, não um resultado**. A pergunta certa não é "deu certo?". É "com que frequência dá certo?".

## Margem de erro: como numa pesquisa eleitoral

Pesquisa eleitoral não diz só "o candidato tem 40%". Ela diz "40%, com margem de erro de 3 pontos". Com poucas pessoas ouvidas, a margem é larga. Com mais pessoas, ela estreita.

A taxa de acerto de um agente funciona do mesmo jeito. O repositório calcula a margem de erro com uma conta chamada **intervalo de Wilson**, com 95% de confiança (o capítulo 5 explica). Dois números para calibrar a intuição:

| O que você viu | Onde a taxa real pode estar (margem de erro) |
|---|---|
| deu certo 1 de 1 vez | entre **21% e 100%** |
| deu certo 16 de 16 vezes | entre **81% e 100%** |

Uma execução que deu certo combina até com um agente que acerta uma vez a cada cinco. E mesmo 16 acertos em 16 tentativas não provam 100%. Esses números são conta, não opinião: é a mesma fórmula que o relatório do repositório usa.

## O experimento da palestra

Eu escrevi um `CLAUDE.md` para um app pequeno de exemplo, com as regras da casa: que tipo de erro lançar, como lidar com dinheiro, de onde vem a hora atual, que pasta não se toca. Acho que ele ajuda o agente. Mas "acho" não é medida. Então, no começo da palestra, eu rodo `pnpm eval`, e o Claude Code faz as mesmas 8 tarefas **sem** o `CLAUDE.md` (variante A) e **com** ele (variante B), duas vezes cada: 32 execuções, enquanto eu falo. No fim, o próprio comando gera um relatório que diz "Com CLAUDE.md foi melhor", "Sem CLAUDE.md foi melhor" ou "Ainda não dá para saber". No ensaio, deu "Ainda não dá para saber", e o capítulo 5 mostra por quê.

O repositório `agent-evaluation` roda esse mesmo experimento no seu computador, com o login normal do Claude Code. Não precisa de chave de API.

## Como ler este ebook

- **Está começando?** Leia os capítulos 1, 2, 5 e 8. Eles explicam o que medir, como ler o resultado e onde é fácil se enganar. O glossário, no fim, ajuda com os termos.
- **Vai rodar e adaptar o repositório?** Leia também os capítulos 3, 4 e 6. Eles mostram como as tarefas são montadas, o que acontece em cada execução e como trocar o app de exemplo pelo seu projeto.
- **O capítulo 7** traz lições de agentes em produção. Vale para os dois públicos.

Nos capítulos mais técnicos, as partes avançadas ficam em seções marcadas como **"Para quem quer ir fundo"**. Dá para pular sem perder o fio.

## O que você leva deste ebook

Ao final, você consegue:

- dizer o que medir num agente de código: se deu certo, quanto custou, quantas voltas deu, quanto demorou, se mexeu onde não devia e se resolve sempre (capítulo 2);
- montar um conjunto pequeno de tarefas com testes escondidos e rodar o seu agente contra ele (capítulos 3 e 4);
- comparar duas configurações, por exemplo sem e com `CLAUDE.md`, e ler o resultado com a margem de erro, sem se enganar com uma execução só (capítulo 5);
- transformar uma falha do dia a dia em tarefa nova da eval (capítulo 6).
