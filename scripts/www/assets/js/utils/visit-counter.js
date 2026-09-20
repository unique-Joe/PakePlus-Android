/* Visit counter: anti-refresh + large number formatting + PV/UV toggle */
(function(){
    var KEY='bsz_reported',COOLDOWN=60*1000;
    try{var ts=sessionStorage.getItem(KEY);if(ts&&(Date.now()-parseInt(ts,10))<COOLDOWN){window.busuanzi=window.busuanzi||{};window.busuanzi.__skip=true;}else{sessionStorage.setItem(KEY,String(Date.now()));}}catch(e){}
    function fmtVisit(n){
        var s=String(n).replace(/,/g,'');
        var num=Number(s);
        if(!Number.isFinite(num)||num<0)return n;
        var isZh = (typeof uiLanguage !== 'undefined' && uiLanguage === 'zh');
        if(isZh){
            if(num>=1e8)return(num/1e8).toFixed(1).replace(/\.0$/,'')+t('亿','00M');
            if(num>=1e4)return(num/1e4).toFixed(1).replace(/\.0$/,'')+t('万','0K');
        } else {
            if(num>=1e9)return(num/1e9).toFixed(1).replace(/\.0$/,'')+'B';
            if(num>=1e6)return(num/1e6).toFixed(1).replace(/\.0$/,'')+'M';
            if(num>=1e3)return(num/1e3).toFixed(1).replace(/\.0$/,'')+'K';
        }
        return n;
    }
    function formatEl(el){if(!el)return;var raw=el.textContent.replace(/,/g,'');var num=parseInt(raw,10);if(Number.isFinite(num)&&num>=1e4)el.textContent=fmtVisit(num);}
    document.addEventListener('DOMContentLoaded',function(){
        var pvEl=document.getElementById('busuanzi_site_pv');
        var uvEl=document.getElementById('busuanzi_site_uv');
        var counter=document.getElementById('visitCounter');
        var label=document.getElementById('visitLabel');
        var mode=sessionStorage.getItem('bsz_mode')||'pv';
        function applyMode(m){
            mode=m;sessionStorage.setItem('bsz_mode',m);
            if(label)label.textContent=m==='pv'?t('访问量：','Visits: '):t('访客数：','Visitors: ');
            var src=m==='pv'?pvEl:uvEl;
            var tgt=document.getElementById('visitNum');
            if(src&&tgt){formatEl(src);tgt.textContent=src.textContent;}
        }
        if(counter)counter.addEventListener('click',function(){applyMode(mode==='pv'?'uv':'pv');});
        if(window.busuanzi&&window.busuanzi.__skip){
            if(pvEl)pvEl.textContent=sessionStorage.getItem('bsz_cached_pv')||'--';
            if(uvEl)uvEl.textContent=sessionStorage.getItem('bsz_cached_uv')||'--';
        }
        applyMode(mode);
        function cacheVal(el,key){if(!el)return;formatEl(el);try{sessionStorage.setItem(key,el.textContent);}catch(e){}}
        var obs=new MutationObserver(function(){
            cacheVal(pvEl,'bsz_cached_pv');cacheVal(uvEl,'bsz_cached_uv');applyMode(mode);
        });
        if(pvEl)obs.observe(pvEl,{childList:true});
        if(uvEl)obs.observe(uvEl,{childList:true});
    });
})();
