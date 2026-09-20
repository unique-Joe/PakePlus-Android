(function () {
  'use strict';

  const SPECIES_NAME_ALIASES = {
    '氢离子': 'H⁺', '氢氧根离子': 'OH⁻', '氢氧根': 'OH⁻', '羟基离子': 'OH⁻',
    '钠离子': 'Na⁺', '钾离子': 'K⁺', '钙离子': 'Ca²⁺', '钡离子': 'Ba²⁺',
    '铵根': 'NH₄⁺', '铵根离子': 'NH₄⁺', '铵离子': 'NH₄⁺',
    '乙酸根': 'CH₃COO⁻', '醋酸根': 'CH₃COO⁻', '乙酸分子': 'CH₃COOH', '醋酸分子': 'CH₃COOH',
    '氯离子': 'Cl⁻', '硝酸根': 'NO₃⁻', '硫酸根': 'SO₄²⁻', '氟离子': 'F⁻',
    '碳酸氢根': 'HCO₃⁻', '碳酸根': 'CO₃²⁻', '磷酸根': 'PO₄³⁻',
    '水合氢离子': 'H₃O⁺', '水合氢': 'H₃O⁺'
  };

  function setStatus(el, msg, isError) {
    el.textContent = msg;
    el.className = 'ai-status ' + (isError ? 'ai-status-error' : 'ai-status-info');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 解析模型 JSON：统一走 AiApi 容错解析（自动修复 LaTeX 引起的非法转义等）
  async function callAi(systemPrompt, userText) {
    const content = await window.AiApi.call(systemPrompt, userText);
    return window.AiApi.parseModelJson(content);
  }

  // ===== Markdown 渲染：marked 解析 + DOMPurify 净化（vendor 本地第三方库）=====
  // DOMPurify 钩子：所有链接在新标签页打开并阻断反向跳转（官方推荐做法）
  if (typeof DOMPurify !== 'undefined' && !window.__aiMdHookInstalled) {
    DOMPurify.addHook('afterSanitizeAttributes', function (node) {
      if (node.tagName === 'A' && node.getAttribute('href')) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    });
    window.__aiMdHookInstalled = true;
  }

  function renderMarkdown(src) {
    if (src === null || src === undefined) return '';
    const text = String(src).replace(/\r\n?/g, '\n');
    // 库未加载完成时退化为纯文本展示，避免抛错
    if (typeof marked === 'undefined' || !marked.parse) {
      return escapeHtml(text).replace(/\n/g, '<br>');
    }
    let html;
    try {
      html = marked.parse(text, { gfm: true, breaks: true });
    } catch (e) {
      return escapeHtml(text).replace(/\n/g, '<br>');
    }
    if (typeof DOMPurify !== 'undefined') {
      try {
        html = DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });
      } catch (e) { /* 净化失败时保留 marked 输出 */ }
    }
    return html;
  }

  function buildExplainPrompt() {
    return `你是一名化学助教，负责把用户关于滴定的问题解析成结构化指令，由前端结合当前曲线数据生成解答。\n` +
      `请只输出合法 JSON，不要输出任何解释、markdown 代码块或推理过程。\n` +
      `输出格式只能是以下五种之一：\n` +
      `1. 询问某个 pH、体积或 pOH 条件下溶液的物种组成、浓度（含某类离子总和）：\n` +
      `{ "type": "distributionQuery", "axisMode": "ph" | "volume" | "poh", "xValue": 数字, "filter": "all" | "cation" | "anion" | "neutral" | "specific", "speciesNames": ["物种名"], "aggregation": "none" | "sum" }\n` +
      `2. 询问滴定突变区间、跃迁区间、等当点位置：\n` +
      `{ "type": "jumpInfo" }\n` +
      `3. 询问某种指示剂（酚酞、甲基橙、甲基红等）是否适合当前滴定：\n` +
      `{ "type": "indicatorQuery", "indicators": [{ "name": "指示剂名", "low": 变色下限 pH, "high": 变色上限 pH }] }\n` +
      `4. 其他通识类问题：\n` +
      `{ "type": "general", "answer": "结合上下文的中文回答，可使用 Markdown 格式（加粗、列表、表格、行内代码、公式等）" }\n` +
      `5. 复合问题（包含多个子问题，例如“离子浓度是多少并写出化学方程式”）：\n` +
      `{ "type": "compound", "steps": [\n` +
      `  { "type": "distributionQuery", ... },\n` +
      `  { "type": "general", "answer": "化学方程式或补充说明" }\n` +
      `] }\n` +
      `规则：\n` +
      `- 若用户一句话里包含多个独立请求（如先问浓度再问方程式/机理/建议），请优先使用 compound 类型，每个子问题放入 steps，确保所有请求都被回答。\n` +
      `- 当无法确定复合意图时，可退化为 general 给出完整回答。\n` +
      `- filter 用于只筛选部分物种：阳离子用 cation，阴离子用 anion，中性分子用 neutral，具体某几个物种用 specific 并在 speciesNames 中给出上下文里列出的物种名。\n` +
      `- 问“阳离子浓度总和/总和是多少”这类聚合问题时，filter 取对应类别且 aggregation 取 "sum"。\n` +
      `- axisMode：按 pH 提问用 "ph"，按体积提问用 "volume"，按 pOH 提问用 "poh"。若用户未指定条件但询问组成，默认取等当点（上下文中有等当点 pH）。\n` +
      `- 指示剂变色范围请用标准文献值（如酚酞 8.0~9.6，甲基橙 3.1~4.4，甲基红 4.4~6.2，百里酚酞 9.4~10.6）。\n` +
      `- 数学/化学公式必须使用纯标准 LaTeX 数学语法，仅使用 $...$、$$...$$、\mathrm{...}、\frac、\sqrt、下标 _{}、上标 ^{} 等基础数学命令；化学式/化学方程式示例：$\mathrm{H_2O}$、$\mathrm{Ca^{2+}}$、$\mathrm{H^+ + OH^- \rightarrow H_2O}$；禁止调用 \ce、\pu、mhchem 或任何需要额外 LaTeX 宏包的命令；避免在 $...$ 内换行。\n` +
      `- general 类型请结合上下文中的当前滴定体系信息回答，简洁准确。\n` +
      `- 输出必须严格是 JSON。`;
  }

  function getActiveTabSafe() {
    return (typeof getActiveTab === 'function') ? getActiveTab() : null;
  }

  function getJumps(tab) {
    if (!tab || !tab.jumpInfo) return [];
    return Array.isArray(tab.jumpInfo.leaps) && tab.jumpInfo.leaps.length
      ? tab.jumpInfo.leaps
      : [tab.jumpInfo];
  }

  function componentDesc(comp) {
    if (!comp) return '';
    const name = comp.displayName || comp.name || '?';
    const conc = Number.isFinite(comp.concentration) ? comp.concentration : '?';
    const kStr = (comp.isStrong || !Array.isArray(comp.kValues) || !comp.kValues.length)
      ? '' : `，pK=${comp.kValues.join('/')}`;
    return `${name} ${conc} mol/L${kStr}`;
  }

  function buildContext() {
    const parts = [];
    const tab = getActiveTabSafe();
    if (tab && tab.type === 'single' && tab.params) {
      const p = tab.params;
      const solStr = (p.solution?.components || []).map(componentDesc).join('、') || '无';
      const titStr = (p.titrant?.components || []).map(componentDesc).join('、') || '无';
      const v0 = p.solution?.V0 ?? '?';
      parts.push(`当前滴定体系：滴定剂（${titStr}）滴定 ${v0} mL 待测液（${solStr}）`);
    } else {
      parts.push('当前尚未生成滴定曲线。');
    }
    const jumps = getJumps(tab);
    if (jumps.length) {
      const jumpStr = jumps.map((leap, i) =>
        `#${i + 1}: pH ${leap.minPH.toFixed(2)}~${leap.maxPH.toFixed(2)}，等当点 pH=${leap.equivalencePH.toFixed(2)}（V=${leap.equivalenceVolume.toFixed(2)} mL）`
      ).join('；');
      parts.push(`跃迁区间：${jumpStr}`);
    }
    if (typeof window.getDistributionSpeciesInfo === 'function') {
      let list = [];
      try { list = window.getDistributionSpeciesInfo() || []; } catch (e) { list = []; }
      if (list.length) {
        const by = (cat) => list.filter(s => s.category === cat).map(s => s.label).join('、');
        parts.push(`体系物种：阳离子（${by('cation') || '无'}）；阴离子（${by('anion') || '无'}）；中性（${by('neutral') || '无'}）`);
      }
    }
    return parts.join('\n');
  }

  function normSpeciesLabel(s) {
    return String(s || '').toLowerCase()
      .replace(/⁺/g, '+').replace(/⁻/g, '-')
      .replace(/[\s]/g, '');
  }

  function resolveSpeciesName(name) {
    const direct = SPECIES_NAME_ALIASES[name];
    if (direct) return direct;
    const norm = normSpeciesLabel(name);
    for (const key in SPECIES_NAME_ALIASES) {
      if (normSpeciesLabel(key) === norm) return SPECIES_NAME_ALIASES[key];
    }
    return name;
  }

  function matchSpeciesLabels(species, name) {
    const target = normSpeciesLabel(resolveSpeciesName(name));
    if (!target) return false;
    const labels = Array.isArray(species) ? species : [species];
    return labels.some(s => {
      const l = normSpeciesLabel(s.label || s);
      return l === target || l.includes(target) || target.includes(l);
    });
  }

  function formatConcentration(value) {
    if (!Number.isFinite(value) || value <= 0) return '0';
    if (value >= 1e-3 && value < 100) return value.toPrecision(4);
    return value.toExponential(3);
  }

  function filterLabel(filter) {
    switch (filter) {
      case 'cation': return '阳离子';
      case 'anion': return '阴离子';
      case 'neutral': return '中性分子';
      case 'specific': return '所询问的物种';
      default: return '溶液中各物种';
    }
  }

  function buildDistributionAnswer(result, query) {
    if (!result || !Array.isArray(result.speciesData)) return '无法获取该条件下的物种分布数据。';
    const filter = query.filter || 'all';
    let species = result.speciesData.slice();
    if (filter === 'cation') species = species.filter(s => s.category === 'cation');
    else if (filter === 'anion') species = species.filter(s => s.category === 'anion');
    else if (filter === 'neutral') species = species.filter(s => s.category === 'neutral');
    else if (filter === 'specific') {
      const names = Array.isArray(query.speciesNames) ? query.speciesNames : [];
      species = species.filter(s => names.some(n => matchSpeciesLabels([s], n)));
    }
    species.sort((a, b) => (b.rawY || 0) - (a.rawY || 0));
    const header = `在 V = ${Number(result.volume).toFixed(2)} mL（pH = ${Number(result.pH).toFixed(2)}）时`;
    if (!species.length) {
      return `${header}，没有找到${filterLabel(filter)}。`;
    }
    if (query.aggregation === 'sum') {
      const sum = species.reduce((acc, s) => acc + (s.rawY || 0), 0);
      const detail = species.map(s => `${s.label} ${formatConcentration(s.rawY)}`).join(' + ');
      return `**${header}**，${filterLabel(filter)}的浓度总和为 **${formatConcentration(sum)} mol/L**。\n\n（${detail}）`;
    }
    const lines = [`**${header}**，${filterLabel(filter)}的浓度如下：`];
    species.forEach(s => {
      lines.push(`- **${s.label}**：${formatConcentration(s.rawY)} mol/L`);
    });
    return lines.join('\n');
  }

  function buildJumpInfoAnswer() {
    const tab = getActiveTabSafe();
    const jumps = getJumps(tab);
    if (!jumps.length) return '当前曲线未检测到明显的 pH 跃迁区。';
    const lines = ['当前滴定曲线的跃迁信息：'];
    jumps.forEach((leap, idx) => {
      const title = jumps.length > 1 ? `第 ${idx + 1} 个跃迁区` : '跃迁区';
      lines.push(`- **${title}**：pH ${leap.startPH.toFixed(2)} ~ ${leap.endPH.toFixed(2)}（等当点 V = ${leap.equivalenceVolume.toFixed(2)} mL，pH = ${leap.equivalencePH.toFixed(2)}；体积范围 ${leap.startVolume.toFixed(2)} ~ ${leap.endVolume.toFixed(2)} mL）`);
    });
    return lines.join('\n');
  }

  function buildIndicatorAnswer(query) {
    const tab = getActiveTabSafe();
    const jumps = getJumps(tab);
    if (!jumps.length) return '当前曲线未检测到明显的 pH 跃迁区，无法判断指示剂适配性。';
    let indicators = Array.isArray(query.indicators) ? query.indicators.filter(i => i && i.name) : [];
    if (!indicators.length && query.indicatorName) {
      indicators = [{ name: query.indicatorName, low: query.low, high: query.high }];
    }
    if (!indicators.length) return '未能识别要判断的指示剂。';
    const lines = ['当前滴定跃迁信息：'];
    jumps.forEach((leap, i) => {
      lines.push(`- 跃迁区 ${jumps.length > 1 ? '#' + (i + 1) + ' ' : ''}pH ${leap.minPH.toFixed(2)} ~ ${leap.maxPH.toFixed(2)}，等当点 pH = ${leap.equivalencePH.toFixed(2)}`);
    });
    lines.push('');
    indicators.forEach(ind => {
      const low = Number(ind.low);
      const high = Number(ind.high);
      if (!Number.isFinite(low) || !Number.isFinite(high)) {
        lines.push(`**【${ind.name}】**缺少有效变色范围数据，无法判断。`);
        return;
      }
      lines.push(`**【${ind.name}】** 变色范围 pH ${low.toFixed(1)} ~ ${high.toFixed(1)}：`);
      jumps.forEach((leap, i) => {
        const tag = jumps.length > 1 ? `对跃迁区 #${i + 1}：` : '';
        const contained = low >= leap.minPH && high <= leap.maxPH;
        const overlapLow = Math.max(low, leap.minPH);
        const overlapHigh = Math.min(high, leap.maxPH);
        const overlap = overlapHigh - overlapLow;
        let volumesStr = '';
        if (typeof getIndicatorFit === 'function') {
          const fit = getIndicatorFit(tab, { name: ind.name, range: [low, high] });
          const overlapEntry = fit && Array.isArray(fit.validOverlaps)
            ? fit.validOverlaps.find(v => v.leapIndex === i) : null;
          if (overlapEntry && Number.isFinite(overlapEntry.lowVolume) && Number.isFinite(overlapEntry.highVolume)) {
            volumesStr = `对应滴定体积 ${overlapEntry.lowVolume.toFixed(2)} ~ ${overlapEntry.highVolume.toFixed(2)} mL`;
          }
        }
        if (contained) {
          lines.push(`- ${tag}变色范围完全落在跃迁区（pH ${leap.minPH.toFixed(2)} ~ ${leap.maxPH.toFixed(2)}）内${volumesStr ? '，' + volumesStr : ''}，**适合**作为该滴定的指示剂，终点误差小。`);
        } else if (overlap > 0) {
          lines.push(`- ${tag}变色范围与跃迁区仅部分重叠（pH ${overlapLow.toFixed(2)} ~ ${overlapHigh.toFixed(2)}）${volumesStr ? '，' + volumesStr : ''}，勉强可用但终点误差较大，建议改用更合适的指示剂。`);
        } else {
          lines.push(`- ${tag}变色范围与跃迁区（pH ${leap.minPH.toFixed(2)} ~ ${leap.maxPH.toFixed(2)}）不重叠，**不适合**作为该滴定的指示剂。`);
        }
      });
    });
    return lines.join('\n');
  }

  // 公式预处理：归一化模型输出中偶发的双反斜杠、Unicode 数学字符与公式块写法
  function preprocessMath(text) {
    if (!text) return text;
    let s = String(text);

    // 0. 将 Unicode 数学字符替换为 LaTeX/ASCII 友好形式
    const unicodeMap = {
      '\u2212': '-', '\u00D7': '\\times', '\u00F7': '\\div',
      '\u2260': '\\neq', '\u2264': '\\leq', '\u2265': '\\geq',
      '\u2248': '\\approx',
      '\u2192': '\\rightarrow', '\u21CC': '\\rightleftharpoons',
      '\u221E': '\\infty', '\u03B1': '\\alpha', '\u03B2': '\\beta',
      '\u03C0': '\\pi'
    };
    s = s.replace(/[\u2212\u00D7\u00F7\u2260\u2264\u2265\u2248\u2192\u21CC\u221E\u03B1\u03B2\u03C0]/g, ch => unicodeMap[ch] || ch);

    // 1. 模型常在 JSON 里把 LaTeX 命令写成 \\frac、\\(、\\[ 等，需先归一化为单反斜杠
    s = s.replace(/\\\\([a-zA-Z]+)/g, '\\$1');
    s = s.replace(/\\\\([\(\)\[\]])/g, '\\$1');

    let out = '';
    let i = 0;
    while (i < s.length) {
      // display 公式块 $$...$$
      if (s[i] === '$' && s[i + 1] === '$') {
        const end = s.indexOf('$$', i + 2);
        if (end !== -1) {
          const content = s.slice(i + 2, end)
            .replace(/\n/g, ' ')
            .replace(/\\\\([a-zA-Z]+)/g, '\\$1')
            .trim();
          out += '$$' + content + '$$';
          i = end + 2;
          continue;
        }
      }

      // display 公式块 \[...\]
      if (s[i] === '\\' && s[i + 1] === '[') {
        const end = s.indexOf('\\]', i + 2);
        if (end !== -1) {
          const content = s.slice(i + 2, end).replace(/\n/g, ' ').trim();
          out += '$$' + content + '$$';
          i = end + 2;
          continue;
        }
      }

      // 行内公式 $...$：清理内部换行与多余空格
      if (s[i] === '$') {
        const end = s.indexOf('$', i + 1);
        if (end !== -1) {
          const content = s.slice(i + 1, end).replace(/\n/g, ' ').trim();
          out += '$' + content + '$';
          i = end + 1;
          continue;
        }
      }

      // 行内公式 \(...\)
      if (s[i] === '\\' && s[i + 1] === '(') {
        const end = s.indexOf('\\)', i + 2);
        if (end !== -1) {
          const content = s.slice(i + 2, end).replace(/\n/g, ' ').trim();
          out += '$' + content + '$';
          i = end + 2;
          continue;
        }
      }

      out += s[i];
      i++;
    }
    return out;
  }

  // 渲染答案到容器，并在 MathJax 可用时排版其中的 LaTeX 公式
  function renderAnswer(el, markdownText) {
    el.innerHTML = renderMarkdown(preprocessMath(markdownText));
    if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
      window.MathJax.typesetPromise([el]).catch(function () { /* 排版失败不影响文本展示 */ });
    }
  }

  // 执行单个问题步骤，返回 Markdown 文本或 null（general 的 answer 直接返回）
  async function executeExplainStep(step, statusEl) {
    const type = step && step.type;
    if (type === 'distributionQuery') {
      if (!Number.isFinite(step.xValue) || !step.axisMode) throw new Error('缺少查询参数');
      if (typeof window.queryDistributionAtCoordinate !== 'function') throw new Error('浓度分布接口不可用');
      const dist = window.queryDistributionAtCoordinate(step.xValue, step.axisMode);
      if (!dist) throw new Error('浓度分布数据未就绪，请先生成滴定曲线');
      if (statusEl) setStatus(statusEl, '已结合浓度分布数据生成解答...', false);
      return buildDistributionAnswer(dist, step);
    }
    if (type === 'jumpInfo') {
      if (statusEl) setStatus(statusEl, '已结合滴定曲线跃迁信息生成解答...', false);
      return buildJumpInfoAnswer();
    }
    if (type === 'indicatorQuery') {
      if (statusEl) setStatus(statusEl, '已结合跃迁范围完成指示剂判断...', false);
      return buildIndicatorAnswer(step);
    }
    if (type === 'general') {
      return step.answer || '暂无回答';
    }
    throw new Error('未知问题类型：' + type);
  }

  async function handleExplain() {
    const btn = document.getElementById('aiExplainBtn');
    const textarea = document.getElementById('aiExplainInput');
    const status = document.getElementById('aiExplainStatus');
    const answerEl = document.getElementById('aiExplainAnswer');
    if (!btn || !textarea || !status || !answerEl) return;

    const text = textarea.value.trim();
    if (!text) {
      setStatus(status, '请输入问题', true);
      return;
    }
    btn.disabled = true;
    setStatus(status, 'AI 正在分析问题...', false);
    answerEl.textContent = '思考中...';
    try {
      const userMessage = `上下文：\n${buildContext()}\n\n用户问题：${text}`;
      const raw = await window.AiApi.call(buildExplainPrompt(), userMessage);
      const result = window.AiApi.parseModelJson(raw);
      // 降级：模型未按结构化 JSON 返回（如复杂问题触发自由发挥）时，
      // 把原文直接作为 Markdown 回答展示，而不是报错
      if (!result || !result.type) {
        const fallback = String(raw || '').trim();
        if (fallback) {
          renderAnswer(answerEl, fallback);
          setStatus(status, '已生成回答', false);
          return;
        }
        throw new Error('AI 没有返回有效内容');
      }

      if (result.type === 'compound') {
        const steps = Array.isArray(result.steps) ? result.steps : [];
        if (!steps.length) throw new Error('复合问题未返回任何子步骤');
        const answers = [];
        for (let i = 0; i < steps.length; i++) {
          const stepAns = await executeExplainStep(steps[i], status);
          if (stepAns !== null && stepAns !== undefined) {
            answers.push(`### 第 ${i + 1} 部分\n\n${stepAns}`);
          }
        }
        renderAnswer(answerEl, answers.join('\n\n---\n\n'));
        setStatus(status, '已生成完整回答（含多个部分）', false);
      } else {
        const single = await executeExplainStep(result, status);
        renderAnswer(answerEl, single);
        setStatus(status, '已生成回答', false);
      }
    } catch (err) {
      console.error(err);
      setStatus(status, '解答失败：' + err.message, true);
      answerEl.textContent = '获取解答失败，请重试。';
    } finally {
      btn.disabled = false;
    }
  }

  function initAiExplain() {
    const btn = document.getElementById('aiExplainBtn');
    if (!btn) return;
    btn.addEventListener('click', handleExplain);
  }

  document.addEventListener('DOMContentLoaded', initAiExplain);
})();
