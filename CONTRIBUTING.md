# Contribuindo com o Snagly

Relatos reproduzíveis, melhorias na interface e correções dos extratores ajudam
a ampliar a cobertura da extensão. Use os formulários de issues para bugs e ideias.
Para vulnerabilidades, siga a política de segurança. [Política de segurança](SECURITY.md)

## Preparar uma alteração

Com suas alterações anteriores salvas, atualize a base e crie uma branch.

```sh
git switch main
git pull --ff-only
git switch -c fix/nome-da-correcao
npm ci
```

Use nomes como `fix/deteccao-instagram`, `feat/nova-opcao` e `docs/instalacao`.
Mantenha cada PR focado em um problema e respeite as decisões descritas no plano
técnico. [Plano técnico](SPEC.md)

## Validar

```sh
npm run check
npm test
npm run build
```

Para alterações de detecção e navegação, execute também os testes de navegador
depois do build.

```sh
npx playwright install chromium
npm run test:e2e
```

Essa suíte usa Chromium com a extensão compilada e páginas controladas para
reproduzir os cenários das três redes. O CI executa a suíte na combinação Linux
com Node 24 e anexa traces quando há falha.

Para mudanças no player, na detecção, na conversão ou no download, teste também
a extensão no navegador. Registre plataforma, navegador e o caminho usado para
abrir o vídeo. O CI cobre os testes automatizados presentes no projeto.

Revise a alteração antes de enviar e adicione os arquivos específicos do trabalho.

```sh
git diff
git add caminho/do/arquivo
git commit -m "fix: descreve a correcao"
git push -u origin HEAD
```

## Abrir o pull request

Abra um PR para `main` e preencha o modelo com a mudança, os testes e as limitações.
Use capturas para alterações visuais e exemplos públicos para problemas de mídia.
O modelo fica disponível após entrar na branch padrão.

O workflow **CI** testa Node 22 e 24 em Linux e Windows, verifica TypeScript e gera
os builds de Chrome e Firefox. Uma combinação também audita vulnerabilidades
altas e críticas. O check **CI aprovado** reúne o resultado da matriz.

Em **Actions → execução → Artifacts**, os pacotes
`snagly-<sistema>-node<versão>` ficam disponíveis por sete dias. Extraia o pacote
e carregue a pasta do navegador desejado para testar. As execuções mais recentes
substituem as anteriores do mesmo PR.

O Dependabot propõe atualizações semanais de npm e GitHub Actions. Revise a
compatibilidade e o resultado do CI antes de integrar uma atualização.

## Resolver conflitos

O GitHub identifica conflitos no PR. Na sua branch de trabalho, atualize a base.

```sh
git fetch origin
git merge origin/main
```

Resolva os arquivos indicados, adicione os arquivos resolvidos com `git add` e
conclua com `git commit`. Rode as verificações e faça `git push`. O CI do evento
`pull_request` pode executar novamente depois da resolução. [Eventos de pull request](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request)

## Revisão

Explique suas decisões e responda às observações com respeito. Nas mudanças de
rede e mídia, confira os limites de tamanho, os domínios aceitos e as permissões
solicitadas. Confira também se o README descreve o comportamento entregue.

O código do projeto usa a licença MIT. As dependências seguem suas próprias
licenças. [Licença do projeto](LICENSE)
