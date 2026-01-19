/* ===========================================================
   CICÍ PRO MAX - INTELIGÊNCIA ARTIFICIAL CONTEXTUAL
   Versão: 5.0 (Painéis Separados)
   =========================================================== */

const CiciAI = {
    isOpen: false,
    userRole: 'visitor', // visitor, client, employee, admin
    userName: '',
    
    // Avatar
    avatarUrl: 'https://img.freepik.com/fotos-gratis/jovem-mulher-confiante-com-oculos_1098-20868.jpg?w=200',

    // ===============================================
    // CÉREBRO: PADRÕES E AÇÕES (Intents)
    // ===============================================
    intents: [
        // --- 1. GERAL (Funciona para todos) ---
        {
            roles: ['visitor', 'client', 'employee', 'admin'],
            patterns: [/oi/i, /olá/i, /ola/i, /bom dia/i, /boa tarde/i, /boa noite/i],
            response: (role, name) => `Olá, ${name || 'visitante'}! 👋 Sou a Cicí. Estou configurada para o painel de **${role.toUpperCase()}**. Como ajudo?`,
            action: null
        },
        {
            roles: ['visitor', 'client', 'employee', 'admin'],
            patterns: [/obrigado/i, /valeu/i, /show/i, /tchau/i],
            response: () => "Por nada! A Guineexpress agradece. ✈️💛",
            action: null
        },

        // --- 2. PAINEL VISITANTE (Home / Index) ---
        {
            roles: ['visitor'],
            patterns: [/cadastro/i, /cadastrar/i, /criar conta/i, /registrar/i],
            response: () => "Seja bem-vindo à família! 🎉 Vou abrir o formulário para você.",
            action: () => { if(typeof showRegister === 'function') showRegister(); }
        },
        {
            roles: ['visitor'],
            patterns: [/entrar/i, /login/i, /logar/i, /acessar/i],
            response: () => "Claro! Digite seu e-mail e senha na tela de login.",
            action: () => { if(typeof showLogin === 'function') showLogin(); }
        },
        {
            roles: ['visitor'],
            patterns: [/preço/i, /valor/i, /quanto custa/i, /cotação/i],
            response: () => "Nossos preços são por tamanho de caixa (Box) ou peso. Crie uma conta para ver a tabela completa! 📦",
            action: null
        },

        // --- 3. PAINEL CLIENTE (Dashboard Client) ---
        {
            roles: ['client'],
            patterns: [/rastrear/i, /onde está/i, /minhas encomendas/i, /pedidos/i, /chegou/i],
            response: () => "Abrindo sua lista de encomendas! 📦 Se estiver 'Verde', já pode retirar.",
            action: () => { showSection('orders-view'); }
        },
        {
            roles: ['client'],
            patterns: [/pagar/i, /fatura/i, /boleto/i, /pix/i, /financeiro/i],
            response: () => "Área financeira. 💲 Aqui você pode ver faturas abertas e chaves Pix.",
            action: () => { showSection('billing-view'); }
        },
        {
            roles: ['client'],
            patterns: [/agendar/i, /marcar/i, /retirar/i, /horário/i, /ir buscar/i],
            response: () => "Vamos agendar sua retirada ou entrega! 📅 Escolha um horário livre.",
            action: () => { showSection('schedule-view'); }
        },
        {
            roles: ['client'],
            patterns: [/box/i, /caixa/i, /nova caixa/i],
            response: () => "Gerenciamento de Box Virtual. 📦 Você pode ver o que já chegou no armazém.",
            action: () => { showSection('box-view'); }
        },
        {
            roles: ['client'],
            patterns: [/vídeo/i, /video/i, /ver/i, /assistir/i],
            response: () => "Confira os vídeos das suas encomendas sendo pesadas. 🎥",
            action: () => { showSection('videos-section'); }
        },

        // --- 4. PAINEL ADMIN (Dashboard Admin) ---
        {
            roles: ['admin'],
            patterns: [/faturamento/i, /lucro/i, /dinheiro/i, /caixa/i],
            response: () => "Modo Patrão! 💰 Abrindo relatório financeiro completo.",
            action: () => { showSection('billing-view'); } // ou a view específica de admin
        },
        {
            roles: ['admin'],
            patterns: [/funcionário/i, /equipe/i, /staff/i, /usuários/i],
            response: () => "Gerenciamento de equipe e acessos do sistema. 🛡️",
            action: () => { showSection('logs-view'); } 
        },
        {
            roles: ['admin'],
            patterns: [/etiqueta/i, /imprimir/i, /adesivo/i],
            response: () => "Gerador de Etiquetas Térmicas. 🏷️",
            action: () => { showSection('labels-view'); } 
        },

        // --- 5. PAINEL FUNCIONÁRIO (Dashboard Employee) ---
        {
            roles: ['employee'],
            patterns: [/receber/i, /entrada/i, /nova encomenda/i, /chegada/i],
            response: () => "Abrindo tela de Recebimento e Triagem. 📥",
            action: () => { showSection('receipts-view'); } 
        },
        {
            roles: ['employee'],
            patterns: [/vídeo/i, /gravar/i, /camera/i, /pesagem/i],
            response: () => "Luz, Câmera, Ação! 🎥 Vamos gravar o recebimento.",
            action: () => { showSection('videos-section'); } 
        }
    ],

    // ===============================================
    // LÓGICA DO SISTEMA
    // ===============================================
    init: function() {
        this.detectContext(); // Nova função de detecção rigorosa
        this.renderWidget();
        
        // Ativação silenciosa (só o badge)
        setTimeout(() => {
            const badge = document.getElementById('cici-badge');
            if(badge) badge.classList.remove('hidden');
        }, 1500);
    },

    // DETECÇÃO BASEADA NO ARQUIVO HTML (Contexto Real)
    detectContext: function() {
        const path = window.location.pathname;

        if (path.includes('dashboard-admin')) {
            this.userRole = 'admin';
            this.userName = 'Administrador';
        } 
        else if (path.includes('dashboard-employee')) {
            this.userRole = 'employee';
            this.userName = 'Colaborador';
        } 
        else if (path.includes('dashboard-client')) {
            this.userRole = 'client';
            // Tenta pegar o nome real se o script.js já carregou
            if (typeof currentUser !== 'undefined' && currentUser.name) {
                this.userName = currentUser.name.split(' ')[0];
            } else {
                this.userName = 'Cliente';
            }
        } 
        else {
            // Index, Login ou qualquer outra página pública
            this.userRole = 'visitor';
            this.userName = 'Visitante';
        }

        console.log(`🧠 Cici carregada. Contexto: ${this.userRole}`);
    },

    renderWidget: function() {
        if(document.getElementById('cici-widget')) return;

        // Texto de boas-vindas personalizado por painel
        let welcomeText = "Olá! Como posso ajudar?";
        if(this.userRole === 'visitor') welcomeText = "Bem-vindo à Guineexpress! ✈️ Quer fazer Login ou Cadastro?";
        if(this.userRole === 'client') welcomeText = `Olá, ${this.userName}! 📦 Quer ver suas encomendas ou agendar retirada?`;
        if(this.userRole === 'admin') welcomeText = "Painel Administrativo Ativo. 🛡️ Aguardando comando.";
        if(this.userRole === 'employee') welcomeText = "Vamos trabalhar? 🛠️ Recebimento ou Gravação?";

        const html = `
            <div id="cici-widget">
                <div id="cici-chat-window">
                    <div class="cici-header">
                        <div class="cici-info">
                            <div style="display:flex; align-items:center; gap:10px;">
                                <div style="width:35px; height:35px; background:url('${this.avatarUrl}'); background-size:cover; border-radius:50%; border:2px solid #d4af37;"></div>
                                <div>
                                    <h4 style="margin:0; font-size:15px;">Cicí Assistente</h4>
                                    <small style="color:#28a745;">● Online (${this.userRole})</small>
                                </div>
                            </div>
                        </div>
                        <button onclick="CiciAI.toggle()" style="background:none;border:none;color:white;cursor:pointer;font-size:24px;">&times;</button>
                    </div>
                    
                    <div class="cici-body" id="cici-messages">
                        <div class="msg cici">
                            ${welcomeText}
                        </div>
                        ${this.getQuickOptionsHTML()}
                    </div>

                    <div class="cici-input-area">
                        <input type="text" id="cici-input" placeholder="Digite sua dúvida..." onkeypress="CiciAI.handleInput(event)">
                        <button onclick="CiciAI.handleSend()" style="background:none;border:none;cursor:pointer;font-size:20px;">🚀</button>
                    </div>
                </div>
                
                <div id="cici-avatar" onclick="CiciAI.toggle()" style="background-image: url('${this.avatarUrl}');">
                    <div id="cici-badge" class="cici-badge hidden">1</div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
    },

    // Gera botões ESTRITAMENTE baseados no painel
    getQuickOptionsHTML: function() {
        let opts = [];
        
        switch(this.userRole) {
            case 'visitor':
                opts = ['Fazer Login', 'Criar Conta', 'Preços'];
                break;
            case 'client':
                opts = ['Rastrear Encomendas', 'Agendar Retirada', 'Financeiro', 'Vídeos'];
                break;
            case 'employee':
                opts = ['Receber Encomenda', 'Gravar Vídeo', 'Etiquetas'];
                break;
            case 'admin':
                opts = ['Faturamento', 'Equipe', 'Etiquetas', 'Logs'];
                break;
        }

        let html = `<div class="cici-options" style="margin-top:10px;">`;
        opts.forEach(opt => {
            html += `<button class="cici-btn-opt" onclick="CiciAI.processText('${opt}')">${opt}</button>`;
        });
        html += `</div>`;
        return html;
    },

    toggle: function() {
        const win = document.getElementById('cici-chat-window');
        const badge = document.getElementById('cici-badge');
        
        this.isOpen = !this.isOpen;
        if (this.isOpen) {
            win.classList.add('open');
            badge.classList.add('hidden');
            setTimeout(() => document.getElementById('cici-input').focus(), 300);
        } else {
            win.classList.remove('open');
        }
    },

    processText: function(text) {
        this.addMessage(text, 'user');
        this.showTyping();

        setTimeout(() => {
            this.hideTyping();
            
            // 1. Procura match nas Intents
            let match = null;
            
            for (let intent of this.intents) {
                // FILTRO CRÍTICO: Só aceita a intent se ela pertencer à role atual
                if (!intent.roles.includes(this.userRole)) continue;

                for (let pattern of intent.patterns) {
                    if (pattern.test(text)) {
                        match = intent;
                        break;
                    }
                }
                if (match) break;
            }

            // 2. Responde
            if (match) {
                const reply = typeof match.response === 'function' ? match.response(this.userRole, this.userName) : match.response;
                this.addMessage(reply, 'cici');
                if (match.action) match.action();
            } else {
                // Fallback inteligente
                this.addMessage("Desculpe, não entendi ou não tenho acesso a isso no seu painel atual. 😕 Tente clicar nas opções:", 'cici');
                const msgs = document.getElementById('cici-messages');
                msgs.innerHTML += this.getQuickOptionsHTML();
                msgs.scrollTop = msgs.scrollHeight;
            }

        }, 600);
    },

    addMessage: function(text, sender) {
        const msgs = document.getElementById('cici-messages');
        const div = document.createElement('div');
        div.className = `msg ${sender}`;
        div.innerHTML = text;
        msgs.appendChild(div);
        msgs.scrollTop = msgs.scrollHeight;
    },

    showTyping: function() {
        const msgs = document.getElementById('cici-messages');
        if(document.getElementById('typing-dots')) return;
        msgs.innerHTML += `<div id="typing-dots" class="typing-indicator"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>`;
        msgs.scrollTop = msgs.scrollHeight;
    },

    hideTyping: function() {
        const el = document.getElementById('typing-dots');
        if(el) el.remove();
    },

    handleInput: function(e) {
        if(e.key === 'Enter') this.handleSend();
    },

    handleSend: function() {
        const input = document.getElementById('cici-input');
        const txt = input.value.trim();
        if(!txt) return;
        input.value = '';
        this.processText(txt);
    }
};

// Inicializa
document.addEventListener('DOMContentLoaded', () => {
    // Delay para garantir que variaveis globais existam
    setTimeout(() => { CiciAI.init(); }, 800);
});