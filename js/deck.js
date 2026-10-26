// SLIDE CONTROLLER: keys, wheel, swipe, stage scaling, #N deep links
// Additions for Andi's talk:
// - data-scene="id.step" on a slide picks the 3D shot (and the stage's data-slide / data-step) without
//   renaming the slide, so several slides can share one shot sequence (camera, then mics, ...).
// - Keynote mode (K, or ?talk=keynote) skips slides marked data-keynote="cut".
// - Speaker notes (N): <aside class="notes"> in each slide, in a second window, or over the slide if the
//   browser refuses the window.
// - Videos play only while their slide is shown; <video data-click> starts with sound on a click.
class SlidePresentation {
    constructor() {
        this.slides = [...document.querySelectorAll('.slide')];
        this.stage = document.getElementById('deckStage');
        this.current = 0;
        this.step = 0;
        this.lock = 0;
        this.t0 = Date.now();
        try { this.keynote = new URLSearchParams(location.search).get('talk') === 'keynote' || localStorage.getItem('andi-deck-talk') === 'keynote'; } catch { this.keynote = false; }
        this.scaleStage();
        addEventListener('resize', () => this.scaleStage());
        addEventListener('keydown', e => this.key(e));
        addEventListener('wheel', e => {
            if (Date.now() < this.lock || Math.abs(e.deltaY) < 20) return;
            this.lock = Date.now() + 900;
            this.next(Math.sign(e.deltaY));
        }, { passive: true });
        let x0 = null;
        addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
        addEventListener('touchend', e => {
            if (x0 === null) return;
            const dx = e.changedTouches[0].clientX - x0;
            if (Math.abs(dx) > 50) this.next(-Math.sign(dx));
            x0 = null;
        });
        for (const v of document.querySelectorAll('video[data-click]')) {
            v.addEventListener('click', e => { e.stopPropagation(); v.muted = false; v.paused ? v.play().catch(() => {}) : v.pause(); });
        }
        const [slide, step] = location.hash.slice(1).split('.').map(Number); // #3.2 = slide 3, focus step 2
        this.go((slide || 1) - 1);
        if (step) { this.step = Math.min(step, this.steps(this.current)); this.emit(); }
    }
    key(e) {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); this.next(1); }
        else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); this.next(-1); }
        else if (e.key === 'Home') this.go(0);
        else if (e.key === 'End') this.go(this.slides.length - 1);
        else if (e.key === 'n' || e.key === 'N') this.notes();
        else if (e.key === 'k' || e.key === 'K') this.setKeynote(!this.keynote);
        else if (e.key === 'f' || e.key === 'F') { const d = document; (d.fullscreenElement ? d.exitFullscreen() : d.documentElement.requestFullscreen())?.catch?.(() => {}); }
    }
    scaleStage() {
        const f = Math.min(innerWidth / 1920, innerHeight / 1080);
        this.stage.style.transform = `translate(${(innerWidth - 1920 * f) / 2}px, ${(innerHeight - 1080 * f) / 2}px) scale(${f})`;
    }
    // A slide with data-steps="N" takes N extra presses before the next slide (camera focus steps).
    steps(i) { return +(this.slides[i]?.dataset.steps ?? 0); }
    // The 3D shot and stage state of slide i at its step s.
    scene(i = this.current, s = this.step) {
        const el = this.slides[i];
        const [id, base] = (el.dataset.scene || el.dataset.id).split('.');
        return { id, step: (+base || 0) + s };
    }
    skipped(i) { return this.keynote && this.slides[i]?.dataset.keynote === 'cut'; }
    setKeynote(on) {
        this.keynote = on;
        try { localStorage.setItem('andi-deck-talk', on ? 'keynote' : 'university'); } catch {}
        this.flash(on ? 'Keynote: cut slides skipped' : 'University: every slide');
        this.emit();
    }
    flash(text) {
        let el = document.getElementById('deckToast');
        if (!el) { el = Object.assign(document.createElement('div'), { id: 'deckToast' }); document.body.append(el); }
        el.textContent = text; el.classList.add('on');
        clearTimeout(this.toastT); this.toastT = setTimeout(() => el.classList.remove('on'), 1600);
    }
    next(dir) {
        const step = this.step + dir;
        if (step >= 0 && step <= this.steps(this.current)) { this.step = step; this.emit(); return; }
        let i = this.current + dir;
        while (this.slides[i] && this.skipped(i)) i += dir;
        if (this.slides[i]) this.go(i, dir < 0);
    }
    go(i, atEnd = false) {
        this.current = Math.max(0, Math.min(i, this.slides.length - 1));
        this.step = atEnd ? this.steps(this.current) : 0;
        this.slides.forEach((s, j) => { s.classList.toggle('active', j === this.current); s.classList.toggle('visible', j === this.current); });
        document.getElementById('progress').style.width = `${((this.current + 1) / this.slides.length) * 100}%`;
        for (const v of document.querySelectorAll('.slide video')) {
            const here = v.closest('.slide') === this.slides[this.current];
            if (here && v.hasAttribute('autoplay')) { v.currentTime = 0; v.play().catch(() => {}); }
            else if (!here) { v.pause(); if (v.hasAttribute('data-click')) { v.currentTime = 0; v.muted = true; } }
        }
        this.emit();
    }
    emit() {
        const slide = this.slides[this.current], sc = this.scene();
        this.stage.dataset.slide = sc.id;
        this.stage.dataset.step = sc.step;
        this.stage.dataset.talk = this.keynote ? 'keynote' : 'uni';
        // Step-dependent elements: [data-only="0 2"] at those steps, [data-from="1"] from that step on.
        for (const el of slide.querySelectorAll('[data-only]')) el.classList.toggle('on', el.dataset.only.split(' ').map(Number).includes(this.step));
        for (const el of slide.querySelectorAll('[data-from]')) el.classList.toggle('on', this.step >= +el.dataset.from);
        try { history.replaceState(null, '', `#${this.current + 1}${this.step ? '.' + this.step : ''}`); } catch {} // a sandboxed frame may refuse
        dispatchEvent(new CustomEvent('slidechange', { detail: { slide: this.current, id: sc.id, step: sc.step } }));
        this.renderNotes();
    }

    /* --- Speaker notes --- */
    notes() {
        if (this.notesWin && !this.notesWin.closed) { this.notesWin.focus(); return; }
        let w = null;
        try { w = window.open('', 'andi-deck-notes', 'width=900,height=700'); } catch {}
        if (!w) { document.body.classList.toggle('notes-on'); this.renderNotes(); return; }
        w.document.title = 'Speaker notes';
        w.document.body.innerHTML = '<div id="n"></div>';
        const st = w.document.createElement('style');
        st.textContent = `body{margin:0;background:#16161a;color:#f3efe6;font:22px/1.45 'DM Sans',system-ui,sans-serif;padding:28px 36px}
#n header{display:flex;justify-content:space-between;font:16px 'JetBrains Mono',monospace;letter-spacing:.12em;text-transform:uppercase;color:#8c877d;margin-bottom:18px}
#n header b{color:#ff9d00;font-weight:500}
#n h1{font:400 44px/1.05 'Anton',Impact,sans-serif;text-transform:uppercase;margin:0 0 18px}
#n .t{font:15px 'JetBrains Mono',monospace;color:#ffd21e;margin-bottom:10px}
#n p{margin:0 0 14px}#n .dim{opacity:.4}#n .next{margin-top:28px;padding-top:14px;border-top:1px solid #3a3a40;color:#8c877d;font-size:18px}`;
        w.document.head.append(st);
        w.addEventListener('keydown', e => this.key(e));
        this.notesWin = w;
        clearInterval(this.clock); this.clock = setInterval(() => this.renderNotes(), 1000);
        this.renderNotes();
    }
    notesHTML() {
        const slide = this.slides[this.current];
        const title = el => (el?.querySelector('h1, h2')?.textContent ?? el?.getAttribute('aria-label') ?? '').replace(/\s+/g, ' ').trim();
        const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        const notes = [...slide.querySelectorAll('aside.notes')].map(a => {
            const on = !a.dataset.step || +a.dataset.step === this.step;
            const [tag, ...rest] = a.textContent.trim().split('\n');
            const body = (tag.startsWith('[') ? rest : [tag, ...rest]).map(l => `<p>${esc(l.trim())}</p>`).join('');
            return `<div class="${on ? '' : 'dim'}">${tag.startsWith('[') ? `<div class="t">${esc(tag)}</div>` : ''}${body}</div>`;
        }).join('');
        let j = this.current + 1; while (this.slides[j] && this.skipped(j)) j++;
        const s = Math.floor((Date.now() - this.t0) / 1000), clock = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        const steps = this.steps(this.current) ? ` · step ${this.step}/${this.steps(this.current)}` : '';
        return `<header><span><b>${this.current + 1}</b> / ${this.slides.length}${steps}${this.keynote ? ' · keynote' : ''}</span><span>${clock}</span></header>`
            + `<h1>${esc(title(slide))}</h1>${notes || '<p class="dim">No notes.</p>'}`
            + `<div class="next">Next: ${this.slides[j] ? esc(title(this.slides[j])) : 'end'}</div>`;
    }
    renderNotes() {
        if (this.notesWin && !this.notesWin.closed) this.notesWin.document.getElementById('n').innerHTML = this.notesHTML();
        if (document.body.classList.contains('notes-on')) {
            let el = document.getElementById('notesOverlay');
            if (!el) { el = Object.assign(document.createElement('div'), { id: 'notesOverlay' }); document.body.append(el); }
            el.innerHTML = this.notesHTML();
        }
    }
}
// Page numbers in each slide's footer
document.querySelectorAll('.slide').forEach((s, i) => s.querySelectorAll('.chrome .num').forEach(n => { n.textContent = String(i + 1).padStart(2, '0'); }));
window.deck = new SlidePresentation();
