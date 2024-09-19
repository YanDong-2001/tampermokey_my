// ==UserScript==
// @name         获取图片URL和二维码信息并提供复制功能
// @namespace    http://tampermonkey.net/
// @version      1.0
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

    // 添加自定义样式
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

    // 全局变量
    let currentPopup = null; // 当前显示的弹窗
    let ctrlPressed = false; // Ctrl键是否被按下

    // 监听Ctrl键的按下
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Control') ctrlPressed = true;
    });

    // 监听Ctrl键的释放
    document.addEventListener('keyup', function(e) {
        if (e.key === 'Control') ctrlPressed = false;
    });

    // 监听鼠标按下事件，处理Ctrl+右键点击图片
    document.addEventListener('mousedown', function(e) {
        if (ctrlPressed && e.button === 2 && e.target.tagName.toLowerCase() === 'img') {
            e.preventDefault();
            e.stopPropagation();
            showPopup(e.target.src);
            return false;
        }
    }, true);

    // 阻止默认的右键菜单
    document.addEventListener('contextmenu', function(e) {
        if (ctrlPressed && e.target.tagName.toLowerCase() === 'img') {
            e.preventDefault();
            return false;
        }
    }, true);

    // 显示弹窗
    function showPopup(imageUrl) {
        // 如果已有弹窗，先移除
        if (currentPopup) document.body.removeChild(currentPopup);

        // 创建新弹窗
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

        // 添加弹窗到页面并调整文本区域大小
        document.body.appendChild(popup);
        popup.querySelectorAll('textarea').forEach(autoResizeTextarea);
        currentPopup = popup;

        // 添加复制URL按钮事件
        document.getElementById('copyUrlButton').addEventListener('click', function() {
            GM_setClipboard(imageUrl);
            alert('图片URL已复制到剪贴板');
            closePopup();
        });

        // 添加复制二维码信息按钮事件
        document.getElementById('copyQrButton').addEventListener('click', function() {
            GM_setClipboard(document.getElementById('qrTextarea').value);
            alert('二维码信息已复制到剪贴板');
            closePopup();
        });

        // 添加下载二维码按钮事件
        document.getElementById('downloadQrButton').addEventListener('click', downloadQRCode);
        
        // 添加点击外部关闭弹窗事件
        document.addEventListener('click', closePopupOnOutsideClick);
        
        // 开始检测二维码
        detectQRCode(imageUrl);
    }

    // 检测图片中的二维码
    function detectQRCode(imageUrl) {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0, img.width, img.height);
            
            // 图像预处理
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const processedImageData = preProcessImage(imageData);
            
            // 使用jsQR库检测二维码
            const code = jsQR(processedImageData.data, processedImageData.width, processedImageData.height);

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

    // 图像预处理函数
    function preProcessImage(imageData) {
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            // 转换为灰度
            const avg = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
            
            // 应用自适应阈值
            const threshold = getLocalThreshold(data, i, imageData.width, imageData.height);
            const value = avg < threshold ? 0 : 255;
            
            data[i] = data[i + 1] = data[i + 2] = value;
        }
        return imageData;
    }

    // 获取局部阈值
    function getLocalThreshold(data, index, width, height) {
        const blockSize = 11; // 局部区域大小
        const x = (index / 4) % width;
        const y = Math.floor((index / 4) / width);
        let sum = 0;
        let count = 0;

        for (let j = Math.max(0, y - blockSize / 2); j < Math.min(height, y + blockSize / 2); j++) {
            for (let i = Math.max(0, x - blockSize / 2); i < Math.min(width, x + blockSize / 2); i++) {
                const idx = (j * width + i) * 4;
                sum += (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114);
                count++;
            }
        }

        return sum / count;
    }

    // 生成新的二维码
    function generateQRCode(data) {
        const canvas = document.getElementById('qrCodeCanvas');
        QRCode.toCanvas(canvas, data, function (error) {
            if (error) console.error(error);
            canvas.style.display = 'block';
            document.getElementById('downloadQrButton').style.display = 'block';
        });
    }

    // 下载生成的二维码
    function downloadQRCode() {
        const canvas = document.getElementById('qrCodeCanvas');
        const link = document.createElement('a');
        link.download = 'qrcode.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    // 自动调整文本区域大小
    function autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    }

    // 关闭弹窗
    function closePopup() {
        if (currentPopup) {
            document.body.removeChild(currentPopup);
            currentPopup = null;
            document.removeEventListener('click', closePopupOnOutsideClick);
        }
    }

    // 点击弹窗外部时关闭弹窗
    function closePopupOnOutsideClick(event) {
        if (currentPopup && !currentPopup.contains(event.target)) {
            closePopup();
        }
    }
})();