function updateChart(tab, volumes, phs, color) {
    if (!tab) return;
    const pane = getTabContent(tab);
    if (!pane) return;
    const canvas = pane.querySelector('[data-role="chart-canvas"]');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const themeColors = getThemeColors();
    const chartLabels = getChartLabels();
    cancelHold();
    if (tab.chart) {
        tab.chart.destroy();
    }
    const isPaperStyle = chartStyle === 'paper';
    const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
    const natureColors = isPaperStyle ? {
        line: color,
        fill: 'transparent',
        grid: isDarkTheme ? 'rgba(255, 255, 255, 0.18)' : '#e5e5e5',
        text: isDarkTheme ? '#e5e7eb' : '#000000',
        textSecondary: isDarkTheme ? '#cbd5e1' : '#666666',
        background: isDarkTheme ? '#070b12' : '#ffffff'
    } : {
        line: color,
        fill: color + '20',
        grid: themeColors.gridColor,
        text: themeColors.textPrimary,
        textSecondary: themeColors.textSecondary,
        background: '#ffffff'
    };
    const pixelRatio = getLiveChartPixelRatio(isPaperStyle);
    const datasetPoints = volumes.map((v, idx) => ({ x: v, y: phs[idx] }));
    const xMax = Number.isFinite(tab.maxVolume)
        ? tab.maxVolume
        : (Array.isArray(volumes) && volumes.length ? volumes[volumes.length - 1] : config.maxVolume);
    const showDerivative = !!tab.showDerivative;
    let derivativePoints = [];
    let derivativeMax = 0;
    if (showDerivative && Array.isArray(volumes) && volumes.length >= 2) {
        for (let i = 1; i < volumes.length; i++) {
            const dV = volumes[i] - volumes[i - 1];
            if (!dV) continue;
            const dPH = Math.abs((phs[i] - phs[i - 1]) / dV);
            const x = (volumes[i] + volumes[i - 1]) / 2;
            derivativePoints.push({ x, y: dPH });
            if (dPH > derivativeMax) derivativeMax = dPH;
        }
    }
    const derivativeAxisMax = derivativeMax > 0 ? Math.ceil(derivativeMax * 1.1 * 100) / 100 : 1;
    const derivativeColor = tab.derivativeColor || '#f59e0b';
    const lineDash = getCurveLineDash(tab.curveLineStyle);
    const datasets = [
        {
            label: chartLabels.curveLabel,
            data: datasetPoints,
            borderColor: natureColors.line,
            backgroundColor: natureColors.fill,
            fill: !isPaperStyle,
            tension: isPaperStyle ? 0 : 0.4,
            pointRadius: tab.showRawPoints ? (isPaperStyle ? 1.5 : 2) : 0,
            pointHoverRadius: tab.showRawPoints ? (isPaperStyle ? 3 : 4) : 0,
            pointHitRadius: tab.showRawPoints ? 8 : 6,
            borderWidth: tab.curveBorderWidth ?? (isPaperStyle ? 1.5 : 2),
            borderDash: lineDash,
            borderJoinStyle: 'round',
            borderCapStyle: 'round',
            yAxisID: 'y'
        }
    ];
    if (showDerivative) {
        datasets.push({
            label: '|dpH/dV|',
            data: derivativePoints,
            borderColor: derivativeColor,
            backgroundColor: 'transparent',
            fill: false,
            tension: isPaperStyle ? 0 : 0.3,
            pointRadius: 0,
            pointHoverRadius: 0,
            pointHitRadius: 0,
            borderWidth: isPaperStyle ? 1.2 : 1.6,
            borderDash: getCurveLineDash(tab.derivativeLineStyle || 'dash'),
            borderJoinStyle: 'round',
            borderCapStyle: 'round',
            yAxisID: 'yDerivative'
        });
    }
    tab.chart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            devicePixelRatio: pixelRatio,
            animation: false,
            animations: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: tab.showLegend !== false,
                    position: 'top',
                    labels: {
                        color: natureColors.text,
                        font: { size: 12 },
                        usePointStyle: false,
                        boxWidth: 12,
                        boxHeight: 12,
                        padding: 20,
                        fillStyle: 'transparent',
                        backgroundColor: 'transparent'
                    }
                },
                tooltip: { enabled: false },
                annotation: { annotations: {} },
                axisArrow: {
                    x: !!tab.xAxisArrow,
                    y: !!tab.yAxisArrow,
                    color: tab.xAxisLineColor || natureColors.textSecondary
                }
            },
            onClick: null,
            scales: {
                x: mergeGridOptions({
                    type: 'linear',
                    min: Number.isFinite(tab.xMin) ? tab.xMin : 0,
                    max: Number.isFinite(tab.xMax) ? tab.xMax : (xMax || undefined),
                    title: {
                        display: true,
                        text: tab.xAxisLabel || chartLabels.xSingle,
                        color: natureColors.text,
                        font: { size: isPaperStyle ? 14 : 12, weight: '600' }
                    },
                    ticks: {
                        color: tab.xTickColor || natureColors.textSecondary,
                        font: { size: isPaperStyle ? 12 : 11 },
                        display: tab.xTicksVisible !== false
                    },
                    grid: {
                        color: tab.xGridColor || natureColors.grid,
                        drawBorder: true,
                        lineWidth: 1
                    },
                    border: { color: tab.xAxisLineColor || natureColors.textSecondary }
                }, tab, 'x'),
                y: mergeGridOptions({
                    title: {
                        display: true,
                        text: tab.yAxisLabel || chartLabels.y,
                        color: natureColors.text,
                        font: { size: isPaperStyle ? 14 : 12, weight: '600' }
                    },
                    min: Number.isFinite(tab.yMin) ? tab.yMin : 0,
                    max: Number.isFinite(tab.yMax) ? tab.yMax : 14,
                    ticks: {
                        color: tab.yTickColor || natureColors.textSecondary,
                        font: { size: isPaperStyle ? 12 : 11 },
                        display: tab.yTicksVisible !== false
                    },
                    grid: {
                        color: tab.yGridColor || natureColors.grid,
                        drawBorder: true,
                        lineWidth: 1
                    },
                    border: { color: tab.yAxisLineColor || natureColors.textSecondary }
                }, tab, 'y'),
                yDerivative: {
                    display: showDerivative,
                    position: 'right',
                    title: {
                        display: showDerivative,
                        text: '|dpH/dV|',
                        color: derivativeColor,
                        font: { size: isPaperStyle ? 13 : 12, weight: '600' }
                    },
                    min: 0,
                    max: derivativeAxisMax,
                    ticks: {
                        color: derivativeColor,
                        font: { size: isPaperStyle ? 12 : 11 }
                    },
                    grid: {
                        drawOnChartArea: false,
                        drawBorder: true
                    }
                }
            }
        }
    });
    refreshTabAnnotations(tab);
}
function updateMultiChart(tab) {
    if (!tab) return;
    const pane = getTabContent(tab);
    if (!pane) return;
    const canvas = pane.querySelector('[data-role="chart-canvas"]');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const themeColors = getThemeColors();
    const chartLabels = getChartLabels();
    cancelHold();
    if (tab.chart) {
        tab.chart.destroy();
    }
    const checkedCurves = [];
    const visibleIndices = Array.isArray(tab.curveSelection)
        ? tab.curveSelection.filter(index => Number.isFinite(index) && savedCurves[index])
        : [];
    visibleIndices.forEach(index => {
        if (savedCurves[index]) {
            checkedCurves.push(savedCurves[index]);
        }
    });
    const isPaperStyle = chartStyle === 'paper';
    const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
    const natureColors = isPaperStyle ? {
        grid: isDarkTheme ? 'rgba(255, 255, 255, 0.18)' : '#e5e5e5',
        text: isDarkTheme ? '#e5e7eb' : '#000000',
        textSecondary: isDarkTheme ? '#cbd5e1' : '#666666',
        background: isDarkTheme ? '#070b12' : '#ffffff'
    } : {
        grid: themeColors.gridColor,
        text: themeColors.textPrimary,
        textSecondary: themeColors.textSecondary,
        background: '#ffffff'
    };
    const pixelRatio = getLiveChartPixelRatio(isPaperStyle);
    const maxPoints = checkedCurves.reduce((max, curve) => Math.max(max, curve.volumes.length), 0);
    const xMax = checkedCurves.reduce((max, curve) => {
        const curveMax = Number.isFinite(curve.params?.maxVolume)
            ? curve.params.maxVolume
            : (Array.isArray(curve.volumes) && curve.volumes.length ? curve.volumes[curve.volumes.length - 1] : 0);
        return Math.max(max, curveMax || 0);
    }, 0);
    const datasets = checkedCurves.map((curve, idx) => {
        const lineStyle = curve.lineStyle || curve.params?.curveLineStyle || 'solid';
        const pointStyle = curve.pointStyle || curve.params?.curvePointStyle || 'circle';
        const markStyle = getCurveMarkStyleConfig(curve);
        const savedIndex = visibleIndices[idx];
        return {
            label: curve.name,
            data: resampleCurve(curve.volumes, curve.phs, maxPoints),
            borderColor: curve.color,
            backgroundColor: 'transparent',
            fill: false,
            tension: isPaperStyle ? 0 : 0.4,
            pointRadius: tab.showRawPoints ? (isPaperStyle ? 1.5 : 2) : 0,
            pointHoverRadius: tab.showRawPoints ? (isPaperStyle ? 3 : 4) : 0,
            pointHitRadius: tab.showRawPoints ? 8 : 6,
            borderWidth: curve.borderWidth ?? (isPaperStyle ? 1.5 : 2),
            borderDash: getCurveLineDash(lineStyle),
            borderJoinStyle: 'round',
            borderCapStyle: 'round',
            savedCurveIndex: savedIndex,
            savedLineStyle: lineStyle,
            savedPointStyle: pointStyle,
            savedMarkStyle: markStyle
        };
    });
    tab.chart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            devicePixelRatio: pixelRatio,
            animation: false,
            animations: false,
            plugins: {
                legend: {
                    display: tab.showLegend !== false,
                    position: 'top',
                    labels: {
                        color: natureColors.text,
                        usePointStyle: false,
                        boxWidth: 12,
                        boxHeight: 12,
                        font: { size: isPaperStyle ? 12 : 11 },
                        fillStyle: 'transparent',
                        backgroundColor: 'transparent'
                    }
                },
                tooltip: { enabled: false },
                annotation: { annotations: {} },
                axisArrow: {
                    x: !!tab.xAxisArrow,
                    y: !!tab.yAxisArrow,
                    color: tab.xAxisLineColor || natureColors.textSecondary
                }
            },
            onClick: null,
            scales: {
                x: mergeGridOptions({
                    type: 'linear',
                    min: Number.isFinite(tab.xMin) ? tab.xMin : 0,
                    max: Number.isFinite(tab.xMax) ? tab.xMax : (xMax || undefined),
                    title: {
                        display: true,
                        text: tab.xAxisLabel || chartLabels.xMulti,
                        color: natureColors.text,
                        font: { size: isPaperStyle ? 14 : 12, weight: '600' }
                    },
                    ticks: { color: tab.xTickColor || natureColors.textSecondary, font: { size: isPaperStyle ? 12 : 11 }, display: tab.xTicksVisible !== false },
                    grid: { color: tab.xGridColor || natureColors.grid, drawBorder: true },
                    border: { color: tab.xAxisLineColor || natureColors.textSecondary }
                }, tab, 'x'),
                y: mergeGridOptions({
                    title: {
                        display: true,
                        text: tab.yAxisLabel || chartLabels.y,
                        color: natureColors.text,
                        font: { size: isPaperStyle ? 14 : 12, weight: '600' }
                    },
                    min: Number.isFinite(tab.yMin) ? tab.yMin : 0,
                    max: Number.isFinite(tab.yMax) ? tab.yMax : 14,
                    ticks: { color: tab.yTickColor || natureColors.textSecondary, font: { size: isPaperStyle ? 12 : 11 }, display: tab.yTicksVisible !== false },
                    grid: { color: tab.yGridColor || natureColors.grid, drawBorder: true },
                    border: { color: tab.yAxisLineColor || natureColors.textSecondary }
                }, tab, 'y')
            }
        }
    });
    refreshTabAnnotations(tab);
    updateIntersectionPanel(tab);
}
