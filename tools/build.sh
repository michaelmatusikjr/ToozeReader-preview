#!/bin/sh
# Build the preview app at the repo root (what GitHub Pages serves as Tooz Preview).
set -e
R=$(cd "$(dirname "$0")/.." && pwd)
(cd "$R/src" && python3 assemble.py)
python3 "$R/tools/brand.py" preview "$R"
