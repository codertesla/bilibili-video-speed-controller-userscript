// ==UserScript==
// @name         B站视频倍速器
// @namespace    https://github.com/codertesla/bilibili-video-speed-controller-userscript
// @version      1.5.0
// @description  自由设定 Bilibili 视频的默认播放速度。支持记住设置、自动应用、手动倍速检测、键盘快捷键控制、SPA 切换。
// @author       codertesla
// @match        *://*.bilibili.com/video/*
// @match        *://*.bilibili.com/bangumi/*
// @match        *://*.bilibili.com/cheese/*
// @icon         https://www.bilibili.com/favicon.ico
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_addStyle
// @license      MIT
// @supportURL   https://github.com/codertesla/bilibili-video-speed-controller-userscript
// @homepageURL  https://github.com/codertesla/bilibili-video-speed-controller-userscript
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ==================== 常量配置 ====================
    const SPEED_SETTINGS = {
        MIN: 0.1,
        MAX: 3.0,
        DEFAULT: 1.0,
        DEFAULT_ENABLED: true,
        BILIBILI_DEFAULT: 1.5,
        PRESETS: [0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0]
    };

    const STORAGE_KEYS = {
        speed: 'bilibiliSpeed',
        enabled: 'enabled',
        panelPosition: 'panelPosition',
        debug: 'debug'
    };

    // ==================== 存储工具 ====================
    const Storage = {
        get(key, defaultValue) {
            return GM_getValue(key, defaultValue);
        },
        set(key, value) {
            GM_setValue(key, value);
        }
    };

    // ==================== 日志工具 ====================
    const DEBUG = Storage.get(STORAGE_KEYS.debug, false);
    const LOG_PREFIX = '[BiliSpeeder]';

    const log = {
        info(message) {
            if (DEBUG) console.log(`${LOG_PREFIX} ${message}`);
        },
        warn(message, error) {
            if (error != null) console.warn(`${LOG_PREFIX} ${message}`, error);
            else console.warn(`${LOG_PREFIX} ${message}`);
        },
        error(message, error) {
            if (error != null) console.error(`${LOG_PREFIX} ${message}`, error);
            else console.error(`${LOG_PREFIX} ${message}`);
        }
    };

    // ==================== DOM 工具 ====================
    const DOMUtils = {
        findVideoElements() {
            return Array.from(document.querySelectorAll('video'));
        },

        getVideoContainer(video) {
            let container = video.parentElement;
            while (container && container.tagName !== 'BODY') {
                if (container.offsetWidth > video.offsetWidth ||
                    container.offsetHeight > video.offsetHeight) {
                    return container;
                }
                container = container.parentElement;
            }
            return video.parentElement || document.body;
        },

        isValidSpeed(speed) {
            return typeof speed === 'number' && !Number.isNaN(speed) &&
                speed >= SPEED_SETTINGS.MIN && speed <= SPEED_SETTINGS.MAX;
        },

        findOptimalObserverTarget(selectors) {
            for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (element) return element;
            }
            return document.body;
        },

        isVideoContainer(element) {
            if (!element || !element.classList) return false;
            if (element.querySelector && element.querySelector('video')) return true;
            const classList = element.classList;
            for (const cls of classList) {
                if (/^(player|video|media)/i.test(cls) || /player|video|media/i.test(cls)) {
                    return true;
                }
            }
            const id = element.id || '';
            return /^(player|video)/i.test(id);
        },

        describeElement(element) {
            if (!element) return 'unknown';
            const parts = [];
            if (element.tagName) parts.push(element.tagName.toLowerCase());
            if (element.id) parts.push(`#${element.id}`);
            if (element.classList && element.classList.length) {
                parts.push(`.${Array.from(element.classList).join('.')}`);
            }
            return parts.join('') || 'unnamed-element';
        }
    };

    // ==================== 视频速度控制器 ====================
    class VideoSpeedController {
        constructor(config = {}) {
            this.currentSpeed = config.defaultSpeed || SPEED_SETTINGS.BILIBILI_DEFAULT;
            this.enabled = config.defaultEnabled !== false;
            this.observer = null;
            this.isInitialized = false;

            // 使用 WeakMap / WeakSet 以便视频元素被移除后能被 GC
            this.observedVideos = new WeakSet();
            this.manualOverrides = new WeakMap();
            this.videoSources = new WeakMap();
            this.expectedRates = new WeakMap();

            this.boundHandleRateChange = this.handleRateChange.bind(this);
            this.boundHandleLoadedMetadata = this.handleLoadedMetadata.bind(this);
            this.boundRecordInteraction = this.recordInteraction.bind(this);
            this.boundHandleNavigation = this.handleNavigation.bind(this);

            this.interactionEvents = ['pointerdown', 'mousedown', 'keydown', 'wheel', 'touchstart'];
            this.interactionTrackingInitialized = false;
            this.navigationTrackingInitialized = false;
            this.lastUserInteraction = 0;
            this.lastUrl = location.href;

            this.config = {
                targetSelector: config.targetSelector || 'body',
                observeOptions: config.observeOptions || {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['src', 'class']
                },
                debounceDelay: config.debounceDelay || 300,
                saveDebounceDelay: config.saveDebounceDelay || 300,
                navigationDelay: config.navigationDelay || 300,
                manualOverrideInteractionWindow:
                    typeof config.manualOverrideInteractionWindow === 'number'
                        ? config.manualOverrideInteractionWindow
                        : 1200,
                ...config
            };

            this.applyTimer = null;
            this.saveTimer = null;
            this.onStateChange = null; // 供外部订阅（刷新菜单）
        }

        async initialize() {
            if (this.isInitialized) return;
            try {
                this.loadSettings();
                this.setupUserInteractionTracking();
                this.setupNavigationTracking();

                if (this.enabled) {
                    this.applyVideoSpeed();
                    this.setupObserver();
                }

                this.isInitialized = true;
                log.info('初始化完成');
            } catch (error) {
                log.error('初始化失败', error);
            }
        }

        loadSettings() {
            const savedSpeed = parseFloat(Storage.get(STORAGE_KEYS.speed, this.currentSpeed));
            const savedEnabled = Storage.get(STORAGE_KEYS.enabled, this.enabled);

            this.currentSpeed = DOMUtils.isValidSpeed(savedSpeed)
                ? savedSpeed
                : (this.config.defaultSpeed || SPEED_SETTINGS.BILIBILI_DEFAULT);
            this.enabled = savedEnabled;

            if (!DOMUtils.isValidSpeed(savedSpeed)) {
                log.warn(`无效的保存速度，已重置为 ${this.currentSpeed}x`);
            }
        }

        // 防抖持久化，避免拖动滑杆时每次 input 都同步写入
        saveSettings() {
            if (this.saveTimer) clearTimeout(this.saveTimer);
            this.saveTimer = setTimeout(() => {
                Storage.set(STORAGE_KEYS.speed, this.currentSpeed);
                Storage.set(STORAGE_KEYS.enabled, this.enabled);
                this.saveTimer = null;
            }, this.config.saveDebounceDelay);
        }

        setSpeed(newSpeed) {
            if (!DOMUtils.isValidSpeed(newSpeed)) return;
            if (Math.abs(this.currentSpeed - newSpeed) < 0.001) return;

            this.currentSpeed = newSpeed;
            this.saveSettings();
            this.clearManualOverrides();
            if (this.enabled) this.applyVideoSpeed();
            log.info(`速度设置为 ${newSpeed}x`);
            this.emitStateChange();
        }

        setEnabled(newEnabled) {
            if (this.enabled === newEnabled) return;
            this.enabled = newEnabled;
            this.saveSettings();
            if (this.enabled) {
                this.clearManualOverrides();
                this.applyVideoSpeed();
                this.setupObserver();
            } else {
                this.resetVideoSpeed();
                this.disconnectObserver();
            }
            log.info(`倍速功能 ${this.enabled ? '已启用' : '已禁用'}`);
            this.emitStateChange();
        }

        emitStateChange() {
            if (typeof this.onStateChange === 'function') {
                try { this.onStateChange(this.getStatus()); } catch (e) { /* ignore */ }
            }
        }

        debounceApply() {
            if (this.applyTimer) clearTimeout(this.applyTimer);
            this.applyTimer = setTimeout(() => {
                this.applyVideoSpeed();
                this.applyTimer = null;
            }, this.config.debounceDelay);
        }

        applyVideoSpeed() {
            try {
                const videos = DOMUtils.findVideoElements();
                let appliedCount = 0;
                videos.forEach(video => {
                    this.attachVideoListeners(video);
                    if (this.manualOverrides.has(video)) return;
                    if (this.setVideoPlaybackRate(video, this.currentSpeed)) appliedCount++;
                });
                if (appliedCount > 0) {
                    log.info(`已将 ${appliedCount} 个视频速度设置为 ${this.currentSpeed}x`);
                }
            } catch (error) {
                log.error('应用视频速度失败', error);
            }
        }

        resetVideoSpeed() {
            try {
                const videos = DOMUtils.findVideoElements();
                videos.forEach(video => {
                    this.attachVideoListeners(video);
                    this.setVideoPlaybackRate(video, 1.0);
                });
            } catch (error) {
                log.error('重置视频速度失败', error);
            }
        }

        setupObserver() {
            this.disconnectObserver();
            try {
                let targetNode;
                if (Array.isArray(this.config.targetSelector)) {
                    targetNode = DOMUtils.findOptimalObserverTarget(this.config.targetSelector);
                } else {
                    targetNode = document.querySelector(this.config.targetSelector) || document.body;
                }
                this.observer = new MutationObserver((mutations) => this.handleMutations(mutations));
                this.observer.observe(targetNode, this.config.observeOptions);
                log.info(`MutationObserver 已设置，目标: ${DOMUtils.describeElement(targetNode)}`);
            } catch (error) {
                log.error('设置观察器失败', error);
            }
        }

        handleMutations(mutations) {
            const filter = this.config.observeOptions.attributeFilter;
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE && this.isVideoRelatedElement(node)) {
                            if (this.enabled) this.debounceApply();
                            return;
                        }
                    }
                } else if (mutation.type === 'attributes' && mutation.target.nodeName === 'VIDEO') {
                    if (!filter || filter.includes(mutation.attributeName)) {
                        if (this.enabled) this.debounceApply();
                        return;
                    }
                }
            }
        }

        isVideoRelatedElement(element) {
            if (element.nodeName === 'VIDEO') return true;
            // 只检查顶层节点和一层子级，避免深度遍历
            if (element.querySelector && element.querySelector('video')) return true;
            return DOMUtils.isVideoContainer(element);
        }

        disconnectObserver() {
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
        }

        destroy() {
            this.disconnectObserver();
            if (this.applyTimer) { clearTimeout(this.applyTimer); this.applyTimer = null; }
            if (this.saveTimer) {
                clearTimeout(this.saveTimer);
                // 立即刷写，避免丢失最后一次修改
                Storage.set(STORAGE_KEYS.speed, this.currentSpeed);
                Storage.set(STORAGE_KEYS.enabled, this.enabled);
                this.saveTimer = null;
            }
            // 弱引用集合会随 video 元素一起回收，这里无法遍历移除监听器
            // 但 video 元素被移除时其监听器也会随之失效，无泄漏风险
            this.teardownUserInteractionTracking();
            this.teardownNavigationTracking();
            this.isInitialized = false;
            log.info('控制器已销毁');
        }

        getStatus() {
            return {
                enabled: this.enabled,
                currentSpeed: this.currentSpeed,
                isInitialized: this.isInitialized,
                videoCount: DOMUtils.findVideoElements().length
            };
        }

        attachVideoListeners(video) {
            if (!video || this.observedVideos.has(video)) return;
            video.addEventListener('ratechange', this.boundHandleRateChange, true);
            video.addEventListener('loadedmetadata', this.boundHandleLoadedMetadata, true);
            this.observedVideos.add(video);
            this.videoSources.set(video, video.currentSrc || video.src || '');
        }

        clearManualOverrides() {
            // WeakMap 无法直接 clear，重建即可
            this.manualOverrides = new WeakMap();
        }

        setVideoPlaybackRate(video, speed) {
            if (!video || !DOMUtils.isValidSpeed(speed)) return false;
            if (typeof video.playbackRate !== 'number') return false;
            if (Math.abs(video.playbackRate - speed) < 0.001) {
                this.manualOverrides.delete(video);
                return false;
            }
            try {
                // 记录"我们期望的值"，待异步 ratechange 到达时据此识别
                this.expectedRates.set(video, speed);
                video.playbackRate = speed;
                this.manualOverrides.delete(video);
                this.videoSources.set(video, video.currentSrc || video.src || '');
                return true;
            } catch (error) {
                this.expectedRates.delete(video);
                log.warn(`设置视频速度失败，速率=${speed}`, error);
                return false;
            }
        }

        handleRateChange(event) {
            const video = event.target;
            if (!video) return;
            const newRate = video.playbackRate;

            // 若本次变化源自脚本自身（expectedRates 中记录），直接消费并忽略
            const expected = this.expectedRates.get(video);
            if (expected !== undefined && Math.abs(newRate - expected) < 0.001) {
                this.expectedRates.delete(video);
                return;
            }

            if (!DOMUtils.isValidSpeed(newRate)) return;

            const now = Date.now();
            const interactionWindow = Math.max(0, this.config.manualOverrideInteractionWindow || 0);
            const hadRecentInteraction = now - this.lastUserInteraction <= interactionWindow;

            if (!hadRecentInteraction) {
                // 无用户交互，很可能是网站自身重置；重新应用我们的倍速
                this.manualOverrides.delete(video);
                if (this.enabled) this.debounceApply();
                return;
            }

            if (Math.abs(newRate - this.currentSpeed) < 0.001) {
                this.manualOverrides.delete(video);
                return;
            }

            this.manualOverrides.set(video, { speed: newRate, timestamp: now });
            log.info(`检测到手动倍速 ${newRate}x，暂停自动应用`);
        }

        handleLoadedMetadata(event) {
            const video = event.target;
            if (!video) return;
            const newSrc = video.currentSrc || video.src || '';
            const previousSrc = this.videoSources.get(video) || '';
            if (newSrc && newSrc !== previousSrc) {
                this.manualOverrides.delete(video);
                this.videoSources.set(video, newSrc);
                log.info('检测到新媒体源，恢复自动倍速');
            }
            if (this.enabled && !this.manualOverrides.has(video)) {
                this.debounceApply();
            }
        }

        recordInteraction() {
            this.lastUserInteraction = Date.now();
        }

        setupUserInteractionTracking() {
            if (this.interactionTrackingInitialized) return;
            this.interactionEvents.forEach(name =>
                document.addEventListener(name, this.boundRecordInteraction, true));
            this.interactionTrackingInitialized = true;
        }

        teardownUserInteractionTracking() {
            if (!this.interactionTrackingInitialized) return;
            this.interactionEvents.forEach(name =>
                document.removeEventListener(name, this.boundRecordInteraction, true));
            this.interactionTrackingInitialized = false;
        }

        // -------- SPA 导航处理 --------
        setupNavigationTracking() {
            if (this.navigationTrackingInitialized) return;
            this._patchHistory();
            window.addEventListener('popstate', this.boundHandleNavigation);
            window.addEventListener('bilispeeder:locationchange', this.boundHandleNavigation);
            this.navigationTrackingInitialized = true;
        }

        teardownNavigationTracking() {
            if (!this.navigationTrackingInitialized) return;
            window.removeEventListener('popstate', this.boundHandleNavigation);
            window.removeEventListener('bilispeeder:locationchange', this.boundHandleNavigation);
            this.navigationTrackingInitialized = false;
        }

        _patchHistory() {
            if (window.__biliSpeederHistoryPatched) return;
            window.__biliSpeederHistoryPatched = true;
            const dispatch = () => window.dispatchEvent(new Event('bilispeeder:locationchange'));
            ['pushState', 'replaceState'].forEach(method => {
                const original = history[method];
                if (typeof original !== 'function') return;
                history[method] = function patched(...args) {
                    const result = original.apply(this, args);
                    dispatch();
                    return result;
                };
            });
        }

        handleNavigation() {
            if (location.href === this.lastUrl) return;
            this.lastUrl = location.href;
            log.info(`导航到 ${location.href}`);
            this.prepareForNavigation();
            if (this.enabled) {
                // 等 B 站更换视频节点
                setTimeout(() => this.applyVideoSpeed(), this.config.navigationDelay);
            }
        }

        prepareForNavigation() {
            this.clearManualOverrides();
            this.videoSources = new WeakMap();
            this.expectedRates = new WeakMap();
            this.lastUserInteraction = 0;
        }
    }

    // ==================== 样式注入（幂等） ====================
    const injectedStyles = new Set();
    function injectStylesOnce(key, css) {
        if (injectedStyles.has(key)) return;
        injectedStyles.add(key);
        GM_addStyle(css);
    }

    // ==================== Toast ====================
    class Toast {
        constructor() {
            this.container = null;
            this.hideTimer = null;
            injectStylesOnce('toast', `
                .speed-toast {
                    position: absolute;
                    top: 10%;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 2147483647;
                    background: rgba(20, 20, 20, 0.9);
                    border-radius: 8px;
                    padding: 20px 40px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    color: #fff;
                    font-size: 32px;
                    font-weight: 500;
                    opacity: 0;
                    transition: opacity 0.15s ease;
                    pointer-events: none;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                }
                .speed-toast.visible { opacity: 1; }
            `);
        }

        ensureContainer(parent) {
            if (this.container && this.container.parentElement === parent) return;
            if (this.container) this.container.remove();
            this.container = document.createElement('div');
            this.container.className = 'speed-toast';
            parent.appendChild(this.container);
        }

        show(message, speed, referenceElement = null) {
            let targetParent = document.body;
            let isFixed = true;

            if (document.fullscreenElement) {
                targetParent = document.fullscreenElement;
                isFixed = false;
            } else if (referenceElement) {
                const container = DOMUtils.getVideoContainer(referenceElement);
                if (container && container !== document.body) {
                    targetParent = container;
                    isFixed = false;
                }
            }

            this.ensureContainer(targetParent);

            if (isFixed) {
                this.container.style.position = 'fixed';
                this.container.style.top = '80px';
            } else {
                this.container.style.position = 'absolute';
                this.container.style.top = '10%';
            }

            if (this.hideTimer) clearTimeout(this.hideTimer);
            this.container.textContent = message || `${speed.toFixed(2)}x`;
            // 强制 reflow 以触发过渡
            void this.container.offsetHeight;
            this.container.classList.add('visible');
            this.hideTimer = setTimeout(() => this.hide(), 800);
        }

        hide() {
            if (this.container) this.container.classList.remove('visible');
        }

        destroy() {
            if (this.hideTimer) clearTimeout(this.hideTimer);
            if (this.container) {
                this.container.remove();
                this.container = null;
            }
        }
    }

    // ==================== 键盘快捷键 ====================
    class KeyboardShortcuts {
        constructor(controller, toast) {
            this.controller = controller;
            this.toast = toast;
            this.speedStep = 0.25;
            this.boundHandleKeydown = this.handleKeydown.bind(this);
            document.addEventListener('keydown', this.boundHandleKeydown, true);
            log.info('快捷键已启用: Shift+> 增速, Shift+< 减速, / 重置');
        }

        handleKeydown(e) {
            const target = e.target;
            const tag = target && target.tagName ? target.tagName.toLowerCase() : '';
            if (tag === 'input' || tag === 'textarea' || (target && target.isContentEditable)) return;

            let handled = false;
            if (e.shiftKey && (e.key === '>' || e.key === '.')) {
                this.increaseSpeed();
                handled = true;
            } else if (e.shiftKey && (e.key === '<' || e.key === ',')) {
                this.decreaseSpeed();
                handled = true;
            } else if (e.key === '/' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
                this.resetSpeed();
                handled = true;
            }

            if (handled) {
                e.preventDefault();
                e.stopPropagation();
            }
        }

        getCurrentVideo() {
            if (document.fullscreenElement) {
                const videoInFs = document.fullscreenElement.querySelector('video');
                if (videoInFs) return videoInFs;
            }
            const videos = DOMUtils.findVideoElements();
            if (videos.length === 0) return null;
            return videos.find(v => !v.paused) || videos[0];
        }

        changeSpeed(delta) {
            const target = Math.round((this.controller.currentSpeed + delta) * 100) / 100;
            const clamped = Math.min(SPEED_SETTINGS.MAX, Math.max(SPEED_SETTINGS.MIN, target));
            if (clamped !== this.controller.currentSpeed) {
                this.controller.setSpeed(clamped);
            }
            this.toast.show(null, clamped, this.getCurrentVideo());
        }

        increaseSpeed() { this.changeSpeed(this.speedStep); }
        decreaseSpeed() { this.changeSpeed(-this.speedStep); }

        resetSpeed() {
            const defaultSpeed = SPEED_SETTINGS.DEFAULT;
            if (this.controller.currentSpeed !== defaultSpeed) {
                this.controller.setSpeed(defaultSpeed);
            }
            this.toast.show(null, defaultSpeed, this.getCurrentVideo());
        }

        destroy() {
            document.removeEventListener('keydown', this.boundHandleKeydown, true);
        }
    }

    // ==================== 设置面板 ====================
    class SettingsPanel {
        constructor(controller) {
            this.controller = controller;
            this.panel = null;
            this.overlay = null;
            this.isVisible = false;
            this.isDragging = false;
            this.dragOffset = { x: 0, y: 0 };
            this.panelSize = { w: 0, h: 0 };
            this.boundHandleEscape = this.handleEscape.bind(this);
            this.boundPointerMove = this.drag.bind(this);
            this.boundPointerUp = this.endDrag.bind(this);
            this.injectStyles();
        }

        injectStyles() {
            injectStylesOnce('panel', `
                .speed-panel-overlay {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    z-index: 999998;
                    opacity: 0;
                    transition: opacity 0.15s ease;
                    pointer-events: none;
                }
                .speed-panel-overlay.visible { opacity: 1; pointer-events: auto; }
                .speed-panel {
                    position: fixed;
                    z-index: 999999;
                    background: #212121;
                    border-radius: 8px;
                    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
                    min-width: 260px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    color: #fff;
                    opacity: 0;
                    transform: scale(0.95);
                    transition: opacity 0.15s ease, transform 0.15s ease;
                    pointer-events: none;
                    user-select: none;
                }
                .speed-panel.visible { opacity: 1; transform: scale(1); pointer-events: auto; }
                .speed-panel-header {
                    display: flex; justify-content: space-between; align-items: center;
                    padding: 12px 16px; border-bottom: 1px solid #333; cursor: move;
                    touch-action: none;
                }
                .speed-panel-title { font-size: 13px; font-weight: 500; color: #fff; }
                .speed-panel-close {
                    width: 20px; height: 20px; border: none; background: transparent;
                    color: #888; border-radius: 4px; cursor: pointer;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 14px; transition: color 0.1s ease;
                }
                .speed-panel-close:hover { color: #fff; }
                .speed-panel-body { padding: 16px; }
                .speed-display { text-align: center; margin-bottom: 16px; }
                .speed-display-value { font-size: 32px; font-weight: 600; color: #fff; line-height: 1.2; }
                .speed-display-label { font-size: 11px; color: #888; margin-top: 4px; }
                .speed-slider-container { margin-bottom: 16px; }
                .speed-slider {
                    -webkit-appearance: none; appearance: none; width: 100%; height: 4px;
                    border-radius: 2px;
                    background: linear-gradient(90deg, #fff 0%, #fff var(--progress), #444 var(--progress), #444 100%);
                    outline: none; cursor: pointer;
                }
                .speed-slider::-webkit-slider-thumb {
                    -webkit-appearance: none; appearance: none; width: 14px; height: 14px;
                    border-radius: 50%; background: #fff; cursor: pointer;
                    transition: transform 0.1s ease;
                }
                .speed-slider::-webkit-slider-thumb:hover { transform: scale(1.2); }
                .speed-slider::-moz-range-thumb {
                    width: 14px; height: 14px; border-radius: 50%; background: #fff;
                    cursor: pointer; border: none;
                }
                .speed-slider-labels {
                    display: flex; justify-content: space-between; margin-top: 6px;
                    font-size: 10px; color: #666;
                }
                .speed-presets { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
                .speed-preset-btn {
                    padding: 8px 6px; border: none; background: #333; color: #aaa;
                    border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;
                    transition: all 0.1s ease;
                }
                .speed-preset-btn:hover { background: #444; color: #fff; }
                .speed-preset-btn.active { background: #fff; color: #212121; }
                .speed-panel-footer {
                    padding: 10px 16px; border-top: 1px solid #333;
                    display: flex; justify-content: center;
                }
                .speed-footer-hint { font-size: 10px; color: #666; }
            `);
        }

        createPanel() {
            if (this.panel) return;

            this.overlay = document.createElement('div');
            this.overlay.className = 'speed-panel-overlay';
            this.overlay.addEventListener('click', () => this.hide());

            this.panel = document.createElement('div');
            this.panel.className = 'speed-panel';
            this.panel.innerHTML = `
                <div class="speed-panel-header">
                    <div class="speed-panel-title">B站视频倍速器</div>
                    <button class="speed-panel-close" aria-label="关闭">✕</button>
                </div>
                <div class="speed-panel-body">
                    <div class="speed-display">
                        <div class="speed-display-value">${this.controller.currentSpeed.toFixed(2)}x</div>
                        <div class="speed-display-label">当前播放速度</div>
                    </div>
                    <div class="speed-slider-container">
                        <input type="range" class="speed-slider"
                               min="${SPEED_SETTINGS.MIN}"
                               max="${SPEED_SETTINGS.MAX}"
                               step="0.05"
                               value="${this.controller.currentSpeed}">
                        <div class="speed-slider-labels">
                            <span>${SPEED_SETTINGS.MIN}x</span>
                            <span>1.0x</span>
                            <span>2.0x</span>
                            <span>${SPEED_SETTINGS.MAX}x</span>
                        </div>
                    </div>
                    <div class="speed-presets">
                        ${SPEED_SETTINGS.PRESETS.map(s => `
                            <button class="speed-preset-btn ${s === this.controller.currentSpeed ? 'active' : ''}"
                                    data-speed="${s}">${s}x</button>
                        `).join('')}
                    </div>
                </div>
                <div class="speed-panel-footer">
                    <span class="speed-footer-hint">拖动标题栏可移动面板</span>
                </div>
            `;

            document.body.appendChild(this.overlay);
            document.body.appendChild(this.panel);

            this.setupEventListeners();
            this.restorePosition();
            this.updateSliderProgress();
        }

        setupEventListeners() {
            this.panel.querySelector('.speed-panel-close')
                .addEventListener('click', () => this.hide());

            const slider = this.panel.querySelector('.speed-slider');
            slider.addEventListener('input', (e) => {
                const speed = parseFloat(e.target.value);
                this.controller.setSpeed(speed);
                this.updateSpeedDisplay();
                this.updatePresetButtons();
                this.updateSliderProgress();
            });

            this.panel.querySelectorAll('.speed-preset-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const speed = parseFloat(btn.dataset.speed);
                    this.controller.setSpeed(speed);
                    this.updateSpeedDisplay();
                    this.updateSlider();
                    this.updatePresetButtons();
                });
            });

            const header = this.panel.querySelector('.speed-panel-header');
            header.addEventListener('pointerdown', (e) => this.startDrag(e));
        }

        startDrag(e) {
            if (e.target.classList.contains('speed-panel-close')) return;
            this.isDragging = true;
            const rect = this.panel.getBoundingClientRect();
            // 缓存尺寸，避免拖动过程中反复读引发布局重排
            this.panelSize.w = rect.width;
            this.panelSize.h = rect.height;
            this.dragOffset.x = e.clientX - rect.left;
            this.dragOffset.y = e.clientY - rect.top;
            this.panel.style.transition = 'none';
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
            e.currentTarget.addEventListener('pointermove', this.boundPointerMove);
            e.currentTarget.addEventListener('pointerup', this.boundPointerUp);
            e.currentTarget.addEventListener('pointercancel', this.boundPointerUp);
        }

        drag(e) {
            if (!this.isDragging) return;
            const x = Math.max(0, Math.min(window.innerWidth - this.panelSize.w, e.clientX - this.dragOffset.x));
            const y = Math.max(0, Math.min(window.innerHeight - this.panelSize.h, e.clientY - this.dragOffset.y));
            this.panel.style.left = `${x}px`;
            this.panel.style.top = `${y}px`;
            this.panel.style.right = 'auto';
            this.panel.style.bottom = 'auto';
        }

        endDrag(e) {
            if (!this.isDragging) return;
            this.isDragging = false;
            this.panel.style.transition = '';
            const target = e && e.currentTarget;
            if (target) {
                target.removeEventListener('pointermove', this.boundPointerMove);
                target.removeEventListener('pointerup', this.boundPointerUp);
                target.removeEventListener('pointercancel', this.boundPointerUp);
                try { target.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
            }
            this.savePosition();
        }

        savePosition() {
            const rect = this.panel.getBoundingClientRect();
            Storage.set(STORAGE_KEYS.panelPosition, { x: rect.left, y: rect.top });
        }

        restorePosition() {
            const saved = Storage.get(STORAGE_KEYS.panelPosition, null);
            if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
                const x = Math.max(0, Math.min(window.innerWidth - this.panel.offsetWidth, saved.x));
                const y = Math.max(0, Math.min(window.innerHeight - this.panel.offsetHeight, saved.y));
                this.panel.style.left = `${x}px`;
                this.panel.style.top = `${y}px`;
            } else {
                this.panel.style.left = '50%';
                this.panel.style.top = '50%';
                this.panel.style.transform = 'translate(-50%, -50%)';
            }
        }

        updateSpeedDisplay() {
            const display = this.panel.querySelector('.speed-display-value');
            if (display) display.textContent = `${this.controller.currentSpeed.toFixed(2)}x`;
        }

        updateSlider() {
            const slider = this.panel.querySelector('.speed-slider');
            if (slider) {
                slider.value = this.controller.currentSpeed;
                this.updateSliderProgress();
            }
        }

        updateSliderProgress() {
            const slider = this.panel.querySelector('.speed-slider');
            if (!slider) return;
            const progress = ((this.controller.currentSpeed - SPEED_SETTINGS.MIN) /
                (SPEED_SETTINGS.MAX - SPEED_SETTINGS.MIN)) * 100;
            slider.style.setProperty('--progress', `${progress}%`);
        }

        updatePresetButtons() {
            this.panel.querySelectorAll('.speed-preset-btn').forEach(btn => {
                const speed = parseFloat(btn.dataset.speed);
                btn.classList.toggle('active', Math.abs(speed - this.controller.currentSpeed) < 0.01);
            });
        }

        handleEscape(e) {
            if (e.key === 'Escape' && this.isVisible) this.hide();
        }

        show() {
            if (!this.panel) this.createPanel();
            this.updateSpeedDisplay();
            this.updateSlider();
            this.updatePresetButtons();

            // 从居中 transform 切到绝对坐标，保证拖动从正确位置开始
            if (this.panel.style.transform && this.panel.style.transform.includes('translate')) {
                const rect = this.panel.getBoundingClientRect();
                this.panel.style.left = `${rect.left}px`;
                this.panel.style.top = `${rect.top}px`;
                this.panel.style.transform = '';
            }

            requestAnimationFrame(() => {
                this.overlay.classList.add('visible');
                this.panel.classList.add('visible');
            });
            this.isVisible = true;
            document.addEventListener('keydown', this.boundHandleEscape);
        }

        hide() {
            if (this.overlay) this.overlay.classList.remove('visible');
            if (this.panel) this.panel.classList.remove('visible');
            this.isVisible = false;
            document.removeEventListener('keydown', this.boundHandleEscape);
        }

        toggle() { this.isVisible ? this.hide() : this.show(); }

        destroy() {
            this.hide();
            if (this.panel) { this.panel.remove(); this.panel = null; }
            if (this.overlay) { this.overlay.remove(); this.overlay = null; }
        }
    }

    // ==================== 菜单 ====================
    class MenuManager {
        constructor(controller, settingsPanel) {
            this.controller = controller;
            this.settingsPanel = settingsPanel;
            this.menuIds = [];
            this.canUnregister = typeof GM_unregisterMenuCommand === 'function';
            this.register();
            // 状态变化时重新注册菜单，让标题反映最新值
            this.controller.onStateChange = () => this.refresh();
        }

        register() {
            const c = this.controller;
            const add = (title, fn) => {
                const id = GM_registerMenuCommand(title, fn);
                if (id !== undefined) this.menuIds.push(id);
            };

            add(`📊 当前状态: ${c.enabled ? c.currentSpeed + 'x' : '已禁用'}`, () => {
                const s = c.getStatus();
                alert(
                    `B站视频倍速控制器\n\n` +
                    `状态: ${s.enabled ? '启用' : '禁用'}\n` +
                    `当前速度: ${s.currentSpeed}x\n` +
                    `检测到视频: ${s.videoCount} 个\n\n` +
                    `快捷键:\n` +
                    `Shift + >  增加倍速\n` +
                    `Shift + <  降低倍速\n` +
                    `/  重置倍速`
                );
            });

            add(`⚡ ${c.enabled ? '禁用' : '启用'}倍速功能`, () => c.setEnabled(!c.enabled));
            add('⚙️ 打开设置面板', () => this.settingsPanel.show());
        }

        refresh() {
            if (!this.canUnregister) return; // 旧版 Tampermonkey 不支持，忽略
            this.menuIds.forEach(id => {
                try { GM_unregisterMenuCommand(id); } catch (_) { /* ignore */ }
            });
            this.menuIds = [];
            this.register();
        }
    }

    // ==================== B 站配置 ====================
    const bilibiliConfig = {
        targetSelector: [
            '.bpx-player-video-area',
            '.player-container',
            '#player_module',
            '.video-container',
            '#bilibili-player'
        ],
        observeOptions: {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['src', 'class', 'style', 'data-loaded']
        },
        debounceDelay: 500,
        defaultSpeed: SPEED_SETTINGS.BILIBILI_DEFAULT,
        defaultEnabled: true
    };

    // ==================== 主流程 ====================
    function main() {
        const controller = new VideoSpeedController(bilibiliConfig);

        controller.initialize().then(() => {
            const toast = new Toast();
            const settingsPanel = new SettingsPanel(controller);
            const keyboardShortcuts = new KeyboardShortcuts(controller, toast);
            const menu = new MenuManager(controller, settingsPanel);

            // pagehide 在 BFCache / SPA 情境下比 beforeunload 更可靠
            window.addEventListener('pagehide', () => {
                keyboardShortcuts.destroy();
                settingsPanel.destroy();
                toast.destroy();
                controller.destroy();
            }, { once: true });

            log.info('启动完成');
            // 避免未使用警告
            void menu;
        }).catch(error => {
            log.error('启动失败', error);
        });
    }

    // @run-at document-idle 已保证 DOM 就绪
    main();
})();
