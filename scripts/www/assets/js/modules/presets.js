function openPresetModal() {
    // v7.0.1: 打开预设面板时，自动同步"添加到待滴定溶液/滴定剂"的激活状态
    document.querySelectorAll('.mode-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.mode === currentAddMode);
    });
    document.getElementById('presetModal').classList.add('active');
    renderPresetList('');
}
function closePresetModal() {
    document.getElementById('presetModal').classList.remove('active');
}
function normalizeSearchText(text) {
    const map = {
        '₀': '0',
        '₁': '1',
        '₂': '2',
        '₃': '3',
        '₄': '4',
        '₅': '5',
        '₆': '6',
        '₇': '7',
        '₈': '8',
        '₉': '9'
    };
    return (text || '')
        .toLowerCase()
        .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (m) => map[m] || m)
        .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '');
}
function getPresetDisplayName(preset) {
    if (!preset) return '';
    if (uiLanguage === 'zh') return preset.name || '';
    return preset.nameEn || preset.formula || preset.name || '';
}
function renderPresetList(searchTerm = '') {
    const list = document.getElementById('presetList');
    list.innerHTML = '';
    const isAcidTitratingBase = config.titrationType === 'acid-base';
    const targetType = currentAddMode === 'solution' ?
        (isAcidTitratingBase ? 'base' : 'acid') :
        (isAcidTitratingBase ? 'acid' : 'base');
    const normalizedSearch = normalizeSearchText(searchTerm);
    const blankTemplate = document.createElement('div');
    blankTemplate.className = 'preset-item blank-template';
    blankTemplate.innerHTML = `
        <div>
            <span class="preset-name" data-i18n="blank_template">空白模板</span>
            <span class="preset-formula" data-i18n="custom_parameters">自定义参数</span>
        </div>
        <div>
            <span style="font-size: 0.8rem; color: var(--accent-primary); font-weight: 600;" data-i18n="manual_setup">手动设置</span>
        </div>
    `;
    blankTemplate.onclick = () => addBlankTemplate();
    list.appendChild(blankTemplate);
    let filtered = presetAcidsBases.filter(item => {
        const nameText = normalizeSearchText(item.name);
        const formulaText = normalizeSearchText(item.formula);
        const matchesSearch = normalizedSearch === '' ||
            nameText.includes(normalizedSearch) ||
            formulaText.includes(normalizedSearch);
        const matchesType = currentPresetFilter === 'all' || item.type === currentPresetFilter;
        // v7.0.1: 移除根据滴定方向对预设酸碱的强制过滤，待测液与滴定剂均允许选择任意酸或碱
        return matchesSearch && matchesType;
    });
    if (filtered.length === 0) {
        list.innerHTML += '<div class="empty-result" data-i18n="no_matching_presets">未找到匹配的酸碱</div>';
        return;
    }
    filtered.forEach(item => {
        const div = document.createElement('div');
        div.className = 'preset-item';
        const displayName = getPresetDisplayName(item);
        div.innerHTML = `
            <div>
                <span class="preset-name">${displayName}</span>
                <span class="preset-formula">${item.formula}</span>
            </div>
            <div>
                ${item.type === 'acid' ?
                    (item.isStrong ?
                        '<span class="preset-pka" data-i18n="strong_acid">强酸</span>' :
                        `<span class="preset-pka">pKa: ${item.pKa.join(', ')}</span>`)
                    :
                    (item.isStrong ?
                        '<span class="preset-kb" data-i18n="strong_base">强碱</span>' :
                        `<span class="preset-kb">pKb: ${item.pKb.join(', ')}</span>`)
                }
            </div>
        `;
        div.onclick = () => addPresetToComponent(item);
        list.appendChild(div);
    });
    if (typeof translateStaticUI === 'function') translateStaticUI();
}
function addBlankTemplate() {
    const containerId = currentAddMode === 'solution' ? 'solutionComponents' : 'titrantComponents';
    const container = document.getElementById(containerId);
    const isAcidTitratingBase = config.titrationType === 'acid-base';
    const count = currentAddMode === 'solution' ? ++solutionComponentCount : ++titrantComponentCount;
    const targetType = currentAddMode === 'solution' ?
        (isAcidTitratingBase ? 'base' : 'acid') :
        (isAcidTitratingBase ? 'acid' : 'base');
    const item = document.createElement('div');
    item.className = 'mixture-item';
    item.dataset.id = count;
    item.dataset.type = targetType;
    item.dataset.name = t('自定义酸碱', 'Custom acid/base');
    item.dataset.displayName = t('自定义酸碱', 'Custom acid/base');
    // v7.0.1: 空白模板亦展示完整的酸/碱 4 选项，便于在同一容器混合添加
    item.innerHTML = `
        <div class="mixture-header">
            <span class="mixture-title" data-i18n="custom_acid_base">自定义酸碱</span>
            <button class="remove-mixture-btn" onclick="removeComponent(this, ${currentAddMode === 'titrant'})">×</button>
        </div>
        <div class="form-group component-type-select">
            <select class="component-type small-input" onchange="updateComponentType(this, ${currentAddMode === 'titrant'})">
                <option value="strong-acid" ${targetType === 'acid' ? '' : ''} data-i18n="strong_acid">强酸</option>
                <option value="weak-acid" ${targetType === 'acid' ? 'selected' : ''} data-i18n="weak_acid">弱酸</option>
                <option value="strong-base" data-i18n="strong_base">强碱</option>
                <option value="weak-base" ${targetType === 'base' ? 'selected' : ''} data-i18n="weak_base">弱碱</option>
            </select>
        </div>
        <div class="form-group">
            <label data-i18n="concentration_label">浓度 (mol/L)</label>
            <input type="number" class="component-conc small-input" value="0.1" step="0.01" min="0.0001">
        </div>
        <div class="k-values-section" style="display: block;">
            <label data-i18n="${targetType === 'acid' ? 'pka_label' : 'pkb_label'}">电离常数 (p${targetType === 'acid' ? 'Ka' : 'Kb'})</label>
            <div class="k-values-container">
                <div class="k-value-item">
                    <div class="k-value-label">
                        <span>K1</span>
                        <button class="remove-k-btn" onclick="removeKValue(this)">×</button>
                    </div>
                    <div class="k-value-inputs">
                        <input type="number" class="k-number-input" value="4.75" step="0.01" min="0" max="14" onchange="syncSlider(this)">
                        <input type="range" class="k-slider" value="4.75" min="0" max="14" step="0.01" oninput="syncInput(this)">
                    </div>
                </div>
            </div>
            <button class="add-k-btn" onclick="addKValue(this)" data-i18n="add_dissociation_level">+ 添加电离级数</button>
        </div>
    `;
    container.appendChild(item);
    if (typeof translateStaticUI === 'function') translateStaticUI();
    closePresetModal();
    updateCurveNameFromComponents();
}
function addPresetToComponent(preset) {
    const containerId = currentAddMode === 'solution' ? 'solutionComponents' : 'titrantComponents';
    const container = document.getElementById(containerId);
    const count = currentAddMode === 'solution' ? ++solutionComponentCount : ++titrantComponentCount;
    const item = document.createElement('div');
    item.className = 'mixture-item';
    const displayName = getPresetDisplayName(preset);
    item.dataset.id = count;
    item.dataset.type = preset.type;
    item.dataset.name = displayName;
    item.dataset.nameZh = preset.name || '';
    item.dataset.nameEn = preset.nameEn || preset.formula || preset.name || '';
    item.dataset.displayName = preset.formula || displayName;
    item.dataset.valence = preset.valence || 1;
    const typeValue = preset.isStrong ? `strong-${preset.type}` : `weak-${preset.type}`;
    item.innerHTML = `
        <div class="mixture-header">
            <span class="mixture-title">${displayName}</span>
            <button class="remove-mixture-btn" onclick="removeComponent(this, ${currentAddMode === 'titrant'})">×</button>
        </div>
        <div class="form-group component-type-select">
            <select class="component-type small-input" onchange="updateComponentType(this, ${currentAddMode === 'titrant'})">
                <option value="strong-acid" ${typeValue === 'strong-acid' ? 'selected' : ''} data-i18n="strong_acid">强酸</option>
                <option value="weak-acid" ${typeValue === 'weak-acid' ? 'selected' : ''} data-i18n="weak_acid">弱酸</option>
                <option value="strong-base" ${typeValue === 'strong-base' ? 'selected' : ''} data-i18n="strong_base">强碱</option>
                <option value="weak-base" ${typeValue === 'weak-base' ? 'selected' : ''} data-i18n="weak_base">弱碱</option>
            </select>
        </div>
        <div class="form-group">
            <label data-i18n="concentration_label">浓度 (mol/L)</label>
            <input type="number" class="component-conc small-input" value="0.1" step="0.01" min="0.0001">
        </div>
        ${!preset.isStrong ? `
        <div class="k-values-section">
            <label data-i18n="${preset.type === 'acid' ? 'pka_label' : 'pkb_label'}">电离常数 (p${preset.type === 'acid' ? 'Ka' : 'Kb'})</label>
            <div class="k-values-container">
                ${preset.pKa ? preset.pKa.map((pk, idx) => `
                    <div class="k-value-item">
                        <div class="k-value-label">
                            <span>K${idx + 1}</span>
                            <button class="remove-k-btn" onclick="removeKValue(this)">×</button>
                        </div>
                        <div class="k-value-inputs">
                            <input type="number" class="k-number-input" value="${pk}" step="0.01" min="0" max="14" onchange="syncSlider(this)">
                            <input type="range" class="k-slider" value="${pk}" min="0" max="14" step="0.01" oninput="syncInput(this)">
                        </div>
                    </div>
                `).join('') : preset.pKb.map((pkb, idx) => `
                    <div class="k-value-item">
                        <div class="k-value-label">
                            <span>K${idx + 1}</span>
                            <button class="remove-k-btn" onclick="removeKValue(this)">×</button>
                        </div>
                        <div class="k-value-inputs">
                            <input type="number" class="k-number-input" value="${pkb}" step="0.01" min="0" max="14" onchange="syncSlider(this)">
                            <input type="range" class="k-slider" value="${pkb}" min="0" max="14" step="0.01" oninput="syncInput(this)">
                        </div>
                    </div>
                `).join('')}
            </div>
            <button class="add-k-btn" onclick="addKValue(this)" data-i18n="add_dissociation_level">+ 添加电离级数</button>
        </div>
        ` : ''}
    `;
    container.appendChild(item);
    if (typeof translateStaticUI === 'function') translateStaticUI();
    renumberComponents(containerId);
    closePresetModal();
    updateCurveNameFromComponents();
}
