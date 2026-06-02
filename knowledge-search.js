/**
 * 知识优先查询管道
 * 搜索链：知识库文档 → 用户闪光记录 → 用户画像 → 历史对话 → 缺口标记
 */

const fs = require('fs');
const path = require('path');

const ROSTER = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'roster.json'), 'utf-8')); }
  catch (_) { return []; }
})();

function loadKnowledgeEntries() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'knowledge_entries.json'), 'utf-8')); }
  catch (_) { return []; }
}

function loadHighlights() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'highlights.json'), 'utf-8')); }
  catch (_) { return []; }
}

function loadProfiles() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'profiles.json'), 'utf-8')); }
  catch (_) { return {}; }
}

function loadTopics() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'topics.json'), 'utf-8')); }
  catch (_) { return {}; }
}

function loadGaps() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'knowledge_gaps.json'), 'utf-8')); }
  catch (_) { return []; }
}

function saveKnowledgeEntries(entries) {
  fs.writeFileSync(path.join(__dirname, 'data', 'knowledge_entries.json'), JSON.stringify(entries, null, 2), 'utf-8');
}

function saveGaps(gaps) {
  fs.writeFileSync(path.join(__dirname, 'data', 'knowledge_gaps.json'), JSON.stringify(gaps, null, 2), 'utf-8');
}

const QUESTION_KEYWORDS = ['怎么', '如何', '什么是', '为什么', '能不能', '可以', '应该', '需要', '在哪', '谁', '请教', '问一下', '想问', '不太清楚', '不清楚', '不了解', '求教', '教程', '步骤', '流程', '审批'];

function isQuestion(text) {
  const t = text.trim();
  if (t.endsWith('？') || t.endsWith('?') || t.endsWith('吗') || t.endsWith('呢')) {
    if (isCasualQuestion(t)) return false;
    return true;
  }
  return QUESTION_KEYWORDS.some(kw => t.includes(kw));
}

function isCasualQuestion(text) {
  const casualPatterns = [
    /^(你|是不是|对吗|是吧|好吗|行吗|可以吗|能吗|会吗|有没有|在不在|是不是|对不对|好不好|行不行|可以不|能不|会不会|有没有|是不是|真的吗)/,
    /(?:刚|新|才|已经|是不是|对吧|好吧|行吧|好的|嗯|哦|啊).{0,6}[？?]$/,
    /^(收到|了解|知道|明白|OK|ok|好的?|嗯|哦|啊|行|可以)[？?]?$/,
    /^.{0,4}(吗|呢|吧|呀)[？?]?$/,
    /(?:刷新|更新|重新|同步|加载|下载|上传|导出|导入|打开|关闭|启动|重启).{0,8}[？?]$/,
  ];
  return casualPatterns.some(p => p.test(text));
}

function extractKeywords(text) {
  const cleaned = text.replace(/[？?！!。，,、\s]+/g, ' ').trim();
  const words = cleaned.split(/\s+/);
  const stops = ['的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这', '那', '他', '她', '它', '们', '什么', '哪', '怎么', '吗', '呢', '啊', '吧', '嗯', '哦'];
  return words.filter(w => w.length >= 2 && !stops.includes(w));
}

function scoreMatch(text, keywords) {
  let score = 0;
  const t = text.toLowerCase();
  for (const kw of keywords) {
    if (t.includes(kw.toLowerCase())) score += 1.5;
  }
  return score;
}

function scoreMatchWithKeywords(entryKeywords, searchKeywords) {
  let score = 0;
  for (const sk of searchKeywords) {
    for (const ek of (entryKeywords || [])) {
      if (ek.includes(sk) || sk.includes(ek)) score += 3;
    }
  }
  return score;
}

function searchKnowledge(query, currentUserId) {
  const isQ = isQuestion(query);
  const keywords = extractKeywords(query);

  const knowledgeEntries = loadKnowledgeEntries();
  const highlights = loadHighlights();
  const profiles = loadProfiles();
  const topics = loadTopics();

  const foundKnowledge = [];
  const foundHighlights = [];
  const foundProfiles = [];
  const foundConvTopics = [];
  let knowledgeContext = null;

  for (const entry of knowledgeEntries) {
    if (entry.status !== 'active') continue;
    const contentScore = scoreMatch(entry.title + ' ' + entry.content, keywords);
    const keywordScore = scoreMatchWithKeywords(entry.keywords || [], keywords);
    const totalScore = contentScore + keywordScore;
    if (totalScore >= 2) {
      foundKnowledge.push({ ...entry, matchScore: totalScore });
    }
  }
  foundKnowledge.sort((a, b) => b.matchScore - a.matchScore);

  if (foundKnowledge.length > 0) {
    const top = foundKnowledge[0];
    knowledgeContext = `**知识库检索结果**\n\n问题匹配到知识库条目「${top.category}」《${top.title}》：\n\n${top.content}`;
    if (foundKnowledge.length > 1) {
      knowledgeContext += '\n\n---\n📚 其他相关条目：\n';
      foundKnowledge.slice(1, 4).forEach(e => {
        knowledgeContext += '• ' + e.category + ' | **' + e.title + '** — ' + e.content.slice(0, 120) + (e.content.length > 120 ? '…' : '') + '\n';
      });
    }
  }

  for (const hl of highlights) {
    if (currentUserId && hl.userId === currentUserId) continue;
    const score = scoreMatch(hl.title + ' ' + hl.subtitle + ' ' + (hl.action || ''), keywords);
    if (score >= 1.5) foundHighlights.push({ ...hl, matchScore: score });
  }
  foundHighlights.sort((a, b) => b.matchScore - a.matchScore);

  for (const [uid, profile] of Object.entries(profiles)) {
    if (currentUserId && uid === currentUserId) continue;
    const text = (profile.job || '') + ' ' + (profile.level || '') + ' ' + (profile.tasks || []).join(' ');
    const score = scoreMatch(text, keywords);
    if (score >= 1) {
      const rosterMatch = ROSTER.find(r => r.id === uid || r.name === uid) || {};
      foundProfiles.push({
        userId: uid,
        name: rosterMatch.name || uid,
        job: profile.job,
        department: rosterMatch.department || '',
        managerName: rosterMatch.managerName || '',
        matchScore: score,
      });
    }
  }
  foundProfiles.sort((a, b) => b.matchScore - a.matchScore);

  const allTopics = {};
  for (const [uid, userTopics] of Object.entries(topics)) {
    for (const [tid, topic] of Object.entries(userTopics)) {
      const msgs = (topic.messages || []).map(m => m.content || '').join(' ');
      const score = scoreMatch(msgs, keywords);
      if (score >= 2) {
        const rosterMatch = ROSTER.find(r => r.id === uid || r.name === uid) || {};
        allTopics[tid] = {
          userId: uid,
          userName: rosterMatch.name || uid,
          title: topic.title,
          matchScore: score,
          snippet: msgs.slice(0, 150),
        };
      }
    }
  }
  foundConvTopics.push(...Object.values(allTopics).sort((a, b) => b.matchScore - a.matchScore));

  let relevantPeople = [];
  if (foundProfiles.length > 0) {
    relevantPeople = foundProfiles.slice(0, 3).map(p => ({
      name: p.name,
      reason: p.job + (p.department ? ' · ' + p.department : '') + ' 可能有相关经验',
      managerName: p.managerName,
    }));
  }

  const knowledgeFound = foundKnowledge.length > 0 || foundHighlights.length > 0 || foundProfiles.length > 0 || foundConvTopics.length > 0;

  return {
    isQuestion: isQ,
    keywords,
    knowledgeFound,
    knowledgeEntries: foundKnowledge.slice(0, 5),
    knowledgeContext,
    highlights: foundHighlights.slice(0, 5),
    profiles: foundProfiles.slice(0, 3),
    convTopics: foundConvTopics.slice(0, 3),
    relevantPeople,
    isGap: isQ && !knowledgeFound,
  };
}

function recordGap(userId, query, context) {
  const gaps = loadGaps();
  const existing = gaps.find(g => g.query.toLowerCase() === query.toLowerCase());
  if (existing) {
    existing.count = (existing.count || 1) + 1;
    existing.lastAsked = new Date().toISOString();
    if (!existing.askedBy.includes(userId)) existing.askedBy.push(userId);
  } else {
    gaps.push({
      id: 'gap_' + Date.now().toString(36),
      query,
      context,
      userId,
      askedBy: [userId],
      count: 1,
      status: 'open',
      createdAt: new Date().toISOString(),
      lastAsked: new Date().toISOString(),
    });
  }
  saveGaps(gaps);
}

function getGaps(status) {
  const gaps = loadGaps();
  if (status) return gaps.filter(g => g.status === status);
  return gaps;
}

function getAllEntries() {
  return loadKnowledgeEntries();
}

function importEntry(entry) {
  const entries = loadKnowledgeEntries();
  const id = 'k_' + Date.now().toString(36);
  const existing = entries.find(e => e.title === entry.title);
  if (existing) {
    Object.assign(existing, entry, { updatedAt: new Date().toISOString().slice(0, 10) });
  } else {
    entries.push({
      id,
      category: entry.category || '未分类',
      title: entry.title || '',
      content: entry.content || '',
      keywords: entry.keywords || [],
      source: entry.source || '管理员导入',
      status: 'active',
      createdAt: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString().slice(0, 10),
    });
  }
  saveKnowledgeEntries(entries);
  return entries.length;
}

function deleteEntry(id) {
  const entries = loadKnowledgeEntries();
  const idx = entries.findIndex(e => e.id === id);
  if (idx === -1) return false;
  entries.splice(idx, 1);
  saveKnowledgeEntries(entries);
  return true;
}

function updateEntry(id, updates) {
  const entries = loadKnowledgeEntries();
  const entry = entries.find(e => e.id === id);
  if (!entry) return null;
  Object.assign(entry, updates, { updatedAt: new Date().toISOString().slice(0, 10) });
  saveKnowledgeEntries(entries);
  return entry;
}

module.exports = {
  searchKnowledge,
  recordGap,
  getGaps,
  getAllEntries,
  importEntry,
  deleteEntry,
  updateEntry,
  isQuestion,
};
