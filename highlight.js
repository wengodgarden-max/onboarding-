/**
 * 闪光点捕捉引擎 + 知识卡片系统
 * 在对话中自动检测新人的洞察、成就、成长瞬间，生成可沉淀的知识卡片
 */

const HIGHLIGHT_PATTERNS = [
  {
    type: 'insight',
    label: '洞察',
    icon: '💡',
    color: '#7C3AED',
    bg: 'rgba(124,58,237,0.06)',
    description: '在对话中发现了新的理解或认知突破',
    patterns: [
      /原来(?:如此|是这样|可以这样|.*更|.*不是)/, /我明白了/, /我发现了/, /恍然大悟/,
      /理解了/, /懂了/, /原来是/, /怪不得/, /之前没想到/, /这么一说/,
      /也就是说/, /换个角度/, /突然想到/, /换个思路/, /意识到/
    ],
    weight: 5,
    cardTemplate: (match) => ({
      title: '💡 新洞察',
      subtitle: match.context,
      action: '这个思路值得记下来，以后遇到类似问题可以直接调用',
    }),
  },
  {
    type: 'accomplishment',
    label: '成就',
    icon: '🏆',
    color: '#E8923F',
    bg: 'rgba(232,146,63,0.06)',
    description: '完成了一个具体的工作成果',
    patterns: [
      /做完了/, /搞定了/, /完成了/, /交付了/, /上线了/, /通过了/,
      /解决了/, /处理好了/, /搞出来了/, /写好了/, /交上去了/,
      /老板说可以/, /通过了评审/, /验收了/, /签了/, /落地了/
    ],
    weight: 5,
    cardTemplate: (match) => ({
      title: '🏆 小成就',
      subtitle: match.context,
      action: '可以复盘一下：做对了什么？下次还能优化什么？',
    }),
  },
  {
    type: 'growth',
    label: '成长',
    icon: '🌱',
    color: '#3A8B5C',
    bg: 'rgba(58,139,92,0.06)',
    description: '学到了新技能或方法',
    patterns: [
      /学会了/, /掌握了/, /能用.*了/, /第一次.*做/, /试着.*做/,
      /试了/, /摸索出/, /找到了方法/, /搞清楚了/, /熟练了/,
      /比以前.*好/, /进步了/, /成长了/
    ],
    weight: 4,
    cardTemplate: (match) => ({
      title: '🌱 新技能 Get',
      subtitle: match.context,
      action: '这个技能沉淀下来，以后能复用，也可以分享给其他新人',
    }),
  },
  {
    type: 'connection',
    label: '融会贯通',
    icon: '🔗',
    color: '#6C5CE7',
    bg: 'rgba(108,92,231,0.06)',
    description: '把学过的东西串联到实际工作中',
    patterns: [
      /之前学的.*用上了/, /和.*有关系/, /之间.*关联/,
      /串起来了/, /连起来了/, /和之前.*一样/, /一脉相承/,
      /我学到.*用到/, /理论.*实践/, /那次学的.*这次/,
      /之前.*经验.*有用/, /迁移/
    ],
    weight: 6,
    cardTemplate: (match) => ({
      title: '🔗 知识串联',
      subtitle: match.context,
      action: '把理论和实践的连接点记下来，这是从"知道"到"做到"的关键跨越',
    }),
  },
  {
    type: 'solution',
    label: '方法',
    icon: '🧩',
    color: '#0EA5E9',
    bg: 'rgba(14,165,233,0.06)',
    description: '自己总结出了解决问题的方法',
    patterns: [
      /我的方法[是：:]/, /我是这么.*的/, /这样做.*比较/,
      /试了几个方法/, /总结.*方法/, /经验.*是/, /套路/,
      /步骤.*是/, /流程.*是/, /关键[是：:]/, /核心[是：:]/,
      /我觉得.*应该/, /一般.*可以/
    ],
    weight: 5,
    cardTemplate: (match) => ({
      title: '🧩 方法论沉淀',
      subtitle: match.context,
      action: '这个方法已经可以用你自己的名字命名了，沉淀下来就是你的方法论资产',
    }),
  },
  {
    type: 'helpOthers',
    label: '助人',
    icon: '🤝',
    color: '#F43F5E',
    bg: 'rgba(244,63,94,0.06)',
    description: '开始帮助其他同事或者被同事认可',
    patterns: [
      /帮.*解决了/, /教.*怎么做/, /分享了.*给/, /同事说/,
      /被.*夸了/, /认可/, /说.*有用/, /说.*有帮助/, /说.*不错/,
      /老板表扬/, /给别人讲/, /带.*做/, /讲了一遍/, /演示给/,
      /我教了/, /有人来问我/, /被.*点赞/
    ],
    weight: 6,
    cardTemplate: (match) => ({
      title: '🤝 开始赋能他人',
      subtitle: match.context,
      action: '能帮到别人说明你已经在这块形成能力了，这是从新人到骨干的标志',
    }),
  },
  {
    type: 'riskAware',
    label: '风控意识',
    icon: '🛡️',
    color: '#6366F1',
    bg: 'rgba(99,102,241,0.06)',
    description: '预判到了风险或提前做了防范',
    patterns: [
      /提前.*想到/, /风险/, /万一/, /备用/, /担心会/,
      /预防/, /保险.*做/, /留了.*余地/, /兜底/, /备案/,
      /Plan B/, /plan b/, /备选/, /多做一个/
    ],
    weight: 4,
    cardTemplate: (match) => ({
      title: '🛡️ 风险预判',
      subtitle: match.context,
      action: '能提前想到风险是PM/骨干的必备能力，这个意识很宝贵',
    }),
  },
];

function detectHighlights(userMessage, recentHistory) {
  const contextText = (recentHistory || []).map(m => (m.role === 'user' ? m.content : '')).filter(Boolean).join(' | ').slice(-300) + ' | ' + userMessage;

  const highlights = [];
  const triggeredTypes = new Set();

  for (const pattern of HIGHLIGHT_PATTERNS) {
    if (triggeredTypes.has(pattern.type)) continue;

    for (const regex of pattern.patterns) {
      const match = userMessage.match(regex);
      if (match) {
        const card = pattern.cardTemplate({
          context: userMessage.slice(0, 200),
          match: match[0],
        });

        highlights.push({
          type: pattern.type,
          label: pattern.label,
          icon: pattern.icon,
          color: pattern.color,
          bg: pattern.bg,
          weight: pattern.weight,
          title: card.title,
          subtitle: card.subtitle,
          action: card.action,
          sourceText: userMessage.slice(0, 300),
          sourceRegex: match[0],
        });

        triggeredTypes.add(pattern.type);
        break;
      }
    }
  }

  highlights.sort((a, b) => b.weight - a.weight);

  return {
    highlights,
    count: highlights.length,
    hasHighlight: highlights.length > 0,
  };
}

function buildHighlightCard(highlight, userInfo) {
  const dateStr = new Date().toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  const userName = (userInfo && userInfo.name) ? userInfo.name : '';

  return {
    ...highlight,
    date: dateStr,
    userName,
    cardHtml: [
      '<div class="hl-card" style="border-left:3px solid ' + highlight.color + ';background:' + highlight.bg + '">',
      '<div class="hl-card-head">',
      '<span class="hl-card-icon">' + highlight.icon + '</span>',
      '<span class="hl-card-type" style="color:' + highlight.color + '">' + highlight.label + '</span>',
      '<span class="hl-card-date">' + dateStr + '</span>',
      '</div>',
      '<div class="hl-card-body">',
      '<div class="hl-card-title">' + highlight.title + '</div>',
      '<div class="hl-card-quote">"' + escHtml(highlight.subtitle) + '"</div>',
      '<div class="hl-card-action">💬 ' + highlight.action + '</div>',
      '</div>',
      '</div>',
    ].join(''),
  };
}

function escHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = { detectHighlights, buildHighlightCard, HIGHLIGHT_PATTERNS };
