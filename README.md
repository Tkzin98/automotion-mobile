# AutoMotion Mobile V9

V9 divide o trabalho em duas partes:

- Celular: vídeo, Whisper, timestamps, detecção de afirmações e planejamento das visualizações.
- Google Colab: renderização final com FFmpeg, para não travar o navegador do celular.

## Fluxo
1. Abra o AutoMotion e escolha o vídeo.
2. Analise as informações.
3. Toque em **Exportar projeto para Colab**.
4. Baixe o `automotion-astronomia-project.json`.
5. Abra `colab/AutoMotion_Renderer.ipynb` no Google Colab.
6. No notebook, envie o JSON e o vídeo original.
7. Execute o render e baixe o MP4 final.

O botão WebM local continua disponível somente para testes curtos.

## GitHub Pages
Depois de copiar a pasta para `main`, o notebook poderá ser aberto pelo Colab usando:
`https://colab.research.google.com/github/tkzin98/automotion-mobile/blob/main/colab/AutoMotion_Renderer.ipynb`
