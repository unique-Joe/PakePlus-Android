const pKw = 14;
let solutionComponentCount = 0;
let titrantComponentCount = 0;
let savedCurves = [];
let currentAddMode = 'solution';
let currentPresetFilter = 'all';
let chartStyle = 'standard';
let uiLanguage = 'zh';
function t(zh, en) {
    return uiLanguage === 'zh' ? zh : en;
}

let chartTabs = [];
let activeTabId = null;
let compositeDatasets = [];
const compositeState = {
    xAxisMode: 'V',
    plainLabel: true,
    selectedIds: new Set(),
    markTargetIds: new Set(),
    gridEnabled: true,
    showLegend: true,
    xAxisArrow: false,
    yAxisArrow: false,
    axisConfig: {
        xAxisLabel: '', yAxisLabel: '', y2AxisLabel: '',
        xAxisLineColor: '', yAxisLineColor: '',
        xTickColor: '', yTickColor: '',
        xGridColor: '', yGridColor: '',
        xTicksVisible: true, yTicksVisible: true
    },
    fixedMarks: []
};
let tabCounter = 1;
let holdState = {
    active: false,
    startTime: 0,
    timer: null,
    raf: null,
    tabId: null,
    point: null
};
let config = {
    titrationType: 'acid-base',
    solution: { components: [], V0: 20 },
    titrant: { components: [] },
    maxVolume: 100,
    sampleCount: 500,
    curveColor: '#57a7bd',
    curveName: t('滴定曲线1', 'Titration curve 1'),
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
    markBorderWidth: 2.8
};
// Restore acid/base database from isolated data module
const acidBaseIndicators = window.AcidBaseDB.acidBaseIndicators;
const presetAcids = window.AcidBaseDB.presetAcids;
const presetBases = window.AcidBaseDB.presetBases;
const presetAcidsBases = window.AcidBaseDB.presetAcidsBases;
const speciesFormulaMap = window.AcidBaseDB.speciesFormulaMap;
const leapMarkerColors = ['#38bdf8', '#57a7bd', '#2dd4bf', '#f59e0b', '#fb7185', '#84cc16'];
const lgOverlay = document.getElementById('lgOverlay');
const lgPanel = document.getElementById('lgPanel');
const lgIcon = document.getElementById('lgIcon');
const lgTitle = document.getElementById('lgTitle');
const lgMessage = document.getElementById('lgMessage');
const lgActions = document.getElementById('lgActions');
let lgCurrentResolve = null;
const iconMap = {
    check: 'icon-check',
    success: 'icon-check',
    warning: 'icon-warning',
    alert: 'icon-warning',
    info: 'icon-info',
    '?': 'icon-info',
    trash: 'icon-trash',
    moon: 'icon-moon',
    sun: 'icon-sun',
    'chart-bar': 'icon-chart-bar',
    document: 'icon-document',
    save: 'icon-save',
    plus: 'icon-plus',
    'arrows-up-down': 'icon-arrows-up-down'
};
function getIcon(name, cls = 'icon-svg') {
    const id = iconMap[name] || iconMap.info;
    return `<svg class="${cls}" aria-hidden="true" focusable="false"><use href="#${id}"></use></svg>`;
}
function setLgIcon(icon) {
    // Map legacy emoji/icon strings to SVG names
    const legacyMap = {
        'check': 'check',
        'check': 'check',
        'check': 'check',
        'warning': 'warning',
        'trash': 'trash',
        'moon': 'moon',
        'sun': 'sun',
        'chart-bar': 'chart-bar',
        'document': 'document',
        'save': 'save',
        'plus': 'plus',
        'plus': 'plus',
        '?': 'info',
        'arrows-up-down': 'arrows-up-down'
    };
    const key = legacyMap[icon] || icon;
    lgIcon.innerHTML = getIcon(key, 'icon-svg');
}
function showAlert(title, message, icon = 'check') {
    return new Promise((resolve) => {
        setLgIcon(icon);
        lgTitle.textContent = title;
        lgMessage.textContent = message;
        lgActions.innerHTML = `
            <button class="lg-btn lg-btn-primary" id="lgConfirmBtn">${t('确定', 'OK')}</button>
        `;
        const confirmBtn = document.getElementById('lgConfirmBtn');
        confirmBtn.addEventListener('click', () => {
            hideLgPanel();
            resolve(true);
        });
        showLgPanel();
    });
}
function showConfirm(title, message, icon = 'warning') {
    return new Promise((resolve) => {
        setLgIcon(icon);
        lgTitle.textContent = title;
        lgMessage.textContent = message;
        lgActions.innerHTML = `
            <button class="lg-btn lg-btn-secondary" id="lgCancelBtn">${t('取消', 'Cancel')}</button>
            <button class="lg-btn lg-btn-primary" id="lgConfirmBtn">${t('确定', 'OK')}</button>
        `;
        const confirmBtn = document.getElementById('lgConfirmBtn');
        const cancelBtn = document.getElementById('lgCancelBtn');
        confirmBtn.addEventListener('click', () => {
            hideLgPanel();
            resolve(true);
        });
        cancelBtn.addEventListener('click', () => {
            hideLgPanel();
            resolve(false);
        });
        showLgPanel();
    });
}
function showLgPanel() {
    lgOverlay.classList.add('active');
    lgPanel.classList.add('active');
}
function hideLgPanel() {
    lgOverlay.classList.remove('active');
    lgPanel.classList.remove('active');
}
lgOverlay.addEventListener('click', hideLgPanel);
