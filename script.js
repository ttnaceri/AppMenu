const SLOT_COUNT = 64;
const STORAGE_KEY = 'sites';
let sites = new Array(SLOT_COUNT).fill(null);
let storageReady = false;

let editingIndex = null;
let openMenuIndex = null;

const grid = document.getElementById('grid');
const overlay = document.getElementById('overlay');
const nameInput = document.getElementById('nameInput');
const urlInput = document.getElementById('urlInput');
const errorText = document.getElementById('errorText');
const modalTitle = document.getElementById('modalTitle');
const slotCount = document.getElementById('slotCount');

function firstEmptyIndex() {
  return sites.findIndex(s => s === null);
}

function normalizeUrl(raw) {
  let u = raw.trim();
  if (!/^https?:\/\//i.test(u)) {
    u = 'https://' + u;
  }
  return u;
}

function faviconFor(url) {
  try {
    const host = new URL(url).hostname;
    return 'https://www.google.com/s2/favicons?sz=64&domain=' + host;
  } catch (e) {
    return '';
  }
}

function loadSites() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length === SLOT_COUNT) {
        sites = parsed;
      }
    }
  } catch (e) {
    console.error('Storage error:', e);
  }

  storageReady = true;
  render();
}

function saveSites() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sites));
  } catch (e) {
    console.error('Storage error:', e);
  }
}

function render() {
  if (!storageReady) {
    grid.innerHTML =
      '<div style="grid-column:1/-1;text-align:center;color:var(--text-dim);padding:30px 0;">Loading…</div>';
    return;
  }

  grid.innerHTML = '';

  const emptyIdx = firstEmptyIndex();
  const filledCount = sites.filter(s => s !== null).length;
  slotCount.textContent = `${filledCount} / ${SLOT_COUNT}`;

  // 32 tadan ko'p sayt bo'lsa — kichraytirilgan rejimga o'tadi
  if (filledCount > 32) {
    grid.classList.add('compact');
  } else {
    grid.classList.remove('compact');
  }

  for (let i = 0; i < SLOT_COUNT; i++) {
    const site = sites[i];
    const slotEl = document.createElement('div');

    if (site) {
      slotEl.className = 'slot filled';

      const iconWrap = document.createElement('div');
      iconWrap.className = 'site-icon';

      const favUrl = faviconFor(site.url);

      if (favUrl) {
        const img = document.createElement('img');
        img.src = favUrl;
        img.alt = '';

        img.onerror = () => {
          iconWrap.innerHTML = `<span class="fallback">${site.name.charAt(0).toUpperCase()}</span>`;
        };

        iconWrap.appendChild(img);
      } else {
        iconWrap.innerHTML = `<span class="fallback">${site.name.charAt(0).toUpperCase()}</span>`;
      }

      const nameEl = document.createElement('div');
      nameEl.className = 'site-name';
      nameEl.textContent = site.name;

      const trigger = document.createElement('button');
      trigger.className = 'menu-trigger';
      trigger.setAttribute('aria-label', 'More options');
      trigger.textContent = '\u22EE';

      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        openMenuIndex = openMenuIndex === i ? null : i;
        render();
      });

      const dropdown = document.createElement('div');
      dropdown.className = 'dropdown' + (openMenuIndex === i ? ' open' : '');

      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';

      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openMenuIndex = null;
        openModal(i);
      });

      const divider = document.createElement('div');
      divider.className = 'divider';

      const delBtn = document.createElement('button');
      delBtn.className = 'delete';
      delBtn.textContent = 'Delete';

      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();

        sites[i] = null;
        openMenuIndex = null;

        render();
        saveSites();
      });

      dropdown.appendChild(editBtn);
      dropdown.appendChild(divider);
      dropdown.appendChild(delBtn);

      if (openMenuIndex === i) {
        trigger.classList.add('active');
      }

      slotEl.appendChild(trigger);
      slotEl.appendChild(dropdown);
      slotEl.appendChild(iconWrap);
      slotEl.appendChild(nameEl);

      slotEl.addEventListener('click', () => {
        window.open(site.url, '_blank', 'noopener');
      });

    } else if (i === emptyIdx) {

      slotEl.className = 'slot add';

      const plus = document.createElement('div');
      plus.className = 'plus-icon';
      plus.textContent = '+';

      slotEl.appendChild(plus);

      slotEl.addEventListener('click', () => {
        openModal(i);
      });

    } else {

      slotEl.className = 'slot empty';

    }

    grid.appendChild(slotEl);
  }
}

function openModal(index) {
  editingIndex = index;

  const existing = sites[index];

  modalTitle.textContent = existing ? 'Edit web site' : 'Add web site';
  nameInput.value = existing ? existing.name : '';
  urlInput.value = existing ? existing.url : '';

  errorText.classList.remove('show');

  overlay.classList.add('open');

  setTimeout(() => {
    nameInput.focus();
  }, 50);
}

function closeModal() {
  overlay.classList.remove('open');
  editingIndex = null;
}

document.getElementById('cancelBtn').addEventListener('click', closeModal);

document.getElementById('saveBtn').addEventListener('click', () => {

  const name = nameInput.value.trim();
  const rawUrl = urlInput.value.trim();

  if (!name || !rawUrl) {
    errorText.textContent = 'Enter both a name and a URL.';
    errorText.classList.add('show');
    return;
  }

  const url = normalizeUrl(rawUrl);

  try {
    new URL(url);
  } catch (e) {
    errorText.textContent = "That URL doesn't look valid.";
    errorText.classList.add('show');
    return;
  }

  sites[editingIndex] = {
    name,
    url
  };

  closeModal();
  render();
  saveSites();
});

overlay.addEventListener('click', (e) => {
  if (e.target === overlay) {
    closeModal();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && overlay.classList.contains('open')) {
    closeModal();
  }
});

document.addEventListener('click', () => {
  if (openMenuIndex !== null) {
    openMenuIndex = null;
    render();
  }
});

loadSites();
