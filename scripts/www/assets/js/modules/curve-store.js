function saveCurrentCurve() {
    let tab = getActiveTab();
    // v6.5.8: 若没有可用的单曲线 tab 或 tab 内尚未生成曲线，
    // 使用当前参数计算一次曲线后保存（曲线显示配置使用默认配置）
    if (!tab || tab.type !== 'single' || !Array.isArray(tab.phs) || tab.phs.length === 0) {
        try {
            config.solution.V0 = parseFloat(document.getElementById('initialVol').value) || 20;
            config.maxVolume = parseFloat(document.getElementById('maxVolume').value) || 100;
            config.sampleCount = parseInt(document.getElementById('sampleDensitySlider').value) || 500;
            config.curveColor = document.getElementById('curveColor').value;
            config.solution.components = getComponentsData('solutionComponents');
            config.titrant.components = getComponentsData('titrantComponents');
            applyAutoMaxVolumeIfNeeded();
            const nameInput = document.getElementById('curveName');
            const userName = nameInput ? nameInput.value.trim() : '';
            updateCurveNameFromComponents();
            const autoNameCurrent = config.curveName;
            config.curveName = userName && userName !== t('滴定曲线1', 'Titration curve 1') ? userName : autoNameCurrent || t('滴定曲线1', 'Titration curve 1');
            if (nameInput) nameInput.value = config.curveName;
        } catch (err) { /* 缺少输入控件时退化为默认值 */ }
        const step = (config.maxVolume || 100) / (config.sampleCount || 500);
        const volumes = [];
        const phs = [];
        for (let i = 0; i <= (config.sampleCount || 500); i++) {
            const V = i * step;
            const pH = solvePH(config, V);
            volumes.push(V);
            phs.push(pH);
        }
        // v6.5.8: 默认显示配置
        const defaultMarkStyle = {
            fillEnabled: false, fillColor: '#57a7bd',
            borderEnabled: false, borderColor: '#0f172a',
            radiusEnabled: false, radius: 5,
            borderWidthEnabled: false, borderWidth: 2.8
        };
        const curveDefault = {
            name: config.curveName,
            volumes: volumes,
            phs: phs,
            color: config.curveColor || '#57a7bd',
            lineStyle: 'solid',
            pointStyle: 'circle',
            borderWidth: 2,
            markStyle: cloneMarkStyleConfig(defaultMarkStyle),
            markFillEnabled: false,
            markFillColor: '#57a7bd',
            markBorderEnabled: false,
            markBorderColor: '#0f172a',
            markRadiusEnabled: false,
            markRadius: 5,
            markBorderWidthEnabled: false,
            markBorderWidth: 2.8,
            params: snapshotParamsFromConfig(config)
        };
        savedCurves.push(curveDefault);
        updateSavedCurvesList();
        updateAllMultiTabs();
        try {
            showAlert(t('保存成功', 'Saved'),
                      t('曲线 “{name}” 已使用默认配置保存到列表', 'Curve "{name}" has been saved with default settings').replace('{name}', curveDefault.name),
                      'check');
        } catch (e) {}
        return;
    }
    config.curveLineStyle = tab.curveLineStyle || 'solid';
    config.curvePointStyle = tab.curvePointStyle || 'circle';
    config.markFillEnabled = !!tab.markFillEnabled;
    config.markFillColor = tab.markFillColor || '#57a7bd';
    config.markBorderEnabled = !!tab.markBorderEnabled;
    config.markBorderColor = tab.markBorderColor || '#0f172a';
    config.markRadiusEnabled = !!tab.markRadiusEnabled;
    config.markRadius = Number.isFinite(tab.markRadius) ? tab.markRadius : 5;
    config.markBorderWidthEnabled = !!tab.markBorderWidthEnabled;
    config.markBorderWidth = Number.isFinite(tab.markBorderWidth) ? tab.markBorderWidth : 2.8;
    const markStyle = buildMarkStyleFromTab(tab);
    const curve = {
        name: config.curveName,
        volumes: [...tab.volumes],
        phs: [...tab.phs],
        color: config.curveColor,
        lineStyle: tab.curveLineStyle || 'solid',
        pointStyle: tab.curvePointStyle || 'circle',
        borderWidth: tab.curveBorderWidth || 2,
        markStyle: cloneMarkStyleConfig(markStyle),
        markFillEnabled: markStyle.fillEnabled,
        markFillColor: markStyle.fillColor,
        markBorderEnabled: markStyle.borderEnabled,
        markBorderColor: markStyle.borderColor,
        markRadiusEnabled: markStyle.radiusEnabled,
        markRadius: markStyle.radius,
        markBorderWidthEnabled: markStyle.borderWidthEnabled,
        markBorderWidth: markStyle.borderWidth,
        params: snapshotParamsFromConfig(config)
    };
    savedCurves.push(curve);
    updateSavedCurvesList();
    updateAllMultiTabs();
    // v6.5.5: 自定义UI 成功提示
    try {
        showAlert(t('保存成功', 'Saved'),
                  t('曲线 “{name}” 已加入保存列表', 'Curve "{name}" has been added to the list').replace('{name}', curve.name),
                  'check');
    } catch (e) {}
}
function buildCompositeMarkStyleFromTab(tab) {
    const defaults = {
        fillEnabled: true,
        fillColor: '#57a7bd',
        borderEnabled: true,
        borderColor: '#0f172a',
        radiusEnabled: true,
        radius: 5,
        borderWidthEnabled: true,
        borderWidth: 2.8
    };
    if (!tab) return defaults;
    return {
        fillEnabled: !!(tab.markFillEnabled ?? defaults.fillEnabled),
        fillColor: tab.markFillColor || defaults.fillColor,
        borderEnabled: !!(tab.markBorderEnabled ?? defaults.borderEnabled),
        borderColor: tab.markBorderColor || defaults.borderColor,
        radiusEnabled: !!(tab.markRadiusEnabled ?? defaults.radiusEnabled),
        radius: Number.isFinite(tab.markRadius) ? tab.markRadius : defaults.radius,
        borderWidthEnabled: !!(tab.markBorderWidthEnabled ?? defaults.borderWidthEnabled),
        borderWidth: Number.isFinite(tab.markBorderWidth) ? tab.markBorderWidth : defaults.borderWidth
    };
}
function checkCompositeXAxisLabel(newXAxisLabel) {
    if (!compositeDatasets.length) return true;
    const existingXLabel = compositeDatasets[0].xAxisLabel || 'V';
    const newLabel = newXAxisLabel || 'V';
    return existingXLabel === newLabel;
}
window.checkCompositeXAxisLabel = checkCompositeXAxisLabel;
function addCompositeDataset(ds) {
    if (!ds || !ds.id || !Array.isArray(ds.data) || !ds.data.length) return false;
    const allYLabels = new Set(compositeDatasets.map(d => d.yAxisLabel || d.yAxisUnit || t('未知', 'Unknown')));
    allYLabels.add(ds.yAxisLabel || ds.yAxisUnit || t('未知', 'Unknown'));
    if (allYLabels.size > 2) {
        const existingUnits = Array.from(allYLabels).slice(0, -1).join('、');
        const newUnit = ds.yAxisLabel || ds.yAxisUnit || t('未知', 'Unknown');
        const msg = t('复合对比最多支持两种纵轴单位（当前已有 {existing}），无法添加 “{newUnit}”。', 'Composite supports at most 2 Y-axis units (currently {existing}); cannot add "{newUnit}".')
            .replace('{existing}', existingUnits)
            .replace('{newUnit}', newUnit);
        try { showAlert(t('提示', 'Tip'), msg, 'warning'); } catch (e) {}
        return false;
    }
    compositeDatasets.push(ds);
    compositeState.selectedIds.add(ds.id);
    compositeState.markTargetIds.add(ds.id);
    try {
        if (typeof window.renderCompositeChart === 'function') window.renderCompositeChart();
        if (typeof window.updateCompositeCurveList === 'function') window.updateCompositeCurveList();
    } catch (e) {}
    try {
        const prefix = t('已加入复合对比', 'Added to composite');
        const body = t('曲线 “{name}” 已加入复合对比（共 {count} 条）', 'Curve "{name}" added to composite ({count} total)')
            .replace('{name}', ds.name)
            .replace('{count}', compositeDatasets.length);
        showAlert(prefix, body, 'check');
    } catch (e) {}
    return true;
}
window.addCompositeDataset = addCompositeDataset;
function saveCurrentCurveToComposite(tab) {
    if (!tab) tab = getActiveTab();
    if (!tab) return;
    let volumes = Array.isArray(tab.volumes) ? tab.volumes.slice() : [];
    let phs = Array.isArray(tab.phs) ? tab.phs.slice() : [];
    if (!volumes.length) {
        try {
            const result = computeCurve(config, config.maxVolume, config.sampleCount);
            volumes = result.volumes || [];
            phs = result.phs || [];
            tab.volumes = volumes;
            tab.phs = phs;
        } catch (e) { return; }
    }
    if (!volumes.length) return;
    const color = tab.curveColor || config.curveColor || '#0ea5e9';
    const baseName = tab.title || config.curveName || (t('曲线', 'Curve') + ' ' + tab.id);
    const xAxisLabel = tab.xAxisLabel || 'V';
    const yAxisLabel = tab.yAxisLabel || 'pH';
    const xUnit = tab.xAxisLabel || 'mL';
    const yUnit = 'pH';
    const data = volumes.map((v, i) => ({
        x: v,
        y: phs[i],
        rawX: v,
        rawPH: phs[i],
        rawY: phs[i],
        rawAmount: null
    }));
    addCompositeDataset({
        id: 'comp-' + Date.now() + '-' + Math.floor(Math.random() * 100000),
        type: 'single',
        sourceName: baseName,
        name: `${baseName}(${yAxisLabel}-${xAxisLabel})`,
        xAxisMode: 'V',
        xAxisLabel: xAxisLabel,
        yAxisLabel: yAxisLabel,
        xUnit: xUnit,
        yUnit: yUnit,
        yAxisUnit: yUnit,
        color: color,
        lineStyle: tab.curveLineStyle || 'solid',
        pointStyle: tab.curvePointStyle || 'circle',
        borderWidth: Number.isFinite(tab.curveBorderWidth) ? tab.curveBorderWidth : 2,
        markStyle: buildCompositeMarkStyleFromTab(tab),
        data: data
    });
}
function saveMultiCurvesToComposite(tab) {
    if (!tab) tab = getActiveTab();
    if (!tab || tab.type !== 'multi') return;
    if (!Array.isArray(tab.datasets) || !tab.datasets.length) return;
    const xAxisLabel = tab.xAxisLabel || 'V';
    let added = 0;
    const yAxisLabel = tab.yAxisLabel || 'pH';
    const xUnit = tab.xAxisLabel || 'mL';
    const yUnit = 'pH';
    tab.datasets.forEach((dataset, idx) => {
        if (!dataset.visible || !Array.isArray(dataset.data) || !dataset.data.length) return;
        const meta = dataset.meta || {};
        const color = dataset.borderColor || meta.color || dataset.backgroundColor || getNatureColor(idx);
        const baseName = dataset.label || meta.name || meta.curveName || (t('曲线', 'Curve') + ' ' + (idx + 1));
        const data = dataset.data.map(pt => ({
            x: pt.x,
            y: pt.y,
            rawX: pt.x,
            rawPH: pt.y,
            rawY: pt.y,
            rawAmount: null
        }));
        addCompositeDataset({
            id: 'comp-' + Date.now() + '-' + idx + '-' + Math.floor(Math.random() * 100000),
            type: 'multi',
            sourceName: baseName,
            name: `${baseName}(${yAxisLabel}-${xAxisLabel})`,
            xAxisMode: 'V',
            xAxisLabel: xAxisLabel,
            yAxisLabel: yAxisLabel,
            xUnit: xUnit,
            yUnit: yUnit,
            yAxisUnit: yUnit,
            color: color,
            lineStyle: dataset.lineStyle || 'solid',
            pointStyle: dataset.pointStyle || 'circle',
            borderWidth: Number.isFinite(dataset.borderWidth) ? dataset.borderWidth : 2,
            markStyle: buildCompositeMarkStyleFromTab(null),
            data: data
        });
        added++;
    });
    if (added === 0) {
        try { showAlert(t('提示', 'Tip'), t('多曲线标签页中没有可见曲线', 'No visible curves in multi-curve tab'), '?'); } catch (e) {}
    }
}
window.saveCurrentCurveToComposite = saveCurrentCurveToComposite;
window.saveMultiCurvesToComposite = saveMultiCurvesToComposite;
function updateSavedCurvesList() {
    const list = document.getElementById('savedCurvesList');
    list.innerHTML = '';
    savedCurves.forEach((curve, index) => {
        const item = document.createElement('div');
        item.className = 'saved-curve-item';
        item.dataset.curveIndex = String(index);
        item.style.cursor = 'pointer';
        item.dataset.i18nTitle = 'load_saved_curve_title';
        item.title = t('点击加载到单曲线标签页', 'Click to load into single-curve tab');
        item.innerHTML = `
            <span class="saved-curve-name" style="color: ${curve.color}">${curve.name}</span>
            <div class="saved-curve-actions">
                <button class="saved-curve-btn" onclick="deleteCurve(${index}, event)" data-i18n="delete">删除</button>
            </div>
        `;
        // v6.5.8: 点击曲线条目加载到单曲线标签页（与右侧删除按钮事件区分）
        item.addEventListener('click', (event) => {
            if (event.target.closest('.saved-curve-btn')) return;
            if (event.target.closest('.saved-curve-actions')) return;
            loadSavedCurveToSingleTab(index);
        });
        list.appendChild(item);
    });
    if (typeof translateStaticUI === 'function') translateStaticUI();
    const activeTab = getActiveTab();
    if (activeTab) {
        refreshTabAnnotations(activeTab);
        updateCurveVisibilityList(activeTab);
        updateCurvePickMenu(activeTab);
    }
}
function loadSavedCurveToSingleTab(index) {
    const curve = savedCurves[index];
    if (!curve) return;
    let tab = getActiveTab();
    if (!tab || tab.type !== 'single') {
        tab = createChartTab('single');
    }
    if (!tab) return;
    // 应用曲线参数到 config 与 tab
    try {
        if (curve.params) {
            config.titrationType = curve.params.titrationType || config.titrationType;
            if (curve.params.solution) config.solution = JSON.parse(JSON.stringify(curve.params.solution));
            if (curve.params.titrant) config.titrant = JSON.parse(JSON.stringify(curve.params.titrant));
            if (Number.isFinite(curve.params.maxVolume)) config.maxVolume = curve.params.maxVolume;
            if (Number.isFinite(curve.params.sampleCount)) config.sampleCount = curve.params.sampleCount;
            config.curveColor = curve.color || curve.params.curveColor || config.curveColor;
            config.curveName = curve.name || curve.params.curveName || config.curveName;
        }
    } catch (e) { /* 容错 */ }
    tab.title = curve.name || tab.title;
    tab.volumes = Array.isArray(curve.volumes) ? curve.volumes.slice() : [];
    tab.phs = Array.isArray(curve.phs) ? curve.phs.slice() : [];
    tab.curveLineStyle = curve.lineStyle || 'solid';
    tab.curvePointStyle = curve.pointStyle || 'circle';
    tab.curveBorderWidth = Number.isFinite(curve.borderWidth) ? curve.borderWidth : 2;
    const ms = curve.markStyle || {};
    tab.markFillEnabled = !!(ms.fillEnabled ?? curve.markFillEnabled);
    tab.markFillColor = ms.fillColor || curve.markFillColor || '#57a7bd';
    tab.markBorderEnabled = !!(ms.borderEnabled ?? curve.markBorderEnabled);
    tab.markBorderColor = ms.borderColor || curve.markBorderColor || '#0f172a';
    tab.markRadiusEnabled = !!(ms.radiusEnabled ?? curve.markRadiusEnabled);
    tab.markRadius = Number.isFinite(ms.radius) ? ms.radius : (Number.isFinite(curve.markRadius) ? curve.markRadius : 5);
    tab.markBorderWidthEnabled = !!(ms.borderWidthEnabled ?? curve.markBorderWidthEnabled);
    tab.markBorderWidth = Number.isFinite(ms.borderWidth) ? ms.borderWidth : (Number.isFinite(curve.markBorderWidth) ? curve.markBorderWidth : 2.8);
    tab.fixedMarks = [];
    tab.selectedPoint = null;
    clearAnnotationLabelOffsets(tab);
    tab.maxVolume = curve.params && curve.params.maxVolume ? curve.params.maxVolume : config.maxVolume;
    tab.params = curve.params ? JSON.parse(JSON.stringify(curve.params)) : snapshotParamsFromConfig(config);
    // 渲染图表与统计
    try { updateChart(tab, tab.volumes, tab.phs, curve.color || config.curveColor); } catch (e) {}
    try { updateStats(tab, tab.volumes, tab.phs); } catch (e) {}
    try { updateAllMultiTabs(); } catch (e) {}
    try { updateDistributionChart(tab, tab.params || config); } catch (e) {}
    // 切换到该 tab 并跳转到图表页面
    try { setActiveTab(tab.id); } catch (e) {}
    // 更新 tab 标题显示
    try {
        const titleEl = document.querySelector(`.tab-item[data-tab-id="${tab.id}"] .tab-title`);
        if (titleEl) titleEl.textContent = tab.title;
    } catch (e) {}
    try { jumpToChartPageAfterGenerate(); } catch (e) {}
    try {
        showAlert(t('已加载', 'Loaded'),
                  t('曲线 “{name}” 已加载到单曲线标签页', 'Curve "{name}" has been loaded').replace('{name}', curve.name),
                  'check');
    } catch (e) {}
}
async function deleteCurve(index, event) {
    const confirmed = await showConfirm(t('确认删除', 'Confirm delete'), t('确定要删除这条曲线吗？', 'Are you sure you want to delete this curve?'), 'trash');
    if (!confirmed) return;
    savedCurves.splice(index, 1);
    updateSavedCurvesList();
    updateAllMultiTabs();
}
