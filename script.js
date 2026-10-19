/* ============================================================
   XOTIRANI TOZALASH VA QOTISHNI OLDINI OLISH
   ============================================================ */
try {
    // Barcha eski va xato yozilgan ma'lumotlarni tozalash
    const oldKeys = ['sites-app-v10', 'sites-app-v11', 'sites-app-v12', 'app-menu-v11', 'app-menu-v12', 'app-menu-v13-debug', 'app-menu-v14'];
    oldKeys.forEach(k => localStorage.removeItem(k));
} catch(e) {}

const STORAGE_KEY = 'app-menu-final-v15';
const CLICK_THRESHOLD = 8;

const state = {
  pages: [[]],          
  currentPage: 0,
  currentFolderPath: [], 
  gridCols: 8,
  gridRows: 4,
  storageReady: false,
};

function getInitialGrid() {
  const w = window.innerWidth;
  if (w < 420) return { c: 4, r: 5 };
  if (w < 680) return { c: 4, r: 6 };
  if (w < 900) return { c: 5, r: 5 };
  return { c: 8, r: 4 };
}

let initialGrid = getInitialGrid();
state.gridCols = initialGrid.c;
state.gridRows = initialGrid.r;

function getCapacity() { return state.gridCols * state.gridRows; }

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

function isLockedNode(node) {
  if (!node) return false;
  return node.name === 'UPDATE Inc.' && node.type === 'folder';
}

function isViewLocked() {
  if (!isInsideFolder()) return false;
  let c = state.pages[state.currentPage];
  for (let i = 0; i < state.currentFolderPath.length; i++) {
    const n = c[state.currentFolderPath[i]];
    if (n && n.name === 'UPDATE Inc.') return true;
    if (n && n.type === 'folder') c = n.children;
  }
  return false;
}

const $ = (id) => document.getElementById(id);
const grid = $('grid');
const overlay = $('overlay');
const choiceOverlay = $('choiceOverlay');
const settingsOverlay = $('settingsOverlay');
const contextMenu = $('contextMenu');

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
const gridSizeSelect = $('gridSizeSelect');

let editingIndex = null;
let editingMode = 'site'; 
let openMenuIndex = null;
let contextMenuIndex = null;
let contextMenuNode = null;
let pendingIndex = null;

function uid(){ return Math.random().toString(36).slice(2, 10); }
function normalizeUrl(raw){
  let u = raw.trim();
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u;
}

// Favicon xatolarini ushlash
function faviconFor(url){
  try {
    const host = new URL(url).hostname;
    return 'https://www.google.com/s2/favicons?sz=64&domain=' + host;
  } catch { return ''; }
}

function save(){
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      pages: state.pages,
      currentPage: state.currentPage,
      gridCols: state.gridCols,
      gridRows: state.gridRows
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
        if (data.gridCols) state.gridCols = data.gridCols;
        if (data.gridRows) state.gridRows = data.gridRows;
      }
    }
  } catch (e) { console.warn('Load error', e); }

  if (!state.pages.length || state.pages[0].length === 0) {
    const defaultFolder = { id: uid(), type: 'folder', name: 'UPDATE Inc.', children: [] };
    const excelData = [
      { name: "My All Repositories", url: "https://github.com/ttnaceri?tab=repositories" },
      { name: "Fuzz", url: "https://ttnaceri.github.io/fuzz/" },
      { name: "Archieve", url: "https://ttnaceri.github.io/ARCHIEVE/" },
      { name: "Cheats For Gta", url: "https://ttnaceri.github.io/CheatsForGta/" },
      { name: "App Menu", url: "https://ttnaceri.github.io/AppMenu/" },
      { name: "Vcoin Payment", url: "https://ttnaceri.github.io/Vcoin-Payment.net/" },
      { name: "Vapynshop", url: "https://ttnaceri.github.io/Vapynshop/" },
      { name: "Awebshop", url: "https://ttnaceri.github.io/AwebShop/" },
      { name: "Telegram Channel", url: "https://t.me/updateDevNews" },
      { name: "Telegram Group", url: "https://t.me/FuzzAppBot" }
    ];
    excelData.forEach(site => defaultFolder.children.push({ id: uid(), type: 'site', name: site.name, url: site.url }));
    state.pages = [[defaultFolder]];
    state.currentPage = 0;
  }

  const firstPage = state.pages[0];
  if (!firstPage[0] || firstPage[0].name !== 'UPDATE Inc.' || firstPage[0].type !== 'folder') {
    const existingIdx = firstPage.findIndex(n => n && n.name === 'UPDATE Inc.' && n.type === 'folder');
    if (existingIdx > 0) {
      const folder = firstPage[existingIdx];
      firstPage.splice(existingIdx, 1);
      firstPage.unshift(folder);
    } else if (existingIdx === -1) {
      firstPage.unshift({ id: uid(), type: 'folder', name: 'UPDATE Inc.', children: [] });
    }
  }

  normalizeAll();
  state.storageReady = true;
  const val = state.gridCols + 'x' + state.gridRows;
  if (!gridSizeSelect.querySelector(`option[value="${val}"]`)) {
    const opt = document.createElement('option');
    opt.value = val; opt.textContent = val + ' (Custom)';
    gridSizeSelect.appendChild(opt);
  }
  gridSizeSelect.value = val;
  render();
}

function normalizeContainer(arr, capacity){
  while (arr.length < capacity) arr.push(null);
  if (arr.length > capacity) arr.length = capacity;
}

function normalizeAll(){
  const cap = getCapacity();
  for (const page of state.pages){
    normalizeContainer(page, cap);
    for (const node of page){
      if (node && node.type === 'folder') normalizeFolder(node, cap);
    }
  }
}

function normalizeFolder(folder, cap){
  normalizeContainer(folder.children, cap);
  for (const node of folder.children){
    if (node && node.type === 'folder') normalizeFolder(node, cap);
  }
}

// Dinamik sahifalash (xotira yeyishni oldini olish uchun optimallashtirildi)
function reflowItems() {
  if (isInsideFolder()) return;
  const cap = getCapacity();
  let allItems = [];
  let lockedItem = state.pages[0][0]; 
  
  for (let p = 0; p < state.pages.length; p++) {
    for (let i = 0; i < state.pages[p].length; i++) {
      if (p === 0 && i === 0) continue;
      if (state.pages[p][i]) allItems.push(state.pages[p][i]);
    }
  }
  
  let newPages = [];
  let currentPageArr = [lockedItem];
  let itemIndex = 0;
  
  while (itemIndex < allItems.length || currentPageArr.length < cap) {
    if (currentPageArr.length >= cap) {
      newPages.push(currentPageArr);
      currentPageArr = [];
    }
    if (itemIndex < allItems.length) {
      currentPageArr.push(allItems[itemIndex]);
      itemIndex++;
    } else {
      currentPageArr.push(null);
    }
    if (currentPageArr.length === cap) {
      newPages.push(currentPageArr);
      currentPageArr = [];
    }
  }
  if (currentPageArr.length > 0) {
    while(currentPageArr.length < cap) currentPageArr.push(null);
    newPages.push(currentPageArr);
  }
  if (newPages.length === 0) {
    newPages = [new Array(cap).fill(null)];
    newPages[0][0] = lockedItem;
  }
  state.pages = newPages;
  if (state.currentPage >= state.pages.length) state.currentPage = state.pages.length - 1;
}

function render(){
  if (!state.storageReady) return;
  const container = currentContainer();
  const capacity = getCapacity();
  normalizeContainer(container, capacity);
  const viewLocked = isViewLocked();

  grid.style.gridTemplateColumns = `repeat(${state.gridCols}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${state.gridRows}, 1fr)`;

  if (isInsideFolder()){
    title.textContent = 'Papka';
    backBtn.style.display = 'inline-flex';
    let path = ''; let c = state.pages[state.currentPage];
    state.currentFolderPath.forEach((idx, i) => {
      const node = c[idx];
      path += (i ? ' / ' : '') + (node ? node.name : '?');
      if (node && node.type === 'folder') c = node.children;
    });
    breadcrumb.innerHTML = `<b id="crumbRoot">App Menu</b> / ${path}`;
    const crumbRoot = $('crumbRoot');
    if (crumbRoot) crumbRoot.addEventListener('click', goRoot);
  } else {
    title.textContent = 'App Menu';
    breadcrumb.textContent = '';
    backBtn.style.display = 'none';
  }

  const filled = container.filter(x => x).length;
  slotCount.textContent = filled + ' / ' + capacity;
  pageLabel.textContent = (state.currentPage + 1) + ' / ' + state.pages.length;
  prevPageBtn.disabled = state.currentPage === 0;
  nextPageBtn.disabled = state.currentPage >= state.pages.length - 1;

  grid.innerHTML = '';
  let emptyIdx = -1;
  if (!viewLocked) {
    for(let i=0; i<capacity; i++){
      if(!container[i]) { emptyIdx = i; break; }
    }
  }

  for (let i = 0; i < capacity; i++){
    const node = container[i];
    const slotEl = document.createElement('div');
    slotEl.dataset.index = i;

    if (node){
      slotEl.className = 'slot filled' + (node.type === 'folder' ? ' folder' : '');
      let isLocked = false;
      if (!isInsideFolder() && state.currentPage === 0 && i === 0) isLocked = true;
      if (isInsideFolder() && isViewLocked()) isLocked = true;

      if (!isLocked) slotEl.draggable = true;

      const iconWrap = document.createElement('div');
      iconWrap.className = 'site-icon';
      if (node.type === 'folder'){
        let previewHtml = '<div class="folder-preview">';
        const children = node.children || [];
        for (let j = 0; j < 9; j++) {
          const child = children[j];
          if (child && child.type === 'site') {
            const fUrl = faviconFor(child.url);
            previewHtml += `<img src="${fUrl}" onerror="this.style.display='none'">`;
          } else if (child && child.type === 'folder') {
             previewHtml += `<div class="empty-mini" style="display:flex;align-items:center;justify-content:center"><i class="fa-solid fa-folder" style="font-size:8px;color:var(--brass)"></i></div>`;
          } else {
            previewHtml += `<div class="empty-mini"></div>`;
          }
        }
        previewHtml += '</div>';
        iconWrap.innerHTML = previewHtml;
      } else {
        const favUrl = faviconFor(node.url);
        if (favUrl){
          const img = document.createElement('img');
          img.src = favUrl;
          img.alt = '';
          // 404 xatolarni ushlab qolish
          img.onerror = function() {
            this.style.display = 'none';
            iconWrap.innerHTML = `<span class="fallback">${(node.name[0] || '?').toUpperCase()}</span>`;
          };
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
      
      if (!isLocked) {
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
      }

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

      slotEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openContextMenu(e.clientX, e.clientY, i, node, isLocked);
      });

      if (!isLocked) {
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
      }

      slotEl.addEventListener('dragover', (e) => { e.preventDefault(); slotEl.classList.add('drag-over'); });
      slotEl.addEventListener('dragleave', () => slotEl.classList.remove('drag-over'));
      slotEl.addEventListener('drop', (e) => {
        e.preventDefault();
        slotEl.classList.remove('drag-over');
        if (viewLocked) return;
        const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (isNaN(from) || from === i) return;
        const sourceNode = container[from];
        const targetNode = container[i];
        if (sourceNode.type === 'site' && targetNode.type === 'site') {
          const newFolderName = targetNode.name + ' & ' + sourceNode.name;
          const newFolder = { id: uid(), type: 'folder', name: newFolderName.substring(0, 20) + (newFolderName.length > 20 ? '...' : ''), children: [] };
          newFolder.children[0] = targetNode;
          newFolder.children[1] = sourceNode;
          container[i] = newFolder;
          container[from] = null;
        } else {
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

function openContextMenu(x, y, index, node, isLocked) {
  contextMenuIndex = index;
  contextMenuNode = node;
  const delBtn = $('ctxDelete');
  const divider = $('ctxDivider');
  if (isLocked) {
    delBtn.style.display = 'none';
    divider.style.display = 'none';
  } else {
    delBtn.style.display = 'flex';
    divider.style.display = 'block';
  }
  contextMenu.style.left = Math.min(x, window.innerWidth - 150) + 'px';
  contextMenu.style.top = Math.min(y, window.innerHeight - 100) + 'px';
  contextMenu.classList.add('open');
}

document.addEventListener('click', () => {
  contextMenu.classList.remove('open');
  if (openMenuIndex !== null) {
    openMenuIndex = null;
    render();
  }
});

$('ctxOpen').addEventListener('click', () => {
  if (contextMenuNode) {
    if (contextMenuNode.type === 'folder') {
      state.currentFolderPath.push(contextMenuIndex);
      render();
    } else {
      window.open(contextMenuNode.url, '_blank', 'noopener');
    }
  }
  contextMenu.classList.remove('open');
});

$('ctxDelete').addEventListener('click', () => {
  const container = currentContainer();
  if (container[contextMenuIndex]) {
    let isLocked = false;
    if (!isInsideFolder() && state.currentPage === 0 && contextMenuIndex === 0) isLocked = true;
    if (isInsideFolder() && isViewLocked()) isLocked = true;
    if (!isLocked) {
      container[contextMenuIndex] = null;
      render();
      save();
    }
  }
  contextMenu.classList.remove('open');
});

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

function nextPage(){
  if (state.currentPage < state.pages.length - 1){
    state.currentPage++;
  } else {
    state.pages.push([]);
    state.currentPage++;
  }
  state.currentFolderPath = [];
  normalizeAll();
  render();
  save();
}

function prevPage(){
  if (state.currentPage > 0) {
    state.currentPage--;
    state.currentFolderPath = [];
    render();
    save();
  }
}

prevPageBtn.addEventListener('click', prevPage);
nextPageBtn.addEventListener('click', nextPage);

document.addEventListener('keydown', (e) => {
  if (overlay.classList.contains('open')) {
    if (e.key === 'Enter') { e.preventDefault(); $('saveBtn').click(); }
    return;
  }
  if (choiceOverlay.classList.contains('open')) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.key === 'ArrowRight') nextPage();
  else if (e.key === 'ArrowLeft') prevPage();
  else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    if (isViewLocked()) return;
    const container = currentContainer();
    let deleted = false;
    for (let i = container.length - 1; i >= 0; i--) {
      if (container[i]) {
        let isLocked = false;
        if (!isInsideFolder() && state.currentPage === 0 && i === 0) isLocked = true;
        if (isLocked) continue;
        container[i] = null;
        deleted = true;
        break;
      }
    }
    if (deleted) { render(); save(); }
  }
});

function openChoiceModal(index){
  if (isInsideFolder() && isViewLocked()) {
    alert("UPDATE Inc. papkasiga qo'shib bo'lmaydi.");
    return;
  }
  pendingIndex = index; 
  choiceOverlay.classList.add('open');
}

function closeChoiceModal(){
  choiceOverlay.classList.remove('open');
}

$('cancelChoiceBtn').addEventListener('click', closeChoiceModal);

$('chooseSiteBtn').addEventListener('click', () => {
    closeChoiceModal(); 
    const idx = pendingIndex;
    openFormModal(idx, 'site'); 
    pendingIndex = null; 
});

$('chooseFolderBtn').addEventListener('click', () => {
    closeChoiceModal(); 
    const idx = pendingIndex;
    openFormModal(idx, 'folder'); 
    pendingIndex = null;
});

function openFormModal(index, mode = 'site'){
  if (isInsideFolder() && isViewLocked()) return;
  if (index === null || index === undefined) return;
  
  editingIndex = index;
  editingMode = mode;
  const container = currentContainer();
  const existing = container[index];

  $('saveBtn').style.display = 'inline-block';
  $('cancelBtn').textContent = "Cancel";
  errorText.classList.remove('show');

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

$('saveBtn').addEventListener('click', () => {
  if (isInsideFolder() && isViewLocked()) {
    alert("UPDATE Inc. ga o'zgartirish kiritib bo'lmaydi.");
    return;
  }
  if (editingIndex === null || editingIndex === undefined) return;

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
      container[editingIndex] = { id: uid(), type: 'folder', name, children: [] };
    }
    closeModal(); render(); save(); return;
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
  container[editingIndex] = { id: existing?.id || uid(), type: 'site', name, url };
  closeModal(); render(); save();
});

$('settingsBtn').addEventListener('click', () => settingsOverlay.classList.add('open'));
$('closeSettingsBtn').addEventListener('click', () => settingsOverlay.classList.remove('open'));

gridSizeSelect.addEventListener('change', (e) => {
  const [c, r] = e.target.value.split('x').map(Number);
  state.gridCols = c;
  state.gridRows = r;
  normalizeAll();
  reflowItems(); 
  render();
  save();
});

// XOTIRA VA QOTISHNI OLDINI OLUVCHI CTRL+SCROLL
let isScrolling = false;
window.addEventListener('wheel', (e) => {
  if (e.ctrlKey) {
    e.preventDefault(); // Brauzer zoomini to'xtatish
    if (isScrolling) return; // Agar hozir ishlayotgan bo'lsa, qayta ishga tushirmaslik
    isScrolling = true;
    
    if (e.deltaY < 0) {
      // Scroll Up -> Kattalashtirish
      if (state.gridCols > 3) {
        state.gridCols--;
        if (state.gridRows > 3) state.gridRows--; 
      }
    } else {
      // Scroll Down -> Kichiklashtirish
      if (state.gridCols * state.gridRows < 150) {
        state.gridCols++;
        if (state.gridCols * state.gridRows < 150) state.gridRows++; 
      }
    }
    
    const val = state.gridCols + 'x' + state.gridRows;
    if (!gridSizeSelect.querySelector(`option[value="${val}"]`)) {
        const opt = document.createElement('option');
        opt.value = val; opt.textContent = val + ' (Custom)';
        gridSizeSelect.appendChild(opt);
    }
    gridSizeSelect.value = val;
    
    normalizeAll();
    reflowItems(); 
    render();
    save();

    // 200 millisekund kuting, keyin yana skroll qabul qilsin
    setTimeout(() => { isScrolling = false; }, 200);
  }
}, { passive: false });

$('exportBtn').addEventListener('click', () => {
  const data = { version: 15, exportedAt: new Date().toISOString(), pages: state.pages, currentPage: state.currentPage, gridCols: state.gridCols, gridRows: state.gridRows };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'app-menu-backup-' + Date.now() + '.json';
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
      state.pages = data.pages;
      state.currentPage = 0;
      state.currentFolderPath = [];
      if (data.gridCols) state.gridCols = data.gridCols;
      if (data.gridRows) state.gridRows = data.gridRows;
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

function updateClock(){
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  $('clock').textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  $('date').textContent = now.toLocaleDateString('uz-UZ', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}
setInterval(updateClock, 1000);
updateClock();

load();
