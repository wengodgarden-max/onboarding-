/**
 * D1-D90 新人旅程引擎
 * 6个节点，每节点定义：触发条件、触发时机、产出物模板、Bot消息模板
 * v1.1 增强：双轨主动触达 + 学习闭环
 */

const NODES = {
  d1: {
    key: 'd1',
    day: 1,
    label: '激活',
    sub: '入职第一天',
    color: '#1a4070',
    triggerDays: [0, 1],
    cooldownHours: 24,
    produce: ['peopleMap', 'welcomeMsg', 'selfIntroDraft'],
    deliverable: '人脉地图 + 欢迎消息 + 自我介绍初稿',
    proactiveMessage: `👋 **欢迎加入！我是伴伴，你接下来90天的AI学伴。**

我能帮你做这些事：
• 📋 **制定试用期目标** — 帮你起草目标初稿（含KPI+重点工作）
• 🔨 **拆解任务** — 拿到任务不知道从哪开始？我帮你拆步骤
• 🔄 **方向自检** — 感觉走偏了？帮你对照检查
• 📚 **查资料** — OA流程、制度、知识库直接问
• ✨ **记录闪光** — 你的每个进步我都会记下来
• 🌱 **准备自我介绍** — 帮你起草"我是谁"展示稿

💡 **第一件事：让我们互相认识一下**
> 告诉我你的名字、来自哪里、之前做什么，我来帮你整理一份2-3分钟的自我介绍，方便你在团队里快速建立印象。

**或者你也可以直接问我：**
> "帮我写试用期目标" / "老大给了我一个XX任务不知道怎么开始" / "OA报销怎么走"`,
    getCheckMessage(userInfo) {
      const dept = userInfo.department || '你的部门';
      return this.proactiveMessage;
    },
    deliverablePrompts: {
      peopleMap: '基于部门信息和岗位，生成一份「值得认识的人」清单，每人附推荐理由和破冰话术。',
      selfIntroDraft: '基于新人基本信息，起草一份2-3分钟的「我是谁」自我介绍初稿：包含来自哪里、擅长什么、30天目标。',
    },
  },

  d3: {
    key: 'd3',
    day: 3,
    label: '目标对齐',
    sub: '首胜时刻',
    color: '#2a6049',
    triggerDays: [2, 3, 4],
    cooldownHours: 72,
    produce: ['goalDraft', 'goalChallenge', 'xhrFormat'],
    deliverable: '30/60/90天目标初稿 + challenge预演 + xHR格式稿',
    proactiveMessage: [
      '\ud83c\udfaf **\u5165\u804c\u7b2c3\u5929 \u00b7 \u76ee\u6807\u5236\u5b9a\u7684\u9ec4\u91d1\u7a97\u53e3**',
      '',
      'HR\u53ef\u80fd\u5df2\u7ecf\u8ba9\u4f60\u5199\u8bd5\u7528\u671f\u76ee\u6807\u4e86\u3002\u5927\u591a\u6570\u65b0\u4eba\u7684\u96be\u70b9\u4e0d\u5728\u201c\u5199\u201d\u2014\u2014\u800c\u5728**\u4e0d\u77e5\u9053\u8001\u677f\u771f\u6b63\u5728\u610f\u4ec0\u4e48**\u3002',
      '',
      '\u6211\u73b0\u5728\u53ef\u4ee5\u5e2e\u4f60\uff1a',
      '\u2022 \u270d\ufe0f \u57fa\u4e8e\u4f60\u7684\u5c97\u4f4d（{JOB_PLACEHOLDER}），\u8349\u62df30/60/90\u5929\u76ee\u6807\u521d\u7a3f',
      '\u2022 \ud83d\udd0d **\u9884\u6f14challenge\u70b9**\uff1a\u201c\u8fd9\u4e2a\u76ee\u6807\u591f\u4e0d\u591f\u5177\u4f53\uff1f\u201d\u201c\u8861\u91cf\u6807\u51c6\u662f\u4ec0\u4e48\uff1f\u201d',
      '\u2023 \ud83d\udccb \u751f\u6210\u9700\u8981\u548c\u4e0a\u7ea7\u786e\u8ba4\u7684 **3-5\u4e2a\u5173\u952e\u95ee\u9898**',
      '\u2024 \ud83d\udcc4 \u4e00\u952e\u751f\u6210 **xHR\u53ef\u5165\u5bfc\u7684\u76ee\u6807\u8868\u683c**',
      '',
      '\ud83d\udccc **\u5efa\u8bae\u4f60\u8fd9\u6837\u8ddf\u8001\u677f\u804a\uff08\u8bdd\u672f\u793a\u4f8b\uff09\uff1a**',
      '> "\u8001\u677f\uff0c\u6211\u521d\u6b65\u68b3\u7406\u4e86\u8bd5\u7528\u671f\u7684\u51e0\u4e2a\u65b9\u5411\u60f3\u8ddf\u4f60\u5bf9\u9f50\u4e00\u4e0b\uff1a',
      '> 1. \u7b2c\u4e00\u4e2a\u6211\u60f3\u5148\u641e\u5b9aXXX\uff0c\u8fbe\u5230\u4ec0\u4e48\u6807\u51c6\u7b97\u5408\u683c\uff1f',
      '> 2. \u7b2c\u4e8c\u4e09\u4e2a\u6708\u91cd\u70b9\u505aXXX\uff0c\u60a8\u89c9\u5f97\u4f18\u5148\u7ea7\u5bf9\u4e0d\u5bf9\uff1f',
      '> 3. \u6709\u6ca1\u6709\u4ec0\u4e48\u662f\u60a8\u89c9\u5f97\u91cd\u8981\u4f46\u6211\u6ca1\u5217\u8fdb\u6765\u7684\uff1f"',
      '',
      '**\u8f93\u5165\u4f60\u7684\u5c97\u4f4d\u804c\u8d23\uff0c\u6211\u5f00\u59cb\u5e2e\u4f60\u8349\u62df\u3002**'
    ].join('\n'),
    getCheckMessage(userInfo) {
      const job = userInfo.job || '你的岗位';
      return this.proactiveMessage.replace('${JOB_PLACEHOLDER}', job);
    },
    deliverablePrompts: {
      goalDraft: '帮新人生成一份30/60/90天试用期目标草稿，包含可验收的交付物和里程碑。',
      goalChallenge: '对目标草稿做预演：标注可能过于笼统、缺少衡量标准的地方，列出需要和上级确认的3-5个问题。',
      xhrFormat: '将目标转成xHR系统可用的格式化输出。',
    },
  },

  d7: {
    key: 'd7',
    day: 7,
    label: '进展检查',
    sub: '目标制定困难跟进',
    color: '#5a3a8a',
    triggerDays: [6, 7, 8],
    cooldownHours: 48,
    produce: ['goalProgressCheckIn'],
    deliverable: '目标制定进展跟进',
    proactiveMessage: `👋 **入职一周了，来看看你的进展！**

D1自我介绍做好了，D3目标初稿也拿到了——现在我想关心一下：

**目标制定之后，实际推进还顺利吗？**
• 有没有拿到目标后不知道怎么拆第一步的？
• 有没有发现指标和实际工作对不上的？
• 有没有哪个目标你还不确定"做到什么程度算合格"？
• 和上级聊完之后，目标有没有需要调整的地方？

💬 如果有卡住的地方，我帮你一起梳理；如果都顺利，那你放心往前跑就好。

**告诉我"进展顺利"或者直接说遇到什么困难，我来帮你。**`,
    getCheckMessage(userInfo) {
      return this.proactiveMessage;
    },
    deliverablePrompts: {
      goalProgressCheckIn: '基于新人的目标制定记录和一周进展，做一次目标推进困难排查：识别卡点、给出拆解建议、必要时建议与上级再次对齐。',
    },
  },

  d30: {
    key: 'd30',
    day: 30,
    label: '成果卡',
    sub: '第一个月',
    color: '#1e6b50',
    triggerDays: [28, 29, 30, 31],
    cooldownHours: 72,
    produce: ['achievementCard', 'progressReport', 'rehearsalNotes', 'directionChecklist'],
    deliverable: '成果卡 + 任务进展复盘 + 对上汇报稿 + 方向自检清单',
    highlight: true,
    proactiveMessage: `🏆 **入职满30天！第一个月复盘时刻**

这是试用期最重要的里程碑之一。让我帮你做四件事：

**① 成果卡** — 这个月你学了什么、建立了哪些连接、目标完成多少
**② 进度诊断** — 有没有任务卡住？有没有方向偏移的风险？
**③ 汇报稿** — 把"做了什么、还卡在哪里"说清楚，给老板看
**④ 方向自检** — 如果你感觉"不太对劲"，我们来做一次正式检查

🎯 **30天自检问题（请逐条回答）：**
1. 这个月完成了哪些具体的、可验收的产出？
2. 目前手头最吃力的任务是什么？卡在哪一步？
3. 和上级沟通的频率够吗？上次1v1聊了什么？
4. 有没有哪个瞬间你觉得"这个方向可能不对"？
5. 下个月你最想提升的一个能力是什么？

**回答任意一条或说"生成成果卡"，我来帮你整理。**`,
    getCheckMessage(userInfo) {
      return this.proactiveMessage;
    },
    deliverablePrompts: {
      achievementCard: '基于新人前30天的问答和任务记录，生成一份成果卡：包含学习进展、建立的联系、目标完成率、新人观察。',
      progressReport: '生成一份对上汇报稿：说清楚做了什么、还卡在哪里、下个月重点。',
      directionChecklist: '基于新人30天的对话信号，生成方向自检清单：标注可能的偏差点、需要确认的问题。',
    },
  },

  d60: {
    key: 'd60',
    day: 60,
    label: '局外人报告',
    sub: '贡献产出',
    color: '#7a4a1a',
    triggerDays: [58, 59, 60, 61],
    cooldownHours: 72,
    produce: ['outsiderReport', 'gapAnalysis', 'deepQ&A'],
    deliverable: '局外人报告 + 知识缺口分析 + 深度答疑',
    proactiveMessage: `👁️ **入职60天！你的"新鲜眼睛"有效期快到了**

过了这个阶段，你对流程的理解会被同化——**现在是你唯一能看到新人视角断层的时候**。

**我要请你做一份「局外人报告」（2-3个观察即可）：**
• 🕳️ **信息断层**：文档矛盾、流程过时、隐性规则
• 💡 **优化建议**：哪些地方可以改得更好
• ❓ **遗留困惑**：到现在还没搞清楚的事情

同时，这也是**深度答疑**的好时机：
• 还有哪些业务逻辑你不理解？
• 有没有跨部门协作中的障碍？
• 对转正有什么顾虑？

**你的这些观察会：**
✅ 成为部门知识库的珍贵输入
✅ 展示你的判断力和主动性
✅ 帮下一个新人少踩坑

**输入"生成局外人报告"或直接告诉我你的观察。**`,
    getCheckMessage(userInfo) {
      return this.proactiveMessage;
    },
    deliverablePrompts: {
      outsiderReport: '帮新人整理一份局外人报告：记录2-3个在试用期前60天观察到的信息断层、流程矛盾或优化机会，每个附建议。',
      gapAnalysis: '基于新人60天内的提问和困惑，分析部门知识库中哪些常见问题还没有被沉淀。',
    },
  },

  d90: {
    key: 'd90',
    day: 90,
    label: '一页纸',
    sub: '知识沉淀',
    color: '#b83232',
    triggerDays: [88, 89, 90, 91, 92],
    cooldownHours: 72,
    produce: ['onePager', 'knowledgeEntries', 'transitionDoc'],
    deliverable: '成长一页纸 + 知识库条目 + 交接文档',
    highlight: true,
    proactiveMessage: `🎓 **入职90天 · 试用期尾声**

最后一站，帮你做三件最有价值的事：

**📄 成长一页纸** — 90天的完整记录
→ 关键里程碑 | 积累的能力 | 发现的风险 | 下一步发展

**📚 知识沉淀** — 把你的经验变成下一个人的路标
→ "如果下一个新人来接我的位置，我会告诉他..."

**🔄 交接准备** — 如果转到正式岗位
→ 当前进展 | 待办事项 | 关键上下文 | 注意事项

**这是试用期最有价值的产出——不光是你的成长记录，也是给部门的知识贡献。**

**输入"生成一页纸"开始。**`,
    getCheckMessage(userInfo) {
      return this.proactiveMessage;
    },
    deliverablePrompts: {
      onePager: '基于新人90天的全部成长记录，生成一份一页纸：关键里程碑、积累的能力、发现的风险、下一步发展建议。',
      knowledgeEntries: '从新人的对话和记录中提取可沉淀为知识库条目的内容：常见问题及答案、流程避坑、岗位心得。',
    },
  },
};

const PROACTIVE_CHECK_RULES = {
  preGoalDeadline: {
    label: '试用期前1个月复盘邀请',
    condition: function(userInfo) { var d = userInfo.daysOnboard || 0; return d >= 55 && d <= 65; },
    message: [
      '⏰ **距离试用期结束还有约1个月**',
      '',
      '是时候做一次阶段性总结了。我可以帮你：',
      '',
      '1. 📊 **梳理当前进度** — 目标完成率、能力成长、待改进项',
      '2. 🎯 **识别风险** — 有没有什么可能影响转正的因素？',
      '3. 📋 **准备转正材料** — 提前整理业绩证据链',
      '',
      '**要不要现在做个中期复盘？**'
    ].join('\n'),
    priority: 'high'
  },
  stuckDetection: {
    label: '长期未活跃检测',
    condition: function(userInfo, topicData) {
      if (!topicData || !topicData.lastMessageAt) return false;
      var lastActive = new Date(topicData.lastMessageAt).getTime();
      var daysSince = (Date.now() - lastActive) / 86400000;
      return daysSince > 7 && (userInfo.daysOnboard || 0) < 90;
    },
    message: function(userInfo) {
      var name = userInfo.name || '你';
      return [
        '👋 ' + name + '，好久没见了！',
        '',
        '最近忙吗？如果在任务上遇到任何问题，随时可以找我聊聊：',
        '• 🔨 任务拆不开 → 我帮你分解步骤',
        '• 🔍 方向不确定 → 我帮你做自检',
        '• 📋 目标要调整 → 我帮你重新梳理',
        '',
        '别一个人找着~'
      ].join('\n');
    },
    priority: 'medium'
  }
};

function getNodeForDay(daysOnboard) {
  let best = null;
  for (const [key, node] of Object.entries(NODES)) {
    if (node.triggerDays.includes(daysOnboard)) return node;
    if (node.day <= daysOnboard) best = node;
  }
  return best;
}

function getProgress(daysOnboard) {
  const milestones = [1, 3, 7, 30, 60, 90];
  const completed = milestones.filter(m => daysOnboard >= m);
  const next = milestones.find(m => daysOnboard < m) || null;
  const current = getNodeForDay(daysOnboard);
  const nodes = Object.values(NODES).map(n => ({
    ...n,
    completed: daysOnboard >= n.day,
    active: current && current.key === n.key,
  }));
  return {
    daysOnboard,
    completedCount: completed.length,
    totalNodes: 6,
    current: current ? { key: current.key, label: current.label, day: current.day, sub: current.sub } : null,
    next: next ? getNodeForDay(next) : null,
    nextDays: next ? next - daysOnboard : 0,
    nodes,
    firstUncompleted: nodes.find(n => !n.completed),
  };
}

function shouldTriggerNode(userInfo, lastNodeTrigger) {
  if (!userInfo || !userInfo.daysOnboard) return null;
  const days = userInfo.daysOnboard;
  const node = getNodeForDay(days);
  if (!node) return null;

  if (lastNodeTrigger) {
    const since = Date.now() - new Date(lastNodeTrigger).getTime();
    if (since < node.cooldownHours * 3600000) return null;
  }

  if (node.triggerDays.includes(days)) return node;
  if (days > node.day && days <= node.day + 2 && days < 90) {
    const nextNode = Object.values(NODES).find(n => n.day > node.day && n.day <= days);
    if (nextNode && nextNode.triggerDays.includes(days)) return nextNode;
    if (!nextNode) return node;
  }

  return null;
}

function checkProactiveTriggers(userInfo, topicData) {
  const results = [];
  for (const [key, rule] of Object.entries(PROACTIVE_CHECK_RULES)) {
    try {
      if (rule.condition(userInfo, topicData)) {
        results.push({
          key,
          label: rule.label,
          message: typeof rule.message === 'function' ? rule.message(userInfo) : rule.message,
          priority: rule.priority || 'low',
        });
      }
    } catch (_) {}
  }
  return results;
}

function getNodeDeliverablePrompt(nodeKey, produceType) {
  const node = NODES[nodeKey];
  if (!node) return null;
  return node.deliverablePrompts[produceType] || null;
}

module.exports = {
  NODES,
  getNodeForDay,
  getProgress,
  shouldTriggerNode,
  checkProactiveTriggers,
  getNodeDeliverablePrompt,
};
