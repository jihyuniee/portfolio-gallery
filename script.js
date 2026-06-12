/* ============================================================
   2026 HYFL Portfolio Gallery — script.js
   ============================================================ */

/* Google Apps Script Web App URL */
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxIdTswZ_itVr10CBajBKSOuB3SfnyO2ugZeU0Ke6bysOkL558l9Z0SmaW0b8I6kp7O/exec";

/* 최근 등록된 작품으로 표시할 개수 (시트 맨 아래쪽 N개) */
const NEW_COUNT = 3;

/* 미리보기 iframe 로딩 제한 시간 (ms) — 초과 시 fallback 표시 */
const PREVIEW_TIMEOUT = 6000;

const grid = document.getElementById('grid');
const filtersEl = document.getElementById('filters');
const reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;

let allWorks = [];
let classNames = [];
let currentClass = "전체";
let query = "";

/* ---------------------------------------------------------- */
/* helpers                                                     */
/* ---------------------------------------------------------- */

function isValidUrl(url){
  if(!url) return false;
  try{
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  }catch{ return false; }
}

function escapeHTML(str){
  return String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(str){ return escapeHTML(str); }

/* ---------------------------------------------------------- */
/* data loading                                                */
/* ---------------------------------------------------------- */

async function loadData(){
  showState('⏳', '작품을 불러오는 중이에요...', '잠시만 기다려 주세요.');

  if(!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('YOUR_APPS_SCRIPT')){
    showState('⚙️', '아직 연결되지 않았어요', 'script.js의 APPS_SCRIPT_URL을 설정해 주세요.');
    return;
  }

  try{
    const res = await fetch(APPS_SCRIPT_URL);
    if(!res.ok) throw new Error('bad response');
    const data = await res.json();

    const items = (Array.isArray(data) ? data : [])
      .filter(item => item && item.studentName && item.studentName.trim() && item.url && item.url.trim());

    // 최신 등록 순으로 정렬 (시트 행 순서가 클수록 최근 등록)
    items.sort((a, b) => (b.row ?? 0) - (a.row ?? 0));
    items.forEach((item, idx) => { item.isNew = idx < NEW_COUNT; });

    allWorks = items;
    classNames = [...new Set(allWorks.map(w=>w.className).filter(Boolean))];

    renderStats();
    renderFilters();
    render();
  }catch(err){
    showState('😢', '작품 목록을 불러오지 못했습니다.', '잠시 후 다시 새로고침해 주세요.');
  }
}

/* ---------------------------------------------------------- */
/* rendering                                                   */
/* ---------------------------------------------------------- */

function renderStats(){
  document.getElementById('stat-works').textContent = allWorks.length;
  document.getElementById('stat-classes').textContent = classNames.length;
}

function renderFilters(){
  const buttons = ["전체", ...classNames].map(name => {
    const pressed = name===currentClass ? 'true' : 'false';
    return `<button class="filter-btn" data-class="${escapeAttr(name)}" aria-pressed="${pressed}">${escapeHTML(name)}</button>`;
  }).join('');
  filtersEl.innerHTML = buttons;
}

function currentList(){
  let list = currentClass==="전체" ? allWorks : allWorks.filter(w=>w.className===currentClass);
  if(query){
    const q = query.toLowerCase();
    list = list.filter(w =>
      (w.studentName||'').toLowerCase().includes(q) ||
      (w.title||'').toLowerCase().includes(q) ||
      (w.description||'').toLowerCase().includes(q)
    );
  }
  return list;
}

function showState(icon, title, sub){
  grid.innerHTML = `<div class="state"><div class="icon">${icon}</div><b>${title}</b><span>${sub}</span></div>`;
}

function render(){
  const list = currentList();
  document.getElementById('section-count').innerHTML = `<b>${list.length}</b>개 작품`;

  if(list.length===0){
    const msg = query
      ? {icon:'🔍', b:'검색 결과가 없어요', s:'다른 이름이나 작품 제목으로 다시 찾아보세요.'}
      : {icon:'🖼️', b:'아직 전시된 작품이 없어요', s:'곧 멋진 작품들이 채워질 예정이에요!'};
    showState(msg.icon, msg.b, msg.s);
    return;
  }

  grid.innerHTML = list.map(cardHTML).join('');
  reveal();
  mountPreviews();
}

/* ---------------------------------------------------------- */
/* card markup                                                 */
/* ---------------------------------------------------------- */

function cardHTML(item){
  const hasUrl = isValidUrl(item.url);
  const title = item.title ? escapeHTML(item.title) : `${escapeHTML(item.studentName)}의 자기소개 웹앱`;
  const desc = item.description
    ? `<p class="card-desc">${escapeHTML(item.description)}</p>`
    : '';
  const number = item.studentNumber ? `${escapeHTML(item.studentNumber)} · ` : '';
  const newBadge = item.isNew ? `<span class="new-badge">NEW</span>` : '';

  const preview = hasUrl
    ? `<div class="skeleton" data-skeleton></div>
       <div class="iframe-scale" data-frame-host>
         <iframe data-src="${escapeAttr(item.url)}" loading="lazy" tabindex="-1" aria-hidden="true" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
       </div>
       <div class="preview-fallback" data-fallback hidden>
         <span class="icon">🖼️</span>
         <span>미리보기를 지원하지 않는 작품</span>
         <a class="go-btn" href="${escapeAttr(item.url)}" target="_blank" rel="noopener noreferrer">클릭하여 작품 보기 →</a>
       </div>`
    : `<div class="preview-fallback">
         <span class="icon">🔗</span>
         <span>링크 확인 필요</span>
       </div>`;

  const btn = hasUrl
    ? `<a class="go-btn" href="${escapeAttr(item.url)}" target="_blank" rel="noopener noreferrer">작품 보러가기 →</a>`
    : `<span class="go-btn disabled">링크 확인 필요</span>`;

  return `<article class="card" ${hasUrl?`data-url="${escapeAttr(item.url)}"`:''}>
    <div class="preview-wrap">
      ${newBadge}
      ${preview}
    </div>
    <div class="card-body">
      <div class="card-head">
        <div>
          <div class="card-title">${title}</div>
          <div class="card-meta">
            <span class="class-tag">${escapeHTML(item.className)}</span>
            <span class="student-info">${number}${escapeHTML(item.studentName)}</span>
          </div>
        </div>
      </div>
      ${desc}
      ${btn}
    </div>
  </article>`;
}

/* 카드(미리보기 영역) 클릭 시 새 탭으로 이동 */
grid.addEventListener('click', e=>{
  if(e.target.closest('a, button')) return;
  const card = e.target.closest('.card[data-url]');
  if(card) window.open(card.dataset.url, '_blank', 'noopener');
});

/* ---------------------------------------------------------- */
/* preview iframe loading (viewport lazy load)                 */
/* ---------------------------------------------------------- */

const previewObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach(entry => {
    if(!entry.isIntersecting) return;
    loadPreview(entry.target);
    observer.unobserve(entry.target);
  });
}, { rootMargin: '200px 0px' });

function loadPreview(iframe){
  const wrap = iframe.closest('.preview-wrap');
  const skeleton = wrap.querySelector('[data-skeleton]');
  const fallback = wrap.querySelector('[data-fallback]');

  const timer = setTimeout(() => showFallback(), PREVIEW_TIMEOUT);

  function showFallback(){
    clearTimeout(timer);
    iframe.closest('[data-frame-host]')?.remove();
    if(skeleton) skeleton.remove();
    if(fallback) fallback.hidden = false;
  }

  iframe.addEventListener('load', () => {
    clearTimeout(timer);
    iframe.classList.add('loaded');
    if(skeleton) skeleton.remove();
  });
  iframe.addEventListener('error', showFallback);

  iframe.src = iframe.dataset.src;
}

function mountPreviews(){
  grid.querySelectorAll('.preview-wrap').forEach(wrap => {
    const host = wrap.querySelector('[data-frame-host]');
    const iframe = wrap.querySelector('iframe[data-src]');
    if(!host || !iframe) return;
    host.style.setProperty('--frame-scale', wrap.clientWidth / 1440);
    previewObserver.observe(iframe);
  });
}

/* ---------------------------------------------------------- */
/* reveal animation                                            */
/* ---------------------------------------------------------- */

function reveal(){
  const cards = [...grid.querySelectorAll('.card')];
  if(reduce){ cards.forEach(c=>c.classList.add('in')); return; }
  cards.forEach((c,i)=> setTimeout(()=>c.classList.add('in'), Math.min(i,16)*40));
}

/* ---------------------------------------------------------- */
/* events                                                      */
/* ---------------------------------------------------------- */

filtersEl.addEventListener('click', e=>{
  const btn = e.target.closest('.filter-btn'); if(!btn) return;
  currentClass = btn.dataset.class;
  renderFilters();
  render();
});

document.getElementById('search').addEventListener('input', e=>{
  query = e.target.value.trim();
  render();
});

loadData();
