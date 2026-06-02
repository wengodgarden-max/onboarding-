const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function readJSON(f) { try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf-8')); } catch (_) { return null; } }
function writeJSON(f, d) { fs.writeFileSync(path.join(DATA_DIR, f), JSON.stringify(d, null, 2), 'utf-8'); }

let _users = readJSON('users.json') || {};
let _topics = readJSON('topics.json') || {};
let _profiles = readJSON('profiles.json') || {};
let _feedback = readJSON('feedback.json') || [];
let _sessions = readJSON('sessions.json') || {};
let _highlights = readJSON('highlights.json') || [];

function saveAll() {
  writeJSON('users.json', _users);
  writeJSON('topics.json', _topics);
  writeJSON('profiles.json', _profiles);
  writeJSON('feedback.json', _feedback);
  writeJSON('sessions.json', _sessions);
  writeJSON('highlights.json', _highlights);
}

const uuid = () => 't_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);

/* ─── Users ─── */
function getUser(userId) { return _users[userId] || null; }
function createUser(userId, name, avatar) {
  if (!_users[userId]) _users[userId] = { id: userId, name, avatar: avatar || '', createdAt: new Date().toISOString() };
  else { _users[userId].name = name; _users[userId].avatar = avatar || ''; }
  saveAll();
  return _users[userId];
}

/* ─── Topics (conversation threads) ─── */
function ensureUserTopics(userId) {
  if (!_topics[userId]) _topics[userId] = {};
  return _topics[userId];
}

function createTopic(userId, title) {
  const userTopics = ensureUserTopics(userId);
  const id = uuid();
  const topic = {
    id, title: title || '新话题',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
    profileGenerated: false,
    stage: 'greet'
  };
  userTopics[id] = topic;
  if (!_topics[userId]) _topics[userId] = {};
  _topics[userId][id] = topic;
  saveAll();
  return topic;
}

function getTopics(userId) {
  const userTopics = _topics[userId] || {};
  return Object.values(userTopics).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function getTopic(userId, topicId) {
  return (_topics[userId] && _topics[userId][topicId]) || null;
}

function updateTopic(userId, topicId, data) {
  if (!_topics[userId] || !_topics[userId][topicId]) return null;
  Object.assign(_topics[userId][topicId], data, { updatedAt: new Date().toISOString() });
  saveAll();
  return _topics[userId][topicId];
}

function deleteTopic(userId, topicId) {
  if (!_topics[userId] || !_topics[userId][topicId]) return false;
  delete _topics[userId][topicId];
  saveAll();
  return true;
}

function addMessage(userId, topicId, role, content, msgType) {
  ensureUserTopics(userId);
  if (!_topics[userId][topicId]) return null;
  const msg = { role, content, msgType: msgType || 'text', createdAt: new Date().toISOString() };
  _topics[userId][topicId].messages.push(msg);
  _topics[userId][topicId].updatedAt = new Date().toISOString();
  saveAll();
  return msg;
}

function getMessages(userId, topicId, limit) {
  if (!_topics[userId] || !_topics[userId][topicId]) return [];
  const msgs = _topics[userId][topicId].messages;
  return limit ? msgs.slice(-limit) : msgs;
}

/* ─── Profiles ─── */
function getProfile(userId) { return _profiles[userId] || null; }
function upsertProfile(userId, data) {
  const existing = _profiles[userId] || {};
  _profiles[userId] = { ...existing, ...data, userId, updatedAt: new Date().toISOString() };
  if (!_profiles[userId].createdAt) _profiles[userId].createdAt = new Date().toISOString();
  saveAll();
}

/* ─── Feedback ─── */
function addFeedback(userId, topicId, rating, comment) {
  const fb = {
    id: 'fb_' + Date.now().toString(36),
    userId, topicId, rating: parseInt(rating) || 0,
    comment: comment || '',
    createdAt: new Date().toISOString()
  };
  _feedback.push(fb);
  saveAll();
  return fb;
}

function getFeedback(userId, limit) {
  let list = _feedback;
  if (userId) list = list.filter(f => f.userId === userId);
  return list.slice(-(limit || 100));
}

function getAllFeedback() { return _feedback.slice().reverse(); }

/* ─── Sessions ─── */
function getSession(userId) { return _sessions[userId] || null; }
function saveSession(userId, data) {
  _sessions[userId] = { ...data, updatedAt: new Date().toISOString() };
  saveAll();
}

/* ─── Highlights / 闪光点 ─── */
function addHighlight(userId, topicId, data) {
  const hl = {
    id: 'hl_' + Date.now().toString(36),
    userId,
    topicId: topicId || '',
    type: data.type,
    label: data.label,
    icon: data.icon,
    color: data.color,
    bg: data.bg,
    weight: data.weight,
    title: data.title,
    subtitle: data.subtitle,
    action: data.action,
    sourceText: data.sourceText,
    sourceRegex: data.sourceRegex,
    createdAt: new Date().toISOString(),
  };
  _highlights.push(hl);
  saveAll();
  return hl;
}

function getHighlights(userId, limit) {
  let list = _highlights;
  if (userId) list = list.filter(h => h.userId === userId);
  return list.slice(-(limit || 100)).reverse();
}

function getAllHighlights() {
  return _highlights.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

module.exports = {
  getUser, createUser,
  createTopic, getTopics, getTopic, updateTopic, deleteTopic,
  addMessage, getMessages,
  getProfile, upsertProfile,
  addFeedback, getFeedback, getAllFeedback,
  getSession, saveSession,
  addHighlight, getHighlights, getAllHighlights,
};
