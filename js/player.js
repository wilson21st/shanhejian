// v132 one player (css/player.css): the subtitle band and the cards over the picture, for shuoshu.html and design-poem.html.
// The pages keep writing their transcript into #tx exactly as before (tests and the 文稿 sheet read it); this watches #tx:
//  - the clip being spoken (the last <span> of .ln.cur) is shown in #sub, at most MAX lines. A clip that would need more is
//    cut into pages at its punctuation (measured, so it holds at any width or font) and the page being said is shown.
//  - cards (questions, books, 史书原文, 出处, 字词, 书完) are moved out of #tx into #cards over the picture. They stay until the
//    show moves on: the next spoken line after the dock's choices were answered clears them; ✕ folds them.
// PL.stat() → {maxLines, pages, subs, cards} for the tests.
(function () {
  const MAX = 3, CARD = ['qcard', 'q', 'books', 'cite', 'src', 'word', 'endcard'];
  const st = { maxLines: 0, pages: 0, subs: 0, cards: 0, over: 0 };
  let sub, tx, cards, choices, meas, lastSp = null, lastTxt = '', pages = null, pageIx = -1, clearNext = false, raf = 0;
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  function lh() { return parseFloat(getComputedStyle(sub.querySelector('.tx') || sub).lineHeight) || 27; }
  // greedy pages of whole clauses (split after ，。！？；：、—), a clause too long for one page split by characters
  function paginate(t, prefix) {
    const tx0 = sub.querySelector('.tx'); meas.style.width = tx0.clientWidth + 'px'; meas.style.font = getComputedStyle(tx0).font;
    meas.style.letterSpacing = getComputedStyle(tx0).letterSpacing; const L = lh(), fits = s => { meas.innerHTML = prefix + esc(s); return meas.offsetHeight <= MAX * L + 1; };
    if (fits(t)) return [[0, t.length]];
    const parts = t.match(/[^，。！？；：、—…]*[，。！？；：、—…」』”]*/g).filter(Boolean), out = []; let a = 0, cur = '';
    for (const p of parts) {
      if (cur && !fits(cur + p)) { out.push([a, a + cur.length]); a += cur.length; cur = ''; }
      if (!cur && !fits(p)) { let s = ''; for (const ch of p) { if (s && !fits(s + ch)) { out.push([a, a + s.length]); a += s.length; s = ''; } s += ch; } cur = s; }
      else cur += p;
    }
    if (cur) out.push([a, a + cur.length]);
    return out;
  }
  function render() {
    raf = 0; const cur = tx.querySelector('.ln.cur');
    const sps = cur ? [...cur.querySelectorAll('span')].filter(s => !s.classList.contains('seal') && !s.closest('.seal') && !s.closest('.nm')) : [];
    const sp = sps[sps.length - 1]; if (!sp) return;
    const full = sp.textContent, hid = sp.querySelector('i'), k = full.length - (hid ? hid.textContent.length : 0);
    const nm = cur.querySelector('.nm'), seal = cur.querySelector('.seal'), who = nm && nm.textContent ? `<span class="who" style="--c:${seal ? getComputedStyle(seal).getPropertyValue('--c') : ''}">${esc(nm.textContent)}</span>` : '';
    const fresh = sp !== lastSp || full !== lastTxt;
    if (fresh) { lastSp = sp; lastTxt = full; st.subs++;
      sub.className = ['peng', 'hook', 'hook2', 'yin'].filter(c => cur.classList.contains(c)).join(' ');
      sub.innerHTML = '<span class="tx"></span>'; pages = paginate(full, who); pageIx = -1; if (pages.length > 1) st.pages++; }
    const at = Math.max(0, Math.min(full.length - 1, k - 1)), ix = Math.max(0, pages.findIndex(([a, b]) => at >= a && at < b));
    const [a, b] = pages[ix], t = sub.querySelector('.tx');
    t.innerHTML = (ix === 0 ? who : '') + esc(full.slice(a, Math.max(a, Math.min(b, k)))) + '<i>' + esc(full.slice(Math.max(a, Math.min(b, k)), b)) + '</i>';
    sub.querySelector('.pg')?.remove(); if (pages.length > 1) sub.insertAdjacentHTML('beforeend', `<span class="pg">${ix + 1}/${pages.length}</span>`);
    if (ix !== pageIx) { pageIx = ix; sub.classList.remove('in'); void sub.offsetWidth; sub.classList.add('in'); }
    const n = Math.round(t.offsetHeight / lh()); if (n > st.maxLines) st.maxLines = n; if (n > MAX) st.over++;
  }
  function cardsIn(nodes) {
    for (const n of nodes) {
      if (n.nodeType !== 1 || n.parentNode !== tx || !CARD.some(c => n.classList.contains(c))) continue;
      if (clearNext) clear();
      if (!cards.querySelector('.cx')) { const x = document.createElement('button'); x.className = 'cx'; x.textContent = '收起 ▾';
        x.onclick = () => { cards.classList.toggle('fold'); x.textContent = cards.classList.contains('fold') ? '展开 ▴' : '收起 ▾'; }; cards.appendChild(x); }
      // 出处 at the end of a poem: folded, so the finished calligraphy stays in view
      if (n.classList.contains('src')) { cards.classList.add('fold'); cards.querySelector('.cx').textContent = '出处 ▴'; }
      cards.appendChild(n); st.cards++; requestAnimationFrame(() => n.scrollIntoView({ block: 'nearest' }));
    }
  }
  function clear() { clearNext = false; cards.innerHTML = ''; cards.classList.remove('fold'); }
  window.PL = {
    init(o = {}) {
      document.body.classList.add('pl'); tx = document.getElementById('tx'); choices = document.getElementById('choices');
      sub = document.createElement('div'); sub.id = 'sub'; sub.setAttribute('aria-live', 'polite'); sub.innerHTML = '<span class="tx"></span>'; tx.after(sub);
      cards = document.createElement('div'); cards.id = 'cards'; document.getElementById('stage').appendChild(cards);
      meas = document.createElement('div'); meas.style.cssText = 'position:absolute;visibility:hidden;left:-9999px;top:0;word-break:break-all'; document.body.appendChild(meas);
      const lb = document.createElement('button'); lb.id = 'logb'; lb.textContent = '文'; lb.title = '文稿'; lb.setAttribute('aria-label', '文稿');
      lb.onclick = () => { const a = document.getElementById('app'); a.classList.toggle('log'); lb.classList.toggle('on', a.classList.contains('log')); if (a.classList.contains('log')) tx.scrollTop = tx.scrollHeight; };
      document.getElementById('snd').before(lb);
      if (o.emb) document.body.classList.add('emb');
      new MutationObserver(ms => {
        for (const m of ms) if (m.target === tx) {
          // a new 回 / show wipes #tx (not a card moving to #cards): the cards and the subtitle go too
          if ([...m.removedNodes].some(n => n.nodeType === 1 && n.parentNode !== cards)) { clear(); lastSp = null; sub.className = ''; sub.innerHTML = '<span class="tx"></span>'; }
          cardsIn(m.addedNodes);
          if (clearNext && [...m.addedNodes].some(n => n.nodeType === 1 && n.classList.contains('ln') && n.classList.contains('cur'))) clear();
        }
        if (!raf) raf = requestAnimationFrame(render);
      }).observe(tx, { childList: true, subtree: true, characterData: true });
      // answered: the next spoken line takes the cards away
      let had = false; new MutationObserver(() => { const h = choices.childElementCount > 0; if (had && !h) clearNext = true; had = h; }).observe(choices, { childList: true });
    },
    stat: () => ({ ...st }), clear,
  };
})();
