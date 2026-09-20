(function () {
  'use strict';

  const NAME_ALIASES = {
    '醋酸': '乙酸',
    '冰醋酸': '乙酸',
    '冰乙酸': '乙酸',
    '氢氧化钠': '氢氧化钠',
    '烧碱': '氢氧化钠',
    '苛性钠': '氢氧化钠',
    '氢氧化钾': '氢氧化钾',
    '苛性钾': '氢氧化钾',
    '盐酸': '盐酸',
    '氢氯酸': '盐酸',
    '硝酸': '硝酸',
    '硫酸': '硫酸',
    '草酸': '乙二酸',
    '柠檬酸': '柠檬酸',
    '酒石酸': '酒石酸',
    '苹果酸': '苹果酸',
    '乳酸': '乳酸',
    '苯甲酸': '苯甲酸',
    '甲酸': '甲酸',
    '磷酸': '磷酸',
    '碳酸': '碳酸',
    '氢氟酸': '氢氟酸',
    '氨水': '氨水',
    '氢氧化钙': '氢氧化钙',
    '熟石灰': '氢氧化钙',
    '氢氧化钡': '氢氧化钡',
    '氢氧化锂': '氢氧化锂',
    '氢氧化镁': '氢氧化镁',
    '乙二胺': '乙二胺',
    '苯胺': '苯胺',
    '吡啶': '吡啶',
    'naoh': '氢氧化钠',
    'hcl': '盐酸',
    'h2so4': '硫酸',
    'hno3': '硝酸',
    'hac': '乙酸',
    'ch3cooh': '乙酸',
    'c2h4o2': '乙酸',
    'ca(oh)2': '氢氧化钙',
    'ba(oh)2': '氢氧化钡',
    'lioh': '氢氧化锂',
    'koh': '氢氧化钾',
    'nh3': '氨水',
    'nh3·h2o': '氨水'
  };

  function normalizeName(name) {
    if (!name) return '';
    const s = String(name).trim();
    const lower = s.toLowerCase();
    if (NAME_ALIASES[lower]) return NAME_ALIASES[lower];
    if (NAME_ALIASES[s]) return NAME_ALIASES[s];
    return s;
  }

  function normalizeFormula(formula) {
    if (!formula) return '';
    return String(formula).toLowerCase().replace(/[₀₁₂₃₄₅₆₇₈₉]/g, m => {
      const map = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };
      return map[m] || m;
    }).replace(/[^a-z0-9]/g, '');
  }

  // 常见盐溶液的等效酸碱分解：浓度系数相对于原盐浓度
  const SALT_DECOMPOSITION = {
    'na2co3': [
      { name: '碳酸', type: 'acid', factor: 1 },
      { name: '氢氧化钠', type: 'base', factor: 2 }
    ],
    'k2co3': [
      { name: '碳酸', type: 'acid', factor: 1 },
      { name: '氢氧化钾', type: 'base', factor: 2 }
    ],
    'nahco3': [
      { name: '碳酸', type: 'acid', factor: 1 },
      { name: '氢氧化钠', type: 'base', factor: 1 }
    ],
    'khco3': [
      { name: '碳酸', type: 'acid', factor: 1 },
      { name: '氢氧化钾', type: 'base', factor: 1 }
    ],
    'ch3coona': [
      { name: '乙酸', type: 'acid', factor: 1 },
      { name: '氢氧化钠', type: 'base', factor: 1 }
    ],
    'naac': [
      { name: '乙酸', type: 'acid', factor: 1 },
      { name: '氢氧化钠', type: 'base', factor: 1 }
    ],
    'kac': [
      { name: '乙酸', type: 'acid', factor: 1 },
      { name: '氢氧化钾', type: 'base', factor: 1 }
    ],
    'na2s': [
      { name: '硫化氢', formula: 'H2S', type: 'acid', factor: 1 },
      { name: '氢氧化钠', type: 'base', factor: 2 }
    ],
    'nacn': [
      { name: '氢氰酸', type: 'acid', factor: 1 },
      { name: '氢氧化钠', type: 'base', factor: 1 }
    ],
    'nh4cl': [
      { name: '氨水', type: 'base', factor: 1 },
      { name: '盐酸', type: 'acid', factor: 1 }
    ],
    'nh4br': [
      { name: '氨水', type: 'base', factor: 1 },
      { name: '氢溴酸', type: 'acid', factor: 1 }
    ],
    'nh4i': [
      { name: '氨水', type: 'base', factor: 1 },
      { name: '氢碘酸', type: 'acid', factor: 1 }
    ],
    'nh4no3': [
      { name: '氨水', type: 'base', factor: 1 },
      { name: '硝酸', type: 'acid', factor: 1 }
    ],
    'nh4hso4': [
      { name: '氨水', type: 'base', factor: 1 },
      { name: '硫酸', type: 'acid', factor: 1 }
    ],
    '(nh4)2so4': [
      { name: '氨水', type: 'base', factor: 2 },
      { name: '硫酸', type: 'acid', factor: 1 }
    ],
    'nh42so4': [
      { name: '氨水', type: 'base', factor: 2 },
      { name: '硫酸', type: 'acid', factor: 1 }
    ],
    'ch3coonh4': [
      { name: '乙酸', type: 'acid', factor: 1 },
      { name: '氨水', type: 'base', factor: 1 }
    ],
    'nh4ac': [
      { name: '乙酸', type: 'acid', factor: 1 },
      { name: '氨水', type: 'base', factor: 1 }
    ]
  };

  const SALT_NAME_MAP = {
    '碳酸钠': 'na2co3', '碳酸钾': 'k2co3',
    '碳酸氢钠': 'nahco3', '碳酸氢钾': 'khco3',
    '乙酸钠': 'naac', '醋酸钠': 'naac',
    '乙酸钾': 'kac', '醋酸钾': 'kac',
    '硫化钠': 'na2s',
    '氰化钠': 'nacn',
    '氯化铵': 'nh4cl',
    '溴化铵': 'nh4br',
    '碘化铵': 'nh4i',
    '硝酸铵': 'nh4no3',
    '硫酸氢铵': 'nh4hso4',
    '硫酸铵': '(nh4)2so4',
    '乙酸铵': 'nh4ac', '醋酸铵': 'nh4ac'
  };

  function resolveSaltKey(name, formula) {
    const keyFromFormula = normalizeFormula(formula || name);
    if (SALT_DECOMPOSITION[keyFromFormula]) return keyFromFormula;
    const plain = normalizeFormula(name);
    if (SALT_DECOMPOSITION[plain]) return plain;
    const zh = SALT_NAME_MAP[String(name || formula || '').trim()];
    if (zh && SALT_DECOMPOSITION[zh]) return zh;
    return null;
  }

  function expandSaltComponent(comp) {
    const key = resolveSaltKey(comp.name, comp.formula);
    if (!key) return null;
    const baseConc = Number.isFinite(comp.concentration) ? comp.concentration : 0.1;
    return SALT_DECOMPOSITION[key].map(p => {
      const out = {
        name: p.name,
        type: p.type,
        concentration: baseConc * p.factor
      };
      if (p.formula) out.formula = p.formula;
      return out;
    });
  }

  function findPreset(comp) {
    if (!window.AcidBaseDB || !window.AcidBaseDB.presetAcidsBases) return null;
    const list = window.AcidBaseDB.presetAcidsBases;
    const inputName = normalizeName(comp.name);
    const inputFormula = normalizeFormula(comp.formula || comp.name);
    // exact name
    let found = list.find(p => normalizeName(p.name) === inputName || normalizeName(p.formula) === inputName);
    if (found) return found;
    // formula exact/sub（inputFormula 为空时跳过，避免中文名称被错误匹配到第一个 preset）
    if (inputFormula) {
      found = list.find(p => {
        const pf = normalizeFormula(p.formula);
        return pf && (pf === inputFormula || inputFormula.includes(pf) || pf.includes(inputFormula));
      });
      if (found) return found;
    }
    // includes
    found = list.find(p => {
      const n = normalizeName(p.name);
      return n && (inputName.includes(n) || n.includes(inputName));
    });
    return found || null;
  }

  function toTypeValue(isStrong, type) {
    return `${isStrong ? 'strong' : 'weak'}-${type}`;
  }

  function createKValueItem(value, index) {
    const item = document.createElement('div');
    item.className = 'k-value-item';
    item.innerHTML = `
      <div class="k-value-label">
        <span>K${index + 1}</span>
        <button class="remove-k-btn" onclick="removeKValue(this)">×</button>
      </div>
      <div class="k-value-inputs">
        <input type="number" class="k-number-input" value="${value}" step="0.01" min="0" max="14" onchange="syncSlider(this); applyAutoMaxVolumeIfNeeded();">
        <input type="range" class="k-slider" value="${value}" min="0" max="14" step="0.01" oninput="syncInput(this); applyAutoMaxVolumeIfNeeded();">
      </div>
    `;
    return item;
  }

  function buildComponentElement(comp, isTitrant) {
    const preset = findPreset(comp);
    const type = (comp.type === 'base' ? 'base' : 'acid');
    const isStrong = preset ? preset.isStrong : !!comp.isStrong;
    const valence = Number.isFinite(comp.valence) ? comp.valence : (preset && preset.valence ? preset.valence : 1);
    const displayName = preset ? (preset.name) : (comp.name || t('自定义酸碱', 'Custom acid/base'));
    let kValues = [];
    if (!isStrong) {
      if (preset) {
        kValues = type === 'acid' ? (preset.pKa || []) : (preset.pKb || []);
      } else if (Array.isArray(comp.kValues) && comp.kValues.length) {
        kValues = comp.kValues.map(v => Number(v)).filter(Number.isFinite);
      }
      if (!kValues.length) kValues = [type === 'acid' ? 4.76 : 4.75];
    }

    const item = document.createElement('div');
    item.className = 'mixture-item';
    item.dataset.type = type;
    item.dataset.name = displayName;
    item.dataset.displayName = preset && preset.formula ? preset.formula : displayName;
    item.dataset.nameZh = displayName;
    item.dataset.nameEn = preset && preset.nameEn ? preset.nameEn : (preset && preset.formula ? preset.formula : displayName);
    if (isStrong) item.dataset.valence = valence;

    const typeValue = toTypeValue(isStrong, type);
    const conc = Number.isFinite(comp.concentration) ? comp.concentration : 0.1;

    item.innerHTML = `
      <div class="mixture-header">
        <span class="mixture-title">${displayName}</span>
        <button class="remove-mixture-btn" onclick="removeComponent(this, ${isTitrant})">×</button>
      </div>
      <div class="form-group component-type-select">
        <select class="component-type small-input" onchange="updateComponentType(this, ${isTitrant})">
          <option value="strong-acid" ${typeValue === 'strong-acid' ? 'selected' : ''} data-i18n="strong_acid">强酸</option>
          <option value="weak-acid" ${typeValue === 'weak-acid' ? 'selected' : ''} data-i18n="weak_acid">弱酸</option>
          <option value="strong-base" ${typeValue === 'strong-base' ? 'selected' : ''} data-i18n="strong_base">强碱</option>
          <option value="weak-base" ${typeValue === 'weak-base' ? 'selected' : ''} data-i18n="weak_base">弱碱</option>
        </select>
      </div>
      <div class="form-group">
        <label data-i18n="concentration_label">浓度 (mol/L)</label>
        <input type="number" class="component-conc small-input" value="${conc}" step="0.01" min="0.0001" oninput="applyAutoMaxVolumeIfNeeded();">
      </div>
      <div class="form-group valence-group" style="${isStrong ? '' : 'display: none;'}">
        <label data-i18n="valence_label">元数</label>
        <input type="number" class="component-valence small-input" value="${valence}" step="1" min="1" oninput="applyAutoMaxVolumeIfNeeded();">
      </div>
      <div class="k-values-section" style="${isStrong ? 'display: none;' : ''}">
        <label data-i18n="${type === 'acid' ? 'pka_label' : 'pkb_label'}">电离常数 (p${type === 'acid' ? 'Ka' : 'Kb'})</label>
        <div class="k-values-container"></div>
        <button class="add-k-btn" onclick="addKValue(this)" data-i18n="add_dissociation_level">+ 添加电离级数</button>
      </div>
    `;

    if (!isStrong) {
      const container = item.querySelector('.k-values-container');
      kValues.forEach((v, i) => container.appendChild(createKValueItem(Number(v).toFixed(2), i)));
    }

    return item;
  }

  function setTitrationType(type) {
    const valid = type === 'base-acid' ? 'base-acid' : 'acid-base';
    if (config.titrationType === valid) return;
    const btn = document.querySelector(`.toggle-btn[data-type="${valid}"]`);
    if (btn) btn.click();
  }

  function resetComponentContainers() {
    document.getElementById('solutionComponents').innerHTML = '';
    document.getElementById('titrantComponents').innerHTML = '';
    solutionComponentCount = 0;
    titrantComponentCount = 0;
  }

  function applyAiConfig(cfg) {
    if (!cfg || typeof cfg !== 'object') throw new Error('配置为空');
    setTitrationType(cfg.titrationType);
    resetComponentContainers();

    const solutionContainer = document.getElementById('solutionComponents');
    const titrantContainer = document.getElementById('titrantComponents');

    const sol = cfg.solution || {};
    const solComps = Array.isArray(sol.components) ? sol.components : [];
    solComps.forEach(comp => {
      const expanded = expandSaltComponent(comp);
      const list = expanded || [comp];
      list.forEach(c => {
        solutionComponentCount++;
        solutionContainer.appendChild(buildComponentElement(c, false));
      });
    });

    const titComps = Array.isArray((cfg.titrant || {}).components) ? cfg.titrant.components : [];
    titComps.forEach(comp => {
      const expanded = expandSaltComponent(comp);
      const list = expanded || [comp];
      list.forEach(c => {
        titrantComponentCount++;
        titrantContainer.appendChild(buildComponentElement(c, true));
      });
    });

    const initialVol = document.getElementById('initialVol');
    if (initialVol && Number.isFinite(sol.V0)) initialVol.value = sol.V0;

    const maxVolumeInput = document.getElementById('maxVolume');
    const autoMaxToggle = document.getElementById('autoMaxVolumeToggle');
    if (autoMaxToggle) autoMaxToggle.checked = true;
    if (maxVolumeInput && Number.isFinite(cfg.maxVolume)) {
      maxVolumeInput.value = cfg.maxVolume;
    }

    const sampleSlider = document.getElementById('sampleDensitySlider');
    const sliderBubble = document.getElementById('sliderBubble');
    if (sampleSlider && Number.isFinite(cfg.sampleCount)) {
      const val = Math.max(200, Math.min(2000, Math.round(cfg.sampleCount)));
      sampleSlider.value = val;
      if (sliderBubble) sliderBubble.textContent = val + t('点', ' points');
      updateSliderBubble();
    }

    const curveColor = document.getElementById('curveColor');
    if (curveColor && cfg.curveColor) curveColor.value = cfg.curveColor;

    updateCurveNameFromComponents();
    applyAutoMaxVolumeIfNeeded();

    const curveName = document.getElementById('curveName');
    if (curveName && cfg.curveName) {
      curveName.value = cfg.curveName;
      config.curveName = cfg.curveName;
    }

    generateCurve();
    // generateCurve 内部通过 setTimeout(100ms) 异步重算并会把曲线样式重置为默认值，
    // 因此返回 Promise，等待其完成后再应用历史保存的样式覆盖
    return new Promise(resolve => setTimeout(resolve, 220));
  }

  function buildSystemPrompt() {
    return `你是一名化学助教，专门把用户的酸碱滴定描述解析成可直接用于计算的结构化配置。\n` +
      `请只输出合法 JSON，不要输出任何解释、markdown 代码块或推理过程。\n` +
      `输出格式必须如下：\n` +
      `{\n` +
      `  "titrationType": "acid-base" | "base-acid",\n` +
      `  "solution": {\n` +
      `    "V0": 待测液体积 mL（数字，默认 20）,\n` +
      `    "components": [\n` +
      `      {\n` +
      `        "name": "试剂中文名、化学式或自定义名称",\n` +
      `        "type": "acid" | "base",\n` +
      `        "isStrong": true | false,\n` +
      `        "concentration": 物质的量浓度 mol/L（数字，默认 0.1）,\n` +
      `        "valence": 强酸/强碱的可解离/可接受质子数（数字，默认 1）,\n` +
      `        "kValues": 弱酸填 pKa 数组，弱碱填 pKb 数组（强酸碱为空数组）\n` +
      `      }\n` +
      `    ]\n` +
      `  },\n` +
      `  "titrant": {\n` +
      `    "components": [同上]\n` +
      `  },\n` +
      `  "maxVolume": 最大滴定体积 mL（数字，默认 100）,\n` +
      `  "sampleCount": 采样点数（整数，默认 500）,\n` +
      `  "curveColor": 曲线颜色十六进制（默认 "#57a7bd"）,\n` +
      `  "curveName": "曲线名称"\n` +
      `}\n` +
      `规则：\n` +
      `1. titrationType：酸滴入碱中为 acid-base；碱滴入酸中为 base-acid。\n` +
      `2. 若描述不完整或模糊，请自行补充合理且常见的参数（如未给浓度默认 0.1 mol/L，未给体积默认 20 mL），不要反问用户；但用户给出的物种名称必须保留，严禁擅自替换为盐酸、氢氧化钠、乙酸等“默认常见物质”。\n` +
      `3. 待测液与滴定剂的对应关系必须严格按用户描述：用户说“氢氧化钠滴定某酸”时，solution 中必须是该酸、titrant 中必须是氢氧化钠，禁止把待测液中的酸换成盐酸或进行其他默认替换。\n` +
      `4. 若题目只给质量、体积、纯度等，请先换算成物质的量浓度。\n` +
      `5. 弱酸请给出各级 pKa；弱碱请给出各级 pKb。数值尽量采用标准文献值；对于数据库外的有机酸/碱（如葡萄糖酸、乳酸等），请自行给出合理的 pKa/pKb 估计值，不要因不熟悉而替换为已知酸碱。\n` +
      `6. 若待测液或滴定剂是混合溶液（例如盐酸和乙酸的混合酸），请拆分为多个 component。\n` +
      `7. 若待测液或滴定剂是盐溶液，请自动将其拆解为对应酸和碱的组合，而不是直接输出盐。拆解规则：弱酸强碱盐 = 该弱酸 + 强碱（按盐中酸碱物质的量比，如 Na2CO3 → H2CO3 + 2 NaOH）；强酸弱碱盐 = 强酸 + 该弱碱（如 NH4Cl → HCl + NH3）；弱酸弱碱盐 = 弱酸 + 弱碱（如 NH4Ac → CH3COOH + NH3）。\n` +
      `8. 对于任何弱酸/弱碱 component（包括盐溶液拆解后得到的弱酸或弱碱），都必须在 kValues 中给出其各级 pKa/pKb；即使该物质看起来在常见数据库中，也不要留空让前端猜测。若试剂不在数据库中（自定义酸碱），请直接给出 name、type、isStrong 以及合理的 pKa/pKb；绝对禁止因为没有匹配 preset 就把物质改成盐酸、氢氧化钠或乙酸。\n` +
      `9. 对于自定义多元酸（如 H2A、H3A），请列出每一级 pKa；对于自定义多元碱，请列出每一级 pKb。\n` +
      `10. 若未指定最大滴定体积，请按滴定当量估算并输出一个合适的 maxVolume（通常为完全滴定体积的 1.2~1.5 倍）。\n` +
      `11. 若未指定颜色，请根据滴定方向选一个合适颜色。\n` +
      `12. 输出必须严格是 JSON，不要包含注释、markdown、多余文字。\n` +
      `示例 1（弱酸滴定）：\n` +
      `{ "titrationType": "base-acid", "solution": { "V0": 20, "components": [{ "name": "乙酸", "type": "acid", "isStrong": false, "concentration": 0.1, "valence": 1, "kValues": [4.76] }] }, "titrant": { "components": [{ "name": "氢氧化钠", "type": "base", "isStrong": true, "concentration": 0.1, "valence": 1, "kValues": [] }] }, "maxVolume": 40, "sampleCount": 500, "curveColor": "#57a7bd", "curveName": "NaOH滴定乙酸" }\n` +
      `示例 2（混合酸滴定）：\n` +
      `{ "titrationType": "base-acid", "solution": { "V0": 25, "components": [{ "name": "盐酸", "type": "acid", "isStrong": true, "concentration": 0.05, "valence": 1, "kValues": [] }, { "name": "乙酸", "type": "acid", "isStrong": false, "concentration": 0.05, "valence": 1, "kValues": [4.76] }] }, "titrant": { "components": [{ "name": "氢氧化钠", "type": "base", "isStrong": true, "concentration": 0.1, "valence": 1, "kValues": [] }] }, "maxVolume": 50, "sampleCount": 500, "curveColor": "#7c3aed", "curveName": "NaOH滴定HCl+乙酸混合酸" }\n` +
      `示例 3（盐溶液滴定，碳酸钠用盐酸滴定）：\n` +
      `{ "titrationType": "acid-base", "solution": { "V0": 25, "components": [{ "name": "碳酸", "type": "acid", "isStrong": false, "concentration": 0.1, "valence": 1, "kValues": [6.35, 10.33] }, { "name": "氢氧化钠", "type": "base", "isStrong": true, "concentration": 0.2, "valence": 1, "kValues": [] }] }, "titrant": { "components": [{ "name": "盐酸", "type": "acid", "isStrong": true, "concentration": 0.1, "valence": 1, "kValues": [] }] }, "maxVolume": 80, "sampleCount": 500, "curveColor": "#059669", "curveName": "盐酸滴定碳酸钠" }\n` +
      `示例 4（盐溶液滴定，硫化钠用盐酸滴定，硫化氢的 pKa 由 AI 补全）：\n` +
      `{ "titrationType": "acid-base", "solution": { "V0": 25, "components": [{ "name": "硫化氢", "type": "acid", "isStrong": false, "concentration": 0.1, "valence": 1, "kValues": [6.99, 12.92] }, { "name": "氢氧化钠", "type": "base", "isStrong": true, "concentration": 0.2, "valence": 1, "kValues": [] }] }, "titrant": { "components": [{ "name": "盐酸", "type": "acid", "isStrong": true, "concentration": 0.1, "valence": 1, "kValues": [] }] }, "maxVolume": 80, "sampleCount": 500, "curveColor": "#b45309", "curveName": "盐酸滴定硫化钠" }\n` +
      `示例 5（数据库外的自定义酸，保留原名并自行补全 pKa）：\n` +
      `{ "titrationType": "base-acid", "solution": { "V0": 20, "components": [{ "name": "葡萄糖酸", "type": "acid", "isStrong": false, "concentration": 0.1, "valence": 1, "kValues": [3.7] }] }, "titrant": { "components": [{ "name": "氢氧化钠", "type": "base", "isStrong": true, "concentration": 0.1, "valence": 1, "kValues": [] }] }, "maxVolume": 40, "sampleCount": 500, "curveColor": "#7c3aed", "curveName": "NaOH滴定葡萄糖酸" }`;
  }

  async function requestAiConfig(text) {
    const content = await window.AiApi.call(buildSystemPrompt(), text);
    return {
      raw: content,
      config: window.AiApi.parseModelJson(content)
    };
  }

  function setStatus(el, msg, isError) {
    el.textContent = msg;
    el.className = 'ai-status ' + (isError ? 'ai-status-error' : 'ai-status-info');
  }

  const HISTORY_KEY = 'titrationAiHistory';
  const MAX_HISTORY = 20;

  let currentHistoryId = null;
  let currentHistoryTab = null; // 当前历史条目对应的曲线标签页，防止把其他曲线的样式写入历史
  let styleUpdateTimer = null;
  const STYLE_ROLES = ['single-curve-color', 'line-style-select', 'point-style-select', 'curve-thickness', 'thickness-number', 'chart-width', 'chart-aspect'];

  function genHistoryId() {
    return `aih_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function loadHistory() {
    try {
      const list = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      let changed = false;
      list.forEach(item => {
        if (item && !item.id) { item.id = genHistoryId(); changed = true; }
      });
      if (changed) localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)));
      return list;
    } catch (e) {
      return [];
    }
  }

  function saveHistory(list) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)));
  }

  function formatTime(ts) {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function getConfigSummary(cfg) {
    if (!cfg) return '';
    const sol = (cfg.solution && cfg.solution.components || []).map(c => c.name).join('+') || t('待测液', 'Solution');
    const tit = (cfg.titrant && cfg.titrant.components || []).map(c => c.name).join('+') || t('滴定剂', 'Titrant');
    return `${tit} → ${sol}`;
  }

  function renderHistory(textarea, statusEl) {
    const listEl = document.getElementById('aiHistoryList');
    if (!listEl) return;
    const list = loadHistory();
    if (!list.length) {
      listEl.innerHTML = `<div class="ai-history-empty">${t('暂无历史任务', 'No history')}</div>`;
      return;
    }
    listEl.innerHTML = '';
    list.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = 'ai-history-item';
      div.innerHTML = `
        <div class="ai-history-text">${escapeHtml(item.text)}</div>
        <div class="ai-history-meta">
          <span>${escapeHtml(item.summary || '')} · ${formatTime(item.timestamp)}</span>
          <button class="ai-history-delete" data-index="${index}">${t('删除', 'Del')}</button>
        </div>
      `;
      div.addEventListener('click', (e) => {
        if (e.target.classList.contains('ai-history-delete')) return;
        if (textarea) textarea.value = item.text;
        if (item.config) {
          try {
            const ready = applyAiConfig(item.config);
            // 等待 generateCurve 异步完成（它会重置样式）后再应用保存的样式覆盖
            Promise.resolve(ready).then(() => {
              applyStyleOverrides(item.config.styleOverrides);
              currentHistoryId = item.id || null;
              currentHistoryTab = (typeof getActiveTab === 'function') ? getActiveTab() : null;
              if (statusEl) setStatus(statusEl, t('已加载历史配置并生成曲线', 'History config loaded and curve generated'), false);
            }).catch(err => {
              console.error(err);
              if (statusEl) setStatus(statusEl, t('应用历史样式失败：', 'Failed to apply history style: ') + err.message, true);
            });
          } catch (err) {
            console.error(err);
            if (statusEl) setStatus(statusEl, t('加载历史配置失败：', 'Failed to load history config: ') + err.message, true);
          }
        }
      });
      const delBtn = div.querySelector('.ai-history-delete');
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cur = loadHistory();
        cur.splice(index, 1);
        saveHistory(cur);
        renderHistory(textarea, statusEl);
      });
      listEl.appendChild(div);
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function addHistory(text, cfg) {
    const list = loadHistory();
    const entry = {
      id: genHistoryId(),
      text,
      summary: getConfigSummary(cfg),
      timestamp: Date.now(),
      config: cfg || null
    };
    list.unshift(entry);
    // 同一配置重复生成时更新时间而非堆叠记录
    const dedupIdx = list.findIndex((item, i) => i > 0 && item.text === text);
    if (dedupIdx > 0) {
      list.splice(dedupIdx, 1);
    }
    saveHistory(list);
    return entry.id;
  }

  // ===== 样式跟随：把当前曲线样式（手工/AI 修改）同步到当前历史条目 =====
  function captureCurrentStyle() {
    const tab = (typeof getActiveTab === 'function') ? getActiveTab() : null;
    const pane = (tab && typeof getTabContent === 'function') ? getTabContent(tab) : null;
    const style = {};
    if (tab) {
      if (tab.curveLineStyle) style.lineStyle = tab.curveLineStyle;
      if (tab.curvePointStyle) style.pointStyle = tab.curvePointStyle;
      if (Number.isFinite(tab.curveBorderWidth)) style.borderWidth = tab.curveBorderWidth;
    }
    const colorInput = pane ? pane.querySelector('[data-role="single-curve-color"]') : null;
    if (colorInput && colorInput.value) style.color = colorInput.value;
    // 比例优先：用户选定宽高比时保存比例值（跨窗口尺寸可还原），
    // 仅在比例为 auto 且手动填写了宽度时才保存像素宽度
    const aspectSelect = pane ? pane.querySelector('[data-role="chart-aspect"]') : null;
    if (aspectSelect && aspectSelect.value && aspectSelect.value !== 'auto') {
      style.aspectRatio = aspectSelect.value;
    } else {
      const widthInput = pane ? pane.querySelector('[data-role="chart-width"]') : null;
      if (widthInput && widthInput.value !== '' && Number.isFinite(parseFloat(widthInput.value))) {
        style.chartWidth = parseFloat(widthInput.value);
      }
    }
    return style;
  }

  window.updateAiHistoryStyle = function () {
    if (!currentHistoryId) return;
    const activeTab = (typeof getActiveTab === 'function') ? getActiveTab() : null;
    if (!activeTab || activeTab !== currentHistoryTab) return;
    const list = loadHistory();
    const entry = list.find(item => item && item.id === currentHistoryId);
    if (!entry || !entry.config) return;
    const style = captureCurrentStyle();
    if (style && Object.keys(style).length) {
      entry.config.styleOverrides = style;
      saveHistory(list);
    }
  };

  function scheduleUpdateAiHistoryStyle() {
    clearTimeout(styleUpdateTimer);
    styleUpdateTimer = setTimeout(() => {
      window.updateAiHistoryStyle();
    }, 250);
  }

  function bindStyleChangeListeners() {
    ['input', 'change'].forEach(evt => {
      document.addEventListener(evt, (e) => {
        const el = e.target;
        if (!el || !el.dataset) return;
        if (!STYLE_ROLES.includes(el.dataset.role)) return;
        scheduleUpdateAiHistoryStyle();
      });
    });
  }

  function applyStyleOverrides(ov) {
    if (!ov || typeof ov !== 'object') return;
    const tab = (typeof getActiveTab === 'function') ? getActiveTab() : null;
    if (!tab) return;
    const pane = (typeof getTabContent === 'function') ? getTabContent(tab) : null;
    if (ov.color && /^#[0-9a-fA-F]{3,8}$/.test(ov.color)) {
      config.curveColor = ov.color;
      const rootInput = document.getElementById('curveColor');
      if (rootInput) rootInput.value = ov.color;
      const colorInput = pane ? pane.querySelector('[data-role="single-curve-color"]') : null;
      if (colorInput) colorInput.value = ov.color;
      if (tab.type === 'single' && Array.isArray(tab.volumes) && tab.volumes.length) {
        updateChart(tab, tab.volumes, tab.phs, ov.color);
      }
    }
    if (ov.lineStyle) {
      tab.curveLineStyle = ov.lineStyle;
      const sel = pane ? pane.querySelector('[data-role="line-style-select"]') : null;
      if (sel) sel.value = ov.lineStyle;
    }
    if (ov.pointStyle) {
      tab.curvePointStyle = ov.pointStyle;
      const sel = pane ? pane.querySelector('[data-role="point-style-select"]') : null;
      if (sel) sel.value = ov.pointStyle;
    }
    if (Number.isFinite(ov.borderWidth) && ov.borderWidth > 0) {
      tab.curveBorderWidth = ov.borderWidth;
      const slider = pane ? pane.querySelector('[data-role="curve-thickness"]') : null;
      const num = pane ? pane.querySelector('[data-role="thickness-number"]') : null;
      if (slider) slider.value = ov.borderWidth;
      if (num) num.value = ov.borderWidth;
    }
    if (typeof renderActiveTabChart === 'function') renderActiveTabChart();
    if (typeof refreshTabAnnotations === 'function') refreshTabAnnotations(tab);
    if (Number.isFinite(ov.chartWidth) && ov.chartWidth > 0) {
      const widthInput = pane ? pane.querySelector('[data-role="chart-width"]') : null;
      if (widthInput) widthInput.value = ov.chartWidth;
      if (typeof applyChartWidth === 'function') applyChartWidth(tab, ov.chartWidth);
    } else if (ov.aspectRatio && ov.aspectRatio !== 'auto') {
      const aspectSelect = pane ? pane.querySelector('[data-role="chart-aspect"]') : null;
      if (aspectSelect) aspectSelect.value = ov.aspectRatio;
      if (typeof applyChartAspectRatio === 'function') applyChartAspectRatio(tab, ov.aspectRatio);
    }
  }

  // ===== 通用拖拽：支持悬浮球与悬浮窗 =====
  function makeDraggable(el, handle, opts) {
    let dragging = false;
    let moved = false;
    let startX = 0, startY = 0, startLeft = 0, startTop = 0;

    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      if (opts && opts.exclude && e.target.closest && e.target.closest(opts.exclude)) return;
      dragging = true;
      moved = false;
      const rect = el.getBoundingClientRect();
      // 将 right/bottom 定位转换为 left/top，便于自由拖动
      el.style.left = rect.left + 'px';
      el.style.top = rect.top + 'px';
      el.style.right = 'auto';
      el.style.bottom = 'auto';
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      try { handle.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      e.preventDefault();
    });

    handle.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const maxLeft = Math.max(0, window.innerWidth - w);
      const maxTop = Math.max(0, window.innerHeight - Math.min(h, 64));
      const newLeft = Math.min(Math.max(0, startLeft + dx), maxLeft);
      const newTop = Math.min(Math.max(0, startTop + dy), maxTop);
      el.style.left = newLeft + 'px';
      el.style.top = newTop + 'px';
    });

    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      try { handle.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (!moved && opts && typeof opts.onClick === 'function') {
        opts.onClick(e);
      }
    }

    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', () => { dragging = false; });
  }

  function initAiPanel() {
    const btn = document.getElementById('aiConfigBtn');
    const textarea = document.getElementById('aiConfigInput');
    const status = document.getElementById('aiConfigStatus');
    const floatBtn = document.getElementById('aiFloatBtn');
    const panel = document.getElementById('aiPanel');
    const panelHeader = document.getElementById('aiPanelHeader');
    const closeBtn = document.getElementById('aiPanelClose');
    const clearBtn = document.getElementById('aiHistoryClear');
    const modelSelect = document.getElementById('aiModelSelect');

    if (!btn || !textarea || !status || !floatBtn || !panel) return;

    function togglePanel() { panel.classList.toggle('open'); }
    function openPanel() { panel.classList.add('open'); }
    function closePanel() { panel.classList.remove('open'); }

    if (closeBtn) closeBtn.addEventListener('click', closePanel);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closePanel();
    });

    // 包装 generateCurve：手动重新生成曲线时解除与智能配置历史的样式关联，
    // 避免把其他曲线的样式写入历史条目（AI 配置流程会在生成后重新建立关联）
    if (typeof window.generateCurve === 'function') {
      const originalGenerateCurve = window.generateCurve;
      window.generateCurve = function () {
        currentHistoryId = null;
        currentHistoryTab = null;
        return originalGenerateCurve.apply(this, arguments);
      };
      const genBtn = document.getElementById('generateBtn');
      if (genBtn) genBtn.onclick = window.generateCurve;
    }

    // ===== 模型切换 =====
    if (modelSelect && window.AiApi) {
      // 选项与 AiApi.MODELS 保持同步：优先动态渲染，避免多处硬编码
      if (Array.isArray(window.AiApi.MODELS) && window.AiApi.MODELS.length) {
        modelSelect.innerHTML = window.AiApi.MODELS
          .map(m => `<option value="${m.id}">${m.label}</option>`)
          .join('');
      }
      modelSelect.value = window.AiApi.getSelectedModel().id;
      modelSelect.addEventListener('change', () => {
        window.AiApi.setSelectedModel(modelSelect.value);
        const m = window.AiApi.getSelectedModel();
        setStatus(status, t(`已切换模型：${m.label}`, `Model switched to ${m.label}`), false);
      });
    }

    // ===== 悬浮球与悬浮窗拖动 =====
    makeDraggable(floatBtn, floatBtn, { onClick: togglePanel });
    if (panelHeader) {
      makeDraggable(panel, panelHeader, { exclude: 'button, select, input, textarea, .ai-header-actions' });
    }

    document.querySelectorAll('.ai-tab').forEach(tabBtn => {
      tabBtn.addEventListener('click', () => {
        document.querySelectorAll('.ai-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.ai-tab-content').forEach(c => c.classList.remove('active'));
        tabBtn.classList.add('active');
        const key = tabBtn.dataset.aiTab;
        const content = document.querySelector(`.ai-tab-content[data-ai-content="${key}"]`);
        if (content) content.classList.add('active');
      });
    });

    renderHistory(textarea, status);
    bindStyleChangeListeners();

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        saveHistory([]);
        currentHistoryId = null;
        renderHistory(textarea, status);
      });
    }

    btn.addEventListener('click', async () => {
      const text = textarea.value.trim();
      if (!text) {
        setStatus(status, t('请输入题目或要求', 'Please enter a problem or request'), true);
        return;
      }
      btn.disabled = true;
      const modelLabel = (window.AiApi && window.AiApi.getSelectedModel().label) || 'AI';
      setStatus(status, t(`AI (${modelLabel}) 正在解析配置...`, `AI (${modelLabel}) is parsing configuration...`), false);
      try {
        const data = await requestAiConfig(text);
        if (!data.config) throw new Error('AI 没有返回有效 JSON');
        if (data.config.styleOverrides) delete data.config.styleOverrides;
        await applyAiConfig(data.config);
        currentHistoryId = addHistory(text, data.config);
        currentHistoryTab = (typeof getActiveTab === 'function') ? getActiveTab() : null;
        renderHistory(textarea, status);
        setStatus(status, t('配置已应用并生成曲线', 'Configuration applied and curve generated'), false);
        closePanel();
      } catch (err) {
        console.error(err);
        setStatus(status, t('解析失败：', 'Parse failed: ') + err.message, true);
      } finally {
        btn.disabled = false;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', initAiPanel);
})();
