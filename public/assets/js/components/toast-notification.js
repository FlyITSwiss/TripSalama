/**
 * TripSalama - Toast Notification Component
 * Notifications temporaires
 */

'use strict';

const Toast = (function() {
    let container = null;

    /**
     * Initialiser le conteneur de toasts
     */
    function init() {
        if (container) return;

        container = document.createElement('div');
        container.className = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'true');
        document.body.appendChild(container);

        // Styles inline pour le conteneur
        Object.assign(container.style, {
            position: 'fixed',
            top: 'calc(var(--size-header, 55px) + var(--space-13, 13px))',
            right: 'var(--space-21, 21px)',
            zIndex: 'var(--z-toast, 500)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-8, 8px)',
            maxWidth: '400px',
            pointerEvents: 'none'
        });
    }

    /**
     * Afficher un toast
     * @param {Object} options - Options du toast
     */
    function show(options = {}) {
        init();

        const {
            type = 'info',
            title = '',
            message = '',
            duration = 5000,
            closable = true
        } = typeof options === 'string' ? { message: options } : options;

        // Creer l'element toast
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.setAttribute('role', 'alert');

        // Styles du toast
        Object.assign(toast.style, {
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-13, 13px)',
            padding: 'var(--space-13, 13px) var(--space-21, 21px)',
            background: 'var(--color-bg-card, #fff)',
            borderRadius: 'var(--radius-md, 8px)',
            boxShadow: 'var(--shadow-lg)',
            borderLeft: `4px solid var(--color-${type}, #2196F3)`,
            animation: 'toastSlideIn 0.3s ease',
            pointerEvents: 'auto'
        });

        // Icone selon le type
        const icons = {
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
            info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        };

        const colors = {
            success: 'var(--color-success, #4CAF50)',
            error: 'var(--color-danger, #E53935)',
            warning: 'var(--color-warning, #FF9800)',
            info: 'var(--color-info, #2196F3)'
        };

        // Construire le contenu
        toast.innerHTML = `
            <div class="toast-icon" style="color: ${colors[type]}; flex-shrink: 0; width: 21px; height: 21px;">
                ${icons[type] || icons.info}
            </div>
            <div class="toast-content" style="flex: 1;">
                ${title ? `<div class="toast-title" style="font-weight: 600; margin-bottom: 4px;">${title}</div>` : ''}
                <div class="toast-message" style="color: var(--color-text-secondary, #666);">${message}</div>
            </div>
            ${closable ? `
                <button class="toast-close" style="background: none; border: none; cursor: pointer; opacity: 0.6; font-size: 18px; line-height: 1;">&times;</button>
            ` : ''}
        `;

        // Ajouter au conteneur
        container.appendChild(toast);

        // Gestion de la fermeture
        const closeBtn = toast.querySelector('.toast-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => remove(toast));
        }

        // Auto-fermeture
        if (duration > 0) {
            setTimeout(() => remove(toast), duration);
        }

        // Ajouter les keyframes si pas encore fait
        if (!document.getElementById('toast-styles')) {
            const style = document.createElement('style');
            style.id = 'toast-styles';
            style.textContent = `
                @keyframes toastSlideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes toastSlideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }

        return toast;
    }

    /**
     * Retirer un toast
     */
    function remove(toast) {
        toast.style.animation = 'toastSlideOut 0.3s ease';
        setTimeout(() => {
            if (toast.parentElement) {
                toast.parentElement.removeChild(toast);
            }
        }, 300);
    }

    /**
     * Raccourcis par type
     */
    function success(message, title = '') {
        return show({ type: 'success', title: title || __('msg.success'), message });
    }

    function error(message, title = '') {
        return show({ type: 'error', title: title || __('msg.error'), message });
    }

    function warning(message, title = '') {
        return show({ type: 'warning', title: title || __('msg.warning'), message });
    }

    function info(message, title = '') {
        return show({ type: 'info', title: title || __('msg.info'), message });
    }

    // Ecouter les evenements globaux
    EventBus.on(EventBus.Events.TOAST_SHOW, (data) => {
        show(data);
    });

    // API publique
    return {
        show,
        success,
        error,
        warning,
        info,
        remove
    };
})();

// Fonction globale
function showToast(type, title, message, duration) {
    return Toast.show({ type, title, message, duration });
}

// Rendre disponible globalement
window.Toast = Toast;
window.showToast = showToast;
