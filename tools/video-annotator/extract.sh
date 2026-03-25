#!/bin/bash
# Extract frames from a video file
# Usage: ./extract.sh <video_file> [fps]
# fps defaults to 1 (one frame per second). Use higher values for more granularity.

set -euo pipefail

VIDEO="${1:?Usage: ./extract.sh <video_file> [fps]}"
FPS="${2:-1}"
OUT_DIR="./frames"

if [ ! -f "$VIDEO" ]; then
  echo "Error: File '$VIDEO' not found"
  exit 1
fi

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

echo "Extracting frames at ${FPS} fps from: $VIDEO"
ffmpeg -i "$VIDEO" -vf "fps=${FPS}" -q:v 2 "$OUT_DIR/frame_%04d.jpg" -hide_banner -loglevel warning

COUNT=$(ls "$OUT_DIR" | wc -l | tr -d ' ')
echo "Extracted $COUNT frames to $OUT_DIR/"
echo ""
echo "Now open annotator.html in your browser to review and annotate frames."
