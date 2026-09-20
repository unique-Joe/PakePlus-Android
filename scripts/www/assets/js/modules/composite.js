(function () {
    let compositeChart = null;
    const compositeAnnotationState = { annotationLabelOffsets: {}, refreshAnnotations: null };
    let lastUnitGroups = [];
    let compositeControlsBound = false;
    let compositeHold = { active: false, timer: null, raf: null, point: null, startTime: 0, startX: 0, startY: 0 };

    function getCompositeChartWrapper() {
        return document.querySelector('.composite-area .chart-wrapper');
    }
    function getCompositeXLabel() {
        if (!compositeDatasets.length) return 'V (mL)';
        const ds = compositeDatasets[0];
        const label = (ds && (ds.xAxisLabel || ds.xAxisMode)) || 'V';
        if (label === 'V') return 'V (mL)';
        return label;
    }
    function getCompositeYLabel() {
        if (!compositeDatasets.length) return 'pH';
        const ds = compositeDatasets[0];
        return (ds && (ds.yAxisLabel || ds.yAxisUnit)) || 'Y';
    }
    function getCompositeXValue(point, ds) {
        if (!point) return NaN;
        const label = (ds && (ds.xAxisLabel || ds.xAxisMode)) || 'V';
        if (label === 'pH') return Number(point.rawPH);
        if (label === 'pOH') return pKw - Number(point.rawPH);
        return Number(point.rawX);
    }
    function getVisibleCompositeDatasets() {
        return compositeDatasets.filter(ds => compositeState.selectedIds.has(ds.id));
    }
    function groupCompositeByUnit(datasets) {
        const groups = [];
        const map = new Map();
        datasets.forEach(ds => {
            const unit = ds.yAxisLabel || ds.yAxisUnit || t('未知', 'Unknown');
            if (!map.has(unit)) {
                map.set(unit, []);
                groups.push({ unit, datasets: map.get(unit) });
            }
            map.get(unit).push(ds);
        });
        return groups;
    }
    function getDatasetYAxisID(ds) {
        const visible = getVisibleCompositeDatasets();
        const groups = groupCompositeByUnit(visible).slice(0, 2);
        const activeUnits = groups.map(g => g.unit);
        const idx = activeUnits.indexOf(ds.yAxisLabel || ds.yAxisUnit || t('未知', 'Unknown'));
        return idx === 1 ? 'y2' : 'y';
    }
    function getCompositeLineDash(style) {
        if (typeof getCurveLineDash === 'function') return getCurveLineDash(style);
        switch (style) {
            case 'dash': return [6, 4];
            case 'longDash': return [12, 6];
            case 'dot': return [2, 4];
            case 'dashDot': return [10, 4, 2, 4];
            case 'denseDash': return [4, 3];
            default: return [];
        }
    }
    function getChartForegroundColor() {
        const theme = document.documentElement.getAttribute('data-theme');
        return theme === 'dark' ? '#cbd5e1' : '#334155';
    }
    function getCompositeGridColor() {
        const theme = document.documentElement.getAttribute('data-theme');
        return theme === 'dark' ? 'rgba(148, 163, 184, 0.14)' : 'rgba(148, 163, 184, 0.32)';
    }
    function formatCompositeValue(value, unit) {
        const u = (unit || '').toLowerCase();
        if (u === 'ph' || u === 'poh') return Number(value).toFixed(2);
        return formatSignificant(value, 2);
    }
    function buildCompositeChartDatasets() {
        const visible = getVisibleCompositeDatasets();
        if (!visible.length) return [];
        // 横轴一致性检查：如果选中的曲线横轴不一致，不加载任何曲线
        const xLabels = new Set(visible.map(ds => ds.xAxisLabel || 'V'));
        if (xLabels.size > 1) return [];
        const groups = groupCompositeByUnit(visible);
        lastUnitGroups = groups.slice(0, 2);
        const activeUnits = lastUnitGroups.map(g => g.unit);
        const chartDatasets = [];
        visible.forEach(ds => {
            const unit = ds.yAxisLabel || ds.yAxisUnit || t('未知', 'Unknown');
            const groupIndex = activeUnits.indexOf(unit);
            if (groupIndex < 0) return;
            const pointData = ds.data.map(p => {
                const x = getCompositeXValue(p, ds);
                return { x: x, y: p.y };
            }).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
            if (!pointData.length) return;
            const effectivePointStyle = ds.pointStyle === 'none' ? 'circle' : (ds.pointStyle || 'circle');
            chartDatasets.push({
                label: ds.name,
                data: pointData,
                borderColor: ds.color,
                backgroundColor: 'transparent',
                borderWidth: Number.isFinite(ds.borderWidth) ? ds.borderWidth : 2,
                borderDash: getCompositeLineDash(ds.lineStyle),
                pointRadius: 0,
                pointHoverRadius: 0,
                pointHitRadius: 0,
                pointStyle: effectivePointStyle,
                showLine: true,
                fill: false,
                tension: 0,
                yAxisID: groupIndex === 1 ? 'y2' : 'y',
                compositeDatasetId: ds.id
            });
        });
        return chartDatasets;
    }
    function getCompositeScales() {
        const visible = getVisibleCompositeDatasets();
        const xValues = [];
        visible.forEach(ds => {
            ds.data.forEach(p => {
                const x = getCompositeXValue(p, ds);
                if (Number.isFinite(x)) xValues.push(x);
            });
        });
        const xMinData = xValues.length ? Math.min(...xValues) : 0;
        const xMaxData = xValues.length ? Math.max(...xValues) : 10;
        const xPad = Math.max((xMaxData - xMinData) * 0.02, 1e-6);
        const xMinInput = document.getElementById('compositeXMin');
        const xMaxInput = document.getElementById('compositeXMax');
        const yLeftMinInput = document.getElementById('compositeYLeftMin');
        const yLeftMaxInput = document.getElementById('compositeYLeftMax');
        const yRightMinInput = document.getElementById('compositeYRightMin');
        const yRightMaxInput = document.getElementById('compositeYRightMax');
        const gridXStep = document.getElementById('compositeGridXStep');
        const gridYStep = document.getElementById('compositeGridYStep');
        const cfg = compositeState.axisConfig;
        const fg = getChartForegroundColor();
        const gridColor = cfg.xGridColor || cfg.yGridColor || getCompositeGridColor();
        const xMin = Number.isFinite(parseFloat(xMinInput?.value)) ? parseFloat(xMinInput.value) : (xMinData - xPad);
        const xMax = Number.isFinite(parseFloat(xMaxInput?.value)) ? parseFloat(xMaxInput.value) : (xMaxData + xPad);
        const xScale = {
            type: 'linear',
            position: 'bottom',
            title: {
                display: true,
                text: cfg.xAxisLabel || getCompositeXLabel(),
                color: cfg.xAxisLineColor || fg,
                font: { size: 12, weight: '600' }
            },
            grid: {
                display: compositeState.gridEnabled,
                color: cfg.xGridColor || gridColor,
                tickLength: 8
            },
            ticks: {
                display: cfg.xTicksVisible !== false,
                color: cfg.xTickColor || fg,
                stepSize: Number.isFinite(parseFloat(gridXStep?.value)) && parseFloat(gridXStep.value) > 0 ? parseFloat(gridXStep.value) : undefined
            },
            min: xMin,
            max: xMax
        };
        const scales = { x: xScale };
        lastUnitGroups.forEach((g, i) => {
            const isRight = i === 1;
            const yValues = [];
            g.datasets.forEach(ds => {
                ds.data.forEach(p => { if (Number.isFinite(p.y)) yValues.push(p.y); });
            });
            const yMinData = yValues.length ? Math.min(...yValues) : 0;
            const yMaxData = yValues.length ? Math.max(...yValues) : 10;
            const yPad = Math.max((yMaxData - yMinData) * 0.05, 1e-9);
            const minInput = isRight ? yRightMinInput : yLeftMinInput;
            const maxInput = isRight ? yRightMaxInput : yLeftMaxInput;
            const manualMin = Number.isFinite(parseFloat(minInput?.value)) ? parseFloat(minInput.value) : null;
            const manualMax = Number.isFinite(parseFloat(maxInput?.value)) ? parseFloat(maxInput.value) : null;
            const yMin = manualMin !== null ? manualMin : (yMinData - yPad);
            const yMax = manualMax !== null ? manualMax : (yMaxData + yPad);
            const labelText = isRight ? (cfg.y2AxisLabel || g.unit) : (cfg.yAxisLabel || getCompositeYLabel() || g.unit);
            scales[isRight ? 'y2' : 'y'] = {
                type: 'linear',
                position: isRight ? 'right' : 'left',
                title: {
                    display: true,
                    text: labelText,
                    color: cfg.yAxisLineColor || fg,
                    font: { size: 12, weight: '600' }
                },
                grid: {
                    display: compositeState.gridEnabled && !isRight,
                    color: cfg.yGridColor || gridColor,
                    tickLength: 8
                },
                ticks: {
                    display: cfg.yTicksVisible !== false,
                    color: cfg.yTickColor || fg,
                    stepSize: Number.isFinite(parseFloat(gridYStep?.value)) && parseFloat(gridYStep.value) > 0 ? parseFloat(gridYStep.value) : undefined
                },
                min: yMin,
                max: yMax
            };
        });
        return scales;
    }
    function buildCompositeAnnotations() {
        const annotations = {};
        const isLightTheme = document.documentElement.getAttribute('data-theme') === 'light';
        const simple = compositeState.plainLabel !== false;
        const marks = compositeState.fixedMarks;
        marks.forEach((mark, idx) => {
            if (!mark || !Number.isFinite(mark.xValue) || !Number.isFinite(mark.y)) return;
            const keyPrefix = `compMark_${idx}`;
            const accent = getReadableAccentColor(mark.color, { target: isLightTheme ? 'light' : 'dark' });
            const pointColors = getContrastMarkColors(mark.color, false, !isLightTheme);
            const markStyle = cloneMarkStyleConfig(mark.markStyle);
            const markRadius = markStyle?.radiusEnabled ? markStyle.radius : (isLightTheme ? 5.2 : 4.6);
            const borderWidth = markStyle?.borderWidthEnabled ? markStyle.borderWidth : (isLightTheme ? 2.8 : 1.8);
            const fill = markStyle?.fillEnabled && markStyle.fillColor ? `${markStyle.fillColor}ff` : pointColors.fill;
            const border = markStyle?.borderEnabled && markStyle.borderColor ? markStyle.borderColor : pointColors.border;
            annotations[`${keyPrefix}Point`] = {
                type: 'point',
                xValue: mark.xValue,
                yValue: mark.y,
                backgroundColor: fill,
                borderColor: border,
                borderWidth: borderWidth,
                radius: mark.pointStyle === 'none' ? 0 : markRadius,
                pointStyle: getMarkPointStyle(mark.pointStyle),
                yScaleID: mark.yAxisID || 'y',
                enabled: true
            };
            const xLabel = mark.xAxisLabel || compositeState.xAxisMode;
            const yLabel = mark.yAxisLabel || mark.yAxisUnit || 'Y';
            const xText = Number(mark.xValue).toFixed(2);
            const yText = formatCompositeValue(mark.y, yLabel);
            const defaultLabel = simple ? `(${xText}, ${yText})` : `${xLabel}=${xText}\n${yLabel}=${yText}`;
            const labelText = mark.label || defaultLabel;
            annotations[`${keyPrefix}Label`] = {
                type: 'label',
                xValue: mark.xValue,
                yValue: mark.y,
                content: labelText,
                backgroundColor: simple ? 'transparent' : accent + (isLightTheme ? 'e6' : 'b3'),
                borderColor: simple ? 'transparent' : accent,
                borderWidth: simple ? 0 : (isLightTheme ? 1.6 : 1.2),
                borderRadius: simple ? 0 : 8,
                color: simple ? accent : getTextColorForFill(accent),
                font: { size: simple ? 10.5 : 10.8, weight: isLightTheme ? '800' : '600' },
                padding: simple ? { top: 0, bottom: 0, left: 0, right: 0 } : { top: 4, bottom: 4, left: 8, right: 8 },
                xAdjust: 0,
                yAdjust: simple ? -22 : -34,
                position: 'center',
                yScaleID: mark.yAxisID || 'y',
                enabled: true
            };
        });
        return annotations;
    }
    function updateCompositeEmptyState() {
        const empty = document.getElementById('compositeEmpty');
        if (!empty) return;
        if (!compositeDatasets.length) empty.classList.add('active');
        else empty.classList.remove('active');
    }
    function refreshCompositeMarks() {
        compositeState.fixedMarks.forEach(m => {
            const ds = compositeDatasets.find(d => d.id === m.datasetId);
            m.xValue = getCompositeXValue(m, ds);
            if (ds) {
                m.yAxisID = getDatasetYAxisID(ds);
                m.color = ds.color;
            }
        });
    }
    function renderCompositeChart() {
        const canvas = document.getElementById('compositeChart');
        if (!canvas || !window.Chart) return;
        updateCompositeEmptyState();
        if (!compositeDatasets.length) {
            if (compositeChart) { compositeChart.destroy(); compositeChart = null; }
            return;
        }
        bindCompositeControls();
        const xPickInput = document.getElementById('compositeXPickInput');
        if (xPickInput) xPickInput.placeholder = getCompositeXLabel();
        const datasets = buildCompositeChartDatasets();
        if (!datasets.length) {
            if (compositeChart) { compositeChart.destroy(); compositeChart = null; }
            // 检查是否有横轴不一致的情况
            const visible = getVisibleCompositeDatasets();
            if (visible.length >= 2) {
                const xLabels = new Set(visible.map(ds => ds.xAxisLabel || 'V'));
                if (xLabels.size > 1) {
                    const emptyEl = document.getElementById('compositeEmpty');
                    if (emptyEl) {
                        emptyEl.querySelector('.point-info-title') && (emptyEl.querySelector('.point-info-title').textContent = t('横轴不一致', 'Inconsistent X axis'));
                        emptyEl.querySelector('.distribution-chart-note') && (emptyEl.querySelector('.distribution-chart-note').textContent = t('选中的曲线横轴不一致，无法在同一坐标系中显示。', 'Selected curves have inconsistent X axes and cannot be displayed together.'));
                        emptyEl.classList.add('active');
                    }
                    return;
                }
            }
            return;
        }
        // 恢复正常的空状态文字
        const emptyEl = document.getElementById('compositeEmpty');
        if (emptyEl) {
            emptyEl.querySelector('.point-info-title') && (emptyEl.querySelector('.point-info-title').textContent = t('暂无复合数据', 'No composite data'));
            emptyEl.querySelector('.distribution-chart-note') && (emptyEl.querySelector('.distribution-chart-note').textContent = t('请先在单曲线/多曲线或浓度分布界面点击「保存到复合对比」。', 'First click "Save to composite comparison" in the Single/Multi curve or Distribution view.'));
            emptyEl.classList.remove('active');
        }
        if (lastUnitGroups.length > 2) {
            if (!compositeState._warnedGroups) {
                compositeState._warnedGroups = true;
                if (typeof showAlert === 'function') showAlert(t('提示', 'Tip'), t('复合对比最多支持两组纵轴，仅显示前两个单位分组。', 'Composite comparison supports at most two Y-axis groups; only the first two unit groups are shown.'), 'ℹ');
            }
        }
        refreshCompositeMarks();
        const scales = getCompositeScales();
        const annotations = buildCompositeAnnotations();
        applyAnnotationLabelOffsets(compositeAnnotationState, annotations);
        const bg = getChartBackgroundColor();
        const fg = getChartForegroundColor();
        if (compositeChart) {
            compositeChart.data.datasets = datasets;
            compositeChart.options.scales = scales;
            compositeChart.options.plugins.annotation.annotations = annotations;
            compositeChart.options.plugins.legend.labels.usePointStyle = false;
            compositeChart.options.plugins.legend.labels.boxWidth = 12;
            compositeChart.options.plugins.legend.labels.boxHeight = 12;
            compositeChart.options.plugins.legend.labels.generateLabels = function(chart) {
                const defaults = Chart.defaults.plugins.legend.labels.generateLabels;
                const items = defaults.call(this, chart);
                items.forEach(item => {
                    item.fillStyle = 'transparent';
                    item.strokeStyle = (item.dataset && item.dataset.borderColor) || item.strokeStyle || '#666';
                    item.lineWidth = 2;
                });
                return items;
            };
            compositeChart.options.plugins.legend.display = compositeState.showLegend;
            compositeChart.options.plugins.axisArrow.x = !!compositeState.xAxisArrow;
            compositeChart.options.plugins.axisArrow.y = !!compositeState.yAxisArrow;
            compositeChart.options.plugins.axisArrow.color = compositeState.axisConfig.xAxisLineColor || fg;
            compositeChart.options.backgroundColor = bg;
            compositeChart.update('none');
        } else {
            const ctx = canvas.getContext('2d');
            compositeChart = new Chart(ctx, {
                type: 'line',
                data: { datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    backgroundColor: bg,
                    interaction: { mode: 'nearest', axis: 'x', intersect: false },
                    onClick: null,
                    plugins: {
                        legend: {
                            display: compositeState.showLegend,
                            labels: {
                                usePointStyle: false,
                                boxWidth: 12,
                                boxHeight: 12,
                                color: fg,
                                padding: 16,
                                font: { size: 11 },
                                generateLabels: function(chart) {
                                    const defaults = Chart.defaults.plugins.legend.labels.generateLabels;
                                    const items = defaults.call(this, chart);
                                    items.forEach(item => {
                                        item.fillStyle = 'transparent';
                                        item.strokeStyle = (item.dataset && item.dataset.borderColor) || item.strokeStyle || '#666';
                                        item.lineWidth = 2;
                                    });
                                    return items;
                                }
                            }
                        },
                        tooltip: { enabled: false },
                        annotation: { annotations },
                        axisArrow: {
                            x: !!compositeState.xAxisArrow,
                            y: !!compositeState.yAxisArrow,
                            color: compositeState.axisConfig.xAxisLineColor || fg
                        }
                    },
                    scales: scales,
                    animation: false
                }
            });
            compositeAnnotationState.chart = compositeChart;
            compositeAnnotationState.refreshAnnotations = refreshCompositeAnnotations;
            installAnnotationLabelDragging(compositeAnnotationState);
            attachCompositeCanvasInteractions(canvas);
        }
        updateCompositeCurveList();
        updateCompositeMarksPanel();
    }
    window.renderCompositeChart = renderCompositeChart;
    function refreshCompositeAnnotations() {
        if (!compositeChart) return;
        const annotations = buildCompositeAnnotations();
        applyAnnotationLabelOffsets(compositeAnnotationState, annotations);
        compositeChart.options.plugins.annotation.annotations = annotations;
        compositeChart.update('none');
    }

    // 插值取点
    function buildCompositeMark(ds, xValue, y, rawX, rawPH, rawY, rawAmount) {
        return {
            key: `${ds.id}_${Number(xValue).toFixed(6)}_${Number(y).toFixed(6)}`,
            datasetId: ds.id,
            datasetIndex: 0,
            xValue: Number(xValue),
            y: Number(y),
            rawX: Number(rawX),
            rawPH: Number(rawPH),
            rawY: Number(rawY),
            rawAmount: Number(rawAmount),
            color: ds.color,
            datasetLabel: ds.name,
            pointStyle: ds.pointStyle,
            xAxisLabel: ds.xAxisLabel,
            yAxisLabel: ds.yAxisLabel,
            yAxisUnit: ds.yAxisUnit,
            markStyle: ds.markStyle,
            yAxisID: getDatasetYAxisID(ds)
        };
    }
    function getCompositeDataForInterpolation(ds) {
        return ds.data.map(p => ({
            x: getCompositeXValue(p, ds),
            y: p.y,
            raw: p
        })).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
    }
    function interpolateCompositeAtX(ds, targetX) {
        const data = getCompositeDataForInterpolation(ds);
        if (!data.length) return null;
        for (let i = 0; i < data.length - 1; i++) {
            const a = data[i], b = data[i + 1];
            if ((a.x <= targetX && targetX <= b.x) || (b.x <= targetX && targetX <= a.x)) {
                const t = Math.abs(b.x - a.x) < 1e-12 ? 0 : (targetX - a.x) / (b.x - a.x);
                const y = a.y + t * (b.y - a.y);
                const rawX = Number.isFinite(a.raw.rawX) && Number.isFinite(b.raw.rawX) ? a.raw.rawX + t * (b.raw.rawX - a.raw.rawX) : targetX;
                const rawPH = Number.isFinite(a.raw.rawPH) && Number.isFinite(b.raw.rawPH) ? a.raw.rawPH + t * (b.raw.rawPH - a.raw.rawPH) : y;
                const rawY = Number.isFinite(a.raw.rawY) && Number.isFinite(b.raw.rawY) ? a.raw.rawY + t * (b.raw.rawY - a.raw.rawY) : y;
                const rawAmount = Number.isFinite(a.raw.rawAmount) && Number.isFinite(b.raw.rawAmount) ? a.raw.rawAmount + t * (b.raw.rawAmount - a.raw.rawAmount) : null;
                return buildCompositeMark(ds, targetX, y, rawX, rawPH, rawY, rawAmount);
            }
        }
        let nearest = null, minDiff = Infinity;
        data.forEach(p => {
            const diff = Math.abs(p.x - targetX);
            if (diff < minDiff) { minDiff = diff; nearest = p; }
        });
        if (nearest) {
            return buildCompositeMark(ds, nearest.x, nearest.y,
                Number.isFinite(nearest.raw.rawX) ? nearest.raw.rawX : nearest.x,
                Number.isFinite(nearest.raw.rawPH) ? nearest.raw.rawPH : nearest.y,
                Number.isFinite(nearest.raw.rawY) ? nearest.raw.rawY : nearest.y,
                Number.isFinite(nearest.raw.rawAmount) ? nearest.raw.rawAmount : null);
        }
        return null;
    }
    function interpolateCompositeAtY(ds, targetY) {
        const data = getCompositeDataForInterpolation(ds);
        if (!data.length) return null;
        for (let i = 0; i < data.length - 1; i++) {
            const a = data[i], b = data[i + 1];
            if ((a.y <= targetY && targetY <= b.y) || (b.y <= targetY && targetY <= a.y)) {
                const t = Math.abs(b.y - a.y) < 1e-12 ? 0 : (targetY - a.y) / (b.y - a.y);
                const xValue = a.x + t * (b.x - a.x);
                const rawX = Number.isFinite(a.raw.rawX) && Number.isFinite(b.raw.rawX) ? a.raw.rawX + t * (b.raw.rawX - a.raw.rawX) : xValue;
                const rawPH = Number.isFinite(a.raw.rawPH) && Number.isFinite(b.raw.rawPH) ? a.raw.rawPH + t * (b.raw.rawPH - a.raw.rawPH) : targetY;
                const rawY = Number.isFinite(a.raw.rawY) && Number.isFinite(b.raw.rawY) ? a.raw.rawY + t * (b.raw.rawY - a.raw.rawY) : targetY;
                const rawAmount = Number.isFinite(a.raw.rawAmount) && Number.isFinite(b.raw.rawAmount) ? a.raw.rawAmount + t * (b.raw.rawAmount - a.raw.rawAmount) : null;
                return buildCompositeMark(ds, xValue, targetY, rawX, rawPH, rawY, rawAmount);
            }
        }
        return null;
    }
    function pickCompositePointByX(targetX) {
        const visible = getVisibleCompositeDatasets();
        if (!visible.length) return;
        let added = 0;
        visible.forEach(ds => {
            const mark = interpolateCompositeAtX(ds, targetX);
            if (mark) { addCompositeMark(mark); added++; }
        });
        if (added === 0 && typeof showAlert === 'function') showAlert(t('提示', 'Tip'), t('未找到与该横坐标对应的点。', 'No point matches this X coordinate.'), 'ℹ');
    }
    function pickCompositePointByY(targetY) {
        const targets = Array.from(compositeState.markTargetIds)
            .map(id => compositeDatasets.find(ds => ds.id === id))
            .filter(Boolean);
        if (!targets.length) {
            if (typeof showAlert === 'function') showAlert(t('提示', 'Tip'), t('请先在面板中选择要按Y取点的曲线。', 'Please select curves for Y picking in the panel first.'), 'ℹ');
            return;
        }
        let added = 0;
        targets.forEach(ds => {
            const mark = interpolateCompositeAtY(ds, targetY);
            if (mark) { addCompositeMark(mark); added++; }
        });
        if (added === 0 && typeof showAlert === 'function') showAlert(t('提示', 'Tip'), t('未找到与该纵坐标对应的点。', 'No point matches this Y coordinate.'), 'ℹ');
    }
    function addCompositeMark(mark) {
        if (!mark) return;
        if (compositeState.fixedMarks.find(m => m.key === mark.key)) return;
        compositeState.fixedMarks.push(mark);
        renderCompositeChart();
        updateCompositeMarksPanel();
    }
    function removeCompositeMark(key) {
        const idx = compositeState.fixedMarks.findIndex(m => m.key === key);
        if (idx >= 0) {
            compositeState.fixedMarks.splice(idx, 1);
            delete compositeAnnotationState.annotationLabelOffsets[key];
            renderCompositeChart();
            updateCompositeMarksPanel();
        }
    }
    function clearCompositeMarks() {
        compositeState.fixedMarks = [];
        compositeAnnotationState.annotationLabelOffsets = {};
        renderCompositeChart();
        updateCompositeMarksPanel();
    }
    window.clearCompositeMarks = clearCompositeMarks;

    // 画布交互：长按取点
    function getNearestCompositePointToPointer(event) {
        if (!compositeChart) return null;
        const canvas = compositeChart.canvas;
        const rect = canvas.getBoundingClientRect();
        const pointerX = event.clientX - rect.left;
        const pointerY = event.clientY - rect.top;
        const xScale = compositeChart.scales.x;
        const yScale = compositeChart.scales.y;
        if (!xScale || !yScale) return null;
        const xValue = xScale.getValueForPixel(pointerX);
        if (!Number.isFinite(xValue)) return null;
        let best = null;
        let bestDistance = Infinity;
        compositeChart.data.datasets.forEach((chartDs, di) => {
            const ds = compositeDatasets.find(d => d.id === chartDs.compositeDatasetId);
            if (!ds || chartDs.hidden) return;
            const interpolated = interpolateCompositeAtX(ds, xValue);
            if (!interpolated) return;
            const yAxisID = getDatasetYAxisID(ds);
            const yScaleCurrent = compositeChart.scales[yAxisID] || yScale;
            const pointX = xScale.getPixelForValue(interpolated.xValue);
            const pointY = yScaleCurrent.getPixelForValue(interpolated.y);
            const distance = Math.hypot(pointX - pointerX, pointY - pointerY);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = { datasetIndex: di, ds, point: interpolated };
            }
        });
        if (!best || bestDistance > 120) return null;
        return best;
    }
    function attachCompositeCanvasInteractions(canvas) {
        if (!canvas || canvas.dataset.compositeListeners === '1') return;
        canvas.dataset.compositeListeners = '1';
        const DURATION = 800;
        const MOVE_THRESHOLD = 64;
        function cancelCompositeHold() {
            if (compositeHold.timer) clearTimeout(compositeHold.timer);
            if (compositeHold.raf) cancelAnimationFrame(compositeHold.raf);
            compositeHold.active = false;
            compositeHold.timer = null;
            compositeHold.raf = null;
            compositeHold.point = null;
            if (typeof hideHoldProgress === 'function') hideHoldProgress();
        }
        function startCompositeHold(event) {
            if (!compositeChart) return;
            if (event.button !== undefined && event.button !== 0) return;
            if (isPointerOnDraggableLabel(compositeChart.canvas, compositeChart, event)) return;
            const point = getNearestCompositePointToPointer(event);
            if (!point) return;
            cancelCompositeHold();
            compositeHold.active = true;
            compositeHold.startTime = performance.now();
            compositeHold.startX = event.clientX;
            compositeHold.startY = event.clientY;
            compositeHold.point = point;
            if (typeof showHoldProgress === 'function') showHoldProgress(event.clientX, event.clientY);
            compositeHold.timer = setTimeout(() => {
                if (!compositeHold.active) return;
                if (!point.point.label) {
                    const xText = Number(point.point.xValue).toFixed(2);
                    const yUnit = point.point.yAxisLabel || point.point.yAxisUnit || 'Y';
                    const yText = formatCompositeValue(point.point.y, yUnit);
                    point.point.label = compositeState.plainLabel !== false ? `(${xText}, ${yText})` : `${point.point.xAxisLabel || 'V'}=${xText}, ${yUnit}=${yText}`;
                }
                addCompositeMark(point.point);
                try { navigator.vibrate && navigator.vibrate(20); } catch (e) {}
                cancelCompositeHold();
            }, DURATION);
            const tick = () => {
                if (!compositeHold.active) return;
                const elapsed = performance.now() - compositeHold.startTime;
                if (typeof updateHoldProgress === 'function') updateHoldProgress(elapsed / DURATION);
                compositeHold.raf = requestAnimationFrame(tick);
            };
            compositeHold.raf = requestAnimationFrame(tick);
        }
        function onPointerDown(event) {
            if (event.button !== 0 && event.button !== undefined) return;
            startCompositeHold(event);
        }
        function onPointerMove(event) {
            if (!compositeHold.active) return;
            const dx = event.clientX - compositeHold.startX;
            const dy = event.clientY - compositeHold.startY;
            if (dx * dx + dy * dy > MOVE_THRESHOLD) {
                cancelCompositeHold();
                return;
            }
            if (typeof showHoldProgress === 'function') showHoldProgress(event.clientX, event.clientY);
        }
        function onPointerUp() {
            cancelCompositeHold();
        }
        function onPointerLeave() {
            cancelCompositeHold();
        }
        canvas.addEventListener('pointerdown', onPointerDown);
        canvas.addEventListener('pointerup', onPointerUp);
        canvas.addEventListener('pointerleave', onPointerLeave);
        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('pointercancel', onPointerUp);
        canvas.addEventListener('contextmenu', event => event.preventDefault());
    }

    // UI 面板
    function updateCompositeCurveList() {
        const list = document.getElementById('compositeCurveList');
        const targetList = document.getElementById('compositeMarkTargetList');
        if (!list || !targetList) return;
        if (!compositeDatasets.length) {
            list.innerHTML = '<span class="component-filter-empty" data-i18n="no_composite_empty">暂无复合对比曲线。</span>';
            targetList.innerHTML = '<span class="component-filter-empty" data-i18n="no_marks">暂无曲线。</span>';
            return;
        }
        list.innerHTML = compositeDatasets.map(ds => `
            <label class="component-filter-item" title="${ds.name}">
                <input type="checkbox" data-composite-id="${ds.id}" data-role="composite-curve-select" ${compositeState.selectedIds.has(ds.id) ? 'checked' : ''}>
                <span class="component-filter-swatch" style="background:${ds.color};"></span>
                <span class="component-filter-label">${ds.name}</span>
                <button type="button" class="component-filter-delete" data-composite-delete="${ds.id}" title="删除曲线" data-i18n-title="delete_curve">×</button>
            </label>`).join('');
        targetList.innerHTML = compositeDatasets.map(ds => `
            <label class="component-filter-item" title="${ds.name}">
                <input type="checkbox" data-composite-id="${ds.id}" data-role="composite-mark-target" ${compositeState.markTargetIds.has(ds.id) ? 'checked' : ''}>
                <span class="component-filter-swatch" style="background:${ds.color};"></span>
                <span class="component-filter-label">${ds.name}</span>
            </label>`).join('');
        bindCompositeListEvents();
        updateCompositeStyleList();
        if (typeof translateStaticUI === 'function') translateStaticUI();
    }
    function updateCompositeStyleList() {
        const list = document.getElementById('compositeStyleList');
        if (!list) return;
        const selected = compositeDatasets.filter(ds => compositeState.selectedIds.has(ds.id));
        if (!selected.length) {
            list.innerHTML = '<span class="component-filter-empty" data-i18n="no_selected_curves">没有选中的曲线。</span>';
            return;
        }
        list.innerHTML = selected.map(ds => {
            const markStyle = ds.markStyle || {};
            return `
            <details class="curve-settings-item" data-persist-key="comp:${ds.id}">
                <summary class="curve-settings-summary">
                    <span class="component-filter-swatch" style="background:${ds.color};"></span>
                    <span style="color:${ds.color}">${ds.name}</span>
                </summary>
                <div class="curve-settings-grid">
                    <label><span data-i18n="line_color">线色</span> <input type="color" data-composite-id="${ds.id}" data-style="color" value="${ds.color}"></label>
                    <label><span data-i18n="line_style">线型</span>
                        <select data-composite-id="${ds.id}" data-style="lineStyle">
                            <option value="solid" ${ds.lineStyle === 'solid' ? 'selected' : ''} data-i18n="line_solid">实线</option>
                            <option value="dash" ${ds.lineStyle === 'dash' ? 'selected' : ''} data-i18n="line_dash">短虚线</option>
                            <option value="longDash" ${ds.lineStyle === 'longDash' ? 'selected' : ''} data-i18n="line_long_dash">长虚线</option>
                            <option value="dot" ${ds.lineStyle === 'dot' ? 'selected' : ''} data-i18n="line_dot">点线</option>
                            <option value="dashDot" ${ds.lineStyle === 'dashDot' ? 'selected' : ''} data-i18n="line_dash_dot">点划线</option>
                            <option value="denseDash" ${ds.lineStyle === 'denseDash' ? 'selected' : ''} data-i18n="line_dense_dash">密集虚线</option>
                        </select>
                    </label>
                    <label><span data-i18n="point_style">点型</span>
                        <select data-composite-id="${ds.id}" data-style="pointStyle">
                            <option value="circle" ${ds.pointStyle === 'circle' ? 'selected' : ''} data-i18n="point_circle">圆点</option>
                            <option value="rect" ${ds.pointStyle === 'rect' ? 'selected' : ''} data-i18n="point_rect">方点</option>
                            <option value="rectRounded" ${ds.pointStyle === 'rectRounded' ? 'selected' : ''} data-i18n="point_rect_rounded">圆角方点</option>
                            <option value="rectRot" ${ds.pointStyle === 'rectRot' ? 'selected' : ''} data-i18n="point_diamond">菱形点</option>
                            <option value="triangle" ${ds.pointStyle === 'triangle' ? 'selected' : ''} data-i18n="point_triangle">三角点</option>
                            <option value="star" ${ds.pointStyle === 'star' ? 'selected' : ''} data-i18n="point_star">星形点</option>
                            <option value="cross" ${ds.pointStyle === 'cross' ? 'selected' : ''} data-i18n="point_cross">十字点</option>
                            <option value="crossRot" ${ds.pointStyle === 'crossRot' ? 'selected' : ''} data-i18n="point_cross_rot">斜十字点</option>
                            <option value="line" ${ds.pointStyle === 'line' ? 'selected' : ''} data-i18n="point_line">无点</option>
                            <option value="none" ${ds.pointStyle === 'none' ? 'selected' : ''} data-i18n="point_none">不显示</option>
                        </select>
                    </label>
                    <label><span data-i18n="point_fill">点填充</span> <input type="color" data-composite-id="${ds.id}" data-style="markFill" value="${markStyle.fillColor || ds.color || '#57a7bd'}"></label>
                    <label><span data-i18n="point_border">点描边</span> <input type="color" data-composite-id="${ds.id}" data-style="markBorder" value="${markStyle.borderColor || '#0f172a'}"></label>
                    <label><span data-i18n="point_size">点大小</span> <input type="number" data-composite-id="${ds.id}" data-style="markRadius" min="1" max="14" step="0.5" value="${markStyle.radius ?? 5}"></label>
                    <label class="curve-width-label"><span data-i18n="line_width">粗细</span> <input type="range" data-composite-id="${ds.id}" data-style="borderWidth" min="0.5" max="6" step="0.1" value="${ds.borderWidth ?? 2}"> <input type="number" class="thickness-number-input width-number" data-style="borderWidthNumber" data-composite-id="${ds.id}" min="0.5" max="6" step="0.1" value="${(ds.borderWidth ?? 2).toFixed(1)}"></label>
                </div>
            </details>`;
        }).join('');
        bindCompositeStyleEvents();
        if (typeof translateStaticUI === 'function') translateStaticUI();
    }
    function updateCompositeMarksPanel() {
        const panel = document.getElementById('compositeMarksPanel');
        const list = document.getElementById('compositeMarksList');
        const count = panel?.querySelector('.marks-count');
        if (!list) return;
        if (!compositeState.fixedMarks.length) {
            list.innerHTML = '<div class="marks-empty" data-i18n="no_marks_set_yet">尚未设置任何标点。</div>';
            if (count) count.textContent = '(0)';
            return;
        }
        list.innerHTML = '';
        compositeState.fixedMarks.forEach(m => {
            const xText = Number(m.xValue).toFixed(2);
            const yUnit = m.yAxisLabel || m.yAxisUnit || 'Y';
            const yText = formatCompositeValue(m.y, yUnit);
            const defaultText = compositeState.plainLabel !== false
                ? `(${xText}, ${yText})`
                : `${m.xAxisLabel || 'V'}=${xText}, ${yUnit}=${yText}`;
            const row = document.createElement('div');
            row.className = 'mark-row';
            row.innerHTML = `
                <span class="mark-dot" style="background:${m.color}"></span>
                <span class="mark-curve-name" title="${m.datasetLabel}">${m.datasetLabel}</span>
                <input type="text" class="mark-text" value="${m.label || defaultText}">
                <button class="mark-delete" data-mark-key="${m.key}" title="删除" data-i18n-title="delete">×</button>`;
            list.appendChild(row);
            const textInput = row.querySelector('.mark-text');
            textInput.addEventListener('input', () => {
                m.label = textInput.value;
                renderCompositeChart();
            });
        });
        if (count) count.textContent = `(${compositeState.fixedMarks.length})`;
        bindCompositeMarkDeleteEvents();
        if (typeof translateStaticUI === 'function') translateStaticUI();
    }
    function bindCompositeListEvents() {
        document.querySelectorAll('#compositeCurveList [data-role="composite-curve-select"]').forEach(cb => {
            cb.addEventListener('change', () => {
                const id = cb.dataset.compositeId;
                if (cb.checked) {
                    const ds = compositeDatasets.find(d => d.id === id);
                    if (ds && compositeDatasets.length > 1) {
                        const existing = compositeDatasets.find(d => d.id !== id && compositeState.selectedIds.has(d.id));
                        if (existing) {
                            const existingX = existing.xAxisLabel || 'V';
                            const newX = ds.xAxisLabel || 'V';
                            if (existingX !== newX) {
                                cb.checked = false;
                                const msg = t('横轴不一致（已有：{existing}，新加：{newX}），无法勾选。', 'X-axis mismatch (existing: {existing}, new: {newX}). Cannot select.')
                                    .replace('{existing}', existingX)
                                    .replace('{newX}', newX);
                                try { showAlert(t('提示', 'Tip'), msg, 'warning'); } catch (e) {}
                                return;
                            }
                        }
                    }
                    compositeState.selectedIds.add(id);
                } else {
                    compositeState.selectedIds.delete(id);
                }
                renderCompositeChart();
            });
        });
        document.querySelectorAll('#compositeMarkTargetList [data-role="composite-mark-target"]').forEach(cb => {
            cb.addEventListener('change', () => {
                const id = cb.dataset.compositeId;
                if (cb.checked) compositeState.markTargetIds.add(id);
                else compositeState.markTargetIds.delete(id);
            });
        });
        document.querySelectorAll('#compositeCurveList [data-composite-delete]').forEach(btn => {
            btn.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                const id = btn.dataset.compositeDelete;
                const idx = compositeDatasets.findIndex(d => d.id === id);
                if (idx >= 0) {
                    compositeDatasets.splice(idx, 1);
                    compositeState.selectedIds.delete(id);
                    compositeState.markTargetIds.delete(id);
                    compositeState.fixedMarks = compositeState.fixedMarks.filter(m => m.datasetId !== id);
                    renderCompositeChart();
                    updateCompositeCurveList();
                }
            });
        });
    }
    function bindCompositeStyleEvents() {
        document.querySelectorAll('#compositeStyleList [data-style]').forEach(el => {
            el.addEventListener('input', () => {
                const id = el.dataset.compositeId;
                const style = el.dataset.style;
                const ds = compositeDatasets.find(d => d.id === id);
                if (!ds) return;
                if (!ds.markStyle) ds.markStyle = {};
                if (style === 'borderWidth') {
                    ds.borderWidth = parseFloat(el.value) || 2;
                    const numberInput = el.parentElement?.querySelector('input[data-style="borderWidthNumber"]');
                    if (numberInput) numberInput.value = ds.borderWidth.toFixed(1);
                } else if (style === 'borderWidthNumber') {
                    const v = parseFloat(el.value);
                    if (Number.isFinite(v)) {
                        ds.borderWidth = Math.max(0.5, Math.min(6, v));
                        const range = el.parentElement?.querySelector('input[data-style="borderWidth"]');
                        if (range) range.value = ds.borderWidth;
                    }
                } else if (style === 'color') {
                    ds.color = el.value;
                    const summary = el.closest('.curve-settings-item')?.querySelector('summary .component-filter-swatch');
                    if (summary) summary.style.background = el.value;
                } else if (style === 'markFill') {
                    ds.markStyle.fillEnabled = true;
                    ds.markStyle.fillColor = el.value;
                } else if (style === 'markBorder') {
                    ds.markStyle.borderEnabled = true;
                    ds.markStyle.borderColor = el.value;
                } else if (style === 'markRadius') {
                    ds.markStyle.radiusEnabled = true;
                    ds.markStyle.radius = parseFloat(el.value) || 5;
                } else {
                    ds[style] = el.value;
                }
                renderCompositeChart();
            });
        });
        document.querySelectorAll('#compositeStyleList .curve-width-label input[type="number"]').forEach(num => {
            num.addEventListener('input', function() {
                const label = this.closest('.curve-width-label');
                if (!label) return;
                const range = label.querySelector('input[type="range"]');
                const v = parseFloat(this.value);
                if (Number.isFinite(v)) {
                    const clamped = Math.max(0.5, Math.min(6, v));
                    if (range) { range.value = clamped; range.dispatchEvent(new Event('input')); }
                }
            });
        });
    }
    function bindCompositeMarkDeleteEvents() {
        document.querySelectorAll('#compositeMarksList [data-mark-key]').forEach(btn => {
            btn.addEventListener('click', event => {
                event.preventDefault();
                removeCompositeMark(btn.dataset.markKey);
            });
        });
    }
    window.updateCompositeCurveList = updateCompositeCurveList;

    // 尺寸与导出
    function applyCompositeChartWidth(value) {
        const wrapper = getCompositeChartWrapper();
        if (!wrapper) return;
        const num = parseFloat(value);
        if (Number.isFinite(num) && num >= 200) {
            wrapper.classList.add('custom-width');
            wrapper.style.setProperty('--chart-custom-width', num + 'px');
        } else {
            wrapper.classList.remove('custom-width');
            wrapper.style.removeProperty('--chart-custom-width');
        }
        if (compositeChart) compositeChart.resize();
    }
    function applyCompositeAspectRatio(ratioValue) {
        const wrapper = getCompositeChartWrapper();
        const widthInput = document.getElementById('compositeChartWidth');
        if (!wrapper) return;
        if (!ratioValue || ratioValue === 'auto') {
            if (widthInput) widthInput.value = '';
            applyCompositeChartWidth('');
            return;
        }
        const parts = ratioValue.split(':').map(Number);
        if (parts.length !== 2 || !parts[0] || !parts[1]) return;
        const rect = wrapper.getBoundingClientRect();
        const height = rect.height || wrapper.clientHeight || 420;
        const width = Math.max(200, Math.round(height * (parts[0] / parts[1])));
        if (widthInput) widthInput.value = width;
        applyCompositeChartWidth(width);
    }
    function downloadCompositeChart() {
        if (!compositeChart) {
            if (typeof showAlert === 'function') showAlert(t('提示', 'Tip'), t('请先添加并显示曲线。', 'Please add and show curves first.'), 'ℹ');
            return;
        }
        const formatEl = document.getElementById('compositeImageFormat');
        const scaleEl = document.getElementById('compositeImageScale');
        const format = formatEl ? formatEl.value : 'png';
        const scale = scaleEl ? parseFloat(scaleEl.value) || 1 : 2;
        const filename = `${t('复合对比', 'Composite')}.${format === 'png' ? 'png' : 'jpg'}`;
        if (typeof exportChartImage === 'function') {
            exportChartImage(compositeChart, format, scale, filename);
        }
    }

    // 控件绑定
    function syncCompositeAxisConfigFromDOM() {
        const ids = {
            xAxisLabel: 'compositeXAxisLabel',
            yAxisLabel: 'compositeYAxisLabel',
            y2AxisLabel: 'compositeY2AxisLabel',
            xAxisLineColor: 'compositeXAxisLineColor',
            yAxisLineColor: 'compositeYAxisLineColor',
            xTickColor: 'compositeXTickColor',
            yTickColor: 'compositeYTickColor',
            xGridColor: 'compositeXGridColor',
            yGridColor: 'compositeYGridColor'
        };
        Object.keys(ids).forEach(key => {
            const el = document.getElementById(ids[key]);
            if (!el) return;
            if (el.type === 'checkbox') compositeState.axisConfig[key] = el.checked;
            else compositeState.axisConfig[key] = el.value;
        });
        const xTicksCb = document.getElementById('compositeXTicksVisible');
        const yTicksCb = document.getElementById('compositeYTicksVisible');
        if (xTicksCb) compositeState.axisConfig.xTicksVisible = xTicksCb.checked;
        if (yTicksCb) compositeState.axisConfig.yTicksVisible = yTicksCb.checked;
    }
    function bindCompositeControls() {
        if (compositeControlsBound) return;
        compositeControlsBound = true;
        const gridCb = document.getElementById('compositeGridEnabled');
        if (gridCb) gridCb.addEventListener('change', () => { compositeState.gridEnabled = gridCb.checked; renderCompositeChart(); });
        const legendCb = document.getElementById('compositeLegendEnabled');
        if (legendCb) legendCb.addEventListener('change', () => { compositeState.showLegend = legendCb.checked; renderCompositeChart(); });
        const xArrowCb = document.getElementById('compositeXAxisArrow');
        const yArrowCb = document.getElementById('compositeYAxisArrow');
        if (xArrowCb) xArrowCb.addEventListener('change', () => { compositeState.xAxisArrow = xArrowCb.checked; syncCompositeAxisConfigFromDOM(); renderCompositeChart(); });
        if (yArrowCb) yArrowCb.addEventListener('change', () => { compositeState.yAxisArrow = yArrowCb.checked; syncCompositeAxisConfigFromDOM(); renderCompositeChart(); });
        const widthInput = document.getElementById('compositeChartWidth');
        if (widthInput) widthInput.addEventListener('input', () => applyCompositeChartWidth(widthInput.value));
        const aspectSelect = document.getElementById('compositeChartAspect');
        if (aspectSelect) aspectSelect.addEventListener('change', () => applyCompositeAspectRatio(aspectSelect.value));
        const axisIds = ['compositeXAxisLabel','compositeYAxisLabel','compositeY2AxisLabel','compositeXAxisLineColor','compositeYAxisLineColor','compositeXTickColor','compositeYTickColor','compositeXGridColor','compositeYGridColor','compositeXTicksVisible','compositeYTicksVisible','compositeXAxisArrow','compositeYAxisArrow'];
        axisIds.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', () => {
                syncCompositeAxisConfigFromDOM();
                renderCompositeChart();
            });
        });
        ['compositeXMin','compositeXMax','compositeYLeftMin','compositeYLeftMax','compositeYRightMin','compositeYRightMax','compositeGridXStep','compositeGridYStep'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', () => renderCompositeChart());
        });
        document.getElementById('compositeSelectAllBtn')?.addEventListener('click', () => {
            const xLabels = new Set(compositeDatasets.map(ds => ds.xAxisLabel || 'V'));
            if (xLabels.size > 1) {
                const msg = t('存在横轴不一致的曲线，无法全选。', 'Some curves have inconsistent X axes; cannot select all.');
                try { showAlert(t('提示', 'Tip'), msg, 'warning'); } catch (e) {}
                return;
            }
            compositeDatasets.forEach(ds => compositeState.selectedIds.add(ds.id));
            renderCompositeChart();
        });
        document.getElementById('compositeSelectNoneBtn')?.addEventListener('click', () => {
            compositeState.selectedIds.clear();
            renderCompositeChart();
        });
        document.getElementById('compositeClearMarksBtn')?.addEventListener('click', clearCompositeMarks);
        const xPickInput = document.getElementById('compositeXPickInput');
        const yPickInput = document.getElementById('compositeYPickInput');
        document.getElementById('compositeXPickBtn')?.addEventListener('click', () => {
            const v = parseFloat(xPickInput?.value);
            if (Number.isFinite(v)) pickCompositePointByX(v);
        });
        document.getElementById('compositeYPickBtn')?.addEventListener('click', () => {
            const v = parseFloat(yPickInput?.value);
            if (Number.isFinite(v)) pickCompositePointByY(v);
        });
        xPickInput?.addEventListener('keydown', event => { if (event.key === 'Enter') { const v = parseFloat(xPickInput.value); if (Number.isFinite(v)) pickCompositePointByX(v); } });
        yPickInput?.addEventListener('keydown', event => { if (event.key === 'Enter') { const v = parseFloat(yPickInput.value); if (Number.isFinite(v)) pickCompositePointByY(v); } });
        document.getElementById('compositeAxisAutoBtn')?.addEventListener('click', () => {
            ['compositeXMin','compositeXMax','compositeYLeftMin','compositeYLeftMax','compositeYRightMin','compositeYRightMax'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            renderCompositeChart();
        });
        document.getElementById('compositeDownloadBtn')?.addEventListener('click', downloadCompositeChart);
        // 初始化状态控件
        if (gridCb) gridCb.checked = compositeState.gridEnabled;
        if (legendCb) legendCb.checked = compositeState.showLegend;
        if (xArrowCb) xArrowCb.checked = !!compositeState.xAxisArrow;
        if (yArrowCb) yArrowCb.checked = !!compositeState.yAxisArrow;
    }

    // 初始：DOM 就绪后绑定面板（即使无数据也绑定控件）
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { bindCompositeControls(); updateCompositeEmptyState(); });
    } else {
        bindCompositeControls();
        updateCompositeEmptyState();
    }
})();
