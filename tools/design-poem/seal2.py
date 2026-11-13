# v135 poem seals (Wilson picked option 1 of design-poem-seals2.html): one 白文方印「姓氏+字」 per poet, the 赵孟頫「赵氏子昂」
# form, drawn exactly as that option (baiwen() of seals-cmp.py: same font, cut, chips and ink filter). A poet with no recorded
# 字 keeps a name seal 「姓名之印」(崔颢 岑参); 唐玄宗 has no 字 either → 「李隆基印」. Traditional forms, as the seal font has them.
# Table with sources: README v135. Writes data/design-poem/seal/<id>.svg (ids = SEALS in design-poem.html).
# usage: python3 tools/design-poem/seal2.py /path/to/chongxi_seal.otf   (download: xiaoxue.iis.sinica.edu.tw/chongxi)
import os
src = open(os.path.join(os.path.dirname(__file__), 'seals-cmp.py')).read()
exec(src[:src.index('os.makedirs(OUT')])
OUT = 'data/design-poem/seal/'
POETS = [('baidi', '李氏太白'), ('chunwang', '杜氏子美'), ('huanghelou', '崔顥之印'), ('poet-xuedaoheng', '薛氏玄卿'),
         ('poet-wangbo', '王氏子安'), ('poet-luobinwang', '駱氏觀光'), ('poet-chenziang', '陳氏伯玉'), ('poet-wangwei', '王氏摩詰'),
         ('poet-wangchangling', '王氏少伯'), ('poet-menghaoran', '孟氏浩然'), ('poet-wangzhihuan', '王氏季凌'),
         ('poet-zhangjiuling', '張氏子壽'), ('poet-hezhizhang', '賀氏季真'), ('poet-gaoshi', '高氏達夫'), ('poet-censhen', '岑參之印'),
         ('poet-zhangji', '張氏懿孫'), ('poet-lilongji', '李隆基印')]
for k, (pid, text) in enumerate(POETS):
    s = baiwen(text, '#b8231a', 121 + k * 10).replace('seals-cmp.py', 'seal2.py')  # 李白 = seed 121 = option 1 itself
    open(OUT + pid + '.svg', 'w').write(s); print(pid, text)
