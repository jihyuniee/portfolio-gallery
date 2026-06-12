/* ============================================================
   2026 HYFL Portfolio Gallery — script.js
   ============================================================ */

/* ⚠️ Google Apps Script Web App URL을 여기에 입력하세요.
   배포 방법: Apps Script 편집기 > 배포 > 새 배포 > 웹 앱
   (실행 대상: 나, 액세스 권한: 모든 사용자) 후 생성된 URL을 아래에 붙여넣기 */
const APPS_SCRIPT_URL = "YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";

const grid = document.getElementById('grid');
const filtersEl = document.getElementById('filters');
const reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;

let allWorks = [];
let classNames = [];
let currentClass = "전체";
let query = "";

/* 아바타용 파스텔 컬러 + 이니셜 */
const AVATAR_COLORS = [
  '#FF8FC0', '#A78BFA', '#6EC6FF', '#FFB86B', '#6EE7C9', '#FF9E9E', '#9CCC65', '#7C9CFF',
];
function hash(s){let h=0;for(let i=0;i<s.length;i++){h=(h<<5)-h+s.charCodeAt(i);h|=0;}return Math.abs(h);}
function initial(name){ return (name||'').trim().slice(0,1) || '?'; }

function isValidUrl(url){
  if(!url) return false;
  try{
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  }catch{ return false; }
}

function cardHTML(item){
  const color = AVATAR_COLORS[hash(item.studentName)%AVATAR_COLORS.length];
  const desc = item.description ? `<p class="desc">${escapeHTML(item.description)}</p>` : '';
  const title = item.title ? `<div class="title">${escapeHTML(item.title)}</div>` : '';

  let btn;
  if(isValidUrl(item.url)){
    btn = `<a class="go-btn" href="${escapeAttr(item.url)}" target="_blank" rel="noopener noreferrer">작품 보러가기 →</a>`;
  } else {
    btn = `<span class="go-btn disabled">링크 확인 필요</span>`;
  }

  return `<article class="card">
    <div class="top">
      <div class="avatar" style="background:${color}">${escapeHTML(initial(item.studentName))}</div>
      <div>
        <div class="name">${escapeHTML(item.studentName)}</div>
        <span class="class-tag">${escapeHTML(item.className)}</span>
      </div>
    </div>
    ${title}
    ${desc}
    ${btn}
  </article>`;
}

function escapeHTML(str){
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(str){ return escapeHTML(str); }

function currentList(){
  let list = currentClass==="전체" ? allWorks : allWorks.filter(w=>w.className===currentClass);
  if(query){
    const q = query.toLowerCase();
    list = list.filter(w =>
      (w.studentName||'').toLowerCase().includes(q) ||
      (w.title||'').toLowerCase().includes(q)
    );
  }
  return list;
}

function reveal(){
  const cards = [...grid.querySelectorAll('.card')];
  if(reduce){ cards.forEach(c=>c.classList.add('in')); return; }
  cards.forEach((c,i)=> setTimeout(()=>c.classList.add('in'), Math.min(i,16)*40));
}

function render(){
  const list = currentList();
  document.getElementById('section-count').innerHTML = `<b>${list.length}</b>개 작품`;

  if(list.length===0){
    const msg = query
      ? {icon:'🔍', b:'검색 결과가 없어요', s:'다른 이름이나 작품 제목으로 다시 찾아보세요.'}
      : {icon:'🎨', b:'아직 전시된 작품이 없어요', s:'곧 멋진 작품들이 채워질 예정이에요!'};
    grid.innerHTML = `<div class="state"><div class="icon">${msg.icon}</div><b>${msg.b}</b><span>${msg.s}</span></div>`;
    return;
  }

  grid.innerHTML = list.map(cardHTML).join('');
  reveal();
}

function renderFilters(){
  const buttons = ["전체", ...classNames].map(name => {
    const pressed = name===currentClass ? 'true' : 'false';
    return `<button class="filter-btn" data-class="${escapeAttr(name)}" aria-pressed="${pressed}">${escapeHTML(name)}</button>`;
  }).join('');
  filtersEl.innerHTML = buttons;
}

function renderStats(){
  document.getElementById('stat-works').textContent = allWorks.length;
  document.getElementById('stat-classes').textContent = classNames.length;
}

function showState(icon, title, sub){
  grid.innerHTML = `<div class="state"><div class="icon">${icon}</div><b>${title}</b><span>${sub}</span></div>`;
}

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

    allWorks = (Array.isArray(data) ? data : [])
      .filter(item => item && item.studentName && item.studentName.trim() && item.url && item.url.trim());

    classNames = [...new Set(allWorks.map(w=>w.className).filter(Boolean))];

    renderStats();
    renderFilters();
    render();
  }catch(err){
    showState('😢', '작품 목록을 불러오지 못했습니다.', '잠시 후 다시 새로고침해 주세요.');
  }
}

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
