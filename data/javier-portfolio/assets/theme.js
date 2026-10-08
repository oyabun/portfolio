/* Theme toggle (persisted), scroll reveal, animated counters */
(function(){
  var root=document.documentElement;
  var saved;
  try{ saved=localStorage.getItem('ja-theme'); }catch(e){}
  if(!saved){ saved = (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark':'light'; }
  root.setAttribute('data-theme', saved);

  function label(){ return root.getAttribute('data-theme')==='dark' ? 'Light' : 'Dark'; }

  document.addEventListener('DOMContentLoaded', function(){
    document.querySelectorAll('[data-toggle-theme]').forEach(function(btn){
      var span=btn.querySelector('.lbl'); if(span) span.textContent=label();
      btn.addEventListener('click', function(){
        var next = root.getAttribute('data-theme')==='dark' ? 'light':'dark';
        root.setAttribute('data-theme', next);
        try{ localStorage.setItem('ja-theme', next); }catch(e){}
        document.querySelectorAll('[data-toggle-theme] .lbl').forEach(function(s){ s.textContent=label(); });
      });
    });

    // reveal
    var rio=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');rio.unobserve(e.target);}})},{threshold:.12});
    document.querySelectorAll('.reveal').forEach(function(el){rio.observe(el);});

    // counters
    function animate(el){
      var target=parseFloat(el.dataset.count), suffix=el.dataset.suffix||"";
      var dec=(target%1!==0)?1:0, dur=1300, t0=performance.now();
      function step(t){var p=Math.min((t-t0)/dur,1), e=1-Math.pow(1-p,3), v=target*e;
        el.textContent=(target>=1000?Math.round(v).toLocaleString():v.toFixed(dec))+suffix;
        if(p<1)requestAnimationFrame(step);}
      requestAnimationFrame(step);
    }
    var cio=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){animate(e.target);cio.unobserve(e.target);}})},{threshold:.5});
    document.querySelectorAll('[data-count]').forEach(function(el){cio.observe(el);});
  });
})();
