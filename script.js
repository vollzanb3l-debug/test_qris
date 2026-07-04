document.addEventListener('DOMContentLoaded', () => {
    // --- DOM References ---
    const qrisImageInput = document.getElementById('qrisImage');
    const fileNameDisplay = document.getElementById('fileName');
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
    const generateBtn = document.getElementById('generateBtn');
    const btnLabel = generateBtn.querySelector('.btn-label');
    const btnSpinner = document.getElementById('btnSpinner');
    const resultSection = document.getElementById('resultSection');
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

    let originalQRISPayload = '';
    let cameraStream = null;
    let cameraRAF = null;
    const hiddenCanvas = document.createElement('canvas');
    const hiddenCtx = hiddenCanvas.getContext('2d', { willReadFrequently: true });

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
                        checkFormValidity();
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
                checkFormValidity();
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
        checkFormValidity();
    });

    chipRow.querySelectorAll('.chip').forEach((chip) => {
        chip.addEventListener('click', () => {
            const raw = parseInt(chip.dataset.value, 10);
            nominalInput.value = formatNominalDisplay(raw);
            updateChipActiveState(raw);
            checkFormValidity();
        });
    });

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
            const nominal = getRawNominal();
            const newPayload = createDynamicQRIS(originalQRISPayload, nominal);

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
                    resultSection.classList.remove('hidden');
                    resultSection.scrollIntoView({ behavior: 'smooth' });
                    saveToHistory(nominal, newPayload);
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
        link.download = `QRIS_${getRawNominal()}.png`;
        link.href = image;
        link.click();
    });

    shareBtn.addEventListener('click', async () => {
        try {
            const blob = await new Promise((resolve) => qrCanvas.toBlob(resolve, 'image/png'));
            const file = new File([blob], `QRIS_${getRawNominal()}.png`, { type: 'image/png' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'QRIS Pembayaran',
                    text: `QRIS pembayaran sebesar Rp ${nominalInput.value}`
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
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            showError('Gagal membuka jendela cetak. Pastikan pop-up tidak diblokir browser.');
            return;
        }
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
                    .nominal { font-size: 24px; font-weight: bold; margin-top: 12px; }
                </style>
            </head>
            <body>
                <h2>${escapeHtml(info.name || 'QRIS Pembayaran')}</h2>
                <p class="city">${escapeHtml(info.city || '')}</p>
                <img src="${dataUrl}" alt="QRIS">
                <div class="nominal">Rp ${nominalInput.value}</div>
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

    function saveToHistory(nominal, payload) {
        const history = loadHistory();
        const info = extractMerchantInfo(originalQRISPayload);
        history.unshift({
            nominal,
            payload,
            merchantName: info.name || 'QRIS',
            merchantCity: info.city || '',
            timestamp: Date.now()
        });
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_LIMIT)));
        renderHistory();
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

        if (history.length === 0) {
            historyList.appendChild(historyEmpty);
            historyEmpty.classList.remove('hidden');
            return;
        }

        history.forEach((entry, idx) => {
            const item = document.createElement('div');
            item.className = 'history-item';

            const infoDiv = document.createElement('div');
            infoDiv.className = 'history-item-info';

            const nominalP = document.createElement('p');
            nominalP.className = 'history-item-nominal';
            nominalP.textContent = `Rp ${Number(entry.nominal).toLocaleString('id-ID')}`;

            const metaP = document.createElement('p');
            metaP.className = 'history-item-meta';
            const cityPart = entry.merchantCity ? ` · ${entry.merchantCity}` : '';
            metaP.textContent = `${entry.merchantName}${cityPart} — ${formatRelativeDate(entry.timestamp)}`;

            infoDiv.appendChild(nominalP);
            infoDiv.appendChild(metaP);

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
                        nominalInput.value = formatNominalDisplay(entry.nominal);
                        resultSection.classList.remove('hidden');
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
        });
        historyList.appendChild(clearBtn);
    }

    historyToggle.addEventListener('click', () => {
        historyList.classList.toggle('hidden');
        historyToggle.classList.toggle('open');
    });

    renderHistory();

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

    // Parse payload EMV QR (QRIS) menjadi daftar tag terstruktur { tag, value }.
    // Urutan tag di payload asli dipertahankan.
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

    // Susun ulang daftar tag menjadi satu string payload EMV QR.
    function buildTLV(tags) {
        return tags
            .map(({ tag, value }) => {
                const length = value.length.toString().padStart(2, '0');
                return `${tag}${length}${value}`;
            })
            .join('');
    }

    // Ambil nama & kota merchant dari payload QRIS (Tag 59 & 60), untuk ditampilkan ke user.
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
        // Step 1: Parse seluruh payload jadi daftar tag terstruktur (termasuk tag 63/CRC lama).
        let tags = parseTLV(payload);

        // Step 2: Buang tag 54 (nominal lama) dan tag 63 (CRC lama, akan dihitung ulang).
        tags = tags.filter((t) => t.tag !== '54' && t.tag !== '63');

        // Step 3: Ubah Point of Initiation Method (Tag 01) dari 11 (statis) ke 12 (dinamis).
        tags = tags.map((t) => (t.tag === '01' ? { ...t, value: '12' } : t));

        // Step 4: Sisipkan Tag 54 (nominal baru) tepat setelah Tag 53 (Transaction Currency),
        // sesuai urutan standar EMVCo. Kalau Tag 53 tidak ditemukan, taruh di akhir sebagai fallback.
        const nominalStr = nominal.toString();
        const tag54 = { tag: '54', value: nominalStr };
        const idx53 = tags.findIndex((t) => t.tag === '53');
        if (idx53 !== -1) {
            tags.splice(idx53 + 1, 0, tag54);
        } else {
            tags.push(tag54);
        }

        // Step 5: Susun ulang jadi string, tambahkan header Tag 63 (6304) untuk dihitung CRC-nya.
        const payloadWithoutCRC = buildTLV(tags) + '6304';

        // Step 6: Hitung CRC16 dan gabungkan jadi payload final.
        const crcValue = calculateCRC16(payloadWithoutCRC);
        return payloadWithoutCRC + crcValue;
    }

    // CRC-16/CCITT-FALSE calculation
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
