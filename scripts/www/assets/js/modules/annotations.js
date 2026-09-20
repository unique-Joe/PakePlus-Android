function setupCanvasInteractions(tab, canvas) {
    if (!canvas) return;
    if (canvas.dataset.listenersAttached === 'true') return;
    attachHoldListeners(canvas, tab);
    if (!isMobilePerformanceMode()) {
        attachHoverPreview(canvas, tab);
    }
    canvas.dataset.listenersAttached = 'true';
}
function addFixedMark(tab, point) {
    if (!tab || !point) return;
    const keyBase = tab.type === 'multi'
        ? `m-${point.curveName || point.datasetIndex}-${point.volume.toFixed(3)}`
        : `s-${point.volume.toFixed(3)}`;
    const key = point.markKey || keyBase;
    if (tab.fixedMarks.find(mark => mark.key === key)) return;
    tab.fixedMarks.push({
        key,
        datasetIndex: point.datasetIndex,
        index: point.index,
        label: point.label ?? ('(' + point.volume.toFixed(2) + ', ' + point.ph.toFixed(2) + ')'),
        volume: point.volume,
        ph: point.ph,
        color: point.color,
        curveName: point.curveName,
        savedCurveIndex: point.savedCurveIndex,
        pointStyle: point.pointStyle,
        markStyle: cloneMarkStyleConfig(point.markStyle)
    });
    refreshTabAnnotations(tab);
}
function attachHoverPreview(canvas, tab) {
    const preview = document.getElementById('hoverPreview');
    if (!preview) return;
    const hide = () => {
        preview.classList.remove('active');
        if (tab) {
            tab.selectedPoint = null;
            tab.hoverPreviewKey = null;
            refreshTabAnnotations(tab);
        }
    };
    const makeKey = (point) => `${point.datasetIndex}|${point.index}`;
    const resolveCurveData = (point) => {
        if (!point) return null;
        if (tab.type === 'single') {
            return { volumes: tab.volumes, phs: tab.phs, maxVolume: config.maxVolume };
        }
        const curve = savedCurves.find(item => item.name === point.curveName);
        if (!curve) return null;
        const maxVolume = curve.volumes.length ? curve.volumes[curve.volumes.length - 1] : config.maxVolume;
        return { volumes: curve.volumes, phs: curve.phs, maxVolume };
    };
    const show = (event, point) => {
        const curveData = resolveCurveData(point);
        const progress = curveData ? ((point.volume / curveData.maxVolume) * 100).toFixed(1) : '--';
        const bufferIndex = curveData ? getBufferIndexForCurve(curveData.volumes, curveData.phs, point.volume).toFixed(2) : '--';
        const nameLine = tab.type === 'multi' && point.curveName ? `<div class="hover-preview-title">${point.curveName}</div>` : '';
        preview.innerHTML = `
            ${nameLine}
            <div class="hover-preview-row"><span data-i18n="hover_volume">体积</span><span>${point.volume.toFixed(2)} mL</span></div>
            <div class="hover-preview-row"><span>pH</span><span>${point.ph.toFixed(2)}</span></div>
            <div class="hover-preview-row"><span data-i18n="hover_volume_progress">体积进度</span><span>${progress}%</span></div>
            <div class="hover-preview-row"><span data-i18n="hover_buffer_index">缓冲指数</span><span>${bufferIndex}</span></div>
        `;
        const pad = 8;
        const targetLeft = event.clientX + 14;
        const targetTop = event.clientY + 12;
        preview.style.left = `${targetLeft}px`;
        preview.style.top = `${targetTop}px`;
        preview.classList.add('active');
        const w = preview.offsetWidth || 180;
        const h = preview.offsetHeight || 100;
        const clampedLeft = Math.min(targetLeft, window.innerWidth - w - pad);
        const clampedTop = Math.min(targetTop, window.innerHeight - h - pad);
        preview.style.left = `${Math.max(pad, clampedLeft)}px`;
        preview.style.top = `${Math.max(pad, clampedTop)}px`;
        const key = makeKey(point);
        if (tab.hoverPreviewKey !== key) {
            tab.hoverPreviewKey = key;
            tab.selectedPoint = point;
            refreshTabAnnotations(tab);
        }
    };
    const move = (event) => {
        if (!tab || !tab.chart) {
            hide();
            return;
        }
        const point = getPointFromEvent(tab.chart, event, true);
        if (!point) {
            hide();
            return;
        }
        show(event, point);
    };
    const leave = () => hide();
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseleave', leave);
}
function pickPointByVolume(tab, volume) {
    if (!tab || !tab.chart || !Number.isFinite(volume)) return;
    if (tab.type === 'single') {
        if (!tab.volumes.length) return;
        const points = tab.volumes.map((v, idx) => ({ x: v, y: tab.phs[idx] }));
        const interpolated = interpolatePoint(points, volume);
        if (!interpolated) return;
        const dataset = tab.chart.data.datasets[0];
        const point = {
            datasetIndex: 0,
            index: interpolated.index,
            volume: interpolated.volume,
            ph: interpolated.ph,
            color: dataset.borderColor || dataset.backgroundColor || '#57a7bd',
            curveName: dataset.label
        };
        updatePointAnnotation(tab, point);
        addFixedMark(tab, point);
        showPointInfo(tab, point.volume, point.ph);
        return;
    }
    const targets = Array.isArray(tab.volumePickIndices) ? tab.volumePickIndices : [];
    if (!targets.length) return;
    targets.forEach(index => {
        const curve = savedCurves[index];
        if (!curve) return;
        const points = curve.volumes.map((v, idx) => ({ x: v, y: curve.phs[idx] }));
        const interpolated = interpolatePoint(points, volume);
        if (!interpolated) return;
        const datasetIndex = tab.chart.data.datasets.findIndex(dataset => dataset.savedCurveIndex === index);
        if (datasetIndex === -1) return;
        const dataset = tab.chart.data.datasets[datasetIndex];
        const point = {
            datasetIndex,
            index: interpolated.index,
            volume: interpolated.volume,
            ph: interpolated.ph,
            color: dataset.borderColor || dataset.backgroundColor || '#57a7bd',
            curveName: curve.name,
            savedCurveIndex: index,
            pointStyle: curve.pointStyle || curve.params?.curvePointStyle || 'circle',
            markStyle: getCurveMarkStyleConfig(curve)
        };
        updatePointAnnotation(tab, point);
        addFixedMark(tab, point);
    });
}
function interpolatePointsByPH(points, targetPH) {
    if (!Array.isArray(points) || points.length < 2 || !Number.isFinite(targetPH)) return [];
    const results = [];
    const seen = new Set();
    const addResult = (volume, ph, index) => {
        if (!Number.isFinite(volume) || !Number.isFinite(ph)) return;
        const key = volume.toFixed(5);
        if (seen.has(key)) return;
        seen.add(key);
        results.push({ volume, ph, index });
    };
    for (let i = 1; i < points.length; i++) {
        const p0 = points[i - 1];
        const p1 = points[i];
        if (!p0 || !p1) continue;
        const y0 = Number(p0.y);
        const y1 = Number(p1.y);
        const x0 = Number(p0.x);
        const x1 = Number(p1.x);
        if (![y0, y1, x0, x1].every(Number.isFinite)) continue;
        if (y0 === targetPH) {
            addResult(x0, y0, i - 1);
        }
        if (y1 === targetPH) {
            addResult(x1, y1, i);
            continue;
        }
        const crosses = (targetPH - y0) * (targetPH - y1) < 0;
        if (!crosses || y1 === y0) continue;
        const t = (targetPH - y0) / (y1 - y0);
        const volume = x0 + (x1 - x0) * t;
        addResult(volume, targetPH, i - 1);
    }
    return results;
}
function makePointFromPHResult(tab, dataset, datasetIndex, result, curveName = null) {
    return {
        datasetIndex,
        index: result.index,
        volume: result.volume,
        ph: result.ph,
        color: dataset.borderColor || dataset.backgroundColor || '#57a7bd',
        curveName: curveName || dataset.label,
        savedCurveIndex: dataset.savedCurveIndex,
        pointStyle: dataset.savedPointStyle,
        markStyle: cloneMarkStyleConfig(dataset.savedMarkStyle)
    };
}
function pickPointByPH(tab, targetPH) {
    if (!tab || !tab.chart || !Number.isFinite(targetPH)) return;
    let pickedCount = 0;
    let lastPoint = null;
    if (tab.type === 'single') {
        if (!Array.isArray(tab.volumes) || !tab.volumes.length) return;
        const points = tab.volumes.map((v, idx) => ({ x: v, y: tab.phs[idx] }));
        const results = interpolatePointsByPH(points, targetPH);
        const dataset = tab.chart.data.datasets[0];
        results.forEach(result => {
            const point = makePointFromPHResult(tab, dataset, 0, result, dataset.label);
            updatePointAnnotation(tab, point);
            addFixedMark(tab, point);
            lastPoint = point;
            pickedCount++;
        });
        if (lastPoint) {
            showPointInfo(tab, lastPoint.volume, lastPoint.ph);
        }
    } else {
        const targets = Array.isArray(tab.volumePickIndices) ? tab.volumePickIndices : [];
        if (!targets.length) {
            showAlert(t('提示', 'Tip'), t('请先在“选择标点曲线”中选择要按 pH 取点的曲线。', 'Please select curves to pick by pH in "Select mark curves".'), 'warning');
            return;
        }
        targets.forEach(index => {
            const curve = savedCurves[index];
            if (!curve || !Array.isArray(curve.volumes) || !curve.volumes.length) return;
            const datasetIndex = tab.chart.data.datasets.findIndex(dataset => dataset.savedCurveIndex === index);
            if (datasetIndex === -1) return;
            const dataset = tab.chart.data.datasets[datasetIndex];
            const points = curve.volumes.map((v, idx) => ({ x: v, y: curve.phs[idx] }));
            const results = interpolatePointsByPH(points, targetPH);
            results.forEach(result => {
                const point = makePointFromPHResult(tab, dataset, datasetIndex, result, curve.name);
                updatePointAnnotation(tab, point);
                addFixedMark(tab, point);
                lastPoint = point;
                pickedCount++;
            });
        });
    }
    if (!pickedCount) {
        showAlert(t('提示', 'Tip'), t('当前曲线没有经过 pH = {ph} 的位置。', 'The current curve does not pass pH = {ph}.').replace('{ph}', targetPH.toFixed(2)), 'ℹ');
    }
}
function getFittedPointFromEvent(chart, event, distanceLimit = 120) {
    if (!chart) return null;
    const pos = getCanvasPosition(chart, event);
    const xValue = chart.scales.x.getValueForPixel(pos.x);
    if (!Number.isFinite(xValue)) return null;
    let best = null;
    let bestDistance = Infinity;
    chart.data.datasets.forEach((dataset, datasetIndex) => {
        if (dataset && dataset.yAxisID === 'yDerivative') return;
        const points = getDatasetPoints(chart, dataset);
        const interpolated = interpolatePoint(points, xValue);
        if (!interpolated) return;
        const xPixel = chart.scales.x.getPixelForValue(interpolated.volume);
        const yPixel = chart.scales.y.getPixelForValue(interpolated.ph);
        const distance = Math.hypot(pos.x - xPixel, pos.y - yPixel);
        if (distance < bestDistance) {
            bestDistance = distance;
            best = {
                datasetIndex,
                index: interpolated.index,
                volume: interpolated.volume,
                ph: interpolated.ph,
                color: dataset.borderColor || dataset.backgroundColor || '#57a7bd',
                curveName: dataset.label,
                savedCurveIndex: dataset.savedCurveIndex,
                pointStyle: dataset.savedPointStyle,
                markStyle: cloneMarkStyleConfig(dataset.savedMarkStyle)
            };
        }
    });
    if (!best || bestDistance > distanceLimit) return null;
    return best;
}
function getPointFromEvent(chart, event, allowFitted = true) {
    if (!chart) return null;
    const elements = chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, true);
    if (elements && elements.length > 0) {
        const filtered = elements.filter(el => {
            const ds = chart.data.datasets[el.datasetIndex];
            return ds && ds.yAxisID !== 'yDerivative';
        });
        const target = filtered.length ? filtered[0] : null;
        if (target) {
            const { datasetIndex, index } = target;
            const dataset = chart.data.datasets[datasetIndex];
            const normalized = normalizeDatasetPoint(chart, dataset, index);
            if (!normalized) return null;
            return {
                datasetIndex,
                index,
                volume: normalized.volume,
                ph: normalized.ph,
                color: dataset.borderColor || dataset.backgroundColor || '#57a7bd',
                curveName: dataset.label,
                savedCurveIndex: dataset.savedCurveIndex,
                pointStyle: dataset.savedPointStyle,
                markStyle: cloneMarkStyleConfig(dataset.savedMarkStyle)
            };
        }
    }
    if (!allowFitted) return null;
    return getFittedPointFromEvent(chart, event);
}
function getCanvasPosition(chart, event) {
    const rect = chart.canvas.getBoundingClientRect();
    const rawX = event.clientX - rect.left;
    const rawY = event.clientY - rect.top;
    const area = chart.chartArea || { left: 0, right: chart.width, top: 0, bottom: chart.height };
    const x = Math.min(Math.max(rawX, area.left + 1), area.right - 1);
    const y = Math.min(Math.max(rawY, area.top + 1), area.bottom - 1);
    return { x, y };
}
function getLabelLayout(chart, point, labelText, simpleLabelMode) {
    const chartArea = chart.chartArea;
    const xValue = point.volume;
    const xPixel = chart.scales.x.getPixelForValue(xValue);
    const yPixel = chart.scales.y.getPixelForValue(point.ph);
    const ctx = chart.ctx;
    ctx.save();
    const fontSize = simpleLabelMode ? 10 : 10.5;
    ctx.font = `${fontSize}px ${Chart.defaults.font && Chart.defaults.font.family ? Chart.defaults.font.family : 'sans-serif'}`;
    const textWidth = ctx.measureText(labelText).width;
    ctx.restore();
    const approxWidth = Math.max(simpleLabelMode ? 52 : 76, Math.ceil(textWidth) + (simpleLabelMode ? 4 : 18));
    const approxHeight = simpleLabelMode ? 16 : 22;
    const labels = chart.data.labels || [];
    const dataset = chart.data.datasets && chart.data.datasets[point.datasetIndex] ? chart.data.datasets[point.datasetIndex].data : [];
    let xAdjust = 0;
    let yAdjust = simpleLabelMode ? -22 : -31;
    const index = point.index;
    if (Number.isFinite(index) && index > 0 && index < dataset.length - 1) {
        const prevY = dataset[index - 1];
        const nextY = dataset[index + 1];
        const prevX = parseFloat(labels[index - 1]);
        const nextX = parseFloat(labels[index + 1]);
        const slope = (nextY - prevY) / ((nextX - prevX) || 1);
        if (Math.abs(slope) > 0.6) {
            xAdjust = slope > 0 ? 22 : -22;
        }
    }
    const topSpace = yPixel - chartArea.top;
    if (topSpace < approxHeight + 10) {
        yAdjust = simpleLabelMode ? 16 : 26;
    }
    const left = xPixel + xAdjust - approxWidth / 2;
    const right = xPixel + xAdjust + approxWidth / 2;
    if (left < chartArea.left + 14) {
        xAdjust += chartArea.left + 14 - left;
    } else if (right > chartArea.right - 6) {
        xAdjust += chartArea.right - 6 - right;
    }
    const top = yPixel - approxHeight + yAdjust;
    const bottom = yPixel + yAdjust;
    if (top < chartArea.top + 6) {
        yAdjust = chartArea.top + 6 - (yPixel - approxHeight);
    } else if (bottom > chartArea.bottom - 6) {
        yAdjust = chartArea.bottom - 6 - yPixel;
    }
    return { xAdjust, yAdjust, approxWidth, approxHeight, xPixel, yPixel };
}
function resolveMarkPointStyle(tab, point) {
    if (point && point.pointStyle) return point.pointStyle;
    if (tab && tab.type === 'multi' && point) {
        const dataset = tab.chart?.data?.datasets?.[point.datasetIndex];
        if (dataset && dataset.savedPointStyle) return dataset.savedPointStyle;
        if (Number.isFinite(point.savedCurveIndex) && savedCurves[point.savedCurveIndex]) {
            const curve = savedCurves[point.savedCurveIndex];
            return curve.pointStyle || curve.params?.curvePointStyle || 'circle';
        }
        const curve = savedCurves.find(item => item.name === point.curveName);
        if (curve) return curve.pointStyle || curve.params?.curvePointStyle || 'circle';
    }
    return (tab && tab.curvePointStyle) || 'circle';
}
function buildMarkStyleFromTab(tab) {
    if (!tab) return null;
    return {
        fillEnabled: !!tab.markFillEnabled,
        fillColor: tab.markFillColor || '#57a7bd',
        borderEnabled: !!tab.markBorderEnabled,
        borderColor: tab.markBorderColor || '#0f172a',
        radiusEnabled: !!tab.markRadiusEnabled,
        radius: Number.isFinite(tab.markRadius) ? tab.markRadius : 5,
        borderWidthEnabled: !!tab.markBorderWidthEnabled,
        borderWidth: Number.isFinite(tab.markBorderWidth) ? tab.markBorderWidth : 2.8
    };
}
function cloneMarkStyleConfig(style) {
    if (!style || typeof style !== 'object') return null;
    return {
        fillEnabled: !!style.fillEnabled,
        fillColor: style.fillColor || '#57a7bd',
        borderEnabled: !!style.borderEnabled,
        borderColor: style.borderColor || '#0f172a',
        radiusEnabled: !!style.radiusEnabled,
        radius: Number.isFinite(style.radius) ? style.radius : 5,
        borderWidthEnabled: !!style.borderWidthEnabled,
        borderWidth: Number.isFinite(style.borderWidth) ? style.borderWidth : 2.8
    };
}
function getCurveMarkStyleConfig(curve) {
    if (!curve) return null;
    return cloneMarkStyleConfig(curve.markStyle || {
        fillEnabled: curve.markFillEnabled,
        fillColor: curve.markFillColor,
        borderEnabled: curve.markBorderEnabled,
        borderColor: curve.markBorderColor,
        radiusEnabled: curve.markRadiusEnabled,
        radius: curve.markRadius,
        borderWidthEnabled: curve.markBorderWidthEnabled,
        borderWidth: curve.markBorderWidth
    });
}
function resolveMarkStyleConfig(tab, point) {
    if (point && point.markStyle) return cloneMarkStyleConfig(point.markStyle);
    if (tab && tab.type === 'single') return buildMarkStyleFromTab(tab);
    if (tab && tab.type === 'multi' && point) {
        const dataset = tab.chart?.data?.datasets?.[point.datasetIndex];
        if (dataset && dataset.savedMarkStyle) return cloneMarkStyleConfig(dataset.savedMarkStyle);
        if (Number.isFinite(point.savedCurveIndex) && savedCurves[point.savedCurveIndex]) {
            return getCurveMarkStyleConfig(savedCurves[point.savedCurveIndex]);
        }
        const curve = savedCurves.find(item => item.name === point.curveName);
        if (curve) return getCurveMarkStyleConfig(curve);
    }
    return null;
}
function buildAnnotationEntries(chart, point, keyPrefix, simpleLabelMode, tab = null) {
    const isPaperStyle = chartStyle === 'paper';
    const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
    const pointLuminance = getRelativeLuminance(point.color);
    const lightTheme = document.documentElement.getAttribute('data-theme') === 'light';
    const labelBaseColor = (lightTheme || isPaperStyle)
        ? getReadableAccentColor(point.color, { target: 'light' })
        : point.color;
    const labelColor = isPaperStyle ? (isDarkTheme ? '#f8fafc' : '#0f172a') : labelBaseColor;
    const bgColor = isPaperStyle
        ? (isDarkTheme ? 'rgba(15, 23, 42, 0.82)' : 'rgba(255,255,255,0.94)')
        : labelBaseColor + (lightTheme ? 'e6' : 'cc');
    const textColor = isPaperStyle ? (isDarkTheme ? '#f8fafc' : '#0f172a') : getTextColorForFill(labelBaseColor);
    const borderColor = isPaperStyle ? (isDarkTheme ? 'rgba(248, 250, 252, 0.72)' : '#0f172a') : labelBaseColor;
    const defaultLabel = `(${point.volume.toFixed(2)}, ${point.ph.toFixed(2)})`;
    const displayLabel = point.label ?? defaultLabel;
    const layout = getLabelLayout(chart, point, displayLabel, simpleLabelMode);
    const xValue = point.volume;
    const labelConfig = {
        type: 'label',
        xValue: xValue,
        yValue: point.ph,
        backgroundColor: simpleLabelMode ? 'transparent' : bgColor,
        borderColor: simpleLabelMode ? 'transparent' : borderColor,
        borderWidth: simpleLabelMode ? 0 : (isPaperStyle ? 1 : 1.5),
        borderRadius: simpleLabelMode ? 0 : (isPaperStyle ? 6 : 8),
        content: displayLabel,
        font: { size: isPaperStyle ? 9.5 : 10.5, weight: '600' },
        color: simpleLabelMode ? labelColor : textColor,
        padding: simpleLabelMode ? { top: 0, bottom: 0, left: 0, right: 0 } : { top: 4, bottom: 4, left: 9, right: 9 },
        xAdjust: layout.xAdjust,
        yAdjust: layout.yAdjust,
        enabled: true,
        position: 'center'
    };
    const markPointStyle = resolveMarkPointStyle(tab, point);
    let markPointRadius = getMarkPointRadius(markPointStyle, isPaperStyle);
    let markBorderWidth = markPointRadius > 0 ? ((lightTheme || isPaperStyle) ? 2.8 : 1.8) : 0;
    const markColors = getContrastMarkColors(point.color, isPaperStyle, isDarkTheme);
    const markStyleConfig = resolveMarkStyleConfig(tab, point);
    if (markStyleConfig) {
        if (markStyleConfig.fillEnabled && markStyleConfig.fillColor) {
            markColors.fill = `${markStyleConfig.fillColor}ff`;
        }
        if (markStyleConfig.borderEnabled && markStyleConfig.borderColor) {
            markColors.border = markStyleConfig.borderColor;
        }
        if (markStyleConfig.radiusEnabled && Number.isFinite(markStyleConfig.radius) && markPointStyle !== 'none') {
            markPointRadius = markStyleConfig.radius;
        }
        if (markStyleConfig.borderWidthEnabled && Number.isFinite(markStyleConfig.borderWidth) && markPointRadius > 0) {
            markBorderWidth = markStyleConfig.borderWidth;
        }
    }
    const pointConfig = {
        type: 'point',
        xValue: xValue,
        yValue: point.ph,
        backgroundColor: markColors.fill,
        borderColor: markColors.border,
        borderWidth: markPointRadius > 0 ? markBorderWidth : 0,
        radius: markPointRadius,
        hitRadius: Math.max(markPointRadius + 5, 10),
        pointStyle: getMarkPointStyle(markPointStyle),
        enabled: true
    };
    const entries = {};
    entries[`${keyPrefix}Point`] = pointConfig;
    entries[`${keyPrefix}Label`] = labelConfig;
    return entries;
}
function buildRangeBandAnnotation(yMin, yMax, color, label, keyPrefix, order = 0, labelOptions = {}) {
    if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) return {};
    const low = Math.max(0, Math.min(yMin, yMax));
    const high = Math.min(14, Math.max(yMin, yMax));
    const entries = {};
    entries[`${keyPrefix}Band`] = {
        type: 'box',
        yMin: low,
        yMax: high,
        backgroundColor: color.background,
        borderColor: color.border,
        borderWidth: color.borderWidth ?? 1,
        borderDash: color.borderDash || [],
        drawTime: 'beforeDatasetsDraw',
        z: order,
        label: {
            display: true,
            content: label,
            position: labelOptions.position || { x: 'start', y: 'center' },
            color: color.text || color.border,
            backgroundColor: color.labelBackground || 'rgba(15, 23, 42, 0.72)',
            borderRadius: labelOptions.borderRadius ?? 999,
            padding: labelOptions.padding || { top: 4, bottom: 4, left: 9, right: 9 },
            xAdjust: labelOptions.xAdjust || 0,
            yAdjust: labelOptions.yAdjust || 0,
            font: { size: labelOptions.fontSize || 10.5, weight: labelOptions.fontWeight || '700' }
        }
    };
    return entries;
}
function buildLeapEndpointTick(point, keyPrefix, color) {
    if (!point || !Number.isFinite(point.volume) || !Number.isFinite(point.ph)) return {};
    const tickHalfWidth = point.tickHalfWidth || 0.8;
    const xMin = Math.max(point.xMinLimit ?? -Infinity, point.volume - tickHalfWidth);
    const xMax = Math.min(point.xMaxLimit ?? Infinity, point.volume + tickHalfWidth);
    const entries = {};
    entries[`${keyPrefix}Tick`] = {
        type: 'line',
        xMin,
        xMax,
        yMin: point.ph,
        yMax: point.ph,
        borderColor: hexToRgba(color, 0.82),
        borderWidth: 2.5,
        borderCapStyle: 'round',
        drawTime: 'afterDatasetsDraw',
        label: {
            display: false
        }
    };
    return entries;
}
function buildIndicatorRangeAnnotations(tab) {
    const annotations = {};
    if (!tab || !tab.showIndicatorRange || !tab.jumpInfo) return annotations;
    const isZh = uiLanguage === 'zh';
    const xMinLimit = Array.isArray(tab.volumes) && tab.volumes.length ? tab.volumes[0] : 0;
    const xMaxLimit = Array.isArray(tab.volumes) && tab.volumes.length ? tab.volumes[tab.volumes.length - 1] : config.maxVolume;
    const xRange = Math.max(1, xMaxLimit - xMinLimit);
    const tickHalfWidth = Math.max(0.25, Math.min(xRange * 0.018, xRange / 18));
    const leapList = Array.isArray(tab.jumpInfo.leaps) && tab.jumpInfo.leaps.length ? tab.jumpInfo.leaps : [tab.jumpInfo];
    leapList.forEach((leap, index) => {
        // v6.5.5: 优先使用用户在跃迁样式 panel 中配置的颜色与标签
        const userEntry = (tab.leapStyleConfig && tab.leapStyleConfig[index]) || null;
        const leapColor = (userEntry && userEntry.color) || leap.color || leapMarkerColors[index % leapMarkerColors.length];
        const leapPalette = getAnnotationPalette(leapColor, 'range');
        const defaultLeapLabel = leapList.length > 1
            ? t('pH 跃迁区 #', 'pH leap #') + (index + 1)
            : t('pH跃迁区', 'pH leap zone');
        const userLeapText = userEntry && typeof userEntry.leapText === 'string' ? userEntry.leapText : '';
        const leapLabelText = userLeapText.length ? userLeapText : defaultLeapLabel;
        Object.assign(annotations, buildRangeBandAnnotation(
            leap.startPH,
            leap.endPH,
            {
                background: leapPalette.background,
                border: leapPalette.border,
                borderWidth: 1.35,
                labelBackground: leapPalette.labelBackground,
                text: leapPalette.text
            },
            leapLabelText,
            `jump${index}Band`,
            -35 + index,
            {
                position: index % 2 === 0 ? { x: 'end', y: 'center' } : { x: 'start', y: 'center' },
                xAdjust: index % 2 === 0 ? -10 : 10,
                fontSize: 10.8,
                fontWeight: '800',
                padding: { top: 4, bottom: 4, left: 9, right: 9 }
            }
        ));
        Object.assign(annotations, buildLeapEndpointTick(
            { volume: leap.startVolume, ph: leap.startPH, tickHalfWidth, xMinLimit, xMaxLimit },
            `jump${index}Start`,
            leapColor
        ));
        Object.assign(annotations, buildLeapEndpointTick(
            { volume: leap.endVolume, ph: leap.endPH, tickHalfWidth, xMinLimit, xMaxLimit },
            `jump${index}End`,
            leapColor
        ));
    });
    const indicator = getSelectedIndicator(tab);
    const fit = getIndicatorFit(tab, indicator);
    if (!fit) return annotations;
    const indicatorPalette = getAnnotationPalette(indicator.color, 'indicator');
    Object.assign(annotations, buildRangeBandAnnotation(
        fit.low,
        fit.high,
        {
            background: indicatorPalette.background,
            border: indicatorPalette.border,
            borderDash: [7, 5],
            borderWidth: 1.7,
            labelBackground: indicatorPalette.labelBackground,
            text: indicatorPalette.text
        },
        ((tab.leapStyleConfig && tab.leapStyleConfig[0] && tab.leapStyleConfig[0].indicatorText) || `${getIndicatorLabel(indicator)} · pH ${fit.low.toFixed(1)}-${fit.high.toFixed(1)}`),
        'indicatorRange',
        -10,
        {
            position: { x: 'start', y: 'start' },
            xAdjust: 10,
            yAdjust: -8,
            fontSize: 10.8,
            fontWeight: '800',
            padding: { top: 4, bottom: 4, left: 9, right: 9 }
        }
    ));
    if (fit.overlaps && Array.isArray(fit.validOverlaps)) {
        fit.validOverlaps.forEach((overlap, index) => {
            const overlapPalette = getAnnotationPalette('#16a34a', 'overlap');
            Object.assign(annotations, buildRangeBandAnnotation(
                overlap.overlapLow,
                overlap.overlapHigh,
                {
                    background: overlapPalette.background,
                    border: overlapPalette.border,
                    borderWidth: 1.8,
                    labelBackground: overlapPalette.labelBackground,
                    text: overlapPalette.text
                },
                ((tab.leapStyleConfig && tab.leapStyleConfig[overlap.leapIndex] && tab.leapStyleConfig[overlap.leapIndex].overlapText) ||
                    (fit.validOverlaps.length > 1
                        ? t('有效终点区 #', 'Endpoint fit #') + (overlap.leapIndex + 1)
                        : t('有效终点区', 'Endpoint fit'))),
                `indicatorOverlap${index}`,
                index,
                {
                    position: index % 2 === 0 ? { x: 'end', y: 'end' } : { x: 'end', y: 'start' },
                    yAdjust: index % 2 === 0 ? 8 : -8,
                    xAdjust: -8 * (index + 1),
                    fontSize: 10.8,
                    fontWeight: '800',
                    padding: { top: 4, bottom: 4, left: 9, right: 9 }
                }
            ));
        });
    }
    return annotations;
}
function ensureAnnotationOffsetStore(tab) {
    if (!tab.annotationLabelOffsets || typeof tab.annotationLabelOffsets !== 'object') {
        tab.annotationLabelOffsets = {};
    }
    return tab.annotationLabelOffsets;
}
function clearAnnotationLabelOffsets(tab) {
    if (!tab) return;
    tab.annotationLabelOffsets = {};
    if (tab.chart?.options?.plugins?.annotation?.annotations) {
        applyAnnotationLabelOffsets(tab, tab.chart.options.plugins.annotation.annotations);
        tab.chart.update('none');
    }
}
function applyAnnotationLabelOffsets(tab, annotations) {
    if (!tab || !annotations) return annotations;
    const store = ensureAnnotationOffsetStore(tab);
    Object.entries(annotations).forEach(([key, cfg]) => {
        const offset = store[key] || { x: 0, y: 0 };
        if (cfg.type === 'label') {
            cfg._draggableLabel = true;
            cfg._baseXAdjust = Number(cfg.xAdjust) || 0;
            cfg._baseYAdjust = Number(cfg.yAdjust) || 0;
            cfg.xAdjust = cfg._baseXAdjust + offset.x;
            cfg.yAdjust = cfg._baseYAdjust + offset.y;
        } else if (cfg.label && cfg.label.display) {
            cfg._draggableLabel = true;
            cfg.label._baseXAdjust = Number(cfg.label.xAdjust) || 0;
            cfg.label._baseYAdjust = Number(cfg.label.yAdjust) || 0;
            cfg.label.xAdjust = cfg.label._baseXAdjust + offset.x;
            cfg.label.yAdjust = cfg.label._baseYAdjust + offset.y;
        }
    });
    return annotations;
}
function getAnnotationTextSize(chart, text, fontSize = 11, padding = 8) {
    const content = Array.isArray(text) ? text.join(' ') : String(text || '');
    const ctx = chart.ctx;
    ctx.save();
    ctx.font = `${fontSize}px ${Chart.defaults.font && Chart.defaults.font.family ? Chart.defaults.font.family : 'sans-serif'}`;
    const width = Math.max(38, ctx.measureText(content).width + padding * 2);
    ctx.restore();
    return { width, height: Math.max(18, fontSize + padding) };
}
function getRangeLabelAnchor(chart, cfg) {
    const chartArea = chart.chartArea;
    const xPos = (cfg.label && cfg.label.position && cfg.label.position.x) || 'start';
    const yPos = (cfg.label && cfg.label.position && cfg.label.position.y) || 'center';
    const yScale = chart.scales.y;
    const yMinPx = yScale.getPixelForValue(cfg.yMin);
    const yMaxPx = yScale.getPixelForValue(cfg.yMax);
    const top = Math.min(yMinPx, yMaxPx);
    const bottom = Math.max(yMinPx, yMaxPx);
    const x = xPos === 'end' ? chartArea.right : (xPos === 'center' ? (chartArea.left + chartArea.right) / 2 : chartArea.left);
    const y = yPos === 'end' ? bottom : (yPos === 'start' ? top : (top + bottom) / 2);
    return { x, y };
}
function getAnnotationLabelBox(chart, key, cfg) {
    if (!cfg || !cfg._draggableLabel) return null;
    let x;
    let y;
    let content;
    let fontSize = 11;
    let pad = 8;
    if (cfg.type === 'label') {
        const xScale = chart.scales.x;
        const yScale = chart.scales[cfg.yScaleID] || chart.scales.y;
        if (!xScale || !yScale) return null;
        x = xScale.getPixelForValue(Number(cfg.xValue));
        y = yScale.getPixelForValue(Number(cfg.yValue));
        content = cfg.content;
        fontSize = Number(cfg.font && cfg.font.size) || 11;
        pad = cfg.padding && typeof cfg.padding === 'object' ? Math.max(cfg.padding.left || 0, cfg.padding.right || 0, 4) : 8;
        x += Number(cfg.xAdjust) || 0;
        y += Number(cfg.yAdjust) || 0;
    } else if (cfg.label && cfg.label.display) {
        const anchor = getRangeLabelAnchor(chart, cfg);
        x = anchor.x + (Number(cfg.label.xAdjust) || 0);
        y = anchor.y + (Number(cfg.label.yAdjust) || 0);
        content = cfg.label.content;
        fontSize = Number(cfg.label.font && cfg.label.font.size) || 11;
        pad = cfg.label.padding && typeof cfg.label.padding === 'object' ? Math.max(cfg.label.padding.left || 0, cfg.label.padding.right || 0, 4) : 8;
    } else {
        return null;
    }
    const size = getAnnotationTextSize(chart, content, fontSize, pad);
    return {
        key,
        x,
        y,
        left: x - size.width / 2,
        right: x + size.width / 2,
        top: y - size.height / 2,
        bottom: y + size.height / 2
    };
}
function findDraggableAnnotationsAt(chart, x, y) {
    const annotations = chart?.options?.plugins?.annotation?.annotations || {};
    const boxes = Object.entries(annotations)
        .map(([key, cfg]) => getAnnotationLabelBox(chart, key, cfg))
        .filter(Boolean)
        .reverse();
    return boxes.filter(box => x >= box.left && x <= box.right && y >= box.top && y <= box.bottom);
}
function findDraggableAnnotationAt(chart, x, y) {
    return findDraggableAnnotationsAt(chart, x, y)[0] || null;
}
function installAnnotationLabelDragging(tab) {
    const chart = tab && tab.chart;
    const canvas = chart && chart.canvas;
    if (!chart || !canvas) return;
    canvas.__annotationDragTab = tab;
    if (canvas.dataset.annotationDragBound === '1') return;
    canvas.dataset.annotationDragBound = '1';
    canvas.style.touchAction = 'none';
    let drag = null;
    const getCurrentTab = () => canvas.__annotationDragTab || tab;
    const getCurrentChart = () => {
        const currentTab = getCurrentTab();
        const current = currentTab && currentTab.chart ? currentTab.chart : null;
        if (current && current.canvas === canvas) return current;
        if (window.Chart && typeof Chart.getChart === 'function') return Chart.getChart(canvas);
        return null;
    };
    const getPoint = event => {
        const rect = canvas.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    canvas.addEventListener('pointerdown', event => {
        const currentChart = getCurrentChart();
        if (!currentChart) return;
        const point = getPoint(event);
        const hits = findDraggableAnnotationsAt(currentChart, point.x, point.y);
        if (!hits.length) return;
        const currentTab = getCurrentTab();
        const store = ensureAnnotationOffsetStore(currentTab);
        const items = hits.map(hit => {
            const current = store[hit.key] || { x: 0, y: 0 };
            return {
                key: hit.key,
                baseX: current.x || 0,
                baseY: current.y || 0
            };
        });
        drag = {
            items,
            startX: point.x,
            startY: point.y
        };
        try {
            canvas.setPointerCapture?.(event.pointerId);
        } catch (err) {
        }
        canvas.style.cursor = 'grabbing';
        event.preventDefault();
    }, { passive: false });
    canvas.addEventListener('pointermove', event => {
        const currentChart = getCurrentChart();
        if (!currentChart) return;
        if (!drag) {
            const point = getPoint(event);
            canvas.style.cursor = findDraggableAnnotationAt(currentChart, point.x, point.y) ? 'grab' : '';
            return;
        }
        const point = getPoint(event);
        const currentTab = getCurrentTab();
        const store = ensureAnnotationOffsetStore(currentTab);
        (drag.items || []).forEach(item => {
            store[item.key] = {
                x: item.baseX + point.x - drag.startX,
                y: item.baseY + point.y - drag.startY
            };
        });
        if (currentTab && typeof currentTab.refreshAnnotations === 'function') {
            currentTab.refreshAnnotations();
        } else {
            refreshTabAnnotations(currentTab);
        }
        event.preventDefault();
    }, { passive: false });
    const endDrag = event => {
        if (!drag) return;
        try {
            canvas.releasePointerCapture?.(event.pointerId);
        } catch (err) {
        }
        drag = null;
        canvas.style.cursor = '';
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('pointerleave', () => {
        if (!drag) canvas.style.cursor = '';
    });
}
function applyChartAnnotations(chart, selectedPoint, fixedPoints, simpleLabelMode, tab) {
    if (!chart || !chart.options.plugins.annotation) return;
    const annotations = {};
    Object.assign(annotations, buildIndicatorRangeAnnotations(tab));
    if (selectedPoint) {
        Object.assign(annotations, buildAnnotationEntries(chart, selectedPoint, 'selected', simpleLabelMode, tab));
    }
    fixedPoints.forEach((point, idx) => {
        Object.assign(annotations, buildAnnotationEntries(chart, point, `fixed_${idx}`, simpleLabelMode, tab));
    });
    applyAnnotationLabelOffsets(tab, annotations);
    chart.options.plugins.annotation.annotations = annotations;
    chart.update('none');
    installAnnotationLabelDragging(tab);
}
function refreshTabAnnotations(tab) {
    if (!tab || !tab.chart) return;
    applyChartAnnotations(tab.chart, tab.selectedPoint, tab.fixedMarks, tab.simpleLabelMode, tab);
    updateMarksPanel(tab);
    if (tab.type === 'single') renderLeapStylePanel(tab);
}
function ensureLeapStyleConfig(tab) {
    if (!tab.leapStyleConfig || typeof tab.leapStyleConfig !== 'object') {
        tab.leapStyleConfig = {};
    }
    return tab.leapStyleConfig;
}
function getLeapStyleEntry(tab, index) {
    const cfg = ensureLeapStyleConfig(tab);
    if (!cfg[index]) {
        const defaultColor = (typeof leapMarkerColors !== 'undefined' && leapMarkerColors[index % leapMarkerColors.length]) || '#f59e0b';
        cfg[index] = {
            color: defaultColor,
            leapText: '',
            indicatorText: '',
            overlapText: '',
            enabled: true
        };
    }
    return cfg[index];
}
function renderLeapStylePanel(tab) {
    if (!tab || tab.type !== 'single') return;
    const pane = getTabContent(tab);
    if (!pane) return;
    const container = pane.querySelector('[data-role="leap-style-content"]');
    if (!container) return;
    const isZh = uiLanguage === 'zh';
    const leaps = (tab.jumpInfo && Array.isArray(tab.jumpInfo.leaps) && tab.jumpInfo.leaps.length)
        ? tab.jumpInfo.leaps
        : (tab.jumpInfo ? [tab.jumpInfo] : []);
    if (!leaps.length) {
        container.innerHTML = '<div class="leap-style-empty" data-i18n="leap_style_empty">生成滴定曲线后会显示各跃迁区样式配置</div>';
        return;
    }
    const indicator = getSelectedIndicator(tab);
    const indicatorLabel = indicator ? getIndicatorLabel(indicator) : '';
    const indicatorRange = indicator ? `${indicator.range[0].toFixed(1)}-${indicator.range[1].toFixed(1)}` : '';
    const html = leaps.map((leap, index) => {
        const entry = getLeapStyleEntry(tab, index);
        const title = leaps.length > 1
            ? t('pH 跃迁区 #', 'pH leap #') + (index + 1)
            : t('pH 跃迁区', 'pH leap zone');
        const leapPh = `${leap.startPH.toFixed(2)} - ${leap.endPH.toFixed(2)}`;
        return `
            <div class="leap-style-row" data-leap-index="${index}">
                <div class="leap-style-row-title">
                    <span class="leap-color-dot" style="background:${entry.color};"></span>
                    <span>${title}</span>
                    <span style="font-weight:400;color:var(--text-secondary);font-size:0.76rem;">pH ${leapPh}</span>
                </div>
                <div class="leap-style-grid">
                    <label><span data-i18n="leap_color">跃迁颜色</span>
                        <input type="color" data-leap-field="color" value="${entry.color}">
                    </label>
                    <label><span data-i18n="leap_label">跃迁标签</span>
                        <input type="text" data-leap-field="leapText" value="${(entry.leapText || '').replace(/"/g, '&quot;')}" placeholder="${t('可留空, 默认显示 pH 跃迁区', 'Leave empty for default pH leap zone')}">
                    </label>
                    <label><span data-i18n="indicator_label">指示剂标签</span>
                        <input type="text" data-leap-field="indicatorText" value="${(entry.indicatorText || '').replace(/"/g, '&quot;')}" placeholder="${indicator ? indicatorLabel + ' · pH ' + indicatorRange : t('请先选择指示剂', 'Pick indicator first')}">
                    </label>
                    <label><span data-i18n="endpoint_label">有效终点标签</span>
                        <input type="text" data-leap-field="overlapText" value="${(entry.overlapText || '').replace(/"/g, '&quot;')}" placeholder="${t('可留空, 默认显示有效终点区', 'Leave empty for default endpoint fit')}">
                    </label>
                </div>
            </div>
        `;
    }).join('');
    container.innerHTML = html;
    if (typeof translateStaticUI === 'function') translateStaticUI();
    container.querySelectorAll('.leap-style-row').forEach(row => {
        const index = parseInt(row.dataset.leapIndex, 10);
        row.querySelectorAll('[data-leap-field]').forEach(input => {
            const field = input.dataset.leapField;
            const handler = () => {
                const entry = getLeapStyleEntry(tab, index);
                entry[field] = input.value;
                if (field === 'color') {
                    const dot = row.querySelector('.leap-color-dot');
                    if (dot) dot.style.background = input.value;
                    applyChartAnnotations(tab.chart, tab.selectedPoint, tab.fixedMarks, tab.simpleLabelMode, tab);
                } else {
                    applyChartAnnotations(tab.chart, tab.selectedPoint, tab.fixedMarks, tab.simpleLabelMode, tab);
                }
            };
            input.addEventListener('input', handler);
            input.addEventListener('change', handler);
        });
    });
    restoreDetailsOpenState(container);
}
const __detailsOpenState = new Map();
function __detailsKey(el) {
    if (!el) return null;
    return el.dataset.persistKey
        || el.id
        || el.getAttribute('data-role')
        || (el.querySelector('summary') ? 'sum:' + (el.querySelector('summary').textContent || '').trim() : null);
}
document.addEventListener('toggle', function(e) {
    const t = e.target;
    if (!t || t.tagName !== 'DETAILS') return;
    if (!t.matches('.chart-appearance-panel, .leap-style-panel, .curve-settings-item, details[data-keep-open]')) return;
    const key = __detailsKey(t);
    if (!key) return;
    __detailsOpenState.set(key, t.open);
}, true);
function restoreDetailsOpenState(root) {
    (root || document).querySelectorAll('.chart-appearance-panel, .leap-style-panel, .curve-settings-item, details[data-keep-open]').forEach(d => {
        const key = __detailsKey(d);
        if (!key) return;
        if (__detailsOpenState.has(key)) {
            d.open = __detailsOpenState.get(key);
        }
    });
}
function updatePointAnnotation(tab, point) {
    if (!tab || !point) return;
    tab.selectedPoint = point;
    refreshTabAnnotations(tab);
}
function toggleFixedMark(tab, point) {
    if (!tab || !point) return;
    const keyBase = tab.type === 'multi'
        ? `m-${point.curveName || point.datasetIndex}-${point.volume.toFixed(3)}`
        : `s-${point.volume.toFixed(3)}`;
    const key = point.markKey || keyBase;
    const existingIndex = tab.fixedMarks.findIndex(mark => mark.key === key);
    if (existingIndex !== -1) {
        tab.fixedMarks.splice(existingIndex, 1);
    } else {
        tab.fixedMarks.push({
            key,
            datasetIndex: point.datasetIndex,
            index: point.index,
            label: point.label ?? ('(' + point.volume.toFixed(2) + ', ' + point.ph.toFixed(2) + ')'),
            volume: point.volume,
            ph: point.ph,
            color: point.color,
            curveName: point.curveName,
            savedCurveIndex: point.savedCurveIndex,
            pointStyle: point.pointStyle
        });
    }
    refreshTabAnnotations(tab);
}
function clearAllMarks(tab) {
    if (!tab) return;
    tab.fixedMarks = [];
    tab.selectedPoint = null;
    refreshTabAnnotations(tab);
}
function updateMarksPanel(tab) {
    if (!tab) return;
    const pane = getTabContent(tab);
    if (!pane) return;
    const panel = pane.querySelector('[data-role="marks-panel"]');
    if (!panel) return;
    const countEl = panel.querySelector('.marks-count');
    const listEl = panel.querySelector('[data-role="marks-list"]');
    if (!listEl) return;
    const marks = tab.fixedMarks || [];
    if (countEl) countEl.textContent = '(' + marks.length + ')';
    if (marks.length === 0) {
        listEl.innerHTML = '<div class="marks-empty" data-i18n="no_marks_yet">暂无标记点。长按图表中的点可添加标记。</div>';
        return;
    }
    listEl.innerHTML = '';
    marks.forEach((mark, idx) => {
        const row = document.createElement('div');
        row.className = 'mark-row';
        const dot = document.createElement('span');
        dot.className = 'mark-dot';
        dot.style.backgroundColor = mark.color || '#57a7bd';
        const nameEl = document.createElement('span');
        nameEl.className = 'mark-curve-name';
        nameEl.textContent = mark.curveName || '';
        const text = document.createElement('input');
        text.className = 'mark-text';
        text.type = 'text';
        text.value = mark.label || '';
        text.addEventListener('input', function() {
            mark.label = this.value;
            if (tab.chart) applyChartAnnotations(tab.chart, tab.selectedPoint, tab.fixedMarks, tab.simpleLabelMode, tab);
        });
        text.addEventListener('change', function() {
            refreshTabAnnotations(tab);
        });
        const del = document.createElement('button');
        del.className = 'mark-delete';
        del.textContent = '×';
        del.dataset.i18nTitle = 'mark_delete_title';
        del.title = t('删除此标记', 'Delete this mark');
        del.addEventListener('click', function() {
            tab.fixedMarks.splice(idx, 1);
            refreshTabAnnotations(tab);
        });
        row.appendChild(dot);
        if (mark.curveName) row.appendChild(nameEl);
        row.appendChild(text);
        row.appendChild(del);
        listEl.appendChild(row);
    });
    if (typeof translateStaticUI === 'function') translateStaticUI();
}
function updateIntersectionPanel(tab) {
    if (!tab || tab.type !== 'multi') return;
    const pane = getTabContent(tab);
    if (!pane) return;
    const panel = pane.querySelector('[data-role="intersection-panel"]');
    if (!panel) return;
    const sel1 = panel.querySelector('[data-role="intersection-curve1"]');
    const sel2 = panel.querySelector('[data-role="intersection-curve2"]');
    const btn = panel.querySelector('[data-role="intersection-btn"]');
    if (!sel1 || !sel2 || !btn) return;
    const visible = tab.curveSelection || [];
    const curves = visible.filter(function(i) { return savedCurves[i] && savedCurves[i].volumes && savedCurves[i].volumes.length > 0; });
    sel1.innerHTML = ''; sel2.innerHTML = '';
    if (curves.length < 2) {
        sel1.innerHTML = '<option value="">--</option>';
        sel2.innerHTML = '<option value="">--</option>';
        btn.disabled = true;
        return;
    }
    curves.forEach(function(i) {
        var c = savedCurves[i];
        var opt = document.createElement('option');
        opt.value = i;
        opt.textContent = c.name || (t('曲线', 'Curve') + ' ' + i);
        sel1.appendChild(opt.cloneNode(true));
        sel2.appendChild(opt);
    });
    if (curves.length >= 2) {
        sel2.selectedIndex = Math.min(1, curves.length - 1);
    }
    btn.disabled = false;
    btn.onclick = function() {
        var i1 = parseInt(sel1.value, 10);
        var i2 = parseInt(sel2.value, 10);
        if (!Number.isFinite(i1) || !Number.isFinite(i2) || i1 === i2) {
            showAlert(t('提示', 'Tip'), t('请选择两条不同的曲线。', 'Please select two different curves.'), 'warning');
            return;
        }
        findAndMarkIntersections(tab, i1, i2);
    };
}
function findSegmentIntersection(p1, p2, p3, p4) {
    var x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
    var x3 = p3.x, y3 = p3.y, x4 = p4.x, y4 = p4.y;
    var d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(d) < 1e-12) return null;
    var t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d;
    var u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / d;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        return {
            x: x1 + t * (x2 - x1),
            y: y1 + t * (y2 - y1)
        };
    }
    return null;
}
function findIntersections(curve1, curve2) {
    var v1 = curve1.volumes, p1 = curve1.phs;
    var v2 = curve2.volumes, p2 = curve2.phs;
    if (!v1 || !v1.length || !v2 || !v2.length) return [];
    var results = [];
    for (var i = 0; i < v1.length - 1; i++) {
        for (var j = 0; j < v2.length - 1; j++) {
            var pt = findSegmentIntersection(
                { x: v1[i], y: p1[i] }, { x: v1[i + 1], y: p1[i + 1] },
                { x: v2[j], y: p2[j] }, { x: v2[j + 1], y: p2[j + 1] }
            );
            if (pt) {
                var exists = results.some(function(r) {
                    return Math.abs(r.volume - pt.x) < 0.001 && Math.abs(r.ph - pt.y) < 0.01;
                });
                if (!exists) results.push({ volume: pt.x, ph: pt.y });
            }
        }
    }
    return results;
}
function findAndMarkIntersections(tab, curveIndex1, curveIndex2) {
    var c1 = savedCurves[curveIndex1];
    var c2 = savedCurves[curveIndex2];
    if (!c1 || !c2) {
        showAlert(t('提示', 'Tip'), t('曲线数据无效。', 'Curve data is invalid.'), 'warning');
        return;
    }
    var pts = findIntersections(c1, c2);
    if (pts.length === 0) {
        showAlert(t('提示', 'Tip'), t('未找到交点，这两条曲线可能没有交点或交点位于当前数据范围之外。', 'No intersections found; the curves may not intersect or intersections are outside the data range.'), 'ℹ');
        return;
    }
    var color1 = c1.color || '#57a7bd';
    var name1 = c1.name || (t('曲线', 'Curve') + ' ' + curveIndex1);
    var name2 = c2.name || (t('曲线', 'Curve') + ' ' + curveIndex2);
    var addedCount = 0;
    pts.forEach(function(pt) {
        var key = 'inter-' + curveIndex1 + '-' + curveIndex2 + '-' + pt.volume.toFixed(3);
        if (tab.fixedMarks.find(function(m) { return m.key === key; })) return;
        tab.fixedMarks.push({
            key: key,
            datasetIndex: 0,
            index: -1,
            label: '(' + pt.volume.toFixed(2) + ', ' + pt.ph.toFixed(2) + ')',
            volume: pt.volume,
            ph: pt.ph,
            color: color1,
            curveName: name1 + ' ∩ ' + name2,
            pointStyle: 'circle',
            markStyle: null
        });
        addedCount++;
    });
    if (addedCount > 0) {
        refreshTabAnnotations(tab);
        showAlert(t('成功', 'Success'), t('找到 {count} 个交点并已标记在图中。', 'Found {count} intersection(s) and marked on the chart.').replace('{count}', addedCount), 'check');
    } else {
        showAlert(t('提示', 'Tip'), t('交点已存在，无需重复标记。', 'Intersection already exists.'), 'ℹ');
    }
}
function findFixedMarkAtPosition(tab, chart, event) {
    const pos = getCanvasPosition(chart, event);
    const points = tab.fixedMarks || [];
    for (const point of points) {
        const defaultLabel = `(${point.volume.toFixed(2)}, ${point.ph.toFixed(2)})`;
        const displayLabel = point.label ?? defaultLabel;
        const layout = getLabelLayout(chart, point, displayLabel, tab.simpleLabelMode);
        const left = layout.xPixel + layout.xAdjust - layout.approxWidth / 2;
        const right = left + layout.approxWidth;
        const top = layout.yPixel - layout.approxHeight + layout.yAdjust;
        const bottom = top + layout.approxHeight;
        if (pos.x >= left && pos.x <= right && pos.y >= top && pos.y <= bottom) {
            return { ...point, markKey: point.key };
        }
    }
    return null;
}
function showHoldProgress(x, y) {
    const progress = document.getElementById('holdProgress');
    if (!progress) return;
    progress.style.display = 'block';
    progress.style.left = `${x}px`;
    progress.style.top = `${y}px`;
}
function updateHoldProgress(percent) {
    const progress = document.getElementById('holdProgress');
    if (!progress) return;
    const clamped = Math.max(0, Math.min(1, percent));
    const deg = clamped * 360;
    progress.style.background = `conic-gradient(var(--accent-primary) ${deg}deg, rgba(148, 163, 184, 0.2) ${deg}deg)`;
}
function hideHoldProgress() {
    const progress = document.getElementById('holdProgress');
    if (!progress) return;
    progress.style.display = 'none';
}
function cancelHold() {
    if (holdState.timer) {
        clearTimeout(holdState.timer);
    }
    if (holdState.raf) {
        cancelAnimationFrame(holdState.raf);
    }
    holdState.active = false;
    holdState.timer = null;
    holdState.raf = null;
    holdState.point = null;
    hideHoldProgress();
}
function startHold(event, tab) {
    if (!tab || !tab.chart) return;
    const point = getPointFromEvent(tab.chart, event) || findFixedMarkAtPosition(tab, tab.chart, event);
    if (!point) return;
    cancelHold();
    holdState.active = true;
    holdState.startTime = performance.now();
    holdState.tabId = tab.id;
    holdState.point = point;
    showHoldProgress(event.clientX, event.clientY);
    const duration = 700;
    holdState.timer = setTimeout(() => {
        if (!holdState.active) return;
        toggleFixedMark(tab, point);
        cancelHold();
    }, duration);
    const tick = () => {
        if (!holdState.active) return;
        const elapsed = performance.now() - holdState.startTime;
        updateHoldProgress(elapsed / duration);
        holdState.raf = requestAnimationFrame(tick);
    };
    holdState.raf = requestAnimationFrame(tick);
}
function isPointerOnDraggableLabel(canvas, chart, event) {
    if (!canvas || !chart) return false;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return !!findDraggableAnnotationAt(chart, x, y);
}
function attachHoldListeners(canvas, tab) {
    if (!canvas) return;
    const start = (event) => {
        if (event.button !== undefined && event.button !== 0) return;
        if (tab && tab.chart && isPointerOnDraggableLabel(canvas, tab.chart, event)) return;
        startHold(event, tab);
    };
    const move = (event) => {
        if (!holdState.active) return;
        if (tab && tab.chart && isPointerOnDraggableLabel(canvas, tab.chart, event)) {
            cancelHold();
            return;
        }
        showHoldProgress(event.clientX, event.clientY);
    };
    const stop = () => {
        cancelHold();
    };
    canvas.addEventListener('pointerdown', start);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointerleave', stop);
    canvas.addEventListener('pointercancel', stop);
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
}
function getBufferIndexForCurve(volumes, phs, volume) {
    if (!volumes || !phs || volumes.length < 3) return 0;
    let nearestIndex = 0;
    let bestDistance = Infinity;
    volumes.forEach((v, idx) => {
        const dist = Math.abs(v - volume);
        if (dist < bestDistance) {
            bestDistance = dist;
            nearestIndex = idx;
        }
    });
    if (nearestIndex > 0 && nearestIndex < phs.length - 1) {
        const prevDerivative = Math.abs(phs[nearestIndex] - phs[nearestIndex - 1]) / (volumes[nearestIndex] - volumes[nearestIndex - 1]);
        const nextDerivative = Math.abs(phs[nearestIndex + 1] - phs[nearestIndex]) / (volumes[nearestIndex + 1] - volumes[nearestIndex]);
        return 1 / ((prevDerivative + nextDerivative) / 2);
    }
    return 0;
}
function showPointInfo(tab, volume, ph) {
    if (!tab) return;
    const pane = getTabContent(tab);
    if (!pane) return;
    const pointInfo = pane.querySelector('[data-role="point-info"]');
    if (!pointInfo) return;
    const volumeEl = pane.querySelector('[data-role="point-volume"]');
    const phEl = pane.querySelector('[data-role="point-ph"]');
    const progressEl = pane.querySelector('[data-role="point-progress"]');
    const bufferEl = pane.querySelector('[data-role="point-buffer"]');
    pointInfo.style.display = 'block';
    if (volumeEl) volumeEl.textContent = volume.toFixed(2);
    if (phEl) phEl.textContent = ph.toFixed(2);
    if (progressEl) progressEl.textContent = `${((volume / config.maxVolume) * 100).toFixed(1)}%`;
    const bufferIndex = getBufferIndexForCurve(tab.volumes, tab.phs, volume);
    if (bufferEl) bufferEl.textContent = bufferIndex.toFixed(2);
}
