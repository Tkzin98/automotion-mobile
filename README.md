# AutoMotion Studio V12

Editor mobile-first para criar visualizações científicas automaticamente a partir da narração do vídeo.

## Fluxo
1. Importar vídeo
2. Escolher um design visual
3. Mediabunny extrai o áudio localmente
4. Whisper via Transformers.js transcreve com timestamps
5. O analisador local identifica fatos quantitativos e escolhe o tipo de visual
6. Preview e renderização ficam no navegador com Mediabunny/WebCodecs

A primeira análise baixa o modelo Whisper. Depois o navegador pode reutilizá-lo pelo cache.

## Publicação
Substitua `index.html`, `app.js`, `estilos.css`, `sw.js`, `manifesto.webmanifest` no GitHub Pages.

## Nota
A V12 usa regras locais determinísticas para transformar números, unidades e relações em gráficos. Isso mantém o processamento da narração local e previsível, mas a cobertura semântica ainda é menor que a de um LLM geral.
