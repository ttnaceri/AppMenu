/* ============================================================
   Konfiguratsiya
   ============================================================ */
const SLOTS_PER_PAGE = 32;
const SLOTS_PER_FOLDER = 27; 
const STORAGE_KEY = 'sites-app-v5'; // Yangilangan versiya
const CLICK_THRESHOLD = 8;

/* ============================================================
   Holat
   ============================================================ */
const state = {
  pages: [[]],          
  currentPage: 0,
  currentFolderPath: [], 
  storageReady: false,
};

function getContainerCapacity() {
  return isInsideFolder() ? SLOTS_PER_FOLDER : SLOTS_PER_PAGE;
}

function currentContainer(){
  let c = state.pages[state.currentPage];
  for (const idx of state.currentFolderPath){
    const node = c[idx];
    if (!node || node.type !== 'folder') return c;
    c = node.children;
  }
  return c;
}

function isInsideFolder(){ return state.currentFolderPath.length > 0; }

/* ============================================================
   DOM
   ============================================================ */
const $ = (id) => document.getElementById(id);
const grid = $('grid');
const overlay = $('overlay');
const choiceOverlay = $('choiceOverlay');
const nameInput = $('nameInput');
const urlInput = $('urlInput');
const errorText = $('errorText');
const modalTitle = $('modalTitle');
const nameField = $('nameField');
const urlField = $('urlField');
const nameLabel = $('nameLabel');
const slotCount = $('slotCount');
const title = $('title');
const breadcrumb = $('breadcrumb');
const backBtn = $('backBtn');
const pageLabel = $('pageLabel');
const prevPageBtn = $('prevPage');
const nextPageBtn = $('nextPage');

let editingIndex = null;
let editingMode = 'site'; 
let openMenuIndex = null;

/* ============================================================
   Yordamchi funksiyalar
   ============================================================ */
function uid(){ return Math.random().toString(36).slice(2, 10); }

function normalizeUrl(raw){
  let u = raw.trim();
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u;
}

function faviconFor(url){
  try {
    const host = new URL(url).hostname;
    return 'https://www.google.com/s2/favicons?sz=64&domain=' + host;
  } catch { return ''; }
}

function firstEmptyIndex(arr, capacity){
  for(let i=0; i<capacity; i++) {
    if (!arr[i]) return i;
  }
  return -1;
}

/* ============================================================
   Saqlash / Yuklash
   ============================================================ */
function save(){
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      pages: state.pages,
      currentPage: state.currentPage,
    }));
  } catch (e) { console.error('Storage error:', e); }
}

function load(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw){
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.pages) && data.pages.length > 0){
        state.pages = data.pages;
        state.currentPage = Math.min(data.currentPage || 0, state.pages.length - 1);
      }
    }
  } catch (e) { console.warn('Load error', e); }

  if (!state.pages.length) state.pages = [[]];
  const root = state.pages[state.currentPage];
  if (root.length === 0 || root.every(x => !x)){
    while (root.length < SLOTS_PER_PAGE) root.push(null);
    root[0] = { id: uid(), type: 'site', name: 'YouTube', url: 'https://youtube.com' };
  }
  normalizeAll();

  state.storageReady = true;
  render();
}

function normalizeContainer(arr, capacity){
  while (arr.length < capacity) arr.push(null);
  if (arr.length > capacity) arr.length = capacity;
}

function normalizeAll(){
  for (const page of state.pages){
    normalizeContainer(page, SLOTS_PER_PAGE);
    for (const node of page){
      if (node && node.type === 'folder') normalizeFolder(node);
    }
  }
}

function normalizeFolder(folder){
  normalizeContainer(folder.children, SLOTS_PER_FOLDER);
  for (const node of folder.children){
    if (node && node.type === 'folder') normalizeFolder(node);
  }
}

/* ============================================================
   Render
   ============================================================ */
function render(){
  if (!state.storageReady){
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;">Loading…</div>';
    return;
  }

  const container = currentContainer();
  const capacity = getContainerCapacity();
  normalizeContainer(container, capacity);

  grid.className = 'grid' + (isInsideFolder() ? ' folder-view' : '');

  if (isInsideFolder()){
    title.textContent = 'Papka';
    backBtn.style.display = 'inline-flex';
    let path = '';
    let c = state.pages[state.currentPage];
    state.currentFolderPath.forEach((idx, i) => {
      const node = c[idx];
      path += (i ? ' / ' : '') + (node ? node.name : '?');
      if (node && node.type === 'folder') c = node.children;
    });
    breadcrumb.innerHTML = `<b id="crumbRoot">Web sites</b> / ${path}`;
    const crumbRoot = $('crumbRoot');
    if (crumbRoot) crumbRoot.addEventListener('click', goRoot);
  } else {
    title.textContent = 'Web sites';
    breadcrumb.textContent = '';
    backBtn.style.display = 'none';
  }

  const filled = container.filter(x => x).length;
  slotCount.textContent = filled + ' / ' + capacity;

  pageLabel.textContent = (state.currentPage + 1) + ' / ' + state.pages.length;
  prevPageBtn.disabled = state.currentPage === 0;
  nextPageBtn.disabled = state.currentPage >= state.pages.length - 1;

  grid.innerHTML = '';
  const emptyIdx = firstEmptyIndex(container, capacity);

  for (let i = 0; i < capacity; i++){
    const node = container[i];
    const slotEl = document.createElement('div');
    slotEl.dataset.index = i;

    if (node){
      slotEl.className = 'slot filled' + (node.type === 'folder' ? ' folder' : '');
      slotEl.draggable = true;

      const iconWrap = document.createElement('div');
      iconWrap.className = 'site-icon';
      if (node.type === 'folder'){
        iconWrap.innerHTML = '<span class="fallback"><i class="fa-solid fa-folder"></i></span>';
      } else {
        const favUrl = faviconFor(node.url);
        if (favUrl){
          const img = document.createElement('img');
          img.src = favUrl;
          img.alt = '';
          img.onerror = () => { iconWrap.innerHTML = `<span class="fallback">${(node.name[0] || '?').toUpperCase()}</span>`; };
          iconWrap.appendChild(img);
        } else {
          iconWrap.innerHTML = `<span class="fallback">${(node.name[0] || '?').toUpperCase()}</span>`;
        }
      }

      const nameEl = document.createElement('div');
      nameEl.className = 'site-name';
      nameEl.textContent = node.name;

      const trigger = document.createElement('button');
      trigger.className = 'menu-trigger';
      trigger.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        openMenuIndex = openMenuIndex === i ? null : i;
        render();
      });

      const dropdown = document.createElement('div');
      dropdown.className = 'dropdown' + (openMenuIndex === i ? ' open' : '');

      const editBtn = document.createElement('button');
      editBtn.innerHTML = '<i class="fa-solid fa-pen"></i> Edit';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openMenuIndex = null;
        openFormModal(i, node.type);
      });
      dropdown.appendChild(editBtn);
      dropdown.appendChild(Object.assign(document.createElement('div'), { className: 'divider' }));

      if (node.type === 'folder'){
        const openBtn = document.createElement('button');
        openBtn.innerHTML = '<i class="fa-solid fa-folder-open"></i> Open folder';
        openBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          state.currentFolderPath.push(i);
          render();
        });
        dropdown.appendChild(openBtn);
        dropdown.appendChild(Object.assign(document.createElement('div'), { className: 'divider' }));
      }

      const delBtn = document.createElement('button');
      delBtn.className = 'delete';
      delBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Delete';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        container[i] = null;
        openMenuIndex = null;
        render();
        save();
      });
      dropdown.appendChild(delBtn);

      if (openMenuIndex === i) trigger.classList.add('active');

      slotEl.appendChild(trigger);
      slotEl.appendChild(dropdown);
      slotEl.appendChild(iconWrap);
      slotEl.appendChild(nameEl);

      slotEl.addEventListener('click', (ev) => {
        if (slotEl.dataset.dragged === '1') return;
        if (ev.target.closest('.menu-trigger') || ev.target.closest('.dropdown')) return;
        if (node.type === 'folder'){
          state.currentFolderPath.push(i);
          render();
        } else {
          window.open(node.url, '_blank', 'noopener');
        }
      });

      slotEl.addEventListener('dragstart', (e) => {
        slotEl.dataset.dragged = '1';
        slotEl.classList.add('dragging');
        e.dataTransfer.setData('text/plain', String(i));
        e.dataTransfer.effectAllowed = 'move';
      });
      slotEl.addEventListener('dragend', () => {
        slotEl.classList.remove('dragging');
        setTimeout(() => { delete slotEl.dataset.dragged; }, 0);
      });
      
      slotEl.addEventListener('dragover', (e) => { e.preventDefault(); slotEl.classList.add('drag-over'); });
      slotEl.addEventListener('dragleave', () => slotEl.classList.remove('drag-over'));
      
      slotEl.addEventListener('drop', (e) => {
        e.preventDefault();
        slotEl.classList.remove('drag-over');
        const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (isNaN(from) || from === i) return;
        
        const sourceNode = container[from];
        const targetNode = container[i];

        // Yangi xususiyat: Sayt ustiga sayt tashlansa -> Papka yaratish
        if (sourceNode.type === 'site' && targetNode.type === 'site') {
          const newFolderName = targetNode.name + ' & ' + sourceNode.name;
          const newFolder = {
            id: uid(),
            type: 'folder',
            name: newFolderName.substring(0, 20) + (newFolderName.length > 20 ? '...' : ''),
            children: new Array(SLOTS_PER_FOLDER).fill(null)
          };
          newFolder.children[0] = targetNode;
          newFolder.children[1] = sourceNode;
          
          container[i] = newFolder;
          container[from] = null; // Manba o'chiriladi
        } else {
          // Boshqa holatlarda shunchaki joy almashadi (Swap)
          const tmp = container[from];
          container[from] = container[i];
          container[i] = tmp;
        }
        
        render();
        save();
      });

    } else if (i === emptyIdx){
      slotEl.className = 'slot add';
      slotEl.innerHTML = '<div class="plus-icon"><i class="fa-solid fa-plus"></i></div>';
      slotEl.addEventListener('click', () => openChoiceModal(i));
      
      slotEl.addEventListener('dragover', (e) => { e.preventDefault(); slotEl.classList.add('drag-over'); });
      slotEl.addEventListener('dragleave', () => slotEl.classList.remove('drag-over'));
      slotEl.addEventListener('drop', (e) => {
        e.preventDefault();
        slotEl.classList.remove('drag-over');
        const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (isNaN(from)) return;
        container[i] = container[from];
        container[from] = null;
        render();
        save();
      });

    } else {
      slotEl.className = 'slot empty';
      slotEl.addEventListener('dragover', (e) => { e.preventDefault(); slotEl.classList.add('drag-over'); });
      slotEl.addEventListener('dragleave', () => slotEl.classList.remove('drag-over'));
      slotEl.addEventListener('drop', (e) => {
        e.preventDefault();
        slotEl.classList.remove('drag-over');
        const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (isNaN(from)) return;
        container[i] = container[from];
        container[from] = null;
        render();
        save();
      });
    }

    grid.appendChild(slotEl);
  }
}

function goRoot(){
  state.currentFolderPath = [];
  openMenuIndex = null;
  render();
}

backBtn.addEventListener('click', () => {
  state.currentFolderPath.pop();
  openMenuIndex = null;
  render();
});

/* ============================================================
   Sahifalar bo'ylab o'tish
   ============================================================ */
function goToPage(idx, direction = 0){
  if (idx < 0 || idx >= state.pages.length || idx === state.currentPage) return;

  grid.style.setProperty('--slide-x', (direction > 0 ? '-60px' : '60px'));
  grid.classList.add('animating');
  setTimeout(() => {
    state.currentPage = idx;
    state.currentFolderPath = [];
    openMenuIndex = null;
    normalizeAll();
    render();
    grid.style.setProperty('--slide-x', (direction > 0 ? '60px' : '-60px'));
    requestAnimationFrame(() => {
      grid.classList.remove('animating');
      save();
    });
  }, 180);
}

function nextPage(){
  if (state.currentPage < state.pages.length - 1){
    goToPage(state.currentPage + 1, 1);
  } else {
    const arr = new Array(SLOTS_PER_PAGE).fill(null);
    state.pages.push(arr);
    goToPage(state.pages.length - 1, 1);
  }
}

function prevPage(){
  if (state.currentPage > 0) goToPage(state.currentPage - 1, -1);
}

prevPageBtn.addEventListener('click', prevPage);
nextPageBtn.addEventListener('click', nextPage);

document.addEventListener('keydown', (e) => {
  if (overlay.classList.contains('open') || choiceOverlay.classList.contains('open')) return;
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowRight') nextPage();
  if (e.key === 'ArrowLeft') prevPage();
  if (e.key === 'Escape') { closeModal(); closeChoiceModal(); }
});

/* Swipe */
let touchStartX = null, touchStartY = null, touchMoved = false;
grid.addEventListener('touchstart', (e) => {
  if (e.touches.length !== 1) return;
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  touchMoved = false;
}, { passive: true });

grid.addEventListener('touchmove', (e) => {
  if (touchStartX === null) return;
  const dx = e.touches[0].clientX - touchStartX;
  const dy = e.touches[0].clientY - touchStartY;
  if (Math.abs(dx) > CLICK_THRESHOLD && Math.abs(dx) > Math.abs(dy)) touchMoved = true;
}, { passive: true });

grid.addEventListener('touchend', (e) => {
  if (touchStartX === null) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (touchMoved && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)){
    if (dx < 0) nextPage(); else prevPage();
  }
  touchStartX = touchStartY = null;
  touchMoved = false;
});

let mouseStartX = null, mouseStartY = null, mouseDown = false;
grid.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  if (e.target.closest('.slot.filled')) return;
  mouseStartX = e.clientX; mouseStartY = e.clientY; mouseDown = true;
});
window.addEventListener('mouseup', (e) => {
  if (!mouseDown) return;
  mouseDown = false;
  if (mouseStartX === null) return;
  const dx = e.clientX - mouseStartX;
  const dy = e.clientY - mouseStartY;
  if (Math.abs(dx) > 120 && Math.abs(dx) > Math.abs(dy)){
    if (dx < 0) nextPage(); else prevPage();
  }
  mouseStartX = mouseStartY = null;
});

/* ============================================================
   Modallar (Xatoliklar to'liq bartaraf etildi)
   ============================================================ */
let pendingIndex = null;

function openChoiceModal(index){
  pendingIndex = index;
  choiceOverlay.classList.add('open');
}

function closeChoiceModal(){
  choiceOverlay.classList.remove('open');
  pendingIndex = null;
}

$('cancelChoiceBtn').addEventListener('click', closeChoiceModal);

$('chooseSiteBtn').addEventListener('click', () => {
  closeChoiceModal();
  openFormModal(pendingIndex, 'site');
});

$('chooseFolderBtn').addEventListener('click', () => {
  closeChoiceModal();
  openFormModal(pendingIndex, 'folder');
});

function openFormModal(index, mode = 'site'){
  editingIndex = index;
  editingMode = mode;
  const container = currentContainer();
  
  // Qat'iy tekshiruv: Agar u yerda allaqachon biror narsa bo'lsa va u yangi qo'shilayotgan bo'lsa
  const existing = container[index];

  if (mode === 'site' && existing && existing.type === 'folder') {
    errorText.textContent = "Bu joyda papka mavjud. Uni ustiga sayt qo'shib bo'lmaydi.";
    errorText.classList.add('show');
    overlay.classList.add('open');
    nameField.style.display = 'none';
    urlField.style.display = 'none';
    $('saveBtn').style.display = 'none';
    $('cancelBtn').textContent = "Tushunarli";
    return;
  } else {
    $('saveBtn').style.display = 'inline-block';
    $('cancelBtn').textContent = "Cancel";
    errorText.classList.remove('show');
  }

  if (mode === 'folder'){
    modalTitle.textContent = existing ? 'Edit folder' : 'New folder';
    nameLabel.textContent = "Folder's name";
    nameField.style.display = '';
    urlField.style.display = 'none';
    nameInput.value = existing ? existing.name : '';
    urlInput.value = '';
  } else {
    modalTitle.textContent = existing ? 'Edit web site' : 'Add web site';
    nameLabel.textContent = "Web site's name";
    nameField.style.display = '';
    urlField.style.display = '';
    nameInput.value = existing ? existing.name : '';
    urlInput.value = existing ? existing.url : '';
  }
  overlay.classList.add('open');
  setTimeout(() => nameInput.focus(), 50);
}

function closeModal(){
  overlay.classList.remove('open');
  editingIndex = null;
  editingMode = 'site';
}

$('cancelBtn').addEventListener('click', closeModal);
overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
choiceOverlay.addEventListener('click', (e) => { if (e.target === choiceOverlay) closeChoiceModal(); });

$('saveBtn').addEventListener('click', () => {
  if (editingMode === 'site' && currentContainer()[editingIndex]?.type === 'folder') return;

  const name = nameInput.value.trim();
  const container = currentContainer();

  if (!name){
    errorText.textContent = 'Nom kiriting.';
    errorText.classList.add('show');
    return;
  }

  if (editingMode === 'folder'){
    const existing = container[editingIndex];
    if (existing && existing.type === 'folder'){
      existing.name = name;
    } else {
      container[editingIndex] = {
        id: uid(),
        type: 'folder',
        name,
        children: new Array(SLOTS_PER_FOLDER).fill(null),
      };
    }
    closeModal();
    render();
    save();
    return;
  }

  const rawUrl = urlInput.value.trim();
  if (!rawUrl){
    errorText.textContent = 'URL kiriting.';
    errorText.classList.add('show');
    return;
  }
  const url = normalizeUrl(rawUrl);
  try { new URL(url); } catch {
    errorText.textContent = 'URL noto\'g\'ri.';
    errorText.classList.add('show');
    return;
  }

  const existing = container[editingIndex];
  if (existing && existing.type === 'folder'){
    errorText.textContent = 'Bu joyda papka bor.';
    errorText.classList.add('show');
    return;
  }
  
  container[editingIndex] = { id: existing?.id || uid(), type: 'site', name, url };
  closeModal();
  render();
  save();
});

/* ============================================================
   Export / Import
   ============================================================ */
$('exportBtn').addEventListener('click', () => {
  const data = {
    version: 5,
    exportedAt: new Date().toISOString(),
    pages: state.pages,
    currentPage: state.currentPage,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'websites-backup-' + Date.now() + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});

$('importBtn').addEventListener('click', () => $('importFile').click());

$('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.pages)) throw new Error('Noto\'g\'ri format');
      for (const page of data.pages){
        if (!Array.isArray(page)) throw new Error('Sahifa noto\'g\'ri');
      }
      state.pages = data.pages;
      state.currentPage = 0;
      state.currentFolderPath = [];
      normalizeAll();
      render();
      save();
      alert('Import muvaffaqiyatli!');
    } catch (err){
      alert('Import xatosi: ' + err.message);
    }
    e.target.value = '';
  };
  reader.readAsText(file);
});

/* ============================================================
   Tashqi click → menyuni yopish
   ============================================================ */
document.addEventListener('click', (e) => {
  if (openMenuIndex === null) return;
  if (e.target.closest('.dropdown') || e.target.closest('.menu-trigger')) return;
  openMenuIndex = null;
  render();
});

/* ============================================================
   Vidjetlar
   ============================================================ */
function updateClock(){
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  $('clock').textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  $('date').textContent = now.toLocaleDateString('uz-UZ', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
  });
}
setInterval(updateClock, 1000);
updateClock();

/* ============================================================
   Boshlash
   ============================================================ */
load();