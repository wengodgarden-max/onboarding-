/**
 * 学习时机感知引擎
 * 在对话中自动检测最佳学习窗口，精准推送学习建议
 */

const SIGNALS = {
  pain: {
    keywords: ['不知道怎么做', '不会', '搞不定', '第一次', '没做过', '不熟悉', '没经验', '头疼', '卡住了', '不知道怎么下手', '毫无头绪', '一筹莫展', '做了很久', '不知道从哪', '不知道从哪里', '完全不知道', '从哪里开始'],
    weight: 4,
    urgency: 'high',
    strategy: '痛点即学点——立刻推对应技能课程',
    courseTagHints: ['新人适应', '任务管理'],
  },
  preTask: {
    keywords: ['下周', '马上要', '老板让', '安排我做', '要开始', '准备做', '要写', '要交', '要上线', '要汇报'],
    weight: 3,
    urgency: 'medium',
    strategy: '任务开始前推预习/模板/案例资源',
    courseTagHints: ['任务管理', '项目跟进'],
  },
  calibration: {
    keywords: ['导师', '1v1', '1 on 1', 'one on one', '汇报', '对齐', 'review', '复盘'],
    weight: 3,
    urgency: 'medium',
    strategy: '校准前推1v1准备清单和沟通框架',
    courseTagHints: ['沟通表达', '领导力'],
  },
  onboardingStage: {
    weight: 2,
    urgency: 'low',
    strategy: '按入职天数分阶段推荐',
  },
  confidenceDip: {
    keywords: ['我行不行', '压力大', '跟不上', '做不好', '怕做错', '不敢问', '拖后腿', '帮不上忙', '没用', '想放弃'],
    weight: 4,
    urgency: 'high',
    strategy: '信心低时推基础巩固+导师沟通建议',
    courseTagHints: ['新人适应'],
  },
  curiosity: {
    keywords: ['为什么', '怎么做到的', '能讲', '能说说', '想了解', '怎么才能', '有什么方法', '有什么技巧'],
    weight: 2,
    urgency: 'low',
    strategy: '好奇心驱动时推深度/进阶内容',
    courseTagHints: ['系统思考'],
  },
};

const STAGE_CONFIG = {
  survival: { maxDay: 7, label: '新人融入期', focus: ['新人融入', '团队认识', '工具上手'], tags: ['新人适应'], userHint: '你刚来不久，先熟悉环境和人最重要', dayRange: '第 1-7 天' },
  task: { maxDay: 30, label: '任务上手期', focus: ['任务管理', '向上沟通', '时间管理'], tags: ['任务管理', '沟通表达', '时间管理'], userHint: '开始接活儿了，学会拆任务和向上汇报是关键', dayRange: '第 8-30 天' },
  contribution: { maxDay: 60, label: '独立贡献期', focus: ['项目推进', '跨团队协作', '独立交付'], tags: ['项目跟进', '沟通表达', '数据分析'], userHint: '已经能独立干活了，可以开始思考怎么做得更好', dayRange: '第 31-60 天' },
  independence: { maxDay: 90, label: '全面成长期', focus: ['影响力', '策略思考', '带领新人'], tags: ['领导力', '系统思考'], userHint: '试用期后半段，是展现综合能力的好时机', dayRange: '第 61-90 天' },
  beyond: { maxDay: Infinity, label: '持续发展期', focus: ['体系搭建', '业务理解', '前沿趋势'], tags: ['领导力', '系统思考'], userHint: '你已经站稳脚跟了，可以往更深的方向发展', dayRange: '90 天以后' },
};

function getOnboardingStage(daysOnboard) {
  if (daysOnboard <= 7) return 'survival';
  if (daysOnboard <= 30) return 'task';
  if (daysOnboard <= 60) return 'contribution';
  if (daysOnboard <= 90) return 'independence';
  return 'beyond';
}

function detectTimingSignals(userMessage, historyMessages, userInfo) {
  const fullText = (historyMessages || []).map(m => m.content || '').join('\n') + '\n' + userMessage;
  const recentText = historyMessages && historyMessages.length > 0
    ? historyMessages.slice(-4).map(m => m.content || '').join('\n') + '\n' + userMessage
    : userMessage;

  const signals = [];
  let totalScore = 0;

  for (const [type, config] of Object.entries(SIGNALS)) {
    if (type === 'onboardingStage') continue;

    let matches = 0;
    const matchedKeywords = [];
    for (const kw of config.keywords) {
      if (recentText.includes(kw)) {
        matches++;
        matchedKeywords.push(kw);
      }
    }

    if (matches > 0) {
      const score = Math.min(config.weight * matches, 10);
      signals.push({
        type,
        matches: matchedKeywords,
        score,
        weight: config.weight,
        urgency: config.urgency,
        strategy: config.strategy,
        tagHints: config.courseTagHints || [],
      });
      totalScore += score;
    }
  }

  const days = userInfo ? (userInfo.daysOnboard || 0) : 0;
  const stage = getOnboardingStage(days);
  const stageConfig = STAGE_CONFIG[stage];

  if (totalScore === 0 && (stage === 'survival' || stage === 'task')) {
    totalScore += 1;
  }

  signals.sort((a, b) => b.score - a.score);

  return {
    signals,
    totalScore,
    stage,
    stageConfig,
    threshold: 3,
    shouldRecommend: totalScore >= 3,
  };
}

function findStageCourses(timing, TAG_INDEX, COURSE_LIBRARY) {
  const stageTags = timing.stageConfig.tags || [];
  const names = new Set();
  for (const tag of stageTags) {
    if (TAG_INDEX[tag]) TAG_INDEX[tag].forEach(n => names.add(n));
  }
  if (names.size === 0) {
    if (TAG_INDEX['新人适应']) TAG_INDEX['新人适应'].forEach(n => names.add(n));
  }
  const courses = [];
  for (const name of names) {
    if (COURSE_LIBRARY[name]) courses.push({ name, ...COURSE_LIBRARY[name] });
  }
  return courses.slice(0, 3);
}

function findTimingCourses(timing, TAG_INDEX, COURSE_LIBRARY) {
  const names = new Set();
  for (const signal of timing.signals) {
    for (const tag of (signal.tagHints || [])) {
      if (TAG_INDEX[tag]) TAG_INDEX[tag].forEach(n => names.add(n));
    }
  }
  if (names.size === 0) return null;
  const courses = [];
  for (const name of names) {
    if (COURSE_LIBRARY[name]) courses.push({ name, ...COURSE_LIBRARY[name] });
  }
  return courses.slice(0, 3);
}

function buildTimingHint(timing, userInfo) {
  if (!timing.shouldRecommend) return null;

  const primarySignal = timing.signals[0];
  const stageCfg = timing.stageConfig;

  let hint = '';

  switch (primarySignal.type) {
    case 'pain':
      hint = '听起来这个点你正在摸索，要不要我给你找几个相关的学习方法？';
      break;
    case 'preTask':
      hint = '既然' + (primarySignal.matches[0] || '接下来有活') + '，要不要提前看看相关的资料，开工前有个底？';
      break;
    case 'calibration':
      hint = '马上要和' + (primarySignal.matches.includes('导师') ? '导师' : '上级') + '聊了，需不需要我帮你准备几个问题方向？';
      break;
    case 'confidenceDip':
      hint = '别给自己太大压力～试用期本来就是成长最快的阶段。想不想看看几个帮你稳住的思路？';
      break;
    case 'curiosity':
      hint = '这个问题问得好！要是我给你找几个深入点的内容看看？';
      break;
    default:
      hint = '聊到这儿，要不要我帮你找几个适合现在学的资料？';
  }

  return {
    hint,
    stage: stageCfg,
    primarySignal,
    urgency: primarySignal.urgency,
    timingQuality: Math.min(timing.totalScore, 10),
  };
}

function shouldInterject(timing, lastInterjectAt) {
  if (!timing.shouldRecommend) {
    if (timing.stage === 'survival' && timing.totalScore >= 1) return true;
    if (timing.stage === 'task' && timing.totalScore >= 2) return true;
    if (timing.stage === 'beyond' && timing.totalScore >= 2) return true;
    return false;
  }
  if (lastInterjectAt) {
    const elapsed = Date.now() - new Date(lastInterjectAt).getTime();
    const cooldownMs = timing.totalScore >= 6 ? 2 * 60 * 1000 : 4 * 60 * 1000;
    if (elapsed < cooldownMs) return false;
  }
  return true;
}

function findJourneyCourses(nodeKey, TAG_INDEX, COURSE_LIBRARY) {
  const JOURSE_TAG_MAP = {
    d1: ['新人适应'],
    d3: ['任务管理', '目标管理'],
    d7: ['沟通表达', '新人适应'],
    d30: ['项目跟进', '沟通表达'],
    d60: ['系统思考', '知识管理'],
    d90: ['领导力', '知识管理'],
  };
  const tags = JOURSE_TAG_MAP[nodeKey] || [];
  const names = new Set();
  for (const tag of tags) {
    if (TAG_INDEX[tag]) TAG_INDEX[tag].forEach(n => names.add(n));
  }
  if (names.size === 0) return [];
  const courses = [];
  for (const name of names) {
    if (COURSE_LIBRARY[name]) courses.push({ name, ...COURSE_LIBRARY[name] });
  }
  return courses.slice(0, 3);
}

function filterRelevantCourses(userMessage, courses, TAG_INDEX) {
  if (!courses || courses.length === 0) return [];
  const stops = ['的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这', '那', '他', '她', '它', '们', '什么', '哪', '怎么', '吗', '呢', '啊', '吧', '嗯', '哦', '刚', '新', '下'];
  const cleaned = userMessage.replace(/[？?！!。，,、\s]+/g, ' ').trim();
  const msgWords = cleaned.split(/\s+/).filter(w => w.length >= 2 && !stops.includes(w));
  if (msgWords.length === 0) return courses.slice(0, 3);
  const scored = courses.map(c => {
    const searchText = (c.name + ' ' + (c.summary || '') + ' ' + (c.tags || []).join(' ')).toLowerCase();
    let score = 0;
    for (const w of msgWords) {
      if (searchText.includes(w.toLowerCase())) score += 2;
    }
    return { ...c, _relScore: score };
  });
  scored.sort((a, b) => b._relScore - a._relScore);
  if (scored[0]._relScore === 0) return [];
  return scored.filter(c => c._relScore > 0).slice(0, 5).map(({ _relScore, ...rest }) => rest);
}

module.exports = { detectTimingSignals, buildTimingHint, shouldInterject, getOnboardingStage, findStageCourses, findTimingCourses, findJourneyCourses, filterRelevantCourses, STAGE_CONFIG, SIGNALS };
