(function () {
    let distributionChartV32 = null;
    let lastTab = null;
    let lastParams = null;
    let lastDatasets = [];
    let yAxisMode = 'linear'; // 'linear' | 'log' | 'amount' | 'amountLog'
    let distributionLogSign = 'neg'; // 'neg' => −log, 'pos' => log
    let xAxisMode = 'volume'; // 'volume' | 'ph' | 'poh'
    // v6.5.8: 横轴是否按 pH/pOH 显示（共用 pH 采样路径）
    function isPHLikeXMode(mode) {
        const m = mode || xAxisMode;
        return m === 'ph' || m === 'poh';
    }
    // v6.5.8: 将 pH 值映射为当前横轴值（pOH 模式下取 14-pH）
    function phToXValue(ph, mode) {
        const m = mode || xAxisMode;
        return m === 'poh' ? (14 - Number(ph)) : Number(ph);
    }
    let isPHRangeManual = false;
    let manualPHRange = null;
    let isDistXRangeManual = false;
    let manualDistXRange = null;
    let isDistYRangeManual = false;
    let manualDistYRange = null;
    let visibleSpeciesKeys = null;
    let distMarkSpeciesKeys = new Set();
    let distributionSimpleLabelMode = true;
    const distributionGrid = { gridEnabled: true, gridXStep: 0, gridYStep: 0, showLegend: true };
    const distributionAxisConfig = {
        xAxisLabel: '', yAxisLabel: '',
        xAxisLineColor: '', yAxisLineColor: '',
        xTickColor: '', yTickColor: '',
        xGridColor: '', yGridColor: '',
        xTicksVisible: true, yTicksVisible: true,
        xAxisArrow: false, yAxisArrow: false
    };
    const distributionStyleMap = new Map();
    const distributionCustomCurves = [];
    let distributionExpressionTokens = [];
    let distributionSelectedPoint = null;
    let distributionFixedMarks = [];
    const distributionAnnotationState = { annotationLabelOffsets: {} };
    let distributionHold = { active: false, timer: null, raf: null, point: null, startTime: 0 };
    let distSaveCompositeSelection = new Set();
    const SAFE_LOG_FLOOR = 1e-30;
    function safePow10(exponent) {
        if (exponent > 300) return 1e300;
        if (exponent < -300) return 1e-300;
        return Math.pow(10, exponent);
    }
    function normalizeWeights(weights) {
        const max = Math.max(...weights.map(v => Number.isFinite(v) && v > 0 ? v : 0), 0);
        if (!max) return weights.map(() => 0);
        const scaled = weights.map(v => (Number.isFinite(v) && v > 0 ? v / max : 0));
        const sum = scaled.reduce((acc, v) => acc + v, 0);
        return sum ? scaled.map(v => v / sum) : weights.map(() => 0);
    }
    function pValuesToConstants(pValues) {
        return (Array.isArray(pValues) ? pValues : [])
            .map(v => Number(v))
            .filter(v => Number.isFinite(v) && v > 0)
            .map(v => safePow10(-v));
    }
    function cumulativeProduct(values, count) {
        let product = 1;
        for (let i = 0; i < count; i++) product *= values[i] || 1;
        return product;
    }
    function acidAlphaFractions(component, pH) {
        const pKas = Array.isArray(component.kValues) ? component.kValues : [];
        const m = component.isStrong ? 0 : pKas.length;
        const baseName = component.displayName || component.name || t('酸', 'acid');
        // v7.0.1: 先按 displayName（化学式）查找，再按 name（中文名）查找
        const formulaMap = speciesFormulaMap[baseName] || speciesFormulaMap[component.name] || null;
        if (m === 0) {
            const label = (formulaMap && formulaMap[0]) ? formulaMap[0] : `${baseName}(${t('强酸阴离子', 'strong-acid anion')})`;
            return [{ state: 0, label, alpha: 1 }];
        }
        const H = safePow10(-pH);
        const Ka = pValuesToConstants(pKas);
        const weights = [];
        for (let j = 0; j <= m; j++) {
            weights.push(cumulativeProduct(Ka, j) * Math.pow(H, m - j));
        }
        const alphas = normalizeWeights(weights);
        return alphas.map((alpha, j) => {
            const label = (formulaMap && formulaMap[j]) ? formulaMap[j] : `${baseName} H${m - j}A${j > 0 ? j : ''}${j > 0 ? (j > 1 ? j + '-' : '-') : ''}`;
            return { state: j, label, alpha };
        });
    }
    function baseAlphaFractions(component, pH) {
        const pKbs = Array.isArray(component.kValues) ? component.kValues : [];
        const n = component.isStrong ? 0 : pKbs.length;
        const baseName = component.displayName || component.name || t('碱', 'base');
        // v7.0.1: 先按 displayName（化学式）查找，再按 name（中文名）查找
        const formulaMap = speciesFormulaMap[baseName] || speciesFormulaMap[component.name] || null;
        if (n === 0) {
            const label = (formulaMap && formulaMap[0]) ? formulaMap[0] : `${baseName}(${t('强碱阳离子', 'strong-base cation')})`;
            return [{ state: 0, label, alpha: 1 }];
        }
        const OH = safePow10(pH - 14);
        const Kb = pValuesToConstants(pKbs);
        const weights = [];
        for (let i = 0; i <= n; i++) {
            weights.push(cumulativeProduct(Kb, i) * Math.pow(OH, n - i));
        }
        const alphas = normalizeWeights(weights);
        return alphas.map((alpha, i) => {
            const label = (formulaMap && formulaMap[i]) ? formulaMap[i] : `${baseName} BH${i > 0 ? i : ''}${i > 0 ? (i > 1 ? i + '+' : '+') : ''}`;
            return { state: i, label, alpha };
        });
    }
    function speciesFractions(component, pH) {
        return component.type === 'acid'
            ? acidAlphaFractions(component, pH)
            : baseAlphaFractions(component, pH);
    }
    function analyticalConcentration(component, source, volume, params) {
        const totalVolume = (params.solution?.V0 || 0) + volume;
        if (!totalVolume) return 0;
        const sourceVolume = source === 'solution' ? (params.solution?.V0 || 0) : volume;
        return (component.c || 0) * sourceVolume / totalVolume;
    }
    function analyticalAmountMmol(component, source, volume, params) {
        const sourceVolume = source === 'solution' ? (params.solution?.V0 || 0) : volume;
        return (component.c || 0) * sourceVolume;
    }
    function cloneCurrentParams(params) {
        return JSON.parse(JSON.stringify(params || {}));
    }
    function getAutoPHRange(tab) {
        if (!tab || !Array.isArray(tab.phs) || !tab.phs.length) return { min: 0, max: 14 };
        const start = Number(tab.phs[0]);
        const end = Number(tab.phs[tab.phs.length - 1]);
        let min = Math.min(start, end);
        let max = Math.max(start, end);
        if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 14 };
        if (Math.abs(max - min) < 0.05) {
            min -= 0.5;
            max += 0.5;
        }
        return {
            min: Math.floor(min * 100) / 100,
            max: Math.ceil(max * 100) / 100
        };
    }
    function normalizePHRange(range) {
        let min = Number(range?.min);
        let max = Number(range?.max);
        if (!Number.isFinite(min) || !Number.isFinite(max)) return getAutoPHRange(lastTab);
        if (min === max) max = min + 0.1;
        if (min > max) [min, max] = [max, min];
        return { min, max };
    }
    function getCurrentPHRange() {
        return normalizePHRange(isPHRangeManual ? manualPHRange : getAutoPHRange(lastTab));
    }
    function getDistXAutoRange() {
        if (xAxisMode === 'ph' || xAxisMode === 'poh') {
            const range = getCurrentPHRange();
            if (xAxisMode === 'poh') {
                return { min: 14 - range.max, max: 14 - range.min };
            }
            return range;
        }
        const maxVol = lastParams && lastParams.maxVolume ? lastParams.maxVolume : 100;
        return { min: 0, max: maxVol };
    }
    function getDistYAutoRange(datasets) {
        return getDistributionYAxisBounds(datasets);
    }
    function normalizeAxisRange(minVal, maxVal, autoRange) {
        let min = Number(minVal);
        let max = Number(maxVal);
        if (!Number.isFinite(min) || !Number.isFinite(max)) return autoRange;
        if (min === max) max = min + 0.1;
        if (min > max) [min, max] = [max, min];
        return { min, max };
    }
    function updateDistXRangeInputs() {
        const minInput = document.getElementById('distXMin');
        const maxInput = document.getElementById('distXMax');
        if (!minInput || !maxInput) return;
        const autoRange = getDistXAutoRange();
        const range = isDistXRangeManual && manualDistXRange
            ? normalizeAxisRange(manualDistXRange.min, manualDistXRange.max, autoRange)
            : autoRange;
        const decimals = (xAxisMode === 'ph' || xAxisMode === 'poh') ? 2 : 2;
        if (xAxisMode === 'poh') {
            minInput.value = Number(14 - range.max).toFixed(decimals);
            maxInput.value = Number(14 - range.min).toFixed(decimals);
        } else {
            minInput.value = Number(range.min).toFixed(decimals);
            maxInput.value = Number(range.max).toFixed(decimals);
        }
    }
    function updateDistYRangeInputs(datasets) {
        const minInput = document.getElementById('distYMin');
        const maxInput = document.getElementById('distYMax');
        if (!minInput || !maxInput) return;
        const range = isDistYRangeManual ? manualDistYRange : getDistYAutoRange(datasets);
        const decimals = (yAxisMode === 'log' || yAxisMode === 'amountLog') ? 1 : 4;
        minInput.value = Number(range.min).toFixed(decimals);
        maxInput.value = Number(range.max).toFixed(decimals);
    }
    function estimateVolumeForPH(pH, tab) {
        const phs = tab?.phs || [];
        const volumes = tab?.volumes || [];
        if (!phs.length || !volumes.length) return 0;
        for (let i = 1; i < phs.length; i++) {
            const a = Number(phs[i - 1]);
            const b = Number(phs[i]);
            if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
            const crosses = (pH >= Math.min(a, b) && pH <= Math.max(a, b));
            if (crosses) {
                const ratio = Math.abs(b - a) < 1e-9 ? 0 : (pH - a) / (b - a);
                return volumes[i - 1] + ratio * (volumes[i] - volumes[i - 1]);
            }
        }
        const first = { pH: Number(phs[0]), volume: Number(volumes[0]) || 0 };
        const last = { pH: Number(phs[phs.length - 1]), volume: Number(volumes[volumes.length - 1]) || 0 };
        const low = first.pH <= last.pH ? first : last;
        const high = first.pH <= last.pH ? last : first;
        return pH < low.pH ? low.volume : high.volume;
    }
    function estimatePHForVolume(volume, tab) {
        const phs = tab?.phs || [];
        const volumes = tab?.volumes || [];
        if (!phs.length || !volumes.length) return 7;
        for (let i = 1; i < volumes.length; i++) {
            const a = Number(volumes[i - 1]);
            const b = Number(volumes[i]);
            if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
            if (volume >= Math.min(a, b) && volume <= Math.max(a, b)) {
                const ratio = Math.abs(b - a) < 1e-9 ? 0 : (volume - a) / (b - a);
                return Number(phs[i - 1]) + ratio * (Number(phs[i]) - Number(phs[i - 1]));
            }
        }
        // 外推：使用首尾两点的斜率
        const first = { pH: Number(phs[0]), volume: Number(volumes[0]) || 0 };
        const last = { pH: Number(phs[phs.length - 1]), volume: Number(volumes[volumes.length - 1]) || 0 };
        if (volume < Math.min(first.volume, last.volume)) {
            const low = first.volume <= last.volume ? first : last;
            const high = first.volume <= last.volume ? last : first;
            const slope = Math.abs(high.volume - low.volume) < 1e-9 ? 0 : (high.pH - low.pH) / (high.volume - low.volume);
            return low.pH + slope * (volume - low.volume);
        }
        const low = first.volume <= last.volume ? first : last;
        const high = first.volume <= last.volume ? last : first;
        const slope = Math.abs(high.volume - low.volume) < 1e-9 ? 0 : (high.pH - low.pH) / (high.volume - low.volume);
        return high.pH + slope * (volume - high.volume);
    }
    // v7.0.9: 根据用户输入的一个坐标（体积/pH/pOH），通过方程精确计算另一个坐标及所有物种浓度
    function calculateDistributionAtCoordinate(xValue, axisMode, params) {
        if (!params || !Number.isFinite(xValue)) return null;
        let volume, pH;
        if (axisMode === 'volume') {
            volume = xValue;
            try { pH = solvePH(params, volume); } catch (e) { return null; }
        } else if (axisMode === 'ph') {
            pH = xValue;
            volume = estimateVolumeForPH(pH, lastTab);
        } else if (axisMode === 'poh') {
            pH = 14 - xValue;
            volume = estimateVolumeForPH(pH, lastTab);
        } else {
            return null;
        }
        if (!Number.isFinite(volume) || !Number.isFinite(pH)) return null;
        const sourceEntries = [];
        (params.solution?.components || []).forEach((component, index) => sourceEntries.push({ source: 'solution', component, index }));
        (params.titrant?.components || []).forEach((component, index) => sourceEntries.push({ source: 'titrant', component, index }));
        const speciesData = [];
        sourceEntries.forEach((entry) => {
            const fractions = speciesFractions(entry.component, pH);
            const analytical = analyticalConcentration(entry.component, entry.source, volume, params);
            const amount = analyticalAmountMmol(entry.component, entry.source, volume, params);
            fractions.forEach((fraction, speciesIndex) => {
                speciesData.push({
                    speciesKey: `${entry.source}_${entry.index}_${speciesIndex}`,
                    label: fraction.label,
                    rawX: volume,
                    rawPH: pH,
                    rawY: fraction.alpha * analytical,
                    rawAmount: fraction.alpha * amount
                });
            });
        });
        speciesData.push({
            speciesKey: 'H', label: 'H⁺',
            rawX: volume, rawPH: pH,
            rawY: safePow10(-pH),
            rawAmount: safePow10(-pH) * ((params.solution?.V0 || 0) + volume)
        });
        speciesData.push({
            speciesKey: 'OH', label: 'OH⁻',
            rawX: volume, rawPH: pH,
            rawY: safePow10(pH - 14),
            rawAmount: safePow10(pH - 14) * ((params.solution?.V0 || 0) + volume)
        });
        return { volume, pH, speciesData };
    }
    function getDistributionPointFromCoordinate(dataset, xValue, axisMode) {
        const calc = calculateDistributionAtCoordinate(xValue, axisMode, lastParams);
        if (!calc) return null;
        const species = calc.speciesData.find(s => s.speciesKey === dataset.speciesKey);
        if (!species) return null;
        const value = dataset.directY
            ? species.rawY
            : transformY((yAxisMode === 'amount' || yAxisMode === 'amountLog') ? species.rawAmount : species.rawY);
        const xVal = axisMode === 'poh' ? (14 - calc.pH) : (axisMode === 'ph' ? calc.pH : calc.volume);
        return {
            key: `${dataset.speciesKey}_${axisMode}_${Number(xValue).toFixed(6)}`,
            speciesKey: dataset.speciesKey,
            datasetLabel: dataset.label,
            datasetIndex: Math.max(0, distributionChartV32?.data?.datasets?.findIndex(ds => ds.speciesKey === dataset.speciesKey) ?? 0),
            index: -1,
            axisMode,
            inputXValue: xValue,
            xValue: xVal,
            volume: calc.volume,
            ph: calc.pH,
            y: value,
            rawY: species.rawY,
            rawAmount: species.rawAmount,
            color: dataset.borderColor || '#61d8f7',
            pointStyle: dataset.pointStyle || 'circle',
            markStyle: cloneMarkStyleConfig(dataset.markStyle)
        };
    }
    function getPHAxisSamples(tab) {
        const phRange = getCurrentPHRange();
        // v7.0.9: 合并手动X轴范围，确保超出滴定pH范围的区段也能生成数据点
        const xRange = isDistXRangeManual ? normalizeAxisRange(manualDistXRange?.min, manualDistXRange?.max, phRange) : phRange;
        const range = {
            min: Math.min(phRange.min, xRange.min),
            max: Math.max(phRange.max, xRange.max)
        };
        const count = Math.max(220, Math.min(900, Array.isArray(tab?.phs) ? tab.phs.length : 500));
        const step = count > 1 ? (range.max - range.min) / (count - 1) : 0;
        return Array.from({ length: count }, (_, index) => {
            const pH = range.min + step * index;
            return {
                pH,
                volume: estimateVolumeForPH(pH, tab)
            };
        });
    }
    function transformY(value) {
        if (yAxisMode === 'log' || yAxisMode === 'amountLog') {
            // v7.0: 对非正/无效值返回 NaN，避免 SAFE_LOG_FLOOR 把所有“无效点”
            // 钉死到 -30，导致自定义曲线锯齿乱跳与纵轴上下限被压扁的 BUG。
            if (!Number.isFinite(value) || value <= 0) return NaN;
            const logValue = Math.log10(value);
            return distributionLogSign === 'pos' ? logValue : -logValue;
        }
        return Number.isFinite(value) ? value : NaN;
    }
    function makeStyledDistributionDataset(speciesKey, label, rawData, fallbackColor, options = {}) {
        const style = distributionStyleMap.get(speciesKey) || {};
        const color = style.color || fallbackColor;
        return {
            speciesKey,
            label,
            rawData,
            directY: !!options.directY,
            borderColor: color,
            backgroundColor: color + '18',
            fill: false,
            tension: style.lineStyle === 'solid' ? 0.35 : 0.2,
            pointRadius: style.rawPointRadius || 0,
            pointHoverRadius: style.rawPointRadius ? style.rawPointRadius + 2 : 4,
            borderWidth: style.borderWidth ?? (options.borderWidth || 2),
            borderDash: getCurveLineDash(style.lineStyle || 'solid'),
            pointStyle: getMarkPointStyle(style.pointStyle || 'circle'),
            markStyle: cloneMarkStyleConfig(style.markStyle),
            borderJoinStyle: 'round',
            borderCapStyle: 'round'
        };
    }
    function getExpressionValueMap(datasets, sampleIndex, sample) {
        const map = {};
        datasets.forEach(ds => {
            const point = ds.rawData?.[sampleIndex];
            if (point) map[ds.speciesKey] = Number(point.rawY) || 0;
        });
        const pH = Number(sample?.pH ?? sample?.rawPH ?? 7);
        map.H = safePow10(-pH);
        map.OH = safePow10(pH - 14);
        return map;
    }
    function evaluateCustomExpression(tokens, valueMap) {
        const expr = tokens.map(token => {
            if (['+', '-', '*', '/', '(', ')'].includes(token)) return token;
            if (token === '^') return '**';
            if (/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+\-]?\d+)?$/.test(token)) return token;
            return `(${Number(valueMap[token] ?? 0)})`;
        }).join('');
        if (!/^[0-9eE+\-*/().\s]+$/.test(expr)) return 0;
        try {
            const value = Function(`"use strict"; return (${expr});`)();
            return Number.isFinite(value) ? value : 0;
        } catch (error) {
            return 0;
        }
    }
    function buildSpeciesDatasetsV32(tab, params) {
        if (!tab || !Array.isArray(tab.volumes) || !Array.isArray(tab.phs) || !tab.volumes.length) return [];
        const sourceEntries = [];
        (params.solution?.components || []).forEach((component, index) => sourceEntries.push({ source: 'solution', component, index }));
        (params.titrant?.components || []).forEach((component, index) => sourceEntries.push({ source: 'titrant', component, index }));
        let samples;
        if (isPHLikeXMode()) {
            samples = getPHAxisSamples(tab);
        } else {
            // v7.0.9: 体积模式下，如果手动X轴范围超出实际体积范围，则扩展采样
            const volMin = Math.min(...tab.volumes);
            const volMax = Math.max(...tab.volumes);
            let xMin = volMin, xMax = volMax;
            if (isDistXRangeManual && manualDistXRange) {
                xMin = Math.min(xMin, Number(manualDistXRange.min) || volMin);
                xMax = Math.max(xMax, Number(manualDistXRange.max) || volMax);
            }
            if (xMin < volMin || xMax > volMax) {
                // 在超出范围的部分生成额外采样点，pH通过外推估算
                const extraPoints = [];
                const step = (volMax - volMin) / Math.max(1, tab.volumes.length - 1);
                if (xMin < volMin) {
                    for (let v = volMin - step; v >= xMin - step * 0.01; v -= step) {
                        extraPoints.push({ volume: v, pH: estimatePHForVolume(v, tab) });
                    }
                    extraPoints.reverse();
                }
                if (xMax > volMax) {
                    for (let v = volMax + step; v <= xMax + step * 0.01; v += step) {
                        extraPoints.push({ volume: v, pH: estimatePHForVolume(v, tab) });
                    }
                }
                samples = [...extraPoints, ...tab.volumes.map((volume, pointIndex) => ({ volume, pH: tab.phs[pointIndex] }))];
            } else {
                samples = tab.volumes.map((volume, pointIndex) => ({ volume, pH: tab.phs[pointIndex] }));
            }
        }
        const palette = ['#61d8f7', '#8a7dff', '#2dd4bf', '#f59e0b', '#f472b6', '#a3e635', '#fb7185', '#38bdf8', '#c084fc', '#34d399', '#facc15', '#fb923c'];
        const datasets = [];
        sourceEntries.forEach((entry, entryIndex) => {
            const templateFractions = speciesFractions(entry.component, tab.phs[0] ?? 7);
            templateFractions.forEach((template, speciesIndex) => {
                const rawData = samples.map(sample => {
                    const volume = sample.volume;
                    const pH = sample.pH;
                    const fractions = speciesFractions(entry.component, pH);
                    const fraction = fractions[speciesIndex];
                    const analytical = analyticalConcentration(entry.component, entry.source, volume, params);
                    const amount = analyticalAmountMmol(entry.component, entry.source, volume, params);
                    return {
                        x: volume,
                        rawX: volume,
                        rawPH: pH,
                        rawY: (fraction ? fraction.alpha : 0) * analytical,
                        rawAmount: (fraction ? fraction.alpha : 0) * amount
                    };
                });
                const speciesKey = `${entry.source}_${entry.index}_${speciesIndex}`;
                const color = palette[(entryIndex * 4 + speciesIndex) % palette.length];
                datasets.push(makeStyledDistributionDataset(
                    speciesKey,
                    template.label,
                    rawData,
                    color
                ));
            });
        });
        datasets.push(makeStyledDistributionDataset('H', 'H⁺', samples.map(sample => ({
            x: sample.volume,
            rawX: sample.volume,
            rawPH: sample.pH,
            rawY: safePow10(-sample.pH),
            rawAmount: safePow10(-sample.pH) * ((params.solution?.V0 || 0) + sample.volume)
        })), '#ef4444'));
        datasets.push(makeStyledDistributionDataset('OH', 'OH⁻', samples.map(sample => ({
            x: sample.volume,
            rawX: sample.volume,
            rawPH: sample.pH,
            rawY: safePow10(sample.pH - 14),
            rawAmount: safePow10(sample.pH - 14) * ((params.solution?.V0 || 0) + sample.volume)
        })), '#3b82f6'));
        distributionCustomCurves.forEach((curve, customIndex) => {
            const rawData = samples.map((sample, sampleIndex) => {
                const value = evaluateCustomExpression(curve.tokens, getExpressionValueMap(datasets, sampleIndex, sample));
                return {
                    x: sample.volume,
                    rawX: sample.volume,
                    rawPH: sample.pH,
                    rawY: value,
                    rawAmount: value * ((params.solution?.V0 || 0) + sample.volume)
                };
            });
            datasets.push(makeStyledDistributionDataset(curve.key, curve.name || t('自定义曲线{index}', 'Custom curve {index}').replace('{index}', customIndex + 1), rawData, curve.color || '#a855f7'));
        });
        return datasets;
    }
    function applyTransformToDatasets(datasets) {
        datasets.forEach(ds => {
            ds.data = ds.rawData.map(p => {
                const xVal = xAxisMode === 'poh' ? (14 - Number(p.rawPH)) : (xAxisMode === 'ph' ? p.rawPH : p.rawX);
                let yVal;
                if (ds.directY) {
                    // v6.5.9: 自定义曲线直接取原始值
                    yVal = Number.isFinite(p.rawY) ? p.rawY : NaN;
                } else {
                    yVal = transformY((yAxisMode === 'amount' || yAxisMode === 'amountLog') ? p.rawAmount : p.rawY);
                }
                return { x: xVal, y: yVal };
            });
            // v6.5.9: 跳过 NaN 间隙，避免 Chart.js 把无效点连线产生锯齿
            ds.spanGaps = false;
        });
    }
    function getVisibleDatasets() {
        if (!visibleSpeciesKeys) return lastDatasets;
        return lastDatasets.filter(ds => visibleSpeciesKeys.has(ds.speciesKey));
    }
    function renderComponentSelector() {
        const list = document.getElementById('distributionComponentList');
        if (!list) return;
        if (!lastDatasets.length) {
            list.innerHTML = '<span class="component-filter-empty" data-i18n="no_components">生成曲线后可选择要显示的组分。</span>';
            renderExpressionTokenPanel();
            renderDistributionMarkSelector();
            return;
        }
        const activeKeys = visibleSpeciesKeys || new Set(lastDatasets.map(ds => ds.speciesKey));
        // v6.5.7: 自定义曲线在显示组分行末尾追加删除按钮
        list.innerHTML = lastDatasets.map(ds => {
            const isCustom = String(ds.speciesKey || '').startsWith('custom_');
            const deleteBtn = isCustom
                ? `<button type="button" class="component-filter-delete" data-delete-custom="${ds.speciesKey}" title="${t('删除自定义曲线', 'Delete custom curve')}" aria-label="${t('删除自定义曲线', 'Delete custom curve')}">×</button>`
                : '';
            return `
            <label class="component-filter-item${isCustom ? ' component-filter-item-custom' : ''}" title="${ds.label}">
                <input type="checkbox" data-species-key="${ds.speciesKey}" ${activeKeys.has(ds.speciesKey) ? 'checked' : ''}>
                <span class="component-filter-swatch" style="background:${ds.borderColor};"></span>
                <span class="component-filter-label">${ds.label}</span>
                ${deleteBtn}
            </label>`;
        }).join('');
        // v6.5.7: 绑定显示组分列表中的删除按钮 (与样式面板内逻辑一致)
        list.querySelectorAll('[data-delete-custom]').forEach(btn => {
            btn.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                const key = btn.dataset.deleteCustom;
                const idx = distributionCustomCurves.findIndex(curve => curve.key === key);
                if (idx >= 0) distributionCustomCurves.splice(idx, 1);
                if (typeof distributionStyleMap !== 'undefined') distributionStyleMap.delete(key);
                if (visibleSpeciesKeys) visibleSpeciesKeys.delete(key);
                renderChart();
            });
        });
        renderDistributionStylePanel();
        renderExpressionTokenPanel();
        renderDistributionMarkSelector();
        if (typeof translateStaticUI === 'function') translateStaticUI();
    }
    function renderDistributionStylePanel() {
        const list = document.getElementById('distributionStyleList');
        if (!list) return;
        if (!lastDatasets.length) {
            list.innerHTML = '<span class="component-filter-empty" data-i18n="no_curve_style">生成曲线后可设置每条分布曲线。</span>';
            return;
        }
        list.innerHTML = lastDatasets.map(ds => {
            const style = distributionStyleMap.get(ds.speciesKey) || {};
            const markStyle = style.markStyle || {};
            return `
            <details class="curve-settings-item" data-persist-key="dist:${ds.speciesKey}">
                <summary class="curve-settings-summary">
                    <span class="component-filter-swatch" style="background:${ds.borderColor};"></span>
                    <span>${ds.label}</span>
                    ${ds.speciesKey.startsWith('custom_') ? '<button type="button" class="dist-mini-btn dist-custom-delete" data-delete-custom="' + ds.speciesKey + '" data-i18n="clear">删除</button>' : ''}
                </summary>
                <div class="curve-settings-grid">
                    <label><span data-i18n="line_color">线色</span> <input type="color" data-dist-style="${ds.speciesKey}" data-field="color" value="${style.color || ds.borderColor || '#61d8f7'}"></label>
                    <label><span data-i18n="line_style">线型</span> <select data-dist-style="${ds.speciesKey}" data-field="lineStyle"><option value="solid" data-i18n="line_solid">实线</option><option value="dash" data-i18n="line_dash">短虚线</option><option value="longDash" data-i18n="line_long_dash">长虚线</option><option value="dot" data-i18n="line_dot">点线</option><option value="dashDot" data-i18n="line_dash_dot">点划线</option><option value="denseDash" data-i18n="line_dense_dash">密集虚线</option></select></label>
                    <label><span data-i18n="point_style">点型</span> <select data-dist-style="${ds.speciesKey}" data-field="pointStyle"><option value="circle" data-i18n="point_circle">圆点</option><option value="rect" data-i18n="point_rect">方点</option><option value="rectRounded" data-i18n="point_rect_rounded">圆角方点</option><option value="rectRot" data-i18n="point_diamond">菱形点</option><option value="triangle" data-i18n="point_triangle">三角点</option><option value="star" data-i18n="point_star">星形点</option><option value="cross" data-i18n="point_cross">十字点</option><option value="crossRot" data-i18n="point_cross_rot">斜十字点</option><option value="none" data-i18n="point_none">不显示</option></select></label>
                    <label><span data-i18n="point_fill">点填充</span> <input type="color" data-dist-style="${ds.speciesKey}" data-field="markFill" value="${markStyle.fillColor || style.color || ds.borderColor || '#61d8f7'}"></label>
                    <label><span data-i18n="point_border">点描边</span> <input type="color" data-dist-style="${ds.speciesKey}" data-field="markBorder" value="${markStyle.borderColor || '#0f172a'}"></label>
                    <label><span data-i18n="point_size">点大小</span> <input type="number" data-dist-style="${ds.speciesKey}" data-field="markRadius" min="1" max="14" step="0.5" value="${markStyle.radius ?? 5}"></label>
                    <label class="curve-width-label"><span data-i18n="line_width">粗细</span> <input type="range" data-dist-style="${ds.speciesKey}" data-field="borderWidth" min="0.5" max="6" step="0.1" value="${style.borderWidth ?? 2}"> <input type="number" class="thickness-number-input width-number" min="0.5" max="6" step="0.1" value="${(style.borderWidth ?? 2).toFixed(1)}"></label>
                </div>
            </details>`;
        }).join('');
        list.querySelectorAll('[data-delete-custom]').forEach(btn => {
            btn.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                const key = btn.dataset.deleteCustom;
                const idx = distributionCustomCurves.findIndex(curve => curve.key === key);
                if (idx >= 0) distributionCustomCurves.splice(idx, 1);
                distributionStyleMap.delete(key);
                if (visibleSpeciesKeys) visibleSpeciesKeys.delete(key);
                renderChart();
            });
        });
        list.querySelectorAll('select[data-dist-style][data-field="lineStyle"]').forEach(sel => {
            const style = distributionStyleMap.get(sel.dataset.distStyle) || {};
            sel.value = style.lineStyle || 'solid';
        });
        list.querySelectorAll('select[data-dist-style][data-field="pointStyle"]').forEach(sel => {
            const style = distributionStyleMap.get(sel.dataset.distStyle) || {};
            sel.value = style.pointStyle || 'circle';
        });
        list.querySelectorAll('[data-dist-style]').forEach(input => {
            input.addEventListener('input', () => {
                const key = input.dataset.distStyle;
                const style = distributionStyleMap.get(key) || {};
                const markStyle = style.markStyle || {};
                if (input.dataset.field === 'color') style.color = input.value;
                if (input.dataset.field === 'lineStyle') style.lineStyle = input.value;
                if (input.dataset.field === 'pointStyle') style.pointStyle = input.value;
                if (input.dataset.field === 'markFill') {
                    markStyle.fillEnabled = true;
                    markStyle.fillColor = input.value;
                }
                if (input.dataset.field === 'markBorder') {
                    markStyle.borderEnabled = true;
                    markStyle.borderColor = input.value;
                }
                if (input.dataset.field === 'markRadius') {
                    markStyle.radiusEnabled = true;
                    markStyle.radius = parseFloat(input.value) || 5;
                }
                if (input.dataset.field === 'borderWidth') {
                    style.borderWidth = parseFloat(input.value) || 2;
                    var slider = input.parentElement.querySelector('input[type="range"]');
                    if (slider) slider.value = input.value;
                    var number = input.parentElement.querySelector('input[type="number"]');
                    if (number) {
                        var v = parseFloat(number.value);
                        if (Number.isFinite(v)) {
                            v = Math.max(0.5, Math.min(6, v));
                            if (slider) slider.value = v;
                        }
                    }
                }
                style.markStyle = markStyle;
                distributionStyleMap.set(key, style);
                renderChart();
            });
            input.addEventListener('change', () => input.dispatchEvent(new Event('input')));
        });
        list.querySelectorAll('.curve-width-label input[type="number"]').forEach(num => {
            num.addEventListener('input', function() {
                const label = this.closest('.curve-width-label');
                if (!label) return;
                const range = label.querySelector('input[type="range"]');
                var v = parseFloat(this.value);
                if (Number.isFinite(v)) {
                    v = Math.max(0.5, Math.min(6, v));
                    if (range) { range.value = v; range.dispatchEvent(new Event('input')); }
                }
            });
        });
        if (typeof restoreDetailsOpenState === 'function') restoreDetailsOpenState(list);
        if (typeof translateStaticUI === 'function') translateStaticUI();
    }
    function formatExpressionDisplay() {
        const display = document.getElementById('distExpressionDisplay');
        if (!display) return;
        if (!distributionExpressionTokens.length) {
            display.innerHTML = '<span data-i18n="expr_empty_hint">点击下方组分标签和运算符构建表达式</span>';
            if (typeof translateStaticUI === 'function') translateStaticUI();
            return;
        }
        const datasetMap = new Map((lastDatasets || []).map(ds => [ds.speciesKey, ds]));
        const html = distributionExpressionTokens.map(token => {
            if (['+', '-', '*', '/', '(', ')', '^'].includes(token)) {
                const opMap = { '*': '×', '/': '÷', '^': '^' };
                const op = opMap[token] || token;
                return `<span class="dist-expression-op">${op}</span>`;
            }
            if (/^[0-9.]+$/.test(token)) {
                return `<span class="dist-expression-num">${token}</span>`;
            }
            const ds = datasetMap.get(token);
            const label = String(ds ? ds.label : token).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
            const color = ds ? ds.borderColor : '#64748b';
            return `<span class="dist-expression-chip" style="background:${color};">${label}</span>`;
        }).join('');
        display.innerHTML = html;
    }
    function renderExpressionTokenPanel() {
        const list = document.getElementById('distExpressionTokens');
        if (!list) return;
        const base = (lastDatasets || []).filter(ds => !ds.speciesKey.startsWith('custom_'));
        if (!base.length) {
            list.innerHTML = '<span class="component-filter-empty" data-i18n="no_expr_tokens">生成曲线后可点击组分标签构建表达式。</span>';
            formatExpressionDisplay();
            return;
        }
        list.innerHTML = base.map(ds => `
            <button type="button" class="dist-mini-btn" data-expr-token="${ds.speciesKey}" title="${ds.label}">
                <span class="component-filter-swatch" style="background:${ds.borderColor};"></span>${ds.label}
            </button>
        `).join('');
        list.querySelectorAll('[data-expr-token]').forEach(btn => {
            btn.addEventListener('click', () => {
                distributionExpressionTokens.push(btn.dataset.exprToken);
                formatExpressionDisplay();
            });
        });
        formatExpressionDisplay();
        if (typeof translateStaticUI === 'function') translateStaticUI();
    }
    function bindExpressionBuilder() {
        const ops = document.getElementById('distExpressionOps');
        const clearBtn = document.getElementById('distExprClearBtn');
        const addBtn = document.getElementById('distExpressionAddBtn');
        if (ops && ops.dataset.bound !== '1') {
            ops.dataset.bound = '1';
            ops.addEventListener('click', event => {
                const btn = event.target.closest('[data-token]');
                if (!btn) return;
                distributionExpressionTokens.push(btn.dataset.token);
                formatExpressionDisplay();
            });
        }
        const nums = document.getElementById('distExpressionNums');
        if (nums && nums.dataset.bound !== '1') {
            nums.dataset.bound = '1';
            nums.addEventListener('click', event => {
                const btn = event.target.closest('[data-token]');
                if (!btn) return;
                distributionExpressionTokens.push(btn.dataset.token);
                formatExpressionDisplay();
            });
        }
        if (clearBtn && clearBtn.dataset.bound !== '1') {
            clearBtn.dataset.bound = '1';
            clearBtn.addEventListener('click', () => {
                distributionExpressionTokens = [];
                formatExpressionDisplay();
            });
        }
        const backBtn = document.getElementById('distExprBackBtn');
        if (backBtn && backBtn.dataset.bound !== '1') {
            backBtn.dataset.bound = '1';
            backBtn.addEventListener('click', () => {
                if (distributionExpressionTokens.length > 0) {
                    distributionExpressionTokens.pop();
                    formatExpressionDisplay();
                }
            });
        }
        if (addBtn && addBtn.dataset.bound !== '1') {
            addBtn.dataset.bound = '1';
            addBtn.addEventListener('click', () => {
                const meaningful = distributionExpressionTokens.filter(t => !['+', '-', '*', '/', '(', ')', '^'].includes(t) && !/^[0-9.]+$/.test(t));
                if (!meaningful.length) {
                    if (typeof showAlert === 'function') showAlert(t('提示', 'Tip'), t('请先用组分标签和运算符构建表达式。', 'Please build an expression with species labels and operators first.'), 'ℹ');
                    return;
                }
                const nameInput = document.getElementById('distExpressionName');
                const name = (nameInput?.value || '').trim() || t('自定义曲线{index}', 'Custom curve {index}').replace('{index}', distributionCustomCurves.length + 1);
                distributionCustomCurves.push({
                    key: `custom_${Date.now()}_${distributionCustomCurves.length}`,
                    name,
                    tokens: distributionExpressionTokens.slice(),
                    color: '#a855f7'
                });
                distributionExpressionTokens = [];
                if (nameInput) nameInput.value = '';
                formatExpressionDisplay();
                renderChart();
            });
        }
    }
    function renderDistributionMarkSelector() {
        const list = document.getElementById('distMarkSpeciesSelect');
        if (!list) return;
        const visible = getVisibleDatasets();
        if (!visible.length) {
            list.innerHTML = '<span class="component-filter-empty" data-i18n="no_curves_to_mark">暂无可标点曲线</span>';
            distMarkSpeciesKeys = new Set();
            return;
        }
        const visibleKeys = new Set(visible.map(ds => ds.speciesKey));
        distMarkSpeciesKeys = new Set(Array.from(distMarkSpeciesKeys).filter(key => visibleKeys.has(key)));
        if (!distMarkSpeciesKeys.size) {
            distMarkSpeciesKeys.add(visible[0].speciesKey);
        }
        list.innerHTML = visible.map(ds => `
            <label class="component-filter-item" title="${ds.label}">
                <input type="checkbox" data-mark-species-key="${ds.speciesKey}" ${distMarkSpeciesKeys.has(ds.speciesKey) ? 'checked' : ''}>
                <span class="component-filter-swatch" style="background:${ds.borderColor};"></span>
                <span class="component-filter-label">${ds.label}</span>
            </label>
        `).join('');
        if (typeof translateStaticUI === 'function') translateStaticUI();
    }
    function getSelectedDistributionDatasets() {
        const visible = getVisibleDatasets();
        const selected = visible.filter(ds => distMarkSpeciesKeys.has(ds.speciesKey));
        return selected.length ? selected : (visible[0] ? [visible[0]] : []);
    }
    function getDistributionPointFromDataset(dataset, xValue, axisMode = xAxisMode) {
        if (!dataset || !Array.isArray(dataset.rawData) || !dataset.rawData.length) return null;
        let nearestIdx = 0;
        let minDiff = Infinity;
        dataset.rawData.forEach((point, index) => {
            const axisValue = axisMode === 'poh' ? (14 - Number(point.rawPH)) : (axisMode === 'ph' ? point.rawPH : point.rawX);
            const diff = Math.abs(axisValue - xValue);
            if (diff < minDiff) {
                minDiff = diff;
                nearestIdx = index;
            }
        });
        const raw = dataset.rawData[nearestIdx];
        const value = dataset.directY ? raw.rawY : transformY((yAxisMode === 'amount' || yAxisMode === 'amountLog') ? raw.rawAmount : raw.rawY);
        return {
            key: `${dataset.speciesKey}_${axisMode}_${Number(xValue).toFixed(3)}`,
            speciesKey: dataset.speciesKey,
            datasetLabel: dataset.label,
            datasetIndex: Math.max(0, distributionChartV32?.data?.datasets?.findIndex(ds => ds.speciesKey === dataset.speciesKey) ?? 0),
            index: nearestIdx,
            axisMode,
            xValue: axisMode === 'poh' ? (14 - Number(raw.rawPH)) : (axisMode === 'ph' ? raw.rawPH : raw.rawX),
            volume: raw.rawX,
            ph: raw.rawPH,
            y: value,
            rawY: raw.rawY,
            rawAmount: raw.rawAmount,
            color: dataset.borderColor || '#61d8f7',
            pointStyle: dataset.pointStyle || 'circle',
            markStyle: cloneMarkStyleConfig(dataset.markStyle)
        };
    }
    function getTargetDistributionPoints(xValue, axisMode = xAxisMode, exact = false) {
        const picker = exact ? getDistributionPointFromCoordinate : getDistributionPointFromDataset;
        return getSelectedDistributionDatasets()
            .map(dataset => picker(dataset, xValue, axisMode))
            .filter(Boolean);
    }
    function getTargetDistributionPoint(xValue, axisMode = xAxisMode, exact = false) {
        return getTargetDistributionPoints(xValue, axisMode, exact)[0] || null;
    }
    function getXAxisConfig(themeColors) {
        const xStep = distributionGrid.gridXStep > 0 ? { stepSize: distributionGrid.gridXStep } : {};
        const xTickColor = distributionAxisConfig.xTickColor || themeColors.textSecondary;
        const xGridColor = distributionAxisConfig.xGridColor || themeColors.gridColor;
        const xTicksDisplay = distributionAxisConfig.xTicksVisible !== false;
        const xBorderColor = distributionAxisConfig.xAxisLineColor || themeColors.textSecondary;
        const xGridEnabled = distributionGrid.gridEnabled !== false;
        const xGridDisplay = xGridEnabled ? { color: xGridColor } : { color: 'transparent', tickColor: xTicksDisplay ? xBorderColor : 'transparent' };
        const autoRange = getDistXAutoRange();
        const range = isDistXRangeManual ? normalizeAxisRange(manualDistXRange?.min, manualDistXRange?.max, autoRange) : autoRange;
        if (xAxisMode === 'ph' || xAxisMode === 'poh') {
            const isPOH = xAxisMode === 'poh';
            const minVal = isPOH ? (14 - range.max) : range.min;
            const maxVal = isPOH ? (14 - range.min) : range.max;
            const defaultText = isPOH ? 'pOH' : 'pH';
            return {
                type: 'linear',
                min: minVal,
                max: maxVal,
                title: { display: true, text: distributionAxisConfig.xAxisLabel || defaultText, color: themeColors.textPrimary },
                ticks: { color: xTickColor, display: xTicksDisplay, ...xStep },
                grid: xGridDisplay,
                border: { color: xBorderColor }
            };
        }
        const defaultText = t('滴定剂体积 (mL)', 'Titrant volume (mL)');
        return {
            type: 'linear',
            min: range.min,
            max: range.max,
            title: { display: true, text: distributionAxisConfig.xAxisLabel || defaultText, color: themeColors.textPrimary },
            ticks: { color: xTickColor, display: xTicksDisplay, ...xStep },
            grid: xGridDisplay,
            border: { color: xBorderColor }
        };
    }
    function getDistributionYAxisBounds(datasets) {
        const values = [];
        (datasets || []).forEach(ds => {
            (ds.data || []).forEach(point => {
                const y = Number(point?.y);
                if (Number.isFinite(y)) values.push(y);
            });
        });
        if (!values.length) {
            return (yAxisMode === 'log' || yAxisMode === 'amountLog')
                ? { min: 0, max: 1 }
                : { min: 0, max: 1 };
        }
        let min = Math.min(...values);
        let max = Math.max(...values);
        if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };
        if (Math.abs(max - min) < 1e-12) {
            const base = Math.max(Math.abs(min), Math.abs(max), 1);
            const pad = Math.max(base * 0.08, 0.5);
            min -= pad;
            max += pad;
        } else {
            const pad = Math.max((max - min) * 0.06, 1e-9);
            min -= pad;
            max += pad;
        }
        if (yAxisMode === 'linear' || yAxisMode === 'amount') {
            min = Math.min(0, min);
            if (max <= min) max = min + 1;
        }
        return { min, max };
    }
    function getYAxisConfig(themeColors, datasets) {
        const yTickColor = distributionAxisConfig.yTickColor || themeColors.textSecondary;
        const yGridColor = distributionAxisConfig.yGridColor || themeColors.gridColor;
        const yGridEnabled = distributionGrid.gridEnabled !== false;
        const yTicksDisplay = distributionAxisConfig.yTicksVisible !== false;
        const yBorderColor = distributionAxisConfig.yAxisLineColor || themeColors.textSecondary;
        const yGrid = yGridEnabled ? { color: yGridColor } : { color: 'transparent', tickColor: yTicksDisplay ? yBorderColor : 'transparent' };
        const yStep = distributionGrid.gridYStep > 0 ? { stepSize: distributionGrid.gridYStep } : {};
        const autoBounds = getDistributionYAxisBounds(datasets);
        const bounds = isDistYRangeManual ? normalizeAxisRange(manualDistYRange?.min, manualDistYRange?.max, autoBounds) : autoBounds;
        if (yAxisMode === 'log') {
            const title = distributionAxisConfig.yAxisLabel || (distributionLogSign === 'pos' ? 'log c' : '−log c (pC)');
            return {
                title: { display: true, text: title, color: themeColors.textPrimary },
                min: bounds.min,
                max: bounds.max,
                ticks: { color: yTickColor, display: yTicksDisplay, callback: v => Number(v).toFixed(1), ...yStep },
                grid: yGrid,
                border: { color: yBorderColor },
                reverse: false
            };
        }
        if (yAxisMode === 'amountLog') {
            const title = distributionAxisConfig.yAxisLabel || (distributionLogSign === 'pos' ? 'log n' : '−log n (pN)');
            return {
                title: { display: true, text: title, color: themeColors.textPrimary },
                min: bounds.min,
                max: bounds.max,
                ticks: { color: yTickColor, display: yTicksDisplay, callback: v => Number(v).toFixed(1), ...yStep },
                grid: yGrid,
                border: { color: yBorderColor },
                reverse: false
            };
        }
        if (yAxisMode === 'amount') {
            const title = distributionAxisConfig.yAxisLabel || t('物质的量 (mmol)', 'Amount (mmol)');
            return {
                title: { display: true, text: title, color: themeColors.textPrimary },
                min: bounds.min,
                max: bounds.max,
                ticks: { color: yTickColor, display: yTicksDisplay, ...yStep },
                grid: yGrid,
                border: { color: yBorderColor }
            };
        }
        const title = distributionAxisConfig.yAxisLabel || t('浓度 (mol/L)', 'Concentration (mol/L)');
        return {
            title: { display: true, text: title, color: themeColors.textPrimary },
            min: bounds.min,
            max: bounds.max,
            ticks: { color: yTickColor, display: yTicksDisplay, ...yStep },
            grid: yGrid,
            border: { color: yBorderColor }
        };
    }
    function formatConcentration(value) {
        if (!Number.isFinite(value) || value <= 0) return '0';
        if (value >= 1e-3 && value < 100) return value.toPrecision(4);
        return value.toExponential(3);
    }
    function formatDistributionValue(point) {
        if (!point) return '--';
        if (yAxisMode === 'log') return point.rawY > 0 ? `${distributionLogSign === 'pos' ? 'log c' : 'pC'} ${transformY(point.rawY).toFixed(2)}` : `${distributionLogSign === 'pos' ? 'log c' : 'pC'} ∞`;
        if (yAxisMode === 'amountLog') return point.rawAmount > 0 ? `${distributionLogSign === 'pos' ? 'log n' : 'pN'} ${transformY(point.rawAmount).toFixed(2)}` : `${distributionLogSign === 'pos' ? 'log n' : 'pN'} ∞`;
        if (yAxisMode === 'amount') return `${Number(point.rawAmount).toFixed(2)} mmol`;
        return `${Number(point.rawY).toFixed(2)} mol/L`;
    }

    function buildDistributionAnnotationEntries(point, keyPrefix) {
        if (!point || !Number.isFinite(point.xValue) || !Number.isFinite(point.y)) return {};
        const simple = distributionSimpleLabelMode;
        const isLightTheme = document.documentElement.getAttribute('data-theme') === 'light';
        const accent = getReadableAccentColor(point.color, { target: isLightTheme ? 'light' : 'dark' });
        // v7.0.9: 使用用户输入的原始坐标，避免标签显示与输入之间存在偏移
        const displayX = Number.isFinite(point.inputXValue) ? point.inputXValue : (xAxisMode === 'poh' ? (14 - Number(point.ph)) : (xAxisMode === 'ph' ? point.ph : point.volume));
        // V/pH/pOH 等坐标统一保留 2 位小数
        const fmtX = Number.isFinite(displayX) ? displayX.toFixed(2) : '0';
        const fmtY = Number.isFinite(point.y) ? point.y.toFixed(2) : '0';
        const labelText = simple
            ? `(${fmtX}, ${fmtY})`
            : `${point.datasetLabel}\nV=${point.volume.toFixed(2)} mL, pH=${point.ph.toFixed(2)}\n${formatDistributionValue(point)}`;
        const bgColor = accent + (simple ? '00' : (isLightTheme ? 'e6' : 'b3'));
        const textColor = simple ? accent : getTextColorForFill(accent);
        const pointColors = getContrastMarkColors(point.color, false, !isLightTheme);
        const markStyle = cloneMarkStyleConfig(point.markStyle);
        const markRadius = markStyle?.radiusEnabled ? markStyle.radius : (isLightTheme ? 5.2 : 4.6);
        if (markStyle?.fillEnabled && markStyle.fillColor) pointColors.fill = `${markStyle.fillColor}ff`;
        if (markStyle?.borderEnabled && markStyle.borderColor) pointColors.border = markStyle.borderColor;
        return {
            [`${keyPrefix}Point`]: {
                type: 'point',
                xValue: point.xValue,
                yValue: point.y,
                backgroundColor: pointColors.fill,
                borderColor: pointColors.border,
                borderWidth: markStyle?.borderWidthEnabled ? markStyle.borderWidth : (isLightTheme ? 2.8 : 1.8),
                radius: point.pointStyle === 'none' ? 0 : markRadius,
                pointStyle: getMarkPointStyle(point.pointStyle || 'circle'),
                hitRadius: 10,
                enabled: true
            },
            [`${keyPrefix}Label`]: {
                type: 'label',
                xValue: point.xValue,
                yValue: point.y,
                content: point.label ?? labelText,
                backgroundColor: bgColor,
                borderColor: simple ? 'transparent' : accent,
                borderWidth: simple ? 0 : (isLightTheme ? 1.6 : 1.2),
                borderRadius: simple ? 0 : 8,
                color: textColor,
                font: { size: simple ? 10.5 : 10.8, weight: isLightTheme ? '800' : '600' },
                padding: simple ? { top: 0, bottom: 0, left: 0, right: 0 } : { top: 4, bottom: 4, left: 8, right: 8 },
                xAdjust: 0,
                yAdjust: simple ? -22 : -34,
                enabled: true,
                position: 'center'
            }
        };
    }
    function interpolateRawAtTransformedX(dataset, targetX) {
        if (!dataset || !dataset.data || !dataset.rawData) return null;
        for (var i = 0; i < dataset.data.length - 1; i++) {
            var x1 = dataset.data[i].x, x2 = dataset.data[i + 1].x;
            if ((x1 <= targetX && targetX <= x2) || (x2 <= targetX && targetX <= x1)) {
                var t = (x2 === x1) ? 0 : (targetX - x1) / (x2 - x1);
                var r1 = dataset.rawData[i], r2 = dataset.rawData[i + 1];
                return {
                    rawX: r1.rawX + t * (r2.rawX - r1.rawX),
                    rawPH: r1.rawPH + t * (r2.rawPH - r1.rawPH),
                    rawY: r1.rawY + t * (r2.rawY - r1.rawY),
                    rawAmount: r1.rawAmount + t * (r2.rawAmount - r1.rawAmount)
                };
            }
        }
        return null;
    }
    function refreshDistributionPoint(point) {
        if (!point) return null;
        // 交点标记：根据当前模式重新计算坐标
        if (point.key && point.key.startsWith('dist-inter-')) {
            var rawVol = point.rawVolume, rawPh = point.rawPH;
            if (!Number.isFinite(rawVol) || !Number.isFinite(rawPh)) return point;
            var newXValue = xAxisMode === 'poh' ? (14 - rawPh) : (xAxisMode === 'ph' ? rawPh : rawVol);
            // 重新计算 y：在两条曲线的 rawData 中找到对应位置，用当前 transformY 变换
            var ds1 = lastDatasets.find(function(d) { return (d.speciesKey || d.label) === point.key1; });
            var ds2 = lastDatasets.find(function(d) { return (d.speciesKey || d.label) === point.key2; });
            var newY = point.y;
            if (ds1 && ds1.rawData) {
                var raw1 = interpolateRawAtTransformedX(ds1, newXValue);
                if (raw1) {
                    var y1 = ds1.directY ? raw1.rawY : transformY((yAxisMode === 'amount' || yAxisMode === 'amountLog') ? raw1.rawAmount : raw1.rawY);
                    if (Number.isFinite(y1)) newY = y1;
                }
            }
            var fmtX = Number.isFinite(newXValue) ? newXValue.toFixed(2) : '--';
            var fmtY = Number.isFinite(newY) ? newY.toFixed(2) : '--';
            var labelText = '(' + fmtX + ', ' + fmtY + ')';
            return {
                ...point,
                xValue: newXValue,
                y: newY,
                label: point.label ? updateLabelCoords(point.label, newXValue, newY) : labelText
            };
        }
        // 普通点：通过原始体积在 rawData 中重新查找，再用当前模式计算坐标
        const dataset = lastDatasets.find(ds => ds.speciesKey === point.speciesKey);
        if (!dataset || !dataset.rawData) return point;
        let nearestIdx = 0;
        let minDiff = Infinity;
        dataset.rawData.forEach((raw, index) => {
            const diff = Math.abs(raw.rawX - point.volume);
            if (diff < minDiff) {
                minDiff = diff;
                nearestIdx = index;
            }
        });
        const raw = dataset.rawData[nearestIdx];
        const refreshedY = dataset.directY ? raw.rawY : transformY((yAxisMode === 'amount' || yAxisMode === 'amountLog') ? raw.rawAmount : raw.rawY);
        return {
            ...point,
            axisMode: xAxisMode,
            xValue: xAxisMode === 'poh' ? (14 - Number(raw.rawPH)) : (xAxisMode === 'ph' ? raw.rawPH : raw.rawX),
            volume: raw.rawX,
            ph: raw.rawPH,
            y: refreshedY,
            rawY: raw.rawY,
            rawAmount: raw.rawAmount
        };
    }
    function updateLabelCoords(label, newX, newY) {
        if (!label || typeof label !== 'string') return label;
        // 坐标统一保留 2 位小数
        const fmtX = Number.isFinite(newX) ? newX.toFixed(2) : '--';
        const fmtY = Number.isFinite(newY) ? newY.toFixed(2) : '--';
        return label.replace(/\([\d.\-]+\s*,\s*[\d.\-]+\)/, '(' + fmtX + ', ' + fmtY + ')');
    }
    function applyDistributionAnnotations() {
        if (!distributionChartV32?.options?.plugins?.annotation) return;
        const visibleKeys = new Set(getVisibleDatasets().map(ds => ds.speciesKey));
        distributionSelectedPoint = refreshDistributionPoint(distributionSelectedPoint);
        distributionFixedMarks = distributionFixedMarks
            .map(refreshDistributionPoint)
            .filter(point => point && visibleKeys.has(point.speciesKey));
        const annotations = {};
        if (distributionSelectedPoint && visibleKeys.has(distributionSelectedPoint.speciesKey)) {
            Object.assign(annotations, buildDistributionAnnotationEntries(distributionSelectedPoint, 'distSelected'));
        }
        distributionFixedMarks.forEach((point, index) => {
            Object.assign(annotations, buildDistributionAnnotationEntries(point, `distFixed_${index}`));
        });
        applyAnnotationLabelOffsets(distributionAnnotationState, annotations);
        distributionChartV32.options.plugins.annotation.annotations = annotations;
        distributionChartV32.update('none');
        distributionAnnotationState.chart = distributionChartV32;
        distributionAnnotationState.refreshAnnotations = applyDistributionAnnotations;
        installAnnotationLabelDragging(distributionAnnotationState);
        updateDistMarksPanel();
    }
    function updateDistributionPointAnnotation(point, addFixed = false) {
        if (!point) return;
        distributionSelectedPoint = point;
        if (addFixed) {
            const key = point.key;
            const existing = distributionFixedMarks.findIndex(mark => mark.key === key);
            if (existing >= 0) {
                distributionFixedMarks.splice(existing, 1);
            } else {
                if (!point.label) {
                    const xVal = point.axisMode === 'poh' ? (14 - Number(point.ph)) : (point.axisMode === 'ph' ? point.ph : point.volume);
                    const fmtX = Number.isFinite(xVal) ? xVal.toFixed(2) : '--';
                    point.label = '(' + fmtX + ', ' + point.y.toFixed(2) + ')';
                }
                distributionFixedMarks.push(point);
            }
        }
        applyDistributionAnnotations();
    }
    function clearDistributionPreviewPoint() {
        if (!distributionSelectedPoint) return;
        distributionSelectedPoint = null;
        applyDistributionAnnotations();
    }
    function clearAllDistributionMarks() {
        distributionSelectedPoint = null;
        distributionFixedMarks = [];
        distributionAnnotationState.annotationLabelOffsets = {};
        applyDistributionAnnotations();
        updateDistMarksPanel();
    }
    function updateDistMarksPanel() {
        var panel = document.getElementById('distMarksPanel');
        if (!panel) return;
        var countEl = panel.querySelector('.marks-count');
        var listEl = document.getElementById('distMarksList');
        if (!listEl) return;
        var marks = distributionFixedMarks || [];
        if (countEl) countEl.textContent = '(' + marks.length + ')';
        if (marks.length === 0) {
            listEl.innerHTML = '<div class="marks-empty" data-i18n="no_marks_yet">暂无标记点。长按图表中的点可添加标记。</div>';
            return;
        }
        listEl.innerHTML = '';
        marks.forEach(function(mark, idx) {
            var row = document.createElement('div');
            row.className = 'mark-row';
            var dot = document.createElement('span');
            dot.className = 'mark-dot';
            dot.style.backgroundColor = mark.color || '#57a7bd';
            var nameEl = document.createElement('span');
            nameEl.className = 'mark-curve-name';
            nameEl.textContent = mark.datasetLabel || mark.speciesKey || '';
            var text = document.createElement('input');
            text.className = 'mark-text';
            text.type = 'text';
            text.value = mark.label || '';
            text.addEventListener('input', function() {
                mark.label = this.value;
                if (distributionChartV32?.options?.plugins?.annotation) {
                    var anns = {};
                    if (distributionSelectedPoint) Object.assign(anns, buildDistributionAnnotationEntries(distributionSelectedPoint, 'distSelected'));
                    distributionFixedMarks.forEach(function(p, i) { Object.assign(anns, buildDistributionAnnotationEntries(p, 'distFixed_' + i)); });
                    applyAnnotationLabelOffsets(distributionAnnotationState, anns);
                    distributionChartV32.options.plugins.annotation.annotations = anns;
                    distributionChartV32.update('none');
                }
            });
            text.addEventListener('change', function() {
                applyDistributionAnnotations();
            });
            var del = document.createElement('button');
            del.className = 'mark-delete';
            del.textContent = '\u00d7';
            del.dataset.i18nTitle = 'mark_delete_title';
            del.title = t('删除此标记', 'Delete this mark');
            del.addEventListener('click', function() {
                distributionFixedMarks.splice(idx, 1);
                applyDistributionAnnotations();
                updateDistMarksPanel();
            });
            row.appendChild(dot);
            if (mark.datasetLabel) row.appendChild(nameEl);
            row.appendChild(text);
            row.appendChild(del);
            listEl.appendChild(row);
        });
        if (typeof translateStaticUI === 'function') translateStaticUI();
    }
    function updateDistIntersectionPanel() {
        var panel = document.getElementById('distIntersectionPanel');
        if (!panel) return;
        var sel1 = document.getElementById('distIntCurve1');
        var sel2 = document.getElementById('distIntCurve2');
        var btn = document.getElementById('distIntBtn');
        if (!sel1 || !sel2 || !btn) return;
        var datasets = (typeof getVisibleDatasets === 'function') ? getVisibleDatasets() : [];
        sel1.innerHTML = ''; sel2.innerHTML = '';
        if (datasets.length < 2) {
            sel1.innerHTML = '<option value="">--</option>';
            sel2.innerHTML = '<option value="">--</option>';
            btn.disabled = true;
            return;
        }
        datasets.forEach(function(ds) {
            var opt = document.createElement('option');
            opt.value = ds.speciesKey || ds.label;
            opt.textContent = ds.label || ds.speciesKey || '';
            sel1.appendChild(opt.cloneNode(true));
            sel2.appendChild(opt);
        });
        if (datasets.length >= 2) sel2.selectedIndex = 1;
        btn.disabled = false;
        btn.onclick = function() {
            var key1 = sel1.value;
            var key2 = sel2.value;
            if (!key1 || !key2 || key1 === key2) {
                showAlert(t('提示', 'Tip'), t('请选择两条不同的曲线。', 'Please select two different curves.'), 'warning');
                return;
            }
            findDistIntersections(key1, key2);
        };
    }
    function findDistIntersections(key1, key2) {
        var datasets = (typeof getVisibleDatasets === 'function') ? getVisibleDatasets() : [];
        var ds1 = datasets.find(function(d) { return (d.speciesKey || d.label) === key1; });
        var ds2 = datasets.find(function(d) { return (d.speciesKey || d.label) === key2; });
        if (!ds1 || !ds2 || !ds1.data || !ds2.data) {
            showAlert(t('提示', 'Tip'), t('曲线数据无效。', 'Curve data is invalid.'), 'warning');
            return;
        }
        var pts1 = ds1.data.map(function(p) { return { x: p.x, y: p.y }; });
        var pts2 = ds2.data.map(function(p) { return { x: p.x, y: p.y }; });
        var results = [];
        for (var i = 0; i < pts1.length - 1; i++) {
            for (var j = 0; j < pts2.length - 1; j++) {
                var pt = findSegmentIntersection(pts1[i], pts1[i+1], pts2[j], pts2[j+1]);
                if (pt) {
                    var dup = results.some(function(r) {
                        return Math.abs(r.x - pt.x) < 0.001 && Math.abs(r.y - pt.y) < 0.01;
                    });
                    if (!dup) results.push(pt);
                }
            }
        }
        if (results.length === 0) {
            showAlert(t('提示', 'Tip'), t('未找到交点。', 'No intersections found.'), 'ℹ');
            return;
        }
        var added = 0;
        results.forEach(function(pt) {
            var iKey = 'dist-inter-' + key1 + '-' + key2 + '-' + pt.x.toFixed(3);
            if (distributionFixedMarks.find(function(m) { return m.key === iKey; })) return;
            // 通过插值获取交点对应的原始体积和原始 pH
            var rawInfo1 = interpolateRawAtTransformedX(ds1, pt.x);
            var rawInfo2 = interpolateRawAtTransformedX(ds2, pt.x);
            var rawVol = rawInfo1 ? rawInfo1.rawX : pt.x;
            var rawPh = rawInfo1 ? rawInfo1.rawPH : (rawInfo2 ? rawInfo2.rawPH : pt.y);
            distributionFixedMarks.push({
                key: iKey,
                xValue: pt.x,
                y: pt.y,
                rawVolume: rawVol,
                rawPH: rawPh,
                volume: rawVol,
                ph: rawPh,
                color: ds1.borderColor || '#57a7bd',
                datasetLabel: (ds1.label || key1) + ' \u2229 ' + (ds2.label || key2),
                speciesKey: key1,
                key1: key1,
                key2: key2,
                label: '(' + pt.x.toFixed(2) + ', ' + pt.y.toFixed(2) + ')'
            });
            added++;
        });
        if (added > 0) {
            applyDistributionAnnotations();
            updateDistMarksPanel();
            showAlert(t('成功', 'Success'), t('找到 {count} 个交点并已标记在图中。', 'Found {count} intersection(s) and marked on the chart.').replace('{count}', added), 'check');
        } else {
            showAlert(t('提示', 'Tip'), t('交点已存在，无需重复标记。', 'Intersection already exists.'), 'ℹ');
        }
    }
    function cancelDistributionHold(clearPreview = true) {
        if (distributionHold.timer) clearTimeout(distributionHold.timer);
        if (distributionHold.raf) cancelAnimationFrame(distributionHold.raf);
        distributionHold = { active: false, timer: null, raf: null, point: null, startTime: 0 };
        if (typeof hideHoldProgress === 'function') hideHoldProgress();
        if (clearPreview) clearDistributionPreviewPoint();
    }
    function getNearestDistributionPointToPointer(event) {
        if (!distributionChartV32) return null;
        const canvas = distributionChartV32.canvas;
        const rect = canvas.getBoundingClientRect();
        const pointerX = event.clientX - rect.left;
        const pointerY = event.clientY - rect.top;
        const xScale = distributionChartV32.scales.x;
        const yScale = distributionChartV32.scales.y;
        if (!xScale || !yScale) return null;
        const xValue = xScale.getValueForPixel(pointerX);
        let best = null;
        let bestDistance = Infinity;
        getVisibleDatasets().forEach(dataset => {
            const point = getDistributionPointFromDataset(dataset, xValue, xAxisMode);
            if (!point) return;
            const pointX = xScale.getPixelForValue(point.xValue);
            const pointY = yScale.getPixelForValue(point.y);
            const distance = Math.hypot(pointX - pointerX, pointY - pointerY);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = point;
            }
        });
        return best;
    }
    function startDistributionHold(event) {
        if (!distributionChartV32) return;
        if (event.button !== undefined && event.button !== 0) return;
        if (isPointerOnDraggableLabel(distributionChartV32.canvas, distributionChartV32, event)) return;
        const point = getNearestDistributionPointToPointer(event);
        if (!point) return;
        cancelDistributionHold();
        updateDistributionPointAnnotation(point, false);
        distributionHold.active = true;
        distributionHold.point = point;
        distributionHold.startTime = performance.now();
        if (typeof showHoldProgress === 'function') showHoldProgress(event.clientX, event.clientY);
        const duration = 700;
        distributionHold.timer = setTimeout(() => {
            if (!distributionHold.active) return;
            updateDistributionPointAnnotation(point, true);
            cancelDistributionHold();
        }, duration);
        const tick = () => {
            if (!distributionHold.active) return;
            if (typeof updateHoldProgress === 'function') {
                updateHoldProgress((performance.now() - distributionHold.startTime) / duration);
            }
            distributionHold.raf = requestAnimationFrame(tick);
        };
        distributionHold.raf = requestAnimationFrame(tick);
    }
    function attachDistributionHoldListeners(canvas) {
        if (!canvas || canvas.dataset.distHoldBound === '1') return;
        canvas.dataset.distHoldBound = '1';
        canvas.addEventListener('pointerdown', startDistributionHold);
        canvas.addEventListener('pointermove', event => {
            if (!distributionHold.active) return;
            if (isPointerOnDraggableLabel(canvas, distributionChartV32, event)) {
                cancelDistributionHold();
                return;
            }
            if (typeof showHoldProgress === 'function') showHoldProgress(event.clientX, event.clientY);
        });
        canvas.addEventListener('pointerup', () => cancelDistributionHold());
        canvas.addEventListener('pointerleave', () => cancelDistributionHold());
        canvas.addEventListener('pointercancel', () => cancelDistributionHold());
        canvas.addEventListener('contextmenu', event => event.preventDefault());
    }
    function setDistributionXAxisMode(mode, shouldRender = true) {
        if (!mode || mode === xAxisMode) {
            if (shouldRender && lastTab && lastParams) renderChart();
            return;
        }
        xAxisMode = mode;
        isDistXRangeManual = false;
        manualDistXRange = null;
        const xsw = document.getElementById('distXAxisSwitch');
        if (xsw) {
            xsw.querySelectorAll('.dist-mode-btn').forEach(b => {
                const active = b.dataset.xmode === mode;
                b.classList.toggle('active', active);
                b.setAttribute('aria-selected', active ? 'true' : 'false');
            });
        }
        // v7.0: update pick panel placeholder/button text based on x-axis mode
        const phPickInput = document.getElementById('distPHPickInput');
        const phPickBtn = document.getElementById('distPHPickBtn');
        if (mode === 'poh') {
            if (phPickInput) phPickInput.placeholder = 'pOH';
            if (phPickBtn) phPickBtn.textContent = t('按 pOH', 'By pOH');
        } else {
            if (phPickInput) phPickInput.placeholder = 'pH';
            if (phPickBtn) phPickBtn.textContent = t('按 pH', 'By pH');
        }
        if (shouldRender && lastTab && lastParams) renderChart();
    }
    function bindModeSwitch() {
        const sw = document.getElementById('distModeSwitch');
        if (sw && sw.dataset.bound !== '1') {
            sw.dataset.bound = '1';
            sw.addEventListener('click', (e) => {
                const btn = e.target.closest('.dist-mode-btn');
                if (!btn) return;
                const mode = btn.dataset.mode;
                if (!mode || mode === yAxisMode) return;
                yAxisMode = mode;
                isDistYRangeManual = false;
                manualDistYRange = null;
                updateLogSignVisibility();
                sw.querySelectorAll('.dist-mode-btn').forEach(b => {
                    const active = b.dataset.mode === mode;
                    b.classList.toggle('active', active);
                    b.setAttribute('aria-selected', active ? 'true' : 'false');
                });
                if (lastTab && lastParams) {
                    renderChart();
                }
            });
        }
        const xsw = document.getElementById('distXAxisSwitch');
        if (xsw && xsw.dataset.bound !== '1') {
            xsw.dataset.bound = '1';
            xsw.addEventListener('click', (e) => {
                const btn = e.target.closest('.dist-mode-btn');
                if (!btn) return;
                const mode = btn.dataset.xmode;
                if (!mode || mode === xAxisMode) return;
                setDistributionXAxisMode(mode);
            });
        }
        const logSw = document.getElementById('distLogSignSwitch');
        updateLogSignVisibility();
        if (logSw && logSw.dataset.bound !== '1') {
            logSw.dataset.bound = '1';
            logSw.addEventListener('click', (e) => {
                const btn = e.target.closest('.dist-mode-btn');
                if (!btn) return;
                const sign = btn.dataset.logsign;
                if (!sign || sign === distributionLogSign) return;
                distributionLogSign = sign;
                updateLogSignVisibility();
                logSw.querySelectorAll('.dist-mode-btn').forEach(b => {
                    const active = b.dataset.logsign === sign;
                    b.classList.toggle('active', active);
                    b.setAttribute('aria-selected', active ? 'true' : 'false');
                });
                if (lastTab && lastParams) renderChart();
            });
        }
    }
    function updateLogSignVisibility() {
        const logSw = document.getElementById('distLogSignSwitch');
        if (!logSw) return;
        logSw.classList.toggle('active', yAxisMode === 'log' || yAxisMode === 'amountLog');
        const logBtn = document.querySelector('#distModeSwitch [data-mode="log"]');
        const amountLogBtn = document.querySelector('#distModeSwitch [data-mode="amountLog"]');
        if (logBtn) logBtn.textContent = distributionLogSign === 'pos' ? t('log c', 'log c') : t('−log c', '−log c');
        if (amountLogBtn) amountLogBtn.textContent = distributionLogSign === 'pos' ? t('log 总量', 'log total') : t('−log 总量', '−log total');
    }
    function bindDistributionControls() {
        bindExpressionBuilder();
        // X轴范围输入绑定
        const xMinInput = document.getElementById('distXMin');
        const xMaxInput = document.getElementById('distXMax');
        const xAutoBtn = document.getElementById('distXAutoBtn');
        if (xMinInput && xMaxInput && xMinInput.dataset.bound !== '1') {
            xMinInput.dataset.bound = '1';
            xMaxInput.dataset.bound = '1';
            const applyXRange = () => {
                const autoRange = getDistXAutoRange();
                manualDistXRange = normalizeAxisRange(xMinInput.value, xMaxInput.value, autoRange);
                isDistXRangeManual = true;
                if (lastTab && lastParams) renderChart();
            };
            xMinInput.addEventListener('change', applyXRange);
            xMaxInput.addEventListener('change', applyXRange);
            xMinInput.addEventListener('keydown', event => { if (event.key === 'Enter') applyXRange(); });
            xMaxInput.addEventListener('keydown', event => { if (event.key === 'Enter') applyXRange(); });
        }
        if (xAutoBtn && xAutoBtn.dataset.bound !== '1') {
            xAutoBtn.dataset.bound = '1';
            xAutoBtn.addEventListener('click', () => {
                isDistXRangeManual = false;
                manualDistXRange = null;
                updateDistXRangeInputs();
                if (lastTab && lastParams) renderChart();
            });
        }
        // Y轴范围输入绑定
        const yMinInput = document.getElementById('distYMin');
        const yMaxInput = document.getElementById('distYMax');
        const yAutoBtn = document.getElementById('distYAutoBtn');
        if (yMinInput && yMaxInput && yMinInput.dataset.bound !== '1') {
            yMinInput.dataset.bound = '1';
            yMaxInput.dataset.bound = '1';
            const applyYRange = () => {
                const autoRange = getDistYAutoRange(lastDatasets);
                manualDistYRange = normalizeAxisRange(yMinInput.value, yMaxInput.value, autoRange);
                isDistYRangeManual = true;
                if (lastTab && lastParams) renderChart();
            };
            yMinInput.addEventListener('change', applyYRange);
            yMaxInput.addEventListener('change', applyYRange);
            yMinInput.addEventListener('keydown', event => { if (event.key === 'Enter') applyYRange(); });
            yMaxInput.addEventListener('keydown', event => { if (event.key === 'Enter') applyYRange(); });
        }
        if (yAutoBtn && yAutoBtn.dataset.bound !== '1') {
            yAutoBtn.dataset.bound = '1';
            yAutoBtn.addEventListener('click', () => {
                isDistYRangeManual = false;
                manualDistYRange = null;
                updateDistYRangeInputs(lastDatasets);
                if (lastTab && lastParams) renderChart();
            });
        }
        const list = document.getElementById('distributionComponentList');
        if (list && list.dataset.bound !== '1') {
            list.dataset.bound = '1';
            list.addEventListener('change', event => {
                const input = event.target.closest('input[data-species-key]');
                if (!input) return;
                const allKeys = lastDatasets.map(ds => ds.speciesKey);
                visibleSpeciesKeys = new Set(
                    Array.from(list.querySelectorAll('input[data-species-key]:checked'))
                        .map(item => item.dataset.speciesKey)
                        .filter(key => allKeys.includes(key))
                );
                renderChart();
            });
        }
        const allBtn = document.getElementById('distComponentAllBtn');
        if (allBtn && allBtn.dataset.bound !== '1') {
            allBtn.dataset.bound = '1';
            allBtn.addEventListener('click', () => {
                visibleSpeciesKeys = null;
                renderComponentSelector();
                renderChart();
            });
        }
        const noneBtn = document.getElementById('distComponentNoneBtn');
        if (noneBtn && noneBtn.dataset.bound !== '1') {
            noneBtn.dataset.bound = '1';
            noneBtn.addEventListener('click', () => {
                visibleSpeciesKeys = new Set();
                renderComponentSelector();
                renderChart();
            });
        }
        const markSelect = document.getElementById('distMarkSpeciesSelect');
        if (markSelect && markSelect.dataset.bound !== '1') {
            markSelect.dataset.bound = '1';
            markSelect.addEventListener('change', () => {
                distMarkSpeciesKeys = new Set(
                    Array.from(markSelect.querySelectorAll('input[data-mark-species-key]:checked'))
                        .map(input => input.dataset.markSpeciesKey)
                        .filter(Boolean)
                );
            });
        }
        const volumePickInput = document.getElementById('distVolumePickInput');
        const volumePickBtn = document.getElementById('distVolumePickBtn');
        const phPickInput = document.getElementById('distPHPickInput');
        const phPickBtn = document.getElementById('distPHPickBtn');
        const clearMarksBtn = document.getElementById('distClearMarksBtn');
        const pickByVolume = () => {
            const volume = parseFloat(volumePickInput?.value);
            if (!Number.isFinite(volume)) {
                if (typeof showAlert === 'function') showAlert(t('提示', 'Tip'), t('请输入有效的体积数值。', 'Please enter a valid volume value.'), 'ℹ');
                return;
            }
            setDistributionXAxisMode('volume', true);
            setTimeout(() => {
                const points = getTargetDistributionPoints(volume, 'volume', true);
                points.forEach(point => updateDistributionPointAnnotation(point, true));
                clearDistributionPreviewPoint();
            }, 0);
        };
        const pickByPH = () => {
            const inputValue = parseFloat(phPickInput?.value);
            if (!Number.isFinite(inputValue)) {
                if (typeof showAlert === 'function') showAlert(t('提示', 'Tip'), t('请输入有效的数值。', 'Please enter a valid value.'), 'ℹ');
                return;
            }
            // v7.0: when xAxisMode is 'poh', treat input as pOH and convert to pH
            const isPOHMode = xAxisMode === 'poh';
            const pH = isPOHMode ? (14 - inputValue) : inputValue;
            const targetMode = isPOHMode ? 'poh' : 'ph';
            setDistributionXAxisMode(targetMode, true);
            setTimeout(() => {
                const points = getTargetDistributionPoints(pH, targetMode, true);
                points.forEach(point => updateDistributionPointAnnotation(point, true));
                clearDistributionPreviewPoint();
            }, 0);
        };
        if (volumePickBtn && volumePickBtn.dataset.bound !== '1') {
            volumePickBtn.dataset.bound = '1';
            volumePickBtn.addEventListener('click', pickByVolume);
        }
        if (volumePickInput && volumePickInput.dataset.pickBound !== '1') {
            volumePickInput.dataset.pickBound = '1';
            volumePickInput.addEventListener('keydown', event => { if (event.key === 'Enter') pickByVolume(); });
        }
        if (phPickBtn && phPickBtn.dataset.bound !== '1') {
            phPickBtn.dataset.bound = '1';
            phPickBtn.addEventListener('click', pickByPH);
        }
        if (phPickInput && phPickInput.dataset.pickBound !== '1') {
            phPickInput.dataset.pickBound = '1';
            phPickInput.addEventListener('keydown', event => { if (event.key === 'Enter') pickByPH(); });
        }
        if (clearMarksBtn && clearMarksBtn.dataset.bound !== '1') {
            clearMarksBtn.dataset.bound = '1';
            clearMarksBtn.addEventListener('click', clearAllDistributionMarks);
        }
        // v6.6: distribution chart width + aspect ratio (desktop)
        //       Only the chart width changes; the chart height stays
        //       fixed so that the page layout doesn't shift.
        const distWidthInput = document.getElementById('distChartWidth');
        const distAspectSelect = document.getElementById('distChartAspect');
        if (distWidthInput && distWidthInput.dataset.bound !== '1') {
            distWidthInput.dataset.bound = '1';
            distWidthInput.addEventListener('input', () => applyDistributionChartWidth(distWidthInput.value));
            distWidthInput.addEventListener('change', () => applyDistributionChartWidth(distWidthInput.value));
        }
        if (distAspectSelect && distAspectSelect.dataset.bound !== '1') {
            distAspectSelect.dataset.bound = '1';
            distAspectSelect.addEventListener('change', () => applyDistributionAspectRatio(distAspectSelect.value));
        }
        const distGridEnabled = document.getElementById('distGridEnabled');
        const distLegendEnabled = document.getElementById('distLegendEnabled');
        const distGridXStep = document.getElementById('distGridXStep');
        const distGridYStep = document.getElementById('distGridYStep');
        if (distGridEnabled && distGridEnabled.dataset.bound !== '1') {
            distGridEnabled.dataset.bound = '1';
            distGridEnabled.checked = distributionGrid.gridEnabled !== false;
            distGridEnabled.addEventListener('change', () => {
                distributionGrid.gridEnabled = distGridEnabled.checked;
                renderChart();
            });
        }
        if (distLegendEnabled && distLegendEnabled.dataset.bound !== '1') {
            distLegendEnabled.dataset.bound = '1';
            distLegendEnabled.checked = distributionGrid.showLegend !== false;
            distLegendEnabled.addEventListener('change', () => {
                distributionGrid.showLegend = distLegendEnabled.checked;
                renderChart();
            });
        }
        if (distGridXStep && distGridXStep.dataset.bound !== '1') {
            distGridXStep.dataset.bound = '1';
            distGridXStep.value = distributionGrid.gridXStep > 0 ? String(distributionGrid.gridXStep) : '';
            distGridXStep.addEventListener('input', () => {
                const val = parseFloat(distGridXStep.value);
                distributionGrid.gridXStep = Number.isFinite(val) && val > 0 ? val : 0;
                renderChart();
            });
        }
        if (distGridYStep && distGridYStep.dataset.bound !== '1') {
            distGridYStep.dataset.bound = '1';
            distGridYStep.value = distributionGrid.gridYStep > 0 ? String(distributionGrid.gridYStep) : '';
            distGridYStep.addEventListener('input', () => {
                const val = parseFloat(distGridYStep.value);
                distributionGrid.gridYStep = Number.isFinite(val) && val > 0 ? val : 0;
                renderChart();
            });
        }
        // v7.0: distribution axis label and style controls
        const distXAxisLabel = document.getElementById('distXAxisLabel');
        const distYAxisLabel = document.getElementById('distYAxisLabel');
        const distXTickColor = document.getElementById('distXTickColor');
        const distYTickColor = document.getElementById('distYTickColor');
        const distXGridColor = document.getElementById('distXGridColor');
        const distYGridColor = document.getElementById('distYGridColor');
        const distXTicksVisible = document.getElementById('distXTicksVisible');
        const distYTicksVisible = document.getElementById('distYTicksVisible');
        const distXAxisArrow = document.getElementById('distXAxisArrow');
        const distYAxisArrow = document.getElementById('distYAxisArrow');
        const distXAxisLineColor = document.getElementById('distXAxisLineColor');
        const distYAxisLineColor = document.getElementById('distYAxisLineColor');
        if (distXAxisLabel && distXAxisLabel.dataset.axisBound !== '1') {
            distXAxisLabel.dataset.axisBound = '1';
            distXAxisLabel.value = distributionAxisConfig.xAxisLabel || '';
            distXAxisLabel.addEventListener('input', () => { distributionAxisConfig.xAxisLabel = distXAxisLabel.value; renderChart(); });
        }
        if (distYAxisLabel && distYAxisLabel.dataset.axisBound !== '1') {
            distYAxisLabel.dataset.axisBound = '1';
            distYAxisLabel.value = distributionAxisConfig.yAxisLabel || '';
            distYAxisLabel.addEventListener('input', () => { distributionAxisConfig.yAxisLabel = distYAxisLabel.value; renderChart(); });
        }
        if (distXAxisLineColor && distXAxisLineColor.dataset.axisBound !== '1') {
            distXAxisLineColor.dataset.axisBound = '1';
            distXAxisLineColor.value = distributionAxisConfig.xAxisLineColor || '#666666';
            distXAxisLineColor.addEventListener('input', () => { distributionAxisConfig.xAxisLineColor = distXAxisLineColor.value; renderChart(); });
        }
        if (distYAxisLineColor && distYAxisLineColor.dataset.axisBound !== '1') {
            distYAxisLineColor.dataset.axisBound = '1';
            distYAxisLineColor.value = distributionAxisConfig.yAxisLineColor || '#666666';
            distYAxisLineColor.addEventListener('input', () => { distributionAxisConfig.yAxisLineColor = distYAxisLineColor.value; renderChart(); });
        }
        if (distXTickColor && distXTickColor.dataset.axisBound !== '1') {
            distXTickColor.dataset.axisBound = '1';
            distXTickColor.value = distributionAxisConfig.xTickColor || '#666666';
            distXTickColor.addEventListener('input', () => { distributionAxisConfig.xTickColor = distXTickColor.value; renderChart(); });
        }
        if (distYTickColor && distYTickColor.dataset.axisBound !== '1') {
            distYTickColor.dataset.axisBound = '1';
            distYTickColor.value = distributionAxisConfig.yTickColor || '#666666';
            distYTickColor.addEventListener('input', () => { distributionAxisConfig.yTickColor = distYTickColor.value; renderChart(); });
        }
        if (distXGridColor && distXGridColor.dataset.axisBound !== '1') {
            distXGridColor.dataset.axisBound = '1';
            distXGridColor.value = distributionAxisConfig.xGridColor || '#e5e5e5';
            distXGridColor.addEventListener('input', () => { distributionAxisConfig.xGridColor = distXGridColor.value; renderChart(); });
        }
        if (distYGridColor && distYGridColor.dataset.axisBound !== '1') {
            distYGridColor.dataset.axisBound = '1';
            distYGridColor.value = distributionAxisConfig.yGridColor || '#e5e5e5';
            distYGridColor.addEventListener('input', () => { distributionAxisConfig.yGridColor = distYGridColor.value; renderChart(); });
        }
        if (distXTicksVisible && distXTicksVisible.dataset.axisBound !== '1') {
            distXTicksVisible.dataset.axisBound = '1';
            distXTicksVisible.checked = distributionAxisConfig.xTicksVisible !== false;
            distXTicksVisible.addEventListener('change', () => { distributionAxisConfig.xTicksVisible = distXTicksVisible.checked; renderChart(); });
        }
        if (distYTicksVisible && distYTicksVisible.dataset.axisBound !== '1') {
            distYTicksVisible.dataset.axisBound = '1';
            distYTicksVisible.checked = distributionAxisConfig.yTicksVisible !== false;
            distYTicksVisible.addEventListener('change', () => { distributionAxisConfig.yTicksVisible = distYTicksVisible.checked; renderChart(); });
        }
        if (distXAxisArrow && distXAxisArrow.dataset.axisBound !== '1') {
            distXAxisArrow.dataset.axisBound = '1';
            distXAxisArrow.checked = !!distributionAxisConfig.xAxisArrow;
            distXAxisArrow.addEventListener('change', () => { distributionAxisConfig.xAxisArrow = distXAxisArrow.checked; renderChart(); });
        }
        if (distYAxisArrow && distYAxisArrow.dataset.axisBound !== '1') {
            distYAxisArrow.dataset.axisBound = '1';
            distYAxisArrow.checked = !!distributionAxisConfig.yAxisArrow;
            distYAxisArrow.addEventListener('change', () => { distributionAxisConfig.yAxisArrow = distYAxisArrow.checked; renderChart(); });
        }
    }
    function getDistributionChartWrapper() {
        const canvas = document.getElementById('distributionChart');
        return canvas ? canvas.closest('.chart-wrapper') : null;
    }
    function applyDistributionChartWidth(value) {
        const wrapper = getDistributionChartWrapper();
        if (!wrapper) return;
        const width = parseInt(value, 10);
        if (Number.isFinite(width) && width >= 200) {
            wrapper.style.setProperty('--chart-custom-width', `${width}px`);
            wrapper.style.width = `${width}px`;
            wrapper.style.maxWidth = '100%';
            wrapper.classList.add('custom-width');
        } else {
            wrapper.style.removeProperty('--chart-custom-width');
            wrapper.style.removeProperty('width');
            wrapper.style.removeProperty('max-width');
            wrapper.classList.remove('custom-width');
        }
        if (distributionChartV32) distributionChartV32.resize();
    }
    function applyDistributionAspectRatio(ratioValue) {
        const wrapper = getDistributionChartWrapper();
        const widthInput = document.getElementById('distChartWidth');
        if (!wrapper) return;
        if (!ratioValue || ratioValue === 'auto') {
            if (widthInput) widthInput.value = '';
            applyDistributionChartWidth('');
            return;
        }
        const parts = ratioValue.split(':').map(Number);
        if (parts.length !== 2 || !parts[0] || !parts[1]) return;
        // v6.6: keep the current height fixed; derive the width from
        //       the desired aspect ratio so layout height stays stable.
        const rect = wrapper.getBoundingClientRect();
        const height = rect.height || wrapper.clientHeight || 420;
        const width = Math.max(200, Math.round(height * (parts[0] / parts[1])));
        if (widthInput) widthInput.value = width;
        applyDistributionChartWidth(width);
    }
    function renderChart() {
        const canvas = document.getElementById('distributionChart');
        const empty = document.getElementById('distributionEmpty');
        if (!canvas || !window.Chart) return;
        if (lastTab && lastParams) {
            lastDatasets = buildSpeciesDatasetsV32(lastTab, lastParams);
            if (visibleSpeciesKeys) {
                const validKeys = new Set(lastDatasets.map(ds => ds.speciesKey));
                visibleSpeciesKeys = new Set(Array.from(visibleSpeciesKeys).filter(key => validKeys.has(key)));
            }
        }
        renderComponentSelector();
        renderDistSaveToCompositeList();
        if (!lastDatasets.length) {
            if (distributionChartV32) { distributionChartV32.destroy(); distributionChartV32 = null; }
            if (empty) empty.style.display = 'block';
            return;
        }
        if (empty) empty.style.display = 'none';
        applyTransformToDatasets(lastDatasets);
        if (!isDistXRangeManual) updateDistXRangeInputs();
        if (!isDistYRangeManual) updateDistYRangeInputs(lastDatasets);
        const visibleDatasets = getVisibleDatasets();
        const isPaperStyle = typeof chartStyle !== 'undefined' && chartStyle === 'paper';
        const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
        const themeColors = isPaperStyle ? {
            textPrimary: isDarkTheme ? '#e5e7eb' : '#000000',
            textSecondary: isDarkTheme ? '#cbd5e1' : '#666666',
            gridColor: isDarkTheme ? 'rgba(255,255,255,0.18)' : '#e5e5e5'
        } : (typeof getThemeColors === 'function' ? getThemeColors() : {
            textPrimary: '#edf6ff',
            textSecondary: 'rgba(226,237,255,.66)',
            gridColor: 'rgba(210,235,255,.13)'
        });
        if (distributionChartV32) distributionChartV32.destroy();
        distributionChartV32 = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: { datasets: visibleDatasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                devicePixelRatio: (typeof getLiveChartPixelRatio === 'function') ? getLiveChartPixelRatio(isPaperStyle) : 1,
                animation: false,
                interaction: { intersect: false, mode: 'index' },
                onClick: (evt, elements, chart) => {
                    // v7.0.9: 底部物种浓度信息面板已删除，点击不再显示详情
                },
                plugins: {
                    legend: {
                        display: distributionGrid.showLegend !== false,
                        position: 'top',
                        labels: { color: themeColors.textPrimary, font: { size: isPaperStyle ? 12 : 11 }, usePointStyle: false, boxWidth: 12, boxHeight: 12, padding: 12, fillStyle: 'transparent', backgroundColor: 'transparent' }
                    },
                    tooltip: {
                        enabled: false
                    },
                    annotation: { annotations: {} },
                    axisArrow: {
                        x: !!distributionAxisConfig.xAxisArrow,
                        y: !!distributionAxisConfig.yAxisArrow,
                        color: distributionAxisConfig.xAxisLineColor || themeColors.textSecondary
                    }
                },
                scales: {
                    x: getXAxisConfig(themeColors),
                    y: getYAxisConfig(themeColors, visibleDatasets)
                }
            }
        });
        attachDistributionHoldListeners(canvas);
        applyDistributionAnnotations();
        updateDistIntersectionPanel();
    }
    window.syncDistributionToActiveSingleTab = function () {
        bindModeSwitch();
        bindDistributionControls();
        bindDownloadBtn();
        bindDistSaveToCompositeBtn();
        const tab = (typeof getActiveTab === 'function') ? getActiveTab() : null;
        const hasCurveData = tab
            && tab.type === 'single'
            && Array.isArray(tab.volumes)
            && Array.isArray(tab.phs)
            && tab.volumes.length > 0
            && tab.phs.length > 0;
        distributionSelectedPoint = null;
        distributionFixedMarks = [];
        if (!hasCurveData) {
            lastTab = tab || null;
            lastParams = null;
            lastDatasets = [];
            visibleSpeciesKeys = new Set();
            renderChart();
            return false;
        }
        window.updateDistributionChart(tab, tab.params || config);
        return true;
    };
    window.updateDistributionChart = function (tab, params) {
        bindModeSwitch();
        bindDistributionControls();
        bindDownloadBtn();
        bindDistSaveToCompositeBtn();
        const stableParams = cloneCurrentParams(params);
        lastTab = tab;
        lastParams = stableParams;
        isPHRangeManual = false;
        manualPHRange = null;
        isDistXRangeManual = false;
        manualDistXRange = null;
        isDistYRangeManual = false;
        manualDistYRange = null;
        lastDatasets = buildSpeciesDatasetsV32(tab, stableParams);
        visibleSpeciesKeys = new Set(lastDatasets
            .filter(ds => ds.speciesKey !== 'H' && ds.speciesKey !== 'OH')
            .map(ds => ds.speciesKey));
        renderChart();
    };
    window.refreshDistributionChartStyle = function () {
        if (lastTab && lastParams) renderChart();
    };
    function getDistributionXAxisShort() {
        if (xAxisMode === 'ph') return 'pH';
        if (xAxisMode === 'poh') return 'pOH';
        return 'V';
    }
    function getDistributionYAxisShort() {
        if (yAxisMode === 'linear') return t('浓度', 'Concentration');
        if (yAxisMode === 'log') return distributionLogSign === 'pos' ? 'log c' : 'pC';
        if (yAxisMode === 'amount') return 'mmol';
        if (yAxisMode === 'amountLog') return distributionLogSign === 'pos' ? 'log n' : 'pN';
        return t('浓度', 'Concentration');
    }
    function getDistributionYAxisUnit() {
        return getDistributionYAxisShort();
    }
    window.saveDistributionToComposite = function (selectedKeys) {
        if (!lastDatasets.length || !lastParams) {
            if (typeof showAlert === 'function') showAlert(t('提示', 'Tip'), t('请先生成滴定曲线后再保存。', 'Please generate a titration curve before saving.'), 'ℹ');
            return;
        }
        const xShort = getDistributionXAxisShort();
        const yShort = getDistributionYAxisShort();
        const yUnit = getDistributionYAxisUnit();
        const activeKeys = visibleSpeciesKeys || new Set(lastDatasets.map(ds => ds.speciesKey));
        const keysToSave = selectedKeys && selectedKeys.size
            ? new Set(Array.from(selectedKeys).filter(k => activeKeys.has(k)))
            : activeKeys;
        if (!keysToSave.size) {
            if (typeof showAlert === 'function') showAlert(t('提示', 'Tip'), t('请至少勾选一条曲线。', 'Please select at least one curve.'), 'ℹ');
            return;
        }
        let added = 0;
        lastDatasets.forEach(ds => {
            if (!keysToSave.has(ds.speciesKey)) return;
            const useAmount = (yAxisMode === 'amount' || yAxisMode === 'amountLog') && !ds.directY;
            const data = (ds.rawData || []).map(p => ({
                x: Number(p.x),
                y: ds.directY
                    ? (Number.isFinite(p.rawY) ? p.rawY : NaN)
                    : (useAmount ? p.rawAmount : p.rawY),
                rawX: Number(p.rawX),
                rawPH: Number(p.rawPH),
                rawY: Number(p.rawY),
                rawAmount: Number(p.rawAmount)
            })).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
            if (!data.length) return;
            const dsStyle = (typeof distributionStyleMap !== 'undefined' && distributionStyleMap.get(ds.speciesKey)) || {};
            const lineStyle = Array.isArray(ds.borderDash) && ds.borderDash.length ? 'dash' : 'solid';
            const compositeDs = {
                id: 'comp-' + Date.now() + '-' + added + '-' + Math.floor(Math.random() * 100000),
                type: 'distribution',
                sourceName: ds.label || t('物种曲线', 'Species curve'),
                name: (ds.label || t('物种曲线', 'Species curve')) + '(' + yShort + '-' + xShort + ')',
                xAxisMode: xShort,
                xAxisLabel: xShort,
                yAxisLabel: yShort,
                xUnit: xShort,
                yUnit: yUnit,
                yAxisUnit: yUnit,
                color: dsStyle.color || ds.borderColor || '#0ea5e9',
                lineStyle: dsStyle.lineStyle || lineStyle,
                pointStyle: dsStyle.pointStyle || 'circle',
                borderWidth: Number.isFinite(dsStyle.borderWidth) ? dsStyle.borderWidth : (Number.isFinite(ds.borderWidth) ? ds.borderWidth : 2),
                markStyle: {
                    fillEnabled: true,
                    fillColor: dsStyle.color || ds.borderColor || '#57a7bd',
                    borderEnabled: true,
                    borderColor: '#0f172a',
                    radiusEnabled: true,
                    radius: 5,
                    borderWidthEnabled: true,
                    borderWidth: 2.8
                },
                data: data
            };
            if (typeof window.addCompositeDataset === 'function') {
                window.addCompositeDataset(compositeDs);
                added++;
            }
        });
        if (added === 0) {
            if (typeof showAlert === 'function') showAlert(t('提示', 'Tip'), t('没有可见的浓度分布曲线可保存。', 'No visible distribution curves to save.'), 'ℹ');
        }
    };
    function renderDistSaveToCompositeList() {
        const list = document.getElementById('distSaveToCompositeList');
        if (!list) return;
        const visible = getVisibleDatasets();
        if (!visible.length) {
            list.innerHTML = '<span class="component-filter-empty" data-i18n="no_curves_to_save">生成曲线后可选择要保存的曲线。</span>';
            return;
        }
        if (!distSaveCompositeSelection) distSaveCompositeSelection = new Set();
        list.innerHTML = visible.map(ds => `
            <label class="component-filter-item" title="${ds.label}">
                <input type="checkbox" data-save-species-key="${ds.speciesKey}" ${distSaveCompositeSelection.has(ds.speciesKey) ? 'checked' : ''}>
                <span class="component-filter-swatch" style="background:${ds.borderColor};"></span>
                <span class="component-filter-label">${ds.label}</span>
            </label>`).join('');
        list.querySelectorAll('[data-save-species-key]').forEach(cb => {
            cb.addEventListener('change', () => {
                if (!distSaveCompositeSelection) distSaveCompositeSelection = new Set();
                if (cb.checked) distSaveCompositeSelection.add(cb.dataset.saveSpeciesKey);
                else distSaveCompositeSelection.delete(cb.dataset.saveSpeciesKey);
            });
        });
    }
    function bindDistSaveToCompositeBtn() {
        const btn = document.getElementById('distSaveToCompositeBtn');
        if (!btn || btn.dataset.bound === '1') return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', () => {
            if (typeof window.saveDistributionToComposite === 'function') window.saveDistributionToComposite(distSaveCompositeSelection);
        });
    }
    function bindDownloadBtn() {
        const btn = document.getElementById('distDownloadBtn');
        if (!btn || btn.dataset.bound === '1') return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', () => {
            if (!distributionChartV32) {
                if (typeof showAlert === 'function') showAlert(t('提示', 'Tip'), t('请先生成滴定曲线后再下载分布图。', 'Please generate a titration curve before downloading the distribution chart.'), 'ℹ');
                return;
            }
            const formatEl = document.getElementById('distImageFormat');
            const scaleEl = document.getElementById('distImageScale');
            const format = formatEl ? formatEl.value : 'png';
            const scale = scaleEl ? parseFloat(scaleEl.value) || 1 : 2;
            const baseName = (lastTab && lastTab.title) ? lastTab.title : (lastParams && lastParams.curveName) || t('物种浓度分布', 'Species concentration distribution');
            const suffix = yAxisMode === 'log' ? '_log'
                : (yAxisMode === 'amount' ? '_amount'
                    : (yAxisMode === 'amountLog' ? '_amount_log' : ''));
            const filename = `${baseName}_distribution${suffix}.${format === 'png' ? 'png' : 'jpg'}`;
            if (typeof exportChartImage === 'function') {
                exportChartImage(distributionChartV32, format, scale, filename);
            }
        });
    }
    function ensureLastDistributionParams() {
        if (lastParams) return lastParams;
        const tab = (typeof getActiveTab === 'function') ? getActiveTab() : null;
        if (tab && tab.type === 'single' && tab.params) {
            lastTab = tab;
            lastParams = cloneCurrentParams(tab.params);
            lastDatasets = buildSpeciesDatasetsV32(tab, lastParams);
        }
        return lastParams;
    }
    function speciesChargeFromKey(speciesKey) {
        if (speciesKey === 'H') return 1;
        if (speciesKey === 'OH') return -1;
        const parts = String(speciesKey || '').split('_');
        if (parts.length !== 3) return 0;
        const source = parts[0];
        const index = Number(parts[1]);
        const speciesIndex = Number(parts[2]);
        const comps = source === 'titrant'
            ? (lastParams && lastParams.titrant && lastParams.titrant.components) || []
            : (lastParams && lastParams.solution && lastParams.solution.components) || [];
        const comp = comps[index];
        if (!comp) return 0;
        if (comp.type === 'acid') return comp.isStrong ? -1 : -speciesIndex;
        return comp.isStrong ? 1 : speciesIndex;
    }
    function enrichSpeciesCategory(species) {
        if (!species) return species;
        species.charge = speciesChargeFromKey(species.speciesKey);
        species.category = species.charge > 0 ? 'cation'
            : (species.charge < 0 ? 'anion' : 'neutral');
        return species;
    }
    window.queryDistributionAtCoordinate = function(xValue, axisMode) {
        ensureLastDistributionParams();
        const result = calculateDistributionAtCoordinate(xValue, axisMode || 'volume', lastParams);
        if (result && Array.isArray(result.speciesData)) {
            result.speciesData.forEach(enrichSpeciesCategory);
        }
        return result;
    };
    window.getDistributionSpeciesInfo = function() {
        ensureLastDistributionParams();
        if (!lastParams) return [];
        const list = [];
        const collect = (source) => {
            const comps = source === 'titrant'
                ? (lastParams.titrant && lastParams.titrant.components) || []
                : (lastParams.solution && lastParams.solution.components) || [];
            comps.forEach((component, index) => {
                speciesFractions(component, 7).forEach((fraction, speciesIndex) => {
                    list.push(enrichSpeciesCategory({
                        speciesKey: `${source}_${index}_${speciesIndex}`,
                        label: fraction.label
                    }));
                });
            });
        };
        collect('solution');
        collect('titrant');
        list.push(enrichSpeciesCategory({ speciesKey: 'H', label: 'H⁺' }));
        list.push(enrichSpeciesCategory({ speciesKey: 'OH', label: 'OH⁻' }));
        return list;
    };
})();
