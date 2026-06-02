/**
 * 学习闭环引擎 v1.0
 * "系统主动触达 → 用户反馈 → 系统分析 → 精准支持"
 *
 * 核心能力：
 * 1. 记录每次触达与用户响应
 * 2. 分析用户反馈模式（积极/消极/中性）
 * 3. 基于历史反馈调整推荐策略
 * 4. 识别学习缺口并触发补充支持
 */

const LOOP_STATES = {
  INITIATED: 'initiated',
  RESPONDED: 'responded',
  ANALYZED: 'analyzed',
  SUPPORTED: 'supported',
};

const FEEDBACK_SIGNALS = {
  positive: ['好的', '可以', '谢谢', '太好了', '有用', '帮我', '开始', '试试', '好', '行', 'OK', 'ok',
    '想了解', '怎么弄', '怎么做', '怎么写', '怎么拆', '生成', '帮我看', '帮我想',
    '正需要', '正好', '对对对', '是的', '没错'],
  negative: ['不用了', '不需要', '算了', '没空', '忙', '下次', '再说吧', '不用谢', '知道了',
    '已经知道', '都懂', '不用你管', '别烦', '烦死了', '没用', '垃圾', '不行',
    '不对', '不是这个', '不相关', '不匹配', '不感兴趣', '跳过', '忽略'],
  confused: ['什么意思', '不懂', '不明白', '没看懂', '解释一下', '详细点', '具体点',
    '举个例子', '能说清楚吗', '不太明白', '有点晕', '复杂', '听不懂'],
};

function classifyUserResponse(message) {
  if (!message || typeof message !== 'string') return { sentiment: 'neutral', confidence: 0 };
  const lower = message.trim().toLowerCase();
  if (lower.length <= 1) return { sentiment: 'neutral', confidence: 0 };

  let posScore = 0, negScore = 0, confScore = 0;

  for (const kw of FEEDBACK_SIGNALS.positive) {
    if (lower.includes(kw.toLowerCase())) { posScore += 1; }
  }
  for (const kw of FEEDBACK_SIGNALS.negative) {
    if (lower.includes(kw.toLowerCase())) { negScore += 1; }
  }
  for (const kw of FEEDBACK_SIGNALS.confused) {
    if (lower.includes(kw.toLowerCase())) { confScore += 1; }
  }

  const max = Math.max(posScore, negScore, confScore);
  if (max === 0) return { sentiment: 'neutral', confidence: 0 };
  const total = posScore + negScore + confScore;
  const confidence = total > 0 ? max / total : 0;
  if (posScore === max) return { sentiment: 'positive', confidence, signals: posScore };
  if (negScore === max) return { sentiment: 'negative', confidence, signals: negScore };
  return { sentiment: 'confused', confidence, signals: confScore };
}

function recordInteraction(store, userId, topicId, triggerType, triggerData, userResponse) {
  const loopEntry = {
    id: 'cl_' + Date.now().toString(36),
    userId,
    topicId,
    triggerType,
    triggerData: triggerData || {},
    userResponse: userResponse || '',
    state: userResponse ? LOOP_STATES.RESPONDED : LOOP_STATES.INITIATED,
    analysis: null,
    refinedAction: null,
    createdAt: new Date().toISOString(),
  };

  if (userResponse) {
    loopEntry.analysis = classifyUserResponse(userResponse);
    loopEntry.state = LOOP_STATES.ANALYZED;
  }

  try {
    const session = store.getSession(userId) || {};
    const loops = session.learningLoops || [];
    loops.push(loopEntry);
    if (loops.length > 50) loops.shift();
    store.saveSession(userId, { ...session, learningLoops: loops });
  } catch (_) {}

  return loopEntry;
}

function getLearningProfile(store, userId) {
  const session = store.getSession(userId);
  if (!session || !session.learningLoops) return null;

  const loops = session.learningLoops;
  const profile = {
    totalInteractions: loops.length,
    positiveRate: 0,
    negativeRate: 0,
    confusedRate: 0,
    activeTriggers: {},
    weakAreas: [],
    strongAreas: [],
    lastInteraction: null,
    recommendedAdjustments: [],
  };

  let posCount = 0, negCount = 0, confCount = 0, neutralCount = 0;
  const triggerCounts = {};
  const areaScores = {};

  for (const loop of loops) {
    if (loop.analysis) {
      switch (loop.analysis.sentiment) {
        case 'positive': posCount++; break;
        case 'negative': negCount++; break;
        case 'confused': confCount++; break;
        default: neutralCount++;
      }

      const area = loop.triggerType || 'unknown';
      areaScores[area] = areaScores[area] || { pos: 0, neg: 0, conf: 0, total: 0 };
      areaScores[area].total++;
      switch (loop.analysis.sentiment) {
        case 'positive': areaScores[area].pos++; break;
        case 'negative': areaScores[area].neg++; break;
        case 'confused': areaScores[area].conf++; break;
      }
    }

    triggerCounts[loop.triggerType] = (triggerCounts[loop.triggerType] || 0) + 1;
    profile.lastInteraction = loop.createdAt;
  }

  const analyzed = posCount + negCount + confCount;
  profile.positiveRate = analyzed > 0 ? posCount / analyzed : 0;
  profile.negativeRate = analyzed > 0 ? negCount / analyzed : 0;
  profile.confusedRate = analyzed > 0 ? confCount / analyzed : 0;
  profile.activeTriggers = triggerCounts;

  for (const [area, scores] of Object.entries(areaScores)) {
    const netScore = (scores.pos * 1) - (scores.neg * 1) - (scores.conf * 0.5);
    if (netScore < -1 && scores.total >= 2) {
      profile.weakAreas.push({ area, score: netScore, total: scores.total, negRate: scores.neg / scores.total });
    } else if (netScore > 1 && scores.total >= 2) {
      profile.strongAreas.push({ area, score: netScore, total: scores.total });
    }
  }

  profile.recommendedAdjustments = generateAdjustments(profile);
  return profile;
}

function generateAdjustments(profile) {
  const adjustments = [];

  if (profile.confusedRate > 0.35) {
    adjustments.push({
      type: 'simplify',
      reason: '用户困惑率较高，建议简化表达、增加示例',
      action: '降低术语使用频率，每个建议附带具体案例',
    });
  }

  if (profile.negativeRate > 0.25) {
    adjustments.push({
      type: 'reduce_frequency',
      reason: '用户拒绝率偏高，建议降低主动触达频率',
      action: '将主动推送间隔从默认值增加50%',
    });
  }

  for (const wa of profile.weakAreas.slice(0, 3)) {
    adjustments.push({
      type: 'pivot_content',
      reason: `${wa.area}场景下用户反馈偏负面(${(wa.negRate * 100).toFixed(0)}%)`,
      action: `调整${wa.area}场景的内容策略，尝试不同的切入角度`,
    });
  }

  if (profile.positiveRate > 0.6 && profile.totalInteractions >= 5) {
    adjustments.push({
      type: 'deepen',
      reason: '整体正向反馈良好，可提供更深度的内容',
      action: '推荐进阶课程和挑战性任务',
    });
  }

  return adjustments;
}

function shouldAdjustRecommendation(profile, currentRecs) {
  if (!profile || !profile.recommendedAdjustments.length) return currentRecs;

  let adjusted = [...currentRecs];

  for (const adj of profile.recommendedAdjustments) {
    switch (adj.type) {
      case 'simplify':
        adjusted = adjusted.filter(c =>
          !(c.summary && c.summary.length > 60)
        ).slice(0, 5);
        break;
      case 'deepen':
        adjusted.sort((a, b) => (b.duration || 0) - (a.duration || 0));
        break;
      case 'pivot_content':
        adjusted = adjusted.filter(c => c.tags && c.tags.includes('实战'));
        break;
    }
  }

  return adjusted.length > 0 ? adjusted : currentRecs;
}

module.exports = {
  LOOP_STATES,
  FEEDBACK_SIGNALS,
  classifyUserResponse,
  recordInteraction,
  getLearningProfile,
  shouldAdjustRecommendation,
};
