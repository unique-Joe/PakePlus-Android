function updateSliderBubble() {
    const slider = document.getElementById('sampleDensitySlider');
    const bubble = document.getElementById('sliderBubble');
    if (!slider || !bubble) return;
    const value = Number(slider.value);
    const min = Number(slider.min);
    const max = Number(slider.max);
    const percent = ((value - min) / (max - min)) * 100;
    bubble.textContent = value + t('点', ' points');
    slider.style.setProperty('--density-progress', `${Math.min(100, Math.max(0, percent))}%`);
}
function applyChartWidth(tab, value) {
    if (!tab) return;
    const pane = getTabContent(tab);
    if (!pane) return;
    const wrapper = pane.querySelector('.chart-wrapper');
    if (!wrapper) return;
    const width = parseInt(value, 10);
    if (Number.isFinite(width) && width > 0) {
        wrapper.style.setProperty('--chart-custom-width', `${width}px`);
        wrapper.classList.add('custom-width');
    } else {
        wrapper.style.setProperty('--chart-custom-width', '100%');
        wrapper.classList.remove('custom-width');
    }
    if (tab.chart) {
        tab.chart.resize();
    }
}
function applyChartAspectRatio(tab, ratioValue) {
    if (!tab) return;
    if (!ratioValue) return;
    const pane = getTabContent(tab);
    if (!pane) return;
    const chartWidthInput = pane.querySelector('[data-role="chart-width"]');
    if (!chartWidthInput) return;
    if (ratioValue === 'auto') {
        chartWidthInput.value = '';
        applyChartWidth(tab, '');
        return;
    }
    const parts = ratioValue.split(':').map(Number);
    if (parts.length !== 2 || !parts[0] || !parts[1]) return;
    const wrapper = pane.querySelector('.chart-wrapper');
    const height = wrapper ? wrapper.getBoundingClientRect().height : 420;
    const width = Math.round(height * (parts[0] / parts[1]));
    chartWidthInput.value = width;
    applyChartWidth(tab, width);
}
function updateThemeLabel() {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;
    const themeText = themeToggle.querySelector('.text');
    if (!themeText) return;
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    themeText.textContent = isLight ? t('浅色', 'Light') : t('深色', 'Dark');
    themeToggle.title = t('切换主题', 'Toggle theme');
}
function updateStyleLabel() {
    const styleToggle = document.getElementById('styleToggle');
    if (!styleToggle) return;
    const styleText = styleToggle.querySelector('.text');
    if (!styleText) return;
    styleText.textContent = chartStyle === 'paper' ? t('论文风格', 'Paper') : t('标准风格', 'Standard');
    styleToggle.title = t('切换图表风格', 'Toggle chart style');
}
function updateLanguageLabel() {
    const langToggle = document.getElementById('langToggle');
    if (!langToggle) return;
    const langIcon = langToggle.querySelector('.icon-lang');
    const langText = langToggle.querySelector('.text');
    if (!langIcon || !langText) return;
    const isZh = uiLanguage === 'zh';
    if (isZh) {
        langIcon.textContent = '中';
        langText.textContent = '中文';
    } else {
        langIcon.textContent = 'EN';
        langText.textContent = 'English';
    }
    langToggle.title = t('切换语言', 'Switch language');
    const helpBtn = document.getElementById('helpBtn');
    if (helpBtn) helpBtn.title = t('帮助', 'Help');
}
const staticI18n = {
    zh: {
        acid_terms: '酸项',
        acid_terms_desc: '各酸组分的解离程度贡献，包含各级质子解离',
        add_component: '+ 添加酸/碱组件',
        add_curve: '添加为曲线',
        add_dissociation_level: '+ 添加电离级数',
        advanced_summary: '高级设置',
        app_title: '酸碱滴定pH计算器 - 专业版 v7.0.9',
        arrow_x: 'X箭头',
        arrow_y: 'Y箭头',
        aspect_auto: '比例自动',
        aspect_label: '分布图横宽比',
        auto_max_hint: '生成曲线时会按各组分浓度 × 元数加和，并用净酸碱当量估算完全滴定点。',
        auto_max_volume: '按混合液净当量自动设置最大体积（约 1.2×）',
        auto_sample: '突变区域自动插值',
        axis_range: '坐标轴范围',
        axis_range_note: '留空则自动根据可见数据范围计算。',
        axis_style_summary: '坐标轴样式设置',
        axis_x_grid_color: 'X网格颜色',
        axis_x_label: 'X轴标签',
        axis_x_line_color: 'X轴线颜色',
        axis_x_tick_color: 'X刻度颜色',
        axis_y_grid_color: 'Y网格颜色',
        axis_y_label: 'Y轴标签',
        axis_y_line_color: 'Y轴线颜色',
        axis_y_tick_color: 'Y刻度颜色',
        backspace_title: '退格',
        base_terms: '碱项',
        base_terms_desc: '各碱组分的质子化程度贡献，包含各级质子结合',
        blank_template: '空白模板',
        border_color: '描边颜色',
        border_width: '描边宽度',
        btn_acid_base: '酸滴定碱',
        btn_auto: '自动',
        btn_base_acid: '碱滴定酸',
        btn_save_curve: '保存当前曲线',
        chart_appearance: '图表外观',
        chart_width: '图表宽度',
        clear: '清空',
        clear_all_marks: '清除所有取点',
        clear_marks: '清除选点',
        composite_aspect_label: '复合图横宽比',
        composite_note: '将单/多曲线或浓度分布中的曲线放在同一坐标系对比。最多支持左右两组纵轴。',
        composite_settings_summary: '曲线、外观与坐标轴设置',
        composite_title: '复合对比',
        concentration_label: '浓度 (mol/L)',
        curve_appearance_settings: '曲线与图表外观设置',
        curve_name_placeholder: '为当前曲线命名',
        curve_style: '曲线样式',
        curve_thickness: '曲线粗细',
        custom_acid_base: '自定义酸碱',
        custom_curve: '自定义组合曲线',
        custom_curve_name_placeholder: '曲线名称，例如：酸碱差',
        custom_expr_label: '自定义曲线表达式',
        custom_parameters: '自定义参数',
        delete: '删除',
        delete_curve: '删除曲线',
        density_points: '{value}点',
        derivative_color: '一阶导数颜色',
        derivative_dash: '导数短虚线',
        derivative_dash_dot: '导数点划线',
        derivative_dense_dash: '导数密集虚线',
        derivative_dot: '导数点线',
        derivative_line: '一阶导数线',
        derivative_line_style: '一阶导数线型',
        derivative_long_dash: '导数长虚线',
        derivative_solid: '导数实线',
        dist_log_neg: '−log',
        dist_log_pos: 'log',
        dist_log_sign_label: 'log 正负号',
        dist_log_sign_title: 'log 模式下切换 log / −log',
        dist_mode_amount: '总量',
        dist_mode_amount_log: '−log 总量',
        dist_mode_linear: '浓度',
        dist_mode_log: '−log c',
        dist_note: '横轴可按滴定体积或 pH 显示，可按浓度、log/−log 或总物质的量查看各组分分布。点击图表查看具体数值。',
        dist_pick_title: '分布图取点',
        dist_title: '物种分布',
        dist_x_axis_label: '横轴模式',
        dist_x_axis_title: '切换横轴：体积 / pH / pOH',
        dist_x_ph: 'pH',
        dist_x_poh: 'pOH',
        dist_x_volume: 'V',
        dlg_message: '消息内容',
        dlg_title: '提示',
        download_chart: '下载图表',
        draw_curves: '绘制曲线',
        enable: '启用',
        endpoint_label: '有效终点标签',
        eq_cx: '组分X的浓度 (mol/L)',
        eq_h_concentration: 'H⁺离子浓度',
        eq_kxi: '组分X的第i级电离常数（酸为Ka，碱为Kb）',
        eq_oh_concentration: 'OH⁻离子浓度',
        eq_ph: '溶液的pH值',
        eq_v: '滴定剂体积 (mL)',
        eq_v0: '待测液初始体积',
        eq_zx: '组分X的电荷数（酸为可解离质子数，碱为可接受质子数）',
        equation_charge_conservation: '该方程基于电荷守恒原理建立，表示溶液中所有阳离子浓度之和等于所有阴离子浓度之和。',
        equation_label: '等式:',
        equation_notes: '方程说明',
        equation_terms: '方程中的各项分别代表:',
        expr_empty_hint: '点击下方组分标签和运算符构建表达式',
        expr_help: '表达式支持组分标签、H⁺、OH⁻ 以及 + − × ÷ 和括号；添加后会作为普通分布曲线参与显示、取点和样式编辑。',
        fill_color: '填充颜色',
        filter_acid: '酸',
        filter_all: '全部',
        filter_base: '碱',
        full_equation: '完整方程',
        generate_curve: '生成滴定曲线',
        generate_mathematica: '生成Mathematica代码',
        grid_label: '网格',
        grid_x_step_placeholder: '横向间距 自动',
        grid_y_step_placeholder: '纵向间距 自动',
        help_title: '帮助',
        hover_buffer_index: '缓冲指数',
        hover_volume: '体积',
        hover_volume_progress: '体积进度',
        img_format_label: '图片格式',
        img_scale_label: '导出倍率',
        indicator_label: '指示剂标签',
        indicator_note: '开启后会在图中显示滴定pH跃迁区和所选指示剂变色范围。',
        intersection_title: '交点查找',
        lang_icon: '中',
        lang_text: '中文',
        lang_title: '切换语言',
        lbl_curve_color: '曲线颜色',
        lbl_curve_name: '曲线名称',
        lbl_max_volume: '最大滴定体积 (mL)',
        lbl_sample_density: '采样密度',
        lbl_total_volume: '总体积 (mL)',
        leap_color: '跃迁颜色',
        leap_label: '跃迁标签',
        leap_style_empty: '生成滴定曲线后会显示各跃迁区样式配置',
        leap_threshold: '跃迁判断阈值',
        leap_threshold_help: '越大越严格（仅最陡区），越小越宽松（更多过渡也被视作跃迁）',
        leap_zone_style: '跃迁区与指示剂样式',
        leave_empty_default: '留空默认',
        left_side_basic: '左侧(碱性):',
        left_y_label: '左Y轴标签',
        left_y_range: '左侧纵轴范围',
        legend_label: '图例',
        line_color: '线色',
        line_dash: '短虚线',
        line_dash_dot: '点划线',
        line_dense_dash: '密集虚线',
        line_dot: '点线',
        line_long_dash: '长虚线',
        line_solid: '实线',
        line_style: '线型',
        line_width: '粗细',
        load_saved_curve_title: '点击加载到单曲线标签页',
        loading: '加载中...',
        'log c': 'log c',
        'log 总量': 'log 总量',
        main_curve: '主曲线',
        manual_mark_appearance: '手动设置标点外观',
        manual_setup: '手动设置',
        mark_curve_aria: '选择要标点的分布曲线',
        mark_curve_label: '标点曲线',
        mark_delete_title: '删除此标记',
        mark_style_hint: '勾选「启用」后，将以此处选择的颜色、半径或描边宽度覆盖默认样式；未启用时使用主题与曲线颜色自动计算。',
        marks_summary: '标点',
        marks_y_note: '按Y取点时只在所选曲线中搜索；建议所选曲线纵轴单位相同。',
        Mathematica代码已复制到剪贴板: 'Mathematica代码已复制到剪贴板',
        multi_chart_title: '多曲线图表',
        nav_charts: '图表',
        nav_composite: '复合',
        nav_distribution: '分布',
        nav_settings: '设置',
        no_components: '生成曲线后可选择要显示的组分。',
        no_composite_data_note: '请先在单曲线/多曲线或浓度分布界面点击「保存到复合对比」。',
        no_composite_data_title: '暂无复合数据',
        no_composite_empty: '暂无复合对比曲线。',
        no_curve_style: '生成曲线后可设置每条分布曲线。',
        no_curves_available: '暂无可选曲线',
        no_curves_to_mark: '暂无可标点曲线',
        no_curves_to_save: '生成曲线后可选择要保存的曲线。',
        no_dist_data_note: '请先在设置页生成滴定曲线。',
        no_dist_data_title: '暂无分布数据',
        no_expr_tokens: '生成曲线后可点击组分标签构建表达式。',
        no_marks: '暂无曲线。',
        no_marks_set_yet: '尚未设置任何标点。',
        no_marks_yet: '暂无标记点。长按图表中的点可添加标记。',
        no_matching_presets: '未找到匹配的酸碱',
        no_selected_curves: '没有选中的曲线。',
        no_style_yet: '添加曲线后可设置样式。',
        no_visible_curves_tab: '当前标签页没有可见曲线。',
        notation: '符号说明',
        page_menu_aria: '打开页面菜单',
        pH: 'pH',
        'pH 跃迁区': 'pH 跃迁区',
        'pH 跃迁区 #': 'pH 跃迁区 #',
        ph_placeholder: 'pH',
        pH跃迁区: 'pH跃迁区',
        pick_by_coordinates: '按坐标取点',
        pick_by_ph: '按 pH',
        pick_by_volume: '按体积',
        pick_by_x: '按X取点',
        pick_by_y: '按Y取点',
        pka_label: '电离常数 (pKa)',
        pkb_label: '电离常数 (pKb)',
        placeholder_auto: '自动',
        plain_labels: '朴素标签',
        point_border: '点描边',
        point_circle: '圆点',
        point_cross: '十字点',
        point_cross_rot: '斜十字点',
        point_diamond: '菱形点',
        point_fill: '点填充',
        point_line: '无点',
        point_none: '不显示标点',
        point_radius: '点半径',
        point_rect: '方点',
        point_rect_rounded: '圆角方点',
        point_size: '点大小',
        point_star: '星形点',
        point_style: '点型',
        point_triangle: '三角点',
        preset_mode_solution: '添加到待滴定溶液',
        preset_mode_titrant: '添加到滴定剂',
        preset_search_placeholder: '搜索酸碱名称或化学式...',
        preset_title: '选择预置酸碱',
        range_separator: '到',
        right_side_acidic: '右侧(酸性):',
        right_y_label: '右Y轴标签',
        right_y_range: '右侧纵轴范围',
        save_current_curve_list: '保存当前曲线到列表',
        save_curves_to_style: '保存曲线后可设置每条曲线的样式。',
        save_selected_to_composite: '保存选中曲线到复合对比',
        save_to_composite: '保存到复合对比',
        save_to_composite_summary: '保存到复合对比',
        save_to_composite_switch: '保存到复合对比',
        sec_direction: '滴定方向',
        sec_params: '计算参数',
        sec_saved_curves: '保存曲线列表',
        sec_solution: '待滴定溶液',
        sec_titrant: '滴定剂',
        select_all: '全选',
        select_mark_curves: '选择标点曲线',
        select_none: '清空',
        selected_info: '选定信息',
        show_components: '显示组分',
        show_curves: '显示曲线',
        show_derivative: '显示一阶导数',
        show_grid: '显示网格',
        show_indicator_range: '显示pH跃迁/指示剂范围',
        show_legend: '显示图例',
        show_raw_points: '显示原始数据点',
        single_chart_title: '单曲线图表',
        solution_components: '待测液组分',
        solve_intersection: '求解交点',
        strong_acid: '强酸',
        strong_base: '强碱',
        style_paper: '论文风格',
        style_standard: '标准风格',
        style_title: '切换图表风格',
        tab_multi: '多曲线标签',
        tab_single: '单曲线标签',
        theme_dark: '深色',
        theme_light: '浅色',
        theme_title: '切换主题',
        ticks_x: 'X刻度',
        ticks_y: 'Y刻度',
        titrant_components: '滴定剂组分',
        titration_equation: '滴定方程',
        valence_label: '元数',
        visible_curves_here: '可见曲线将显示在这里。',
        visit_label: '访问量：',
        visit_title: '点击切换访问量/访客数',
        volume_placeholder: '体积 (mL)',
        weak_acid: '弱酸',
        weak_base: '弱碱',
        ws_charts: '单/多曲线',
        ws_composite: '复合对比',
        ws_distribution: '浓度分布',
        ws_switch_label: '桌面端图表功能切换',
        x_max_aria: 'X轴上限',
        x_max_placeholder: '最大',
        x_min_aria: 'X轴下限',
        x_min_placeholder: '最小',
        x_range_label: '横轴范围',
        x_range_note: '留空则自动根据数据范围计算',
        x_range_title: 'X 轴范围',
        y_max_aria: 'Y轴上限',
        y_min_aria: 'Y轴下限',
        y_placeholder: 'pH / 浓度...',
        y_range_note: '留空则自动根据数据范围计算。',
        y_range_title: 'Y轴范围',
        '−log c': '−log c',
        '−log 总量': '−log 总量',
        '万': '万',
        '不在跃迁范围内': '不在跃迁范围内',
        '交点已存在，无需重复标记。': '交点已存在，无需重复标记。',
        '亿': '亿',
        '体积 (mL)': '体积 (mL)',
        '保存成功': '保存成功',
        '切换主题': '切换主题',
        '切换图表风格': '切换图表风格',
        '切换语言': '切换语言',
        '删除此标记': '删除此标记',
        '删除自定义曲线': '删除自定义曲线',
        '加入碱体积 (mL)': '加入碱体积 (mL)',
        '加入酸体积 (mL)': '加入酸体积 (mL)',
        '单曲线': '单曲线',
        '取消': '取消',
        '可留空, 默认显示 pH 跃迁区': '可留空, 默认显示 pH 跃迁区',
        '可留空, 默认显示有效终点区': '可留空, 默认显示有效终点区',
        '复合对比': '复合对比',
        '复合对比最多支持两组纵轴，仅显示前两个单位分组。': '复合对比最多支持两组纵轴，仅显示前两个单位分组。',
        '多曲线': '多曲线',
        '多曲线对比': '多曲线对比',
        '多曲线标签页中没有可见曲线': '多曲线标签页中没有可见曲线',
        '存在横轴不一致的曲线，无法全选。': '存在横轴不一致的曲线，无法全选。',
        '已加入复合对比': '已加入复合对比',
        '已加载': '已加载',
        '已按混合液净当量估算：{direction}；完全滴定点 {eqVol} mL，最大体积 {maxVol} mL。': '已按混合液净当量估算：{direction}；完全滴定点 {eqVol} mL，最大体积 {maxVol} mL。',
        '帮助': '帮助',
        '开启后会在图中显示滴定pH跃迁区和所选指示剂变色范围。': '开启后会在图中显示滴定pH跃迁区和所选指示剂变色范围。',
        '强碱': '强碱',
        '强碱阳离子': '强碱阳离子',
        '强酸': '强酸',
        '强酸阴离子': '强酸阴离子',
        '当前曲线没有经过 pH = {ph} 的位置。': '当前曲线没有经过 pH = {ph} 的位置。',
        '当前组分不足以估算完全滴定点，请检查浓度、元数或滴定剂设置。': '当前组分不足以估算完全滴定点，请检查浓度、元数或滴定剂设置。',
        '待测液净碱当量由滴定剂净酸当量中和': '待测液净碱当量由滴定剂净酸当量中和',
        '待测液净酸当量由滴定剂净碱当量中和': '待测液净酸当量由滴定剂净碱当量中和',
        '成功': '成功',
        '所选指示剂变色范围与滴定跃迁区重叠，终点可落在约 {range}。': '所选指示剂变色范围与滴定跃迁区重叠，终点可落在约 {range}。',
        '所选指示剂的变色范围没有落入本曲线的pH跃迁区，建议更换指示剂。': '所选指示剂的变色范围没有落入本曲线的pH跃迁区，建议更换指示剂。',
        '找到 {count} 个交点并已标记在图中。': '找到 {count} 个交点并已标记在图中。',
        '按 pH': '按 pH',
        '按 pOH': '按 pOH',
        '提示': '提示',
        '无法定位体积': '无法定位体积',
        '暂无复合数据': '暂无复合数据',
        '曲线': '曲线',
        '曲线数据无效。': '曲线数据无效。',
        '曲线未经过该范围': '曲线未经过该范围',
        '有效终点区': '有效终点区',
        '有效终点区 #': '有效终点区 #',
        '未找到与该横坐标对应的点。': '未找到与该横坐标对应的点。',
        '未找到与该纵坐标对应的点。': '未找到与该纵坐标对应的点。',
        '未找到交点。': '未找到交点。',
        '未找到交点，这两条曲线可能没有交点或交点位于当前数据范围之外。': '未找到交点，这两条曲线可能没有交点或交点位于当前数据范围之外。',
        '未找到可用于求根生成的曲线参数': '未找到可用于求根生成的曲线参数',
        '未找到选定曲线': '未找到选定曲线',
        '未知': '未知',
        '标准风格': '标准风格',
        '横轴不一致': '横轴不一致',
        '横轴不一致（已有：{existing}，新加：{newX}），无法勾选。': '横轴不一致（已有：{existing}，新加：{newX}），无法勾选。',
        '没有可见的浓度分布曲线可保存。': '没有可见的浓度分布曲线可保存。',
        '浅色': '浅色',
        '浓度': '浓度',
        '浓度 (mol/L)': '浓度 (mol/L)',
        '深色': '深色',
        '滴定': '滴定',
        '滴定剂体积 (mL)': '滴定剂体积 (mL)',
        '滴定曲线': '滴定曲线',
        '滴定曲线1': '滴定曲线1',
        '点': '点',
        '点击加载到单曲线标签页': '点击加载到单曲线标签页',
        '物种曲线': '物种曲线',
        '物种浓度分布': '物种浓度分布',
        '物质的量 (mmol)': '物质的量 (mmol)',
        '电离常数': '电离常数',
        '电离常数 (pKa)': '电离常数 (pKa)',
        '电离常数 (pKb)': '电离常数 (pKb)',
        '确定': '确定',
        '确定要删除这条曲线吗？': '确定要删除这条曲线吗？',
        '确认删除': '确认删除',
        '碱': '碱',
        '自定义曲线{index}': '自定义曲线{index}',
        '自定义酸碱': '自定义酸碱',
        '论文风格': '论文风格',
        '访客数：': '访客数：',
        '访问量：': '访问量：',
        '请先在面板中选择要按Y取点的曲线。': '请先在面板中选择要按Y取点的曲线。',
        '请先添加并显示曲线。': '请先添加并显示曲线。',
        '请先生成滴定曲线后再下载分布图。': '请先生成滴定曲线后再下载分布图。',
        '请先生成滴定曲线后再保存。': '请先生成滴定曲线后再保存。',
        '请先用组分标签和运算符构建表达式。': '请先用组分标签和运算符构建表达式。',
        '请先选择指示剂': '请先选择指示剂',
        '请至少勾选一条曲线': '请至少勾选一条曲线',
        '请至少勾选一条曲线。': '请至少勾选一条曲线。',
        '请输入有效的体积数值。': '请输入有效的体积数值。',
        '请输入有效的数值。': '请输入有效的数值。',
        '请选择两条不同的曲线。': '请选择两条不同的曲线。',
        '适配': '适配',
        '选中的曲线横轴不一致，无法在同一坐标系中显示。': '选中的曲线横轴不一致，无法在同一坐标系中显示。',
        '酸': '酸',
    
    },
    en: {
        acid_terms: 'Acid terms',
        acid_terms_desc: 'Dissociation contribution of each acid component, including stepwise proton release',
        add_component: '+ Add acid/base component',
        add_curve: 'Add as curve',
        add_dissociation_level: '+ Add dissociation level',
        advanced_summary: 'Advanced settings',
        app_title: 'Acid-Base Titration pH Calculator - Pro v7.0.9',
        arrow_x: 'X arrow',
        arrow_y: 'Y arrow',
        aspect_auto: 'Auto aspect',
        aspect_label: 'Distribution aspect ratio',
        auto_max_hint: 'The curve is generated by summing concentration × valence and estimating the equivalence point from net acid-base equivalents.',
        auto_max_volume: 'Auto set max volume by net equivalent (~1.2x)',
        auto_sample: 'Auto interpolate steep regions',
        axis_range: 'Axis range',
        axis_range_note: 'Leave empty to auto calculate from visible data.',
        axis_style_summary: 'Axis style settings',
        axis_x_grid_color: 'X grid color',
        axis_x_label: 'X axis label',
        axis_x_line_color: 'X axis line color',
        axis_x_tick_color: 'X tick color',
        axis_y_grid_color: 'Y grid color',
        axis_y_label: 'Y axis label',
        axis_y_line_color: 'Y axis line color',
        axis_y_tick_color: 'Y tick color',
        backspace_title: 'Backspace',
        base_terms: 'Base terms',
        base_terms_desc: 'Protonation contribution of each base component, including stepwise proton binding',
        blank_template: 'Blank template',
        border_color: 'Border color',
        border_width: 'Border width',
        btn_acid_base: 'Acid titrates base',
        btn_auto: 'Auto',
        btn_base_acid: 'Base titrates acid',
        btn_save_curve: 'Save current curve',
        chart_appearance: 'Chart appearance',
        chart_width: 'Chart width',
        clear: 'Clear',
        clear_all_marks: 'Clear all marks',
        clear_marks: 'Clear marks',
        composite_aspect_label: 'Composite aspect ratio',
        composite_note: 'Compare single/multi curves or distribution curves in one coordinate system. Supports left/right Y axes.',
        composite_settings_summary: 'Curves, appearance and axis settings',
        composite_title: 'Composite comparison',
        concentration_label: 'Concentration (mol/L)',
        curve_appearance_settings: 'Curve and chart appearance',
        curve_name_placeholder: 'Name the current curve',
        curve_style: 'Curve style',
        curve_thickness: 'Curve thickness',
        custom_acid_base: 'Custom acid/base',
        custom_curve: 'Custom composite curve',
        custom_curve_name_placeholder: 'Curve name, e.g. acid-base diff',
        custom_expr_label: 'Custom curve expression',
        custom_parameters: 'Custom parameters',
        delete: 'Delete',
        delete_curve: 'Delete curve',
        density_points: '{value} points',
        derivative_color: 'Derivative color',
        derivative_dash: 'Derivative dashed',
        derivative_dash_dot: 'Derivative dash-dot',
        derivative_dense_dash: 'Derivative dense dashed',
        derivative_dot: 'Derivative dotted',
        derivative_line: 'First derivative line',
        derivative_line_style: 'Derivative line style',
        derivative_long_dash: 'Derivative long dashed',
        derivative_solid: 'Derivative solid',
        dist_log_neg: '−log',
        dist_log_pos: 'log',
        dist_log_sign_label: 'Log sign',
        dist_log_sign_title: 'Toggle log / −log in log mode',
        dist_mode_amount: 'Total amount',
        dist_mode_amount_log: '−log total',
        dist_mode_linear: 'Concentration',
        dist_mode_log: '−log c',
        dist_note: 'The horizontal axis can show titrant volume or pH; view concentration, log/−log, or total amount. Click the chart for values.',
        dist_pick_title: 'Distribution point picking',
        dist_title: 'Species distribution',
        dist_x_axis_label: 'Horizontal axis mode',
        dist_x_axis_title: 'Switch axis: volume / pH / pOH',
        dist_x_ph: 'pH',
        dist_x_poh: 'pOH',
        dist_x_volume: 'V',
        dlg_message: 'Message',
        dlg_title: 'Notice',
        download_chart: 'Download chart',
        draw_curves: 'Draw curves',
        enable: 'Enable',
        endpoint_label: 'Endpoint fit label',
        eq_cx: 'Concentration of component X (mol/L)',
        eq_h_concentration: 'H⁺ ion concentration',
        eq_kxi: 'i-th dissociation constant of component X (Ka for acids, Kb for bases)',
        eq_oh_concentration: 'OH⁻ ion concentration',
        eq_ph: 'Solution pH value',
        eq_v: 'Titrant volume (mL)',
        eq_v0: 'Initial solution volume',
        eq_zx: 'Charge number of component X (protons dissociable for acids, protons acceptable for bases)',
        equation_charge_conservation: 'This equation is based on charge conservation: total cation concentration equals total anion concentration.',
        equation_label: 'Equation:',
        equation_notes: 'Equation notes',
        equation_terms: 'Each term represents:',
        expr_empty_hint: 'Click species labels and operators below to build an expression',
        expr_help: 'Expressions support species labels, H⁺, OH⁻, + − × ÷ and parentheses; added curves can be displayed, picked and styled.',
        fill_color: 'Fill color',
        filter_acid: 'Acid',
        filter_all: 'All',
        filter_base: 'Base',
        full_equation: 'Full equation',
        generate_curve: 'Generate titration curve',
        generate_mathematica: 'Generate Mathematica code',
        grid_label: 'Grid',
        grid_x_step_placeholder: 'X grid step auto',
        grid_y_step_placeholder: 'Y grid step auto',
        help_title: 'Help',
        hover_buffer_index: 'Buffer index',
        hover_volume: 'Volume',
        hover_volume_progress: 'Volume progress',
        img_format_label: 'Image format',
        img_scale_label: 'Export scale',
        indicator_label: 'Indicator label',
        indicator_note: 'Enable to show the titration pH leap and selected indicator range.',
        intersection_title: 'Find intersections',
        lang_icon: 'EN',
        lang_text: 'English',
        lang_title: 'Switch language',
        lbl_curve_color: 'Curve color',
        lbl_curve_name: 'Curve name',
        lbl_max_volume: 'Max titrant volume (mL)',
        lbl_sample_density: 'Sampling density',
        lbl_total_volume: 'Total volume (mL)',
        leap_color: 'Leap color',
        leap_label: 'Leap label',
        leap_style_empty: 'Generate a curve to configure leap zone styles',
        leap_threshold: 'Leap threshold',
        leap_threshold_help: 'Larger = stricter (only steepest); smaller = looser (more transitions count).',
        leap_zone_style: 'Leap zone and indicator style',
        leave_empty_default: 'Leave empty for default',
        left_side_basic: 'Left side (basic):',
        left_y_label: 'Left Y axis label',
        left_y_range: 'Left Y axis range',
        legend_label: 'Legend',
        line_color: 'Line color',
        line_dash: 'Dashed',
        line_dash_dot: 'Dash-dot',
        line_dense_dash: 'Dense dashed',
        line_dot: 'Dotted',
        line_long_dash: 'Long dashed',
        line_solid: 'Solid',
        line_style: 'Line style',
        line_width: 'Width',
        load_saved_curve_title: 'Click to load into single-curve tab',
        loading: 'Loading...',
        'log c': 'log c',
        'log 总量': 'log total',
        main_curve: 'Main curve',
        manual_mark_appearance: 'Manual mark appearance',
        manual_setup: 'Manual setup',
        mark_curve_aria: 'Select distribution curve to mark',
        mark_curve_label: 'Mark curve',
        mark_delete_title: 'Delete this mark',
        mark_style_hint: 'When enabled, the selected color/radius/width overrides defaults; otherwise theme and curve colors are used.',
        marks_summary: 'Marks',
        marks_y_note: 'Y picking searches only selected curves; curves with the same Y unit are recommended.',
        Mathematica代码已复制到剪贴板: 'Mathematica code copied to clipboard',
        multi_chart_title: 'Multi-curve chart',
        nav_charts: 'Charts',
        nav_composite: 'Composite',
        nav_distribution: 'Distribution',
        nav_settings: 'Settings',
        no_components: 'Generate a curve to select species.',
        no_composite_data_note: 'First click "Save to composite comparison" in the Single/Multi curve or Distribution view.',
        no_composite_data_title: 'No composite data',
        no_composite_empty: 'No composite comparison curves.',
        no_curve_style: 'Generate a curve to configure each distribution curve.',
        no_curves_available: 'No curves available',
        no_curves_to_mark: 'No curves available for marking',
        no_curves_to_save: 'Generate a curve to choose curves to save.',
        no_dist_data_note: 'Please generate a titration curve in Settings first.',
        no_dist_data_title: 'No distribution data',
        no_expr_tokens: 'Generate a curve to build an expression from species labels.',
        no_marks: 'No curves.',
        no_marks_set_yet: 'No marks set yet.',
        no_marks_yet: 'No marks yet. Long-press a chart point to add a mark.',
        no_matching_presets: 'No matching acids/bases found',
        no_selected_curves: 'No curves selected.',
        no_style_yet: 'Add curves to configure styles.',
        no_visible_curves_tab: 'No visible curves in the current tab.',
        notation: 'Notation',
        page_menu_aria: 'Open page menu',
        pH: 'pH',
        'pH 跃迁区': 'pH leap zone',
        'pH 跃迁区 #': 'pH leap #',
        ph_placeholder: 'pH',
        pH跃迁区: 'pH leap zone',
        pick_by_coordinates: 'Pick by coordinates',
        pick_by_ph: 'By pH',
        pick_by_volume: 'By volume',
        pick_by_x: 'Pick by X',
        pick_by_y: 'Pick by Y',
        pka_label: 'Dissociation constant (pKa)',
        pkb_label: 'Dissociation constant (pKb)',
        placeholder_auto: 'Auto',
        plain_labels: 'Plain labels',
        point_border: 'Point border',
        point_circle: 'Circle',
        point_cross: 'Cross',
        point_cross_rot: 'Rotated cross',
        point_diamond: 'Diamond',
        point_fill: 'Point fill',
        point_line: 'Line',
        point_none: 'No marker',
        point_radius: 'Point radius',
        point_rect: 'Square',
        point_rect_rounded: 'Rounded square',
        point_size: 'Point size',
        point_star: 'Star',
        point_style: 'Point style',
        point_triangle: 'Triangle',
        preset_mode_solution: 'Add to solution',
        preset_mode_titrant: 'Add to titrant',
        preset_search_placeholder: 'Search acid/base name or formula...',
        preset_title: 'Choose preset acid/base',
        range_separator: 'to',
        right_side_acidic: 'Right side (acidic):',
        right_y_label: 'Right Y axis label',
        right_y_range: 'Right Y axis range',
        save_current_curve_list: 'Saved curve list',
        save_curves_to_style: 'Save curves to configure each curve style.',
        save_selected_to_composite: 'Save selected curves to composite',
        save_to_composite: 'Save to composite comparison',
        save_to_composite_summary: 'Save to composite comparison',
        save_to_composite_switch: 'Save to composite',
        sec_direction: 'Titration direction',
        sec_params: 'Calculation parameters',
        sec_saved_curves: 'Saved curves',
        sec_solution: 'Solution to titrate',
        sec_titrant: 'Titrant',
        select_all: 'Select all',
        select_mark_curves: 'Select mark curves',
        select_none: 'Clear',
        selected_info: 'Selected info',
        show_components: 'Show species',
        show_curves: 'Show curves',
        show_derivative: 'Show first derivative',
        show_grid: 'Show grid',
        show_indicator_range: 'Show pH leap / indicator range',
        show_legend: 'Show legend',
        show_raw_points: 'Show raw data points',
        single_chart_title: 'Single curve chart',
        solution_components: 'Solution components',
        solve_intersection: 'Solve intersections',
        strong_acid: 'Strong acid',
        strong_base: 'Strong base',
        style_paper: 'Paper',
        style_standard: 'Standard',
        style_title: 'Toggle chart style',
        tab_multi: 'Multi curve',
        tab_single: 'Single curve',
        theme_dark: 'Dark',
        theme_light: 'Light',
        theme_title: 'Toggle theme',
        ticks_x: 'X ticks',
        ticks_y: 'Y ticks',
        titrant_components: 'Titrant components',
        titration_equation: 'Titration equation',
        valence_label: 'Valence',
        visible_curves_here: 'Visible curves will appear here.',
        visit_label: 'Visits: ',
        visit_title: 'Click to toggle site visits / unique visitors',
        volume_placeholder: 'Volume (mL)',
        weak_acid: 'Weak acid',
        weak_base: 'Weak base',
        ws_charts: 'Single/Multi',
        ws_composite: 'Composite',
        ws_distribution: 'Distribution',
        ws_switch_label: 'Desktop chart view switch',
        x_max_aria: 'X axis maximum',
        x_max_placeholder: 'Max',
        x_min_aria: 'X axis minimum',
        x_min_placeholder: 'Min',
        x_range_label: 'X axis range',
        x_range_note: 'Leave empty to auto calculate from data',
        x_range_title: 'X axis range',
        y_max_aria: 'Y axis maximum',
        y_min_aria: 'Y axis minimum',
        y_placeholder: 'pH / concentration...',
        y_range_note: 'Leave empty to auto calculate from data.',
        y_range_title: 'Y axis range',
        '−log c': '−log c',
        '−log 总量': '−log total',
        '万': 'ten thousand',
        '不在跃迁范围内': 'Outside pH leap',
        '交点已存在，无需重复标记。': 'Intersection already exists; no duplicate mark.',
        '亿': 'hundred million',
        '体积 (mL)': 'Volume (mL)',
        '保存成功': 'Saved',
        '切换主题': 'Toggle theme',
        '切换图表风格': 'Toggle chart style',
        '切换语言': 'Switch language',
        '删除此标记': 'Delete this mark',
        '删除自定义曲线': 'Delete custom curve',
        '加入碱体积 (mL)': 'Base added (mL)',
        '加入酸体积 (mL)': 'Acid added (mL)',
        '单曲线': 'Single',
        '取消': 'Cancel',
        '可留空, 默认显示 pH 跃迁区': 'Optional; default shows pH leap zone',
        '可留空, 默认显示有效终点区': 'Optional; default shows endpoint fit',
        '复合对比': 'Composite',
        '复合对比最多支持两组纵轴，仅显示前两个单位分组。': 'Composite supports at most two Y-axis units; only the first two unit groups are shown.',
        '多曲线': 'Multi',
        '多曲线对比': 'Multi-curve comparison',
        '多曲线标签页中没有可见曲线': 'No visible curves in multi-curve tab',
        '存在横轴不一致的曲线，无法全选。': 'Some curves have inconsistent X axes; cannot select all.',
        '已加入复合对比': 'Added to composite',
        '已加载': 'Loaded',
        '已按混合液净当量估算：{direction}；完全滴定点 {eqVol} mL，最大体积 {maxVol} mL。': 'Estimated from net equivalents: {direction}; equivalence point {eqVol} mL, max volume {maxVol} mL.',
        '帮助': 'Help',
        '开启后会在图中显示滴定pH跃迁区和所选指示剂变色范围。': 'Enable this to show the titration pH leap and the selected indicator transition range.',
        '强碱': 'Strong base',
        '强碱阳离子': 'strong-base cation',
        '强酸': 'Strong acid',
        '强酸阴离子': 'strong-acid anion',
        '当前曲线没有经过 pH = {ph} 的位置。': 'The current curve does not pass pH = {ph}.',
        '当前组分不足以估算完全滴定点，请检查浓度、元数或滴定剂设置。': 'Current components are insufficient to estimate the equivalence point. Check concentration, valence, or titrant settings.',
        '待测液净碱当量由滴定剂净酸当量中和': 'Solution net base equivalents neutralized by titrant net acid equivalents',
        '待测液净酸当量由滴定剂净碱当量中和': 'Solution net acid equivalents neutralized by titrant net base equivalents',
        '成功': 'Success',
        '所选指示剂变色范围与滴定跃迁区重叠，终点可落在约 {range}。': 'The selected indicator overlaps the titration pH leap; the endpoint can fall around {range}.',
        '所选指示剂的变色范围没有落入本曲线的pH跃迁区，建议更换指示剂。': 'The selected indicator transition range does not fall inside this pH leap; choose another indicator.',
        '找到 {count} 个交点并已标记在图中。': 'Found {count} intersection(s) and marked on the chart.',
        '按 pH': 'By pH',
        '按 pOH': 'By pOH',
        '提示': 'Tip',
        '无法定位体积': 'volume not located',
        '暂无复合数据': 'No composite data',
        '曲线': 'Curve',
        '曲线数据无效。': 'Curve data is invalid.',
        '曲线未经过该范围': 'Curve does not cross this range',
        '有效终点区': 'Endpoint fit',
        '有效终点区 #': 'Endpoint fit #',
        '未找到与该横坐标对应的点。': 'No point found for this X coordinate.',
        '未找到与该纵坐标对应的点。': 'No point found for this Y coordinate.',
        '未找到交点。': 'No intersection found.',
        '未找到交点，这两条曲线可能没有交点或交点位于当前数据范围之外。': 'No intersection found; the two curves may not intersect or the intersection lies outside the current data range.',
        '未找到可用于求根生成的曲线参数': 'No curve parameters available for root finding.',
        '未找到选定曲线': 'Selected curve not found.',
        '未知': 'Unknown',
        '标准风格': 'Standard',
        '横轴不一致': 'X-axis mismatch',
        '横轴不一致（已有：{existing}，新加：{newX}），无法勾选。': 'X-axis mismatch (existing: {existing}, new: {newX}). Cannot select.',
        '没有可见的浓度分布曲线可保存。': 'No visible distribution curves to save.',
        '浅色': 'Light',
        '浓度': 'Concentration',
        '浓度 (mol/L)': 'Concentration (mol/L)',
        '深色': 'Dark',
        '滴定': ' titrates ',
        '滴定剂体积 (mL)': 'Titrant volume (mL)',
        '滴定曲线': 'Titration curve',
        '滴定曲线1': 'Titration curve 1',
        '点': 'points',
        '点击加载到单曲线标签页': 'Click to load into single-curve tab',
        '物种曲线': 'Species curves',
        '物种浓度分布': 'Species distribution',
        '物质的量 (mmol)': 'Amount (mmol)',
        '电离常数': 'Dissociation constant',
        '电离常数 (pKa)': 'Dissociation constant (pKa)',
        '电离常数 (pKb)': 'Dissociation constant (pKb)',
        '确定': 'OK',
        '确定要删除这条曲线吗？': 'Delete this curve?',
        '确认删除': 'Confirm delete',
        '碱': 'Base',
        '自定义曲线{index}': 'Custom curve {index}',
        '自定义酸碱': 'Custom acid/base',
        '论文风格': 'Paper',
        '访客数：': 'Visitors: ',
        '访问量：': 'Visits: ',
        '请先在面板中选择要按Y取点的曲线。': 'Please select a curve for Y picking in the panel first.',
        '请先添加并显示曲线。': 'Please add and display a curve first.',
        '请先生成滴定曲线后再下载分布图。': 'Please generate a titration curve before downloading the distribution chart.',
        '请先生成滴定曲线后再保存。': 'Please generate a titration curve before saving.',
        '请先用组分标签和运算符构建表达式。': 'Please build an expression with species labels and operators first.',
        '请先选择指示剂': 'Please select an indicator first.',
        '请至少勾选一条曲线': 'Please select at least one curve.',
        '请至少勾选一条曲线。': 'Please select at least one curve.',
        '请输入有效的体积数值。': 'Please enter a valid volume value.',
        '请输入有效的数值。': 'Please enter a valid number.',
        '请选择两条不同的曲线。': 'Please select two different curves.',
        '适配': 'Fits',
        '选中的曲线横轴不一致，无法在同一坐标系中显示。': 'Selected curves have inconsistent X axes and cannot be shown in the same coordinate system.',
        '酸': 'Acid',
    }
};
function translateStaticUI() {
    const dict = staticI18n[uiLanguage] || staticI18n.zh;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (!dict[key]) return;
        // select 不能整体替换 textContent，否则会清空全部 option；
        // 其选项文字由每个 option 自身的 data-i18n 翻译
        if (el.tagName === 'SELECT') return;
        const value = dict[key];
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            if (el.placeholder && el.value === '') el.placeholder = value;
            else el.textContent = value;
        } else {
            el.textContent = value;
        }
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.dataset.i18nPlaceholder;
        if (dict[key]) el.placeholder = dict[key];
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.dataset.i18nTitle;
        if (dict[key]) el.title = dict[key];
    });
    document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
        const key = el.dataset.i18nAriaLabel;
        if (dict[key]) el.setAttribute('aria-label', dict[key]);
    });
    document.querySelectorAll('[data-i18n-value]').forEach(el => {
        const key = el.dataset.i18nValue;
        if (dict[key]) el.value = dict[key];
    });
    document.querySelectorAll('title[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (dict[key]) el.textContent = dict[key];
    });
}
function updateToggleLabels() {
    updateThemeLabel();
    updateStyleLabel();
    updateLanguageLabel();
    translateStaticUI();
    refreshAllTabUIs();
    if (typeof refreshComponentLabels === 'function') refreshComponentLabels();
    updateSliderBubble();
}
function refreshAllTabUIs() {
    // Update tab titles for language switch
    document.querySelectorAll('.tab-item').forEach(item => {
        const tabId = item.dataset.tabId;
        const tab = chartTabs.find(t => t.id === tabId);
        if (!tab) return;
        const titleEl = item.querySelector('.tab-title');
        const typeTag = item.querySelector('.tab-type-tag');
        if (typeTag) typeTag.textContent = tab.type === 'multi' ? t('多曲线', 'Multi') : t('单曲线', 'Single');
        if (titleEl && tab.title) {
            const numberMatch = tab.title.match(/\d+$/);
            const number = numberMatch ? numberMatch[0] : '';
            const prefix = tab.type === 'multi' ? t('多曲线', 'Multi') : t('单曲线', 'Single');
            titleEl.textContent = prefix + number;
        }
    });
    // Re-render dynamic tab content that is generated from code
    chartTabs.forEach(tab => {
        if (tab.type === 'multi') {
            updateCurveVisibilityList(tab);
            updateMultiCurveStyleList(tab);
            updateSaveCompositeList(tab);
            updateCurvePickMenu(tab);
        }
        if (tab.type === 'single') {
            if (typeof refreshIndicatorSelect === 'function') refreshIndicatorSelect(tab);
        }
        translateStaticUI();
    });
}
function applyMobileViewportAdjustments() {
    const isPhoneLayout = window.matchMedia('(max-width: 900px)').matches;
    document.querySelectorAll('.chart-wrapper.custom-width').forEach(wrapper => {
        if (isPhoneLayout) {
            wrapper.dataset.mobileCustomWidth = 'true';
            wrapper.style.width = '100%';
        } else if (wrapper.dataset.mobileCustomWidth) {
            wrapper.style.width = '';
            delete wrapper.dataset.mobileCustomWidth;
        }
    });
    if (Array.isArray(window.chartTabs || chartTabs)) {
        (window.chartTabs || chartTabs).forEach(tab => {
            if (tab && tab.chart && typeof tab.chart.resize === 'function') {
                tab.chart.resize();
            }
        });
    }
}
let mobileViewportResizeTimer = null;
window.addEventListener('resize', () => {
    clearTimeout(mobileViewportResizeTimer);
    mobileViewportResizeTimer = setTimeout(applyMobileViewportAdjustments, 120);
}, { passive: true });
window.addEventListener('orientationchange', () => {
    setTimeout(applyMobileViewportAdjustments, 250);
}, { passive: true });
document.addEventListener('DOMContentLoaded', function() {
    setupToggleButtons();
    document.getElementById('addSolutionComponent').onclick = function() {
        currentAddMode = 'solution';
        openPresetModal();
    };
    document.getElementById('addTitrantComponent').onclick = function() {
        currentAddMode = 'titrant';
        openPresetModal();
    };
    document.getElementById('closeModal').onclick = closePresetModal;
    document.getElementById('presetSearch').addEventListener('input', function(e) {
        renderPresetList(e.target.value);
    });
    document.querySelectorAll('.preset-type-btn').forEach(btn => {
        btn.onclick = function() {
            document.querySelectorAll('.preset-type-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentPresetFilter = this.dataset.type;
            renderPresetList(document.getElementById('presetSearch').value);
        };
    });
    document.querySelectorAll('.mode-option').forEach(btn => {
        btn.onclick = function() {
            document.querySelectorAll('.mode-option').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentAddMode = this.dataset.mode;
            renderPresetList(document.getElementById('presetSearch').value);
        };
    });
    document.getElementById('generateBtn').onclick = generateCurve;
    document.getElementById('saveCurrentCurve').onclick = saveCurrentCurve;
    const addTabBtn = document.getElementById('addChartTabBtn');
    const addTabMenu = document.getElementById('addChartTabMenu');
    if (addTabBtn && addTabMenu) {
        const wrapper = document.getElementById('tabAddWrapper');
        const openMenu = () => {
            const rect = addTabBtn.getBoundingClientRect();
            addTabMenu.classList.add('active');
            addTabMenu.style.position = 'fixed';
            addTabMenu.style.left = `${Math.round(rect.left)}px`;
            addTabMenu.style.top = `${Math.round(rect.bottom + 6)}px`;
            addTabMenu.style.zIndex = '2147483647';
            document.body.appendChild(addTabMenu);
        };
        const closeMenu = () => {
            addTabMenu.classList.remove('active');
            addTabMenu.style.position = '';
            addTabMenu.style.left = '';
            addTabMenu.style.top = '';
            addTabMenu.style.zIndex = '';
            if (wrapper) wrapper.appendChild(addTabMenu);
        };
        addTabBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (addTabMenu.classList.contains('active')) {
                closeMenu();
            } else {
                openMenu();
            }
        });
        addTabMenu.querySelectorAll('.tab-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const type = item.dataset.type || 'single';
                createChartTab(type);
                closeMenu();
            });
        });
        document.addEventListener('click', (event) => {
            if (!addTabMenu.contains(event.target) && event.target !== addTabBtn) {
                closeMenu();
            }
        });
        window.addEventListener('scroll', () => {
            if (addTabMenu.classList.contains('active')) {
                openMenu();
            }
        }, { passive: true });
        window.addEventListener('resize', () => {
            if (addTabMenu.classList.contains('active')) {
                openMenu();
            }
        });
    }
    if (chartTabs.length === 0) {
        createChartTab('single');
    }
    const slider = document.getElementById('sampleDensitySlider');
    slider.addEventListener('input', function() {
        updateSliderBubble();
    });
    updateSliderBubble();
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = themeToggle.querySelector('.icon');
    document.documentElement.setAttribute('data-theme', 'dark');
    themeIcon.innerHTML = '<use href="#icon-moon"></use>';
    updateThemeLabel();
    themeToggle.addEventListener('click', function() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        if (newTheme === 'light') {
            themeIcon.innerHTML = '<use href="#icon-sun"></use>';
        } else {
            themeIcon.innerHTML = '<use href="#icon-moon"></use>';
        }
        updateThemeLabel();
        rerenderAllTabs();
    });
    const styleToggle = document.getElementById('styleToggle');
    const styleIcon = styleToggle.querySelector('.icon');
    styleToggle.addEventListener('click', function() {
        chartStyle = chartStyle === 'standard' ? 'paper' : 'standard';
        if (chartStyle === 'paper') {
            styleIcon.innerHTML = '<use href="#icon-document"></use>';
        } else {
            styleIcon.innerHTML = '<use href="#icon-chart-bar"></use>';
        }
        updateStyleLabel();
        rerenderAllTabs();
    });
    const langToggle = document.getElementById('langToggle');
    if (langToggle) {
        langToggle.addEventListener('click', function() {
            uiLanguage = uiLanguage === 'zh' ? 'en' : 'zh';
            updateToggleLabels();
            renderHelpContent();
            rerenderAllTabs();
        });
    }
    const helpBtn = document.getElementById('helpBtn');
    const helpPanel = document.getElementById('helpPanel');
    const closeHelp = document.getElementById('closeHelp');
    if (helpBtn && helpPanel) {
        helpBtn.addEventListener('click', function() {
            helpPanel.classList.toggle('active');
        });
        if (closeHelp) {
            closeHelp.addEventListener('click', function() {
                helpPanel.classList.remove('active');
            });
        }
        document.addEventListener('click', function(event) {
            if (helpPanel.classList.contains('active') &&
                !helpPanel.contains(event.target) &&
                !helpBtn.contains(event.target)) {
                helpPanel.classList.remove('active');
            }
        });
    }
    function renderHelpContent() {
        const helpContent = document.getElementById('helpContent');
        if (!helpContent) return;
        const isZh = uiLanguage === 'zh';
        const helpHTML = isZh ? `
            <h2>酸碱滴定 S 型曲线绘图程序 (ATSC-Plot)</h2>
            <p style="margin-bottom: 14px; color: var(--text-secondary); line-height: 1.6;">本程序用于计算并绘制酸碱滴定过程的 pH-体积曲线、各组分浓度分布曲线及相关分析结果。</p>

            <h3>1. 参数设置</h3>
            <ul>
                <li><strong>滴定方向</strong>：酸滴定碱或碱滴定酸</li>
                <li><strong>待滴定溶液</strong>：可添加多个酸/碱组分，设置总体积</li>
                <li><strong>滴定剂</strong>：同样支持多组分配置</li>
                <li><strong>预设库</strong>：内置常见酸碱（如 HCl、NaOH、CH₃COOH 等），可手动输入自定义组分（强弱酸碱、浓度、元数、pKa/pKb）</li>
                <li><strong>采样密度</strong>：200~2000 点之间可调，默认 800</li>
                <li><strong>最大滴定体积</strong>：可手动设置或开启自动估算</li>
            </ul>

            <h3>2. 单曲线标签页</h3>
            <ul>
                <li><strong>显示原始数据点</strong>：切换是否显示采样点</li>
                <li><strong>朴素标签</strong>：使用更简洁的标注样式</li>
                <li><strong>显示 pH 跃迁/指示剂范围</strong>：高亮跃迁区域和所选指示剂的变色范围</li>
                <li><strong>显示一阶导数</strong>：叠加 dpH/dV 曲线，可单独配置颜色和线型</li>
                <li><strong>显示图例</strong>：控制图例的显示与隐藏</li>
                <li><strong>跃迁判断阈值</strong>：滑动条调节跃迁判定的严格程度</li>
                <li><strong>取点功能</strong>：按体积取点、按 pH 取点、长按图表添加固定标记</li>
                <li><strong>外观设置</strong>：折叠面板内可调整曲线颜色、线型、点型、网格、宽高比等</li>
                <li><strong>保存当前曲线</strong>：将当前曲线加入保存列表，用于多曲线对比与分布分析</li>
                <li><strong>生成 Mathematica 代码</strong>：导出可在 Mathematica 中运行的计算代码</li>
            </ul>

            <h3>3. 多曲线标签页</h3>
            <ul>
                <li>从已保存曲线中选择多条进行同图对比</li>
                <li>每条曲线可独立调整颜色、线型、点型、点大小</li>
                <li>支持按体积或 pH 在指定曲线上取点</li>
                <li>支持图例显示控制和网格控制</li>
            </ul>

            <h3>4. 浓度分布标签页</h3>
            <ul>
                <li><strong>纵轴模式</strong>：浓度 / −log c (log c) / 总量 / −log 总量 (log 总量)</li>
                <li><strong>横轴模式</strong>：滴定体积 V 或 pH</li>
                <li><strong>log 符号切换</strong>：在 log 模式下可切换正负号</li>
                <li><strong>组分选择</strong>：勾选要显示的物种（默认隐藏 H⁺ 和 OH⁻）</li>
                <li><strong>每条曲线样式</strong>：可独立设置颜色、线型、点型、点大小、点填充/描边色</li>
                <li><strong>自定义组合曲线</strong>：通过点击组分标签和运算符号（+ − × ÷ ( ) ^ 及数字 0-9）构建表达式，例如 [HA]+[A⁻]、[H⁺]·[OH⁻]、[A⁻]/[HA] 等</li>
                <li><strong>分布图取点</strong>：按体积或 pH 在选定曲线上取点</li>
            </ul>

            <h3>5. 主题与图表风格</h3>
            <ul>
                <li><strong>深色/浅色主题</strong>：适合不同环境</li>
                <li><strong>标准/论文风格</strong>：论文风格使用黑白线条，适合学术发表</li>
                <li><strong>界面语言</strong>：中文 / English 切换</li>
            </ul>

            <h3>6. 数据导出</h3>
            <ul>
                <li>所有图表支持导出 PNG 或 JPG，可选 1x/2x/3x 倍率</li>
                <li>可生成 Mathematica 计算代码用于深入分析</li>
            </ul>

            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border-color);">
                <p style="font-size: 0.82rem; color: #888; line-height: 1.6; margin: 0;">
                    <strong>程序设计：</strong>北京航空航天大学 士谔书院 乔家祺　团队负责人：北京航空航天大学 士谔书院 刘韦嘉
                </p>
            </div>

            <div style="margin-top: 16px; padding: 12px 14px; border: 1px solid rgba(128,128,128,0.25); border-radius: 8px; background: rgba(128,128,128,0.06);">
                <p style="font-size: 0.78rem; color: #888; font-weight: 600; margin: 0 0 8px 0;">免责声明</p>
                <p style="font-size: 0.72rem; color: #888; line-height: 1.7; margin: 0;">
                    1. 作者授予您一份非排他性且不可转让的免费软件许可，允许您在家中、课堂或学术实验室中将该程序用于个人或教育用途。如果您打算将该程序用于商业用途，包括但不限于任何盈利性的非教育活动或有偿出售或分发该程序，您必须事先获得作者的书面许可。<br><br>
                    2. 作者保留自主更新该程序及修改本条款与条件的权利，无需向您发出通知或承担任何责任。您同意受经修改的条款与条件约束。<br><br>
                    3. 作者不对您（或您的同事、学生）使用该程序及与其协同运行的第三方软件所产生的任何损害承担责任。该程序以现状提供，不附带任何形式的保证——无论明示、默示或法定，包括但不限于适销性、特定用途适用性及不侵犯专有权利的保证。作者亦不对该程序的安全性、可靠性、准确性、稳定性、收敛性及性能作出任何保证。<br><br>
                    4. 您应理解并同意：下载和/或使用该程序系您自行决定并承担风险，因使用该程序获得错误信息或结果而产生的一切后果，均由您自行承担。<br><br>
                    5. 在任何情况下，作者均不对用户因使用或误用该程序所产生的任何责任负责。若您接受上述条款与条件，即有权免费无限期、无次数限制地使用该程序。
                </p>
            </div>
        ` : `
            <h2>Acid-Base Titration S-Curve Plotting (ATSC-Plot)</h2>
            <p style="margin-bottom: 14px; color: var(--text-secondary); line-height: 1.6;">A program to compute and plot pH-volume titration curves, species distribution profiles, and related analyses for acid-base titrations.</p>

            <h3>1. Parameters</h3>
            <ul>
                <li><strong>Direction</strong>: Titrate base with acid, or acid with base</li>
                <li><strong>Solution</strong>: Multiple acid/base components and total volume</li>
                <li><strong>Titrant</strong>: Multi-component support</li>
                <li><strong>Preset library</strong>: Built-in common acids/bases (HCl, NaOH, CH₃COOH, etc.); manual entry supports strong/weak, concentration, valence, pKa/pKb</li>
                <li><strong>Sampling density</strong>: 200-2000 points (default 800)</li>
                <li><strong>Max titrant volume</strong>: Manual or auto-estimate</li>
            </ul>

            <h3>2. Single-curve tab</h3>
            <ul>
                <li>Show raw data points; plain labels; pH leap / indicator range; first derivative (with own color and line style); legend toggle</li>
                <li>Leap threshold slider</li>
                <li>Pick by volume / pH; long-press to add fixed markers</li>
                <li>Appearance panel: color, line style, point style, grid, aspect ratio</li>
                <li>Save current curve to the list for comparison and distribution analysis</li>
                <li>Export Mathematica code</li>
            </ul>

            <h3>3. Multi-curve tab</h3>
            <ul>
                <li>Compare multiple saved curves on the same chart</li>
                <li>Independent style per curve (color, line, marker, size)</li>
                <li>Point picking on a chosen target curve; legend & grid controls</li>
            </ul>

            <h3>4. Distribution tab</h3>
            <ul>
                <li>Vertical axis: c / -log c / total / -log total (log sign switchable)</li>
                <li>Horizontal axis: V or pH</li>
                <li>Component visibility (H⁺ and OH⁻ hidden by default)</li>
                <li>Per-curve style settings</li>
                <li>Custom expression curves: build from species labels and operators (+ − × ÷ ( ) ^ and digits 0-9)</li>
                <li>Point picking in distribution</li>
            </ul>

            <h3>5. Theme & style</h3>
            <ul>
                <li>Dark / Light theme; Standard / Paper style; Chinese / English UI</li>
            </ul>

            <h3>6. Export</h3>
            <ul>
                <li>PNG / JPG export with 1x / 2x / 3x scale</li>
                <li>Mathematica code generation</li>
            </ul>

            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border-color);">
                <p style="font-size: 0.82rem; color: #888; line-height: 1.6; margin: 0;">
                    <strong>Program Design:</strong> Qiao Jiaqi, Shi'e College, Beihang University (BUAA). Team Lead: Liu Weijia, Shi'e College, Beihang University (BUAA)
                </p>
            </div>

            <div style="margin-top: 16px; padding: 12px 14px; border: 1px solid rgba(128,128,128,0.25); border-radius: 8px; background: rgba(128,128,128,0.06);">
                <p style="font-size: 0.78rem; color: #888; font-weight: 600; margin: 0 0 8px 0;">Disclaimer</p>
                <p style="font-size: 0.72rem; color: #888; line-height: 1.7; margin: 0;">
                    1. The author grants you a non-exclusive, non-transferable, free license to use this program for personal or educational purposes at home, in the classroom, or in academic laboratories. For any commercial use, including but not limited to any for-profit non-educational activity or paid sale/distribution of the program, you must obtain prior written permission from the author.<br><br>
                    2. The author reserves the right to update the program and modify these terms and conditions without notice or liability. You agree to be bound by such modified terms and conditions.<br><br>
                    3. The author is not responsible for any damages incurred by you (or your colleagues or students) from using this program and any third-party software that runs in conjunction with it. The program is provided "as is", without warranty of any kind, whether express, implied or statutory, including but not limited to merchantability, fitness for a particular purpose, and non-infringement of proprietary rights. The author also makes no warranty as to the security, reliability, accuracy, stability, convergence, or performance of the program.<br><br>
                    4. You understand and agree that downloading and/or using this program is at your sole discretion and risk; you bear all consequences arising from any erroneous information or results produced by use of the program.<br><br>
                    5. In no event shall the author be liable for any responsibility arising from the use or misuse of the program. If you accept the above terms and conditions, you may use the program free of charge with no time or frequency limits.
                </p>
            </div>
        `;
        helpContent.innerHTML = helpHTML;
    }
    renderHelpContent();
    updateToggleLabels();
    createMixtureComponent(++solutionComponentCount, null, false);
    createMixtureComponent(++titrantComponentCount, null, true);
    updateCurveNameFromComponents();
    applyMobileViewportAdjustments();
});

(function () {
    function installDesktopWorkspaceSwitch() {
        const main = document.querySelector('.main-content');
        const switcher = document.getElementById('desktopWorkspaceSwitch');
        if (!main || !switcher) return;
        const buttons = Array.from(switcher.querySelectorAll('[data-desktop-view]'));
        function isDesktopLayout() {
            return window.matchMedia('(min-width: 901px)').matches;
        }
        function resizeVisibleCharts() {
            window.setTimeout(function () {
                try {
                    if (Array.isArray(chartTabs)) {
                        chartTabs.forEach(function (tab) {
                            if (tab && tab.chart && typeof tab.chart.resize === 'function') {
                                tab.chart.resize();
                            }
                        });
                    }
                    const distCanvas = document.getElementById('distributionChart');
                    const distChart = distCanvas && window.Chart ? Chart.getChart(distCanvas) : null;
                    if (distChart && typeof distChart.resize === 'function') {
                        distChart.resize();
                    }
                    const compCanvas = document.getElementById('compositeChart');
                    const compChart = compCanvas && window.Chart ? Chart.getChart(compCanvas) : null;
                    if (compChart && typeof compChart.resize === 'function') {
                        compChart.resize();
                    }
                } catch (error) {}
            }, 120);
        }
        window.setDesktopWorkspaceView = function (view) {
            const normalized = ['distribution', 'composite'].includes(view) ? view : 'charts';
            if (normalized === 'distribution' && typeof window.syncDistributionToActiveSingleTab === 'function') {
                window.syncDistributionToActiveSingleTab();
            }
            if (normalized === 'composite' && typeof window.renderCompositeChart === 'function') {
                try { window.renderCompositeChart(); } catch (e) { console.warn('renderCompositeChart error:', e); }
            }
            main.classList.toggle('desktop-show-distribution', normalized === 'distribution');
            main.classList.toggle('desktop-show-composite', normalized === 'composite');
            buttons.forEach(function (btn) {
                btn.classList.toggle('active', btn.dataset.desktopView === normalized);
            });
            resizeVisibleCharts();
        };
        buttons.forEach(function (btn) {
            btn.addEventListener('click', function () {
                window.setDesktopWorkspaceView(btn.dataset.desktopView);
            });
        });
        window.addEventListener('resize', function () {
            if (isDesktopLayout()) resizeVisibleCharts();
        }, { passive: true });
        window.setDesktopWorkspaceView('charts');
    }
    document.addEventListener('DOMContentLoaded', installDesktopWorkspaceSwitch);
})();

(function () {
    function installDistributionPageNavigation() {
        const main = document.querySelector('.main-content');
        const nav = document.getElementById('appPageNav');
        if (!main || !nav) return;
        nav.querySelectorAll('[data-app-page], #appPageFab').forEach(function (node) {
            const clean = node.cloneNode(true);
            node.replaceWith(clean);
        });
        const fab = document.getElementById('appPageFab');
        const actions = Array.from(nav.querySelectorAll('[data-app-page]'));
        const dots = Array.from(nav.querySelectorAll('.app-page-dot'));
        function resizeVisibleCharts() {
            setTimeout(() => {
                try {
                    const distCanvas = document.getElementById('distributionChart');
                    const distChart = distCanvas && window.Chart ? Chart.getChart(distCanvas) : null;
                    if (distChart && typeof distChart.resize === 'function') distChart.resize();
                    const compCanvas = document.getElementById('compositeChart');
                    const compChart = compCanvas && window.Chart ? Chart.getChart(compCanvas) : null;
                    if (compChart && typeof compChart.resize === 'function') compChart.resize();
                    if (Array.isArray(chartTabs)) {
                        chartTabs.forEach(tab => {
                            if (tab && tab.chart && typeof tab.chart.resize === 'function') tab.chart.resize();
                        });
                    }
                } catch (error) {}
            }, 120);
        }
        function showPage(index) {
            const page = Math.max(0, Math.min(3, Number(index) || 0));
            if (page === 2 && typeof window.syncDistributionToActiveSingleTab === 'function') {
                window.syncDistributionToActiveSingleTab();
            }
            if (page === 3 && typeof window.renderCompositeChart === 'function') {
                try { window.renderCompositeChart(); } catch (e) { console.warn('renderCompositeChart error:', e); }
            }
            main.classList.toggle('show-chart-page', page === 1);
            main.classList.toggle('show-distribution-page', page === 2);
            main.classList.toggle('show-composite-page', page === 3);
            actions.forEach(btn => btn.classList.toggle('active', Number(btn.dataset.appPage) === page));
            dots.forEach((dot, i) => dot.classList.toggle('active', i === page));
            nav.classList.remove('open');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            if (page > 0) resizeVisibleCharts();
        }
        if (fab) {
            fab.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                nav.classList.toggle('open');
            });
        }
        actions.forEach(btn => {
            btn.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                if (!nav.classList.contains('open')) return;
                showPage(btn.dataset.appPage);
            }, true);
        });
        document.addEventListener('click', event => {
            if (!nav.contains(event.target)) nav.classList.remove('open');
        }, true);
        showPage(0);
    }
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(installDistributionPageNavigation, 20);
    });
})();
