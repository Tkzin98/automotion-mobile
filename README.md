# AutoMotion Mobile V7 — Astronomy Information Engine

A V7 troca a lógica de “palavra → card” por “afirmação mensurável → visualização”. O foco é documentário de astronomia.

Detecta localmente padrões de comparação (`318 vezes`), percentual, distância (`150 milhões de km`), tempo/escala temporal, temperatura, velocidade e quantidades contextualizadas.

O fluxo continua usando Whisper Tiny via Transformers.js no navegador; CPU/WASM é o caminho principal e WebGPU só é usado quando disponível. FFmpeg permanece opcional e só é carregado para conversão MP4.

Cada afirmação recebe timestamp, tipo, valor e unidade. A lista no app mostra o texto que ativou o gráfico. Um duplo toque alterna o gráfico entre ativo e desativado.

V7 ainda é um motor local leve: não tenta resolver todas as ambiguidades de linguagem com um LLM grande. O objetivo desta etapa é criar a fundação do motor “informação → visualização” com baixo consumo e funcionamento gratuito no celular.
