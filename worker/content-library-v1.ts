import type { Dimension } from './rules';

export const CONTENT_LIBRARY_VERSION = 'cofounder-content-v1';

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
            id: 'archetype.vision-reality',
            key: 'vision-reality',
            title: '望远镜与工具箱',
            englishTitle: 'Vision × Reality',
            explanation:
                '一人把远方说清楚，一人把脚下铺扎实。你们的优势不是谁说服谁，而是让野心持续接受现实检验。',
            safeTraits: ['方向感强', '落地有序', '互相校准'],
            teamQuotes: [
                '先看见未来，再把今天做完。',
                '一个抬头找路，一个低头铺路。',
                '愿景负责拉远，现实负责抵达。',
            ],
            approval,
        },
        {
            id: 'archetype.dual-big-outcome',
            key: 'dual-big-outcome',
            title: '双引擎造浪者',
            englishTitle: 'Category Builders',
            explanation:
                '你们都愿意为更大的结果投入长期筹码。共同的上限感很强，真正的功课是把速度、代价和阶段目标讲清楚。',
            safeTraits: ['目标远大', '推进有力', '长期投入'],
            teamQuotes: [
                '不是追浪，是一起造浪。',
                '两台引擎，先对齐航向。',
                '把大目标拆成今天的第一步。',
            ],
            approval,
        },
        {
            id: 'archetype.dual-product',
            key: 'dual-product',
            title: '双核产品组',
            englishTitle: 'Product Twins',
            explanation:
                '你们都习惯从用户、产品和证据出发。共同语言很多，但也要提前约定意见相同时谁执行、意见不同时谁收口。',
            safeTraits: ['用户敏感', '产品直觉', '证据导向'],
            teamQuotes: [
                '两个产品脑，一份发布清单。',
                '先问用户，再改答案。',
                '对细节认真，对彼此坦白。',
            ],
            approval,
        },
        {
            id: 'archetype.cashflow-operators',
            key: 'cashflow-operators',
            title: '现金流行动派',
            englishTitle: 'Cashflow Operators',
            explanation:
                '你们擅长把生存条件变成行动顺序，重视客户、交付和可持续节奏。别让短期确定性挤掉值得下注的长期机会。',
            safeTraits: ['务实经营', '交付可靠', '节奏清醒'],
            teamQuotes: [
                '先活下来，再活得漂亮。',
                '收入是反馈，交付是信用。',
                '把每一块钱都变成下一步。',
            ],
            approval,
        },
        {
            id: 'archetype.research-lab',
            key: 'research-lab',
            title: '前沿实验室',
            englishTitle: 'Research Lab',
            explanation:
                '你们愿意围绕难题、技术和新证据持续探索。优势来自认知深度，挑战是为探索设置能被市场检验的出口。',
            safeTraits: ['探索深入', '技术好奇', '耐心求证'],
            teamQuotes: [
                '先把未知变小，再把产品做大。',
                '允许实验失败，不允许停止学习。',
                '深水里找答案，岸上交付结果。',
            ],
            approval,
        },
        {
            id: 'archetype.narrative-market-fit',
            key: 'narrative-market-fit',
            title: '叙事市场搭档',
            englishTitle: 'Narrative-Market Fit',
            explanation:
                '你们能把产品价值翻译成市场愿意听懂的故事。最强时，叙事放大真实证据；最危险时，故事跑在产品前面。',
            safeTraits: ['表达清晰', '市场敏锐', '连接资源'],
            teamQuotes: [
                '让好产品被世界正确理解。',
                '故事负责开门，产品负责留人。',
                '先有证据，再把声音放大。',
            ],
            approval,
        },
        {
            id: 'archetype.complementary-monsters',
            key: 'complementary-monsters',
            title: '互补怪物',
            englishTitle: 'Complementary Monsters',
            explanation:
                '你们在关键能力上差得刚刚好，组合后的覆盖面明显大于各自单打独斗。把接口写清楚，互补才不会变成互相等待。',
            safeTraits: ['能力互补', '覆盖全面', '组合强劲'],
            teamQuotes: [
                '各自离谱，合起来靠谱。',
                '不同的强项，同一个战场。',
                '接口清楚，怪物出动。',
            ],
            approval,
        },
        {
            id: 'archetype.complementary-builders',
            key: 'complementary-builders',
            title: '互补建设者',
            englishTitle: 'Complementary Builders',
            explanation:
                '你们没有被单一标签定义，而是在不同位置上共同把事情建起来。稳定的合作来自持续分工、复盘和重新对齐。',
            safeTraits: ['协作稳健', '分工灵活', '持续建设'],
            teamQuotes: [
                '不必一样，也能一起建成。',
                '边做边对齐，边走边加固。',
                '两种方法，一个作品。',
            ],
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
        archetypeId: 'archetype.complementary-builders',
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
            'prompt.decision-deadlock.1',
            'prompt.conflict-latency.1',
            'prompt.external-role.1',
            'prompt.work-boundary.1',
            'prompt.unresolved-conflict.1',
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
