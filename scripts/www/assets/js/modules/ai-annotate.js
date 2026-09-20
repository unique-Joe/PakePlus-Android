(function () {
  'use strict';

  const VALID_LINE_STYLES = ['solid', 'dash', 'longDash', 'dot', 'dashDot', 'denseDash'];
  const LINE_STYLE_ALIASES = { dotted: 'dot', dashed: 'dash', dottedLine: 'dot', shortDash: 'dash', longdash: 'longDash', dashdot: 'dashDot', densedash: 'denseDash' };
  const VALID_POINT_STYLES = ['circle', 'rect', 'rectRounded', 'rectRot', 'triangle', 'star', 'cross', 'crossRot', 'none'];
  const VALID_ASPECTS = ['auto', '16:9', '4:3', '1:1', '3:2', '2:1'];

  function setStatus(el, msg, isError) {
    el.textContent = msg;
    el.className = 'ai-status ' + (isError ? 'ai-status-error' : 'ai-status-info');
  }

  // 解析模型 JSON：统一走 AiApi 容错解析
  async function callAi(systemPrompt, userText) {
    const content = await window.AiApi.call(systemPrompt, userText);
    return window.AiApi.parseModelJson(content);
  }

  function normalizeLineStyle(value) {
    if (!value) return null;
    const v = String(value);
    if (VALID_LINE_STYLES.includes(v)) return v;
    if (LINE_STYLE_ALIASES[v]) return LINE_STYLE_ALIASES[v];
    return null;
  }

  function buildAnnotatePrompt() {
    return `你是一名化学助教，专门把用户对滴定曲线的标注/样式要求解析成可执行的操作列表。\n` +
      `请只输出合法 JSON，不要输出任何解释、markdown 代码块或推理过程。\n` +
      `输出格式：\n` +
      `{\n` +
      `  "actions": [\n` +
      `    { "type": "markPoint", "target": "neutral" | "ph" | "volume" | "start" | "end" | "equivalence", "ph": 数字（target=ph 时）, "volume": 数字（target=volume 时）, "index": 整数（可选，第几个等当点/跃迁区，从 0 开始）, "label": "标注文字（可选）" },\n` +
      `    { "type": "markRange", "target": "transition", "index": 整数（可选）, "label": "区间名称（可选）" },\n` +
      `    { "type": "setStyle", "color": "#rrggbb（可选）", "lineStyle": "solid" | "dash" | "longDash" | "dot" | "dashDot" | "denseDash"（可选）, "pointStyle": "circle" | "rect" | "rectRounded" | "rectRot" | "triangle" | "star" | "cross" | "crossRot" | "none"（可选）, "borderWidth": 数字（可选）, "aspectRatio": "auto" | "16:9" | "4:3" | "1:1" | "3:2" | "2:1"（可选，图表宽高比） }\n` +
      `  ]\n` +
      `}\n` +
      `规则：\n` +
      `1. target=neutral 表示 pH=7 的中性点；start 表示滴定起点（V=0）；end 表示滴定终点（最大体积）；equivalence 表示等当点。\n` +
      `2. 若存在多个等当点/跃迁区且用户未指定，可输出多个 action，每个用不同 index，或省略 index 表示全部。\n` +
      `3. 跃迁区间用 markRange transition 表示，执行时会自动标出该区间的起点和终点。\n` +
      `4. 颜色必须为 # 开头的十六进制；lineStyle 只能为 solid、dash、longDash、dot、dashDot、denseDash；pointStyle 只能为 circle、rect、rectRounded、rectRot、triangle、star、cross、crossRot、none。\n` +
      `5. 用户要求调整图表比例/宽高比时（如"图表改成16:9"、"比例1:1"），在 setStyle 中输出 aspectRatio。\n` +
      `6. 若用户只问样式（如"把曲线改成红色虚线"），只返回 setStyle。\n` +
      `7. 输出必须严格是 JSON。`;
  }

  function getActiveSingleTab() {
    const tab = (typeof getActiveTab === 'function') ? getActiveTab() : null;
    if (!tab) throw new Error('当前没有活动曲线');
    return tab;
  }

  function getPaneForTab(tab) {
    return (typeof getTabContent === 'function') ? getTabContent(tab) : null;
  }

  function markCountBefore(tab) {
    return (tab.fixedMarks || []).length;
  }

  function setLabelsForNewMarks(tab, beforeCount, baseName) {
    const marks = tab.fixedMarks || [];
    for (let i = beforeCount; i < marks.length; i++) {
      const m = marks[i];
      const vol = Number.isFinite(m.volume) ? Number(m.volume).toFixed(2) : '--';
      const ph = Number.isFinite(m.ph) ? Number(m.ph).toFixed(2) : '--';
      m.label = `${baseName}（${vol}, ${ph}）`;
    }
    refreshTabAnnotations(tab);
  }

  function openMarksPanel(tab) {
    const pane = getPaneForTab(tab);
    if (!pane) return;
    const panel = pane.querySelector('[data-role="marks-panel"]');
    if (panel) panel.open = true;
  }

  function executeMarkPoint(tab, action) {
    const target = action.target;
    const before = markCountBefore(tab);
    if (target === 'neutral') {
      pickPointByPH(tab, 7);
      setLabelsForNewMarks(tab, before, action.label || '中性点');
    } else if (target === 'ph') {
      if (!Number.isFinite(action.ph)) throw new Error('缺少 pH 数值');
      pickPointByPH(tab, action.ph);
      setLabelsForNewMarks(tab, before, action.label || `pH=${action.ph}`);
    } else if (target === 'volume') {
      if (!Number.isFinite(action.volume)) throw new Error('缺少体积数值');
      pickPointByVolume(tab, action.volume);
      setLabelsForNewMarks(tab, before, action.label || `V=${action.volume} mL`);
    } else if (target === 'start') {
      pickPointByVolume(tab, 0);
      setLabelsForNewMarks(tab, before, action.label || '起点');
    } else if (target === 'end') {
      const lastV = Array.isArray(tab.volumes) && tab.volumes.length ? tab.volumes[tab.volumes.length - 1] : (config.maxVolume || 100);
      pickPointByVolume(tab, lastV);
      setLabelsForNewMarks(tab, before, action.label || '终点');
    } else if (target === 'equivalence') {
      const jumps = tab.jumpInfo && Array.isArray(tab.jumpInfo.leaps) && tab.jumpInfo.leaps.length ? tab.jumpInfo.leaps : (tab.jumpInfo ? [tab.jumpInfo] : []);
      if (!jumps.length) throw new Error('当前曲线未检测到明显跃迁，无法标出等当点');
      const indices = Number.isInteger(action.index) ? [action.index] : jumps.map((_, i) => i);
      indices.forEach(idx => {
        const leap = jumps[idx];
        if (!leap) return;
        const b = markCountBefore(tab);
        pickPointByVolume(tab, leap.equivalenceVolume);
        setLabelsForNewMarks(tab, b, action.label || (jumps.length > 1 ? `等当点 #${idx + 1}` : '等当点'));
      });
    } else {
      throw new Error('不支持的标注目标：' + target);
    }
  }

  function executeMarkRange(tab, action) {
    const jumps = tab.jumpInfo && Array.isArray(tab.jumpInfo.leaps) && tab.jumpInfo.leaps.length ? tab.jumpInfo.leaps : (tab.jumpInfo ? [tab.jumpInfo] : []);
    if (!jumps.length) throw new Error('当前曲线未检测到明显跃迁区');
    const indices = Number.isInteger(action.index) ? [action.index] : jumps.map((_, i) => i);
    indices.forEach(idx => {
      const leap = jumps[idx];
      if (!leap) return;
      const name = action.label || (jumps.length > 1 ? `跃迁区 #${idx + 1}` : '跃迁区');
      const b1 = markCountBefore(tab);
      pickPointByVolume(tab, leap.startVolume);
      setLabelsForNewMarks(tab, b1, `${name} 起点`);
      const b2 = markCountBefore(tab);
      pickPointByVolume(tab, leap.endVolume);
      setLabelsForNewMarks(tab, b2, `${name} 终点`);
    });
  }

  function executeSetStyle(tab, action) {
    const pane = getPaneForTab(tab);
    if (action.color && /^#[0-9a-fA-F]{3,8}$/.test(action.color)) {
      const hex = action.color;
      config.curveColor = hex;
      const rootInput = document.getElementById('curveColor');
      if (rootInput) rootInput.value = hex;
      const singleColor = pane ? pane.querySelector('[data-role="single-curve-color"]') : document.querySelector('[data-role="single-curve-color"]');
      if (singleColor) singleColor.value = hex;
      if (tab.type === 'single' && Array.isArray(tab.volumes) && tab.volumes.length) {
        updateChart(tab, tab.volumes, tab.phs, hex);
      }
    }
    const lineStyle = normalizeLineStyle(action.lineStyle);
    if (lineStyle) {
      tab.curveLineStyle = lineStyle;
      const lineSelect = pane ? pane.querySelector('[data-role="line-style-select"]') : document.querySelector('[data-role="line-style-select"]');
      if (lineSelect) lineSelect.value = lineStyle;
    }
    if (action.pointStyle && VALID_POINT_STYLES.includes(action.pointStyle)) {
      tab.curvePointStyle = action.pointStyle;
      const pointSelect = pane ? pane.querySelector('[data-role="point-style-select"]') : document.querySelector('[data-role="point-style-select"]');
      if (pointSelect) pointSelect.value = action.pointStyle;
    }
    if (Number.isFinite(action.borderWidth) && action.borderWidth > 0) {
      tab.curveBorderWidth = action.borderWidth;
      const slider = pane ? pane.querySelector('[data-role="curve-thickness"]') : document.querySelector('[data-role="curve-thickness"]');
      const num = pane ? pane.querySelector('[data-role="thickness-number"]') : document.querySelector('[data-role="thickness-number"]');
      if (slider) slider.value = action.borderWidth;
      if (num) num.value = action.borderWidth;
    }
    if (typeof renderActiveTabChart === 'function') renderActiveTabChart();
    if (typeof refreshTabAnnotations === 'function') refreshTabAnnotations(tab);
    // 图表比例（宽高比）
    if (action.aspectRatio && VALID_ASPECTS.includes(action.aspectRatio)) {
      if (action.aspectRatio === 'auto') {
        const widthInput = pane ? pane.querySelector('[data-role="chart-width"]') : null;
        if (widthInput) widthInput.value = '';
        if (typeof applyChartWidth === 'function') applyChartWidth(tab, '');
      } else {
        const aspectSelect = pane ? pane.querySelector('[data-role="chart-aspect"]') : null;
        if (aspectSelect && aspectSelect.value !== action.aspectRatio) {
          aspectSelect.value = action.aspectRatio;
        }
        if (typeof applyChartAspectRatio === 'function') applyChartAspectRatio(tab, action.aspectRatio);
      }
    }
  }

  function executeAnnotations(actions) {
    const tab = getActiveSingleTab();
    if (!Array.isArray(actions) || !actions.length) throw new Error('没有可执行的操作');
    let hasMarkAction = false;
    actions.forEach((action, i) => {
      if (!action || !action.type) return;
      if (action.type === 'markPoint') {
        hasMarkAction = true;
        executeMarkPoint(tab, action);
      } else if (action.type === 'markRange') {
        hasMarkAction = true;
        executeMarkRange(tab, action);
      } else if (action.type === 'setStyle') {
        executeSetStyle(tab, action);
      }
    });
    if (hasMarkAction) openMarksPanel(tab);
    // 样式修改同步到智能配置历史
    if (typeof window.updateAiHistoryStyle === 'function') {
      window.updateAiHistoryStyle();
    }
  }

  function initAiAnnotate() {
    const btn = document.getElementById('aiAnnotateBtn');
    const textarea = document.getElementById('aiAnnotateInput');
    const status = document.getElementById('aiAnnotateStatus');
    if (!btn || !textarea || !status) return;

    btn.addEventListener('click', async () => {
      const text = textarea.value.trim();
      if (!text) {
        setStatus(status, '请输入标注或样式要求', true);
        return;
      }
      btn.disabled = true;
      const modelLabel = (window.AiApi && window.AiApi.getSelectedModel().label) || 'AI';
      setStatus(status, `AI (${modelLabel}) 正在解析标注指令...`, false);
      try {
        const result = await callAi(buildAnnotatePrompt(), text);
        if (!result || !Array.isArray(result.actions)) throw new Error('AI 没有返回有效操作列表');
        executeAnnotations(result.actions);
        setStatus(status, '标注/样式已应用', false);
      } catch (err) {
        console.error(err);
        setStatus(status, '执行失败：' + err.message, true);
      } finally {
        btn.disabled = false;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', initAiAnnotate);
})();
