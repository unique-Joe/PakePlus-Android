function exportChartImage(chart, format, scale, filename) {
    if (!chart) return;
    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
    const baseRatio = chart.options.devicePixelRatio || window.devicePixelRatio || 1;
    const targetRatio = Math.max(baseRatio * scale, 1);
    chart.options.devicePixelRatio = targetRatio;
    chart.resize();
    chart.update('none');
    const canvas = chart.canvas;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.fillStyle = getChartBackgroundColor();
    tempCtx.fillRect(0, 0, canvas.width, canvas.height);
    tempCtx.drawImage(canvas, 0, 0);
    function triggerDownload(url) {
        const link = document.createElement('a');
        link.download = filename;
        link.href = url;
        link.rel = 'noopener';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
            if (link.parentNode) link.parentNode.removeChild(link);
        }, 0);
    }
    if (tempCanvas.toBlob) {
        tempCanvas.toBlob((blob) => {
            if (!blob) {
                const dataUrl = tempCanvas.toDataURL(mimeType, 1.0);
                triggerDownload(dataUrl);
                return;
            }
            const objectUrl = URL.createObjectURL(blob);
            triggerDownload(objectUrl);
            setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
        }, mimeType, 1.0);
    } else {
        const dataUrl = tempCanvas.toDataURL(mimeType, 1.0);
        triggerDownload(dataUrl);
    }
    chart.options.devicePixelRatio = baseRatio;
    chart.resize();
    chart.update('none');
}
function snapshotParamsFromConfig(cfg) {
    return {
        titrationType: cfg.titrationType,
        solution: JSON.parse(JSON.stringify(cfg.solution)),
        titrant: JSON.parse(JSON.stringify(cfg.titrant)),
        maxVolume: cfg.maxVolume,
        sampleCount: cfg.sampleCount,
        curveColor: cfg.curveColor,
        curveName: cfg.curveName,
        curveLineStyle: cfg.curveLineStyle || 'solid',
        curvePointStyle: cfg.curvePointStyle || 'circle',
        markFillEnabled: !!cfg.markFillEnabled,
        markFillColor: cfg.markFillColor || '#57a7bd',
        markBorderEnabled: !!cfg.markBorderEnabled,
        markBorderColor: cfg.markBorderColor || '#0f172a',
        markRadiusEnabled: !!cfg.markRadiusEnabled,
        markRadius: Number.isFinite(cfg.markRadius) ? cfg.markRadius : 5,
        markBorderWidthEnabled: !!cfg.markBorderWidthEnabled,
        markBorderWidth: Number.isFinite(cfg.markBorderWidth) ? cfg.markBorderWidth : 2.8
    };
}
function buildMathematicaMarks(tab, curveName, colorStr) {
    if (!tab) return '';
    const items = [];
    const pushPoint = (point) => {
        if (!point || !Number.isFinite(point.volume) || !Number.isFinite(point.ph)) return;
        const nameMatch = curveName ? point.curveName === curveName : true;
        if (!nameMatch) return;
        const key = `${point.datasetIndex ?? 's'}-${point.volume.toFixed(3)}`;
        if (items.find(item => item.key === key)) return;
        items.push({
            key,
            volume: point.volume,
            ph: point.ph,
            label: `(${point.volume.toFixed(2)}, ${point.ph.toFixed(2)})`
        });
    };
    if (Array.isArray(tab.fixedMarks)) {
        tab.fixedMarks.forEach(mark => pushPoint(mark));
    }
    if (tab.selectedPoint) {
        pushPoint(tab.selectedPoint);
    }
    if (items.length === 0) return '';
    const points = items.map(item => `{${item.volume.toFixed(4)}, ${item.ph.toFixed(4)}}`).join(', ');
    const labels = items.map(item => `Text[Style["${item.label}", 11, ${colorStr}], {${item.volume.toFixed(4)}, ${item.ph.toFixed(4)}}, {1, -1}]`).join(', ');
    return `Epilog -> {${colorStr}, PointSize[0.015], Point[{${points}}], ${labels}}`;
}
function buildMathematicaMarksForCurves(tab, curves) {
    if (!tab || !Array.isArray(curves) || curves.length === 0) return '';
    const epilogParts = [];
    curves.forEach((curve, idx) => {
        const items = [];
        const pushPoint = (point) => {
            if (!point || !Number.isFinite(point.volume) || !Number.isFinite(point.ph)) return;
            const nameMatch = point.curveName === curve.name;
            if (!nameMatch) return;
            const key = `${point.datasetIndex ?? 's'}-${point.volume.toFixed(3)}`;
            if (items.find(item => item.key === key)) return;
            items.push({
                key,
                volume: point.volume,
                ph: point.ph,
                label: `(${point.volume.toFixed(2)}, ${point.ph.toFixed(2)})`
            });
        };
        if (Array.isArray(tab.fixedMarks)) {
            tab.fixedMarks.forEach(mark => pushPoint(mark));
        }
        if (tab.selectedPoint && tab.selectedPoint.curveName === curve.name) {
            pushPoint(tab.selectedPoint);
        }
        if (items.length > 0) {
            const rgb = hexToRGBTuple(curve.color || curve.params?.curveColor || '#57a7bd');
            const colorStr = `RGBColor[${(rgb[0] / 255).toFixed(3)}, ${(rgb[1] / 255).toFixed(3)}, ${(rgb[2] / 255).toFixed(3)}]`;
            const points = items.map(item => `{${item.volume.toFixed(4)}, ${item.ph.toFixed(4)}}`).join(', ');
            const labels = items.map(item => `Text[Style["${item.label}", 11, ${colorStr}], {${item.volume.toFixed(4)}, ${item.ph.toFixed(4)}}, {1, -1}]`).join(', ');
            epilogParts.push(`${colorStr}, PointSize[0.015], Point[{${points}}], ${labels}`);
        }
    });
    if (epilogParts.length === 0) return '';
    return `Epilog -> {${epilogParts.join(', ')}}`;
}
function buildMathematicaCodeFromCurve(curve, tab) {
    if (curve.params) {
        const cfg = Object.assign({}, curve.params, { curveColor: curve.color || curve.params.curveColor });
        return buildMathematicaCodeFromConfig(cfg, tab, curve.name);
    }
    const rgb = hexToRGBTuple(curve.color || '#57a7bd');
    const maxV = curve.volumes.length ? curve.volumes[curve.volumes.length - 1] : (config.maxVolume || 100);
    const pts = curve.volumes.map((v, i) => `{${v.toFixed(4)}, ${curve.phs[i].toFixed(4)}}`).join(', ');
    const colorStr = `RGBColor[${(rgb[0]/255).toFixed(3)}, ${(rgb[1]/255).toFixed(3)}, ${(rgb[2]/255).toFixed(3)}]`;
    const epilog = buildMathematicaMarks(tab, curve.name, colorStr);
    return `Module[{data, color},
  data = {${pts}};
  color = ${colorStr};
  ListLinePlot[data,
    PlotRange -> {{0, ${maxV.toFixed(4)}}, {0, 14}},
    PlotStyle -> Directive[color, Thick],
    AxesLabel -> {"V (mL)", "pH"},
    ImageSize -> Large,
    GridLines -> Automatic,
    GridLinesStyle -> Directive[GrayLevel[0.8, 0.3]]${epilog ? `,\n    ${epilog}` : ''}
  ]
]`;
}
function buildMathematicaCodeFromCurves(curves, tab) {
    const validCurves = Array.isArray(curves) ? curves.filter(curve => curve && curve.params) : [];
    if (!validCurves.length) return '';
    const safeName = (name) => (name || t('曲线', 'Curve')).replace(/"/g, '\\"');
    const dataDefs = validCurves.map((curve, idx) => {
        const localMax = Number.isFinite(curve.params.maxVolume) ? curve.params.maxVolume : (config.maxVolume || 0);
        const sampleCount = Number.isFinite(curve.params.sampleCount) ? curve.params.sampleCount : config.sampleCount;
        const step = sampleCount ? localMax / sampleCount : (localMax / 100);
        const solveBlock = buildMathematicaSolveBlock(curve.params);
        return `data${idx + 1} = Table[{V, ${solveBlock}}, {V, 0, ${localMax}, ${step}}]`;
    });
    const colorDefs = validCurves.map((curve, idx) => {
        const rgb = hexToRGBTuple(curve.color || curve.params.curveColor || '#57a7bd');
        return `color${idx + 1} = RGBColor[${(rgb[0] / 255).toFixed(3)}, ${(rgb[1] / 255).toFixed(3)}, ${(rgb[2] / 255).toFixed(3)}]`;
    });
    const dataList = validCurves.map((_, idx) => `data${idx + 1}`).join(', ');
    const colorList = validCurves.map((_, idx) => `color${idx + 1}`).join(', ');
    const legends = validCurves.map(curve => `"${safeName(curve.name)}"`).join(', ');
    const xMaxExpr = validCurves.length
        ? `Max@Flatten@{${validCurves.map((_, idx) => `data${idx + 1}[[All, 1]]`).join(', ')}}`
        : `Max@Flatten@{}`;
    const epilog = buildMathematicaMarksForCurves(tab, validCurves);
    return `Module[{${validCurves.map((_, idx) => `data${idx + 1}`).join(', ')}, ${validCurves.map((_, idx) => `color${idx + 1}`).join(', ')}, xMax},
  ${dataDefs.join(';\n  ')};
  ${colorDefs.join(';\n  ')};
  xMax = ${xMaxExpr};
  ListLinePlot[{${dataList}},
    PlotRange -> {{0, xMax}, {0, 14}},
    PlotStyle -> ${validCurves.length ? `{${validCurves.map((_, idx) => `Directive[color${idx + 1}, Thick]`).join(', ')}}` : `{Thick}`},
    AxesLabel -> {"V (mL)", "pH"},
    ImageSize -> Large,
    GridLines -> Automatic,
    GridLinesStyle -> Directive[GrayLevel[0.8, 0.3]],
    PlotLegends -> {${legends}}${epilog ? `,\n    ${epilog}` : ''}
  ]
]`;
}
function buildMathematicaEquation(cfg) {
    function formatK(list) { return `{${list.map(pk => `10^-(${pk})`).join(', ')}}`; }
    const V0 = cfg.solution.V0;
    const solAcids = cfg.solution.components.filter(c => c.type === 'acid');
    const solBases = cfg.solution.components.filter(c => c.type === 'base');
    const titAcids = cfg.titrant.components.filter(c => c.type === 'acid');
    const titBases = cfg.titrant.components.filter(c => c.type === 'base');
    const isAcidTitratingBase = cfg.titrationType === 'acid-base';
    const buildBaseTerm = (c, factor) => `(${factor}) * With[{Kb=${formatK(c.kValues || [])}, n=${c.kValues ? c.kValues.length : 0}}, If[n==0, ${c.valence || 1}, (Sum[i*Times@@Kb[[;;i]]*10^((pH-14)*(n-i)), {i,1,n}])/(10^((pH-14)*n)+Sum[Times@@Kb[[;;t]]*10^((pH-14)*(n-t)), {t,1,n}])]]`;
    const buildAcidTerm = (c, factor) => `(${factor}) * With[{Ka=${formatK(c.kValues || [])}, m=${c.kValues ? c.kValues.length : 0}}, If[m==0, ${c.valence || 1}, (Sum[j*Times@@Ka[[;;j]]*10^(-pH*(m-j)), {j,1,m}])/(10^(-pH*m)+Sum[Times@@Ka[[;;t]]*10^(-pH*(m-t)), {t,1,m}])]]`;
    let leftTerms, rightTerms;
    if (isAcidTitratingBase) {
        leftTerms = [
            `10^-pH`,
            ...solBases.map(c => buildBaseTerm(c, `${c.c}*${V0}/(V+${V0})`)),
            ...titBases.map(c => buildBaseTerm(c, `${c.c}*V/(V+${V0})`))
        ];
        rightTerms = [
            `10^(pH-14)`,
            ...solAcids.map(c => buildAcidTerm(c, `${c.c}*${V0}/(V+${V0})`)),
            ...titAcids.map(c => buildAcidTerm(c, `${c.c}*V/(V+${V0})`))
        ];
    } else {
        leftTerms = [
            `10^-pH`,
            ...titBases.map(c => buildBaseTerm(c, `${c.c}*V/(V+${V0})`)),
            ...solBases.map(c => buildBaseTerm(c, `${c.c}*${V0}/(V+${V0})`))
        ];
        rightTerms = [
            `10^(pH-14)`,
            ...solAcids.map(c => buildAcidTerm(c, `${c.c}*${V0}/(V+${V0})`)),
            ...titAcids.map(c => buildAcidTerm(c, `${c.c}*V/(V+${V0})`))
        ];
    }
    return `${leftTerms.join(" + ")} == ${rightTerms.join(" + ")}`;
}
function buildLatexEquation(cfg) {
    const V0 = cfg.solution.V0;
    const solAcids = cfg.solution.components.filter(c => c.type === 'acid');
    const solBases = cfg.solution.components.filter(c => c.type === 'base');
    const titAcids = cfg.titrant.components.filter(c => c.type === 'acid');
    const titBases = cfg.titrant.components.filter(c => c.type === 'base');
    const buildBaseTerm = (c, factor, label) => {
        const n = c.kValues ? c.kValues.length : 0;
        if (n === 0) {
            return factor + ' \\cdot z_{' + label + '}';
        }
        const numerator = [];
        const denominator = [];
        for (let i = 0; i <= n; i++) {
            const kProduct = i === 0 ? '1' : c.kValues.slice(0, i).map((pk, idx) => 'K_{' + label + ',' + (idx + 1) + '}').join(' \\cdot ');
            const phTerm = i === n ? '1' : '10^{(pH-14) \\cdot ' + (n - i) + '}';
            const term = kProduct + ' \\cdot ' + phTerm;
            denominator.push(term);
            if (i > 0) {
                numerator.push(i + ' \\cdot ' + term);
            }
        }
        return factor + ' \\cdot \\frac{' + numerator.join('+') + '}{' + denominator.join('+') + '}';
    };
    const buildAcidTerm = (c, factor, label) => {
        const m = c.kValues ? c.kValues.length : 0;
        if (m === 0) {
            return factor + ' \\cdot z_{' + label + '}';
        }
        const numerator = [];
        const denominator = [];
        for (let j = 0; j <= m; j++) {
            const kProduct = j === 0 ? '1' : c.kValues.slice(0, j).map((pk, idx) => 'K_{' + label + ',' + (idx + 1) + '}').join(' \\cdot ');
            const phTerm = j === m ? '1' : '10^{-pH \\cdot ' + (m - j) + '}';
            const term = kProduct + ' \\cdot ' + phTerm;
            denominator.push(term);
            if (j > 0) {
                numerator.push(j + ' \\cdot ' + term);
            }
        }
        return factor + ' \\cdot \\frac{' + numerator.join('+') + '}{' + denominator.join('+') + '}';
    };
    const leftTerms = [
        '[H^+] = 10^{-pH}',
        ...solBases.map(c => {
            const label = c.name || 'B';
            return buildBaseTerm(c, '\\frac{c_{' + label + '} \\cdot V_0}{V + V_0}', label);
        }),
        ...titBases.map(c => {
            const label = c.name || 'B';
            return buildBaseTerm(c, '\\frac{c_{' + label + '} \\cdot V}{V + V_0}', label);
        })
    ];
    const rightTerms = [
        '[OH^-] = 10^{pH-14}',
        ...solAcids.map(c => {
            const label = c.name || 'A';
            return buildAcidTerm(c, '\\frac{c_{' + label + '} \\cdot V_0}{V + V_0}', label);
        }),
        ...titAcids.map(c => {
            const label = c.name || 'A';
            return buildAcidTerm(c, '\\frac{c_{' + label + '} \\cdot V}{V + V_0}', label);
        })
    ];
    return {
        left: leftTerms,
        right: rightTerms,
        full: leftTerms.join(' + ') + ' = ' + rightTerms.join(' + '),
        components: {
            solAcids,
            solBases,
            titAcids,
            titBases
        }
    };
}
function generateEquationHTML(equationData) {
    const { left, right, components } = equationData;
    const V0 = config.solution.V0;
    let html = '<div class="equation-title" data-i18n="titration_equation">滴定方程</div>';
    html += '<div class="equation-item">';
    html += '<div class="equation-label" data-i18n="full_equation">完整方程</div>';
    html += '<div class="equation-content">';
    html += '<p><strong data-i18n="left_side_basic">左侧(碱性):</strong></p>';
    html += '<div class="equation-scroll"><span>\\[' + left.join(' + ') + '\\]</span></div>';
    html += '<p><strong data-i18n="right_side_acidic">右侧(酸性):</strong></p>';
    html += '<div class="equation-scroll"><span>\\[' + right.join(' + ') + '\\]</span></div>';
    html += '<p><strong data-i18n="equation_label">等式:</strong></p>';
    html += '<div class="equation-scroll"><span>\\[' + left.join(' + ') + ' = ' + right.join(' + ') + '\\]</span></div>';
    html += '</div></div>';
    html += '<div class="equation-item">';
    html += '<div class="equation-label" data-i18n="notation">符号说明</div>';
    html += '<div class="equation-content">';
    html += '<ul>';
    html += '<li><strong>V</strong>: <span data-i18n="eq_v">滴定剂体积 (mL)</span></li>';
    html += '<li><strong>V₀</strong>: <span data-i18n="eq_v0">待测液初始体积</span> = ' + V0 + ' mL</li>';
    html += '<li><strong>pH</strong>: <span data-i18n="eq_ph">溶液的pH值</span></li>';
    html += '<li><strong>c<sub>X</sub></strong>: <span data-i18n="eq_cx">组分X的浓度 (mol/L)</span></li>';
    html += '<li><strong>z<sub>X</sub></strong>: <span data-i18n="eq_zx">组分X的电荷数（酸为可解离质子数，碱为可接受质子数）</span></li>';
    html += '<li><strong>K<sub>X,i</sub></strong>: <span data-i18n="eq_kxi">组分X的第i级电离常数（酸为Ka，碱为Kb）</span></li>';
    html += '</ul></div></div>';
    if (components.solAcids.length > 0 || components.solBases.length > 0) {
        html += '<div class="equation-item">';
        html += '<div class="equation-label" data-i18n="solution_components">待测液组分</div>';
        html += '<div class="equation-content">';
        html += '<ul>';
        components.solAcids.forEach(c => {
            const label = c.name || 'A';
            const kStr = c.kValues && c.kValues.length > 0
                ? c.kValues.map((k, i) => 'K<sub>' + label + ',' + (i+1) + '</sub> = ' + k).join(', ')
                : t('强酸', 'Strong acid');
            html += '<li><strong>' + label + '</strong>: ' + kStr + ', c<sub>' + label + '</sub> = ' + c.c + ' mol/L, z<sub>' + label + '</sub> = ' + (c.valence || 1) + '</li>';
        });
        components.solBases.forEach(c => {
            const label = c.name || 'B';
            const kStr = c.kValues && c.kValues.length > 0
                ? c.kValues.map((k, i) => 'K<sub>' + label + ',' + (i+1) + '</sub> = ' + k).join(', ')
                : t('强碱', 'Strong base');
            html += '<li><strong>' + label + '</strong>: ' + kStr + ', c<sub>' + label + '</sub> = ' + c.c + ' mol/L, z<sub>' + label + '</sub> = ' + (c.valence || 1) + '</li>';
        });
        html += '</ul></div></div>';
    }
    if (components.titAcids.length > 0 || components.titBases.length > 0) {
        html += '<div class="equation-item">';
        html += '<div class="equation-label" data-i18n="titrant_components">滴定剂组分</div>';
        html += '<div class="equation-content">';
        html += '<ul>';
        components.titAcids.forEach(c => {
            const label = c.name || 'A';
            const kStr = c.kValues && c.kValues.length > 0
                ? c.kValues.map((k, i) => 'K<sub>' + label + ',' + (i+1) + '</sub> = ' + k).join(', ')
                : t('强酸', 'Strong acid');
            html += '<li><strong>' + label + '</strong>: ' + kStr + ', c<sub>' + label + '</sub> = ' + c.c + ' mol/L, z<sub>' + label + '</sub> = ' + (c.valence || 1) + '</li>';
        });
        components.titBases.forEach(c => {
            const label = c.name || 'B';
            const kStr = c.kValues && c.kValues.length > 0
                ? c.kValues.map((k, i) => 'K<sub>' + label + ',' + (i+1) + '</sub> = ' + k).join(', ')
                : t('强碱', 'Strong base');
            html += '<li><strong>' + label + '</strong>: ' + kStr + ', c<sub>' + label + '</sub> = ' + c.c + ' mol/L, z<sub>' + label + '</sub> = ' + (c.valence || 1) + '</li>';
        });
        html += '</ul></div></div>';
    }
    html += '<div class="equation-item">';
    html += '<div class="equation-label" data-i18n="equation_notes">方程说明</div>';
    html += '<div class="equation-content">';
    html += '<p data-i18n="equation_charge_conservation">该方程基于电荷守恒原理建立，表示溶液中所有阳离子浓度之和等于所有阴离子浓度之和。</p>';
    html += '<p data-i18n="equation_terms">方程中的各项分别代表:</p>';
    html += '<ul>';
    html += '<li><strong>[H⁺] = 10<sup>-pH</sup></strong>: <span data-i18n="eq_h_concentration">H⁺离子浓度</span></li>';
    html += '<li><strong>[OH⁻] = 10<sup>pH-14</sup></strong>: <span data-i18n="eq_oh_concentration">OH⁻离子浓度</span></li>';
    html += '<li><strong data-i18n="acid_terms">酸项</strong>: <span data-i18n="acid_terms_desc">各酸组分的解离程度贡献，包含各级质子解离</span></li>';
    html += '<li><strong data-i18n="base_terms">碱项</strong>: <span data-i18n="base_terms_desc">各碱组分的质子化程度贡献，包含各级质子结合</span></li>';
    html += '</ul></div></div>';
    return html;
}
function buildMathematicaSolveBlock(cfg) {
    const eqn = buildMathematicaEquation(cfg);
    const pH0 = estimateInitialPH(cfg).toFixed(2);
    return `Module[{eqn = ${eqn}}, Clip[Quiet@Check[pH /. FindRoot[eqn, {pH, ${pH0}}, AccuracyGoal -> 8, PrecisionGoal -> 8, MaxIterations -> 100], 7], {0, 14}]]`;
}
function buildMathematicaCodeFromConfig(cfg, tab, curveName = null) {
    const V0 = cfg.solution.V0;
    const maxV = cfg.maxVolume;
    const rgb = hexToRGBTuple(cfg.curveColor || '#57a7bd');
    const solveBlock = buildMathematicaSolveBlock(cfg);
    const rgbStr = `RGBColor[${(rgb[0]/255).toFixed(3)}, ${(rgb[1]/255).toFixed(3)}, ${(rgb[2]/255).toFixed(3)}]`;
    const epilog = buildMathematicaMarks(tab, curveName, rgbStr);
    return `Module[{V0=${V0}, maxV=${maxV}, color=${rgbStr}, data},
  data = Table[{V, ${solveBlock}}, {V, 0, maxV, maxV/${cfg.sampleCount}}];
  ListLinePlot[data,
    PlotRange -> {{0, maxV}, {0, 14}},
    PlotStyle -> {color, Thick},
    AxesLabel -> {"V (mL)", "pH"},
    ImageSize -> Large,
    GridLines -> Automatic,
    GridLinesStyle -> Directive[GrayLevel[0.8, 0.3]]${epilog ? `,\n    ${epilog}` : ''}
  ]
]`;
}
function downloadChart(tab) {
    if (!tab) return;
    const pane = getTabContent(tab);
    if (!pane) return;
    const formatEl = pane.querySelector('[data-role="image-format"]');
    const scaleEl = pane.querySelector('[data-role="image-scale"]');
    const format = formatEl ? formatEl.value : 'png';
    const scale = scaleEl ? parseFloat(scaleEl.value) || 1 : 1;
    const filename = `${tab.title || config.curveName}.${format === 'png' ? 'png' : 'jpg'}`;
    exportChartImage(tab.chart, format, scale, filename);
}
function downloadMultiChart(tab) {
    if (!tab) return;
    const pane = getTabContent(tab);
    if (!pane) return;
    const formatEl = pane.querySelector('[data-role="image-format"]');
    const scaleEl = pane.querySelector('[data-role="image-scale"]');
    const format = formatEl ? formatEl.value : 'png';
    const scale = scaleEl ? parseFloat(scaleEl.value) || 1 : 1;
    const filename = `${tab.title || t('多曲线对比', 'Multi-curve comparison')}.${format === 'png' ? 'png' : 'jpg'}`;
    exportChartImage(tab.chart, format, scale, filename);
}
