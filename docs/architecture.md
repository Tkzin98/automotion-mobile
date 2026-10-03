# Arquitetura

## Core

O parser aceita `(min:seg) texto`, SRT, VTT e JSON.

O planner converte um cue em uma cena estruturada:

`{ type, title, data, subtitle, start, end, processKind, enabled }`

Tipos iniciais:

- timeline
- process
- headline
- editorial
- statement
- comparison
- scale
- percentage
- distance
- speed
- duration

O renderer é compartilhado entre preview e exportação, reduzindo divergência visual.

## Render

Mediabunny 1.61.0 + WebCodecs. O frame original é desenhado no canvas e os motions são compostos em seguida. O áudio original é adicionado separadamente ao MP4. Não existe pipeline de SFX.
