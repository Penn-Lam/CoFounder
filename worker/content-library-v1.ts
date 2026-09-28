import type { Dimension } from './rules';

export const CONTENT_LIBRARY_VERSION = 'cofounder-content-v3';

export type ApprovedContent = {
    id: string;
    approval: { status: 'approved'; approvedBy: string; approvedAt: string };
};

const approval = {
    status: 'approved' as const,
    approvedBy: 'Cofounder editorial',
    approvedAt: '2026-09-20',
};
const promptOccurrences = new Map<string, number>();

export const contentLibraryV1 = {
    version: CONTENT_LIBRARY_VERSION,
    status: 'human-final' as const,
    locale: 'zh-CN' as const,
    approval,
    publicArchetypes: [
        {
            id: 'archetype.chopsticks',
            key: 'chopsticks',
            title: '筷子型合伙人',
            englishTitle: 'Chopsticks Pair',
            tagline: '看起来是两个人，下手的时候基本是一个人。',
            explanation:
                '你们对方向、判断节奏和彼此意图有很高的同步率。真正的优势不是答案总相同，而是很少需要重新解释为什么。',
            story: {
                title: '沃伦·巴菲特与查理·芒格',
                paragraphs: [
                    '1959 年夏天，29 岁的沃伦·巴菲特在奥马哈的一场家庭晚餐上见到了查理·芒格。那晚的餐桌很快变成了两台精密大脑的高速共振。',
                    '几十年间，他们用完全互补的性格，把两套顶尖的判断系统磨合成了同一种无需多言的思维语言。',
                ],
                image: '/images/pair-types/compounding-original.webp',
                receiptImage: '/images/pair-types/compounding-dot.webp',
            },
            approval,
        },
        {
            id: 'archetype.split-pot',
            key: 'split-pot',
            title: '鸳鸯锅型合伙人',
            englishTitle: 'Split Pot Pair',
            tagline: '一个总觉得窗口要关了，一个总觉得钱要烧完了。',
            explanation:
                '你们对公司最后要去哪几乎没有分歧，但对现在该不该踩油门天然站在两边。一个负责不错过机会，一个负责让公司活着看到机会兑现。',
            story: {
                title: '里德·哈斯廷斯与马克·兰多夫',
                paragraphs: [
                    'Netflix 诞生前，马克·兰多夫不断抛出创业设想，里德·哈斯廷斯则用逻辑、单位经济模型和技术可行性逐个设卡。',
                    '一个充满激情的直觉主义者负责发起进攻，一个极度理性的工程师负责防守，直到那个能经受双重检验的点子幸存下来。',
                ],
                image: '/images/pair-types/experiment-original.webp',
                receiptImage: '/images/pair-types/experiment-dot.webp',
            },
            approval,
        },
        {
            id: 'archetype.two-stage-rocket',
            key: 'two-stage-rocket',
            title: '两级火箭型合伙人',
            englishTitle: 'Two-Stage Rocket',
            tagline: '一个负责十年以后，一个负责下周三。',
            explanation:
                '一方持续拉高终局，另一方把终局拆成可以交付的下一步。两级同时点火时，你们既能离开地面，也不会只停在想象里。',
            story: {
                title: '史蒂夫·乔布斯与史蒂夫·沃兹尼亚克',
                paragraphs: [
                    '沃兹尼亚克把电路板当作工程艺术品，乔布斯却从同一块板上看见了大众个人计算时代。',
                    '一个专注系统底层的极致与优雅，一个执着于把冷冰冰的芯片变成改变世界的消费级产品。',
                ],
                image: '/images/pair-types/craft-original.webp',
                receiptImage: '/images/pair-types/craft-dot.webp',
            },
            approval,
        },
        {
            id: 'archetype.sushi-roll',
            key: 'sushi-roll',
            title: '寿司卷型合伙人',
            englishTitle: 'Sushi Roll Pair',
            tagline: '一个在外面扛住世界，一个在里面负责真的有料。',
            explanation:
                '你们自然形成清晰的内外分工。外层让世界愿意靠近，内层确保每一次承诺都有真实产品和系统支撑。',
            story: {
                title: '布莱恩·切斯基与内森·布莱查奇克',
                paragraphs: [
                    'Airbnb 用设计、叙事与情感体验让陌生人愿意彼此信任，而这种信任要规模化成立，还需要复杂的工程基底。',
                    '一人在聚光灯下重塑旅行的定义，一人在幕后确保全球用户按下预订键时，庞大的技术轮盘丝毫不差地转动。',
                ],
                image: '/images/pair-types/trust-original.webp',
                receiptImage: '/images/pair-types/trust-dot.webp',
            },
            approval,
        },
        {
            id: 'archetype.dual-core',
            key: 'dual-core',
            title: '双核型合伙人',
            englishTitle: 'Dual-Core Pair',
            tagline: '两个人都能单刷，所以经常忘了这是双排。',
            explanation:
                '你们都有完整的判断与推进能力，合作价值来自两套强系统的并行运转。要小心的是，各自都能走太远，才想起同步上下文。',
            story: {
                title: '拉里·佩奇与谢尔盖·布林',
                paragraphs: [
                    '第一次校园漫步时，他们几乎对每个话题都持有互不相让的尖锐观点。',
                    '正是这种旗鼓相当的思想角力，把数学直觉与数据模型推到一起，也让大学实验最终演化成 Google。',
                ],
                image: '/images/pair-types/debate-original.webp',
                receiptImage: '/images/pair-types/debate-dot.webp',
            },
            approval,
        },
        {
            id: 'archetype.gears',
            key: 'gears',
            title: '齿轮型合伙人',
            englishTitle: 'Interlocking Gears',
            tagline: '你缺的那颗齿，刚好长在他身上。',
            explanation:
                '你们的强项不是相似，而是能互相咬合。一个人的输出正好成为另一个人的输入，接口越清楚，组合后的力量越大。',
            story: {
                title: '比尔·盖茨与保罗·艾伦',
                paragraphs: [
                    '当 Altair 8800 出现在杂志封面时，两人立即押上全部筹码，承诺交付一套尚不存在的 BASIC 解释器。',
                    '艾伦搭建硬件仿真环境，盖茨把代码压缩到极致，两套能力在八周冲刺中严丝合缝地咬在一起。',
                ],
                image: '/images/pair-types/execution-original.webp',
                receiptImage: '/images/pair-types/execution-dot.webp',
            },
            approval,
        },
        {
            id: 'archetype.double-helix',
            key: 'double-helix',
            title: '双螺旋型合伙人',
            englishTitle: 'Double Helix Pair',
            tagline: '一直往同一个方向长，但从来不是同一条线。',
            explanation:
                '你们对终局有稳定共识，却长期保留不同的方法和视角。分歧不是偏航，而是让同一个方向拥有两条互相校正的路径。',
            story: {
                title: '埃文·斯皮格尔与鲍比·墨菲',
                paragraphs: [
                    '一次共同项目的失败没有破坏两人的信任，反而让他们继续追问：社交产品能不能不制造永久的表演压力。',
                    '一人持续定义产品哲学与审美方向，一人把反直觉的理念变成稳定的技术架构。',
                ],
                image: '/images/pair-types/creativity-original.webp',
                receiptImage: '/images/pair-types/creativity-dot.webp',
            },
            approval,
        },
        {
            id: 'archetype.sailboat',
            key: 'sailboat',
            title: '帆船型合伙人',
            englishTitle: 'Sailboat Pair',
            tagline: '一个负责接住风口，一个负责别被风口吹走。',
            explanation:
                '你们同时拥有捕捉机会和维持秩序的能力。一方让船借到风，另一方用规则、现金与边界确保它不会失控。',
            story: {
                title: '马云与蔡崇信',
                paragraphs: [
                    '1999 年，蔡崇信走进杭州湖畔花园，看见马云用近乎疯狂的理想主义凝聚一群年轻人。',
                    '一个在前面挥舞旗帜开拓疆域，另一个把狂热装进股权、融资与现代公司治理的制度骨骼。',
                ],
                image: '/images/pair-types/vision-original.webp',
                receiptImage: '/images/pair-types/vision-dot.webp',
            },
            approval,
        },
    ],
    modifiers: [
        { id: 'modifier.same-mountain', group: 'identity', label: '同一座山', approval },
        { id: 'modifier.digital-twin', group: 'identity', label: 'Digital Twin', approval },
        { id: 'modifier.dual-big-outcome', group: 'identity', label: '双大结果', approval },
        { id: 'modifier.dual-product', group: 'identity', label: '双产品经理', approval },
        { id: 'modifier.cashflow-couple', group: 'identity', label: 'Cashflow Couple', approval },
        { id: 'modifier.research-driven', group: 'identity', label: 'Research Driven', approval },
        { id: 'modifier.quiet-reactive', group: 'dynamic', label: '闭麦 Founder × 发疯联创', approval },
        { id: 'modifier.narrative-market-fit', group: 'dynamic', label: 'Narrative-Market Fit', approval },
        { id: 'modifier.high-pressure-pair', group: 'dynamic', label: '高压搭档', approval },
        { id: 'modifier.fight-and-return', group: 'dynamic', label: '吵完还能开会', approval },
        { id: 'modifier.story-and-delivery', group: 'dynamic', label: '一个讲故事，一个交付', approval },
        { id: 'modifier.independent-founders', group: 'dynamic', label: '双人组队，各自单刷', approval },
    ],
    legendaryTraits: [
        {
            id: 'trait.century-company',
            title: '百年公司',
            copy: '你们俩真的有点像要开一家百年公司。',
            approval,
        },
    ],
    privateRiskPatterns: [
        {
            id: 'risk.dual-leadership',
            key: 'dual-leadership',
            title: '双一号位',
            copy: '你们都可能自然站到最终拍板的位置。若权责只靠默契，关键时刻容易出现两套指挥系统。',
            action: '按决策类型写下唯一收口人，并约定何时重新分配。',
            approval,
        },
        {
            id: 'risk.quiet-reactive',
            key: 'quiet-reactive',
            title: '静默与应激',
            copy: '一方倾向先消化，另一方倾向立即处理；沉默可能被误读为同意，追问也可能被误读为施压。',
            action: '约定暂停信号、恢复对话的具体时间和确认方式。',
            approval,
        },
        {
            id: 'risk.high-pressure-pair',
            key: 'high-pressure-pair',
            title: '高压搭档',
            copy: '你们都能扛事，也可能把高压当作默认工作温度，直到身体、关系或判断先报错。',
            action: '明确不可长期透支的边界，并设置能真实减载的触发条件。',
            approval,
        },
        {
            id: 'risk.world-peace',
            key: 'world-peace',
            title: '世界和平型',
            copy: '你们重视和气，分歧可能因此被包装成“都可以”。没有被说出口的不同，不会因为气氛良好而消失。',
            action: '在重要决策中固定安排反方意见，并记录仍未解决的问题。',
            approval,
        },
        {
            id: 'risk.parallel-solo-founders',
            key: 'parallel-solo-founders',
            title: '并行单人公司',
            copy: '你们各自都能独立推进，但接口和共同决策可能变少，最后像两家公司共享一个名字。',
            action: '列出必须共同拥有的三类信息与每周同步的决策。',
            approval,
        },
    ],
    mirrorMisreads: [
        {
            id: 'mirror.accurate-model',
            title: '彼此模型清晰',
            copy: '你们对彼此关键选择的预测整体稳定。下一步不是继续猜，而是确认这种理解在压力情境中仍然成立。',
            approval,
        },
        {
            id: 'mirror.near-but-fragile',
            title: '方向懂了，边界还模糊',
            copy: '你们常能猜中大方向，但对触发条件和优先级的理解仍可能错位。关键决定前需要把“差不多”说具体。',
            approval,
        },
        {
            id: 'mirror.opposite-assumptions',
            title: '关键假设相反',
            copy: '部分预测与本人选择方向相反，说明你们可能正在用旧经验替代当下确认。先更新彼此模型，再讨论结论。',
            approval,
        },
        {
            id: 'mirror.asymmetric-model',
            title: '理解深度不对称',
            copy: '一方对另一方的预测明显更准确。这不代表谁更在意关系，但说明重要信息的流动目前并不对称。',
            approval,
        },
    ],
    dimensionBands: {
        ambition: [
            ['守住当下', '更看重可控进展与当期确定性。'],
            ['稳步扩张', '愿意增长，但希望每一步都有支撑。'],
            ['机会平衡', '会在规模与确定性之间动态选择。'],
            ['主动做大', '倾向为显著增长投入更多筹码。'],
            ['定义赛道', '更愿意押注长期的大范围影响。'],
        ],
        risk: [
            ['强防守', '优先避免不可逆损失。'],
            ['谨慎试水', '先用小成本验证，再逐步加码。'],
            ['风险均衡', '根据收益与退路决定下注。'],
            ['敢于加码', '证据足够时愿意承担明显风险。'],
            ['高波动下注', '能接受高不确定性换取突破机会。'],
        ],
        money: [
            ['现金优先', '更看重收入、成本和生存周期。'],
            ['效率经营', '愿意投入，但要求清楚的回报路径。'],
            ['弹性配置', '会按阶段平衡增长与现金纪律。'],
            ['增长投入', '愿意用更多资源换取速度和市场。'],
            ['规模优先', '更愿意为长期规模承受短期压力。'],
        ],
        product: [
            ['快速交付', '先让方案进入真实场景，再持续修正。'],
            ['实用迭代', '重视速度，也保留必要质量门槛。'],
            ['证据折中', '按风险选择快做或深做。'],
            ['系统打磨', '倾向用更完整的产品判断减少返工。'],
            ['极致产品', '愿意为核心体验和技术质量投入更久。'],
        ],
        governance: [
            ['单点拍板', '偏好清晰且集中的最终决定权。'],
            ['主责决策', '按领域授权，由主责人收口。'],
            ['协商收口', '多数决策共同讨论，再明确落点。'],
            ['共同治理', '重要事项倾向双方形成一致。'],
            ['高度共识', '重大方向必须充分对齐后才行动。'],
        ],
        conflict: [
            ['延后处理', '更愿意等情绪和信息稳定后再谈。'],
            ['缓冲再谈', '需要短暂空间，但会回到问题。'],
            ['择机直面', '按分歧强度选择处理节奏。'],
            ['及时摊开', '倾向尽快把不同观点说清楚。'],
            ['当场解决', '希望分歧出现时立即推进到结论。'],
        ],
        operating: [
            ['弹性探索', '偏好保留空间，随新信息调整路径。'],
            ['轻量规划', '用少量结构保持方向与速度。'],
            ['节奏混合', '在流程与机动之间切换。'],
            ['流程推进', '依靠明确计划、责任和检查点。'],
            ['严密执行', '重视稳定流程、标准和可预测交付。'],
        ],
        external: [
            ['深度内建', '更愿意专注产品、技术与内部建设。'],
            ['选择性外联', '在明确需要时连接客户和资源。'],
            ['内外平衡', '能在内部建设与外部表达间切换。'],
            ['主动连接', '乐于持续接触客户、伙伴和资本。'],
            ['前台驱动', '擅长通过表达、关系和市场推动公司。'],
        ],
    } as Record<Dimension, Array<[string, string]>>,
    reportVocabulary: {
        id: 'report.vocabulary',
        dimensions: {
            ambition: '长期目标',
            risk: '风险选择',
            money: '资金观念',
            product: '产品判断',
            governance: '治理方式',
            conflict: '冲突处理',
            operating: '工作节奏',
            external: '对外角色',
        } as Record<Dimension, string>,
        relations: {
            aligned: '方向一致',
            productive_tension: '有效互补',
            structural_difference: '结构性差异',
        },
        severities: {
            moderate: '需要留意',
            high: '优先讨论',
            critical: '必须先谈清楚',
        },
        flags: {
            'dual-sole-authority': {
                title: '最终决定权重叠',
                copy: '双方都把最终决定权放在自己一侧，关键决策可能出现两套指挥。',
            },
            'safe-ambition-gap': {
                title: '长期目标距离较大',
                copy: '双方对公司最终要走多远的判断不同，需要先谈清成功的定义。',
            },
            'risk-gap': {
                title: '风险承受差异较大',
                copy: '面对同一个窗口，双方可能对下注速度与可承受损失有明显不同。',
            },
            'money-gap': {
                title: '资金使用逻辑不同',
                copy: '双方对现金纪律与增长投入的优先顺序存在明显差异。',
            },
            'product-large-structural-difference': {
                title: '产品判断方式不同',
                copy: '双方依赖的产品证据与决策方式不同，容易在关键取舍上持续拉扯。',
            },
            'conflict-latency-gap': {
                title: '冲突处理时差较大',
                copy: '一方希望尽快处理，另一方需要更长缓冲，沉默和追问都可能被误读。',
            },
            'operating-gap': {
                title: '工作节奏差异较大',
                copy: '双方对临时变化、规划和执行节奏的偏好不同，需要明确协作接口。',
            },
        },
        sensitiveTopics: {
            'acquisition-intent': '收购选择',
            'equity-adjustment': '股权调整',
            'commitment-horizon': '长期投入',
            'ethics-boundary': '业务伦理边界',
            'ceo-removal': 'CEO 更换机制',
        },
        sensitiveStates: {
            aligned: '原则接近',
            conflict: '存在原则冲突',
            unresolved: '至少一方尚未形成明确答案',
        },
        approval,
    },
    reportModules: [
        {
            id: 'report.team-portrait',
            title: '你们这支队伍',
            copy: '这不是兼容性结论，而是你们在压力下可能如何共同工作的快照。',
            approval,
        },
        {
            id: 'report.strongest-alignment',
            title: '最强共识',
            copy: '这里是你们当前最容易同向发力的维度，也值得确认这种一致在真实决策中是否成立。',
            approval,
        },
        {
            id: 'report.valuable-complement',
            title: '最有价值的互补',
            copy: '差异可以扩大团队覆盖面；前提是双方知道何时交棒、何时共同决定。',
            approval,
        },
        {
            id: 'report.top-difference',
            title: '最该先聊的不同',
            copy: '它可能是结构性差异，也可能只是尚未讨论。请先澄清事实，不急着判断谁对。',
            approval,
        },
        {
            id: 'report.dimensions',
            title: '八维协作地图',
            copy: '每个匹配值只描述该维度预期的协作摩擦，不评价任何一方，也不是总体兼容度。',
            approval,
        },
        {
            id: 'report.mirror',
            title: '镜像准确度',
            copy: '分别查看准确、接近和相反的预测次数；它反映彼此理解，不是默契分数。',
            approval,
        },
        {
            id: 'report.conflict-flags',
            title: '需要正视的信号',
            copy: '这些信号由固定规则触发。最高优先级会先展示，其余仍保留在对应维度中。',
            approval,
        },
        {
            id: 'report.prompts',
            title: '下一次对话',
            copy: '选五个问题，给彼此完整回答时间，并把暂时没有结论的部分记下来。',
            approval,
        },
        {
            id: 'report.footer',
            title: '使用边界',
            copy: 'Cofounder 是娱乐产品，不是科学、心理、法律或投资评估，也不能替代参与者之间的直接沟通。',
            approval,
        },
    ],
    conservativeResult: {
        id: 'conservative.complete',
        pairTypeId: 'archetype.chopsticks',
        riskPatternId: 'risk.parallel-solo-founders',
        reportModuleIds: [
            'report.team-portrait',
            'report.strongest-alignment',
            'report.valuable-complement',
            'report.top-difference',
            'report.dimensions',
            'report.mirror',
            'report.conflict-flags',
            'report.prompts',
            'report.footer',
        ],
        promptIds: [
            'prompt.five-year-definition.1',
            'prompt.cash-at-six-months.1',
            'prompt.decision-deadlock.1',
            'prompt.conflict-latency.1',
            'prompt.external-role.1',
        ],
        approval,
    },
    prompts: [
        [
            'acquisition-threshold',
            '如果今天收到收购邀约，什么数字与条件会让你认真考虑？',
        ],
        ['five-year-definition', '五年后你会用哪三件事判断这家公司做成了？'],
        ['hiring-window', '未来六个月最晚在什么信号出现时必须招人？'],
        [
            'platform-overlap',
            '如果平台方进入我们的核心功能，继续、转向或合作的判断线分别是什么？',
        ],
        [
            'risk-loss-aversion',
            '哪一种损失最让你无法接受：钱、时间、声誉还是机会？为什么？',
        ],
        [
            'customer-customization',
            '一个大客户要求重度定制时，我们用什么条件决定接不接？',
        ],
        [
            'founder-compensation',
            '创始人工资何时可以上调，谁来确认公司承担得起？',
        ],
        ['cash-at-six-months', '只剩六个月现金时，哪三项支出最后才能砍？'],
        ['runway-signal', '跑道缩短到什么程度时，我们必须切换经营模式？'],
        ['user-demand', '用户说想要与实际愿意付费冲突时，我们相信什么证据？'],
        [
            'media-vs-usage',
            '媒体热度很高但使用不增长时，我们继续放大还是暂停？',
        ],
        ['product-evidence', '什么证据足以让我们推翻当前产品判断？'],
        ['decision-deadlock', '重要决策僵持 48 小时后，由谁用什么原则收口？'],
        ['decision-deadlock', '双方都确信自己正确时，最小可逆实验是什么？'],
        ['company-authority', '今天公司级最终决定权属于谁？哪些事件会改变它？'],
        ['company-authority', '如果外部只能听一个答案，谁代表公司做最终承诺？'],
        ['authority-model', '哪些决策必须共同同意，哪些可以先做后报？'],
        ['authority-model', '按领域授权时，跨领域决策由谁收口？'],
        [
            'repeated-bad-decisions',
            '同一个人连续做出错误决定后，权限如何临时调整？',
        ],
        ['repeated-bad-decisions', '我们用什么证据区分坏结果与坏决策？'],
        ['conflict-latency', '发生冲突后，最晚多久必须重新开口？谁负责发起？'],
        ['conflict-latency', '需要冷静时，怎样说明暂停不是逃避？'],
        ['conflict-style', '对方用什么表达方式时，你最容易停止倾听？'],
        ['conflict-style', '争论升温时，哪一句固定提醒能让我们回到问题？'],
        [
            'unresolved-conflict',
            '一个月后仍未解决的分歧，要升级给谁或用什么机制处理？',
        ],
        ['unresolved-conflict', '哪些分歧可以带着继续工作，哪些不可以？'],
        ['work-boundary', '什么时间与情形下，工作消息可以不立即回复？'],
        ['engineering-rigor', '哪些技术债可以接受，哪些上线前绝不能欠？'],
        ['delayed-decision', '信息一直不够时，到哪一天必须带着不确定性决定？'],
        [
            'public-representation',
            '谁更适合代表公司公开发言，另一方如何纠正错误承诺？',
        ],
        ['customer-crisis', '客户危机发生时，谁对外、谁排障、谁记录决定？'],
        ['external-role', '融资、销售、招聘与媒体关系分别由谁主责？'],
        ['equity-adjustment', '贡献长期失衡时，重新讨论股权的触发条件是什么？'],
        [
            'commitment-horizon',
            '连续两年没有明显结果时，什么会让你继续或退出？',
        ],
        [
            'ethics-boundary',
            '合法但个人反感的收入机会出现时，哪些边界不能交换？',
        ],
        ['ceo-removal', '什么事实足以启动 CEO 更换讨论，程序由谁发起？'],
        ['decision-deadlock', '当速度比共识更重要时，谁获得一次性决定权？'],
        ['authority-model', '紧急状态下的临时授权多久自动失效？'],
        ['conflict-style', '你希望对方当面指出问题，还是先书面整理？'],
        ['conflict-latency', '如果约定的恢复对话时间被错过，下一步是什么？'],
        ['unresolved-conflict', '怎样记录未决事项，避免沉默被当作同意？'],
        [
            'company-authority',
            '董事会、CEO 与两位创始人的权限冲突时按什么顺序处理？',
        ],
        ['work-boundary', '高压冲刺最长可以持续多久，停止信号是什么？'],
        ['external-role', '对外承诺超出交付能力时，谁有权叫停？'],
    ].map(([topic, copy]) => {
        const occurrence = (promptOccurrences.get(topic) || 0) + 1;
        promptOccurrences.set(topic, occurrence);
        return {
            id: `prompt.${topic}.${String(occurrence)}`,
            topic,
            copy,
            approval,
        };
    }),
    commonCopy: [
        {
            id: 'receipt.heading',
            title: '合伙人压力测试完成',
            copy: '两位参与者已完成同一版本的 Cofounder 测试。',
            approval,
        },
        {
            id: 'receipt.date-version',
            title: '测试记录',
            copy: '完成日期与内容版本用于识别这一次独立测试。',
            approval,
        },
        {
            id: 'receipt.cta',
            title: '创建你们的 Pair',
            copy: '邀请你的合伙人，完成一次双人压力测试。',
            approval,
        },
        {
            id: 'tombstone.withdrawn',
            title: '此结果已撤回',
            copy: '该公开页面不再提供，且不会显示此前的身份或结果信息。',
            approval,
        },
        {
            id: 'tombstone.unpublished',
            title: '页面不可用',
            copy: '此公开结果未发布、已取消发布或链接无效。',
            approval,
        },
        {
            id: 'disclaimer.before-test',
            title: '开始前',
            copy: 'Cofounder 是娱乐产品，不是科学、心理、法律或投资评估，也不能替代双方直接沟通。',
            approval,
        },
        {
            id: 'disclaimer.private-report',
            title: '报告说明',
            copy: '本报告用于开启对话，不评价个人，也不提供总体兼容性结论。',
            approval,
        },
        {
            id: 'report.generating',
            title: '报告生成中',
            copy: '双方回答已封存。系统正在按固定规则组装报告，请稍后返回。',
            approval,
        },
        {
            id: 'report.conservative',
            title: '稳定版本',
            copy: '自动分类未参与本次叙事选择；完整报告已由确定性规则与保守内容生成。',
            approval,
        },
    ],
} as const;
