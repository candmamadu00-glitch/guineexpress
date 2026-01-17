/* ===========================================================
   CICÍ PRO MAX - INTELIGÊNCIA ARTIFICIAL DE LOGÍSTICA
   Versão: 4.0 (Super Smart)
   =========================================================== */

const CiciAI = {
    isOpen: false,
    userRole: 'visitor', // visitor, client, employee, admin
    userName: '',
    
    // Avatar Profissional (Mulher Simpática)
    avatarUrl: 'https://img.freepik.com/fotos-gratis/jovem-mulher-confiante-com-oculos_1098-20868.jpg?w=200',

    // ===============================================
    // CÉREBRO: PADRÕES E AÇÕES (Intents)
    // ===============================================
    // Aqui definimos o que ela entende e o que ela FAZ
    intents: [
        {
            // SAUDAÇÃO
            patterns: [/oi/i, /olá/i, /ola/i, /bom dia/i, /boa tarde/i, /boa noite/i, /eai/i],
            response: (role, name) => `Olá, ${name || 'visitante'}! Sou a Cicí, sua assistente virtual. 🤖\nComo posso agilizar seu dia hoje?`,
            action: null
        },
        {
            // AJUDA / MENU
            patterns: [/ajuda/i, /help/i, /socorro/i, /menu/i, /opções/i, /o que você faz/i],
            response: () => "Estou aqui para facilitar! Posso te ajudar a rastrear, pagar, agendar ou tirar dúvidas. Tente dizer: 'Quero ver minhas encomendas' ou 'Como pagar?'.",
            action: null
        },
        {
            // CADASTRO (Visitante)
            roles: ['visitor'],
            patterns: [/cadastro/i, /cadastrar/i, /criar conta/i, /registrar/i, /novo/i, /nova conta/i],
            response: () => "Ótima escolha! 🎉 Vou abrir o formulário de cadastro para você agora mesmo. É só preencher!",
            action: () => { 
                if(typeof showRegister === 'function') showRegister(); 
                else alert("Navegue até a tela de login para cadastrar.");
            }
        },
        {
            // LOGIN (Visitante)
            roles: ['visitor'],
            patterns: [/entrar/i, /logar/i, /login/i, /acessar/i, /minha conta/i],
            response: () => "Claro! Vou te levar para a tela de login. Digite seu email e senha.",
            action: () => { if(typeof showLogin === 'function') showLogin(); }
        },
        {
            // RASTREIO (Cliente/Admin)
            roles: ['client', 'admin', 'employee'],
            patterns: [/rastrear/i, /onde está/i, /minha encomenda/i, /chegou/i, /status/i, /pedidos/i],
            response: () => "Abrindo sua lista de encomendas! 📦 Se estiver 'Verde', já foi entregue.",
            action: () => { 
                if(typeof showSection === 'function') showSection('orders-view'); 
            }
        },
        {
            // FINANCEIRO / PAGAMENTO (Cliente)
            roles: ['client'],
            patterns: [/pagar/i, /fatura/i, /boleto/i, /pix/i, /cobrança/i, /dinheiro/i, /quanto custa/i],
            response: () => "Entendido! Indo para a área financeira. 💲 Lá você pode gerar o Pix ou pagar com cartão.",
            action: () => { 
                if(typeof showSection === 'function') showSection('billing-view'); 
            }
        },
        {
            // BOX (Cliente)
            roles: ['client'],
            patterns: [/box/i, /caixa/i, /juntar/i, /acumular/i],
            response: () => "O Box é ótimo para economizar no frete! 📦 Aqui estão seus itens acumulados.",
            action: () => { 
                if(typeof showSection === 'function') showSection('box-view'); 
            }
        },
        {
            // AGENDAMENTO (Cliente)
            roles: ['client'],
            patterns: [/agendar/i, /horário/i, /visita/i, /ir ai/i, /ir aí/i, /retirar/i],
            response: () => "Vamos marcar! 📅 Selecione um dia e horário disponível na tela que vou abrir.",
            action: () => { 
                if(typeof showSection === 'function') showSection('schedule-view'); 
            }
        },
        {
            // ADMINISTRAÇÃO (Admin)
            roles: ['admin'],
            patterns: [/lucro/i, /ganhos/i, /faturamento/i, /relatório/i, /dinheiro/i],
            response: () => "Modo Patrão Ativado! 💰 📊 Aqui está o resumo financeiro da empresa.",
            action: () => { 
                if(typeof showSection === 'function') showSection('billing-view'); // ou expenses-view se tiver
                // Tenta carregar stats se existir
                if(typeof loadDashboardStats === 'function') loadDashboardStats();
            }
        },
        {
            // FUNCIONÁRIOS (Admin/Employee)
            roles: ['admin'],
            patterns: [/funcionário/i, /equipe/i, /staff/i, /bloquear/i],
            response: () => "Gerenciamento de equipe. 🛠️ Aqui você pode adicionar ou remover acessos.",
            action: () => { 
                // Se tiver uma aba de usuarios, abre ela. Senão, vai para logs
                if(typeof showSection === 'function') showSection('logs-view'); 
            }
        },
        {
            // ETIQUETAS (Admin/Employee)
            roles: ['admin', 'employee'],
            patterns: [/etiqueta/i, /imprimir/i, /adesivo/i, /colar/i],
            response: () => "Abrindo o gerador de etiquetas térmicas. 🏷️ Selecione as caixas e clique em Imprimir.",
            action: () => { 
                if(typeof showSection === 'function') showSection('labels-view'); 
            }
        },
        {
            // VÍDEOS (Geral)
            patterns: [/vídeo/i, /video/i, /gravar/i, /ver caixa/i, /pesagem/i],
            response: () => "Câmera, Ação! 🎥 Na aba de vídeos você pode gravar ou assistir as pesagens.",
            action: () => { 
                if(typeof showSection === 'function') showSection('videos-section'); 
            }
        },
        {
            // AGRADECIMENTO
            patterns: [/obrigado/i, /valeu/i, /show/i, /top/i, /amei/i],
            response: () => "Fico feliz em ajudar! A Guineexpress agradece. 💛✈️",
            action: null
        }
    ],

    // ===============================================
    // LÓGICA DO SISTEMA
    // ===============================================
    init: function() {
        this.detectUser();
        this.renderWidget();
        
        // Boas vindas inteligente após 2 segundos
        setTimeout(() => {
            const badge = document.getElementById('cici-badge');
            if(badge) {
                badge.classList.remove('hidden');
                // Toca um som suave (opcional)
                // const audio = new Audio('notification.mp3'); audio.play().catch(e=>{});
            }
        }, 2000);
    },

    detectUser: function() {
        // Tenta pegar do localStorage ou da variável global do script.js
        if (typeof currentUser !== 'undefined' && currentUser) {
            this.userRole = currentUser.role;
            this.userName = currentUser.name.split(' ')[0]; // Só o primeiro nome
        } else {
            // Fallback pela URL
            const path = window.location.pathname;
            if (path.includes('admin')) this.userRole = 'admin';
            else if (path.includes('employee')) this.userRole = 'employee';
            else if (path.includes('client')) this.userRole = 'client';
            else this.userRole = 'visitor';
        }
    },

    renderWidget: function() {
        if(document.getElementById('cici-widget')) return;

        const html = `
            <div id="cici-widget">
                <div id="cici-chat-window">
                    <div class="cici-header">
                        <div class="cici-info">
                            <div style="display:flex; align-items:center; gap:10px;">
                                <div style="width:35px; height:35px; background:url('${this.avatarUrl}'); background-size:cover; border-radius:50%; border:2px solid #d4af37;"></div>
                                <div>
                                    <h4 style="margin:0; font-size:15px;">Cicí Inteligente</h4>
                                    <small style="color:#28a745;">● Online agora</small>
                                </div>
                            </div>
                        </div>
                        <button onclick="CiciAI.toggle()" style="background:none;border:none;color:white;cursor:pointer;font-size:24px;">&times;</button>
                    </div>
                    
                    <div class="cici-body" id="cici-messages">
                        <div class="msg cici">
                            Olá! Sou a <b>Cicí</b>, a IA da Guineexpress. ✈️<br>
                            Posso te ajudar a navegar, cadastrar ou rastrear. O que você precisa?
                        </div>
                        ${this.getQuickOptionsHTML()}
                    </div>

                    <div class="cici-input-area">
                        <input type="text" id="cici-input" placeholder="Ex: Rastrear, Pagar, Cadastro..." onkeypress="CiciAI.handleInput(event)">
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

    // Gera botões rápidos baseados no cargo
    getQuickOptionsHTML: function() {
        let opts = [];
        if (this.userRole === 'visitor') {
            opts = ['Criar Conta', 'Fazer Login', 'Preços'];
        } else if (this.userRole === 'client') {
            opts = ['Rastrear', 'Pagar Fatura', 'Novo Box', 'Sair'];
        } else if (this.userRole === 'admin') {
            opts = ['Financeiro', 'Funcionários', 'Embarques', 'Etiquetas'];
        } else { // Employee
            opts = ['Receber Encomenda', 'Vídeos', 'Etiquetas'];
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
            // Foca no input
            setTimeout(() => document.getElementById('cici-input').focus(), 300);
        } else {
            win.classList.remove('open');
        }
    },

    // CÉREBRO: Processa o texto e encontra a melhor resposta
    processText: function(text) {
        // Mostra a mensagem do usuário
        this.addMessage(text, 'user');

        // Simula "Digitando..."
        this.showTyping();

        setTimeout(() => {
            this.hideTyping();
            
            // 1. Procura nas INTENÇÕES (Intents)
            let match = null;
            
            for (let intent of this.intents) {
                // Se a intenção tem restrição de role, verifica se o usuário tem permissão
                if (intent.roles && !intent.roles.includes(this.userRole)) continue;

                // Verifica os padrões (Regex)
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
                // Resposta encontrada
                const reply = typeof match.response === 'function' ? match.response(this.userRole, this.userName) : match.response;
                this.addMessage(reply, 'cici');
                
                // Executa ação (Navegação, abrir modal, etc)
                if (match.action) {
                    console.log("Cicí executando ação...");
                    match.action();
                }
            } else {
                // Resposta Padrão (Fallback)
                this.addMessage("Hmm, não entendi exatamente. 😕 Tente usar os botões abaixo ou fale palavras-chave como 'Rastrear', 'Pagar' ou 'Cadastro'.", 'cici');
                // Mostra botões de novo para ajudar
                const msgs = document.getElementById('cici-messages');
                msgs.innerHTML += this.getQuickOptionsHTML();
                msgs.scrollTop = msgs.scrollHeight;
            }

        }, 800); // Delay artificial para parecer humano
    },

    addMessage: function(text, sender) {
        const msgs = document.getElementById('cici-messages');
        const div = document.createElement('div');
        div.className = `msg ${sender}`;
        div.innerHTML = text; // Permite HTML na resposta
        msgs.appendChild(div);
        msgs.scrollTop = msgs.scrollHeight;
    },

    showTyping: function() {
        const msgs = document.getElementById('cici-messages');
        const id = 'typing-dots';
        if(document.getElementById(id)) return;
        
        msgs.innerHTML += `
            <div id="${id}" class="typing-indicator">
                <div class="dot"></div><div class="dot"></div><div class="dot"></div>
            </div>`;
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

// Inicializa quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    // Pequeno delay para garantir que o 'currentUser' do script.js já foi carregado
    setTimeout(() => {
        CiciAI.init();
    }, 500);
});