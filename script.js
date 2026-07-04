document.addEventListener('DOMContentLoaded', () => {
    const qrisImageInput = document.getElementById('qrisImage');
    const fileNameDisplay = document.getElementById('fileName');
    const nominalInput = document.getElementById('nominal');
    const generateBtn = document.getElementById('generateBtn');
    const resultSection = document.getElementById('resultSection');
    const errorMsg = document.getElementById('errorMsg');
    const qrCanvas = document.getElementById('qrCanvas');
    const downloadBtn = document.getElementById('downloadBtn');

    let originalQRISPayload = '';

    // 1. Handle File Upload and Read QR
    qrisImageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        fileNameDisplay.textContent = file.name;
        hideError();
        originalQRISPayload = '';
        generateBtn.disabled = true;

        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                // Create an off-screen canvas to read image data
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                context.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                
                // Use jsQR to decode
                const code = jsQR(imageData.data, imageData.width, imageData.height);
                
                if (code) {
                    if (code.data.startsWith('000201')) {
                        originalQRISPayload = code.data;
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
    });

    nominalInput.addEventListener('input', checkFormValidity);

    function checkFormValidity() {
        if (originalQRISPayload && nominalInput.value && parseInt(nominalInput.value) > 0) {
            generateBtn.disabled = false;
        } else {
            generateBtn.disabled = true;
        }
    }

    // 2. Modify QRIS Payload
    generateBtn.addEventListener('click', () => {
        try {
            const nominal = parseInt(nominalInput.value);
            const newPayload = createDynamicQRIS(originalQRISPayload, nominal);
            
            // 3. Generate New QR Code
            QRCode.toCanvas(qrCanvas, newPayload, {
                width: 300,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                }
            }, function (error) {
                if (error) {
                    showError('Gagal membuat gambar QR Code baru.');
                    console.error(error);
                } else {
                    resultSection.classList.remove('hidden');
                    // Scroll to result
                    resultSection.scrollIntoView({ behavior: 'smooth' });
                }
            });
        } catch (error) {
            showError('Terjadi kesalahan: ' + error.message);
        }
    });

    // 4. Download QR Code
    downloadBtn.addEventListener('click', () => {
        const image = qrCanvas.toDataURL("image/png");
        const link = document.createElement('a');
        link.download = `QRIS_${nominalInput.value}.png`;
        link.href = image;
        link.click();
    });

    function showError(message) {
        errorMsg.textContent = message;
        errorMsg.classList.remove('hidden');
        resultSection.classList.add('hidden');
    }

    function hideError() {
        errorMsg.classList.add('hidden');
    }

    // --- Core Logic for QRIS Modification ---

    function createDynamicQRIS(payload, nominal) {
        // Step 1: Remove CRC (Tag 63) which is always at the end and has length 04 + 4 chars value = 8 chars
        // Format of CRC: 6304XXXX
        let payloadWithoutCRC = payload;
        if (payload.length > 8 && payload.substring(payload.length - 8, payload.length - 4) === '6304') {
            payloadWithoutCRC = payload.substring(0, payload.length - 8);
        } else {
            // Find 6304 just in case it's not strictly at the end, though it should be.
            let crcIdx = payload.lastIndexOf('6304');
            if(crcIdx !== -1) {
                payloadWithoutCRC = payload.substring(0, crcIdx);
            }
        }

        // Step 2: Change Point of Initiation Method (Tag 01) from 11 (Static) to 12 (Dynamic)
        // Usually it's 010211. We replace it with 010212.
        payloadWithoutCRC = payloadWithoutCRC.replace('010211', '010212');

        // Step 3: Remove existing Tag 54 (Transaction Amount) if it exists, to replace it.
        // This is a simple TLV parser just to remove tag 54.
        payloadWithoutCRC = removeTag(payloadWithoutCRC, '54');

        // Step 4: Construct the new Tag 54
        const nominalStr = nominal.toString();
        const lengthStr = nominalStr.length.toString().padStart(2, '0');
        const tag54 = `54${lengthStr}${nominalStr}`;

        // Step 5: Append the new Tag 54 before the CRC
        // We just append it to the payload without CRC
        let newPayload = payloadWithoutCRC + tag54;

        // Step 6: Add Tag 63 ID and Length (6304) to calculate CRC
        newPayload += '6304';

        // Step 7: Calculate new CRC
        const crcValue = calculateCRC16(newPayload);

        // Step 8: Append CRC value
        return newPayload + crcValue;
    }

    function removeTag(payload, targetTag) {
        let i = 0;
        let result = '';
        while (i < payload.length) {
            const tag = payload.substring(i, i + 2);
            const length = parseInt(payload.substring(i + 2, i + 4), 10);
            const totalLen = 4 + length;
            
            if (tag !== targetTag) {
                result += payload.substring(i, i + totalLen);
            }
            i += totalLen;
        }
        return result;
    }

    // CRC-16/CCITT-FALSE calculation
    function calculateCRC16(str) {
        let crc = 0xFFFF;
        for (let i = 0; i < str.length; i++) {
            crc ^= str.charCodeAt(i) << 8;
            for (let j = 0; j < 8; j++) {
                if ((crc & 0x8000) > 0) {
                    crc = ((crc << 1) ^ 0x1021);
                } else {
                    crc = (crc << 1);
                }
            }
        }
        return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    }
});
