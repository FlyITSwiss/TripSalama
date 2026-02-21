/**
 * TripSalama - Ride Chat Module
 * Communication conductrice-passagère (style Uber)
 * Mobile-ready pour Android/iOS (Capacitor compatible)
 *
 * Design System φ = 1.618
 * Spacing Fibonacci: 4, 6, 10, 17, 27, 44, 71 px
 */

(function() {
    'use strict';

    window.RideChat = {
        rideId: null,
        userRole: null,
        userId: null,
        pollInterval: null,
        messages: [],
        isOpen: false,
        lastMessageId: 0,
        isBackground: false,
        notificationPermission: null,

        /**
         * Initialiser le chat pour une course
         * @param {number} rideId - ID de la course
         * @param {string} userRole - 'passenger' ou 'driver'
         * @param {number} userId - ID de l'utilisateur connecté
         */
        init: function(rideId, userRole, userId) {
            this.rideId = rideId;
            this.userRole = userRole;
            this.userId = userId;

            this.render();
            this.bindEvents();
            this.loadMessages();
            this.startPolling();

            // Mobile: Demander permission notifications
            this.requestNotificationPermission();

            // Mobile: Gérer le lifecycle app (foreground/background)
            this.setupMobileLifecycle();

            AppConfig && AppConfig.log && AppConfig.log('RideChat initialized for ride ' + rideId);
        },

        /**
         * Demander la permission pour les notifications (mobile)
         */
        requestNotificationPermission: function() {
            var self = this;

            if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission().then(function(permission) {
                    self.notificationPermission = permission;
                    AppConfig && AppConfig.log && AppConfig.log('Notification permission:', permission);
                });
            } else if ('Notification' in window) {
                this.notificationPermission = Notification.permission;
            }
        },

        /**
         * Gérer le lifecycle mobile (foreground/background)
         */
        setupMobileLifecycle: function() {
            var self = this;

            // Visibility API - détecter quand l'app passe en arrière-plan
            document.addEventListener('visibilitychange', function() {
                if (document.hidden) {
                    self.isBackground = true;
                    AppConfig && AppConfig.log && AppConfig.log('App went to background');
                } else {
                    self.isBackground = false;
                    // Recharger les messages en revenant au premier plan
                    self.loadMessages();
                    AppConfig && AppConfig.log && AppConfig.log('App returned to foreground');
                }
            });

            // Capacitor App plugin support (si disponible)
            if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.App) {
                Capacitor.Plugins.App.addListener('appStateChange', function(state) {
                    self.isBackground = !state.isActive;
                    if (state.isActive) {
                        self.loadMessages();
                    }
                });
            }
        },

        /**
         * Messages rapides selon le rôle
         */
        getQuickMessages: function() {
            var i18n = window.ChatI18n || {};

            if (this.userRole === 'passenger') {
                return [
                    { key: 'on_my_way', label: i18n.passenger_on_my_way || 'On my way' },
                    { key: 'arriving_soon', label: i18n.passenger_arriving_soon || 'Arriving soon' },
                    { key: 'at_location', label: i18n.passenger_at_location || 'At location' },
                    { key: 'waiting', label: i18n.passenger_waiting || 'Waiting for you' }
                ];
            } else {
                return [
                    { key: 'arriving', label: i18n.driver_arriving || 'Arriving' },
                    { key: 'arrived', label: i18n.driver_arrived || 'I arrived' },
                    { key: 'where_are_you', label: i18n.driver_where_are_you || 'Where are you?' },
                    { key: 'waiting', label: i18n.driver_waiting || 'Waiting for you' },
                    { key: 'traffic', label: i18n.driver_traffic || 'Traffic, arriving soon' }
                ];
            }
        },

        /**
         * Rendu du panneau de chat
         */
        render: function() {
            var self = this;
            var i18n = window.ChatI18n || {};

            // Créer le bouton flottant
            var chatButton = document.createElement('button');
            chatButton.id = 'chatToggleBtn';
            chatButton.className = 'chat-toggle-btn';
            chatButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span class="chat-unread-badge" id="chatUnreadBadge" style="display:none;">0</span>';
            document.body.appendChild(chatButton);

            // Créer le panneau de chat
            var chatPanel = document.createElement('div');
            chatPanel.id = 'chatPanel';
            chatPanel.className = 'chat-panel';
            chatPanel.innerHTML = this.getPanelHTML();
            document.body.appendChild(chatPanel);

            // Rendre les messages rapides
            this.renderQuickMessages();
        },

        /**
         * HTML du panneau
         */
        getPanelHTML: function() {
            var i18n = window.ChatI18n || {};

            return '<div class="chat-header">' +
                '<span class="chat-header-title">' + (i18n.title || 'Chat') + '</span>' +
                '<div class="chat-header-actions">' +
                    '<button class="chat-call-btn" id="chatCallBtn">' +
                        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                            '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.58 2.81.7A2 2 0 0 1 22 16.92z"/>' +
                        '</svg>' +
                    '</button>' +
                    '<button class="chat-close-btn" id="chatCloseBtn">' +
                        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                            '<line x1="18" y1="6" x2="6" y2="18"/>' +
                            '<line x1="6" y1="6" x2="18" y2="18"/>' +
                        '</svg>' +
                    '</button>' +
                '</div>' +
            '</div>' +
            '<div id="chatMessages" class="chat-messages">' +
                '<div class="chat-empty" id="chatEmpty">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
                        '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' +
                    '</svg>' +
                    '<p>' + (i18n.no_messages || 'No messages') + '</p>' +
                '</div>' +
            '</div>' +
            '<div class="chat-quick-messages" id="chatQuickMessages"></div>' +
            '<div class="chat-input-area">' +
                '<input type="text" id="chatInput" class="chat-input" placeholder="' + (i18n.placeholder || 'Type your message...') + '" maxlength="500">' +
                '<button id="chatSendBtn" class="chat-send-btn">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                        '<line x1="22" y1="2" x2="11" y2="13"/>' +
                        '<polygon points="22 2 15 22 11 13 2 9 22 2"/>' +
                    '</svg>' +
                '</button>' +
            '</div>';
        },

        /**
         * Rendre les boutons de messages rapides
         */
        renderQuickMessages: function() {
            var container = document.getElementById('chatQuickMessages');
            if (!container) return;

            var self = this;
            var quickMessages = this.getQuickMessages();

            container.innerHTML = quickMessages.map(function(msg) {
                return '<button class="quick-message-btn" data-message="' + self.escapeHtml(msg.label) + '">' +
                    msg.label +
                '</button>';
            }).join('');
        },

        /**
         * Bind des événements
         */
        bindEvents: function() {
            var self = this;

            // Toggle panel
            var toggleBtn = document.getElementById('chatToggleBtn');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', function() {
                    self.toggle();
                });
            }

            // Close panel
            var closeBtn = document.getElementById('chatCloseBtn');
            if (closeBtn) {
                closeBtn.addEventListener('click', function() {
                    self.close();
                });
            }

            // Send message
            var sendBtn = document.getElementById('chatSendBtn');
            var input = document.getElementById('chatInput');

            if (sendBtn) {
                sendBtn.addEventListener('click', function() {
                    self.sendFromInput();
                });
            }

            if (input) {
                input.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        self.sendFromInput();
                    }
                });
            }

            // Quick messages
            var quickContainer = document.getElementById('chatQuickMessages');
            if (quickContainer) {
                quickContainer.addEventListener('click', function(e) {
                    var btn = e.target.closest('.quick-message-btn');
                    if (btn) {
                        var message = btn.dataset.message;
                        if (message) {
                            self.sendMessage(message, 'quick');
                        }
                    }
                });
            }

            // Call button
            var callBtn = document.getElementById('chatCallBtn');
            if (callBtn) {
                callBtn.addEventListener('click', function() {
                    self.initiateCall();
                });
            }
        },

        /**
         * Toggle le panneau
         */
        toggle: function() {
            if (this.isOpen) {
                this.close();
            } else {
                this.open();
            }
        },

        /**
         * Ouvrir le panneau
         */
        open: function() {
            var panel = document.getElementById('chatPanel');
            if (panel) {
                panel.classList.add('active');
                this.isOpen = true;
                this.loadMessages();
                this.scrollToBottom();

                // Focus input
                var input = document.getElementById('chatInput');
                if (input) {
                    setTimeout(function() { input.focus(); }, 300);
                }
            }
        },

        /**
         * Fermer le panneau
         */
        close: function() {
            var panel = document.getElementById('chatPanel');
            if (panel) {
                panel.classList.remove('active');
                this.isOpen = false;
            }
        },

        /**
         * Charger les messages
         */
        loadMessages: function() {
            var self = this;

            ApiService.get('chat', {
                action: 'list',
                ride_id: this.rideId
            }).then(function(response) {
                if (response.success) {
                    self.messages = response.data.messages || [];
                    self.renderMessages();
                    self.updateUnreadBadge(0);
                }
            }).catch(function(error) {
                console.error('Chat load error:', error);
            });
        },

        /**
         * Envoyer depuis l'input
         */
        sendFromInput: function() {
            var input = document.getElementById('chatInput');
            if (input && input.value.trim()) {
                this.sendMessage(input.value.trim(), 'text');
                input.value = '';
            }
        },

        /**
         * Envoyer un message
         */
        sendMessage: function(content, type) {
            var self = this;
            type = type || 'text';

            ApiService.post('chat', {
                action: 'send',
                ride_id: this.rideId,
                content: content,
                message_type: type
            }).then(function(response) {
                if (response.success) {
                    self.loadMessages();
                }
            }).catch(function(error) {
                console.error('Chat send error:', error);
                Toast && Toast.error && Toast.error(error.message);
            });
        },

        /**
         * Rendu des messages
         */
        renderMessages: function() {
            var container = document.getElementById('chatMessages');
            var emptyState = document.getElementById('chatEmpty');

            if (!container) return;

            if (this.messages.length === 0) {
                if (emptyState) emptyState.style.display = 'flex';
                return;
            }

            if (emptyState) emptyState.style.display = 'none';

            var self = this;
            var html = this.messages.map(function(msg) {
                return self.renderMessage(msg);
            }).join('');

            // Conserver l'état vide masqué
            container.innerHTML = '<div class="chat-empty" id="chatEmpty" style="display:none;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><p>' + (window.ChatI18n?.no_messages || 'No messages') + '</p></div>' + html;

            this.scrollToBottom();
        },

        /**
         * Rendu d'un message
         */
        renderMessage: function(msg) {
            var isMine = parseInt(msg.sender_id) === this.userId;
            var className = isMine ? 'chat-message chat-message-mine' : 'chat-message chat-message-other';

            if (msg.message_type === 'quick') {
                className += ' chat-message-quick';
            }

            return '<div class="' + className + '">' +
                '<div class="chat-bubble">' + this.escapeHtml(msg.content) + '</div>' +
                '<div class="chat-time">' + this.formatTime(msg.created_at) + '</div>' +
            '</div>';
        },

        /**
         * Scroll en bas
         */
        scrollToBottom: function() {
            var container = document.getElementById('chatMessages');
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        },

        /**
         * Polling pour nouveaux messages
         */
        startPolling: function() {
            var self = this;

            // Clear existing interval
            if (this.pollInterval) {
                clearInterval(this.pollInterval);
            }

            // Poll toutes les 3 secondes
            this.pollInterval = setInterval(function() {
                self.checkNewMessages();
            }, 3000);
        },

        /**
         * Vérifier nouveaux messages
         */
        checkNewMessages: function() {
            var self = this;

            ApiService.get('chat', {
                action: 'unread-count',
                ride_id: this.rideId
            }).then(function(response) {
                if (response.success && response.data.unread_count > 0) {
                    var previousCount = parseInt(document.getElementById('chatUnreadBadge')?.textContent) || 0;
                    var newCount = response.data.unread_count;

                    self.updateUnreadBadge(newCount);

                    // Nouveau message reçu
                    if (newCount > previousCount) {
                        self.onNewMessageReceived(newCount - previousCount);
                    }

                    // Si panel ouvert, recharger
                    if (self.isOpen) {
                        self.loadMessages();
                    }
                }
            }).catch(function() {
                // Silently fail
            });
        },

        /**
         * Callback quand un nouveau message est reçu
         * @param {number} count - Nombre de nouveaux messages
         */
        onNewMessageReceived: function(count) {
            var self = this;
            var i18n = window.ChatI18n || {};

            // Vibration (mobile)
            this.vibrate([100, 50, 100]);

            // Haptic feedback (Capacitor)
            this.hapticFeedback('medium');

            // Notification si app en arrière-plan ou panel fermé
            if (this.isBackground || !this.isOpen) {
                this.showNotification(
                    i18n.new_message || 'New message',
                    count + ' ' + (i18n.new_messages_body || 'new message(s)')
                );
            }

            // Émettre événement pour d'autres modules
            if (typeof EventBus !== 'undefined') {
                EventBus.emit('chat:new-message', { rideId: this.rideId, count: count });
            }
        },

        /**
         * Vibration (mobile native)
         * @param {number|number[]} pattern - Pattern de vibration en ms
         */
        vibrate: function(pattern) {
            // Vibration API standard
            if ('vibrate' in navigator) {
                navigator.vibrate(pattern);
                return;
            }

            // Capacitor Haptics fallback
            this.hapticFeedback('medium');
        },

        /**
         * Haptic feedback (Capacitor)
         * @param {string} style - 'light', 'medium', 'heavy'
         */
        hapticFeedback: function(style) {
            if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.Haptics) {
                var impact = {
                    light: 'LIGHT',
                    medium: 'MEDIUM',
                    heavy: 'HEAVY'
                };
                Capacitor.Plugins.Haptics.impact({ style: impact[style] || 'MEDIUM' });
            }
        },

        /**
         * Afficher une notification (mobile)
         * @param {string} title - Titre
         * @param {string} body - Corps du message
         */
        showNotification: function(title, body) {
            var self = this;

            // Capacitor Push Notifications
            if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications) {
                Capacitor.Plugins.LocalNotifications.schedule({
                    notifications: [{
                        title: title,
                        body: body,
                        id: Date.now(),
                        schedule: { at: new Date() },
                        sound: 'default',
                        extra: { rideId: this.rideId }
                    }]
                });
                return;
            }

            // Web Notification API fallback
            if ('Notification' in window && Notification.permission === 'granted') {
                var notification = new Notification(title, {
                    body: body,
                    icon: '/assets/images/icons/icon-192x192.png',
                    badge: '/assets/images/icons/badge-72x72.png',
                    tag: 'tripsalama-chat-' + this.rideId,
                    vibrate: [100, 50, 100],
                    requireInteraction: false
                });

                notification.onclick = function() {
                    window.focus();
                    self.open();
                    notification.close();
                };

                // Auto-close après 5 secondes
                setTimeout(function() { notification.close(); }, 5000);
            }
        },

        /**
         * Mettre à jour le badge
         */
        updateUnreadBadge: function(count) {
            var badge = document.getElementById('chatUnreadBadge');
            if (badge) {
                if (count > 0) {
                    badge.textContent = count > 9 ? '9+' : count;
                    badge.style.display = 'flex';
                } else {
                    badge.style.display = 'none';
                }
            }
        },

        /**
         * Initier un appel
         */
        initiateCall: function() {
            var self = this;
            var i18n = window.ChatI18n || {};

            // Haptic feedback sur le bouton
            this.hapticFeedback('light');

            ApiService.get('chat', {
                action: 'call-info',
                ride_id: this.rideId
            }).then(function(response) {
                if (response.success && response.data.phone) {
                    self.makePhoneCall(response.data.phone, response.data.name);
                } else {
                    Toast && Toast.error && Toast.error(i18n.call_not_available || 'Call not available');
                }
            }).catch(function(error) {
                Toast && Toast.error && Toast.error(error.message);
            });
        },

        /**
         * Effectuer l'appel téléphonique
         * @param {string} phoneNumber - Numéro de téléphone
         * @param {string} contactName - Nom du contact (optionnel)
         */
        makePhoneCall: function(phoneNumber, contactName) {
            var self = this;
            var i18n = window.ChatI18n || {};

            // Capacitor CallNumber plugin (pour apps natives)
            if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.CallNumber) {
                Capacitor.Plugins.CallNumber.call({
                    number: phoneNumber,
                    displayPrompt: true
                }).then(function() {
                    AppConfig && AppConfig.log && AppConfig.log('Call initiated to:', phoneNumber);
                }).catch(function(error) {
                    // Fallback sur tel: protocol
                    self.openTelProtocol(phoneNumber);
                });
                return;
            }

            // Web: utiliser le protocole tel:
            this.openTelProtocol(phoneNumber);
        },

        /**
         * Ouvrir le protocole tel: (web standard)
         * @param {string} phoneNumber - Numéro de téléphone
         */
        openTelProtocol: function(phoneNumber) {
            // Vérifier si on est sur mobile
            var isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

            if (isMobile) {
                // Sur mobile, ouvrir directement l'app téléphone
                window.location.href = 'tel:' + phoneNumber;
            } else {
                // Sur desktop, essayer d'ouvrir (certains OS supportent)
                var link = document.createElement('a');
                link.href = 'tel:' + phoneNumber;
                link.click();

                // Afficher aussi le numéro pour copie manuelle
                var i18n = window.ChatI18n || {};
                Toast && Toast.info && Toast.info(
                    (i18n.call_number || 'Phone number') + ': ' + phoneNumber
                );
            }
        },

        /**
         * Arrêter le polling
         */
        stopPolling: function() {
            if (this.pollInterval) {
                clearInterval(this.pollInterval);
                this.pollInterval = null;
            }
        },

        /**
         * Détruire le module
         */
        destroy: function() {
            this.stopPolling();

            var panel = document.getElementById('chatPanel');
            var btn = document.getElementById('chatToggleBtn');

            if (panel) panel.remove();
            if (btn) btn.remove();
        },

        /**
         * Helpers
         */
        escapeHtml: function(text) {
            var div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        formatTime: function(timestamp) {
            var date = new Date(timestamp);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
    };

    // Auto-init si AppConfig présent
    if (typeof AppConfig !== 'undefined') {
        AppConfig.log && AppConfig.log('RideChat module loaded');
    }
})();
