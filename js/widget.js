// Refatoração básica com separação de responsabilidades em classes auxiliares.

// 1) Renderização e sanitização de conteúdo
class ChatRenderer {
    escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    markdownToHtml(text) {
        let s = this.escapeHtml(text);
        s = s.replace(/```([\s\S]*?)```/g, (_, code) => '<pre><code>' + code.replace(/\n/g, '\n') + '</code></pre>');
        s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
        s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        s = s.replace(/\n\n+/g, '</p><p>');
        s = '<p>' + s.replace(/\n/g, '<br>') + '</p>';
        s = s.replace(/\[([^\]]+)\]\((https?:[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="nofollow noopener noreferrer">$1</a>');
        s = s.replace(/(^|\s)(https?:[^\s<]+)(?=$|\s)/g, '$1<a href="$2" target="_blank" rel="nofollow noopener noreferrer">$2</a>');
        return s;
    }

    sanitizeHtml(html) {
        const allowedTags = new Set(['A','B','BR','CODE','EM','I','P','STRONG','U','UL','OL','LI','PRE','BLOCKQUOTE']);
        const allowedAttrs = { 'A': ['href','target','rel'] };
        const template = document.createElement('template');
        template.innerHTML = html;
        const sanitizeNode = (node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const tag = node.tagName;
                if (!allowedTags.has(tag)) {
                    const text = document.createTextNode(node.textContent || '');
                    node.replaceWith(text);
                    return;
                }
                [...node.attributes].forEach(attr => {
                    const attrName = attr.name.toLowerCase();
                    const tagAllowed = allowedAttrs[tag] || [];
                    if (!tagAllowed.map(a => a.toLowerCase()).includes(attrName)) {
                        node.removeAttribute(attr.name);
                    }
                });
                if (tag === 'A') {
                    const href = node.getAttribute('href') || '';
                    if (!/^https?:\/\//i.test(href) && !/^mailto:/i.test(href)) {
                        node.removeAttribute('href');
                    }
                    node.setAttribute('target', '_blank');
                    node.setAttribute('rel', 'nofollow noopener noreferrer');
                }
            }
            [...node.childNodes].forEach(sanitizeNode);
        };
        [...template.content.childNodes].forEach(sanitizeNode);
        return template.innerHTML;
    }

    renderMessageContent(text, format) {
        try {
            if (format === 'markdown') return this.markdownToHtml(String(text ?? ''));
            if (format === 'html') return this.sanitizeHtml(String(text ?? ''));
            return this.escapeHtml(String(text ?? '')).replace(/\n/g, '<br>');
        } catch (_) {
            return this.escapeHtml(String(text ?? ''));
        }
    }
}

// 2) Comunicação com a API
class ChatTransport {
    constructor(apiEndpoint) {
        this.apiEndpoint = apiEndpoint;
    }

    async send({ message, sessionId }) {
        const response = await fetch(this.apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, sessionId })
        });
        return response.json();
    }
}

// 3) Camada de UI (DOM, estilos e eventos)
class ChatUI {
    constructor(config, renderer) {
        this.config = config;
        this.renderer = renderer;
        this.root = null;
        this.injectStyles();
        this.create();
    }

    injectStyles() {
        if (document.getElementById('chat-widget-styles')) return;
        const style = document.createElement('style');
        style.id = 'chat-widget-styles';
        style.textContent = `
            .chat-widget { position: fixed; bottom: 20px; right: 20px; z-index: 9999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; }
            .chat-widget.bottom-left { left: 20px; right: auto; }
            .chat-widget.top-right { top: 20px; bottom: auto; }
            .chat-widget.top-left { top: 20px; left: 20px; right: auto; bottom: auto; }
            .chat-button { width: 64px; height: 64px; border-radius: 50%; background: ${this.config.primaryColor}; border: none; cursor: pointer; box-shadow: 0 8px 24px rgba(0,0,0,.2); display: flex; align-items: center; justify-content: center; transition: all .3s ease; }
            .chat-button:hover { transform: scale(1.05); box-shadow: 0 12px 32px rgba(0,0,0,.25); }
            .chat-button svg { width: 32px; height: 32px; fill: #fff; }
            .chat-window { display: none; position: fixed; bottom: 100px; right: 20px; width: 380px; height: 540px; background: #fff; border-radius: 20px; box-shadow: 0 8px 40px rgba(0,0,0,.15); flex-direction: column; overflow: hidden; }
            .chat-window.expanded { width: min(900px, 90vw); height: min(80vh, 820px); }
            .chat-widget.bottom-left .chat-window { left: 20px; right: auto; }
            .chat-widget.top-right .chat-window { top: 100px; bottom: auto; }
            .chat-widget.top-left .chat-window { top: 100px; left: 20px; right: auto; bottom: auto; }
            .chat-window.active { display: flex; }
            .chat-header { background: ${this.config.primaryColor}; color: #fff; padding: 18px 20px; font-weight: 600; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 8px rgba(0,0,0,.1); }
            .chat-header .header-title { display: flex; align-items: center; gap: 12px; font-size: 16px; }
            .chat-header .bot-avatar { width: 36px; height: 36px; border-radius: 50%; background: #FFD93D; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 2px 8px rgba(0,0,0,.15); }
            .chat-header .header-actions { display: flex; gap: 8px; align-items: center; }
            .close-btn, .expand-btn { background: rgba(255,255,255,.2); border: none; color: #fff; cursor: pointer; padding: 0; width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; transition: background .2s; }
            .close-btn:hover, .expand-btn:hover { background: rgba(255,255,255,.3); }
            .close-btn { font-size: 20px; line-height: 20px; }
            .expand-btn { font-size: 16px; }
            .chat-messages { flex: 1; padding: 20px; overflow-y: auto; background: #F8F9FA; }
            .message { margin-bottom: 16px; display: flex; gap: 10px; align-items: flex-end; }
            .message.user { flex-direction: row-reverse; }
            .message.user .message-avatar { display: none; }
            .message-avatar { width: 32px; height: 32px; border-radius: 50%; background: #FFD93D; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; box-shadow: 0 2px 6px rgba(0,0,0,.1); }
            .message-bubble { max-width: 70%; padding: 12px 16px; border-radius: 16px; word-wrap: break-word; white-space: normal; line-height: 1.5; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
            .message.bot .message-bubble { background: #fff; color: #333; border-bottom-left-radius: 4px; }
            .message.user .message-bubble { background: ${this.config.primaryColor}; color: #fff; border-bottom-right-radius: 4px; }
            .chat-input-container { padding: 16px 20px; background: #fff; border-top: 1px solid #E8EAED; display: flex; gap: 10px; align-items: center; }
            .chat-input { flex: 1; padding: 12px 16px; border: 2px solid #E8EAED; border-radius: 24px; outline: none; font-size: 14px; transition: border-color .2s; }
            .chat-input:focus { border-color: ${this.config.primaryColor}; }
            .send-btn { width: 44px; height: 44px; border-radius: 50%; background: ${this.config.primaryColor}; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,.15); transition: all .2s; }
            .send-btn:hover:not(:disabled) { transform: scale(1.05); box-shadow: 0 6px 16px rgba(0,0,0,.2); }
            .send-btn:disabled { opacity: .5; cursor: not-allowed; }
            .send-btn svg { width: 20px; height: 20px; fill: #fff; }
            .message-bubble p { margin: 0 0 8px; }
            .message-bubble p:last-child { margin-bottom: 0; }
            .message-bubble ul, .message-bubble ol { margin: 4px 0 8px 20px; padding-left: 0; }
            .message-bubble code { background: rgba(0,0,0,.08); padding: 2px 6px; border-radius: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 13px; }
            .message-bubble pre { background: rgba(0,0,0,.08); padding: 12px; border-radius: 8px; overflow: auto; margin: 8px 0; }
            .message.bot .message-bubble a { color: ${this.config.primaryColor}; text-decoration: underline; }
            .message.user .message-bubble a { color: #fff; text-decoration: underline; }
            .typing-indicator-wrapper { display: flex; gap: 10px; align-items: flex-end; margin-bottom: 16px; }
            .typing-indicator { display: none; padding: 12px 16px; background: #fff; border-radius: 16px; border-bottom-left-radius: 4px; width: fit-content; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
            .typing-indicator.active { display: block; }
            .typing-indicator span { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #A0A0A0; margin: 0 2px; animation: typing 1.4s infinite; }
            .typing-indicator span:nth-child(2) { animation-delay: .2s; }
            .typing-indicator span:nth-child(3) { animation-delay: .4s; }
            @keyframes typing { 0%,60%,100% { transform: translateY(0); opacity: .5; } 30% { transform: translateY(-8px); opacity: 1; } }
            @media (max-width: 480px) {
                .chat-window { width: calc(100vw - 40px); height: calc(100vh - 120px); right: 20px; }
                .chat-widget.bottom-left .chat-window, .chat-widget.top-left .chat-window { left: 20px; right: auto; }
                .chat-window.expanded { width: calc(100vw - 40px); height: calc(100vh - 120px); }
                .message-bubble { max-width: 78%; }
            }
        `;
        document.head.appendChild(style);
    }

    create() {
        const root = document.createElement('div');
        root.className = `chat-widget ${this.config.position}`;
        root.innerHTML = `
            <button class="chat-button" aria-label="Abrir chat">
                <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
            </button>
            <div class="chat-window" role="dialog" aria-label="${this.config.title}">
                <div class="chat-header">
                    <div class="header-title">
                        <div class="bot-avatar">${this.config.botIcon || '🤖'}</div>
                        <span>${this.config.title}</span>
                    </div>
                    <div class="header-actions">
                      <button class="expand-btn" title="Expandir" aria-label="Expandir" data-state="collapsed">⤢</button>
                      <button class="close-btn" title="Fechar" aria-label="Fechar">×</button>
                    </div>
                </div>
                <div class="chat-messages"></div>
                <div class="chat-input-container">
                    <input type="text" class="chat-input" placeholder="${this.config.placeholder}">
                    <button class="send-btn" aria-label="Enviar mensagem">
                        <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                    </button>
                </div>
            </div>`;
        document.body.appendChild(root);
        this.root = root;
        if (this.config.greeting) this.addMessage(this.config.greeting, false, this.config.messageFormat);
    }

    // Eventos de UI: callbacks serão recebidos via parâmetro.
    bind({ onToggle, onExpandToggle, onSend }) {
        const chatButton = this.root.querySelector('.chat-button');
        const closeBtn = this.root.querySelector('.close-btn');
        const expandBtn = this.root.querySelector('.expand-btn');
        const input = this.root.querySelector('.chat-input');
        const sendBtn = this.root.querySelector('.send-btn');

        chatButton.addEventListener('click', onToggle);
        closeBtn.addEventListener('click', onToggle);
        expandBtn.addEventListener('click', onExpandToggle);
        sendBtn.addEventListener('click', () => onSend());
        input.addEventListener('keypress', (e) => { if (e.key === 'Enter') onSend(); });
    }

    setActive(active) {
        const win = this.root.querySelector('.chat-window');
        win.classList.toggle('active', !!active);
    }

    setExpanded(expanded) {
        const win = this.root.querySelector('.chat-window');
        const btn = this.root.querySelector('.expand-btn');
        win.classList.toggle('expanded', !!expanded);
        if (win.classList.contains('expanded')) {
            btn.textContent = '⤡';
            btn.title = 'Reduzir';
            btn.setAttribute('aria-label', 'Reduzir');
            btn.setAttribute('data-state', 'expanded');
        } else {
            btn.textContent = '⤢';
            btn.title = 'Expandir';
            btn.setAttribute('aria-label', 'Expandir');
            btn.setAttribute('data-state', 'collapsed');
        }
    }

    focusInput() {
        const input = this.root.querySelector('.chat-input');
        if (input) input.focus();
    }

    getInputValue() {
        const input = this.root.querySelector('.chat-input');
        return input.value.trim();
    }

    clearInput() {
        const input = this.root.querySelector('.chat-input');
        input.value = '';
    }

    disableSend(disabled) {
        const sendBtn = this.root.querySelector('.send-btn');
        sendBtn.disabled = !!disabled;
    }

    addMessage(text, isUser = false, format = isUser ? 'text' : (this.config.messageFormat || 'markdown')) {
        const container = this.root.querySelector('.chat-messages');
        const msg = document.createElement('div');
        msg.className = `message ${isUser ? 'user' : 'bot'}`;

        // Adiciona avatar apenas para mensagens do bot
        if (!isUser) {
            const avatar = document.createElement('div');
            avatar.className = 'message-avatar';
            avatar.textContent = this.config.botIcon || '🤖';
            msg.appendChild(avatar);
        }

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.innerHTML = this.renderer.renderMessageContent(text, format);
        msg.appendChild(bubble);
        container.appendChild(msg);
        container.scrollTop = container.scrollHeight;
    }

    showTyping() {
        const container = this.root.querySelector('.chat-messages');
        const typingWrapper = document.createElement('div');
        typingWrapper.className = 'typing-indicator-wrapper';
        typingWrapper.id = 'typingIndicator';

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = this.config.botIcon || '🤖';

        const indicator = document.createElement('div');
        indicator.className = 'typing-indicator active';
        indicator.innerHTML = '<span></span><span></span><span></span>';

        typingWrapper.appendChild(avatar);
        typingWrapper.appendChild(indicator);
        container.appendChild(typingWrapper);
        container.scrollTop = container.scrollHeight;
    }

    hideTyping() {
        const typing = this.root.querySelector('#typingIndicator');
        if (typing) typing.remove();
    }

    destroy() { if (this.root) this.root.remove(); }
}

// 4) Orquestração: mantém API compatível com a versão anterior
class ChatWidget {
    constructor(options = {}) {
        this.config = {
            apiEndpoint: options.apiEndpoint,
            position: options.position,
            title: options.title,
            botIcon: options.botIcon || '🤖',
            placeholder: options.placeholder,
            primaryColor: options.primaryColor,
            greeting: options.greeting,
            messageFormat: options.messageFormat || 'markdown',
            ...options
        };
        this.sessionId = Date.now().toString();
        this.isOpen = false;

        this.renderer = new ChatRenderer();
        this.ui = new ChatUI(this.config, this.renderer);
        this.transport = new ChatTransport(this.config.apiEndpoint);

        this.ui.bind({
            onToggle: () => this.toggle(),
            onExpandToggle: () => this.toggleExpand(),
            onSend: () => this.sendMessage()
        });
    }

    toggleExpand() {
        const win = this.ui.root.querySelector('.chat-window');
        const expanded = !win.classList.contains('expanded');
        this.ui.setExpanded(expanded);
    }

    toggle() {
        this.isOpen = !this.isOpen;
        this.ui.setActive(this.isOpen);
        if (this.isOpen) this.ui.focusInput();
    }

    open() { this.isOpen = true; this.ui.setActive(true); this.ui.focusInput(); }
    close() { this.isOpen = false; this.ui.setActive(false); }

    addMessage(text, isUser = false, format = isUser ? 'text' : (this.config.messageFormat || 'markdown')) {
        this.ui.addMessage(text, isUser, format);
    }

    async sendMessage() {
        const message = this.ui.getInputValue();
        if (!message) return;
        this.ui.disableSend(true);
        this.addMessage(message, true, 'text');
        this.ui.clearInput();
        this.ui.showTyping();
        try {
            const data = await this.transport.send({ message, sessionId: this.sessionId });
            this.ui.hideTyping();
            if (data && data.success) {
                this.addMessage(data.reply, false, this.config.messageFormat || 'markdown');
                if (data.sessionId) this.sessionId = data.sessionId;
            } else {
                this.addMessage('Desculpe, ocorreu um erro. Tente novamente.', false);
            }
        } catch (err) {
            console.error('Erro ao enviar mensagem:', err);
            this.ui.hideTyping();
            this.addMessage('Erro de conexão. Verifique se o servidor está rodando.', false);
        } finally {
            this.ui.disableSend(false);
            this.ui.focusInput();
        }
    }

    setConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        // Atualizações simples de UI quando cores/títulos mudarem
        if (this.ui && this.ui.root) {
            // Atualiza cor primária em runtime (botão, header, etc.)
            const styleEl = document.getElementById('chat-widget-styles');
            if (styleEl && newConfig.primaryColor) {
                // Regera CSS mínimo afetado (básico; para mudanças maiores considerar CSS separado)
                styleEl.parentElement.removeChild(styleEl);
                this.ui.config = this.config;
                this.ui.injectStyles();
            }
            if (newConfig.title) {
                const titleEl = this.ui.root.querySelector('.chat-header .header-title span');
                if (titleEl) titleEl.textContent = newConfig.title;
            }
        }
    }

    destroy() { if (this.ui) this.ui.destroy(); }
}

// Exporta para uso global
window.ChatWidget = ChatWidget;

// Integração com Drupal (inalterada funcionalmente)
(function (Drupal, drupalSettings) {
  'use strict';

  Drupal.behaviors.chatbotWidget = {
    attach: function (context, settings) {
      if (context !== document) return;
      if (document.querySelector('.chat-widget')) return;
      const config = drupalSettings.chatbotWidget || {};
      new ChatWidget({
        apiEndpoint: config.apiEndpoint,
        title: config.title,
        botIcon: config.botIcon || '🤖',
        primaryColor: config.primaryColor,
        position: config.position,
        greeting: config.greeting,
        placeholder: config.placeholder,
        messageFormat: config.messageFormat || 'markdown'
      });
    }
  };

})(Drupal, drupalSettings);
