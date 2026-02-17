/**
 * TripSalama - Modal Component
 * Modales et dialogues
 */

'use strict';

const Modal = (function() {
    let activeModal = null;
    let backdrop = null;

    /**
     * Creer le backdrop
     */
    function createBackdrop() {
        if (backdrop) return backdrop;

        backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        Object.assign(backdrop.style, {
            position: 'fixed',
            inset: '0',
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 'var(--z-modal-backdrop, 300)',
            opacity: '0',
            transition: 'opacity 0.25s ease'
        });

        backdrop.addEventListener('click', close);
        document.body.appendChild(backdrop);

        return backdrop;
    }

    /**
     * Ouvrir une modale
     * @param {Object} options - Options de la modale
     */
    function open(options = {}) {
        const {
            title = '',
            content = '',
            size = 'md',
            closable = true,
            onClose = null,
            buttons = []
        } = options;

        // Fermer une modale existante
        if (activeModal) {
            close();
        }

        // Creer la modale
        const modal = document.createElement('div');
        modal.className = `modal modal-${size}`;
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        if (title) modal.setAttribute('aria-labelledby', 'modal-title');

        const sizes = {
            sm: '360px',
            md: '500px',
            lg: '700px',
            xl: '900px',
            full: '95vw'
        };

        Object.assign(modal.style, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) scale(0.95)',
            width: '90%',
            maxWidth: sizes[size] || sizes.md,
            maxHeight: '90vh',
            background: 'var(--color-bg-card, #fff)',
            borderRadius: 'var(--radius-xl, 21px)',
            boxShadow: 'var(--shadow-xl)',
            zIndex: 'var(--z-modal, 400)',
            opacity: '0',
            transition: 'all 0.25s ease',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        });

        // Construire le contenu
        modal.innerHTML = `
            ${title || closable ? `
                <div class="modal-header" style="display: flex; align-items: center; justify-content: space-between; padding: var(--space-21, 21px); border-bottom: 1px solid var(--color-border, #E0E0E0);">
                    ${title ? `<h3 id="modal-title" style="font-size: var(--text-lg, 1.272rem); font-weight: 600; margin: 0;">${title}</h3>` : '<span></span>'}
                    ${closable ? `
                        <button class="modal-close" style="background: none; border: none; cursor: pointer; font-size: 24px; color: var(--color-text-muted, #999); transition: color 0.15s ease;">&times;</button>
                    ` : ''}
                </div>
            ` : ''}
            <div class="modal-body" style="padding: var(--space-21, 21px); overflow-y: auto; flex: 1;">
                ${content}
            </div>
            ${buttons.length > 0 ? `
                <div class="modal-footer" style="display: flex; gap: var(--space-13, 13px); justify-content: flex-end; padding: var(--space-21, 21px); border-top: 1px solid var(--color-border, #E0E0E0); background: var(--color-bg-secondary, #F0F0F0);">
                    ${buttons.map((btn, index) => `
                        <button class="btn ${btn.class || 'btn-outline'}" data-modal-btn="${index}">${btn.text}</button>
                    `).join('')}
                </div>
            ` : ''}
        `;

        // Ajouter au DOM
        createBackdrop();
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';

        // Event listeners
        if (closable) {
            const closeBtn = modal.querySelector('.modal-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', close);
            }
        }

        // Boutons d'action
        buttons.forEach((btn, index) => {
            const btnEl = modal.querySelector(`[data-modal-btn="${index}"]`);
            if (btnEl && btn.onClick) {
                btnEl.addEventListener('click', () => {
                    btn.onClick(modal);
                });
            }
        });

        // Fermer avec Escape
        const handleEscape = (e) => {
            if (e.key === 'Escape' && closable) {
                close();
            }
        };
        document.addEventListener('keydown', handleEscape);

        // Stocker les references
        activeModal = modal;
        activeModal._onClose = onClose;
        activeModal._handleEscape = handleEscape;

        // Animer l'ouverture
        requestAnimationFrame(() => {
            backdrop.style.opacity = '1';
            modal.style.opacity = '1';
            modal.style.transform = 'translate(-50%, -50%) scale(1)';
        });

        EventBus.emit(EventBus.Events.MODAL_OPEN, { modal });

        return modal;
    }

    /**
     * Fermer la modale active
     */
    function close() {
        if (!activeModal) return;

        const modal = activeModal;
        const onClose = modal._onClose;
        const handleEscape = modal._handleEscape;

        // Animer la fermeture
        backdrop.style.opacity = '0';
        modal.style.opacity = '0';
        modal.style.transform = 'translate(-50%, -50%) scale(0.95)';

        setTimeout(() => {
            if (modal.parentElement) {
                modal.parentElement.removeChild(modal);
            }
            if (backdrop && backdrop.parentElement) {
                backdrop.parentElement.removeChild(backdrop);
                backdrop = null;
            }
            document.body.style.overflow = '';
        }, 250);

        // Nettoyer
        document.removeEventListener('keydown', handleEscape);
        activeModal = null;

        // Callback
        if (typeof onClose === 'function') {
            onClose();
        }

        EventBus.emit(EventBus.Events.MODAL_CLOSE);
    }

    /**
     * Dialogue de confirmation
     * @param {string} message - Message de confirmation
     * @param {Object} options - Options
     * @returns {Promise<boolean>}
     */
    function confirm(message, options = {}) {
        return new Promise((resolve) => {
            open({
                title: options.title || __('common.confirm') || 'Confirmation',
                content: `<p style="margin: 0;">${message}</p>`,
                size: 'sm',
                buttons: [
                    {
                        text: options.cancelText || __('form.cancel') || 'Annuler',
                        class: 'btn-outline',
                        onClick: () => {
                            close();
                            resolve(false);
                        }
                    },
                    {
                        text: options.confirmText || __('form.confirm') || 'Confirmer',
                        class: options.danger ? 'btn-danger' : 'btn-primary',
                        onClick: () => {
                            close();
                            resolve(true);
                        }
                    }
                ],
                onClose: () => resolve(false)
            });
        });
    }

    /**
     * Dialogue d'alerte
     * @param {string} message - Message
     * @param {Object} options - Options
     * @returns {Promise}
     */
    function alert(message, options = {}) {
        return new Promise((resolve) => {
            open({
                title: options.title || __('msg.info') || 'Information',
                content: `<p style="margin: 0;">${message}</p>`,
                size: 'sm',
                buttons: [
                    {
                        text: 'OK',
                        class: 'btn-primary',
                        onClick: () => {
                            close();
                            resolve();
                        }
                    }
                ],
                onClose: () => resolve()
            });
        });
    }

    // API publique
    return {
        open,
        close,
        confirm,
        alert
    };
})();

// Rendre disponible globalement
window.Modal = Modal;
