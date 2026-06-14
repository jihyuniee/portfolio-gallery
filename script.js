/* ============================================================
   2026 HYFL Portfolio Gallery — script.js
   ============================================================ */

import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore, doc, getDoc, getDocs, setDoc, addDoc,
  collection, increment, serverTimestamp, query, orderBy, limit,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

/* Google Apps Script Web App URL */
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxIdTswZ_itVr10CBajBKSOuB3SfnyO2ugZeU0Ke6bysOkL558l9Z0SmaW0b8I6kp7O/exec";

/* 최근 등록된 작품으로 표시할 개수 (시트 맨 아래쪽 N개) */
const NEW_COUNT = 3;

const grid = document.getElementById('grid');
const filtersEl = document.getElementById('filters');
const reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;

let allWorks = [];
let classNames = [];
let currentClass = "전체";
let query_ = "";

/* ---------------------------------------------------------- */
/* firebase                                                    */
/* ---------------------------------------------------------- */

let db = null;
try{
  if(firebaseConfig && firebaseConfig.apiKey && !String(firebaseConfig.apiKey).includes('YOUR_')){
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  }
}catch(e){
  console.warn('Firebase 초기화에 실패했어요:', e);
}

const reactions = new Map(); // workId -> { views, cheers }

function workId(item){
  return [item.className, item.studentNumber, item.studentName]
    .map(v => String(v||'').trim())
    .join('__')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/(^-+|-+$)/g, '') || 'work';
}

async function loadReactions(){
  if(!db) return;
  try{
    const snap = await getDocs(collection(db, 'works'));
    snap.forEach(d => reactions.set(d.id, d.data()));
  }catch(e){
    console.warn('반응 데이터를 불러오지 못했어요:', e);
  }
}

async function bumpField(id, field, metaField){
  if(!db) return;
  try{
    await setDoc(doc(db, 'works', id), { [field]: increment(1) }, { merge: true });
    if(metaField){
      await setDoc(doc(db, 'meta', 'stats'), { [metaField]: increment(1) }, { merge: true });
    }
  }catch(e){
    console.warn('반응을 저장하지 못했어요:', e);
  }
}

/* ---------------------------------------------------------- */
/* helpers                                                     */
/* ---------------------------------------------------------- */

/* 시트에서 가져온 URL 값을 정리해서 유효한 절대 URL로 변환 (실패 시 null) */
function normalizeUrl(raw){
  if(!raw) return null;

  let url = String(raw).trim();
  url = url.replace(/\s+/g, "");
  if(!url) return null;

  if(!/^https?:\/\//i.test(url)){
    url = "https://" + url;
  }

  try{
    const parsed = new URL(url);
    if(parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.href;
  }catch(e){
    console.warn("Invalid URL:", raw);
    return null;
  }
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
      .filter(item => item && item.studentName && item.studentName.trim())
      .map(item => ({
        ...item,
        rawUrl: item.url,
        url: normalizeUrl(item.url),
      }));

    // 최신 등록 순으로 정렬 (시트 행 순서가 클수록 최근 등록)
    items.sort((a, b) => (b.row ?? 0) - (a.row ?? 0));
    items.forEach((item, idx) => { item.isNew = idx < NEW_COUNT; });

    items.forEach(item => { item.id = workId(item); });

    console.table(items.map(w => ({
      name: w.studentName,
      className: w.className,
      rawUrl: w.rawUrl,
      normalizedUrl: w.url,
      valid: !!w.url,
    })));

    allWorks = items;
    classNames = [...new Set(allWorks.map(w=>w.className).filter(Boolean))];

    await loadReactions();

    renderStats();
    renderFilters();
    render();
    renderTodayPick();
  }catch(err){
    showState('😢', '작품 목록을 불러오지 못했습니다.', '잠시 후 다시 새로고침해 주세요.');
  }

  loadGuestbook();
  loadWarmStats();
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
  if(query_){
    const q = query_.toLowerCase();
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
    const msg = query_
      ? {icon:'🔍', b:'검색 결과가 없어요', s:'다른 이름이나 작품 제목으로 다시 찾아보세요.'}
      : {icon:'🖼️', b:'아직 전시된 작품이 없어요', s:'곧 멋진 작품들이 채워질 예정이에요!'};
    showState(msg.icon, msg.b, msg.s);
    return;
  }

  grid.innerHTML = list.map(cardHTML).join('');
  reveal();
  mountPreviews();
  mountReactionWatchers();
}

/* ---------------------------------------------------------- */
/* card markup                                                 */
/* ---------------------------------------------------------- */

function cardHTML(item){
  const hasUrl = !!item.url;
  const title = item.title ? escapeHTML(item.title) : `${escapeHTML(item.studentName)}의 자기소개 웹앱`;
  const desc = item.description
    ? `<p class="card-desc">${escapeHTML(item.description)}</p>`
    : '';
  const number = item.studentNumber ? `${escapeHTML(item.studentNumber)} · ` : '';
  const newBadge = item.isNew ? `<span class="new-badge">NEW</span>` : '';

  const preview = hasUrl
    ? `<div class="skeleton" data-skeleton></div>
       <div class="iframe-scale" data-frame-host>
         <iframe data-src="${escapeAttr(item.url)}" loading="lazy" tabindex="-1" aria-hidden="true" referrerpolicy="no-referrer"></iframe>
       </div>`
    : `<div class="preview-fallback">
         <span class="icon">🔗</span>
         <span>링크 확인 필요</span>
       </div>`;

  const btn = hasUrl
    ? `<a class="go-btn" href="${escapeAttr(item.url)}" target="_blank" rel="noopener noreferrer">작품 보러가기 →</a>`
    : `<span class="go-btn disabled">링크 확인 필요</span>`;

  const data = reactions.get(item.id) || {};
  const views = data.views || 0;
  const cheers = data.cheers || 0;
  const cheered = localStorage.getItem(`cheered_${item.id}`) === '1';

  const reactionsHTML = `<div class="card-reactions">
    <span class="view-count" data-views-for="${escapeAttr(item.id)}">👀 ${views}명이 읽어봤어요</span>
    <button class="cheer-btn" type="button" data-cheer-id="${escapeAttr(item.id)}" aria-pressed="${cheered}">💛 응원 <b>${cheers}</b></button>
  </div>`;

  return `<article class="card" data-id="${escapeAttr(item.id)}" ${hasUrl?`data-url="${escapeAttr(item.url)}"`:''}>
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
      ${reactionsHTML}
    </div>
  </article>`;
}

/* 카드(미리보기 영역) 클릭 시 새 탭으로 이동 */
grid.addEventListener('click', e=>{
  if(e.target.closest('a, button')) return;
  const card = e.target.closest('.card[data-url]');
  if(card) window.open(card.dataset.url, '_blank', 'noopener');
});

/* "응원해요" 클릭 — 같은 사용자의 반복 클릭은 localStorage로 방지 */
grid.addEventListener('click', e=>{
  const btn = e.target.closest('.cheer-btn');
  if(!btn) return;

  const id = btn.dataset.cheerId;
  const key = `cheered_${id}`;
  if(localStorage.getItem(key) === '1') return;

  localStorage.setItem(key, '1');
  btn.setAttribute('aria-pressed', 'true');

  const data = reactions.get(id) || {};
  data.cheers = (data.cheers || 0) + 1;
  reactions.set(id, data);

  const countEl = btn.querySelector('b');
  if(countEl) countEl.textContent = data.cheers;

  bumpField(id, 'cheers', 'totalCheers');
  loadWarmStats();
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

  // cross-origin iframe은 load/error 이벤트만으로 내부 렌더 성공 여부를 정확히 알 수 없으므로,
  // URL이 정상인 카드는 절대 "미리보기 미지원" 같은 실패 화면으로 대체하지 않는다.
  // load가 발생하면 skeleton만 제거하고, 그렇지 않더라도 iframe은 그대로 남겨둔다.
  iframe.addEventListener('load', () => {
    iframe.classList.add('loaded');
    if(skeleton) skeleton.remove();
  });

  iframe.src = iframe.dataset.src;

  // 일부 브라우저/환경에서는 차단된 iframe이 load 이벤트를 전혀 발생시키지 않을 수 있으므로,
  // 일정 시간 후에는 skeleton만 제거해 빈 미리보기 영역이라도 보이게 한다 (실패 문구는 띄우지 않음).
  setTimeout(() => { if(skeleton) skeleton.remove(); }, 4000);
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
/* 조회수 — 카드가 화면에 한 번 보이면 "읽어봤어요" 카운트 증가     */
/* (같은 브라우저에서는 작품별로 한 번만 카운트)                    */
/* ---------------------------------------------------------- */

const viewObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach(entry => {
    if(!entry.isIntersecting) return;
    registerView(entry.target);
    observer.unobserve(entry.target);
  });
}, { rootMargin: '0px', threshold: 0.4 });

function registerView(card){
  const id = card.dataset.id;
  if(!id) return;

  const key = `viewed_${id}`;
  if(localStorage.getItem(key) === '1') return;
  localStorage.setItem(key, '1');

  const data = reactions.get(id) || {};
  data.views = (data.views || 0) + 1;
  reactions.set(id, data);

  const label = card.querySelector(`[data-views-for="${CSS.escape(id)}"]`);
  if(label) label.textContent = `👀 ${data.views}명이 읽어봤어요`;

  bumpField(id, 'views', 'totalViews');
  loadWarmStats();
}

function mountReactionWatchers(){
  grid.querySelectorAll('.card[data-id]').forEach(card => viewObserver.observe(card));
}

/* ---------------------------------------------------------- */
/* 오늘의 자기소개                                              */
/* ---------------------------------------------------------- */

function renderTodayPick(){
  const wrap = document.getElementById('today-pick');
  if(!wrap || allWorks.length===0) return;

  const item = allWorks[Math.floor(Math.random() * allWorks.length)];
  const title = item.title ? escapeHTML(item.title) : `${escapeHTML(item.studentName)}의 자기소개 웹앱`;
  const desc = item.description ? escapeHTML(item.description) : '오늘은 이 친구의 이야기를 만나보세요.';
  const number = item.studentNumber ? `${escapeHTML(item.studentNumber)} · ` : '';

  wrap.innerHTML = `
    <div class="today-inner">
      <div class="today-head">
        <span class="kicker">✨ 오늘의 자기소개</span>
        <p>오늘은 이 친구의 이야기를 읽어볼까요?</p>
      </div>
      <a class="today-card" href="${item.url ? escapeAttr(item.url) : '#'}" target="_blank" rel="noopener noreferrer">
        <div class="today-card-body">
          <div class="card-title">${title}</div>
          <div class="card-meta">
            <span class="class-tag">${escapeHTML(item.className)}</span>
            <span class="student-info">${number}${escapeHTML(item.studentName)}</span>
          </div>
          <p class="card-desc">${desc}</p>
        </div>
        <span class="go-btn">읽으러 가기 →</span>
      </a>
    </div>`;
}

/* ---------------------------------------------------------- */
/* 방명록                                                       */
/* (Firebase 연결 시 Firestore 사용, 미연결 시 localStorage)      */
/* ---------------------------------------------------------- */

const GUESTBOOK_LOCAL_KEY = 'guestbook_entries';
const GUESTBOOK_DISPLAY_LIMIT = 10;

function formatGuestbookDate(value){
  let d;
  if(value && typeof value.toDate === 'function') d = value.toDate();
  else if(value) d = new Date(value);
  else d = new Date();

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd}`;
}

function readLocalGuestbook(){
  try{
    const raw = localStorage.getItem(GUESTBOOK_LOCAL_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  }catch(e){
    console.warn('방명록(local)을 읽지 못했어요:', e);
    return [];
  }
}

function writeLocalGuestbook(list){
  try{
    localStorage.setItem(GUESTBOOK_LOCAL_KEY, JSON.stringify(list));
  }catch(e){
    console.warn('방명록(local)을 저장하지 못했어요:', e);
  }
}

function renderGuestbook(entries){
  const listEl = document.getElementById('guestbook-list');
  const countEl = document.getElementById('guestbook-count');
  if(!listEl) return;

  if(countEl) countEl.innerHTML = `<b>${entries.length}</b>개의 메시지`;

  if(entries.length===0){
    listEl.innerHTML = `<li class="guestbook-empty">아직 방명록이 없어요. 첫 메시지를 남겨주세요!</li>`;
    return;
  }

  listEl.innerHTML = entries.slice(0, GUESTBOOK_DISPLAY_LIMIT).map(entry => `
    <li class="guestbook-item">
      <span class="guestbook-name">${escapeHTML(entry.name)}</span>
      <span class="guestbook-msg">${escapeHTML(entry.message)}</span>
      <span class="guestbook-date">${escapeHTML(formatGuestbookDate(entry.createdAt))}</span>
    </li>`).join('');
}

async function loadGuestbook(){
  const listEl = document.getElementById('guestbook-list');
  if(!listEl) return;

  if(!db){
    renderGuestbook(readLocalGuestbook());
    return;
  }

  try{
    const q = query(collection(db, 'guestbook'), orderBy('createdAt', 'desc'), limit(GUESTBOOK_DISPLAY_LIMIT));
    const snap = await getDocs(q);
    renderGuestbook(snap.docs.map(d => d.data()));
  }catch(e){
    console.warn('방명록을 불러오지 못했어요:', e);
    renderGuestbook(readLocalGuestbook());
  }
}

async function saveGuestbookEntry(name, message){
  const entry = { name, message, createdAt: new Date().toISOString() };

  if(!db){
    const list = readLocalGuestbook();
    list.unshift(entry);
    writeLocalGuestbook(list.slice(0, GUESTBOOK_DISPLAY_LIMIT));
    return;
  }

  await addDoc(collection(db, 'guestbook'), {
    name: entry.name,
    message: entry.message,
    createdAt: serverTimestamp(),
  });
  await setDoc(doc(db, 'meta', 'stats'), { totalGuestbook: increment(1) }, { merge: true });
}

function showGuestbookNotice(message){
  const noticeEl = document.getElementById('guestbook-notice');
  if(!noticeEl) return;
  noticeEl.textContent = message;
  noticeEl.classList.toggle('show', !!message);
}

const guestbookForm = document.getElementById('guestbook-form');
if(guestbookForm){
  guestbookForm.addEventListener('submit', async e => {
    e.preventDefault();

    const nameInput = document.getElementById('guestbook-name');
    const messageInput = document.getElementById('guestbook-message');
    const name = nameInput.value.trim();
    const message = messageInput.value.trim();

    if(!name || !message){
      showGuestbookNotice('이름과 메시지를 모두 입력해 주세요.');
      return;
    }

    showGuestbookNotice('');
    const submitBtn = guestbookForm.querySelector('button');
    submitBtn.disabled = true;

    try{
      await saveGuestbookEntry(name.slice(0, 20), message.slice(0, 120));

      nameInput.value = '';
      messageInput.value = '';
      await loadGuestbook();
      await loadWarmStats();
    }catch(err){
      console.warn('방명록 등록에 실패했어요:', err);
      showGuestbookNotice('방명록 등록에 실패했어요. 잠시 후 다시 시도해 주세요.');
    }finally{
      submitBtn.disabled = false;
    }
  });
}

/* ---------------------------------------------------------- */
/* 따뜻한 반응 통계                                             */
/* ---------------------------------------------------------- */

async function loadWarmStats(){
  const wrap = document.getElementById('warm-stats');
  if(!wrap) return;

  if(!db){
    const guestbook = readLocalGuestbook().length;
    wrap.innerHTML = `
      <div class="warm-stats-inner">
        <p class="warm-stats-title">지금까지</p>
        <div class="warm-stats-row">
          <span>💬 ${guestbook.toLocaleString()}개의 방명록이 남겨졌어요</span>
        </div>
      </div>`;
    return;
  }

  try{
    const snap = await getDoc(doc(db, 'meta', 'stats'));
    const data = snap.exists() ? snap.data() : {};
    const views = data.totalViews || 0;
    const cheers = data.totalCheers || 0;
    const guestbook = data.totalGuestbook || 0;

    wrap.innerHTML = `
      <div class="warm-stats-inner">
        <p class="warm-stats-title">지금까지</p>
        <div class="warm-stats-row">
          <span>👀 ${views.toLocaleString()}번 읽혔어요</span>
          <span>💛 ${cheers.toLocaleString()}번 응원받았어요</span>
          <span>💬 ${guestbook.toLocaleString()}개의 방명록이 남겨졌어요</span>
        </div>
      </div>`;
  }catch(e){
    console.warn('통계를 불러오지 못했어요:', e);
  }
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
  query_ = e.target.value.trim();
  render();
});

loadData();
