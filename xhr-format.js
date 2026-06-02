/**
 * xHR 格式化输出模块
 * 基于 目标设定模版-XHR导入.xlsx 结构
 * 生成可直接复制进 xHR 系统的格式化文本（含量化指标）
 */

const TEMPLATE_CONFIG = {
  kpiColumns: ['关键绩效指标', '指标定义与描述', '开始日期', '结束日期', '权重(%)', '数据来源', '上周期完成值', '门槛值(60分)', '目标值(100分)', '挑战值(140分)'],
  taskColumns: ['重点工作任务', '任务定义与描述', '开始日期', '结束日期', '权重(%)', '完成标准及交付件/关键里程碑'],
  milestoneSub: ['开始日期', '结束日期', '关键里程碑'],
};

function formatGoalToXHR(goalData) {
  const { employeeName, employeeId, department, job, period, kpis, tasks } = goalData;

  let text = `# 员工目标制定 · xHR 导入格式\n`;
  const eName = employeeName || '待填';
  const eId = employeeId || '待填';
  text += `> 员工: ${eName} | 工号: ${eId} | 部门: ${department || '待填'} | 岗位: ${job || '待填'}\n`;
  text += `> 周期: ${period || '试用期(90天)'}\n\n`;

  let kpiTotalWeight = 0;
  let taskTotalWeight = 0;

  text += `## 一、关键绩效考核指标（KPI）\n\n`;
  text += `| ${TEMPLATE_CONFIG.kpiColumns.join(' | ')} |\n`;
  text += `|${TEMPLATE_CONFIG.kpiColumns.map(() => '---').join('|')}|\n`;

  if (kpis && kpis.length > 0) {
    kpis.forEach(kpi => {
      kpiTotalWeight += (Number(kpi.weight) || 0);
      text += `| ${kpi.name || ''} | ${kpi.definition || ''} | ${kpi.startDate || ''} | ${kpi.endDate || ''} | ${kpi.weight || ''} | ${kpi.dataSource || ''} | ${kpi.lastValue || ''} | ${kpi.threshold || ''} | ${kpi.target || ''} | ${kpi.challenge || ''} |\n`;
    });
  }
  text += `| **KPI小计** | | | | **${kpiTotalWeight}%** | | | | | | |\n\n`;

  text += `## 二、重点任务\n\n`;
  text += `| ${TEMPLATE_CONFIG.taskColumns.join(' | ')} |\n`;
  text += `|${TEMPLATE_CONFIG.taskColumns.map(() => '---').join('|')}|\n`;

  if (tasks && tasks.length > 0) {
    tasks.forEach(task => {
      taskTotalWeight += (Number(task.weight) || 0);
      const milestones = (task.milestones || []).map(m => `${m.startDate || ''} ~ ${m.endDate || ''}: ${m.name || ''}`).join('；');
      text += `| ${task.name || ''} | ${task.definition || ''} | ${task.startDate || ''} | ${task.endDate || ''} | ${task.weight || ''} | ${milestones || ''} |\n`;
    });
  }
  text += `| **任务小计** | | | | **${taskTotalWeight}%** | |\n\n`;

  const totalWeight = kpiTotalWeight + taskTotalWeight;
  text += `---\n`;
  text += `**权重核对**：KPI ${kpiTotalWeight}% + 重点任务 ${taskTotalWeight}% = **${totalWeight}%**${totalWeight === 100 ? ' ✅ 合计100%' : ' ⚠️ 合计不是100%，请检查'}\n\n`;
  text += `💡 **使用说明**：将上表数据逐行复制到 xHR 目标设定模板对应列即可。KPI权重+任务权重应合计100%。\n`;

  return text;
}

function generateTrialGoalDraft(daysOnboard, job, department) {
  const startDate = new Date();
  const d30 = new Date(startDate.getTime() + 30 * 86400000);
  const d60 = new Date(startDate.getTime() + 60 * 86400000);
  const d90 = new Date(startDate.getTime() + 90 * 86400000);
  const fmt = d => d.toISOString().slice(0, 10);

  const kpis = [
    {
      name: '业务系统熟悉度',
      definition: '独立完成所在岗位核心业务系统操作，无需他人辅助',
      startDate: fmt(startDate), endDate: fmt(d30), weight: 20,
      dataSource: '系统操作记录/导师签字确认',
      lastValue: '—',
      threshold: '30天内独立操作率≥60%',
      target: '独立操作率≥90%，常见操作零求助',
      challenge: '独立操作率100%，关键操作可指导新人',
    },
    {
      name: '核心流程掌握',
      definition: '理解并独立执行岗位相关核心业务流程',
      startDate: fmt(startDate), endDate: fmt(d60), weight: 20,
      dataSource: '流程检查清单/任务记录',
      lastValue: '—',
      threshold: '完成≥2个核心流程',
      target: '独立完成≥3个核心流程，出错率<10%',
      challenge: '完成≥5个流程，输出改善建议≥2条被采纳',
    },
    {
      name: '任务交付质量',
      definition: '按质按量完成导师/上级分配的关键任务',
      startDate: fmt(startDate), endDate: fmt(d90), weight: 30,
      dataSource: '任务管理表/上级评分(1-5分)',
      lastValue: '—',
      threshold: '任务按时完成率≥80%，质量评分≥3.0',
      target: '按时按质完成率≥95%，质量评分≥4.0',
      challenge: '完成率100%，评分≥4.5，主动承担≥1个额外任务',
    },
    {
      name: '团队融入与协作',
      definition: '与关键对接人建立有效协作关系，能够参与跨部门配合',
      startDate: fmt(startDate), endDate: fmt(d90), weight: 10,
      dataSource: '对接人反馈/会议参与次数',
      lastValue: '—',
      threshold: '认识并完成≥5人1v1，参加≥3次跨部门会议',
      target: '与≥10人建立有效对接，独立发起≥2次跨部门协作',
      challenge: '发起跨部门协作≥4次且有可验证产出，被2名以上对接人书面认可',
    },
  ];

  const tasks = [
    {
      name: '新人上手计划执行',
      definition: '完成部门新人上手清单所有必选项',
      startDate: fmt(startDate), endDate: fmt(d30), weight: 10,
      milestones: [
        { startDate: fmt(startDate), endDate: fmt(new Date(startDate.getTime() + 7 * 86400000)), name: '完成所有系统权限开通和接入' },
        { startDate: fmt(new Date(startDate.getTime() + 3 * 86400000)), endDate: fmt(d30), name: '完成≥10份核心文档阅读和读后检核(含纠正或补充建议)' },
        { startDate: fmt(new Date(startDate.getTime() + 14 * 86400000)), endDate: fmt(d30), name: '完成首次导师check-in并记录待办' },
      ],
    },
    {
      name: '试用期业务项目A',
      definition: '独立承接1个真实业务任务，产出可验收交付物',
      startDate: fmt(new Date(startDate.getTime() + 14 * 86400000)), endDate: fmt(d90), weight: 10,
      milestones: [
        { startDate: fmt(new Date(startDate.getTime() + 14 * 86400000)), endDate: fmt(new Date(startDate.getTime() + 30 * 86400000)), name: '完成项目范围确认和方案初稿' },
        { startDate: fmt(new Date(startDate.getTime() + 30 * 86400000)), endDate: fmt(d60), name: '完成第一阶段执行并输出中期报告' },
        { startDate: fmt(d60), endDate: fmt(d90), name: '提交最终交付物并通过导师评审(≥3分)' },
      ],
    },
  ];

  return {
    employeeName: '', employeeId: '', department, job,
    period: `试用期${Math.min(daysOnboard || 90, 90)}天`,
    kpis, tasks,
  };
}

function formatGoalToHTML(goalData) {
  const { employeeName, employeeId, department, job, period, kpis, tasks } = goalData;
  const eName = employeeName || '待填';
  const eId = employeeId || '待填';
  let kpiTotalWeight = 0;
  let taskTotalWeight = 0;

  let html = '<div style="font-family:-apple-system,PingFang SC,Microsoft YaHei,sans-serif;font-size:13px;color:#1F2329">';
  html += '<div style="margin-bottom:12px;padding:10px 14px;background:#F5F4F0;border-radius:8px">';
  html += '<div style="font-size:15px;font-weight:700;margin-bottom:4px">📋 员工目标制定 · xHR 导入格式</div>';
  html += '<div style="font-size:12px;color:#646A73">员工: <b>' + eName + '</b> | 工号: ' + eId + ' | 部门: ' + (department || '待填') + ' | 岗位: ' + (job || '待填') + ' | 周期: ' + (period || '试用期(90天)') + '</div>';
  html += '</div>';

  html += '<div style="margin-bottom:16px">';
  html += '<div style="font-size:13px;font-weight:700;margin-bottom:6px;color:#4A3AAD">一、关键绩效考核指标（KPI）</div>';
  html += '<table style="width:100%;border-collapse:collapse;font-size:11px;border:1px solid #E5E1D9">';
  html += '<thead><tr style="background:#6C5CE7;color:#fff">';
  TEMPLATE_CONFIG.kpiColumns.forEach(function(col) {
    html += '<th style="padding:6px 8px;text-align:left;border:1px solid #5A4BD6;white-space:nowrap">' + col + '</th>';
  });
  html += '</tr></thead><tbody>';

  if (kpis && kpis.length > 0) {
    kpis.forEach(function(kpi, idx) {
      kpiTotalWeight += (Number(kpi.weight) || 0);
      var bg = idx % 2 === 0 ? '#fff' : '#FAFAF8';
      html += '<tr style="background:' + bg + '">';
      html += '<td style="padding:5px 8px;border:1px solid #E5E1D9;font-weight:600">' + (kpi.name || '') + '</td>';
      html += '<td style="padding:5px 8px;border:1px solid #E5E1D9">' + (kpi.definition || '') + '</td>';
      html += '<td style="padding:5px 8px;border:1px solid #E5E1D9;white-space:nowrap">' + (kpi.startDate || '') + '</td>';
      html += '<td style="padding:5px 8px;border:1px solid #E5E1D9;white-space:nowrap">' + (kpi.endDate || '') + '</td>';
      html += '<td style="padding:5px 8px;border:1px solid #E5E1D9;text-align:center;font-weight:600">' + (kpi.weight || '') + '</td>';
      html += '<td style="padding:5px 8px;border:1px solid #E5E1D9">' + (kpi.dataSource || '') + '</td>';
      html += '<td style="padding:5px 8px;border:1px solid #E5E1D9;text-align:center">' + (kpi.lastValue || '') + '</td>';
      html += '<td style="padding:5px 8px;border:1px solid #E5E1D9;background:#FEF3C7">' + (kpi.threshold || '') + '</td>';
      html += '<td style="padding:5px 8px;border:1px solid #E5E1D9;background:#D1FAE5">' + (kpi.target || '') + '</td>';
      html += '<td style="padding:5px 8px;border:1px solid #E5E1D9;background:#EDE9FE">' + (kpi.challenge || '') + '</td>';
      html += '</tr>';
    });
  }
  html += '<tr style="background:#F5F4F0;font-weight:700">';
  html += '<td style="padding:5px 8px;border:1px solid #E5E1D9" colspan="4">KPI 小计</td>';
  html += '<td style="padding:5px 8px;border:1px solid #E5E1D9;text-align:center">' + kpiTotalWeight + '%</td>';
  html += '<td style="padding:5px 8px;border:1px solid #E5E1D9" colspan="5"></td>';
  html += '</tr></tbody></table></div>';

  html += '<div style="margin-bottom:16px">';
  html += '<div style="font-size:13px;font-weight:700;margin-bottom:6px;color:#4A3AAD">二、重点任务</div>';
  html += '<table style="width:100%;border-collapse:collapse;font-size:11px;border:1px solid #E5E1D9">';
  html += '<thead><tr style="background:#6C5CE7;color:#fff">';
  TEMPLATE_CONFIG.taskColumns.forEach(function(col) {
    html += '<th style="padding:6px 8px;text-align:left;border:1px solid #5A4BD6;white-space:nowrap">' + col + '</th>';
  });
  html += '</tr></thead><tbody>';

  if (tasks && tasks.length > 0) {
    tasks.forEach(function(task, idx) {
      taskTotalWeight += (Number(task.weight) || 0);
      var bg = idx % 2 === 0 ? '#fff' : '#FAFAF8';
      var milestones = (task.milestones || []).map(function(m) { return (m.startDate || '') + ' ~ ' + (m.endDate || '') + ': ' + (m.name || ''); }).join('；');
      html += '<tr style="background:' + bg + '">';
      html += '<td style="padding:5px 8px;border:1px solid #E5E1D9;font-weight:600">' + (task.name || '') + '</td>';
      html += '<td style="padding:5px 8px;border:1px solid #E5E1D9">' + (task.definition || '') + '</td>';
      html += '<td style="padding:5px 8px;border:1px solid #E5E1D9;white-space:nowrap">' + (task.startDate || '') + '</td>';
      html += '<td style="padding:5px 8px;border:1px solid #E5E1D9;white-space:nowrap">' + (task.endDate || '') + '</td>';
      html += '<td style="padding:5px 8px;border:1px solid #E5E1D9;text-align:center;font-weight:600">' + (task.weight || '') + '</td>';
      html += '<td style="padding:5px 8px;border:1px solid #E5E1D9">' + (milestones || '') + '</td>';
      html += '</tr>';
    });
  }
  html += '<tr style="background:#F5F4F0;font-weight:700">';
  html += '<td style="padding:5px 8px;border:1px solid #E5E1D9" colspan="4">任务小计</td>';
  html += '<td style="padding:5px 8px;border:1px solid #E5E1D9;text-align:center">' + taskTotalWeight + '%</td>';
  html += '<td style="padding:5px 8px;border:1px solid #E5E1D9"></td>';
  html += '</tr></tbody></table></div>';

  var totalWeight = kpiTotalWeight + taskTotalWeight;
  html += '<div style="padding:8px 12px;border-radius:6px;font-size:12px;margin-top:8px;' + (totalWeight === 100 ? 'background:#D1FAE5;color:#065F46' : 'background:#FEF3C7;color:#92400E') + '">';
  html += '权重核对：KPI ' + kpiTotalWeight + '% + 重点任务 ' + taskTotalWeight + '% = <b>' + totalWeight + '%</b>' + (totalWeight === 100 ? ' ✅ 合计100%' : ' ⚠️ 合计不是100%，请检查');
  html += '</div>';

  html += '<div style="margin-top:8px;font-size:11px;color:#8F959E">💡 将上表数据逐行复制到 xHR 目标设定模板对应列即可。KPI权重+任务权重应合计100%。</div>';
  html += '</div>';
  return html;
}

function formatGoalToCSV(goalData) {
  const { employeeName, employeeId, department, job, period, kpis, tasks } = goalData;
  var BOM = '\uFEFF';
  var rows = [];

  rows.push(['员工目标制定 · xHR 导入格式']);
  rows.push(['员工', employeeName || '待填', '工号', employeeId || '待填', '部门', department || '待填', '岗位', job || '待填', '周期', period || '试用期(90天)']);
  rows.push([]);
  rows.push(['一、关键绩效考核指标（KPI）']);
  rows.push(TEMPLATE_CONFIG.kpiColumns);

  var kpiTotalWeight = 0;
  if (kpis && kpis.length > 0) {
    kpis.forEach(function(kpi) {
      kpiTotalWeight += (Number(kpi.weight) || 0);
      rows.push([kpi.name || '', kpi.definition || '', kpi.startDate || '', kpi.endDate || '', kpi.weight || '', kpi.dataSource || '', kpi.lastValue || '', kpi.threshold || '', kpi.target || '', kpi.challenge || '']);
    });
  }
  rows.push(['KPI小计', '', '', '', kpiTotalWeight + '%', '', '', '', '', '']);
  rows.push([]);
  rows.push(['二、重点任务']);
  rows.push(TEMPLATE_CONFIG.taskColumns);

  var taskTotalWeight = 0;
  if (tasks && tasks.length > 0) {
    tasks.forEach(function(task) {
      taskTotalWeight += (Number(task.weight) || 0);
      var milestones = (task.milestones || []).map(function(m) { return (m.startDate || '') + '~' + (m.endDate || '') + ':' + (m.name || ''); }).join('; ');
      rows.push([task.name || '', task.definition || '', task.startDate || '', task.endDate || '', task.weight || '', milestones || '']);
    });
  }
  rows.push(['任务小计', '', '', '', taskTotalWeight + '%', '']);
  rows.push([]);
  rows.push(['权重核对', 'KPI ' + kpiTotalWeight + '% + 任务 ' + taskTotalWeight + '% = ' + (kpiTotalWeight + taskTotalWeight) + '%']);

  var csv = BOM + rows.map(function(row) {
    return row.map(function(cell) {
      var s = String(cell).replace(/"/g, '""');
      return '"' + s + '"';
    }).join(',');
  }).join('\r\n');
  return csv;
}

module.exports = {
  TEMPLATE_CONFIG,
  formatGoalToXHR,
  formatGoalToHTML,
  formatGoalToCSV,
  generateTrialGoalDraft,
};
