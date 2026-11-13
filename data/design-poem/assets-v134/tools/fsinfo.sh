#!/bin/zsh
# fsinfo.sh <user>/<id> ... → id | licence | duration | title | preview
for p in "$@"; do
  u=${p%/*}; id=${p#*/}
  curl -s -A "Mozilla/5.0" "https://freesound.org/people/$u/sounds/$id/" > /tmp/fs1.html
  lic=$(grep -oE '(Creative Commons 0|Attribution NonCommercial [0-9.]+|Attribution [0-9.]+|Sampling\+?)' /tmp/fs1.html | head -1)
  dur=$(grep -oE 'bw-icon-clock[^0-9]*[0-9:.]+' /tmp/fs1.html | grep -oE '[0-9:.]+$' | head -1)
  [ -z "$dur" ] && dur=$(grep -oE '[0-9]+:[0-9]{2}' /tmp/fs1.html | head -1)
  title=$(grep -oE '<title>[^<]*' /tmp/fs1.html | sed 's/<title>//' | head -1)
  prev=$(grep -oE 'https://cdn.freesound.org/previews/[^"]+-hq.mp3' /tmp/fs1.html | head -1)
  echo "$u/$id | $lic | $dur | $title | $prev"
  sleep 1
done
