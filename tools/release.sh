#!/bin/sh
# Release the current preview to the live app (michaelmatusikjr/readfast-app, main). Only on Mick's OK.
# Needs readfast-app attached with push access and cloned at LIVE_DIR (default /home/user/readfast-app).
# Copies every tracked file here into readfast-app as the normal "Tooz" app, commits "Release <version>" on its main,
# pushes, and appends the release (with how to undo it) to docs/RELEASES.md here. Commit and push that log afterwards.
set -e
R=$(cd "$(dirname "$0")/.." && pwd)
LIVE=${LIVE_DIR:-/home/user/readfast-app}
[ -d "$LIVE/.git" ] || { echo "No readfast-app clone at $LIVE"; exit 1; }
cd "$R"
[ -z "$(git status --porcelain)" ] || { echo "Commit the preview work first"; exit 1; }
SHA=$(git rev-parse --short HEAD)
VER=$(grep -o "APP_VERSION='[^']*'" src/g_extra.js | cut -d"'" -f2)

cd "$LIVE"
git fetch -q origin main && git checkout -q -B main origin/main
BEFORE=$(git rev-parse --short HEAD)
find "$LIVE" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
(cd "$R" && git ls-files | while read -r f; do mkdir -p "$LIVE/$(dirname "$f")"; cp "$R/$f" "$LIVE/$f"; done)
(cd "$LIVE/src" && python3 assemble.py)
python3 "$R/tools/brand.py" live "$LIVE"
cat > "$LIVE/CLAUDE.md" <<EOT
# Tooz eReader — live app

This repo is what GitHub Pages serves as the live app. **Don't work here.** All work happens in
\`michaelmatusikjr/ToozeReader-preview\` (read its CLAUDE.md); \`tools/release.sh\` there copies each approved
release into this repo. Releases and how to undo them are listed in that repo's \`docs/RELEASES.md\`.
EOT
cp "$LIVE/CLAUDE.md" "$LIVE/README.md"
git add -A
if git diff --cached --quiet; then echo "Live already matches preview ($VER)"; exit 0; fi
git commit -q -m "Release $VER" -m "From ToozeReader-preview $SHA"
for k in 1 2 3 4; do git push -q origin main && break; sleep $((k*2)); done
AFTER=$(git rev-parse --short HEAD)

cd "$R"
[ -f docs/RELEASES.md ] || printf '# Live releases\n\nEach release copied from preview to the live app (readfast-app `main`), newest last.\nTo undo one: in readfast-app, `git revert <live commit>` and push (or say "revert release <version>").\n\n| Date | Version | Preview commit | Live before | Live commit |\n|---|---|---|---|---|\n' > docs/RELEASES.md
echo "| $(date +%Y-%m-%d) | $VER | $SHA | $BEFORE | $AFTER |" >> docs/RELEASES.md
echo "Released $VER to live ($BEFORE -> $AFTER). Logged in docs/RELEASES.md; commit and push it."
