/**
 * 贡献量化引擎
 * "使用即贡献" — 用户的每一次对话都在建设组织的知识体系
 */

const fs = require('fs');
const path = require('path');

function loadFile(name) {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', name), 'utf-8')); }
  catch (_) { return null; }
}

const DIMENSIONS = {
  task: { label: '任务执行', icon: '🔨' },
  comm: { label: '沟通汇报', icon: '💬' },
  think: { label: '系统思考', icon: '🧠' },
  learn: { label: '学习迁移', icon: '📖' },
  collab: { label: '协作协同', icon: '🤝' },
  owner: { label: '主人翁意识', icon: '🎯' },
};

const HIGHLIGHT_TYPE_DIM = {
  accomplishment: 'task', solution: 'think',
  connection: 'learn', insight: 'think', growth: 'learn',
  helpOthers: 'collab', riskAware: 'owner',
};

function getPersonalContribution(userId) {
  const highlights = loadFile('highlights.json') || [];
  const feedback = loadFile('feedback.json') || [];
  const profiles = loadFile('profiles.json') || {};
  const gaps = loadFile('knowledge_gaps.json') || [];
  const topics = loadFile('topics.json') || {};

  const myHighlights = highlights.filter(h => h.userId === userId);
  const myFeedback = feedback.filter(f => f.userId === userId);
  const myGaps = gaps.filter(g => g.askedBy && g.askedBy.includes(userId));
  const myProfile = profiles[userId] || null;

  const dimensionMap = {};
  myHighlights.forEach(h => {
    const dim = HIGHLIGHT_TYPE_DIM[h.type] || null;
    if (!dim) return;
    if (!dimensionMap[dim]) dimensionMap[dim] = { count: 0, items: [] };
    dimensionMap[dim].count++;
    if (dimensionMap[dim].items.length < 3) dimensionMap[dim].items.push(h.title);
  });

  const totalOrgHighlights = highlights.length;
  const totalOrgGaps = gaps.filter(g => g.status === 'open').length;
  const resolvedGaps = gaps.filter(g => g.status === 'resolved' && g.askedBy && g.askedBy.includes(userId));

  const contributionScore = Math.min(100, Math.round(
    myHighlights.length * 5 + myGaps.length * 3 + myFeedback.length * 2 + resolvedGaps.length * 2
  ));

  let badge = '🌱';
  if (contributionScore >= 80) badge = '🏆';
  else if (contributionScore >= 50) badge = '⭐';
  else if (contributionScore >= 30) badge = '🌿';
  else if (contributionScore >= 10) badge = '🌱';

  return {
    userId,
    highlightsCreated: myHighlights.length,
    questionsRaised: myGaps.length,
    gapsResolved: resolvedGaps.length,
    feedbackGiven: myFeedback.length,
    contributionScore,
    badge,
    dimensionCoverage: dimensionMap,
    totalDimensionsCovered: Object.keys(dimensionMap).length,
    totalOrgHighlights,
    totalOrgGaps,
    highlightPercentOfOrg: totalOrgHighlights > 0 ? Math.round((myHighlights.length / totalOrgHighlights) * 100) : 0,
    gapPercentOfOrg: totalOrgGaps > 0 ? Math.round((myGaps.length / totalOrgGaps) * 100) : 0,
    profile: myProfile ? {
      job: myProfile.job, level: myProfile.level, daysOnboard: myProfile.daysOnboard, status: myProfile.status
    } : null,
  };
}

function getOrgOverview() {
  const highlights = loadFile('highlights.json') || [];
  const gaps = loadFile('knowledge_gaps.json') || [];
  const profiles = loadFile('profiles.json') || {};

  const typeMap = {};
  highlights.forEach(h => {
    typeMap[h.type] = (typeMap[h.type] || 0) + 1;
  });

  const activeUsers = new Set();
  highlights.forEach(h => activeUsers.add(h.userId));
  Object.keys(profiles).forEach(uid => activeUsers.add(uid));

  return {
    totalHighlights: highlights.length,
    totalGaps: gaps.filter(g => g.status === 'open').length,
    totalResolved: gaps.filter(g => g.status === 'resolved').length,
    activeContributors: activeUsers.size,
    highlightsByType: typeMap,
  };
}

module.exports = { getPersonalContribution, getOrgOverview, DIMENSIONS };
