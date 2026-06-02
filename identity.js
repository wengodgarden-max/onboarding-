const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

var EXCEL_PATH = path.join(__dirname, '..', '..', '自主学习产品材料', '01_人员数据', '员工花名册_demo.xlsx');
var CACHE_PATH = path.join(__dirname, 'data', 'roster_cache.json');

var _roster = [];
var _loadedAt = null;
var _excelMtime = null;
var _cacheMtime = null;
var _indexById = {};
var _indexByName = {};
var _changeListeners = [];
var _syncLog = [];

var SCHEMA = {
  id: { type: 'string', required: true, label: '员工工号', excelCol: '工号' },
  name: { type: 'string', required: true, label: '姓名', excelCol: '姓名' },
  englishName: { type: 'string', required: false, label: '英文名', excelCol: '英文名' },
  status: { type: 'string', required: false, label: '在职状态', excelCol: '在职状态' },
  company: { type: 'string', required: false, label: '公司', excelCol: '公司' },
  deptLevel1: { type: 'string', required: false, label: '一级部门', excelCol: '一级部门' },
  deptLevel2: { type: 'string', required: false, label: '二级部门', excelCol: '二级部门' },
  deptLevel3: { type: 'string', required: false, label: '三级部门', excelCol: '三级部门' },
  deptLevel4: { type: 'string', required: false, label: '四级部门', excelCol: '四级部门' },
  departmentCode: { type: 'string', required: false, label: '直属部门编码', excelCol: '直属部门编码' },
  department: { type: 'string', required: true, label: '直属部门', excelCol: '直属部门' },
  positionCode: { type: 'string', required: false, label: '编制编码', excelCol: '编制编码' },
  job: { type: 'string', required: true, label: '岗位(编制)', excelCol: '编制' },
  level: { type: 'string', required: false, label: '职级', excelCol: '职级' },
  grade: { type: 'string', required: false, label: '职等', excelCol: '职等' },
  managerName: { type: 'string', required: false, label: '直属上级', excelCol: '直属上级' },
  mentorName: { type: 'string', required: false, label: '导师', excelCol: '导师' },
  hrBP: { type: 'string', required: false, label: 'HRBB', excelCol: 'HRBB' },
  location: { type: 'string', required: false, label: '工作地', excelCol: '工作地' },
  employeeClass: { type: 'string', required: false, label: '员工组', excelCol: '员工组' },
  type: { type: 'string', required: false, label: '用工类型', excelCol: '员工子组' },
  onboardDate: { type: 'string', required: true, label: '入职日期', excelCol: '入职日期', pattern: /^\d{4}-\d{2}-\d{2}/ },
  probationEndDate: { type: 'string', required: false, label: '转正日期', excelCol: '转正日期' },
};

function parseExcel() {
  var tmpScript = path.join(__dirname, 'data', '_tmp_excel_parse.py');
  var pythonCode = [
    "import sys,json,pandas as pd",
    "try:",
    "  df=pd.read_excel(r'" + EXCEL_PATH.replace(/\\/g, '/') + "',sheet_name=0,header=1)",
    "  df=df.iloc[1:].reset_index(drop=True)",
    "  records=[]",
    "  cols=['工号','姓名','英文名','在职状态','公司','一级部门','二级部门','三级部门','四级部门',",
    "        '直属部门编码','直属部门','编制编码','编制','职级','职等','直属上级','导师','HRBB',",
    "        '工作地','员工组','员工子组','入职日期','转正日期']",
    "  valid=[c for c in cols if c in df.columns]",
    "  for _,r in df.iterrows():",
    "    eid=r.get('工号')",
    "    if pd.isna(eid) or str(eid).strip()=='': continue",
    "    rec={}",
    "    for c in valid:",
    "      v=r.get(c)",
    "      rec[c]=str(v).strip() if pd.notna(v) else ''",
    "    hire=rec.get('入职日期','')",
    "    if hire and hasattr(hire,'strftime'): rec['入职日期']=hire.strftime('%Y-%m-%d')",
    "    elif hire and len(str(hire))>=10: rec['入职日期']=str(hire)[:10]",
    "    prob=rec.get('转正日期','')",
    "    if prob and hasattr(prob,'strftime'): rec['转正日期']=prob.strftime('%Y-%m-%d')",
    "    elif prob and len(str(prob))>=10: rec['转正日期']=str(prob)[:10]",
    "    records.append(rec)",
    "  sys.stdout.reconfigure(encoding='utf-8')",
    "  print(json.dumps({'ok':True,'count':len(records),'records':records},ensure_ascii=False))",
    "except Exception as e:",
    "  sys.stdout.reconfigure(encoding='utf-8')",
    "  print(json.dumps({'ok':False,'error':str(e)},ensure_ascii=False))"
  ].join('\n');
  try {
    fs.writeFileSync(tmpScript, pythonCode, 'utf-8');
    var result = execSync('python "' + tmpScript + '"', {
      encoding: 'utf-8',
      timeout: 30000,
      cwd: path.dirname(EXCEL_PATH),
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 5 * 1024 * 1024
    });
    return JSON.parse(result.trim());
  } catch (e) {
    var errOutput = e.stderr ? e.stderr.toString() : e.message;
    return { ok: false, error: 'exec error: ' + errOutput };
  } finally {
    try { fs.unlinkSync(tmpScript); } catch (_) {}
  }
}

function mapExcelToSchema(excelRecord) {
  var entry = {};
  entry.id = String(excelRecord['工号'] || '').trim();
  entry.name = String(excelRecord['姓名'] || '').trim();
  entry.englishName = String(excelRecord['英文名'] || '').trim();
  entry.status = String(excelRecord['在职状态'] || '').trim();
  entry.company = String(excelRecord['公司'] || '').trim();

  var d1 = String(excelRecord['一级部门'] || '').trim();
  var d2 = String(excelRecord['二级部门'] || '').trim();
  var d3 = String(excelRecord['三级部门'] || '').trim();
  var d4 = String(excelRecord['四级部门'] || '').trim();
  var parts = [d1, d2, d3, d4].filter(function(p) { return p && p !== 'nan'; });
  entry.departmentPath = parts.join('/');
  entry.department = String(excelRecord['直属部门'] || parts[parts.length - 1] || '').trim();
  entry.deptLevel1 = d1;
  entry.deptLevel2 = d2;

  entry.job = String(excelRecord['编制'] || '').trim();
  entry.level = String(excelRecord['职级'] || '').trim();
  entry.grade = String(excelRecord['职等'] || '');

  var mgrRaw = String(excelRecord['直属上级'] || '').trim();
  entry.managerName = mgrRaw.replace(/\[\d+\]/g, '').trim();
  var mentorRaw = String(excelRecord['导师'] || '').trim();
  entry.mentorName = mentorRaw.replace(/\[\d+\]/g, '').trim();
  entry.hrBP = String(excelRecord['HRBB'] || '').replace(/\[\d+\]/g, '').trim();

  entry.location = String(excelRecord['工作地'] || '').trim().replace(/\s+/g, '');
  entry.employeeClass = String(excelRecord['员工组'] || '').trim().replace(/\s+/g, '');
  entry.type = String(excelRecord['员工子组'] || '').trim().replace(/\s+/g, '');

  var hireRaw = String(excelRecord['入职日期'] || '').trim();
  if (hireRaw && hireRaw.length >= 10) {
    entry.onboardDate = hireRaw.substring(0, 10);
  }
  var probRaw = String(excelRecord['转正日期'] || '').trim();
  if (probRaw && probRaw.length >= 10) {
    entry.probationEndDate = probRaw.substring(0, 10);
  }

  entry._raw = excelRecord;
  entry._source = 'excel';
  return entry;
}

function validateEntry(entry, index) {
  var errors = [];
  var warnings = [];
  var fields = Object.keys(SCHEMA);
  for (var i = 0; i < fields.length; i++) {
    var f = fields[i];
    var rule = SCHEMA[f];
    var val = entry[f];
    if (rule.required && (!val || val.toString().trim() === '' || val === 'nan')) {
      errors.push('[' + index + '] 缺少必填字段: ' + rule.label + ' (' + f + ')');
    }
    if (val && val !== 'nan' && rule.pattern && !rule.pattern.test(val)) {
      warnings.push('[' + index + '] 字段格式异常: ' + f + '="' + val + '"');
    }
    if (val && val !== 'nan' && rule.enum && rule.enum.indexOf(val) === -1) {
      warnings.push('[' + index + '] 字段值不在允许范围内: ' + f + '="' + val + '", 允许值=' + rule.enum.join(','));
    }
  }
  return { errors: errors, warnings: warnings };
}

function buildIndex() {
  _indexById = {};
  _indexByName = {};
  var idConflicts = [];
  for (var i = 0; i < _roster.length; i++) {
    var e = _roster[i];
    if (!_indexById[e.id]) _indexById[e.id] = [];
    _indexById[e.id].push(e);
    if (!_indexByName[e.name]) _indexByName[e.name] = e;
  }
  Object.keys(_indexById).forEach(function(id) {
    if (_indexById[id].length > 1) {
      idConflicts.push({ id: id, count: _indexById[id].length, names: _indexById[id].map(function(e){return e.name}) });
    }
  });
  return { totalRecords: _roster.length, uniqueIds: Object.keys(_indexById).length, uniqueNames: Object.keys(_indexByName).length, conflicts: idConflicts };
}

function saveCache() {
  try {
    var cacheData = {
      source: EXCEL_PATH,
      syncedAt: new Date().toISOString(),
      excelMtime: _excelMtime,
      recordCount: _roster.length,
      records: _roster
    };
    var cacheDir = path.dirname(CACHE_PATH);
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cacheData, null, 2), 'utf-8');
    _cacheMtime = Date.now();
    console.log('[IDENTITY] Cache saved: ' + _roster.length + ' records -> ' + CACHE_PATH);
  } catch (e) {
    console.error('[IDENTITY] Cache save failed:', e.message);
  }
}

function loadCache() {
  try {
    if (fs.existsSync(CACHE_PATH)) {
      var raw = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
      if (raw.records && Array.isArray(raw.records) && raw.records.length > 0) {
        _roster = raw.records;
        _loadedAt = raw.syncedAt || new Date().toISOString();
        _cacheMtime = fs.statSync(CACHE_PATH).mtimeMs;
        buildIndex();
        console.log('[IDENTITY] Cache loaded: ' + _roster.length + ' records (synced at ' + (_loadedAt || '?') + ')');
        return true;
      }
    }
  } catch (e) {
    console.error('[IDENTITY] Cache load failed:', e.message);
  }
  return false;
}

function loadFromExcel() {
  console.log('[IDENTITY-SYNC] Reading Excel: ' + EXCEL_PATH);
  var startTime = Date.now();
  var excelStat = null;
  try {
    excelStat = fs.statSync(EXCEL_PATH);
    _excelMtime = excelStat.mtimeMs;
  } catch (e) {
    console.error('[IDENTITY-SYNC] Excel file not found: ' + EXCEL_PATH);
    return { ok: false, error: 'Excel not found: ' + EXCEL_PATH, fallback: loadCache() };
  }

  var parsed = parseExcel();
  if (!parsed.ok) {
    console.error('[IDENTITY-SYNC] Parse failed:', parsed.error);
    return { ok: false, error: parsed.error, fallback: loadCache() };
  }

  var oldCount = _roster.length;
  _roster = [];
  var validationErrors = [];
  var validationWarnings = [];

  for (var j = 0; j < parsed.records.length; j++) {
    var mapped = mapExcelToSchema(parsed.records[j]);
    var v = validateEntry(mapped, j);
    validationErrors = validationErrors.concat(v.errors);
    validationWarnings = validationWarnings.concat(v.warnings);
    _roster.push(mapped);
  }

  _loadedAt = new Date().toISOString();
  buildIndex();
  saveCache();

  var elapsed = Date.now() - startTime;
  var stats = buildIndex();
  console.log('[IDENTITY-SYNC] Excel loaded: ' + stats.totalRecords + ' records (' + elapsed + 'ms)');
  console.log('[IDENTITY-SYNC] Unique IDs: ' + stats.uniqueIds + ', Names: ' + stats.uniqueNames);

  if (stats.conflicts.length > 0) {
    console.log('[IDENTITY-SYNC] WARNING: ' + stats.conflicts.length + ' duplicate ID(s):');
    stats.conflicts.forEach(function(c) { console.log('  ID ' + c.id + ': x' + c.count + ' (' + c.names.join(', ') + ')'); });
  }

  if (validationErrors.length > 0) {
    console.log('[IDENTITY-SYNC] Validation errors: ' + validationErrors.length);
    validationErrors.slice(0, 5).forEach(function(e) { console.log('  ' + e); });
  }
  if (validationWarnings.length > 0) {
    console.log('[IDENTITY-SYNC] Validation warnings: ' + validationWarnings.length);
    validationWarnings.slice(0, 5).forEach(function(w) { console.log('  ' + w); });
  }

  var logEntry = {
    time: _loadedAt,
    action: 'sync_from_excel',
    source: EXCEL_PATH,
    recordCount: _roster.length,
    oldCount: oldCount,
    errors: validationErrors.length,
    warnings: validationWarnings.length,
    conflicts: stats.conflicts.length,
    elapsed: elapsed
  };
  _syncLog.push(logEntry);
  if (_syncLog.length > 50) _syncLog = _syncLog.slice(-50);

  notifyChange({
    type: 'sync',
    source: 'excel',
    recordCount: _roster.length,
    oldCount: oldCount,
    timestamp: _loadedAt,
    log: logEntry
  });

  return { ok: true, count: _roster.length, elapsed: elapsed, stats: stats, errors: validationErrors, warnings: validationWarnings };
}

function load() {
  var excelExists = false;
  try { excelExists = fs.existsSync(EXCEL_PATH); } catch (_) {}

  if (excelExists) {
    return loadFromExcel();
  } else {
    console.log('[IDENTITY] Excel not found, loading from cache...');
    var cached = loadCache();
    if (cached) return { ok: true, source: 'cache', count: _roster.length };
    console.log('[IDENTITY] No cache available, roster is empty');
    return { ok: false, error: 'No data source available' };
  }
}

function ensureFresh() {
  try {
    if (fs.existsSync(EXCEL_PATH)) {
      var mt = fs.statSync(EXCEL_PATH).mtimeMs;
      if (mt !== _excelMtime) {
        console.log('[IDENTITY-SYNC] Excel file changed, re-syncing...');
        loadFromExcel();
      }
    }
  } catch (_) {}
}

function onChange(listener) {
  if (typeof listener === 'function') _changeListeners.push(listener);
}

function notifyChange(event) {
  for (var i = 0; i < _changeListeners.length; i++) {
    try { _changeListeners[i](event); } catch (_) {}
  }
}

function find(userId, userName) {
  if (_indexById[userId]) {
    var candidates = _indexById[userId];
    if (candidates.length === 1) return candidates[0];
    if (userName && candidates.length > 1) {
      var match = candidates.find(function(e) { return e.name === userName; });
      if (match) return match;
    }
    return candidates[0];
  }
  if (userName && _indexByName[userName]) return _indexByName[userName];
  return null;
}

function getIdentity(userId, userName) {
  ensureFresh();
  var entry = find(userId, userName);
  if (!entry) return null;
  return resolveIdentity(entry);
}

function resolveIdentity(entry) {
  var info = {
    id: entry.id,
    name: entry.name || '',
    englishName: entry.englishName || '',
    status: entry.status || '',
    company: entry.company || '',
    job: entry.job || '',
    level: entry.level || '',
    grade: entry.grade || '',
    departmentPath: entry.departmentPath || '',
    department: entry.department || '',
    location: entry.location || '',
    managerName: entry.managerName || '',
    mentorName: entry.mentorName || '',
    hrBP: entry.hrBP || '',
    type: entry.type || '',
    employeeClass: entry.employeeClass || '',
    daysOnboard: 0,
    onboardDate: entry.onboardDate || null,
    probationEndDate: entry.probationEndDate || null,
    source: entry._source || 'unknown'
  };

  if (entry.onboardDate) {
    info.daysOnboard = Math.floor((Date.now() - new Date(entry.onboardDate).getTime()) / 86400000);
    if (info.daysOnboard < 0) info.daysOnboard = 0;
  }

  return info;
}

function getAllIdentities() {
  ensureFresh();
  return _roster.map(function(e) { return resolveIdentity(e); });
}

function search(keyword) {
  ensureFresh();
  if (!keyword) return [];
  var kw = keyword.toLowerCase();
  return _roster.filter(function(e) {
    return (e.name && e.name.toLowerCase().indexOf(kw) !== -1) ||
           (e.job && e.job.toLowerCase().indexOf(kw) !== -1) ||
           (e.department && e.department.toLowerCase().indexOf(kw) !== -1) ||
           (e.departmentPath && e.departmentPath.toLowerCase().indexOf(kw) !== -1) ||
           (e.managerName && e.managerName.toLowerCase().indexOf(kw) !== -1) ||
           (e.id && e.id.indexOf(kw) !== -1);
  }).map(function(e) { return resolveIdentity(e); });
}

function getStats() {
  ensureFresh();
  var stats = buildIndex();
  stats.loadedAt = _loadedAt;
  stats.source = fs.existsSync(EXCEL_PATH) ? 'excel' : 'cache';
  stats.excelPath = EXCEL_PATH;
  stats.excelMtime = _excelMtime ? new Date(_excelMtime).toISOString() : null;
  stats.cachePath = CACHE_PATH;
  stats.schemaFields = Object.keys(SCHEMA).map(function(k) { return { field: k, ...SCHEMA[k] }; });
  stats.syncHistory = _syncLog.slice(-10);
  return stats;
}

function forceSync() {
  return loadFromExcel();
}

function updateEntry(userId, updates) {
  console.warn('[IDENTITY] updateEntry: Excel is read-only. Changes will be lost on next sync.');
  ensureFresh();
  var idx = -1;
  for (var i = 0; i < _roster.length; i++) {
    if (_roster[i].id === userId) { idx = i; break; }
  }
  if (idx === -1) return { ok: false, error: 'User not found: ' + userId };
  var oldData = JSON.parse(JSON.stringify(_roster[idx]));
  var validUpdates = {};
  var upKeys = Object.keys(updates);
  for (var j = 0; j < upKeys.length; j++) {
    var k = upKeys[j];
    if (SCHEMA[k]) validUpdates[k] = updates[k];
  }
  Object.assign(_roster[idx], validUpdates);
  var v = validateEntry(_roster[idx], idx);
  if (v.errors.length > 0) {
    _roster[idx] = oldData;
    return { ok: false, error: 'Validation failed: ' + v.errors.join('; ') };
  }
  buildIndex();
  var event = { type: 'update', userId: userId, changes: validUpdates, previous: oldData, current: _roster[idx], timestamp: new Date().toISOString(), warning: 'Excel is source of truth, change will be overwritten on next sync' };
  notifyChange(event);
  return { ok: true, entry: resolveIdentity(_roster[idx]), event: event };
}

function addEntry(newEntry) {
  console.warn('[IDENTITY] addEntry: Excel is read-only. Use Excel as source of truth.');
  ensureFresh();
  var v = validateEntry(newEntry, _roster.length);
  if (v.errors.length > 0) return { ok: false, error: 'Validation failed: ' + v.errors.join('; ') };
  if (_indexById[newEntry.id]) return { ok: false, error: 'Duplicate ID: ' + newEntry.id };
  var entry = {};
  var sk = Object.keys(SCHEMA);
  for (var i = 0; i < sk.length; i++) {
    if (newEntry[sk[i]] !== undefined) entry[sk[i]] = newEntry[sk[i]];
  }
  entry._source = 'manual';
  _roster.push(entry);
  buildIndex();
  var event = { type: 'add', userId: entry.id, entry: resolveIdentity(entry), timestamp: new Date().toISOString(), warning: 'Will be removed on next Excel sync' };
  notifyChange(event);
  return { ok: true, entry: resolveIdentity(entry), event: event };
}

function removeEntry(userId) {
  console.warn('[IDENTITY] removeEntry: Excel is read-only.');
  ensureFresh();
  var idx = -1;
  for (var i = 0; i < _roster.length; i++) {
    if (_roster[i].id === userId) { idx = i; break; }
  }
  if (idx === -1) return { ok: false, error: 'Not found: ' + userId };
  var removed = _roster.splice(idx, 1)[0];
  buildIndex();
  var event = { type: 'remove', userId: userId, removed: resolveIdentity(removed), timestamp: new Date().toISOString(), warning: 'Will be restored on next Excel sync' };
  notifyChange(event);
  return { ok: true, event: event };
}

function reload() {
  return load();
}

load();

module.exports = {
  SCHEMA: SCHEMA,
  EXCEL_PATH: EXCEL_PATH,
  CACHE_PATH: CACHE_PATH,
  load: load,
  reload: reload,
  forceSync: forceSync,
  ensureFresh: ensureFresh,
  find: find,
  getIdentity: getIdentity,
  resolveIdentity: resolveIdentity,
  getAllIdentities: getAllIdentities,
  search: search,
  getStats: getStats,
  addEntry: addEntry,
  updateEntry: updateEntry,
  removeEntry: removeEntry,
  onChange: onChange,
  getRosterRaw: function() { return _roster; },
  getSyncLog: function() { return _syncLog; },
};
