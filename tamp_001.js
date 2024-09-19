// ==UserScript==
// @name         获取图片URL和二维码信息并提供复制功能
// @namespace    http://tampermonkey.net/
// @version      0.7
// @description  Ctrl+右键点击图片时:显示URL、并识别其中可能存在的二维码(目前来看png格式最佳)，同时提供下载新生成的二维码功能
// @match        *://*/*
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @license      GPL-3.0
// @require      https://cdn.jsdelivr.net/npm/jsqr@1.3.1/dist/jsQR.min.js
// @require      https://cdn.jsdelivr.net/npm/qrcode@1.4.4/build/qrcode.min.js
// ==/UserScript==

(function() {
    'use strict';

    GM_addStyle(`
        #imageUrlPopup {
            position: fixed;
            background: #ffffff;
            border-radius: 8px;
            padding: 15px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            font-family: Arial, sans-serif;
            width: 200px;
            height: auto;
            overflow-y: auto;
            top: 10px;
            left: 10px;
        }
        #imageUrlPopup p {
            margin: 0 0 10px 0;
            font-weight: bold;
            color: #333;
        }
        #imageUrlPopup textarea {
            width: calc(100% - 16px);
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin-bottom: 10px;
            font-size: 14px;
            resize: none;
            min-height: 20px;
            max-height: 150px;
            text-align: justify;
        }
        #imageUrlPopup button {
            width: 100%;
            padding: 8px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: background-color 0.3s;
        }
        #imageUrlPopup button:hover {
            background-color: #45a049;
        }
        #qrCodeCanvas {
            display: none;
            margin-top: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            max-width: 100%;
            height: auto;
        }
        #downloadQrButton {
            margin-top: 10px;
            background-color: #008CBA;
        }
        #downloadQrButton:hover {
            background-color: #007B9A;
        }
    `);

    let currentPopup = null;
    let ctrlPressed = false;

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Control') ctrlPressed = true;
    });

    document.addEventListener('keyup', function(e) {
        if (e.key === 'Control') ctrlPressed = false;
    });

    document.addEventListener('mousedown', function(e) {
        if (ctrlPressed && e.button === 2 && e.target.tagName.toLowerCase() === 'img') {
            e.preventDefault();
            e.stopPropagation();
            showPopup(e.target.src);
            return false;
        }
    }, true);

    document.addEventListener('contextmenu', function(e) {
        if (ctrlPressed && e.target.tagName.toLowerCase() === 'img') {
            e.preventDefault();
            return false;
        }
    }, true);

    function showPopup(imageUrl) {
        if (currentPopup) document.body.removeChild(currentPopup);

        var popup = document.createElement('div');
        popup.id = 'imageUrlPopup';
        popup.innerHTML = `
            <p>图片URL</p>
            <textarea readonly>${imageUrl}</textarea>
            <button id="copyUrlButton">复制URL到剪贴板</button>
            <p id="qrResult">正在识别二维码...</p>
            <textarea id="qrTextarea" readonly style="display:none;"></textarea>
            <button id="copyQrButton" style="display:none;">复制二维码信息</button>
            <canvas id="qrCodeCanvas"></canvas>
            <button id="downloadQrButton" style="display:none;">下载新二维码</button>
        `;

        document.body.appendChild(popup);
        popup.querySelectorAll('textarea').forEach(autoResizeTextarea);
        currentPopup = popup;

        document.getElementById('copyUrlButton').addEventListener('click', function() {
            GM_setClipboard(imageUrl);
            alert('图片URL已复制到剪贴板');
            closePopup();
        });

        document.getElementById('copyQrButton').addEventListener('click', function() {
            GM_setClipboard(document.getElementById('qrTextarea').value);
            alert('二维码信息已复制到剪贴板');
            closePopup();
        });

        document.getElementById('downloadQrButton').addEventListener('click', downloadQRCode);
        document.addEventListener('click', closePopupOnOutsideClick);
        detectQRCode(imageUrl);
    }

    function detectQRCode(imageUrl) {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0, img.width, img.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);

            const qrResult = document.getElementById('qrResult');
            const qrTextarea = document.getElementById('qrTextarea');
            const copyQrButton = document.getElementById('copyQrButton');
            if (code) {
                qrResult.textContent = "检测到二维码：";
                qrTextarea.value = code.data;
                qrTextarea.style.display = 'block';
                copyQrButton.style.display = 'block';
                autoResizeTextarea(qrTextarea);
                generateQRCode(code.data);
            } else {
                qrResult.textContent = "未检测到二维码";
                qrTextarea.style.display = 'none';
                copyQrButton.style.display = 'none';
            }
        };
        img.onerror = function() {
            document.getElementById('qrResult').textContent = "图片加载失败，无法识别二维码";
            document.getElementById('qrTextarea').style.display = 'none';
            document.getElementById('copyQrButton').style.display = 'none';
        };
        img.src = imageUrl;
    }

    function generateQRCode(data) {
        const canvas = document.getElementById('qrCodeCanvas');
        QRCode.toCanvas(canvas, data, function (error) {
            if (error) console.error(error);
            canvas.style.display = 'block';
            document.getElementById('downloadQrButton').style.display = 'block';
        });
    }

    function downloadQRCode() {
        const canvas = document.getElementById('qrCodeCanvas');
        const link = document.createElement('a');
        link.download = 'qrcode.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    function autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    }

    function closePopup() {
        if (currentPopup) {
            document.body.removeChild(currentPopup);
            currentPopup = null;
            document.removeEventListener('click', closePopupOnOutsideClick);
        }
    }

    function closePopupOnOutsideClick(event) {
        if (currentPopup && !currentPopup.contains(event.target)) {
            closePopup();
        }
    }
})();