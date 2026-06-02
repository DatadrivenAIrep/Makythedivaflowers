#!/usr/bin/env bash
# convert-corsage-photos.sh
#
# Converts the real corsage/boutonnière photos from ~/Downloads/Coursages/
# into WebP files and places them in public/corsages/.
#
# Usage:
#   chmod +x tools/convert-corsage-photos.sh
#   ./tools/convert-corsage-photos.sh
#
# Then open /tmp/corsages-preview in Finder, pick:
#   - 3 hero photos → copy as hero-1.webp, hero-2.webp, hero-3.webp
#   - 4 product photos → copy as rose-corsage.webp, rose-boutonniere.webp,
#                                 orchid-corsage.webp, orchid-boutonniere.webp
#
# This replaces the placeholder images in public/corsages/.

set -e

SOURCE=~/Downloads/Coursages
TMPDIR=/tmp/corsages-jpegs
PREVIEW=/tmp/corsages-preview
DEST="$(dirname "$0")/../public/corsages"

echo "→ Creating temp directories..."
mkdir -p "$TMPDIR" "$PREVIEW"

echo "→ Converting HEIC files to JPEG..."
for f in "$SOURCE"/*.HEIC "$SOURCE"/*.heic; do
  [ -f "$f" ] || continue
  stem=$(basename "$f")
  stem="${stem%.*}"
  sips -s format jpeg "$f" --out "$TMPDIR/$stem.jpg" 2>/dev/null
  echo "  ✓ $stem.jpg"
done

echo "→ Converting PNG files to JPEG..."
for f in "$SOURCE"/*.PNG "$SOURCE"/*.png; do
  [ -f "$f" ] || continue
  stem=$(basename "$f")
  stem="${stem%.*}"
  sips -s format jpeg "$f" --out "$TMPDIR/$stem.jpg" 2>/dev/null
  echo "  ✓ $stem.jpg"
done

echo "→ Converting JPEGs to WebP (q=85)..."
for f in "$TMPDIR"/*.jpg; do
  [ -f "$f" ] || continue
  stem=$(basename "$f" .jpg)
  cwebp -q 85 "$f" -o "$PREVIEW/$stem.webp" -quiet
  echo "  ✓ $stem.webp"
done

echo ""
echo "✅ Preview files are in: $PREVIEW"
echo ""
echo "Opening Finder at preview directory..."
open "$PREVIEW"
echo ""
echo "Now choose your files and copy them to $DEST/"
echo ""
echo "Example (replace IMG_XXXX with your picks):"
echo "  cp $PREVIEW/IMG_8082.webp $DEST/hero-1.webp"
echo "  cp $PREVIEW/IMG_7634.webp $DEST/hero-2.webp"
echo "  cp $PREVIEW/IMG_9245.webp $DEST/hero-3.webp"
echo "  cp $PREVIEW/IMG_7629.webp $DEST/rose-corsage.webp"
echo "  cp $PREVIEW/IMG_7630.webp $DEST/rose-boutonniere.webp"
echo "  cp $PREVIEW/IMG_8083.webp $DEST/orchid-corsage.webp"
echo "  cp $PREVIEW/IMG_8085.webp $DEST/orchid-boutonniere.webp"
