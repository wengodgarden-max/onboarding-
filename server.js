const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

process.on('uncaughtException', (err) => { console.error('UNCAUGHT:', err.message, '\n', err.stack); });
process.on('unhandledRejection', (err) => { console.error('UNHANDLED REJECTION:', err && err.message, '\n', err && err.stack); });
const store = require('./store');
const brain = require('./brain');
const profileEngine = require('./profile');
const recommendEngine = require('./recommend');
const timingEngine = require('./timing');
const highlightEngine = require('./highlight');
const knowledgeSearch = require('./knowledge-search');
const contributeEngine = require('./contribute');
const assessEngine = require('./assess');
const journeyEngine = require('./journey');
const taskCheck = require('./taskcheck');
const xhrFormat = require('./xhr-format');
const closedLoop = require('./closedloop');
const identity = require('./identity');
const taskDecompInvite = require('./task-decomp-invite');
const goalEngine = require('./goal-engine');

const CONFIG_PATH = path.join(__dirname, 'config.json');
let config;
try { config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')); }
catch (e) { config = { llm: { apiKey: '', baseURL: 'https://api.deepseek.com/v1', model: 'deepseek-chat', maxTokens: 2000, temperature: 0.7 }, server: { port: 3460 } }; fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2)); }
function saveConfig() { fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8'); }

identity.onChange(function(event) {
  console.log('[IDENTITY-CHANGE] type=' + event.type + ' userId=' + (event.userId || '-') + ' at=' + event.timestamp);
});

function checkLLM() { return config.llm.apiKey && config.llm.apiKey !== 'sk-your-api-key-here'; }
function useLLM() { return checkLLM(); }

console.log('LLM:', checkLLM() ? '已配置 (' + config.llm.model + ')' : '离线模式');
var idStats = identity.getStats();
console.log('花名册:', idStats.totalRecords, '人 (唯一ID:' + idStats.uniqueIds + ')');

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

app.get('/', (req, res) => { res.set('Content-Type', 'text/html; charset=utf-8'); res.sendFile(path.join(__dirname, 'public', 'index.html')); });
app.get('/demo', (req, res) => { res.set('Content-Type', 'text/html; charset=utf-8'); res.sendFile(path.join(__dirname, 'public', 'demo.html')); });
app.use(express.static(path.join(__dirname, 'public'), { setHeaders: (res, p) => { if (p.endsWith('.html')) res.set('Content-Type', 'text/html; charset=utf-8'); if (p.endsWith('.css')) res.set('Content-Type', 'text/css; charset=utf-8'); if (p.endsWith('.js')) res.set('Content-Type', 'application/javascript; charset=utf-8'); } }));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir, limits: { fileSize: 20 * 1024 * 1024 } });

const uploadedFiles = {};

app.post('/api/files/upload', upload.array('file', 5), (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: '没有文件' });
  const results = req.files.map(f => {
    const fileId = 'f_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    uploadedFiles[fileId] = { originalName: f.originalname, path: f.path, mimetype: f.mimetype, size: f.size, uploadedAt: new Date().toISOString() };
    return { fileId, name: f.originalname, path: f.path, size: f.size };
  });
  res.json(results.length === 1 ? results[0] : { files: results, fileId: results[0].fileId });
});

app.get('/api/files/:fileId', (req, res) => {
  const info = uploadedFiles[req.params.fileId];
  if (!info) return res.status(404).json({ error: '文件不存在或已过期' });
  res.setHeader('Content-Disposition', 'inline; filename="' + encodeURIComponent(info.originalName) + '"');
  res.setHeader('Content-Type', info.mimetype || 'application/octet-stream');
  res.sendFile(path.resolve(info.path));
});

async function callLLM(messages) {
  const { baseURL, apiKey, model, maxTokens, temperature } = config.llm;
  const resp = await fetch(`${baseURL.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens || 2000, temperature: temperature || 0.7 }),
  });
  if (!resp.ok) { const err = await resp.text().catch(() => ''); throw new Error(`LLM ${resp.status}: ${err.slice(0,200)}`); }
  const data = await resp.json();
  return data.choices[0].message.content;
}

function getUserInfo(userId, userName) {
  identity.ensureFresh();
  var info = identity.getIdentity(userId, userName);
  if (info) {
    console.log('[USER-INFO] name=' + info.name + ' job=' + info.job + ' dept=' + info.department + ' level=' + info.level + ' days=' + info.daysOnboard + ' manager=' + info.managerName + ' source=identity');
  } else {
    console.log('[USER-INFO] userId=' + userId + ' name=' + (userName || '') + ' no identity found');
  }
  return info;
}

function buildGreeting(userInfo, known) {
  if (known) {
    return userInfo.name + '你好！👋 欢迎加入传音～\n\n我看到你是**' + userInfo.department + '**的**' + userInfo.job + '**，职级' + userInfo.level + '，入职' + userInfo.daysOnboard + '天了。' + (userInfo.managerName ? '你的上级是' + userInfo.managerName + '。' : '') + '\n\n我是伴伴，比你早来半年，试用期那些事儿我熟。现在已经开始干活了吗，还是还在熟悉环境？';
  }
  return '你好！我是伴伴 👋 传音新人的AI学伴。\n\n来传音多久了？现在主要在做什么岗位呀？随便聊聊～';
}

function parseChatForProfile(messages) {
  const fullText = messages.map(m => m.content).join('\n');
  const info = { job: '', level: '', days_onboard: 0, tasks: [], manager_input: '', pain_points: '' };
  const jobM = fullText.match(/(?:岗位|职位|做|是)[：:\s]*?(.+?(?:经理|工程师|专员|主管|设计师|HR|运营|产品|研发|测试|市场|销售|财务|供应链|GTM|PM|实习))/);
  if (jobM) info.job = (jobM[1] || jobM[0]).trim();
  const levelM = fullText.match(/[PBpb]\s*(\d+)/);
  if (levelM) info.level = (fullText.match(/[PBpb]/)[0].toUpperCase()) + levelM[1];
  const dayM = fullText.match(/(\d+)\s*(?:天|个?月)/);
  if (dayM) info.days_onboard = parseInt(dayM[1]);
  const taskSection = fullText.split(/任务|做|在忙|在搞/).slice(1).join(' ');
  if (taskSection) { const tasks = taskSection.match(/[^。，,\n]{3,80}/g); if (tasks) info.tasks = tasks.slice(0, 3).map(t => t.trim()); }
  const bossM = fullText.match(/(?:老板|上级|领导|主管|导师)(?:说|要求|希望|让|叫|给)[：:]?\s*([^。\n]{3,120})/);
  if (bossM) info.manager_input = bossM[1].trim();
  const painM = fullText.match(/(?:吃力|困难|不知道|搞不定|担心|困惑|迷茫|不确定)([^。\n]{3,120})/);
  if (painM) info.pain_points = painM[0].trim();
  return info;
}

function hasEnough(collected) { let c = 0; if (collected.job || collected.level) c += 2; if (collected.tasks && collected.tasks.length > 0) c++; if (collected.manager_input || collected.pain_points) c++; return c >= 2; }

function structureProfileReply(profile) {
  const lines = ['好的，帮你梳理了一下：\n'];
  lines.push('✅ **已确认**');
  if (profile.job) lines.push('1. 岗位：' + profile.job);
  if (profile.level) lines.push('2. 职级：' + profile.level + '（' + (profile.levelLabel || '') + '）');
  if (profile.confirmed && profile.confirmed.length) lines.push('3. 核心任务：' + profile.confirmed.join('、'));
  if (profile.gaps && profile.gaps.length) { lines.push('\n⚠️ **对照标准可能需要关注**'); profile.gaps.slice(0, 4).forEach((g, i) => lines.push((i + 1) + '. ' + g.item + '（' + g.source + '）')); }
  if (profile.mentorQuestions && profile.mentorQuestions.length) { lines.push('\n💬 **建议和导师聊的问题**'); profile.mentorQuestions.forEach((q, i) => lines.push((i + 1) + '. ' + q)); }
  return lines.join('\n');
}

async function handleTrigger(userId, topicId, history) {
  const chatMsgs = history.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({ role: m.role, content: m.content }));
  const collected = parseChatForProfile(chatMsgs);
  var user = store.getUser(userId);
  var idInfo = getUserInfo(userId, user ? user.name : '');
  console.log('[PROFILE-GEN] userId=' + userId + ' userName=' + (user ? user.name : 'null') + ' identityFound=' + !!idInfo);
  if (idInfo) {
    collected.job = collected.job || idInfo.job || '';
    collected.level = collected.level || idInfo.level || '';
    if (!collected.days_onboard && idInfo.daysOnboard) collected.days_onboard = idInfo.daysOnboard;
    collected.managerName = collected.managerName || idInfo.managerName || '';
    collected.mentorName = collected.mentorName || idInfo.mentorName || '';
    collected.department = collected.department || idInfo.department || '';
    console.log('[PROFILE-GEN] identity data applied: job=' + collected.job + ' level=' + collected.level + ' manager=' + collected.managerName);
  }
  if (!hasEnough(collected)) return { reply: '还差一点信息：\n岗位：' + (collected.job || '未知') + '\n任务：' + (collected.tasks.join(', ') || '未知') + '\n\n能再和我说说你的工作内容吗？', profile: null };
  const profile = profileEngine.generateProfile(userId, collected);
  store.upsertProfile(userId, { job: profile.job, level: profile.level, daysOnboard: profile.daysOnboard, tasks: profile.confirmed, managerInput: collected.manager_input, painPoints: collected.pain_points, mentorName: profile.mentorName, managerName: profile.managerName, status: 'generated' });
  const recs = recommendEngine.recommendCourses(profile);
  const highlights = store.getHighlights(userId, 20);
  const highlightSummary = highlights.map(h => h.icon + ' ' + h.label + ': ' + h.title).slice(0, 10);
  let reply;
  if (useLLM()) {
    try { reply = await callLLM([{ role: 'system', content: brain.buildProfilePrompt(collected, highlightSummary) }]); } catch (e) { console.error('LLM profile error:', e.message); reply = structureProfileReply(profile); }
  } else { reply = structureProfileReply(profile); }
  return { reply, profile, recs, questions: profile.mentorQuestions };
}

const OFFLINE_NEXT = {
  greet: { reply: '你现在在做什么岗位呀？比如职能/方向。', next: 'ask_role' },
  ask_role: { reply: '了解～那最近主要在忙什么任务？或者老板有没有给你方向？', next: 'ask_task' },
  ask_task: { reply: '好的记下来了。老板或者导师对试用期有什么期望吗？或者你自己觉得哪里比较吃力？', next: 'ask_boss' },
  ask_boss: { reply: '收到！信息差不多了～要不要我帮你**整理**一下目前的画像？回复"帮我整理"就行。', next: 'offer' },
};

/* ═══════ ROUTES ═══════ */

app.get('/api/health', (req, res) => {
  var s = identity.getStats();
  res.json({ ok: true, llm: checkLLM(), roster: s.totalRecords, uniqueIds: s.uniqueIds, conflicts: s.conflicts.length, loadedAt: s.loadedAt });
});

app.post('/api/admin/roster/reload', (req, res) => {
  identity.reload();
  var s = identity.getStats();
  res.json({ ok: true, roster: s.totalRecords, uniqueIds: s.uniqueIds, conflicts: s.conflicts.length, loadedAt: s.loadedAt });
});

app.post('/api/login', (req, res) => {
  const { name, userId: inputId } = req.body;
  if (!name) return res.status(400).json({ error: '请输入姓名' });
  const userId = inputId || name;
  const user = store.createUser(userId, name);
  var userInfo = getUserInfo(userId, name);

  let topics = store.getTopics(userId);
  if (topics.length === 0) {
    const t = store.createTopic(userId, '欢迎加入传音');
    store.addMessage(userId, t.id, 'assistant', buildGreeting(userInfo, !!userInfo));
    topics = [t];
  }

  res.json({
    user: { id: user.id, name: user.name },
    known: !!userInfo,
    llmActive: checkLLM(),
    info: userInfo ? { job: userInfo.job, level: userInfo.level, department: userInfo.department, managerName: userInfo.managerName, mentorName: userInfo.mentorName || '', daysOnboard: userInfo.daysOnboard, type: userInfo.type, location: userInfo.location } : null,
    topics: topics.map(t => ({ id: t.id, title: t.title, updatedAt: t.updatedAt, messageCount: t.messages.length })),
  });
});

/* ─── Topics ─── */
app.get('/api/topics/:userId', (req, res) => {
  const topics = store.getTopics(req.params.userId);
  res.json(topics.map(t => ({ id: t.id, title: t.title, updatedAt: t.updatedAt, messageCount: t.messages.length })));
});

app.post('/api/topics/:userId', (req, res) => {
  const { title } = req.body;
  const topic = store.createTopic(req.params.userId, title || '新话题');
  var userInfo = getUserInfo(req.params.userId, null);
  const greeting = buildGreeting(userInfo, !!userInfo);
  store.addMessage(req.params.userId, topic.id, 'assistant', greeting);
  res.json({ id: topic.id, title: topic.title, updatedAt: topic.updatedAt, messageCount: 1, greeting });
});

app.get('/api/topics/:userId/:topicId', (req, res) => {
  const t = store.getTopic(req.params.userId, req.params.topicId);
  if (!t) return res.status(404).json({ error: '话题不存在' });
  res.json(t);
});

app.delete('/api/topics/:userId/:topicId', (req, res) => {
  const ok = store.deleteTopic(req.params.userId, req.params.topicId);
  res.json({ ok });
});

app.put('/api/topics/:userId/:topicId', (req, res) => {
  const { title } = req.body;
  const t = store.updateTopic(req.params.userId, req.params.topicId, { title });
  if (!t) return res.status(404).json({ error: '话题不存在' });
  res.json(t);
});

/* ─── Chat (scoped to topic) ─── */

function detectUserIntent(message) {
  const m = message.toLowerCase();
  if (/复盘|总结|成果卡|回顾|收获|进展|月报|周报|月度总结|一页纸|局外人报告|帮我整理|整理入职/.test(m)) return 'summary';
  if (/沉淀|归档|知识条目|复用|知识库条目|记录到知识库|经验整理|方法论/.test(m)) return 'contribute';
  if (/检查进度|做到哪|下一步|接下来|看看进度|任务进展|完成了多少|还差什么|帮我检查|进度检查|检查一下.*进度|检查.*任务/.test(m)) return 'progress_check';
  return null;
}

function getIntentContext(intent, userInfo, history) {
  const job = userInfo.job || '员工';
  const dept = userInfo.department || '部门';
  const days = userInfo.daysOnboard || 0;

  if (intent === 'summary') {
    const node = journeyEngine.getNodeForDay(days);
    const stage = days <= 7 ? '生存期' : days <= 30 ? '任务期' : days <= 60 ? '贡献期' : days <= 90 ? '独立期' : '转正后';
    return `\n\n[系统指令 - 工作总结模式]
你正在为一名入职${days}天(${stage})的${dept}${job}生成工作总结。
请基于对话历史，结构化输出以下内容：
1. 📊 **关键成果**：这段时间完成了什么（3-5条，每条附一句量化描述）
2. 🔗 **建立的连接**：认识了哪些人、参与了哪些协作
3. 🧠 **学到的方法论**：掌握的关键工作方法和思维
4. ⚠️ **风险与卡点**：当前还在进行中/不确定的事项
5. 📋 **下阶段计划**：接下来1-2周的重点
格式要求：每条用符号开头，简洁有结论，适合直接给导师/上级看。`;
  }

  if (intent === 'contribute') {
    const historyText = (history || []).slice(-10).map(m => m.content || '').join('\n');
    return `\n\n[系统指令 - 知识沉淀模式]
你正在帮助${job}将从对话中学到的经验沉淀为组织知识。
请从以下维度提取可沉淀的内容（每条50-100字）：
1. 📌 **流程避坑**：实际做任务中发现的流程卡点和应对方式
2. 💡 **岗位心得**：这个岗位的隐性知识——别人不会主动告诉你但很重要的事
3. 🔧 **工具/技巧**：发现的好用的工具、模板或工作技巧
4. 📖 **推荐学习路径**：如果是下一个新人来做同样的事，你会推荐他怎么学
每条产出都是一个独立的知识库条目，可以独立被后续新人搜索到。`;
  }

  if (intent === 'progress_check') {
    return `\n\n[系统指令 - 任务进度检查模式]
你正在帮${dept}${job}(入职${days}天)做任务进度检查。
请基于对话历史做以下分析：
1. 📍 **当前阶段**：根据对话推断任务/项目进展到哪一步
2. ✅ **已完成**：列出已经做完的部分（标记✓）
3. 🔄 **进行中**：列出还在做的部分（标记🔄）
4. ⏳ **未启动**：列出还没开始但必要的部分（标记⏳）
5. 🔴 **风险点**：可能延迟或卡住的地方
6. 🎯 **建议的下一步**：具体的、可执行的下一个动作
格式：用进度条风格呈现，让新人清晰知道自己在哪里。`;
  }

  return null;
}

/* ─── Chat (scoped to topic) ─── */
app.post('/api/chat', async (req, res) => {
  const { userId, topicId, message } = req.body;
  if (!userId || !topicId || !message) return res.status(400).json({ error: '需要 userId、topicId 和 message' });
  const user = store.getUser(userId);
  if (!user) return res.status(401).json({ error: '请先登录' });
  const topic = store.getTopic(userId, topicId);
  if (!topic) return res.status(404).json({ error: '话题不存在' });

  try {

  store.addMessage(userId, topicId, 'user', message);
  const history = store.getMessages(userId, topicId);

  const preIntent = detectUserIntent(message);

  if (!preIntent && brain.checkTrigger(message)) {
    const result = await handleTrigger(userId, topicId, history);
    store.addMessage(userId, topicId, 'assistant', result.reply, result.profile ? 'profile' : 'text');
    if (result.profile) store.updateTopic(userId, topicId, { profileGenerated: true });
    return res.json(result);
  }

  var userInfo = getUserInfo(userId, user.name);
  userInfo = userInfo || { name: user.name || '', job: '', level: '', department: '', daysOnboard: 0, managerName: '', mentorName: '', location: '', type: '' };

  const ks = knowledgeSearch.searchKnowledge(message, userId);

  const breakpoints = taskCheck.detectBreakpoint(message, history);
  let breakpointContext = null;
  let breakpointPrompt = null;
  if (breakpoints.length > 0 && (!topic.lastBreakpointType || (topic.lastBreakpointType && breakpoints[0].type !== topic.lastBreakpointType))) {
    breakpointContext = taskCheck.getSystemPromptForBreakpoint(breakpoints[0].type);
    breakpointPrompt = taskCheck.getBreakpointPrompt(breakpoints[0].type);
    store.updateTopic(userId, topicId, { lastBreakpointType: breakpoints[0].type });
  }

  const userIntent = preIntent;
  let intentContext = null;
  if (userIntent) {
    intentContext = getIntentContext(userIntent, userInfo, history);
  }

  let journeyAlert = null;
  const hasOtherResponse = userIntent || (breakpoints.length > 0 && breakpointPrompt) || (ks.knowledgeFound && ks.knowledgeContext && ks.isQuestion);
  if (!hasOtherResponse) {
    const journeyNode = journeyEngine.shouldTriggerNode(userInfo, topic.lastJourneyTrigger);
    if (journeyNode) {
      journeyAlert = {
        nodeKey: journeyNode.key,
        label: journeyNode.label,
        sub: journeyNode.sub,
        day: journeyNode.day,
        message: journeyNode.getCheckMessage(userInfo),
        deliverables: journeyNode.produce,
        deliverable: journeyNode.deliverable,
      };
      store.updateTopic(userId, topicId, { lastJourneyTrigger: new Date().toISOString() });
    }
  }

  const proactiveAlerts = journeyEngine.checkProactiveTriggers(userInfo, topic);

  let combinedContext = '';
  if (breakpointContext) {
    combinedContext += '## 🔍 当前场景：检测到新人正面对特定任务断点\n';
    combinedContext += breakpointContext + '\n\n**在这个场景下，你的回复策略应该是：先共情（"这个阶段有这种感觉很正常"），再帮TA把现状理清楚，最后给出具体可操作的建议或工具。不要让TA觉得是自己能力不足，而是组织没有做好衔接。**';
  }
  if (intentContext) {
    combinedContext += (combinedContext ? '\n\n' : '') + intentContext;
  }
  if (ks.knowledgeContext) {
    combinedContext += (combinedContext ? '\n\n' : '') + '## 📚 知识库检索结果（请基于以下内容回答问题，不要编造）\n' + ks.knowledgeContext;
  }

  const timing = timingEngine.detectTimingSignals(message, history, userInfo);
  const lastHint = topic.lastTimingHint || null;
  const { COURSE_LIBRARY, TAG_INDEX, smartRecommend, getJobConfig } = recommendEngine;

  const bpType = breakpoints.length > 0 ? breakpoints[0].type : null;
  const jNodeKey = journeyAlert ? journeyAlert.nodeKey : null;
  const msgAskingForLearn = /课程|培训|学什么|推荐.*课|有没有.*资料|学.*内容|看.*什么/.test(message);

  let recsToPush = [];
  let courseListText = '';
  let courseAsk = '';

  try {
  if (msgAskingForLearn) {
    const smartRecs = smartRecommend({
      userInfo,
      breakpointType: bpType,
      journeyNodeKey: jNodeKey,
      timingResult: timing,
      userMessage: message,
      knowledgeEntries: ks.knowledgeEntries || [],
      historyMessages: history,
      maxResults: 2,
    });

    const globalSeenNames = new Set();
    const MAX_RECS = 2;

    const addCourse = function(c) {
      if (globalSeenNames.has(c.name) || recsToPush.length >= MAX_RECS) return false;
      globalSeenNames.add(c.name);
      courseListText += '• 📖 **[' + c.name + '](' + c.url + ')**' + (c.summary && c.summary !== c.category ? ' — ' + c.summary : '') + (c.why && c.why !== c.whyDefault ? ' （' + c.why + '）' : '') + '\n';
      recsToPush.push({ name: c.name, url: c.url, type: c.type, category: c.category, duration: c.duration, summary: c.summary, why: c.why, tags: c.tags });
      return true;
    };

    for (const c of smartRecs) { addCourse(c); }
  } else if ((!!bpType || !!jNodeKey) && !msgAskingForLearn) {
    const nodeLabel = jNodeKey ? (journeyAlert.label || '当前阶段') : (bpType === 'goalAlign' ? '目标制定' : bpType === 'taskDecompose' ? '任务拆解' : bpType === 'directionCheck' ? '方向校准' : bpType === 'learnToTask' ? '学以致用' : '当前阶段');
    courseAsk = '\n\n---\n💡 要不要我给你推荐一两门跟**' + nodeLabel + '**相关的学习内容看看？回我"好"或者"看看"就行～';
  }

  if (msgAskingForLearn && timingEngine.shouldInterject(timing, lastHint) && recsToPush.length > 0) {
    store.updateTopic(userId, topicId, { lastTimingHint: new Date().toISOString() });
  }
  } catch (courseErr) {
    console.error('[COURSE-ERROR] 课程推荐出错:', courseErr.message, courseErr.stack);
    recsToPush = [];
    courseListText = '';
    courseAsk = '';
  }

  const hresult = highlightEngine.detectHighlights(message, history.slice(-6));
  let newHighlights = [];
  if (hresult.hasHighlight) {
    newHighlights = hresult.highlights.map(h => {
      store.addHighlight(userId, topicId, h);
      return { icon: h.icon, label: h.label, title: h.title, subtitle: h.subtitle, color: h.color };
    });
  }

  let gapAlert = null;
  if (ks.isQuestion) {
    if (ks.isGap) {
      knowledgeSearch.recordGap(userId, message, userInfo.job || '');
      gapAlert = { query: message, message: '这个问题暂时没有匹配的答案，已记录为知识缺口。\n\n📌 **系统会自动通知管理员**，管理员可以：\n1. 自己补充答案 → 转为知识卡片\n2. 指派给相关同事补充\n3. 从外部知识库搜索后录入\n\n补充完成后，以后的新人再问就能收到答案了。' };
    }
  }

  let xhrExport = null;
  let xhrHTML = null;
  let xhrCSV = null;

  let finalReply = '';
  let llmOk = false;
  let skipLLM = false;
  let skipReason = '';

  if (userIntent === 'summary' || (breakpoints.length > 0 && breakpoints[0].type === 'goalAlign')) {
    const profile = store.getProfile(userId) || {};
    const conversationProfile = goalEngine.parseProfileFromMessages(history);
    const mergedProfile = { ...profile, ...conversationProfile, department: userInfo.department, job: userInfo.job || profile.job, name: userInfo.name };
    
    store.upsertProfile(userId, mergedProfile);
    
    const assessment = goalEngine.assessCollectionCompleteness(mergedProfile);
    
    if (assessment.completeness < 0.6) {
      const nextQuestion = goalEngine.getNextCollectionQuestion(mergedProfile);
      if (nextQuestion) {
        finalReply = nextQuestion + '\n\n💡 **别担心，我们一步步来。** 你可以随便说，用大白话就行，我会帮你整理成正式的表达。';
      } else {
        finalReply = '好的！我大概了解你的情况了。\n\n' + goalEngine.buildConfirmationSummary(mergedProfile, assessment);
      }
      skipLLM = true;
      skipReason = 'goal_collection';
      console.log('[GOAL-ENGINE] 信息收集中 | 完成度:', Math.round(assessment.completeness * 100) + '%', '| 缺失:', assessment.missingFields.join(','));
    } else {
      console.log('[GOAL-ENGINE] 信息充足，生成个性化目标 | 完成度:', Math.round(assessment.completeness * 100) + '%');
      
      const goalData = goalEngine.generatePersonalizedGoals(mergedProfile, userInfo);
      goalData.employeeName = userInfo.name || '';
      goalData.employeeId = userId;
      
      xhrExport = xhrFormat.formatGoalToXHR(goalData);
      xhrHTML = xhrFormat.formatGoalToHTML(goalData);
      xhrCSV = xhrFormat.formatGoalToCSV(goalData);
      
      const sourceType = goalData.metadata.source;
      const summary = goalEngine.buildConfirmationSummary(mergedProfile, assessment);
      
      finalReply = summary + '\n\n---\n📋 **已为你生成试用期目标草案**（基于我们刚才聊的内容）\n\n';
      if (sourceType === 'conversation_based') {
        finalReply += '✨ 这份目标是**根据你提供的信息**定制的，不是通用模板。你可以直接拿去和上级讨论对齐。\n\n';
      } else {
        finalReply += '⚠️ 部分内容使用了通用模板，建议你补充具体任务信息后重新生成，会更贴合你的实际情况。\n\n';
      }
      finalReply += '💡 如果需要调整任何细节（比如任务描述、权重、里程碑），随时告诉我！';
    }
  }

  const hasEngineResponse = userIntent === 'summary' || userIntent === 'contribute' || userIntent === 'progress_check'
    || (breakpoints.length > 0 && breakpointPrompt)
    || (ks.knowledgeFound && ks.knowledgeContext && ks.isQuestion);

  if (journeyAlert) {
    combinedContext += (combinedContext ? '\n\n' : '') + '## 🗺️ 新人旅程提醒\n' + journeyAlert.message + '\n\n请自然地将这个旅程节点融入对话中，不要生硬地切换话题。';
  }

  if (hasEngineResponse) {
    skipLLM = true;
    skipReason = userIntent || (breakpoints.length > 0 ? 'breakpoint:' + breakpoints[0].type : '') || (ks.knowledgeFound ? 'knowledge' : '');
    console.log('[COST-SAVE] 引擎直接回答，跳过 LLM | reason:', skipReason, '| msg:', message.substring(0, 40));
    if (userIntent === 'summary') {
      finalReply = '📋 以下是你的试用期目标整理，已生成 xHR 格式表格，可以下载 CSV 导入系统。\n\n基于你目前的岗位和部门信息，我帮你梳理了 30/60/90 天的关键目标方向：';
    } else if (userIntent === 'contribute') {
      finalReply = '📝 好的，我来帮你把经验沉淀成知识库条目。请告诉我：\n1. 这次任务的核心流程是什么？\n2. 有哪些坑是别人不会告诉你的？\n3. 如果下一个新人来做，你会建议他怎么上手？';
    } else if (userIntent === 'progress_check') {
      finalReply = '📊 让我帮你梳理一下当前进度：\n\n请告诉我你目前在做的任务名称和大概进展，我来帮你做进度检查和下一步建议。';
    } else if (breakpointPrompt && breakpoints.length > 0) {
      finalReply = breakpointPrompt;
    } else if (ks.knowledgeFound && ks.knowledgeContext && ks.isQuestion) {
      const topEntry = ks.knowledgeEntries && ks.knowledgeEntries[0];
      finalReply = '📚 找到了相关内容：\n\n' + (topEntry ? '**' + topEntry.title + '**（' + topEntry.category + '）\n\n' + topEntry.content : ks.knowledgeContext);
    }
  }

  if (!skipLLM && useLLM()) {
    try {
      const msgs = brain.buildMessages(userInfo, history, message, combinedContext || null);
      const reply = await callLLM(msgs);
      finalReply = reply;
      llmOk = true;
      console.log('[LLM-CALL] LLM 已调用 | msg:', message.substring(0, 40));
    } catch (e) {
      console.error('LLM chat error:', e.message);
    }
  }

  if (!llmOk && !skipLLM) {
    if (breakpointPrompt && breakpoints.length > 0) {
      finalReply = breakpointPrompt;
    } else if (ks.knowledgeFound && ks.knowledgeContext) {
      const topEntry = ks.knowledgeEntries && ks.knowledgeEntries[0];
      finalReply = '📚 **知识库找到了相关内容**：\n\n' + (topEntry ? '**' + topEntry.title + '**（' + topEntry.category + '）\n\n' + topEntry.content : ks.knowledgeContext);
    } else {
      finalReply = '收到～有什么想聊的都可以跟我说，比如：\n• 📋 "帮我整理一下试用期目标"\n• 📚 "有没有关于XX的资料或课程"\n• 🎯 "帮我检查一下当前进度"\n• 📝 "我想把这次经验沉淀下来"';
    }
  }

  if (breakpointPrompt && breakpoints.length > 0 && llmOk) {
    finalReply = finalReply + '\n\n---\n' + breakpointPrompt;
  }

  if (ks.isQuestion && ks.knowledgeFound && llmOk) {
    let kText = '\n\n---\n📚 **知识库里有这些可以帮到你**：\n';
    if (ks.highlights.length > 0) {
      kText += '✨ 相关经验：\n';
      ks.highlights.slice(0, 2).forEach(h => { kText += '• ' + h.icon + ' ' + (h.title || '') + '\n'; });
    }
    if (ks.relevantPeople && ks.relevantPeople.length > 0) {
      kText += '\n👥 可以问这些人：\n';
      ks.relevantPeople.forEach(p => { kText += '• **' + p.name + '** — ' + p.reason + '\n'; });
    }
    finalReply = finalReply + kText;
  }

  if (courseListText) {
    const hintText = '\n\n---\n📖 **推荐学习**\n' + courseListText;
    finalReply = finalReply + hintText;
  }

  if (courseAsk) {
    finalReply = finalReply + courseAsk;
  }

  if (newHighlights.length > 0 && llmOk) {
    const hCards = hresult.highlights.map(h => highlightEngine.buildHighlightCard(h, userInfo).cardHtml);
    finalReply = finalReply + '\n\n---\n✨ 我注意到你刚刚有一个闪光时刻：\n' + hCards.join('\n');
  }

  if (proactiveAlerts.length > 0) {
    const paText = proactiveAlerts.map(a => a.message).join('\n\n---\n');
    finalReply = finalReply + '\n\n---\n' + paText;
  }

  const taskDecompInviteResult = taskDecompInvite.shouldInviteForTaskDecomposition(userInfo, topic, history);
  if (taskDecompInviteResult) {
    console.log('[TASK-DECOMP-INVITE] 触发L3任务拆解邀约:', taskDecompInviteResult.triggerReason);
    finalReply = finalReply + '\n\n---\n' + taskDecompInviteResult.message;
    store.updateTopic(userId, topicId, {
      lastTaskDecompInviteAt: new Date().toISOString(),
      taskDecompInviteCount: (topic.taskDecompInviteCount || 0) + 1,
      lastBreakpointType: 'taskDecompose',
    });
  }

  store.addMessage(userId, topicId, 'assistant', finalReply);

  const triggerType = journeyAlert ? ('journey:' + journeyAlert.nodeKey)
    : (breakpoints.length > 0 ? 'breakpoint:' + breakpoints[0].type
      : (proactiveAlerts.length > 0 ? 'proactive:' + proactiveAlerts[0].key
        : (timingEngine.shouldInterject(timing, lastHint) ? 'timing' : null)));

  if (triggerType) {
    closedLoop.recordInteraction(store, userId, topicId, triggerType, {
      journeyNode: journeyAlert?.nodeKey,
      breakpoint: breakpoints[0]?.type,
      proactiveKey: proactiveAlerts[0]?.key,
    }, message);
  }

  const learningProfile = closedLoop.getLearningProfile(store, userId);
  const adjustedRecs = closedLoop.shouldAdjustRecommendation(learningProfile, recsToPush);

  return res.json({
    reply: finalReply, profile: null, recs: adjustedRecs, questions: [],
    highlights: newHighlights,
    knowledgeFound: ks.isQuestion ? ks.knowledgeFound : undefined,
    gapAlert: gapAlert,
    journeyAlert: journeyAlert,
    breakpoint: breakpoints.length > 0 ? { type: breakpoints[0].type, deliverable: breakpoints[0].deliverable, label: breakpoints[0].deliverableLabel } : null,
    xhrExport: xhrExport,
    xhrHTML: xhrHTML,
    xhrCSV: xhrCSV,
    llmUsed: llmOk,
    engineOnly: skipLLM,
    proactiveAlerts: proactiveAlerts.length > 0 ? proactiveAlerts : undefined,
  });
  } catch (e) {
    console.error('[CHAT-ERROR]', e.message);
    res.json({
      reply: '❌ **出错了，请把这段话发给我：**\n> ' + e.message + '\n> ' + (e.stack ? e.stack.split('\n').slice(0, 1).join('') : ''),
      profile: null, recs: [], questions: [], highlights: [],
      engineOnly: true,
    });
  }
});

/* ─── Profile ─── */
app.get('/api/profile/:userId', (req, res) => {
  res.json(store.getProfile(req.params.userId) || null);
});

/* ─── Feedback ─── */
app.post('/api/feedback', (req, res) => {
  const { userId, topicId, rating, comment } = req.body;
  if (!userId || rating === undefined) return res.status(400).json({ error: '需要 userId 和 rating' });
  const fb = store.addFeedback(userId, topicId || '', rating, comment);
  res.json(fb);
});

app.get('/api/feedback', (req, res) => {
  const { userId } = req.query;
  res.json(store.getFeedback(userId || null));
});

app.get('/api/feedback/all', (req, res) => {
  res.json(store.getAllFeedback());
});

/* ─── Knowledge Base ─── */
 app.get('/api/knowledge', (req, res) => {
   const { userId } = req.query;
   const highlights = store.getHighlights(userId || null, 100);
   const profile = userId ? store.getProfile(userId) : null;
   const feedback = userId ? store.getFeedback(userId, 10) : [];
   const contribution = userId ? contributeEngine.getPersonalContribution(userId) : null;
   const byType = {};
   highlights.forEach(h => { byType[h.type] = (byType[h.type] || 0) + 1; });
   res.json({
     userId: userId || 'all',
     highlightCount: highlights.length,
     highlightsByType: byType,
     highlights: highlights.slice(0, 30),
     profile: profile ? { job: profile.job, level: profile.level, daysOnboard: profile.daysOnboard, status: profile.status } : null,
     feedbackCount: feedback.length,
     contribution,
     orgOverview: contributeEngine.getOrgOverview(),
     dataFiles: ['highlights.json', 'profiles.json', 'topics.json', 'feedback.json', 'users.json', 'courses_parsed.json', 'roster.json', 'knowledge_gaps.json'],
   });
 });

/* ─── Highlights / 闪光点 ─── */
app.get('/api/highlights', (req, res) => {
  const { userId } = req.query;
  res.json(store.getHighlights(userId || null, 50));
});

app.get('/api/highlights/all', (req, res) => {
  res.json(store.getAllHighlights());
});

app.post('/api/highlights/export', (req, res) => {
  const { userId } = req.body;
  const list = store.getHighlights(userId || null, 200);
  const text = list.map((h, i) => {
    return (i + 1) + '. ' + h.icon + ' ' + h.label + ' | ' + h.title + '\n   "' + h.subtitle + '"\n   ' + h.action + '\n';
  }).join('\n');
  res.json({ text, count: list.length });
});

/* ─── Contribution ─── */
app.get('/api/contribute', (req, res) => {
  const { userId } = req.query;
  res.json(userId ? contributeEngine.getPersonalContribution(userId) : contributeEngine.getOrgOverview());
});

/* ─── Assess / 能力体检 ─── */
app.post('/api/assess', (req, res) => {
  const { userId, answers } = req.body;
  if (!userId) return res.status(400).json({ error: '需要 userId' });
  const { COURSE_LIBRARY, TAG_INDEX } = recommendEngine;
  var profile = store.getProfile(userId) || {};
  var idInfo = getUserInfo(userId, null);
  if (idInfo) {
    profile.daysOnboard = idInfo.daysOnboard;
    if (idInfo.job) profile.job = idInfo.job;
    if (idInfo.level) profile.level = idInfo.level;
  }
  const highlights = store.getHighlights(userId, 50);
  const timing = require('./timing');
  const stage = timing.getOnboardingStage(profile.daysOnboard || 0);
  const stageConfig = timing.STAGE_CONFIG[stage];

  let result;
  if (answers && Object.keys(answers).length >= 3) {
    result = assessEngine.calculateFromAnswers(answers);
  } else {
    result = { scores: assessEngine.calculateFromHighlights(highlights) };
  }
  const gaps = assessEngine.generateGapAnalysis(result.scores, profile.level || 'B1');
  const learningPath = assessEngine.generateLearningPath(gaps, highlights, stageConfig, TAG_INDEX, COURSE_LIBRARY);

  res.json({
    scores: result.scores,
    benchmarks: assessEngine.getBenchmark(profile.level || 'B1'),
    gaps,
    learningPath,
    stage: stageConfig,
    dimensions: assessEngine.DIMENSIONS,
    questions: assessEngine.QUESTIONS,
  });
});

/* ─── Journey ─── */
app.get('/api/journey', (req, res) => {
  const { userId } = req.query;
  var idInfo = getUserInfo(userId, null);
  var daysOnboard = idInfo ? idInfo.daysOnboard : 0;
  var progress = journeyEngine.getProgress(daysOnboard);
  res.json(progress);
});

/* ─── xHR 格式化 ─── */
app.post('/api/xhr/goal', (req, res) => {
  const { userId, customData } = req.body;
  var idInfo = getUserInfo(userId, null);
  var profile = userId ? store.getProfile(userId) : {};
  if (idInfo) {
    profile.daysOnboard = idInfo.daysOnboard;
    if (idInfo.job && !profile.job) profile.job = idInfo.job;
    if (idInfo.department && !profile.department) profile.department = idInfo.department;
  }
  var daysOnboard = (profile && profile.daysOnboard) || 0;

  let goalData;
  if (customData && customData.kpis) {
    goalData = customData;
  } else {
    goalData = xhrFormat.generateTrialGoalDraft(daysOnboard, profile.job || user.job || '', profile.department || '');
    if (user) goalData.employeeName = user.name || '';
  }

  const formatted = xhrFormat.formatGoalToXHR(goalData);
  const htmlTable = xhrFormat.formatGoalToHTML(goalData);
  const csvContent = xhrFormat.formatGoalToCSV(goalData);
  res.json({ formatted, htmlTable, csvContent, goalData });
});

/* ─── Knowledge Gaps（知识缺口管理） ─── */
app.get('/api/knowledge-gaps', (req, res) => {
  const { status } = req.query;
  const gaps = knowledgeSearch.getGaps(status || null);
  res.json({
    total: gaps.length,
    open: gaps.filter(g => g.status === 'open').length,
    resolving: gaps.filter(g => g.status === 'resolving').length,
    resolved: gaps.filter(g => g.status === 'resolved').length,
    gaps,
  });
});

app.put('/api/knowledge-gaps/:gapId', (req, res) => {
  const gaps = knowledgeSearch.getGaps();
  const gap = gaps.find(g => g.id === req.params.gapId);
  if (!gap) return res.status(404).json({ error: '缺口不存在' });

  const { status, assignee, note } = req.body;
  if (status) gap.status = status;
  if (assignee) gap.assignee = assignee;
  if (note) gap.note = (gap.note || '') + '\n[' + new Date().toISOString().slice(0, 10) + '] ' + note;
  gap.updatedAt = new Date().toISOString();

  if (status === 'resolved') gap.resolvedAt = new Date().toISOString();

  fs.writeFileSync(path.join(__dirname, 'data', 'knowledge_gaps.json'), JSON.stringify(gaps, null, 2), 'utf-8');
  res.json({ ok: true, gap });
});

app.post('/api/knowledge-gaps/:gapId/fill', (req, res) => {
  const gaps = knowledgeSearch.getGaps();
  const gap = gaps.find(g => g.id === req.params.gapId);
  if (!gap) return res.status(404).json({ error: '缺口不存在' });

  const { title, content, category, source } = req.body;
  if (!title || !content) return res.status(400).json({ error: '需要 title 和 content' });

  knowledgeSearch.importEntry({
    category: category || '知识补充',
    title: title,
    content: content,
    keywords: gap.query ? [gap.query] : [],
    source: source || ('缺口补充 · ' + (req.body.filledBy || '管理员')),
  });

  gap.status = 'resolved';
  gap.resolvedAt = new Date().toISOString();
  gap.resolution = { title, filledBy: req.body.filledBy || '管理员', filledAt: new Date().toISOString() };
  fs.writeFileSync(path.join(__dirname, 'data', 'knowledge_gaps.json'), JSON.stringify(gaps, null, 2), 'utf-8');

  res.json({ ok: true, gap, message: '知识缺口已补充并转为知识卡片，后续新人提问将自动匹配此条。' });
});

app.post('/api/knowledge-gaps/:gapId/assign', (req, res) => {
  const gaps = knowledgeSearch.getGaps();
  const gap = gaps.find(g => g.id === req.params.gapId);
  if (!gap) return res.status(404).json({ error: '缺口不存在' });

  const { assignee } = req.body;
  if (!assignee) return res.status(400).json({ error: '需要 assignee（指派对象）' });

  gap.assignee = assignee;
  gap.status = 'resolving';
  gap.updatedAt = new Date().toISOString();
  fs.writeFileSync(path.join(__dirname, 'data', 'knowledge_gaps.json'), JSON.stringify(gaps, null, 2), 'utf-8');

  res.json({ ok: true, gap, message: '已指派给 ' + assignee + ' 补充知识内容。补充完成后请使用 /api/knowledge-gaps/' + req.params.gapId + '/fill 提交。' });
});

/* ─── Knowledge Entries CRUD ─── */
app.get('/api/knowledge/entries', (req, res) => {
  res.json(knowledgeSearch.getAllEntries());
});

app.post('/api/knowledge/entries', (req, res) => {
  const { category, title, content, keywords, source } = req.body;
  if (!title || !content) return res.status(400).json({ error: '需要 title 和 content' });
  const count = knowledgeSearch.importEntry({ category, title, content, keywords: keywords || [], source: source || '管理员导入' });
  res.json({ ok: true, totalEntries: count });
});

app.put('/api/knowledge/entries/:id', (req, res) => {
  const updated = knowledgeSearch.updateEntry(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: '条目不存在' });
  res.json(updated);
});

app.delete('/api/knowledge/entries/:id', (req, res) => {
  const ok = knowledgeSearch.deleteEntry(req.params.id);
  res.json({ ok });
});

/* ─── Admin ─── */
app.get('/api/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

/* ─── Test Report ─── */
app.get('/test-results/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'test-results', req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: '报告文件不存在' });
  }
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.sendFile(filePath);
});

app.get('/api/admin/config', (req, res) => {
  res.json({ apiKey: config.llm.apiKey === 'sk-your-api-key-here' ? '' : (config.llm.apiKey || ''), baseURL: config.llm.baseURL, model: config.llm.model, llmActive: checkLLM() });
});

app.post('/api/admin/config', (req, res) => {
  const { apiKey, baseURL, model } = req.body;
  if (apiKey !== undefined) config.llm.apiKey = apiKey || 'sk-your-api-key-here';
  if (baseURL) config.llm.baseURL = baseURL;
  if (model) config.llm.model = model;
  saveConfig();
  res.json({ ok: true, llmActive: checkLLM() });
});

/* ─── Identity Management ─── */
app.get('/api/identity/stats', (req, res) => {
  res.json(identity.getStats());
});

app.get('/api/identity/search', (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: '需要搜索关键词 q' });
  res.json(identity.search(q));
});

app.get('/api/identity/:userId', (req, res) => {
  var info = identity.getIdentity(req.params.userId);
  if (!info) return res.status(404).json({ error: '未找到该用户' });
  res.json(info);
});

app.post('/api/identity/:userId/update', (req, res) => {
  var result = identity.updateEntry(req.params.userId, req.body);
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

/* ─── Start ─── */
function startServer(port) {
  const srv = app.listen(port, '0.0.0.0', () => {
    const os = require('os');
    const ifaces = os.networkInterfaces();
    let lanIP = '';
    for (const name of Object.keys(ifaces)) {
      for (const iface of ifaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) { lanIP = iface.address; break; }
      }
      if (lanIP) break;
    }
    console.log('----------------------------------------');
    console.log('  学伴已启动');
    console.log('  本地访问: http://localhost:' + port);
    if (lanIP) console.log('  局域网访问: http://' + lanIP + ':' + port);
    console.log('  Demo页面: http://localhost:' + port + '/demo.html');
    console.log('  管理后台: http://localhost:' + port + '/api/admin');
    console.log('----------------------------------------');
  });
  srv.on('error', (e) => {
    if (e.code === 'EADDRINUSE') { console.log('端口 ' + port + ' 被占用，尝试 ' + (port + 1) + '...'); srv.close(); startServer(port + 1); }
    else console.error('启动失败:', e.message);
  });
}
startServer(process.env.PORT || config.server.port || 3456);
