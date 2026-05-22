let currentRole = 'employee';
let currentUser = null;
let globalPricePerKg = 0; 
let mediaRecorder;
let recordedChunks = [];
let currentStream = null;
let currentBlob = null;

// 👇 ADICIONE AQUI NO TOPO!
let itensNoCarrinho = []; 
let produtosOriginais = [];
let meuGraficoEstoque = null;
// 👇 ADICIONE BEM NO TOPO DO SEU script.js
var categoriaAtualLoja = 'Todos';
// O banco de dados salva em Reais (BRL). 
// Usamos window.COTACAO para o sistema inteiro (Vitrine e Carrinho) conseguir ver estes valores!
window.COTACAO = {
    BRL: 1,      // R$ 1 é R$ 1
    XOF: 120,    // R$ 1 = 120 Francos CFA (Ajuste conforme o câmbio atual)
    EUR: 0.18,   // R$ 1 = 0,18 Euros
    USD: 0.20    // R$ 1 = 0,20 Dólares
};

// Esta função deve ser chamada quando o cliente muda a moeda no menu dropdown
window.alterarMoedaLoja = function() {
    aplicarFiltrosLoja(); // Atualiza os preços na vitrine
    renderizarCarrinhoLateral(); // Atualiza os preços dentro da sacola
}
// ============================================================
// BLOQUEADOR DE NAVEGADOR INTERNO (WHATSAPP, INSTAGRAM, ETC)
// ============================================================
function checkInAppBrowser() {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    
    // Verifica se está dentro do WhatsApp, Facebook ou Instagram
    if (ua.indexOf('FBAN') > -1 || ua.indexOf('FBAV') > -1 || ua.indexOf('Instagram') > -1 || ua.indexOf('WhatsApp') > -1) {
        
        // Esconde tudo e mostra um aviso gigante para abrir no Chrome
        document.body.innerHTML = `
            <div style="padding: 30px; text-align: center; font-family: 'Arial', sans-serif; background: #0a1931; color: white; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; box-sizing: border-box;">
                <i class="fab fa-chrome" style="font-size: 60px; color: #d4af37; margin-bottom: 20px;"></i>
                <h2 style="color: #d4af37; margin-bottom: 10px;">Atenção!</h2>
                <p style="font-size: 16px; margin-bottom: 20px; line-height: 1.5;">Você abriu o nosso aplicativo por dentro do WhatsApp e isso limita algumas funções importantes (como o envio de comprovantes).</p>
                
                <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; border: 1px solid #d4af37;">
                    <p style="font-size: 15px; margin: 0;">👉 Toque nos <strong>3 pontinhos</strong> (no canto superior da tela) e escolha:<br><br><strong style="color: #13d841;">"Abrir no Chrome"</strong> ou <strong>"Abrir no Navegador"</strong>.</p>
                </div>
            </div>
        `;
        return true;
    }
    return false;
}
// ==========================================
// CICÍ TOUR GUIDE (EFEITOS VISUAIS E SETAS)
// ==========================================
const CiciTour = {
    overlay: null,
    arrow: null,

    // Cria a camada escura e a seta
    initEfeitos: function() {
        if (!document.getElementById('cici-overlay')) {
            this.overlay = document.createElement('div');
            this.overlay.id = 'cici-overlay';
            this.overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:9990; display:none; pointer-events:none; transition: all 0.3s;';
            document.body.appendChild(this.overlay);
        }
        if (!document.getElementById('cici-arrow')) {
            this.arrow = document.createElement('div');
            this.arrow.id = 'cici-arrow';
            this.arrow.innerHTML = '👉'; // Seta piscando
            this.arrow.style.cssText = 'position:fixed; z-index:9995; font-size:40px; display:none; animation: bounceX 1s infinite; pointer-events:none;';
            document.body.appendChild(this.arrow);
            
            // Adiciona a animação da seta no CSS
            const style = document.createElement('style');
            style.innerHTML = `@keyframes bounceX { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(-15px); } }`;
            document.head.appendChild(style);
        }
    },

    // Ilumina um elemento específico e aponta a seta
    focarElemento: function(elementId, mensagemCici) {
        this.initEfeitos();
        const el = document.getElementById(elementId) || document.querySelector(elementId);
        
        if (!el) return;

        // Traz o elemento para frente do overlay
        el.style.position = 'relative';
        el.style.zIndex = '9991';
        el.style.background = '#fff'; // Garante que fique visível

        this.overlay.style.display = 'block';

        // Calcula a posição para colocar a seta ao lado esquerdo do elemento
        const rect = el.getBoundingClientRect();
        this.arrow.style.top = `${rect.top + (rect.height / 2) - 20}px`;
        this.arrow.style.left = `${rect.left - 50}px`;
        this.arrow.style.display = 'block';

        // Faz a Cicí falar
        if (!CiciAI.isOpen) CiciAI.toggle();
        CiciAI.addMessage(mensagemCici, 'cici');
    },

    limparFoco: function(elementId) {
        const el = document.getElementById(elementId) || document.querySelector(elementId);
        if (el) {
            el.style.zIndex = '';
            el.style.position = '';
        }
        if(this.overlay) this.overlay.style.display = 'none';
        if(this.arrow) this.arrow.style.display = 'none';
    }
};

// Roda a verificação assim que o script carrega
checkInAppBrowser();
// ==========================================
// AUTO-LOGIN (Ao atualizar a página)
// ==========================================
async function checkAutoLogin() {
    try {
        const res = await fetch('/api/check-session');
        const data = await res.json();

        if (data.loggedIn) {
            // Salva dados globais
            currentUser = data.user;
            currentRole = data.user.role;

            // --- NOVO: ATUALIZA O NOME NA TELA ---
            const nameDisplay = document.getElementById('user-name-display');
            if (nameDisplay && currentUser.name) {
                // Pega só o primeiro nome (Ex: "João Silva" vira "João")
                const firstName = currentUser.name.split(' ')[0];
                nameDisplay.innerText = firstName;
            }
            // -------------------------------------
                   // 👇 PUXA OS ITENS DA SACOLA QUE O CLIENTE DEIXOU ONTEM!
            if (currentRole === 'client') {
                recuperarCarrinhoDaMemoriaDoCelular();
            }
            // Esconde Login e Mostra Dashboard
            document.getElementById('login-screen').classList.add('hidden');
            
            if (currentRole === 'admin') {
                window.location.href = 'dashboard-admin.html'; 
            } else {
                if(window.location.pathname.includes('index') || window.location.pathname === '/') {
                     window.location.href = 'dashboard-client.html';
                } else {
                     showSection('home-view'); 
                }
            }
        }
    } catch (error) {
        console.log("Sessão expirada ou inválida.");
    }
}
// Executa ao abrir a página
document.addEventListener('DOMContentLoaded', () => {
    checkAutoLogin();
});
// ==========================================
// 1. FUNÇÕES DE VALIDAÇÃO MATEMÁTICA (CPF/NIF)
// ==========================================

function isValidCPF(cpf) {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf == '') return false;
    // Elimina CPFs invalidos conhecidos
    if (cpf.length != 11 || 
        cpf == "00000000000" || 
        cpf == "11111111111" || 
        cpf == "22222222222" || 
        cpf == "33333333333" || 
        cpf == "44444444444" || 
        cpf == "55555555555" || 
        cpf == "66666666666" || 
        cpf == "77777777777" || 
        cpf == "88888888888" || 
        cpf == "99999999999")
            return false;
    
    // Valida 1o digito
    let add = 0;
    for (let i = 0; i < 9; i ++) add += parseInt(cpf.charAt(i)) * (10 - i);
    let rev = 11 - (add % 11);
    if (rev == 10 || rev == 11) rev = 0;
    if (rev != parseInt(cpf.charAt(9))) return false;
    
    // Valida 2o digito
    add = 0;
    for (let i = 0; i < 10; i ++) add += parseInt(cpf.charAt(i)) * (11 - i);
    rev = 11 - (add % 11);
    if (rev == 10 || rev == 11) rev = 0;
    if (rev != parseInt(cpf.charAt(10))) return false;
    
    return true;
}

function isValidPT_NIF(nif) {
    // Validação básica de NIF Portugal
    if (!['1', '2', '3', '5', '6', '8', '9'].includes(nif.substr(0, 1)) && 
        !['45', '70', '71', '72', '74', '75', '77', '79'].includes(nif.substr(0, 2))) {
        return false;
    }
    const total = nif[0] * 9 + nif[1] * 8 + nif[2] * 7 + nif[3] * 6 + nif[4] * 5 + nif[5] * 4 + nif[6] * 3 + nif[7] * 2;
    const modulo11 = total % 11;
    const comparador = modulo11 < 2 ? 0 : 11 - modulo11;
    return nif[8] == comparador;
}

// ==========================================
// 2. CONFIGURAÇÃO AVANÇADA DE MÁSCARAS
// ==========================================

const countryData = {
    'GW': { code: '245', phoneMask: '+{245} 00 000 00 00', docMask: '000000000' }, // Guiné (Biométrico)
    'BR': { code: '55',  phoneMask: '+{55} (00) 00000-0000', docMask: '000.000.000-00' }, // Brasil (CPF)
    'PT': { code: '351', phoneMask: '+{351} 000 000 000', docMask: '000000000' }, // Portugal (NIF)
    'SN': { code: '221', phoneMask: '+{221} 00 000 00 00', docMask: '0 000 0000 00000' }, // Senegal
    'MA': { code: '212', phoneMask: '+{212} 0 00 00 00 00', docMask: '00000000' }, // Marrocos
    'US': { code: '1',   phoneMask: '+{1} (000) 000-0000', docMask: '000-00-0000' }, // EUA
    'FR': { code: '33',  phoneMask: '+{33} 0 00 00 00 00', docMask: '000000000000' }, // França
    'ES': { code: '34',  phoneMask: '+{34} 000 000 000', docMask: '00000000a' }, // Espanha (NIE/DNI aceita letra no fim)
    'UK': { code: '44',  phoneMask: '+{44} 0000 000000', docMask: '000000000' }, // UK
    'BE': { code: '32',  phoneMask: '+{32} 000 00 00 00', docMask: '00.00.00-000.00' }, // Bélgica
    'CV': { code: '238', phoneMask: '+{238} 000 00 00', docMask: '000000000' }, // Cabo Verde
    'default': { code: '', phoneMask: '00000000000000', docMask: '********************' }
};

let phoneMaskInstance = null;
let docMaskInstance = null;

function updateMasks() {
    if (typeof IMask === 'undefined') return;

    const countrySelect = document.getElementById('reg-country');
    const phoneInput = document.getElementById('reg-phone');
    const docInput = document.getElementById('reg-doc');
    const loginCard = document.querySelector('.login-card'); // Pega o card

    if (!countrySelect || !phoneInput || !docInput) return;

    const country = countrySelect.value;
    const data = countryData[country] || countryData['default'];

    // --- NOVIDADE: ATUALIZA BANDEIRA NO FUNDO ---
    // Remove qualquer classe de bandeira anterior
    loginCard.className = loginCard.className.replace(/\bbg-flag-\S+/g, '');
    // Adiciona a nova classe de bandeira
    loginCard.classList.add(`bg-flag-${country}`);

    // --- 1. MÁSCARA DE TELEFONE ---
    if (phoneMaskInstance) phoneMaskInstance.destroy();
    try {
        phoneMaskInstance = IMask(phoneInput, {
            mask: data.phoneMask,
            lazy: false,
            placeholderChar: '_' 
        });
    } catch (e) { console.error(e); }

    // --- 2. MÁSCARA DE DOCUMENTO ---
    if (docMaskInstance) docMaskInstance.destroy();
    try {
        docMaskInstance = IMask(docInput, {
            mask: data.docMask,
            prepare: (str) => str.toUpperCase()
        });
        
        // Placeholders dinâmicos
        if (country === 'BR') docInput.placeholder = "CPF (Ex: 123.456.789-00)";
        else if (country === 'PT') docInput.placeholder = "NIF (Ex: 123456789)";
        else if (country === 'GW') docInput.placeholder = "Nº Documento (9 dígitos)";
        else docInput.placeholder = "Número do Documento";
        
    } catch (e) { console.error(e); }
}

// Inicializa
document.addEventListener('DOMContentLoaded', () => {
    if(document.getElementById('reg-country')) updateMasks();
    checkAutoLogin(); // Sua função de login existente
});
// --- LOGIN COM A INTERVENÇÃO DA CICI ---
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const loginInput = document.getElementById('login-user').value;
    const passInput = document.getElementById('login-pass').value;
    
    // Tenta fazer o login
    try {
        const res = await fetch('/api/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: loginInput, password: passInput, role: currentRole })
        });
        
        const data = await res.json();
        
        if(data.success) {
            localStorage.setItem('userRole', data.role);
            
            // Sucesso! Vai para o painel
            if (data.role === 'client') {
                window.location.href = 'dashboard-client.html';
            } else if (data.role === 'employee') {
                window.location.href = 'dashboard-employee.html';
            } else {
                window.location.href = 'dashboard-admin.html';
            }
        } else {
            // ===============================================
            // A MÁGICA DA CICI ACONTECE AQUI SE DER ERRO!
            // ===============================================
            if (currentRole === 'client') {
                // Chama a Cici para ajudar o cliente
                acionarAjudaDaCici(loginInput);
            } else {
                // Se for Admin/Staff, só dá o erro normal
                alert("Erro de acesso: " + data.msg);
            }
        }
    } catch (err) {
        console.error(err);
        alert("Erro de conexão ao tentar fazer login.");
    }
});
// ==========================================
// VERIFICAR CLIENTES ANTIGOS AO FAZER LOGIN
// ==========================================
function verificarClienteAntigoNoLogin(dadosDoCliente) {
    const nome = dadosDoCliente.nome;
    const email = dadosDoCliente.email;
    const telefone = dadosDoCliente.telefone;

    // Passamos os dados antigos dele pelo mesmo validador
    const dadosCorretos = validarDadosCadastro(nome, email, telefone);

    if (!dadosCorretos) {
        // Se os dados estiverem bagunçados, nós forçamos ele a corrigir!
        alert("⚠️ Notamos que os seus dados de contato (Nome, Email ou Celular) estão incorretos no nosso sistema. Para sua segurança e para receber atualizações das suas encomendas, por favor, atualize-os agora.");
        
        // AQUI VOCÊ PODE ABRIR UM MODAL DE "ATUALIZAR PERFIL" 
        // Em vez de deixar ele ir pro painel, obriga ele a preencher um formulário de correção.
        // abrirModalCorrecaoDados(); 
        
        return false; // Impede ele de ver o painel enquanto não arrumar
    }

    // Se estiver tudo ok, deixa ele entrar no painel
    console.log("Dados antigos conferidos. Acesso Liberado!");
    window.location.href = "painel.html"; // ou a rota do seu painel
}
// FUNÇÃO QUE CRIA O BALÃO DA CICI, FAZ PISCAR E FALA EM VOZ ALTA!
function acionarAjudaDaCici(emailDigitado) {
    // 1. Cria o balão visual da Cici
    let ciciMsg = document.getElementById('cici-login-msg');
    if (!ciciMsg) {
        ciciMsg = document.createElement('div');
        ciciMsg.id = 'cici-login-msg';
        ciciMsg.innerHTML = `
            <div style="display:flex; align-items:center; gap:15px; background:rgba(10, 25, 49, 0.95); padding:15px 20px; border-radius:15px; border:2px solid #009ee3; box-shadow:0 10px 30px rgba(0,158,227,0.4); color:#fff; max-width:350px;">
                <div style="font-size:35px; animation: bounce 2s infinite;">👩‍💻</div>
                <div>
                    <strong style="color:#009ee3; font-size:16px;">Assistente Cici diz:</strong><br>
                    <span style="font-size:14px; line-height:1.4;">Oi! 🙋‍♀️ Não encontrei essa conta. Você é novo por aqui? Clique em <b>Criar Conta Agora</b> e faça seu cadastro rapidinho!</span>
                </div>
            </div>
        `;
        ciciMsg.style.position = 'fixed';
        ciciMsg.style.bottom = '30px';
        ciciMsg.style.right = '20px';
        ciciMsg.style.zIndex = '9999';
        ciciMsg.style.transform = 'translateY(150px)';
        ciciMsg.style.opacity = '0';
        ciciMsg.style.transition = 'all 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
        document.body.appendChild(ciciMsg);
    }

    // Faz a Cici subir na tela
    setTimeout(() => {
        ciciMsg.style.transform = 'translateY(0)';
        ciciMsg.style.opacity = '1';
    }, 100);

    // ==========================================
    // 🎙️ A MÁGICA DA VOZ DA CICI ACONTECE AQUI
    // ==========================================
    const textoFalado = "Oi! Não encontrei essa conta. Você é novo por aqui? Clique em Criar Conta e faça seu cadastro rapidinho!";
    const vozCici = new SpeechSynthesisUtterance(textoFalado);
    vozCici.lang = 'pt-BR'; // Idioma
    vozCici.rate = 1.0; // Velocidade
    vozCici.pitch = 1.2; // Voz mais fina/feminina
    
    // Cancela e fala
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(vozCici);
    // ==========================================

    // 2. Faz o NOVO BOTÃO DOURADO "Criar Conta Agora" piscar intensamente
    const btnCadastro = document.getElementById('btn-cadastro');
    if (btnCadastro) {
        // Guarda o estilo original
        const boxSOriginal = btnCadastro.style.boxShadow;
        const transOriginal = btnCadastro.style.transform;

        // Aplica o super brilho azul e aumenta o botão
        btnCadastro.style.transition = 'all 0.3s';
        btnCadastro.style.boxShadow = '0 0 30px #009ee3, 0 0 10px #fff';
        btnCadastro.style.transform = 'scale(1.05)';
        btnCadastro.style.border = '2px solid #fff';

        // Volta ao normal depois de 6 segundos
        setTimeout(() => {
            btnCadastro.style.boxShadow = boxSOriginal;
            btnCadastro.style.transform = transOriginal;
            btnCadastro.style.border = 'none';
        }, 6000);
    }

    // 3. Preenche automaticamente o e-mail no formulário
    if (emailDigitado && emailDigitado.includes('@')) {
        const regEmailInput = document.getElementById('reg-email');
        if(regEmailInput) regEmailInput.value = emailDigitado;
    }
    
    // A Cici vai embora da tela depois de 9 segundos
    setTimeout(() => {
        if (ciciMsg) {
            ciciMsg.style.transform = 'translateY(150px)';
            ciciMsg.style.opacity = '0';
            setTimeout(() => ciciMsg.remove(), 600);
        }
    }, 9000);
}
// ==========================================
// 3. LÓGICA DE CADASTRO RIGOROSA
// ==========================================

document.getElementById('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const pass = document.getElementById('reg-pass').value;
    const pass2 = document.getElementById('reg-pass2').value;
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const country = document.getElementById('reg-country').value;
    
    // Pega o valor do documento direto do input (com ou sem máscara)
    const docInput = document.getElementById('reg-doc').value.trim();
    // ========================================================
    // 🛡️ NOVO: GUARDA-COSTAS DE NOME E EMAIL
    // ========================================================
    if (name.includes('@') || name.toLowerCase().includes('.com')) {
        return alert("❌ O campo NOME está incorreto. Digite seu Nome e Sobrenome, não o seu email.");
    }
    if (name.trim().split(' ').length < 2) {
        return alert("❌ Por favor, digite seu Nome e Sobrenome completos.");
    }
    const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regexEmail.test(email)) {
        return alert("❌ O EMAIL digitado é inválido. Digite um email correto (Ex: nome@gmail.com).");
    }
    // --- A. Validação de Senha ---
    if (pass !== pass2) return alert('❌ As senhas não coincidem!');
    if (pass.length < 6) return alert('❌ A senha deve ter no mínimo 6 caracteres.');

    // --- B. Validação de Telefone ---
    // Pega o valor do telefone. Se tiver máscara do iMask, pega o valor sem máscara. Se não tiver, pega o valor direto.
    const finalPhone = typeof phoneMaskInstance !== 'undefined' && phoneMaskInstance ? phoneMaskInstance.unmaskedValue : document.getElementById('reg-phone').value;

    if (!finalPhone || finalPhone.length < 8) {
         return alert('❌ Telefone incompleto ou inválido!');
    }

    // --- C. Validação de Documento (A flexibilidade para estrangeiros) ---
    let finalDoc = docInput;

    // Se o país for Brasil e a máscara estiver ativa, aplica validação estrita
    if (country === 'BR') {
        if (typeof docMaskInstance !== 'undefined' && docMaskInstance) {
             if (!docMaskInstance.masked.isComplete) {
                 return alert('❌ O CPF/CNPJ está incompleto.');
             }
             finalDoc = docMaskInstance.unmaskedValue; // Pega só os números
        } else {
             finalDoc = docInput.replace(/\D/g, ''); // Segurança caso a máscara falhe
        }
        
        // Aqui você pode manter sua função isValidCPF se ela existir no seu código
        if (typeof isValidCPF === 'function' && finalDoc.length === 11 && !isValidCPF(finalDoc)) {
            return alert('❌ CPF Inválido! Verifique os números digitados.');
        }
    } 
    // Se o país for Portugal, aplica validação estrita (se a função existir)
    else if (country === 'PT' && typeof isValidPT_NIF === 'function') {
         if (!isValidPT_NIF(docInput)) {
             return alert('❌ NIF de Portugal inválido!');
         }
    } 
    // SE FOR OUTRO PAÍS: Verifica apenas se não está vazio ou muito curto
    else {
        if (finalDoc.length < 4) {
            return alert(`❌ O documento digitado para ${country} é muito curto ou inválido.`);
        }
    }

    // --- D. Envio dos Dados ---
    const formData = {
        name: name,
        email: email,
        phone: finalPhone, 
        country: country,
        document: country === 'BR' ? finalDoc : finalDoc.toUpperCase(), // Maiúsculo para passaportes
        password: pass
    };

    const btn = e.target.querySelector('button');
    const oldText = btn.innerText;
    btn.innerText = "Verificando...";
    btn.disabled = true;

    try {
        const res = await fetch('/api/register', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(formData)
        });
        
        const data = await res.json();
        
        if(data.success) { 
            alert('✅ Cadastro realizado com sucesso!\nFaça login para continuar.'); 
            if (typeof showLogin === 'function') showLogin(); 
            document.getElementById('register-form').reset();
            if (typeof updateMasks === 'function') updateMasks(); 
        } else { 
            alert('Erro: ' + data.msg); 
        }
    } catch (error) {
        console.error(error);
        alert("Erro de conexão ao cadastrar.");
    } finally {
        btn.innerText = oldText;
        btn.disabled = false;
    }
});
function showSection(sectionId) {
    console.log("Navegando para:", sectionId);

    // 1. Esconde TODAS as seções
    const allSections = document.querySelectorAll('section');
    allSections.forEach(sec => {
        sec.classList.add('hidden');
        sec.style.display = 'none'; 
    });

    // 2. Mostra a seção desejada
    const target = document.getElementById(sectionId);
    if (target) {
        target.classList.remove('hidden');
        target.style.display = 'block'; 
        localStorage.setItem('activeTab', sectionId);
    }

    // 3. CARREGAMENTO DE DADOS (Aqui estava o erro: faltavam funções)
    switch(sectionId) {
        // --- AS QUE JÁ EXISTIAM ---
        case 'orders-view':     if(typeof loadOrders === 'function') loadOrders(); break;
        case 'schedule-view':   if(typeof loadSchedules === 'function') loadSchedules(); break;
        case 'box-view':        if(typeof loadBoxes === 'function') loadBoxes(); break;
        case 'price-section':   if(typeof loadPrice === 'function') loadPrice(); break;
        case 'billing-view':    if(typeof loadClientInvoices === 'function') loadClientInvoices(); break; // Admin ou Cliente
        case 'history-view':    if(typeof loadHistory === 'function') loadHistory(); break;
        case 'labels-view':     if(typeof loadLabels === 'function') loadLabels(); break;
        case 'expenses-view':   if(typeof loadExpenses === 'function') loadExpenses(); break;
        case 'logs-view':       if(typeof loadSystemLogs === 'function') loadSystemLogs(); break;
        case 'shipments-view':  if(typeof loadShipments === 'function') loadShipments(); break;
        case 'receipts-view':   if(typeof loadReceipts === 'function') loadReceipts(); break;

        // --- AS QUE ESTAVAM FALTANDO (AQUI ESTÁ A CORREÇÃO) ---
        case 'employees-view':  if(typeof loadEmployees === 'function') loadEmployees(); break; 
        case 'clients-view':    if(typeof loadClients === 'function') loadClients(); break;
    }
// ==========================================
    // 🪄 MÁGICA: MOSTRAR/ESCONDER ITENS DA LOJA
    // ==========================================
    const btnSacola = document.getElementById('nav-sacola');
    const btnPedidos = document.getElementById('nav-pedidos');
    const videoFlutuante = document.getElementById('floating-carousel-container'); // <-- AGORA COM O ID REAL!

    if (sectionId === 'store-view') {
        // Se abriu a loja, MOSTRA tudo
        if (btnSacola) btnSacola.style.display = 'flex';
        if (btnPedidos) btnPedidos.style.display = 'flex';
        if (videoFlutuante) videoFlutuante.style.display = 'block'; 
    } else {
        // Se abriu qualquer outra tela, ESCONDE tudo
        if (btnSacola) btnSacola.style.display = 'none';
        if (btnPedidos) btnPedidos.style.display = 'none';
        if (videoFlutuante) videoFlutuante.style.display = 'none';
    }
    // Lógica especial de vídeo
    if(sectionId === 'videos-section') {
        if(currentUser && currentUser.role !== 'client') {
            if(typeof loadOrdersForVideo === 'function') loadOrdersForVideo();
            if(typeof loadAdminVideos === 'function') loadAdminVideos();
        } else {
            if(typeof loadClientVideos === 'function') loadClientVideos();
        }
    }
}
async function initDashboard() {
    try {
        const res = await fetch('/api/user');
        
        if(res.status !== 200) {
            console.warn("Sessão inválida.");
            return window.location.href = 'index.html';
        }

        currentUser = await res.json();
        
        // Exibe cargo no topo
        const roleDisplay = document.getElementById('user-role-display');
        if(roleDisplay) roleDisplay.innerText = `| ${currentUser.role.toUpperCase()}`;

        // Preenche perfil se for cliente
        if(currentUser.role === 'client' && document.getElementById('profile-name')) {
            document.getElementById('profile-name').value = currentUser.name || '';
            document.getElementById('profile-email').value = currentUser.email || '';
            document.getElementById('profile-phone').value = currentUser.phone || '';

            // --- ATUALIZA A FOTO NAS DUAS TELAS ---
            const imgDisplay = document.getElementById('profile-img-display');
            if(currentUser.profile_pic && imgDisplay) {
                const urlFoto = '/uploads/' + currentUser.profile_pic + '?v=' + new Date().getTime();
                
                // 1. Atualiza na aba Perfil
                imgDisplay.src = urlFoto;
                
                // 2. Atualiza na aba Início (O bonequinho do topo!)
                const vipImg = document.getElementById('vip-profile-img');
                if (vipImg) vipImg.src = urlFoto;
            }

            // --- BÔNUS: ATUALIZA O NOME NA TELA INICIAL ---
            const nameDisplay = document.getElementById('user-name-display');
            if (nameDisplay && currentUser.name) {
                // Pega só o primeiro nome da pessoa (ex: "Mamadu") para ficar amigável
                nameDisplay.innerText = currentUser.name.split(' ')[0];
            }
        }
        // --- AQUI ESTAVA O ERRO DO PREÇO ZERADO ---
        // O "await" obriga o código a parar aqui até o preço ser carregado do servidor
        await loadPrice(); 
        
        // Só depois de ter o preço, carregamos as listas
        if(currentUser.role !== 'client') loadClients();
        loadOrders();
        loadSchedules();

        // Recupera aba anterior
        const lastTab = localStorage.getItem('activeTab');
        if (lastTab && document.getElementById(lastTab)) {
            showSection(lastTab);
        } else {
            if(currentUser.role === 'client') showSection('orders-view'); 
            else showSection('orders-view'); 
        }

    } catch (error) {
        console.error("Erro ao iniciar dashboard:", error);
    }
}

// --- CONFIGURAÇÃO DE PREÇO (AGORA ASSÍNCRONA) ---
async function loadPrice() {
    try {
        const res = await fetch('/api/config/price');
        const data = await res.json();
        
        // Atualiza a variável global
        globalPricePerKg = parseFloat(data.price) || 0;
        
        // Atualiza input se existir
        const input = document.getElementById('price-input');
        if(input) input.value = globalPricePerKg;
        
        // Se a aba de Box estiver aberta, recarrega para atualizar valores
        const boxSection = document.getElementById('box-view');
        if(boxSection && !boxSection.classList.contains('hidden')) {
            loadBoxes();
        }
        console.log("Preço carregado:", globalPricePerKg);
    } catch (e) {
        console.error("Erro ao carregar preço:", e);
    }
}

function savePrice() {
    const price = parseFloat(document.getElementById('price-input').value);
    if (isNaN(price)) return alert("Digite um valor válido");

    fetch('/api/config/price', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ price: price })
    })
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            alert("Preço atualizado com sucesso!");
            loadPrice(); 
        } else {
            alert("Erro ao salvar.");
        }
    });
}

// --- SISTEMA DE ENCOMENDAS E CAIXAS INTELIGENTE (TURBINADO) ---
let boxLimit = 50; // Quantas caixas mostrar por vez

async function loadBoxes() {
    try {
        const res = await fetch('/api/boxes');
        let list = await res.json(); 
        const tbody = document.getElementById('box-table-body');
        const summaryContainer = document.getElementById('box-summary-container');
        const toggleBtn = document.getElementById('toggle-boxes');
        const showCompleted = toggleBtn ? toggleBtn.checked : false;
        
        // 🧠 CÉREBRO DO FILTRO DE LOTES 🧠
        const filterSelect = document.getElementById('filter-box-lote');
        
        let loteSelecionado = filterSelect ? filterSelect.value : 'Todos';
        
        // Se for o cliente logado, ele puxa o lote do Seletor Mestre do Painel VIP
        if (currentUser.role === 'client') {
            const mainFilter = document.getElementById('main-shipment-filter');
            if (mainFilter) {
                loteSelecionado = mainFilter.value !== '' ? mainFilter.value : 'Todos';
            }
        }

        // Aprende quais lotes existem e cria os botões do filtro
        if (filterSelect) {
            const lotesUnicos = [...new Set(list.map(b => b.lote || 'Sem Lote'))];
            let htmlFiltro = '<option value="Todos">📦 Todos os Envios</option>';
            lotesUnicos.sort().forEach(l => htmlFiltro += `<option value="${l}">✈️ ${l}</option>`);
            filterSelect.innerHTML = htmlFiltro;
            if (lotesUnicos.includes(loteSelecionado) || loteSelecionado === 'Todos') filterSelect.value = loteSelecionado;
        }

        // Filtra a lista inteira baseada no Lote escolhido
        if (loteSelecionado !== 'Todos') {
            list = list.filter(b => (b.lote || 'Sem Lote') === loteSelecionado);
        }
        
        if(!tbody) return;
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Carregando caixas...</td></tr>';
        if(summaryContainer) summaryContainer.innerHTML = '';

        // 1. FAZ A MATEMÁTICA COM TODAS AS CAIXAS (SEPARANDO POR LOTE E BOX)
        const boxTotals = {};
        list.forEach(b => {
            const status = b.status || b.order_status || '';
            if ((status === 'Entregue' || status === 'Pago') && currentUser.role !== 'client' && !showCompleted) return;
            
            const code = b.box_code || 'SEM-BOX';
            if (code === 'SEM-BOX') return;

            const lote = b.lote || 'Sem Lote';
            const weight = parseFloat(b.order_weight) || 0;
            
            // Cria uma chave única: "1º Envio - BOX-001"
            const chaveUnica = `${lote} | ${code}`;

            if (!boxTotals[chaveUnica]) {
                boxTotals[chaveUnica] = { lote: lote, code: code, peso: 0 };
            }
            boxTotals[chaveUnica].peso += weight; 
        });

        // 2. CRIA OS CARTÕES DE RESUMO
        if (summaryContainer && Object.keys(boxTotals).length > 0) {
            let cardsHTML = '';
            // Agora ele usa a chave única para não misturar envios diferentes
            for (const [chave, dados] of Object.entries(boxTotals)) {
                cardsHTML += `
                    <div style="background: #f4f9ff; border-left: 4px solid #00b1ea; padding: 10px 15px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); min-width: 150px; flex: 1;">
                        <span style="font-size: 11px; color: #555; text-transform: uppercase;">📦 ${dados.lote}</span> <br>
                        <strong style="font-size: 18px; color: #0a1931;">${dados.code}</strong><br>
                        <span style="font-size: 11px; color: #555;">Peso Total:</span> 
                        <strong style="font-size: 16px; color: #d4af37;">${dados.peso.toFixed(2)} KG</strong>
                    </div>
                `;
            }
            summaryContainer.innerHTML = cardsHTML;
        }

        // Ordena a lista
        list.sort((a, b) => (a.box_code || '').localeCompare((b.box_code || ''), undefined, {numeric: true, sensitivity: 'base'}));

        // 3. A MÁGICA DA VELOCIDADE
        let htmlBuffer = '';
        let itensRenderizados = 0;
        let totalValidos = 0; 

        for (let i = 0; i < list.length; i++) {
            const b = list[i];
            const status = b.status || b.order_status || '';
            
            if ((status === 'Entregue' || status === 'Pago') && currentUser.role !== 'client' && !showCompleted) continue;

            totalValidos++;
            if (itensRenderizados >= boxLimit) continue; 

            const individualWeight = parseFloat(b.order_weight) || 0;
            const freightValue = individualWeight * globalPricePerKg;
            const nfValue = parseFloat(b.nf_amount) || 0;
            const finalTotal = parseFloat(b.amount) || (freightValue + nfValue);
            const isAdmin = currentUser.role !== 'client';

            let act = '-';
            if (isAdmin) {
                act = `
                 <button onclick="printSimpleBoxLabel('${b.box_code}')" style="color:white; background:#ff9800; border:none; padding:5px 10px; cursor:pointer; border-radius:3px; margin-right:5px;" title="Imprimir Etiqueta da Caixa">
                    <i class="fas fa-tag"></i> Etiqueta para Caixa
                 </button>
                 <button onclick="deleteBox(${b.id})" style="color:white; background:red; border:none; padding:5px 10px; cursor:pointer; border-radius:3px;">Excluir</button>`;
            } else {
                const textoBtn = b.receiver_name ? `✅ Destinatario: ${b.receiver_name.split(' ')[0]}` : '👤 Informar Destinatario';
                const corBtn = b.receiver_name ? '#28a745' : '#f1c40f';
                const corTexto = b.receiver_name ? '#fff' : '#000';
                
                // 🔴 A MÁGICA DO PULSO: Se não tiver nome, adiciona a classe que pulsa! Se já tiver, fica vazio.
                const classePulse = b.receiver_name ? '' : 'pulse-action';

                act = `<button class="${classePulse}" onclick="openReceiverModal(${b.id}, '${b.receiver_name || ''}', '${b.receiver_doc || ''}')" 
                        style="background:${corBtn}; color:${corTexto}; border:none; padding:5px 10px; cursor:pointer; border-radius:4px; font-weight:bold; font-size:12px;">
                        ${textoBtn}
                       </button>`;
            }

            const clientCell = isAdmin ? `<td>${b.client_name || '-'}</td>` : `<td style="display:none;">${b.client_name || '-'}</td>`;

            htmlBuffer += `
            <tr>
                <td style="font-weight:bold; color:#0a1931; font-size:16px;">📦 ${b.box_code}</td>
                ${clientCell}
                <td>${b.order_code || '-'}</td>
                <td>${individualWeight} Kg</td>
                <td style="font-weight:bold; color:green;">R$ ${finalTotal.toFixed(2)}</td> 
                <td>${b.products || '-'}</td>
                <td>${act}</td>
            </tr>`; 
            itensRenderizados++;
        }
        
        if (totalValidos > boxLimit) {
            htmlBuffer += `
            <tr>
                <td colspan="7" style="text-align:center; padding: 20px;">
                    <button onclick="loadMoreBoxes()" style="background:#00b1ea; color:white; border:none; padding:10px 20px; border-radius:5px; cursor:pointer; font-weight:bold; width: 100%; max-width: 300px;">
                        <i class="fas fa-chevron-down"></i> Mostrar mais caixas antigas...
                    </button>
                </td>
            </tr>`;
        }

        tbody.innerHTML = htmlBuffer;
        if(typeof makeTablesResponsive === 'function') makeTablesResponsive();
        
        // (Isso fica no finalzinho da loadBoxes no script.js)
        if (currentUser.role === 'client') {
            populateClientMainFilter();
            updateSmartGreeting(); 
        }

    } catch (e) {
        console.error("Erro ao carregar boxes:", e);
    }
}

// Função auxiliar para o botão "Carregar Mais"
function loadMoreBoxes() {
    boxLimit += 50; // Aumenta o limite em mais 50
    loadBoxes(); // Recarrega a tabela com o novo limite
}

// Resetar o limite quando o botão de filtro mudar (opcional, mas recomendado)
document.getElementById('toggle-boxes')?.addEventListener('change', () => {
    boxLimit = 50; // Volta o limite para 50 ao mudar o filtro
    loadBoxes();
});
// ==========================================
// FUNÇÃO CRIAR ENCOMENDA (AGORA COM LOTES/ENVIOS 📦✈️)
// ==========================================
async function createOrder() {
    // 1. Pega os dados do formulário
    const clientSelect = document.getElementById('order-client-select');
    const clientId = clientSelect.value;
    const code = document.getElementById('order-code').value;
    const desc = document.getElementById('order-desc').value;
    const weight = document.getElementById('order-weight').value;
    const status = document.getElementById('order-status').value;
    
    // PEGANDO O LOTE (1º Envio, 2º Envio, etc)
    const loteSelect = document.getElementById('order-lote');
    const lote = loteSelect ? loteSelect.value : 'Sem Lote';

    // 2. Validação simples
    if (!clientId || !code || !weight) {
        return alert("Preencha Cliente, Código e Peso!");
    }

    // --- A TRAVA DE SEGURANÇA! ---
    // Pega o texto da opção que foi selecionada para checar se tem o símbolo de alerta
    const clienteTexto = clientSelect.options[clientSelect.selectedIndex].text;
    if (clienteTexto.includes('⚠️')) {
        const confirmar = confirm("⚠️ ATENÇÃO: Este cliente já possui uma encomenda ativa na Guineexpress! Tem certeza absoluta de que deseja criar mais uma?");
        if (!confirmar) return; // Se o admin clicar em "Cancelar", a função para aqui!
    }
    // ----------------------------------------

    const data = {
        client_id: clientId,
        code: code,
        description: desc,
        weight: weight,
        status: status,
        lote: lote // <-- MÁGICA: O LOTE AGORA VAI PARA O SERVIDOR!
    };

    try {
        // 3. Envia para o servidor
        const res = await fetch('/api/orders/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const json = await res.json();

        if (json.success) {
            alert("✅ Encomenda criada com sucesso no " + lote + "!");
            
            // 4. Limpa e fecha
            document.getElementById('new-order-form').reset();
            // Limpa o campo de busca que criamos
            if(document.getElementById('order-client-search')) document.getElementById('order-client-search').value = '';
            
            closeModal('modal-order');
            
            // 5. Atualiza a lista na tela (clientes e encomendas)
            loadOrders();
            loadClients(); // Chama de novo para atualizar as tags ⚠️
        } else {
            alert("Erro ao criar: " + (json.msg || "Verifique se o código já existe."));
        }
    } catch (error) {
        console.error(error);
        alert("Erro de conexão com o servidor.");
    }
}
// ========================================================
// ✅ SELECIONAR TODAS AS ENCOMENDAS (MÓVEL & DESKTOP)
// ========================================================
window.estadoSelecaoEncomendas = false;

function alternarSelecaoEncomendas(checkboxClicado) {
    // Se o clique veio da caixinha do cabeçalho, segue o que ela ditar
    if (checkboxClicado && checkboxClicado.type === 'checkbox') {
        window.estadoSelecaoEncomendas = checkboxClicado.checked;
    } else {
        // Se veio do botão azul grande, inverte o estado atual
        window.estadoSelecaoEncomendas = !window.estadoSelecaoEncomendas;
    }

    // Procura e marca/desmarca todas as caixinhas geradas dentro da tabela de encomendas
    const caixasNaTabela = document.querySelectorAll('#orders-list input[type="checkbox"]');
    caixasNaTabela.forEach(caixa => {
        caixa.checked = window.estadoSelecaoEncomendas;
    });

    // Mantém a caixinha master do cabeçalho em perfeita sincronia
    const chkMaster = document.getElementById('selectAllOrders');
    if (chkMaster) {
        chkMaster.checked = window.estadoSelecaoEncomendas;
    }
}

// Substitui ou garante o funcionamento da função chamada no clique do cabeçalho original
function toggleAllOrderCheckboxes(elemento) {
    alternarSelecaoEncomendas(elemento);
}
async function createBox(e) {
    if(e) e.preventDefault();

    // 1. Captura os ELEMENTOS primeiro (para verificar se existem)
    const clientEl = document.getElementById('box-client-select');
    const orderEl = document.getElementById('box-order-select');
    const codeEl = document.getElementById('box-code');
    const prodEl = document.getElementById('box-products');
    const amountEl = document.getElementById('box-amount'); // <--- Esse pode ser null no painel de funcionário
    
    // PEGANDO O NOVO CAMPO DE LOTE 📦✈️
    const loteEl = document.getElementById('box-lote');

    // Se por acaso o HTML não carregou direito, evita erro
    if(!clientEl || !codeEl) {
        return alert("Erro de interface: Campos obrigatórios não encontrados.");
    }

    // 2. Pega os valores com segurança
    const clientVal = clientEl.value;
    const codeVal = codeEl.value.trim().toUpperCase();
    const orderVal = orderEl ? orderEl.value : ""; // Se não existir, vazio
    const prodVal = prodEl ? prodEl.value : "";   // Se não existir, vazio
    
    // Se o campo de valor (amountEl) existir, pega o valor. Se não existir (funcionário), usa 0.
    const amountVal = amountEl ? amountEl.value : 0; 

    // Se o campo Lote existir, pega o valor, senão usa 'Sem Lote'
    const loteVal = loteEl && loteEl.value.trim() !== "" ? loteEl.value.trim() : "Sem Lote";

    if(!clientVal || !codeVal) {
        return alert("Erro: O Cliente e o Número do Box são obrigatórios.");
    }

    const d = {
        client_id: clientVal,
        order_id: orderVal === "" ? null : orderVal, 
        box_code: codeVal,
        products: prodVal,
        amount: amountVal === "" ? 0 : amountVal,
        lote: loteVal // <--- MÁGICA: O LOTE AGORA VIAJA PARA O BANCO DE DADOS!
    };

    try {
        const res = await fetch('/api/boxes/create', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(d)
        });
        
        const json = await res.json();

        if(json.success) {
            closeModal('modal-box'); 
            
            // Reseta o formulário
            const form = document.getElementById('new-box-form');
            if(form) form.reset();
            
            loadBoxes(); // O filtro inteligente que fizemos antes vai rodar aqui!
            alert("✅ Box criado com sucesso no " + loteVal + "!");
        } else {
            console.error("Erro servidor:", json);
            const msg = json.err ? json.err.message : (json.msg || "Erro desconhecido");
            
            if (msg.includes("FOREIGN KEY")) {
                alert("Erro: O Cliente selecionado não confere.");
            } else if (msg.includes("UNIQUE")) {
                alert("Erro: Já existe um Box com este código.");
            } else {
                alert("❌ Erro ao salvar: " + msg);
            }
        }
    } catch (err) {
        console.error(err);
        alert("Erro de conexão com o sistema.");
    }
}
async function deleteBox(id) {
    if(confirm('Apagar esta caixa?')) {
        await fetch('/api/boxes/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
        loadBoxes();
    }
}
// ============================================================
// PUXAR LOTES NO AGENDAMENTO (CÉREBRO INTELIGENTE 🧠)
// ============================================================
async function loadScheduleLots() {
    const select = document.getElementById('sched-lote');
    if (!select) return;
    
    // Mostra que está carregando para você saber que o clique funcionou
    select.innerHTML = '<option value="">Buscando Envios... ⏳</option>';
    
    try {
        // 1. Puxa todas as caixas, igualzinho faz nos recibos!
        const response = await fetch('/api/boxes');
        const boxes = await response.json();
        
        // 2. Aprende quais lotes existem (ignorando os vazios)
        const todosOsLotes = boxes.map(b => b.lote).filter(l => l && l.trim() !== '');
        const lotesUnicos = [...new Set(todosOsLotes)];
        
        // 3. Monta as opções bonitinhas
        let html = '<option value="">📦 Selecione o Envio/Lote</option>';
        
        lotesUnicos.sort().forEach(lote => {
            html += `<option value="${lote}">✈️ ${lote}</option>`;
        });

        // 4. Se não achar nada, avisa
        if(lotesUnicos.length === 0) {
            html += '<option value="" disabled>Nenhum envio encontrado nas caixas</option>';
        }
        
        // 5. Joga tudo na tela
        select.innerHTML = html;
        
    } catch (e) {
        console.error("Erro ao carregar lotes do agendamento:", e);
        select.innerHTML = '<option value="">Erro ao carregar lotes</option>';
    }
}
// FUNÇÃO ATUALIZADA: Criar Vaga com Intervalo de Datas
async function createAvailability(e) {
    e.preventDefault();
    
    const loteValue = document.getElementById('sched-lote').value;
    
    // Trava de segurança: obriga a escolher o envio!
    if (!loteValue) {
        alert('⚠️ ATENÇÃO: Você precisa selecionar um Envio/Lote antes de criar as vagas!');
        return;
    }

    const data = {
        start_date: document.getElementById('sched-start-date').value,
        end_date: document.getElementById('sched-end-date').value, // 🚀 NOVA DATA
        start_time: document.getElementById('sched-start').value,
        end_time: document.getElementById('sched-end').value,
        max_slots: document.getElementById('sched-slots').value,
        lote: loteValue 
    };

    // Trava: a data inicial não pode ser maior que a final
    if (data.start_date > data.end_date) {
        alert("⚠️ A Data de Início não pode ser maior que a Data Final!");
        return;
    }

    const res = await fetch('/api/schedule/create-availability', { 
        method: 'POST', 
        headers: {'Content-Type':'application/json'}, 
        body: JSON.stringify(data)
    });

    const json = await res.json();
    if(json.success) { 
        alert(`✅ Vagas liberadas para o ${loteValue}! Os clientes deste envio foram notificados.`); 
        loadSchedules(); 
    } else {
        alert('Erro ao criar vagas: ' + (json.msg || ''));
    }
}

// 3. FUNÇÃO ATUALIZADA: Carregar as agendas (Acorda a lista de lotes e quebra o Cache!)
async function loadSchedules() {
    loadScheduleLots();

    // 🚀 MÁGICA 1: Engana o navegador colocando a hora exata no link, obrigando ele a buscar dados frescos!
    const tempoAgora = new Date().getTime();
    const resSlots = await fetch(`/api/schedule/slots-15min?t=${tempoAgora}`, { cache: 'no-store' });
    const responseSlots = await resSlots.json();
    
    const isBloqueado = responseSlots.status === "bloqueado";
    const slots15min = responseSlots.data || [];

    const resAppoint = await fetch(`/api/schedule/appointments?t=${tempoAgora}`, { cache: 'no-store' });
    const appointments = await resAppoint.json();

    if(currentUser.role !== 'client') {
        renderAdminSchedule(appointments);
        renderAdminAvailabilities();
        return;
    }

    const container = document.getElementById('available-slots-container');
    if(container) {
        container.innerHTML = '';

        if (isBloqueado) {
            container.innerHTML = `
                <div style="text-align:center; padding: 40px 20px; background: #fff3cd; color: #856404; border-radius: 8px; border: 1px solid #ffeeba;">
                    <i class="fas fa-lock" style="font-size: 40px; margin-bottom: 15px;"></i>
                    <h3 style="margin:0 0 10px 0;">Agenda Bloqueada</h3>
                    <p style="margin:0;">Para liberar o agendamento de recolha ou entrega, é necessário ter pelo menos uma fatura <strong>Paga</strong> de um envio com vagas abertas.</p>
                </div>
            `;
        } else {
            const bookedDates = appointments.filter(app => app.status !== 'Cancelado').map(app => app.date);
            const groups = {};
            slots15min.forEach(slot => { if(!groups[slot.date]) groups[slot.date] = []; groups[slot.date].push(slot); });

            if(Object.keys(groups).length === 0) container.innerHTML = '<p style="text-align:center; color:#666;">Sem horários disponíveis no momento.</p>';

            for (const [date, slots] of Object.entries(groups)) {
                const alreadyBookedThisDay = bookedDates.includes(date);
                const dateObj = new Date(date + 'T00:00:00');
                const dateStr = dateObj.toLocaleDateString('pt-BR', {weekday: 'long', day: 'numeric', month: 'long'});
                
                let html = `<div class="schedule-group" style="margin-bottom: 25px;">
                    <h4 style="border-bottom: 2px solid #0a1931; color: #0a1931; padding-bottom: 5px; margin-bottom: 10px; text-transform: capitalize;">
                        📅 ${dateStr} ${alreadyBookedThisDay ? '<span style="font-size:12px; color:red;">(Já agendado)</span>' : ''}
                    </h4>
                    <div style="display: flex; flex-wrap: wrap; gap: 10px;">`;

                let temVagaNesseDia = false; // 🚀 MÁGICA 2: Verifica se sobrou algo no dia

                slots.forEach(slot => {
                    const isFull = slot.available <= 0;
                    const isBlocked = isFull || alreadyBookedThisDay;
                    
                    // Só desenha o botão de hora se a vaga NÃO estiver cheia
                    if (!isFull) {
                        temVagaNesseDia = true;
                        let style = `border: 1px solid ${isBlocked?'#ccc':'#28a745'}; background: ${isBlocked?'#eee':'#fff'}; color: ${isBlocked?'#999':'#28a745'}; padding: 8px 15px; border-radius: 5px; cursor: ${isBlocked?'not-allowed':'pointer'}; font-weight:bold; min-width: 80px; text-align:center;`;
                        
                        html += `<div onclick="${isBlocked ? '' : `bookSlot(${slot.availability_id}, '${slot.date}', '${slot.time}')`}" style="${style}">
                            ${slot.time}
                        </div>`;
                    }
                });
                
                html += `</div></div>`;
                
                // Se ainda sobrou algum botão de horário nesse dia, ele exibe o dia na tela
                if (temVagaNesseDia) {
                    container.innerHTML += html;
                }
            }
        }
    }

    const tbody = document.getElementById('client-schedule-list');
    if(tbody) {
        tbody.innerHTML = '';
        appointments.forEach(app => {
            const canCancel = app.status !== 'Cancelado' && app.status !== 'Recusado';
            const btn = canCancel ? `<button onclick="cancelBooking(${app.id})" style="color:red; border:1px solid red; background:white; padding:2px 5px; cursor:pointer;">Cancelar</button>` : '-';
            tbody.innerHTML += `<tr><td>${formatDate(app.date)}</td><td>${app.time_slot}</td><td>${app.status}</td><td>${btn}</td></tr>`;
        });
    }
}

async function bookSlot(availId, date, time) {
    if(!confirm(`Confirmar agendamento dia ${formatDate(date)} às ${time}?`)) return;
    
    const res = await fetch('/api/schedule/book', { 
        method: 'POST', 
        headers: {'Content-Type':'application/json'}, 
        body: JSON.stringify({ availability_id: availId, date: date, time: time }) 
    });
    const json = await res.json();
    
    if(json.success) { 
        alert('✅ Sucesso! Seu horário está garantido.'); 
    } else {
        alert('❌ Ops: ' + json.msg);
    }
    
    // 🚀 MÁGICA 3: Se deu erro ou sucesso, forçamos a tela a se atualizar!
    // Assim, se o cliente clicou num "fantasma", a tela pisca e o fantasma some.
    loadSchedules();
}

// Funções Administrativas de Agenda
async function renderAdminAvailabilities() {
    const res = await fetch('/api/schedule/availability');
    const list = await res.json();
    const tbody = document.getElementById('admin-availability-list');
    if(!tbody) return;
    tbody.innerHTML = '';
    list.forEach(item => {
        tbody.innerHTML += `<tr><td>${formatDate(item.date)}</td><td>${item.start_time}</td><td>${item.end_time}</td><td>${item.max_slots}</td><td><button onclick="deleteAvailability(${item.id})" style="color:white; background:red; border:none; padding:5px; cursor:pointer;">Excluir</button></td></tr>`;
    });
}

async function deleteAvailability(id) {
    if(!confirm('Isso excluirá todos os agendamentos deste dia. Continuar?')) return;
    await fetch('/api/schedule/delete-availability', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({id}) });
    renderAdminAvailabilities();
}

function renderAdminSchedule(appointments) {
    const tbody = document.getElementById('admin-schedule-list');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    // 1. Ordenar por data e hora para garantir que a lista faça sentido
    const sorted = [...appointments].sort((a, b) => {
        return a.date.localeCompare(b.date) || a.time_slot.localeCompare(b.time_slot);
    });

    let lastDate = ""; // Variável para controlar quando a data muda

    sorted.forEach(app => {
        // 2. Se a data mudou, cria uma linha de separação bonitinha
        if (app.date !== lastDate) {
            const dataFormatada = new Date(app.date + 'T00:00:00').toLocaleDateString('pt-BR', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
            });

            tbody.innerHTML += `
                <tr style="background-color: #f0f4f8;">
                    <td colspan="5" style="text-align: center; font-weight: bold; color: #0a1931; padding: 15px 0; text-transform: capitalize;">
                        📅 ${dataFormatada}
                    </td>
                </tr>
            `;
            lastDate = app.date;
        }

        // 3. Lógica das cores dos status (mantida do seu código)
        let badgeClass = 'bg-success'; 
        if (app.status === 'Pendente') badgeClass = 'bg-warning'; 
        if (app.status === 'Recusado' || app.status === 'Cancelado') badgeClass = 'bg-danger';

        // 4. Desenha a linha do cliente
        tbody.innerHTML += `
            <tr style="border-bottom: 1px solid #eee;">
                <td data-label="Data" style="color: #666; font-size: 12px;">${formatDate(app.date)}</td>
                <td data-label="Horário" style="font-weight: bold; color: #0a1931;">${app.time_slot}</td>
                <td data-label="Cliente" style="font-weight: bold;">${app.client_name}</td>
                <td data-label="Tel">${app.client_phone || '-'}</td>
                <td data-label="Status">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="badge ${badgeClass}">${app.status}</span>
                        <button onclick="deleteAppointmentRecord(${app.id})" style="color:red; background:none; border:none; cursor:pointer; font-size:16px;" title="Apagar Histórico">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
}
async function deleteAppointmentRecord(id) {
    if(!confirm("Tem certeza que deseja apagar este registro do histórico permanentemente?")) return;
    
    try {
        const res = await fetch(`/api/schedule/delete-appointment/${id}`, { method: 'DELETE' });
        const json = await res.json();
        if(json.success) {
            loadSchedules(); // recarrega a tabela
        } else {
            alert("Erro ao excluir registro.");
        }
    } catch(e) {
        alert("Erro de conexão ao excluir.");
    }
}
async function updateScheduleStatus(id, newStatus) {
    if(!confirm(`Alterar para ${newStatus}?`)) return;
    await fetch('/api/schedule/status', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ id: id, status: newStatus }) });
    loadSchedules();
}

async function cancelBooking(id) {
    if(!confirm('Deseja cancelar?')) return;
    await fetch('/api/schedule/cancel', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ id: id }) });
    loadSchedules();
}

// --- FUNÇÕES AUXILIARES ---
function formatDate(dateStr) { if(!dateStr) return ''; const [y, m, d] = dateStr.split('-'); return `${d}/${m}/${y}`; }
// Função atualizada para o novo design Dark/Gold
function setRole(role) {
    currentRole = role;

    // 1. Seleciona todos os botões dentro do seletor de cargos
    const buttons = document.querySelectorAll('#role-selector button');

    // 2. Reseta TODOS os botões para o estado inativo (Cinza)
    buttons.forEach(b => {
        b.style.background = '#eee';
        b.style.color = '#333';
        b.classList.remove('btn-primary'); 
        b.classList.add('btn'); 
    });

    // 3. Ativa o estilo apenas no botão do cargo selecionado (Azul/Gold)
    const activeBtn = document.getElementById(`btn-${role}`);
    if(activeBtn) {
        activeBtn.style.background = '#0a1931'; // Azul do seu tema
        activeBtn.style.color = '#fff';         // Texto branco
    }

    // 4. Lógica de visibilidade dos links (Esqueci senha / Cadastro)
    const linksContainer = document.getElementById('client-links');
    if (linksContainer) {
        if (role !== 'client') {
            linksContainer.classList.add('hidden');
        } else {
            linksContainer.classList.remove('hidden');
        }
    } else {
        const r = document.getElementById('register-link');
        const f = document.getElementById('forgot-pass');
        if (role !== 'client') {
            if(r) r.style.display = 'none'; 
            if(f) f.style.display = 'none';
        } else {
            if(r) r.style.display = 'block'; 
            if(f) f.style.display = 'block';
        }
    }

    // 5. --- NOVA LÓGICA: OCULTAR BIOMETRIA PARA ADMIN/EMPLOYEE ---
    const btnBio = document.getElementById('btn-biometria-login');
    if (btnBio) {
        if (role !== 'client') {
            // Se for Admin ou Funcionário, o botão desaparece completamente
            btnBio.style.display = 'none';
        } else {
            // Se for Cliente, o botão volta a aparecer (formato flex para ícone+texto)
            btnBio.style.display = 'flex';
        }
    }
}
// No arquivo script.js

function showRegister() {
    // Esconde Login, Mostra Cadastro
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
    
    // --- SEGURANÇA VISUAL ---
    // Esconde os botões de Funcionário e Admin
    document.getElementById('btn-employee').style.display = 'none';
    document.getElementById('btn-admin').style.display = 'none';

    // Força a seleção ser "Cliente" automaticamente
    setRole('client');

    updateMasks();
}

function showLogin() {
    // Esconde Cadastro, Mostra Login
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');

    // Mostra os botões novamente (para o staff poder logar)
    document.getElementById('btn-employee').style.display = 'inline-block';
    document.getElementById('btn-admin').style.display = 'inline-block';

    // === CORREÇÃO DA BANDEIRA FANTASMA ===
    // Pega o cartão de login
    const loginCard = document.querySelector('.login-card');
    if (loginCard) {
        // Remove TODAS as classes de bandeira que possam estar presas lá
        loginCard.classList.remove(
            'bg-flag-GW', 'bg-flag-BR', 'bg-flag-PT', 'bg-flag-SN', 
            'bg-flag-US', 'bg-flag-FR', 'bg-flag-ES', 'bg-flag-MA', 
            'bg-flag-UK', 'bg-flag-CV'
        );
    }
}
// A LINHA DO ERRO ESTAVA AQUI (updateMasks duplicada) - FOI REMOVIDA
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function logout() { fetch('/api/logout'); window.location.href = 'index.html'; }

// ==========================================
// MÓDULO: GESTÃO DE CLIENTES PELO ADMIN
// ==========================================

// Variáveis para as máscaras do formulário de Admin
let adminPhoneMaskInstance = null;
let adminDocMaskInstance = null;

// Função para aplicar as máscaras de acordo com o país (igual ao login, mas pro Modal Admin)
function updateAdminMasks() {
    const country = document.getElementById('admin-reg-country').value;
    const phoneInput = document.getElementById('admin-reg-phone');
    const docInput = document.getElementById('admin-reg-doc');

    if (adminPhoneMaskInstance) { adminPhoneMaskInstance.destroy(); adminPhoneMaskInstance = null; }
    if (adminDocMaskInstance) { adminDocMaskInstance.destroy(); adminDocMaskInstance = null; }
    phoneInput.value = '';
    docInput.value = '';

    if (country === 'BR') {
        adminPhoneMaskInstance = IMask(phoneInput, { mask: '+55 (00) 00000-0000' });
        adminDocMaskInstance = IMask(docInput, { mask: '000.000.000-00' });
        docInput.placeholder = "CPF do Cliente";
    } else if (country === 'PT') {
        adminPhoneMaskInstance = IMask(phoneInput, { mask: '+351 000 000 000' });
        adminDocMaskInstance = IMask(docInput, { mask: '000000000' }); 
        docInput.placeholder = "NIF de Portugal";
    } else if (country === 'GW') {
        adminPhoneMaskInstance = IMask(phoneInput, { mask: '+245 000000000' });
        docInput.placeholder = "Nº de Identificação / Passaporte";
    } else {
        docInput.placeholder = "Documento Oficial";
    }
}

// Envia o formulário do Modal para a ROTA DE REGISTRO ORIGINAL
async function adminRegisterClient(e) {
    e.preventDefault();

    const country = document.getElementById('admin-reg-country').value;
    const name = document.getElementById('admin-reg-name').value.trim();
    const email = document.getElementById('admin-reg-email').value.trim();
    const pass = document.getElementById('admin-reg-pass').value;
    const docInput = document.getElementById('admin-reg-doc').value.trim();
    
    // Tratamento de telefone e documento igual ao login publico
    const finalPhone = adminPhoneMaskInstance ? adminPhoneMaskInstance.unmaskedValue : document.getElementById('admin-reg-phone').value;
    
    let finalDoc = docInput;
    if (country === 'BR') {
        finalDoc = adminDocMaskInstance ? adminDocMaskInstance.unmaskedValue : docInput.replace(/\D/g, '');
    }

    if (!finalPhone || finalPhone.length < 8) return alert('❌ Telefone incompleto ou inválido!');
    if (pass.length < 6) return alert('❌ A senha deve ter no mínimo 6 caracteres.');

    const formData = {
        name: name,
        email: email,
        phone: finalPhone, 
        country: country,
        document: country === 'BR' ? finalDoc : finalDoc.toUpperCase(),
        password: pass,
        // Mandamos uma flag para a API saber que foi o Admin quem criou, 
        // assim não precisa fazer auto-login.
        createdByAdmin: true 
    };

    const btn = document.getElementById('btn-admin-save-client');
    const oldText = btn.innerText;
    btn.innerText = "Salvando...";
    btn.disabled = true;

    try {
        // Aproveitamos a mesma rota de registro que você já tem pronta!
        const res = await fetch('/api/register', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(formData)
        });
        
        const data = await res.json();
        
        if(data.success) { 
            alert(`✅ Cliente ${name} cadastrado com sucesso!`); 
            closeModal('modal-new-client-admin');
            document.getElementById('admin-register-client-form').reset();
            loadClients(); // Recarrega a tabela imediatamente
        } else { 
            alert('Erro ao cadastrar: ' + data.msg); 
        }
    } catch (error) {
        console.error(error);
        alert("Erro de conexão ao salvar o cliente.");
    } finally {
        btn.innerText = oldText;
        btn.disabled = false;
    }
}

// Função para o Admin Forçar o Reset de Senha por dentro do sistema
async function adminResetClientPassword(clientId, clientName) {
    const novaSenha = prompt(`🔒 DEFINIR NOVA SENHA\n\nDigite a nova senha para o cliente ${clientName}:\n(Mínimo de 6 caracteres)`);
    
    if (!novaSenha) return; // Cancelou
    if (novaSenha.length < 6) return alert("❌ A senha deve ter no mínimo 6 caracteres.");

    if (!confirm(`Confirma a alteração da senha do cliente ${clientName} para: ${novaSenha} ?\nO cliente precisará usar esta nova senha para entrar.`)) return;

    try {
        const res = await fetch('/api/admin-reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: clientId, newPassword: novaSenha })
        });

        const data = await res.json();

        if (data.success) {
            alert(`✅ Senha do cliente ${clientName} alterada com sucesso!`);
        } else {
            alert(`❌ Erro: ${data.msg}`);
        }
    } catch (error) {
        console.error(error);
        alert("Erro ao comunicar com o servidor.");
    }
}

// ==========================================
// FUNÇÃO AUXILIAR PARA PEGAR INICIAIS 
// ==========================================
function pegarIniciais(nomeCompleto) {
    if (!nomeCompleto) return "U";
    const partes = nomeCompleto.trim().split(" ");
    if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
    return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
}

// ==========================================
// ATUALIZAÇÃO DA FUNÇÃO LOAD CLIENTS (OTIMIZADA 🚀)
// ==========================================
let clientsLimit = 50; // Variável global de limite

async function loadClients() { 
    try {
        const tbody = document.getElementById('clients-list'); 
        if(tbody) tbody.innerHTML = '<tr><td colspan="8" align="center">Carregando clientes...</td></tr>';

        const res = await fetch('/api/clients'); 
        const list = await res.json(); 
        
        let clientesComEncomenda = [];
        try {
            const resOrd = await fetch('/api/orders');
            const ordList = await resOrd.json();
            clientesComEncomenda = ordList.filter(o => o.status !== 'Entregue').map(o => String(o.client_id));
        } catch(e) { console.warn("Aviso: Não foi possível checar encomendas ativas."); }

        // Popula os selects (isso aqui é rápido e pode fazer todos)
        const selects = [
            document.getElementById('order-client-select'),
            document.getElementById('box-client-select')
        ];

        let selectOptionsHtml = '<option value="">Selecione o Cliente...</option>';
        list.forEach(c => {
            if(c.name) {
                let aviso = clientesComEncomenda.includes(String(c.id)) ? ' ⚠️ [JÁ TEM ENCOMENDA]' : '';
                selectOptionsHtml += `<option value="${c.id}">${c.name}${aviso} | ${c.email || 'Sem email'}</option>`; 
            }
        });

        selects.forEach(sel => {
            if(sel) sel.innerHTML = selectOptionsHtml;
        });

        // Agora sim, monta a Tabela de Clientes com o Buffer
        if(tbody) {
            let htmlBuffer = '';
            let renderizados = 0;
            let totalValidos = 0;

            for (let i = 0; i < list.length; i++) {
                const c = list[i];
                if(!c.name) continue; 
                
                totalValidos++;

                if (renderizados >= clientsLimit) continue; // Trava de segurança 

                let actionBtn = '';
                if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'employee')) {
                    const btnColor = c.active ? '#dc3545' : '#28a745';
                    const btnText = c.active ? 'Desativar' : 'Ativar';
                    const toggleBtn = `<button onclick="toggleClient(${c.id},${c.active?0:1})" style="color:white; background:${btnColor}; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;" title="${btnText} Cliente">${btnText}</button>`;
                    
                    const resetBtn = `<button onclick="adminResetClientPassword(${c.id}, '${c.name.replace(/'/g, "\\'")}')" style="color:white; background:#ff9800; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;" title="Redefinir Senha do Cliente"><i class="fas fa-key"></i></button>`;
                    
                    let deleteBtn = '';
                    if (currentUser.role === 'admin') {
                        deleteBtn = `<button onclick="excluirCliente(${c.id}, '${c.name.replace(/'/g, "\\'")}')" class="btn" style="background-color: #dc3545; color: white; padding: 5px 10px; border-radius: 4px; border: none; cursor: pointer; font-size: 13px; font-weight: bold;" title="Excluir Cliente Permanentemente">
                                        <i class="fas fa-trash"></i>
                                     </button>`;
                    }

                    actionBtn = `<div style="display:flex; justify-content:center; gap:5px; align-items:center; flex-wrap:wrap;">${toggleBtn}${resetBtn}${deleteBtn}</div>`;
                } else {
                    actionBtn = '<span style="color:#999; font-size:12px;">🔒 Restrito</span>';
                }

                const statusBadge = c.active 
                    ? '<span style="background:#d4edda; color:#155724; padding:2px 8px; border-radius:10px; font-size:12px; font-weight:bold;">Ativo</span>' 
                    : '<span style="background:#f8d7da; color:#721c24; padding:2px 8px; border-radius:10px; font-size:12px; font-weight:bold;">Inativo</span>';

                // 👇 AQUI ESTÁ A MÁGICA DOS AVATARES NATIVOS 👇
                let photoHtml = "";
                // Se o cliente tem uma foto cadastrada e não é a default, tenta exibir
                if (c.profile_pic && c.profile_pic !== 'default.png' && !c.profile_pic.includes('ui-avatars')) {
                    let imgUrl = c.profile_pic.startsWith('http') ? c.profile_pic : '/uploads/' + c.profile_pic;
                    photoHtml = `<img src="${imgUrl}" onerror="this.outerHTML='<div style=\\'width:32px;height:32px;border-radius:50%;background:#0a1931;color:#d4af37;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;margin:0 auto;\\'>${pegarIniciais(c.name)}</div>'" style="width:32px; height:32px; border-radius:50%; object-fit:cover; border:1px solid #ddd;">`;
                } else {
                    // Se não tem foto, cria o círculo com as iniciais
                    photoHtml = `<div style="width:32px; height:32px; border-radius:50%; background:#0a1931; color:#d4af37; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:14px; margin:0 auto; border: 1px solid #d4af37;">${pegarIniciais(c.name)}</div>`;
                }
                // 👆 FIM DA MÁGICA DOS AVATARES 👆

                let dataCadastro = "-";
                if (c.created_at) {
                    let dataFormatada = new Date(c.created_at);
                    dataCadastro = dataFormatada.toLocaleDateString('pt-BR');
                }

                htmlBuffer += `
                    <tr style="border-bottom: 1px solid #eee; text-align: center;">
                        <td style="padding:10px;">${photoHtml}</td>  
                        <td style="text-align:left; font-weight:bold;">${c.name}</td> 
                        <td>${c.email || '-'}</td> 
                        <td>${c.phone || '-'}</td> 
                        <td>${c.country || 'BR'}</td> 
                        <td style="font-weight:bold; color:#555;">${dataCadastro}</td> 
                        <td>${statusBadge}</td> 
                        <td>${actionBtn}</td> 
                    </tr>`; 
                renderizados++;
            }
            
            // ADICIONA O BOTÃO "CARREGAR MAIS" NO FINAL DA TABELA
            if (totalValidos > clientsLimit) {
                htmlBuffer += `
                <tr>
                    <td colspan="8" style="text-align:center; padding: 20px;">
                        <button onclick="loadMoreClients()" style="background:#00b1ea; color:white; border:none; padding:10px 20px; border-radius:5px; cursor:pointer; font-weight:bold; width: 100%; max-width: 300px;">
                            <i class="fas fa-chevron-down"></i> Mostrar mais clientes...
                        </button>
                    </td>
                </tr>`;
            }

            if (renderizados === 0) {
                tbody.innerHTML = '<tr><td colspan="8" align="center">Nenhum cliente cadastrado.</td></tr>';
            } else {
                tbody.innerHTML = htmlBuffer;
            }

            if(typeof makeTablesResponsive === 'function') makeTablesResponsive();
        }
    } catch (error) {
        console.error("Erro ao carregar clientes:", error);
        const tbody = document.getElementById('clients-list');
        if(tbody) tbody.innerHTML = '<tr><td colspan="8" align="center" style="color:red;">Erro ao buscar clientes.</td></tr>';
    }
}

// Função auxiliar para carregar mais clientes
function loadMoreClients() {
    clientsLimit += 50;
    loadClients();
}
async function toggleClient(id, active) { await fetch('/api/clients/toggle', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,active})}); loadClients(); }

async function openBoxModal() { document.getElementById('box-modal').classList.remove('hidden'); loadClientsBox(); }
async function loadClientsBox() { const res = await fetch('/api/clients'); const list = await res.json(); const sel = document.getElementById('box-client-select'); sel.innerHTML='<option value="">Selecione...</option>'; list.forEach(c => sel.innerHTML += `<option value="${c.id}">${c.name}</option>`); }
async function loadClientOrdersInBox(cid) { 
    const sel = document.getElementById('box-order-select'); 
    const loteInput = document.getElementById('box-lote'); 

    if(!cid) { 
        sel.disabled=true; 
        if(loteInput) loteInput.value = ''; 
        return; 
    } 

    const res = await fetch(`/api/orders/by-client/${cid}`); 
    const list = await res.json(); 
    sel.innerHTML='<option value="">Selecione...</option>'; 
    
    list.forEach(o => {
        const loteDaEncomenda = o.lote || 'Sem Lote';
        sel.innerHTML += `<option value="${o.id}" data-desc="${o.description}" data-lote="${loteDaEncomenda}">${o.code}</option>`;
    }); 
    
    sel.disabled=false; 

    // 🚀 A NOVA MÁGICA: Caçador de Lotes!
    if (list.length > 0 && loteInput) {
        // Ele procura na lista do cliente alguma encomenda que já tenha um Lote de verdade
        const encomendaComLote = list.find(o => o.lote && o.lote !== 'Sem Lote' && o.lote.trim() !== '');
        
        if (encomendaComLote) {
            loteInput.value = encomendaComLote.lote; // Achou! Puxa o lote.
        } else {
            loteInput.value = list[0].lote || 'Sem Lote'; // Não achou nenhuma, bota o padrão.
        }
    } else if (loteInput) {
        loteInput.value = 'Sem Lote';
    }
}

function autoFillBoxData(sel) { 
    // Preenche os produtos
    document.getElementById('box-products').value = sel.options[sel.selectedIndex].getAttribute('data-desc') || ''; 
    
    // MÁGICA 2: Preenche o lote automaticamente!
    const loteBoxInput = document.getElementById('box-lote');
    if (loteBoxInput) {
        loteBoxInput.value = sel.options[sel.selectedIndex].getAttribute('data-lote') || '';
    }
}
function autoFillBoxData(sel) { document.getElementById('box-products').value = sel.options[sel.selectedIndex].getAttribute('data-desc') || ''; }

// ==============================================================
// 2. FUNÇÃO LOAD ORDERS ATUALIZADA (COM LAZY LOADING E VELOCIDADE)
// ==============================================================
window.todasEncomendas = []; // Guarda os dados na memória (não na tela)
window.limiteEncomendas = 50; // Quantidade inicial para carregar rápido

async function loadOrders() {
    if (!currentUser) return; 

    try {
        const res = await fetch('/api/orders');
        const list = await res.json();
        
       // Salva na memória e atualiza o número no topo do painel
        window.todasEncomendas = list;
        window.limiteEncomendas = 50; 
        
        const dashCount = document.getElementById('dash-orders-count');
        if (dashCount) dashCount.innerText = list.length; 
        
        // CHAMA O CÉREBRO DO FILTRO AQUI 👇
        atualizarFiltroLotes();
        
        // Chama a função turbo para desenhar a tabela
        renderizarTabelaEncomendas();

        if (currentUser.role === 'client') updateClientNotifications(list);
    } catch (error) {
        console.error("Erro ao carregar encomendas:", error);
    }
}
// ==============================================================
// FUNÇÃO MÁGICA: CRIA O FILTRO DE LOTES AUTOMATICAMENTE
// ==============================================================
function atualizarFiltroLotes() {
    const select = document.getElementById('filter-envio');
    if (!select) return;

    // Guarda o que estava selecionado para não desmarcar sozinho
    const loteAtual = select.value;

    // Vasculha TODAS as encomendas e descobre quais Lotes existem (sem repetir)
    const lotesUnicos = [...new Set(window.todasEncomendas.map(o => o.lote || 'Sem Lote'))];

    // Recria a lista de opções do zero
    let html = '<option value="Todos">📦 Todos os Envios</option>';
    
    // Organiza em ordem alfabética (1º, 2º, 3º...) e cria os botões
    lotesUnicos.sort().forEach(lote => {
        html += `<option value="${lote}">✈️ ${lote}</option>`;
    });

    select.innerHTML = html;

    // Devolve a seleção que o usuário estava vendo
    if (lotesUnicos.includes(loteAtual) || loteAtual === 'Todos') {
        select.value = loteAtual;
    }
}
// --------------------------------------------------------------
// FUNÇÃO TURBO: DESENHA A TABELA SEM TRAVAR O NAVEGADOR
// --------------------------------------------------------------
function renderizarTabelaEncomendas() {
    const tbody = document.getElementById('orders-list') || 
                  document.getElementById('client-orders-list') || 
                  document.querySelector('.data-table tbody');
    
    if(!tbody) return;
    
    if(window.todasEncomendas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:20px;">Nenhuma encomenda encontrada.</td></tr>';
        return;
    }

    // --- NOVA MÁGICA: VERIFICA O FILTRO DE ENVIO ---
    const selectFiltro = document.getElementById('filter-envio');
    const loteEscolhido = selectFiltro ? selectFiltro.value : 'Todos';

    let encomendasFiltradas = window.todasEncomendas;

    if (loteEscolhido !== 'Todos') {
        // Se o administrador escolheu um envio específico, filtra a lista!
        // Nota: O banco de dados vai passar a devolver o campo "lote" em breve.
        encomendasFiltradas = encomendasFiltradas.filter(o => o.lote === loteEscolhido);
    }

    if(encomendasFiltradas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:20px;">Nenhuma encomenda encontrada no ${loteEscolhido}.</td></tr>`;
        return;
    }

    // Pega apenas as primeiras encomendas até o limite atual (da lista já filtrada)
    const encomendasVisiveis = encomendasFiltradas.slice(0, window.limiteEncomendas);
    
    // O SEGREDO DA VELOCIDADE: Cria o HTML na memória antes de jogar na tela
    let htmlDasLinhas = '';

    encomendasVisiveis.forEach(o => {
        const toggleBtn = document.getElementById('toggle-orders');
        if (o.status === 'Entregue' && currentUser.role !== 'client' && (!toggleBtn || !toggleBtn.checked)) return;
        
        const phone = o.client_phone || o.phone || o.whatsapp || ''; 
        const email = o.client_email || o.email || o.mail || ''; 
        const name = o.client_name || o.name || 'Cliente';
        
        const basePrice = parseFloat(o.price) || 0;
        const freightValue = parseFloat(o.freight_amount) || basePrice;
        const nfValue = parseFloat(o.nf_amount) || 0;
        const finalPrice = freightValue + nfValue;

        // --- 1. STATUS ---
        let statusDisplay;
        if (currentUser.role === 'client') {
            statusDisplay = typeof getTimelineHTML === 'function' ? getTimelineHTML(o.status) : o.status;
        } else {
            statusDisplay = `
            <select onchange="checkDeliveryStatus(this, ${o.id}, '${name}', '${o.code}', '${phone}')" 
                    style="padding:5px; border-radius:4px; border:1px solid #ccc; font-size:12px; width:100%;">
                <option value="Processando" ${o.status=='Processando'?'selected':''}>Processando</option>
                <option value="Recebido" ${o.status=='Recebido'?'selected':''}>Recebido na Origem</option>
                <option value="Em Trânsito" ${o.status=='Em Trânsito'?'selected':''}>Em Trânsito ✈️</option>
                <option value="Chegou ao Destino" ${o.status=='Chegou ao Destino'?'selected':''}>Chegou ao Destino 🏢</option>
                <option value="Pendente Pagamento" ${o.status=='Pendente Pagamento'?'selected':''}>Pendente Pagamento</option>
                <option value="Pago" ${o.status=='Pago'?'selected':''}>Pago</option>
                <option value="Entregue" ${o.status=='Entregue'?'selected':''}>Entregue ✅</option>
                <option value="Avaria" ${o.status=='Avaria'?'selected':''}>Avaria ⚠️</option>
            </select>`;
        }

        // --- 2. BOTÕES DE AÇÃO ---
        let actions = '-';
        if (currentUser.role !== 'client') {
            const whatsappColor = phone ? '#25D366' : '#ccc';
            const emailColor = email ? '#007bff' : '#ccc';
            actions = `<div style="display:flex; gap:5px; justify-content:center;">`;
            actions += `<button onclick="sendNotification('whatsapp', '${phone}', '${name}', '${o.code}', '${o.status}')" title="WhatsApp" style="background:${whatsappColor}; color:white; border:none; width:30px; height:30px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center;"><i class="fab fa-whatsapp"></i></button>`;
            actions += `<button onclick="sendNotification('email', '${email}', '${name}', '${o.code}', '${o.status}')" title="Email" style="background:${emailColor}; color:white; border:none; width:30px; height:30px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center;"><i class="far fa-envelope"></i></button>`;
            actions += `<button onclick="editOrder(${o.id})" title="Editar" style="background:#ffc107; color:white; border:none; width:30px; height:30px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center;"><i class="fas fa-edit"></i></button>`;
            actions += `<button onclick="deleteOrder(${o.id})" title="Excluir" style="background:#dc3545; color:white; border:none; width:30px; height:30px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center;"><i class="fas fa-trash"></i></button>`;
            actions += `<button onclick="DeliveryProof.start(${o.id}, 'damage')" title="Avaria" style="background:#dc3545; color:white; border:none; width:30px; height:30px; border-radius:50%; margin-left:5px; cursor:pointer; display:flex; align-items:center; justify-content:center;"><i class="fas fa-exclamation-triangle"></i></button>`;
            if (o.delivery_proof) {
                actions += `<button onclick='DeliveryProof.view("${o.delivery_proof}")' title="Ver Foto" style="background:#6f42c1; color:white; border:none; width:30px; height:30px; border-radius:50%; margin-left:5px; cursor:pointer; display:flex; align-items:center; justify-content:center;"><i class="fas fa-camera"></i></button>`;
            }
            actions += `<button onclick="printLabel('${o.code}', '${name}', '${o.weight}', '${o.description}')" title="Etiqueta" style="background:#6c757d; color:white; border:none; width:30px; height:30px; border-radius:50%; margin-left:5px; cursor:pointer;"><i class="fas fa-print"></i></button></div>`;
        } else {
            if (o.status === 'Pendente Pagamento' || o.status === 'Pendente') {
                actions = `<button onclick="openPaymentModal(${o.id}, '${o.description}', ${finalPrice})" class="btn-pay-pulse" style="background:#28a745; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-weight:bold;"><i class="fas fa-dollar-sign"></i> PAGAR</button>`;
            } else if (o.status === 'Pago') {
                actions = `<span style="color:green; font-weight:bold;"><i class="fas fa-check-circle"></i> Pago</span>`;
            } else if ((o.status === 'Entregue' || o.status === 'Avaria') && o.proof_image) {
                actions = `<button onclick='viewDeliveryPhoto("${o.proof_image}")' style="color:#6f42c1; border:1px solid #6f42c1; background:none; padding:4px 10px; border-radius:4px; cursor:pointer; font-weight:bold;"><i class="fas fa-camera"></i> Ver Comprovante</button>`;
            } else {
                actions = `<button onclick="alert('Detalhes: ${o.description} | Valor: R$ ${finalPrice.toFixed(2)}')" style="padding:5px 10px; border:1px solid #ddd; background:#fff; cursor:pointer; border-radius:4px;">Detalhes</button>`;
            }
        }
        
        const checkboxHtml = currentUser.role !== 'client' 
            ? `<td style="text-align: center;"><input type="checkbox" class="order-checkbox" value="${o.id}" onclick="updateBulkCounter()"></td>`
            : '';
        
        // Em vez de desenhar, ele soma no texto
        htmlDasLinhas += `
            <tr style="border-bottom: 1px solid #eee;">
                ${checkboxHtml}
                <td style="padding:12px;"><strong>${o.code}</strong></td>
                <td>${name}</td>
                <td>${o.description||'-'}</td>
                <td>${o.weight} Kg</td>
                <td style="font-weight:bold; color:green;">R$ ${finalPrice.toFixed(2)}</td> 
                <td style="min-width: 320px; padding: 10px 5px;">${statusDisplay}</td>
                <td style="text-align:center;">${actions}</td>
            </tr>`; 
    });

    // Se ainda tem mais para mostrar, adiciona o botão mágico de carregar mais
    if (window.todasEncomendas.length > window.limiteEncomendas) {
        htmlDasLinhas += `
        <tr>
            <td colspan="9" style="text-align:center; padding: 15px;">
                <button onclick="carregarMaisEncomendas()" style="background:#0a1931; color:white; font-weight:bold; padding:10px 20px; border-radius:5px; border:none; cursor:pointer; width: 100%; max-width: 300px;">
                    Carregar Mais Encomendas ⬇️
                </button>
            </td>
        </tr>`;
    }

    // A mágica acontece aqui: Desenha TUDO de uma única vez!
    tbody.innerHTML = htmlDasLinhas;
    
    if(typeof makeTablesResponsive === 'function') makeTablesResponsive();
}

// --------------------------------------------------------------
// FUNÇÃO DO BOTÃO "CARREGAR MAIS"
// --------------------------------------------------------------
function carregarMaisEncomendas() {
    window.limiteEncomendas += 50; // Aumenta de 50 em 50
    renderizarTabelaEncomendas(); // Redesenha a tabela ultra-rápido
}
function toggleOrderForm() { const f = document.getElementById('new-order-form'); f.classList.toggle('hidden'); if(!f.classList.contains('hidden')) loadClients(); }
async function updateOrderStatus(id, status) { await fetch('/api/orders/update', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status})}); loadOrders(); }
// --- ATUALIZAR PERFIL (COM FOTO E ATUALIZAÇÃO NO INÍCIO) ---
async function updateProfile() {
    const fileInput = document.getElementById('profile-upload');
    const nameInput = document.getElementById('profile-name');
    const emailInput = document.getElementById('profile-email');
    const phoneInput = document.getElementById('profile-phone');
    
    // Feedback visual de carregamento
    const btn = document.querySelector('#profile-view button');
    const oldText = btn.innerText;
    btn.innerText = "Salvando...";
    btn.disabled = true;

    // Cria o FormData para enviar arquivo + texto
    const formData = new FormData();
    formData.append('name', nameInput.value);
    formData.append('email', emailInput.value);
    formData.append('phone', phoneInput.value);

    if (fileInput.files.length > 0) {
        formData.append('profile_pic', fileInput.files[0]);
    }

    try {
        const response = await fetch('/api/user/update', {
            method: 'POST',
            body: formData 
        });

        const result = await response.json();

        if (result.success) {
            alert('✅ Perfil atualizado com sucesso!');
            
            // Atualiza a foto imediatamente na tela
            // NOTA: Se o seu backend retorna 'newProfilePic' em vez de 'newProfilePicUrl', use result.newProfilePic
            const picPath = result.newProfilePicUrl || (result.newProfilePic ? '/uploads/' + result.newProfilePic : null);
            
            if(picPath) {
                const newImgSrc = picPath + '?v=' + new Date().getTime();
                
                // 1. Atualiza na aba de Perfil
                const imgDisplay = document.getElementById('profile-img-display');
                if (imgDisplay) imgDisplay.src = newImgSrc;

                // 2. Atualiza no Início (Cabeçalho VIP) - A MÁGICA ACONTECE AQUI ✨
                const vipImg = document.getElementById('vip-profile-img');
                if (vipImg) vipImg.src = newImgSrc;
            }
        } else {
            alert('Erro: ' + (result.message || 'Falha ao salvar.'));
        }
    } catch (error) {
        console.error(error);
        alert('Erro de conexão.');
    } finally {
        btn.innerText = oldText;
        btn.disabled = false;
    }
}
// --- VARIÁVEIS GLOBAIS DE VÍDEO ---
let currentFacingMode = 'environment'; // Começa com a câmera traseira

// 1. Habilita o botão apenas se selecionar cliente
function checkVideoPermission() {
    const sel = document.getElementById('video-client-select');
    const btn = document.getElementById('btn-open-fullscreen');
    if(sel && btn) {
        btn.disabled = !sel.value;
        if(sel.value) {
            btn.innerHTML = '<i class="fas fa-camera"></i> ABRIR CÂMERA';
            btn.style.background = '#28a745';
        } else {
            btn.innerHTML = 'Selecione uma encomenda acima';
            btn.style.background = '#2c3e50';
        }
    }
}

// 2. Abre o Modo Tela Cheia
async function openFullscreenCamera() {
    const overlay = document.getElementById('fullscreen-camera-overlay');
    overlay.classList.remove('hidden'); // Mostra a div preta
    overlay.style.display = 'flex'; // Garante o display flex
    
    // Reseta UI
    document.getElementById('record-ui').classList.remove('hidden');
    document.getElementById('upload-ui').classList.add('hidden');
    document.getElementById('camera-feed').style.display = 'block';
    document.getElementById('video-preview').style.display = 'none';
    
    await startCamera(currentFacingMode);
}

function closeFullscreenCamera() {
    // Esconde a sobreposição
    const overlay = document.getElementById('fullscreen-camera-overlay');
    if (overlay) overlay.classList.add('hidden');

    // Para o vídeo (stream) para economizar bateria/processamento
    const video = document.getElementById('camera-feed');
    if (video && video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
    }

    // Reseta variaveis globais
    recordedBlob = null;
    mediaRecorder = null;
    chunks = [];

    // Reseta visual dos botões (UI) com segurança
    const recordUI = document.getElementById('record-ui');
    const uploadUI = document.getElementById('upload-ui');
    const preview = document.getElementById('video-preview');
    const cameraFeed = document.getElementById('camera-feed');
    const timer = document.getElementById('recording-timer');

    if(recordUI) recordUI.classList.remove('hidden');
    if(uploadUI) uploadUI.classList.add('hidden');
    if(preview) {
        preview.style.display = 'none';
        preview.src = '';
    }
    if(cameraFeed) cameraFeed.style.display = 'block';
    if(timer) {
        timer.classList.add('hidden');
        timer.innerText = "00:00";
    }

    // Reseta botões de gravar
    const btnStart = document.getElementById('btn-start-rec');
    const btnStop = document.getElementById('btn-stop-rec');
    
    if(btnStart) btnStart.classList.remove('hidden');
    if(btnStop) btnStop.classList.add('hidden');
}

async function startCamera(facingMode) {
    const video = document.getElementById('camera-feed');
    
    // 1. Limpeza total de streams antigos
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }

    // 2. Configurações mais compatíveis para celular
    const constraints = {
        video: { 
            facingMode: facingMode,
            width: { ideal: 640 }, // Reduzi um pouco para garantir que abra em qualquer celular
            height: { ideal: 480 }
        }, 
        audio: true 
    };

    try {
        // Importante: Isso DEVE ser disparado por um clique de botão
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        currentStream = stream;
        video.srcObject = stream;
        
        // Garante que o vídeo comece a tocar
        await video.play();
        console.log("✅ Câmera iniciada com sucesso!");
    } catch (err) {
        console.error("Erro detalhado da câmera:", err);
        alert("Atenção: Ative a permissão de câmera no cadeado do navegador.");
    }
}

function switchCamera() {
    currentFacingMode = (currentFacingMode === 'environment') ? 'user' : 'environment';
    startCamera(currentFacingMode);
}

// Variáveis globais para controlar o tempo
let recInterval; 
let recSeconds = 0;

// 5. Gravação
function startRecording() {
    recordedChunks = [];
    
    // Tenta codecs melhores para celular
    let options = { mimeType: 'video/webm;codecs=vp8' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm' }; // Fallback
    }

    try {
        mediaRecorder = new MediaRecorder(currentStream, options);
    } catch(e) {
        mediaRecorder = new MediaRecorder(currentStream);
    }

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
        currentBlob = new Blob(recordedChunks, { type: 'video/webm' });
        const videoURL = URL.createObjectURL(currentBlob);
        
        const previewEl = document.getElementById('video-preview');
        previewEl.src = videoURL;
        
        // Troca visualização: Câmera -> Preview Gravado
        document.getElementById('camera-feed').style.display = 'none';
        previewEl.style.display = 'block';
        
        // Troca botões: Gravar -> Enviar
        document.getElementById('record-ui').classList.add('hidden');
        document.getElementById('upload-ui').classList.remove('hidden');
        
        previewEl.play(); // Toca o vídeo automaticamente pra conferir
    };

    mediaRecorder.start();

    // ==========================================
    // MOTOR DO CRONÔMETRO (NOVO)
    // ==========================================
    const timerEl = document.getElementById('recording-timer');
    timerEl.classList.remove('hidden'); // Mostra o relógio
    recSeconds = 0; // Zera os segundos
    timerEl.innerText = "00:00"; // Zera o texto na tela

    // Limpa qualquer timer travado antes de começar
    if(typeof recInterval !== 'undefined') clearInterval(recInterval);

    // Faz o relógio rodar a cada 1 segundo (1000 milissegundos)
    recInterval = setInterval(() => {
        recSeconds++; // Soma 1 segundo
        // Formata para ficar 00:00 (com zero à esquerda)
        let m = Math.floor(recSeconds / 60).toString().padStart(2, '0');
        let s = (recSeconds % 60).toString().padStart(2, '0');
        timerEl.innerText = `${m}:${s}`; // Atualiza a tela
    }, 1000);

    // UI de gravando
    document.getElementById('btn-start-rec').classList.add('hidden');
    document.getElementById('btn-stop-rec').classList.remove('hidden');
}

function stopRecording() {
    mediaRecorder.stop();
    document.getElementById('btn-start-rec').classList.remove('hidden');
    document.getElementById('btn-stop-rec').classList.add('hidden');
    document.getElementById('recording-timer').classList.add('hidden');
    
    // ==========================================
    // PARA O MOTOR DO CRONÔMETRO
    // ==========================================
    if(typeof recInterval !== 'undefined') {
        clearInterval(recInterval);
    }
}
// 6. Refazer vídeo (Botão Descartar)
function retakeVideo() {
    currentBlob = null;
    document.getElementById('camera-feed').style.display = 'block';
    document.getElementById('video-preview').style.display = 'none';
    document.getElementById('video-preview').src = "";
    
    document.getElementById('record-ui').classList.remove('hidden');
    document.getElementById('upload-ui').classList.add('hidden');
}
// ==========================================
// FUNÇÕES DA ABA DE VÍDEO (COM BUSCA BLINDADA)
// ==========================================

// Variável global para guardar a lista original de encomendas
let allVideoOrders = [];

// --- FUNÇÃO CORRIGIDA: CARREGAR ENCOMENDAS NA ABA DE VÍDEO ---
async function loadOrdersForVideo() {
    const select = document.getElementById('video-client-select');
    const infoBox = document.getElementById('video-order-info');
    
    // Se não estiver na tela de admin/funcionário, sai
    if (!select || !infoBox) return;

    // Reseta o botão da câmera
    const btnCamera = document.getElementById('btn-open-fullscreen');
    if(btnCamera) {
        btnCamera.disabled = true;
        btnCamera.style.background = '#2c3e50';
        btnCamera.innerHTML = '<i class="fas fa-camera"></i> Selecione uma encomenda';
    }

    try {
        // Busca todas as encomendas
        const res = await fetch('/api/orders');
        const orders = await res.json();

        // Filtra para não mostrar encomendas já entregues
        allVideoOrders = orders.filter(o => o.status !== 'Entregue');

        // Renderiza a lista inicial (completa)
        renderVideoOrdersList(allVideoOrders);

        // --- EVENTO: QUANDO O USUÁRIO SELECIONA UMA ENCOMENDA ---
        select.onchange = function() {
            checkVideoPermission(); // Libera o botão da câmera
            
            const option = select.options[select.selectedIndex];
            
            // Se o usuário selecionou algo válido
            if (select.value) {
                const code = option.getAttribute('data-code');
                const desc = option.getAttribute('data-desc');
                const name = option.getAttribute('data-name');
                const weight = option.getAttribute('data-weight');

                // Atualiza o visual bonito
                infoBox.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <strong>${name}</strong><br>
                            <span style="font-size:12px; color:#666;">${code}</span>
                        </div>
                        <div style="text-align:right;">
                            <span style="font-weight:bold; color:#0a1931;">${weight} kg</span><br>
                            <span style="font-size:11px;">${desc}</span>
                        </div>
                    </div>
                `;
            } else {
                // Se desmarcou, limpa
                infoBox.innerHTML = `<small>Resumo: <span id="info-desc" style="font-weight:bold;">-</span></small>`;
            }
        };

    } catch (error) {
        console.error("Erro ao carregar encomendas para vídeo:", error);
        select.innerHTML = '<option value="">Erro ao carregar lista</option>';
    }
}

// --- FUNÇÃO AUXILIAR PARA DESENHAR AS OPÇÕES NO SELECT ---
function renderVideoOrdersList(ordersToRender) {
    const select = document.getElementById('video-client-select');
    if (!select) return;

    select.innerHTML = '<option value="">Selecione a Encomenda...</option>';

    ordersToRender.forEach(o => {
        const clientName = o.client_name || 'Cliente';
        select.innerHTML += `
            <option value="${o.client_id}" 
                    data-code="${o.code}" 
                    data-desc="${o.description || 'Sem descrição'}"
                    data-name="${clientName}"
                    data-weight="${o.weight || 0}">
                ${o.code} - ${clientName}
            </option>
        `;
    });
}

// --- FUNÇÃO DE BUSCA BLINDADA ---
function filterVideoClients() {
    const input = document.getElementById("video-client-search");
    const filter = input.value.toLowerCase().trim();
    
    // Se o campo de busca estiver vazio, mostra tudo de novo
    if (filter === "") {
        renderVideoOrdersList(allVideoOrders);
        return;
    }

    // Filtra a lista original na memória (procurando no nome ou no código)
    const filteredOrders = allVideoOrders.filter(o => {
        const clientName = (o.client_name || 'Cliente').toLowerCase();
        const code = (o.code || '').toLowerCase();
        
        return clientName.includes(filter) || code.includes(filter);
    });

    // Redesenha o select SÓ com as opções encontradas
    renderVideoOrdersList(filteredOrders);

    // Limpa a seleção e reseta a área de informações
    const select = document.getElementById('video-client-select');
    select.value = "";
    document.getElementById('video-order-info').innerHTML = `<small>Resumo: <span id="info-desc" style="font-weight:bold;">-</span></small>`;
    checkVideoPermission(); // Trava a câmera até selecionar de novo
}

// --- FUNÇÃO PARA LIBERAR O BOTÃO DA CÂMERA ---
function checkVideoPermission() {
    const sel = document.getElementById('video-client-select');
    const btn = document.getElementById('btn-open-fullscreen');
    
    if(sel && btn) {
        // Se tem valor selecionado, ativa o botão
        if(sel.value) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-camera"></i> ABRIR CÂMERA';
            btn.style.background = '#28a745'; // Verde
            btn.style.cursor = 'pointer';
        } else {
            btn.disabled = true;
            btn.innerHTML = 'Selecione uma encomenda acima';
            btn.style.background = '#2c3e50'; // Cinza escuro
            btn.style.cursor = 'not-allowed';
        }
    }
}

async function loadClientsForVideoSelect() {
    const res = await fetch('/api/clients');
    const clients = await res.json();
    const sel = document.getElementById('video-client-select');
    if(!sel) return;
    sel.innerHTML = '<option value="">Selecione para vincular...</option>';
    clients.forEach(c => {
        sel.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
}
async function confirmUpload() {
    // 1. Validações Iniciais
    if(!currentBlob) return alert("Erro: Nenhum vídeo gravado.");

    const clientSelect = document.getElementById('video-client-select');
    const clientId = clientSelect ? clientSelect.value : null;
    
    // PEGANDO O CÓDIGO DA ENCOMENDA 🚀
    const selectedOption = clientSelect.options[clientSelect.selectedIndex];
    const orderCode = selectedOption ? selectedOption.getAttribute('data-code') : null;
    
    if (!clientId || !orderCode) return alert("⚠️ Erro: Selecione um Cliente/Encomenda na lista antes de enviar!");

    // 2. Prepara Dados
    const descEl = document.getElementById('info-desc');
    const descText = descEl ? descEl.innerText : 'Vídeo de Encomenda';
    
    const formData = new FormData();
    formData.append('client_id', clientId);
    formData.append('order_code', orderCode); // ENVIANDO O CÓDIGO PRO SERVIDOR 🚀
    formData.append('description', descText);
    formData.append('video', currentBlob, `rec-${Date.now()}.webm`);

    // 3. Feedback Visual (Bloqueia botão)
    let btn = document.getElementById('btn-confirm-upload'); // Tente usar ID fixo se possível
    if(!btn) btn = document.querySelector('#preview-controls-ui .btn-primary');
    
    const oldText = btn ? btn.innerText : 'Enviar';
    if(btn) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...'; 
        btn.disabled = true;
    }

    try {
        // 4. Envio para o Servidor
        const res = await fetch('/api/videos/upload', { 
            method: 'POST', 
            body: formData 
        });
        
        // Verifica se a resposta é JSON antes de tentar ler
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            const text = await res.text(); // Pega o erro em texto (ex: HTML de erro 500)
            console.error("Resposta não-JSON do servidor:", text);
            throw new Error("O servidor retornou um erro inesperado. Verifique o terminal.");
        }

        const data = await res.json();
        
        if(data.success) {
            alert("✅ Vídeo enviado com sucesso!");
            
            // Atualiza a lista na tela (verifica qual função chamar)
            if(currentUser.role !== 'client') {
                 if(typeof loadAdminVideos === 'function') loadAdminVideos(); 
            } else {
                 if(typeof loadClientVideos === 'function') loadClientVideos();
            }
            
            // 5. IMPORTANTE: Limpa tudo (Timer, vídeo, memória)
            discardVideo(); 
            closeFullscreenCamera(); // Fecha a tela cheia para evitar bugs
            
        } else {
            throw new Error(data.msg || "Erro desconhecido no upload");
        }
    } catch(e) { 
        console.error(e);
        alert("❌ Falha no envio: " + e.message); 
    } finally {
        // Restaura o botão
        if(btn) {
            btn.innerText = oldText; 
            btn.disabled = false;
        }
    }
}

// Garante que o timer pare ao descartar ou finalizar
function discardVideo() {
    currentBlob = null;
    recordedChunks = [];
    
    // Para o vídeo se estiver tocando
    const preview = document.getElementById('video-preview');
    if(preview) {
        preview.pause();
        preview.src = "";
        preview.style.display = 'none';
    }

    // Volta para a câmera
    const camFeed = document.getElementById('camera-feed');
    if(camFeed) camFeed.style.display = 'block';

    // Troca os controles
    document.getElementById('record-ui').classList.remove('hidden');
    document.getElementById('upload-ui').classList.add('hidden');

    // ZERA O TIMER VISUALMENTE
    const timerEl = document.getElementById('recording-timer');
    if(timerEl) {
        timerEl.innerText = "00:00";
        timerEl.classList.add('hidden');
    }
    
    // PARA O LOOP DO RELÓGIO (CRÍTICO)
    if(typeof recInterval !== 'undefined') clearInterval(recInterval);
}
// ==========================================
// FUNÇÃO PARA APAGAR O VÍDEO (A QUE FALTAVA!)
// ==========================================
async function deleteVideo(id, filename) {
    // 1. Pede confirmação antes de apagar (para evitar acidentes)
    if (!confirm(`⚠️ Tem certeza que deseja excluir o vídeo #${id}? Essa ação apagará o ficheiro para sempre.`)) {
        return;
    }

    try {
        // 2. Manda a ordem de exclusão no formato POST exato que o seu backend espera
        const res = await fetch('/api/videos/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            // Envia o ID e o NOME DO ARQUIVO para o backend saber o que apagar no disco
            body: JSON.stringify({ id: id, filename: filename }) 
        });

        const data = await res.json();

        // 3. Verifica se deu certo
        if (data.success) {
            alert("🗑️ Vídeo apagado com sucesso do sistema e do servidor!");
            
            // 4. Recarrega a lista na tela para o vídeo sumir imediatamente
            if (typeof loadAdminVideos === 'function') {
                loadAdminVideos(); 
            }
        } else {
            alert("❌ Erro ao apagar o vídeo. Tente novamente.");
        }
    } catch (error) {
        console.error("Erro ao deletar vídeo:", error);
        alert("📡 Erro de conexão ao tentar apagar o vídeo: " + error.message);
    }
}
async function loadClientInfoForVideo(clientId) {
    const divInfo = document.getElementById('video-order-info');
    if(!clientId) {
        divInfo.style.opacity = '0.5';
        document.getElementById('info-name').innerText = '-';
        return;
    }
    const res = await fetch(`/api/orders/by-client/${clientId}`);
    const orders = await res.json();
    const resC = await fetch('/api/clients'); 
    const allClients = await resC.json();
    const client = allClients.find(c => c.id == clientId);

    divInfo.style.opacity = '1';
    document.getElementById('info-name').innerText = client ? client.name : 'Erro';
    document.getElementById('info-email').innerText = client ? client.email : '-';

    if(orders.length > 0) {
        const lastOrder = orders[orders.length - 1]; 
        document.getElementById('info-desc').innerText = lastOrder.description;
        document.getElementById('info-weight').innerText = lastOrder.weight + ' Kg';
    } else {
        document.getElementById('info-desc').innerText = "Nenhum pedido recente";
        document.getElementById('info-weight').innerText = "-";
    }
}

// --- VARIÁVEIS GLOBAIS PARA LIMITES DE VÍDEOS ---
let adminVideoLimit = 50;
let clientVideoLimit = 50;

// --- VÍDEOS DO ADMIN (COM FILTRO DE LOTE 🎨🚀) ---
async function loadAdminVideos() {
    const tbody = document.getElementById('admin-video-list');
    if(!tbody) return;

    // Aviso de carregamento
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Carregando vídeos... <i class="fas fa-spinner fa-spin"></i></td></tr>';

    try {
        const res = await fetch('/api/videos/list');
        const list = await res.json();
        
        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Nenhum vídeo encontrado.</td></tr>';
            return;
        }

        // ==========================================
        // 🧠 CÉREBRO DO FILTRO DE LOTES (Aprende sozinho!)
        // ==========================================
        const filterSelect = document.getElementById('video-lot-filter');
        const loteSelecionado = filterSelect ? filterSelect.value : '';

        if (filterSelect) {
            // Pega todos os nomes de lotes salvos nos vídeos (tira os vazios/nulos)
            const todosOsLotes = list.map(v => v.lote || v.shipment_id || 'Sem Lote');
            const lotesUnicos = [...new Set(todosOsLotes)];

            let htmlFiltro = '<option value="">📦 Todos os Envios/Lotes</option>';
            lotesUnicos.sort().forEach(l => {
                htmlFiltro += `<option value="${l}">✈️ ${l}</option>`;
            });
            
            filterSelect.innerHTML = htmlFiltro;
            
            // Mantém selecionado o lote que estava antes
            if (lotesUnicos.includes(loteSelecionado) || loteSelecionado === '') {
                filterSelect.value = loteSelecionado;
            }
        }
        // ==========================================

        let htmlBuffer = '';
        let renderizados = 0;
        let totalValidos = 0;

        for (let i = 0; i < list.length; i++) {
            const v = list[i];

            // MÁGICA DO FREIO: Se não for do lote escolhido, pula e oculta!
            const loteDesteVideo = v.lote || v.shipment_id || 'Sem Lote';
            if (loteSelecionado !== '' && String(loteDesteVideo) !== String(loteSelecionado)) continue;

            totalValidos++;

            if (renderizados >= adminVideoLimit) continue; // Trava de segurança 
            
            // A MÁGICA DOS BOTÕES E CAIXINHAS AQUI 👇
            htmlBuffer += `
                <tr>
                    <td style="text-align: center; padding: 15px; border-bottom: 1px solid #eee;">
                        <input type="checkbox" class="video-checkbox" value="${v.id}" data-filename="${v.filename}" onchange="checkVideoSelection()" style="transform: scale(1.3); cursor: pointer; accent-color: #dc3545;">
                    </td>
                    <td style="font-weight:bold; color:#0a1931; padding: 15px; border-bottom: 1px solid #eee;">${v.id}</td>
                    <td style="padding: 15px; border-bottom: 1px solid #eee;">${v.client_name || 'Desconhecido'}</td>
                    <td style="padding: 15px; border-bottom: 1px solid #eee;">${formatDate(v.created_at)}</td>
                    <td style="padding: 15px; border-bottom: 1px solid #eee;">
                        <div style="display: flex; gap: 8px; justify-content: flex-start;">
                            <a href="/uploads/videos/${v.filename}" target="_blank" 
                               style="background-color: #00b1ea; color: white; padding: 6px 12px; text-decoration: none; border-radius: 4px; font-size: 13px; font-weight: bold; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                <i class="fas fa-eye"></i> Ver
                            </a> 
                            <button onclick="deleteVideo(${v.id}, '${v.filename}')" 
                                    style="background-color: #dc3545; color: white; border: none; padding: 6px 12px; cursor: pointer; border-radius: 4px; font-size: 13px; font-weight: bold; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            renderizados++;
        }

        // ADICIONA O BOTÃO "CARREGAR MAIS"
        if (totalValidos > adminVideoLimit) {
            htmlBuffer += `
            <tr>
                <td colspan="4" style="text-align:center; padding: 20px;">
                    <button onclick="loadMoreAdminVideos()" style="background:#00b1ea; color:white; border:none; padding:10px 20px; border-radius:5px; cursor:pointer; font-weight:bold; width: 100%; max-width: 300px;">
                        <i class="fas fa-chevron-down"></i> Mostrar vídeos antigos...
                    </button>
                </td>
            </tr>`;
        }

        if (renderizados === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Nenhum vídeo encontrado para este envio.</td></tr>';
        } else {
            tbody.innerHTML = htmlBuffer;
        }

    } catch (error) {
        console.error("Erro ao carregar vídeos admin:", error);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Erro ao buscar vídeos.</td></tr>';
    }
}

// Função auxiliar para Admin ver mais vídeos
function loadMoreAdminVideos() {
    adminVideoLimit += 50;
    loadAdminVideos();
}

async function loadClientVideos(loteFiltro = '') {
    const grid = document.getElementById('client-video-grid');
    if(!grid) return; 
    
    grid.innerHTML = '<p style="text-align:center; width:100%;">Carregando seus vídeos...</p>';

    try {
        const res = await fetch('/api/videos/list');
        let list = await res.json();
        
        // 🧠 MÁGICA DO FILTRO: Puxa só os vídeos do envio selecionado!
        if (loteFiltro && loteFiltro !== '') {
            // Nota: Se a sua tabela de vídeos tem a coluna 'order_code', assumimos que o lote
            // está salvo nela ou relacionado. Se a rota `/api/videos/list` do backend retornar o `lote`, filtramos por ele:
            list = list.filter(v => (v.lote || v.order_code || 'Sem Lote') === loteFiltro);
        }
        // 👇 AQUI ESTÁ A CORREÇÃO DA MÁGICA DO HISTÓRICO 👇
        if (!window.verHistoricoCompleto) {
            // Nota: Confirme se a sua tabela de vídeos traz o status da encomenda! 
            list = list.filter(v => v.status !== 'Entregue'); 
        }
        
        if(list.length === 0) {
            grid.innerHTML = `<p style="text-align:center; color:#666; width:100%; margin-top:20px;">Nenhum vídeo disponível ${loteFiltro ? 'para este envio' : 'no momento'}.</p>`;
            return;
        }

        let htmlBuffer = '';
        let renderizados = 0;
        let totalValidos = 0;

        for (let i = 0; i < list.length; i++) {
            totalValidos++;

            if (renderizados >= clientVideoLimit) continue; 

            const v = list[i];
            const dateStr = new Date(v.created_at).toLocaleDateString('pt-BR');
            const descSafe = (v.description || 'Sem descrição').replace(/"/g, '&quot;');
            const ext = v.filename.split('.').pop();
            
            htmlBuffer += `
                <div class="video-card" style="border:1px solid #ddd; padding:15px; border-radius:8px; background:white; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                    <div style="margin-bottom:10px; font-weight:bold; color:#0a1931; font-size:14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${descSafe}">
                        📦 ${descSafe}
                    </div>
                    <video controls preload="metadata" style="width:100%; border-radius:5px; background:black; aspect-ratio: 16/9;">
                        <source src="/uploads/videos/${v.filename}" type="video/${ext === 'mp4' ? 'mp4' : 'webm'}">
                        Seu navegador não suporta vídeos.
                    </video>
                    <div style="margin-top:10px; display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:12px; color:#666;">📅 ${dateStr}</span>
                        <a href="/uploads/videos/${v.filename}" download="video-${v.id}.${ext}" class="btn-primary" style="padding:6px 12px; text-decoration:none; font-size:12px; border-radius:4px; font-weight:bold; display:inline-flex; align-items:center; gap:5px;">
                            <i class="fas fa-download"></i> Baixar
                        </a>
                    </div>
                </div>
            `;
            renderizados++;
        }

        if (totalValidos > clientVideoLimit) {
            htmlBuffer += `
            <div style="width: 100%; display: flex; justify-content: center; padding: 20px 0;">
                <button onclick="loadMoreClientVideos()" style="background:#00b1ea; color:white; border:none; padding:10px 20px; border-radius:5px; cursor:pointer; font-weight:bold; width: 100%; max-width: 300px;">
                    <i class="fas fa-chevron-down"></i> Mostrar vídeos antigos...
                </button>
            </div>`;
        }

        grid.innerHTML = htmlBuffer;

    } catch (error) {
        console.error("Erro ao carregar vídeos:", error);
        grid.innerHTML = '<p style="color:red; text-align:center; width:100%;">Erro de conexão ao buscar vídeos.</p>';
    }
}

// Função auxiliar para Cliente ver mais vídeos
function loadMoreClientVideos() {
    clientVideoLimit += 50;
    loadClientVideos();
}
// --- FUNÇÃO DE PESQUISA GLOBAL ---
function searchTable(inputId, tableBodyId) {
    const input = document.getElementById(inputId);
    const filter = input.value.toLowerCase();
    
    const tbody = document.getElementById(tableBodyId);
    const rows = tbody.getElementsByTagName('tr');

    for (let i = 0; i < rows.length; i++) {
        const rowText = rows[i].innerText.toLowerCase();
        if (rowText.includes(filter)) {
            rows[i].style.display = "";
        } else {
            rows[i].style.display = "none";
        }
    }
}

// --- RESPONSIVIDADE: CORRIGIDA E COMPLETADA ---
function makeTablesResponsive() {
    const tables = document.querySelectorAll('.data-table');
    
    tables.forEach(table => {
        const headers = table.querySelectorAll('thead th');
        const rows = table.querySelectorAll('tbody tr');

        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            cells.forEach((cell, index) => {
                if (headers[index]) {
                    // Pega o texto do cabeçalho e coloca no atributo
                    cell.setAttribute('data-label', headers[index].innerText);
                }
            });
        });
    });
}
function sendNotification(type, contact, name, code, status) {
    if(!contact || contact === 'undefined' || contact === 'null') {
        return alert("Erro: Contato não cadastrado para este cliente.");
    }

    const message = `Olá *${name}*! 👋\n\nPassando para informar sobre sua encomenda *${code}* na Guineexpress.\n\n📦 *Novo Status:* ${status.toUpperCase()}\n\nAcesse nosso painel para mais detalhes.\nObrigado!`;

    if (type === 'whatsapp') {
        // Limpa o numero deixando apenas digitos
        let cleanPhone = contact.replace(/\D/g, '');
        const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    
    } else if (type === 'email') {
        // Abre o app de email do celular/pc
        const subject = `📦 Atualização: ${code}`;
        const url = `mailto:${contact}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    }
}

async function updateOrderStatus(id, status, name, code, phone) {
    // 1. Confirmação
    if(!confirm(`Deseja alterar o status para: ${status}?`)) return;

    try {
        // 2. Envia para o servidor (que vai disparar o E-MAIL automático)
        await fetch('/api/orders/update', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({id, status})
        });
        
        // 3. Pergunta sobre o WhatsApp (Manual mas facilitado)
        if(phone && confirm(`Status salvo! 💾\n\nDeseja avisar o cliente no WhatsApp agora?`)) {
            sendNotification('whatsapp', phone, name, code, status);
        }
        
        loadOrders(); // Recarrega a tabela

    } catch (error) {
        console.error(error);
        alert("Erro ao atualizar status.");
    }
}

// --- FUNÇÕES PARA ABRIR E FECHAR MODAIS ---

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        // Isso aqui anula o display: none que colocamos no HTML
        modal.style.display = 'flex'; 
        // Remove a classe hidden caso ela exista
        modal.classList.remove('hidden');
    } else {
        console.error("Modal não encontrado: " + modalId);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        // Volta a esconder
        modal.style.display = 'none';
    }
}
// ==========================================
// FILTRO DO HISTÓRICO DE VÍDEOS ENVIADOS
// ==========================================
function filterVideoHistory() {
    // Pega o texto digitado na busca
    const input = document.getElementById("search-video-history");
    const filter = input.value.toLowerCase().trim();
    
    // Pega o corpo da tabela onde estão os vídeos
    const tbody = document.getElementById("admin-video-list");
    
    // Pega todas as linhas (<tr>) dentro dessa tabela
    const trs = tbody.getElementsByTagName("tr");

    // Passa por todas as linhas uma por uma
    for (let i = 0; i < trs.length; i++) {
        // Pega todo o texto que existe dentro dessa linha (ID, Nome, Data, etc)
        const rowText = trs[i].textContent || trs[i].innerText;
        
        // Se o texto da linha contiver o que foi digitado, mostra a linha
        if (rowText.toLowerCase().indexOf(filter) > -1) {
            trs[i].style.display = "";
        } else {
            // Se não contiver, esconde a linha
            trs[i].style.display = "none";
        }
    }
}
// Update the existing openBoxModal to use the new generic openModal
async function openBoxModal() {
    // Ensure the ID matches your HTML ('modal-box')
    openModal('modal-box'); 
    loadClientsBox(); 
}

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal-overlay')) {
        event.target.classList.remove('active');
    }
}
async function loadClientsForBilling() {
    const sel = document.getElementById('bill-client-select');
    if(!sel) return;
    
    // Tira o "Carregando..." na hora e prepara o seletor
    sel.innerHTML = '<option value="">Buscando clientes...</option>';

    try {
        // Busca a lista de clientes
        const res = await fetch('/api/clients');
        const list = await res.json();

        let clientesComCobranca = [];
        
        // Tenta buscar faturas. Se der erro, ele pula pro catch interno e segue a vida.
        try {
            const resInv = await fetch('/api/invoices/list'); 
            if (resInv.ok) {
                const invList = await resInv.json();
                clientesComCobranca = invList
                    .filter(i => {
                        const s = (i.status || '').toLowerCase();
                        return !['pago','paid','approved','cancel'].some(st => s.includes(st));
                    })
                    .map(i => String(i.client_id));
            }
        } catch(e) { 
            console.warn("Aviso: Ignorando checagem de faturas pendentes."); 
        }

        // Limpa o select e preenche com os clientes reais
        let html = '<option value="">Selecione o Cliente...</option>';
        list.forEach(c => {
            let aviso = clientesComCobranca.includes(String(c.id)) ? ' 💰 [PENDENTE]' : '';
            html += `<option value="${c.id}" data-email="${c.email}">${c.name}${aviso}</option>`;
        });
        
        sel.innerHTML = html;

    } catch (error) {
        console.error("Erro ao carregar clientes:", error);
        sel.innerHTML = '<option value="">Erro ao carregar lista</option>';
    }
}

// 2. Quando seleciona cliente, busca os BOXES dele
async function loadClientBoxesForBilling(clientId) {
    const boxSel = document.getElementById('bill-box-select');
    if(!boxSel) return;

    boxSel.innerHTML = '<option value="">Carregando...</option>';
    boxSel.disabled = true;

    if(!clientId) {
        boxSel.innerHTML = '<option value="">Selecione o Cliente Primeiro...</option>';
        return;
    }

    try {
        const res = await fetch('/api/boxes'); 
        const allBoxes = await res.json();
        
        // Filtra boxes do cliente
        const clientBoxes = allBoxes.filter(b => b.client_id == clientId);

        boxSel.innerHTML = '<option value="">Selecione o Box...</option>';

        clientBoxes.forEach(b => {
            // Guarda peso e descrição nos atributos para calcular preço
            const weight = b.order_weight || 0; 
            
            // 👇 O PORTEIRO DAS ENCOMENDAS (AGORA USANDO A LETRA 'b' CORRETA) 👇
            const statusBox = String(b.status || '').toLowerCase();
            
            // 👇 A MÁGICA CORRIGIDA: O Administrador vê sempre tudo! Só esconde se for CLIENTE. 👇
if (currentUser && currentUser.role === 'client' && !window.verHistoricoCompleto) {
    boxes = boxes.filter(b => String(b.order_status).toLowerCase() !== 'entregue' && String(b.status).toLowerCase() !== 'entregue');
}
// 👆 ------------------------------------------ 👆

            const desc = b.products || `Box ${b.box_code}`;
            boxSel.innerHTML += `<option value="${b.id}" data-weight="${weight}" data-desc="${desc}">
                ${b.box_code} (${weight} Kg)
            </option>`;
        });

        boxSel.disabled = false; // Destrava a caixa para você poder clicar!
    } catch (err) {
        console.error("Erro ao carregar boxes:", err);
        boxSel.innerHTML = '<option value="">Erro ao carregar boxes</option>';
    }
}

// 3. Calcula o Valor APENAS DO FRETE (Peso * Preço Global)
function calculateBillAmount(selectElement) {
    const option = selectElement.options[selectElement.selectedIndex];
    const weight = parseFloat(option.getAttribute('data-weight')) || 0;
    
    // Usa o preço global carregado no inicio do dashboard
    const totalFrete = (weight * globalPricePerKg).toFixed(2);
    
    // ATENÇÃO AQUI: Agora ele preenche o campo de FRETE, e não o total final
    document.getElementById('bill-freight-amount').value = totalFrete;
    
    // Chama a função abaixo para somar o frete com a nota fiscal
    updateTotalAmount();
}

// Função auxiliar nova para atualizar o Total (Frete + NF)
function updateTotalAmount() {
    const freightAmount = parseFloat(document.getElementById('bill-freight-amount').value) || 0;
    const nfAmount = parseFloat(document.getElementById('bill-nf-amount').value) || 0;
    const total = freightAmount + nfAmount;
    document.getElementById('bill-amount').value = total.toFixed(2);
}

// 4. Criar a Fatura
async function createInvoice(e) {
    e.preventDefault();
    
    const clientSelect = document.getElementById('bill-client-select');
    const boxSelect = document.getElementById('bill-box-select');

    // --- NOVIDADE: A TRAVA DE SEGURANÇA NO FINANCEIRO! ---
    const clienteTexto = clientSelect.options[clientSelect.selectedIndex].text;
    if (clienteTexto.includes('💰')) {
        const confirmarDuplicata = confirm("⚠️ ATENÇÃO: Este cliente já possui uma cobrança pendente! Tem certeza que deseja gerar OUTRA cobrança para ele?");
        if (!confirmarDuplicata) return; // Cancela se o admin disser não
    }
    // -----------------------------------------------------
    
    const data = {
        client_id: clientSelect.value,
        email: clientSelect.options[clientSelect.selectedIndex].getAttribute('data-email'),
        box_id: boxSelect.value,
        description: boxSelect.options[boxSelect.selectedIndex].getAttribute('data-desc'),
        amount: document.getElementById('bill-amount').value, // O Total final
        nf_amount: document.getElementById('bill-nf-amount').value, // O Valor da NF separado
        freight_amount: document.getElementById('bill-freight-amount').value // O Valor do Frete separado
    };

    if(!confirm(`Gerar cobrança de R$ ${data.amount} para este cliente?`)) return;

    const btn = e.target.querySelector('button');
    const originalText = btn.innerHTML;
    btn.innerHTML = "Gerando Pix...";
    btn.disabled = true;

    try {
        const res = await fetch('/api/invoices/create', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const json = await res.json();
        
        if(json.success) {
            alert("✅ Cobrança Gerada! O cliente já pode ver no painel dele.");
            loadInvoices(); // Atualiza tabela
            e.target.reset();
            
            // Limpa o campo de busca que acabamos de criar
            if(document.getElementById('bill-client-search')) document.getElementById('bill-client-search').value = '';
        } else {
            alert("Erro: " + json.msg);
        }
    } catch(err) {
        alert("Erro de conexão.");
    }
    
    btn.innerHTML = originalText;
    btn.disabled = false;
}

// 6. Verificar Status no Mercado Pago (Sincronização)
async function checkInvoiceStatus(mpId, localId) {
    const res = await fetch('/api/invoices/check-status', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ mp_payment_id: mpId, invoice_id: localId })
    });
    const json = await res.json();
    if(json.success) {
        if(json.status === 'approved') alert("Pagamento Confirmado!");
        else alert("Ainda consta como: " + json.status);
        loadInvoices();
    }
}

async function deleteInvoice(id) {
    if(!confirm("Apagar esta cobrança?")) return;
    await fetch('/api/invoices/delete', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id}) });
    loadInvoices();
}


// ==========================================
// CICÍ COBRANDO DADOS DO RECEBEDOR (COM MEMÓRIA PROFUNDA)
// ==========================================
async function checkMissingReceiverInfo(clientId) {
    if(!clientId) return;

    try {
        const res = await fetch('/api/boxes'); 
        const allBoxes = await res.json();
        const clientBoxes = allBoxes.filter(b => b.client_id == clientId);
        
        const missingInfoBoxes = clientBoxes.filter(b => !b.receiver_name || !b.ticket_number);
        
        // 🧠 MEMÓRIA PROFUNDA DA CICÍ: Usa sessionStorage para não pedir os dados de Bissau repetidamente
        if (missingInfoBoxes.length > 0 && sessionStorage.getItem('ciciJaAvisouBox') !== 'sim') {
            sessionStorage.setItem('ciciJaAvisouBox', 'sim'); // Grava na memória!
            
            setTimeout(() => {
                showSection('box-view'); 
                
                setTimeout(() => {
                    CiciTour.focarElemento('#box-table-body', `📦 Atenção! Você precisa me dizer quem vai retirar a sua encomenda lá em Bissau.<br><br>Olhe para onde a seta está apontando, clique em <b>"Informar Recebedor"</b> e preencha o Nome e o Número do Bilhete do seu familiar.`);
                    
                    const overlay = document.getElementById('cici-overlay');
                    if (overlay) overlay.onclick = () => CiciTour.limparFoco('#box-table-body');
                }, 500);

            }, 4000); 
        }
    } catch(err) {
        console.error("Erro ao verificar recebedores: ", err);
    }
}
// ==========================================
// ABRIR MODAL DE PAGAMENTO (PIX MANUAL) - ATUALIZADO
// ==========================================
function openPaymentModal(orderId, description, amount) {
    // 🌟 SALVA O ID DA FATURA NA MEMÓRIA DO CELULAR PARA O AUTO-ENVIO DO BANCO
    localStorage.setItem('fatura_pendente_id', orderId);

    // 1. Mostra o modal na tela
    document.getElementById('modal-payment').style.display = 'block';

    // 2. Preenche os valores ocultos
    let valorNumerico = limparValor(amount);
    document.getElementById('pay-order-id').value = orderId;
    document.getElementById('pay-amount').value = valorNumerico; 

    // 3. Formata o texto bonito (Ex: Fatura #12 - R$ 50,00)
    let valorParaExibir = valorNumerico.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('pay-desc').innerText = `${description} - ${valorParaExibir}`;
    
    // 4. Limpa o input de arquivo
    const fileInput = document.getElementById('pix-file-input');
    if(fileInput) fileInput.value = '';
    
    // 5. Restaura o botão de enviar (caso tenha ficado travado em "Enviando...")
    const btnSubmit = document.getElementById('btn-auto-submit-pix');
    if(btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="fas fa-camera"></i> ANEXAR E ENVIAR';
    }
    
    // 6. Abre sempre na aba padrão da Chave CNPJ
    togglePixKey('cnpj');

    // ✨ A MÁGICA DA CICÍ COMEÇA AQUI ✨
    setTimeout(() => {
        if (typeof CiciTour !== 'undefined') {
            CiciTour.focarElemento('#btn-auto-submit-pix', `💸 <b>Passo 1:</b> Copie a chave acima e pague no app do banco.<br><br><b>Passo 2:</b> Compartilhe o comprovante direto com nosso App, ou clique neste botão verde e anexe a foto!`);
            
            const botaoAnexar = document.getElementById('btn-auto-submit-pix');
            if (botaoAnexar) {
                botaoAnexar.onclick = () => {
                    CiciTour.limparFoco('#btn-auto-submit-pix');
                    const fileInput = document.getElementById('pix-file-input');
                    if(fileInput) fileInput.click();
                };
            }
        }
    }, 500);
}
// ==========================================
// FECHAR MODAL DE PAGAMENTO - ATUALIZADO COM CICÍ
// ==========================================
function closePaymentModal() {
    // Esconde o modal
    document.getElementById('modal-payment').style.display = 'none';
    
    // Limpa o campo de arquivo para a próxima vez que abrir
    const fileInput = document.getElementById('pix-file-input');
    if(fileInput) fileInput.value = '';
    
    // 5. Restaura o botão de enviar (caso tenha ficado travado em "Enviando...")
    const btnSubmit = document.getElementById('btn-auto-submit-pix');
    if(btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="fas fa-camera"></i> ANEXAR E ENVIAR';
    }

    // ✨ LIMPEZA DA CICÍ ✨
    // Se o cliente clicar no "X" para fechar o modal, nós limpamos a tela escura e a seta
    if (typeof CiciTour !== 'undefined') {
        CiciTour.limparFoco('#pix-file-input');
    }
}
// Função robusta para limpar dinheiro (aceita "R$ 4", "R$ 4,00" e "1.200,50")
function limparValor(valor) {
    if (!valor) return 0;
    
    // Converte para string para garantir
    let str = valor.toString();

    // 1. Remove "R$", espaços e qualquer letra
    str = str.replace(/[^\d.,]/g, '');

    // 2. Lógica para diferenciar milhar de decimal
    // Se tiver ponto E vírgula (ex: 1.200,50), remove o ponto
    if (str.includes('.') && str.includes(',')) {
        str = str.replace(/\./g, ''); 
    }
    
    // 3. Troca vírgula por ponto (para o JavaScript entender)
    str = str.replace(',', '.');

    // 4. Converte para float
    let numero = parseFloat(str);

    // Se der NaN, retorna 0
    return isNaN(numero) ? 0 : numero;
}

async function recoverPassword() {
    // 1. Pergunta o e-mail ao usuário
    const email = prompt("🔒 RECUPERAÇÃO DE SENHA\n\nDigite seu E-mail ou Celular cadastrado:");
    
    if (!email) return; // Se cancelar, para aqui

    // 2. Envia para o servidor verificar (usando a Role atual selecionada nos botões)
    try {
        const res = await fetch('/api/recover-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, role: currentRole }) 
        });

        const data = await res.json();

        if (data.success) {
            alert("✅ " + data.msg);
        } else {
            alert("❌ " + data.msg);
        }
    } catch (error) {
        console.error(error);
        alert("Erro ao tentar recuperar senha. Verifique sua conexão.");
    }
}
// --- LÓGICA DO MODAL DE RECUPERAÇÃO ---

function openRecoverModal() {
    document.getElementById('modal-recover').classList.remove('hidden');
    document.getElementById('recover-input').value = ''; // Limpa o campo
    document.getElementById('recover-input').focus(); // Foca no campo
}

function closeRecoverModal() {
    document.getElementById('modal-recover').classList.add('hidden');
}

// Fecha o modal se clicar fora da caixinha branca
document.getElementById('modal-recover')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-recover') {
        closeRecoverModal();
    }
});

async function sendRecoveryRequest() {
    const inputVal = document.getElementById('recover-input').value;
    const btn = document.getElementById('btn-send-recover');

    if (!inputVal) {
        alert("⚠️ Por favor, digite seu e-mail ou telefone.");
        return;
    }

    // Muda botão para carregando
    const originalText = btn.innerText;
    btn.innerText = "Verificando...";
    btn.disabled = true;

    try {
        // Envia para o backend (mantendo a role selecionada: cliente ou admin)
        const res = await fetch('/api/recover-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: inputVal, role: currentRole }) 
        });

        const data = await res.json();

        if (data.success) {
            alert("✅ Sucesso!\n" + data.msg);
            closeRecoverModal();
        } else {
            alert("❌ Erro: " + data.msg);
        }

    } catch (err) {
        console.error(err);
        alert("Erro de conexão com o servidor.");
    }

    // Restaura o botão
    btn.innerText = originalText;
    btn.disabled = false;
}
// ==============================================================
// FUNÇÃO HISTORY ATUALIZADA (SUPER RÁPIDA)
// ==============================================================
async function loadHistory() {
    const tbody = document.getElementById('history-list');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" align="center">Carregando histórico...</td></tr>';

    try {
        const res = await fetch('/api/history');
        const list = await res.json();
        
        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" align="center">Nenhum registro encontrado.</td></tr>';
            return;
        }

        let htmlDasLinhas = '';
        
        // No histórico, desenhamos apenas os 100 mais recentes para não travar
        const listLimitada = list.slice(0, 100);

        listLimitada.forEach(item => {
            const date = new Date(item.created_at).toLocaleDateString('pt-BR');
            const statusClass = `status-${item.status}`; 
            
            let clientCellHtml = '';
            if (currentUser.role !== 'client') {
                clientCellHtml = `<td>${item.client_name || 'Desconhecido'}</td>`;
            }

            const conteudo = item.description || item.products || 'Sem descrição';

            htmlDasLinhas += `
                <tr>
                    <td>${date}</td>
                    <td style="font-weight:bold;">${item.code}</td>
                    ${clientCellHtml}
                    <td>${conteudo}</td>
                    <td><span class="status-badge ${statusClass}">${item.status}</span></td>
                </tr>
            `;
        });
        
        if (list.length > 100) {
            htmlDasLinhas += `<tr><td colspan="5" style="text-align:center; padding: 15px; color:#666; font-size:12px;">Mostrando os 100 registros mais recentes...</td></tr>`;
        }

        // Desenha de uma vez!
        tbody.innerHTML = htmlDasLinhas;
        
        const thClient = document.getElementById('hist-col-client');
        if(thClient) {
            thClient.style.display = (currentUser.role === 'client') ? 'none' : 'table-cell';
        }

    } catch (err) {
        console.error("Erro histórico:", err);
        tbody.innerHTML = '<tr><td colspan="5" align="center">Erro ao carregar histórico.</td></tr>';
    }
}
// Função de filtro para o Histórico
function filterHistory() {
    searchTable('history-search', 'history-list');
}
// ============================================================
// LÓGICA DE ETIQUETAS (LABELS) CORRIGIDA E COMPLETA (COM FILTRO DE LOTE)
// ============================================================
let labelsLimit = 50;

// PREENCHE A CAIXA DE LOTES NA ABA ETIQUETAS
async function loadLabelLots() {
    const select = document.getElementById('label-lot-filter');
    if (!select) return;
    try {
        const res = await fetch('/api/shipments/list'); // Puxa os embarques
        const lots = await res.json();
        
        let html = '<option value="">📦 Todos os Envios/Lotes</option>';
        lots.forEach(lot => {
            html += `<option value="${lot.id}">✈️ ${lot.code} - ${lot.type}</option>`;
        });
        select.innerHTML = html;
    } catch(e) {
        console.error("Erro ao carregar lotes para etiquetas:", e);
    }
}

// Carrega os lotes automaticamente ao abrir a página
document.addEventListener('DOMContentLoaded', () => {
    loadLabelLots();
});

// ============================================================
// LÓGICA DE ETIQUETAS (LABELS) COM FILTRO DE LOTE DINÂMICO
// ============================================================

async function loadLabels() {
    const tbody = document.getElementById('labels-list');
    if (!tbody) return; 

    tbody.innerHTML = '<tr><td colspan="6" align="center">Carregando etiquetas... <i class="fas fa-spinner fa-spin"></i></td></tr>';

    try {
        // Busca as Caixas e Encomendas
        const [resBoxes, resOrders] = await Promise.all([
            fetch('/api/boxes'),
            fetch('/api/orders')
        ]);

        const boxes = resBoxes.ok ? await resBoxes.json() : [];
        const orders = resOrders.ok ? await resOrders.json() : [];

        // ==========================================
        // 🧠 CÉREBRO DO FILTRO DE LOTES (IGUAL DA ABA BOX)
        // ==========================================
        const filterSelect = document.getElementById('label-lot-filter');
        const loteSelecionado = filterSelect ? filterSelect.value : '';

        // Aprende quais lotes existem olhando para as caixas e encomendas
        if (filterSelect) {
            const lotesCaixas = boxes.map(b => b.lote || 'Sem Lote');
            const lotesOrders = orders.map(o => o.lote || 'Sem Lote');
            
            // Junta tudo e tira os nomes repetidos
            const lotesUnicos = [...new Set([...lotesCaixas, ...lotesOrders])];

            let htmlFiltro = '<option value="">📦 Todos os Envios/Lotes</option>';
            lotesUnicos.sort().forEach(l => {
                htmlFiltro += `<option value="${l}">✈️ ${l}</option>`;
            });
            
            filterSelect.innerHTML = htmlFiltro;
            
            // Mantém selecionado o lote que você clicou
            if (lotesUnicos.includes(loteSelecionado) || loteSelecionado === '') {
                filterSelect.value = loteSelecionado;
            }
        }
        // ==========================================

        // Inverte a ordem das caixas para as mais novas ficarem no topo
        boxes.sort((a, b) => b.id - a.id);

        let htmlBuffer = '';
        let renderizados = 0;
        let totalValidos = 0;

        // PARTE 1: MOSTRAR AS CAIXAS (BOXES) PRIMEIRO
        for (let i = 0; i < boxes.length; i++) {
            const loteDaCaixa = boxes[i].lote || 'Sem Lote';
            
            // FREIO: Se tiver um lote selecionado e a caixa não for dele, pula ela!
            if (loteSelecionado !== '' && loteDaCaixa !== loteSelecionado) continue;

            totalValidos++;
            if (renderizados >= labelsLimit) continue;

            const box = boxes[i];
            const orderOriginal = orders.find(o => o.code === box.order_code) || {};
            
            const labelData = {
                id: box.id,
                box_code: box.box_code,
                code: box.order_code || 'SEM-REF',
                client_name: box.client_name || orderOriginal.client_name || 'Desconhecido',
                client_phone: orderOriginal.client_phone || 'Não informado',
                client_email: orderOriginal.client_email || 'Não informado',
                description: box.products || orderOriginal.description || 'Diversos',
                weight: box.order_weight || orderOriginal.weight || 0
            };

            const jsonStr = JSON.stringify(labelData).replace(/'/g, "&#39;").replace(/"/g, "&quot;");
            
            htmlBuffer += `
                <tr style="background-color: #f4f9ff; border-left: 4px solid #00b1ea;">
                    <td><input type="checkbox" class="label-check" value="box-${box.id}" data-obj='${jsonStr}'></td>
                    <td><span style="background:#0a1931; color:#fff; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:bold;">📦 BOX</span></td>
                    <td style="font-weight:bold; color:#d4af37;">${box.box_code}</td>
                    <td>${labelData.client_name} <br> <span style="font-size:11px; color:#666;">📞 ${labelData.client_phone} | ✉️ ${labelData.client_email}</span></td>
                    <td>${labelData.description}</td>
                    <td>${labelData.weight} kg</td>
                </tr>
            `;
            renderizados++;
        }

        // PARTE 2: MOSTRAR AS ENCOMENDAS SOLTAS DEPOIS
        const ordersWithoutBox = orders.filter(o => !boxes.some(b => b.order_code === o.code));
        ordersWithoutBox.sort((a, b) => b.id - a.id);

        for (let i = 0; i < ordersWithoutBox.length; i++) {
            const loteDaOrder = ordersWithoutBox[i].lote || 'Sem Lote';

            // FREIO: Se um lote estiver selecionado e a encomenda não for dele, pula ela!
            if (loteSelecionado !== '' && loteDaOrder !== loteSelecionado) continue;

            totalValidos++;
            if (renderizados >= labelsLimit) continue;

            const order = ordersWithoutBox[i];
            const date = new Date(order.created_at).toLocaleDateString('pt-BR');
            
            const labelData = {
                id: order.id,
                code: order.code,
                box_code: '', 
                client_name: order.client_name || 'Desconhecido',
                client_phone: order.client_phone || 'Não informado',
                client_email: order.client_email || 'Não informado',
                description: order.description || '---',
                weight: order.weight || 0
            };

            const orderJson = JSON.stringify(labelData).replace(/'/g, "&#39;").replace(/"/g, "&quot;");
            
            htmlBuffer += `
                <tr>
                    <td><input type="checkbox" class="label-check" value="ord-${order.id}" data-obj='${orderJson}'></td>
                    <td>${date}</td>
                    <td style="font-weight:bold;">${order.code}</td>
                    <td>${labelData.client_name} <br> <span style="font-size:11px; color:#666;">📞 ${labelData.client_phone} | ✉️ ${labelData.client_email}</span></td>
                    <td>${labelData.description}</td>
                    <td>${labelData.weight} kg</td>
                </tr>
            `;
            renderizados++;
        }

        // ADICIONA O BOTÃO "CARREGAR MAIS"
        if (totalValidos > labelsLimit) {
            htmlBuffer += `
            <tr>
                <td colspan="6" style="text-align:center; padding: 20px;">
                    <button onclick="loadMoreLabels()" style="background:#00b1ea; color:white; border:none; padding:10px 20px; border-radius:5px; cursor:pointer; font-weight:bold; width: 100%; max-width: 300px;">
                        <i class="fas fa-chevron-down"></i> Mostrar mais etiquetas...
                    </button>
                </td>
            </tr>`;
        }

        tbody.innerHTML = htmlBuffer;

    } catch (err) {
        console.error("Erro ao carregar etiquetas:", err);
        tbody.innerHTML = '<tr><td colspan="6" align="center" style="color:red;">Erro ao carregar dados. Verifique a conexão com o banco.</td></tr>';
    }
}

function loadMoreLabels() {
    labelsLimit += 50;
    loadLabels();
}

// 2. Selecionar Todos
function toggleAllLabels(source) {
    document.querySelectorAll('.label-check').forEach(c => c.checked = source.checked);
}

// 3. Filtro de pesquisa na tabela
function filterLabels() {
    const term = document.getElementById('label-search').value.toLowerCase();
    document.querySelectorAll('#labels-list tr').forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(term) ? '' : 'none';
    });
}

// 4. GERAR ETIQUETA EM PDF NATIVO COM CARIMBO DE ALTA DEFINIÇÃO E IMPRESSÃO DIRETA
async function printSelectedLabels() {
    const checked = document.querySelectorAll('.label-check:checked');
    if (checked.length === 0) return alert("Selecione pelo menos uma encomenda.");

    const box = checked[0]; 
    const data = JSON.parse(box.getAttribute('data-obj'));

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    let qtdVolumes = prompt(`Quantas sacolas/volumes tem a encomenda de ${data.client_name}? (Código: ${data.code})`, "1");
    if (qtdVolumes === null) return; 
    qtdVolumes = parseInt(qtdVolumes) || 1; 

    // Salva volumes no banco silenciosamente
    const itemType = box.value.startsWith('box-') ? 'box' : 'order';
    fetch('/api/update-volumes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: data.id, type: itemType, volumes: qtdVolumes })
    }).catch(e => console.error("Erro ao salvar volumes:", e));

    let nomeEscolhido = `Etiqueta_${data.code}.pdf`;
    if (isMobile) {
        nomeEscolhido = prompt("Digite o nome para salvar o PDF da etiqueta:", `Etiqueta_${data.code}`);
        if (nomeEscolhido === null || nomeEscolhido.trim() === "") return; 
        if (!nomeEscolhido.toLowerCase().endsWith('.pdf')) nomeEscolhido += '.pdf';
    }

    alert("Gerando a Etiqueta... Por favor, aguarde.");

    // ==========================================
    // 🛡️ MODO DEUS: DOWNLOAD BLINDADO (LINKS NOVOS - SEM ERRO 404)
    // ==========================================
    let ClassePDF = null;
    if (window['jspdf'] && window['jspdf']['jsPDF']) ClassePDF = window['jspdf']['jsPDF'];
    else if (window['jsPDF']) ClassePDF = window['jsPDF'];

    if (!ClassePDF) {
        console.warn("Forçando o download limpo do jsPDF pelos links oficiais...");
        const oldDefine = window.define;
        window.define = undefined; 

        try {
            await new Promise((resolve) => {
                const s = document.createElement('script');
                // Link oficial 1 (jsDelivr - NÃO É O CDNJS)
                s.src = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
                s.onload = resolve;
                s.onerror = () => {
                    // Link oficial 2 (Unpkg - Plano B)
                    const s2 = document.createElement('script');
                    s2.src = "https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js";
                    s2.onload = resolve;
                    document.head.appendChild(s2);
                };
                document.head.appendChild(s);
            });
            
            if (window['jspdf'] && window['jspdf']['jsPDF']) ClassePDF = window['jspdf']['jsPDF'];
            else if (window['jsPDF']) ClassePDF = window['jsPDF'];
        } catch(e) { console.error(e); }

        window.define = oldDefine;
    }

    if (!ClassePDF) return alert("Erro Crítico: O navegador bloqueou o PDF.");

    const doc = new ClassePDF({ orientation: 'portrait', unit: 'mm', format: [100, 151] });

    // ==========================================
    // CARREGA IMAGENS (APENAS A LOGO DO CABEÇALHO)
    // ==========================================
    let logoData = null;
    try {
        const img = new Image(); img.src = 'logo.png'; img.crossOrigin = 'Anonymous';
        await new Promise((resolve) => {
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width; canvas.height = img.height;
                canvas.getContext('2d').drawImage(img, 0, 0);
                logoData = canvas.toDataURL('image/png'); resolve();
            };
            img.onerror = resolve; 
        });
    } catch(e) {}

    // ==========================================
    // DESENHA A ETIQUETA
    // ==========================================
    for (let i = 1; i <= qtdVolumes; i++) {
        if (i > 1) doc.addPage();
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, 100, 151, 'F');

        if (logoData) doc.addImage(logoData, 'PNG', 5, 5, 18, 18); 
        
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("AGÊNCIA GUINEEXPRESS", 95, 9, { align: "right" });
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text("Av. Tristão Gonçalves, 1203", 95, 14, { align: "right" });
        doc.text("(85) 98239-207 / (85) 97175-853", 95, 18, { align: "right" });
        doc.text("CNPJ: 49.356.085/0001-34", 95, 22, { align: "right" });
        
        doc.setLineWidth(0.5);
        doc.line(5, 25, 95, 25);

        doc.setLineWidth(0.5);
        doc.setFillColor(255, 255, 255); 
        doc.roundedRect(5, 28, 90, 24, 2, 2, 'S'); 
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text("REMETENTE", 7, 32);
        doc.line(7, 33, 48, 33); 
        
        doc.setFontSize(14);
        doc.text(data.client_name || 'CLIENTE', 7, 40);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(`Tel: ${data.client_phone || '-'}`, 7, 46);
        doc.text(`Email: ${data.client_email ? data.client_email.substring(0, 35) : '-'}`, 7, 50);

        doc.setLineWidth(0.5);
        doc.roundedRect(5, 54, 43, 16, 2, 2, 'S');
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text("CÓDIGO DA ENCOMENDA", 26.5, 58, { align: "center" });
        doc.setFontSize(15);
        doc.text(data.code || '-', 26.5, 66, { align: "center" });

        doc.roundedRect(52, 54, 43, 16, 2, 2, 'S');
        doc.setFontSize(8);
        doc.text("PESO TOTAL", 73.5, 58, { align: "center" });
        doc.setFontSize(15);
        doc.text(`${data.weight} kg`, 73.5, 66, { align: "center" });

        doc.roundedRect(5, 72, 90, 50, 2, 2, 'S');
        doc.setFontSize(8);
        doc.text("CONTEÚDO / DESCRIÇÃO", 7, 76);
        doc.line(7, 77, 40, 77);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        let descText = data.description || 'Nenhum conteúdo informado.';
        let splitDesc = doc.splitTextToSize(descText, 86);
        doc.text(splitDesc, 7, 82);

        doc.line(5, 125, 95, 125); 
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("NÚMERO DA BOX", 5, 131);
        doc.setFontSize(22);
        doc.text(data.box_code || '---', 5, 142);

        doc.roundedRect(45, 128, 26, 17, 2, 2, 'S');
        doc.setFontSize(8);
        doc.text("VOLUME", 58, 132, { align: "center" });
        doc.setFontSize(18);
        doc.text(`${i}/${qtdVolumes}`, 58, 141, { align: "center" });

        const limparTexto = (texto) => {
            if (!texto) return 'N/A';
            return texto.normalize("NFD").replace(/[^a-zA-Z0-9 \-]/g, "").trim();
        };

        const nomeSeguro = limparTexto(data.client_name).substring(0, 20);
        const boxSegura = limparTexto(data.box_code).substring(0, 15);
        const codigoSeguro = limparTexto(data.code).substring(0, 15);

        const textoDoQR = `BOX:${boxSegura}|ENC:${codigoSeguro}|VOL:${i}/${qtdVolumes}|${nomeSeguro}`;

        const qrTemp = document.createElement('div');
        new QRCode(qrTemp, {
            text: textoDoQR,
            width: 100, height: 100,
            correctLevel : QRCode.CorrectLevel.L
        });
        
        await new Promise(resolve => setTimeout(resolve, 50));
        const qrCanvas = qrTemp.querySelector('canvas');
        if (qrCanvas) {
            const qrData = qrCanvas.toDataURL('image/png');
            doc.addImage(qrData, 'PNG', 75, 126.5, 20, 20);
        }
        
        // CÓDIGO DO CARIMBO (LOGO GRANDE) FOI REMOVIDO DAQUI
    }

    // ==========================================
    // IMPRESSÃO E DOWNLOAD GARANTIDOS
    // ==========================================
    if (isMobile) {
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = nomeEscolhido;
        document.body.appendChild(a);
        a.click(); 
        document.body.removeChild(a); 
        
        alert(`✅ O arquivo "${nomeEscolhido}" foi baixado!\n\nAbra o aplicativo Print Label e vá em 'Impressão de PDF' para imprimir.`);
    } else {
        doc.autoPrint(); 
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        
        const iframe = document.createElement('iframe');
        iframe.style.visibility = 'hidden'; 
        iframe.style.position = 'absolute';
        iframe.style.width = '1px';
        iframe.style.height = '1px';
        iframe.src = url;
        document.body.appendChild(iframe);
        
        iframe.onload = function() {
            setTimeout(function() {
                try {
                    iframe.contentWindow.focus();
                    iframe.contentWindow.print();
                } catch (err) {
                    console.warn("Navegador bloqueou a impressão, abrindo em nova aba...");
                    window.open(url, '_blank'); 
                }
            }, 800); 
        };
    }
}
// ==========================================
// 🗑️ APAGAR ETIQUETAS SELECIONADAS EM MASSA
// ==========================================
async function apagarEtiquetasSelecionadas() {
    const marcados = document.querySelectorAll('.label-check:checked');
    
    if (marcados.length === 0) {
        return alert("⚠️ Selecione pelo menos uma etiqueta para apagar.");
    }

    if (!confirm(`Tem a certeza que deseja ocultar/apagar estas ${marcados.length} etiquetas? Elas deixarão de pesar no sistema.`)) {
        return;
    }

    // Pega os IDs de tudo o que foi selecionado
    const itensParaApagar = [];
    marcados.forEach(checkbox => {
        const objData = JSON.parse(checkbox.getAttribute('data-obj'));
        const tipoItem = checkbox.value.startsWith('box-') ? 'box' : 'order';
        itensParaApagar.push({ id: objData.id, type: tipoItem });
    });

    try {
        const res = await fetch('/api/labels/bulk-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: itensParaApagar })
        });
        
        const data = await res.json();
        
        if (data.success) {
            alert("✅ Etiquetas apagadas com sucesso! O sistema vai ficar mais rápido.");
            
            // Desmarca a caixinha principal "Selecionar Todos"
            const chkTodos = document.querySelector('input[onclick="toggleAllLabels(this)"]');
            if(chkTodos) chkTodos.checked = false;
            
            loadLabels(); // Recarrega a tela limpa
        } else {
            alert("Erro ao apagar: " + data.message);
        }
    } catch (e) {
        console.error(e);
        alert("Erro de conexão com o servidor ao tentar apagar.");
    }
}
// ============================================================
// LÓGICA DE RECIBOS PROFISSIONAIS (COM FILTRO DE LOTE 🚀)
// ============================================================
let receiptsLimit = 50;

async function loadReceipts() {
    const list = document.getElementById('receipts-list');
    if (!list) return;

    list.innerHTML = '<tr><td colspan="6" align="center">Carregando recibos... <i class="fas fa-spinner fa-spin"></i></td></tr>';

    try {
        const response = await fetch('/api/boxes');
        let boxes = response.ok ? await response.json() : [];

        if (currentUser && currentUser.role === 'client') {
            boxes = boxes.filter(b => b.client_id === currentUser.id);
        }
          // 👇 A MÁGICA CORRIGIDA: O Administrador vê sempre tudo! Só esconde se for CLIENTE. 👇
if (currentUser && currentUser.role === 'client' && !window.verHistoricoCompleto) {
    boxes = boxes.filter(b => String(b.order_status).toLowerCase() !== 'entregue' && String(b.status).toLowerCase() !== 'entregue');
}
// 👆 ------------------------------------------ 👆
        
        if (boxes.length === 0) {
            list.innerHTML = '<tr><td colspan="6" align="center">Nenhum recibo disponível.</td></tr>';
            return;
        }

        // ==========================================
        // 🧠 CÉREBRO DO FILTRO DE LOTES (Aprende sozinho!)
        // ==========================================
        const filterSelect = document.getElementById('receipts-lot-filter');
        const loteSelecionado = filterSelect ? filterSelect.value : '';

        if (filterSelect) {
            // Aprende quais lotes existem nas caixas (boxes)
            const todosOsLotes = boxes.map(b => b.lote || 'Sem Lote');
            const lotesUnicos = [...new Set(todosOsLotes)];

            let htmlFiltro = '<option value="">📦 Todos os Envios/Lotes</option>';
            lotesUnicos.sort().forEach(l => {
                htmlFiltro += `<option value="${l}">✈️ ${l}</option>`;
            });
            
            filterSelect.innerHTML = htmlFiltro;
            
            // Mantém selecionado o lote que estava antes
            if (lotesUnicos.includes(loteSelecionado) || loteSelecionado === '') {
                filterSelect.value = loteSelecionado;
            }
        }
        // ==========================================

        boxes.sort((a, b) => b.id - a.id);

        let htmlBuffer = '';
        let renderizados = 0;
        let totalValidos = 0;

        for (let i = 0; i < boxes.length; i++) {
            const box = boxes[i];
            const loteDaCaixa = box.lote || 'Sem Lote';

            // MÁGICA DO FREIO: Se um lote estiver selecionado e a caixa não for dele, pula!
            if (loteSelecionado !== '' && loteDaCaixa !== loteSelecionado) continue;

            totalValidos++;
            
            if (renderizados >= receiptsLimit) continue; // Limite para não travar

            const peso = parseFloat(box.order_weight || 0);
            const freteEstimado = peso * globalPricePerKg;
            const valorFrete = parseFloat(box.freight_amount) || parseFloat(box.amount) || freteEstimado;
            const valorNf = parseFloat(box.nf_amount) || 0;
            const valorTotalCalculado = valorFrete + valorNf;

            const valorReais = valorTotalCalculado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const produtos = box.products || '---';
            
            let clientCol = '';
            if (currentUser && currentUser.role !== 'client') {
                clientCol = `<td>${box.client_name || 'Desconhecido'}</td>`;
            }

            htmlBuffer += `
                <tr>
                    <td><strong>#${box.box_code}</strong></td>
                    ${clientCol}
                    <td><small>${produtos.substring(0, 30)}...</small></td>
                    <td>${peso.toFixed(2)} kg</td>
                    <td style="font-weight:bold; color:#0a1931;">${valorReais}</td>
                    <td>
                        <button onclick="printReceipt(${box.id})" class="btn" style="background:#000; color:#d4af37; border:1px solid #d4af37; padding:5px 10px; font-size:11px; font-weight:bold;">
                            <i class="fas fa-print"></i> RECIBO
                        </button>
                    </td>
                </tr>
            `;
            renderizados++;
        }

        if (totalValidos > receiptsLimit) {
            htmlBuffer += `
            <tr>
                <td colspan="6" style="text-align:center; padding: 20px;">
                    <button onclick="loadMoreReceipts()" style="background:#00b1ea; color:white; border:none; padding:10px 20px; border-radius:5px; cursor:pointer; font-weight:bold; width: 100%; max-width: 300px;">
                        <i class="fas fa-chevron-down"></i> Mostrar recibos antigos...
                    </button>
                </td>
            </tr>`;
        }

        if (renderizados === 0) {
            list.innerHTML = '<tr><td colspan="6" align="center">Nenhum recibo encontrado para este envio.</td></tr>';
        } else {
            list.innerHTML = htmlBuffer;
        }
        
        const thClient = document.getElementById('rec-col-client');
        if(thClient && currentUser && currentUser.role === 'client') thClient.style.display = 'none';

    } catch (err) {
        console.error("Erro ao carregar recibos:", err);
        list.innerHTML = '<tr><td colspan="6" align="center" style="color:red;">Erro ao carregar dados.</td></tr>';
    }
}

function loadMoreReceipts() {
    receiptsLimit += 50;
    loadReceipts();
}

// ============================================================
// 5. GERAR RECIBO A4 (A SOLUÇÃO DEFINITIVA SEM TRAVAMENTOS)
// ============================================================
async function printReceipt(boxId) {
    let janelaRecibo = null;
    
    // Detecta se é celular. Celular não lida bem com abas fantasmas, vamos usar link direto!
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (!isMobile) {
        // No PC, tenta abrir a aba antes para evitar bloqueio do navegador
        janelaRecibo = window.open('', '_blank');
        if (janelaRecibo) {
            janelaRecibo.document.write('<h2 style="font-family:sans-serif; text-align:center; margin-top:50px; color:#0a1931;">Gerando seu recibo... Por favor, aguarde ⏳</h2>');
        }
    }

    try {
        const res = await fetch(`/api/receipt-data/${boxId}`); 
        const response = await res.json();
        
        if (!response.success) {
            if(janelaRecibo) janelaRecibo.close();
            return alert("Erro ao buscar dados do recibo: " + (response.msg || 'Erro desconhecido'));
        }

        const d = response.data;

        // Cálculos Financeiros
        const nfVal = parseFloat(d.nf_amount) || 0;
        const freteVal = parseFloat(d.freight_amount) || parseFloat(d.amount) || 0; 
        const totalVal = freteVal + nfVal;

        const valorFreteReais = freteVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const valorNfReais = nfVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const valorTotalReais = totalVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        const dataHoje = new Date().toLocaleDateString('pt-BR');
        const stampStatus = d.is_paid ? 'PAGO' : 'PENDENTE';
        
        const stampColor = d.is_paid ? 'rgba(40, 167, 69, 0.25)' : 'rgba(220, 53, 69, 0.25)';
        const stampBorder = d.is_paid ? 'rgba(40, 167, 69, 0.4)' : 'rgba(216, 30, 49, 0.4)';

        // MONTANDO O HTML EXCLUSIVO DA IMPRESSÃO
        const receiptHTML = `
            <!DOCTYPE html>
            <html lang="pt">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Recibo Guineexpress - ${d.box_code}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;900&family=Roboto:wght@400;500;700&display=swap');
                    
                    :root { --azul-oficial: #0a1931; --dourado-luxo: #dfaf12; --vermelho-total: #d32f2f; --fundo-cards: #f4f6f9; --texto-escuro: #28425c; --borda-clara: #e1e8ed; }
                    body { font-family: 'Roboto', sans-serif; color: var(--texto-escuro); margin: 0; padding: 15px; background: #fff; }
                    .document-wrapper { border: 1px solid var(--borda-clara); padding: 25px; border-radius: 10px; position: relative; overflow: hidden; min-height: 950px; }
                    .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-35deg); font-size: 130px; font-family: 'Nunito', sans-serif; font-weight: 900; color: ${stampColor}; border: 8px solid ${stampBorder}; padding: 15px 60px; text-transform: uppercase; z-index: 9999; border-radius: 20px; pointer-events: none; letter-spacing: 10px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    .header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 20px; border-bottom: 3px solid var(--fundo-cards); margin-bottom: 20px; }
                    .header-brand { display: flex; align-items: center; gap: 20px; }
                    .header-brand img { width: 90px; height: 90px; object-fit: contain; }
                    .brand-text h1 { margin: 0; font-family: 'Nunito', sans-serif; font-size: 28px; color: var(--azul-oficial); font-weight: 900; letter-spacing: 1.5px;}
                    .brand-text p { margin: 3px 0 0 0; font-size: 11px; font-weight: 700; color: var(--dourado-luxo); letter-spacing: 0.5px;}
                    .header-contact { text-align: right; font-size: 11px; line-height: 1.6; color: #695a5a; }
                    .header-contact strong { color: var(--azul-oficial); font-size: 12px; }
                    .title-bar { background: var(--azul-oficial); color: #fff; border-radius: 8px; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; box-shadow: 0 4px 10px rgba(10, 25, 49, 0.15); -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    .title-bar h2 { margin: 0; font-family: 'Nunito', sans-serif; font-size: 20px; color: var(--dourado-luxo); font-weight: 900; }
                    .title-info { display: flex; gap: 20px; }
                    .info-badge { border-left: 2px solid rgba(121, 85, 85, 0.2); padding-left: 15px; }
                    .info-badge span { display: block; font-size: 9px; color: var(--dourado-luxo); text-transform: uppercase; font-weight: 700; margin-bottom: 4px; }
                    .info-badge strong { font-size: 14px; letter-spacing: 0.5px; }
                    .cards-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 25px; }
                    .info-card { background: var(--fundo-cards); border-radius: 8px; border-top: 4px solid var(--azul-oficial); padding: 15px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    .info-card h3 { margin: 0 0 12px 0; font-size: 13px; color: var(--azul-oficial); text-transform: uppercase; font-weight: 800; }
                    .data-row { display: flex; justify-content: space-between; border-bottom: 1px dashed var(--borda-clara); padding: 6px 0; font-size: 11px; }
                    .data-row:last-child { border-bottom: none; }
                    .data-row span:first-child { font-weight: 700; color: #666; }
                    .data-row span:last-child { font-weight: 600; color: var(--texto-escuro); text-align: right; }
                    .alert-receiver { background: #fff3cd; border: 1px solid #ffeeba; color: #856404; padding: 8px; border-radius: 6px; margin-top: 8px; font-size: 11px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    .alert-receiver strong { color: #d32f2f; display: block; margin-bottom: 4px; font-size: 11px; }
                    .table-container { border-radius: 8px; overflow: hidden; border: 1px solid var(--borda-clara); margin-bottom: 30px; }
                    table { width: 100%; border-collapse: collapse; }
                    th { background: var(--azul-oficial); color: var(--dourado-luxo); padding: 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    th:not(:first-child) { text-align: center; }
                    th:first-child { text-align: left; }
                    td { padding: 12px; font-size: 12px; border-bottom: 1px solid var(--borda-clara); }
                    td:not(:first-child) { text-align: center; font-weight: 600; }
                    tr:nth-child(even) { background-color: #fafbfc; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    .service-title { font-weight: 700; color: var(--azul-oficial); display: block; margin-bottom: 4px; font-size: 13px;}
                    .service-desc { font-size: 11px; color: #5c4242; }
                    .checkout-area { text-align: right; margin-top: 20px; margin-bottom: 40px; width: 100%; }
                    .totals-box { display: inline-block; width: 320px; }
                    .total-pill { background-color: #d32f2f; color: #fff; padding: 12px 25px; border-radius: 30px; width: 100%; box-sizing: border-box; box-shadow: 0 5px 15px rgba(211, 47, 47, 0.3); display: table; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    .total-pill span { display: table-cell; vertical-align: middle; }
                    .total-pill-left { text-align: left; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
                    .total-pill-right { text-align: right; font-size: 22px; font-weight: 900; }
                    .footer-terms { text-align: center; font-size: 11px; color: #886e6e; margin-bottom: 50px; padding: 0 40px; font-style: italic; }
                    .signatures { display: flex; justify-content: space-around; margin-top: 50px; padding-bottom: 20px; }
                    .sign-box { width: 40%; text-align: center; }
                    .sign-line { border-bottom: 1px solid var(--texto-escuro); margin-bottom: 8px; height: 30px; }
                    .sign-box span { font-size: 12px; font-weight: 700; color: var(--texto-escuro); }
                    @media print { body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } @page { size: A4 portrait; margin: 5mm; } }
                </style>
            </head>
            <body>
                <div class="document-wrapper">
                    <div class="watermark">${stampStatus}</div>

                    <div class="header">
                        <div class="header-brand">
                            <img src="${window.location.origin}/logo.png" alt="Logo">
                            <div class="brand-text">
                                <h1>GUINEEXPRESS</h1>
                                <p>AGENCIA DE LOGÍSTICA INTERNACIONAL</p>
                            </div>
                        </div>
                        <div class="header-contact">
                            <strong>Av. Tristão Gonçalves, 1203</strong><br>
                            Centro - Fortaleza / CE<br>
                            (85) 98239-207<br>
                            Comercialguineexpress245@gmail.com
                        </div>
                    </div>

                    <div class="title-bar">
                        <h2>RECIBO DE ENCOMENDA</h2>
                        <div class="title-info">
                            <div class="info-badge">
                                <span>Box Nº</span>
                                <strong>${d.box_code || '1'}</strong>
                            </div>
                            <div class="info-badge">
                                <span>Ref</span>
                                <strong>${d.order_code || '-'}</strong>
                            </div>
                            <div class="info-badge">
                                <span>Emissão</span>
                                <strong>${dataHoje}</strong>
                            </div>
                        </div>
                    </div>

                    <div class="cards-grid">
                        <div class="info-card">
                            <h3>DADOS DO CLIENTE</h3>
                            <div class="data-row"><span>Nome:</span> <span>${d.client_name || 'Cliente'}</span></div>
                            <div class="data-row"><span>Telefone:</span> <span>${d.phone || '-'}</span></div>
                            <div class="data-row"><span>Documento:</span> <span>${d.document || '-'}</span></div>
                            <div class="data-row"><span>Email:</span> <span>${d.email || '-'}</span></div>
                        </div>

                        <div class="info-card">
                            <h3>DADOS DO ENVIO</h3>
                            <div class="data-row"><span>Destino:</span> <span>Guiné-Bissau</span></div>
                            <div class="data-row"><span>Ref. Encomenda:</span> <span>${d.order_code || '-'}</span></div>
                            <div class="data-row"><span>Peso:</span> <span>${d.weight || '0'} kg</span></div>
                            <div class="data-row"><span>Volumes (Qtd):</span> <span>${d.volumes || '1'} volume(s)</span></div>
                            <div class="data-row"><span>Status:</span> <span>${d.order_status || 'Processando'}</span></div>
                        </div>

                        <div class="info-card">
                            <h3>RETIRADA EM GUINÉ-BISSAU</h3>
                            <div class="data-row"><span>Local:</span> <span>Rotunda de Nhonho</span></div>
                            <div class="data-row"><span>Bairro:</span> <span>Belem</span></div>
                            <div class="data-row"><span>Contato:</span> <span>+245 956604423</span></div>
                            <div class="alert-receiver">
                                <strong>AUTORIZADO A RETIRAR:</strong>
                                👤 Nome: ${d.receiver_name ? d.receiver_name : 'O Próprio Cliente'}<br>
                                📄 Bilhete: ${d.receiver_doc ? d.receiver_doc : '-'}
                            </div>
                        </div>
                    </div>

                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>DESCRIÇÃO DOS SERVIÇOS</th>
                                    <th style="width: 120px;">PESO</th>
                                    <th style="width: 150px; text-align:right; padding-right:20px;">VALOR</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>
                                        <span class="service-title">Frete Aéreo/Marítimo Internacional</span>
                                        <span class="service-desc">Conteúdo: ${d.products || 'Diversos'}</span>
                                    </td>
                                    <td>${d.weight || '0'} kg</td>
                                    <td style="text-align:right; padding-right:20px;">${valorFreteReais}</td>
                                </tr>
                                <tr>
                                    <td>
                                        <span class="service-title">Taxa de Despacho / Nota Fiscal</span>
                                        <span class="service-desc">Impostos e taxas aduaneiras</span>
                                    </td>
                                    <td>-</td>
                                    <td style="text-align:right; padding-right:20px;">${valorNfReais}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div class="checkout-area">
                        <div class="totals-box">
                            <div class="total-pill">
                                <span class="total-pill-left">TOTAL A PAGAR:</span>
                                <span class="total-pill-right">${valorTotalReais}</span>
                            </div>
                        </div>
                    </div>

                    <div class="footer-terms">
                        Declaro que os itens acima listados foram conferidos na minha presença.<br>
                        A Guineexpress não se responsabiliza por itens não conferidos no local da retirada.
                    </div>

                    <div class="signatures">
                        <div class="sign-box">
                            <div class="sign-line"></div>
                            <span>GUINEEXPRESS LOGÍSTICA</span>
                        </div>
                        <div class="sign-box">
                            <div class="sign-line"></div>
                            <span>ASSINATURA DO CLIENTE</span>
                        </div>
                    </div>
                </div>

                <script>
                    window.onload = function() {
                        setTimeout(() => { window.print(); }, 800);
                    };
                </script>
            </body>
            </html>
        `;

        if (janelaRecibo) {
            // Se abriu a aba no PC
            janelaRecibo.document.open();
            janelaRecibo.document.write(receiptHTML);
            janelaRecibo.document.close();
        } else {
            // 🚀 TRUQUE SUPREMO PARA O CELULAR (BLOB URL DIRETO)
            // Transforma o HTML numa página web real na hora e MUDA a tela atual do cliente!
            // O cliente vai ver o recibo em tela cheia, vai gerar o PDF, e depois é só ele apertar "Voltar" no celular.
            const blob = new Blob([receiptHTML], { type: 'text/html;charset=utf-8' });
            const blobUrl = URL.createObjectURL(blob);
            window.location.href = blobUrl;
        }

    } catch (e) {
        console.error(e);
        if (janelaRecibo) janelaRecibo.close();
        alert("Erro de conexão ao tentar gerar o recibo.");
    }
}
// ==========================================
// LÓGICA DO DASHBOARD (GRÁFICOS REAIS)
// ==========================================
let chartRevenue = null;
let chartStatus = null;

async function loadDashboardStats() {
    // Verifica se o elemento existe (evita erro se não for admin)
    if (!document.getElementById('revenueChart')) return;

    try {
        const res = await fetch('/api/dashboard-stats');
        const response = await res.json();
        
        if (!response.success) return;

        const d = response.data;

        // 1. Atualiza os Cards (KPIs)
        if(document.getElementById('kpi-revenue')) 
            document.getElementById('kpi-revenue').innerText = parseFloat(d.revenue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        if(document.getElementById('kpi-weight')) 
            document.getElementById('kpi-weight').innerText = parseFloat(d.weight).toFixed(2) + ' kg';
        
        if(document.getElementById('kpi-orders')) 
            document.getElementById('kpi-orders').innerText = d.totalOrders;
        
        if(document.getElementById('kpi-clients')) 
            document.getElementById('kpi-clients').innerText = d.totalClients;

        // 2. Gráfico de Status (Rosca)
        const statusLabels = d.statusDistribution.map(i => i.status);
        const statusData = d.statusDistribution.map(i => i.count);
        // Cores fixas para status conhecidos, cinza para outros
        const statusColors = statusLabels.map(s => {
            if(s.includes('Pendente')) return '#ffc107'; // Amarelo
            if(s.includes('Entregue')) return '#28a745'; // Verde
            if(s.includes('Enviado') || s.includes('Trânsito')) return '#007bff'; // Azul
            if(s.includes('Recebido')) return '#17a2b8'; // Turquesa
            return '#6c757d'; // Cinza
        });

        const ctxStatus = document.getElementById('statusChart').getContext('2d');
        if (chartStatus) chartStatus.destroy();

        chartStatus = new Chart(ctxStatus, {
            type: 'doughnut',
            data: {
                labels: statusLabels,
                datasets: [{
                    data: statusData,
                    backgroundColor: statusColors,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 10 } } }
            }
        });

        // 3. Gráfico Financeiro (Barras Reais)
        const ctxRevenue = document.getElementById('revenueChart').getContext('2d');
        if (chartRevenue) chartRevenue.destroy();

        // Extrai dados da API
        const months = d.revenueHistory.map(item => item.month); // Ex: ['01/2024', '02/2024']
        const values = d.revenueHistory.map(item => item.total);

        // Se não tiver dados, cria um mock vazio para não ficar feio
        const finalLabels = months.length ? months : ['Sem Dados'];
        const finalData = months.length ? values : [0];

        chartRevenue = new Chart(ctxRevenue, {
            type: 'bar',
            data: {
                labels: finalLabels,
                datasets: [{
                    label: 'Faturamento (R$)',
                    data: finalData,
                    backgroundColor: '#0a1931',
                    borderRadius: 4,
                    barThickness: 40
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { 
                        beginAtZero: true,
                        ticks: { callback: (val) => 'R$ ' + val } // Formata eixo Y
                    }
                }
            }
        });

    } catch (err) {
        console.error("Erro ao carregar dashboard:", err);
    }
}
// ==========================================
// FUNÇÃO DE BACKUP MANUAL
// ==========================================
async function forceBackup() {
    if (!confirm("Deseja criar uma cópia de segurança do banco de dados agora?")) return;

    try {
        const btn = document.querySelector('button[onclick="forceBackup()"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
        
        const res = await fetch('/api/admin/force-backup');
        const data = await res.json();

        if (data.success) {
            alert("✅ " + data.msg);
        } else {
            alert("❌ Erro: " + data.msg);
        }

        btn.innerHTML = originalText;

    } catch (err) {
        console.error(err);
        alert("Erro ao conectar com servidor.");
    }
}
// ==========================================
// LÓGICA DE DESPESAS
// ==========================================

async function loadExpenses() {
    // 1. Carrega a Lista
    const res = await fetch('/api/expenses/list');
    const list = await res.json();
    const tbody = document.getElementById('expenses-list');
    
    if(tbody) {
        tbody.innerHTML = '';
        list.forEach(e => {
            const val = parseFloat(e.amount).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
            const date = new Date(e.date).toLocaleDateString('pt-BR');
            tbody.innerHTML += `
                <tr>
                    <td>${date}</td>
                    <td>${e.description}</td>
                    <td><span class="status-badge" style="background:#eee; color:#333;">${e.category}</span></td>
                    <td style="color:red; font-weight:bold;">- ${val}</td>
                    <td><button onclick="deleteExpense(${e.id})" style="color:red; border:none; cursor:pointer;">X</button></td>
                </tr>
            `;
        });
    }

    // 2. Carrega o Relatório Financeiro (Cards Coloridos)
    const resFin = await fetch('/api/financial-report');
    const fin = await resFin.json();

    if(document.getElementById('fin-revenue')) {
        document.getElementById('fin-revenue').innerText = parseFloat(fin.revenue).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        document.getElementById('fin-expenses').innerText = parseFloat(fin.expenses).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        
        const profitEl = document.getElementById('fin-profit');
        profitEl.innerText = parseFloat(fin.profit).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        
        // Se prejuízo, fica vermelho. Se lucro, verde.
        profitEl.style.color = fin.profit >= 0 ? '#28a745' : '#dc3545';
    }
}

async function addExpense(e) {
    e.preventDefault();
    const data = {
        description: document.getElementById('exp-desc').value,
        category: document.getElementById('exp-cat').value,
        amount: document.getElementById('exp-amount').value,
        date: document.getElementById('exp-date').value
    };

    if(!confirm(`Registrar saída de R$ ${data.amount}?`)) return;

    await fetch('/api/expenses/add', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)
    });
    
    document.getElementById('exp-desc').value = '';
    document.getElementById('exp-amount').value = '';
    loadExpenses();
}

async function deleteExpense(id) {
    if(!confirm('Apagar este registro?')) return;
    await fetch('/api/expenses/delete', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id})
    });
    loadExpenses();
}
// --- FUNÇÃO CORRIGIDA: Ler Logs de Auditoria ---
async function loadSystemLogs() {
    const list = document.getElementById('logs-list');
    if(!list) return;

    list.innerHTML = '<tr><td colspan="4" class="text-center">Carregando auditoria...</td></tr>';

    try {
        const res = await fetch('/api/admin/logs');
        const logs = await res.json();

        if (!logs || logs.length === 0) {
            list.innerHTML = '<tr><td colspan="4" class="text-center">Nenhum registro encontrado.</td></tr>';
            return;
        }

        list.innerHTML = logs.map(log => {
            // Formata a data
            const date = new Date(log.created_at).toLocaleString('pt-BR');
            
            // Define cor baseada na ação
            let color = '#333';
            let bg = '#eee';
            
            if(log.action === 'EXCLUSÃO') { color = '#721c24'; bg = '#f8d7da'; } // Vermelho
            if(log.action === 'CRIACAO')  { color = '#155724'; bg = '#d4edda'; } // Verde
            if(log.action === 'LOGIN')    { color = '#004085'; bg = '#cce5ff'; } // Azul

            return `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px; font-size: 12px; color: #666;">${date}</td>
                    <td style="padding: 10px; font-weight: bold;">${log.user_name || 'Sistema'}</td>
                    <td style="padding: 10px;">
                        <span style="background: ${bg}; color: ${color}; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">
                            ${log.action}
                        </span>
                    </td>
                    <td style="padding: 10px; font-size: 13px;">${log.details}</td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error(error);
        list.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Erro ao carregar logs.</td></tr>';
    }
}
// ==========================================
// LÓGICA DE EMBARQUES (MANIFESTO)
// ==========================================

async function loadShipments() {
    // 1. Carrega Embarques Existentes
    const res = await fetch('/api/shipments/list');
    const shipments = await res.json();
    
    const table = document.getElementById('shipments-list');
    const select = document.getElementById('target-shipment');
    
    table.innerHTML = '';
    select.innerHTML = '<option value="">-- Selecione para Adicionar --</option>';

    shipments.forEach(s => {
        // Preenche Tabela
        table.innerHTML += `
            <tr>
                <td><strong>${s.code}</strong></td>
                <td>${s.type}</td>
                <td>${new Date(s.departure_date).toLocaleDateString('pt-GB')}</td>
                <td>${s.box_count} caixas</td>
                <td>
                    <button onclick="printManifest(${s.id})" class="btn" style="padding: 5px 10px; font-size: 11px; background: #0a1931;">
                        <i class="fas fa-file-alt"></i> MANIFESTO
                    </button>
                </td>
            </tr>
        `;
        
        // Preenche Select (Apenas se estiver Aberto)
        if(s.status === 'Aberto') {
            select.innerHTML += `<option value="${s.id}">${s.code} (${s.type})</option>`;
        }
    });

    // 2. Carrega Caixas Pendentes (Sem lote)
    const resBoxes = await fetch('/api/shipments/pending-boxes');
    const boxes = await resBoxes.json();
    const list = document.getElementById('pending-boxes-list');
    
    list.innerHTML = '';
    if(boxes.length === 0) list.innerHTML = '<li style="padding:10px; text-align:center; color:#777;">Nenhuma caixa pendente.</li>';

    boxes.forEach(b => {
        list.innerHTML += `
            <li style="background: white; padding: 10px; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>${b.box_code}</strong><br>
                    <small>${b.client_name}</small>
                </div>
                <button onclick="addToShipment(${b.id})" style="background: #28a745; color: white; border: none; border-radius: 50%; width: 25px; height: 25px; cursor: pointer;">+</button>
            </li>
        `;
    });
}

// Criar Embarque
async function createShipment(e) {
    e.preventDefault();
    const data = {
        code: document.getElementById('ship-code').value,
        type: document.getElementById('ship-type').value,
        departure_date: document.getElementById('ship-date').value
    };
    
    await fetch('/api/shipments/create', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)
    });
    
    loadShipments();
}

// Adicionar Caixa ao Lote Selecionado
async function addToShipment(boxId) {
    const shipId = document.getElementById('target-shipment').value;
    if(!shipId) return alert("Selecione um Lote de Destino no menu acima primeiro!");

    await fetch('/api/shipments/add-box', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ shipment_id: shipId, box_id: boxId })
    });
    
    loadShipments(); // Recarrega tudo
}

// GERAR PDF DO MANIFESTO
async function printManifest(shipId) {
    const res = await fetch(`/api/shipments/manifest/${shipId}`);
    const data = await res.json();
    if(!data.success) return alert("Erro ao carregar dados.");

    const s = data.shipment;
    const items = data.items;
    let totalWeight = 0;

    // Gera linhas da tabela
    let rowsHtml = '';
    items.forEach((item, index) => {
        const w = parseFloat(item.weight || 0);
        totalWeight += w;
        rowsHtml += `
            <tr style="border-bottom: 1px solid #ccc;">
                <td style="padding: 8px; text-align: center;">${index + 1}</td>
                <td style="padding: 8px;">${item.box_code}</td>
                <td style="padding: 8px;">${item.client_name}<br><small>Doc: ${item.document || '-'}</small></td>
                <td style="padding: 8px;">${item.country}</td>
                <td style="padding: 8px; font-size: 11px;">${item.products.substring(0, 50)}</td>
                <td style="padding: 8px; text-align: center;">${w.toFixed(2)} kg</td>
            </tr>
        `;
    });

    const printArea = document.getElementById('print-area');
    printArea.innerHTML = `
        <div class="print-container">
            <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px;">
                <h1 style="margin: 0;">GUINEEXPRESS LOGÍSTICA</h1>
                <h2 style="margin: 5px 0;">MANIFESTO DE CARGA INTERNACIONAL</h2>
                <p style="margin: 0;">LOTE: <strong>${s.code}</strong> | TIPO: ${s.type.toUpperCase()}</p>
                <p style="margin: 0; font-size: 12px;">Saída: ${new Date(s.departure_date).toLocaleDateString('pt-BR')} | Total Volumes: ${items.length}</p>
            </div>

            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                <thead>
                    <tr style="background: #eee; font-weight: bold;">
                        <th style="border: 1px solid #000; padding: 5px;">#</th>
                        <th style="border: 1px solid #000; padding: 5px;">BOX ID</th>
                        <th style="border: 1px solid #000; padding: 5px;">DESTINATÁRIO</th>
                        <th style="border: 1px solid #000; padding: 5px;">DESTINO</th>
                        <th style="border: 1px solid #000; padding: 5px;">CONTEÚDO</th>
                        <th style="border: 1px solid #000; padding: 5px;">PESO</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
                <tfoot>
                    <tr style="background: #000; color: #fff; font-weight: bold;">
                        <td colspan="5" style="text-align: right; padding: 8px;">PESO TOTAL EMBARCADO:</td>
                        <td style="padding: 8px; text-align: center;">${totalWeight.toFixed(2)} kg</td>
                    </tr>
                </tfoot>
            </table>

            <br><br>
            <div style="text-align: center; font-size: 10px;">
                <p>Certifico que este manifesto representa fielmente a carga consolidada neste lote.</p>
                <br>
                __________________________________________<br>
                Assinatura Responsável Guineexpress
            </div>
        </div>
    `;

    setTimeout(() => { window.print(); }, 500);
}
// --- FUNÇÃO: EXCLUIR ENCOMENDA ---
async function deleteOrder(id) {
    if (!confirm("⚠️ Tem certeza que deseja EXCLUIR esta encomenda? Essa ação não pode ser desfeita.")) {
        return;
    }

    try {
        const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' });
        const data = await res.json();

        if (data.success) {
            alert("✅ Encomenda excluída!");
            loadOrders(); // Recarrega a tabela
        } else {
            alert("Erro ao excluir: " + data.message);
        }
    } catch (error) {
        console.error(error);
        alert("Erro de conexão.");
    }
}

// ==========================================
// FUNÇÕES DE EDIÇÃO E EXCLUSÃO
// ==========================================

// 1. Prepara o Modal para NOVA encomenda (Limpa tudo)
function prepareNewOrder() {
    document.getElementById('new-order-form').reset();
    document.getElementById('editing-order-id').value = ''; 
    document.getElementById('modal-order-title').innerText = '📦 Nova Encomenda';
    
    loadClientsToSelect(); // Carrega a lista de clientes
    openModal('modal-order');
}

// 2. Prepara o Modal para EDITAR encomenda (Preenche dados)
async function editOrder(id) {
    try {
        await loadClientsToSelect(); // Garante que a lista de clientes esteja carregada

        const res = await fetch(`/api/orders/${id}`);
        const order = await res.json();

        if (!order) return alert('Encomenda não encontrada!');

        // Preenche o formulário com os dados do banco
        document.getElementById('editing-order-id').value = order.id;
        document.getElementById('order-code').value = order.code || '';
        document.getElementById('order-desc').value = order.description || '';
        document.getElementById('order-weight').value = order.weight || '';
        document.getElementById('order-status').value = order.status || 'Processando';
        document.getElementById('order-client-select').value = order.client_id || '';
        
        // 👇 AQUI ESTAVA FALTANDO O LOTE 👇
        document.getElementById('order-lote').value = order.lote || 'Sem Lote'; 

        // Muda título e abre
        document.getElementById('modal-order-title').innerText = '✏️ Editar Encomenda';
        openModal('modal-order');

    } catch (error) {
        console.error(error);
        alert('Erro ao carregar dados.');
    }
}
// 3. Função EXCLUIR
async function deleteOrder(id) {
    if (!confirm("⚠️ Tem certeza que deseja EXCLUIR esta encomenda?")) return;

    try {
        const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' });
        const data = await res.json();

        if (data.success) {
            alert("✅ Excluído com sucesso!");
            loadOrders(); // Recarrega a tabela
        } else {
            alert("Erro ao excluir.");
        }
    } catch (error) {
        alert("Erro de conexão.");
    }
}

// 3. Salva a Encomenda (Detecta se é Nova ou Edição)
async function handleOrderSubmit(event) {
    event.preventDefault();

    const id = document.getElementById('editing-order-id').value;
    const lote = document.getElementById('order-lote').value;
    const client_id = document.getElementById('order-client-select').value;
    const code = document.getElementById('order-code').value;
    const description = document.getElementById('order-desc').value;
    const weight = document.getElementById('order-weight').value;
    const status = document.getElementById('order-status').value;

    const payload = {
        lote: lote,
        client_id: client_id,
        code: code,
        description: description,
        weight: weight,
        status: status
    };

    try {
        let res;
        
        if (id) {
            // Rota de Edição
            res = await fetch(`/api/orders/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            // ✨ CORREÇÃO AQUI: Mudamos de '/api/orders' para '/api/orders/create'
            res = await fetch('/api/orders/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        const data = await res.json();
        
        if (data.success) {
            alert("✅ Encomenda salva com sucesso!");
            closeModal('modal-order');
            if (typeof loadOrders === 'function') loadOrders(); 
        } else {
            alert("Erro ao salvar: " + (data.msg || "Verifique os dados."));
        }
    } catch (error) {
        console.error("Erro na requisição:", error);
        alert("Erro de conexão ao tentar salvar.");
    }
}

// --- FUNÇÃO AUXILIAR: ATUALIZAR ENCOMENDA (PUT) ---
async function updateOrder(id) {
    const data = {
        client_id: document.getElementById('order-client-select').value,
        code: document.getElementById('order-code').value,
        description: document.getElementById('order-desc').value,
        weight: document.getElementById('order-weight').value,
        status: document.getElementById('order-status').value,
        // ENVIANDO O LOTE PARA O BACKEND
        lote: document.getElementById('order-lote') ? document.getElementById('order-lote').value : 'Sem Lote'
    };

    try {
        const res = await fetch(`/api/orders/${id}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        
        const json = await res.json();
        if(json.success) {
            alert("✅ Atualizado com sucesso!");
            closeModal('modal-order');
            loadOrders();
        } else {
            alert("Erro: " + json.message);
        }
    } catch (e) {
        alert("Erro de conexão.");
    }
}

// --- FUNÇÃO AUXILIAR: CARREGAR CLIENTES NO SELECT DE EDIÇÃO ---
async function loadClientsToSelect() {
    const sel = document.getElementById('order-client-select');
    if(!sel) return;
    
    // Se já tiver opções carregadas (mais de 1), não recarrega para economizar dados
    if(sel.options.length > 1) return;

    try {
        const res = await fetch('/api/clients');
        const list = await res.json();
        
        sel.innerHTML = '<option value="">Selecione o Cliente...</option>';
        list.forEach(c => {
            sel.innerHTML += `<option value="${c.id}">${c.name}</option>`;
        });
    } catch (e) {
        console.error("Erro ao carregar lista de clientes para edição:", e);
    }
}


// --- FUNÇÃO: Carregar Lista de Funcionários ---
async function loadEmployees() {
    try {
        const res = await fetch('/api/admin/employees');
        const data = await res.json();
        const list = document.getElementById('employees-list');
        
        // Se a lista não existir no HTML (ex: painel do cliente), para a função
        if (!list) return;

        list.innerHTML = '';

        if (!data.success || !data.employees || data.employees.length === 0) {
            list.innerHTML = '<tr><td colspan="4" style="text-align:center;">Nenhum funcionário encontrado.</td></tr>';
            return;
        }

        data.employees.forEach(emp => {
            const isActive = emp.active === 1;
            // Configuração visual do Status
            const statusLabel = isActive 
                ? '<span style="color: green; font-weight: bold;">Ativo</span>' 
                : '<span style="color: red; font-weight: bold;">Bloqueado</span>';
            
            const btnColor = isActive ? '#dc3545' : '#28a745'; // Vermelho p/ desativar, Verde p/ ativar
            const btnText = isActive ? 'Bloquear' : 'Ativar';
            const newStatus = isActive ? 0 : 1;

            const row = `
                <tr>
                    <td>${emp.name}</td>
                    <td>${emp.email}</td>
                    <td>${statusLabel}</td>
                    <td>
                        <button onclick="toggleEmployee(${emp.id}, ${newStatus})" 
                                class="btn" 
                                style="padding: 5px 10px; font-size: 12px; background-color: ${btnColor}; color: white;">
                            ${btnText}
                        </button>
                    </td>
                </tr>
            `;
            list.innerHTML += row;
        });

    } catch (error) {
        console.error("Erro ao carregar funcionários:", error);
    }
}

// --- FUNÇÃO: Botão de Ativar/Desativar Funcionário ---
async function toggleEmployee(id, newStatus) {
    const action = newStatus === 0 ? "BLOQUEAR" : "REATIVAR";
    if(!confirm(`Tem certeza que deseja ${action} o acesso deste funcionário?`)) {
        return;
    }

    try {
        const res = await fetch('/api/admin/toggle-employee', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, active: newStatus })
        });
        
        const data = await res.json();
        
        if (data.success) {
            loadEmployees(); // Recarrega a tabela para ver a mudança
        } else {
            alert("Erro ao alterar status.");
        }
    } catch (error) {
        console.error(error);
        alert("Erro de conexão.");
    }
}
/* =========================================
   SISTEMA DE CÂMERA (ENTREGA & AVARIA)
   ========================================= */
const DeliveryProof = {
    stream: null,
    capturedImage: null,
    pendingOrderId: null,
    currentMode: 'delivery', // 'delivery' ou 'damage'

    // Abre a câmera (Aceita o ID e o MODO)
    start: function(orderId, mode = 'delivery') {
        this.pendingOrderId = orderId;
        this.currentMode = mode;
        
        const modal = document.getElementById('delivery-photo-modal');
        const video = document.getElementById('delivery-video');
        const preview = document.getElementById('delivery-preview');
        const btnSnap = document.getElementById('btn-snap-photo');
        const btnConfirm = document.getElementById('btn-confirm-delivery');
        const btnRetake = document.getElementById('btn-retake-photo'); // NOVO BOTÃO
        const title = document.querySelector('#delivery-photo-modal h3');
        const desc = document.querySelector('#delivery-photo-modal p');

        // 1. Muda os textos dependendo do modo
        if (this.currentMode === 'damage') {
            title.innerText = "⚠️ Relatar Avaria/Dano";
            desc.innerText = "Tire uma foto clara do dano na encomenda.";
            btnConfirm.innerText = "🚨 Confirmar Avaria";
            btnConfirm.classList.remove('btn-success');
            btnConfirm.classList.add('btn-danger'); // Botão vermelho
        } else {
            title.innerText = "📸 Comprovante de Entrega";
            desc.innerText = "Tire uma foto do pacote com o cliente.";
            btnConfirm.innerText = "✅ Confirmar Entrega";
            btnConfirm.classList.remove('btn-danger');
            btnConfirm.classList.add('btn-success'); // Botão verde
        }

        // Reseta visual para a câmera ao vivo
        if(preview) preview.style.display = 'none';
        if(video) video.style.display = 'block';
        if(btnSnap) btnSnap.classList.remove('hidden');
        if(btnConfirm) btnConfirm.classList.add('hidden');
        if(btnRetake) btnRetake.classList.add('hidden'); // Esconde o "Descartar"
        
        // Abre o modal
        if(modal) modal.classList.remove('hidden');

        // Tenta câmera traseira
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
            .then(stream => {
                this.stream = stream;
                if(video) {
                    video.srcObject = stream;
                    video.play();
                }
            })
            .catch(err => {
                console.error(err);
                alert("Erro ao abrir câmera. Verifique permissões ou HTTPS.");
                this.close();
            });
    },

    // Tira a foto
    snap: function() {
        const video = document.getElementById('delivery-video');
        const canvas = document.getElementById('delivery-canvas');
        const preview = document.getElementById('delivery-preview');
        
        if(!canvas || !video) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        
        // Qualidade 0.7 (JPG)
        this.capturedImage = canvas.toDataURL('image/jpeg', 0.7); 
        
        if(preview) {
            preview.src = this.capturedImage;
            preview.style.display = 'block';
        }
        
        video.style.display = 'none';
        document.getElementById('btn-snap-photo').classList.add('hidden');
        
        // Mostra os botões de Confirmar e Descartar
        document.getElementById('btn-confirm-delivery').classList.remove('hidden');
        const btnRetake = document.getElementById('btn-retake-photo');
        if(btnRetake) btnRetake.classList.remove('hidden');
    },

    // 🔄 NOVA FUNÇÃO: DESCARTA A FOTO E VOLTA PARA A CÂMERA
    retake: function() {
        this.capturedImage = null;
        const video = document.getElementById('delivery-video');
        const preview = document.getElementById('delivery-preview');
        const btnSnap = document.getElementById('btn-snap-photo');
        const btnConfirm = document.getElementById('btn-confirm-delivery');
        const btnRetake = document.getElementById('btn-retake-photo');

        if(preview) preview.style.display = 'none'; // Esconde a foto
        if(video) video.style.display = 'block';    // Mostra a câmera

        if(btnSnap) btnSnap.classList.remove('hidden');  // Mostra botão de tirar foto
        if(btnConfirm) btnConfirm.classList.add('hidden'); // Esconde confirmar
        if(btnRetake) btnRetake.classList.add('hidden');   // Esconde descartar
    },

    // Confirma e envia
    confirm: function() {
        if (!this.capturedImage || !this.pendingOrderId) return;
        
        let newStatus = 'Entregue';
        let locationLog = 'App (Entrega)';

        if (this.currentMode === 'damage') {
            newStatus = 'Avaria'; // Cria status "Avaria"
            locationLog = 'Armazém (Registro de Dano)';
        }

        // Chama a função de update
        updateOrderWithProof(this.pendingOrderId, newStatus, locationLog, this.capturedImage);
        this.close();
    },

    close: function() {
        const modal = document.getElementById('delivery-photo-modal');
        if(modal) modal.classList.add('hidden');
        
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    },

    view: function(imgData) {
        const imgFull = document.getElementById('proof-image-full');
        const modal = document.getElementById('view-proof-modal');
        if(imgFull && modal) {
            imgFull.src = imgData;
            modal.classList.remove('hidden');
        }
    }
};
// ==========================================
// DESCARTAR FOTO DE ENTREGA
// ==========================================
function discardDeliveryImage() {
    const fileInput = document.getElementById('camera-input');
    const previewContainer = document.getElementById('preview-container');
    const imagePreview = document.getElementById('image-preview');
    const btnSubmit = document.getElementById('btn-submit-delivery');

    // Limpa o arquivo selecionado e a imagem
    if (fileInput) fileInput.value = ''; 
    if (imagePreview) imagePreview.src = '';
    
    // Esconde a área de pré-visualização
    if (previewContainer) previewContainer.style.display = 'none';
    
    // Bloqueia o botão de "Confirmar Entrega" novamente por segurança
    if (btnSubmit) btnSubmit.disabled = true;
}
// --- FUNÇÃO DE UPDATE COM FOTO (Renomeada para ficar claro) ---
async function updateOrderWithProof(id, status, location, proofBase64) {
    const btn = document.getElementById('btn-confirm-delivery');
    if(btn) btn.innerText = "Enviando...";

    try {
        const res = await fetch('/api/orders/update', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status, location, delivery_proof: proofBase64 })
        });
        const data = await res.json();
        
        if(data.success) {
            alert("✅ Entrega confirmada com FOTO!");
            loadOrders(); // Recarrega tabela
        } else {
            alert("Erro: " + data.msg);
        }
    } catch(err) {
        console.error("Erro:", err);
        alert("Erro de conexão ao enviar foto.");
    } finally {
        if(btn) btn.innerText = "Confirmar";
    }
}
// Função auxiliar para decidir se abre Câmera ou atualiza direto
function checkDeliveryStatus(selectElement, id, name, code, phone) {
    const newStatus = selectElement.value;
    
    if (newStatus === 'Entregue') {
        // Se escolheu 'Entregue', ABRE A CÂMERA
        DeliveryProof.start(id);
    } else {
        // Se for qualquer outro status, atualiza normal (como era antes)
        updateOrderStatus(id, newStatus, name, code, phone);
    }
}
/* =========================================
   SISTEMA DE LEITOR DE QR CODE (SCANNER)
   ========================================= */
let html5QrcodeScanner = null;

function startScanner() {
    const modal = document.getElementById('scanner-modal');
    modal.classList.remove('hidden');

    // Configuração do Leitor
    html5QrcodeScanner = new Html5Qrcode("reader");
    
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    
    // Inicia a câmera traseira (environment)
    html5QrcodeScanner.start({ facingMode: "environment" }, config, onScanSuccess, onScanFailure)
    .catch(err => {
        console.error("Erro ao iniciar câmera:", err);
        alert("Erro: Permita o acesso à câmera.");
        stopScanner();
    });
}

function onScanSuccess(decodedText, decodedResult) {
    // Toca um bipe (opcional, feedback sonoro)
    // const audio = new Audio('/beep.mp3'); audio.play();

    console.log(`Código lido: ${decodedText}`);
    
    // Para o scanner para não ficar lendo repetidamente
    stopScanner();

    // LÓGICA DE BUSCA:
    // O seu QR Code na etiqueta é gerado assim: "CODE:ENC-123|NomeCliente"
    // Vamos limpar para pegar só o código ou procurar o texto todo.
    
    let searchTerm = decodedText;
    
    // Se o QR Code tiver prefixo "CODE:", limpamos
    if (decodedText.includes("CODE:")) {
        const parts = decodedText.split('|'); // Separa o código do nome
        searchTerm = parts[0].replace("CODE:", "").trim();
    }

    handleScannedCode(searchTerm);
}

function onScanFailure(error) {
    // Não faça nada, apenas continua procurando
    // console.warn(`Code scan error = ${error}`);
}

function stopScanner() {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => {
            html5QrcodeScanner.clear();
            document.getElementById('scanner-modal').classList.add('hidden');
        }).catch(err => console.error(err));
    } else {
        document.getElementById('scanner-modal').classList.add('hidden');
    }
}

// O que fazer quando encontrar o código?
async function handleScannedCode(code) {
    // 1. Busca a encomenda no banco pelo código
    try {
        const res = await fetch('/api/orders');
        const orders = await res.json();
        
        // Procura a encomenda exata
        const found = orders.find(o => o.code === code || o.code.includes(code));

        if (found) {
            alert(`📦 Encomenda Encontrada: ${found.code}\nCliente: ${found.client_name}`);
            
            // AÇÃO AUTOMÁTICA: Abre o modal de edição dessa encomenda
            // Se você for funcionário, pode já querer mudar status
            editOrder(found.id); 
            
        } else {
            alert(`❌ Encomenda com código "${code}" não encontrada no sistema.`);
        }

    } catch (err) {
        alert("Erro ao buscar dados.");
    }
}
// ==========================================
// ✅ SELECIONAR TODAS AS ETIQUETAS (BOTAO CELULAR)
// ==========================================
let estadoSelecaoEtiquetas = false;

function alternarSelecaoTodas() {
    // Inverte o estado (Se estava marcado, desmarca. Se estava desmarcado, marca)
    estadoSelecaoEtiquetas = !estadoSelecaoEtiquetas;
    
    // Marca ou desmarca todas as caixinhas da tela
    document.querySelectorAll('.label-check').forEach(caixa => {
        caixa.checked = estadoSelecaoEtiquetas;
    });
    
    // Atualiza também a caixinha pequena lá do topo da tabela para ficar igual
    const chkTodos = document.querySelector('input[onclick="toggleAllLabels(this)"]');
    if(chkTodos) chkTodos.checked = estadoSelecaoEtiquetas;
}
function printLabel(code, name, weight, desc, qtd = 1) {
    const printWindow = window.open('', '', 'width=400,height=600');
    
    let labelsHTML = '';
    // 👇 O LOOP DA MÁGICA: Cria a etiqueta X vezes!
    for(let i = 0; i < qtd; i++) {
        // O page-break-after: always garante que cada etiqueta saia em um adesivo/página separada
        labelsHTML += `
            <div style="border:2px solid #000; padding:20px; margin:10px; page-break-after: always;">
                <h1>GUINEEXPRESS</h1>
                <h2 style="font-size:40px; margin:10px 0;">${code}</h2>
                <div class="qrcode-container" data-text="${code}|${name}" style="display:flex; justify-content:center; margin:20px 0;"></div>
                <h3>${name}</h3>
                <p>${desc} - ${weight}kg</p>
                <p style="font-size:10px;">${new Date().toLocaleDateString()}</p>
            </div>
        `;
    }

    printWindow.document.write(`
        <html>
        <body style="text-align:center; font-family:Arial;">
            ${labelsHTML}
            <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
            <script>
                // Lê todas as divs de qrcode que criamos no loop e desenha a imagem nelas
                const qrcodes = document.querySelectorAll('.qrcode-container');
                qrcodes.forEach(container => {
                    new QRCode(container, {
                        text: container.getAttribute('data-text'),
                        width: 150,
                        height: 150
                    });
                });
                
                // Espera 1.5s para os QRCodes carregarem antes de abrir a janela de imprimir
                setTimeout(() => { window.print(); window.close(); }, 1500);
            </script>
        </body>
        </html>
    `);
}
function getTimelineHTML(status) {
    const steps = ['Agência', 'Em Transito Fort.', 'Em transito Lisboa', 'Chegou Bissau', 'Entregue'];
    const s = status ? status.toLowerCase() : '';
    
    let currentStepIndex = 0;
    if (s.includes('recebido') || s.includes('triagem') || s.includes('agencia') || s.includes('agência')) currentStepIndex = 0;
    if (s.includes('fortaleza') || s.includes('pinto martins') || s.includes('brasil')) currentStepIndex = 1;
    if (s.includes('lisboa') || s.includes('portugal') || s.includes('europa')) currentStepIndex = 2;
    if (s.includes('bissau') || s.includes('armazém') || s.includes('chegou')) currentStepIndex = 3;
    if (s.includes('entregue') || s.includes('retirado') || s.includes('concluído')) currentStepIndex = 4;

    const progressPercent = (currentStepIndex / (steps.length - 1)) * 100;

    let html = `
        <div class="timeline-container" style="position: relative; margin: 10px auto; padding: 10px 0; width: 100%; box-sizing: border-box;">
            
            <div style="position: absolute; top: 23px; left: 10%; width: 80%; height: 3px; background: #eee; z-index: 1;"></div>
            
            <div class="timeline-progress" style="position: absolute; top: 23px; left: 10%; width: ${(progressPercent * 0.8)}%; height: 3px; background: linear-gradient(90deg, #009ee3, #28a745); z-index: 2; transition: width 1s ease-in-out;"></div>
            
            <div style="display: flex; justify-content: space-between; position: relative; z-index: 3; width: 100%; box-sizing: border-box;">
    `;

    const icons = ['📦', '🛫', '🛬', '📍', '✅'];

    steps.forEach((step, index) => {
        const isCompleted = index <= currentStepIndex;
        const isActive = index === currentStepIndex;
        
        const bgColor = isActive ? '#009ee3' : (isCompleted ? '#28a745' : '#f0f0f0');
        const textColor = isActive ? '#0a1931' : (isCompleted ? '#28a745' : '#888');
        const fontWeight = isActive ? 'bold' : 'normal';
        // Reduzimos o tamanho dos ícones e textos para caberem lado a lado no telemóvel
        const circleSize = '28px'; 
        const fontSizeIcon = '13px';
        const fontSizeText = '9px';

        html += `
            <div class="timeline-step" style="text-align: center; flex: 1; display: flex; flex-direction: column; align-items: center; min-width: 0; padding: 0 2px; box-sizing: border-box;">
                <div style="width: ${circleSize}; height: ${circleSize}; background: ${bgColor}; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); font-size: ${fontSizeIcon}; transition: all 0.3s; ${isActive ? 'transform: scale(1.1); border: 2px solid #fff;' : ''}">
                    ${icons[index]}
                </div>
                <span style="font-size: ${fontSizeText}; font-weight: ${fontWeight}; color: ${textColor}; line-height: 1.1; text-align: center; width: 100%; word-wrap: break-word;">
                    ${step}
                </span>
            </div>
        `;
    });

    html += `</div></div>`;
    return html;
}
async function getZapQR() {
    const btn = event.target;
    btn.innerText = "Gerando QR...";
    const response = await fetch('/api/admin/zap-qr');
    const data = await response.json();
    
    if (data.qr) {
        document.getElementById('qr-container').style.display = 'block';
        document.getElementById('zap-qr-img').src = data.qr;
        btn.innerText = "Aguardando Leitura...";
    } else {
        alert(data.msg || "Zap já está ativo!");
        btn.innerText = "WhatsApp Ativo ✅";
    }
}
// ==========================================
// EXPORTAÇÃO PARA EXCEL (ADMIN E FUNCIONÁRIOS)
// ==========================================
async function exportOrdersToExcel() {
    // Verifica permissão (Bloqueia apenas clientes, liberando Admin e Funcionários)
    if (currentUser.role === 'client') return alert('Acesso negado. Apenas administradores e funcionários.');

    const btn = document.querySelector('button[onclick="exportOrdersToExcel()"]');
    const oldText = btn.innerHTML;
    if(btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...';

    try {
        // 1. Busca os dados mais recentes do servidor
        const res = await fetch('/api/orders');
        const orders = await res.json();

        if (orders.length === 0) {
            alert("Nenhuma encomenda para exportar.");
            if(btn) btn.innerHTML = oldText;
            return;
        }

        // 2. Formata os dados para ficarem bonitos no Excel (AGORA COM NOTA FISCAL SEPARADA!)
        const dataFormatted = orders.map(o => {
            // Puxa os valores certinhos que configuramos antes
            const basePrice = parseFloat(o.price) || 0;
            const freightValue = parseFloat(o.freight_amount) || basePrice;
            const nfValue = parseFloat(o.nf_amount) || 0;
            const finalPrice = freightValue + nfValue;

            return {
                "Código": o.code,
                "Cliente": o.client_name || o.name,
                "Telefone": o.client_phone || o.phone,
                "Descrição": o.description,
                "Peso (kg)": o.weight,
                "Frete (R$)": freightValue.toFixed(2),
                "Nota Fiscal (R$)": nfValue.toFixed(2),
                "Total (R$)": finalPrice.toFixed(2),
                "Status": o.status,
                "Data Criação": o.created_at ? new Date(o.created_at).toLocaleDateString('pt-BR') : '-',
                "Local Atual": o.delivery_location || '-'
            };
        });

        // 3. Cria a Planilha
        const worksheet = XLSX.utils.json_to_sheet(dataFormatted);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Encomendas");

        // 4. Ajusta largura das colunas para a nova estrutura
        const wscols = [
            {wch: 15}, // Código
            {wch: 25}, // Cliente
            {wch: 15}, // Telefone
            {wch: 30}, // Descrição
            {wch: 10}, // Peso
            {wch: 12}, // Frete
            {wch: 15}, // Nota Fiscal
            {wch: 12}, // Total
            {wch: 15}, // Status
            {wch: 15}, // Data
            {wch: 20}  // Local
        ];
        worksheet['!cols'] = wscols;

        // 5. Baixa o Arquivo
        const today = new Date().toISOString().slice(0,10);
        XLSX.writeFile(workbook, `Relatorio_Guineexpress_${today}.xlsx`);

    } catch (error) {
        console.error("Erro ao exportar:", error);
        alert("Erro ao gerar Excel.");
    } finally {
        if(btn) btn.innerHTML = oldText;
    }
}
// ==========================================
// CENTRAL DE NOTIFICAÇÕES (CLIENTE) - CORRIGIDA
// ==========================================

// 1. Mostrar/Esconder o menu
function toggleNotifications() {
    const dropdown = document.getElementById('notif-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
    } else {
        console.error("❌ Erro: Elemento 'notif-dropdown' não encontrado no HTML.");
    }
}

// 2. Gerar Notificações baseadas nas Encomendas
function updateClientNotifications(orders) {
    console.log("🔔 Verificando notificações para", orders.length, "encomendas...");

    const list = document.getElementById('notif-list');
    const badge = document.getElementById('notif-badge');
    
    // Se não achar o sino no HTML, avisa no console (F12)
    if (!list || !badge) {
        console.warn("⚠️ AVISO: Os elementos do sino (notif-list ou notif-badge) não existem nesta página.");
        return;
    }

    let notifHTML = '';
    let count = 0;

    // Ordena: as mais novas primeiro
    const sortedOrders = [...orders].sort((a, b) => b.id - a.id);

    sortedOrders.forEach(o => {
        // Normaliza o status para evitar erros de maiúscula/minúscula
        // Ex: transforma "Entregue" em "entregue" para comparar
        const status = o.status ? o.status.toLowerCase().trim() : '';
        const code = o.code || '???';

        let icon = '📦';
        let style = 'notif-info';
        let text = `Status: <b>${o.status}</b>`;
        let show = false;

        // --- REGRAS DE NOTIFICAÇÃO ---
        
        // 1. Entregue
        if (status === 'entregue') {
            icon = '✅';
            style = 'notif-success';
            text = `Oba! A encomenda <b>${code}</b> foi entregue! 🎉`;
            show = true;
        } 
        // 2. Chegou / Disponível
        else if (status.includes('chegou') || status.includes('dispon') || status.includes('retirada')) {
            icon = '🏢';
            style = 'notif-success';
            text = `Sua caixa <b>${code}</b> já pode ser retirada!`;
            show = true;
            count++; // Importante: conta para a bolinha vermelha
        }
        // 3. Em Trânsito / Voo
        else if (status.includes('trânsito') || status.includes('transito') || status.includes('voo')) {
            icon = '✈️';
            style = 'notif-info';
            text = `A encomenda <b>${code}</b> está a caminho.`;
            show = true;
        }
        // 4. Pagamento Pendente
        else if (status.includes('pendente') && status.includes('pagamento')) {
            icon = '💲';
            style = 'notif-warn';
            text = `Pagamento pendente para a caixa <b>${code}</b>.`;
            show = true;
            count++; // Importante
        }
        // 5. Avaria (Novo)
        else if (status.includes('avaria') || status.includes('dano')) {
            icon = '⚠️';
            style = 'notif-warn'; // Ou criar uma classe notif-danger
            text = `Atenção: Houve um problema com a caixa <b>${code}</b>.`;
            show = true;
            count++;
        }

        // Se passar nas regras, adiciona ao HTML
        if (show) {
            notifHTML += `
                <div class="notif-item">
                    <div class="notif-icon ${style}">${icon}</div>
                    <div>${text}</div>
                </div>
            `;
        }
    });

    // Atualiza a lista na tela
    if (notifHTML !== '') {
        list.innerHTML = notifHTML;
    } else {
        list.innerHTML = '<div style="padding:15px; text-align:center; color:#999; font-size:12px;">Nenhuma notificação recente. 🍃</div>';
    }
    // --- PARTE ATUALIZADA DO CONTADOR ---
    console.log("🔴 Total de notificações não lidas:", count);
    
    if (count > 0) {
        badge.innerText = count;         // Coloca o número
        badge.classList.remove('hidden');// Mostra a bolinha
        
        // Adiciona um efeito de pulsar se tiver coisas importantes
        if(count > 0) {
            badge.classList.add('pulse-animation');
        }
    } else {
        badge.classList.add('hidden');   // Esconde se for zero
        badge.classList.remove('pulse-animation');
    }
}
// --- FUNÇÃO: CARREGAR LOGS DE ACESSO E AUDITORIA ---
async function loadAccessLogs() {
    try {
        const response = await fetch('/api/admin/logs');
        const logs = await response.json();
        
        const tbody = document.getElementById('logs-table-body');
        tbody.innerHTML = ''; // Limpa a tabela

        logs.forEach(log => {
            const tr = document.createElement('tr');
            
            // 🎨 MÁGICA DAS CORES: Verde (Sucesso), Vermelho (Exclusão/Falha)
            let statusColor = '#6c757d'; 
            if (log.status === 'Sucesso') statusColor = '#28a745';
            else if (log.status === 'Exclusão') statusColor = '#dc3545'; // Vermelho de Alerta!
            else statusColor = '#dc3545'; 

            const statusBadge = `<span style="background: ${statusColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">${log.status}</span>`;

            // Formata a data
            const date = new Date(log.created_at).toLocaleString('pt-BR');

            // Ajustei as cores do texto para o Nome do Usuário e o Motivo ficarem bem destacados
            tr.innerHTML = `
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${date}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #003de3;">${log.user_input}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${statusBadge}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${log.device}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; font-family: monospace;">${log.ip_address}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; color: #333; font-weight: bold;">${log.reason || '-'}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Erro ao carregar logs:", error);
        alert("Erro ao carregar histórico.");
    }
}
// ==========================================
// ABA FINANCEIRO (TURBINADA 🚀 COM FILTRO DE LOTE)
// ==========================================
let financesLimit = 50;

async function loadFinances() {
    try {
        const res = await fetch('/api/finances/all');
        const finances = await res.json();
        const tbody = document.getElementById('finances-list');
        
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Carregando financeiro... <i class="fas fa-spinner fa-spin"></i></td></tr>';

        const toggleBtn = document.getElementById('toggle-finances');
        const showCompleted = toggleBtn ? toggleBtn.checked : false;

        if (finances.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Nenhum registro encontrado.</td></tr>`;
            return;
        }

        // ==========================================
        // 🧠 CÉREBRO DO FILTRO DE LOTES (Aprende sozinho!)
        // ==========================================
        const filterSelect = document.getElementById('finances-lot-filter');
        const loteSelecionado = filterSelect ? filterSelect.value : '';

        if (filterSelect) {
            // Pega todos os nomes de lotes salvos no financeiro (tira os vazios/nulos)
            // Usa 'lote' ou 'shipment_id' dependendo de como a rota manda os dados
            const todosOsLotes = finances.map(f => f.lote || f.shipment_id || 'Sem Lote');
            const lotesUnicos = [...new Set(todosOsLotes)];

            let htmlFiltro = '<option value="">📦 Todos os Envios/Lotes</option>';
            lotesUnicos.sort().forEach(l => {
                htmlFiltro += `<option value="${l}">✈️ ${l}</option>`;
            });
            
            filterSelect.innerHTML = htmlFiltro;
            
            // Mantém selecionado o lote que estava antes
            if (lotesUnicos.includes(loteSelecionado) || loteSelecionado === '') {
                filterSelect.value = loteSelecionado;
            }
        }
        // ==========================================

        let htmlBuffer = '';
        let itensRenderizados = 0;
        let totalValidos = 0;

        for (let i = 0; i < finances.length; i++) {
            const item = finances[i];
            
            if (item.type === 'Encomenda') continue;

            let statusPt = item.status || '';
            const statusLower = statusPt.toLowerCase();

            if (statusLower === 'pending') statusPt = 'Pendente';
            if (statusLower === 'paid' || statusLower === 'approved') statusPt = 'Pago'; 
            if (statusLower === 'cancelled' || statusLower === 'rejected') statusPt = 'Cancelado';

            // MÁGICA 1: Oculta pagos se o checkbox não estiver marcado
            if (statusPt === 'Pago' && !showCompleted) continue;

            // MÁGICA 2: Freio do Lote! Se não for do lote escolhido, pula!
            const loteDesteItem = item.lote || item.shipment_id || 'Sem Lote';
            if (loteSelecionado !== '' && String(loteDesteItem) !== String(loteSelecionado)) continue;

            totalValidos++;

            if (itensRenderizados >= financesLimit) continue; 

            let statusBadge = 'bg-warning'; 
            if (statusPt === 'Pago') statusBadge = 'bg-success'; 
            if (statusPt === 'Cancelado') statusBadge = 'bg-danger'; 

            htmlBuffer += `
                <tr>
                    <td data-label="Código" style="font-weight: bold;">${item.id_code || 'N/A'}</td>
                    <td data-label="Tipo"><span class="badge bg-primary">${item.type}</span></td>
                    <td data-label="Cliente">${item.client_name || 'Desconhecido'}</td>
                    <td data-label="Descrição">${item.description || '-'}</td>
                    <td data-label="Peso" style="text-align: center;">${item.weight ? item.weight + ' kg' : '-'}</td>
                    <td data-label="Volumes" style="text-align: center; font-weight: bold; color: #d4af37;"><i class="fas fa-boxes"></i> ${item.volumes || '1'}</td>
                    <td data-label="Status" style="text-align: center;"><span class="badge ${statusBadge}">${statusPt}</span></td>
                </tr>
            `;
            
            itensRenderizados++;
        }

        if (totalValidos > financesLimit) {
            htmlBuffer += `
            <tr>
                <td colspan="7" style="text-align:center; padding: 20px;">
                    <button onclick="loadMoreFinances()" style="background:#00b1ea; color:white; border:none; padding:10px 20px; border-radius:5px; cursor:pointer; font-weight:bold; width: 100%; max-width: 300px;">
                        <i class="fas fa-chevron-down"></i> Mostrar registros antigos...
                    </button>
                </td>
            </tr>`;
        }

        if (itensRenderizados === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Nenhum registro encontrado para este envio.</td></tr>`;
        } else {
            tbody.innerHTML = htmlBuffer;
        }

    } catch (e) {
        console.error("Erro ao carregar o financeiro", e);
        const tbody = document.getElementById('finances-list');
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">Erro ao carregar dados.</td></tr>`;
    }
}

function loadMoreFinances() {
    financesLimit += 50;
    loadFinances();
}

// Resetar o limite quando o botão de filtro do financeiro mudar (opcional)
document.getElementById('toggle-finances')?.addEventListener('change', () => {
    financesLimit = 50;
    loadFinances();
});
// Geração de PDF (Requer jspdf e autotable no HTML)
function exportFinancesPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Relatório Financeiro - GuineExpress", 14, 22);
    doc.setFontSize(11);
    doc.text("Gerado em: " + new Date().toLocaleString(), 14, 30);

    // Pega a tabela HTML pelo ID e converte para PDF automaticamente
    doc.autoTable({
        html: '#finances-table',
        startY: 35,
        theme: 'grid',
        styles: { fontSize: 9 },
        headStyles: { fillColor: [10, 25, 49] }, 
        
        didParseCell: function(data) {
            // ATUALIZADO: O Status agora é a coluna 6!
            // Índices: 0=Código, 1=Tipo, 2=Cliente, 3=Descrição, 4=Peso, 5=Volumes, 6=Status
            if (data.section === 'body' && data.column.index === 6) {
                
                const statusText = data.cell.text.join('').toLowerCase();

                if (statusText.includes('pago')) {
                    // Fundo Verde claro e Texto Verde Escuro
                    data.cell.styles.fillColor = [212, 237, 218]; 
                    data.cell.styles.textColor = [21, 87, 36];
                    data.cell.styles.fontStyle = 'bold';
                } 
                else if (statusText.includes('pendente') || statusText.includes('processando')) {
                    // Fundo Vermelho claro e Texto Vermelho Escuro
                    data.cell.styles.fillColor = [248, 215, 218];
                    data.cell.styles.textColor = [114, 28, 36];
                    data.cell.styles.fontStyle = 'bold';
                }
                else if (statusText.includes('cancelado')) {
                    // Fundo Cinza/Vermelho
                    data.cell.styles.fillColor = [255, 235, 238];
                    data.cell.styles.textColor = [211, 47, 47];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        }
    });

    doc.save('Relatorio_Financeiro.pdf');
}

// Geração de Excel Colorido (Requer ExcelJS e FileSaver)
async function exportFinancesExcel() {
    // 1. Cria a planilha
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Financeiro');

    // 2. Define as colunas e as larguras (NOVA COLUNA DE VOLUMES ADICIONADA)
    sheet.columns = [
        { header: 'Código', key: 'code', width: 15 },
        { header: 'Tipo', key: 'type', width: 15 },
        { header: 'Cliente', key: 'client', width: 25 },
        { header: 'Descrição', key: 'desc', width: 30 },
        { header: 'Peso', key: 'weight', width: 15 },
        { header: 'Volumes', key: 'volumes', width: 12 }, // <--- COLUNA NOVA!
        { header: 'Status', key: 'status', width: 20 }
    ];

    // 3. Pinta o cabeçalho de Azul Escuro
    sheet.getRow(1).eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A1931' } };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    });

    // 4. Puxa as linhas da sua tabela HTML
    const rows = document.querySelectorAll('#finances-list tr');
    
    rows.forEach(tr => {
        if(tr.cells.length <= 1) return;

        // Pega os textos de cada coluna (ATUALIZADO PARA 7 COLUNAS)
        const rowData = {
            code: tr.cells[0].innerText,
            type: tr.cells[1].innerText,
            client: tr.cells[2].innerText,
            desc: tr.cells[3].innerText,
            weight: tr.cells[4].innerText,
            volumes: tr.cells[5].innerText, // <--- PEGA OS VOLUMES
            status: tr.cells[6].innerText   // <--- O STATUS PASSOU PARA O 6
        };

        const excelRow = sheet.addRow(rowData);

        // 5. Aplica as cores na coluna de Status (Agora é a Coluna 7 no Excel)
        const statusCell = excelRow.getCell(7);
        const statusText = rowData.status.toLowerCase();

        if (statusText.includes('pago')) {
            // Fundo Verde 
            statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EDDA' } }; 
            statusCell.font = { color: { argb: 'FF155724' }, bold: true };
        } 
        else if (statusText.includes('pendente') || statusText.includes('processando')) {
            // Fundo Vermelho
            statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8D7DA' } }; 
            statusCell.font = { color: { argb: 'FF721C24' }, bold: true };
        }
        else if (statusText.includes('cancelado')) {
            // Fundo Cinza/Vermelho claro
            statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEE' } }; 
            statusCell.font = { color: { argb: 'FFD32F2F' }, bold: true };
        }
    });

    // 6. Gera o arquivo e faz o download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, 'Relatorio_Financeiro.xlsx');
}
// ==============================================================
// GARANTIA DE TELA LIMPA AO CARREGAR A PÁGINA
// ==============================================================
document.addEventListener('DOMContentLoaded', () => {
    // Força a tela de login a não ter nenhuma classe de bandeira ao abrir
    const loginCard = document.querySelector('.login-card');
    if (loginCard) {
        loginCard.classList.remove(
            'bg-flag-GW', 'bg-flag-BR', 'bg-flag-PT', 'bg-flag-SN', 
            'bg-flag-US', 'bg-flag-FR', 'bg-flag-ES', 'bg-flag-MA', 
            'bg-flag-UK', 'bg-flag-CV'
        );
    }
});
// Função auxiliar necessária para converter a chave
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}


// Forçar o registro ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    if ('serviceWorker' in navigator) {
        // Pequeno atraso para garantir que tudo carregou
        setTimeout(() => {
            registerPush(); 
        }, 2000);
    }
});
// ============================================================
// LÓGICA DO BOTÃO FLUTUANTE (INSTALAÇÃO + ARRASTAR) - BLINDADO
// ============================================================
let deferredPrompt;
const installBtn = document.getElementById('btn-install-fab');
const iosModal = document.getElementById('modal-ios-install');

// 1. Mostrar o botão imediatamente se não estiver instalado
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
const isAndroid = /android/i.test(navigator.userAgent);
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

// FORÇA O BOTÃO A APARECER: Se não estiver instalado, mostra. 
// No Android, forçamos a exibição para driblar navegadores como Mi Browser (Xiaomi).
if (!isStandalone || (isAndroid && !isStandalone)) {
    if(installBtn) installBtn.style.display = 'flex';
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e; 
    if(installBtn) installBtn.style.display = 'flex'; // Garante que apareça
});

// ==========================================
// FÍSICA PARA ARRASTAR O BOTÃO PELA TELA
// ==========================================
let isDragging = false;
let moved = false; // Diferencia um "clique" de um "arrasto"
let startX, startY, initialX, initialY;

if (installBtn) {
    // Eventos de Toque (Celular)
    installBtn.addEventListener('touchstart', dragStart, { passive: false });
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('touchend', dragEnd);

    // Eventos de Mouse (Computador)
    installBtn.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);
}

function dragStart(e) {
    if (e.type === "touchstart") {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    } else {
        startX = e.clientX;
        startY = e.clientY;
    }
    
    // Pega a posição exata do botão na tela antes de mover
    const rect = installBtn.getBoundingClientRect();
    initialX = rect.left;
    initialY = rect.top;
    
    // Fixa o botão pelas coordenadas top/left para facilitar o cálculo
    installBtn.style.left = initialX + 'px';
    installBtn.style.top = initialY + 'px';
    installBtn.style.bottom = 'auto';
    installBtn.style.right = 'auto';

    isDragging = true;
    moved = false; // Resetamos a variável que checa se o usuário só clicou
    installBtn.style.cursor = 'grabbing';
    installBtn.style.animation = 'none'; // Pausa o brilho enquanto arrasta
}

function drag(e) {
    if (!isDragging) return;
    e.preventDefault(); // Impede a tela de rolar junto

    let currentX = e.type === "touchmove" ? e.touches[0].clientX : e.clientX;
    let currentY = e.type === "touchmove" ? e.touches[0].clientY : e.clientY;

    let diffX = currentX - startX;
    let diffY = currentY - startY;

    // Se moveu mais de 5 pixels, nós consideramos um "arrasto" e não um "clique"
    if (Math.abs(diffX) > 5 || Math.abs(diffY) > 5) {
        moved = true;
    }

    let newX = initialX + diffX;
    let newY = initialY + diffY;

    // Limites da tela (para o botão não sumir pelas bordas)
    let maxX = window.innerWidth - installBtn.offsetWidth;
    let maxY = window.innerHeight - installBtn.offsetHeight;

    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));

    installBtn.style.left = newX + "px";
    installBtn.style.top = newY + "px";
}

function dragEnd(e) {
    if (!isDragging) return;
    isDragging = false;
    installBtn.style.cursor = 'grab';
    installBtn.style.animation = 'pulse-dourado 2s infinite'; // Volta a pulsar
}

// ==========================================
// AÇÃO DE CLIQUE (INSTALAR O APP)
// ==========================================
if (installBtn) {
    installBtn.addEventListener('click', async (e) => {
        // Se o cliente acabou de arrastar o botão, não faça a instalação!
        if (moved) return; 

        if (isIOS) {
            if(iosModal) iosModal.style.display = iosModal.style.display === 'block' ? 'none' : 'block';
        } else {
            if (deferredPrompt) {
                // Modo Moderno: O navegador permite abrir a janelinha
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    installBtn.style.display = 'none'; 
                }
                deferredPrompt = null;
            } else {
                // MODO RAIZ (XIAOMI E BLOQUEADOS): Se o navegador engoliu o evento, ensina na marra!
                alert("📲 Seu navegador bloqueou a instalação automática.\n\nPara instalar agora mesmo:\n\n1️⃣ Clique nos três pontinhos (⋮) ou no menu do seu navegador.\n2️⃣ Escolha 'Adicionar à tela inicial' ou 'Instalar aplicativo'.\n\nPronto! A Guineexpress estará na sua tela inicial! 🚀");
            }
        }
    });
}

// Esconde o botão se o app for instalado com sucesso (independente de como foi instalado)
window.addEventListener('appinstalled', () => {
    if(installBtn) installBtn.style.display = 'none';
    deferredPrompt = null;
});

// ==========================================
// 🔔 SISTEMA DE NOTIFICAÇÕES WEB-PUSH (COM FAXINA AUTOMÁTICA)
// ==========================================
async function registerPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn("Push não suportado neste navegador.");
        return;
    }

    try {
        const register = await navigator.serviceWorker.register('/sw.js');
        
        // 🧹 CAÇADOR DE CHAVE VELHA: Se existir uma inscrição antiga, ele deleta sozinho!
        const existingSubscription = await register.pushManager.getSubscription();
        if (existingSubscription) {
            await existingSubscription.unsubscribe();
            console.log("🧹 Inscrição antiga removida automaticamente pelo sistema!");
        }

        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
            const urlBase64ToUint8Array = (base64String) => {
                const padding = '='.repeat((4 - base64String.length % 4) % 4);
                const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
                const rawData = window.atob(base64);
                const outputArray = new Uint8Array(rawData.length);
                for (let i = 0; i < rawData.length; ++i) {
                    outputArray[i] = rawData.charCodeAt(i);
                }
                return outputArray;
            };

            // ⚠️ A CHAVE EXATA DO SEU .ENV
            const publicVapidKey = 'BHz6ezs_RX0nln77mT3xRFrBpf6WhAWwiedXWOwDoRl90r32Iwmgx4ROqxzLRWhwXHc_pvIejfWcKNOaPNFzEsY';
            const convertedKey = urlBase64ToUint8Array(publicVapidKey);

            // Cria a nova inscrição limpinha
            const subscription = await register.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedKey
            });

            // Envia para o servidor salvar no banco
            await fetch('/api/notifications/subscribe', {
                method: 'POST',
                body: JSON.stringify(subscription),
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin' 
            });
            
            console.log("✅ Push ativado e chave nova salva com sucesso!");
        }
    } catch (e) {
        console.error("❌ Erro no processo de push:", e);
    }
}
// ==========================================
// FUNÇÃO EXCLUSIVA DO PAINEL DO ADMINISTRADOR (COM SELEÇÃO EM MASSA 🚀)
// ==========================================
async function loadInvoices() {
    const tbodyReview = document.getElementById('invoices-review-list');
    const tbodyPending = document.getElementById('invoices-pending-list');
    const tbodyPaid = document.getElementById('invoices-paid-list');
    
    if(!tbodyReview || !tbodyPending || !tbodyPaid) return;

    // Coloca mensagem de carregando adaptada ao novo número de colunas
    tbodyReview.innerHTML = '<tr><td colspan="7" style="text-align:center;">Carregando...</td></tr>';
    tbodyPending.innerHTML = '<tr><td colspan="7" style="text-align:center;">Carregando...</td></tr>';
    tbodyPaid.innerHTML = '<tr><td colspan="8" style="text-align:center;">Carregando...</td></tr>';

    try {
        const res = await fetch('/api/invoices/list'); // Certifique-se que o nome bate com o servidor
        const list = await res.json();

        // Limpa as tabelas para preencher
        tbodyReview.innerHTML = '';
        tbodyPending.innerHTML = '';
        tbodyPaid.innerHTML = '';

        // ==========================================
        // 🧠 CÉREBRO DO FILTRO DE LOTES (Aprende sozinho!)
        // ==========================================
        const filterSelect = document.getElementById('invoice-lot-filter');
        const loteSelecionado = filterSelect ? filterSelect.value : '';

        if (filterSelect) {
            // Pega todos os nomes de lotes e remove os vazios/repetidos
            const todosOsLotes = list.map(inv => inv.lote || 'Sem Lote');
            const lotesUnicos = [...new Set(todosOsLotes)];

            let htmlFiltro = '<option value="">📦 Todos os Envios/Lotes</option>';
            lotesUnicos.sort().forEach(l => {
                htmlFiltro += `<option value="${l}">✈️ ${l}</option>`;
            });
            
            filterSelect.innerHTML = htmlFiltro;
            
            if (lotesUnicos.includes(loteSelecionado) || loteSelecionado === '') {
                filterSelect.value = loteSelecionado;
            }
        }
        // ==========================================

        let countReview = 0, countPending = 0, countPaid = 0;

        list.forEach(inv => {
            // MÁGICA DO FREIO: Se não for do lote escolhido, pula e esconde! 🚀
            const loteDestaFatura = inv.lote || 'Sem Lote';
            if (loteSelecionado !== '' && String(loteDestaFatura) !== String(loteSelecionado)) return;

            let statusHtml = '';
            let deleteBtn = '';
            let actionButtons = '';

            // Lógica dos Botões (Herdada do seu código original)
            if(currentUser && currentUser.role === 'admin') {
                deleteBtn = `<button onclick="deleteInvoice(${inv.id})" style="color:red; background:none; border:none; cursor:pointer; margin-left:10px;" title="Excluir"><i class="fas fa-trash"></i></button>`;
                
                if (inv.status === 'pending') {
                    actionButtons = `
                        <button onclick="forcePayInvoice(${inv.id})" style="background:#f39c12; color:white; border:none; padding:5px 8px; border-radius:3px; cursor:pointer; font-size:12px; font-weight:bold;" title="Marcar como Pago Manualmente">
                            💰 Lelo Confirma pagamento Manual
                        </button>
                    `;
                } else if (inv.status === 'in_review') {
                    actionButtons = `
                        <button onclick="viewReceipt(${inv.id}, '${inv.receipt_url}')" style="background:#17a2b8; color:white; border:none; padding:5px 8px; border-radius:3px; cursor:pointer; font-size:12px; margin-right:5px;">
                            👁️ Ver
                        </button>
                        <button onclick="approveInvoice(${inv.id})" style="background:#28a745; color:white; border:none; padding:5px 8px; border-radius:3px; cursor:pointer; font-size:12px; font-weight:bold;">
                            ✅ Aprovar
                        </button>
                    `;
                }
            } else {
                actionButtons = '-'; // Funcionário comum não tem botão de ação
                deleteBtn = '';
            }

            const refCode = inv.order_code || inv.raw_order || inv.box_code || 'Sem Ref.';
            
            // MÁGICA REALIZADA AQUI: Adicionado o TD com o checkbox class="invoice-check"
            const baseRowHTML = `
                <td style="text-align:center; padding:12px;"><input type="checkbox" class="invoice-check" value="${inv.id}"></td>
                <td style="font-weight:bold; color:#0a1931;">${refCode}</td>
                <td>${inv.client_name}</td>
                <td>${inv.box_code || '-'}</td>
                <td style="font-weight:bold;">R$ ${inv.amount}</td> 
            `;

            // DISTRIBUINDO NAS FILAS
            if(inv.status === 'approved' || inv.status === 'paid') {
                statusHtml = '<span style="color:green; font-weight:bold;">✅ PAGO</span>';
                let dataFormatada = "Sem data";
                if (inv.created_at) {
                    const dataBanco = new Date(inv.created_at);
                    dataFormatada = dataBanco.toLocaleDateString('pt-BR');
                }

                tbodyPaid.innerHTML += `
                    <tr style="border-bottom: 1px solid #eee;">
                        ${baseRowHTML}
                        <td style="color:#555; font-weight:bold;">${dataFormatada}</td>
                        <td>${statusHtml}</td>
                        <td><div style="display:flex; gap:5px; align-items:center;">${actionButtons} ${deleteBtn}</div></td>
                    </tr>`;
                countPaid++;
            } 
            else if(inv.status === 'in_review') {
                statusHtml = '<span style="background-color:blue; color:white; padding:2px 5px; border-radius:4px; font-weight:bold;">👀 Em Análise</span>';
                tbodyReview.innerHTML += `
                    <tr style="border-bottom: 1px solid #eee;">
                        ${baseRowHTML}
                        <td>${statusHtml}</td>
                        <td><div style="display:flex; gap:5px; align-items:center;">${actionButtons} ${deleteBtn}</div></td>
                    </tr>`;
                countReview++;
            } 
            else {
                statusHtml = inv.status === 'pending' 
                    ? '<span style="color:orange; font-weight:bold;">⏳ Pendente</span>' 
                    : '<span style="color:red;">Cancelado</span>';
                
                tbodyPending.innerHTML += `
                    <tr style="border-bottom: 1px solid #eee;">
                        ${baseRowHTML}
                        <td>${statusHtml}</td>
                        <td><div style="display:flex; gap:5px; align-items:center;">${actionButtons} ${deleteBtn}</div></td>
                    </tr>`;
                countPending++;
            }
        });

        // Mensagens caso alguma fila esteja vazia (atualizado colspan)
        if (countReview === 0) tbodyReview.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#888;">Nenhuma fatura em análise.</td></tr>';
        if (countPending === 0) tbodyPending.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#888;">Nenhum cliente com pagamento pendente.</td></tr>';
        if (countPaid === 0) tbodyPaid.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#888;">Nenhuma fatura paga ainda.</td></tr>';

    } catch (err) {
        console.error("Erro ao carregar faturas:", err);
        tbodyReview.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">Erro ao carregar faturas. Tente atualizar a página.</td></tr>';
    }
}

// ==========================================
// DAR BAIXA MANUAL (FORÇAR PAGAMENTO)
// ==========================================
async function forcePayInvoice(invoiceId) {
    if(!confirm("Tem certeza que deseja marcar esta fatura como PAGA manualmente? (O cliente não enviou comprovante pelo sistema)")) return;

    try {
        const res = await fetch(`/api/invoices/${invoiceId}/force-pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        
        if(data.success) {
            alert("✅ Pagamento confirmado manualmente com sucesso!");
            loadInvoices(); // Atualiza a tabela
        } else {
            alert("Erro: " + data.message);
        }
    } catch (err) {
        alert("Erro de conexão ao forçar o pagamento.");
    }
}

// O Administrador clica para abrir a foto do comprovante e aprovar
function viewReceipt(invoiceId, receiptUrl) {
    if(!receiptUrl) return alert("Erro: Link do talão não encontrado.");

    // ISTO FAZ A FOTO ABRIR NUMA NOVA ABA PARA VOCÊ BAIXAR/VER:
    window.open(receiptUrl, '_blank');
    
    // Pergunta se você quer aprovar
    setTimeout(async () => {
        const confirmar = confirm("Você abriu o comprovativo na outra aba.\n\nO dinheiro já caiu na sua conta?\nDeseja APROVAR este pagamento agora?");
        
        if(confirmar) {
            try {
                const res = await fetch(`/api/invoices/${invoiceId}/approve-receipt`, { method: 'POST' });
                const data = await res.json();
                if(data.success) {
                    alert("✅ Pagamento Aprovado com sucesso!");
                    loadInvoices(); // Fica verdinho como PAGO
                } else {
                    alert("Erro ao aprovar: " + data.message);
                }
            } catch(err) { alert("Erro de conexão."); }
        }
    }, 1500);
}

// Abre a janela para o cliente ver o número da conta e anexar
function openEcobankModal(invoiceId) {
    document.getElementById('ecobank-invoice-id').value = invoiceId;
    document.getElementById('ecobank-receipt-file').value = ''; 
    document.getElementById('modal-ecobank').style.display = 'block';
}
// ==========================================
// FUNÇÃO PARA O CLIENTE/ADMIN VER A FOTO DA ENTREGA
// ==========================================
function viewDeliveryPhoto(base64Data) {
    // Cria uma tela preta transparente por cima de tudo para mostrar a foto
    const modal = document.createElement('div');
    modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:10000; display:flex; justify-content:center; align-items:center; flex-direction:column;";
    
    modal.innerHTML = `
        <img src="${base64Data}" style="max-width:90%; max-height:80%; border-radius:10px; border:3px solid #009ee3; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
        <button onclick="this.parentElement.remove()" style="margin-top:20px; padding:12px 25px; background:#dc3545; color:white; border:none; border-radius:5px; font-size:16px; font-weight:bold; cursor:pointer;"><i class="fas fa-times"></i> Fechar Comprovante</button>
    `;
    
    document.body.appendChild(modal);
}
// ==========================================
// CLIENTE ENVIA COMPROVANTE ECOBANK
// ==========================================
async function submitEcobankReceipt() {
    const invoiceId = document.getElementById('ecobank-invoice-id').value;
    const fileInput = document.getElementById('ecobank-receipt-file');
    
    if (fileInput.files.length === 0) return alert("Anexe a foto do comprovativo primeiro!");

    const formData = new FormData();
    formData.append('receipt', fileInput.files[0]);

    alert("A enviar o comprovativo... Aguarde.");
    try {
        const res = await fetch(`/api/invoices/${invoiceId}/upload-receipt`, { 
            method: 'POST', 
            body: formData 
        });
        const data = await res.json();
        
        if(data.success) {
            alert("✅ Comprovativo enviado! Aguarde a aprovação da GuineExpress.");
            document.getElementById('modal-ecobank').style.display = 'none';
            if(typeof loadClientInvoices === 'function') loadClientInvoices();
        } else {
            alert("Erro: " + data.message);
        }
    } catch(err) { 
        console.error(err);
        alert("Erro ao enviar a imagem."); 
    }
}
async function approveInvoice(invoiceId) {
    if(!confirm("Tem certeza que deseja APROVAR e marcar esta fatura como PAGA?")) return;

    try {
        // CORREÇÃO AQUI: Usando a rota exata que nós criamos no seu server.js
        const res = await fetch(`/api/invoices/${invoiceId}/approve-receipt`, {
            method: 'POST'
        });
        
        const data = await res.json();
        if(data.success) {
            alert("✅ Pagamento aprovado com sucesso!");
            loadInvoices(); // Atualiza a tabela na hora
        } else {
            alert("Erro ao aprovar: " + data.message);
        }
    } catch (err) {
        console.error(err);
        alert("Erro de conexão ao tentar aprovar a fatura.");
    }
}
// ==========================================
// EXPORTAÇÃO DE BOXES (PDF E EXCEL DIRETOS)
// ==========================================

function exportBoxExcel() {
    // Cria a estrutura de um ficheiro Excel real (.xls) com cores e bordas
    let tableHTML = `
        <html xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head><meta charset="utf-8"></head>
        <body>
            <table border="1" cellpadding="5">
                <thead>
                    <tr><th colspan="6" style="font-size: 18px; font-weight: bold; background-color: #f4f9ff; text-align: center; height: 40px;">📦 Relatório de Boxes - Guineexpress</th></tr>
                    <tr style="background-color: #0a1931; color: #ffffff; font-weight: bold;">
                        <th>N° Box</th><th>Cliente</th><th>Ref. Encomenda</th><th>Peso (Kg)</th><th>Valor Estimado</th><th>Produtos</th>
                    </tr>
                </thead>
                <tbody>
    `;

    // Pega os dados da tabela
    const trs = document.querySelectorAll("#box-table-body tr");
    trs.forEach(tr => {
        const tds = tr.querySelectorAll("td");
        if (tds.length > 0) {
            tableHTML += `<tr>
                <td>${tds[0].innerText}</td>
                <td>${tds[1].innerText}</td>
                <td>${tds[2].innerText}</td>
                <td>${tds[3].innerText.replace(' Kg', '')}</td>
                <td>${tds[4].innerText}</td>
                <td>${tds[5].innerText}</td>
            </tr>`;
        }
    });

    tableHTML += `</tbody></table></body></html>`;

    // Força o download como ficheiro .xls
    const blob = new Blob([tableHTML], { type: 'application/vnd.ms-excel' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Guineexpress_Relatorio_Boxes.xls";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportBoxPDF() {
    // Muda o botão para mostrar que está a carregar (Opcional)
    const btn = event.currentTarget;
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Baixando...';

    // Se a biblioteca de PDF ainda não existir, o sistema baixa ela automaticamente
    if (typeof html2pdf === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.onload = () => gerarPDF(btn, textoOriginal);
        document.head.appendChild(script);
    } else {
        gerarPDF(btn, textoOriginal);
    }

    function gerarPDF(btn, textoOriginal) {
        // Pega os dados da tabela limpos
        let rowsHtml = '';
        const trs = document.querySelectorAll("#box-table-body tr");
        trs.forEach(tr => {
            const tds = tr.querySelectorAll("td");
            if (tds.length > 0) {
                rowsHtml += `
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;">${tds[0].innerText}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${tds[1].innerText}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${tds[2].innerText}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${tds[3].innerText}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${tds[4].innerText}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${tds[5].innerText}</td>
                </tr>`;
            }
        });

        // Monta o visual do PDF
        const divTemp = document.createElement('div');
        divTemp.innerHTML = `
            <div style="font-family: Arial, sans-serif; padding: 20px; background: white;">
                <h2 style="color: #0a1931; text-align: center; border-bottom: 2px solid #0a1931; padding-bottom: 10px;">📦 Relatório de Boxes - Guineexpress</h2>
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px;">
                    <thead>
                        <tr>
                            <th style="border: 1px solid #ddd; padding: 10px; background-color: #0a1931; color: white;">N° Box</th>
                            <th style="border: 1px solid #ddd; padding: 10px; background-color: #0a1931; color: white;">Cliente</th>
                            <th style="border: 1px solid #ddd; padding: 10px; background-color: #0a1931; color: white;">Ref. Encomenda</th>
                            <th style="border: 1px solid #ddd; padding: 10px; background-color: #0a1931; color: white;">Peso</th>
                            <th style="border: 1px solid #ddd; padding: 10px; background-color: #0a1931; color: white;">Valor Estimado</th>
                            <th style="border: 1px solid #ddd; padding: 10px; background-color: #0a1931; color: white;">Produtos</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
        `;

        // Configurações do Ficheiro PDF
        const opt = {
            margin:       10,
            filename:     'Guineexpress_Relatorio_Boxes.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true }, // useCORS garante que imagens carreguem no celular
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
        };

        // 🚀 LÓGICA À PROVA DE CELULAR: Extrai o arquivo bruto (Blob) e força o download
        html2pdf().set(opt).from(divTemp).toPdf().get('pdf').then(function(pdfObj) {
            const pdfBlob = pdfObj.output('blob');
            const blobUrl = URL.createObjectURL(pdfBlob);
            
            // Cria um link invisível e clica nele automaticamente
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = opt.filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Volta o botão ao normal
            btn.innerHTML = textoOriginal;
        }).catch(err => {
            console.error("Erro ao gerar PDF: ", err);
            btn.innerHTML = textoOriginal;
            alert("Erro ao gerar o relatório.");
        });
    }
}
// ==================================================================
// FUNÇÃO PARA FAZER LOGIN COM A BIOMETRIA (VERSÃO ÚNICA)
// ==================================================================
async function loginComBiometria() {
    const campoLogin = document.getElementById('login-user') || document.getElementById('email') || document.getElementById('login');
    const loginValue = campoLogin ? campoLogin.value.trim() : '';

    if (!loginValue) {
        alert("⚠️ Por favor, digite o seu Email ou Telefone primeiro, e depois clique no botão de Impressão Digital!");
        if (campoLogin) campoLogin.focus();
        return;
    }

    try {
        const resposta = await fetch('/api/webauthn/login-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // 🌟 OBRIGATÓRIO: Garante que a sessão vai junto!
            body: JSON.stringify({ login: loginValue })
        });

        const opcoes = await resposta.json();

        if (opcoes.error) {
            alert("⚠️ " + opcoes.error);
            return;
        }

        const credencial = await SimpleWebAuthnBrowser.startAuthentication(opcoes);

        const verificacao = await fetch('/api/webauthn/login-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // 🌟 OBRIGATÓRIO: Garante que a sessão vai junto!
            body: JSON.stringify(credencial)
        });

        const resultado = await verificacao.json();

        if (resultado.success) {
            localStorage.setItem('userRole', resultado.role);
            if (resultado.role === 'client') window.location.href = 'dashboard-client.html';
            else if (resultado.role === 'employee') window.location.href = 'dashboard-employee.html';
            else window.location.href = 'dashboard-admin.html';
        } else {
            alert("❌ Impressão digital incorreta. " + (resultado.error || "Tente novamente."));
        }

    } catch (erro) {
        console.error("Erro no login:", erro);
        if (erro.name === 'NotAllowedError') {
            alert("⚠️ Login cancelado ou tempo esgotado.");
        } else {
            alert("❌ Erro ao reconhecer o seu dedo/rosto. Tente limpar o sensor.");
        }
    }
}

window.loginComBiometria = loginComBiometria;
// ==================================================================
// FUNÇÃO DA CICI EXPLICANDO A BIOMETRIA (TEXTO E VOZ)
// ==================================================================
function explicarBiometriaCici() {
    // 1. Cria o balão visual da Cici
    let ciciMsg = document.getElementById('cici-bio-msg');
    if (!ciciMsg) {
        ciciMsg = document.createElement('div');
        ciciMsg.id = 'cici-bio-msg';
        ciciMsg.innerHTML = `
            <div style="display:flex; align-items:center; gap:15px; background:rgba(10, 25, 49, 0.95); padding:15px 20px; border-radius:15px; border:2px solid #009ee3; box-shadow:0 10px 30px rgba(0,158,227,0.4); color:#fff; max-width:350px;">
                <div style="font-size:35px; animation: bounce 2s infinite;">👩‍💻</div>
                <div>
                    <strong style="color:#009ee3; font-size:16px;">Assistente Cici diz:</strong><br>
                    <span style="font-size:14px; line-height:1.4;">Oi! Sabia que você pode entrar na sua conta sem precisar digitar a senha? É só clicar no botão escuro "Ativar Impressão Digital Agora", e seguir as instruções na tela do seu celular! É super seguro!</span>
                </div>
            </div>
        `;
        ciciMsg.style.position = 'fixed';
        ciciMsg.style.bottom = '30px';
        ciciMsg.style.right = '20px';
        ciciMsg.style.zIndex = '9999';
        ciciMsg.style.transform = 'translateY(150px)';
        ciciMsg.style.opacity = '0';
        ciciMsg.style.transition = 'all 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
        document.body.appendChild(ciciMsg);
    }

    // Faz a Cici subir na tela
    setTimeout(() => {
        ciciMsg.style.transform = 'translateY(0)';
        ciciMsg.style.opacity = '1';
    }, 100);

    // 2. A MÁGICA DA VOZ DA CICI 🎙️
    const textoFalado = "Oi! Sabia que você pode entrar na sua conta sem precisar digitar a senha? É só clicar no botão escuro: Ativar Impressão Digital Agora, e seguir as instruções na tela do seu celular! É super seguro!";
    const vozCici = new SpeechSynthesisUtterance(textoFalado);
    vozCici.lang = 'pt-BR'; // Sotaque em português do Brasil
    vozCici.rate = 1.05; // Velocidade um pouquinho mais rápida e dinâmica
    vozCici.pitch = 1.2; // Voz mais feminina e simpática
    
    // Cancela falas anteriores e começa a falar
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(vozCici);

    // 3. Faz o botão de Ativar a Biometria piscar e brilhar
    const btnBio = document.getElementById('btn-ativar-bio');
    if (btnBio) {
        btnBio.style.transition = 'all 0.3s';
        btnBio.style.background = '#009ee3';
        btnBio.style.color = '#fff';
        btnBio.style.boxShadow = '0 0 20px #009ee3';
        btnBio.style.transform = 'scale(1.05)';
        
        // Tira o brilho depois de 10 segundos
        setTimeout(() => {
            btnBio.style.background = '#0a1931';
            btnBio.style.color = '#d4af37';
            btnBio.style.boxShadow = 'none';
            btnBio.style.transform = 'scale(1)';
        }, 10000);
    }
    
    // 4. A Cici vai embora da tela depois de 12 segundos (tempo suficiente para ela terminar de falar)
    setTimeout(() => {
        if (ciciMsg) {
            ciciMsg.style.transform = 'translateY(150px)';
            ciciMsg.style.opacity = '0';
            setTimeout(() => ciciMsg.remove(), 600);
        }
    }, 12000);
}
// ==================================================================
// FUNÇÃO UNIVERSAL DA CICI (FALA ERROS E SUCESSOS)
// ==================================================================
function ciciAvisa(mensagemTexto, tipo = 'info') {
    // Define as cores e o rostinho dependendo se é erro ou sucesso
    let cor = '#009ee3'; // Azul por padrão
    let emoji = '👩‍💻';
    
    if (tipo === 'erro') {
        cor = '#ff4d4d'; // Vermelho para erros
        emoji = '😟';
    } else if (tipo === 'sucesso') {
        cor = '#4CAF50'; // Verde para sucesso
        emoji = '🎉';
    }

    // Se já tiver uma mensagem da Cici na tela, remove para colocar a nova
    let msgAntiga = document.getElementById('cici-bio-msg');
    if (msgAntiga) msgAntiga.remove();

    // 1. Cria o balão visual da Cici
    let ciciMsg = document.createElement('div');
    ciciMsg.id = 'cici-bio-msg';
    ciciMsg.innerHTML = `
        <div style="display:flex; align-items:center; gap:15px; background:rgba(10, 25, 49, 0.95); padding:15px 20px; border-radius:15px; border:2px solid ${cor}; box-shadow:0 10px 30px rgba(0,0,0,0.4); color:#fff; max-width:350px;">
            <div style="font-size:35px; animation: bounce 2s infinite;">${emoji}</div>
            <div>
                <strong style="color:${cor}; font-size:16px;">Assistente Cici diz:</strong><br>
                <span style="font-size:14px; line-height:1.4;">${mensagemTexto}</span>
            </div>
        </div>
    `;
    ciciMsg.style.position = 'fixed';
    ciciMsg.style.bottom = '30px';
    ciciMsg.style.right = '20px';
    ciciMsg.style.zIndex = '9999';
    ciciMsg.style.transform = 'translateY(150px)';
    ciciMsg.style.opacity = '0';
    ciciMsg.style.transition = 'all 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
    document.body.appendChild(ciciMsg);

    // Faz a Cici subir na tela
    setTimeout(() => {
        ciciMsg.style.transform = 'translateY(0)';
        ciciMsg.style.opacity = '1';
    }, 100);

    // 2. A MÁGICA DA VOZ DA CICI 🎙️
    const vozCici = new SpeechSynthesisUtterance(mensagemTexto);
    vozCici.lang = 'pt-BR'; 
    vozCici.rate = 1.05; 
    vozCici.pitch = 1.2; 
    
    window.speechSynthesis.cancel(); // Para de falar se já estiver falando
    window.speechSynthesis.speak(vozCici);
    
    // 3. A Cici vai embora da tela depois de 8 segundos
    setTimeout(() => {
        if (ciciMsg) {
            ciciMsg.style.transform = 'translateY(150px)';
            ciciMsg.style.opacity = '0';
            setTimeout(() => ciciMsg.remove(), 600);
        }
    }, 8000);
}
// ==================================================================
// FUNÇÃO PARA CADASTRAR A BIOMETRIA NO PAINEL DO CLIENTE
// ==================================================================
async function registarBiometria() {
    try {
        const resp = await fetch('/api/webauthn/register-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include' // 🌟 CORREÇÃO: Garante que o servidor sabe quem você é!
        });

        const options = await resp.json();

        if (options.error) {
            ciciAvisa("Não foi possível iniciar a biometria: " + options.error, "erro");
            return;
        }

        ciciAvisa("Por favor, toque no sensor de impressão digital do seu telemóvel.", "info");
        const credencial = await SimpleWebAuthnBrowser.startRegistration(options);

        const verifyResp = await fetch('/api/webauthn/register-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // 🌟 CORREÇÃO AQUI TAMBÉM!
            body: JSON.stringify(credencial)
        });

        const result = await verifyResp.json();

        if (result.success) {
            ciciAvisa("Que máximo! A sua impressão digital foi salva com sucesso. No próximo login, já não precisará de senha!", "sucesso");
        } else {
            ciciAvisa("Ops! " + (result.error || "A digital não foi guardada. Tente novamente."), "erro");
        }
    } catch (error) {
        console.error("Erro no registo:", error);
        ciciAvisa("Ocorreu um erro ou você cancelou a leitura.", "erro");
    }
}

window.registarBiometria = registarBiometria;
// ==================================================================
// LÓGICA DO BOTÃO FLUTUANTE DA ROLETA (ARRASTAR E CLICAR)
// ==================================================================
const roletaBtn = document.getElementById('btn-roleta-flutuante');

if (roletaBtn) {
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    // Quando o utilizador toca no botão (Telemóvel)
    roletaBtn.addEventListener('touchstart', (e) => {
        isDragging = false;
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        
        const rect = roletaBtn.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        
        roletaBtn.style.transition = 'none'; // Tira a animação para arrastar suavemente
    });

    // Quando o utilizador arrasta o dedo
    roletaBtn.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        
        // Se ele moveu o dedo mais de 5 pixels, consideramos que está a arrastar (e não a clicar)
        if (Math.abs(touch.clientX - startX) > 5 || Math.abs(touch.clientY - startY) > 5) {
            isDragging = true;
            e.preventDefault(); // Impede que a página role para baixo
            
            const dx = touch.clientX - startX;
            const dy = touch.clientY - startY;
            
            // Move o botão para a nova posição
            roletaBtn.style.left = `${initialLeft + dx}px`;
            roletaBtn.style.top = `${initialTop + dy}px`;
            roletaBtn.style.bottom = 'auto'; 
            roletaBtn.style.right = 'auto';
        }
    }, { passive: false });

    // Quando o utilizador levanta o dedo
    roletaBtn.addEventListener('touchend', () => {
        roletaBtn.style.transition = 'transform 0.2s'; // Devolve a animação de clique
        
        // Se ele não arrastou, então foi um CLIQUE!
        if (!isDragging) {
            abrirRoleta();
        }
    });

    // Mesma lógica para testes com o Rato no Computador
    roletaBtn.addEventListener('mousedown', (e) => {
        isDragging = false;
        startX = e.clientX;
        startY = e.clientY;
        const rect = roletaBtn.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        roletaBtn.style.transition = 'none';
        
        const onMouseMove = (moveEvent) => {
            if (Math.abs(moveEvent.clientX - startX) > 5 || Math.abs(moveEvent.clientY - startY) > 5) {
                isDragging = true;
                const dx = moveEvent.clientX - startX;
                const dy = moveEvent.clientY - startY;
                roletaBtn.style.left = `${initialLeft + dx}px`;
                roletaBtn.style.top = `${initialTop + dy}px`;
                roletaBtn.style.bottom = 'auto'; 
                roletaBtn.style.right = 'auto';
            }
        };
        
        const onMouseUp = () => {
            roletaBtn.style.transition = 'transform 0.2s';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            if (!isDragging) abrirRoleta();
        };
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

// ==============================================================
// FUNÇÕES DE AÇÃO EM MASSA (ENCOMENDAS)
// ==============================================================

// Selecionar/Deselecionar Todos
function toggleAllOrderCheckboxes(source) {
    const checkboxes = document.querySelectorAll('.order-checkbox');
    checkboxes.forEach(cb => cb.checked = source.checked);
    updateBulkCounter();
}

// Atualizar o contador visual de itens selecionados
function updateBulkCounter() {
    const checkboxes = document.querySelectorAll('.order-checkbox:checked');
    const count = checkboxes.length;
    const container = document.getElementById('bulk-action-container');
    const countSpan = document.getElementById('bulk-count');
    const mestreCheckbox = document.getElementById('selectAllOrders');
    
    // Atualiza o número
    if (countSpan) countSpan.innerText = count;
    
    // Mostra ou esconde o menu de ação em massa
    if (container) {
        container.style.display = count > 0 ? 'flex' : 'none';
    }

    // Desmarca o master se nem todos estiverem marcados
    const allCheckboxes = document.querySelectorAll('.order-checkbox');
    if (mestreCheckbox && allCheckboxes.length > 0) {
        mestreCheckbox.checked = count === allCheckboxes.length;
    }
}

// ==============================================================
// FUNÇÃO: APLICAR STATUS EM MASSA (FRONT-END CORRIGIDO)
// ==============================================================
async function applyBulkStatus() {
    const checkboxes = document.querySelectorAll('.order-checkbox:checked');
    const newStatus = document.getElementById('bulk-status-select').value;
    
    if (checkboxes.length === 0) return alert("Selecione pelo menos uma encomenda.");
    if (!newStatus) return alert("Selecione o novo status que deseja aplicar.");
    
    if (!confirm(`Tem certeza que deseja alterar o status de ${checkboxes.length} encomendas para "${newStatus}"?`)) return;

    // Pega os IDs selecionados
    const orderIds = Array.from(checkboxes).map(cb => cb.value);

    // Muda o texto do botão para dar feedback visual
    const btnAplicar = document.querySelector('#bulk-action-container button');
    if(btnAplicar) btnAplicar.innerText = "Atualizando...";

    try {
        // 🌟 NOME DA ROTA NOVA E MÉTODO POST
        const response = await fetch('/api/orders/bulk-update-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: orderIds, status: newStatus })
        });

        const data = await response.json();
        
        if (data.success) {
            alert(`✅ ${data.updated} encomendas atualizadas com sucesso!\nO sistema está enviando as notificações.`);
            
            // Reseta a interface
            document.getElementById('selectAllOrders').checked = false;
            document.getElementById('bulk-status-select').value = "";
            document.getElementById('bulk-action-container').style.display = 'none';
            
            // Atualiza a tabela imediatamente
            if (typeof loadOrders === 'function') loadOrders(); 
        } else {
            alert("Erro: " + data.message);
        }
    } catch (error) {
        console.error(error);
        alert("Erro de conexão ao tentar atualizar em massa.");
    } finally {
        if(btnAplicar) btnAplicar.innerText = "Aplicar";
    }
}
// Alternar entre CNPJ e E-mail
function togglePixKey(tipo) {
    const txt = document.getElementById('txt-chave');
    const label = document.getElementById('tipo-chave');
    const tabCnpj = document.getElementById('tab-cnpj');
    const tabEmail = document.getElementById('tab-email');

    if(tipo === 'cnpj') {
        txt.innerText = '49356085000134';
        label.innerText = '(Chave CNPJ)';
        tabCnpj.style.background = '#0a1931'; tabCnpj.style.color = 'white';
        tabEmail.style.background = '#eee'; tabEmail.style.color = '#333';
    } else {
        txt.innerText = 'comercialguineexpress245@gmail.com';
        label.innerText = '(Chave E-mail)';
        tabEmail.style.background = '#0a1931'; tabEmail.style.color = 'white';
        tabCnpj.style.background = '#eee'; tabCnpj.style.color = '#333';
    }
}
// Copiar chave manual
function copyManualPix() {
    const chave = document.getElementById('txt-chave').innerText;
    copiarTextoUniversal(chave, "Chave PIX copiada! Agora pague no seu banco e volte para enviar o comprovante.");
}

// ==========================================
// CLIENTE ENVIA COMPROVANTE PIX
// ==========================================
async function submitPixReceipt() {
    const orderId = document.getElementById('pay-order-id').value;
    const fileInput = document.getElementById('pix-file-input');
    
    // 👇 CORREÇÃO 1: Atualizamos para o ID novo do botão!
    const btn = document.getElementById('btn-auto-submit-pix');

    if (!fileInput.files[0]) {
        return alert("Por favor, selecione a foto do comprovante antes de enviar.");
    }

    const formData = new FormData();
    formData.append('receipt', fileInput.files[0]);

    // 👇 CORREÇÃO 2: Trava de segurança para evitar o erro null
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ENVIANDO...';
    }

    try {
        const res = await fetch(`/api/invoices/${orderId}/upload-receipt`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (data.success) {
            alert("✅ Comprovante enviado! O administrador foi notificado no WhatsApp e fará a conferência.");
            closePaymentModal();
            if(typeof loadClientInvoices === 'function') loadClientInvoices(); // Atualiza a tabela
        } else {
            alert("Erro: " + data.message);
        }
    } catch (err) {
        console.error(err);
        alert("Erro na conexão com o servidor. Tente novamente.");
    } finally {
        // 👇 CORREÇÃO 3: Restaura o visual do botão novo caso dê erro
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-camera"></i> ANEXAR E ENVIAR';
        }
        // Limpa a foto da memória para não bugar o próximo envio
        fileInput.value = '';
    }
}
// ==========================================
// FUNÇÃO PARA BUSCAR CLIENTE NO DROPDOWN
// ==========================================
function filtrarClientesDropdown() {
    const termo = document.getElementById('order-client-search').value.toLowerCase();
    const options = document.getElementById('order-client-select').options;
    
    for (let i = 0; i < options.length; i++) {
        const texto = options[i].text.toLowerCase();
        // Oculta quem não tem o texto digitado (exceto a primeira opção "Selecione")
        const esconder = !texto.includes(termo) && options[i].value !== "";
        options[i].hidden = esconder;
        options[i].disabled = esconder; 
    }
}
// ==========================================
// FUNÇÃO PARA BUSCAR CLIENTE NO DROPDOWN DE BOX
// ==========================================
function filtrarClientesBoxDropdown() {
    const termo = document.getElementById('box-client-search').value.toLowerCase();
    const options = document.getElementById('box-client-select').options;
    
    for (let i = 0; i < options.length; i++) {
        const texto = options[i].text.toLowerCase();
        // Oculta quem não tem o texto digitado (exceto a primeira opção "Selecione")
        const esconder = !texto.includes(termo) && options[i].value !== "";
        options[i].hidden = esconder;
        options[i].disabled = esconder; 
    }
}
// ==========================================
// FUNÇÃO PARA BUSCAR CLIENTE NO FINANCEIRO
// ==========================================
function filtrarClientesFinanceiroDropdown() {
    const termo = document.getElementById('bill-client-search').value.toLowerCase();
    const options = document.getElementById('bill-client-select').options;
    
    for (let i = 0; i < options.length; i++) {
        const texto = options[i].text.toLowerCase();
        // Oculta quem não tem o texto digitado (exceto a primeira opção)
        const esconder = !texto.includes(termo) && options[i].value !== "";
        options[i].hidden = esconder;
        options[i].disabled = esconder; 
    }
}
// ==========================================
// 1. ABA DE ENTREGAS INTELIGENTE (COM FILTRO DE LOTE)
// ==========================================
async function loadDeliveryList() {
    try {
        const response = await fetch('/api/orders'); 
        const orders = await response.json();
        const list = document.getElementById('delivery-list');
        if(!list) return;
        
        list.innerHTML = '';

        // Verifica se o usuário quer ver o histórico
        const toggleBtn = document.getElementById('toggle-deliveries');
        const showCompleted = toggleBtn ? toggleBtn.checked : false;

        // ==========================================
        // 🧠 CÉREBRO DO FILTRO DE LOTES (Aprende sozinho!)
        // ==========================================
        const filterSelect = document.getElementById('delivery-lot-filter');
        const loteSelecionado = filterSelect ? filterSelect.value : '';

        if (filterSelect) {
            // Pega todos os nomes de lotes salvos nas encomendas (tira os vazios/nulos)
            const todosOsLotes = orders.map(o => o.lote || 'Sem Lote');
            const lotesUnicos = [...new Set(todosOsLotes)];

            let htmlFiltro = '<option value="">📦 Todos os Envios/Lotes</option>';
            lotesUnicos.sort().forEach(l => {
                htmlFiltro += `<option value="${l}">✈️ ${l}</option>`;
            });
            
            filterSelect.innerHTML = htmlFiltro;
            
            // Mantém selecionado o lote que estava antes
            if (lotesUnicos.includes(loteSelecionado) || loteSelecionado === '') {
                filterSelect.value = loteSelecionado;
            }
        }
        // ==========================================

        orders.forEach(order => {
            const isDelivered = order.status === 'Entregue';
            
            // MÁGICA 1: Se for entregue e o botão não estiver marcado, pula e oculta!
            if (isDelivered && !showCompleted) return;

            // MÁGICA 2: Freio do Lote! Se não for do lote escolhido, pula e oculta!
            const loteDestaOrder = order.lote || 'Sem Lote';
            if (loteSelecionado !== '' && loteDestaOrder !== loteSelecionado) return;

            const volumeExibicao = order.volumes_reais || order.volumes || '1';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight: bold;">${order.code}</td>
                <td>${order.client_name}</td>
                <td style="text-align: center; font-weight: bold; color: #0a1931;">${volumeExibicao}</td>
                <td>
                    <span class="badge" style="background: ${isDelivered ? '#27ae60' : '#f39c12'}; color: white; padding: 4px 8px; border-radius: 4px;">
                        ${order.status}
                    </span>
                </td>
                <td style="text-align: center;">
                    ${isDelivered 
                        ? `<span style="color: #27ae60; font-weight: bold;"><i class="fas fa-check-circle"></i> JÁ ENTREGUE</span>
                           <div style="display:flex; justify-content:center; gap:5px; margin-top:8px;">
                               ${order.proof_image ? `<button onclick='viewDeliveryPhoto("${order.proof_image}")' style="color:#6f42c1; border:1px solid #6f42c1; background:none; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:12px; font-weight:bold;" title="Ver foto enviada"><i class="fas fa-camera"></i> Foto</button>` : ''}
                               <button onclick="undoDelivery('${order.code}')" style="color:#dc3545; border:1px solid #dc3545; background:none; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:12px; font-weight:bold;" title="Apagar foto e tentar de novo"><i class="fas fa-undo"></i> Desfazer</button>
                           </div>` 
                        : `<button onclick="confirmDelivery('${order.code}')" class="btn" style="background: #27ae60; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer;">
                            <i class="fas fa-handshake"></i> CONFIRMAR ENTREGA
                           </button>`
                    }
                </td>
            `;
            list.appendChild(tr);
        });
    } catch (err) {
        console.error("Erro ao carregar lista de entregas:", err);
    }
}

// ==========================================
// FUNÇÃO PARA DESFAZER A ENTREGA
// ==========================================
async function undoDelivery(code) {
    // Pede uma confirmação rápida para evitar clique sem querer
    if (!confirm(`⚠️ Tem certeza que deseja DESFAZER a entrega da encomenda ${code}? A foto atual será apagada e você terá que tirar outra.`)) return;
    
    try {
        const res = await fetch(`/api/orders/${code}/undo-delivery`, { method: 'POST' });
        const data = await res.json();
        
        if (data.success) {
            alert('🔄 Entrega desfeita! A câmera foi liberada para você tirar a foto novamente.');
            loadDeliveryList(); // Atualiza a lista na tela (o botão verde volta a aparecer)
        } else {
            alert('❌ Erro ao desfazer: ' + data.message);
        }
    } catch (err) {
        console.error(err);
        alert('❌ Erro de conexão ao tentar desfazer a entrega.');
    }
}

// ==========================================
// SISTEMA DE ENTREGA COM FOTO (POD - Base64)
// ==========================================

var pendingDeliveryCode = null;
var currentProofBase64 = null;

// Abre o modal de captura ao invés de confirmar direto
function confirmDelivery(code) {
    pendingDeliveryCode = code;
    currentProofBase64 = null;
    
    // Reseta o visual do modal
    document.getElementById('camera-input').value = '';
    document.getElementById('preview-container').style.display = 'none';
    document.getElementById('btn-submit-delivery').disabled = true;
    
    document.getElementById('delivery-modal').style.display = 'flex';
}

function closeDeliveryModal() {
    document.getElementById('delivery-modal').style.display = 'none';
    pendingDeliveryCode = null;
    currentProofBase64 = null;
}

// Quando o usuário tira a foto, converte e reduz tamanho
function previewDeliveryImage(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        // Exibe o preview
        const imgElement = document.getElementById('image-preview');
        imgElement.src = e.target.result;
        document.getElementById('preview-container').style.display = 'block';
        
        // Habilita o botão de envio
        document.getElementById('btn-submit-delivery').disabled = false;
        
        // Vamos comprimir a imagem num Canvas para não estourar o banco de dados
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 600; // Reduz a resolução para caber tranquilo
            const scaleSize = MAX_WIDTH / img.width;
            canvas.width = MAX_WIDTH;
            canvas.height = img.height * scaleSize;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // Salva a imagem comprimida na variável global
            currentProofBase64 = canvas.toDataURL('image/jpeg', 0.6); // 60% de qualidade
        }
        img.src = e.target.result;
    }
    reader.readAsDataURL(file);
}

// Envia os dados para o servidor (Agora silencioso, o servidor se vira com o Zap)
async function submitDelivery() {
    if (!pendingDeliveryCode || !currentProofBase64) return;

    const btn = document.getElementById('btn-submit-delivery');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    btn.disabled = true;

    try {
        const response = await fetch(`/api/orders/${pendingDeliveryCode}/deliver`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ proofImage: currentProofBase64 }) // Manda a foto pro banco
        });

        if (response.ok) {
            alert("✅ Encomenda entregue! A foto foi salva e enviada automaticamente no WhatsApp do cliente.");
            closeDeliveryModal();
            loadDeliveryList(); 
        } else {
            const errorData = await response.json();
            alert("❌ Erro: " + (errorData.error || "Falha ao registrar"));
            btn.innerHTML = 'Confirmar Entrega';
            btn.disabled = false;
        }
    } catch (err) {
        console.error("Erro na requisição:", err);
        alert("Erro de conexão com o servidor.");
        btn.innerHTML = 'Confirmar Entrega';
        btn.disabled = false;
    }
}
// ==========================================
// ETIQUETA SIMPLES DE IDENTIFICAÇÃO DE BOX (100x150mm) - VERSÃO MOBILE FRIENDLY
// ==========================================
function printSimpleBoxLabel(boxCode) {
    // 1. Força a primeira letra a ser maiúscula (ex: "box 1" vira "Box 1")
    let formattedBoxCode = boxCode;
    if (formattedBoxCode && formattedBoxCode.toLowerCase().startsWith('box ')) {
        formattedBoxCode = 'Box ' + formattedBoxCode.substring(4);
    }

    const htmlContent = `
        <html>
        <head>
            <title>Etiqueta Simples - ${formattedBoxCode}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700;900&display=swap');
                
                /* Configuração EXATA para impressora térmica de etiquetas 100x150mm */
                @page {
                    size: 100mm 150mm;
                    margin: 0;
                }
                
                body { 
                    font-family: 'Roboto', sans-serif; 
                    margin: 0; 
                    padding: 0;
                    display: flex; 
                    flex-direction: column;
                    align-items: center; 
                    background-color: #f4f4f4; 
                }

                /* Aviso para quem está no celular */
                .mobile-warning {
                    background-color: #ff9800;
                    color: white;
                    padding: 15px;
                    text-align: center;
                    width: 100%;
                    font-weight: bold;
                    margin-bottom: 20px;
                    box-sizing: border-box;
                }

                @media print {
                    .mobile-warning { display: none !important; }
                    body { background: white; display: block; }
                }

                .label-container { 
                    width: 96mm; 
                    height: 146mm; 
                    background: white; 
                    border: 2mm solid #000; 
                    border-radius: 4mm;
                    box-sizing: border-box;
                    display: flex; 
                    flex-direction: column; 
                    padding: 5mm;
                    position: relative;
                    margin-top: 10px;
                }

                /* Cabeçalho - Nome da Agência */
                .header {
                    text-align: center;
                    border-bottom: 1.5mm solid #000;
                    padding-bottom: 5mm;
                    margin-bottom: 5mm;
                }
                .agency-name { 
                    font-size: 24px; 
                    text-transform: uppercase; 
                    font-weight: 900; 
                    letter-spacing: 2px;
                    color: #000;
                }
                .subtitle {
                    font-size: 12px;
                    text-transform: uppercase;
                    color: #444;
                    font-weight: 700;
                    margin-top: 2px;
                }

                /* Centro - O Destaque do BOX */
                .box-highlight {
                    flex-grow: 1;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    background-color: #000;
                    color: #fff;
                    border-radius: 3mm;
                    padding: 10mm;
                    margin-bottom: 5mm;
                }
                .box-text { 
                    font-size: 20px; 
                    font-weight: 700; 
                    letter-spacing: 5px;
                    margin-bottom: -5px;
                }
                .box-code { 
                    font-size: 48px; 
                    font-weight: 900; 
                    line-height: 1.1;
                    text-align: center;
                }

                /* Rodapé - "Código de barras" fake e infos */
                .footer {
                    text-align: center;
                    border-top: 1mm dashed #000;
                    padding-top: 5mm;
                }
                .barcode-lines {
                    height: 30px;
                    width: 80%;
                    margin: 0 auto 5px auto;
                    background: repeating-linear-gradient(
                        90deg,
                        #000,
                        #000 2px,
                        transparent 2px,
                        transparent 4px,
                        #000 4px,
                        #000 7px,
                        transparent 7px,
                        transparent 9px
                    );
                }
                .footer-text {
                    font-size: 10px;
                    font-weight: 700;
                    color: #000;
                }

                /* Ajustes finais para a hora de imprimir */
                @media print {
                    .label-container { border: 1.5mm solid #000; margin: 0; }
                    .box-highlight { 
                        -webkit-print-color-adjust: exact; 
                        print-color-adjust: exact; 
                    }
                }
            </style>
        </head>
        <body>
            <div class="mobile-warning">
                Se a janela de impressão não abrir sozinha, use o menu do seu navegador (três pontinhos) e clique em "Compartilhar" > "Imprimir" ou "Salvar como PDF".<br><br>
                <button onclick="window.print()" style="padding: 10px 20px; margin-top:10px; font-weight:bold; cursor:pointer;">IMPRIMIR AGORA</button>
            </div>

            <div class="label-container">
                <div class="header">
                    <div class="agency-name">Guineexpress</div>
                    <div class="subtitle">Logística & Encomendas</div>
                </div>

                <div class="box-highlight">
                    <div class="box-text">IDENTIFICAÇÃO</div>
                    <div class="box-code">${formattedBoxCode}</div>
                </div>

                <div class="footer">
                    <div class="barcode-lines"></div>
                    <div class="footer-text">REF: ${formattedBoxCode}</div>
                </div>
            </div>
            
            <script>
                // Tenta abrir a impressão automaticamente
                window.onload = function() { 
                    setTimeout(() => {
                        window.print(); 
                    }, 1000);
                }
            </script>
        </body>
        </html>
    `;

    // Para celular, a melhor abordagem é abrir na MESMA janela ou usar um iframe.
    // Usar uma nova janela no mobile frequentemente quebra. 
    // Aqui, vamos tentar abrir uma nova aba simples sem tentar forçar tamanhos.
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    } else {
        alert("O seu navegador bloqueou a abertura da etiqueta. Por favor, permita pop-ups para este site.");
    }
}

// ==========================================
// CARREGAR DADOS DO CLIENTE NO CABEÇALHO VIP
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    // Só executa se estivermos na página do cliente
    if (document.getElementById('vip-profile-img')) {
        try {
            const res = await fetch('/api/check-session');
            const data = await res.json();
            
            if (data.loggedIn && data.user) {
                // Atualiza o nome de boas-vindas
                const nameDisplay = document.getElementById('user-name-display');
                if (nameDisplay) nameDisplay.innerText = data.user.name.split(' ')[0]; // Mostra só o primeiro nome

                // Atualiza a foto de perfil no cabeçalho e na aba perfil
                if (data.user.profile_pic && data.user.profile_pic !== 'default.png') {
                    const imgUrl = data.user.profile_pic.startsWith('http') 
                        ? data.user.profile_pic 
                        : '/uploads/' + data.user.profile_pic;
                    
                    document.getElementById('vip-profile-img').src = imgUrl;
                    
                    const profileImg = document.getElementById('profile-img-display');
                    if(profileImg) profileImg.src = imgUrl;
                }
            }
        } catch (error) {
            console.error("Erro ao carregar sessão para o cabeçalho:", error);
        }
    }
});
// ==============================================================
// 🌟 SISTEMA INTELIGENTE DE NOTIFICAÇÕES (COM CONFIRMAÇÃO DE LEITURA)
// ==============================================================

let tentativasAssistente = 0;
let assistenteInterval = setInterval(iniciarAssistente, 2000);

// Variáveis para guardar o que está pendente atualmente
let currentPendingOrdersIds = "";
let currentPendingInvoicesIds = "";

async function iniciarAssistente() {
    tentativasAssistente++;

    // Aguarda o usuário ser carregado
    if (typeof currentUser === 'undefined' || !currentUser) {
        if (tentativasAssistente > 10) clearInterval(assistenteInterval);
        return;
    }

    clearInterval(assistenteInterval);

    // Se não for cliente, aborta silenciosamente
    if (currentUser.role !== 'client') return;

    let alertas = [];
    let mostrarBolinhaOrders = false;
    let mostrarBolinhaInvoices = false;
    let countOrders = 0;
    let countInvoices = 0;

    // 1. Checar Encomendas
    try {
        const res = await fetch('/api/orders');
        if (res.ok) {
            const orders = await res.json();
            const pendentes = orders.filter(o => o.status !== 'Entregue' && o.status !== 'Avaria');
            countOrders = pendentes.length;
            
            // Salva os IDs de tudo que está pendente hoje para comparar com o que ele já viu
            currentPendingOrdersIds = pendentes.map(o => o.id).sort().join(',');
            const lidos = localStorage.getItem('lido_orders') || "";

            // Só mostra a bolinha se houver encomendas E se for diferente do que ele já tinha visto
            if (countOrders > 0 && currentPendingOrdersIds !== lidos) {
                mostrarBolinhaOrders = true;
                alertas.push(`📦 Você tem <b>${countOrders} encomenda(s)</b> a caminho. <a href="#" onclick="showTab('orders')" style="color:#007bff; text-decoration:none;"><b>Rastrear agora ➔</b></a>`);
            }
        }
    } catch(e) {}

    // 2. Checar Faturas
    try {
        // ROTA CORRIGIDA DE VERDADE AGORA!
        const res = await fetch('/api/invoices');
        if (res.ok) {
            const invoices = await res.json();
            const pendentes = invoices.filter(i => i.status === 'pending');
            countInvoices = pendentes.length;

            currentPendingInvoicesIds = pendentes.map(i => i.id).sort().join(',');
            const lidos = localStorage.getItem('lido_invoices') || "";

            // Só mostra a bolinha se houver faturas E se for diferente do que ele já tinha visto
            if (countInvoices > 0 && currentPendingInvoicesIds !== lidos) {
                mostrarBolinhaInvoices = true;
                alertas.push(`🚨 Atenção: Você tem <b>${countInvoices} fatura(s) pendente(s)</b>! <a href="#" onclick="showTab('invoices')" style="color:#dc3545; text-decoration:none;"><b>[ Pagar Agora ]</b></a>`);
            }
        }
    } catch(e) {}

    // === INJETAR NA TELA ===
    if (mostrarBolinhaOrders) atualizarBolinhaMenu('orders', countOrders);
    if (mostrarBolinhaInvoices) atualizarBolinhaMenu('invoices', countInvoices);
    
    mostrarCardAvisos(alertas);
}

// Cria a bolinha vermelha no menu
function atualizarBolinhaMenu(tabName, count) {
    const menuBtn = document.querySelector(`li[onclick*="${tabName}"], a[onclick*="${tabName}"]`);
    if (!menuBtn) return;

    const oldBadge = menuBtn.querySelector('.smart-badge');
    if (oldBadge) oldBadge.remove();

    if (count > 0) {
        // Agora a bolinha tem um ID para podermos apagá-la no clique
        menuBtn.innerHTML += `<span class="smart-badge" id="badge-${tabName}" style="background:#dc3545; color:white; border-radius:50%; padding:2px 6px; font-size:11px; margin-left:8px; font-weight:bold; box-shadow:0 0 5px rgba(220,53,69,0.5); vertical-align: top; animation: pulse 2s infinite;">${count}</span>`;
    }
}

// Cria o Card Amarelo na tela Início
function mostrarCardAvisos(alertas) {
    let container = document.getElementById('smart-alerts-container');
    
    if (!container) {
        const dashboardTab = document.getElementById('dashboard');
        if (!dashboardTab) return;
        container = document.createElement('div');
        container.id = 'smart-alerts-container';
        dashboardTab.insertBefore(container, dashboardTab.firstChild);
    }

    if (alertas.length === 0) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    let html = `
    <div style="background: #fff3cd; border-left: 5px solid #ffc107; padding: 15px; margin-bottom: 20px; border-radius: 6px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
        <h4 style="margin-top:0; color: #856404; font-size: 16px; margin-bottom: 10px;">
            <i class="fas fa-bell"></i> <b>Assistente GuineExpress:</b>
        </h4>
        <ul style="margin-bottom:0; color: #856404; line-height: 1.8; list-style-type: none; padding-left: 0;">`;
    
    alertas.forEach(alerta => html += `<li style="margin-bottom: 8px; font-size: 14px;">${alerta}</li>`);
    html += `</ul></div>`;
    
    container.innerHTML = html;
}

// ==============================================================
// 🕵️ MÁGICA PARA ESCONDER AS NOTIFICAÇÕES AO CLICAR NA ABA
// ==============================================================
document.addEventListener('click', (e) => {
    // 1. O cliente clicou em "Encomendas"?
    const clicouOrders = e.target.closest('[onclick*="orders"]');
    if (clicouOrders && currentPendingOrdersIds) {
        // Salva na memória que ele já abriu e leu!
        localStorage.setItem('lido_orders', currentPendingOrdersIds);
        
        // Remove a bolinha instantaneamente
        const badge = document.getElementById('badge-orders');
        if (badge) badge.remove();
        
        // Dá um refresh no robô para limpar o card amarelo também
        setTimeout(iniciarAssistente, 100); 
    }

    // 2. O cliente clicou em "Faturas"?
    const clicouInvoices = e.target.closest('[onclick*="invoices"]');
    if (clicouInvoices && currentPendingInvoicesIds) {
        // Salva na memória
        localStorage.setItem('lido_invoices', currentPendingInvoicesIds);
        
        // Remove a bolinha instantaneamente
        const badge = document.getElementById('badge-invoices');
        if (badge) badge.remove();

        // Dá um refresh no robô para limpar o card amarelo
        setTimeout(iniciarAssistente, 100);
    }
});
// Abre o popup pro cliente digitar
function openReceiverModal(boxId, currentName, currentDoc) {
    document.getElementById('rec-box-id').value = boxId;
    document.getElementById('rec-name').value = currentName !== 'null' ? currentName : '';
    document.getElementById('rec-doc').value = currentDoc !== 'null' ? currentDoc : '';
    document.getElementById('modal-receiver').style.display = 'flex';
}

// Salva e manda pro servidor
async function saveReceiver(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.innerText = "Salvando...";
    
    const data = {
        box_id: document.getElementById('rec-box-id').value,
        receiver_name: document.getElementById('rec-name').value,
        receiver_doc: document.getElementById('rec-doc').value
    };

    try {
        const res = await fetch('/api/boxes/set-receiver', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const json = await res.json();
        
        if(json.success) {
            closeModal('modal-receiver');
            alert("✅ Destinatario salvo com sucesso! O nome já sairá no recibo.");
            loadBoxes(); // Atualiza a tabela pra ficar verde!
        } else {
            alert("Erro: " + json.msg);
        }
    } catch(err) {
        alert("Erro de conexão.");
    }
    btn.innerText = "Salvar Destinatario";
}
// --- CARREGAR E SOMAR OS ITENS DA LISTA DE EMBARQUE ---
async function loadManifest() {
    try {
        const res = await fetch('/api/manifest');
        const json = await res.json();
        
        if (!json.success) return alert("Erro ao carregar lista de embarque.");

        // 🧠 CÉREBRO DO FILTRO DE LOTE DO MANIFESTO 🧠
        const filterSelect = document.getElementById('manifest-lote-filter');
        const loteSelecionado = filterSelect ? filterSelect.value : 'Todos';

        // 1. Aprende quais lotes vieram do banco e cria as opções
        if (filterSelect) {
            const lotesUnicos = [...new Set(json.data.map(row => row.lote || 'Sem Lote'))];
            
            // Só recria as opções se o select estiver vazio, para não perder a seleção ao atualizar
            if (filterSelect.options.length <= 1) {
                let htmlFiltro = '<option value="Todos">📦 Todos os Envios</option>';
                lotesUnicos.sort().forEach(l => htmlFiltro += `<option value="${l}">✈️ ${l}</option>`);
                filterSelect.innerHTML = htmlFiltro;
                filterSelect.value = loteSelecionado; // Restaura a opção que o usuário clicou
            }
        }

        // 2. FILTRA OS DADOS BASEADO NO LOTE ESCOLHIDO
        let dadosFiltrados = json.data;
        if (loteSelecionado !== 'Todos') {
            dadosFiltrados = dadosFiltrados.filter(row => (row.lote || 'Sem Lote') === loteSelecionado);
        }

        const tbody = document.getElementById('manifest-list');
        tbody.innerHTML = '';
        let itemMap = {};

        // 3. Soma as quantidades usando apenas os dados filtrados!
        dadosFiltrados.forEach(row => {
            if (!row.items) return; 
            
            let itemsArray = row.items.split(/,|\n/);
            
            itemsArray.forEach(item => {
                let cleanItem = item.trim();
                if (!cleanItem) return;

                let match = cleanItem.match(/^(\d+)\s*(.*)$/) || cleanItem.match(/^(.*)\s+(\d+)$/);
                let qtd = 1; 
                let nome = cleanItem;

                if (match) {
                    if (!isNaN(match[1])) { 
                        qtd = parseInt(match[1]); 
                        nome = match[2]; 
                    } else { 
                        qtd = parseInt(match[2]); 
                        nome = match[1]; 
                    }
                }

                nome = nome.trim().toUpperCase();
                if (nome === "") nome = "ITENS DIVERSOS";

                if (itemMap[nome]) {
                    itemMap[nome] += qtd;
                } else {
                    itemMap[nome] = qtd;
                }
            });
        });

        // Transforma o dicionário em lista e desenha na tabela
        let keys = Object.keys(itemMap).sort(); 
        
        if(keys.length === 0) {
            tbody.innerHTML = `<tr><td colspan="2" style="text-align:center;">Nenhum produto encontrado para o filtro: ${loteSelecionado}.</td></tr>`;
            return;
        }

        let totalGeral = 0;

        keys.forEach(nome => {
            let qtd = itemMap[nome];
            totalGeral += qtd;
            tbody.innerHTML += `
                <tr>
                    <td style="text-align: center; font-weight: bold; font-size: 16px; color: #d32f2f;">${qtd}</td>
                    <td style="font-weight: bold; color: #0a1931;">${nome}</td>
                </tr>
            `;
        });

        tbody.innerHTML += `
            <tr style="background-color: #e9ecef;">
                <td style="text-align: center; font-weight: 900; font-size: 18px;">${totalGeral}</td>
                <td style="font-weight: 900; font-size: 18px;">TOTAL DE ITENS</td>
            </tr>
        `;

    } catch (err) {
        console.error(err);
    }
}
// --- BAIXAR PDF DA LISTA DE EMBARQUE ---
function printManifestPDF() {
    const area = document.getElementById('print-manifest-area').innerHTML;
    const dataHoje = new Date().toLocaleDateString('pt-BR');
    
    // Cria uma tela de impressão rápida e bonita
    const janela = window.open('', '', 'width=800,height=600');
    janela.document.write(`
        <html>
        <head>
            <title>Manifesto de Carga - Guineexpress</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { text-align: center; color: #0a1931; margin-bottom: 5px; }
                p { text-align: center; color: #666; margin-top: 0; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                th { background-color: #0a1931; color: white; }
                .center { text-align: center; }
            </style>
        </head>
        <body>
            <h1>MANIFESTO DE CARGA - GUINEEXPRESS</h1>
            <p>Gerado em: ${dataHoje}</p>
            ${area}
        </body>
        </html>
    `);
    janela.document.close();
    janela.focus();
    setTimeout(() => { janela.print(); janela.close(); }, 500);
}

// --- NOVO BOTÃO DE BAIXAR EXCEL INTELIGENTE ---
function exportManifestExcel() {
    const filterSelect = document.getElementById('manifest-lote-filter');
    const lote = filterSelect ? filterSelect.value : 'Todos';
    
    // Manda o lote na URL para o servidor!
    window.location.href = '/api/export/smart-excel?lote=' + encodeURIComponent(lote);
}
// ==========================================
// FUNÇÃO PARA EXCLUIR CLIENTE (ADMIN)
// ==========================================
async function excluirCliente(id, nome) {
    // Confirmação de segurança dupla para não apagar sem querer
    const confirmacao = confirm(`⚠️ ATENÇÃO!\n\nTem certeza absoluta que deseja excluir o cadastro de "${nome}"?\n\nEsta ação apagará o acesso deste cliente e NÃO pode ser desfeita!`);
    
    if (!confirmacao) {
        return; // Se o admin clicar em "Cancelar", não faz nada
    }

    try {
        const res = await fetch(`/api/admin/clients/${id}`, {
            method: 'DELETE'
        });
        
        const data = await res.json();

        if (data.success) {
            alert("✅ " + data.msg);
            loadClients(); // Atualiza a tabela imediatamente tirando o cliente da tela
        } else {
            alert("❌ Erro: " + data.msg);
        }
    } catch (err) {
        console.error("Erro ao tentar excluir:", err);
        alert("Erro na conexão com o servidor. Tente novamente.");
    }
}
// ==========================================
// FUNÇÕES NOVAS PARA FACILITAR O ENVIO DO PIX
// ==========================================

// 1. Faz o auto-envio assim que o cliente escolhe a foto
function handleAutoSubmitPix() {
    const fileInput = document.getElementById('pix-file-input');
    
    // Se o cliente realmente escolheu um arquivo
    if (fileInput.files.length > 0) {
        const btn = document.getElementById('btn-auto-submit-pix');
        
        // Dá um "feedback" visual pro cliente saber que está indo
        if(btn) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ENVIANDO...';
            btn.style.opacity = '0.7';
            btn.disabled = true;
        }
        
        // Chama a sua função original que faz a gravação no sistema
        submitPixReceipt();
    }
}

// 2. Monta a mensagem para o WhatsApp automático
function sendPixViaWhatsApp() {
    const orderId = document.getElementById('pay-order-id').value;
    
    // ⚠️ ATENÇÃO: COLOQUE O NÚMERO DE WHATSAPP DA SUA EMPRESA AQUI ABAIXO ⚠️
    // Apenas números, com o código do país (55 para Brasil) e DDD.
    const numeroWhatsApp = "558598239207"; 
    
    const textoMensagem = encodeURIComponent(`Olá! Tive dificuldade de anexar no site, então estou enviando por aqui o comprovante de pagamento da minha encomenda/fatura #${orderId}. Segue a foto abaixo:`);
    
    window.open(`https://wa.me/${numeroWhatsApp}?text=${textoMensagem}`, '_blank');
}
// ==============================================================
// 🌟 RECEPTOR DE COMPROVANTES DIRETOS DO BANCO (VIA SERVIDOR)
// ==============================================================
window.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedFile = urlParams.get('shared_file'); // O servidor mandou o nome da foto aqui!
    
    // Se a URL tiver o nome do arquivo, é porque o cliente acabou de voltar do Banco!
    if (sharedFile) {
        // 1. Lembra qual fatura o cliente estava pagando
        const invoiceId = localStorage.getItem('fatura_pendente_id');
        
        if (!invoiceId) {
            alert('⚠️ Recebemos o comprovante, mas a fatura não foi encontrada na memória. Por favor, anexe manualmente no painel.');
            window.location.href = '/dashboard-client.html';
            return;
        }

        alert("🔄 Recebemos a foto do seu banco! Finalizando o envio para a Guineexpress...");

        try {
            // 2. Avisa o servidor para colar a foto na Fatura certa
            const res = await fetch(`/api/invoices/${invoiceId}/link-shared-receipt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: sharedFile })
            });
            
            const data = await res.json();

            if (data.success) {
                alert("✅ Comprovante enviado e vinculado com sucesso! O administrador já foi notificado.");
                
                // Limpa a memória pra não bugar a próxima
                localStorage.removeItem('fatura_pendente_id');
                
                // Limpa a URL e recarrega a página
                window.location.href = '/dashboard-client.html';
            } else {
                alert("❌ Erro ao vincular comprovante: " + data.message);
                window.location.href = '/dashboard-client.html';
            }
        } catch (erro) {
            alert("❌ Erro de conexão com o sistema.");
            window.location.href = '/dashboard-client.html';
        }
    }
});
// ==========================================
// CICÍ: ANÚNCIO DA NOVIDADE DE COMPARTILHAMENTO DE COMPROVANTE
// ==========================================
setTimeout(() => {
    // 1. Verifica se quem está logado é realmente um cliente
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'client') {
        
        // 2. 🧠 MEMÓRIA DA CICÍ: Só avisa se ainda não avisou nesta visita
        if (sessionStorage.getItem('ciciNovidadeShare') !== 'sim') {
            sessionStorage.setItem('ciciNovidadeShare', 'sim'); // Grava que já avisou
            
            // 3. Verifica se a Cicí está pronta para falar
            if (typeof CiciAI !== 'undefined') {
                // Se a janela da Cicí estiver fechada, ela abre sozinha
                if (!CiciAI.isOpen) CiciAI.toggle();
                
                // 4. A mensagem animada explicando como funciona!
                const mensagemNovidade = "🚀 <b>NOVIDADE INCRÍVEL!</b><br><br>" +
                                         "Agora ficou muito mais fácil enviar seus comprovantes!<br><br>" +
                                         "Ao fazer o pagamento no aplicativo do seu banco, basta clicar no botão de <b>Compartilhar</b> e escolher o ícone da <b>Guineexpress</b>.<br><br>" +
                                         "O comprovante entra direto no nosso sistema e vai para o administrador aprovar sua caixa na hora! Legal, né? ✨";
                
                CiciAI.addMessage(mensagemNovidade, "cici");
            }
        }
    }
}, 6000); // ⏳ Ela espera 6 segundos após o aplicativo carregar para dar a notícia!
// ============================================================
// FUNÇÃO DE PESQUISA (CORRIGIDA PARA AS 3 TABELAS 🐞✅)
// ============================================================
function filterInvoices() {
    const input = document.getElementById('search-invoices');
    const filter = input.value.toLowerCase();
    
    // Agora o sistema pesquisa nas 3 tabelas de uma vez!
    const tabelas = [
        document.getElementById('invoices-review-list'),
        document.getElementById('invoices-pending-list'),
        document.getElementById('invoices-paid-list')
    ];

    tabelas.forEach(tbody => {
        if (!tbody) return;
        const rows = tbody.getElementsByTagName('tr');

        for (let i = 0; i < rows.length; i++) {
            const rowText = rows[i].textContent.toLowerCase();
            if (rowText.includes(filter)) {
                rows[i].style.display = '';
            } else {
                rows[i].style.display = 'none';
            }
        }
    });
}

// ==========================================
// VALIDAÇÃO RIGOROSA DE CADASTRO
// ==========================================
function validarDadosCadastro(nome, email, telefone) {
    // 1. Verifica se a pessoa botou email no lugar do nome (se tem '@' ou '.com' no nome)
    if (nome.includes('@') || nome.toLowerCase().includes('.com')) {
        alert("❌ O campo NOME está incorreto. Por favor, digite seu Nome e Sobrenome, não o seu email.");
        return false;
    }

    // Exige pelo menos nome e sobrenome (duas palavras)
    if (nome.trim().split(' ').length < 2) {
        alert("❌ Por favor, digite seu Nome e Sobrenome completos.");
        return false;
    }

    // 2. Verifica se o email é realmente um email válido
    const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regexEmail.test(email)) {
        alert("❌ O EMAIL digitado é inválido. Digite um email correto (Ex: nome@gmail.com ou nome@hotmail.com).");
        return false;
    }

    // 3. Verifica se o telefone tem um tamanho mínimo aceitável (ignora espaços e traços)
    const apenasNumeros = telefone.replace(/\D/g, ''); 
    if (apenasNumeros.length < 8) {
        alert("❌ O número de CELULAR parece estar incompleto ou incorreto. Por favor, corrija.");
        return false;
    }

    return true; // Se passou por tudo, os dados estão ótimos!
}

// ==========================================
// INTERCEPTANDO O BOTÃO DE CADASTRAR
// ==========================================
const formCadastro = document.getElementById('register-form');

// 🛡️ O ESCUDO: Só executa isso se a pessoa estiver na tela de cadastro!
if (formCadastro) {
    formCadastro.addEventListener('submit', function(event) {
        event.preventDefault(); // Impede o envio automático para podermos verificar

        const nomeInput = document.getElementById('reg-name').value;
        const emailInput = document.getElementById('reg-email').value;
        const telefoneInput = document.getElementById('reg-phone').value;

        // Chama o Guarda-Costas
        const dadosEstaoCorretos = validarDadosCadastro(nomeInput, emailInput, telefoneInput);

        if (dadosEstaoCorretos) {
            // AQUI VOCÊ CONTINUA O CADASTRO NORMALMENTE
            // Exemplo: enviarDadosParaOBanco();
            console.log("Tudo certo! Criando a conta...");
            
            // Se você já tem uma função que cadastra, chame ela aqui!
        }
    });
}
// ==========================================
// GERAR PDF BEM DESENHADO DAS FATURAS
// ==========================================
async function downloadInvoicesPDF() {
    // Pega as ferramentas do jsPDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'pt', 'a4'); // Retrato, pontos, tamanho A4

    // Título do Documento
    doc.setFontSize(18);
    doc.setTextColor(10, 25, 49); // Azul escuro do seu sistema
    doc.text("Relatório de Status de Pagamentos", 40, 40);
    
    // Subtítulo com a data
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Gerado em: " + new Date().toLocaleString('pt-BR'), 40, 55);

    try {
        // Busca os dados fresquinhos do servidor
        const res = await fetch('/api/invoices/list');
        const list = await res.json();

        // Prepara os dados para colocar na tabela
        const tableData = list.map(inv => {
            let statusText = '';
            if(inv.status === 'approved' || inv.status === 'paid') statusText = 'PAGO';
            else if(inv.status === 'in_review') statusText = 'EM ANALISE';
            else if(inv.status === 'pending') statusText = 'PENDENTE';
            else statusText = 'CANCELADO';

            const refCode = inv.order_code || inv.raw_order || inv.box_code || 'Sem Ref.';
            const valorFormatado = parseFloat(inv.amount || 0).toFixed(2);

            // Retorna a linha da tabela
            return [
                refCode,
                inv.client_name || '-',
                inv.box_code || '-',
                `R$ ${valorFormatado}`,
                statusText
            ];
        });

        // Desenha a tabela com design profissional
        doc.autoTable({
            startY: 70, // Começa abaixo do título
            head: [['Ref.', 'Cliente', 'Box', 'Valor', 'Status']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [10, 25, 49], textColor: [255, 255, 255], fontStyle: 'bold' }, // Cabeçalho azul marinho
            alternateRowStyles: { fillColor: [240, 248, 255] }, // Linhas zebradas azul clarinho
            styles: { fontSize: 10, cellPadding: 5 },
            didParseCell: function(data) {
                // Colore apenas o texto da coluna de Status (índice 4)
                if (data.section === 'body' && data.column.index === 4) {
                    if (data.cell.raw === 'PAGO') {
                        data.cell.styles.textColor = [0, 128, 0]; // Verde
                        data.cell.styles.fontStyle = 'bold';
                    } else if (data.cell.raw === 'EM ANALISE') {
                        data.cell.styles.textColor = [0, 0, 255]; // Azul
                        data.cell.styles.fontStyle = 'bold';
                    } else if (data.cell.raw === 'PENDENTE') {
                        data.cell.styles.textColor = [255, 140, 0]; // Laranja
                        data.cell.styles.fontStyle = 'bold';
                    } else if (data.cell.raw === 'CANCELADO') {
                        data.cell.styles.textColor = [255, 0, 0]; // Vermelho
                    }
                }
            }
        });

        // Baixa o arquivo para o computador
        doc.save("Relatorio_Pagamentos.pdf");

    } catch(err) {
        console.error("Erro ao gerar PDF:", err);
        alert("Erro ao buscar os dados para o PDF. Tente novamente.");
    }
}
// ==========================================
// FUNÇÃO PARA FILTRAR ENCOMENDAS NA ABA VÍDEO
// ==========================================
function filterVideoClients() {
    // Pega o que foi digitado no campo de busca e transforma tudo em minúsculo
    const input = document.getElementById("video-client-search");
    const filter = input.value.toLowerCase();
    
    // Pega a lista de opções dentro do select
    const select = document.getElementById("video-client-select");
    const options = select.getElementsByTagName("option");

    // Passa por todas as opções da lista (começando do 1 para pular o "Selecione...")
    for (let i = 1; i < options.length; i++) {
        const txtValue = options[i].textContent || options[i].innerText;
        
        // Se o texto da opção tiver o que foi digitado, mostra. Se não, esconde.
        if (txtValue.toLowerCase().indexOf(filter) > -1) {
            options[i].style.display = "";
        } else {
            options[i].style.display = "none";
        }
    }

    // Se a opção que estava selecionada for escondida, limpa a seleção
    if (select.selectedIndex > 0 && options[select.selectedIndex].style.display === "none") {
        select.value = "";
        checkVideoPermission(); // Chama sua função original para desativar o botão de câmera
    }
}
// ==========================================
// RADAR DO LELO: ESCUTANDO A CICÍ (RODA A CADA 5 SEGS)
// ==========================================
setInterval(async () => {
    try {
        const res = await fetch('/api/cici-avisos');
        const data = await res.json();
        
        if (data.avisos && data.avisos.length > 0) {
            data.avisos.forEach(mensagemHtml => {
                // Toca um sonzinho de notificação (Opcional, se você tiver um áudio)
                // new Audio('/sons/alerta.mp3').play().catch(()=>console.log("Sem som"));
                
                // Exibe a mensagem da Cicí na tela usando um Toast ou Alert estilizado
                mostrarAlertaDaCici(mensagemHtml);
            });
        }
    } catch (err) {
        // Ignora erros silenciosamente para não atrapalhar o Lelo se a net cair
    }
}, 5000);

// Função para desenhar a mensagem na tela
function mostrarAlertaDaCici(htmlContent) {
    const alerta = document.createElement('div');
    alerta.style.cssText = "position:fixed; top:20px; right:20px; background:rgba(10, 25, 49, 0.95); border:2px solid #009ee3; color:#fff; padding:20px; border-radius:10px; box-shadow:0 10px 25px rgba(0,0,0,0.5); z-index:9999; max-width:350px; animation: slideIn 0.5s;";
    
    alerta.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div style="font-size:30px; margin-right:15px;">🤖</div>
            <div style="flex-grow:1; font-size:14px; line-height:1.5;">${htmlContent}</div>
            <button onclick="this.parentElement.parentElement.remove()" style="background:none; border:none; color:#ff4d4d; font-size:18px; cursor:pointer; margin-left:10px; font-weight:bold;">X</button>
        </div>
    `;
    
    document.body.appendChild(alerta);

    // Some sozinho depois de 30 segundos se o Lelo não clicar
    setTimeout(() => {
        if(document.body.contains(alerta)) alerta.remove();
    }, 30000);
}
// Função para rolar as abas do menu
function scrollNav(amount) {
    // Busca o menu que está na tela atual
    const nav = document.querySelector('.nav-links');
    if (nav) {
        nav.scrollBy({ left: amount, behavior: 'smooth' });
    }
}
// ==========================================
// PREENCHE A CAIXA DE LOTES NA ABA ETIQUETAS
// ==========================================
async function loadLabelLots() {
    const select = document.getElementById('label-lot-filter');
    if (!select) return;
    try {
        const res = await fetch('/api/shipments/list'); // Puxa os embarques
        const lots = await res.json();
        
        let html = '<option value="">📦 Todos os Envios/Lotes</option>';
        lots.forEach(lot => {
            html += `<option value="${lot.id}">✈️ ${lot.code} - ${lot.type}</option>`;
        });
        select.innerHTML = html;
    } catch(e) {
        console.error("Erro ao carregar lotes para etiquetas:", e);
    }
}

// Faz os lotes carregarem assim que a tela abre
document.addEventListener('DOMContentLoaded', () => {
    loadLabelLots();
});
// ==============================================================
// PREENCHE O "SELETOR MESTRE" DE LOTES NO PAINEL DO CLIENTE
// ==============================================================
async function populateClientMainFilter() {
    const mainFilter = document.getElementById('main-shipment-filter');
    
    // Só executa se o seletor existir na tela e se for o cliente logado
    if (!mainFilter || !currentUser || currentUser.role !== 'client') return; 

    try {
        // Puxa as caixas para descobrir quais lotes esse cliente tem
        const response = await fetch('/api/boxes');
        const list = await response.json();
        
        // Separa só as caixas que pertencem ao cliente logado
        const caixasDoCliente = list.filter(b => b.client_id === currentUser.id);

        // Extrai os nomes dos lotes, remove duplicados e tira os vazios
        const lotesUnicos = [...new Set(caixasDoCliente.map(b => b.lote).filter(l => l && l.trim() !== ''))];
        
        // Guarda o valor que o cliente já tinha clicado (para não resetar do nada)
        const valorAtual = mainFilter.value;

        // Monta o HTML das opções
        let optionsHTML = '<option value="">📦 Todos os Envios</option>';
        lotesUnicos.sort().forEach(lote => {
            optionsHTML += `<option value="${lote}">✈️ ${lote}</option>`;
        });

        // Injeta na tela
        mainFilter.innerHTML = optionsHTML;

        // Se o cliente já tinha escolhido um, mantém ele selecionado
        if (lotesUnicos.includes(valorAtual) || valorAtual === '') {
            mainFilter.value = valorAtual;
        }

    } catch (erro) {
        console.error("Erro ao preencher o seletor mestre do cliente:", erro);
    }
}
// ==============================================================
// SAUDAÇÃO INTELIGENTE DO CLIENTE 🧠☀️🌙
// ==============================================================
function updateSmartGreeting() {
    const greetingElement = document.getElementById('smart-greeting');
    
    // Só funciona se o título existir na tela e o cliente estiver logado
    if (!greetingElement || !currentUser || currentUser.role !== 'client') return;

    const hora = new Date().getHours();
    let cumprimento = '';
    let emoji = '';

    // Lê o relógio
    if (hora >= 5 && hora < 12) {
        cumprimento = 'Bom dia';
        emoji = '☀️';
    } else if (hora >= 12 && hora < 18) {
        cumprimento = 'Boa tarde';
        emoji = '🌤️';
    } else {
        cumprimento = 'Boa noite';
        emoji = '🌙';
    }

    // Pega só o primeiro nome para ficar mais íntimo
    const primeiroNome = currentUser.name.split(' ')[0];

    // Frases aleatórias para não ficar repetitivo
    const frases = [
        "Pronto para acompanhar seus envios?",
        "Tudo organizado por aqui hoje.",
        "Como podemos ajudar com suas encomendas?",
        "Seu painel logístico está atualizado."
    ];
    const fraseAleatoria = frases[Math.floor(Math.random() * frases.length)];

    // Injeta na tela
    greetingElement.innerHTML = `${emoji} ${cumprimento}, <strong style="color: #00b1ea;">${primeiroNome}</strong>!<br><span style="font-size: 14px; font-weight: normal; color: #666;">${fraseAleatoria}</span>`;
}
// ==========================================================
// 📄 GERAR PDF DA LISTA DE AGENDAMENTOS
// ==========================================================
function baixarPDFAgendamentos() {
    // Puxa a biblioteca do jsPDF que já está no seu HTML
    const { jsPDF } = window.jspdf;
    
    // Cria o documento 'landscape' (deitado) para caberem todas as colunas perfeitamente
    const doc = new jsPDF('landscape'); 

    // Título e Cabeçalho do PDF
    doc.setFontSize(18);
    doc.setTextColor(10, 25, 49); // Azul marinho da Guineexpress
    doc.text("Relatório de Agendamentos - Guineexpress", 14, 15);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("Gerado em: " + new Date().toLocaleString('pt-BR'), 14, 22);

    // Caça a tabela pelo ID do corpo (tbody)
    const tbody = document.getElementById("admin-schedule-list");
    
    if (!tbody) {
        alert("Tabela de agendamentos não encontrada na tela!");
        return;
    }

    // Pega a tabela inteira para levar o cabeçalho (Data, Horário, Cliente...) junto
    const tabelaCompleta = tbody.closest('table'); 

    // Monta a tabela no PDF
    doc.autoTable({
        html: tabelaCompleta,
        startY: 28,
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 3 },
        headStyles: { fillColor: [10, 25, 49], textColor: [255, 255, 255] }, // Cabeçalho Azul
        alternateRowStyles: { fillColor: [244, 247, 246] } // Linhas com cores alternadas
    });

    // Baixa o arquivo direto para o admin
    doc.save("Agendamentos_Guineexpress.pdf");
}
// ==========================================
// LOGIN OFICIAL COM O GOOGLE
// ==========================================
function loginComGoogle() {
    // Como o cliente agora pode digitar o Gmail dele na barra de cima, 
    // ele já consegue logar usando o email.
    // Para o botão fazer o login "automático" (abrir aquela janelinha do Google),
    // você precisará criar um projeto gratuito no "Google Cloud Console" para gerar um "Client ID".
    alert("🚀 O acesso por e-mail já está liberado! Digite seu Gmail no campo acima e sua senha.\n\n(Aviso ao Admin: Para ativar a janela de clique automático do Google, é necessário conectar a API de Autenticação do Google Cloud).");
}
// ==========================================
// FUNÇÕES DE COMUNICADO EM MASSA (ADMIN)
// ==========================================

function openBroadcastModal() {
    document.getElementById('broadcast-modal').classList.remove('hidden');
}

async function sendBroadcast() {
    const subject = document.getElementById('broadcast-subject').value;
    const message = document.getElementById('broadcast-message').value;
    
    // NOVO: Verifica se o botão do WhatsApp está marcado
    const checkboxZap = document.getElementById('check-send-zap');
    const sendZap = checkboxZap ? checkboxZap.checked : false;

    if (!subject || !message) return alert("❌ Preencha o assunto e a mensagem.");

    if (!confirm("⚠️ Tem a certeza? Isso enviará mensagens para TODOS os clientes.")) return;

    const btn = document.querySelector('#broadcast-modal .btn-primary');
    const oldText = btn.innerText;
    btn.innerText = "Enviando...";
    btn.disabled = true;

    try {
        const res = await fetch('/api/admin/broadcast-zap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject, message, sendZap }) 
        });
        
        const data = await res.json();

        if (data.success) {
            alert("✅ " + data.msg);
            closeModal('broadcast-modal');
            document.getElementById('broadcast-subject').value = '';
            document.getElementById('broadcast-message').value = '';
            if (checkboxZap) checkboxZap.checked = false; // Desmarca a caixinha ao terminar
        } else {
            alert("Erro: " + data.msg);
        }
    } catch (error) {
        console.error(error);
        alert("Erro de conexão.");
    } finally {
        btn.innerText = oldText;
        btn.disabled = false;
    }
}
// =======================================================
// 🛍️ MOTOR DA LOJA VIRTUAL (PAINEL ADMIN)
// =======================================================

async function adicionarProdutoLoja(e) {
    e.preventDefault();
    
    // O FormData é obrigatório porque estamos enviando uma FOTO junto com texto
    const formData = new FormData();
    formData.append('name', document.getElementById('prod-name').value);
    formData.append('category', document.getElementById('prod-category').value);
    formData.append('price_brl', document.getElementById('prod-price').value);
    formData.append('stock', document.getElementById('prod-stock').value);
    formData.append('description', document.getElementById('prod-desc').value);
    
    const imageFile = document.getElementById('prod-image').files[0];
    if (imageFile) formData.append('image', imageFile);

    const btn = e.target.querySelector('button');
    const oldText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando na vitrine...';
    btn.disabled = true;

    try {
        const res = await fetch('/api/store/products', {
            method: 'POST',
            body: formData 
        });
        const json = await res.json();
        
        if (json.success) {
            alert("✅ Produto cadastrado com sucesso e já está disponível na loja!");
            e.target.reset(); // Limpa o formulário
            carregarProdutosAdmin(); // Atualiza as fotinhas na tela
        } else {
            alert("Erro: " + json.msg);
        }
    } catch(err) {
        console.error(err);
        alert("Erro de conexão ao salvar produto.");
    } finally {
        btn.innerHTML = oldText;
        btn.disabled = false;
    }
}

// Essa função desenha a vitrine na tela do Admin para você ver o que já tem lá
async function carregarProdutosAdmin() {
    const grid = document.getElementById('admin-products-grid');
    if (!grid) return;

    grid.innerHTML = '<p>Carregando produtos <i class="fas fa-spinner fa-spin"></i></p>';

    try {
        const res = await fetch('/api/store/products');
        const json = await res.json();

        if (!json.success || json.products.length === 0) {
            grid.innerHTML = '<p style="color:#666;">A sua vitrine está vazia. Adicione o primeiro produto acima!</p>';
            return;
        }

        let html = '';
        json.products.forEach(p => {
            // Se o produto não tiver foto, usa a logo da Guineexpress
            const foto = p.image_url ? p.image_url : '/logo.png';
            
            html += `
                <div style="background: white; border: 1px solid #e1e8ed; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.05); display: flex; flex-direction: column; transition: transform 0.3s ease;">
                    <img src="${foto}" style="width: 100%; height: 180px; object-fit: cover; border-bottom: 2px solid #d4af37;">
                    <div style="padding: 15px; flex-grow: 1; display: flex; flex-direction: column;">
                        <span style="font-size: 10px; color: #d4af37; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">${p.category}</span>
                        <h4 style="margin: 8px 0; color: #0a1931; font-size: 15px;">${p.name}</h4>
                        <p style="font-size: 18px; font-weight: 900; color: #d32f2f; margin: 5px 0;">R$ ${parseFloat(p.price_brl).toFixed(2)}</p>
                        <p style="font-size: 12px; color: #666; margin-bottom: 15px;"><i class="fas fa-box"></i> Estoque: <b>${p.stock}</b> unid.</p>
                        
                        <button onclick="deletarProdutoLoja(${p.id})" style="margin-top: auto; background: #dc3545; color: white; border: none; padding: 8px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12px;">
                            <i class="fas fa-trash"></i> Retirar da Vitrine
                        </button>
                    </div>
                </div>
            `;
        });
        grid.innerHTML = html;
    } catch(err) {
        console.error(err);
        grid.innerHTML = '<p style="color:red;">Erro ao carregar produtos.</p>';
    }
}
// ==============================================================
// 🛍️ CARREGAR PRODUTOS NA VITRINE DO CLIENTE
// ==============================================================
async function carregarProdutosLoja() {
    // 👇 ID CORRIGIDO PARA O SEU LAYOUT PREMIUM!
    const grid = document.getElementById('store-products-grid');
    
    if (!grid) return; // Se não achar a caixa, não faz nada

    grid.innerHTML = '<p style="text-align:center; padding: 20px; width: 100%; grid-column: 1 / -1;">Carregando a loja... <i class="fas fa-spinner fa-spin"></i></p>';

    try {
        const resposta = await fetch('/api/loja/produtos-clientes');
        const dados = await resposta.json();

        if (!dados.success || !dados.products || dados.products.length === 0) {
            grid.innerHTML = '<p style="text-align:center; color:#666; padding: 20px; width: 100%; grid-column: 1 / -1;">A vitrine está vazia no momento.</p>';
            return;
        }

        // Salva os produtos globais para o SEU layout Premium e a Cotação de Moedas funcionarem!
        window.produtosOriginais = dados.products; 
        
        // Chama a SUA função que tem o design da Shopee/Premium
        renderizarProdutos(); 

    } catch (erro) {
        console.error("Erro ao carregar loja:", erro);
        grid.innerHTML = '<p style="color:red; text-align:center; padding: 20px; width: 100%; grid-column: 1 / -1;">Falha ao carregar o catálogo.</p>';
    }
}

function renderizarProdutosLoja(produtos) {
    const grid = document.getElementById('store-items') || document.querySelector('.store-items') || document.getElementById('produtos-grid');
    if (!grid) return;

    let html = '';
    produtos.forEach(p => {
        const foto = p.image_url ? p.image_url : '/logo.png';
        const precoFormatado = parseFloat(p.price_brl).toFixed(2);
        
        html += `
            <div style="background: white; border: 1px solid #e1e8ed; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 8px rgba(0,0,0,0.05); display: flex; flex-direction: column;">
                <img src="${foto}" style="width: 100%; height: 180px; object-fit: cover; border-bottom: 2px solid #ee4d2d;">
                <div style="padding: 15px; flex-grow: 1; display: flex; flex-direction: column;">
                    <span style="font-size: 10px; color: #ee4d2d; font-weight: 900; text-transform: uppercase;">${p.category || 'Geral'}</span>
                    <h4 style="margin: 8px 0; color: #0a1931; font-size: 15px;">${p.name}</h4>
                    <p style="font-size: 18px; font-weight: 900; color: #d32f2f; margin: 5px 0;">R$ ${precoFormatado}</p>
                    
                    <button onclick="adicionarAoCarrinho(${p.id}, '${p.name.replace(/'/g, "\\'")}', ${p.price_brl}, '${foto}')" 
                            style="margin-top: auto; background: #ee4d2d; color: white; border: none; padding: 10px; border-radius: 6px; cursor: pointer; font-weight: bold;">
                        <i class="fas fa-cart-plus"></i> Comprar
                    </button>
                </div>
            </div>
        `;
    });
    grid.innerHTML = html;
}
async function deletarProdutoLoja(id) {
    if(!confirm("Tem certeza que deseja apagar este produto da sua loja?")) return;
    try {
        const res = await fetch('/api/store/products/delete', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({id})
        });
        const json = await res.json();
        if(json.success) carregarProdutosAdmin();
        else alert("Erro ao apagar: " + json.msg);
    } catch(err) { alert("Erro de conexão."); }
}
function renderizarProdutos() {
    const grid = document.getElementById('store-products-grid');
    if (!grid) return;
    
    // Fallback caso não encontre o seletor na hora
    const moedaElement = document.getElementById('currency-selector');
    const moeda = moedaElement ? moedaElement.value : 'BRL';
    let html = '';

    produtosOriginais.forEach(p => {
        let precoFinal = p.price_brl;
        let simbolo = 'R$';

        // Lógica da cotação usando a variável global window.COTACAO que criámos mais cedo
        const cotacoes = window.COTACAO || { XOF: 120, EUR: 0.18, USD: 0.20 };
        
        if (moeda === 'CFA') { precoFinal = p.price_brl * cotacoes.XOF; simbolo = 'XOF'; }
        else if (moeda === 'EUR') { precoFinal = p.price_brl * cotacoes.EUR; simbolo = '€'; }
        else if (moeda === 'USD') { precoFinal = p.price_brl * cotacoes.USD; simbolo = '$'; }

        // Verifica se este produto está nos favoritos do cliente
        let favs = JSON.parse(localStorage.getItem('loja_favoritos')) || [];
        let isFav = favs.includes(p.id);
        let corCoracao = isFav ? '#ee4d2d' : '#ccc';

        html += `
    <div class="product-card-premium" style="position: relative; cursor: pointer; display: flex; flex-direction: column;" onclick="abrirDetalhesProduto(${p.id}, '${simbolo}', ${precoFinal})">
        <div class="promo-badge">Oferta</div>
        
        <div id="fav-${p.id}" class="fav-btn" onclick="toggleFavorito(${p.id}); event.stopPropagation();" style="color: ${corCoracao};">
            <i class="fas fa-heart"></i>
        </div>
        
        <div class="img-container">
            <img src="${p.image_url || '/logo.png'}" alt="${p.name}" style="width: 100%; height: 160px; object-fit: cover;">
        </div>

        <div class="product-details" style="display: flex; flex-direction: column; flex-grow: 1;">
            <span class="product-cat">${p.category}</span>
            <h3 class="product-title" style="margin-bottom: 5px; height: 36px; overflow: hidden;">${p.name}</h3>
            
            <div class="product-stars" style="margin-bottom: 10px;">
                <i class="fas fa-star" style="color: #f59e0b;"></i>
                <i class="fas fa-star" style="color: #f59e0b;"></i>
                <i class="fas fa-star" style="color: #f59e0b;"></i>
                <i class="fas fa-star" style="color: #f59e0b;"></i>
                <i class="fas fa-star-half-alt" style="color: #f59e0b;"></i>
                <span style="font-size: 11px; color: #94a3b8;">(99+)</span>
            </div>

            <div style="margin-top: auto;">
                <div class="price-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span class="price-amount" style="color: #ee4d2d; font-weight: 900; font-size: 16px;">${simbolo} ${precoFinal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                </div>
                
                <div style="display: flex; gap: 6px; width: 100%;">
                    <button class="add-btn-premium" onclick="adicionarAoCarrinho(${p.id}, event); event.stopPropagation();" style="flex: 1; border-radius: 8px; font-size: 13px; font-weight: bold; padding: 10px 0; display: flex; justify-content: center; align-items: center; gap: 5px;">
                        <i class="fas fa-cart-plus"></i> Adicionar
                    </button>
                    
                    <button onclick="enviarDuvidaWhatsApp('${p.name.replace(/'/g, "\\'")}'); event.stopPropagation();" style="background: #25d366; color: white; border: none; width: 42px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(37, 211, 102, 0.3);">
                        <i class="fab fa-whatsapp" style="font-size: 18px;"></i>
                    </button>
                </div>
            </div>

        </div>
    </div>
    `;
    });
    grid.innerHTML = html;
}

// A Lógica do Voo Nível NASA
function fazerProdutoVoar(imgUrl, elementoOrigem) {
    // A foto que vai voar (padrão é logo se não tiver foto)
    const fotoUrl = imgUrl || '/logo.png';
    
    // Cria o elemento da imagem voadora no HTML
    const voadora = document.createElement('img');
    voadora.src = fotoUrl;
    voadora.classList.add('flying-product');
    document.body.appendChild(voadora);

    // Posição do botão clicado (Origem)
    const rectOrigem = elementoOrigem.getBoundingClientRect();
    // Posição do Carrinho da Cicí (Destino)
    const rectDestino = document.getElementById('floating-cici-cart').getBoundingClientRect();

    // Define a posição inicial exata da imagem voadora (em cima do botão)
    voadora.style.left = `${rectOrigem.left + rectOrigem.width/2 - 25}px`;
    voadora.style.top = `${rectOrigem.top + rectOrigem.height/2 - 25}px`;
    voadora.style.transform = 'scale(0.5)'; // Começa pequena

    // 🚀 O VOO: Usa um timeout bem curto para o navegador registrar a posição inicial antes de animar
    setTimeout(() => {
        // Define o destino final e transformações durante o voo (roda e cresce)
        voadora.style.left = `${rectDestino.left + rectDestino.width/2 - 25}px`;
        voadora.style.top = `${rectDestino.top + rectDestino.height/2 - 25}px`;
        voadora.style.transform = 'scale(1) rotate(360deg)';
        voadora.style.opacity = '0.5'; // Vai sumindo
    }, 10);

    // 🏁 A CHEGADA: O que acontece quando o produto "pousa" no carrinho
    setTimeout(() => {
        // 1. Remove a imagem voadora
        voadora.remove();

        // 2. MÁGICA DA SACOLA: O botão inteiro dá um "pulo" quando o item cai
        const carrinhoFlutuante = document.getElementById('floating-cici-cart');
        
        if (carrinhoFlutuante) {
            // Vamos usar a mesma classe que você já tinha, mas agora no botão principal
            carrinhoFlutuante.classList.add('cart-eat');

            // Remove a animação para poder tocar de novo no próximo produto
            setTimeout(() => {
                carrinhoFlutuante.classList.remove('cart-eat');
            }, 600);
        }

        // 3. Atualiza o contador
        atualizarContadorCarrinho();
        
    }, 800); // Tempo exato do voo (igual ao CSS transition)
}

function atualizarContadorCarrinho() {
    const contador = document.getElementById('cart-counter');
    const qtd = itensNoCarrinho.length;
    
    if (qtd > 0) {
        contador.innerText = qtd;
        contador.classList.remove('hidden');
        // Efeito de "pulsar" no número novo
        contador.style.animation = 'cart-bump 0.3s ease-out';
        setTimeout(() => contador.style.animation = '', 300);
    } else {
        contador.classList.add('hidden');
    }
}
// =======================================================
// 🛠️ FUNÇÕES CORRIGIDAS (FILTROS E GATILHO DE ESCASSEZ)
// =======================================================

// Adiciona a animação de piscar no CSS via JavaScript (Mágica!)
if (!document.getElementById('animacao-escassez')) {
    const style = document.createElement('style');
    style.id = 'animacao-escassez';
    style.innerHTML = `
        @keyframes pulse-fire {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.05); opacity: 0.8; box-shadow: 0 0 10px red; }
            100% { transform: scale(1); opacity: 1; }
        }
        .escassez-badge { background: #d32f2f !important; animation: pulse-fire 1s infinite; }
        .esgotado-badge { background: #333 !important; }
    `;
    document.head.appendChild(style);
}

function aplicarFiltrosLoja() {
    const grid = document.getElementById('store-products-grid');
    if (!grid) return;
    
    const inputPesquisa = document.getElementById('search-store');
    const termoBusca = inputPesquisa ? inputPesquisa.value.toLowerCase() : '';
    const moeda = document.getElementById('currency-selector') ? document.getElementById('currency-selector').value : 'BRL';

    let produtosFiltrados = produtosOriginais;

    if (categoriaAtualLoja !== 'Todos') produtosFiltrados = produtosFiltrados.filter(p => p.category === categoriaAtualLoja);
    if (termoBusca !== '') produtosFiltrados = produtosFiltrados.filter(p => p.name.toLowerCase().includes(termoBusca) || (p.description && p.description.toLowerCase().includes(termoBusca)));

    if (produtosFiltrados.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; color: #666;"><i class="fas fa-search-minus" style="font-size: 50px; margin-bottom: 15px; color: #ccc;"></i><h3 style="color: #0a1931;">Poxa!</h3><p>Não encontramos nenhum produto.</p></div>`;
        return;
    }

    let html = '';
    produtosFiltrados.forEach(p => {
        let precoFinal = p.price_brl;
        let simbolo = 'R$';
        const cotacoesGlobais = window.COTACAO || { XOF: 1, EUR: 1, USD: 1 };

        if (moeda === 'CFA') { precoFinal = p.price_brl * cotacoesGlobais.XOF; simbolo = 'XOF'; }
        else if (moeda === 'EUR') { precoFinal = p.price_brl * cotacoesGlobais.EUR; simbolo = '€'; }
        else if (moeda === 'USD') { precoFinal = p.price_brl * cotacoesGlobais.USD; simbolo = '$'; }

        // 🔥 GATILHO DE ESCASSEZ E ESTOQUE
        let badgeHtml = `<div class="promo-badge">Oferta</div>`;
        if (p.stock <= 0) {
            badgeHtml = `<div class="promo-badge esgotado-badge">⏳ Esgotado</div>`;
        } else if (p.stock <= 5) {
            badgeHtml = `<div class="promo-badge escassez-badge">🔥 Restam só ${p.stock}!</div>`;
        }

        html += `
            <div class="product-card-premium" onclick="abrirDetalhesProduto(${p.id}, '${simbolo}', ${precoFinal})" style="cursor: pointer;">
                ${badgeHtml}
                <div class="fav-btn" onclick="this.style.color='#d32f2f'; event.stopPropagation();"><i class="fas fa-heart"></i></div>
                <div class="img-container"><img src="${p.image_url || '/logo.png'}" alt="${p.name}"></div>
                <div class="product-details">
                    <span class="product-cat">${p.category}</span>
                    <h3 class="product-title">${p.name}</h3>
                    <div class="product-stars"><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star-half-alt"></i></div>
                    <div class="price-row">
                        <span class="price-amount">${simbolo} ${precoFinal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                        <button class="add-btn-premium" onclick="adicionarAoCarrinho(${p.id}, event); event.stopPropagation();">
                            <i class="fas fa-cart-plus"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    grid.innerHTML = html;
}

// =======================================================
// 🛍️ MOTOR EXTRAORDINÁRIO DA LOJA (MEMÓRIA E VARIAÇÕES)
// =======================================================

// 🧠 SALVA E CARREGA DA MEMÓRIA
function salvarCarrinhoNaMemoria() {
    localStorage.setItem('guineexpressCarrinho', JSON.stringify(itensNoCarrinho));
}

function carregarCarrinhoDaMemoria() {
    const salvo = localStorage.getItem('guineexpressCarrinho');
    if (salvo) {
        itensNoCarrinho = JSON.parse(salvo);
        atualizarContadorCarrinho();
        // Se a gaveta estiver aberta, atualiza ela
        if (document.getElementById('side-cart') && document.getElementById('side-cart').style.right === '0px') {
            renderizarCarrinhoLateral();
        }
    }
}
// Carrega o carrinho assim que o site abre
window.addEventListener('DOMContentLoaded', carregarCarrinhoDaMemoria);


function adicionarAoCarrinho(productId, event) {
    const produtoOriginal = produtosOriginais.find(p => p.id === productId);
    if (!produtoOriginal) return;

    if (produtoOriginal.stock <= 0) {
        const querEncomendar = confirm("⏳ A Cicí informa: Este produto esgotou e está a ser produzido!\n\nDeseja solicitar uma reserva para garantir o seu na próxima remessa?");
        if (!querEncomendar) return; 
    } else {
        const qtdNoCarrinho = itensNoCarrinho.filter(item => item.id === productId).length;
        if (qtdNoCarrinho >= produtoOriginal.stock) {
            alert(`Você já colocou todas as ${produtoOriginal.stock} unidades disponíveis na sacola! 🛍️`);
            return;
        }
    }

    // 👕 VARIAÇÕES DE PRODUTO
    let nomeComVariacao = produtoOriginal.name;
    if (produtoOriginal.category === 'Roupas' || produtoOriginal.category === 'Cabelos/Perucas') {
        const escolha = prompt(`Você está comprando: ${produtoOriginal.name}\n\nDigite a Cor ou Tamanho desejado (Ex: P, M, Loiro, Preto):`);
        if (escolha === null) return; 
        if (escolha.trim() !== '') {
            nomeComVariacao = `${produtoOriginal.name} (${escolha})`;
        }
    }

    const produtoParaSacola = { ...produtoOriginal, name: nomeComVariacao };
    itensNoCarrinho.push(produtoParaSacola);
    
    atualizarContadorCarrinho();
    
    // 👇 MÁGICA 1: SALVA O CARRINHO NO CELULAR DO CLIENTE
    salvarCarrinhoNaMemoriaDoCelular(); 

    if (event && event.currentTarget) {
        fazerProdutoVoar(produtoParaSacola.image_url, event.currentTarget);
    }

    setTimeout(() => {
        const cart = document.getElementById('side-cart');
        if (cart && cart.style.right !== '0px') {
            toggleCarrinho();
        } else {
            renderizarCarrinhoLateral();
        }
    }, 800);
}

function removerDoCarrinho(productId) {
    const index = itensNoCarrinho.findIndex(item => item.id === productId);
    if (index > -1) {
        itensNoCarrinho.splice(index, 1);
        renderizarCarrinhoLateral();
        atualizarContadorCarrinho();
        
        // 👇 MÁGICA 2: ATUALIZA O CELULAR DO CLIENTE APÓS REMOVER
        salvarCarrinhoNaMemoriaDoCelular(); 
    }
}

function limparCarrinho() {
    itensNoCarrinho = [];
    renderizarCarrinhoLateral();
    atualizarContadorCarrinho();
    // 👇 MÁGICA 3: LIMPA O CELULAR QUANDO A COMPRA ACABA
    salvarCarrinhoNaMemoriaDoCelular(); 
}

function alterarQuantidadeCarrinho(productId, operacao) {
    if (operacao === 'aumentar') {
        const produtoParaAdicionar = itensNoCarrinho.find(item => item.id === productId);
        if (produtoParaAdicionar) itensNoCarrinho.push({ ...produtoParaAdicionar });
    } else if (operacao === 'diminuir') {
        const index = itensNoCarrinho.findIndex(item => item.id === productId);
        if (index > -1) itensNoCarrinho.splice(index, 1);
    }
    
    renderizarCarrinhoLateral();
    if (typeof atualizarContadorCarrinho === 'function') {
        atualizarContadorCarrinho();
    }
    salvarCarrinhoNaMemoria(); // 💾 Atualiza a memória
}
function voltarParaCarrinho() {
    document.getElementById('cart-step-2').style.display = 'none';
    document.getElementById('cart-step-1').style.display = 'flex';
}

// =======================================================
// 📊 MOTOR DE RELATÓRIOS (ADMIN)
// =======================================================

async function carregarEstatisticasLoja() {
    try {
        const res = await fetch('/api/admin/store/stats');
        const data = await res.json();

        if (data.success) {
            // 1. Renderiza o Gráfico de Top Estoque
            renderizarGraficoEstoque(data.topStock);

            // 2. Renderiza os Alertas de Estoque Baixo
            const alertaContainer = document.getElementById('low-stock-list');
            if (data.lowStock.length === 0) {
                alertaContainer.innerHTML = '<p style="color: green; font-size: 13px;">✅ Tudo sob controle! Nenhum produto acabando.</p>';
            } else {
                let html = '';
                data.lowStock.forEach(p => {
                    html += `
                        <div style="display:flex; justify-content:space-between; padding: 8px 0; border-bottom: 1px solid #eee; font-size: 13px;">
                            <span><b>${p.name}</b> (${p.category})</span>
                            <span style="color: #d32f2f; font-weight: 900;">Restam ${p.stock}</span>
                        </div>
                    `;
                });
                alertaContainer.innerHTML = html;
            }
        }
    } catch (err) { console.error("Erro nas estatísticas:", err); }
}

function renderizarGraficoEstoque(produtos) {
    const ctx = document.getElementById('stockChart').getContext('2d');
    
    if (meuGraficoEstoque) meuGraficoEstoque.destroy();

    meuGraficoEstoque = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: produtos.map(p => p.name),
            datasets: [{
                label: 'Unidades em Estoque',
                data: produtos.map(p => p.stock),
                backgroundColor: ['#0a1931', '#dfaf12', '#009ee3', '#185adb', '#5c7aea'],
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}
// =======================================================
// 🚀 SISTEMA DE PROMOÇÃO RELÂMPAGO
// =======================================================
async function dispararPromoçaoEstoque() {
    try {
        const res = await fetch('/api/admin/store/stats');
        const data = await res.json();

        if (data.success && data.topStock.length > 0) {
            const produtoMaisEstoque = data.topStock[0]; // Pega o que tem mais unidades
            
            const msgSugestao = `🔥 *PROMOÇÃO RELÂMPAGO GUINEEXPRESS* 🔥\n\nAproveite agora: *${produtoMaisEstoque.name}* em estoque! 📦\n\nGaranta o seu antes que acabe direto no nosso painel.\n🔗 https://guineexpress.onrender.com/`;

            // Abre o modal de broadcast que você já tem, preenchendo os campos automaticamente
            document.getElementById('broadcast-subject').value = `Promoção: ${produtoMaisEstoque.name}`;
            document.getElementById('broadcast-message').value = msgSugestao;
            
            // Abre o modal (ajuste o ID conforme o seu sistema de modal)
            openModal('broadcast-modal'); 
            
            alert(`Cicí selecionou: ${produtoMaisEstoque.name} (${produtoMaisEstoque.stock} unidades).`);
        }
    } catch (err) { alert("Erro ao preparar promoção."); }
}

// 2. Fica "escutando" o cliente digitar na barra de pesquisa em tempo real
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-store');
    if (searchInput) {
        searchInput.addEventListener('input', aplicarFiltrosLoja);
    }
});

// =======================================================
// 🛍️ MOTOR DA VITRINE DO CLIENTE (BUSCA, FILTRO E VISUAL)
// =======================================================

async function carregarLojaCliente() {
    const grid = document.getElementById('store-products-grid');
    if (!grid) return;

    grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
            <i class="fas fa-circle-notch fa-spin" style="font-size: 50px; color: #dfaf12; margin-bottom: 20px;"></i>
            <h3 style="color: #0a1931; margin-bottom: 5px;">Aguarde um momento...</h3>
            <p style="color: #666; font-size: 14px;">Cicí está organizando as vitrines para você!</p>
        </div>
    `;

    try {
        const response = await fetch('/api/store/products');
        const data = await response.json();

        if (data.success) {
            produtosOriginais = data.products;
            // Quando os produtos chegam, chama a função para desenhar todos na tela
            filtrarLoja('Todos'); 
        } else {
            grid.innerHTML = '<p style="text-align:center; color: red;">Erro ao carregar a vitrine.</p>';
        }
    } catch (error) {
        grid.innerHTML = '<p style="text-align:center; color: #666;">Verifique sua conexão com a internet.</p>';
    }
}

// Fica "escutando" quando o cliente digita na barra de pesquisa
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-store');
    if (searchInput) {
        searchInput.addEventListener('input', aplicarFiltrosLoja);
    }
});

// =======================================================
// 🛒 MOTOR DA VITRINE: FILTRAR, BUSCAR E DESENHAR
// =======================================================

function alterarMoedaLoja() {
    aplicarFiltrosLoja(); // Re-desenha com a moeda nova e com o filtro que já estava ativado
}

function filtrarLoja(categoria, elementoClicado) {
    categoriaAtualLoja = categoria;

    // Atualiza a cor das bolinhas de categoria lá no topo (Aba Laranja)
    if (elementoClicado) {
        document.querySelectorAll('.cat-item').forEach(el => el.classList.remove('active'));
        elementoClicado.closest('.cat-item').classList.add('active');
    }

    aplicarFiltrosLoja();
}

function aplicarFiltrosLoja() {
    const grid = document.getElementById('store-products-grid');
    if (!grid) return;

    const termoBusca = document.getElementById('search-store') ? document.getElementById('search-store').value.toLowerCase() : '';
    
    // Filtra os produtos originais
    let produtosFiltrados = produtosOriginais.filter(p => {
        // 1. Filtro de Categoria (ignora se for 'Todos')
        let bateCategoria = (categoriaAtualLoja === 'Todos' || p.category === categoriaAtualLoja);
        
        // 2. Filtro de Busca (Texto)
        let bateBusca = p.name.toLowerCase().includes(termoBusca) || p.description.toLowerCase().includes(termoBusca);
        
        return bateCategoria && bateBusca;
    });

    renderizarProdutos(produtosFiltrados);
}

// A Função Master que desenha os cartões de produtos!
function renderizarProdutos(listaDeProdutos) {
    const grid = document.getElementById('store-products-grid');
    if (!grid) return;

    if (listaDeProdutos.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px;">
                <i class="fas fa-box-open" style="font-size: 50px; color: #ccc; margin-bottom: 15px;"></i>
                <h3 style="color: #666;">Nenhum produto encontrado.</h3>
                <p style="color: #999; font-size: 13px;">Tente buscar por outro termo ou categoria.</p>
            </div>
        `;
        return;
    }
    
    const moedaElement = document.getElementById('currency-selector');
    const moeda = moedaElement ? moedaElement.value : 'BRL';
    let html = '';

    listaDeProdutos.forEach(p => {
        let precoFinal = p.price_brl;
        let simbolo = 'R$';

        // Lógica da cotação
        const cotacoes = window.COTACAO || { XOF: 120, EUR: 0.18, USD: 0.20 };
        if (moeda === 'CFA') { precoFinal = p.price_brl * cotacoes.XOF; simbolo = 'XOF'; }
        else if (moeda === 'EUR') { precoFinal = p.price_brl * cotacoes.EUR; simbolo = '€'; }
        else if (moeda === 'USD') { precoFinal = p.price_brl * cotacoes.USD; simbolo = '$'; }

        // Favoritos do localStorage
        let favs = JSON.parse(localStorage.getItem('loja_favoritos')) || [];
        let isFav = favs.includes(p.id);
        let corCoracao = isFav ? '#ee4d2d' : '#ccc';

        html += `
        <div class="product-card-premium" style="position: relative; cursor: pointer; display: flex; flex-direction: column;" onclick="abrirDetalhesProduto(${p.id}, '${simbolo}', ${precoFinal})">
            <div class="promo-badge">Oferta</div>
            
            <div id="fav-${p.id}" class="fav-btn" onclick="toggleFavorito(${p.id}); event.stopPropagation();" style="color: ${corCoracao}; position: absolute; top: 10px; right: 10px; z-index: 2; background: white; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 50%; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                <i class="fas fa-heart"></i>
            </div>
            
            <div class="img-container" style="border-radius: 12px 12px 0 0; overflow: hidden;">
                <img src="${p.image_url || '/logo.png'}" alt="${p.name}" style="width: 100%; height: 160px; object-fit: cover;">
            </div>

            <div class="product-details" style="padding: 12px; display: flex; flex-direction: column; flex-grow: 1; background: white; border-radius: 0 0 12px 12px; border: 1px solid #eee; border-top: none;">
                <span class="product-cat" style="font-size: 10px; font-weight: bold; color: #ee4d2d; text-transform: uppercase;">${p.category}</span>
                <h3 class="product-title" style="margin: 5px 0; font-size: 14px; color: #333; height: 36px; overflow: hidden;">${p.name}</h3>
                
                <div class="product-stars" style="margin-bottom: 10px;">
                    <i class="fas fa-star" style="color: #f59e0b; font-size: 10px;"></i>
                    <i class="fas fa-star" style="color: #f59e0b; font-size: 10px;"></i>
                    <i class="fas fa-star" style="color: #f59e0b; font-size: 10px;"></i>
                    <i class="fas fa-star" style="color: #f59e0b; font-size: 10px;"></i>
                    <i class="fas fa-star-half-alt" style="color: #f59e0b; font-size: 10px;"></i>
                    <span style="font-size: 10px; color: #94a3b8;">(99+)</span>
                </div>

                <div style="margin-top: auto;">
                    <div class="price-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span class="price-amount" style="color: #ee4d2d; font-weight: 900; font-size: 16px;">${simbolo} ${precoFinal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                    </div>
                    
                    <div style="display: flex; gap: 6px; width: 100%;">
                        <button class="add-btn-premium" onclick="adicionarAoCarrinho(${p.id}, event); event.stopPropagation();" style="flex: 1; border: none; background: #ee4d2d; color: white; border-radius: 8px; font-size: 13px; font-weight: bold; padding: 10px 0; display: flex; justify-content: center; align-items: center; gap: 5px; cursor: pointer;">
                            <i class="fas fa-cart-plus"></i>
                        </button>
                        
                        <button onclick="enviarDuvidaWhatsApp('${p.name.replace(/'/g, "\\'")}'); event.stopPropagation();" style="background: #25d366; color: white; border: none; width: 42px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(37, 211, 102, 0.3);">
                            <i class="fab fa-whatsapp" style="font-size: 18px;"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
        `;
    });
    
    grid.innerHTML = html;
}

// =======================================================
// 📱 MOTOR DE CÓPIA UNIVERSAL (À PROVA DE IPHONE/SAFARI)
// =======================================================
function copiarTextoUniversal(texto, mensagemSucesso) {
    // 1. Tenta usar o método moderno primeiro
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(texto).then(() => {
            alert(mensagemSucesso);
        }).catch(() => copiarComTextareaInvisivel(texto, mensagemSucesso));
    } else {
        // 2. Se for iPhone chato ou navegador antigo, usa a técnica invisível
        copiarComTextareaInvisivel(texto, mensagemSucesso);
    }
}

function copiarComTextareaInvisivel(texto, mensagemSucesso) {
    const textArea = document.createElement("textarea");
    textArea.value = texto;
    
    // Esconde o campo para o cliente não ver
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    
    // Truques específicos para destravar o bloqueio do iPhone
    textArea.contentEditable = true;
    textArea.readOnly = false;
    
    document.body.appendChild(textArea);
    
    // Seleção especial para iOS (Apple)
    if (navigator.userAgent.match(/ipad|iphone|mac/i)) {
        const range = document.createRange();
        range.selectNodeContents(textArea);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        textArea.setSelectionRange(0, 999999);
    } else {
        textArea.select();
    }

    try {
        const copiou = document.execCommand('copy');
        if (copiou) {
            alert(mensagemSucesso);
        } else {
            alert("⚠️ Selecione a chave e copie manualmente.");
        }
    } catch (err) {
        alert("⚠️ Selecione a chave e copie manualmente.");
    }

    document.body.removeChild(textArea);
}
// Funções de Controle do Modal
function openThemeModal() { document.getElementById('modal-theme').style.display = 'block'; }
function closeThemeModal() { document.getElementById('modal-theme').style.display = 'none'; }

// Aplica cor baseada no Slider (Matiz/Arco-íris)
function updateThemeBySlider(hue) {
    const color = `hsl(${hue}, 30%, 95%)`; // Gera um tom suave baseado no slider
    setThemeColor(color);
}

// Função Principal que muda a cor e SALVA na memória
function setThemeColor(color) {
    // Muda a variável principal do CSS do seu site
    document.documentElement.style.setProperty('--light', color);
    document.body.style.backgroundColor = color;
    
    // Salva a escolha do cliente para a próxima vez
    localStorage.setItem('user-theme-pref', color);
}

// Carregar a preferência do cliente assim que o site abrir
window.addEventListener('DOMContentLoaded', () => {
    const savedColor = localStorage.getItem('user-theme-pref');
    if (savedColor) {
        setThemeColor(savedColor);
    }
});
// ==========================================
// MODO HISTÓRICO PARA O CLIENTE
// ==========================================


window.alternarHistorico = function() {
    window.verHistoricoCompleto = !window.verHistoricoCompleto; // Liga e desliga
    
    const btn = document.getElementById('btnToggleHistory');
    if (window.verHistoricoCompleto) {
        btn.innerHTML = '<i class="fas fa-eye-slash"></i> Ocultar Histórico';
        btn.style.background = '#0a1931';
    } else {
        btn.innerHTML = '<i class="fas fa-history"></i> Mostrar Histórico (Entregues)';
        btn.style.background = '#6c757d';
    }
    
    // 👇 ATUALIZA TUDO NA TELA QUANDO APERTAR O BOTÃO 👇
    if (typeof loadClientInvoices === 'function') loadClientInvoices();
    if (typeof loadOrders === 'function') loadOrders(); // Ou a função que carrega as Boxes
    if (typeof loadClientVideos === 'function') loadClientVideos();
    if (typeof loadReceipts === 'function') loadReceipts();
}
// =======================================================
// 👑 GESTÃO DE PEDIDOS DA LOJA (COM DASHBOARD E FILTROS)
// =======================================================
let pedidoAtualAdmin = null; 
window.todosPedidosAdmin = []; // Memória global dos pedidos
window.filtroStatusAdmin = 'Todos'; // Filtro atual selecionado

async function carregarPedidosLojaAdmin() {
    const grid = document.getElementById('admin-orders-grid');
    if (!grid) return;

    grid.innerHTML = '<div style="text-align:center; padding: 40px; grid-column: 1/-1;"><i class="fas fa-spinner fa-spin fa-2x" style="color: #dfaf12;"></i><p>Sincronizando Centro de Comando...</p></div>';

    try {
        const res = await fetch('/api/admin/store/orders');
        const data = await res.json();

        if (data.success) {
            window.todosPedidosAdmin = data.orders; // Salva na memória!
            atualizarDashboardFinanceiro(); // 💰 Calcula o faturamento
            filtrarPedidosAdminPainel(); // 🔍 Desenha os pedidos na tela
        }
    } catch (err) {
        console.error(err);
        grid.innerHTML = '<p style="color:red; text-align:center; grid-column: 1/-1;">Erro de conexão com o banco de dados.</p>';
    }
}

// 💰 Calcula o Dinheiro e os Status (BLINDADA)
function atualizarDashboardFinanceiro() {
    let faturamento = 0;
    let qtdPagos = 0;
    let qtdPendentes = 0;

    // 🛡️ BLINDAGEM: Se a memória estiver vazia, cria uma lista vazia para não dar erro
    const pedidos = window.todosPedidosAdmin || [];

    pedidos.forEach(order => {
        const status = (order.status || '').toLowerCase();
        // Soma Faturamento (Apenas se o status não for "Pendente" ou "Cancelado")
        if (status !== 'pending' && status !== 'aguardando pagamento' && status !== 'cancelado') {
            faturamento += parseFloat(order.total_brl) || 0;
        }

        if (status === 'pago' || status.includes('preparando')) qtdPagos++;
        if (status === 'pending' || status === 'aguardando pagamento') qtdPendentes++;
    });

    if(document.getElementById('dash-faturamento')) {
        document.getElementById('dash-faturamento').innerText = `R$ ${faturamento.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        document.getElementById('dash-pagos').innerText = qtdPagos;
        document.getElementById('dash-pendentes').innerText = qtdPendentes;
    }
}

// 🎨 Função para trocar a cor do botão clicado
function mudarFiltroAdmin(status, botao) {
    window.filtroStatusAdmin = status;
    
    // Tira a cor de todos os botões
    document.querySelectorAll('.btn-filtro-admin').forEach(btn => {
        btn.style.background = '#f1f5f9';
        btn.style.color = '#64748b';
        btn.style.border = '1px solid #e2e8f0';
    });

    // Pinta o botão que foi clicado
    botao.style.background = '#0a1931';
    botao.style.color = 'white';
    botao.style.border = 'none';

    filtrarPedidosAdminPainel(); // Aplica o filtro na tela
}

// 🔍 A Mágica de Filtrar Instantaneamente (Busca + Status + Data) (BLINDADA)
function filtrarPedidosAdminPainel() {
    const grid = document.getElementById('admin-orders-grid');
    if (!grid) return;
    
    const inputBusca = document.getElementById('admin-search-order');
    const termoBusca = inputBusca && inputBusca.value ? String(inputBusca.value).toLowerCase() : '';

    // 👇 Pegando os valores de Mês e Ano
    const selectMes = document.getElementById('filtro-mes-loja');
    const mesEscolhido = selectMes ? selectMes.value : 'Todos';
    
    const selectAno = document.getElementById('filtro-ano-loja');
    const anoEscolhido = selectAno ? selectAno.value : 'Todos';

    let filtrados = window.todosPedidosAdmin || [];
    
    const filtroStatus = window.filtroStatusAdmin ? String(window.filtroStatusAdmin).toLowerCase() : 'todos';

    // 1. Filtra pelo Status do Botão (Todos, Pendentes, Pagos...)
    if (filtroStatus !== 'todos') {
        filtrados = filtrados.filter(order => {
            if (!order) return false;
            let status = String(order.status || '').toLowerCase();
            if(status === 'pending') status = 'aguardando pagamento';
            return status.includes(filtroStatus);
        });
    }

    // 2. Filtra pela barra de pesquisa
    if (termoBusca !== '') {
        filtrados = filtrados.filter(order => {
            if (!order) return false;
            const idStr = String(order.id || '').toLowerCase();
            const nomeStr = String(order.client_name || '').toLowerCase();
            const phoneStr = String(order.client_phone || '').toLowerCase();
            return idStr.includes(termoBusca) || nomeStr.includes(termoBusca) || phoneStr.includes(termoBusca);
        });
    }

    // 👇 3. NOVO: Filtro de Mês e Ano 👇
    if (mesEscolhido !== 'Todos' || anoEscolhido !== 'Todos') {
        filtrados = filtrados.filter(order => {
            if (!order || !order.created_at) return false;
            
            // Exemplo de created_at: "2026-05-17 12:01:00"
            const dataPedido = new Date(order.created_at);
            
            // Pega o mês (0-11, então +1) e formata com dois dígitos (ex: "05")
            const mesPedido = String(dataPedido.getMonth() + 1).padStart(2, '0');
            const anoPedido = String(dataPedido.getFullYear());

            let mesOk = true;
            let anoOk = true;

            if (mesEscolhido !== 'Todos' && mesPedido !== mesEscolhido) mesOk = false;
            if (anoEscolhido !== 'Todos' && anoPedido !== anoEscolhido) anoOk = false;

            return mesOk && anoOk;
        });
    }

    // Desenha na tela
    if (filtrados.length === 0) {
        grid.innerHTML = '<div style="text-align:center; color:#666; grid-column: 1/-1; padding: 40px;"><i class="fas fa-search-minus fa-3x" style="margin-bottom:15px; color:#ccc;"></i><p>Nenhum pedido encontrado com este filtro.</p></div>';
        return;
    }

    let html = '';
    filtrados.forEach(order => {
        let statusColor = '#f39c12'; // Aguardando
        let statusTratado = order.status ? String(order.status) : 'Pendente';
        
        if(statusTratado.toLowerCase() === 'pending') statusTratado = 'Aguardando Pagamento';
        if (statusTratado === 'Pago') statusColor = '#27ae60';
        if (statusTratado === 'Enviado') statusColor = '#2980b9';
        if (statusTratado === 'Entregue') statusColor = '#8e44ad';

        const valorSeguro = parseFloat(order.total_brl) || 0;

        html += `
            <div style="background: white; border-radius: 12px; padding: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); border-top: 4px solid ${statusColor}; cursor: pointer; display: flex; flex-direction: column; justify-content: space-between; height: 100%; transition: 0.3s;" onmouseover="this.style.transform='translateY(-3px)'" onmouseout="this.style.transform='translateY(0)'" onclick='abrirModalPedidoLoja(${JSON.stringify(order)})'>
                
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                    <h3 style="margin: 0; color: #0a1931; font-size: 14px; font-weight: 900;">#${order.id}</h3>
                    <span style="background: ${statusColor}22; color: ${statusColor}; padding: 3px 6px; border-radius: 6px; font-size: 9px; font-weight: 900; text-transform: uppercase;">${statusTratado}</span>
                </div>
                
                <div style="flex-grow: 1;">
                    <p style="margin: 0 0 4px 0; font-size: 12px; color: #1e293b; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><i class="fas fa-user" style="color:#dfaf12; width: 14px;"></i> ${order.client_name || 'Anônimo'}</p>
                    <p style="margin: 0; font-size: 10px; color: #64748b;"><i class="fas fa-clock" style="width: 14px;"></i> ${new Date(order.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
                
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 10px; color: #64748b; font-weight: bold; background: #f1f5f9; padding: 3px 6px; border-radius: 4px;">${order.items ? order.items.length : 0} it.</span>
                    <span style="font-size: 13px; font-weight: 900; color: #d32f2f;">R$ ${valorSeguro.toFixed(2)}</span>
                </div>
            </div>
        `;
    });
    grid.innerHTML = html;
}

// =======================================================
// 👑 ADMIN: GESTÃO DE PEDIDOS (BLINDADO DEFINITIVAMENTE)
// =======================================================

function abrirModalPedidoLoja(order) {
    // Usamos o "window." para o navegador nunca perder esta variável de memória
    window.pedidoAtualAdmin = order; 

    // Preenche os dados básicos
    document.getElementById('modal-order-id').innerText = order.id;
    document.getElementById('modal-order-client').innerText = order.client_name || 'Desconhecido';
    document.getElementById('modal-order-phone').innerText = order.client_phone || 'Não informado';
    document.getElementById('modal-order-address').innerText = order.delivery_address || 'Não informado';
    
    // Moeda correta
    let simbolo = order.currency_used === 'CFA' ? 'XOF' : (order.currency_used === 'EUR' ? '€' : (order.currency_used === 'USD' ? '$' : 'R$'));
    
    // 🛡️ CORREÇÃO 1: Blinda o valor total do pedido
    const totalSeguro = parseFloat(order.total_brl) || 0;
    document.getElementById('modal-order-total').innerText = `${simbolo} ${totalSeguro.toFixed(2)}`;
    
    // Trata o status (Se vier 'pending' do banco de dados, muda para 'Aguardando Pagamento')
    let statusCorreto = order.status;
    if(statusCorreto === 'pending') statusCorreto = 'Aguardando Pagamento';
    document.getElementById('modal-order-status').value = statusCorreto;

    // Desenha a lista de produtos comprados no recibo
    let itemsHtml = '';
    if (order.items && order.items.length > 0) {
        order.items.forEach(item => {
            // 🛡️ CORREÇÃO 2: Blinda o preço de cada item da lista
            const precoItemSeguro = parseFloat(item.price_brl) || 0;

            itemsHtml += `
            <div style="display: flex; align-items: center; gap: 15px; padding-bottom: 15px; border-bottom: 1px solid #e2e8f0; margin-bottom: 10px;">
                <img src="${item.image_url || '/logo.png'}" style="width: 50px; height: 50px; border-radius: 10px; object-fit: cover; border: 1px solid #e2e8f0;">
                <div style="flex: 1;">
                    <h5 style="margin: 0; color: #0f172a; font-size: 14px;">${item.product_name}</h5>
                    <span style="font-size: 12px; color: #64748b; font-weight: bold;">Qtd: ${item.quantity}</span>
                </div>
                <span style="font-size: 14px; font-weight: 900; color: #0f172a;">R$ ${precoItemSeguro.toFixed(2)}</span>
            </div>`;
        });
    } else {
        itemsHtml = '<p style="color: #64748b; font-size: 13px;">Nenhum item detalhado.</p>';
    }
    document.getElementById('modal-order-items').innerHTML = itemsHtml;

    // Mostra o Modal lindo na tela!
    document.getElementById('modal-store-order-details').style.display = 'flex';
}

async function salvarStatusPedido() {
    if (!window.pedidoAtualAdmin) return;
    const novoStatus = document.getElementById('modal-order-status').value;
    
    const btnSalvar = event.currentTarget;
    const textoOriginal = btnSalvar.innerHTML;
    btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    
    try {
        const res = await fetch('/api/admin/store/orders/status', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ order_id: window.pedidoAtualAdmin.id, new_status: novoStatus }) 
        });
        const data = await res.json();
        
        if (data.success) { 
            alert("✅ Status atualizado com sucesso!"); 
            window.pedidoAtualAdmin.status = novoStatus; 
            carregarPedidosLojaAdmin(); // Atualiza a tabela lá atrás
            document.getElementById('modal-store-order-details').style.display = 'none'; // Fecha o modal
        } else {
            alert("Erro ao salvar: " + data.msg);
        }
    } catch(e) { 
        alert("Erro de conexão."); 
    } finally {
        btnSalvar.innerHTML = textoOriginal;
    }
}

function enviarReciboCicizaNoZap() {
    if (!window.pedidoAtualAdmin) return;
    let order = window.pedidoAtualAdmin;
    let tel = order.client_phone.replace(/\D/g, '');
    
    let msg = `✨ Olá ${order.client_name}! Aqui é a *Cicí*, da Guineexpress! 🤖💙\n\n`;
    
    if (order.status === 'Aguardando Pagamento' || order.status === 'pending') {
        msg += `Recebi o seu pedido *#${order.id}* na nossa loja! 🛍️\nEstou aguardando a confirmação do pagamento para pedir pro pessoal separar seu pacote, tá bem?\n\n`;
    } else if (order.status === 'Pago') {
        msg += `Uhuu! 🎉 O pagamento do seu pedido *#${order.id}* foi *APROVADO*! ✅\nJá estamos separando tudo com muito carinho. 📦💨\n\n`;
    } else if (order.status === 'Enviado') {
        msg += `Seu pacote está a caminho! ✈️📦\nO pedido *#${order.id}* acabou de ser despachado para: _${order.delivery_address}_\n\n`;
    } else if (order.status === 'Entregue') {
        msg += `Festa! 🎉 O seu pedido *#${order.id}* consta como entregue! Esperamos que goste muito! 🥰\n\n`;
    }

    msg += `*🧾 RESUMO:*\n`;
    if(order.items) {
        order.items.forEach(item => {
            msg += `▪️ ${item.quantity}x ${item.product_name}\n`;
        });
    }
    msg += `\n*Total Pago:* R$ ${order.total_brl.toFixed(2)}\n`;
    
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');
}

function renderizarModalPedidosLoja(orders) {
    // Verifica se o modal já existe, se não, cria um novo
    let modal = document.getElementById('modal-meus-pedidos');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-meus-pedidos';
        modal.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); backdrop-filter: blur(5px); z-index: 30000; display: flex; justify-content: center; align-items: center;";
        document.body.appendChild(modal);
    }

    let html = `
    <div style="background: white; width: 90%; max-width: 500px; border-radius: 15px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); display: flex; flex-direction: column; max-height: 80vh;">
        <div style="background: #0a1931; color: white; padding: 20px; display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0; color: #dfaf12;"><i class="fas fa-receipt"></i> Minhas Compras</h3>
            <button onclick="document.getElementById('modal-meus-pedidos').style.display='none'" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer;">&times;</button>
        </div>
        <div style="padding: 20px; overflow-y: auto; flex-grow: 1; background: #f4f7f6;">`;

    if (orders.length === 0) {
        html += `<div style="text-align: center; padding: 30px; color: #666;"><i class="fas fa-box-open" style="font-size: 40px; margin-bottom: 10px; color: #ccc;"></i><p>Você ainda não tem compras na loja.</p></div>`;
    } else {
        orders.forEach(o => {
            html += `
            <div style="background: white; border-radius: 10px; padding: 15px; margin-bottom: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); border-left: 4px solid #dfaf12;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <strong>Pedido #${o.id}</strong>
                    <span style="color: #d32f2f; font-weight: bold;">${o.currency_used} ${o.total_brl.toFixed(2)}</span>
                </div>
                <div style="font-size: 12px; color: #666; margin-bottom: 10px;">Método: <strong>${o.payment_method.toUpperCase()}</strong></div>
                <div style="font-size: 13px;">`;
            
            o.items.forEach(item => {
                html += `<div style="display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding: 4px 0;">
                            <span>${item.quantity}x ${item.product_name}</span>
                         </div>`;
            });
            html += `</div></div>`;
        });
    }

    html += `</div></div>`;
    modal.innerHTML = html;
    modal.style.display = 'flex';
}

// 2. Abre o Pop-up de Detalhes do Produto
function abrirDetalhesProduto(idProduto, simboloMoeda, precoConvertido) {
    const produto = produtosOriginais.find(p => p.id === idProduto);
    if (!produto) return;

    // Preenche as informações na tela
    document.getElementById('detail-image').src = produto.image_url || '/logo.png';
    document.getElementById('detail-category').innerText = produto.category;
    document.getElementById('detail-name').innerText = produto.name;
    document.getElementById('detail-price').innerText = `${simboloMoeda} ${precoConvertido.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    document.getElementById('detail-desc').innerText = produto.description || "Sem descrição detalhada disponível.";
    
    const stockEl = document.getElementById('detail-stock');
    if (produto.stock > 0) {
        stockEl.innerHTML = `<i class="fas fa-box"></i> Restam ${produto.stock} unid.`;
        stockEl.style.color = '#28a745'; // Verde
    } else {
        stockEl.innerHTML = `<i class="fas fa-times-circle"></i> Esgotado`;
        stockEl.style.color = '#dc3545'; // Vermelho
    }

    // Configura o botão de comprar
    const btnAdd = document.getElementById('btn-add-detail');
    btnAdd.onclick = (e) => {
        adicionarAoCarrinho(produto.id, e);
        fecharDetalhesProduto();
    };

    // Mostra a tela
    document.getElementById('modal-product-details').style.display = 'block';
}

function fecharDetalhesProduto() {
    document.getElementById('modal-product-details').style.display = 'none';
}
// =======================================================
// 🗂️ NAVEGAÇÃO INTERNA DA LOJA ADMIN
// =======================================================
function abrirSubAbaLoja(idAba, botaoClicado) {
    // 1. Esconde todas as sub-abas
    const abas = document.querySelectorAll('.sub-aba-loja');
    abas.forEach(aba => {
        aba.style.display = 'none';
    });

    // 2. Tira a cor de "ativo" de todos os botões
    const botoes = document.querySelectorAll('.sub-aba-btn');
    botoes.forEach(btn => {
        btn.style.background = '#fff';
        btn.style.color = '#0a1931';
        btn.style.border = '2px solid #eee';
    });

    // 3. Mostra a aba escolhida
    const abaDestino = document.getElementById(idAba);
    if (abaDestino) {
        abaDestino.style.display = 'block';
    }

    // 4. Pinta o botão clicado com as cores VIP
    if (botaoClicado) {
        botaoClicado.style.background = '#0a1931';
        botaoClicado.style.color = '#dfaf12';
        botaoClicado.style.border = '2px solid #0a1931';
    }
}
// ==========================================
// 🕹️ CONTROLO DO CARRINHO LATERAL
// ==========================================

function toggleCarrinho() {
    const cart = document.getElementById('side-cart');
    const overlay = document.getElementById('cart-overlay');
    
    if (cart.style.right === '0px') {
        cart.style.right = '-400px';
        overlay.style.display = 'none';
    } else {
        renderizarCarrinhoLateral(); // Atualiza os itens antes de abrir
        cart.style.right = '0px';
        overlay.style.display = 'block';
    }
}

// =======================================================
// 🛒 DESENHAR SACOLA E CALCULAR TOTAL (PASSO 1 E 2)
// =======================================================
function renderizarCarrinhoLateral() {
    const container = document.getElementById('cart-items-container');
    const totalStep1 = document.getElementById('cart-side-total'); // Total da tela 1
    const totalStep2 = document.getElementById('checkout-side-total'); // Total da tela de pagamento
    
    if (!container) return;

    // Pega a moeda que o cliente escolheu lá no topo
    const moeda = document.getElementById('currency-selector') ? document.getElementById('currency-selector').value : 'BRL';
    const cotacoes = window.COTACAO || { XOF: 120, EUR: 0.18, USD: 0.20 };
    
    let totalBRL = 0;
    let html = '';

    // Agrupa os itens para não repetir o mesmo produto várias vezes (mostra a quantidade)
    let itensAgrupados = {};
    itensNoCarrinho.forEach(p => {
        if(itensAgrupados[p.id]) {
            itensAgrupados[p.id].qtd += 1;
        } else {
            itensAgrupados[p.id] = { ...p, qtd: 1 };
        }
        totalBRL += parseFloat(p.price_brl);
    });

    // Se a sacola estiver vazia
    if (itensNoCarrinho.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding: 50px 20px; color: #94a3b8;"><i class="fas fa-shopping-bag fa-4x" style="margin-bottom: 15px; opacity: 0.3;"></i><p>A sua sacola está vazia.</p></div>';
        if(totalStep1) totalStep1.innerText = 'R$ 0,00';
        if(totalStep2) totalStep2.innerText = 'R$ 0,00';
        return;
    }

    // Desenha os produtos agrupados
    Object.values(itensAgrupados).forEach(item => {
        let precoFinal = item.price_brl;
        let simbolo = 'R$';

        if (moeda === 'CFA') { precoFinal = item.price_brl * cotacoes.XOF; simbolo = 'XOF'; }
        else if (moeda === 'EUR') { precoFinal = item.price_brl * cotacoes.EUR; simbolo = '€'; }
        else if (moeda === 'USD') { precoFinal = item.price_brl * cotacoes.USD; simbolo = '$'; }

        html += `
        <div style="display: flex; align-items: center; background: white; padding: 15px; margin-bottom: 12px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 10px rgba(0,0,0,0.02);">
            <img src="${item.image_url || '/logo.png'}" style="width: 65px; height: 65px; border-radius: 8px; object-fit: cover; margin-right: 15px;">
            <div style="flex-grow: 1;">
                <h4 style="margin: 0 0 5px 0; font-size: 14px; color: #0a1931; line-height: 1.2;">${item.name}</h4>
                <div style="color: #ee4d2d; font-weight: 900; font-size: 15px;">${simbolo} ${(precoFinal * item.qtd).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
            </div>
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                <button onclick="removerDoCarrinho(${item.id})" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 16px;"><i class="fas fa-trash-alt"></i></button>
                <div style="display: flex; align-items: center; background: #f8fafc; border-radius: 6px; overflow: hidden; border: 1px solid #cbd5e1;">
                    <button onclick="alterarQuantidadeCarrinho(${item.id}, 'diminuir')" style="background: none; border: none; padding: 4px 10px; cursor: pointer; color: #0f172a; font-weight: bold;">-</button>
                    <span style="font-weight: 900; font-size: 12px; width: 22px; text-align: center; color: #0f172a;">${item.qtd}</span>
                    <button onclick="alterarQuantidadeCarrinho(${item.id}, 'aumentar')" style="background: none; border: none; padding: 4px 10px; cursor: pointer; color: #0f172a; font-weight: bold;">+</button>
                </div>
            </div>
        </div>
        `;
    });

    container.innerHTML = html;

    // Converte o Total Final para a moeda certa
    let totalMoeda = totalBRL;
    let simboloTotal = 'R$';
    if (moeda === 'CFA') { totalMoeda = totalBRL * cotacoes.XOF; simboloTotal = 'XOF'; }
    else if (moeda === 'EUR') { totalMoeda = totalBRL * cotacoes.EUR; simboloTotal = '€'; }
    else if (moeda === 'USD') { totalMoeda = totalBRL * cotacoes.USD; simboloTotal = '$'; }

    const textoFinal = `${simboloTotal} ${totalMoeda.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    
    // Atualiza a tela 1 (Sacola) E a tela 2 (Pagamento)
    if(totalStep1) totalStep1.innerText = textoFinal;
    if(totalStep2) totalStep2.innerText = textoFinal; 
}
// ==========================================
// 💳 MOTOR DE PAGAMENTO (CHECKOUT LATERAL)
// ==========================================

function finalizarPedidoLoja() {
    if (itensNoCarrinho.length === 0) {
        alert("A sua sacola está vazia!");
        return;
    }
    
    // Esconde o Passo 1 e mostra o Passo 2
    document.getElementById('cart-step-1').style.display = 'none';
    document.getElementById('cart-step-2').style.display = 'flex';
    
    // Copia o valor total para a tela final
    document.getElementById('checkout-side-total').innerText = document.getElementById('cart-side-total').innerText;

    // Se o cliente já tiver telefone guardado, preenche automaticamente
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.phone) {
        document.getElementById('checkout-phone').value = currentUser.phone;
    }
}

// ==========================================
// 🔄 MOTOR DO MINI-CARROSSEL DE PRODUTOS
// ==========================================
let indexCarrossel = 0;

function atualizarMiniCarrossel() {
    if (typeof produtosOriginais === 'undefined' || !produtosOriginais || produtosOriginais.length === 0) return;

    const imgElement = document.getElementById('carousel-dynamic-img');
    const nameElement = document.getElementById('carousel-dynamic-name');
    
    if (!imgElement) return;

    // Sorteia ou segue a sequência
    const produto = produtosOriginais[indexCarrossel];
    
    // Efeito de fade (piscar) ao trocar
    imgElement.style.opacity = '0';
    
    setTimeout(() => {
        imgElement.src = produto.image_url;
        nameElement.innerText = produto.name;
        imgElement.style.opacity = '1';
    }, 500);

    indexCarrossel = (indexCarrossel + 1) % produtosOriginais.length;
}

// Inicia o carrossel e troca a cada 5 segundos
setInterval(atualizarMiniCarrossel, 5000);
// Chama a primeira vez logo ao carregar
setTimeout(atualizarMiniCarrossel, 2000);

// ==========================================
// 🎡 MOTOR DO CARROSSEL DE BANNERS
// ==========================================
let bannerIndex = 0;
const totalBanners = 3; // Temos 3 imagens no HTML

function autoSlideBanners() {
    const track = document.getElementById('banner-track');
    const dots = document.querySelectorAll('.dot');
    
    if(!track) return; // Se não estiver na tela da loja, ignora

    bannerIndex++;
    if (bannerIndex >= totalBanners) {
        bannerIndex = 0; // Volta ao início
    }

    // Move o trilho para a esquerda (0%, -33.33%, -66.66%)
    track.style.transform = `translateX(-${bannerIndex * 33.333}%)`;

    // Atualiza as bolinhas
    dots.forEach((dot, index) => {
        if (index === bannerIndex) {
            dot.style.background = 'white';
            dot.style.boxShadow = '0 1px 3px rgba(0,0,0,0.5)';
        } else {
            dot.style.background = 'rgba(255,255,255,0.5)';
            dot.style.boxShadow = 'none';
        }
    });
}

// Inicia o carrossel a girar a cada 3.5 segundos
setInterval(autoSlideBanners, 3500);
// Fecha o Mini Vídeo
function fecharMiniVideo() {
    document.getElementById('floating-video-container').style.display = 'none';
}

// 🧠 MOTOR DE MARKETING (GATILHOS MENTAIS)
const nomesMarketing = ["Maria", "João", "Fátima", "Carlos", "Amina", "Pedro", "Sana", "Binta"];

function dispararGatilhoMarketing() {
    if (typeof produtosOriginais === 'undefined' || !produtosOriginais || produtosOriginais.length === 0) return;
    
    const produtoSorteado = produtosOriginais[Math.floor(Math.random() * produtosOriginais.length)];
    const nomeSorteado = nomesMarketing[Math.floor(Math.random() * nomesMarketing.length)];
    
    const msgs = [
        `⚡ ${nomeSorteado} acabou de encomendar: ${produtoSorteado.name}!`,
        `🔥 Muitas pessoas estão a ver o ${produtoSorteado.name} agora.`,
        `📦 A Cicí está a embalar o pedido de ${nomeSorteado}!`
    ];
    
    document.getElementById('marketing-toast-text').innerText = msgs[Math.floor(Math.random() * msgs.length)];
    const toast = document.getElementById('marketing-toast');
    
    // Desce a mensagem do topo
    toast.style.transform = 'translateX(-50%) translateY(0)';
    
    // Esconde depois de 4 segundos
    setTimeout(() => {
        toast.style.transform = 'translateX(-50%) translateY(-150px)';
    }, 4000);
}
// Dispara o alerta de marketing a cada 20 segundos
setInterval(dispararGatilhoMarketing, 20000);

// 🔍 ZOOM NA IMAGEM (TELA CHEIA)
function abrirImagemTelaCheia(urlDaImagem) {
    const telaPreta = document.createElement('div');
    telaPreta.style.position = 'fixed';
    telaPreta.style.top = '0'; telaPreta.style.left = '0';
    telaPreta.style.width = '100vw'; telaPreta.style.height = '100vh';
    telaPreta.style.backgroundColor = 'rgba(0,0,0,0.95)';
    telaPreta.style.zIndex = '40000'; // Em cima de tudo
    telaPreta.style.display = 'flex';
    telaPreta.style.justifyContent = 'center'; telaPreta.style.alignItems = 'center';
    telaPreta.style.cursor = 'zoom-out';
    
    telaPreta.onclick = () => telaPreta.remove();
    
    const img = document.createElement('img');
    img.src = urlDaImagem;
    img.style.maxWidth = '95%'; img.style.maxHeight = '95%';
    img.style.objectFit = 'contain'; img.style.borderRadius = '10px';
    
    telaPreta.appendChild(img);
    document.body.appendChild(telaPreta);
}
let notificacoes = [];
function adicionarNotificacao(titulo, msg) {
    const agora = new Date().toLocaleTimeString();
    notificacoes.unshift({ titulo, msg, hora: agora });
    atualizarInterfaceNotif();
}

function atualizarInterfaceNotif() {
    const list = document.getElementById('notif-list');
    const count = document.getElementById('notif-count');
    
    if (notificacoes.length > 0) {
        count.innerText = notificacoes.length;
        count.style.display = 'block';
        list.innerHTML = notificacoes.map(n => `
            <div style="padding: 10px; border-bottom: 1px solid #f9f9f9; background: #fff8e1; margin-bottom: 5px; border-radius: 8px;">
                <strong style="display:block; color: #0a1931;">${n.titulo}</strong>
                ${n.msg} <br> <small style="color: #999;">${n.hora}</small>
            </div>
        `).join('');
    }
}

function toggleNotificacoes() {
    const panel = document.getElementById('notif-panel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function limparNotificacoes() {
    notificacoes = [];
    document.getElementById('notif-list').innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">Nenhuma notificação nova.</p>';
    document.getElementById('notif-count').style.display = 'none';
}

// =======================================================
// 🚚 RASTREIO DE PEDIDOS (CLIENTE - LINHA DO TEMPO VISUAL)
// =======================================================

// Inicialização segura no objeto Window
window.todosOsPedidosDoCliente = [];
window.abaPedidosAtiva = 'andamento'; 

async function abrirMeusPedidosLoja() {
    // Abre o modal de pedidos
    const modal = document.getElementById('modal-my-store-orders');
    if(modal) modal.style.display = 'flex';
    
    const container = document.getElementById('my-store-orders-list');
    if(!container) return;
    
    container.innerHTML = '<div style="text-align:center; padding: 50px;"><i class="fas fa-spinner fa-spin fa-3x" style="color:#dfaf12;"></i></div>';

    try {
        const res = await fetch('/api/store/my-orders');
        const data = await res.json();

        if (data.success) {
            // ✅ CORREÇÃO AQUI: Salva diretamente na window para o renderizador enxergar!
            window.todosOsPedidosDoCliente = data.orders; 
            renderizarAbaPedidosCliente(); 
        } else {
            container.innerHTML = '<p style="text-align:center; color: red;">Erro ao carregar seus pedidos.</p>';
        }
    } catch (err) {
        container.innerHTML = '<p style="color:red; text-align:center;">Erro ao conectar com o servidor.</p>';
    }
}

// 🔄 Alterna entre a aba "Em Andamento" e "Histórico"
function mudarAbaPedidosCliente(aba) {
    window.abaPedidosAtiva = aba;
    
    const btnAndamento = document.getElementById('tab-andamento');
    const btnHistorico = document.getElementById('tab-historico');
    
    if (btnAndamento && btnHistorico) {
        if (aba === 'andamento') {
            btnAndamento.style.background = 'var(--primary-orange, #ea580c)';
            btnAndamento.style.color = 'white';
            btnAndamento.style.boxShadow = '0 4px 10px rgba(234, 88, 12, 0.3)';
            btnAndamento.style.border = 'none';
            
            btnHistorico.style.background = '#f1f5f9';
            btnHistorico.style.color = '#64748b';
            btnHistorico.style.boxShadow = 'none';
            btnHistorico.style.border = '1px solid #cbd5e1';
        } else {
            btnHistorico.style.background = '#64748b';
            btnHistorico.style.color = 'white';
            btnHistorico.style.boxShadow = '0 4px 10px rgba(100, 116, 139, 0.3)';
            btnHistorico.style.border = 'none';
            
            btnAndamento.style.background = '#f1f5f9';
            btnAndamento.style.color = '#64748b';
            btnAndamento.style.boxShadow = 'none';
            btnAndamento.style.border = '1px solid #cbd5e1';
        }
    }
    
    renderizarAbaPedidosCliente();
}

// 🎨 Desenha a lista filtrada na tela
function renderizarAbaPedidosCliente() {
    const container = document.getElementById('my-store-orders-list');
    if(!container) return;

    // Pega a lista salva de forma segura
    const listaSegura = window.todosOsPedidosDoCliente || [];

    const pedidosFiltrados = listaSegura.filter(order => {
        const status = order.status ? order.status.toLowerCase() : '';
        if (window.abaPedidosAtiva === 'andamento') {
            return status !== 'entregue' && status !== 'cancelado';
        } else {
            return status === 'entregue' || status === 'cancelado';
        }
    });

    if (pedidosFiltrados.length === 0) {
        let mensagemZero = window.abaPedidosAtiva === 'andamento' 
            ? "Nenhuma compra a caminho no momento." 
            : "Você ainda não tem compras concluídas.";
            
        container.innerHTML = `
            <div style="text-align:center; color:#64748b; padding: 40px;">
                <i class="fas fa-box-open fa-4x" style="margin-bottom:20px; opacity:0.3;"></i>
                <h4 style="margin:0; color:#0f172a;">Tudo limpo por aqui</h4>
                <p style="font-size:14px; margin-top:5px;">${mensagemZero}</p>
            </div>`;
        return;
    }

    let html = '';
    pedidosFiltrados.forEach(order => {
        let statusDisplay = order.status || 'Pendente';
        if(statusDisplay.toLowerCase() === 'pending') statusDisplay = 'Aguardando Pagamento';
        
        let step = 1; 
        if(statusDisplay.includes('Pago')) step = 2; 
        if(statusDisplay.includes('Enviado')) step = 3; 
        if(statusDisplay.includes('Entregue')) step = 4;

        let progressWidth = ((step - 1) / 3) * 100;

        html += `
            <div style="background: white; border-radius: 20px; padding: 25px; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.03); border: 1px solid #e2e8f0;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px;">
                    <div>
                        <span style="background: #f1f5f9; color: #475569; padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 900;">PEDIDO #${order.id}</span>
                        <div style="font-size: 12px; color: #94a3b8; margin-top: 5px;">${new Date(order.created_at).toLocaleDateString('pt-BR')}</div>
                    </div>
                    <div style="text-align: right; color: #16a34a; font-weight: 900; font-size: 18px;">
                        ${order.currency_used || 'R$'} ${(order.total_brl || 0).toFixed(2)}
                    </div>
                </div>

                <div style="position: relative; display: flex; justify-content: space-between; margin-bottom: 30px; margin-top: 10px;">
                    <div style="position: absolute; top: 15px; left: 10%; right: 10%; height: 4px; background: #e2e8f0; z-index: 1; border-radius: 4px;"></div>
                    <div style="position: absolute; top: 15px; left: 10%; width: ${progressWidth}%; max-width: 80%; height: 4px; background: #10b981; z-index: 2; transition: width 1s ease-in-out; border-radius: 4px;"></div>

                    <div style="text-align: center; width: 50px; position: relative; z-index: 3;">
                        <div style="width: 34px; height: 34px; border-radius: 50%; background: ${step >= 1 ? '#10b981' : '#f1f5f9'}; color: ${step >= 1 ? 'white' : '#94a3b8'}; display: flex; align-items: center; justify-content: center; margin: 0 auto 8px auto; border: 2px solid white;"><i class="fas fa-file-invoice"></i></div>
                        <span style="font-size: 10px; font-weight: bold;">Pedido</span>
                    </div>
                    <div style="text-align: center; width: 50px; position: relative; z-index: 3;">
                        <div style="width: 34px; height: 34px; border-radius: 50%; background: ${step >= 2 ? '#10b981' : '#f1f5f9'}; color: ${step >= 2 ? 'white' : '#94a3b8'}; display: flex; align-items: center; justify-content: center; margin: 0 auto 8px auto; border: 2px solid white;"><i class="fas fa-box"></i></div>
                        <span style="font-size: 10px; font-weight: bold;">Preparo</span>
                    </div>
                    <div style="text-align: center; width: 50px; position: relative; z-index: 3;">
                        <div style="width: 34px; height: 34px; border-radius: 50%; background: ${step >= 3 ? '#3b82f6' : '#f1f5f9'}; color: ${step >= 3 ? 'white' : '#94a3b8'}; display: flex; align-items: center; justify-content: center; margin: 0 auto 8px auto; border: 2px solid white;"><i class="fas fa-truck-fast"></i></div>
                        <span style="font-size: 10px; font-weight: bold;">Em Rota</span>
                    </div>
                    <div style="text-align: center; width: 50px; position: relative; z-index: 3;">
                        <div style="width: 34px; height: 34px; border-radius: 50%; background: ${step >= 4 ? '#8b5cf6' : '#f1f5f9'}; color: ${step >= 4 ? 'white' : '#94a3b8'}; display: flex; align-items: center; justify-content: center; margin: 0 auto 8px auto; border: 2px solid white;"><i class="fas fa-check-double"></i></div>
                        <span style="font-size: 10px; font-weight: bold;">Entregue</span>
                    </div>
                </div>

                <div style="background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px dashed #cbd5e1;">
                    <p style="margin: 0 0 10px 0; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">O que tem no pacote:</p>
                    ${(order.items || []).map(i => `
                        <div style="font-size: 13px; color: #0f172a; margin-bottom: 5px; display: flex; align-items: center;">
                            <span style="background: #dfaf12; color: #0a1931; width: 22px; height: 22px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; font-weight: 900; font-size: 11px; margin-right: 10px;">${i.quantity}</span> 
                            ${i.product_name}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// =======================================================
// 🛒 FINALIZAR COMPRA (CHECKOUT DA LOJA)
// =======================================================
async function processarCompraDaLoja() {
    if (typeof itensNoCarrinho === 'undefined' || itensNoCarrinho.length === 0) {
        alert("⚠️ A sua sacola está vazia!");
        return;
    }

    // Pega os dados do cliente nos campos do HTML
    const enderecoEl = document.getElementById('checkout-address');
    const telefoneEl = document.getElementById('checkout-phone');
    const nomeClienteEl = document.getElementById('user-name-display'); // Ou o campo onde tem o nome dele

    const endereco = enderecoEl ? enderecoEl.value : '';
    const telefone = telefoneEl ? telefoneEl.value : '';
    const nome = nomeClienteEl ? nomeClienteEl.innerText : 'Cliente Loja';

    if (!endereco || !telefone) {
        alert("⚠️ Por favor, preencha o seu endereço e telefone para a entrega!");
        return;
    }

    const btn = document.getElementById('btn-final-buy');
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
    btn.disabled = true;

    try {
        // Calcula o total em BRL (o sistema da Cicí usa BRL para o PIX)
        const totalBRL = itensNoCarrinho.reduce((sum, item) => sum + (item.price_brl || 0), 0);
        const moeda = document.getElementById('currency-selector') ? document.getElementById('currency-selector').value : 'XOF';

        const response = await fetch('/api/store/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                client_name: nome,
                client_phone: telefone,
                delivery_address: endereco,
                items: itensNoCarrinho, 
                total_brl: totalBRL,
                currency_used: moeda,
                payment_method: 'pix_automatico'
            })
        });

        const data = await response.json();

        if (data.success) {
    // 1. Limpa o carrinho
    itensNoCarrinho = []; 
    localStorage.removeItem('loja_carrinho'); 
    
    // 2. PREPARA O ID COM O PREFIXO "STORE-" 
    // É isso que avisa ao servidor que o pedido é da LOJA!
    document.getElementById('pay-order-id').value = 'STORE-' + data.order_id;
    
    document.getElementById('pay-amount').value = data.total_confirmado;
    document.getElementById('pay-desc').innerText = `Pedido #${data.order_id} - Total: R$ ${data.total_confirmado.toFixed(2)}`;

    // 3. Abre o modal
    document.getElementById('modal-payment').style.display = 'block';
    
    if (typeof toggleCarrinho === "function") toggleCarrinho();

} else {
    alert("❌ Erro: " + data.msg);
}
    } catch (erro) {
        console.error(erro);
        alert("📡 Erro de conexão com o servidor.");
    } finally {
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
    }
}

// =======================================================
// 📋 FUNÇÃO PARA COPIAR O CÓDIGO PIX
// =======================================================
function copiarCodigoPix() {
    const inputPix = document.getElementById('pix-copia-cola-text');
    inputPix.select();
    inputPix.setSelectionRange(0, 99999); // Para telemóveis
    navigator.clipboard.writeText(inputPix.value);
    
    const btn = document.getElementById('btn-copiar-pix');
    btn.innerHTML = '<i class="fas fa-check"></i> CÓDIGO COPIADO!';
    btn.style.background = "#0a1931";
    btn.style.color = "#dfaf12";
    
    setTimeout(() => {
        btn.innerHTML = '<i class="fas fa-copy"></i> COPIAR CÓDIGO PIX';
        btn.style.background = "#39dac4";
        btn.style.color = "#013f35";
    }, 3000);
}

// =======================================================
// ✅ RESETAR INTERFACE APÓS O PEDIDO
// =======================================================
function concluirPedidoAposPix() {
    // Garante que o carrinho está vazio
    itensNoCarrinho = []; 
    localStorage.removeItem('loja_carrinho'); 
    
    if (typeof renderizarCarrinhoLateral === "function") renderizarCarrinhoLateral();
    if (typeof atualizarContadorCarrinho === "function") atualizarContadorCarrinho();
    
    // Volta os passos do carrinho para o início para a próxima compra
    const step1 = document.getElementById('cart-step-1');
    const step2 = document.getElementById('cart-step-2');
    if (step1) step1.style.display = 'flex';
    if (step2) step2.style.display = 'none';
    
    // Fecha qualquer modal aberto e abre a lista de pedidos
    document.getElementById('modal-payment').style.display = 'none';
    if (typeof abrirMeusPedidosLoja === "function") abrirMeusPedidosLoja();
}
// =======================================================
// 🎉 A MÁGICA DOS CONFETES (QUANDO O CLIENTE RECEBE)
// =======================================================
async function confirmarRecebimentoCliente(orderId) {
    if(!confirm("Atenção: Apenas confirme se já estiver com o pacote em mãos. Deseja confirmar?")) return;
    
    try {
        // Envia para o Admin que o pacote foi entregue
        const res = await fetch('/api/admin/store/orders/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: orderId, new_status: 'Entregue' })
        });
        
        const data = await res.json();
        if(data.success) {
            dispararConfetesDaCici(); // FESTA!
            abrirMeusPedidosLoja(); // Recarrega a tela para a barra ficar no 100% (Entregue)
        }
    } catch(e) {
        alert("Erro na conexão.");
    }
}

function dispararConfetesDaCici() {
    const festas = ['🎉', '🎊', '✨', '📦', '💙'];
    
    for (let i = 0; i < 30; i++) {
        setTimeout(() => {
            const confete = document.createElement('div');
            confete.innerText = festas[Math.floor(Math.random() * festas.length)];
            confete.style.position = 'fixed';
            confete.style.left = Math.random() * 100 + 'vw';
            confete.style.top = '-50px';
            confete.style.fontSize = (Math.random() * 20 + 20) + 'px';
            confete.style.zIndex = '999999';
            confete.style.pointerEvents = 'none';
            confete.style.transition = 'top 3s linear, left 3s ease-in-out, transform 3s';
            
            document.body.appendChild(confete);
            
            setTimeout(() => {
                confete.style.top = '120vh';
                confete.style.left = (Math.random() * 100) + 'vw';
                confete.style.transform = `rotate(${Math.random() * 360}deg)`;
            }, 50);
            
            setTimeout(() => confete.remove(), 3000);
        }, i * 50);
    }
}
// Função para abrir o modal de pagamento PIX após finalizar o pedido na loja
function abrirModalPagamentoLoja(orderId, total) {
    const modal = document.getElementById('modal-payment');
    if(modal) {
        document.getElementById('pay-order-id').value = orderId;
        document.getElementById('pay-amount').value = total;
        document.getElementById('pay-desc').innerText = `Pedido #${orderId} - Total: R$ ${total.toFixed(2)}`;
        modal.style.display = 'block';
    }
}

function closePaymentModal() {
    document.getElementById('modal-payment').style.display = 'none';
    // Ao fechar, levamos o cliente para a tela de "Meus Pedidos" para ele ver o status
    abrirMeusPedidosLoja();
}
function abrirModalCarrinho() {
    const sideCart = document.getElementById('side-cart');
    const overlay = document.getElementById('cart-overlay');
    
    if (sideCart && overlay) {
        sideCart.style.right = '0'; // Faz o carrinho deslizar para dentro
        overlay.classList.remove('hidden'); // Mostra o fundo escuro
        renderizarCarrinhoLateral(); // Atualiza os itens lá dentro
    }
}

function fecharModalCarrinho() {
    const sideCart = document.getElementById('side-cart');
    const overlay = document.getElementById('cart-overlay');
    
    if (sideCart && overlay) {
        sideCart.style.right = '-100%'; // Esconde o carrinho
        overlay.classList.add('hidden'); // Esconde o fundo escuro
    }
}
// --- 🟢 FUNÇÃO WHATSAPP ---
function enviarDuvidaWhatsApp(nomeProduto) {
    const telefone = "5585"; // 👈 COLOQUE O SEU NÚMERO AQUI (com código do país)
    const mensagem = encodeURIComponent(`Olá! Tenho uma dúvida sobre o produto: *${nomeProduto}*`);
    window.open(`https://wa.me/${telefone}?text=${mensagem}`, '_blank');
}

// --- ❤️ FUNÇÃO FAVORITOS (LOCALSTORAGE) ---
// Trocamos 'let' por 'var' para evitar o erro de inicialização (ReferenceError)
var meusFavoritos = JSON.parse(localStorage.getItem('loja_favoritos')) || [];

function toggleFavorito(id) {
    // 🛡️ Trava de segurança: Se por acaso a variável falhar ao carregar, forçamos o carregamento aqui
    if (!meusFavoritos) {
        meusFavoritos = JSON.parse(localStorage.getItem('loja_favoritos')) || [];
    }

    const index = meusFavoritos.indexOf(id);
    const iconDiv = document.getElementById(`fav-${id}`);

    if (index === -1) {
        meusFavoritos.push(id);
        if (iconDiv) {
            iconDiv.style.color = "#ee4d2d"; // Fica Vermelho
            iconDiv.style.background = "#fff";
        }
    } else {
        meusFavoritos.splice(index, 1);
        if (iconDiv) {
            iconDiv.style.color = "#ccc"; // Fica Cinza
            iconDiv.style.background = "rgba(255,255,255,0.8)";
        }
    }

    // Salva no armazenamento do celular/computador
    localStorage.setItem('loja_favoritos', JSON.stringify(meusFavoritos));
    
    // Pequeno efeito visual de "pulo"
    if (iconDiv) {
        iconDiv.style.transform = "scale(1.3)";
        setTimeout(() => iconDiv.style.transform = "scale(1)", 200);
    }
}
function atualizarBarraFrete(total) {
    const metaFrete = 20000; // 👈 Valor que você quer dar frete grátis
    const msg = document.getElementById('frete-msg');
    const bar = document.getElementById('frete-bar');
    const percentTxt = document.getElementById('frete-percent');

    if (total >= metaFrete) {
        msg.innerHTML = "🎉 Parabéns! Você ganhou <b>FRETE GRÁTIS!</b>";
        bar.style.width = "100%";
        bar.style.background = "#25d366"; // Fica Verde
        percentTxt.innerText = "100%";
    } else {
        const falta = metaFrete - total;
        const percent = (total / metaFrete) * 100;
        msg.innerHTML = `Faltam <b>XOF ${falta.toFixed(0)}</b> para Frete Grátis!`;
        bar.style.width = `${percent}%`;
        bar.style.background = "#ee4d2d";
        percentTxt.innerText = `${percent.toFixed(0)}%`;
    }
}
// =======================================================
// 🛍️ NAVEGAÇÃO DA SACOLA (PASSO 1 E PASSO 2)
// =======================================================

// Função para avançar para o endereço/pagamento
function irParaCheckout() {
    // Verifica se a sacola está vazia para não deixar o cliente pagar o vazio
    // (Ajuste o nome 'itensNoCarrinho' se a sua variável se chamar 'carrinhoLoja')
    const sacola = (typeof itensNoCarrinho !== 'undefined') ? itensNoCarrinho : (typeof carrinhoLoja !== 'undefined' ? carrinhoLoja : []);
    
    if (sacola.length === 0) {
        alert("⚠️ A sua sacola está vazia! Adicione produtos antes de avançar.");
        return;
    }

    const step1 = document.getElementById('cart-step-1');
    const step2 = document.getElementById('cart-step-2');

    if (step1 && step2) {
        step1.style.display = 'none'; // Esconde a lista de produtos
        
        step2.style.display = 'flex'; // Mostra a tela de endereço/pagamento
        step2.classList.remove('hidden');
    }
}

// Função para voltar para a lista de produtos caso o cliente desista ou queira alterar
function voltarParaCarrinho() {
    const step1 = document.getElementById('cart-step-1');
    const step2 = document.getElementById('cart-step-2');

    if (step1 && step2) {
        step2.style.display = 'none'; // Esconde a tela de pagamento
        step1.style.display = 'flex'; // Mostra a lista de produtos novamente
    }
}
// ==========================================
// 🛠️ LÓGICA DE APAGAR MÚLTIPLOS VÍDEOS
// ==========================================

// Função do "Selecionar Todos" (Marca ou desmarca todos da página)
function toggleSelectAllVideos(source) {
    const checkboxes = document.querySelectorAll('.video-checkbox');
    checkboxes.forEach(cb => cb.checked = source.checked);
    checkVideoSelection(); // Atualiza o botão vermelho
}

// Verifica quantos estão selecionados e mostra o botão
function checkVideoSelection() {
    const checkboxes = document.querySelectorAll('.video-checkbox:checked');
    const btnBulk = document.getElementById('btn-bulk-delete');
    const countSpan = document.getElementById('count-selected');
    
    if (checkboxes.length > 0) {
        if(btnBulk) btnBulk.style.display = 'inline-block';
        if(countSpan) countSpan.innerText = checkboxes.length;
    } else {
        if(btnBulk) btnBulk.style.display = 'none';
    }
    
    // Se o utilizador desmarcar um manualmente, desmarca o "Selecionar Todos" lá do topo
    const allCheckboxes = document.querySelectorAll('.video-checkbox');
    const selectAll = document.getElementById('selectAllVideos');
    if (selectAll) {
        selectAll.checked = (checkboxes.length === allCheckboxes.length && allCheckboxes.length > 0);
    }
}

// O gatilho que apaga tudo o que foi selecionado
async function deleteSelectedVideos() {
    const checkboxes = document.querySelectorAll('.video-checkbox:checked');
    if (checkboxes.length === 0) return;

    if (!confirm(`⚠️ Atenção: Tem certeza que deseja apagar ${checkboxes.length} vídeos de uma vez? Essa ação é permanente!`)) {
        return;
    }

    // Cria um pacote com os IDs e nomes dos ficheiros para o servidor
    const videosToTrash = [];
    checkboxes.forEach(cb => {
        videosToTrash.push({
            id: cb.value,
            filename: cb.getAttribute('data-filename')
        });
    });

    const btnBulk = document.getElementById('btn-bulk-delete');
    const txtOld = btnBulk.innerHTML;
    btnBulk.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Apagando...';
    btnBulk.disabled = true;

    try {
        const res = await fetch('/api/videos/delete-bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videos: videosToTrash })
        });
        const data = await res.json();

        if (data.success) {
            alert(`✅ ${checkboxes.length} vídeos apagados com sucesso! O seu disco está mais limpo.`);
            
            // Esconde o botão e desmarca a caixa principal
            btnBulk.style.display = 'none';
            const selectAll = document.getElementById('selectAllVideos');
            if(selectAll) selectAll.checked = false;
            
            // Atualiza a tabela instantaneamente
            loadAdminVideos(); 
        } else {
            alert("❌ Erro ao apagar: " + data.msg);
        }
    } catch (error) {
        alert("📡 Erro de conexão ao tentar apagar os vídeos.");
    } finally {
        btnBulk.innerHTML = txtOld;
        btnBulk.disabled = false;
    }
}
// ==========================================
// FUNÇÃO EXCLUSIVA DO PAINEL DO CLIENTE (COM CÂMBIO EM TEMPO REAL 🌍)
// ==========================================
async function loadClientInvoices(loteFiltro = '') {
    const tbody = document.getElementById('client-invoices-list');
    if(!tbody) return; 

    // Descobre qual moeda o cliente quer ver agora
    const comboMoeda = document.getElementById('moeda-fatura');
    const moedaSelecionada = comboMoeda ? comboMoeda.value : 'BRL';

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Carregando cotação atualizada e faturas... <i class="fas fa-spinner fa-spin"></i></td></tr>';

    try {
        // 🌍 1. MÁGICA DA COTAÇÃO EM TEMPO REAL
        let taxaConversao = 1;
        let simboloMoeda = 'R$';
        
        if (moedaSelecionada !== 'BRL') {
            try {
                // Puxa a cotação oficial do dia baseada no Real (BRL)
                const resCotacao = await fetch('https://open.er-api.com/v6/latest/BRL');
                const dadosCotacao = await resCotacao.json();
                
                taxaConversao = dadosCotacao.rates[moedaSelecionada] || 1;
                
                if(moedaSelecionada === 'XOF') simboloMoeda = 'CFA';
                if(moedaSelecionada === 'EUR') simboloMoeda = '€';
                if(moedaSelecionada === 'USD') simboloMoeda = '$';
            } catch(e) {
                console.log("Erro ao buscar cotação. Usando Real Brasileiro por segurança.");
                taxaConversao = 1;
                simboloMoeda = 'R$';
            }
        }

        // 2. BUSCA AS FATURAS NO SERVIDOR
        const res = await fetch('/api/invoices/my_invoices'); 
        let list = await res.json();

        // ==========================================
        // 🛡️ O ESCUDO ANTIMÍSSEIS VEM AQUI!
        // ==========================================
        if (!Array.isArray(list)) {
            console.warn("⚠️ Servidor bloqueou o pedido (Erro 429). Protegendo o site...", list);
            list = []; // Transforma a resposta errada em uma lista vazia para não quebrar a tela!
        }
        // ==========================================

        // Filtro de Lote
        if (loteFiltro && loteFiltro !== '') {
            list = list.filter(inv => (inv.lote || 'Sem Lote') === loteFiltro);
        }

        // Filtro de Histórico (Esconde pagas se não quiser ver todas)
        if (!window.verHistoricoCompleto) {
            list = list.filter(inv => {
                const statusStr = String(inv.status || '').toLowerCase();
                const isPago = (statusStr === 'pago' || statusStr === 'approved' || statusStr === 'paid');
                return !isPago; 
            });
        }

        tbody.innerHTML = '';
        if(list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px;">Nenhuma fatura pendente ${loteFiltro ? 'para este envio' : ''}.</td></tr>`;
            return;
        }

        list.forEach(inv => {
            let statusHtml = '';
            let actionHtml = '';

            let rawDesc = inv.box_code ? `Box ${inv.box_code}` : `Fatura #${inv.id}`;
            let safeDesc = rawDesc.replace(/'/g, "&#39;").replace(/"/g, "&quot;");

            // 🧮 3. CALCULA O VALOR NA MOEDA ESCOLHIDA
            const valorEmReais = parseFloat(inv.amount) || 0;
            const valorConvertido = valorEmReais * taxaConversao;

            if(inv.status === 'approved') {
                statusHtml = '<span style="color:green; font-weight:bold;">✅ PAGO</span>';
                actionHtml = '<span style="color:#ccc; font-size:12px;">Concluído</span>';
            } else if(inv.status === 'in_review') {
                statusHtml = '<span style="background-color:blue; color:white; padding:2px 5px; border-radius:4px; font-weight:bold;">👀 Em Análise</span>';
                actionHtml = '<span style="color:#ccc; font-size:12px;">Aguardando o Admin</span>';
            } else if(inv.status === 'pending') {
                statusHtml = '<span style="color:orange; font-weight:bold;">⏳ Pendente</span>';
                
                actionHtml = `
                <div style="display:flex; justify-content:center; gap:8px;">
                    <button class="btn-pisca" onclick="openPaymentModal('${inv.id}', '${safeDesc}', '${valorEmReais}')" style="background:#00b1ea; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:12px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
                        💸 Pagar 
                    </button>
                </div>`;
            } else {
                statusHtml = '<span style="color:red;">Cancelado</span>';
                actionHtml = '-';
            }

            tbody.innerHTML += `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding:12px; font-weight:bold; color:#0a1931;">#${inv.id}</td>
                <td>${rawDesc}</td>
                <td style="font-weight:bold; color:#0a1931;">${simboloMoeda} ${valorConvertido.toFixed(2)}</td>
                <td>${statusHtml}</td>
                <td style="text-align:center;">${actionHtml}</td>
            </tr>`;
        });

    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Erro ao carregar faturas.</td></tr>';
    }
}
// =======================================================
// 🛍️ MÁGICA DO CARRINHO PERSISTENTE (NUNCA DESAPARECE)
// =======================================================

function salvarCarrinhoNaMemoriaDoCelular() {
    // Pega a lista do carrinho e guarda na memória local (localStorage) do navegador
    localStorage.setItem('guineexpress_carrinho_v1', JSON.stringify(itensNoCarrinho));
}

function recuperarCarrinhoDaMemoriaDoCelular() {
    // Tenta puxar o que estava salvo no navegador
    const carrinhoSalvo = localStorage.getItem('guineexpress_carrinho_v1');
    
    if (carrinhoSalvo) {
        try {
            // Transforma o texto guardado de volta numa lista real
            itensNoCarrinho = JSON.parse(carrinhoSalvo);
            
            // Atualiza o contador vermelho que fica flutuando na tela
            atualizarContadorCarrinho();
            
            // Desenha os itens dentro da sacola invisível
            renderizarCarrinhoLateral(); 
            
            console.log("🛍️ Carrinho recuperado com sucesso!", itensNoCarrinho.length, "itens.");
        } catch (e) {
            console.error("Erro ao ler o carrinho da memória. Limpando...", e);
            itensNoCarrinho = [];
        }
    }
}
// ==========================================================
// 💎 MODO CATÁLOGO VIP 3D - LÓGICA E EFEITOS CINEMATOGRÁFICOS
// ==========================================================

async function carregarLojaVip() {
    const gridVip = document.getElementById('vip-products-grid');
    if (!gridVip) return;

    // Se os produtos ainda não estiverem na memória do telemóvel, vamos buscá-los ao Banco de Dados AGORA!
    if (!window.produtosOriginais || window.produtosOriginais.length === 0) {
        gridVip.innerHTML = '<div style="text-align:center; padding:50px;"><i class="fas fa-spinner fa-spin fa-2x" style="color:#d4af37;"></i><p style="color:white; margin-top:10px;">A importar coleção premium...</p></div>';
        
        try {
            // 🔄 CORREÇÃO AQUI: Mudamos para a rota exclusiva de clientes que entrega o formato { success: true }
            const response = await fetch('/api/loja/produtos-clientes');
            const data = await response.json();
            
            if (data.success) {
                window.produtosOriginais = data.products; // Guarda na memória com sucesso!
            } else {
                gridVip.innerHTML = '<p style="color:#ff4c4c; text-align:center;">Erro ao carregar a coleção. Tente novamente.</p>';
                return;
            }
        } catch (erro) {
            console.error("Erro na rota da loja:", erro);
            gridVip.innerHTML = '<p style="color:#ff4c4c; text-align:center;">Erro de conexão com a loja.</p>';
            return;
        }
    }

    // Agora que temos certeza que os produtos existem, desenhamos a vitrine!
    let html = '';
    window.produtosOriginais.forEach(p => {
        // Blindagem de moedas: Aceita tanto o seletor da loja quanto o das faturas
        const moedaElement = document.getElementById('currency-selector') || document.getElementById('moeda-fatura');
        const moeda = moedaElement ? moedaElement.value : 'BRL';
        let precoFinal = p.price_brl;
        let simbolo = 'R$';
        const cotacoes = window.COTACAO || { XOF: 120, EUR: 0.18, USD: 0.20 };
        
        if (moeda === 'CFA' || moeda === 'XOF') { precoFinal = p.price_brl * cotacoes.XOF; simbolo = 'CFA'; }
        else if (moeda === 'EUR') { precoFinal = p.price_brl * cotacoes.EUR; simbolo = '€'; }
        else if (moeda === 'USD') { precoFinal = p.price_brl * cotacoes.USD; simbolo = '$'; }

        html += `
            <div onclick="abrirProdutoVip3D(${p.id}, '${simbolo}', ${precoFinal})" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 20px; text-align: center; cursor: pointer; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);" onmouseover="this.style.transform='scale(1.05) translateY(-5px)'; this.style.background='rgba(255,255,255,0.1)';" onmouseout="this.style.transform='scale(1) translateY(0)'; this.style.background='rgba(255,255,255,0.05)';">
                <img src="${p.image_url || '/logo.png'}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 50%; box-shadow: 0 15px 25px rgba(0,0,0,0.5); margin-bottom: 15px; border: 3px solid rgba(212, 175, 55, 0.3);">
                <h4 style="color: white; margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</h4>
                <p style="color: #d4af37; margin: 8px 0 0 0; font-weight: 900; font-size: 16px; text-shadow: 0 2px 5px rgba(0,0,0,0.5);">${simbolo} ${precoFinal.toFixed(2)}</p>
            </div>
        `;
    });
    
    gridVip.innerHTML = html;
}

// 🎩 A MÁGICA: O PRODUTO SALTA DO ECRÃ (OTIMIZADO)
function abrirProdutoVip3D(id, simbolo, preco) {
    const produto = window.produtosOriginais.find(p => p.id === id);
    if(!produto) return;

    let overlay = document.getElementById('vip-3d-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'vip-3d-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0'; overlay.style.left = '0';
        overlay.style.width = '100vw'; overlay.style.height = '100vh';
        
        // Fundo escuro sólido em vez de Blur pesado (Resolve 99% dos travamentos!)
        overlay.style.background = 'rgba(10, 25, 49, 0.98)';
        
        overlay.style.zIndex = '999999';
        overlay.style.display = 'flex';
        overlay.style.flexDirection = 'column';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.4s ease';
        document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
        <div style="position: absolute; top: 40px; right: 40px; cursor: pointer; color: rgba(255,255,255,0.7); font-size: 35px; transition: 0.3s;" onclick="fecharProdutoVip3D()">
            <i class="fas fa-times"></i>
        </div>
        
        <img src="${produto.image_url || '/logo.png'}" style="width: 280px; height: 280px; object-fit: cover; border-radius: 30px; box-shadow: 0 20px 50px rgba(0,0,0,0.8); border: 2px solid rgba(255,255,255,0.1); transform: scale(0.3) translateY(200px) rotateY(60deg) rotateX(-20deg); opacity: 0; transition: all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);" id="vip-3d-img">
        
        <div id="vip-3d-info" style="text-align: center; margin-top: 40px; transform: translateY(60px); opacity: 0; transition: all 0.7s ease 0.3s; padding: 0 20px;">
            <h2 style="color: white; font-size: 32px; font-weight: 900; margin: 0;">${produto.name}</h2>
            <p style="color: #d4af37; font-size: 28px; font-weight: 900; margin: 15px 0;">${simbolo} ${preco.toFixed(2)}</p>
            <p style="color: #cbd5e1; font-size: 15px; max-width: 350px; margin: 0 auto 35px auto; line-height: 1.6;">${produto.description || 'Produto premium exclusivo Guineexpress.'}</p>
            
            <button onclick="adicionarAoCarrinho(${produto.id}); fecharProdutoVip3D();" style="background: linear-gradient(135deg, #d4af37, #f1db8a); color: #0a1931; border: none; padding: 18px 45px; border-radius: 50px; font-size: 16px; font-weight: 900; cursor: pointer; box-shadow: 0 10px 20px rgba(212, 175, 55, 0.4); margin-top: 20px;">
                <i class="fas fa-shopping-cart" style="margin-right: 10px;"></i> ADICIONAR À SACOLA
            </button>
        </div>
    `;

    overlay.style.display = 'flex';
    
    setTimeout(() => {
        overlay.style.opacity = '1';
        const img = document.getElementById('vip-3d-img');
        const info = document.getElementById('vip-3d-info');
        img.style.transform = 'scale(1) translateY(0) rotateY(0deg) rotateX(0deg)';
        img.style.opacity = '1';
        info.style.transform = 'translateY(0)';
        info.style.opacity = '1';
    }, 50);
}

// 🎬 Encerra a Magia Suavemente
function fecharProdutoVip3D() {
    const overlay = document.getElementById('vip-3d-overlay');
    if (overlay) {
        const img = document.getElementById('vip-3d-img');
        const info = document.getElementById('vip-3d-info');
        
        // Faz a imagem "cair" e girar para trás
        img.style.transform = 'scale(0.3) translateY(200px) rotateY(-60deg) rotateX(20deg)';
        img.style.opacity = '0';
        
        // Esconde as informações
        info.style.transform = 'translateY(60px)';
        info.style.opacity = '0';
        
        // Remove o fundo desfocado
        overlay.style.opacity = '0';

        setTimeout(() => {
            overlay.style.display = 'none';
        }, 500); // Tempo equivalente ao CSS
    }
}
// ==========================================
// 🗑️ APAGAR FATURAS EM MASSA (CÓDIGO BLINDADO)
// ==========================================
window.estadoSelecaoFaturas = false; // <-- Agora pendurado no window (zero erros!)

function alternarSelecaoFaturas(checkboxClicado) {
    // Se clicou na caixinha do cabeçalho, segue o estado dela. Se clicou no botão azul, inverte tudo.
    if (checkboxClicado && checkboxClicado.type === 'checkbox') {
        window.estadoSelecaoFaturas = checkboxClicado.checked;
    } else {
        window.estadoSelecaoFaturas = !window.estadoSelecaoFaturas;
    }

    document.querySelectorAll('.invoice-check').forEach(caixa => {
        caixa.checked = window.estadoSelecaoFaturas;
    });

    // Atualiza as caixinhas dos cabeçalhos para acompanharem o botão
    document.querySelectorAll('th input[type="checkbox"]').forEach(chk => {
        chk.checked = window.estadoSelecaoFaturas;
    });
}

async function apagarFaturasSelecionadas() {
    const marcados = document.querySelectorAll('.invoice-check:checked');
    
    if (marcados.length === 0) {
        return alert("⚠️ Selecione pelo menos uma fatura para apagar.");
    }

    if (!confirm(`Tem a certeza que deseja APAGAR DEFINITIVAMENTE estas ${marcados.length} faturas?`)) {
        return;
    }

    const idsParaApagar = [];
    marcados.forEach(checkbox => {
        idsParaApagar.push(checkbox.value);
    });

    try {
        const res = await fetch('/api/invoices/bulk-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: idsParaApagar })
        });
        
        const data = await res.json();
        
        if (data.success) {
            alert("✅ Faturas apagadas com sucesso!");
            window.estadoSelecaoFaturas = false; // Reseta a variável
            
            // Tira a marcação das caixas do cabeçalho
            document.querySelectorAll('th input[type="checkbox"]').forEach(chk => {
                chk.checked = false;
            });
            
            loadInvoices(); // Recarrega as tabelas atualizadas
        } else {
            alert("Erro ao apagar: " + data.message);
        }
    } catch (e) {
        console.error(e);
        alert("Erro de conexão com o servidor ao tentar apagar as faturas.");
    }
}
// ========================================================
// 🗑️ APAGAR ENCOMENDAS EM MASSA
// ========================================================
async function apagarEncomendasSelecionadas() {
    // Pega todas as caixinhas marcadas dentro da tabela de encomendas
    const marcados = document.querySelectorAll('#orders-list input[type="checkbox"]:checked');
    
    if (marcados.length === 0) {
        return alert("⚠️ Selecione pelo menos uma encomenda para apagar.");
    }

    if (!confirm(`Tem a certeza que deseja APAGAR (ocultar) estas ${marcados.length} encomendas selecionadas?`)) {
        return;
    }

    // Pega o ID de cada encomenda
    const idsParaApagar = [];
    marcados.forEach(checkbox => {
        idsParaApagar.push(checkbox.value);
    });

    try {
        const res = await fetch('/api/orders/bulk-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: idsParaApagar })
        });
        
        const data = await res.json();
        
        if (data.success) {
            alert("✅ Encomendas apagadas com sucesso!");
            
            // Reseta as marcações
            window.estadoSelecaoEncomendas = false;
            const chkMaster = document.getElementById('selectAllOrders');
            if (chkMaster) chkMaster.checked = false;
            
            loadOrders(); // Recarrega a tabela de encomendas
        } else {
            alert("Erro ao apagar: " + data.message);
        }
    } catch (e) {
        console.error(e);
        alert("Erro de conexão com o servidor ao tentar apagar.");
    }
}
// ==========================================
// SISTEMA DA VITRINE VIP
// ==========================================

// 1. Função para abrir o modal quando clica num produto
function abrirProdutoVIP(imagem, titulo, descricao, preco) {
    const modal = document.getElementById('modal-produto-premium');
    const card = modal.querySelector('.produto-card-glass');
    
    // Preenche os dados
    document.getElementById('vip-prod-img').src = imagem;
    document.getElementById('vip-prod-title').innerText = titulo;
    document.getElementById('vip-prod-desc').innerText = descricao;
    document.getElementById('vip-prod-price').innerText = preco;

    // Mostra o modal com animação
    modal.classList.remove('hidden');
    // Pequeno atraso para a animação funcionar
    setTimeout(() => {
        modal.style.opacity = '1';
        card.style.transform = 'scale(1)';
    }, 10);
}

// 2. Função para fechar o modal
function fecharModalProduto() {
    const modal = document.getElementById('modal-produto-premium');
    const card = modal.querySelector('.produto-card-glass');
    
    modal.style.opacity = '0';
    card.style.transform = 'scale(0.8)';
    
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 400); // Espera a animação terminar antes de esconder
}

// 3. O GUARDA-COSTAS DA COMPRA (Verifica Login)
function tentarComprar() {
    // Verifica se a variável currentUser (que você já usa no sistema) está vazia
    if (!window.currentUser) {
        // Usuário NÃO está logado!
        fecharModalProduto(); // Fecha o produto
        
        alert("🔒 Acesso Restrito! Faça login ou crie uma conta grátis para finalizar sua compra.");
        
        // Puxa a tela de login que você me enviou
        const loginScreen = document.getElementById('login-screen'); 
        // ou window.location.href = 'index.html'; dependendo de como está sua estrutura
        if(loginScreen) {
            loginScreen.classList.remove('hidden');
        } else {
            window.location.href = '/'; // Manda pro login se for página separada
        }
    } else {
        // Usuário ESTÁ logado!
        alert("✅ Produto adicionado ao carrinho com sucesso!");
        // Aqui você chama a sua função de adicionar ao carrinho!
        // Ex: adicionarAoCarrinho(produtoAtual);
    }
}
// --- 🌍 SISTEMA DO RADAR DE RASTREAMENTO REAL (CONECTADO AO BD) ---
        async function iniciarRastreamento() {
            // Pega o código digitado (ex: 15 ou GX-15) e limpa para deixar só o número
            let codigoDigitado = document.getElementById('track-code').value.trim();
            let idPedido = codigoDigitado.replace(/\D/g, ''); // Extrai apenas os números

            if(!idPedido) return alert("Por favor, digite o número do seu pedido (Ex: 15).");

            document.getElementById('radar-progress-container').style.display = 'flex';
            const statusBar = document.getElementById('radar-bar');
            const plane = document.getElementById('radar-plane');
            const statusText = document.getElementById('radar-status');
            
            statusText.innerText = "Buscando nos servidores da Guineexpress... 🛰️";
            statusText.style.color = "var(--gold)";
            statusText.style.opacity = '1';
            
            // Reseta a barra para o início enquanto busca
            statusBar.style.width = '0%';
            plane.style.left = '0%';

            try {
                // 🚀 PUXA OS PEDIDOS REAIS DO BANCO DE DADOS
                const res = await fetch('/api/store/my-orders');
                const data = await res.json();

                if (data.success) {
                    // Tenta achar o pedido com o ID correspondente
                    const pedidoReal = data.orders.find(o => o.id.toString() === idPedido);

                    if (pedidoReal) {
                        const status = pedidoReal.status ? pedidoReal.status.toLowerCase() : 'pendente';
                        
                        setTimeout(() => {
                            if (status.includes('entregue')) {
                                statusBar.style.width = '100%';
                                plane.style.left = '100%';
                                statusText.innerText = "✅ Aterrissou e Entregue em Bissau!";
                                statusText.style.color = "#00ff66";
                            } 
                            else if (status.includes('enviado') || status.includes('rota')) {
                                statusBar.style.width = '60%';
                                plane.style.left = '60%';
                                statusText.innerText = "✈️ Carga sobrevoando o Atlântico (Em Voo)";
                                statusText.style.color = "var(--gold)";
                            } 
                            else {
                                // Pago, Pendente, etc. Fica no Brasil (Início)
                                statusBar.style.width = '15%';
                                plane.style.left = '15%';
                                statusText.innerText = "📦 Preparando no Armazém Seguro (Brasil)";
                                statusText.style.color = "var(--gold)";
                            }
                        }, 1000); // Dá 1 segundo de suspense cinematográfico
                    } else {
                        statusText.innerText = "❌ Pedido não encontrado ou não pertence a você.";
                        statusText.style.color = "#ff4d4d";
                    }
                } else {
                    statusText.innerText = "🔒 Faça login no painel principal para rastrear.";
                    statusText.style.color = "#ff4d4d";
                }
            } catch (err) {
                statusText.innerText = "❌ Erro ao conectar com o satélite. Tente de novo.";
                statusText.style.color = "#ff4d4d";
            }
        }