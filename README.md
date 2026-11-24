# 🎬 Snagly

**Gostou do vídeo? Leve com você.**

Baixe vídeos e extraia áudio do X/Twitter, Instagram e Facebook direto no navegador. Clique com o botão direito, confira a prévia e escolha a resolução ou a qualidade do MP3.

<p align="center">
  <img src="https://img.shields.io/badge/extens%C3%A3o-Manifest_V3-6366f1" alt="Extensão Manifest V3">
  <img src="https://img.shields.io/badge/v%C3%ADdeo-MP4-22c55e" alt="Vídeo MP4">
  <img src="https://img.shields.io/badge/%C3%A1udio-MP3-f59e0b" alt="Áudio MP3">
  <img src="https://img.shields.io/badge/convers%C3%A3o-local-38bdf8" alt="Conversão local">
  <img src="https://img.shields.io/badge/status-em_desenvolvimento-f97316" alt="Em desenvolvimento">
</p>

---

## ✨ Do post para os seus arquivos

Encontrou um vídeo que quer guardar ou um trecho que prefere ouvir depois? O Snagly coloca as opções de download perto do conteúdo que você está vendo.

- 🖱️ **Botão direito e pronto.** Escolha **Baixar com Snagly** na publicação para abrir a janela de download.
- 🎞️ **Veja antes de salvar.** Confira a prévia com play, pausa e controle de volume.
- 🎚️ **Escolha a resolução.** As versões disponíveis do mesmo vídeo do X ficam reunidas em um cartão. Selecionar uma opção inicia o download.
- 🎵 **Leve só o áudio.** Converta para MP3 com 128, 192 ou 320 kbps e amostragem de 44,1 ou 48 kHz.
- 💻 **Converta no seu dispositivo.** O codificador de áudio acompanha a extensão e carrega quando você usa a conversão.
- 📥 **Acompanhe pelo navegador.** Depois de entregar o arquivo ao gerenciador nativo, o Snagly pode fechar sua janela automaticamente.

## 🚀 Como usar

1. Abra a publicação ou o vídeo na rede social.
2. Clique com o botão direito e selecione **Baixar com Snagly**. Você também pode usar o ícone da extensão.
3. Confira o vídeo na prévia.
4. Escolha uma resolução em **MP4** ou uma qualidade em **MP3**.
5. Acompanhe o arquivo nos downloads do navegador.

No MP3, mantenha a janela aberta durante a conversão. Ela fecha automaticamente depois de entregar o arquivo ao navegador, se a opção de fechamento estiver marcada. O aviso nativo de download segue as configurações do seu navegador.

> Baixe conteúdo que você tem direito de salvar.

## 🌐 Onde funciona

| Plataforma | O que o Snagly procura |
| --- | --- |
| **X / Twitter** | Versões MP4 vinculadas ao tuíte escolhido, com resoluções agrupadas e identificação da publicação para evitar misturar vídeos das respostas. |
| **Instagram** | Vídeos de publicações, Reels e carrosséis, incluindo players carregados no feed, Explorar e publicações abertas pela DM. |
| **Facebook** | Fontes progressivas de vídeos, Reels e links Watch, com versões SD e HD quando disponíveis. |

A cobertura depende das fontes que cada publicação disponibiliza. No Instagram, abra a publicação compartilhada pela DM para carregar o player quando o cartão da mensagem ainda não expuser os dados do vídeo.

Quando a primeira leitura do Instagram falha, o Snagly pode consultar imediatamente os metadados da publicação no próprio site. No X e no Facebook, os botões de consulta pública oferecem uma alternativa quando o player carregado não fornece um arquivo compatível.

## 📦 Instalação

A instalação atual é manual, a partir do código deste repositório. Para gerar a extensão, use **Node.js 22 ou superior** e npm.

```sh
git clone https://github.com/EduardoLopes085/Snagly.git
cd Snagly
npm ci
npm run build
```

### Chrome e navegadores Chromium

1. Abra a página de extensões do navegador. No Chrome, use `chrome://extensions`.
2. Ative o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação**.
4. Selecione a pasta `.output/chrome-mv3`.

### Firefox

Use **Firefox 140 ou superior**.

1. Abra `about:debugging#/runtime/this-firefox`.
2. Clique em **Carregar extensão temporária**.
3. Selecione `.output/firefox-mv3/manifest.json`.

O carregamento temporário precisa ser repetido após reiniciar o Firefox.

**Atualizou o código?** Rode `npm run build`, recarregue a extensão e atualize a página da rede social.

## 🔒 Privacidade e permissões

O Snagly busca a mídia quando você abre sua janela ou solicita uma nova busca. O processamento e a conversão acontecem no navegador, com acesso às plataformas para obter os metadados e os arquivos.

- **Acesso à aba e aos players.** A extensão usa `activeTab`, `scripting` e um script restrito às redes suportadas para identificar o conteúdo escolhido.
- **Menu e downloads.** As permissões `contextMenus` e `downloads` permitem oferecer o atalho de botão direito e entregar os arquivos ao navegador.
- **Consultas opcionais.** O acesso ao serviço público do X e aos domínios de mídia usados na conversão depende da autorização correspondente.
- **Sessão do Instagram.** A consulta aos metadados usa sua sessão na própria origem do Instagram.

As consultas públicas do X e do Facebook são feitas sem cookies. A extensão opera sem servidor próprio e sem telemetria. Os dados de detecção ficam temporariamente em memória, e o navegador administra seu histórico de downloads.

## 🧩 Quando o vídeo não aparece

Reproduza o vídeo e use **Buscar novamente**. No Instagram, a busca também faz até três tentativas curtas para acompanhar o carregamento do player, com uma única consulta de metadados por publicação em cada busca.

Se a falha continuar, abra **Dados para diagnosticar esta busca**, quando disponível, e copie o resultado ao relatar o problema. Informe também o navegador e, se possível, um link público de exemplo. O diagnóstico mostra contagens, tipos de fonte e o resultado das etapas da busca.

### Limites da versão atual

| Recurso | Condição atual |
| --- | --- |
| Download de vídeo | Depende de uma fonte progressiva compatível disponível na publicação. |
| Conversão para MP3 | Arquivo de entrada de até **64 MB** e áudio de até **10 minutos**. O navegador precisa conseguir decodificar a faixa de áudio. |
| Memória durante a conversão | O áudio é decodificado em memória. O processamento usa um worker, encerrado ao terminar. |
| Áudio separado no Instagram | O vídeo salvo pode ficar sem som quando a plataforma fornece as faixas separadamente. |
| HLS, DASH e conteúdo protegido | Indisponíveis nesta versão. |

## 🛠️ Para quem desenvolve

O projeto usa **TypeScript, WXT e Manifest V3**, com builds para Chrome e Firefox. A interface usa HTML, CSS e DOM nativos. A conversão MP3 usa `@breezystack/lamejs` em um worker carregado sob demanda.

```sh
npm ci
npm run check
npm test
npm run build
```

Os extratores relacionam a mídia à publicação, validam os domínios e limitam a análise dos dados da página. No Instagram e no X, a leitura dos dados do player pode ocorrer no contexto da página, com revalidação dos resultados pela extensão.

A prévia é descarregada ao fechar a janela, e os recursos temporários da conversão são liberados para coleta pelo navegador. As pastas de build, caches e perfis de teste ficam fora do versionamento.

Consulte o plano técnico e o registro de validação para acompanhar a arquitetura, os testes e os próximos marcos. [Plano técnico](SPEC.md) · [Validação inicial](docs/validacao-m1.md)

## 🗺️ Próximos passos

- [x] Download progressivo pelo gerenciador nativo.
- [x] Menu de contexto com prévia e seleção de resolução.
- [x] Conversão local para MP3.
- [x] Extratores para X, Instagram e Facebook.
- [ ] Ampliar a cobertura com testes em mais publicações e navegadores.
- [ ] Implementar o motor HLS e validar a união de faixas separadas.
- [ ] Evoluir armazenamento e retomada de trabalhos.
- [ ] Preparar a distribuição nas lojas de extensões.

## 🤝 Contribuindo

Encontrou uma publicação que o Snagly não reconhece? Relate o navegador, o caminho usado para abrir o vídeo e o resultado da busca. Exemplos públicos ajudam a reproduzir o problema. Sugestões e pull requests também são bem-vindos.

## 📄 Licenças

A licença do projeto está pendente de definição. O codificador `@breezystack/lamejs` 1.2.7 é distribuído sob LGPL-3.0, com aviso incluído na extensão. Para substituir o codificador, altere a dependência e gere o build novamente. [Aviso da biblioteca](public/LAMEJS-LICENSE.txt) · [Código-fonte da biblioteca](https://github.com/shijinyu/lamejs)
