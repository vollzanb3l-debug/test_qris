(function () {
    'use strict';

    // ==========================================================
    // DAFTAR TOOLS
    // Mau nambah tool baru? Cukup tambahkan satu object di sini,
    // nggak perlu ubah HTML/CSS sama sekali.
    //
    // Contoh:
    // {
    //     id: 'nama-tool',
    //     name: 'Nama Tool',
    //     desc: 'Deskripsi singkat, fungsinya buat apa.',
    //     icon: 'icon-nama-tool.png', // taruh file iconnya di folder yang sama
    //     color: '#0EA5E9',           // warna aksen/glow tool ini
    //     url: 'nama-tool.html'       // halaman tool-nya
    // }
    // ==========================================================
    const TOOLS = [
        {
            id: 'qris',
            name: 'QRIS Dinamis',
            desc: 'Ubah QRIS statis kamu jadi QRIS dengan nominal yang sudah ditentukan.',
            icon: 'icon-512.png',
            color: '#4F46E5',
            url: 'qris.html'
        }
    ];

    const stage = document.getElementById('stage');
    const track = document.getElementById('track');
    const dotsRow = document.getElementById('dots');
    const toolNameEl = document.getElementById('toolName');
    const toolDescEl = document.getElementById('toolDesc');
    const openBtn = document.getElementById('openBtn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    let current = 0;
    const tiles = [];
    const dots = [];

    function hexToRgba(hex, alpha) {
        const h = hex.replace('#', '');
        const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
        const bigint = parseInt(full, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    }

    function buildTiles() {
        TOOLS.forEach((tool, i) => {
            const tile = document.createElement('button');
            tile.type = 'button';
            tile.className = 'tool-tile';
            tile.setAttribute('aria-label', 'Buka ' + tool.name);

            const img = document.createElement('img');
            img.src = tool.icon;
            img.alt = '';
            img.draggable = false;
            tile.appendChild(img);

            tile.addEventListener('click', () => {
                if (i === current) {
                    openTool(tool);
                } else {
                    goTo(i);
                }
            });

            track.appendChild(tile);
            tiles.push(tile);
        });
    }

    function buildDots() {
        if (TOOLS.length <= 1) return;
        TOOLS.forEach((_, i) => {
            const dot = document.createElement('button');
            dot.type = 'button';
            dot.className = 'dot';
            dot.setAttribute('aria-label', 'Ke tool ' + (i + 1));
            dot.addEventListener('click', () => goTo(i));
            dotsRow.appendChild(dot);
            dots.push(dot);
        });
    }

    function render() {
        const spacing = 110;

        tiles.forEach((tile, i) => {
            const diff = i - current;
            const dist = Math.abs(diff);
            const scale = dist === 0 ? 1 : 0.72;
            tile.style.transform = 'translate(-50%, -50%) translateX(' + (diff * spacing) + 'px) scale(' + scale + ')';
            tile.style.opacity = dist === 0 ? '1' : (dist === 1 ? '0.45' : '0');
            tile.style.zIndex = String(10 - dist);
            tile.style.pointerEvents = dist > 1 ? 'none' : 'auto';
            tile.tabIndex = dist === 0 ? 0 : -1;
        });

        dots.forEach((dot, i) => dot.classList.toggle('active', i === current));

        const tool = TOOLS[current];
        toolNameEl.textContent = tool.name;
        toolDescEl.textContent = tool.desc;
        stage.style.setProperty('--accent-glow', hexToRgba(tool.color, 0.35));

        const multi = TOOLS.length > 1;
        prevBtn.classList.toggle('hidden', !multi);
        nextBtn.classList.toggle('hidden', !multi);
        dotsRow.classList.toggle('hidden', !multi);
        prevBtn.disabled = current === 0;
        nextBtn.disabled = current === TOOLS.length - 1;
    }

    function goTo(index) {
        current = Math.max(0, Math.min(TOOLS.length - 1, index));
        render();
    }

    function openTool(tool) {
        window.location.href = tool.url;
    }

    prevBtn.addEventListener('click', () => goTo(current - 1));
    nextBtn.addEventListener('click', () => goTo(current + 1));
    openBtn.addEventListener('click', () => openTool(TOOLS[current]));

    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') goTo(current - 1);
        if (e.key === 'ArrowRight') goTo(current + 1);
        if (e.key === 'Enter' && document.activeElement && document.activeElement.classList.contains('tool-tile')) {
            openTool(TOOLS[current]);
        }
    });

    // Swipe di layar sentuh
    let touchStartX = null;

    stage.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
    }, { passive: true });

    stage.addEventListener('touchend', (e) => {
        if (touchStartX === null) return;
        const deltaX = e.changedTouches[0].clientX - touchStartX;
        const THRESHOLD = 40;
        if (deltaX > THRESHOLD) {
            goTo(current - 1);
        } else if (deltaX < -THRESHOLD) {
            goTo(current + 1);
        }
        touchStartX = null;
    });

    // ======= THEME (pakai localStorage key yang sama dengan tool lain) =======
    const THEME_KEY = 'qris-theme';
    const themeToggle = document.getElementById('themeToggle');
    const iconMoon = themeToggle.querySelector('.icon-moon');
    const iconSun = themeToggle.querySelector('.icon-sun');

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        iconMoon.classList.toggle('hidden', theme === 'dark');
        iconSun.classList.toggle('hidden', theme !== 'dark');
    }

    function initTheme() {
        const saved = localStorage.getItem(THEME_KEY);
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyTheme(saved || (prefersDark ? 'dark' : 'light'));
    }

    themeToggle.addEventListener('click', () => {
        const curTheme = document.documentElement.getAttribute('data-theme');
        const next = curTheme === 'dark' ? 'light' : 'dark';
        localStorage.setItem(THEME_KEY, next);
        applyTheme(next);
    });

    initTheme();
    buildTiles();
    buildDots();
    render();
})();
