// v7.0: axis arrow plugin for Chart.js
const axisArrowPlugin = {
    id: 'axisArrow',
    afterDraw(chart) {
        const opts = chart.options.plugins.axisArrow || {};
        if (!opts.x && !opts.y) return;
        const ctx = chart.ctx;
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;
        if (!xScale || !yScale) return;
        const arrowSize = 8;
        ctx.save();
        ctx.fillStyle = opts.color || '#333';
        if (opts.x) {
            const tipX = xScale.right;
            const y = yScale.bottom;
            ctx.beginPath();
            ctx.moveTo(tipX, y);
            ctx.lineTo(tipX - arrowSize, y - arrowSize / 2);
            ctx.lineTo(tipX - arrowSize, y + arrowSize / 2);
            ctx.closePath();
            ctx.fill();
        }
        if (opts.y) {
            const x = xScale.left;
            const tipY = yScale.top;
            ctx.beginPath();
            ctx.moveTo(x, tipY);
            ctx.lineTo(x - arrowSize / 2, tipY + arrowSize);
            ctx.lineTo(x + arrowSize / 2, tipY + arrowSize);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }
};
Chart.register(axisArrowPlugin);
