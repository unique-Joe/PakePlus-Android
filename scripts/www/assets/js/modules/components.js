function createMixtureComponent(id, type, isTitrant = false) {
    const containerId = isTitrant ? 'titrantComponents' : 'solutionComponents';
    const isAcidTitratingBase = config.titrationType === 'acid-base';
    const defaultType = isTitrant ?
        (isAcidTitratingBase ? 'acid' : 'base') :
        (isAcidTitratingBase ? 'base' : 'acid');
    const componentName = t('自定义酸碱', 'Custom acid/base');
    const item = document.createElement('div');
    item.className = 'mixture-item';
    item.dataset.id = id;
    item.dataset.type = defaultType;
    item.dataset.name = componentName;
    item.dataset.displayName = componentName;
    // v7.0.1: 允许在滴定剂或待测液内同时存在酸与碱，下拉框始终展示 4 种类型
    item.innerHTML = `
        <div class="mixture-header">
            <span class="mixture-title">${componentName}</span>
            <button class="remove-mixture-btn" onclick="removeComponent(this, ${isTitrant})">×</button>
        </div>
        <div class="form-group component-type-select">
            <select class="component-type small-input" onchange="updateComponentType(this, ${isTitrant})">
                <option value="strong-acid" ${defaultType === 'acid' ? 'selected' : ''} data-i18n="strong_acid">强酸</option>
                <option value="weak-acid" data-i18n="weak_acid">弱酸</option>
                <option value="strong-base" ${defaultType === 'base' ? 'selected' : ''} data-i18n="strong_base">强碱</option>
                <option value="weak-base" data-i18n="weak_base">弱碱</option>
            </select>
        </div>
        <div class="form-group">
            <label data-i18n="concentration_label">浓度 (mol/L)</label>
            <input type="number" class="component-conc small-input" value="0.1" step="0.01" min="0.0001" oninput="applyAutoMaxVolumeIfNeeded();">
        </div>
        <div class="form-group valence-group">
            <label data-i18n="valence_label">元数</label>
            <input type="number" class="component-valence small-input" value="1" step="1" min="1" oninput="applyAutoMaxVolumeIfNeeded();">
        </div>
        <div class="k-values-section" style="display: none;">
            <label data-i18n="${defaultType === 'acid' ? 'pka_label' : 'pkb_label'}">电离常数 (p${defaultType === 'acid' ? 'Ka' : 'Kb'})</label>
            <div class="k-values-container"></div>
            <button class="add-k-btn" onclick="addKValue(this)" data-i18n="add_dissociation_level">+ 添加电离级数</button>
        </div>
    `;
    document.getElementById(containerId).appendChild(item);
    if (typeof translateStaticUI === 'function') translateStaticUI();
    const typeSelect = item.querySelector('.component-type');
    typeSelect.value = `strong-${defaultType}`;
    updateCurveNameFromComponents();
    applyAutoMaxVolumeIfNeeded();
    return item;
}
function updateComponentType(select, isTitrant) {
    const item = select.closest('.mixture-item');
    const type = select.value;
    const isWeak = type.startsWith('weak-');
    const acidBase = type.split('-')[1];
    item.dataset.type = acidBase;
    const kSection = item.querySelector('.k-values-section');
    const label = kSection.querySelector('label');
    label.dataset.i18n = acidBase === 'acid' ? 'pka_label' : 'pkb_label';
    label.textContent = acidBase === 'acid'
        ? t('电离常数 (pKa)', 'Dissociation constant (pKa)')
        : t('电离常数 (pKb)', 'Dissociation constant (pKb)');
    kSection.style.display = isWeak ? 'block' : 'none';
    const valenceGroup = item.querySelector('.valence-group');
    if (valenceGroup) {
        valenceGroup.style.display = isWeak ? 'none' : 'block';
    }
    updateCurveNameFromComponents();
    applyAutoMaxVolumeIfNeeded();
}
function removeComponent(btn, isTitrant) {
    const containerId = isTitrant ? 'titrantComponents' : 'solutionComponents';
    const container = document.getElementById(containerId);
    const items = container.querySelectorAll('.mixture-item');
    if (items.length > 1) {
        btn.closest('.mixture-item').remove();
        renumberComponents(containerId);
        updateCurveNameFromComponents();
        applyAutoMaxVolumeIfNeeded();
    }
}
function renumberComponents(containerId) {
    const container = document.getElementById(containerId);
    const items = container.querySelectorAll('.mixture-item');
    items.forEach((item, index) => {
        const titleSpan = item.querySelector('.mixture-title');
        titleSpan.textContent = item.dataset.name || t('自定义酸碱', 'Custom acid/base');
    });
}
function refreshComponentLabels() {
    ['solutionComponents', 'titrantComponents'].forEach(containerId => {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.querySelectorAll('.mixture-item').forEach(item => {
            const titleSpan = item.querySelector('.mixture-title');
            if (!titleSpan) return;
            const customZh = '自定义酸碱';
            const customEn = 'Custom acid/base';
            const nameZh = item.dataset.nameZh;
            const nameEn = item.dataset.nameEn;
            if (nameZh && nameEn) {
                titleSpan.textContent = uiLanguage === 'zh' ? nameZh : nameEn;
                return;
            }
            const name = item.dataset.name || '';
            if (name === customZh || name === customEn) {
                titleSpan.textContent = t(customZh, customEn);
            } else {
                titleSpan.textContent = name || t(customZh, customEn);
            }
        });
    });
}
function addKValue(btn) {
    const item = btn.closest('.mixture-item');
    const container = item.querySelector('.k-values-container');
    const count = container.querySelectorAll('.k-value-item').length;
    if (count < 5) {
        const nextVal = count > 0 ? 5 + count * 2 : 4.75;
        addKValueItem(container, count + 1, nextVal);
    }
}
function addKValueItem(container, index, value) {
    const item = document.createElement('div');
    item.className = 'k-value-item';
    item.innerHTML = `
        <div class="k-value-label">
            <span>K${index}</span>
            <button class="remove-k-btn" onclick="removeKValue(this)">×</button>
        </div>
        <div class="k-value-inputs">
            <input type="number" class="k-number-input" value="${value}" step="0.01" min="0" max="14" onchange="syncSlider(this); applyAutoMaxVolumeIfNeeded();">
            <input type="range" class="k-slider" value="${value}" min="0" max="14" step="0.01" oninput="syncInput(this); applyAutoMaxVolumeIfNeeded();">
        </div>
    `;
    container.appendChild(item);
    if (typeof translateStaticUI === 'function') translateStaticUI();
}
function removeKValue(btn) {
    const item = btn.closest('.k-value-item');
    const container = item.parentElement;
    if (container.querySelectorAll('.k-value-item').length > 1) {
        item.remove();
        updateKLabels(container);
    }
}
function updateKLabels(container) {
    container.querySelectorAll('.k-value-item').forEach((item, index) => {
        item.querySelector('.k-value-label span').textContent = `K${index + 1}`;
    });
}
function syncSlider(input) {
    const slider = input.parentElement.querySelector('.k-slider');
    let val = Math.max(0, Math.min(14, parseFloat(input.value) || 0));
    slider.value = val;
    input.value = val;
}
function syncInput(slider) {
    slider.parentElement.querySelector('.k-number-input').value = slider.value;
}
function setupToggleButtons() {
    document.querySelectorAll('[data-type="acid-base"], [data-type="base-acid"]').forEach(btn => {
        btn.onclick = function() {
            document.querySelectorAll('[data-type="acid-base"], [data-type="base-acid"]').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            config.titrationType = this.dataset.type;
            clearAllComponents();
            updateAllComponentTypes();
        };
    });
}
function clearAllComponents() {
    document.getElementById('solutionComponents').innerHTML = '';
    document.getElementById('titrantComponents').innerHTML = '';
    solutionComponentCount = 0;
    titrantComponentCount = 0;
    createMixtureComponent(++solutionComponentCount, null, false);
    createMixtureComponent(++titrantComponentCount, null, true);
    updateCurveNameFromComponents();
}
function updateAllComponentTypes() {
    // v7.0.1: 保留每个组分原有的酸/碱归属，仅在切换主滴定方向时重建为统一的 4 选项下拉框
    const rebuildSelect = (item) => {
        const typeSelect = item.querySelector('.component-type');
        const currentValue = typeSelect.value;
        const parts = currentValue.split('-');
        const isStrong = parts[0] === 'strong';
        const acidBase = parts[1] === 'base' ? 'base' : 'acid';
        typeSelect.innerHTML = `
            <option value="strong-acid" data-i18n="strong_acid">强酸</option>
            <option value="weak-acid" data-i18n="weak_acid">弱酸</option>
            <option value="strong-base" data-i18n="strong_base">强碱</option>
            <option value="weak-base" data-i18n="weak_base">弱碱</option>
        `;
        typeSelect.value = `${isStrong ? 'strong' : 'weak'}-${acidBase}`;
        item.dataset.type = acidBase;
        const kSection = item.querySelector('.k-values-section');
        const label = kSection.querySelector('label');
        label.textContent = t('电离常数', 'Dissociation constant') + ` (p${acidBase === 'acid' ? 'Ka' : 'Kb'})`;
    };
    document.querySelectorAll('#solutionComponents .mixture-item').forEach(rebuildSelect);
    document.querySelectorAll('#titrantComponents .mixture-item').forEach(rebuildSelect);
    updateCurveNameFromComponents();
}
function getComponentsData(containerId) {
    const container = document.getElementById(containerId);
    const components = [];
    container.querySelectorAll('.mixture-item').forEach(item => {
        const typeSelect = item.querySelector('.component-type');
        const concInput = item.querySelector('.component-conc');
        const kSection = item.querySelector('.k-values-section');
        const type = typeSelect.value.split('-');
        const isStrong = type[0] === 'strong';
        const acidBase = type[1];
    const component = {
            type: acidBase,
            isStrong: isStrong,
            c: parseFloat(concInput.value) || 0,
            kValues: [],
            name: item.dataset.name || t('自定义酸碱', 'Custom acid/base'),
            displayName: item.dataset.displayName || item.dataset.name || t('自定义酸碱', 'Custom acid/base'),
            valence: 1
        };
        if (!isStrong) {
            kSection.querySelectorAll('.k-number-input').forEach(input => {
                const val = parseFloat(input.value);
                if (!isNaN(val) && val > 0) {
                    component.kValues.push(val);
                }
            });
            component.valence = component.kValues.length;
        } else {
            const valenceInput = item.querySelector('.component-valence');
            const valenceValue = valenceInput ? parseInt(valenceInput.value, 10) : parseInt(item.dataset.valence || '1', 10);
            component.valence = Number.isFinite(valenceValue) && valenceValue > 0 ? valenceValue : 1;
        }
        components.push(component);
    });
    return components;
}
function getNeutralizationValence(component) {
    if (!component) return 0;
    if (component.isStrong) {
        const v = Number(component.valence);
        return Number.isFinite(v) && v > 0 ? v : 1;
    }
    const kCount = Array.isArray(component.kValues) ? component.kValues.length : 0;
    const v = Number(component.valence);
    return kCount > 0 ? kCount : (Number.isFinite(v) && v > 0 ? v : 1);
}
function sumEquivalentConcentration(components, typeFilter = null) {
    return (components || []).reduce((sum, component) => {
        if (typeFilter && component.type !== typeFilter) return sum;
        const c = Number(component.c);
        const valence = getNeutralizationValence(component);
        if (!Number.isFinite(c) || c <= 0 || valence <= 0) return sum;
        return sum + c * valence;
    }, 0);
}
function getNetAcidEquivalentConcentration(components) {
    const acidEq = sumEquivalentConcentration(components, 'acid');
    const baseEq = sumEquivalentConcentration(components, 'base');
    return acidEq - baseEq;
}
function estimateCompleteTitrationVolume(params) {
    const solutionComponents = params.solution?.components || [];
    const titrantComponents = params.titrant?.components || [];
    const solutionVolume = Number(params.solution?.V0);
    const solutionNetEqConc = getNetAcidEquivalentConcentration(solutionComponents);
    const titrantNetEqConc = getNetAcidEquivalentConcentration(titrantComponents);
    const solutionNetEqAmount = solutionNetEqConc * solutionVolume;
    if (!Number.isFinite(solutionVolume) || solutionVolume <= 0 ||
        !Number.isFinite(solutionNetEqAmount) || !Number.isFinite(titrantNetEqConc) ||
        Math.abs(solutionNetEqAmount) < 1e-12 || Math.abs(titrantNetEqConc) < 1e-12) {
        return null;
    }
    const equivalenceVolume = -solutionNetEqAmount / titrantNetEqConc;
    if (!Number.isFinite(equivalenceVolume) || equivalenceVolume <= 0) return null;
    return {
        equivalenceVolume,
        maxVolume: Math.max(10, Math.ceil(equivalenceVolume * 1.2 * 10) / 10),
        solutionAcidEq: sumEquivalentConcentration(solutionComponents, 'acid'),
        solutionBaseEq: sumEquivalentConcentration(solutionComponents, 'base'),
        titrantAcidEq: sumEquivalentConcentration(titrantComponents, 'acid'),
        titrantBaseEq: sumEquivalentConcentration(titrantComponents, 'base'),
        solutionNetEqConc,
        titrantNetEqConc
    };
}
function applyAutoMaxVolumeIfNeeded() {
    const toggle = document.getElementById('autoMaxVolumeToggle');
    const maxVolumeInput = document.getElementById('maxVolume');
    const hint = document.getElementById('autoMaxVolumeHint');
    const estimate = estimateCompleteTitrationVolume(config);
    if (!estimate) {
        if (hint) hint.textContent = t('当前组分不足以估算完全滴定点，请检查浓度、元数或滴定剂设置。', 'Current components cannot estimate the equivalence point; check concentration, valence or titrant settings.');
        return;
    }
    if (toggle && toggle.checked && maxVolumeInput) {
        config.maxVolume = estimate.maxVolume;
        maxVolumeInput.value = estimate.maxVolume.toString();
    }
    const directionText = estimate.solutionNetEqConc > 0
        ? t('待测液净酸当量由滴定剂净碱当量中和', 'Solution net acid equivalents are neutralized by titrant net base equivalents')
        : t('待测液净碱当量由滴定剂净酸当量中和', 'Solution net base equivalents are neutralized by titrant net acid equivalents');
    if (hint) {
        hint.textContent = t('已按混合液净当量估算：{direction}；完全滴定点 {eqVol} mL，最大体积 {maxVol} mL。', 'Estimated from net equivalents: {direction}; equivalence point {eqVol} mL, max volume {maxVol} mL.')
            .replace('{direction}', directionText)
            .replace('{eqVol}', estimate.equivalenceVolume.toFixed(2))
            .replace('{maxVol}', estimate.maxVolume.toFixed(1));
    }
}
function updateCurveNameFromComponents() {
    const nameInput = document.getElementById('curveName');
    if (!nameInput) return;
    const solutionComponents = getComponentsData('solutionComponents');
    const titrantComponents = getComponentsData('titrantComponents');
    // v7.0.1: 待测液与滴定剂可能同时含酸碱，曲线名按"滴定剂全部组分 滴定 待测液全部组分"组合
    const joinAll = (components, fallback) => {
        const names = components.map(c => c.displayName || c.name).filter(Boolean);
        return names.length ? names.join('+') : fallback;
    };
    const titrantLabel = joinAll(titrantComponents, config.titrationType === 'acid-base' ? t('酸', 'Acid') : t('碱', 'Base'));
    const solutionLabel = joinAll(solutionComponents, config.titrationType === 'acid-base' ? t('碱', 'Base') : t('酸', 'Acid'));
    const autoName = `${titrantLabel}${t('滴定', ' titrates ')}${solutionLabel}`;
    config.curveName = autoName || t('滴定曲线1', 'Titration curve 1');
    nameInput.value = config.curveName;
}
