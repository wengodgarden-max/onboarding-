# 学伴系统：产品定位与修整开发标准

> 给有编程能力的 AI 使用  
> 基于当前代码包：`学伴系统_代码审查.zip`  
> 目标：把当前 demo 修整为“企业级 AI 自主学习 Agent”的可扩展 V1，而不是写死为新人目标工具

---

## 1. 产品定位

### 1.1 长期定位

**学伴是学习部门建设的企业级 AI 自主学习 Agent，面向员工成长关键场景，连接 TES 学习平台、飞书、xHR 和部门知识资源，把“学习资源”转化为“真实工作中的行动产出、校准反馈和成长沉淀”。**

它不是单一新人产品，而是学习部门的 AI 学习编排层。

### 1.2 V1 定位

**V1 以新人试用期为第一个 MVP 场景，验证“真实任务驱动的自主学习闭环”。**

新人试用期只是首个 Journey，不是产品边界。后续应扩展到：

1. 新人试用期。
2. 转岗适应。
3. 晋升答辩。
4. 外派落地。
5. 新晋管理者。
6. 专业能力提升。
7. 项目复盘。
8. 关键岗位培养。
9. 后备人才成长。
10. 业务专项学习营。

### 1.3 一句话对外表达

```text
学伴是员工成长关键场景中的 AI 学习伙伴。它基于员工当前角色、任务和成长阶段，识别学习缺口，匹配 TES 课程、组织知识、协作路径和校准对象，帮助员工形成行动方案、完成工作产出，并把经验沉淀为组织学习资产。
```

---

## 2. 产品不是这些

学伴不是：

1. 不是新人专属助手。
2. 不是绩效系统。
3. 不是替上级制定目标的工具。
4. 不是 HR 管理工具。
5. 不是普通知识库问答机器人。
6. 不是课程推荐列表。
7. 不是飞书机器人外壳。
8. 不是 xHR 表格生成器。

目标制定、任务拆解、xHR 草稿只是触发学习和产出的场景之一，不是产品本体。

---

## 3. 学习部门的核心价值

学习部门要解决的不是“员工能不能问 AI”，而是：

> 员工在真实工作挑战中，能不能自主识别该学什么、去哪学、找谁校准、如何产出，以及如何把经验沉淀给组织。

因此学伴必须围绕以下闭环开发：

```text
成长场景
-> 当前任务/挑战
-> 学习缺口
-> 资源匹配
-> 行动产出
-> 校准反馈
-> 学习记录
-> 组织知识沉淀
```

如果只做到“问答”或“推课”，就没有满足学习部门的产品目标。

---

## 4. 未来系统集成定位

理想架构中，学伴应连接以下系统：

### 4.1 TES 学习平台

用于：

1. 课程检索。
2. 学习路径推荐。
3. 学习记录读取。
4. 学习完成状态回写。
5. 能力模型或课程标签映射。

### 4.2 飞书

用于：

1. 消息触达。
2. 节点提醒。
3. 导师/上级校准邀请。
4. 飞书文档生成。
5. 群内学习任务协作。
6. 复盘材料沉淀。

### 4.3 xHR

用于：

1. 员工身份。
2. 组织关系。
3. 岗位和职级。
4. 上级/导师信息。
5. 试用期或绩效目标字段。
6. 目标草稿导入或对齐。

### 4.4 部门知识与业务资料

用于：

1. SOP。
2. 岗位必读资料。
3. 常见问题。
4. 典型任务样例。
5. 目标样例。
6. 完成标准样例。
7. 联系人和求助路径。

---

## 5. 代码架构要求

当前代码不要继续写成本地 demo 直连实现。请抽象 Provider。

### 5.1 必须抽象的 Provider

```text
IdentityProvider
- xHR
- roster excel
- local mock

LearningResourceProvider
- TES
- local course library
- manual knowledge entries

CollaborationProvider
- Feishu message
- Feishu doc
- Feishu group/task
- local mock

GoalProvider
- xHR goal fields
- local draft/export

KnowledgeProvider
- department docs
- knowledge entries
- knowledge gaps

JourneyProvider
- newcomer_probation
- promotion_defense
- transfer_adaptation
- expatriation_landing
- new_manager
```

### 5.2 V1 可以先 mock，但业务代码不能写死 mock

V1 可以实现：

```text
MockIdentityProvider
MockTESProvider
MockFeishuProvider
MockXHRProvider
LocalKnowledgeProvider
```

但主业务逻辑必须通过接口调用，不要直接：

1. 读死花名册 Excel。
2. 写死 5834 门课程本地数组。
3. 拼死 xHR CSV。
4. 把飞书仅作为未来注释。
5. 把新人试用期逻辑散落在所有模块里。

---

## 6. 核心领域模型

请按以下概念组织代码，不要写死“新人”。

```text
Profile
用户画像：身份、岗位、部门、职级、阶段、上级、导师、学习记录

Journey
成长旅程：新人试用期、晋升答辩、转岗适应、外派落地、新晋管理者

Milestone
关键节点：D1、D3、D7、D30、D60、D90，或晋升/转岗等其他节点

Scenario
具体场景：目标制定、任务拆解、方向校准、复盘、答辩准备、管理上手

Timing
学习时机：用户主动提问、节点触发、任务卡点、信心低、复盘窗口

LearningGap
学习缺口：知识、流程、标准、资源、联系人、样例、技能、经验

Resource
学习资源：TES 课程、SOP、知识卡、飞书文档、联系人、导师问题

Deliverable
行动产出：目标草案、任务拆解、沟通提纲、复盘卡、答辩稿、一页纸

Feedback
校准反馈：用户反馈、导师确认、上级确认、资源有效性、缺口状态

KnowledgeAsset
组织学习资产：FAQ、任务样例、目标样例、经验沉淀、知识缺口补充
```

---

## 7. V1 新人试用期主链路

V1 仍然优先做新人试用期，因为它人群清晰、节点清晰、痛点高频、可验证。

主链路：

```text
登录识别身份
-> 判断 Journey = newcomer_probation
-> 判断入职阶段和当前 Milestone
-> 识别当前 Scenario
-> 收集真实任务和卡点
-> 识别 LearningGap
-> 匹配 TES/知识/SOP/联系人/导师问题
-> 生成行动产出
-> 引导飞书/导师/上级校准
-> 沉淀知识缺口和经验
```

V1 优先场景：

1. 活下来：找资料、找流程、找人、知道从哪里开始。
2. 定目标：把模糊想法整理成试用期目标草案。
3. 接任务：把真实任务拆成步骤、标准、资源和问题清单。
4. 轻量校准：生成和上级/导师沟通的问题，不做强管理闭环。

---

## 8. 当前代码修整方向

当前代码的问题不是功能少，而是没有按“AI 学习编排层”组织。需要修整。

## 8.1 P0：目标制定不能是 xHR 生成器

### 当前问题

用户说“帮我制定试用期目标”，系统可能直接生成目标和 xHR。这会把产品带偏成绩效工具。

### 修整目标

目标制定应当是学习缺口识别的入口。

生成目标前必须收集：

1. 当前真实任务。
2. 成功标准。
3. 上级/导师期待。
4. 不确定点。
5. 需要补齐的知识、流程、样例或联系人。

输出必须包含：

1. 目标草案。
2. 重点任务。
3. 学习缺口清单。
4. 推荐资源。
5. 上级/导师确认问题。
6. 可选 xHR 草稿。

### 给编程 AI 的任务

```text
重构目标制定流程。
1. 用户第一句“帮我制定试用期目标”后，不允许直接生成 xHR。
2. 先进入 goal_setup 状态，逐步收集任务、标准、期待和卡点。
3. 在生成目标前，必须生成 learningGaps。
4. 每个 learningGap 必须尝试匹配 resource。
5. xHR 只是 deliverables 中的 optional export，不是主逻辑。
6. 所有目标草案都必须标注“需上级/导师确认”。
```

---

## 8.2 P0：修复 `keyTasks/tasks` 字段错误

### 当前问题

`goal-engine.js` 返回 `keyTasks`，但 `xhr-format.js` 读取 `tasks`，导致重点任务导出为空。

### 为什么必须修

任务是学习缺口识别的核心输入。如果任务丢失，后续资源推荐、行动计划、导师问题、沉淀都无法成立。

### 给编程 AI 的任务

```text
统一 goalData 结构。
1. goal-engine.js 返回 tasks。
2. xhr-format.js 读取 goalData.tasks。
3. 临时兼容 goalData.tasks || goalData.keyTasks || []。
4. 所有导出格式必须包含 tasks。
5. 增加测试：有 coreTasks 时，导出重点任务不能为空。
```

---

## 8.3 P0：修复目标权重

### 当前问题

KPI 和重点任务权重口径不一致，可能误报“合计 100%”。

### 给编程 AI 的任务

```text
修复权重校验。
1. 明确 KPI + tasks 合计为 100%。
2. 如果信息不足，不生成正式 xHR。
3. totalWeight !== 100 时返回 validation.valid=false。
4. validation.valid=false 时前端不得显示“可导入”。
5. xHR 输出必须包含“草稿，需上级确认”的边界提示。
```

---

## 8.4 P0：修复历史消息污染

### 当前问题

`parseProfileFromMessages()` 扫描全部 history，可能把 assistant 欢迎语和用户触发句写入 KPI。

### 给编程 AI 的任务

```text
修复信息抽取。
1. 只从 role === "user" 的消息抽取。
2. 忽略纯意图句，例如“帮我制定试用期目标”。
3. 不要用关键词附近 substring 直接作为字段。
4. 优先使用显式状态字段 collectedFields，而不是从全历史猜测。
```

---

## 8.5 P0：建立 Scenario 状态机

不要只建“目标制定状态机”，要建可扩展 Scenario 状态机。

建议：

```text
idle
scenario_detected
collecting_context
identifying_learning_gaps
matching_resources
drafting_deliverable
awaiting_user_confirmation
awaiting_manager_or_mentor_calibration
completed
archived_as_knowledge_asset
```

新人目标制定可以是其中一个 scenario：

```text
journey = newcomer_probation
scenario = goal_setup
```

### 给编程 AI 的任务

```text
在 topic/session 中保存 activeScenario。
activeScenario 包含：
1. journey
2. scenario
3. status
4. collectedFields
5. missingFields
6. learningGaps
7. matchedResources
8. deliverables
9. calibrationTargets
10. lastUpdatedAt

/api/chat 根据 activeScenario.status 决定下一步，不要只靠关键词。
```

---

## 8.6 P1：课程推荐必须来自 LearningGap

### 当前问题

课程推荐容易变成对话尾部的泛推荐。

### 修整标准

每个课程推荐必须说明：

1. 当前任务是什么。
2. 学习缺口是什么。
3. 为什么推荐该课程/资料。
4. 学完后要产出什么。

### 给编程 AI 的任务

```text
重构推荐输出。
1. recommendedResources 必须挂在 learningGap 下。
2. 推荐来源支持 LearningResourceProvider。
3. V1 可使用 MockTESProvider 或本地课程库。
4. 业务代码不要直接依赖本地课程数组。
```

---

## 8.7 P1：知识缺口要沉淀为学习资产

### 当前问题

知识缺口现在更像“未命中问题列表”，还没有成为组织学习资产闭环。

### 给编程 AI 的任务

```text
优化 knowledge gap。
1. gap 增加 type：faq / task_example / goal_example / sop / contact_path / standard / course_gap。
2. gap 增加 sourceScene：onboarding / goal / task / calibration / review / promotion / transfer。
3. gap 使用 normalizedQuery 去重。
4. 管理员补充后先进入 pending_review。
5. 审核通过后成为 KnowledgeAsset。
6. KnowledgeAsset 可被后续 Journey 复用。
```

---

## 8.8 P1：身份识别改为 Provider

### 当前问题

花名册路径硬编码，演示账号和数据源不稳定。

### 给编程 AI 的任务

```text
抽象 IdentityProvider。
1. 支持 MockIdentityProvider。
2. 支持 ExcelRosterProvider。
3. 预留 XHRIdentityProvider。
4. 登录接口只调用 IdentityProvider.resolve(userId, name)。
5. 重复工号必须使用工号+姓名精确匹配。
6. known=false 时前端明确提示未匹配身份。
```

---

## 8.9 P1：飞书和 xHR 先做接口占位

V1 不要求真实打通，但必须预留接口，避免后续重写。

### 给编程 AI 的任务

```text
新增 provider 接口占位。

CollaborationProvider:
- sendMessage(userId, content)
- createDoc(title, content)
- createCalibrationRequest(targetUser, content)

GoalProvider:
- getGoalSchema(userInfo)
- exportGoalDraft(goalData)
- submitGoalDraft(goalData) // V1 可 throw NotImplemented

LearningResourceProvider:
- searchResources(query, context)
- getLearningRecord(userId)
- recommendByGap(learningGap, context)
```

V1 mock 实现即可，但接口和业务调用关系必须建立。

---

## 8.10 P1：错误处理不能暴露 stack trace

### 给编程 AI 的任务

```text
修复 /api/chat 错误处理。
1. 用户只看到友好提示。
2. 后端记录完整 stack。
3. 响应返回 requestId。
4. 不暴露路径、stack、密钥、上游 API 原始错误。
```

---

## 8.11 P2：修复编码乱码

### 给编程 AI 的任务

```text
统一项目编码。
1. 全项目统一 UTF-8。
2. 修复乱码文案。
3. 增加脚本扫描乱码特征：鈥、馃、锛、銆、鐨、宀。
4. 对关键接口做中文响应快照测试。
```

---

## 9. 标准响应结构

为了支持未来多场景扩展，不要只返回 `reply/xhrExport`。

建议 `/api/chat` 返回：

```js
{
  reply: string,
  journey: "newcomer_probation" | "promotion_defense" | "transfer_adaptation" | "expatriation_landing" | "new_manager",
  scenario: "goal_setup" | "task_decomposition" | "onboarding" | "calibration" | "review",
  stage: string,
  activeScenario: {
    status,
    collectedFields,
    missingFields
  },
  learningGaps: [
    {
      id,
      type,
      description,
      sourceTask,
      severity,
      matchedResources
    }
  ],
  recommendedResources: [
    {
      provider: "TES" | "local" | "knowledge" | "feishu_doc",
      type: "course" | "sop" | "knowledge" | "contact" | "mentor_question",
      title,
      reason,
      expectedOutput
    }
  ],
  deliverables: {
    goalDraft,
    tasks,
    actionList,
    mentorQuestions,
    feishuDocDraft,
    xhrExport
  },
  validation: {
    valid,
    warnings
  }
}
```

---

## 10. V1 验收标准

### 10.1 不是新人也能表达为 Journey

代码里不能把所有逻辑写死为 newcomer。  
至少应支持配置：

```text
journey = newcomer_probation
```

并保留扩展：

```text
journey = promotion_defense
journey = transfer_adaptation
journey = expatriation_landing
journey = new_manager
```

### 10.2 新人登录

```text
输入真实工号 + 姓名
期望：
known=true
返回岗位、部门、职级、入职天数、上级、导师
```

### 10.3 第一句目标制定

```text
user: 帮我制定试用期目标
```

期望：

```text
不生成 xHR
进入 journey=newcomer_probation, scenario=goal_setup
追问真实任务
```

### 10.4 任务补充后

```text
user: 我试用期最重要的是负责智能穿戴新品上市规划。
```

期望：

```text
继续追问成功标准
识别 learningGap
推荐相关资源或导师确认问题
```

### 10.5 信息足够后

期望：

```text
生成目标草案
生成重点任务
生成学习缺口
生成资源推荐
生成上级/导师确认问题
可选生成 xHR 草稿
权重校验正确
明确标注需上级/导师确认
```

### 10.6 Provider 验收

V1 即使使用 mock，也必须有：

```text
IdentityProvider
LearningResourceProvider
CollaborationProvider
GoalProvider
KnowledgeProvider
```

主业务代码不能直接依赖 Excel、CSV、本地课程数组或飞书/xHR 的具体实现。

---

## 11. 开发优先级

### 第一阶段：修主链路

1. 修 `keyTasks/tasks`。
2. 修权重校验。
3. 建 activeScenario 状态。
4. 修历史消息污染。
5. 让目标制定输出 learningGaps 和 resources。

### 第二阶段：抽象集成层

1. IdentityProvider。
2. LearningResourceProvider。
3. KnowledgeProvider。
4. GoalProvider。
5. CollaborationProvider。

### 第三阶段：学习产品能力

1. 课程推荐绑定 learningGap。
2. 知识缺口沉淀为 KnowledgeAsset。
3. 飞书文档/消息 mock。
4. xHR 草稿导出 mock。

### 第四阶段：工程质量

1. 错误处理安全化。
2. 编码清理。
3. JSON 存储优化。
4. 自动化测试。

---

## 12. 给编程 AI 的最终指令

```text
请不要把学伴开发成“新人目标/xHR生成器”。

请将它修整为学习部门的企业级 AI 自主学习 Agent：
- 面向员工成长关键场景
- V1 以新人试用期为首个 MVP
- 长期支持晋升、转岗、外派、新晋管理者等 Journey
- 未来连接 TES、飞书、xHR 和部门知识资源

当前开发请优先做到：
1. 目标制定先识别学习缺口，再生成产出。
2. 推荐资源必须来自 learningGap，不做泛课程推荐。
3. xHR 只是可选草稿导出，不是主产品逻辑。
4. 所有正式判断都标注“需上级/导师确认”。
5. 代码必须抽象 Provider，V1 可 mock，但不要写死本地实现。
6. 修复 keyTasks/tasks、权重、历史消息污染、身份识别、错误处理和中文乱码。
```

