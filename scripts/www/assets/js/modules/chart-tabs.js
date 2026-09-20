function getTabById(tabId) {
    return chartTabs.find(tab => tab.id === tabId);
}
function getActiveTab() {
    return chartTabs.find(tab => tab.id === activeTabId);
}
function getTabContent(tab) {
    if (!tab) return null;
    return document.querySelector(`.tab-pane[data-tab-id="${tab.id}"]`);
}
function updateActiveTabDefaults(tab) {
    if (!tab) return;
    if (tab.showRawPoints === undefined) tab.showRawPoints = false;
    if (tab.simpleLabelMode === undefined) tab.simpleLabelMode = false;
    if (tab.showIndicatorRange === undefined) tab.showIndicatorRange = false;
    if (tab.showDerivative === undefined) tab.showDerivative = false;
    if (!tab.derivativeLineStyle) tab.derivativeLineStyle = 'dash';
    if (!tab.derivativeColor) tab.derivativeColor = '#f59e0b';
    if (typeof tab.showLegend !== 'boolean') tab.showLegend = true;
    if (!Number.isFinite(tab.leapThreshold)) tab.leapThreshold = 0.2;
    if (!tab.curveLineStyle) tab.curveLineStyle = 'solid';
    if (!tab.curvePointStyle) tab.curvePointStyle = 'circle';
    if (typeof tab.markFillEnabled !== 'boolean') tab.markFillEnabled = false;
    if (!tab.markFillColor) tab.markFillColor = '#57a7bd';
    if (typeof tab.markBorderEnabled !== 'boolean') tab.markBorderEnabled = false;
    if (!tab.markBorderColor) tab.markBorderColor = '#0f172a';
    if (typeof tab.markRadiusEnabled !== 'boolean') tab.markRadiusEnabled = false;
    if (!Number.isFinite(tab.markRadius)) tab.markRadius = 5;
    if (typeof tab.markBorderWidthEnabled !== 'boolean') tab.markBorderWidthEnabled = false;
    if (!Number.isFinite(tab.markBorderWidth)) tab.markBorderWidth = 2.8;
    if (typeof tab.gridEnabled !== 'boolean') tab.gridEnabled = true;
    if (!Number.isFinite(tab.gridXStep)) tab.gridXStep = 0;
    if (!Number.isFinite(tab.gridYStep)) tab.gridYStep = 0;
    if (!tab.selectedIndicatorId) tab.selectedIndicatorId = 'phenolphthalein';
    if (!Array.isArray(tab.fixedMarks)) tab.fixedMarks = [];
    if (!Array.isArray(tab.volumes)) tab.volumes = [];
    if (!Array.isArray(tab.phs)) tab.phs = [];
    if (!Array.isArray(tab.volumePickIndices)) tab.volumePickIndices = [];
    if (!Array.isArray(tab.curveSelection)) {
        if (Array.isArray(tab.visibleCurveIndices)) {
            tab.curveSelection = tab.visibleCurveIndices.slice();
        } else {
            tab.curveSelection = [];
        }
    }
}
function createChartTab(type = 'single') {
    const id = `tab-${tabCounter++}`;
    const titlePrefix = type === 'multi' ? t('多曲线', 'Multi') : t('单曲线', 'Single');
    const tab = {
        id,
        type,
        title: `${titlePrefix}${tabCounter - 1}`,
        chart: null,
        volumes: [],
        phs: [],
        showRawPoints: false,
        simpleLabelMode: false,
        showIndicatorRange: false,
        showDerivative: false,
        derivativeLineStyle: 'dash',
        derivativeColor: '#f59e0b',
        showLegend: true,
        leapThreshold: 0.2,
        curveLineStyle: 'solid',
        curvePointStyle: 'circle',
        curveBorderWidth: 2,
        markFillEnabled: false,
        markFillColor: '#57a7bd',
        markBorderEnabled: false,
        markBorderColor: '#0f172a',
        markRadiusEnabled: false,
        markRadius: 5,
        markBorderWidthEnabled: false,
        markBorderWidth: 2.8,
        gridEnabled: true,
        gridXStep: 0,
        gridYStep: 0,
        selectedIndicatorId: 'phenolphthalein',
        jumpInfo: null,
        selectedPoint: null,
        fixedMarks: [],
        volumePickIndices: [],
        curveSelection: []
    };
    chartTabs.push(tab);
    renderTabItem(tab);
    renderTabContent(tab);
    setActiveTab(tab.id);
    return tab;
}
function renderTabItem(tab) {
    const tabsList = document.getElementById('chartTabs');
    if (!tabsList) return;
    const item = document.createElement('div');
    item.className = 'tab-item';
    item.dataset.tabId = tab.id;
    item.setAttribute('draggable', 'true');
    item.innerHTML = `
        <span class="tab-title">${tab.title}</span>
        <span class="tab-type-tag">${tab.type === 'multi' ? t('多曲线', 'Multi') : t('单曲线', 'Single')}</span>
        <button class="tab-close" type="button">×</button>
    `;
    const title = item.querySelector('.tab-title');
    const closeBtn = item.querySelector('.tab-close');
    item.addEventListener('click', (event) => {
        if (event.target === closeBtn) return;
        if (item.classList.contains('editing')) return;
        setActiveTab(tab.id);
    });
    closeBtn.addEventListener('click', () => removeTab(tab.id));
    title.addEventListener('dblclick', (event) => {
        event.stopPropagation();
        beginTabRename(item, tab);
    });
    title.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            title.blur();
        }
    });
    title.addEventListener('blur', () => finishTabRename(item, tab));
    item.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', tab.id);
        event.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragover', (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    });
    item.addEventListener('drop', (event) => {
        event.preventDefault();
        const draggedId = event.dataTransfer.getData('text/plain');
        if (!draggedId || draggedId === tab.id) return;
        reorderTabs(draggedId, tab.id);
    });
    const addWrapper = document.getElementById('tabAddWrapper');
    if (addWrapper && addWrapper.parentElement === tabsList) {
        tabsList.insertBefore(item, addWrapper);
    } else {
        tabsList.appendChild(item);
    }
}
function beginTabRename(item, tab) {
    const title = item.querySelector('.tab-title');
    if (!title) return;
    item.classList.add('editing');
    title.contentEditable = 'true';
    title.focus();
    document.execCommand('selectAll', false, null);
}
function finishTabRename(item, tab) {
    const title = item.querySelector('.tab-title');
    if (!title) return;
    title.contentEditable = 'false';
    item.classList.remove('editing');
    const newTitle = title.textContent.trim();
    tab.title = newTitle || tab.title;
    title.textContent = tab.title;
}
function reorderTabs(draggedId, targetId) {
    const draggedIndex = chartTabs.findIndex(tab => tab.id === draggedId);
    const targetIndex = chartTabs.findIndex(tab => tab.id === targetId);
    if (draggedIndex === -1 || targetIndex === -1) return;
    const [draggedTab] = chartTabs.splice(draggedIndex, 1);
    chartTabs.splice(targetIndex, 0, draggedTab);
    const tabsList = document.getElementById('chartTabs');
    if (!tabsList) return;
    const draggedEl = tabsList.querySelector(`[data-tab-id="${draggedId}"]`);
    const targetEl = tabsList.querySelector(`[data-tab-id="${targetId}"]`);
    if (!draggedEl || !targetEl) return;
    tabsList.insertBefore(draggedEl, draggedIndex < targetIndex ? targetEl.nextSibling : targetEl);
}
function removeTab(tabId) {
    const index = chartTabs.findIndex(tab => tab.id === tabId);
    if (index === -1) return;
    const [removed] = chartTabs.splice(index, 1);
    const tabsList = document.getElementById('chartTabs');
    const contents = document.getElementById('chartTabContents');
    const tabItem = tabsList ? tabsList.querySelector(`[data-tab-id="${tabId}"]`) : null;
    const tabPane = contents ? contents.querySelector(`[data-tab-id="${tabId}"]`) : null;
    if (tabItem) tabItem.remove();
    if (tabPane) tabPane.remove();
    if (removed.chart) removed.chart.destroy();
    if (activeTabId === tabId) {
        const nextTab = chartTabs[index] || chartTabs[index - 1] || chartTabs[0];
        if (nextTab) {
            setActiveTab(nextTab.id);
        } else {
            createChartTab('single');
        }
    }
}
function setActiveTab(tabId) {
    const tab = getTabById(tabId);
    if (!tab) return;
    updateActiveTabDefaults(tab);
    activeTabId = tabId;
    document.querySelectorAll('.tab-item').forEach(item => {
        item.classList.toggle('active', item.dataset.tabId === tabId);
    });
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.toggle('active', pane.dataset.tabId === tabId);
    });
    updateCurvePickMenu(tab);
    renderActiveTabChart();
}
function renderTabContent(tab) {
    const contents = document.getElementById('chartTabContents');
    if (!contents) return;
    const pane = document.createElement('div');
    pane.className = 'tab-pane';
    pane.dataset.tabId = tab.id;
    pane.innerHTML = tab.type === 'multi' ? getMultiTabTemplate() : getSingleTabTemplate();
    contents.appendChild(pane);
    if (typeof translateStaticUI === 'function') translateStaticUI();
    setupTabControls(tab, pane);
}
function getSingleTabTemplate() {
    return `
        <div class="chart-container">
            <div class="chart-header">
                <div class="chart-title" data-i18n="single_chart_title">单曲线图表</div>
                <div class="chart-actions">
                    <select class="action-btn" data-role="image-format">
                        <option value="png">PNG</option>
                        <option value="jpg">JPG</option>
                    </select>
                    <select class="action-btn" data-role="image-scale">
                        <option value="1">1x</option>
                        <option value="2">2x</option>
                        <option value="3">3x</option>
                    </select>
                    <button class="action-btn" data-role="download" data-i18n="download_chart">下载图表</button>
                </div>
            </div>
            <div class="chart-wrapper">
                <canvas data-role="chart-canvas"></canvas>
            </div>
            <div class="chart-utility-row">
                <label class="control-toggle-item">
                    <input type="checkbox" data-role="raw-toggle">
                    <span class="control-toggle-label" data-i18n="show_raw_points">显示原始数据点</span>
                </label>
                <label class="control-toggle-item">
                    <input type="checkbox" data-role="simple-label-toggle">
                    <span class="control-toggle-label" data-i18n="plain_labels">朴素标签</span>
                </label>
                <label class="control-toggle-item">
                    <input type="checkbox" data-role="indicator-toggle">
                    <span class="control-toggle-label" data-i18n="show_indicator_range">显示pH跃迁/指示剂范围</span>
                </label>
                <select class="action-btn indicator-select" data-role="indicator-select"></select>
                <label class="control-toggle-item">
                    <input type="checkbox" data-role="derivative-toggle">
                    <span class="control-toggle-label" data-i18n="show_derivative">显示一阶导数</span>
                </label>
                <label class="control-toggle-item">
                    <input type="checkbox" data-role="legend-toggle" checked>
                    <span class="control-toggle-label" data-i18n="show_legend">显示图例</span>
                </label>
                <button class="action-btn mark-clear-btn" data-role="clear-marks" data-i18n="clear_marks">清除选点</button>
            </div>
            <div class="indicator-note" data-role="indicator-note">
                <svg class="indicator-note-icon" aria-hidden="true"><use href="#icon-info"></use></svg>
                <span data-i18n="indicator_note">开启后会在图中显示滴定pH跃迁区和所选指示剂变色范围。</span>
            </div>
            <div class="chart-utility-row leap-threshold-row">
                <div class="leap-threshold-control">
                    <span class="leap-threshold-label" data-i18n="leap_threshold">跃迁判断阈值</span>
                    <input type="range" data-role="leap-threshold-slider" min="0.05" max="0.9" step="0.01" value="0.2">
                    <span class="leap-threshold-value" data-role="leap-threshold-value">0.20</span>
                </div>
                <span class="leap-threshold-label leap-threshold-help" data-i18n="leap_threshold_help">越大越严格（仅最陡区），越小越宽松（更多过渡也被视作跃迁）</span>
            </div>
            <div class="chart-utility-row chart-aspect-row compact-control-row">
                <div class="control-toggle-item">
                    <span class="chart-width-label" data-i18n="chart_width">图表宽度</span>
                    <input type="number" class="chart-width-input" data-role="chart-width" placeholder="自动" data-i18n-placeholder="placeholder_auto">
                </div>
                <select class="action-btn" data-role="chart-aspect">
                    <option value="auto" data-i18n="aspect_auto">比例自动</option>
                    <option value="16:9">16:9</option>
                    <option value="4:3">4:3</option>
                    <option value="1:1">1:1</option>
                    <option value="3:2">3:2</option>
                    <option value="2:1">2:1</option>
                </select>
                <div class="volume-pick-group">
                    <input type="number" class="volume-pick-input" data-role="volume-input" placeholder="体积 (mL)" step="0.01" data-i18n-placeholder="volume_placeholder">
                    <button class="action-btn" data-role="volume-pick-btn" data-i18n="pick_by_volume">按体积取点</button>
                </div>
                <div class="volume-pick-group">
                    <input type="number" class="volume-pick-input" data-role="ph-input" placeholder="pH" step="0.01" min="0" max="14" data-i18n-placeholder="ph_placeholder">
                    <button class="action-btn" data-role="ph-pick-btn" data-i18n="pick_by_ph">按 pH 取点</button>
                </div>
            </div>
            <div class="chart-utility-row single-tab-save-row">
                <button class="action-btn save-curve-inline-btn" data-role="save-current-curve">
                    <svg class="icon" aria-hidden="true"><use href="#icon-save"></use></svg>
                    <span data-i18n="save_current_curve_list">保存当前曲线到列表</span>
                </button>
                <button class="action-btn save-composite-inline-btn" data-role="save-to-composite">
                    <svg class="icon" aria-hidden="true"><use href="#icon-chart-bar"></use></svg>
                    <span data-i18n="save_to_composite">保存到复合对比</span>
                </button>
            </div>
            <details class="chart-appearance-panel" data-role="single-appearance-panel">
                <summary class="chart-appearance-summary" data-i18n="curve_appearance_settings">曲线与图表外观设置</summary>
                <div class="chart-utility-row axis-labels-row">
                    <span class="axis-field-group"><span data-i18n="axis_x_label">X轴标签</span> <input type="text" data-role="x-axis-label" placeholder="留空默认" data-i18n-placeholder="leave_empty_default"></span>
                    <span class="axis-field-group"><span data-i18n="axis_y_label">Y轴标签</span> <input type="text" data-role="y-axis-label" placeholder="留空默认" data-i18n-placeholder="leave_empty_default"></span>
                    <span class="axis-field-group"><span data-i18n="axis_x_line_color">X轴线颜色</span> <input type="color" data-role="x-axis-line-color" value="#666666"></span>
                    <span class="axis-field-group"><span data-i18n="axis_y_line_color">Y轴线颜色</span> <input type="color" data-role="y-axis-line-color" value="#666666"></span>
                    <span class="axis-field-group"><span data-i18n="axis_x_tick_color">X刻度颜色</span> <input type="color" data-role="x-tick-color" value="#666666"></span>
                    <span class="axis-field-group"><span data-i18n="axis_y_tick_color">Y刻度颜色</span> <input type="color" data-role="y-tick-color" value="#666666"></span>
                    <span class="axis-field-group"><span data-i18n="axis_x_grid_color">X网格颜色</span> <input type="color" data-role="x-grid-color" value="#e5e5e5"></span>
                    <span class="axis-field-group"><span data-i18n="axis_y_grid_color">Y网格颜色</span> <input type="color" data-role="y-grid-color" value="#e5e5e5"></span>
                    <label><input type="checkbox" data-role="x-ticks-visible" checked><span data-i18n="ticks_x">X刻度</span></label>
                    <label><input type="checkbox" data-role="y-ticks-visible" checked><span data-i18n="ticks_y">Y刻度</span></label>
                    <label><input type="checkbox" data-role="x-axis-arrow"><span data-i18n="arrow_x">X箭头</span></label>
                    <label><input type="checkbox" data-role="y-axis-arrow"><span data-i18n="arrow_y">Y箭头</span></label>
                </div>
                <div class="chart-utility-row curve-style-row">
                    <span class="leap-threshold-label" data-i18n="main_curve">主曲线</span>
                    <input type="color" class="inline-color-input" data-role="single-curve-color" value="#57a7bd" title="曲线颜色" data-i18n-title="lbl_curve_color">
                    <select class="action-btn curve-style-select" data-role="line-style-select" data-i18n="line_style">
                        <option value="solid" data-i18n="line_solid">实线</option>
                        <option value="dash" data-i18n="line_dash">短虚线</option>
                        <option value="longDash" data-i18n="line_long_dash">长虚线</option>
                        <option value="dot" data-i18n="line_dot">点线</option>
                        <option value="dashDot" data-i18n="line_dash_dot">点划线</option>
                        <option value="denseDash" data-i18n="line_dense_dash">密集虚线</option>
                    </select>
                    <select class="action-btn curve-style-select" data-role="point-style-select" data-i18n="point_style">
                        <option value="circle" data-i18n="point_circle">圆点</option>
                        <option value="rect" data-i18n="point_rect">方点</option>
                        <option value="rectRounded" data-i18n="point_rect_rounded">圆角方点</option>
                        <option value="rectRot" data-i18n="point_diamond">菱形点</option>
                        <option value="triangle" data-i18n="point_triangle">三角点</option>
                        <option value="star" data-i18n="point_star">星形点</option>
                        <option value="cross" data-i18n="point_cross">十字点</option>
                        <option value="crossRot" data-i18n="point_cross_rot">斜十字点</option>
                        <option value="none" data-i18n="point_none">不显示标点</option>
                    </select>
                    <span class="curve-thickness-wrap">
                        <input type="range" data-role="curve-thickness" min="0.5" max="6" step="0.1" value="2" title="曲线粗细" data-i18n-title="curve_thickness">
                        <input type="number" class="thickness-number-input" data-role="thickness-number" min="0.5" max="6" step="0.1" value="2">
                    </span>
                </div>
                <div class="chart-utility-row curve-style-row">
                    <span class="leap-threshold-label" data-i18n="derivative_line">一阶导数线</span>
                    <input type="color" class="inline-color-input" data-role="derivative-color" value="#f59e0b" title="一阶导数颜色" data-i18n-title="derivative_color">
                    <select class="action-btn curve-style-select" data-role="derivative-line-style" title="一阶导数线型" data-i18n-title="derivative_line_style">
                        <option value="solid" data-i18n="derivative_solid">导数实线</option>
                        <option value="dash" data-i18n="derivative_dash">导数短虚线</option>
                        <option value="longDash" data-i18n="derivative_long_dash">导数长虚线</option>
                        <option value="dot" data-i18n="derivative_dot">导数点线</option>
                        <option value="dashDot" data-i18n="derivative_dash_dot">导数点划线</option>
                        <option value="denseDash" data-i18n="derivative_dense_dash">导数密集虚线</option>
                    </select>
                </div>
                <div class="chart-utility-row mark-style-panel" data-role="mark-style-panel">
                    <div class="mark-style-title" data-i18n="manual_mark_appearance">手动设置标点外观</div>
                    <div class="mark-style-grid">
                        <div class="mark-style-row">
                            <div class="mark-style-field">
                                <span class="mark-style-label" data-i18n="fill_color">填充颜色</span>
                                <div class="mark-style-color">
                                    <label class="mark-style-toggle"><input type="checkbox" data-role="mark-fill-enable"><span data-i18n="enable">启用</span></label>
                                    <input type="color" data-role="mark-fill-color" value="#57a7bd">
                                </div>
                            </div>
                            <div class="mark-style-field">
                                <span class="mark-style-label" data-i18n="border_color">描边颜色</span>
                                <div class="mark-style-color">
                                    <label class="mark-style-toggle"><input type="checkbox" data-role="mark-border-enable"><span data-i18n="enable">启用</span></label>
                                    <input type="color" data-role="mark-border-color" value="#0f172a">
                                </div>
                            </div>
                        </div>
                        <div class="mark-style-row">
                            <div class="mark-style-field mark-style-field-wide">
                                <span class="mark-style-label" data-i18n="point_radius">点半径</span>
                                <div class="mark-style-radius">
                                    <label class="mark-style-toggle"><input type="checkbox" data-role="mark-radius-enable"><span data-i18n="enable">启用</span></label>
                                    <input type="range" data-role="mark-radius-slider" min="1" max="14" step="0.5" value="5">
                                    <span class="mark-style-value" data-role="mark-radius-value">5.0</span>
                                </div>
                            </div>
                            <div class="mark-style-field mark-style-field-wide">
                                <span class="mark-style-label" data-i18n="border_width">描边宽度</span>
                                <div class="mark-style-radius">
                                    <label class="mark-style-toggle"><input type="checkbox" data-role="mark-border-width-enable"><span data-i18n="enable">启用</span></label>
                                    <input type="range" data-role="mark-border-width-slider" min="0" max="8" step="0.1" value="2.8">
                                    <span class="mark-style-value" data-role="mark-border-width-value">2.8</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="mark-style-hint" data-i18n="mark_style_hint">勾选「启用」后，将以此处选择的颜色、半径或描边宽度覆盖默认样式；未启用时使用主题与曲线颜色自动计算。</div>
                </div>
                <div class="chart-utility-row grid-style-row">
                    <label class="control-toggle-item"><input type="checkbox" data-role="grid-enabled" checked><span class="control-toggle-label" data-i18n="show_grid">显示网格</span></label>
                    <input type="number" class="chart-width-input compact-number-input" data-role="grid-x-step" placeholder="横向间距 自动" min="0" step="0.1" data-i18n-placeholder="grid_x_step_placeholder">
                    <input type="number" class="chart-width-input compact-number-input" data-role="grid-y-step" placeholder="纵向间距 自动" min="0" step="0.1" data-i18n-placeholder="grid_y_step_placeholder">
                </div>
                <div class="chart-utility-row axis-range-row">
                    <div class="axis-range-group">
                        <span class="chart-width-label" data-i18n="x_range_label">X轴范围</span>
                        <input type="number" class="chart-width-input compact-number-input" data-role="x-min" placeholder="最小" step="any" data-i18n-placeholder="x_min_placeholder">
                        <span style="color:var(--text-secondary)">~</span>
                        <input type="number" class="chart-width-input compact-number-input" data-role="x-max" placeholder="最大" step="any" data-i18n-placeholder="x_max_placeholder">
                        <button class="dist-mini-btn" data-role="x-auto-btn" data-i18n="btn_auto">自动</button>
                    </div>
                    <div class="axis-range-group">
                        <span class="chart-width-label" data-i18n="y_range_title">Y轴范围</span>
                        <input type="number" class="chart-width-input compact-number-input" data-role="y-min" placeholder="最小" step="any" data-i18n-placeholder="x_min_placeholder">
                        <span style="color:var(--text-secondary)">~</span>
                        <input type="number" class="chart-width-input compact-number-input" data-role="y-max" placeholder="最大" step="any" data-i18n-placeholder="x_max_placeholder">
                        <button class="dist-mini-btn" data-role="y-auto-btn" data-i18n="btn_auto">自动</button>
                    </div>
                </div>
            </details>
            <details class="chart-appearance-panel leap-style-panel" data-role="single-leap-panel">
                <summary class="chart-appearance-summary" data-i18n="leap_zone_style">跃迁区与指示剂样式</summary>
                <div class="leap-style-content" data-role="leap-style-content">
                    <div class="leap-style-empty" data-role="leap-style-empty" data-i18n="leap_style_empty">生成滴定曲线后会显示各跃迁区样式配置</div>
                </div>
            </details>
            <details class="marks-info-panel" data-role="marks-panel">
                <summary data-i18n="selected_info">选定信息 <span class="marks-count">(0)</span></summary>
                <div class="marks-list" data-role="marks-list"></div>
            </details>
            <div class="math-output-panel">
                <div class="math-output-actions">
                    <button class="action-btn" data-role="mathematica" data-i18n="generate_mathematica">生成Mathematica代码</button>
                </div>
                <pre class="math-output" data-role="math-output"></pre>
            </div>
        </div>
    `;
}
function getMultiTabTemplate() {
    return `
        <div class="chart-container">
            <div class="chart-header">
                <div class="chart-title" data-i18n="multi_chart_title">多曲线图表</div>
                <div class="chart-actions">
                    <select class="action-btn" data-role="image-format">
                        <option value="png">PNG</option>
                        <option value="jpg">JPG</option>
                    </select>
                    <select class="action-btn" data-role="image-scale">
                        <option value="1">1x</option>
                        <option value="2">2x</option>
                        <option value="3">3x</option>
                    </select>
                    <button class="action-btn" data-role="download" data-i18n="download_chart">下载图表</button>
                </div>
            </div>
            <div class="chart-wrapper">
                <canvas data-role="chart-canvas"></canvas>
            </div>
            <div class="chart-utility-row">
                <label class="control-toggle-item">
                    <input type="checkbox" data-role="raw-toggle">
                    <span class="control-toggle-label" data-i18n="show_raw_points">显示原始数据点</span>
                </label>
                <label class="control-toggle-item">
                    <input type="checkbox" data-role="simple-label-toggle">
                    <span class="control-toggle-label" data-i18n="plain_labels">朴素标签</span>
                </label>
                <label class="control-toggle-item">
                    <input type="checkbox" data-role="legend-toggle" checked>
                    <span class="control-toggle-label" data-i18n="show_legend">显示图例</span>
                </label>
                <button class="action-btn mark-clear-btn" data-role="clear-marks" data-i18n="clear_marks">清除选点</button>
            </div>
            <div class="chart-utility-row chart-aspect-row compact-control-row">
                <div class="control-toggle-item">
                    <span class="chart-width-label" data-i18n="chart_width">图表宽度</span>
                    <input type="number" class="chart-width-input" data-role="chart-width" placeholder="自动" data-i18n-placeholder="placeholder_auto">
                </div>
                <select class="action-btn" data-role="chart-aspect">
                    <option value="auto" data-i18n="aspect_auto">比例自动</option>
                    <option value="16:9">16:9</option>
                    <option value="4:3">4:3</option>
                    <option value="1:1">1:1</option>
                    <option value="3:2">3:2</option>
                    <option value="2:1">2:1</option>
                </select>
                <div class="volume-pick-group">
                    <input type="number" class="volume-pick-input" data-role="volume-input" placeholder="体积 (mL)" step="0.01" data-i18n-placeholder="volume_placeholder">
                    <button class="action-btn" data-role="volume-pick-btn" data-i18n="pick_by_volume">按体积取点</button>
                </div>
                <div class="volume-pick-group">
                    <input type="number" class="volume-pick-input" data-role="ph-input" placeholder="pH" step="0.01" min="0" max="14" data-i18n-placeholder="ph_placeholder">
                    <button class="action-btn" data-role="ph-pick-btn" data-i18n="pick_by_ph">按 pH 取点</button>
                </div>
                <div class="curve-pick" data-role="curve-pick">
                    <button class="action-btn" data-role="curve-pick-toggle" data-i18n="select_mark_curves">选择标点曲线</button>
                    <div class="curve-pick-menu" data-role="curve-pick-menu"></div>
                </div>
            </div>
            <div class="chart-utility-row grid-style-row">
                <label class="control-toggle-item">
                    <input type="checkbox" data-role="grid-enabled" checked>
                    <span class="control-toggle-label" data-i18n="grid_label">网格</span>
                </label>
                <input type="number" class="chart-width-input compact-number-input" data-role="grid-x-step" placeholder="横向间距 自动" min="0" step="0.1" data-i18n-placeholder="grid_x_step_placeholder">
                <input type="number" class="chart-width-input compact-number-input" data-role="grid-y-step" placeholder="纵向间距 自动" min="0" step="0.1" data-i18n-placeholder="grid_y_step_placeholder">
            </div>
            <details class="chart-appearance-panel save-composite-panel" data-role="save-composite-panel">
                <summary class="chart-appearance-summary" data-i18n="save_to_composite_summary">保存到复合对比</summary>
                <div class="save-composite-content">
                    <div class="save-composite-list" data-role="save-composite-list">
                        <span class="component-filter-empty" data-i18n="visible_curves_here">可见曲线将显示在这里。</span>
                    </div>
                    <button class="action-btn save-composite-inline-btn" data-role="save-to-composite">
                        <svg class="icon" aria-hidden="true"><use href="#icon-chart-bar"></use></svg>
                        <span data-i18n="save_selected_to_composite">保存选中曲线到复合对比</span>
                    </button>
                </div>
            </details>
            <div class="chart-utility-row axis-range-row">
                <div class="axis-range-group">
                    <span class="chart-width-label" data-i18n="x_range_label">X轴范围</span>
                    <input type="number" class="chart-width-input compact-number-input" data-role="x-min" placeholder="最小" step="any" data-i18n-placeholder="x_min_placeholder">
                    <span style="color:var(--text-secondary)">~</span>
                    <input type="number" class="chart-width-input compact-number-input" data-role="x-max" placeholder="最大" step="any" data-i18n-placeholder="x_max_placeholder">
                    <button class="dist-mini-btn" data-role="x-auto-btn" data-i18n="btn_auto">自动</button>
                </div>
                <div class="axis-range-group">
                    <span class="chart-width-label" data-i18n="y_range_title">Y轴范围</span>
                    <input type="number" class="chart-width-input compact-number-input" data-role="y-min" placeholder="最小" step="any" data-i18n-placeholder="x_min_placeholder">
                    <span style="color:var(--text-secondary)">~</span>
                    <input type="number" class="chart-width-input compact-number-input" data-role="y-max" placeholder="最大" step="any" data-i18n-placeholder="x_max_placeholder">
                    <button class="dist-mini-btn" data-role="y-auto-btn" data-i18n="btn_auto">自动</button>
                </div>
            </div>
            <details class="chart-appearance-panel" data-role="multi-appearance-panel">
                <summary class="chart-appearance-summary" data-i18n="axis_style_summary">坐标轴样式设置</summary>
                <div class="chart-utility-row axis-labels-row">
                    <span class="axis-field-group"><span data-i18n="axis_x_label">X轴标签</span> <input type="text" data-role="x-axis-label" placeholder="留空默认" data-i18n-placeholder="leave_empty_default"></span>
                    <span class="axis-field-group"><span data-i18n="axis_y_label">Y轴标签</span> <input type="text" data-role="y-axis-label" placeholder="留空默认" data-i18n-placeholder="leave_empty_default"></span>
                    <span class="axis-field-group"><span data-i18n="axis_x_line_color">X轴线颜色</span> <input type="color" data-role="x-axis-line-color" value="#666666"></span>
                    <span class="axis-field-group"><span data-i18n="axis_y_line_color">Y轴线颜色</span> <input type="color" data-role="y-axis-line-color" value="#666666"></span>
                    <span class="axis-field-group"><span data-i18n="axis_x_tick_color">X刻度颜色</span> <input type="color" data-role="x-tick-color" value="#666666"></span>
                    <span class="axis-field-group"><span data-i18n="axis_y_tick_color">Y刻度颜色</span> <input type="color" data-role="y-tick-color" value="#666666"></span>
                    <span class="axis-field-group"><span data-i18n="axis_x_grid_color">X网格颜色</span> <input type="color" data-role="x-grid-color" value="#e5e5e5"></span>
                    <span class="axis-field-group"><span data-i18n="axis_y_grid_color">Y网格颜色</span> <input type="color" data-role="y-grid-color" value="#e5e5e5"></span>
                    <label><input type="checkbox" data-role="x-ticks-visible" checked><span data-i18n="ticks_x">X刻度</span></label>
                    <label><input type="checkbox" data-role="y-ticks-visible" checked><span data-i18n="ticks_y">Y刻度</span></label>
                    <label><input type="checkbox" data-role="x-axis-arrow"><span data-i18n="arrow_x">X箭头</span></label>
                    <label><input type="checkbox" data-role="y-axis-arrow"><span data-i18n="arrow_y">Y箭头</span></label>
                </div>
            </details>
            <div class="curve-select-panel">
                <div class="curve-select-title" data-i18n="draw_curves">绘制曲线</div>
                <div class="curve-select-list curve-visibility-simple-list" data-role="curve-visibility-list"></div>
            </div>
            <div class="curve-select-panel">
                <div class="curve-select-title" data-i18n="curve_style">曲线样式</div>
                <div class="curve-style-settings-list" data-role="curve-style-list"></div>
            </div>
            <details class="marks-info-panel" data-role="marks-panel">
                <summary data-i18n="selected_info">选定信息 <span class="marks-count">(0)</span></summary>
                <div class="marks-list" data-role="marks-list"></div>
            </details>
            <details class="intersection-panel" data-role="intersection-panel">
                <summary data-i18n="intersection_title">交点查找</summary>
                <div class="intersection-form" data-role="intersection-form">
                    <select data-role="intersection-curve1"></select>
                    <span style="color:var(--text-secondary);font-size:0.8rem;">&</span>
                    <select data-role="intersection-curve2"></select>
                    <button class="intersection-btn" data-role="intersection-btn" data-i18n="solve_intersection">求解交点</button>
                </div>
            </details>
            <div class="math-output-panel">
                <div class="math-output-actions">
                    <button class="action-btn" data-role="mathematica" data-i18n="generate_mathematica">生成Mathematica代码</button>
                </div>
                <pre class="math-output" data-role="math-output"></pre>
            </div>
        </div>
    `;
}
function refreshIndicatorSelect(tab) {
    const pane = getTabContent(tab);
    if (!pane) return;
    const indicatorSelect = pane.querySelector('[data-role="indicator-select"]');
    if (!indicatorSelect) return;
    const selected = tab.selectedIndicatorId || 'phenolphthalein';
    indicatorSelect.innerHTML = acidBaseIndicators.map(item => {
        const label = `${getIndicatorLabel(item)} (${item.range[0].toFixed(1)}-${item.range[1].toFixed(1)})`;
        return `<option value="${item.id}">${label}</option>`;
    }).join('');
    indicatorSelect.value = selected;
    indicatorSelect.dispatchEvent(new Event('change', { bubbles: true }));
}
function refreshAllIndicatorSelects() {
    chartTabs.forEach(tab => {
        if (tab.type === 'single') refreshIndicatorSelect(tab);
    });
}
function setupTabControls(tab, pane) {
    const rawToggle = pane.querySelector('[data-role="raw-toggle"]');
    const simpleToggle = pane.querySelector('[data-role="simple-label-toggle"]');
    const indicatorToggle = pane.querySelector('[data-role="indicator-toggle"]');
    const indicatorSelect = pane.querySelector('[data-role="indicator-select"]');
    const derivativeToggle = pane.querySelector('[data-role="derivative-toggle"]');
    const legendToggle = pane.querySelector('[data-role="legend-toggle"]');
    const derivativeColorInput = pane.querySelector('[data-role="derivative-color"]');
    const derivativeLineStyleSelect = pane.querySelector('[data-role="derivative-line-style"]');
    const leapThresholdSlider = pane.querySelector('[data-role="leap-threshold-slider"]');
    const leapThresholdValue = pane.querySelector('[data-role="leap-threshold-value"]');
    const singleCurveColor = pane.querySelector('[data-role="single-curve-color"]');
    const lineStyleSelect = pane.querySelector('[data-role="line-style-select"]');
    const pointStyleSelect = pane.querySelector('[data-role="point-style-select"]');
    const clearBtn = pane.querySelector('[data-role="clear-marks"]');
    const downloadBtn = pane.querySelector('[data-role="download"]');
    const mathBtn = pane.querySelector('[data-role="mathematica"]');
    const mathOutput = pane.querySelector('[data-role="math-output"]');
    const equationBtn = pane.querySelector('[data-role="equation"]');
    const equationOutput = pane.querySelector('[data-role="equation-output"]');
    const widthInput = pane.querySelector('[data-role="chart-width"]');
    const aspectSelect = pane.querySelector('[data-role="chart-aspect"]');
    const gridEnabled = pane.querySelector('[data-role="grid-enabled"]');
    const gridXStep = pane.querySelector('[data-role="grid-x-step"]');
    const gridYStep = pane.querySelector('[data-role="grid-y-step"]');
    const volumeInput = pane.querySelector('[data-role="volume-input"]');
    const volumeBtn = pane.querySelector('[data-role="volume-pick-btn"]');
    const phInput = pane.querySelector('[data-role="ph-input"]');
    const phBtn = pane.querySelector('[data-role="ph-pick-btn"]');
    const saveInlineBtn = pane.querySelector('[data-role="save-current-curve"]');
    const curvePickToggle = pane.querySelector('[data-role="curve-pick-toggle"]');
    const curvePickMenu = pane.querySelector('[data-role="curve-pick-menu"]');
    const canvas = pane.querySelector('[data-role="chart-canvas"]');
    rawToggle.checked = tab.showRawPoints;
    simpleToggle.checked = tab.simpleLabelMode;
    if (indicatorSelect) {
        refreshIndicatorSelect(tab);
    }
    if (indicatorToggle) {
        indicatorToggle.checked = !!tab.showIndicatorRange;
        indicatorToggle.addEventListener('change', () => {
            tab.showIndicatorRange = indicatorToggle.checked;
            updateStats(tab, tab.volumes, tab.phs);
            refreshTabAnnotations(tab);
        });
    }
    if (indicatorSelect) {
        indicatorSelect.addEventListener('change', () => {
            tab.selectedIndicatorId = indicatorSelect.value;
            clearAnnotationLabelOffsets(tab);
            updateStats(tab, tab.volumes, tab.phs);
            refreshTabAnnotations(tab);
        });
    }
    rawToggle.addEventListener('change', () => {
        tab.showRawPoints = rawToggle.checked;
        renderActiveTabChart();
    });
    simpleToggle.addEventListener('change', () => {
        tab.simpleLabelMode = simpleToggle.checked;
        refreshTabAnnotations(tab);
    });
    if (legendToggle) {
        legendToggle.checked = tab.showLegend !== false;
        legendToggle.addEventListener('change', () => {
            tab.showLegend = legendToggle.checked;
            renderActiveTabChart();
        });
    }
    if (lineStyleSelect) {
        lineStyleSelect.value = tab.curveLineStyle || 'solid';
        lineStyleSelect.addEventListener('change', () => {
            tab.curveLineStyle = lineStyleSelect.value || 'solid';
            renderActiveTabChart();
        });
    }
    if (singleCurveColor) {
        singleCurveColor.value = config.curveColor || '#57a7bd';
        singleCurveColor.addEventListener('input', () => {
            config.curveColor = singleCurveColor.value || '#57a7bd';
            const rootColorInput = document.getElementById('curveColor');
            if (rootColorInput) rootColorInput.value = config.curveColor;
            if (tab.type === 'single' && Array.isArray(tab.volumes) && tab.volumes.length) {
                updateChart(tab, tab.volumes, tab.phs, config.curveColor);
            }
        });
    }
    if (pointStyleSelect) {
        pointStyleSelect.value = tab.curvePointStyle || 'circle';
        pointStyleSelect.addEventListener('change', () => {
            tab.curvePointStyle = pointStyleSelect.value || 'circle';
            refreshTabAnnotations(tab);
        });
    }
    const thicknessSlider = pane.querySelector('[data-role="curve-thickness"]');
    const thicknessNum = pane.querySelector('[data-role="thickness-number"]');
    if (thicknessSlider && thicknessNum) {
        thicknessSlider.value = tab.curveBorderWidth ?? 2;
        thicknessNum.value = thicknessSlider.value;
        thicknessSlider.addEventListener('input', () => {
            const v = parseFloat(thicknessSlider.value);
            thicknessNum.value = v.toFixed(1);
            tab.curveBorderWidth = v;
            renderActiveTabChart();
        });
        thicknessNum.addEventListener('input', () => {
            var v = parseFloat(thicknessNum.value);
            if (Number.isFinite(v)) {
                v = Math.max(0.5, Math.min(6, v));
                thicknessSlider.value = v;
                tab.curveBorderWidth = v;
                renderActiveTabChart();
            }
        });
    }
    // v6.5: manual mark-style panel (single-curve tab only)
    const markStylePanel = pane.querySelector('[data-role="mark-style-panel"]');
    if (markStylePanel && tab.type === 'single') {
        const markFillEnable = markStylePanel.querySelector('[data-role="mark-fill-enable"]');
        const markFillColor = markStylePanel.querySelector('[data-role="mark-fill-color"]');
        const markBorderEnable = markStylePanel.querySelector('[data-role="mark-border-enable"]');
        const markBorderColor = markStylePanel.querySelector('[data-role="mark-border-color"]');
        const markRadiusEnable = markStylePanel.querySelector('[data-role="mark-radius-enable"]');
        const markRadiusSlider = markStylePanel.querySelector('[data-role="mark-radius-slider"]');
        const markRadiusValue = markStylePanel.querySelector('[data-role="mark-radius-value"]');
        const markBorderWidthEnable = markStylePanel.querySelector('[data-role="mark-border-width-enable"]');
        const markBorderWidthSlider = markStylePanel.querySelector('[data-role="mark-border-width-slider"]');
        const markBorderWidthValue = markStylePanel.querySelector('[data-role="mark-border-width-value"]');
        if (markFillEnable) markFillEnable.checked = !!tab.markFillEnabled;
        if (markFillColor) markFillColor.value = tab.markFillColor || '#57a7bd';
        if (markBorderEnable) markBorderEnable.checked = !!tab.markBorderEnabled;
        if (markBorderColor) markBorderColor.value = tab.markBorderColor || '#0f172a';
        if (markRadiusEnable) markRadiusEnable.checked = !!tab.markRadiusEnabled;
        if (markRadiusSlider) markRadiusSlider.value = String(tab.markRadius ?? 5);
        if (markRadiusValue) markRadiusValue.textContent = (tab.markRadius ?? 5).toFixed(1);
        if (markBorderWidthEnable) markBorderWidthEnable.checked = !!tab.markBorderWidthEnabled;
        if (markBorderWidthSlider) markBorderWidthSlider.value = String(tab.markBorderWidth ?? 2.8);
        if (markBorderWidthValue) markBorderWidthValue.textContent = (tab.markBorderWidth ?? 2.8).toFixed(1);
        if (markFillEnable) markFillEnable.addEventListener('change', () => {
            tab.markFillEnabled = markFillEnable.checked;
            refreshTabAnnotations(tab);
        });
        if (markFillColor) markFillColor.addEventListener('input', () => {
            tab.markFillColor = markFillColor.value || '#57a7bd';
            if (tab.markFillEnabled) refreshTabAnnotations(tab);
        });
        if (markBorderEnable) markBorderEnable.addEventListener('change', () => {
            tab.markBorderEnabled = markBorderEnable.checked;
            refreshTabAnnotations(tab);
        });
        if (markBorderColor) markBorderColor.addEventListener('input', () => {
            tab.markBorderColor = markBorderColor.value || '#0f172a';
            if (tab.markBorderEnabled) refreshTabAnnotations(tab);
        });
        if (markRadiusEnable) markRadiusEnable.addEventListener('change', () => {
            tab.markRadiusEnabled = markRadiusEnable.checked;
            refreshTabAnnotations(tab);
        });
        if (markRadiusSlider) markRadiusSlider.addEventListener('input', () => {
            const val = parseFloat(markRadiusSlider.value);
            if (!Number.isFinite(val)) return;
            tab.markRadius = val;
            if (markRadiusValue) markRadiusValue.textContent = val.toFixed(1);
            if (tab.markRadiusEnabled) refreshTabAnnotations(tab);
        });
        if (markBorderWidthEnable) markBorderWidthEnable.addEventListener('change', () => {
            tab.markBorderWidthEnabled = markBorderWidthEnable.checked;
            refreshTabAnnotations(tab);
        });
        if (markBorderWidthSlider) markBorderWidthSlider.addEventListener('input', () => {
            const val = parseFloat(markBorderWidthSlider.value);
            if (!Number.isFinite(val)) return;
            tab.markBorderWidth = val;
            if (markBorderWidthValue) markBorderWidthValue.textContent = val.toFixed(1);
            if (tab.markBorderWidthEnabled) refreshTabAnnotations(tab);
        });
    } else if (markStylePanel) {
        markStylePanel.style.display = 'none';
    }
    if (derivativeToggle) {
        derivativeToggle.checked = !!tab.showDerivative;
        derivativeToggle.addEventListener('change', () => {
            tab.showDerivative = derivativeToggle.checked;
            renderActiveTabChart();
        });
    }
    if (derivativeColorInput) {
        derivativeColorInput.value = tab.derivativeColor || '#f59e0b';
        derivativeColorInput.addEventListener('input', () => {
            tab.derivativeColor = derivativeColorInput.value || '#f59e0b';
            if (tab.showDerivative) renderActiveTabChart();
        });
    }
    if (derivativeLineStyleSelect) {
        derivativeLineStyleSelect.value = tab.derivativeLineStyle || 'dash';
        derivativeLineStyleSelect.addEventListener('change', () => {
            tab.derivativeLineStyle = derivativeLineStyleSelect.value || 'dash';
            if (tab.showDerivative) renderActiveTabChart();
        });
    }
    if (leapThresholdSlider) {
        const initial = Number.isFinite(tab.leapThreshold) ? tab.leapThreshold : 0.2;
        leapThresholdSlider.value = String(initial);
        if (leapThresholdValue) leapThresholdValue.textContent = initial.toFixed(2);
        leapThresholdSlider.addEventListener('input', () => {
            const val = parseFloat(leapThresholdSlider.value);
            if (!Number.isFinite(val)) return;
            tab.leapThreshold = val;
            clearAnnotationLabelOffsets(tab);
            if (leapThresholdValue) leapThresholdValue.textContent = val.toFixed(2);
            if (Array.isArray(tab.volumes) && Array.isArray(tab.phs) && tab.volumes.length) {
                updateStats(tab, tab.volumes, tab.phs);
                refreshTabAnnotations(tab);
            }
        });
    }
    clearBtn.addEventListener('click', () => clearAllMarks(tab));
    downloadBtn.addEventListener('click', () => {
        if (tab.type === 'multi') {
            downloadMultiChart(tab);
        } else {
            downloadChart(tab);
        }
    });
    if (saveInlineBtn) {
        saveInlineBtn.addEventListener('click', saveCurrentCurve);
    }
    const saveCompositeBtn = pane.querySelector('[data-role="save-to-composite"]');
    const saveCompositeList = pane.querySelector('[data-role="save-composite-list"]');
    if (saveCompositeList) {
        updateSaveCompositeList(tab);
    }
    if (saveCompositeBtn) {
        saveCompositeBtn.addEventListener('click', () => {
            if (tab.type === 'multi') {
                saveSelectedMultiCurvesToComposite(tab);
            } else {
                saveCurrentCurveToComposite(tab);
            }
        });
    }
    if (mathBtn) {
        mathBtn.addEventListener('click', () => {
            const setOutput = (text) => {
                if (!mathOutput) return;
                mathOutput.textContent = text || '';
                mathOutput.classList.toggle('active', !!text);
            };
            if (tab.type === 'multi') {
                const indices = Array.isArray(tab.curveSelection) ? tab.curveSelection.filter(i => Number.isFinite(i)) : [];
                if (indices.length === 0) {
                    showAlert(t('提示', 'Tip'), t('请先在"绘制曲线"中勾选要导出的曲线', 'Please check curves to export in "Draw curves" first'), 'warning');
                    return;
                }
                const curves = indices.map(idx => savedCurves[idx]).filter(curve => curve && curve.params);
                if (curves.length === 0) {
                    showAlert(t('提示', 'Tip'), t('未找到选定曲线', 'Selected curve not found'), 'warning');
                    return;
                }
                const code = buildMathematicaCodeFromCurves(curves, tab);
                if (!code) {
                    showAlert(t('提示', 'Tip'), t('未找到可用于求根生成的曲线参数', 'No curve parameters available for root generation'), 'warning');
                    return;
                }
                copyText(code);
                setOutput(code);
                showAlert(t('成功', 'Success'), t('Mathematica代码已复制到剪贴板', 'Mathematica code copied to clipboard'), 'check');
                return;
            }
            const code = buildMathematicaCodeFromConfig(config, tab);
            copyText(code);
            setOutput(code);
            showAlert(t('成功', 'Success'), t('Mathematica代码已复制到剪贴板', 'Mathematica code copied to clipboard'), 'check');
        });
    }
    if (equationBtn && tab.type === 'single') {
        equationBtn.addEventListener('click', () => {
            const setOutput = (html) => {
                if (!equationOutput) return;
                equationOutput.innerHTML = html || '';
                equationOutput.classList.toggle('active', !!html);
                if (window.MathJax && typeof MathJax.typesetPromise === 'function') {
                    MathJax.typesetPromise([equationOutput]).catch(() => {});
                }
            };
            const equationData = buildLatexEquation(config);
            const html = generateEquationHTML(equationData);
            setOutput(html);
            if (typeof translateStaticUI === 'function') translateStaticUI();
        });
    }
    if (widthInput) widthInput.addEventListener('input', () => applyChartWidth(tab, widthInput.value));
    if (aspectSelect) aspectSelect.addEventListener('change', () => applyChartAspectRatio(tab, aspectSelect.value));
    if (gridEnabled) {
        gridEnabled.checked = tab.gridEnabled !== false;
        gridEnabled.addEventListener('change', () => {
            tab.gridEnabled = gridEnabled.checked;
            renderActiveTabChart();
        });
    }
    if (gridXStep) {
        gridXStep.value = tab.gridXStep > 0 ? String(tab.gridXStep) : '';
        gridXStep.addEventListener('input', () => {
            const val = parseFloat(gridXStep.value);
            tab.gridXStep = Number.isFinite(val) && val > 0 ? val : 0;
            renderActiveTabChart();
        });
    }
    if (gridYStep) {
        gridYStep.value = tab.gridYStep > 0 ? String(tab.gridYStep) : '';
        gridYStep.addEventListener('input', () => {
            const val = parseFloat(gridYStep.value);
            tab.gridYStep = Number.isFinite(val) && val > 0 ? val : 0;
            renderActiveTabChart();
        });
    }
    // v7.0.9: axis range controls
    const xMinInput = pane.querySelector('[data-role="x-min"]');
    const xMaxInput = pane.querySelector('[data-role="x-max"]');
    const xAutoBtn = pane.querySelector('[data-role="x-auto-btn"]');
    const yMinInput = pane.querySelector('[data-role="y-min"]');
    const yMaxInput = pane.querySelector('[data-role="y-max"]');
    const yAutoBtn = pane.querySelector('[data-role="y-auto-btn"]');
    if (xMinInput) {
        xMinInput.value = Number.isFinite(tab.xMin) ? String(tab.xMin) : '';
        xMinInput.addEventListener('change', () => {
            const val = parseFloat(xMinInput.value);
            tab.xMin = Number.isFinite(val) ? val : undefined;
            renderActiveTabChart();
        });
    }
    if (xMaxInput) {
        xMaxInput.value = Number.isFinite(tab.xMax) ? String(tab.xMax) : '';
        xMaxInput.addEventListener('change', () => {
            const val = parseFloat(xMaxInput.value);
            tab.xMax = Number.isFinite(val) ? val : undefined;
            renderActiveTabChart();
        });
    }
    if (xAutoBtn) {
        xAutoBtn.addEventListener('click', () => {
            tab.xMin = undefined;
            tab.xMax = undefined;
            if (xMinInput) xMinInput.value = '';
            if (xMaxInput) xMaxInput.value = '';
            renderActiveTabChart();
        });
    }
    if (yMinInput) {
        yMinInput.value = Number.isFinite(tab.yMin) ? String(tab.yMin) : '';
        yMinInput.addEventListener('change', () => {
            const val = parseFloat(yMinInput.value);
            tab.yMin = Number.isFinite(val) ? val : undefined;
            renderActiveTabChart();
        });
    }
    if (yMaxInput) {
        yMaxInput.value = Number.isFinite(tab.yMax) ? String(tab.yMax) : '';
        yMaxInput.addEventListener('change', () => {
            const val = parseFloat(yMaxInput.value);
            tab.yMax = Number.isFinite(val) ? val : undefined;
            renderActiveTabChart();
        });
    }
    if (yAutoBtn) {
        yAutoBtn.addEventListener('click', () => {
            tab.yMin = undefined;
            tab.yMax = undefined;
            if (yMinInput) yMinInput.value = '';
            if (yMaxInput) yMaxInput.value = '';
            renderActiveTabChart();
        });
    }
    // v7.0: axis label and style controls
    const xAxisLabelInput = pane.querySelector('[data-role="x-axis-label"]');
    const yAxisLabelInput = pane.querySelector('[data-role="y-axis-label"]');
    const xTickColorInput = pane.querySelector('[data-role="x-tick-color"]');
    const yTickColorInput = pane.querySelector('[data-role="y-tick-color"]');
    const xGridColorInput = pane.querySelector('[data-role="x-grid-color"]');
    const yGridColorInput = pane.querySelector('[data-role="y-grid-color"]');
    const xTicksVisibleCb = pane.querySelector('[data-role="x-ticks-visible"]');
    const yTicksVisibleCb = pane.querySelector('[data-role="y-ticks-visible"]');
    const xAxisArrowCb = pane.querySelector('[data-role="x-axis-arrow"]');
    const yAxisArrowCb = pane.querySelector('[data-role="y-axis-arrow"]');
    const xAxisLineColorInput = pane.querySelector('[data-role="x-axis-line-color"]');
    const yAxisLineColorInput = pane.querySelector('[data-role="y-axis-line-color"]');
    if (xAxisLabelInput) {
        xAxisLabelInput.value = tab.xAxisLabel || '';
        xAxisLabelInput.addEventListener('input', () => { tab.xAxisLabel = xAxisLabelInput.value; renderActiveTabChart(); });
    }
    if (yAxisLabelInput) {
        yAxisLabelInput.value = tab.yAxisLabel || '';
        yAxisLabelInput.addEventListener('input', () => { tab.yAxisLabel = yAxisLabelInput.value; renderActiveTabChart(); });
    }
    if (xAxisLineColorInput) {
        xAxisLineColorInput.value = tab.xAxisLineColor || '#666666';
        xAxisLineColorInput.addEventListener('input', () => { tab.xAxisLineColor = xAxisLineColorInput.value; renderActiveTabChart(); });
    }
    if (yAxisLineColorInput) {
        yAxisLineColorInput.value = tab.yAxisLineColor || '#666666';
        yAxisLineColorInput.addEventListener('input', () => { tab.yAxisLineColor = yAxisLineColorInput.value; renderActiveTabChart(); });
    }
    if (xTickColorInput) {
        xTickColorInput.value = tab.xTickColor || '#666666';
        xTickColorInput.addEventListener('input', () => { tab.xTickColor = xTickColorInput.value; renderActiveTabChart(); });
    }
    if (yTickColorInput) {
        yTickColorInput.value = tab.yTickColor || '#666666';
        yTickColorInput.addEventListener('input', () => { tab.yTickColor = yTickColorInput.value; renderActiveTabChart(); });
    }
    if (xGridColorInput) {
        xGridColorInput.value = tab.xGridColor || '#e5e5e5';
        xGridColorInput.addEventListener('input', () => { tab.xGridColor = xGridColorInput.value; renderActiveTabChart(); });
    }
    if (yGridColorInput) {
        yGridColorInput.value = tab.yGridColor || '#e5e5e5';
        yGridColorInput.addEventListener('input', () => { tab.yGridColor = yGridColorInput.value; renderActiveTabChart(); });
    }
    if (xTicksVisibleCb) {
        xTicksVisibleCb.checked = tab.xTicksVisible !== false;
        xTicksVisibleCb.addEventListener('change', () => { tab.xTicksVisible = xTicksVisibleCb.checked; renderActiveTabChart(); });
    }
    if (yTicksVisibleCb) {
        yTicksVisibleCb.checked = tab.yTicksVisible !== false;
        yTicksVisibleCb.addEventListener('change', () => { tab.yTicksVisible = yTicksVisibleCb.checked; renderActiveTabChart(); });
    }
    if (xAxisArrowCb) {
        xAxisArrowCb.checked = !!tab.xAxisArrow;
        xAxisArrowCb.addEventListener('change', () => { tab.xAxisArrow = xAxisArrowCb.checked; renderActiveTabChart(); });
    }
    if (yAxisArrowCb) {
        yAxisArrowCb.checked = !!tab.yAxisArrow;
        yAxisArrowCb.addEventListener('change', () => { tab.yAxisArrow = yAxisArrowCb.checked; renderActiveTabChart(); });
    }
    volumeBtn.addEventListener('click', () => {
        const value = parseFloat(volumeInput.value);
        if (!Number.isFinite(value)) return;
        pickPointByVolume(tab, value);
    });
    volumeInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            const value = parseFloat(volumeInput.value);
            if (!Number.isFinite(value)) return;
            pickPointByVolume(tab, value);
        }
    });
    if (phBtn && phInput) {
        phBtn.addEventListener('click', () => {
            const value = parseFloat(phInput.value);
            if (!Number.isFinite(value)) return;
            pickPointByPH(tab, value);
        });
        phInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                const value = parseFloat(phInput.value);
                if (!Number.isFinite(value)) return;
                pickPointByPH(tab, value);
            }
        });
    }
    if (curvePickToggle && curvePickMenu) {
        curvePickToggle.addEventListener('click', (event) => {
            event.stopPropagation();
            // v7.0.9: 将菜单挂载到 body，避免 chart-container 的 transform 创建 containing block 导致 fixed 定位偏移
            if (curvePickMenu.parentElement !== document.body) {
                document.body.appendChild(curvePickMenu);
            }
            const rect = curvePickToggle.getBoundingClientRect();
            curvePickMenu.style.left = `${rect.left}px`;
            curvePickMenu.style.top = `${rect.bottom + 6}px`;
            curvePickMenu.style.minWidth = `${Math.max(160, rect.width)}px`;
            curvePickMenu.classList.toggle('active');
        });
        document.addEventListener('click', (event) => {
            const isToggle = event.target === curvePickToggle || curvePickToggle.contains(event.target);
            if (!curvePickMenu.contains(event.target) && !isToggle) {
                curvePickMenu.classList.remove('active');
            }
        });
        updateCurvePickMenu(tab);
    }
    if (tab.type === 'multi') {
        updateCurveVisibilityList(tab);
    }
    setupCanvasInteractions(tab, canvas);
}
function updateCurveVisibilityList(tab) {
    if (!tab || tab.type !== 'multi') return;
    const pane = getTabContent(tab);
    if (!pane) return;
    const list = pane.querySelector('[data-role="curve-visibility-list"]');
    if (!list) {
        updateMultiCurveStyleList(tab);
        return;
    }
    const availableIndices = savedCurves.map((_, index) => index);
    if (!tab.curveSelection || tab.curveSelection.length === 0) {
        tab.curveSelection = availableIndices.slice();
    } else {
        tab.curveSelection = tab.curveSelection.filter(index => Number.isFinite(index) && savedCurves[index]);
    }
    list.innerHTML = '';
    if (!availableIndices.length) {
        list.innerHTML = '<div class="curve-pick-empty" data-i18n="no_curves_available">暂无可用曲线</div>';
        updateMultiCurveStyleList(tab);
        return;
    }
    availableIndices.forEach(index => {
        const curve = savedCurves[index];
        if (!curve) return;
        const item = document.createElement('label');
        item.className = 'curve-visible-row';
        item.innerHTML = `
            <input type="checkbox" class="curve-checkbox" data-index="${index}">
            <span class="color-dot" style="color: ${curve.color}"></span>
            <span class="curve-visible-name" style="color: ${curve.color}">${curve.name}</span>
        `;
        const checkbox = item.querySelector('input');
        checkbox.checked = tab.curveSelection.includes(index);
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                if (!tab.curveSelection.includes(index)) {
                    tab.curveSelection.push(index);
                }
            } else {
                tab.curveSelection = tab.curveSelection.filter(val => val !== index);
            }
            updateMultiChart(tab);
            updateCurvePickMenu(tab);
        });
        list.appendChild(item);
    });
    updateMultiCurveStyleList(tab);
    updateSaveCompositeList(tab);
    if (typeof translateStaticUI === 'function') translateStaticUI();
}
function updateSaveCompositeList(tab) {
    if (!tab || tab.type !== 'multi') return;
    const pane = getTabContent(tab);
    if (!pane) return;
    const list = pane.querySelector('[data-role="save-composite-list"]');
    if (!list) return;
    const visibleIndices = Array.isArray(tab.curveSelection)
        ? tab.curveSelection.filter(index => Number.isFinite(index) && savedCurves[index])
        : [];
    if (!visibleIndices.length) {
        list.innerHTML = '<span class="component-filter-empty" data-i18n="no_visible_curves_tab">当前标签页没有可见曲线。</span>';
        return;
    }
    if (!tab.saveCompositeSelection) tab.saveCompositeSelection = new Set();
    list.innerHTML = visibleIndices.map(index => {
        const curve = savedCurves[index];
        return `
            <label class="component-filter-item" title="${curve.name}">
                <input type="checkbox" data-save-index="${index}" ${tab.saveCompositeSelection.has(String(index)) ? 'checked' : ''}>
                <span class="component-filter-swatch" style="background:${curve.color};"></span>
                <span class="component-filter-label">${curve.name}</span>
            </label>`;
    }).join('');
    list.querySelectorAll('[data-save-index]').forEach(cb => {
        cb.addEventListener('change', () => {
            const idx = cb.dataset.saveIndex;
            if (!tab.saveCompositeSelection) tab.saveCompositeSelection = new Set();
            if (cb.checked) tab.saveCompositeSelection.add(idx);
            else tab.saveCompositeSelection.delete(idx);
        });
    });
    if (typeof translateStaticUI === 'function') translateStaticUI();
}
function saveSelectedMultiCurvesToComposite(tab) {
    if (!tab || tab.type !== 'multi') return;
    if (!Array.isArray(tab.datasets) || !tab.datasets.length) return;
    const selection = tab.saveCompositeSelection || new Set();
    const xAxisLabel = tab.xAxisLabel || 'V';
    let added = 0;
    const yAxisLabel = tab.yAxisLabel || t('pH', 'pH');
    const xUnit = tab.xAxisLabel || 'mL';
    const yUnit = t('pH', 'pH');
    tab.datasets.forEach((dataset, idx) => {
        if (!dataset.visible || !Array.isArray(dataset.data) || !dataset.data.length) return;
        const meta = dataset.meta || {};
        const savedIndex = meta.savedCurveIndex;
        if (Number.isFinite(savedIndex) && !selection.has(String(savedIndex))) return;
        if (!Number.isFinite(savedIndex)) return;
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
        showAlert(t('提示', 'Tip'), t('请至少勾选一条曲线', 'Please select at least one curve'), '?');
    }
}
function updateMultiCurveStyleList(tab) {
    if (!tab || tab.type !== 'multi') return;
    const pane = getTabContent(tab);
    if (!pane) return;
    const list = pane.querySelector('[data-role="curve-style-list"]');
    if (!list) return;
    list.innerHTML = '';
    const availableIndices = savedCurves.map((_, index) => index);
    if (!availableIndices.length) {
        list.innerHTML = '<span class="component-filter-empty" data-i18n="save_curves_to_style">保存曲线后可设置每条曲线的样式。</span>';
        return;
    }
    availableIndices.forEach(index => {
        const curve = savedCurves[index];
        if (!curve) return;
        const markStyle = getCurveMarkStyleConfig(curve) || {
            fillEnabled: false, fillColor: curve.color || '#57a7bd',
            borderEnabled: false, borderColor: '#0f172a',
            radiusEnabled: false, radius: 5,
            borderWidthEnabled: false, borderWidth: 2.8
        };
        curve.markStyle = cloneMarkStyleConfig(markStyle);
        const item = document.createElement('details');
        item.className = 'curve-settings-item';
        // v6.5.6: 使用 curve.id 或 index 作为持久化 key, 防止重渲染时丢失展开状态
        const persistKey = 'multi:' + (curve.id || curve.name || ('idx' + index));
        item.setAttribute('data-persist-key', persistKey);
        item.innerHTML = `
            <summary class="curve-settings-summary">
                <span class="component-filter-swatch" style="background:${curve.color || '#57a7bd'};"></span>
                <span style="color: ${curve.color}">${curve.name}</span>
            </summary>
            <div class="curve-settings-grid">
                <label><span data-i18n="line_color">线色</span> <input type="color" data-role="curve-color" value="${curve.color || '#57a7bd'}"></label>
                <label><span data-i18n="line_style">线型</span>
                    <select data-role="curve-line-style">
                        <option value="solid" data-i18n="line_solid">实线</option><option value="dash" data-i18n="line_dash">短虚线</option><option value="longDash" data-i18n="line_long_dash">长虚线</option><option value="dot" data-i18n="line_dot">点线</option><option value="dashDot" data-i18n="line_dash_dot">点划线</option><option value="denseDash" data-i18n="line_dense_dash">密集虚线</option>
                    </select>
                </label>
                <label><span data-i18n="point_style">点型</span>
                    <select data-role="curve-point-style">
                        <option value="circle" data-i18n="point_circle">圆点</option><option value="rect" data-i18n="point_rect">方点</option><option value="rectRounded" data-i18n="point_rect_rounded">圆角方点</option><option value="rectRot" data-i18n="point_diamond">菱形点</option><option value="triangle" data-i18n="point_triangle">三角点</option><option value="star" data-i18n="point_star">星形点</option><option value="cross" data-i18n="point_cross">十字点</option><option value="crossRot" data-i18n="point_cross_rot">斜十字点</option><option value="none" data-i18n="point_none">不显示</option>
                    </select>
                </label>
                <label><span data-i18n="point_fill">点填充</span> <input type="color" data-role="mark-fill-color" value="${markStyle.fillColor || curve.color || '#57a7bd'}"></label>
                <label><span data-i18n="point_border">点描边</span> <input type="color" data-role="mark-border-color" value="${markStyle.borderColor || '#0f172a'}"></label>
                <label><span data-i18n="point_size">点大小</span> <input type="number" data-role="mark-radius" min="1" max="14" step="0.5" value="${markStyle.radius ?? 5}"></label>
                <label class="curve-width-label"><span data-i18n="line_width">粗细</span> <input type="range" data-role="curve-width" min="0.5" max="6" step="0.1" value="${curve.borderWidth ?? 2}"> <input type="number" class="thickness-number-input width-number" data-role="curve-width-number" min="0.5" max="6" step="0.1" value="${(curve.borderWidth ?? 2).toFixed(1)}"></label>
            </div>
        `;
        const lineSelect = item.querySelector('[data-role="curve-line-style"]');
        const pointSelect = item.querySelector('[data-role="curve-point-style"]');
        const colorInput = item.querySelector('[data-role="curve-color"]');
        const fillInput = item.querySelector('[data-role="mark-fill-color"]');
        const borderInput = item.querySelector('[data-role="mark-border-color"]');
        const radiusInput = item.querySelector('[data-role="mark-radius"]');
        const widthInput = item.querySelector('[data-role="curve-width"]');
        const widthNum = item.querySelector('[data-role="curve-width-number"]');
        if (lineSelect) lineSelect.value = curve.lineStyle || curve.params?.curveLineStyle || 'solid';
        if (pointSelect) pointSelect.value = curve.pointStyle || curve.params?.curvePointStyle || 'circle';
        if (widthInput && !curve.borderWidth) curve.borderWidth = 2;
        // v6.5.6: 样式变化只重绘画布与外部菜单, 不重建本列表 -> 不会折叠
        const applyStyle = () => {
            curve.markStyle = cloneMarkStyleConfig({
                fillEnabled: true,
                fillColor: fillInput?.value || curve.color || '#57a7bd',
                borderEnabled: true,
                borderColor: borderInput?.value || '#0f172a',
                radiusEnabled: true,
                radius: parseFloat(radiusInput?.value) || 5,
                borderWidthEnabled: curve.markStyle?.borderWidthEnabled || false,
                borderWidth: curve.markStyle?.borderWidth || 2.8
            });
            if (widthInput) {
                var wv = parseFloat(widthInput.value) || 2;
                curve.borderWidth = wv;
                if (widthNum) widthNum.value = wv.toFixed(1);
            }
            updateMultiChart(tab);
            updateCurvePickMenu(tab);
        };
        colorInput?.addEventListener('input', () => {
            curve.color = colorInput.value || '#57a7bd';
            if (curve.params) curve.params.curveColor = curve.color;
            // 同步 summary swatch 与可见性列表的颜色点 (无需重建 DOM)
            const swatch = item.querySelector('.component-filter-swatch');
            if (swatch) swatch.style.background = curve.color;
            const summarySpan = item.querySelector('summary span:last-child');
            if (summarySpan) summarySpan.style.color = curve.color;
            const visList = pane.querySelector('[data-role="curve-visibility-list"]');
            if (visList) {
                const matchRow = visList.querySelector('input[data-index="' + index + '"]')?.closest('label');
                if (matchRow) {
                    const dot = matchRow.querySelector('.color-dot');
                    if (dot) dot.style.color = curve.color;
                    const nameSpan = matchRow.querySelector('.curve-visible-name');
                    if (nameSpan) nameSpan.style.color = curve.color;
                }
            }
            applyStyle();
        });
        lineSelect?.addEventListener('change', () => {
            curve.lineStyle = lineSelect.value || 'solid';
            if (curve.params) curve.params.curveLineStyle = curve.lineStyle;
            applyStyle();
        });
        pointSelect?.addEventListener('change', () => {
            curve.pointStyle = pointSelect.value || 'circle';
            if (curve.params) curve.params.curvePointStyle = curve.pointStyle;
            applyStyle();
        });
        fillInput?.addEventListener('input', applyStyle);
        borderInput?.addEventListener('input', applyStyle);
        radiusInput?.addEventListener('input', applyStyle);
        if (widthInput) {
            widthInput.addEventListener('input', function() {
                if (widthNum) widthNum.value = parseFloat(this.value).toFixed(1);
                applyStyle();
            });
        }
        if (widthNum) {
            widthNum.addEventListener('input', function() {
                var v = parseFloat(this.value);
                if (Number.isFinite(v)) {
                    v = Math.max(0.5, Math.min(6, v));
                    if (widthInput) widthInput.value = v;
                    applyStyle();
                }
            });
        }
        list.appendChild(item);
    });
    // v6.5.6: 重建后恢复展开状态
    if (typeof restoreDetailsOpenState === 'function') restoreDetailsOpenState(list);
    if (typeof translateStaticUI === 'function') translateStaticUI();
    list.querySelectorAll('.curve-width-label input[type="number"]').forEach(num => {
        num.addEventListener('input', function() {
            const label = this.closest('.curve-width-label');
            if (!label) return;
            const range = label.querySelector('input[type="range"]');
            var v = parseFloat(this.value);
            if (Number.isFinite(v)) {
                v = Math.max(0.5, Math.min(6, v));
                if (range) {
                    range.value = v;
                    range.dispatchEvent(new Event('input'));
                }
            }
        });
    });
}
function updateCurvePickMenu(tab) {
    if (!tab || tab.type !== 'multi') return;
    const pane = getTabContent(tab);
    if (!pane) return;
    const menu = pane.querySelector('[data-role="curve-pick-menu"]');
    if (!menu) return;
    const availableIndices = Array.isArray(tab.curveSelection)
        ? tab.curveSelection.filter(index => Number.isFinite(index) && savedCurves[index])
        : [];
    if (!tab.volumePickIndices || tab.volumePickIndices.length === 0) {
        tab.volumePickIndices = availableIndices.slice();
    } else {
        tab.volumePickIndices = tab.volumePickIndices.filter(index => availableIndices.includes(index));
    }
    menu.innerHTML = '';
    if (!availableIndices.length) {
        menu.innerHTML = '<div class="curve-pick-empty" data-i18n="no_curves_available">暂无可选曲线</div>';
        return;
    }
    availableIndices.forEach(index => {
        const curve = savedCurves[index];
        const item = document.createElement('label');
        item.className = 'curve-pick-item';
        item.innerHTML = `
            <input type="checkbox" data-index="${index}">
            <span class="color-dot" style="color: ${curve.color}"></span>
            <span style="color: ${curve.color}">${curve.name}</span>
        `;
        const checkbox = item.querySelector('input');
        checkbox.checked = tab.volumePickIndices.includes(index);
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                if (!tab.volumePickIndices.includes(index)) {
                    tab.volumePickIndices.push(index);
                }
            } else {
                tab.volumePickIndices = tab.volumePickIndices.filter(val => val !== index);
            }
        });
        menu.appendChild(item);
    });
    if (typeof translateStaticUI === 'function') translateStaticUI();
}
function updateCurvePickMenus() {
    chartTabs.forEach(tab => {
        updateCurveVisibilityList(tab);
        updateCurvePickMenu(tab);
    });
}
function updateAllMultiTabs() {
    chartTabs.forEach(tab => {
        if (tab.type === 'multi') {
            updateCurveVisibilityList(tab);
            updateMultiChart(tab);
            updateCurvePickMenu(tab);
        }
    });
}
function rerenderAllTabs() {
    chartTabs.forEach(tab => {
        if (tab.type === 'multi') {
            updateMultiChart(tab);
        } else {
            updateChart(tab, tab.volumes, tab.phs, config.curveColor);
        }
    });
    if (typeof window.refreshDistributionChartStyle === 'function') {
        window.refreshDistributionChartStyle();
    }
}
function renderActiveTabChart() {
    const tab = getActiveTab();
    if (!tab) return;
    if (tab.type === 'multi') {
        updateMultiChart(tab);
    } else {
        updateChart(tab, tab.volumes, tab.phs, config.curveColor);
    }
}
