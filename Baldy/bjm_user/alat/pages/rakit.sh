#!/usr/bin/env bash
# Merakit demo GitHub Pages: publish WebAssembly mandiri, pasang index.html + 404.html (fallback SPA) + .nojekyll.
# Pakai: alat/pages/rakit.sh <folder-keluaran> <base-href>   (dijalankan dari folder bjm_user)
set -euo pipefail
KELUAR="${1:?folder keluaran}"; BASE="${2:-/}"
rm -rf "$KELUAR.publish" "$KELUAR"
dotnet publish bjm_user.Client/bjm_user.Client.csproj -c Release -p:SikotisMandiri=true -o "$KELUAR.publish" -nologo -v q
mkdir -p "$KELUAR"
cp -r "$KELUAR.publish/wwwroot/." "$KELUAR/"
LAIN=""
for f in "$KELUAR"/css/*.css; do
  n=$(basename "$f")
  case "$n" in bootstrap.css|sikotis.css|komponen.css|cetak.css|trip.css) ;; *) case "$n" in *.*.css) ;; *) LAIN="$LAIN<link rel=\"stylesheet\" href=\"css/$n\" />";; esac;; esac
done
sed -e "s#__BASE__#$BASE#" -e "s#__CSS_LAIN__#$LAIN#" alat/pages/index.html > "$KELUAR/index.html"
cp "$KELUAR/index.html" "$KELUAR/404.html"
touch "$KELUAR/.nojekyll"
rm -rf "$KELUAR.publish"
echo "Demo dirakit di $KELUAR (base $BASE): $(du -sh "$KELUAR" | cut -f1)"
