/**
 * TripSalama - UBER INTERACTIONS
 * Premium micro-interactions and UI components
 *
 * Features:
 * - Bottom Sheet with drag
 * - Pull to Refresh
 * - Swipe Actions
 * - Haptic Feedback
 * - Button Ripple Effects
 * - Smooth Animations
 */

(function() {
    'use strict';

    // ============================================
    // UBER BOTTOM SHEET
    // ============================================
    class UberBottomSheet {
        constructor(element, options = {}) {
            this.element = element;
            this.options = {
                snapPoints: [0.3, 0.5, 0.9], // Percentage of viewport
                defaultSnap: 0.5,
                closeThreshold: 0.15,
                dragHandle: '.uber-bottom-sheet-handle',
                onOpen: null,
                onClose: null,
                onSnap: null,
                ...options
            };

            this.isOpen = false;
            this.currentSnap = this.options.defaultSnap;
            this.startY = 0;
            this.currentY = 0;
            this.isDragging = false;

            this.init();
        }

        init() {
            // Create overlay
            this.overlay = document.createElement('div');
            this.overlay.className = 'uber-bottom-sheet-overlay';
            this.overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.4);
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.3s, visibility 0.3s;
                z-index: 299;
            `;
            document.body.appendChild(this.overlay);

            // Find or create drag handle
            this.handle = this.element.querySelector(this.options.dragHandle);
            if (!this.handle) {
                this.handle = document.createElement('div');
                this.handle.className = 'uber-bottom-sheet-handle';
                this.element.insertBefore(this.handle, this.element.firstChild);
            }

            // Initial styles
            this.element.style.cssText = `
                position: fixed;
                bottom: 0;
                left: 50%;
                transform: translateX(-50%) translateY(100%);
                width: 100%;
                max-width: 420px;
                background: #fff;
                border-radius: 24px 24px 0 0;
                box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.08);
                z-index: 400;
                transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                touch-action: none;
            `;

            this.bindEvents();
        }

        bindEvents() {
            // Drag events
            this.handle.addEventListener('touchstart', this.onDragStart.bind(this), { passive: true });
            this.handle.addEventListener('mousedown', this.onDragStart.bind(this));

            document.addEventListener('touchmove', this.onDragMove.bind(this), { passive: false });
            document.addEventListener('mousemove', this.onDragMove.bind(this));

            document.addEventListener('touchend', this.onDragEnd.bind(this));
            document.addEventListener('mouseup', this.onDragEnd.bind(this));

            // Overlay click to close
            this.overlay.addEventListener('click', () => this.close());
        }

        onDragStart(e) {
            this.isDragging = true;
            this.startY = e.touches ? e.touches[0].clientY : e.clientY;
            this.element.style.transition = 'none';

            // Haptic feedback
            this.haptic(10);
        }

        onDragMove(e) {
            if (!this.isDragging) return;

            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const deltaY = clientY - this.startY;
            const viewportHeight = window.innerHeight;
            const currentHeight = viewportHeight * this.currentSnap;
            const newHeight = currentHeight - deltaY;
            const newSnap = newHeight / viewportHeight;

            // Clamp between 0 and max snap point
            const clampedSnap = Math.max(0, Math.min(newSnap, Math.max(...this.options.snapPoints)));
            const translateY = (1 - clampedSnap) * 100;

            this.element.style.transform = `translateX(-50%) translateY(${translateY}%)`;
            this.overlay.style.opacity = clampedSnap;

            if (e.cancelable) e.preventDefault();
        }

        onDragEnd() {
            if (!this.isDragging) return;
            this.isDragging = false;

            this.element.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';

            // Get current position
            const transform = this.element.style.transform;
            const match = transform.match(/translateY\(([\d.]+)%\)/);
            const currentTranslateY = match ? parseFloat(match[1]) : 100;
            const currentSnap = 1 - (currentTranslateY / 100);

            // Find closest snap point
            if (currentSnap < this.options.closeThreshold) {
                this.close();
            } else {
                const closestSnap = this.options.snapPoints.reduce((prev, curr) =>
                    Math.abs(curr - currentSnap) < Math.abs(prev - currentSnap) ? curr : prev
                );
                this.snapTo(closestSnap);
            }

            // Haptic feedback
            this.haptic(10);
        }

        snapTo(snapPoint) {
            this.currentSnap = snapPoint;
            const translateY = (1 - snapPoint) * 100;
            this.element.style.transform = `translateX(-50%) translateY(${translateY}%)`;
            this.overlay.style.opacity = snapPoint;

            if (this.options.onSnap) {
                this.options.onSnap(snapPoint);
            }
        }

        open(snapPoint = this.options.defaultSnap) {
            this.isOpen = true;
            this.overlay.style.visibility = 'visible';
            this.snapTo(snapPoint);

            if (this.options.onOpen) {
                this.options.onOpen();
            }

            // Haptic feedback
            this.haptic(20);
        }

        close() {
            this.isOpen = false;
            this.element.style.transform = 'translateX(-50%) translateY(100%)';
            this.overlay.style.opacity = '0';

            setTimeout(() => {
                this.overlay.style.visibility = 'hidden';
            }, 300);

            if (this.options.onClose) {
                this.options.onClose();
            }

            // Haptic feedback
            this.haptic(10);
        }

        toggle() {
            if (this.isOpen) {
                this.close();
            } else {
                this.open();
            }
        }

        haptic(duration = 10) {
            if ('vibrate' in navigator) {
                navigator.vibrate(duration);
            }
        }

        destroy() {
            this.overlay.remove();
        }
    }

    // ============================================
    // BUTTON RIPPLE EFFECT
    // ============================================
    class RippleEffect {
        constructor() {
            this.init();
        }

        init() {
            document.addEventListener('click', this.createRipple.bind(this));
        }

        createRipple(e) {
            const btn = e.target.closest('.btn, .uber-btn, .uber-action-item, .nav-item');
            if (!btn) return;

            const rect = btn.getBoundingClientRect();
            const ripple = document.createElement('span');
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;

            ripple.style.cssText = `
                position: absolute;
                width: ${size}px;
                height: ${size}px;
                left: ${x}px;
                top: ${y}px;
                background: rgba(255, 255, 255, 0.3);
                border-radius: 50%;
                transform: scale(0);
                animation: ripple 0.6s ease-out;
                pointer-events: none;
            `;

            // Ensure btn has relative positioning
            const currentPosition = window.getComputedStyle(btn).position;
            if (currentPosition === 'static') {
                btn.style.position = 'relative';
            }
            btn.style.overflow = 'hidden';

            btn.appendChild(ripple);

            setTimeout(() => ripple.remove(), 600);
        }
    }

    // Add ripple keyframes
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ripple {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);

    // ============================================
    // PULL TO REFRESH
    // ============================================
    class PullToRefresh {
        constructor(element, options = {}) {
            this.element = element;
            this.options = {
                threshold: 80,
                maxPull: 120,
                onRefresh: null,
                ...options
            };

            this.startY = 0;
            this.currentY = 0;
            this.isPulling = false;
            this.isRefreshing = false;

            this.init();
        }

        init() {
            // Create indicator
            this.indicator = document.createElement('div');
            this.indicator.className = 'ptr-indicator';
            this.indicator.innerHTML = `
                <svg class="ptr-spinner" viewBox="0 0 24 24" width="24" height="24">
                    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="60" stroke-dashoffset="60"/>
                </svg>
            `;
            this.indicator.style.cssText = `
                position: absolute;
                top: 0;
                left: 50%;
                transform: translateX(-50%) translateY(-100%);
                padding: 16px;
                color: #757575;
                transition: transform 0.3s;
                z-index: 10;
            `;

            this.element.style.position = 'relative';
            this.element.insertBefore(this.indicator, this.element.firstChild);

            this.bindEvents();
        }

        bindEvents() {
            this.element.addEventListener('touchstart', this.onStart.bind(this), { passive: true });
            this.element.addEventListener('touchmove', this.onMove.bind(this), { passive: false });
            this.element.addEventListener('touchend', this.onEnd.bind(this));
        }

        onStart(e) {
            if (this.isRefreshing) return;
            if (this.element.scrollTop > 0) return;

            this.startY = e.touches[0].clientY;
            this.isPulling = true;
        }

        onMove(e) {
            if (!this.isPulling || this.isRefreshing) return;

            const currentY = e.touches[0].clientY;
            const deltaY = currentY - this.startY;

            if (deltaY > 0 && this.element.scrollTop === 0) {
                e.preventDefault();
                const pull = Math.min(deltaY * 0.5, this.options.maxPull);
                this.indicator.style.transform = `translateX(-50%) translateY(${pull - 40}px)`;

                // Rotate spinner based on pull
                const rotation = (pull / this.options.maxPull) * 360;
                const spinner = this.indicator.querySelector('.ptr-spinner');
                spinner.style.transform = `rotate(${rotation}deg)`;
            }
        }

        onEnd() {
            if (!this.isPulling || this.isRefreshing) return;
            this.isPulling = false;

            const transform = this.indicator.style.transform;
            const match = transform.match(/translateY\(([\d.-]+)px\)/);
            const currentPull = match ? parseFloat(match[1]) + 40 : 0;

            if (currentPull >= this.options.threshold) {
                this.refresh();
            } else {
                this.reset();
            }
        }

        refresh() {
            this.isRefreshing = true;
            this.indicator.style.transform = 'translateX(-50%) translateY(16px)';

            // Animate spinner
            const spinner = this.indicator.querySelector('.ptr-spinner');
            spinner.style.animation = 'spin 1s linear infinite';

            // Haptic feedback
            if ('vibrate' in navigator) {
                navigator.vibrate(20);
            }

            if (this.options.onRefresh) {
                this.options.onRefresh(() => {
                    this.isRefreshing = false;
                    spinner.style.animation = '';
                    this.reset();
                });
            } else {
                setTimeout(() => {
                    this.isRefreshing = false;
                    spinner.style.animation = '';
                    this.reset();
                }, 1500);
            }
        }

        reset() {
            this.indicator.style.transform = 'translateX(-50%) translateY(-100%)';
        }
    }

    // ============================================
    // SWIPE ACTIONS
    // ============================================
    class SwipeActions {
        constructor(element, options = {}) {
            this.element = element;
            this.options = {
                threshold: 80,
                maxSwipe: 120,
                leftAction: null,
                rightAction: null,
                leftColor: '#EF4444',
                rightColor: '#10B981',
                leftIcon: '&times;',
                rightIcon: '&check;',
                ...options
            };

            this.startX = 0;
            this.currentX = 0;
            this.isSwiping = false;

            this.init();
        }

        init() {
            // Wrap content
            this.wrapper = document.createElement('div');
            this.wrapper.className = 'swipe-wrapper';
            this.wrapper.style.cssText = `
                position: relative;
                overflow: hidden;
            `;

            this.content = document.createElement('div');
            this.content.className = 'swipe-content';
            this.content.style.cssText = `
                position: relative;
                background: #fff;
                transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                z-index: 1;
            `;

            // Move children to content
            while (this.element.firstChild) {
                this.content.appendChild(this.element.firstChild);
            }

            // Create action backgrounds
            this.leftBg = this.createActionBg('left');
            this.rightBg = this.createActionBg('right');

            this.wrapper.appendChild(this.leftBg);
            this.wrapper.appendChild(this.rightBg);
            this.wrapper.appendChild(this.content);
            this.element.appendChild(this.wrapper);

            this.bindEvents();
        }

        createActionBg(side) {
            const bg = document.createElement('div');
            const isLeft = side === 'left';
            bg.className = `swipe-action-bg swipe-action-${side}`;
            bg.innerHTML = `<span>${isLeft ? this.options.leftIcon : this.options.rightIcon}</span>`;
            bg.style.cssText = `
                position: absolute;
                top: 0;
                ${side}: 0;
                bottom: 0;
                width: ${this.options.maxSwipe}px;
                background: ${isLeft ? this.options.leftColor : this.options.rightColor};
                display: flex;
                align-items: center;
                justify-content: ${isLeft ? 'flex-end' : 'flex-start'};
                padding: 0 24px;
                color: white;
                font-size: 24px;
                opacity: 0;
                transition: opacity 0.3s;
            `;
            return bg;
        }

        bindEvents() {
            this.content.addEventListener('touchstart', this.onStart.bind(this), { passive: true });
            this.content.addEventListener('touchmove', this.onMove.bind(this), { passive: false });
            this.content.addEventListener('touchend', this.onEnd.bind(this));
        }

        onStart(e) {
            this.startX = e.touches[0].clientX;
            this.isSwiping = true;
            this.content.style.transition = 'none';
        }

        onMove(e) {
            if (!this.isSwiping) return;

            const currentX = e.touches[0].clientX;
            const deltaX = currentX - this.startX;

            // Clamp delta
            const clampedDelta = Math.max(-this.options.maxSwipe, Math.min(this.options.maxSwipe, deltaX));
            this.content.style.transform = `translateX(${clampedDelta}px)`;

            // Show action backgrounds
            if (deltaX < 0) {
                this.leftBg.style.opacity = Math.abs(deltaX) / this.options.maxSwipe;
                this.rightBg.style.opacity = 0;
            } else {
                this.rightBg.style.opacity = deltaX / this.options.maxSwipe;
                this.leftBg.style.opacity = 0;
            }
        }

        onEnd() {
            if (!this.isSwiping) return;
            this.isSwiping = false;

            this.content.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';

            const transform = this.content.style.transform;
            const match = transform.match(/translateX\(([-\d.]+)px\)/);
            const currentDelta = match ? parseFloat(match[1]) : 0;

            if (currentDelta < -this.options.threshold && this.options.leftAction) {
                // Haptic
                if ('vibrate' in navigator) navigator.vibrate(20);
                this.options.leftAction(this.element);
            } else if (currentDelta > this.options.threshold && this.options.rightAction) {
                // Haptic
                if ('vibrate' in navigator) navigator.vibrate(20);
                this.options.rightAction(this.element);
            }

            // Reset
            this.content.style.transform = 'translateX(0)';
            this.leftBg.style.opacity = 0;
            this.rightBg.style.opacity = 0;
        }
    }

    // ============================================
    // SMOOTH COUNTER ANIMATION
    // ============================================
    class CounterAnimation {
        static animate(element, end, duration = 1000) {
            const start = parseInt(element.textContent) || 0;
            const range = end - start;
            const startTime = performance.now();

            const update = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // Ease out cubic
                const easeProgress = 1 - Math.pow(1 - progress, 3);
                const current = Math.round(start + range * easeProgress);

                element.textContent = current;

                if (progress < 1) {
                    requestAnimationFrame(update);
                }
            };

            requestAnimationFrame(update);
        }
    }

    // ============================================
    // INTERSECTION OBSERVER FOR ANIMATIONS
    // ============================================
    class ScrollAnimations {
        constructor() {
            this.observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            entry.target.classList.add('is-visible');
                            this.observer.unobserve(entry.target);
                        }
                    });
                },
                { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
            );

            this.init();
        }

        init() {
            document.querySelectorAll('.animate-on-scroll').forEach(el => {
                this.observer.observe(el);
            });
        }
    }

    // ============================================
    // AUTO-INIT ON DOM READY
    // ============================================
    document.addEventListener('DOMContentLoaded', () => {
        // Initialize ripple effect globally
        new RippleEffect();

        // Initialize scroll animations
        new ScrollAnimations();

        // Add smooth press effect to interactive elements
        document.querySelectorAll('.btn, .uber-btn, .uber-action-item, .uber-card-interactive').forEach(el => {
            el.addEventListener('touchstart', () => {
                el.style.transform = 'scale(0.98)';
            }, { passive: true });

            el.addEventListener('touchend', () => {
                el.style.transform = '';
            });
        });

        console.log('[TripSalama] Uber interactions initialized');
    });

    // ============================================
    // EXPORT TO GLOBAL
    // ============================================
    window.UberBottomSheet = UberBottomSheet;
    window.PullToRefresh = PullToRefresh;
    window.SwipeActions = SwipeActions;
    window.CounterAnimation = CounterAnimation;

})();
