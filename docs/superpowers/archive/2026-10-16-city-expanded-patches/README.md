# Scripts históricos — expansão Cidade Dorme (16/10/2026)

Os oito scripts Python nesta pasta foram usados como transformações textuais
pontuais durante a implementação e os testes da expansão de papéis do Cidade
Dorme. Os arquivos foram preservados integralmente, retirados da raiz do
worktree e versionados para manter o histórico do desenvolvimento.

**Não execute novamente em uma árvore atualizada:** eles modificam arquivos
por substituição literal, pressupõem estados anteriores específicos e podem
aplicar edições incompatíveis ao runtime mais recente. Use os commits e os
testes da expansão como referência de comportamento, não estes scripts para
atualizações ou migrations.

A versão funcional correspondente permanece na branch
`feat/cidade-dorme-expanded-roles-01`. O arquivo gerado
`android/capacitor.settings.gradle`, cujas únicas mudanças apontavam para
`../../galerows/node_modules` neste worktree, foi restaurado à versão
portável já versionada, pois é recriado em `npx cap sync android`.
