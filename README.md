# AutoMotion Studio V20 — Black Documentary

Editor mobile-first para motion design automático em vídeos científicos e documentários.

## Fluxo

`vídeo → transcrição marcada → parser → plano visual → design → render MP4`

Não há Whisper no projeto e não há geração de efeitos sonoros. A exportação preserva o áudio original.

## Formato preferencial da transcrição

```text
(0:08) Há 4 bilhões e 600 milhões de anos, algo aconteceu nesta região da galáxia.
(0:14) E o que aconteceu não foi calmo.
(0:20) Não havia sol. Não havia terra.
(0:22) Havia apenas uma nuvem escura de gás e poeira, fria e imóvel.
```

Também há suporte a SRT, VTT e JSON.

## Estrutura

- `src/core/parser.js` — timestamps e formatos.
- `src/core/planner.js` — detecção de fatos/processos.
- `src/core/designSystem.js` — tokens e presets.
- `src/core/motionRenderer.js` — linguagem visual no preview/render.
- `src/core/mediaRenderer.js` — Mediabunny + WebCodecs.
- `src/ui/app.js` — interface e fluxo do editor.
- `styles/main.css` — interface e tokens visuais.
- `assets/` — assets astronômicos locais.
- `docs/` — decisões de design e arquitetura.
- `examples/` — transcrição de exemplo.

## Testes

O smoke test cobre o formato `(0:08)`, a conversão de `4 bilhões e 600 milhões` para `4,6 bilhões`, cenas consecutivas sem sobreposição indevida e a regra de posição à direita. Rode `node tests/smoke.mjs` a partir de `tests/` ou ajuste o diretório de execução conforme seu ambiente.

## Biblioteca de mídia

A V20 usa Mediabunny 1.61.0, versão publicada em 29 de setembro de 2026. O pacote é carregado por ESM no navegador e usa WebCodecs quando disponível.

## Princípios de design

A linguagem visual evita cards pesados, excesso de cor e decoração. O painel fica sempre à direita, com fundo preto translúcido, uma regra vertical discreta, tipografia sans serif e números com tratamento monoespaçado quando apropriado. A ideia é explicar a informação sem competir com o vídeo.
