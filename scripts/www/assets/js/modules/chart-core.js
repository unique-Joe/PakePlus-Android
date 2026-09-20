function getThemeColors() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    return {
        textPrimary: isLight ? '#172033' : '#dce4ef',
        textSecondary: isLight ? 'rgba(55, 65, 81, 0.70)' : 'rgba(188, 199, 214, 0.70)',
        gridColor: isLight ? 'rgba(100, 116, 139, 0.15)' : 'rgba(148, 163, 184, 0.13)'
    };
}
function getGridDisplayConfig(target, axis, borderColor) {
    const enabled = target?.gridEnabled !== false;
    const step = axis === 'x' ? target?.gridXStep : target?.gridYStep;
    const ticksVisible = axis === 'x'
        ? target?.xTicksVisible !== false
        : target?.yTicksVisible !== false;
    if (enabled) {
        return {
            grid: {},
            ticks: Number.isFinite(step) && step > 0 ? { stepSize: step } : {}
        };
    }
    // 网格关闭时：隐藏网格线；若刻度开关开启则保留刻度线（tickColor=坐标轴颜色），否则隐藏刻度线
    return {
        grid: { color: 'transparent', tickColor: ticksVisible ? (borderColor || '#666') : 'transparent' },
        ticks: Number.isFinite(step) && step > 0 ? { stepSize: step } : {}
    };
}
function mergeGridOptions(baseScale, target, axis) {
    const borderColor = baseScale?.border?.color || '#666';
    const gridCfg = getGridDisplayConfig(target, axis, borderColor);
    return {
        ...baseScale,
        ticks: { ...(baseScale.ticks || {}), ...gridCfg.ticks },
        grid: { ...(baseScale.grid || {}), ...gridCfg.grid }
    };
}
function getChartLabels() {
    const isAcidTitratingBase = config.titrationType === 'acid-base';
    const xSingle = isAcidTitratingBase
        ? t('加入酸体积 (mL)', 'Volume of acid added (mL)')
        : t('加入碱体积 (mL)', 'Volume of base added (mL)');
    return {
        xSingle,
        xMulti: t('体积 (mL)', 'Volume (mL)'),
        y: 'pH',
        curveLabel: t('滴定曲线', 'Titration curve')
    };
}
function isMobilePerformanceMode() {
    return window.matchMedia('(max-width: 900px)').matches ||
        (window.matchMedia('(hover: none)').matches && window.matchMedia('(pointer: coarse)').matches);
}
function getLiveChartPixelRatio(isPaperStyle) {
    const dpr = window.devicePixelRatio || 1;
    if (isMobilePerformanceMode()) {
        return Math.max(dpr, 2);
    }
    return Math.max(dpr, isPaperStyle ? 3 : 2);
}
function getCurveLineDash(style) {
    switch (style) {
        case 'dash': return [6, 4];
        case 'longDash': return [12, 6];
        case 'dot': return [2, 4];
        case 'dashDot': return [10, 4, 2, 4];
        case 'denseDash': return [4, 3];
        default: return [];
    }
}
function getMarkPointStyle(style) {
    return style && style !== 'none' ? style : 'circle';
}
function getMarkPointRadius(style, isPaperStyle) {
    if (style === 'none') return 0;
    if (['star', 'cross', 'crossRot'].includes(style)) return isPaperStyle ? 5.2 : 6;
    if (['triangle', 'rectRot'].includes(style)) return isPaperStyle ? 4.8 : 5.4;
    return isPaperStyle ? 4.4 : 5;
}
function getNatureColor(index) {
    const colors = ['#000000', '#e31a1c', '#1f78b4', '#33a02c', '#ff7f00', '#6a3d9a', '#b15928'];
    return colors[index % colors.length];
}
function normalizeDatasetPoint(chart, dataset, index) {
    const point = dataset.data[index];
    if (point && typeof point === 'object') {
        return { volume: point.x, ph: point.y };
    }
    const label = chart.data.labels ? chart.data.labels[index] : null;
    if (label === null || label === undefined) return null;
    return { volume: parseFloat(label), ph: point };
}
function getDatasetPoints(chart, dataset) {
    if (!dataset || !Array.isArray(dataset.data)) return [];
    if (dataset.data.length === 0) return [];
    if (dataset.data[0] && typeof dataset.data[0] === 'object') {
        return dataset.data.map(item => ({ x: item.x, y: item.y }));
    }
    if (!chart.data.labels) return [];
    return dataset.data.map((value, index) => ({ x: parseFloat(chart.data.labels[index]), y: value }));
}
function interpolatePoint(points, volume) {
    if (!points || points.length < 2) return null;
    let leftIndex = -1;
    for (let i = 1; i < points.length; i++) {
        if (volume <= points[i].x) {
            leftIndex = i - 1;
            break;
        }
    }
    if (leftIndex < 0) return null;
    const p0 = points[leftIndex];
    const p1 = points[leftIndex + 1];
    const range = p1.x - p0.x;
    if (range === 0) return { volume, ph: p0.y, index: leftIndex };
    const t = (volume - p0.x) / range;
    const ph = p0.y + (p1.y - p0.y) * t;
    return { volume, ph, index: leftIndex };
}
function resampleCurve(volumes, phs, targetCount) {
    if (!Array.isArray(volumes) || !Array.isArray(phs)) return [];
    if (volumes.length < 2 || phs.length < 2) {
        return volumes.map((v, i) => ({ x: v, y: phs[i] }));
    }
    const count = Math.max(2, targetCount || volumes.length);
    const minV = volumes[0];
    const maxV = volumes[volumes.length - 1];
    if (minV === maxV) {
        return volumes.map((v, i) => ({ x: v, y: phs[i] }));
    }
    const step = (maxV - minV) / (count - 1);
    const points = volumes.map((v, i) => ({ x: v, y: phs[i] }));
    const resampled = [];
    for (let i = 0; i < count; i++) {
        const targetV = minV + step * i;
        const interpolated = interpolatePoint(points, targetV);
        if (interpolated) {
            resampled.push({ x: targetV, y: interpolated.ph });
        }
    }
    return resampled;
}
function normalizeHexColor(color) {
    if (typeof color !== 'string') return null;
    const raw = color.trim();
    if (!raw.startsWith('#')) return null;
    const hex = raw.slice(1);
    if (hex.length === 3) return hex.split('').map(ch => ch + ch).join('');
    if (hex.length >= 6) return hex.slice(0, 6);
    return null;
}
function getRelativeLuminance(color) {
    const hex = normalizeHexColor(color);
    if (!hex) return 0.35;
    const channels = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => {
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
function darkenHexColor(color, amount = 0.34) {
    const hex = normalizeHexColor(color);
    if (!hex) return '#1d4ed8';
    const values = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
    return '#' + values.map(v => {
        const next = Math.max(0, Math.round(v * (1 - amount)));
        return next.toString(16).padStart(2, '0');
    }).join('');
}
function lightenHexColor(color, amount = 0.28) {
    const hex = normalizeHexColor(color);
    if (!hex) return '#93c5fd';
    const values = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
    return '#' + values.map(v => {
        const next = Math.min(255, Math.round(v + (255 - v) * amount));
        return next.toString(16).padStart(2, '0');
    }).join('');
}
function formatSignificant(value, digits = 2) {
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    const abs = Math.abs(n);
    if (abs === 0) return '0';
    if (abs >= 1e-4 && abs < 1e4) {
        return parseFloat(n.toPrecision(digits)).toString();
    }
    return n.toExponential(digits - 1);
}
function getReadableAccentColor(color, options = {}) {
    const isLightTheme = document.documentElement.getAttribute('data-theme') === 'light';
    const target = options.target || (isLightTheme ? 'light' : 'dark');
    const luminance = getRelativeLuminance(color);
    if (target === 'light' && luminance > 0.46) return darkenHexColor(color, luminance > 0.72 ? 0.56 : 0.42);
    if (target === 'dark' && luminance < 0.28) return lightenHexColor(color, 0.34);
    return normalizeHexColor(color) ? color : '#2563eb';
}
function getTextColorForFill(fillColor) {
    return getRelativeLuminance(fillColor) > 0.42 ? '#0f172a' : '#ffffff';
}
function getAnnotationPalette(color, purpose = 'range') {
    const isLightTheme = document.documentElement.getAttribute('data-theme') === 'light';
    const isPaperStyle = chartStyle === 'paper';
    const target = (isLightTheme || isPaperStyle) ? 'light' : 'dark';
    const accent = getReadableAccentColor(color, { target });
    // v6.5: force leap/indicator/overlap label text color by theme only.
    //       Dark theme → white text; Light theme → black text.
    //       Both standard and paper chart styles obey this rule.
    const text = isLightTheme ? '#000000' : '#ffffff';
    const labelBackground = isLightTheme
        ? lightenHexColor(accent, getRelativeLuminance(accent) < 0.45 ? 0.62 : 0.48)
        : darkenHexColor(accent, getRelativeLuminance(accent) > 0.45 ? 0.58 : 0.40);
    const labelAlpha = isLightTheme ? 0.92 : 0.94;
    const alpha = purpose === 'overlap' ? 0.18 : (purpose === 'indicator' ? 0.13 : 0.10);
    return {
        accent,
        background: hexToRgba(accent, alpha),
        border: hexToRgba(accent, purpose === 'range' ? 0.72 : 0.86),
        labelBackground: hexToRgba(labelBackground, labelAlpha),
        text
    };
}
function getContrastMarkColors(pointColor, isPaperStyle, isDarkTheme) {
    if (isPaperStyle) {
        if (!isDarkTheme) {
            const accent = getReadableAccentColor(pointColor, { target: 'light' });
            return {
                fill: `${accent}ff`,
                border: '#0f172a'
            };
        }
        return {
            fill: '#f8fafc',
            border: '#070b12'
        };
    }
    const isLightTheme = document.documentElement.getAttribute('data-theme') === 'light';
    const luminance = getRelativeLuminance(pointColor);
    if (!isLightTheme) {
        return { fill: `${pointColor}ff`, border: '#ffffff' };
    }
    const fill = getReadableAccentColor(pointColor, { target: 'light' });
    const fillLum = getRelativeLuminance(fill);
    return {
        fill: `${fill}ff`,
        border: fillLum < 0.30 ? '#ffffff' : '#0f172a'
    };
}
function hexToRgba(hex, alpha) {
    if (typeof hex !== 'string' || !hex.startsWith('#')) return hex;
    const raw = hex.replace('#', '').trim();
    const full = raw.length === 3
        ? raw.split('').map(ch => ch + ch).join('')
        : raw.slice(0, 6);
    const value = parseInt(full, 16);
    if (!Number.isFinite(value)) return hex;
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
function getChartBackgroundColor() {
    const theme = document.documentElement.getAttribute('data-theme');
    return theme === 'dark' ? '#070b12' : '#ffffff';
}
function hexToRGBTuple(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return [88, 166, 255];
    return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}
function copyText(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
}
if (typeof Chart !== 'undefined' && Chart.register) {
    // 自定义全局插件已移除
}
