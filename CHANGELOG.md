# Changelog

## V20

- Projeto reorganizado em módulos `src/core`, `src/ui`, `styles`, `docs`, `examples` e `assets`.
- Removida a arquitetura de efeitos sonoros; apenas o áudio original é preservado.
- Design monocromático com painel translúcido fixo à direita.
- Presets Obsidian, Aperture, Archive e Eclipse, todos dentro da mesma linguagem preta.
- Posição vertical automática ou fixa, com safe area.
- Parser robusto para `(0:08)`, SRT, VTT e JSON.
- Planejador atualizado para não deixar um motion permanecer por toda a duração de um cue longo.
- Timestamp “4 bilhões e 600 milhões” convertido para “4,6 bilhões de anos”.
- Preview e render usam o mesmo renderer de motion.
- Adicionado smoke test automatizado.
