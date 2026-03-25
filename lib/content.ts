// Content library for pronunciation training

export interface ContentItem {
  id: string;
  text: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  subcategory?: string;
  author?: string;
  dynasty?: string;
}

export interface ContentCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export const CATEGORIES: ContentCategory[] = [
  { id: 'grade1', name: '一年级语文', description: '小学一年级课文', icon: '📖' },
  { id: 'grade2', name: '二年级语文', description: '小学二年级课文', icon: '📖' },
  { id: 'grade3', name: '三年级语文', description: '小学三年级课文', icon: '📖' },
  { id: 'tang300', name: '唐诗三百首', description: '经典唐诗选编', icon: '🏮' },
  { id: 'song100', name: '宋词精选', description: '经典宋词选编', icon: '🌸' },
  { id: 'idiom', name: '成语故事', description: '成语典故朗读', icon: '🎭' },
  { id: 'tongue', name: '绕口令', description: '发音练习绕口令', icon: '👅' },
];

// 一年级语文
const GRADE1_CONTENT: ContentItem[] = [
  // 上册
  { id: 'g1-1', text: '一二三四五，金木水火土。', title: '金木水火土', difficulty: 'easy', category: 'grade1', subcategory: '上册' },
  { id: 'g1-2', text: '云对雨，雪对风。花对树，鸟对虫。山清对水秀，柳绿对桃红。', title: '对韵歌', difficulty: 'easy', category: 'grade1', subcategory: '上册' },
  { id: 'g1-3', text: '鹅鹅鹅，曲项向天歌。白毛浮绿水，红掌拨清波。', title: '咏鹅', difficulty: 'easy', category: 'grade1', subcategory: '上册', author: '骆宾王', dynasty: '唐' },
  { id: 'g1-4', text: '一片两片三四片，五片六片七八片。九片十片无数片，飞入水中都不见。', title: '雪梅', difficulty: 'easy', category: 'grade1', subcategory: '上册' },
  { id: 'g1-5', text: '小小竹排画中游。小竹排，顺水流，鸟儿唱，鱼儿游。两岸树木密，禾苗绿油油。', title: '小小竹排画中游', difficulty: 'easy', category: 'grade1', subcategory: '上册' },
  { id: 'g1-6', text: '哪座房子最漂亮？一座房，两座房，青青的瓦，白白的墙，宽宽的门，大大的窗。', title: '哪座房子最漂亮', difficulty: 'easy', category: 'grade1', subcategory: '上册' },
  { id: 'g1-7', text: '爸爸告诉我，沿着宽宽的公路，就会走出北京。遥远的新疆，有美丽的天山，雪山上盛开着洁白的雪莲。', title: '我多想去看看', difficulty: 'easy', category: 'grade1', subcategory: '上册' },
  { id: 'g1-8', text: '阳光像金子，洒遍田野、高山和小河。', title: '阳光', difficulty: 'easy', category: 'grade1', subcategory: '上册' },
  { id: 'g1-9', text: '影子在前，影子在后，影子常常跟着我，就像一条小黑狗。', title: '影子', difficulty: 'easy', category: 'grade1', subcategory: '上册' },
  { id: 'g1-10', text: '谁会飞？鸟会飞。鸟儿鸟儿怎样飞？拍拍翅膀去又回。', title: '谁会飞', difficulty: 'easy', category: 'grade1', subcategory: '上册' },
  // 下册
  { id: 'g1-11', text: '春风吹，夏雨落，秋霜降，冬雪飘。', title: '春夏秋冬', difficulty: 'easy', category: 'grade1', subcategory: '下册' },
  { id: 'g1-12', text: '你姓什么？我姓李。什么李？木子李。', title: '姓氏歌', difficulty: 'easy', category: 'grade1', subcategory: '下册' },
  { id: 'g1-13', text: '祖国多么广大。大兴安岭，雪花还在飞舞。长江两岸，柳枝已经发芽。海南岛上，到处盛开着鲜花。', title: '祖国多么广大', difficulty: 'easy', category: 'grade1', subcategory: '下册' },
  { id: 'g1-14', text: '小葱拌豆腐——一清二白。竹篮打水——一场空。', title: '歇后语', difficulty: 'easy', category: 'grade1', subcategory: '下册' },
  { id: 'g1-15', text: '吃水不忘挖井人，时刻想念毛主席。', title: '吃水不忘挖井人', difficulty: 'easy', category: 'grade1', subcategory: '下册' },
];

// 二年级语文
const GRADE2_CONTENT: ContentItem[] = [
  { id: 'g2-1', text: '杨树高，榕树壮，梧桐树叶像手掌。枫树秋天叶儿红，松柏四季披绿装。', title: '树之歌', difficulty: 'easy', category: 'grade2', subcategory: '上册' },
  { id: 'g2-2', text: '清晨，林中谁最快乐？是可爱的小鸟，叽叽喳喳，蹦蹦跳跳，一会儿唱歌，一会儿梳理蓬松的羽毛。', title: '林中', difficulty: 'easy', category: 'grade2', subcategory: '上册' },
  { id: 'g2-3', text: '葡萄种在山坡的梯田上。茂密的枝叶向四面展开，就像搭起了一个个绿色的凉棚。', title: '葡萄沟', difficulty: 'easy', category: 'grade2', subcategory: '上册' },
  { id: 'g2-4', text: '日照香炉生紫烟，遥看瀑布挂前川。飞流直下三千尺，疑是银河落九天。', title: '望庐山瀑布', difficulty: 'medium', category: 'grade2', subcategory: '上册', author: '李白', dynasty: '唐' },
  { id: 'g2-5', text: '黄山风景区在我国安徽省南部。那里景色秀丽神奇，尤其是那些怪石，有趣极了。', title: '黄山奇石', difficulty: 'easy', category: 'grade2', subcategory: '上册' },
  { id: 'g2-6', text: '日月潭是我国台湾省最大的一个湖。它在台中附近的高山上。', title: '日月潭', difficulty: 'easy', category: 'grade2', subcategory: '上册' },
  { id: 'g2-7', text: '小岛把湖水分成两半，北边像圆圆的太阳，叫日潭；南边像弯弯的月亮，叫月潭。', title: '日月潭', difficulty: 'easy', category: 'grade2', subcategory: '上册' },
  { id: 'g2-8', text: '儿童散学归来早，忙趁东风放纸鸢。', title: '村居', difficulty: 'easy', category: 'grade2', subcategory: '下册', author: '高鼎', dynasty: '清' },
  { id: 'g2-9', text: '离离原上草，一岁一枯荣。野火烧不尽，春风吹又生。', title: '赋得古原草送别', difficulty: 'medium', category: 'grade2', subcategory: '下册', author: '白居易', dynasty: '唐' },
  { id: 'g2-10', text: '小信成则大信立。', title: '诚信名言', difficulty: 'easy', category: 'grade2', subcategory: '下册' },
];

// 三年级语文
const GRADE3_CONTENT: ContentItem[] = [
  { id: 'g3-1', text: '清晨，公园里有许多人在锻炼身体。有的打太极拳，有的舞剑，还有的在跑步。', title: '晨练', difficulty: 'easy', category: 'grade3', subcategory: '上册' },
  { id: 'g3-2', text: '秋天的雨，是一把钥匙。它带着清凉和温柔，趁你没留意，把秋天的大门打开了。', title: '秋天的雨', difficulty: 'medium', category: 'grade3', subcategory: '上册' },
  { id: 'g3-3', text: '天对地，雨对风，大陆对长空。山花对海树，赤日对苍穹。', title: '笠翁对韵', difficulty: 'medium', category: 'grade3', subcategory: '上册' },
  { id: 'g3-4', text: '每一片法国梧桐树的落叶，都像一个金色的小巴掌，熨帖地、平展地粘在水泥道上。', title: '铺满金色巴掌的水泥道', difficulty: 'medium', category: 'grade3', subcategory: '上册' },
  { id: 'g3-5', text: '只有那些善于动脑、执着追求的人，才能从平凡的生活中发现美，创造美。', title: '生活的美', difficulty: 'medium', category: 'grade3', subcategory: '上册' },
  { id: 'g3-6', text: '山行的路上，杜牧看到远上寒山石径斜，白云生处有人家。', title: '山行', difficulty: 'medium', category: 'grade3', subcategory: '上册', author: '杜牧', dynasty: '唐' },
  { id: 'g3-7', text: '荷叶圆圆的，绿绿的。小水珠说：荷叶是我的摇篮。', title: '荷叶圆圆', difficulty: 'easy', category: 'grade3', subcategory: '下册' },
  { id: 'g3-8', text: '花钟已经修建好了。这些花在二十四小时内陆续开放。', title: '花钟', difficulty: 'medium', category: 'grade3', subcategory: '下册' },
];

// 唐诗三百首精选
const TANG300_CONTENT: ContentItem[] = [
  // 五言绝句
  { id: 'tang-1', text: '白日依山尽，黄河入海流。欲穷千里目，更上一层楼。', title: '登鹳雀楼', difficulty: 'easy', category: 'tang300', subcategory: '五言绝句', author: '王之涣', dynasty: '唐' },
  { id: 'tang-2', text: '床前明月光，疑是地上霜。举头望明月，低头思故乡。', title: '静夜思', difficulty: 'easy', category: 'tang300', subcategory: '五言绝句', author: '李白', dynasty: '唐' },
  { id: 'tang-3', text: '春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少。', title: '春晓', difficulty: 'easy', category: 'tang300', subcategory: '五言绝句', author: '孟浩然', dynasty: '唐' },
  { id: 'tang-4', text: '红豆生南国，春来发几枝。愿君多采撷，此物最相思。', title: '相思', difficulty: 'easy', category: 'tang300', subcategory: '五言绝句', author: '王维', dynasty: '唐' },
  { id: 'tang-5', text: '独坐幽篁里，弹琴复长啸。深林人不知，明月来相照。', title: '竹里馆', difficulty: 'easy', category: 'tang300', subcategory: '五言绝句', author: '王维', dynasty: '唐' },
  { id: 'tang-6', text: '移舟泊烟渚，日暮客愁新。野旷天低树，江清月近人。', title: '宿建德江', difficulty: 'medium', category: 'tang300', subcategory: '五言绝句', author: '孟浩然', dynasty: '唐' },
  { id: 'tang-7', text: '千山鸟飞绝，万径人踪灭。孤舟蓑笠翁，独钓寒江雪。', title: '江雪', difficulty: 'medium', category: 'tang300', subcategory: '五言绝句', author: '柳宗元', dynasty: '唐' },
  { id: 'tang-8', text: '松下问童子，言师采药去。只在此山中，云深不知处。', title: '寻隐者不遇', difficulty: 'easy', category: 'tang300', subcategory: '五言绝句', author: '贾岛', dynasty: '唐' },
  { id: 'tang-9', text: '向晚意不适，驱车登古原。夕阳无限好，只是近黄昏。', title: '乐游原', difficulty: 'medium', category: 'tang300', subcategory: '五言绝句', author: '李商隐', dynasty: '唐' },
  { id: 'tang-10', text: '君自故乡来，应知故乡事。来日绮窗前，寒梅著花未？', title: '杂诗', difficulty: 'medium', category: 'tang300', subcategory: '五言绝句', author: '王维', dynasty: '唐' },
  // 七言绝句
  { id: 'tang-11', text: '朝辞白帝彩云间，千里江陵一日还。两岸猿声啼不住，轻舟已过万重山。', title: '早发白帝城', difficulty: 'medium', category: 'tang300', subcategory: '七言绝句', author: '李白', dynasty: '唐' },
  { id: 'tang-12', text: '故人西辞黄鹤楼，烟花三月下扬州。孤帆远影碧空尽，唯见长江天际流。', title: '黄鹤楼送孟浩然之广陵', difficulty: 'medium', category: 'tang300', subcategory: '七言绝句', author: '李白', dynasty: '唐' },
  { id: 'tang-13', text: '葡萄美酒夜光杯，欲饮琵琶马上催。醉卧沙场君莫笑，古来征战几人回？', title: '凉州词', difficulty: 'medium', category: 'tang300', subcategory: '七言绝句', author: '王翰', dynasty: '唐' },
  { id: 'tang-14', text: '黄河远上白云间，一片孤城万仞山。羌笛何须怨杨柳，春风不度玉门关。', title: '凉州词', difficulty: 'medium', category: 'tang300', subcategory: '七言绝句', author: '王之涣', dynasty: '唐' },
  { id: 'tang-15', text: '秦时明月汉时关，万里长征人未还。但使龙城飞将在，不教胡马度阴山。', title: '出塞', difficulty: 'medium', category: 'tang300', subcategory: '七言绝句', author: '王昌龄', dynasty: '唐' },
  { id: 'tang-16', text: '寒雨连江夜入吴，平明送客楚山孤。洛阳亲友如相问，一片冰心在玉壶。', title: '芙蓉楼送辛渐', difficulty: 'medium', category: 'tang300', subcategory: '七言绝句', author: '王昌龄', dynasty: '唐' },
  { id: 'tang-17', text: '渭城朝雨浥轻尘，客舍青青柳色新。劝君更尽一杯酒，西出阳关无故人。', title: '送元二使安西', difficulty: 'medium', category: 'tang300', subcategory: '七言绝句', author: '王维', dynasty: '唐' },
  { id: 'tang-18', text: '清明时节雨纷纷，路上行人欲断魂。借问酒家何处有，牧童遥指杏花村。', title: '清明', difficulty: 'easy', category: 'tang300', subcategory: '七言绝句', author: '杜牧', dynasty: '唐' },
  { id: 'tang-19', text: '远上寒山石径斜，白云生处有人家。停车坐爱枫林晚，霜叶红于二月花。', title: '山行', difficulty: 'medium', category: 'tang300', subcategory: '七言绝句', author: '杜牧', dynasty: '唐' },
  { id: 'tang-20', text: '烟笼寒水月笼沙，夜泊秦淮近酒家。商女不知亡国恨，隔江犹唱后庭花。', title: '泊秦淮', difficulty: 'hard', category: 'tang300', subcategory: '七言绝句', author: '杜牧', dynasty: '唐' },
  // 五言律诗
  { id: 'tang-21', text: '国破山河在，城春草木深。感时花溅泪，恨别鸟惊心。烽火连三月，家书抵万金。白头搔更短，浑欲不胜簪。', title: '春望', difficulty: 'medium', category: 'tang300', subcategory: '五言律诗', author: '杜甫', dynasty: '唐' },
  { id: 'tang-22', text: '空山新雨后，天气晚来秋。明月松间照，清泉石上流。竹喧归浣女，莲动下渔舟。随意春芳歇，王孙自可留。', title: '山居秋暝', difficulty: 'medium', category: 'tang300', subcategory: '五言律诗', author: '王维', dynasty: '唐' },
  { id: 'tang-23', text: '青山横北郭，白水绕东城。此地一为别，孤蓬万里征。浮云游子意，落日故人情。挥手自兹去，萧萧班马鸣。', title: '送友人', difficulty: 'medium', category: 'tang300', subcategory: '五言律诗', author: '李白', dynasty: '唐' },
  // 七言律诗
  { id: 'tang-24', text: '昔人已乘黄鹤去，此地空余黄鹤楼。黄鹤一去不复返，白云千载空悠悠。晴川历历汉阳树，芳草萋萋鹦鹉洲。日暮乡关何处是，烟波江上使人愁。', title: '黄鹤楼', difficulty: 'hard', category: 'tang300', subcategory: '七言律诗', author: '崔颢', dynasty: '唐' },
  { id: 'tang-25', text: '风急天高猿啸哀，渚清沙白鸟飞回。无边落木萧萧下，不尽长江滚滚来。万里悲秋常作客，百年多病独登台。艰难苦恨繁霜鬓，潦倒新停浊酒杯。', title: '登高', difficulty: 'hard', category: 'tang300', subcategory: '七言律诗', author: '杜甫', dynasty: '唐' },
];

// 宋词精选
const SONG100_CONTENT: ContentItem[] = [
  { id: 'song-1', text: '明月几时有，把酒问青天。不知天上宫阙，今夕是何年。', title: '水调歌头', difficulty: 'medium', category: 'song100', author: '苏轼', dynasty: '宋' },
  { id: 'song-2', text: '大江东去，浪淘尽，千古风流人物。', title: '念奴娇·赤壁怀古', difficulty: 'medium', category: 'song100', author: '苏轼', dynasty: '宋' },
  { id: 'song-3', text: '寻寻觅觅，冷冷清清，凄凄惨惨戚戚。', title: '声声慢', difficulty: 'hard', category: 'song100', author: '李清照', dynasty: '宋' },
  { id: 'song-4', text: '莫道不销魂，帘卷西风，人比黄花瘦。', title: '醉花阴', difficulty: 'medium', category: 'song100', author: '李清照', dynasty: '宋' },
  { id: 'song-5', text: '醉里挑灯看剑，梦回吹角连营。八百里分麾下炙，五十弦翻塞外声。', title: '破阵子', difficulty: 'medium', category: 'song100', author: '辛弃疾', dynasty: '宋' },
  { id: 'song-6', text: '多情自古伤离别，更那堪，冷落清秋节。', title: '雨霖铃', difficulty: 'medium', category: 'song100', author: '柳永', dynasty: '宋' },
  { id: 'song-7', text: '今宵酒醒何处，杨柳岸，晓风残月。', title: '雨霖铃', difficulty: 'medium', category: 'song100', author: '柳永', dynasty: '宋' },
  { id: 'song-8', text: '衣带渐宽终不悔，为伊消得人憔悴。', title: '蝶恋花', difficulty: 'medium', category: 'song100', author: '柳永', dynasty: '宋' },
];

// 成语故事
const IDIOM_CONTENT: ContentItem[] = [
  { id: 'idiom-1', text: '守株待兔：宋国有个农夫，偶然捡到一只撞死在树桩上的兔子，从此放下农具，天天等兔子撞树。', title: '守株待兔', difficulty: 'easy', category: 'idiom' },
  { id: 'idiom-2', text: '刻舟求剑：有人把剑掉进江里，在船边刻个记号，等船靠岸再去找，当然找不到了。', title: '刻舟求剑', difficulty: 'easy', category: 'idiom' },
  { id: 'idiom-3', text: '画蛇添足：画蛇的时候添上脚，反而多余了。', title: '画蛇添足', difficulty: 'easy', category: 'idiom' },
  { id: 'idiom-4', text: '掩耳盗铃：偷铃铛的时候捂住自己的耳朵，以为自己听不见别人也听不见。', title: '掩耳盗铃', difficulty: 'easy', category: 'idiom' },
  { id: 'idiom-5', text: '井底之蛙：井底的一只青蛙，以为天只有井口那么大。', title: '井底之蛙', difficulty: 'easy', category: 'idiom' },
  { id: 'idiom-6', text: '拔苗助长：急于求成，反而把事情弄糟。', title: '拔苗助长', difficulty: 'easy', category: 'idiom' },
  { id: 'idiom-7', text: '亡羊补牢：丢了羊再修羊圈，还不算晚。', title: '亡羊补牢', difficulty: 'easy', category: 'idiom' },
  { id: 'idiom-8', text: '狐假虎威：狐狸借老虎的威风吓唬其他动物。', title: '狐假虎威', difficulty: 'easy', category: 'idiom' },
];

// 绕口令
const TONGUE_TWISTER_CONTENT: ContentItem[] = [
  { id: 'tw-1', text: '吃葡萄不吐葡萄皮，不吃葡萄倒吐葡萄皮。', title: '葡萄皮', difficulty: 'medium', category: 'tongue' },
  { id: 'tw-2', text: '四是四，十是十，十四是十四，四十是四十。', title: '四和十', difficulty: 'medium', category: 'tongue' },
  { id: 'tw-3', text: '牛郎恋刘娘，刘娘念牛郎。', title: '牛郎刘娘', difficulty: 'hard', category: 'tongue' },
  { id: 'tw-4', text: '白石塔，白石搭，白石搭白塔，白塔白石搭。', title: '白石塔', difficulty: 'medium', category: 'tongue' },
  { id: 'tw-5', text: '黑化肥发灰，灰化肥发黑。', title: '化肥', difficulty: 'hard', category: 'tongue' },
  { id: 'tw-6', text: '八百标兵奔北坡，炮兵并排北边跑。', title: '标兵炮兵', difficulty: 'medium', category: 'tongue' },
  { id: 'tw-7', text: '扁担长，板凳宽，扁担没有板凳宽，板凳没有扁担长。', title: '扁担板凳', difficulty: 'medium', category: 'tongue' },
  { id: 'tw-8', text: '红鲤鱼与绿鲤鱼与驴。', title: '鲤鱼驴', difficulty: 'hard', category: 'tongue' },
  { id: 'tw-9', text: '墙上一根钉，钉上挂条绳，绳下吊个瓶，瓶下放盏灯。', title: '钉绳瓶灯', difficulty: 'hard', category: 'tongue' },
  { id: 'tw-10', text: '山前有个严圆眼，山后有个严眼圆，二人山前来比眼，不知是严圆眼比严眼圆的眼圆，还是严眼圆比严圆眼的圆眼。', title: '严圆眼', difficulty: 'hard', category: 'tongue' },
];

// 合并所有内容
export const ALL_CONTENT: ContentItem[] = [
  ...GRADE1_CONTENT,
  ...GRADE2_CONTENT,
  ...GRADE3_CONTENT,
  ...TANG300_CONTENT,
  ...SONG100_CONTENT,
  ...IDIOM_CONTENT,
  ...TONGUE_TWISTER_CONTENT,
];

// 按分类获取内容
export function getContentByCategory(categoryId: string): ContentItem[] {
  return ALL_CONTENT.filter(item => item.category === categoryId);
}

// 搜索内容
export function searchContent(query: string): ContentItem[] {
  const lowerQuery = query.toLowerCase();
  return ALL_CONTENT.filter(item =>
    item.text.includes(query) ||
    item.title.includes(query) ||
    item.author?.includes(query)
  );
}

// 获取随机内容
export function getRandomContent(count: number = 5): ContentItem[] {
  const shuffled = [...ALL_CONTENT].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}