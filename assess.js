/**
 * 能力体检模块
 * 基于传音职级标准 + 对话数据，生成能力雷达图 + 自适应学习路径
 */

const DIMENSIONS = {
  task: { label: '任务执行', icon: '🔨', weight: 5, desc: '按时按质交付任务，拆解步骤清晰' },
  comm: { label: '沟通汇报', icon: '💬', weight: 5, desc: '向上汇报结构清晰，横向沟通高效' },
  think: { label: '系统思考', icon: '🧠', weight: 4, desc: '能从全局看问题，找到关键杠杆点' },
  learn: { label: '学习迁移', icon: '📖', weight: 4, desc: '能把学到的知识用到工作中' },
  collab: { label: '协作协同', icon: '🤝', weight: 3, desc: '跨团队配合顺畅，主动分享信息' },
  owner: { label: '主人翁意识', icon: '🎯', weight: 4, desc: '对结果负责，不光完成任务还关注效果' },
};

const PER_LEVEL_BENCHMARKS = {
  'B1': { task: 2, comm: 2, think: 1.5, learn: 2, collab: 2, owner: 2 },
  'B1-1': { task: 2.5, comm: 2.5, think: 2, learn: 2.5, collab: 2.5, owner: 2.5 },
  'B2': { task: 3.5, comm: 3, think: 3, learn: 3, collab: 3, owner: 3 },
  'B2-1': { task: 4, comm: 3.5, think: 3.5, learn: 3.5, collab: 3.5, owner: 3.5 },
  'P1': { task: 3, comm: 2.5, think: 3.5, learn: 3, collab: 2.5, owner: 3 },
};

const QUESTIONS = [
  { id: 'q1', dim: 'task', text: '在接到一个新任务时，你能独立拆解步骤、排出优先级吗？' },
  { id: 'q2', dim: 'comm', text: '你在向上汇报时，能用"结论先行"的方式讲清楚进度和风险吗？' },
  { id: 'q3', dim: 'think', text: '遇到复杂问题时，你能跳出自己的岗位视角，从业务流程或商业角度思考吗？' },
  { id: 'q4', dim: 'learn', text: '你学完一个新工具/方法论后，能在实际工作中用上吗？' },
  { id: 'q5', dim: 'collab', text: '跨部门合作时，你能主动对接信息、推动共同目标吗？' },
  { id: 'q6', dim: 'owner', text: '你对任务的结果负责吗？是否不光完成，还关注做得对不对、好不好？' },
];

function getBenchmark(level) {
  return PER_LEVEL_BENCHMARKS[level] || PER_LEVEL_BENCHMARKS['B1'];
}

function calculateFromAnswers(answers) {
  const dimScores = {};
  let totalAnswered = 0;
  for (const [qId, score] of Object.entries(answers)) {
    const q = QUESTIONS.find(q => q.id === qId);
    if (!q) continue;
    if (!dimScores[q.dim]) dimScores[q.dim] = { total: 0, count: 0 };
    dimScores[q.dim].total += (typeof score === 'number' ? score : parseInt(score)) || 1;
    dimScores[q.dim].count += 1;
    totalAnswered++;
  }
  const scores = {};
  for (const [dim, v] of Object.entries(dimScores)) {
    scores[dim] = Math.round((v.total / v.count) * 10) / 10;
  }
  return { scores, answeredCount: totalAnswered, totalQuestions: QUESTIONS.length };
}

function calculateFromHighlights(highlights) {
  const dimScores = {};
  const typeDimMap = {
    accomplishment: 'task', solution: 'think', method: 'think',
    connection: 'learn', insight: 'think', growth: 'learn',
    helpOthers: 'collab', riskAware: 'owner',
  };
  for (const h of highlights) {
    const dim = typeDimMap[h.type] || null;
    if (!dim) continue;
    dimScores[dim] = (dimScores[dim] || 0) + 1;
  }
  const maxCount = Math.max(1, ...Object.values(dimScores));
  const scores = {};
  for (const dim of Object.keys(DIMENSIONS)) {
    const raw = dimScores[dim] || 0;
    scores[dim] = Math.min(5, Math.round((raw / maxCount) * 3 + 0.5) + 1);
  }
  return scores;
}

function generateGapAnalysis(scores, level) {
  const benchmark = getBenchmark(level);
  const gaps = [];
  for (const [dim, config] of Object.entries(DIMENSIONS)) {
    const selfScore = scores[dim] || 0;
    const benchScore = benchmark[dim] || 2;
    const gap = benchScore - selfScore;
    if (gap > 0.5) {
      gaps.push({
        dimension: dim,
        label: config.label,
        icon: config.icon,
        selfScore,
        benchScore,
        gap: Math.round(gap * 10) / 10,
        severity: gap > 1.5 ? 'high' : 'medium',
      });
    }
  }
  gaps.sort((a, b) => b.gap - a.gap);
  return gaps;
}

function generateLearningPath(gaps, highlights, stage, TAG_INDEX, COURSE_LIBRARY) {
  const gapTagMap = {
    task: ['任务管理', '项目跟进'],
    comm: ['沟通表达', '领导力'],
    think: ['系统思考', '数据分析'],
    learn: ['新人适应', '任务管理'],
    collab: ['沟通表达'],
    owner: ['领导力', '系统思考'],
  };

  const urgentCourses = [];
  const electiveCourses = [];

  const usedNames = new Set();

  for (const gap of gaps) {
    const tags = gapTagMap[gap.dimension] || ['新人适应'];
    for (const tag of tags) {
      const courseNames = TAG_INDEX[tag] || [];
      for (const cn of courseNames) {
        if (usedNames.has(cn)) continue;
        usedNames.add(cn);
        if (COURSE_LIBRARY[cn]) {
          const entry = {
            name: cn,
            ...COURSE_LIBRARY[cn],
            reason: gap.label + '缺口' + (gap.severity === 'high' ? '较大，优先补齐' : '可以提升'),
            forGap: gap.label,
          };
          if (gap.severity === 'high') urgentCourses.push(entry);
          else electiveCourses.push(entry);
        }
      }
    }
  }

  const stageTags = (stage && stage.tags) ? stage.tags : ['新人适应'];
  for (const tag of stageTags) {
    const courseNames = TAG_INDEX[tag] || [];
    for (const cn of courseNames) {
      if (usedNames.has(cn)) continue;
      usedNames.add(cn);
      if (COURSE_LIBRARY[cn]) {
        electiveCourses.push({
          name: cn,
          ...COURSE_LIBRARY[cn],
          reason: '当前阶段推荐',
          forGap: '阶段发展',
        });
      }
    }
  }

  return {
    urgent: urgentCourses.slice(0, 4),
    elective: electiveCourses.slice(0, 4),
    total: Math.min(urgentCourses.length + electiveCourses.length, 8),
  };
}

function assessFromProfile(profile, highlights) {
  const scores = calculateFromHighlights(highlights);
  const gaps = generateGapAnalysis(scores, profile.level || 'B1');
  return { scores, gaps };
}

module.exports = {
  DIMENSIONS, QUESTIONS, PER_LEVEL_BENCHMARKS,
  getBenchmark, calculateFromAnswers, calculateFromHighlights,
  generateGapAnalysis, generateLearningPath, assessFromProfile,
};
