#!/usr/bin/env bash
set -euo pipefail
# Generates bundled pt-BR narration assets on macOS. Files are committed; Android never runs this script.
command -v say >/dev/null || { echo 'macOS say required' >&2; exit 1; }
command -v afconvert >/dev/null || { echo 'macOS afconvert required' >&2; exit 1; }
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/assets/cidade-dorme/narracao"
mkdir -p "$OUT"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
while IFS='|' read -r file narration; do
  [[ -z "$file" || "$file" == \#* ]] && continue
  say -v Luciana -r 150 -o "$TMP/$file.aiff" "$narration"
  afconvert "$TMP/$file.aiff" "$OUT/$file.m4a" -f m4af -d aac -b 64000
done <<'NARRATION'
reveal|A cidade está pronta. Descubram seus papéis em segredo.
killer-turn|A cidade dorme. Todos fecham os olhos. Assassino, acorde e escolha a sua vítima.
doctor-turn|Assassino, volte a dormir. Médico, acorde e escolha quem deseja proteger.
detective-turn|Médico, volte a dormir. Detetive, acorde e investigue uma pessoa.
morning|A cidade acorda. Abram os olhos. A noite terminou.
discussion|A cidade desperta para o mistério. Conversem e descubram quem pode ser o assassino.
voting|A discussão acabou. É hora de votar. Cada jogador escolhe uma pessoa em segredo.
vote-result|Os votos foram apurados. A cidade conhece o resultado.
summary|O jogo terminou. A cidade revela seus segredos.
NARRATION
echo "Gerei $(find "$OUT" -name '*.m4a' | wc -l | tr -d ' ') arquivos de narração offline em $OUT"
du -ch "$OUT"/*.m4a | tail -1
