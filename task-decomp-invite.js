/**
 * L3任务拆解主动邀约引擎
 * V1.0 P0功能：目标制定完成后，主动邀约用户进行任务拆解
 *
 * 触发条件：
 * 1. 用户触发了goalAlign断点且生成了xHR格式目标
 * 2. 用户在对话中提到"目标写好了/目标定了/目标搞定了"
 *
 * 设计原则：
 * - 不强迫用户，提供"现在开始 OR 以后再用"两种选择
 * - 强调能力信号："我可以做到这个"
 * - 语气温暖，像师兄/师姐的提醒
 */

const TASK_DECOMP_INVITE_CONFIG = {
  cooldownHours: 24,  // 冷却时间24小时（避免重复打扰）
  maxInvitesPerUser: 3,  // 每个用户最多邀约3次
  inviteMessage: `🎯 **太棒了！目标已经清晰了。**

接下来最关键的一步是：**把目标拆成具体的行动步骤**。

很多新人在这一步卡住——知道要做什么，但不知道从哪开始、先做什么、做到什么程度算合格。

💡 **我可以帮你做任务拆解**（完全免费，随时可以用）：

📌 **拆解后的你会得到：**
• 🧩 把你的30/60/90天目标拆成每周的具体行动
• 📏 识别每个任务的完成标准和验收方式
• ⚡ 排出优先级和依赖关系
• ❓ 生成需要和导师确认的关键问题

---

🚀 **两种启动方式（你选）：**

**1️⃣ 现在就开始** 🎉
> 告诉我你第一个月的目标是什么，我帮你拆第一周的步骤
> （比如："第一个月要熟悉产品流程和团队协作"）

**2️⃣ 以后再用** ⏳
> 等你接到第一个真实任务时再来找我
> 只要说一句："帮我拆一下这个任务"就行

---

无论哪种方式，**我都在这里陪你** 👋

💬 **回复任意内容开始，或说"稍后再说"跳过**`,

  followUpMessages: {
    userChoseNow: [
      `好的！那我们开始吧 ✨

请告诉我：**你第一个月的重点目标是什么？**

可以简单描述，比如：
• "熟悉公司的产品线和开发流程"
• "完成新人培训课程并通过考核"
• "参与XX项目的前期调研工作"

我会帮你把它拆成可执行的步骤～`,
    ],
    userChoseLater: [
      `没问题！随时欢迎你回来 😊

当你接到第一个真实任务、或者想拆解任何目标的时候，
只需要对我说：**"帮我拆一下这个任务"**

我会立刻帮你：
• 分析任务的优先级和依赖关系
• 拆成3-5个可执行的步骤
• 标注每个步骤的完成标准

**记住：我不是在催你，而是在等你需要的时候出现。**

加油！我在这里陪你 💪`,
    ],
  },
};

/**
 * 检测是否应该触发L3任务拆解邀约
 * @param {Object} userInfo - 用户信息（从identity模块获取）
 * @param {Object} topic - 当前话题对象
 * @param {Array} history - 对话历史
 * @returns {Object|null} 返回邀约信息或null
 */
function shouldInviteForTaskDecomposition(userInfo, topic, history) {
  const userId = userInfo.id || userInfo.userId;

  if (!userId) {
    console.log('[TASK-DECOMP-INVITE] 缺少userId，跳过');
    return null;
  }

  const now = new Date();
  const lastInviteAt = topic.lastTaskDecompInviteAt
    ? new Date(topic.lastTaskDecompInviteAt)
    : new Date(0);

  const hoursSinceLastInvite = (now - lastInviteAt) / (1000 * 60 * 60);
  if (hoursSinceLastInvite < TASK_DECOMP_INVITE_CONFIG.cooldownHours) {
    console.log(`[TASK-DECOMP-INVITE] 冷却中，距上次邀约${hoursSinceLastInvite.toFixed(1)}小时`);
    return null;
  }

  const inviteCount = topic.taskDecompInviteCount || 0;
  if (inviteCount >= TASK_DECOMP_INVITE_CONFIG.maxInvitesPerUser) {
    console.log(`[TASK-DECOMP-INVITE] 已达最大邀约次数(${inviteCount}次)`);
    return null;
  }

  const hasGoalDraft = checkGoalCompletionSignal(topic);
  const mentionedGoalDone = checkGoalDoneInHistory(history);

  if (hasGoalDraft || mentionedGoalDone) {
    console.log(`[TASK-DECOMP-INVITE] 检测到目标完成信号: goalDraft=${hasGoalDraft}, mentioned=${mentionedGoalDone}`);

    return {
      type: 'proactive:taskDecompInvite',
      message: TASK_DECOMP_INVITE_CONFIG.inviteMessage,
      triggerReason: hasGoalDraft ? '已生成xHR格式目标' : '对话中提到目标已完成',
      timestamp: now.toISOString(),
    };
  }

  return null;
}

function checkGoalCompletionSignal(topic) {
  return topic.lastBreakpointType === 'goalAlign'
    && (topic.xhrExport || topic.goalGenerated);
}

function checkGoalDoneInHistory(history) {
  if (!history || history.length === 0) return false;

  const recentMessages = history.slice(-5);
  const goalDoneKeywords = [
    '目标写好了', '目标定了', '目标搞定了', '目标完成了',
    '目标OK了', '目标搞定', '目标已经写好', '目标已经定好'
  ];

  return recentMessages.some(msg => {
    const content = (msg.content || msg.text || '').toLowerCase();
    return goalDoneKeywords.some(kw => content.includes(kw.toLowerCase()));
  });
}

function handleUserResponseToInvite(userMessage) {
  const msg = (userMessage || '').toLowerCase().trim();

  const chooseNowPatterns = [
    '现在开始', '现在就', '好的', '可以', '行', '开始吧',
    '帮我拆', '拆一下', '第一个月', '先拆', '来吧'
  ];

  const chooseLaterPatterns = [
    '稍后', '以后', '下次', '再说', '暂时不', '先不用',
    '稍后再说', '跳过', '不用了', '谢谢', '知道了'
  ];

  if (chooseNowPatterns.some(p => msg.includes(p))) {
    return {
      response: 'now',
      followUp: TASK_DECOMP_INVITE_CONFIG.followUpMessages.userChoseNow[0],
    };
  }

  if (chooseLaterPatterns.some(p => msg.includes(p))) {
    return {
      response: 'later',
      followUp: TASK_DECOMP_INVITE_CONFIG.followUpMessages.userChoseLater[0],
    };
  }

  return {
    response: 'unclear',
    followUp: null,
  };
}

module.exports = {
  shouldInviteForTaskDecomposition,
  handleUserResponseToInvite,
  CONFIG: TASK_DECOMP_INVITE_CONFIG,
};
