#!/usr/bin/env python3
"""One-off merge (2026-11-10, 人物视角 v2): builds data/people.json from the old people.json (李世民 玄奘 玄宗 贵妃 李白),
the design mock data/design-people/people.json (杜甫 王维, 李白's 梁宋 stop) and the crossings authored below.
After this run data/people.json is the source of truth; edit it directly. Kept for provenance.
  python3 tools/person-map/build-people.py   (reads the backup in /tmp if people.json already has crossings)"""
import json, os, sys
R = os.path.join(os.path.dirname(__file__), '..', '..')
src = os.path.join(R, 'data/people.json')
old = json.load(open(src))
if 'crossings' in old:
    old = json.load(open('/tmp/hs-before-personmap/people.json'))
D = json.load(open(os.path.join(R, 'data/design-people/people.json')))
dp = {p['id']: p for p in D['people']}
CH = 'https://commons.wikimedia.org/wiki/File:'
IMG = {
  'lishimin': ('唐太宗立像（后世画像，台北故宫）', CH + 'TangTaizong_(cropped).jpg'),
  'xuanzang': ('玄奘负笈图（镰仓时代，东京国立博物馆）', CH + 'Xuanzang_w.jpg'),
  'xuanzong': ('唐玄宗像（后世画像）', CH + '%E6%9D%8E%E9%9A%86%E5%9F%BA%E5%83%8F.jpg'),
  'yangguifei': ('吴友如《古今百美图》· 杨玉环（清）', CH + '%E5%8F%A4%E4%BB%8A%E7%99%BE%E7%BE%8E%E5%9C%96%E4%B9%8B%E6%A5%8A%E7%8E%89%E7%92%B0%EF%BC%88One_hundred_beauties_Yang_Yuhuan%EF%BC%89.png'),
  'libai': ('梁楷《李白行吟图》（南宋）', CH + 'LiBai.jpg'),
  'dufu': ('杜甫像（后世想象画像）', CH + 'Dufu.jpg'),
  'wangwei': ('王维像（后世想象画像）', CH + 'Wang_Wei.jpg'),
  'hezhizhang': ('王圻《三才图会》· 贺知章（明刻本）', CH + '%E8%B3%80%E7%9F%A5%E7%AB%A0_%E4%B8%89%E6%89%8D%E5%9C%96%E6%9C%83.jpg'),
  'menghaoran': ('狩野常信《三十六诗仙》· 孟浩然（日本江户时代）', CH + 'Tang_dynasty_poet_Meng_Haoran.jpg'),
  'gaoshi': ('狩野常信《三十六诗仙》· 高适（日本江户时代）', CH + 'Tang_dynasty_poet_Gao_Shi.jpg'),
}
COL = {'lishimin': '#6b3f86', 'xuanzang': '#6a6a24', 'xuanzong': '#a5781c', 'yangguifei': '#c0569a', 'libai': '#b3261b',
       'dufu': '#2f5d8a', 'wangwei': '#3f7a5c', 'hezhizhang': '#7a5a3a', 'menghaoran': '#3d6680', 'gaoshi': '#8a3b2a'}

def S(year, place, ll, title, text, src, born, approx=False, **kw):
    return dict(year=year, place=place, ll=ll, approx=approx, age=year - born, title=title, text=text, src=src, **kw)

people = []
for p in old['people']:
    p = dict(p); p.pop('meet', None)
    if p['id'] == 'libai':  # the mock adds the 梁宋 stop; keep the old event links
        ev = {(s['year'], s['place']): s.get('event') for s in p['stops']}
        p['stops'] = [dict(s, **({'event': ev[(s['year'], s['place'])]} if ev.get((s['year'], s['place'])) else {})) for s in dp['libai']['stops']]
        for s in p['stops']: s.pop('reg', None)
    people.append(p)

def from_design(pid, focus, fix):
    d = dp[pid]; p = {k: d[k] for k in ('id', 'name', 'alias', 'face', 'born', 'died', 'note', 'roles')}
    p['stops'] = []
    for s in d['stops']:
        s = {k: v for k, v in s.items() if k != 'reg'}
        if (s['year'], s['place']) in fix: s['text'] = fix[(s['year'], s['place'])]
        p['stops'].append(s)
    p['focus'] = focus
    return p

dufu = from_design('dufu', [
    {'ll': [108.95, 34.3], 'r': 90, 'label': '长安'}, {'ll': [113.2, 34.9], 'r': 160, 'label': '河洛·梁宋'},
    {'ll': [104.3, 30.8], 'r': 140, 'label': '蜀中'}, {'ll': [111.2, 29.8], 'r': 220, 'label': '夔州·荆湘'}],
    {(758, '长安'): '随肃宗回长安，与王维、贾至、岑参唱和《早朝大明宫》；六月贬华州',
     (712, '巩县'): '生于河南巩县（今巩义），祖父是诗人杜审言',
     (756, '鄜州'): '安史乱起，避到鄜州羌村；只身投奔肃宗，途中被俘回长安'})
wangwei = from_design('wangwei', [
    {'ll': [109.1, 34.2], 'r': 90, 'label': '长安·辋川'}, {'ll': [112.45, 34.62], 'r': 60, 'label': '洛阳'},
    {'ll': [116.25, 36.4], 'r': 80, 'label': '济州'}],
    {(756, '洛阳·菩提寺'): '长安陷落，服药装哑，仍被押往洛阳菩提寺，被迫受伪职'})
wangwei['stops'].insert(4, S(729, '长安', [108.94, 34.26], '闲居', '离济州后回长安闲居，与孟浩然交好', '陈铁民《王维年谱》；王维《送孟六归襄阳》', 701, approx=True))
people += [dufu, wangwei]
xz = next(p for p in people if p['id'] == 'xuanzong')
if not any(s['year'] == 751 for s in xz['stops']):
    xz['stops'].insert(next(i for i, s in enumerate(xz['stops']) if s['year'] > 751), S(751, '长安', [108.94, 34.26], '皇帝', '以安禄山兼河东节度使，宠信日深', '资治通鉴·卷二一六', 685))

people += [
  dict(id='hezhizhang', name='贺知章', alias='贺季真', face='贺', born=659, died=744, cameo=True,
       note='只收与主角相交的几站。生年据其天宝三载（744）卒、年八十六推得。',
       roles=[{'from': 659, 'to': 695, 'label': '越州士子'}, {'from': 695, 'to': 744, 'label': '朝官·诗人'}],
       stops=[S(659, '越州永兴', [120.27, 30.18], '贺氏子', '生于越州永兴（今杭州萧山）', '旧唐书·贺知章传', 659, approx=True),
              S(695, '长安', [108.94, 34.26], '进士', '证圣元年进士及第，入仕', '旧唐书·贺知章传', 659),
              S(742, '长安', [108.94, 34.26], '秘书监', '读《蜀道难》，呼李白为「谪仙人」', '李白《对酒忆贺监》序；孟棨《本事诗》', 659),
              S(744, '会稽', [120.58, 30.0], '道士', '告老请为道士还乡，不久去世', '旧唐书·贺知章传', 659)]),
  dict(id='menghaoran', name='孟浩然', alias='孟襄阳', face='孟', born=689, died=740, cameo=True,
       note='只收与主角相交的几站。入京应试的年份有728、729两说。',
       roles=[{'from': 689, 'to': 728, 'label': '鹿门隐士'}, {'from': 728, 'to': 737, 'label': '求仕漫游'},
              {'from': 737, 'to': 738, 'label': '张九龄幕'}, {'from': 738, 'to': 740, 'label': '归隐襄阳'}],
       stops=[S(689, '襄阳', [112.14, 32.04], '孟氏子', '生于襄州襄阳，早年隐居鹿门山', '新唐书·孟浩然传', 689),
              S(729, '长安', [108.94, 34.26], '落第举子', '四十岁入京应进士不第，与王维交好', '王士源《孟浩然集序》；新唐书·孟浩然传', 689, approx=True),
              S(730, '江夏·黄鹤楼', [114.297, 30.547], '漫游', '东下广陵，李白在黄鹤楼相送', '李白《黄鹤楼送孟浩然之广陵》', 689, approx=True),
              S(737, '荆州', [112.19, 30.35], '张九龄幕', '张九龄贬荆州长史，辟为从事', '新唐书·孟浩然传', 689),
              S(740, '襄阳', [112.14, 32.04], '归隐', '王昌龄来访，宴饮食鲜，疽发背卒', '王士源《孟浩然集序》', 689)]),
  dict(id='gaoshi', name='高适', alias='高达夫', face='高', born=704, died=765, cameo=True,
       note='只收与主角相交的几站。生年有700、702、704等说，取704。',
       roles=[{'from': 704, 'to': 749, 'label': '布衣'}, {'from': 749, 'to': 752, 'label': '封丘尉'},
              {'from': 752, 'to': 756, 'label': '幕府书记'}, {'from': 756, 'to': 765, 'label': '节度·刺史'}],
       stops=[S(704, '渤海蓨县', [116.27, 37.75], '高氏子', '祖籍渤海蓨县，少年落拓', '旧唐书·高适传', 704, approx=True),
              S(731, '宋州', [115.65, 34.41], '客居梁宋', '客居梁宋，以渔樵自给', '旧唐书·高适传', 704, approx=True),
              S(744, '梁宋（汴州）', [114.35, 34.79], '布衣', '与李白、杜甫同游梁宋，登吹台', '杜甫《遣怀》《昔游》', 704),
              S(749, '封丘', [114.42, 35.04], '封丘尉', '举有道科，授封丘尉', '旧唐书·高适传', 704),
              S(752, '河西', [102.64, 37.93], '掌书记', '入哥舒翰幕府掌书记', '旧唐书·高适传', 704, approx=True),
              S(757, '扬州', [119.43, 32.39], '淮南节度使', '任淮南节度使，讨平永王璘', '旧唐书·高适传；资治通鉴·卷二一九', 704),
              S(760, '彭州', [103.95, 30.99], '彭州刺史', '任彭州刺史，接济成都的杜甫', '杜甫《酬高使君相赠》', 704),
              S(765, '长安', [108.94, 34.26], '散骑常侍', '以刑部侍郎、散骑常侍卒', '旧唐书·高适传', 704)]),
]
for p in people:
    p['c'] = COL[p['id']]; p['img'] = f"data/people-img/{p['id']}.jpg"
    p['imgCredit'] = {'cap': IMG[p['id']][0], 'page': IMG[p['id']][1], 'lic': 'Public domain'}

CA, LY, LD, BJ = [108.94, 34.26], [112.45, 34.62], [114.35, 34.79], [116.83, 35.55]
X = []
def C(id, a, b, year, place, ll, kind, title, text, src, **kw):
    X.append(dict(id=id, a=a, b=b, year=year, place=place, ll=ll, kind=kind, title=title, text=text, src=src, **kw))

# ---- 李白 ----
C('li-meng-730', 'libai', 'menghaoran', 730, '江夏·黄鹤楼', [114.297, 30.547], 'met', '黄鹤楼送别',
  '三月，李白在江夏黄鹤楼送孟浩然顺江东下广陵。孟浩然比李白大十二岁，李白一向敬重他，另有《赠孟浩然》：「吾爱孟夫子，风流天下闻。」这首送别诗不写离愁，只写江上一片孤帆越走越远，直到消失在天边。年份是年谱推定。',
  '李白《黄鹤楼送孟浩然之广陵》《赠孟浩然》', poem='故人西辞黄鹤楼，烟花三月下扬州', approx=True)
C('li-he-742', 'libai', 'hezhizhang', 742, '长安', CA, 'met', '「谪仙人」',
  '李白初到长安，在紫极宫遇见秘书监贺知章。贺知章读了《蜀道难》，连声赞叹，称李白是「谪仙人」——从天上贬下凡间的神仙，又解下腰间的金龟换酒同饮。这一年贺知章已八十多岁，李白四十二岁。',
  '李白《对酒忆贺监》序；孟棨《本事诗》')
C('li-xz-742', 'libai', 'xuanzong', 742, '长安', CA, 'met', '金銮殿召见',
  '秋天，玄宗下诏召李白入京。据李阳冰记载，玄宗下辇步行迎接，以七宝床赐食，亲手调羹，命他供奉翰林——替皇帝写诗作文、随时待召的文学侍从，并没有实权。',
  '李阳冰《草堂集序》；新唐书·李白传')
C('li-wang-742', 'libai', 'wangwei', 742, '长安', CA, 'near', '同城三年，互不提起',
  '两人同年出生，742至744年同在长安：李白供奉翰林，王维任左补阙。共同的朋友有孟浩然、贺知章，可是两人的诗集里找不到写给对方的一个字，也没有任何见面的记载。为什么，至今没有定论。',
  '陈铁民《王维年谱》；安旗《李白全集编年注释》', years=[742, 744])
C('li-yang-743', 'libai', 'yangguifei', 743, '长安·兴庆宫', [108.97, 34.26], 'legend', '沉香亭《清平调》',
  '传说玄宗与贵妃在沉香亭赏牡丹，召李白作新词，李白醉中写成《清平调》三首：「云想衣裳花想容。」这个故事出自晚唐笔记；「高力士脱靴、贵妃研墨」更是后来才加上的情节，正史没有记载。',
  '李濬《松窗杂录》；乐史《杨太真外传》', poem='云想衣裳花想容，春风拂槛露华浓')
C('li-he-744', 'libai', 'hezhizhang', 744, '长安', CA, 'met', '送贺监归越',
  '正月，贺知章告老，请为道士还乡会稽，玄宗率百官为他饯行，李白写《送贺宾客归越》相送。贺知章回乡不久就去世了；几年后李白到会稽，写下《对酒忆贺监》：「昔好杯中物，翻为松下尘。」',
  '李白《送贺宾客归越》《对酒忆贺监》；旧唐书·贺知章传')
C('li-xz-744', 'libai', 'xuanzong', 744, '长安', CA, 'met', '赐金放还',
  '不到两年，李白受同僚谗毁，自知不被容，上书请求还山。玄宗赏给钱财放他离京，史称「赐金放还」。他的政治梦就此落空——也正因为离开长安，这年夏天在洛阳遇见了杜甫。',
  '新唐书·李白传；李阳冰《草堂集序》')
C('li-du-744a', 'libai', 'dufu', 744, '洛阳', LY, 'met', '洛阳初遇',
  '四十三岁、名满天下的李白，在洛阳遇见三十二岁、还没有名气的杜甫。杜甫随即写《赠李白》，说自己厌倦了洛阳的机巧，想跟李白去山中访道。闻一多把这次相遇比作太阳和月亮碰了面。',
  '杜甫《赠李白》；闻一多《杜甫》', film='lidu')
C('li-du-744b', 'libai', 'dufu', 744, '梁宋（汴州）', LD, 'met', '梁宋同游（与高适）',
  '秋天，李白、杜甫和高适三人同游梁宋：登汴州吹台、单父琴台怀古，到孟诸泽打猎，喝酒论诗。三个人这时都是布衣。多年后杜甫在夔州回忆：「忆与高李辈，论交入酒垆。」',
  '杜甫《遣怀》《昔游》', film='lidu')
C('li-gao-744', 'libai', 'gaoshi', 744, '梁宋（汴州）', LD, 'met', '梁宋同游（与杜甫）',
  '秋天，李白、高适与杜甫三人同游梁宋，登吹台、琴台，射猎孟诸。高适比李白小三岁，这时还在梁宋一带客居耕钓，五年后才得到第一个小官。',
  '杜甫《遣怀》《昔游》；旧唐书·高适传')
C('li-du-745', 'libai', 'dufu', 745, '鲁郡（兖州）', BJ, 'met', '石门一别',
  '两人在东鲁再聚，一起寻访隐士范十，「醉眠秋共被，携手日同行」。秋末在鲁郡东石门分手，李白写诗相送：「飞蓬各自远，且尽手中杯。」此后两人再也没有见过面。',
  '杜甫《与李十二白同寻范十隐居》；李白《鲁郡东石门送杜二甫》', film='lidu', poem='飞蓬各自远，且尽手中杯')
C('li-gao-757', 'libai', 'gaoshi', 757, '浔阳', [116.0, 29.71], 'far', '狱中求援',
  '安史之乱中李白入永王幕，永王兵败，李白下浔阳狱。当年梁宋同游的高适，这时正是奉命讨伐永王的淮南节度使。李白在狱中写诗托张秀才去见「高中丞」，史书没有记下高适是否回应。',
  '李白《送张秀才谒高中丞》；旧唐书·高适传')
C('li-du-759', 'libai', 'dufu', 759, '秦州', [105.72, 34.58], 'far', '隔空的思念',
  '石门一别十四年。李白因永王案长流夜郎，消息传到秦州，杜甫接连梦见他，写下《梦李白》二首：「故人入我梦，明我长相忆。」杜甫一生写到李白的诗有十几首，李白写给杜甫、可靠流传下来的只有两首。',
  '杜甫《梦李白二首》《天末怀李白》', poem='故人入我梦，明我长相忆')
# ---- 杜甫 王维 孟浩然 高适 贺知章 ----
C('wang-meng-729', 'wangwei', 'menghaoran', 729, '长安', CA, 'met', '长安订交',
  '孟浩然四十岁入京应试落第，在长安与王维成了好友。唐人笔记说：孟浩然在王维官署时玄宗忽然驾到，他躲到床下，被叫出来念了「不才明主弃」，玄宗不悦，放他回襄阳。这一段未必是真的。王维写《送孟六归襄阳》送他。',
  '新唐书·孟浩然传；王维《送孟六归襄阳》', approx=True)
C('meng-xz-729', 'menghaoran', 'xuanzong', 729, '长安', CA, 'legend', '「不才明主弃」',
  '传说孟浩然在王维处遇见玄宗，念了自己的诗「不才明主弃，多病故人疏」，玄宗说：「卿不求仕，而朕未尝弃卿，奈何诬我？」便放他回山。故事见于唐人笔记和《新唐书》，细节各本不同。',
  '新唐书·孟浩然传；王定保《唐摭言》')
C('wang-meng-740', 'wangwei', 'menghaoran', 740, '襄阳', [112.14, 32.04], 'far', '哭孟浩然',
  '王维奉命知南选，路过襄阳时，孟浩然刚刚病逝。王维写下《哭孟浩然》：「故人不可见，汉水日东流。」',
  '王维《哭孟浩然》', poem='故人不可见，汉水日东流')
C('he-xz-744', 'hezhizhang', 'xuanzong', 744, '长安', CA, 'met', '御赐还乡',
  '贺知章八十六岁请为道士还乡，玄宗准了，赐镜湖一曲，亲自作诗送行，太子以下百官在长乐坡饯别。',
  '旧唐书·贺知章传；唐玄宗《送贺知章归四明》')
C('du-xz-751', 'dufu', 'xuanzong', 751, '长安', CA, 'met', '献《三大礼赋》',
  '杜甫献《三大礼赋》，玄宗读了称奇，命他待制集贤院，宰相亲自出题考他。杜甫后来回忆那天「集贤学士如堵墙」——可最后只等来一个候补资格，又困了好几年。',
  '新唐书·杜甫传；杜甫《莫相疑行》')
C('du-yang-753', 'dufu', 'yangguifei', 753, '长安·曲江', [108.99, 34.2], 'saw', '曲江《丽人行》',
  '三月三日，杨氏兄妹游曲江，杜甫在人群外远远看着，写成《丽人行》：「炙手可热势绝伦，慎莫近前丞相嗔。」他并没有和贵妃说过话，诗里也只写排场，不写贵妃本人。',
  '杜甫《丽人行》', poem='炙手可热势绝伦，慎莫近前丞相嗔')
C('wang-du-758', 'wangwei', 'dufu', 758, '长安', CA, 'met', '大明宫同朝',
  '乱后同朝：杜甫是左拾遗，王维是太子中允，两人都和了贾至的《早朝大明宫》。王维因陷贼受伪职待罪，杜甫写诗为他说话：「共传收庾信，不比得陈琳。」',
  '杜甫《奉赠王中允维》；王维《和贾舍人早朝大明宫之作》', poem='共传收庾信，不比得陈琳')
C('du-gao-760', 'dufu', 'gaoshi', 760, '成都', [104.04, 30.66], 'met', '故人供禄米',
  '杜甫流寓成都草堂，生计艰难；当年梁宋同游的高适这时是彭州刺史，常接济他。杜甫诗里说：「故人供禄米，邻舍与园蔬。」两个当年的布衣，一个做了大官，一个还在漂泊。',
  '杜甫《酬高使君相赠》', poem='故人供禄米，邻舍与园蔬')
C('du-gui-770', 'dufu', None, 770, '潭州', [112.94, 28.23], 'met', '江南逢李龟年',
  '当年在岐王宅里唱歌的宫廷乐师李龟年，安史之乱后流落江南；两个老人在长沙重逢，杜甫写下《江南逢李龟年》。这一年冬天杜甫去世。',
  '杜甫《江南逢李龟年》', guest={'name': '李龟年', 'face': '龟'}, poem='正是江南好风景，落花时节又逢君')
# ---- 玄宗 贵妃 (old meet) ----
C('xz-yang-740', 'xuanzong', 'yangguifei', 740, '骊山温泉宫', [109.21, 34.36], 'met', '温泉宫召见',
  '玄宗幸骊山温泉宫，召寿王妃杨氏入宫，先度为女道士，号太真，避开儿媳的名分；五年后册为贵妃。',
  '陈寅恪《元白诗笺证稿》；旧唐书·后妃传')
C('xz-yang-756', 'xuanzong', 'yangguifei', 756, '马嵬驿', [108.21, 34.31], 'met', '马嵬驿诀别',
  '安禄山攻破潼关，玄宗西逃至马嵬驿，六军不发，杀杨国忠，又逼玄宗处死贵妃。玄宗命高力士将贵妃缢死于佛堂。',
  '旧唐书·后妃传；资治通鉴·卷二一八')
C('xz-yao-713', 'xuanzong', None, 713, '骊山', [109.21, 34.36], 'met', '讲武召姚崇',
  '玄宗讲武骊山，召见姚崇问政，旋即拜为宰相，开元之治由此开始。', '资治通鉴·卷二一〇', guest={'name': '姚崇', 'face': '姚'})
C('yang-an-751', 'yangguifei', None, 751, '长安', CA, 'met', '洗儿戏',
  '安禄山生日后三日，被召入禁中，贵妃以锦绣大襁褓裹之作「洗儿」游戏，宫中喧笑。', '资治通鉴·卷二一六', guest={'name': '安禄山', 'face': '安'})
# ---- 李世民 玄奘 (old meet) ----
C('li-wei-626', 'lishimin', None, 626, '长安', CA, 'met', '责问魏征',
  '玄武门之变后，李世民责问东宫旧臣魏征为何离间兄弟，魏征答太子早听他的话就不会有今日。李世民嘉其直言，引为詹事主簿。',
  '资治通鉴·卷一九一', guest={'name': '魏征', 'face': '魏'})
C('tz-zang-645', 'lishimin', 'xuanzang', 645, '洛阳', LY, 'met', '仪鸾殿召见',
  '玄奘西行十七年归来，太宗在洛阳宫仪鸾殿召见，劝他还俗辅政，玄奘婉辞；太宗命他撰写《大唐西域记》。',
  '大慈恩寺三藏法师传·卷六')
C('zang-qu-630', 'xuanzang', None, 630, '高昌', [89.53, 42.85], 'met', '高昌结义',
  '高昌王麴文泰强留玄奘不得，与他结为兄弟，资送人马、书信，送他继续西行。', '大慈恩寺三藏法师传·卷一', guest={'name': '麴文泰', 'face': '麴'})
C('zang-jie-631', 'xuanzang', None, 631, '那烂陀寺', [85.44, 25.14], 'met', '拜师戒贤',
  '玄奘到中天竺那烂陀寺，拜寺主、百岁高僧戒贤为师，受学《瑜伽师地论》等五年，成为寺中十大德之一。', '大慈恩寺三藏法师传·卷三', guest={'name': '戒贤', 'face': '戒'})
C('zang-ri-642', 'xuanzang', None, 642, '曲女城', [79.92, 27.05], 'met', '曲女城大会',
  '戒日王为玄奘设无遮大会，十八天无人能难倒他，尊为「大乘天」。', '大慈恩寺三藏法师传·卷五', guest={'name': '戒日王', 'face': '日'})

meta = dict(old['_meta'])
meta['note'] = meta['note'] + ' 画像全部是后人想象画（唐人真容没有流传下来），出处见各人 imgCredit。crossings 是两人的交集：kind=met 真见过，legend 传说，near 同城而无交往记载，saw 远远见到，far 隔空（书信、梦、悼念）。cameo=true 的人物只收与主角相交的几站。'
meta['sources'] = meta['sources'] + ['杜甫诗集（仇兆鳌《杜诗详注》）；闻一多《少陵先生年谱会笺》', '陈铁民《王维年谱》', '王士源《孟浩然集序》；新唐书·孟浩然传', '旧唐书·高适传；旧唐书·贺知章传', '李濬《松窗杂录》；孟棨《本事诗》']
meta['films'] = {'lidu': {'title': '李杜相遇', 'href': 'design-film.html?s=lidu', 'mins': 3}}
out = {'_meta': meta, 'people': people, 'crossings': X}
json.dump(out, open(src, 'w'), ensure_ascii=False, indent=1)
print(len(people), 'people', sum(len(p['stops']) for p in people), 'stops', len(X), 'crossings')
