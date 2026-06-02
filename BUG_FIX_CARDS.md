# 学伴系统 BUG 修复卡片 - 对标实际代码

> 给 Trae 的具体改造任务  
> 每个卡片对应一个 BUG，包含准确的文件位置和代码

---

## 🔴 Bug Card #1: userInfo 空值防御

**优先级**: P0（必修）  
**预计时间**: 1 小时  
**状态**: [ ] 待改

### 问题描述

**文件**: `server.js`  
**问题位置**: 第 87-96 行 (`getUserInfo` 函数)

当用户花名册中不存在时，`getUserInfo` 返回 `null`，但下游代码（如第 250-254 行）直接访问 `userInfo.job`, `userInfo.department` 等属性，导致 `TypeError: Cannot read property xxx of null` 崩溃。

### 当前问题代码

```javascript
// server.js 第 87-96 行
function getUserInfo(userId, userName) {
  identity.ensureFresh();
  var info = identity.getIdentity(userId, userName);
  if (info) {
    console.log('[USER-INFO] name=' + info.name + ' job=' + info.job + ' dept=' + info.department + ' level=' + info.level + ' days=' + info.daysOnboard + ' manager=' + info.managerName + ' source=' + info.sourceType);
  } else {
    console.log('[USER-INFO] userId=' + userId + ' name=' + (userName || '') + ' no identity found');
  }
  return info;  // ← 可能返回 null
}

// server.js 第 250-254 行（下游使用点 - 会崩溃）
function getIntentContext(intent, userInfo, history) {
  const job = userInfo.job || '员工';       // ← userInfo 为 null 时崩溃
  const dept = userInfo.department || '部门';
  const days = userInfo.daysOnboard || 0;
```

### 修复方案

**Step 1: 在 `getUserInfo` 函数加 try/catch**

```javascript
function getUserInfo(userId, userName) {
  try {
    identity.ensureFresh();
    var info = identity.getIdentity(userId, userName);
    if (info) {
      console.log('[USER-INFO] name=' + info.name + ' job=' + info.job + ' dept=' + info.department + ' level=' + info.level + ' days=' + info.daysOnboard + ' manager=' + info.managerName + ' source=' + info.sourceType);
    } else {
      console.log('[USER-INFO] userId=' + userId + ' name=' + (userName || '') + ' no identity found');
    }
    return info;
  } catch (e) {
    // 新增：异常处理
    console.error('[getUserInfo ERROR]', e.message, '\n', e.stack);
    return null;
  }
}
```

**Step 2: 在 `/api/chat` 路由中做防御（第 298-322 行）**

找到这段代码：
```javascript
app.post('/api/chat', async (req, res) => {
  const { userId, topicId, message } = req.body;
  // ...
  var userInfo = getUserInfo(userId, user.name);  // ← 第 320 行
  userInfo = userInfo || { name: user.name || '', job: '', level: '', department: '', daysOnboard: 0, managerName: '', mentorName: '', location: '', type: '' };
```

这段已经有降级逻辑了，但需要检查所有使用 `userInfo` 的地方是否都有防御。特别是第 250-254 行的 `getIntentContext` 函数。

改为：
```javascript
function getIntentContext(intent, userInfo, history) {
  // 新增：防御 userInfo 为 null
  if (!userInfo) {
    userInfo = { job: '员工', department: '部门', daysOnboard: 0 };
  }
  
  const job = userInfo.job || '员工';
  const dept = userInfo.department || '部门';
  const days = userInfo.daysOnboard || 0;
```

### 验证方法

**测试场景**: 用不存在的工号登录
```
1. 输入：userId="invalid999", userName="nobody"
2. 调用 `/api/login`
3. 期望：
   - ✅ 返回 200 OK（不崩溃）
   - ✅ known: false
   - ✅ terminal 有 warn 日志
   - ✅ 继续聊天不报错
```

---

## 🔴 Bug Card #2: keyTasks/tasks 字段不一致

**优先级**: P0（必修）  
**预计时间**: 1 小时  
**状态**: [ ] 待改

### 问题描述

**文件 A**: `goal-engine.js`  
**文件 B**: `xhr-format.js`

在 `goal-engine.js` 第 210 行返回的是 `keyTasks`，但在 `xhr-format.js` 第 14 行读取的是 `tasks`，导致重点任务导出为空。

### 当前问题代码

**goal-engine.js 第 179-223 行**
```javascript
function generatePersonalizedGoals(profile, userInfo) {
  // ... 代码省略 ...
  
  return {
    employeeName: userInfo?.name || profile.name || '',
    employeeId: userInfo?.id || '',
    department,
    job,
    level,
    period: '试用期',
    kpis: kpis,
    keyTasks: tasks,     // ← 用的是 keyTasks
    metadata: {
      // ...
    }
  };
}
```

**xhr-format.js 第 13-15 行**
```javascript
function formatGoalToXHR(goalData) {
  const { employeeName, employeeId, department, job, period, kpis, tasks } = goalData;
  // ↑ 解构读取的是 tasks，但 goalData 里叫 keyTasks！
```

### 修复方案

**改法 1: 改 goal-engine.js（主要方案）**

第 210 行改为：
```javascript
return {
  employeeName: userInfo?.name || profile.name || '',
  employeeId: userInfo?.id || '',
  department,
  job,
  level,
  period: '试用期',
  kpis: kpis,
  tasks: tasks,         // ← 改为 tasks
  metadata: {
    // ...
  }
};
```

**改法 2: 改 xhr-format.js（兼容方案）**

第 14 行改为：
```javascript
const { employeeName, employeeId, department, job, period, kpis, tasks, keyTasks } = goalData;
```

第 41 行读取时做兼容：
```javascript
const taskList = tasks || keyTasks || [];  // ← 兼容两种字段名

if (taskList && taskList.length > 0) {
  taskList.forEach(task => {
    taskTotalWeight += (Number(task.weight) || 0);
    const milestones = (task.milestones || []).map(m => `${m.startDate || ''} ~ ${m.endDate || ''}: ${m.name || ''}`).join('；');
    text += `| ${task.name || ''} | ${task.definition || ''} | ${task.startDate || ''} | ${task.endDate || ''} | ${task.weight || ''} | ${milestones || ''} |\n`;
  });
}
```

### 验证方法

**测试场景**: 生成目标后导出 xHR
```
1. 完成目标制定流程
2. 调用 `/api/xhr/goal`
3. 期望：
   - ✅ 返回的 formatted 中"重点任务"表格不为空
   - ✅ 包含所有任务（name, definition, weight 等）
   - ✅ 权重计算正确
```

---

## 🔴 Bug Card #3: user 变量未定义 + 权重校验错误

**优先级**: P0（必修）  
**预计时间**: 1 小时  
**状态**: [ ] 待改

### 问题描述

**文件**: `server.js`  
**问题位置**: 第 747-770 行 (`/api/xhr/goal` 路由)

在第 762 行引用了 `user` 变量，但这个作用域里没有定义 `user`。

### 当前问题代码

```javascript
// server.js 第 747-770 行
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
    // ↑ 第 762 行：user 未定义！
    if (user) goalData.employeeName = user.name || '';  // ← 又是 user
  }

  const formatted = xhrFormat.formatGoalToXHR(goalData);
  const htmlTable = xhrFormat.formatGoalToHTML(goalData);
  const csvContent = xhrFormat.formatGoalToCSV(goalData);
  res.json({ formatted, htmlTable, csvContent, goalData });
});
```

### 修复方案

在路由开头补充 `user` 变量定义：

```javascript
app.post('/api/xhr/goal', (req, res) => {
  const { userId, customData } = req.body;
  
  // 新增：获取 user 变量
  const user = store.getUser(userId) || {};
  
  var idInfo = getUserInfo(userId, user.name);
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
    goalData = xhrFormat.generateTrialGoalDraft(daysOnboard, profile.job || (user && user.job) || '', profile.department || '');
    // ↑ 现在 user 已定义
    if (user && user.name) goalData.employeeName = user.name;  // ← 安全检查
  }

  const formatted = xhrFormat.formatGoalToXHR(goalData);
  const htmlTable = xhrFormat.formatGoalToHTML(goalData);
  const csvContent = xhrFormat.formatGoalToCSV(goalData);
  res.json({ formatted, htmlTable, csvContent, goalData });
});
```

### 验证方法

**测试场景**: 调用 `/api/xhr/goal`
```
1. POST /api/xhr/goal
   Body: { userId: '11064001' }
2. 期望：
   - ✅ 返回 200（不崩溃）
   - ✅ 包含 formatted, htmlTable, csvContent, goalData
   - ✅ terminal 无 ReferenceError
```

---

## 🔴 Bug Card #4: catch 块错误处理 + 分段 catch

**优先级**: P0（必修）  
**预计时间**: 1.5 小时  
**状态**: [ ] 待改

### 问题描述

**文件**: `server.js`  
**问题位置**: 第 298-629 行 (`/api/chat` 路由)

当前有两个问题：
1. 最后的 catch 块（第 621-629 行）可能因为 `e.stack.split()` 而二次崩溃
2. 任何一个引擎失败（第 313、324、343、384 等）都会导致整个请求返回 500

### 当前问题代码

**问题 A: catch 块二次错误**
```javascript
// server.js 第 621-629 行
} catch (e) {
  console.error('[CHAT-ERROR]', e.message);
  res.json({
    reply: '❌ **出错了，请把这段话发给我：**\n> ' + e.message + '\n> ' + (e.stack ? e.stack.split('\n').slice(0, 1).join('') : ''),
    // ↑ e.stack.split() 可能在某些 Error 类型下报错（e.stack 为 undefined）
    profile: null, recs: [], questions: [], highlights: [],
    engineOnly: true,
  });
}
```

**问题 B: 单引擎失败导致全流程失败**

比如第 384-422 行的课程推荐 catch 块只保护了推荐逻辑，但如果前面的 journeyEngine（第 343 行）崩溃，整个请求就失败了。

### 修复方案

**修复 A: 安全化 catch 块**

改第 621-629 行：
```javascript
} catch (e) {
  const errorId = require('uuid').v4();
  // 后端完整记录
  console.error('[CHAT-ERROR-' + errorId + ']', e.message, '\n', (e.stack || '(no stack)'));
  
  // 前端只显示友好提示
  res.status(500).json({
    error: '系统错误',
    reply: '抱歉，系统遇到问题。请将错误码反馈给技术团队：' + errorId,
    errorId: errorId,
    profile: null, recs: [], questions: [], highlights: [],
    engineOnly: true,
  });
}
```

**修复 B: 为各个引擎加分段 catch**

在第 342-356 行（journeyEngine 部分）加 try/catch：
```javascript
let journeyAlert = null;
const hasOtherResponse = userIntent || (breakpoints.length > 0 && breakpointPrompt) || (ks.knowledgeFound && ks.knowledgeContext && ks.isQuestion);
if (!hasOtherResponse) {
  try {  // ← 新增
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
  } catch (e) {  // ← 新增
    console.error('[JOURNEY-ERROR]', e.message);
    journeyAlert = null;  // 降级处理
  }  // ← 新增
}
```

同样改 highlightEngine（第 424-431 行）：
```javascript
let newHighlights = [];
try {  // ← 新增
  const hresult = highlightEngine.detectHighlights(message, history.slice(-6));
  if (hresult.hasHighlight) {
    newHighlights = hresult.highlights.map(h => {
      store.addHighlight(userId, topicId, h);
      return { icon: h.icon, label: h.label, title: h.title, subtitle: h.subtitle, color: h.color };
    });
  }
} catch (e) {  // ← 新增
  console.warn('[HIGHLIGHT-ERROR]', e.message);
  newHighlights = [];
}  // ← 新增
```

### 验证方法

**测试 1: 引擎部分失败但主流程继续**
```
1. 在 recommendationEngine.recommend() 里加 throw 
2. 发送聊天消息
3. 期望：
   - ✅ 仍能获得主要回复
   - ✅ 不返回 500 错误
   - ✅ 推荐为空
   - ✅ terminal 有 WARN 级别日志
```

**测试 2: 查看错误日志**
```
1. 故意触发任何错误
2. 期望：
   - ✅ terminal 看到 [CHAT-ERROR-xxxx] 和完整 stack
   - ✅ 前端用户只看到错误码，没有 stack
```

---

## 📋 修复检查清单

完成每个 Bug 修复后，勾选：

- [ ] Bug #1: userInfo 空值防御 - 完成并通过验证
- [ ] Bug #2: keyTasks/tasks 字段统一 - 完成并通过验证
- [ ] Bug #3: user 变量 + xHR 导出 - 完成并通过验证
- [ ] Bug #4: catch 块 + 分段错误处理 - 完成并通过验证

---

## 🚀 后续步骤

所有 P0 BUG 修复完成后：
1. 提交一个 Commit: `fix: P0 BUG 修复集合`
2. 创建 Pull Request
3. 等待 Review 合并

之后进入 P1 问题修复（目标制定门槛、历史消息污染、课程推荐等）
