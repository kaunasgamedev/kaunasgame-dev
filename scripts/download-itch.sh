#!/usr/bin/env bash
# Usage: download-itch.sh https://account.itch.io/game
# Writes the 256px cover jpg to cwd, prints the games yaml entry
# Needs curl and ffmpeg
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "usage: $0 URL" >&2
  exit 1
fi

url="${1%/}"
if [[ ! "$url" =~ ^https://([^.]+)\.itch\.io/([^/?#]+)$ ]]; then
  echo "not a game url: $url" >&2
  exit 1
fi

account="${BASH_REMATCH[1]}"
slug="${BASH_REMATCH[2]}"

# One line so the table rows are greppable
page=$(curl -fsSL -A "Mozilla/5.0 (kaunasgame.dev)" "$url" | tr -d '\n')

unescape() {
  sed 's/&amp;/\&/g; s/&#0*39;/'"'"'/g; s/&quot;/"/g; s/&lt;/</g; s/&gt;/>/g'
}

# Link texts of one info table row, comma separated
row() {
  printf '%s' "$page" \
    | grep -o "<tr><td>$1</td><td>.*" \
    | sed 's#</td></tr>.*##' \
    | grep -o '>[^<]*</a>' \
    | sed 's/^>//; s#</a>$##' \
    | paste -sd ',' - \
    | sed 's/,/, /g' \
    | unescape
}

authors=$(row 'Authors\?' || true)
authors="${authors:-$account}"

# Entry is the account, the game lists everyone
user="${authors%%,*}"

title=$(printf '%s' "$page" | grep -o '<title>[^<]*</title>' | sed 's/<[^>]*>//g' | unescape)
title="${title% by $authors}"

platforms=$(row 'Platforms' | tr 'A-Z' 'a-z' | sed 's/html5/web/g' || true)

# Cover, resized with ffmpeg
thumbnail="none"
cover=$(printf '%s' "$page" | grep -o '<meta content="[^"]*" property="og:image"' | sed 's/<meta content="//; s/" property.*//' || true)
if [ -n "$cover" ]; then
  thumbnail="$account--$slug.jpg"
  curl -fsSL -A "Mozilla/5.0 (kaunasgame.dev)" "$cover" -o cover.tmp
  # Animated gif covers: first frame only
  ffmpeg -loglevel error -y -i cover.tmp -frames:v 1 -vf 'scale=256:-2' -q:v 4 "$thumbnail"
  rm cover.tmp
fi

# Quote titles yaml would trip on
case "$title" in
  *[:#\"\']*) title="\"${title//\"/\\\"}\"" ;;
esac

echo "  - user: $user"
echo "    url: https://$account.itch.io"
echo "    games:"
echo "      - title: $title"
echo "        url: $url"
if [ "$thumbnail" != "none" ]; then
  size=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$thumbnail")
  echo "        thumbnail:"
  echo "          url: thumbnails/$thumbnail"
  echo "          width: ${size%,*}"
  echo "          height: ${size#*,}"
fi
echo "        authors:"
printf '%s\n' "${authors//, /$'\n'}" | sed 's/^/          - /'
if [ -n "$platforms" ]; then
  echo "        platforms:"
  printf '%s\n' "${platforms//, /$'\n'}" | sed 's/^/          - /'
fi

echo >&2
echo "thumbnail: $thumbnail" >&2
