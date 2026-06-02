const COMPANY_STANDARDS = {
  'P1-P3': {
    label: '初级（P1-P3）',
    expectations: ['在指导下完成分配的任务', '掌握岗位基础工具和流程', '能够清晰汇报工作进展', '主动学习业务知识'],
  },
  'P4-P6': {
    label: '中级（P4-P6）',
    expectations: ['独立负责一个模块或项目', '能够拆解需求并制定执行计划', '跨部门协作和沟通', '对产出质量和效率负责', '具备一定的数据分析和复盘能力'],
  },
  'P7+': {
    label: '高级（P7及以上）',
    expectations: ['带领团队完成复杂项目', '制定业务策略和方向', '培养和指导团队成员', '跨体系资源协调', '对业务结果负责'],
  },
};

const ROLE_CAPABILITIES = {
  '产品经理': {
    typical: ['竞品分析', '需求管理', 'MRD/PRD撰写', '用户调研', '原型设计', '数据分析', '项目跟进'],
    industry: ['手机行业产品经理通常需要：GTM策略理解、供应链基础认知、硬件+软件协作经验'],
    taskTemplates: {
      '竞品分析': { steps: ['确定竞品范围和维度（功能/定价/渠道/用户画像）', '收集竞品信息和数据来源', '制作对比分析表（推荐用多维对比矩阵）', '提炼差异化洞察（不是罗列数据，是找机会点）', '输出报告和建议'], tip: '不确定分析框架的话可以找Leader要一份之前做过的竞品报告做模板参考。' },
      'PRD撰写': { steps: ['明确需求背景和用户场景（谁在什么情况下遇到什么问题）', '列出功能范围和优先级（P0/P1/P2）', '画交互流程图（可以在飞书文档里直接画）', '写验收标准和边界条件', '拉开发评审、确认排期'], tip: '飞书文档有PRD模板，直接复制改就行。先写完再追求完美。' },
      '需求管理': { steps: ['收集各渠道需求并录入需求池', '按业务价值和紧急度排优先级', '每个需求明确Owner和Deadline', '每周同步需求进展给关联方', '处理需求变更时记录变更原因'], tip: '需求池用飞书多维表格管理最方便，可以直接关联到人。' },
      '数据分析': { steps: ['明确分析目标（回答什么问题）', '确定数据来源和口径（别拿错数据）', '用图表呈现趋势和对比（别只放表格）', '给出conclusion和建议（数据→洞察→行动）'], tip: '公司BI平台上有现成的数据看板，可以先从看板里找答案，不用每次都自己跑SQL。' },
    },
  },
  'GTM经理': {
    typical: ['市场策略', '定价策略', '渠道管理', '竞品分析', '销售赋能', '上市执行'],
    industry: ['非洲市场GTM：需要理解当地消费者购买力、渠道结构、政策环境'],
    taskTemplates: {
      '上市执行': { steps: ['确认上市物料清单（KV、POSM、培训材料）', '制定上市时间表和各区域节奏', '和各区域销售团队对齐准备情况', '监控首周销售数据和市场反馈', '上市后72小时快速复盘'], tip: '上市checklist可以找之前做过的同事要一份成熟版本。' },
      '市场策略': { steps: ['分析目标市场的消费者画像和购买力', '确定产品定位和核心卖点', '制定定价策略和渠道策略', '规划上市节奏和营销日历', '设定KPI和监控机制'], tip: '非洲各个国家市场差异很大，不要用一个方案套所有国家。先深入了解一个重点市场。' },
    },
  },
  '研发工程师': {
    typical: ['代码质量', '系统设计', '技术文档', 'Code Review', '性能优化', '技术选型'],
    industry: [],
    taskTemplates: {
      '系统设计': { steps: ['理解业务需求和约束条件', '设计数据模型和接口定义', '画系统架构图和核心流程图', '考虑扩展性、性能、安全', '写设计文档并拉评审'], tip: '公司内部应该有架构评审模板，问Leader要一份。设计评审前先和同事过一遍。' },
    },
  },
  '项目经理': {
    typical: ['项目计划', '风险管理', '资源协调', '进度跟踪', '干系人沟通', '复盘总结'],
    industry: [],
    taskTemplates: {
      '项目计划': { steps: ['明确项目目标和成功标准', '拆解WBS（工作分解结构）', '估算工期和识别关键路径', '识别风险和制定应对方案', '制定沟通计划和节奏'], tip: '建议用飞书项目管理模板建一个项目空间，把所有相关方拉进来。' },
    },
  },
  'HR': {
    typical: ['招聘执行', '员工关系', '培训组织', '绩效管理', '数据分析', '文化建设'],
    industry: [],
    taskTemplates: {},
  },
  '营销': {
    typical: ['市场调研', '营销策划', '内容创作', '渠道投放', '数据分析', 'ROI优化'],
    industry: [],
    taskTemplates: {},
  },
  '供应链': {
    typical: ['采购管理', '库存控制', '物流协调', '供应商管理', '成本分析', '需求预测'],
    industry: [],
    taskTemplates: {},
  },
  '财务': {
    typical: ['财务报表', '预算管理', '成本分析', '税务合规', '风险控制'],
    industry: [],
    taskTemplates: {},
  },
};

const DEFAULT_CAPABILITIES = {
  typical: ['目标制定与执行', '团队沟通协作', '问题分析与解决', '时间管理', '汇报表达'],
  industry: [],
  taskTemplates: {},
};

function getLevelBucket(level) {
  if (!level) return 'P4-P6';
  const num = parseInt(level.replace(/[^0-9]/g, ''));
  if (!num) return 'P4-P6';
  if (num <= 3) return 'P1-P3'; if (num <= 6) return 'P4-P6';
  return 'P7+';
}

function matchRole(roleName) {
  if (!roleName) return DEFAULT_CAPABILITIES;
  for (const [key, val] of Object.entries(ROLE_CAPABILITIES)) {
    if (roleName.includes(key)) return val;
  }
  return DEFAULT_CAPABILITIES;
}

function findTaskTemplate(roleName, taskKeyword) {
  const caps = matchRole(roleName);
  if (!caps.taskTemplates) return null;
  for (const [k, v] of Object.entries(caps.taskTemplates)) {
    if (taskKeyword.includes(k) || k.includes(taskKeyword.slice(0, 3))) return v;
  }
  return null;
}

function generateProfile(userId, collected) {
  const job = collected.job || '';
  const level = collected.level || '';
  const tasks = collected.tasks || [];
  const painPoints = collected.pain_points || '';
  const managerInput = collected.manager_input || '';
  const managerName = collected.managerName || '';
  const mentorName = collected.mentorName || '';
  const hasSeparateMentor = !!(mentorName && mentorName !== managerName);

  const levelBucket = getLevelBucket(level);
  const levelLabel = COMPANY_STANDARDS[levelBucket] ? COMPANY_STANDARDS[levelBucket].label : '中级';
  const levelExpectations = COMPANY_STANDARDS[levelBucket] ? COMPANY_STANDARDS[levelBucket].expectations : [];
  const roleCaps = matchRole(job);

  const userCapabilities = tasks.map(function(t) {
    if (typeof t === 'string') return t; return t.name || t;
  });

  const matched = [];
  const gaps = [];

  for (const exp of levelExpectations) {
    const found = userCapabilities.some(function(c) { return c.includes(exp.slice(0, 2)); });
    if (found) matched.push({ item: exp, status: 'covered' });
    else gaps.push({ item: exp, source: '公司' + levelLabel + '标准', status: 'gap' });
  }

  for (const cap of roleCaps.typical) {
    const found = userCapabilities.some(function(c) { return c.includes(cap.slice(0, 2)); });
    if (!found && !gaps.find(function(g) { return g.item === cap; })) {
      gaps.push({ item: cap, source: '岗位典型能力', status: 'gap' });
    }
  }

  const taskBreakdown = [];
  if (tasks.length > 0) {
    const mainTask = tasks[0];
    if (typeof mainTask === 'string') {
      const template = findTaskTemplate(job, mainTask);
      if (template) taskBreakdown.push({ task: mainTask, steps: template.steps, tip: template.tip });
      else {
        taskBreakdown.push({
          task: mainTask,
          steps: ['先弄清楚这个任务的交付标准和截止日期', '拆解成2-3个可检查的阶段性产出', '找到可以复用的模板或参考案例', '先做出第一个版本再迭代'],
          tip: '不确定标准的话，直接问Leader："之前这个类型的工作有参考吗？做到什么程度算合格？"'
        });
      }
    }
  }

  const mentorCalibration = buildMentorCalibration(tasks, gaps, painPoints, mentorName || managerName, levelLabel);
  const leaderCalibration = buildLeaderCalibration(tasks, managerInput, managerName, painPoints, levelLabel, hasSeparateMentor);

  const profile = {
    job, level, levelLabel,
    daysOnboard: collected.days_onboard || 0,
    confirmed: matched.map(function(m) { return m.item; }).concat(userCapabilities),
    gaps: gaps.map(function(g) { return { item: g.item, source: g.source }; }),
    industryRef: roleCaps.industry || [],
    taskBreakdown,
    mentorCalibration,
    leaderCalibration,
    hasSeparateMentor,
    mentorName: mentorName || managerName,
    managerName,
    generatedAt: new Date().toISOString(),
  };

  return profile;
}

function buildMentorCalibration(tasks, gaps, painPoints, mentorName, levelLabel) {
  const questions = [];
  const timing = '建议第2-3周安排第一次1v1';

  if (gaps.length >= 2) {
    questions.push('目前自评下来，' + gaps.slice(0, 2).map(function(g) { return g.item; }).join('和') + '方面感觉需要加强，您觉得在试用期内需要重点提升哪些？');
  }
  if (tasks.length > 0) {
    const t = tasks[0];
    const taskName = typeof t === 'string' ? t : (t.name || '');
    questions.push('关于"' + taskName + '"这个任务，行业里有没有更好的做法可以借鉴？');
  }
  if (painPoints) {
    questions.push('我目前在' + painPoints.slice(0, 20) + '上遇到一些困惑，您当年是怎么过这一关的？');
  } else {
    questions.push('作为过来人，您觉得' + levelLabel + '试用期最容易踩的坑是什么？');
  }
  questions.push('您之前带的新人，试用期通过和没通过的，最大的差别是什么？');

  return {
    person: mentorName,
    timing: timing,
    focus: '能力培养、学习方向、职业困惑',
    questions: questions,
    expectedOutcome: '明确试用期能力提升重点和具体学习资源；约好下次1v1的时间节点',
  };
}

function buildLeaderCalibration(tasks, managerInput, managerName, painPoints, levelLabel, hasSeparateMentor) {
  const questions = [];
  const timing = '建议第1周内或第2周初安排第一次1v1';

  if (tasks.length > 0) {
    const t = tasks[0];
    const taskName = typeof t === 'string' ? t : (t.name || '');
    questions.push('关于"' + taskName + '"，做到什么程度算合格？有没有之前的交付物可以参考？');
  }
  if (managerInput) {
    questions.push('您提到"' + managerInput.slice(0, 30) + '"，能再具体讲讲时间节点和优先级吗？');
  }
  questions.push('试用期内除了手头这些事，还有哪些是我应该关注但可能还没意识到的？');
  if (painPoints) {
    questions.push('在' + painPoints.slice(0, 20) + '上我有些吃力，您觉得这个阶段我的时间和精力应该怎么分配？');
  }
  questions.push('您希望我在第1个月/第2个月/第3个月结束时分别达到什么状态？');

  return {
    person: managerName,
    timing: timing,
    focus: '任务对齐、目标期望、交付标准、资源需求',
    questions: questions,
    expectedOutcome: '拿到明确的试用期任务清单和优先级；对齐每个阶段的交付标准和期望',
    note: hasSeparateMentor ? '这次1v1聚焦任务和交付，成长和职业话题留给导师。' : '上半场聊任务对齐，下半场聊成长方向。',
  };
}

module.exports = { generateProfile, COMPANY_STANDARDS, ROLE_CAPABILITIES, getLevelBucket, matchRole, findTaskTemplate };
