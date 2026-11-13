#!/usr/bin/env python3
# Build data/dem.bin for map3d.html: real elevation (Int16 metres, little-endian) on an 800x466 grid,
# lon 72–142, lat 52–18 (row 0 = north), from free AWS/Mapzen Terrarium tiles at zoom 5 (x 22–28, y 10–14).
# python3 gen-dem.py   (needs Pillow; downloads ~3 MB of tiles into /tmp/dem)
import math, array, os, urllib.request
from PIL import Image
Z=5; N=2**Z; os.makedirs('/tmp/dem', exist_ok=True); tiles={}
for x in range(22,29):
    for y in range(10,15):
        f=f'/tmp/dem/t_{x}_{y}.png'
        if not os.path.exists(f): urllib.request.urlretrieve(f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{x}/{y}.png', f)
        tiles[(x,y)]=Image.open(f).convert('RGB').load()
def elev(lon,lat):
    xt=(lon+180)/360*N; lr=math.radians(lat); yt=(1-math.log(math.tan(lr)+1/math.cos(lr))/math.pi)/2*N
    tx,ty=int(xt),int(yt); r,g,b=tiles[(tx,ty)][min(255,int((xt-tx)*256)),min(255,int((yt-ty)*256))]
    return (r*256+g+b/256)-32768
GW,GH=800,466; out=array.array('h')
for j in range(GH):
    la=52-(j+.5)/GH*34
    for i in range(GW): out.append(int(max(-32000,min(32000,elev(72+(i+.5)/GW*70,la)))))
open(os.path.join(os.path.dirname(__file__) or '.','data','dem.bin'),'wb').write(out.tobytes())
