function calcProduct(K, n) {
    if (n === 0 || K.length === 0) return 1;
    let product = 1;
    for (let i = 0; i < Math.min(n, K.length); i++) {
        product *= K[i];
    }
    return product;
}
function calcBaseContribution(K_B, pH, n, c, concFactor, valence = 1) {
    const pKw = 14;
    let contribution = 0;
    if (n === 0) {
        contribution = c * concFactor * valence;
    } else {
        const Kb = K_B.map(pk => Math.pow(10, -pk));
        let denominator = Math.pow(10, (pH - pKw) * n);
        for (let t = 1; t <= n; t++) {
            denominator += calcProduct(Kb, t) * Math.pow(10, (pH - pKw) * (n - t));
        }
        let numerator = 0;
        for (let i = 1; i <= n; i++) {
            numerator += i * calcProduct(Kb, i) * Math.pow(10, (pH - pKw) * (n - i));
        }
        contribution = c * concFactor * (numerator / denominator);
    }
    return contribution;
}
function calcAcidContribution(K_A, pH, m, c, concFactor, valence = 1) {
    const pKw = 14;
    let contribution = 0;
    if (m === 0) {
        contribution = c * concFactor * valence;
    } else {
        const Ka = K_A.map(pk => Math.pow(10, -pk));
        let denominator = Math.pow(10, -pH * m);
        for (let t = 1; t <= m; t++) {
            denominator += calcProduct(Ka, t) * Math.pow(10, -pH * (m - t));
        }
        let numerator = 0;
        for (let j = 1; j <= m; j++) {
            numerator += j * calcProduct(Ka, j) * Math.pow(10, -pH * (m - j));
        }
        contribution = c * concFactor * (numerator / denominator);
    }
    return contribution;
}
function combinedEquation(pH, params) {
    const { solution, titrant, V } = params;
    const V0 = solution.V0;
    const pKw = 14;
    const totalVolume = V0 + V;
    let leftSide = Math.pow(10, -pH);
    let rightSide = Math.pow(10, pH - pKw);
    // v7.0.1: 取消酸/碱与溶液/滴定剂的严格绑定。
    // 基于电荷守恒，所有"碱性"项（接受质子）累加到左侧，
    // 所有"酸性"项（释放质子）累加到右侧，无论它们来自待测液还是滴定剂。
    for (const comp of (solution.components || [])) {
        const concFactor = V0 / totalVolume;
        if (comp.type === 'base') {
            const n = comp.isStrong ? 0 : comp.kValues.length;
            leftSide += calcBaseContribution(comp.kValues, pH, n, comp.c, concFactor, comp.valence || 1);
        } else if (comp.type === 'acid') {
            const m = comp.isStrong ? 0 : comp.kValues.length;
            rightSide += calcAcidContribution(comp.kValues, pH, m, comp.c, concFactor, comp.valence || 1);
        }
    }
    for (const comp of (titrant.components || [])) {
        const concFactor = V / totalVolume;
        if (comp.type === 'base') {
            const n = comp.isStrong ? 0 : comp.kValues.length;
            leftSide += calcBaseContribution(comp.kValues, pH, n, comp.c, concFactor, comp.valence || 1);
        } else if (comp.type === 'acid') {
            const m = comp.isStrong ? 0 : comp.kValues.length;
            rightSide += calcAcidContribution(comp.kValues, pH, m, comp.c, concFactor, comp.valence || 1);
        }
    }
    return leftSide - rightSide;
}
function solvePH(params, V) {
    let low = 0;
    let high = 14;
    for (let i = 0; i < 100; i++) {
        let mid = (low + high) / 2;
        let result = combinedEquation(mid, {...params, V});
        if (Math.abs(result) < 1e-10) {
            return mid;
        }
        if (result > 0) {
            low = mid;
        } else {
            high = mid;
        }
    }
    return (low + high) / 2;
}
function getIndicatorLabel(indicator) {
    if (!indicator) return '--';
    return uiLanguage === 'zh' ? indicator.nameZh : indicator.nameEn;
}
function getSelectedIndicator(tab) {
    if (!tab) return null;
    return acidBaseIndicators.find(item => item.id === tab.selectedIndicatorId) || acidBaseIndicators.find(item => item.id === 'phenolphthalein') || acidBaseIndicators[0];
}
function calculateJumpInfo(volumes, phs, thresholdRatio) {
    if (!Array.isArray(volumes) || !Array.isArray(phs) || volumes.length < 2 || phs.length < 2) return null;
    let maxDerivative = 0;
    let maxDerivativeIndex = 0;
    const derivatives = [];
    for (let i = 1; i < phs.length; i++) {
        const deltaV = volumes[i] - volumes[i - 1];
        if (!deltaV) continue;
        const derivative = Math.abs((phs[i] - phs[i - 1]) / deltaV);
        derivatives[i] = derivative;
        if (derivative > maxDerivative) {
            maxDerivative = derivative;
            maxDerivativeIndex = i;
        }
    }
    if (!maxDerivative) return null;
    const ratio = Number.isFinite(thresholdRatio) ? Math.min(0.99, Math.max(0.01, thresholdRatio)) : 0.2;
    const threshold = maxDerivative * ratio;
    const leapSegments = [];
    let segmentStart = null;
    let segmentPeakIndex = null;
    let segmentPeakDerivative = 0;
    for (let i = 1; i < phs.length; i++) {
        const derivative = derivatives[i] || 0;
        if (derivative >= threshold) {
            if (segmentStart === null) {
                segmentStart = i;
                segmentPeakIndex = i;
                segmentPeakDerivative = derivative;
            }
            if (derivative > segmentPeakDerivative) {
                segmentPeakDerivative = derivative;
                segmentPeakIndex = i;
            }
        } else if (segmentStart !== null) {
            leapSegments.push({
                derivativeStart: segmentStart,
                derivativeEnd: i - 1,
                peakIndex: segmentPeakIndex,
                peakDerivative: segmentPeakDerivative
            });
            segmentStart = null;
            segmentPeakIndex = null;
            segmentPeakDerivative = 0;
        }
    }
    if (segmentStart !== null) {
        leapSegments.push({
            derivativeStart: segmentStart,
            derivativeEnd: phs.length - 1,
            peakIndex: segmentPeakIndex,
            peakDerivative: segmentPeakDerivative
        });
    }
    if (!leapSegments.length) {
        leapSegments.push({
            derivativeStart: Math.max(1, maxDerivativeIndex),
            derivativeEnd: Math.max(1, maxDerivativeIndex),
            peakIndex: maxDerivativeIndex,
            peakDerivative: maxDerivative
        });
    }
    const leaps = leapSegments.map((segment, index) => {
        let jumpStart = Math.max(0, segment.derivativeStart - 1);
        let jumpEnd = Math.min(phs.length - 1, segment.derivativeEnd);
        if (jumpEnd <= jumpStart) {
            jumpEnd = Math.min(phs.length - 1, jumpStart + 1);
        }
        const startPH = phs[jumpStart];
        const endPH = phs[jumpEnd];
        return {
            index,
            startIndex: jumpStart,
            endIndex: jumpEnd,
            equivalenceIndex: segment.peakIndex,
            equivalenceVolume: volumes[segment.peakIndex],
            equivalencePH: phs[segment.peakIndex],
            startVolume: volumes[jumpStart],
            endVolume: volumes[jumpEnd],
            startPH,
            endPH,
            minPH: Math.min(startPH, endPH),
            maxPH: Math.max(startPH, endPH),
            direction: endPH >= startPH ? 'up' : 'down',
            color: leapMarkerColors[index % leapMarkerColors.length],
            peakDerivative: segment.peakDerivative
        };
    }).filter(leap => Number.isFinite(leap.startPH) && Number.isFinite(leap.endPH));
    let primaryLeap = leaps.find(leap => leap.equivalenceIndex === maxDerivativeIndex) || leaps.reduce((best, leap) => {
        if (!best || leap.peakDerivative > best.peakDerivative) return leap;
        return best;
    }, null);
    if (!primaryLeap) return null;
    return {
        ...primaryLeap,
        leaps
    };
}
function findVolumeForPH(volumes, phs, targetPH, startIndex = 0, endIndex = null) {
    if (!Array.isArray(volumes) || !Array.isArray(phs) || volumes.length < 2) return null;
    const start = Math.max(1, (startIndex || 0) + 1);
    const end = Math.min(phs.length - 1, endIndex ?? phs.length - 1);
    for (let i = start; i <= end; i++) {
        const p0 = phs[i - 1];
        const p1 = phs[i];
        const low = Math.min(p0, p1);
        const high = Math.max(p0, p1);
        if (targetPH < low || targetPH > high) continue;
        if (p1 === p0) return volumes[i - 1];
        const ratio = (targetPH - p0) / (p1 - p0);
        return volumes[i - 1] + ratio * (volumes[i] - volumes[i - 1]);
    }
    return null;
}
function getIndicatorFit(tab, indicator) {
    if (!tab || !indicator || !tab.jumpInfo) return null;
    const [rawLow, rawHigh] = indicator.range;
    const low = Math.min(rawLow, rawHigh);
    const high = Math.max(rawLow, rawHigh);
    const leapList = Array.isArray(tab.jumpInfo.leaps) && tab.jumpInfo.leaps.length ? tab.jumpInfo.leaps : [tab.jumpInfo];
    const validOverlaps = leapList.map((leap, index) => {
        const overlapLow = Math.max(low, leap.minPH);
        const overlapHigh = Math.min(high, leap.maxPH);
        const overlaps = overlapLow <= overlapHigh;
        if (!overlaps) return null;
        const lowVolume = findVolumeForPH(tab.volumes, tab.phs, overlapLow, leap.startIndex, leap.endIndex);
        const highVolume = findVolumeForPH(tab.volumes, tab.phs, overlapHigh, leap.startIndex, leap.endIndex);
        const midVolume = findVolumeForPH(tab.volumes, tab.phs, (overlapLow + overlapHigh) / 2, leap.startIndex, leap.endIndex);
        return {
            leap,
            leapIndex: index,
            overlapLow,
            overlapHigh,
            lowVolume,
            highVolume,
            midVolume,
            color: leap.color || leapMarkerColors[index % leapMarkerColors.length]
        };
    }).filter(Boolean);
    const firstOverlap = validOverlaps[0] || null;
    const overlaps = validOverlaps.length > 0;
    const lowVolume = firstOverlap ? firstOverlap.lowVolume : findVolumeForPH(tab.volumes, tab.phs, low);
    const highVolume = firstOverlap ? firstOverlap.highVolume : findVolumeForPH(tab.volumes, tab.phs, high);
    const midVolume = firstOverlap ? firstOverlap.midVolume : findVolumeForPH(tab.volumes, tab.phs, (low + high) / 2);
    return {
        indicator,
        low,
        high,
        overlaps,
        overlapLow: firstOverlap ? firstOverlap.overlapLow : null,
        overlapHigh: firstOverlap ? firstOverlap.overlapHigh : null,
        lowVolume,
        highVolume,
        midVolume,
        validOverlaps
    };
}
function formatVolumeRange(fit) {
    if (!fit) return '--';
    if (Array.isArray(fit.validOverlaps) && fit.validOverlaps.length) {
        return fit.validOverlaps.map(overlap => {
            const volumes = [overlap.lowVolume, overlap.highVolume].filter(Number.isFinite);
            const prefix = fit.validOverlaps.length > 1 ? `#${overlap.leapIndex + 1}: ` : '';
            if (!volumes.length) return `${prefix}${t('无法定位体积', 'volume not located')}`;
            if (volumes.length === 1) return `${prefix}${volumes[0].toFixed(2)} mL`;
            return `${prefix}${Math.min(...volumes).toFixed(2)} - ${Math.max(...volumes).toFixed(2)} mL`;
        }).join(' | ');
    }
    const volumes = [fit.lowVolume, fit.highVolume].filter(Number.isFinite);
    if (!volumes.length) return t('曲线未经过该范围', 'Curve does not cross this range');
    if (volumes.length === 1) return `${volumes[0].toFixed(2)} mL`;
    return `${Math.min(...volumes).toFixed(2)} - ${Math.max(...volumes).toFixed(2)} mL`;
}
function updateStats(tab, volumes, phs) {
    // v6.5.5: 即使 DOM 元素缺失也要计算 jumpInfo, 否则跃迁/指示剂范围无法显示
    if (!Array.isArray(phs) || phs.length === 0) {
        tab.jumpInfo = null;
    } else {
        tab.jumpInfo = calculateJumpInfo(volumes, phs, tab.leapThreshold);
    }
    const pane = getTabContent(tab);
    if (!pane) return;
    const eqVolumeEl = pane.querySelector('[data-role="equivalence-volume"]');
    const jumpRangeEl = pane.querySelector('[data-role="jump-range"]');
    const initialEl = pane.querySelector('[data-role="initial-ph"]');
    const finalEl = pane.querySelector('[data-role="final-ph"]');
    const indicatorRangeEl = pane.querySelector('[data-role="indicator-range"]');
    const indicatorFitEl = pane.querySelector('[data-role="indicator-fit"]');
    const indicatorNoteEl = pane.querySelector('[data-role="indicator-note"]');
    if (!Array.isArray(phs) || phs.length === 0) {
        if (eqVolumeEl) eqVolumeEl.textContent = '--';
        return;
    }
    const initialPH = phs[0].toFixed(2);
    const finalPH = phs[phs.length - 1].toFixed(2);
    const jumpInfo = tab.jumpInfo;
    if (jumpInfo) {
        const jumpRange = Array.isArray(jumpInfo.leaps) && jumpInfo.leaps.length > 1
            ? jumpInfo.leaps.map((leap, index) => `#${index + 1}: ${leap.startPH.toFixed(2)} - ${leap.endPH.toFixed(2)}`).join(' | ')
            : `${jumpInfo.startPH.toFixed(2)} - ${jumpInfo.endPH.toFixed(2)}`;
        if (eqVolumeEl) eqVolumeEl.textContent = jumpInfo.equivalenceVolume.toFixed(2);
        if (jumpRangeEl) jumpRangeEl.textContent = jumpRange;
    } else {
        if (eqVolumeEl) eqVolumeEl.textContent = '--';
        if (jumpRangeEl) jumpRangeEl.textContent = '--';
    }
    if (initialEl) initialEl.textContent = initialPH;
    if (finalEl) finalEl.textContent = finalPH;
    const indicator = getSelectedIndicator(tab);
    const fit = getIndicatorFit(tab, indicator);
    if (indicatorRangeEl) {
        indicatorRangeEl.textContent = tab.showIndicatorRange && indicator
            ? `${getIndicatorLabel(indicator)} ${indicator.range[0].toFixed(1)} - ${indicator.range[1].toFixed(1)}`
            : '--';
    }
    if (indicatorFitEl) {
        if (!tab.showIndicatorRange || !fit) {
            indicatorFitEl.textContent = '--';
            indicatorFitEl.classList.remove('indicator-fit-good', 'indicator-fit-warning');
        } else {
            indicatorFitEl.textContent = fit.overlaps
                ? `${t('适配', 'Fits')}: ${formatVolumeRange(fit)}`
                : t('不在跃迁范围内', 'Outside pH leap');
            indicatorFitEl.classList.toggle('indicator-fit-good', fit.overlaps);
            indicatorFitEl.classList.toggle('indicator-fit-warning', !fit.overlaps);
        }
    }
    if (indicatorNoteEl) {
        if (!tab.showIndicatorRange || !fit) {
            indicatorNoteEl.textContent = t('开启后会在图中显示滴定pH跃迁区和所选指示剂变色范围。', 'Enable this to show the titration pH leap and the selected indicator transition range.');
        } else if (fit.overlaps) {
            indicatorNoteEl.textContent = t('所选指示剂变色范围与滴定跃迁区重叠，终点可落在约 {range}。', 'The selected indicator overlaps the titration pH leap; the endpoint can fall around {range}.').replace('{range}', formatVolumeRange(fit));
        } else {
            indicatorNoteEl.textContent = t('所选指示剂的变色范围没有落入本曲线的pH跃迁区，建议更换指示剂。', 'The selected indicator transition range does not fall inside this pH leap; choose another indicator.');
        }
    }
    refreshTabAnnotations(tab);
}
function autoInterpolateCurve(volumes, phs) {
    if (!volumes || !phs || volumes.length < 2 || phs.length < 2) {
        return { volumes, phs };
    }
    let maxDerivative = 0;
    for (let i = 1; i < phs.length; i++) {
        const deltaV = volumes[i] - volumes[i - 1];
        if (!deltaV) continue;
        const derivative = Math.abs((phs[i] - phs[i - 1]) / deltaV);
        if (derivative > maxDerivative) {
            maxDerivative = derivative;
        }
    }
    if (!maxDerivative) {
        return { volumes, phs };
    }
    const threshold = maxDerivative * 0.35;
    const newVolumes = [volumes[0]];
    const newPhs = [phs[0]];
    for (let i = 1; i < volumes.length; i++) {
        const v0 = volumes[i - 1];
        const v1 = volumes[i];
        const p0 = phs[i - 1];
        const p1 = phs[i];
        const deltaV = v1 - v0;
        if (deltaV) {
            const derivative = Math.abs((p1 - p0) / deltaV);
            const segmentFactor = derivative >= threshold ? Math.min(6, Math.ceil(derivative / threshold) - 1) : 0;
            if (segmentFactor > 0) {
                for (let j = 1; j <= segmentFactor; j++) {
                    const t = j / (segmentFactor + 1);
                    newVolumes.push(v0 + deltaV * t);
                    newPhs.push(p0 + (p1 - p0) * t);
                }
            }
        }
        newVolumes.push(v1);
        newPhs.push(p1);
    }
    return { volumes: newVolumes, phs: newPhs };
}
function generateCurve() {
    const btn = document.getElementById('generateBtn');
    btn.classList.add('loading');
    setTimeout(() => {
        let tab = getActiveTab();
        // v6.5.8: 若当前不是单曲线标签页（包括多曲线/分布等），自动新建一个单曲线页
        if (!tab || tab.type !== 'single') {
            tab = createChartTab('single');
        }
        if (!tab || tab.type !== 'single') {
            btn.classList.remove('loading');
            return;
        }
        config.solution.V0 = parseFloat(document.getElementById('initialVol').value) || 20;
        config.maxVolume = parseFloat(document.getElementById('maxVolume').value) || 100;
        config.sampleCount = parseInt(document.getElementById('sampleDensitySlider').value) || 500;
        config.curveColor = document.getElementById('curveColor').value;
        config.curveLineStyle = tab.curveLineStyle || 'solid';
        config.curvePointStyle = tab.curvePointStyle || 'circle';
        config.curveBorderWidth = tab.curveBorderWidth || 2;
        config.solution.components = getComponentsData('solutionComponents');
        config.titrant.components = getComponentsData('titrantComponents');
        applyAutoMaxVolumeIfNeeded();
        const nameInput = document.getElementById('curveName');
        const userName = nameInput.value.trim();
        updateCurveNameFromComponents();
        const autoNameCurrent = config.curveName;
        config.curveName = userName && userName !== t('滴定曲线1', 'Titration curve 1') ? userName : autoNameCurrent || t('滴定曲线1', 'Titration curve 1');
        nameInput.value = config.curveName;
        const step = config.maxVolume / config.sampleCount;
        tab.volumes = [];
        tab.phs = [];
        for (let i = 0; i <= config.sampleCount; i++) {
            const V = i * step;
            const pH = solvePH(config, V);
            tab.volumes.push(V);
            tab.phs.push(pH);
        }
        const autoSampleEnabled = document.getElementById('autoSampleToggle').checked;
        if (autoSampleEnabled) {
            const interpolated = autoInterpolateCurve(tab.volumes, tab.phs);
            tab.volumes = interpolated.volumes;
            tab.phs = interpolated.phs;
        }
        tab.fixedMarks = [];
        tab.selectedPoint = null;
        clearAnnotationLabelOffsets(tab);
        // v7.0.1: 重新生成时重置图表外观配置为默认值
        tab.xAxisLabel = '';
        tab.yAxisLabel = '';
        tab.xAxisLineColor = '';
        tab.yAxisLineColor = '';
        tab.xTickColor = '';
        tab.yTickColor = '';
        tab.xGridColor = '';
        tab.yGridColor = '';
        tab.xTicksVisible = true;
        tab.yTicksVisible = true;
        tab.xAxisArrow = false;
        tab.yAxisArrow = false;
        tab.gridEnabled = true;
        tab.gridXStep = 0;
        tab.gridYStep = 0;
        tab.showLegend = true;
        tab.showRawPoints = false;
        tab.simpleLabelMode = false;
        tab.showDerivative = false;
        tab.derivativeLineStyle = 'dash';
        tab.derivativeColor = '#f59e0b';
        tab.curveLineStyle = 'solid';
        tab.curvePointStyle = 'circle';
        tab.curveBorderWidth = 2;
        tab.markFillEnabled = false;
        tab.markFillColor = '#57a7bd';
        tab.markBorderEnabled = false;
        tab.markBorderColor = '#0f172a';
        tab.markRadiusEnabled = false;
        tab.markRadius = 5;
        tab.markBorderWidthEnabled = false;
        tab.markBorderWidth = 2.8;
        tab.maxVolume = config.maxVolume;
        tab.params = snapshotParamsFromConfig(config);
        updateChart(tab, tab.volumes, tab.phs, config.curveColor);
        updateStats(tab, tab.volumes, tab.phs);
        updateAllMultiTabs();
        updateDistributionChart(tab, config);
        jumpToChartPageAfterGenerate();
        btn.classList.remove('loading');
    }, 100);
}
function jumpToChartPageAfterGenerate() {
    const main = document.querySelector('.main-content');
    const nav = document.getElementById('appPageNav');
    if (!main) return;
    main.classList.add('show-chart-page');
    main.classList.remove('desktop-show-distribution');
    if (typeof window.setDesktopWorkspaceView === 'function') {
        window.setDesktopWorkspaceView('charts');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (nav) {
        nav.classList.remove('open');
        nav.querySelectorAll('[data-app-page]').forEach(btn => {
            btn.classList.toggle('active', Number(btn.dataset.appPage) === 1);
        });
        nav.querySelectorAll('.app-page-dot').forEach((dot, index) => {
            dot.classList.toggle('active', index === 1);
        });
    }
    setTimeout(() => {
        chartTabs.forEach(tab => {
            if (tab && tab.chart && typeof tab.chart.resize === 'function') {
                tab.chart.resize();
            }
        });
    }, 160);
}
function estimateInitialPH(cfg) {
    const solAcids = cfg.solution.components.filter(c => c.type === 'acid');
    const solBases = cfg.solution.components.filter(c => c.type === 'base');
    const acidCapacity = solAcids.reduce((acc, c) => acc + (c.c || 0) * (c.valence || (c.kValues ? c.kValues.length : 1)), 0);
    const baseCapacity = solBases.reduce((acc, c) => acc + (c.c || 0) * (c.valence || (c.kValues ? c.kValues.length : 1)), 0);
    if (acidCapacity > baseCapacity * 1.2) return 2.0;
    if (baseCapacity > acidCapacity * 1.2) return 12.0;
    return 7.0;
}
