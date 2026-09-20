(function () {
    const HOST_ATTR = 'data-cs-bound';
    const COLOR_PRESETS = [
        '#57a7bd', '#3b82f6', '#1d4ed8', '#0ea5e9', '#06b6d4', '#14b8a6', '#22c55e', '#84cc16',
        '#eab308', '#f59e0b', '#f97316', '#ef4444', '#dc2626', '#ec4899', '#d946ef', '#a855f7',
        '#7c3aed', '#57a7bd', '#57a7bd', '#10b981', '#0d9488', '#0891b2', '#0369a1', '#075985',
        '#1f2937', '#475569', '#94a3b8', '#cbd5e1', '#e5e7eb', '#f8fafc', '#000000', '#ffffff'
    ];
    let openPopup = null;
    function closeAll() {
        if (openPopup) {
            const { popup, trigger } = openPopup;
            popup.classList.remove('cs-open');
            trigger.classList.remove('cs-open');
            setTimeout(() => { if (popup && popup.parentNode) popup.parentNode.removeChild(popup); }, 200);
            openPopup = null;
        }
    }
    function positionPopup(trigger, popup) {
        const rect = trigger.getBoundingClientRect();
        const vh = window.innerHeight;
        const vw = window.innerWidth;
        document.body.appendChild(popup);
        popup.style.visibility = 'hidden';
        popup.style.display = 'block';
        const ph = popup.offsetHeight || 200;
        const pw = popup.offsetWidth || 200;
        let top = rect.bottom + 6;
        if (top + ph > vh - 8) top = Math.max(8, rect.top - ph - 6);
        let left = rect.left;
        if (left + pw > vw - 8) left = Math.max(8, vw - pw - 8);
        popup.style.top = `${top}px`;
        popup.style.left = `${left}px`;
        popup.style.minWidth = `${rect.width}px`;
        popup.style.visibility = '';
    }
    function keepPopupScrollInside(popup) {
        popup.addEventListener('wheel', (e) => {
            const canScroll = popup.scrollHeight > popup.clientHeight;
            if (!canScroll) return;
            const atTop = popup.scrollTop <= 0;
            const atBottom = popup.scrollTop + popup.clientHeight >= popup.scrollHeight - 1;
            if ((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom)) {
                e.preventDefault();
            }
            e.stopPropagation();
        }, { passive: false });
        let touchStartY = 0;
        popup.addEventListener('touchstart', (e) => {
            touchStartY = e.touches && e.touches.length ? e.touches[0].clientY : 0;
        }, { passive: true });
        popup.addEventListener('touchmove', (e) => {
            const canScroll = popup.scrollHeight > popup.clientHeight;
            if (!canScroll || !e.touches || !e.touches.length) return;
            const currentY = e.touches[0].clientY;
            const deltaY = currentY - touchStartY;
            const atTop = popup.scrollTop <= 0;
            const atBottom = popup.scrollTop + popup.clientHeight >= popup.scrollHeight - 1;
            if ((deltaY > 0 && atTop) || (deltaY < 0 && atBottom)) {
                e.preventDefault();
            }
            e.stopPropagation();
        }, { passive: false });
    }
    function getOptionText(opt) {
        return (opt.textContent || opt.value || '').trim();
    }
    function syncTriggerLabel(host) {
        const native = host._native;
        const trigger = host._trigger;
        const label = trigger.querySelector('.cs-label');
        const opt = native.options[native.selectedIndex];
        label.textContent = opt ? getOptionText(opt) : '';
    }
    function buildSelect(native) {
        if (!native || native.getAttribute(HOST_ATTR) === '1') return;
        if (native.multiple) return; // skip multi-select
        native.setAttribute(HOST_ATTR, '1');
        const host = document.createElement('span');
        host.className = 'cs-host';
        if (native.classList.contains('action-btn')) host.classList.add('cs-as-action');
        if (native.classList.contains('small-input')) host.classList.add('cs-as-small');
        if (native.classList.contains('component-type')) host.classList.add('cs-as-component-type');
        if (native.classList.contains('indicator-select')) host.classList.add('cs-as-indicator');
        native.parentNode.insertBefore(host, native);
        native.classList.add('cs-native-hidden');
        host.appendChild(native);
        native.tabIndex = -1;
        native.classList.add('cs-native-hidden');
        native.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopImmediatePropagation();
        }, true);
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'cs-trigger';
        if (native.classList.contains('small-input')) trigger.classList.add('cs-small');
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');
        if (native.disabled) trigger.disabled = true;
        trigger.innerHTML = `<span class="cs-label"></span><span class="cs-caret">▼</span>`;
        host.appendChild(trigger);
        host._native = native;
        host._trigger = trigger;
        syncTriggerLabel(host);
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            if (openPopup && openPopup.host === host) { closeAll(); return; }
            closeAll();
            showPopup(host);
        });
        const observer = new MutationObserver(() => syncTriggerLabel(host));
        observer.observe(native, { childList: true, subtree: true, attributes: true, attributeFilter: ['value'] });
        const origDescriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
        if (origDescriptor && origDescriptor.configurable) {
            Object.defineProperty(native, 'value', {
                configurable: true,
                get() { return origDescriptor.get.call(this); },
                set(v) { origDescriptor.set.call(this, v); syncTriggerLabel(host); }
            });
        }
        native.addEventListener('change', () => syncTriggerLabel(host));
    }
    function showPopup(host) {
        const native = host._native;
        const trigger = host._trigger;
        const popup = document.createElement('div');
        popup.className = 'cs-popup';
        popup.setAttribute('role', 'listbox');
        Array.from(native.options).forEach((opt, i) => {
            if (opt.disabled) return;
            const row = document.createElement('div');
            row.className = 'cs-option';
            if (i === native.selectedIndex) row.classList.add('cs-selected');
            row.innerHTML = `<span>${getOptionText(opt) || '&nbsp;'}</span>`;
            if (i === native.selectedIndex) row.innerHTML += `<span class="cs-option-check"><svg class="icon" aria-hidden="true"><use href="#icon-check"></use></svg></span>`;
            row.addEventListener('click', (e) => {
                e.stopPropagation();
                if (native.selectedIndex !== i) {
                    native.selectedIndex = i;
                    native.dispatchEvent(new Event('input', { bubbles: true }));
                    native.dispatchEvent(new Event('change', { bubbles: true }));
                    syncTriggerLabel(host);
                }
                closeAll();
            });
            popup.appendChild(row);
        });
        openPopup = { host, popup, trigger };
        positionPopup(trigger, popup);
        keepPopupScrollInside(popup);
        requestAnimationFrame(() => {
            popup.classList.add('cs-open');
            trigger.classList.add('cs-open');
        });
    }
    function hexToRgb(hex) {
        const m = /^#?([a-f0-9]{6})$/i.exec(hex);
        if (!m) return { r: 88, g: 166, b: 255 };
        const v = parseInt(m[1], 16);
        return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
    }
    function rgbToHex(r, g, b) {
        const c = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
        return `#${c(r)}${c(g)}${c(b)}`.toLowerCase();
    }
    function syncSwatch(host) {
        const swatch = host._swatch;
        swatch.style.background = host._native.value || '#000000';
    }
    function buildColor(native) {
        if (!native || native.getAttribute(HOST_ATTR) === '1') return;
        native.setAttribute(HOST_ATTR, '1');
        const host = document.createElement('span');
        host.className = 'cs-color-host';
        native.parentNode.insertBefore(host, native);
        native.classList.add('cs-native-hidden');
        host.appendChild(native);
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'cs-color-trigger';
        trigger.innerHTML = `<span class="cs-color-swatch"></span>`;
        host.appendChild(trigger);
        host._native = native;
        host._trigger = trigger;
        host._swatch = trigger.querySelector('.cs-color-swatch');
        syncSwatch(host);
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            if (openPopup && openPopup.host === host) { closeAll(); return; }
            closeAll();
            showColorPopup(host);
        });
        native.addEventListener('change', () => syncSwatch(host));
        native.addEventListener('input', () => syncSwatch(host));
    }
    function showColorPopup(host) {
        const native = host._native;
        const trigger = host._trigger;
        const popup = document.createElement('div');
        popup.className = 'cs-color-popup';
        const cur = native.value || '#57a7bd';
        const { r, g, b } = hexToRgb(cur);
        popup.innerHTML = `
            <div class="cs-color-presets">
                ${COLOR_PRESETS.map(c => `<div class="cs-color-preset" data-color="${c}" style="background:${c}"></div>`).join('')}
            </div>
            <div class="cs-color-row">
                <div class="cs-color-preview"></div>
                <input type="text" class="cs-hex-input" maxlength="7" value="${cur}">
            </div>
            <div class="cs-color-sliders">
                <label class="cs-color-slider"><span>R</span><input type="range" min="0" max="255" data-ch="r" value="${r}"><span data-ch-val="r">${r}</span></label>
                <label class="cs-color-slider"><span>G</span><input type="range" min="0" max="255" data-ch="g" value="${g}"><span data-ch-val="g">${g}</span></label>
                <label class="cs-color-slider"><span>B</span><input type="range" min="0" max="255" data-ch="b" value="${b}"><span data-ch-val="b">${b}</span></label>
            </div>
        `;
        const preview = popup.querySelector('.cs-color-preview');
        const hexInput = popup.querySelector('.cs-hex-input');
        const sliders = {
            r: popup.querySelector('input[data-ch="r"]'),
            g: popup.querySelector('input[data-ch="g"]'),
            b: popup.querySelector('input[data-ch="b"]')
        };
        const sliderVals = {
            r: popup.querySelector('[data-ch-val="r"]'),
            g: popup.querySelector('[data-ch-val="g"]'),
            b: popup.querySelector('[data-ch-val="b"]')
        };
        let state = { r, g, b };
        function applyState(commit) {
            const hex = rgbToHex(state.r, state.g, state.b);
            preview.style.background = hex;
            hexInput.value = hex.toUpperCase();
            Object.keys(sliders).forEach(k => {
                sliders[k].value = state[k];
                sliderVals[k].textContent = state[k];
            });
            popup.querySelectorAll('.cs-color-preset').forEach(el => {
                el.classList.toggle('cs-active', el.dataset.color.toLowerCase() === hex.toLowerCase());
            });
            if (commit) {
                native.value = hex;
                native.dispatchEvent(new Event('input', { bubbles: true }));
                native.dispatchEvent(new Event('change', { bubbles: true }));
                syncSwatch(host);
            }
        }
        applyState(false);
        popup.querySelectorAll('.cs-color-preset').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const c = hexToRgb(el.dataset.color);
                state = c;
                applyState(true);
            });
        });
        Object.keys(sliders).forEach(k => {
            sliders[k].addEventListener('input', () => {
                state[k] = parseInt(sliders[k].value, 10) || 0;
                applyState(true);
            });
        });
        hexInput.addEventListener('input', () => {
            let v = hexInput.value.trim();
            if (!v.startsWith('#')) v = '#' + v;
            if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                state = hexToRgb(v);
                applyState(true);
            }
        });
        openPopup = { host, popup, trigger };
        positionPopup(trigger, popup);
        keepPopupScrollInside(popup);
        requestAnimationFrame(() => {
            popup.classList.add('cs-open');
            trigger.classList.add('cs-open');
        });
    }
    document.addEventListener('click', (e) => {
        if (!openPopup) return;
        if (openPopup.popup.contains(e.target)) return;
        if (openPopup.trigger.contains(e.target)) return;
        closeAll();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAll();
    });
    window.addEventListener('resize', closeAll);
    window.addEventListener('scroll', (e) => {
        if (!openPopup) return;
        if (openPopup.popup && openPopup.popup.contains(e.target)) return;
        closeAll();
    }, true);
    function scanAndBind(root) {
        root = root || document;
        root.querySelectorAll('select').forEach(buildSelect);
        root.querySelectorAll('input[type="color"]').forEach(buildColor);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => scanAndBind());
    } else {
        scanAndBind();
    }
    const mo = new MutationObserver((mutations) => {
        mutations.forEach(m => {
            m.addedNodes.forEach(node => {
                if (!(node instanceof HTMLElement)) return;
                if (node.matches && node.matches('select')) buildSelect(node);
                else if (node.matches && node.matches('input[type="color"]')) buildColor(node);
                if (node.querySelectorAll) {
                    node.querySelectorAll('select').forEach(buildSelect);
                    node.querySelectorAll('input[type="color"]').forEach(buildColor);
                }
            });
        });
    });
    mo.observe(document.body, { childList: true, subtree: true });
    window.csRescan = scanAndBind;
})();
