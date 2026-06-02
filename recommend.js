const fs = require('fs');
const path = require('path');

const LEARNING_BASE_URL = process.env.LEARNING_BASE_URL || 'https://learning.transsion.com';

let COURSE_LIBRARY = {};
let TAG_INDEX = {};

(function loadCourses() {
  const fp = path.join(__dirname, 'data', 'courses_parsed.json');
  if (!fs.existsSync(fp)) { buildFallback(); return; }

  try {
    const raw = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    const seen = {};
    const courses = [];

    for (const r of raw) {
      const name = (r['课程名称'] || '').trim();
      if (!name || seen[name]) continue;
      seen[name] = true;

      const isNewbie = r['适合新人'] === '✓';
      const isOnline = r['数据来源'] === '在线课程';
      const ctype = (r['课程类型'] || '通用类').trim();
      const dept = (r['所属部门'] || '').trim();
      const lecturer = (r['讲师'] || '').replace(/^-$/, '').trim();

      const course = {
        name,
        url: LEARNING_BASE_URL + '/course?name=' + encodeURIComponent(name),
        type: isOnline ? '线上' : '线下',
        category: ctype,
        duration: '',
        summary: (dept ? dept + ' · ' : '') + ctype + (lecturer ? ' · ' + lecturer : ''),
        why: isNewbie ? '新人推荐课程' : ctype + '类课程',
        tags: [ctype, ...(dept ? [dept] : []), ...(isNewbie ? ['新人适应'] : [])],
        isNewbie,
      };

      COURSE_LIBRARY[name] = course;
      courses.push(course);

      for (const tag of course.tags) {
        if (!TAG_INDEX[tag]) TAG_INDEX[tag] = [];
        if (!TAG_INDEX[tag].includes(name)) TAG_INDEX[tag].push(name);
      }

      if (ctype.includes('沟通') || name.includes('沟通') || name.includes('汇报') || name.includes('表达')) {
        if (!TAG_INDEX['沟通表达']) TAG_INDEX['沟通表达'] = [];
        if (!TAG_INDEX['沟通表达'].includes(name)) TAG_INDEX['沟通表达'].push(name);
      }
      if (ctype.includes('管理') || name.includes('管理') || name.includes('领导') || name.includes('角色')) {
        if (!TAG_INDEX['领导力']) TAG_INDEX['领导力'] = [];
        if (!TAG_INDEX['领导力'].includes(name)) TAG_INDEX['领导力'].push(name);
      }
      if (name.includes('项目') || name.includes('PM') || name.includes('流程')) {
        if (!TAG_INDEX['项目跟进']) TAG_INDEX['项目跟进'] = [];
        if (!TAG_INDEX['项目跟进'].includes(name)) TAG_INDEX['项目跟进'].push(name);
      }
      if (name.includes('数据') || name.includes('分析') || name.includes('复盘')) {
        if (!TAG_INDEX['数据分析']) TAG_INDEX['数据分析'] = [];
        if (!TAG_INDEX['数据分析'].includes(name)) TAG_INDEX['数据分析'].push(name);
      }
      if (name.includes('时间') || name.includes('效率') || name.includes('计划')) {
        if (!TAG_INDEX['时间管理']) TAG_INDEX['时间管理'] = [];
        if (!TAG_INDEX['时间管理'].includes(name)) TAG_INDEX['时间管理'].push(name);
      }
    }

    console.log('[REC] Course library loaded:', Object.keys(COURSE_LIBRARY).length, 'courses,', Object.keys(TAG_INDEX).length, 'tags');
  } catch (e) {
    console.error('[REC] Failed to load course library:', e.message);
    buildFallback();
  }
})();

function buildFallback() {
  COURSE_LIBRARY['社招新人训'] = { name: '社招新人训', url: LEARNING_BASE_URL + '/course?name=' + encodeURIComponent('社招新人训'), type: '线上', category: '新人融入', duration: '', summary: '传音新人入职必修内容。', why: '试用期内必须完成', tags: ['新人适应'], isNewbie: true };
  COURSE_LIBRARY['任务管理'] = { name: '任务管理', url: LEARNING_BASE_URL + '/course?name=' + encodeURIComponent('任务管理'), type: '线上', category: '效能提升', duration: '', summary: '学习任务优先级排序与进度管理。', why: '新人最常遇到的就是事多理不清', tags: ['任务管理'], isNewbie: true };
  COURSE_LIBRARY['沟通汇报实战'] = { name: '沟通汇报实战', url: LEARNING_BASE_URL + '/course?name=' + encodeURIComponent('沟通汇报实战'), type: '线上', category: '沟通表达', duration: '', summary: '学习金字塔原理与SCQA汇报框架。', why: '向上汇报是新人的核心痛点', tags: ['沟通表达'], isNewbie: true };
  COURSE_LIBRARY['时间管理'] = { name: '时间管理', url: LEARNING_BASE_URL + '/course?name=' + encodeURIComponent('时间管理'), type: '线上', category: '效能提升', duration: '', summary: '四象限法则与周计划制定。', why: '试用期节奏快，时间管理是生存基本功', tags: ['时间管理'], isNewbie: true };
  COURSE_LIBRARY['问题分析与解决'] = { name: '问题分析与解决', url: LEARNING_BASE_URL + '/course?name=' + encodeURIComponent('问题分析与解决'), type: '线上', category: '思维方法', duration: '', summary: '系统学习问题定义到解决方案的完整思维链条。', why: '遇到复杂问题有结构化方法可循', tags: ['系统思考'], isNewbie: true };
  TAG_INDEX['新人适应'] = ['社招新人训'];
  TAG_INDEX['任务管理'] = ['任务管理'];
  TAG_INDEX['沟通表达'] = ['沟通汇报实战'];
  TAG_INDEX['时间管理'] = ['时间管理'];
  TAG_INDEX['系统思考'] = ['问题分析与解决'];
}

const JOB_COURSE_MAP = {
  '产品经理': {
    mustHave: ['数据分析', '需求分析', '竞品', 'PRD', '用户研究', '产品'],
    niceToHave: ['项目管理', '沟通表达', '系统思考', '金字塔'],
    exclude: ['影像实验室', '硬件测试', '制造', '生产', '供应链', '财务', '会计', '法务'],
    contextHints: {
      taskDecompose: ['竞品分析', '市场研究', '需求梳理', 'PRD撰写', '数据分析', '用户调研'],
      goalAlign: ['OGSM', '目标管理', 'OKR', '产品规划', '路线图'],
      directionCheck: ['沟通表达', '汇报', '向上管理', '金字塔原理'],
      learnToTask: ['方法论', '工具使用', '数据分析实战'],
    },
  },
  'GTM经理': {
    mustHave: ['营销', '市场', '渠道', 'GTM', '推广', '品牌'],
    niceToHave: ['沟通表达', '数据分析', '项目管理'],
    exclude: ['研发', '代码', '测试', '硬件', '制造', '影像实验室'],
    contextHints: {
      taskDecompose: ['数字营销', '渠道管理', '市场策略', '竞品分析'],
      goalAlign: ['目标管理', 'OKR', '销售目标', 'KPI'],
      directionCheck: ['沟通表达', '谈判', '客户管理'],
      learnToTask: ['营销方法', '市场工具'],
    },
  },
  '研发工程师': {
    mustHave: ['开发', '代码', '编程', '架构', '设计模式', '技术'],
    niceToHave: ['项目管理', '沟通表达', '问题分析'],
    exclude: ['销售', '市场', 'HR', '行政', '财务'],
    contextHints: {
      taskDecompose: ['技术方案', '代码规范', 'Code Review', '架构设计'],
      goalAlign: ['技术成长', '项目交付', '质量标准'],
      directionCheck: ['技术评审', '沟通协作'],
      learnToTask: ['技术文档', '开发流程', '工具链'],
    },
  },
  '运营': {
    mustHave: ['运营', '内容', '活动', '用户增长', '数据'],
    niceToHave: ['沟通表达', '项目管理', '创意'],
    exclude: ['硬件', '制造', '代码', '财务合规'],
    contextHints: {
      taskDecompose: ['活动策划', '内容运营', '用户运营', '数据分析'],
      goalAlign: ['运营指标', '增长目标', 'KPI'],
      directionCheck: ['沟通表达', '跨部门协作'],
      learnToTask: ['运营工具', '分析方法'],
    },
  },
  'default': {
    mustHave: [],
    niceToHave: ['任务管理', '沟通表达', '时间管理', '问题分析'],
    exclude: [],
    contextHints: {},
  },
};

const BREAKPOINT_RECOMMEND_RULES = {
  goalAlign: {
    primaryTags: ['任务管理', '目标管理', 'OGSM', '高效执行'],
    fallbackTags: ['通用类', '新人适应'],
    reasonTemplate: '帮你把模糊的想法整理成可执行的目标框架',
    maxCourses: 5,
  },
  taskDecompose: {
    primaryTags: ['任务管理', '项目跟进', '问题分析与解决', '六顶思考帽', '七步成诗'],
    fallbackTags: ['通用类', '效能提升'],
    reasonTemplate: '拆解任务需要结构化方法，这些课给你工具箱',
    maxCourses: 6,
  },
  directionCheck: {
    primaryTags: ['沟通表达', '领导力', '结构化思考', '汇报'],
    fallbackTags: ['通用类', '管理类'],
    reasonTemplate: '方向自检后可能需要和上级沟通，提前准备表达框架',
    maxCourses: 8,
  },
  learnToTask: {
    primaryTags: ['任务管理', '新人适应', '通用类'],
    fallbackTags: ['通用类'],
    reasonTemplate: '把学到的知识转化成实际操作能力',
    maxCourses: 5,
  },
};

const JOURNEY_NODE_RECOMMENDATIONS = {
  d3: {
    primaryTags: ['任务管理', '目标管理', 'OGSM', '高效执行四原则'],
    fallbackTags: ['通用类', '新人适应'],
    reason: '入职第3天是设定试用期目标的最佳时机',
    maxCourses: 4,
  },
  d7: {
    primaryTags: ['沟通表达', '自我展示', '汇报'],
    fallbackTags: ['通用类'],
    reason: '首周展示需要清晰的自我介绍框架',
    maxCourses: 3,
  },
  d30: {
    primaryTags: ['项目跟进', '沟通表达', '复盘画布', '数据分析'],
    fallbackTags: ['通用类', '管理类'],
    reason: '第一个月复盘需要结构化的总结方法',
    maxCourses: 5,
  },
  d60: {
    primaryTags: ['系统思考', '案例分析', '知识管理', '复盘画布'],
    fallbackTags: ['通用类', '思维方法'],
    reason: '局外人报告需要深度思考和分析能力',
    maxCourses: 5,
  },
  d90: {
    primaryTags: ['领导力', '职业生涯规划', '知识管理'],
    fallbackTags: ['通用类', '管理类'],
    reason: '转正阶段需要展现综合能力和成长潜力',
    maxCourses: 4,
  },
};

function getJobConfig(job) {
  if (!job) return JOB_COURSE_MAP['default'];
  const normalizedJob = job.trim();
  for (const [key, config] of Object.entries(JOB_COURSE_MAP)) {
    if (normalizedJob.includes(key) || key.includes(normalizedJob.split(/[/\-]/)[0])) {
      return config;
    }
  }
  return JOB_COURSE_MAP['default'];
}

function isCourseRelevantForJob(courseName, jobConfig) {
  if (!jobConfig || !jobConfig.exclude) return true;
  for (const excl of jobConfig.exclude) {
    if (courseName.toLowerCase().includes(excl.toLowerCase())) return false;
  }
  return true;
}

function scoreCourseForJob(courseName, jobConfig) {
  if (!jobConfig) return 0;
  let score = 0;
  const lowerName = courseName.toLowerCase();
  for (const must of jobConfig.mustHave || []) {
    if (lowerName.includes(must.toLowerCase())) score += 10;
  }
  for (const nice of jobConfig.niceToHave || []) {
    if (lowerName.includes(nice.toLowerCase())) score += 4;
  }
  return score;
}

function getContextualCourseHints(job, breakpointType, userMessage) {
  const jobConfig = getJobConfig(job);
  const hints = (jobConfig.contextHints && jobConfig.contextHints[breakpointType]) || [];
  if (hints.length === 0 && jobConfig.mustHave) {
    return jobConfig.mustHave.slice(0, 3);
  }
  return hints;
}

function smartRecommend(options) {
  const {
    userInfo = {},
    breakpointType = null,
    journeyNodeKey = null,
    timingResult = null,
    userMessage = '',
    knowledgeEntries = [],
    historyMessages = [],
    maxResults = 8,
  } = options;

  const job = userInfo.job || '';
  const department = userInfo.department || '';
  const daysOnboard = userInfo.daysOnboard || 0;
  const jobConfig = getJobConfig(job);

  const scored = new Map();
  const globalSeen = new Set();

  function addCandidate(name, score, reason) {
    if (!name || globalSeen.has(name)) return false;
    const info = COURSE_LIBRARY[name];
    if (!info) return false;
    if (!isCourseRelevantForJob(name, jobConfig)) return false;
    globalSeen.add(name);
    scored.set(name, { ...info, _recScore: score, _recReason: reason });
    return true;
  }

  function collectFromTagList(tags, baseScore, reason) {
    if (!tags) return;
    for (const tag of tags) {
      const names = TAG_INDEX[tag] || [];
      for (const n of names) {
        if (globalSeen.has(n)) continue;
        const info = COURSE_LIBRARY[n];
        if (!info) continue;
        if (!isCourseRelevantForJob(n, jobConfig)) continue;
        let finalScore = baseScore;
        finalScore += scoreCourseForJob(n, jobConfig);
        if (userMessage && userMessage.length > 2) {
          const searchText = (n + ' ' + (info.summary || '') + ' ' + (info.tags || []).join(' ')).toLowerCase();
          const msgLower = userMessage.toLowerCase();
          const words = msgLower.replace(/[？?！!。，,、\s]+/g, ' ').split(/\s+/).filter(w => w.length >= 2);
          for (const w of words) {
            if (searchText.includes(w)) finalScore += 3;
          }
        }
        addCandidate(n, finalScore, reason);
      }
    }
  }

  if (breakpointType && BREAKPOINT_RECOMMEND_RULES[breakpointType]) {
    const rule = BREAKPOINT_RECOMMEND_RULES[breakpointType];
    const contextualHints = getContextualCourseHints(job, breakpointType, userMessage);
    const enhancedPrimary = [...(rule.primaryTags || []), ...contextualHints];
    collectFromTagList(enhancedPrimary, 50, rule.reasonTemplate || `针对${breakpointType}场景推荐`);
    collectFromTagList(rule.fallbackTags, 20, rule.reasonTemplate || '通用补充推荐');
  }

  if (journeyNodeKey && JOURNEY_NODE_RECOMMENDATIONS[journeyNodeKey]) {
    const jRule = JOURNEY_NODE_RECOMMENDATIONS[journeyNodeKey];
    collectFromTagList(jRule.primaryTags, 40, jRule.reason || `旅程节点${journeyNodeKey}推荐`);
    collectFromTagList(jRule.fallbackTags, 15, '节点补充推荐');
  }

  if (timingResult && timingResult.shouldRecommend) {
    for (const signal of timingResult.signals) {
      collectFromTagList(signal.tagHints, 25 + signal.score * 2, signal.strategy || '时机信号推荐');
    }
    collectFromTagList(timingResult.stageConfig.tags, 15, `${timingResult.stageConfig.label}阶段推荐`);
  }

  if (knowledgeEntries && knowledgeEntries.length > 0) {
    for (const entry of knowledgeEntries) {
      const entryTags = entry.tags || [];
      const entryCategory = entry.category || '';
      collectFromTagList(entryTags, 30, `知识库关联：${entry.title || ''}`);
      const relatedByCat = TAG_INDEX[entryCategory] || [];
      for (const n of relatedByCat.slice(0, 2)) {
        addCandidate(n, 20, `知识库分类关联：${entryCategory}`);
      }
    }
  }

  if (scored.size === 0 || scored.size < 3) {
    const stageDays = daysOnboard <= 7 ? 'survival' : daysOnboard <= 30 ? 'task' : daysOnboard <= 60 ? 'contribution' : 'independence';
    const STAGE_DEFAULT_TAGS = {
      survival: ['新人适应', '通用类'],
      task: ['任务管理', '沟通表达', '时间管理'],
      contribution: ['项目跟进', '沟通表达', '数据分析'],
      independence: ['领导力', '系统思考', '知识管理'],
    };
    collectFromTagList(STAGE_DEFAULT_TAGS[stageDays] || STAGE_DEFAULT_TAGS.survival, 10, `${stageDays}阶段兜底推荐`);
  }

  if (jobConfig.mustHave && jobConfig.mustHave.length > 0) {
    for (const mustKeyword of jobConfig.mustHave) {
      for (const [cname, cinfo] of Object.entries(COURSE_LIBRARY)) {
        if (globalSeen.has(cname)) continue;
        if (cname.toLowerCase().includes(mustKeyword.toLowerCase())) {
          addCandidate(cname, 35 + scoreCourseForJob(cname, jobConfig), `岗位核心技能：${job}`);
        }
      }
    }
  }

  const results = Array.from(scored.values())
    .sort((a, b) => b._recScore - a._recScore)
    .slice(0, maxResults)
    .map(({ _recScore, _recReason, ...rest }) => ({
      ...rest,
      why: _recReason || rest.why,
    }));

  return results;
}

function recommendCourses(profile) {
  const gaps = profile.gaps || [];
  const scored = {};

  for (const gap of gaps) {
    const gapItem = gap.item || '';
    let matched = false;
    for (const [tag, courseNames] of Object.entries(TAG_INDEX)) {
      if (gapItem.includes(tag) || tag.includes(gapItem.slice(0, 2)) || gapItem.slice(0, 2).includes(tag.slice(0, 2))) {
        for (const cn of courseNames) {
          scored[cn] = (scored[cn] || 0) + 1;
          matched = true;
        }
      }
    }
    if (!matched) {
      const newbieCourses = TAG_INDEX['新人适应'] || [];
      for (const cn of newbieCourses) {
        scored[cn] = (scored[cn] || 0) + 0.5;
      }
    }
  }

  if (Object.keys(scored).length === 0) {
    const defaults = ['社招新人训', '任务管理', '沟通汇报实战', '时间管理'];
    for (const d of defaults) {
      if (COURSE_LIBRARY[d]) scored[d] = (scored[d] || 0) + 1;
    }
  }

  const sorted = Object.entries(scored)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return sorted.map(([name, score]) => {
    const info = COURSE_LIBRARY[name];
    if (!info) return { id: name, name, url: '#', score, type: '线上', category: '通用', duration: '', summary: '', why: '', tags: [] };
    return {
      id: name,
      name: info.name,
      url: info.url,
      score: Math.round(score * 10) / 10,
      type: info.type,
      category: info.category,
      duration: info.duration,
      summary: info.summary,
      why: info.why,
      tags: info.tags,
    };
  });
}

module.exports = { recommendCourses, smartRecommend, COURSE_LIBRARY, TAG_INDEX, JOB_COURSE_MAP, BREAKPOINT_RECOMMEND_RULES, JOURNEY_NODE_RECOMMENDATIONS, getJobConfig };
