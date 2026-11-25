# Configuração manual do GitHub

Este guia acompanha os arquivos preparados no projeto. A configuração inicial
considera um único mantenedor, PRs para `main` e builds para teste.

## 1. Enviar os arquivos e validar a primeira execução

Crie uma branch, revise os arquivos preparados, faça o commit e publique a branch.
Abra um PR para `main`. Confira o workflow **CI** na aba **Checks** do PR ou em
**Actions**. Aguarde as quatro combinações e o check final **CI aprovado**.

Se houver um pedido de autorização para executar o workflow, revise a origem
da alteração e autorize pelo próprio GitHub. Teste um build disponível nos
artefatos e revise o PR antes de integrá-lo.

Depois do merge, o modelo de PR, os formulários de issues, o CODEOWNERS e a
configuração do Dependabot ficam disponíveis na branch padrão.

## 2. Proteger a main

Em **Settings → Rules → Rulesets**, escolha **New ruleset → New branch ruleset**.

Use o nome `main protegida`, selecione **Active** e adicione `main` às branches
alvo. Configure as opções abaixo.

| Opção | Configuração inicial |
| --- | --- |
| Restrict deletions | Ativada |
| Block force pushes | Ativada |
| Require a pull request before merging | Ativada |
| Required approvals | 0 enquanto houver apenas um mantenedor |
| Require conversation resolution before merging | Ativada |
| Require status checks to pass | Ativada |
| Check obrigatório | `CI aprovado`, associado ao GitHub Actions |
| Require branches to be up to date before merging | Ativada |
| Bypass list | Vazia |

Selecione o check depois da primeira execução. Se ele ainda não aparecer, confira
se o workflow executou com esse nome e atualize a página.

A configuração com zero aprovações permite que o autor integre seu próprio PR
após os checks. Quando houver outro revisor, podemos exigir uma aprovação.
O CODEOWNERS identifica o mantenedor. A opção de exigir aprovação de code owners
pode ser ativada quando houver revisores suficientes para o fluxo.

Salve e confirme se o ruleset está ativo para `main`. As configurações são
aplicadas pelo GitHub. [Regras de branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository)

## 3. Ajustar o merge

Em **Settings → General → Pull Requests**, habilite **Allow squash merging** e
selecione título e descrição do PR para a mensagem do commit, se essa opção
estiver disponível. Para usar esse método em todo o projeto, desabilite os
métodos merge commit e rebase merge.

Habilite **Automatically delete head branches** para limpar as branches remotas
depois do merge. Esse ajuste afeta branches integradas por PR.

## 4. Conferir o Actions

Em **Settings → Actions → General**, confirme que o GitHub Actions está habilitado
e que as actions oficiais usadas pelo workflow são permitidas.

Em **Workflow permissions**, selecione o token com acesso de leitura ao conteúdo
e aos pacotes. O workflow declara `contents: read`. A opção de permitir que o
Actions crie e aprove PRs pode ficar desmarcada.

A pipeline atual usa runners hospedados pelo GitHub e gera artefatos para teste.
O uso segue as cotas e condições da conta. A configuração atual funciona sem
segredos para build e teste.

## 5. Ativar recursos de segurança

Em **Settings**, procure **Code security** ou **Advanced Security**, conforme a
interface exibida. Confira as opções abaixo e as condições de disponibilidade.

- Dependency graph.
- Dependabot alerts.
- Dependabot security updates.
- Private vulnerability reporting.
- Secret scanning e push protection, se disponíveis para o repositório.

O relato privado deve estar habilitado para disponibilizar
**Security → Report a vulnerability**. Confira o canal antes de anunciar a política.
O arquivo `SECURITY.md` também orienta como pedir um canal privado quando essa
opção estiver indisponível.

O `dependabot.yml` agenda propostas de atualização. As opções de alertas e
atualizações de segurança são configuradas no painel do GitHub.

## 6. Conferir a experiência de contribuição

Abra a criação de uma issue e confira os formulários de bug e melhoria. Em um
novo PR, confira o modelo de descrição e a identificação do code owner. Os
checkboxes do modelo ajudam na revisão e são preenchidos manualmente.

Para verificar a proteção, consulte as regras aplicáveis à `main` e confirme
que um PR aguarda o check obrigatório antes do merge.

## Entrega e publicação

O fluxo atual valida as alterações e entrega os builds como artefatos do Actions,
inclusive após o merge em `main`.

Para uma release no GitHub, atualize a versão em `package.json` e no lockfile em um
PR. Depois do merge e da validação, crie uma release pela interface usando uma tag
no formato `v0.1.0`, correspondente à versão do pacote. Nas primeiras versões,
marque como **pre-release** para comunicar o estágio de desenvolvimento.

Ao publicar a release, o workflow **Pacotes de release** confere a versão,
executa as verificações e anexa `snagly-chrome.zip` e `snagly-firefox.zip`.
Uma reexecução substitui esses dois anexos com os builds daquela mesma tag.
O token desse workflow tem escrita no repositório para anexar os arquivos.

Extraia os ZIPs antes de carregar a extensão. O ZIP de Firefox contém o build
para carregamento temporário. A distribuição instalável no Firefox estável
depende da assinatura pela Mozilla.

A publicação nas lojas exige preparar contas, assinatura, credenciais e revisão
dos pacotes em uma etapa própria.

A licença MIT cobre o código do projeto. Confira também as obrigações das
dependências antes de distribuir uma versão.
