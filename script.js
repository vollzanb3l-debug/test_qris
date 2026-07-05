document.addEventListener('DOMContentLoaded', () => {
    // --- DOM References ---
    const qrisImageInput = document.getElementById('qrisImage');
    const fileNameCaption = document.getElementById('fileNameCaption');
    const fileUploadWrapper = document.getElementById('fileUploadWrapper');
    const fileUploadDesign = document.getElementById('fileUploadDesign');
    const previewThumb = document.getElementById('previewThumb');
    const uploadTabs = document.querySelectorAll('.upload-tab');
    const cameraWrapper = document.getElementById('cameraWrapper');
    const cameraVideo = document.getElementById('cameraVideo');
    const cameraCloseBtn = document.getElementById('cameraCloseBtn');
    const nominalInput = document.getElementById('nominal');
    const chipRow = document.getElementById('chipRow');
    const feeToggle = document.getElementById('feeToggle');
    const feeOptions = document.getElementById('feeOptions');
    const feeTypeTabs = document.querySelectorAll('.fee-type-tab');
    const feeInput = document.getElementById('feeInput');
    const feeSymbol = document.getElementById('feeSymbol');
    const breakdown = document.getElementById('breakdown');
    const breakdownSubtotal = document.getElementById('breakdownSubtotal');
    const breakdownFeeRow = document.getElementById('breakdownFeeRow');
    const breakdownFee = document.getElementById('breakdownFee');
    const breakdownTotal = document.getElementById('breakdownTotal');
    const noteInput = document.getElementById('noteInput');
    const generateBtn = document.getElementById('generateBtn');
    const btnLabel = generateBtn.querySelector('.btn-label');
    const btnSpinner = document.getElementById('btnSpinner');
    const resultSection = document.getElementById('resultSection');
    const resultTotal = document.getElementById('resultTotal');
    const successCheck = document.querySelector('.success-check');
    const errorMsg = document.getElementById('errorMsg');
    const qrCanvas = document.getElementById('qrCanvas');
    const downloadBtn = document.getElementById('downloadBtn');
    const shareBtn = document.getElementById('shareBtn');
    const printBtn = document.getElementById('printBtn');
    const merchantInfo = document.getElementById('merchantInfo');
    const merchantName = document.getElementById('merchantName');
    const merchantCity = document.getElementById('merchantCity');
    const themeToggle = document.getElementById('themeToggle');
    const iconMoon = document.querySelector('.icon-moon');
    const iconSun = document.querySelector('.icon-sun');
    const historyToggle = document.getElementById('historyToggle');
    const historyList = document.getElementById('historyList');
    const historyEmpty = document.getElementById('historyEmpty');
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const statCountToday = document.getElementById('statCountToday');
    const statTotalToday = document.getElementById('statTotalToday');

    let originalQRISPayload = '';
    let feeType = 'fixed';
    let currentTransaction = { subtotal: 0, fee: 0, total: 0 };
    let cameraStream = null;
    let cameraRAF = null;
    const hiddenCanvas = document.createElement('canvas');
    const hiddenCtx = hiddenCanvas.getContext('2d', { willReadFrequently: true });
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const THEME_KEY = 'qris-theme';
    const HISTORY_KEY = 'qris-history';
    const HISTORY_LIMIT = 20;

    // =====================================================
    // THEME (DARK MODE)
    // =====================================================
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        iconMoon.classList.toggle('hidden', theme === 'dark');
        iconSun.classList.toggle('hidden', theme !== 'dark');
    }

    function initTheme() {
        const saved = localStorage.getItem(THEME_KEY);
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyTheme(saved || (prefersDark ? 'dark' : 'light'));
    }

    themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        localStorage.setItem(THEME_KEY, next);
        applyTheme(next);
    });

    initTheme();

    // =====================================================
    // STEPPER
    // =====================================================
    function updateStepper(activeStep) {
        document.querySelectorAll('.step').forEach((stepEl) => {
            const num = parseInt(stepEl.dataset.step, 10);
            stepEl.classList.remove('active', 'completed');
            if (num < activeStep) stepEl.classList.add('completed');
            else if (num === activeStep) stepEl.classList.add('active');
        });
    }

    // =====================================================
    // UPLOAD MODE TABS (UPLOAD vs KAMERA)
    // =====================================================
    function switchUploadMode(mode) {
        uploadTabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.mode === mode));
        if (mode === 'camera') {
            fileUploadWrapper.classList.add('hidden');
            startCamera();
        } else {
            stopCamera();
            fileUploadWrapper.classList.remove('hidden');
        }
    }

    uploadTabs.forEach((tab) => {
        tab.addEventListener('click', () => switchUploadMode(tab.dataset.mode));
    });

    cameraCloseBtn.addEventListener('click', () => switchUploadMode('upload'));

    // =====================================================
    // FILE UPLOAD + DRAG & DROP
    // =====================================================
    function handleFile(file) {
        if (!file) return;
        if (!file.type || !file.type.startsWith('image/')) {
            showError('File harus berupa gambar (JPG/PNG).');
            return;
        }

        hideError();
        originalQRISPayload = '';
        generateBtn.disabled = true;
        merchantInfo.classList.add('hidden');
        resultSection.classList.add('hidden');
        updateStepper(1);

        const reader = new FileReader();
        reader.onload = function (event) {
            previewThumb.src = event.target.result;
            previewThumb.classList.remove('hidden');
            fileUploadDesign.classList.add('hidden');
            fileNameCaption.textContent = file.name;
            fileNameCaption.classList.remove('hidden');

            const img = new Image();
            img.onload = function () {
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                context.drawImage(img, 0, 0, canvas.width, canvas.height);

                const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height);

                if (code) {
                    if (code.data.startsWith('000201')) {
                        originalQRISPayload = code.data;
                        showMerchantInfo(code.data);
                        computeBreakdown();
                        updateStepper(2);
                    } else {
                        showError('QR Code tidak valid. Pastikan itu adalah QRIS.');
                    }
                } else {
                    showError('Tidak dapat membaca QR Code dari gambar. Coba gambar yang lebih jelas.');
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    qrisImageInput.addEventListener('change', (e) => handleFile(e.target.files[0]));

    ['dragover', 'dragenter'].forEach((evt) => {
        fileUploadWrapper.addEventListener(evt, (e) => {
            e.preventDefault();
            fileUploadWrapper.classList.add('drag-active');
        });
    });

    ['dragleave', 'dragend'].forEach((evt) => {
        fileUploadWrapper.addEventListener(evt, () => {
            fileUploadWrapper.classList.remove('drag-active');
        });
    });

    fileUploadWrapper.addEventListener('drop', (e) => {
        e.preventDefault();
        fileUploadWrapper.classList.remove('drag-active');
        const file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) handleFile(file);
    });

    // =====================================================
    // SCAN KAMERA LANGSUNG
    // =====================================================
    async function startCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showError('Perangkat/browser ini tidak mendukung akses kamera. Gunakan upload gambar.');
            switchUploadMode('upload');
            return;
        }
        try {
            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            cameraVideo.srcObject = cameraStream;
            await cameraVideo.play();
            cameraWrapper.classList.remove('hidden');
            hideError();
            scanLoop();
        } catch (err) {
            showError('Tidak bisa mengakses kamera. Pastikan izin kamera diaktifkan, lalu coba lagi, atau gunakan upload gambar.');
            switchUploadMode('upload');
        }
    }

    function stopCamera() {
        if (cameraRAF) {
            cancelAnimationFrame(cameraRAF);
            cameraRAF = null;
        }
        if (cameraStream) {
            cameraStream.getTracks().forEach((track) => track.stop());
            cameraStream = null;
        }
        cameraWrapper.classList.add('hidden');
    }

    function scanLoop() {
        if (!cameraStream) return;
        if (cameraVideo.readyState === cameraVideo.HAVE_ENOUGH_DATA) {
            hiddenCanvas.width = cameraVideo.videoWidth;
            hiddenCanvas.height = cameraVideo.videoHeight;
            hiddenCtx.drawImage(cameraVideo, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
            const imageData = hiddenCtx.getImageData(0, 0, hiddenCanvas.width, hiddenCanvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);

            if (code && code.data.startsWith('000201')) {
                originalQRISPayload = code.data;
                showMerchantInfo(code.data);
                computeBreakdown();
                updateStepper(2);
                hideError();
                fileNameCaption.textContent = 'QRIS berhasil dipindai dari kamera';
                fileNameCaption.classList.remove('hidden');
                fileUploadDesign.classList.add('hidden');
                previewThumb.classList.add('hidden');
                stopCamera();
                switchUploadMode('upload');
                return;
            }
        }
        cameraRAF = requestAnimationFrame(scanLoop);
    }

    // =====================================================
    // FORMAT NOMINAL (PEMISAH RIBUAN) + CHIP PRESET
    // =====================================================
    function getRawNominal() {
        return parseInt(nominalInput.value.replace(/\D/g, ''), 10) || 0;
    }

    function formatNominalDisplay(raw) {
        return raw ? Number(raw).toLocaleString('id-ID') : '';
    }

    function updateChipActiveState(raw) {
        chipRow.querySelectorAll('.chip').forEach((chip) => {
            chip.classList.toggle('active', parseInt(chip.dataset.value, 10) === raw);
        });
    }

    nominalInput.addEventListener('input', () => {
        const raw = getRawNominal();
        nominalInput.value = formatNominalDisplay(raw);
        updateChipActiveState(raw);
        computeBreakdown();
    });

    chipRow.querySelectorAll('.chip').forEach((chip) => {
        chip.addEventListener('click', () => {
            const raw = parseInt(chip.dataset.value, 10);
            nominalInput.value = formatNominalDisplay(raw);
            updateChipActiveState(raw);
            computeBreakdown();
        });
    });

    // =====================================================
    // BIAYA TAMBAHAN (ADMIN / SERVICE FEE)
    // =====================================================
    function getFeeRawValue() {
        if (feeType === 'fixed') {
            return parseInt(feeInput.value.replace(/\D/g, ''), 10) || 0;
        }
        return parseFloat(feeInput.value) || 0;
    }

    function formatFeeInputValue() {
        if (feeType === 'fixed') {
            const raw = parseInt(feeInput.value.replace(/\D/g, ''), 10) || 0;
            feeInput.value = raw ? raw.toLocaleString('id-ID') : '';
        } else {
            let val = feeInput.value.replace(/[^0-9.]/g, '');
            const parts = val.split('.');
            if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
            feeInput.value = val;
        }
        computeBreakdown();
    }

    feeInput.addEventListener('input', formatFeeInputValue);

    feeToggle.addEventListener('change', () => {
        feeOptions.classList.toggle('hidden', !feeToggle.checked);
        if (!feeToggle.checked) feeInput.value = '';
        computeBreakdown();
    });

    feeTypeTabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            feeType = tab.dataset.feeType;
            feeTypeTabs.forEach((t) => t.classList.toggle('active', t === tab));
            feeSymbol.textContent = feeType === 'fixed' ? 'Rp' : '%';
            feeInput.value = '';
            computeBreakdown();
        });
    });

    // =====================================================
    // BREAKDOWN (SUBTOTAL + BIAYA = TOTAL)
    // =====================================================
    function computeBreakdown() {
        const subtotal = getRawNominal();
        let fee = 0;
        if (feeToggle.checked) {
            const feeRaw = getFeeRawValue();
            fee = feeType === 'fixed' ? feeRaw : Math.round(subtotal * feeRaw / 100);
        }
        const total = subtotal + fee;

        if (subtotal > 0) {
            breakdown.classList.remove('hidden');
            breakdownSubtotal.textContent = `Rp ${subtotal.toLocaleString('id-ID')}`;
            breakdownFeeRow.classList.toggle('hidden', fee <= 0);
            breakdownFee.textContent = `Rp ${fee.toLocaleString('id-ID')}`;
            breakdownTotal.textContent = `Rp ${total.toLocaleString('id-ID')}`;
        } else {
            breakdown.classList.add('hidden');
        }

        checkFormValidity();
        return { subtotal, fee, total };
    }

    // =====================================================
    // VALIDASI FORM
    // =====================================================
    function isFormValid() {
        return Boolean(originalQRISPayload) && getRawNominal() > 0;
    }

    function checkFormValidity() {
        generateBtn.disabled = !isFormValid();
    }

    // =====================================================
    // ANIMASI HITUNG NAIK (ALA TOTAL DI KASIR)
    // =====================================================
    function animateCountUp(el, target, duration = 600) {
        if (prefersReducedMotion || target === 0) {
            el.textContent = `Rp ${target.toLocaleString('id-ID')}`;
            return;
        }
        const start = performance.now();
        function step(now) {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(target * eased);
            el.textContent = `Rp ${current.toLocaleString('id-ID')}`;
            if (progress < 1) requestAnimationFrame(step);
            else el.textContent = `Rp ${target.toLocaleString('id-ID')}`;
        }
        requestAnimationFrame(step);
    }

    function playSuccessAnimation() {
        successCheck.classList.remove('play');
        void successCheck.offsetWidth; // force reflow supaya animasi bisa diulang
        successCheck.classList.add('play');
    }

    // =====================================================
    // GENERATE QR BARU
    // =====================================================
    function setGenerating(isLoading) {
        btnLabel.textContent = isLoading ? 'Membuat...' : 'Buat QRIS Baru';
        btnSpinner.classList.toggle('hidden', !isLoading);
        generateBtn.disabled = isLoading || !isFormValid();
    }

    generateBtn.addEventListener('click', () => {
        try {
            setGenerating(true);
            const { subtotal, fee, total } = computeBreakdown();
            const newPayload = createDynamicQRIS(originalQRISPayload, total);

            QRCode.toCanvas(qrCanvas, newPayload, {
                width: 300,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                }
            }, function (error) {
                setGenerating(false);
                if (error) {
                    showError('Gagal membuat gambar QR Code baru.');
                    console.error(error);
                } else {
                    currentTransaction = { subtotal, fee, total };
                    resultSection.classList.remove('hidden');
                    animateCountUp(resultTotal, total);
                    playSuccessAnimation();
                    updateStepper(3);
                    resultSection.scrollIntoView({ behavior: 'smooth' });

                    const note = noteInput.value.trim();
                    saveToHistory({ subtotal, fee, total, payload: newPayload, note });
                    noteInput.value = '';
                }
            });
        } catch (error) {
            setGenerating(false);
            showError('Terjadi kesalahan: ' + error.message);
        }
    });

    // =====================================================
    // DOWNLOAD, BAGIKAN, CETAK
    // =====================================================
    downloadBtn.addEventListener('click', () => {
        const image = qrCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `QRIS_${currentTransaction.total}.png`;
        link.href = image;
        link.click();
    });

    shareBtn.addEventListener('click', async () => {
        try {
            const blob = await new Promise((resolve) => qrCanvas.toBlob(resolve, 'image/png'));
            const file = new File([blob], `QRIS_${currentTransaction.total}.png`, { type: 'image/png' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'QRIS Pembayaran',
                    text: `QRIS pembayaran sebesar Rp ${currentTransaction.total.toLocaleString('id-ID')}`
                });
            } else {
                showError('Perangkat/browser ini belum mendukung fitur bagikan langsung. Silakan gunakan tombol Download, lalu kirim manual.');
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                showError('Gagal membagikan QRIS.');
            }
        }
    });

    printBtn.addEventListener('click', () => {
        const dataUrl = qrCanvas.toDataURL('image/png');
        const info = extractMerchantInfo(originalQRISPayload);
        const { subtotal, fee, total } = currentTransaction;

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            showError('Gagal membuka jendela cetak. Pastikan pop-up tidak diblokir browser.');
            return;
        }

        const feeLines = fee > 0
            ? `<p class="line">Subtotal: Rp ${subtotal.toLocaleString('id-ID')}</p>
               <p class="line">Biaya Admin: Rp ${fee.toLocaleString('id-ID')}</p>`
            : '';

        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="id">
            <head>
                <meta charset="UTF-8">
                <title>Cetak QRIS</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 40px; }
                    img { width: 300px; height: 300px; margin: 16px auto; display: block; }
                    h2 { margin-bottom: 4px; }
                    p.city { color: #555; margin-top: 0; }
                    p.line { color: #555; margin: 2px 0; font-size: 14px; }
                    .nominal { font-size: 24px; font-weight: bold; margin-top: 12px; }
                </style>
            </head>
            <body>
                <h2>${escapeHtml(info.name || 'QRIS Pembayaran')}</h2>
                <p class="city">${escapeHtml(info.city || '')}</p>
                <img src="${dataUrl}" alt="QRIS">
                ${feeLines}
                <div class="nominal">Total: Rp ${total.toLocaleString('id-ID')}</div>
                <script>
                    window.onload = function () { window.print(); };
                <\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
    });

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // =====================================================
    // RIWAYAT (LOCALSTORAGE)
    // =====================================================
    function loadHistory() {
        try {
            return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
        } catch (e) {
            return [];
        }
    }

    // Ambil total & subtotal dengan aman, termasuk untuk entri riwayat versi lama
    // (sebelum fitur biaya tambahan ada) yang cuma punya field "nominal".
    function normalizeEntry(entry) {
        return {
            subtotal: entry.subtotal ?? entry.nominal ?? 0,
            fee: entry.fee ?? 0,
            total: entry.total ?? entry.nominal ?? 0,
            note: entry.note || '',
            merchantName: entry.merchantName || 'QRIS',
            merchantCity: entry.merchantCity || '',
            timestamp: entry.timestamp,
            payload: entry.payload
        };
    }

    function saveToHistory({ subtotal, fee, total, payload, note }) {
        const history = loadHistory();
        const info = extractMerchantInfo(originalQRISPayload);
        history.unshift({
            subtotal,
            fee,
            total,
            payload,
            note,
            merchantName: info.name || 'QRIS',
            merchantCity: info.city || '',
            timestamp: Date.now()
        });
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_LIMIT)));
        renderHistory();
        renderStats();
    }

    function formatRelativeDate(ts) {
        const diffMinutes = Math.floor((Date.now() - ts) / 60000);
        if (diffMinutes < 1) return 'Baru saja';
        if (diffMinutes < 60) return `${diffMinutes} menit lalu`;
        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) return `${diffHours} jam lalu`;
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 7) return `${diffDays} hari lalu`;
        return new Date(ts).toLocaleDateString('id-ID');
    }

    function renderHistory() {
        const history = loadHistory();
        historyList.innerHTML = '';
        historyList.appendChild(exportCsvBtn);

        if (history.length === 0) {
            historyList.appendChild(historyEmpty);
            historyEmpty.classList.remove('hidden');
            return;
        }

        history.forEach((rawEntry) => {
            const entry = normalizeEntry(rawEntry);
            const item = document.createElement('div');
            item.className = 'history-item';

            const infoDiv = document.createElement('div');
            infoDiv.className = 'history-item-info';

            const nominalP = document.createElement('p');
            nominalP.className = 'history-item-nominal';
            nominalP.textContent = `Rp ${entry.total.toLocaleString('id-ID')}`;

            const metaP = document.createElement('p');
            metaP.className = 'history-item-meta';
            const cityPart = entry.merchantCity ? ` · ${entry.merchantCity}` : '';
            const feePart = entry.fee > 0 ? ` (termasuk biaya Rp ${entry.fee.toLocaleString('id-ID')})` : '';
            metaP.textContent = `${entry.merchantName}${cityPart} — ${formatRelativeDate(entry.timestamp)}${feePart}`;

            infoDiv.appendChild(nominalP);
            infoDiv.appendChild(metaP);

            if (entry.note) {
                const noteP = document.createElement('p');
                noteP.className = 'history-item-note';
                noteP.textContent = `"${entry.note}"`;
                infoDiv.appendChild(noteP);
            }

            const viewBtn = document.createElement('button');
            viewBtn.type = 'button';
            viewBtn.className = 'history-item-btn';
            viewBtn.textContent = 'Lihat';
            viewBtn.addEventListener('click', () => {
                QRCode.toCanvas(qrCanvas, entry.payload, {
                    width: 300,
                    margin: 2,
                    color: { dark: '#000000', light: '#ffffff' }
                }, (err) => {
                    if (!err) {
                        currentTransaction = { subtotal: entry.subtotal, fee: entry.fee, total: entry.total };
                        nominalInput.value = formatNominalDisplay(entry.subtotal);
                        resultSection.classList.remove('hidden');
                        animateCountUp(resultTotal, entry.total);
                        playSuccessAnimation();
                        updateStepper(3);
                        resultSection.scrollIntoView({ behavior: 'smooth' });
                    }
                });
            });

            item.appendChild(infoDiv);
            item.appendChild(viewBtn);
            historyList.appendChild(item);
        });

        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'history-clear';
        clearBtn.textContent = 'Hapus semua riwayat';
        clearBtn.addEventListener('click', () => {
            localStorage.removeItem(HISTORY_KEY);
            renderHistory();
            renderStats();
        });
        historyList.appendChild(clearBtn);
    }

    function renderStats() {
        const history = loadHistory();
        const today = new Date();
        const isToday = (ts) => {
            const d = new Date(ts);
            return d.getFullYear() === today.getFullYear()
                && d.getMonth() === today.getMonth()
                && d.getDate() === today.getDate();
        };
        const todaysEntries = history.filter((e) => isToday(e.timestamp)).map(normalizeEntry);
        const totalToday = todaysEntries.reduce((sum, e) => sum + e.total, 0);
        statCountToday.textContent = todaysEntries.length;
        statTotalToday.textContent = `Rp ${totalToday.toLocaleString('id-ID')}`;
    }

    historyToggle.addEventListener('click', () => {
        historyList.classList.toggle('hidden');
        historyToggle.classList.toggle('open');
    });

    function csvEscape(value) {
        const str = String(value);
        if (/[",\n]/.test(str)) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }

    exportCsvBtn.addEventListener('click', () => {
        const history = loadHistory();
        if (history.length === 0) {
            showError('Belum ada riwayat untuk diexport.');
            return;
        }
        const header = ['Tanggal', 'Waktu', 'Merchant', 'Kota', 'Catatan', 'Subtotal', 'Biaya Admin', 'Total'];
        const rows = history.map((rawEntry) => {
            const entry = normalizeEntry(rawEntry);
            const date = new Date(entry.timestamp);
            return [
                date.toLocaleDateString('id-ID'),
                date.toLocaleTimeString('id-ID'),
                entry.merchantName,
                entry.merchantCity,
                entry.note,
                entry.subtotal,
                entry.fee,
                entry.total
            ];
        });
        const csvContent = [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n');
        // \uFEFF (BOM) ditambahkan agar Excel membaca karakter Indonesia dengan benar
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `riwayat-qris-${Date.now()}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    });

    renderHistory();
    renderStats();

    // =====================================================
    // ERROR HELPERS
    // =====================================================
    function showError(message) {
        errorMsg.textContent = message;
        errorMsg.classList.remove('hidden');
        resultSection.classList.add('hidden');
    }

    function hideError() {
        errorMsg.classList.add('hidden');
    }

    // =====================================================
    // CORE LOGIC — MODIFIKASI QRIS (TLV / EMV QR PARSER)
    // =====================================================

    function parseTLV(payload) {
        const tags = [];
        let i = 0;
        while (i < payload.length) {
            const tag = payload.substring(i, i + 2);
            const length = parseInt(payload.substring(i + 2, i + 4), 10);
            const value = payload.substring(i + 4, i + 4 + length);
            tags.push({ tag, value });
            i += 4 + length;
        }
        return tags;
    }

    function buildTLV(tags) {
        return tags
            .map(({ tag, value }) => {
                const length = value.length.toString().padStart(2, '0');
                return `${tag}${length}${value}`;
            })
            .join('');
    }

    function extractMerchantInfo(payload) {
        if (!payload) return { name: null, city: null };
        try {
            const tags = parseTLV(payload);
            const nameTag = tags.find((t) => t.tag === '59');
            const cityTag = tags.find((t) => t.tag === '60');
            return {
                name: nameTag ? nameTag.value : null,
                city: cityTag ? cityTag.value : null
            };
        } catch (e) {
            return { name: null, city: null };
        }
    }

    function showMerchantInfo(payload) {
        const info = extractMerchantInfo(payload);
        if (info.name) {
            merchantName.textContent = info.name;
            merchantCity.textContent = info.city || '';
            merchantInfo.classList.remove('hidden');
        } else {
            merchantInfo.classList.add('hidden');
        }
    }

    function createDynamicQRIS(payload, nominal) {
        let tags = parseTLV(payload);
        tags = tags.filter((t) => t.tag !== '54' && t.tag !== '63');
        tags = tags.map((t) => (t.tag === '01' ? { ...t, value: '12' } : t));

        const nominalStr = nominal.toString();
        const tag54 = { tag: '54', value: nominalStr };
        const idx53 = tags.findIndex((t) => t.tag === '53');
        if (idx53 !== -1) {
            tags.splice(idx53 + 1, 0, tag54);
        } else {
            tags.push(tag54);
        }

        const payloadWithoutCRC = buildTLV(tags) + '6304';
        const crcValue = calculateCRC16(payloadWithoutCRC);
        return payloadWithoutCRC + crcValue;
    }

    function calculateCRC16(str) {
        let crc = 0xFFFF;
        for (let i = 0; i < str.length; i++) {
            crc ^= str.charCodeAt(i) << 8;
            for (let j = 0; j < 8; j++) {
                if ((crc & 0x8000) > 0) {
                    crc = (crc << 1) ^ 0x1021;
                } else {
                    crc = crc << 1;
                }
            }
        }
        return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    }
});
