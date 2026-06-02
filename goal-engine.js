const fs = require('fs');
const path = require('path');

let _xhrTemplate = null;
let _capabilityModel = null;

function loadKnowledgeBase() {
  try {
    const xhrPath = path.join(__dirname, 'data', 'xhr-template.json');
    if (fs.existsSync(xhrPath)) _xhrTemplate = JSON.parse(fs.readFileSync(xhrPath, 'utf-8'));
    const capPath = path.join(__dirname, 'data', 'capability-model.json');
    if (fs.existsSync(capPath)) _capabilityModel = JSON.parse(fs.readFileSync(capPath, 'utf-8'));
  } catch (e) {
    console.warn('[GOAL-ENGINE] Knowledge base load warning:', e.message);
  }
}
loadKnowledgeBase();

const REQUIRED_FIELDS = [
  { key: 'job', label: '岗位名称', examples: ['产品经理', 'GTM经理', '研发工程师'] },
  { key: 'level', label: '职级(P/M)', examples: ['P1', 'P2', 'P3', 'M1'] },
  { key: 'coreTasks', label: '核心任务(最重要的一件事)', examples: [] },
  { key: 'successCriteria', label: '成功标准(怎么算做成)', examples: [] },
  { key: 'bossExpectations', label: '上级期望/老板指令', examples: [] },
  { key: 'painPoints', label: '目前吃力的地方', examples: [] }
];

function assessCollectionCompleteness(profile) {
  if (!profile) return { completeness: 0, missingFields: REQUIRED_FIELDS.map(f => f.label), filledFields: [], score: {} };
  
  const score = {};
  let filledCount = 0;
  for (const field of REQUIRED_FIELDS) {
    const val = profile[field.key];
    if (val && (Array.isArray(val) ? val.length > 0 : String(val).trim().length > 0)) {
      score[field.key] = true;
      filledCount++;
    } else {
      score[field.key] = false;
    }
  }
  
  const completeness = filledCount / REQUIRED_FIELDS.length;
  return {
    completeness,
    missingFields: REQUIRED_FIELDS.filter(f => !score[f.key]).map(f => f.label),
    filledFields: REQUIRED_FIELDS.filter(f => score[f.key]).map(f => f.label),
    score
  };
}

function getNextCollectionQuestion(profile) {
  const assessment = assessCollectionCompleteness(profile);
  if (assessment.completeness >= 0.6) return null;
  
  for (const field of REQUIRED_FIELDS) {
    if (!assessment.score[field.key]) {
      if (field.key === 'job') {
        return `好的！先了解一下你的基本情况。你现在的**岗位名称**是什么？（比如：产品经理、GTM经理、研发工程师…不确定也没关系）`;
      }
      if (field.key === 'level') {
        return `了解。那你的**职级**大概是P几还是M几？（比如P1-P3是新人/初级，P4-P6是骨干，M1+是管理岗）`;
      }
      if (field.key === 'coreTasks') {
        return `收到。试用期时间很短，建议聚焦核心。你这几个月**最重要要完成的一件事**是什么？或者老板有没有给你分配具体的任务？`;
      }
      if (field.key === 'successCriteria') {
        return `记下了。针对这件事，**怎么算"做成了"？** 是有明确的数字指标（如达成率、按时交付），还是完成某个具体的交付物（如报告、方案）？`;
      }
      if (field.key === 'bossExpectations') {
        return `明白。你老板或上级有没有**口头说过试用期的期望**？或者JD里写的要求？有的话可以直接告诉我原话。`;
      }
      if (field.key === 'painPoints') {
        return `最后，目前你觉得哪里**最吃力、最需要帮助**？比如不知道从哪开始、怕方向不对、还是不会某项技能？`;
      }
    }
  }
  return null;
}

function parseProfileFromMessages(messages) {
  const fullText = messages.map(m => m.content || '').join('\n');
  const profile = {};
  
  const jobMatch = fullText.match(/(?:岗位|职位|做|是|作为)[：:\s]*?(.+?(?:经理|工程师|专员|主管|设计师|HR|运营|产品|研发|测试|市场|销售|财务|供应链|GTM|PM|实习|分析师))/i);
  if (jobMatch) profile.job = jobMatch[1].trim();
  
  const levelMatch = fullText.match(/[PBpb]\s*(\d+|[一二三四五六七八九])/i);
  if (levelMatch) {
    const numMap = {'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};
    const num = numMap[levelMatch[1]] || levelMatch[1];
    profile.level = (fullText.match(/[PBpb]/i)[0].toUpperCase()) + num;
  }
  
  const taskSection = fullText.split(/(?:任务|负责|在做|在忙|主要做)/gi).slice(1).join(' ');
  if (taskSection) {
    const tasks = taskSection.match(/[^。，,\n？！?!；;]{5,80}/g);
    if (tasks) profile.coreTasks = tasks.slice(0, 3).map(t => t.trim());
  }
  
  const criteriaKeywords = ['做成','标准','指标','目标','KPI','考核','验收','交付'];
  for (const kw of criteriaKeywords) {
    const idx = fullText.indexOf(kw);
    if (idx > -1) {
      const snippet = fullText.substring(Math.max(0, idx - 20), Math.min(fullText.length, idx + 80));
      if (!profile.successCriteria) profile.successCriteria = snippet.trim();
      break;
    }
  }
  
  const bossKeywords = ['老板','上级','leader','领导','导师','mentor','期望','要求','JD','指令'];
  for (const kw of bossKeywords) {
    const idx = fullText.toLowerCase().indexOf(kw.toLowerCase());
    if (idx > -1) {
      const snippet = fullText.substring(Math.max(0, idx - 10), Math.min(fullText.length, idx + 60));
      if (!profile.bossExpectations) profile.bossExpectations = snippet.trim();
      break;
    }
  }
  
  const painKeywords = ['吃力','困难','不懂','不会','迷茫','担心','焦虑','问题','卡住','偏了','不对'];
  for (const kw of painKeywords) {
    const idx = fullText.indexOf(kw);
    if (idx > -1) {
      const snippet = fullText.substring(Math.max(0, idx - 15), Math.min(fullText.length, idx + 50));
      if (!profile.painPoints) profile.painPoints = snippet.trim();
      break;
    }
  }
  
  return profile;
}

function matchCapabilityRequirements(level, job) {
  if (!_capabilityModel) return getDefaultCapabilities(level);
  
  const levelNum = parseInt(String(level || '').replace(/[^0-9]/g, '')) || 2;
  const capabilities = [];
  
  const sheets = Object.keys(_capabilityModel);
  for (const sheetName of sheets) {
    const sheet = _capabilityModel[sheetName];
    if (sheet.records) {
      for (const rec of sheet.records) {
        const values = Object.values(rec).join(' ');
        if (values.includes('初阶') && levelNum <= 2) capabilities.push({ source: sheetName, ...rec });
        else if (values.includes('中阶') && levelNum >= 2 && levelNum <= 4) capabilities.push({ source: sheetName, ...rec });
        else if (values.includes('高阶') && levelNum >= 4) capabilities.push({ source: sheetName, ...rec });
      }
    }
  }
  
  return capabilities.length > 0 ? capabilities.slice(0, 8) : getDefaultCapabilities(level);
}

function getDefaultCapabilities(level) {
  const levelNum = parseInt(String(level || '').replace(/[^0-9]/g, '')) || 2;
  if (levelNum <= 2) {
    return [
      { category: '公司融入', name: '公司认同', description: '理解公司文化、价值观和业务模式' },
      { category: '专业基础', name: '业务系统熟悉', description: '独立操作岗位核心工具和系统' },
      { category: '协作能力', name: '团队沟通', description: '与关键对接人建立有效协作关系' }
    ];
  } else if (levelNum <= 4) {
    return [
      { category: '专业深度', name: '独立交付', description: '独立负责完整任务模块并保证质量' },
      { category: '方法论', name: '流程优化', description: '识别并改进工作流程中的低效环节' },
      { category: '影响力', name: '跨部门协作', description: '主动发起跨部门合作并产出成果' }
    ];
  } else {
    return [
      { category: '战略思维', name: '业务洞察', description: '理解业务全貌并提出战略性建议' },
      { category: '团队建设', name: '人才培养', description: '指导新人成长并建立团队能力' },
      { category: '结果导向', name: '绩效达成', description: '驱动团队达成关键业务指标' }
    ];
  }
}

function generatePersonalizedGoals(profile, userInfo) {
  const startDate = new Date();
  const fmt = d => d.toISOString().slice(0, 10);
  const d30 = new Date(startDate.getTime() + 30 * 86400000);
  const d60 = new Date(startDate.getTime() + 60 * 86400000);
  const d90 = new Date(startDate.getTime() + 90 * 86400000);
  
  const job = profile.job || userInfo?.job || '';
  const department = profile.department || userInfo?.department || '';
  const level = profile.level || userInfo?.level || '';
  const coreTasks = profile.coreTasks || [];
  const successCriteria = profile.successCriteria || '';
  const bossExpectations = profile.bossExpectations || '';
  const painPoints = profile.painPoints || '';
  
  const capabilities = matchCapabilityRequirements(level, job);
  
  const kpis = deriveKPIsFromContext(coreTasks, successCriteria, capabilities, startDate, d30, d60, d90, fmt);
  const tasks = buildTaskStructure(coreTasks, successCriteria, bossExpectations, painPoints, startDate, d30, d60, d90, fmt);
  
  const totalWeight = kpis.reduce((s, k) => s + (Number(k.weight) || 0), 0) + 
                     tasks.reduce((s, t) => s + (Number(t.weight) || 0), 0);
  
  return {
    employeeName: userInfo?.name || profile.name || '',
    employeeId: userInfo?.id || '',
    department,
    job,
    level,
    period: '试用期',
    kpis: kpis,
    keyTasks: tasks,
    metadata: {
      source: coreTasks.length > 0 ? 'conversation_based' : 'template_fallback',
      generatedAt: new Date().toISOString(),
      completeness: assessCollectionCompleteness(profile).completeness,
      hasCoreTasks: coreTasks.length > 0,
      hasSuccessCriteria: !!successCriteria,
      capabilityMatched: capabilities.length > 0,
      totalWeight,
      format: 'XHR-compatible',
      note: '本目标方案符合xHR系统导入格式要求，可直接导出为xlsx文件'
    }
  };
}

function deriveKPIsFromContext(tasks, criteria, capabilities, start, d30, d60, d90, fmt) {
  const kpis = [];
  const fmtD = d => fmt(d);
  
  if (tasks && tasks.length > 0) {
    const taskText = tasks.join(' ');
    
    kpis.push({
      name: '核心任务交付率',
      definition: '按质按量完成核心任务：' + (tasks[0] || ''),
      startDate: fmtD(start), endDate: fmtD(d90),
      weight: 30,
      dataSource: '任务管理系统/上级评分(1-5分)',
      lastValue: '—',
      threshold: criteria || '按时完成率≥80%，质量评分≥3.0',
      target: '按时按质完成率≥95%，质量评分≥4.0',
      challenge: '完成率100%，评分≥4.5'
    });
    
    kpis.push({
      name: '专业能力掌握度',
      definition: capabilities.length > 0 
        ? '达到' + capabilities[0].name + '要求：' + capabilities[0].description
        : '独立执行岗位核心专业技能，无需他人辅助',
      startDate: fmtD(start), endDate: fmtD(d60),
      weight: 25,
      dataSource: '技能评估/实操检验/导师确认',
      lastValue: '—',
      threshold: '基础操作熟练，常见问题可独立解决',
      target: '独立处理复杂场景，可指导初级同事',
      challenge: '成为团队内该领域的参考标杆'
    });
  } else {
    kpis.push({
      name: '业务系统熟悉度',
      definition: '独立完成所在岗位核心业务系统操作，无需他人辅助',
      startDate: fmtD(start), endDate: fmtD(d30), weight: 20,
      dataSource: '系统操作记录/导师签字确认',
      lastValue: '—',
      threshold: '30天内独立操作率≥60%',
      target: '独立操作率≥90%，常见操作零求助',
      challenge: '独立操作率100%，关键操作可指导新人'
    });
    
    kpis.push({
      name: '核心流程掌握',
      definition: '理解并独立执行岗位相关核心业务流程',
      startDate: fmtD(start), endDate: fmtD(d60), weight: 20,
      dataSource: '流程检查清单/任务记录',
      lastValue: '—',
      threshold: '完成≥2个核心流程',
      target: '独立完成≥3个核心流程，出错率<10%',
      challenge: '完成≥5个流程，输出改善建议≥2条被采纳'
    });
  }
  
  kpis.push({
    name: '任务交付质量',
    definition: criteria || '按质按量完成导师/上级分配的关键任务',
    startDate: fmtD(start), endDate: fmtD(d90), weight: 25,
    dataSource: '任务管理表/上级评分(1-5分)',
    lastValue: '—',
    threshold: '任务按时完成率≥80%，质量评分≥3.0',
    target: '按时按质完成率≥95%，质量评分≥4.0',
    challenge: '完成率100%，评分≥4.5，主动承担≥1个额外任务'
  });
  
  kpis.push({
    name: '团队融入与协作',
    definition: '与关键对接人建立有效协作关系，能够参与跨部门配合',
    startDate: fmtD(start), endDate: fmtD(d90), weight: 20,
    dataSource: '对接人反馈/会议参与次数',
    lastValue: '—',
    threshold: '认识并完成≥5人1v1，参加≥3次跨部门会议',
    target: '与≥10人建立有效对接，独立发起≥2次跨部门协作',
    challenge: '发起跨部门协作≥4次且有可验证产出，被2名以上对接人书面认可'
  });
  
  return kpis;
}

function buildTaskStructure(tasks, criteria, bossExp, painPoints, start, d30, d60, d90, fmt) {
  const result = [];
  const fmtD = d => fmt(d);
  
  if (tasks && tasks.length > 0) {
    result.push({
      name: '核心任务：' + (tasks[0] || ''),
      definition: criteria || '独立完成"' + (tasks[0] || '') + '"，产出可验证的交付物',
      startDate: fmtD(new Date(start.getTime() + 7 * 86400000)),
      endDate: fmtD(d90),
      weight: 40,
      milestones: [
        { startDate: fmtD(new Date(start.getTime() + 7 * 86400000)), endDate: fmtD(d30), name: '完成"' + (tasks[0] || '') + '"的范围确认和方案初稿' },
        { startDate: fmtD(d30), endDate: fmtD(d60), name: '完成第一阶段执行并输出中期进展' },
        { startDate: fmtD(d60), endDate: fmtD(d90), name: '提交最终交付物并通过评审' }
      ]
    });
  } else {
    result.push({
      name: '试用期业务项目A',
      definition: '独立承接1个真实业务任务，产出可验收交付物',
      startDate: fmtD(new Date(start.getTime() + 14 * 86400000)), endDate: fmtD(d90),
      weight: 35,
      milestones: [
        { startDate: fmtD(new Date(start.getTime() + 14 * 86400000)), endDate: fmtD(new Date(start.getTime() + 30 * 86400000)), name: '完成项目范围确认和方案初稿' },
        { startDate: fmtD(new Date(start.getTime() + 30 * 86400000)), endDate: fmtD(d60), name: '完成第一阶段执行并输出中期报告' },
        { startDate: fmtD(d60), endDate: fmtD(d90), name: '提交最终交付物并通过导师评审(≥3分)' }
      ]
    });
  }
  
  result.push({
    name: '新人上手计划执行',
    definition: bossExp ? '基于上级期望："' + bossExp + '"' : '完成部门新人上手清单所有必选项',
    startDate: fmtD(start), endDate: fmtD(d30), weight: 25,
    milestones: [
      { startDate: fmtD(start), endDate: fmtD(new Date(start.getTime() + 7 * 86400000)), name: '完成所有系统权限开通和环境接入' },
      { startDate: fmtD(new Date(start.getTime() + 3 * 86400000)), endDate: fmtD(d30), name: '完成核心文档阅读和读后检核' },
      { startDate: fmtD(new Date(start.getTime() + 14 * 86400000)), endDate: fmtD(d30), name: painPoints ? '针对"' + painPoints + '"完成专项学习计划' : '完成首次导师check-in并记录待办' }
    ]
  });
  
  if (tasks && tasks.length > 1) {
    result.push({
      name: '辅助任务：' + (tasks[1] || ''),
      definition: '配合核心任务完成' + (tasks[1] || '') + '相关工作',
      startDate: fmtD(d30), endDate: fmtD(d90),
      weight: 25,
      milestones: [
        { startDate: fmtD(d30), endDate: fmtD(d60), name: (tasks[1] || '') + '启动和资源协调' },
        { startDate: fmtD(d60), endDate: fmtD(d90), name: (tasks[1] || '') + '完成并总结经验' }
      ]
    });
  } else {
    result.push({
      name: '能力提升与知识沉淀',
      definition: painPoints ? '重点突破：' + painPoints : '完成岗位所需的专业能力培训和认证',
      startDate: fmtD(start), endDate: fmtD(d90),
      weight: 25,
      milestones: [
        { startDate: fmtD(start), endDate: fmtD(d30), name: painPoints ? '识别"' + painPoints + '"的根本原因并制定学习计划' : '完成入职培训并通过考核' },
        { startDate: fmtD(d30), endDate: fmtD(d60), name: painPoints ? '通过实践应用解决"' + painPoints + '"' : '参加至少1次专业培训或工作坊' },
        { startDate: fmtD(d60), endDate: fmtD(d90), name: '沉淀学习心得或方法论文档' }
      ]
    });
  }
  
  result.push({
    name: '融入与协作',
    definition: '与团队成员和关键对接人建立有效关系',
    startDate: fmtD(start), endDate: fmtD(d90),
    weight: 15,
    milestones: [
      { startDate: fmtD(start), endDate: fmtD(d30), name: '完成≥5位关键同事的1v1交流' },
      { startDate: fmtD(d30), endDate: fmtD(d60), name: '参加≥3次跨部门会议或协作活动' },
      { startDate: fmtD(d60), endDate: fmtD(d90), name: '获得直接上级的正式反馈（书面或邮件）' }
    ]
  });
  
  return result;
}

function buildConfirmationSummary(profile, assessment) {
  var summary = '**我理解的你的情况（用于制定试用期目标）：**\n\n';

  if (profile.job) summary += '- **岗位**：' + profile.job + '\n';
  if (profile.level) summary += '- **职级**：' + profile.level + '\n';
  if (profile.coreTasks && profile.coreTasks.length > 0) {
    summary += '- **核心任务/重点工作**：\n';
    for (var i = 0; i < profile.coreTasks.length; i++) { summary += '  ' + (i+1) + '. ' + profile.coreTasks[i] + '\n'; }
  }
  if (profile.successCriteria) summary += '- **成功标准（怎么算做成）**：' + profile.successCriteria + '\n';
  if (profile.bossExpectations) summary += '- **上级期望/老板指令**：' + profile.bossExpectations + '\n';
  if (profile.painPoints) summary += '- **目前吃力的地方**：' + profile.painPoints + '\n';

  summary += '\n**信息完整度**：' + Math.round(assessment.completeness * 100) + '%';
  if (assessment.missingFields.length > 0) {
    summary += '\n**待补充**：' + assessment.missingFields.join('、') + '（标记为"待确认"）';
  }

  summary += '\n\n---\n**确认无误后，我将为你生成包含以下内容的试用期目标方案：**';
  summary += '\n📊 **关键绩效考核指标（KPI）** — 可量化的绩效指标，含门槛值、目标值、挑战值';
  summary += '\n📋 **试用期重点工作任务** — 具体任务描述、完成标准及关键里程碑';
  summary += '\n📄 **xHR导入格式** — 符合系统要求的表格格式，可直接导出xlsx文件';

  return summary;
}

module.exports = {
  REQUIRED_FIELDS,
  assessCollectionCompleteness,
  getNextCollectionQuestion,
  parseProfileFromMessages,
  matchCapabilityRequirements,
  generatePersonalizedGoals,
  buildConfirmationSummary,
  loadKnowledgeBase
};
