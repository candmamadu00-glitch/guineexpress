let currentRole = 'client';
let currentUser = null;
let globalPricePerKg = 0; 
let mediaRecorder;
let recordedChunks = [];
let currentStream = null;
let currentBlob = null;
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

            const imgDisplay = document.getElementById('profile-img-display');
            if(currentUser.profile_pic && imgDisplay) {
                imgDisplay.src = '/uploads/' + currentUser.profile_pic + '?v=' + new Date().getTime();
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
let boxLimit = 50; // Quantas caixas mostrar por vez (variável global)

async function loadBoxes() {
    try {
        const res = await fetch('/api/boxes');
        let list = await res.json(); 
        const tbody = document.getElementById('box-table-body');
        const summaryContainer = document.getElementById('box-summary-container');
        
        const toggleBtn = document.getElementById('toggle-boxes');
        const showCompleted = toggleBtn ? toggleBtn.checked : false;
        
        if(!tbody) return;
        
        // Coloca um aviso de carregando rápido
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Carregando caixas...</td></tr>';
        if(summaryContainer) summaryContainer.innerHTML = '';

        // 1. FAZ A MATEMÁTICA COM TODAS AS CAIXAS (Para não quebrar o resumo)
        const boxTotals = {};

        list.forEach(b => {
            const status = b.status || b.order_status || '';
            if ((status === 'Entregue' || status === 'Pago') && currentUser.role !== 'client' && !showCompleted) return;

            const code = b.box_code || 'SEM-BOX';
            const weight = parseFloat(b.order_weight) || 0;

            if (!boxTotals[code]) {
                boxTotals[code] = 0;
            }
            boxTotals[code] += weight; 
        });

        // 2. CRIA OS CARTÕES DE RESUMO
        if (summaryContainer && Object.keys(boxTotals).length > 0) {
            let cardsHTML = '';
            for (const [code, totalWeight] of Object.entries(boxTotals)) {
                if (code === 'SEM-BOX') continue;
                cardsHTML += `
                    <div style="background: #f4f9ff; border-left: 4px solid #00b1ea; padding: 10px 15px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); min-width: 150px; flex: 1;">
                        <span style="font-size: 11px; color: #555; text-transform: uppercase;">📦 Caixa:</span> <br>
                        <strong style="font-size: 18px; color: #0a1931;">${code}</strong><br>
                        <span style="font-size: 11px; color: #555;">Peso Total:</span> 
                        <strong style="font-size: 16px; color: #d4af37;">${totalWeight.toFixed(2)} KG</strong>
                    </div>
                `;
            }
            summaryContainer.innerHTML = cardsHTML;
        }

        // Ordena a lista
        list.sort((a, b) => {
            const boxA = a.box_code || '';
            const boxB = b.box_code || '';
            return boxA.localeCompare(boxB, undefined, {numeric: true, sensitivity: 'base'});
        });

        // 3. A MÁGICA DA VELOCIDADE: Usar um "Buffer" e limitar na tela
        let htmlBuffer = '';
        let itensRenderizados = 0;
        let totalValidos = 0; // Conta quantos itens reais existem para mostrar o botão certo

        for (let i = 0; i < list.length; i++) {
            const b = list[i];
            const status = b.status || b.order_status || '';
            
            // Ignora os completos se a chave estiver desligada
            if ((status === 'Entregue' || status === 'Pago') && currentUser.role !== 'client' && !showCompleted) continue;

            totalValidos++; // Conta que achou um item válido para mostrar

            // PARA DE DESENHAR SE CHEGAR NO LIMITE PARA NÃO TRAVAR O CELULAR
            if (itensRenderizados >= boxLimit) continue; // Continua o loop só para contar o totalValidos

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
                
                act = `<button onclick="openReceiverModal(${b.id}, '${b.receiver_name || ''}', '${b.receiver_doc || ''}')" 
                        style="background:${corBtn}; color:${corTexto}; border:none; padding:5px 10px; cursor:pointer; border-radius:4px; font-weight:bold; font-size:12px;">
                        ${textoBtn}
                       </button>`;
            }

            const clientCell = isAdmin ? 
                `<td>${b.client_name || '-'}</td>` : 
                `<td style="display:none;">${b.client_name || '-'}</td>`;

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
        
        // 4. ADICIONA O BOTÃO "CARREGAR MAIS" SE HOUVER MAIS ITENS
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

        // Joga todo o código HTML na tabela DE UMA VEZ SÓ (extremamente rápido)
        tbody.innerHTML = htmlBuffer;
        if(typeof makeTablesResponsive === 'function') makeTablesResponsive();

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
// FUNÇÃO CRIAR ENCOMENDA
// ==========================================
async function createOrder() {
    // 1. Pega os dados do formulário
    const clientSelect = document.getElementById('order-client-select');
    const clientId = clientSelect.value;
    const code = document.getElementById('order-code').value;
    const desc = document.getElementById('order-desc').value;
    const weight = document.getElementById('order-weight').value;
    const status = document.getElementById('order-status').value;

    // 2. Validação simples
    if (!clientId || !code || !weight) {
        return alert("Preencha Cliente, Código e Peso!");
    }

    // --- NOVIDADE: A TRAVA DE SEGURANÇA! ---
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
        status: status
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
            alert("✅ Encomenda criada com sucesso!");
            
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
async function createBox(e) {
    if(e) e.preventDefault();

    // 1. Captura os ELEMENTOS primeiro (para verificar se existem)
    const clientEl = document.getElementById('box-client-select');
    const orderEl = document.getElementById('box-order-select');
    const codeEl = document.getElementById('box-code');
    const prodEl = document.getElementById('box-products');
    const amountEl = document.getElementById('box-amount'); // <--- Esse pode ser null no painel de funcionário

    // Se por acaso o HTML não carregou direito, evita erro
    if(!clientEl || !codeEl) {
        return alert("Erro de interface: Campos obrigatórios não encontrados.");
    }

    // 2. Pega os valores com segurança
    const clientVal = clientEl.value;
    const codeVal = codeEl.value.trim().toUpperCase();
    const orderVal = orderEl ? orderEl.value : ""; // Se não existir, vazio
    const prodVal = prodEl ? prodEl.value : "";   // Se não existir, vazio
    
    // --- A CORREÇÃO PRINCIPAL ESTÁ AQUI ---
    // Se o campo de valor (amountEl) existir, pega o valor. Se não existir (funcionário), usa 0.
    const amountVal = amountEl ? amountEl.value : 0; 
    // --------------------------------------

    if(!clientVal || !codeVal) {
        return alert("Erro: O Cliente e o Número do Box são obrigatórios.");
    }

    const d = {
        client_id: clientVal,
        order_id: orderVal === "" ? null : orderVal, 
        box_code: codeVal,
        products: prodVal,
        amount: amountVal === "" ? 0 : amountVal 
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
            
            loadBoxes();
            alert("✅ Box criado com sucesso!");
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

// --- SISTEMA DE AGENDAMENTO ---
async function createAvailability(e) {
    e.preventDefault();
    const data = {
        date: document.getElementById('sched-date').value,
        start_time: document.getElementById('sched-start').value,
        end_time: document.getElementById('sched-end').value,
        max_slots: document.getElementById('sched-slots').value
    };
    const res = await fetch('/api/schedule/create-availability', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data)});
    const json = await res.json();
    if(json.success) { alert('Horário liberado!'); loadSchedules(); } else alert('Erro.');
}

async function loadSchedules() {
    const resSlots = await fetch('/api/schedule/slots-15min');
    const responseSlots = await resSlots.json();
    
    // Tratamento novo: Se o servidor disser que tá bloqueado
    const isBloqueado = responseSlots.status === "bloqueado";
    const slots15min = responseSlots.data || [];

    const resAppoint = await fetch('/api/schedule/appointments');
    const appointments = await resAppoint.json();

    if(currentUser.role !== 'client') {
        renderAdminSchedule(appointments);
        renderAdminAvailabilities();
        return;
    }

    const container = document.getElementById('available-slots-container');
    if(container) {
        container.innerHTML = '';

        // SE O CLIENTE NÃO PAGOU A FATURA AINDA:
        if (isBloqueado) {
            container.innerHTML = `
                <div style="text-align:center; padding: 40px 20px; background: #fff3cd; color: #856404; border-radius: 8px; border: 1px solid #ffeeba;">
                    <i class="fas fa-lock" style="font-size: 40px; margin-bottom: 15px;"></i>
                    <h3 style="margin:0 0 10px 0;">Agenda Bloqueada</h3>
                    <p style="margin:0;">Para liberar o agendamento de recolha ou entrega, é necessário ter pelo menos uma fatura <strong>Paga</strong> no sistema.</p>
                </div>
            `;
        } else {
            // Lógica normal se estiver pago
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

                slots.forEach(slot => {
                    const isFull = slot.available <= 0;
                    const isBlocked = isFull || alreadyBookedThisDay;
                    let style = `border: 1px solid ${isBlocked?'#ccc':'#28a745'}; background: ${isBlocked?'#eee':'#fff'}; color: ${isBlocked?'#999':'#28a745'}; padding: 8px 15px; border-radius: 5px; cursor: ${isBlocked?'not-allowed':'pointer'}; font-weight:bold; min-width: 80px; text-align:center;`;
                    
                    html += `<div onclick="${isBlocked ? '' : `bookSlot(${slot.availability_id}, '${slot.date}', '${slot.time}')`}" style="${style}">
                        ${slot.time} ${isFull ? '(Cheio)' : ''}
                    </div>`;
                });
                html += `</div></div>`;
                container.innerHTML += html;
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
    const res = await fetch('/api/schedule/book', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ availability_id: availId, date: date, time: time }) });
    const json = await res.json();
    if(json.success) { alert('Sucesso!'); loadSchedules(); } else alert(json.msg);
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

// ==========================================
// Tabela de Agendamentos (Admin/Func) COM BOTÃO DE EXCLUIR
// ==========================================
function renderAdminSchedule(appointments) {
    const tbody = document.getElementById('admin-schedule-list');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    appointments.forEach(app => {
        let badgeClass = 'bg-success'; 
        if (app.status === 'Pendente') badgeClass = 'bg-warning'; 
        if (app.status === 'Recusado' || app.status === 'Cancelado') badgeClass = 'bg-danger';

        // Adicionando o botão de excluir histórico na coluna de Status
        tbody.innerHTML += `
            <tr>
                <td data-label="Data">${formatDate(app.date)}</td>
                <td data-label="Horário">${app.time_slot}</td>
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

                let imgUrl = (c.profile_pic && c.profile_pic !== 'default.png') ? 
                             (c.profile_pic.startsWith('http') ? c.profile_pic : '/uploads/' + c.profile_pic) : 
                             `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=random&color=fff&size=64`;

                const photoHtml = `<img src="${imgUrl}" onerror="this.src='https://ui-avatars.com/api/?name=User&background=ccc'" style="width:32px; height:32px; border-radius:50%; object-fit:cover; border:1px solid #ddd;">`;

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
async function loadClientOrdersInBox(cid) { const sel = document.getElementById('box-order-select'); if(!cid) { sel.disabled=true; return; } const res = await fetch(`/api/orders/by-client/${cid}`); const list = await res.json(); sel.innerHTML='<option value="">Selecione...</option>'; list.forEach(o => sel.innerHTML+=`<option value="${o.id}" data-desc="${o.description}">${o.code}</option>`); sel.disabled=false; }
function autoFillBoxData(sel) { document.getElementById('box-products').value = sel.options[sel.selectedIndex].getAttribute('data-desc') || ''; }
// ==============================================================
// 1. FUNÇÃO DA TIMELINE VISUAL (CORRIGIDA E ALINHADA)
// ==============================================================
function getTimelineHTML(status) {
    // 1. Define os passos e ícones
    const steps = [
        { label: 'Recebido', icon: '📥' },
        { label: 'Em Trânsito', icon: '✈️' },
        { label: 'Chegou', icon: '🏢' },
        { label: 'Entregue', icon: '✅' }
    ];
    
    // 2. Descobre em qual passo estamos (Lógica Inteligente)
    let currentIdx = 0;
    const s = status ? status.toLowerCase() : '';

    if (s.includes('recebido') || s.includes('triagem') || s.includes('processando')) currentIdx = 0;
    else if (s.includes('trânsito') || s.includes('voo') || s.includes('enviado')) currentIdx = 1;
    else if (s.includes('chegou') || s.includes('armazém') || s.includes('disponível') || s.includes('retirada')) currentIdx = 2;
    else if (s.includes('entregue') || s.includes('finalizado') || s.includes('avaria')) currentIdx = 3;

    // 3. Calcula % da barra verde (Progresso)
    // Se for o último passo, enche 100%. Se for o primeiro, 0%.
    const percent = (currentIdx / (steps.length - 1)) * 100;

    // 4. Gera o HTML usando as classes CSS do style.css
    let stepsHTML = '';

    steps.forEach((step, idx) => {
        const isActive = idx <= currentIdx;
        const activeClass = isActive ? 'active' : '';
        
        // Se estiver ativo mostra o ícone, se não, mostra vazio ou um ponto simples
        const iconContent = isActive ? step.icon : ''; 

        stepsHTML += `
            <div class="timeline-step ${activeClass}">
                <div class="timeline-dot">${iconContent}</div>
                <span class="timeline-label">${step.label}</span>
            </div>
        `;
    });

    return `
        <div class="timeline-wrapper">
            <div class="timeline-track"></div>
            <div class="timeline-fill" style="width: ${percent}%"></div>
            <div class="timeline-steps-container">
                ${stepsHTML}
            </div>
        </div>
    `;
}

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
        
        // Chama a função turbo para desenhar a tabela
        renderizarTabelaEncomendas();

        if (currentUser.role === 'client') updateClientNotifications(list);
    } catch (error) {
        console.error("Erro ao carregar encomendas:", error);
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
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px;">Nenhuma encomenda encontrada.</td></tr>';
        return;
    }

    // Pega apenas as primeiras encomendas até o limite atual
    const encomendasVisiveis = window.todasEncomendas.slice(0, window.limiteEncomendas);
    
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
                <td style="min-width: 250px;">${statusDisplay}</td>
                <td style="text-align:center;">${actions}</td>
            </tr>`; 
    });

    // Se ainda tem mais para mostrar, adiciona o botão mágico de carregar mais
    if (window.todasEncomendas.length > window.limiteEncomendas) {
        htmlDasLinhas += `
        <tr>
            <td colspan="8" style="text-align:center; padding: 15px;">
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

// 4. Inicia o Stream da Câmera
async function startCamera(facingMode) {
    const video = document.getElementById('camera-feed');
    
    // Para stream anterior se existir
    if(currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: facingMode,
                width: { ideal: 1280 }, // Tenta HD
                height: { ideal: 720 }
            }, 
            audio: true 
        });
        currentStream = stream;
        video.srcObject = stream;
    } catch (err) {
        alert("Erro ao acessar câmera: " + err);
        closeFullscreenCamera();
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
        // Busca todas as encomendas (que já trazem dados do cliente graças ao JOIN no server)
        const res = await fetch('/api/orders');
        const orders = await res.json();

        select.innerHTML = '<option value="">Selecione a Encomenda...</option>';

        // Filtra para não mostrar encomendas já entregues (opcional)
        // Se quiser ver todas, remova o .filter
        const activeOrders = orders.filter(o => o.status !== 'Entregue');

        activeOrders.forEach(o => {
            const clientName = o.client_name || 'Cliente';
            // Salva TUDO que precisamos nos atributos data-*
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

        // --- EVENTO: QUANDO O USUÁRIO SELECIONA UMA ENCOMENDA ---
        select.onchange = function() {
            checkVideoPermission(); // Libera o botão da câmera
            
            const option = select.options[select.selectedIndex];
            
            // Elementos visuais onde vamos jogar os dados
            const spanResumo = document.getElementById('info-desc');
            
            // Se o usuário selecionou algo válido
            if (select.value && spanResumo) {
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
                // Atualiza também o span oculto caso precise
                if(spanResumo) spanResumo.innerText = `Vídeo da Encomenda ${code}`;

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
// ==========================================
// CORREÇÃO DO UPLOAD E TIMER
// ==========================================

async function confirmUpload() {
    // 1. Validações Iniciais
    if(!currentBlob) return alert("Erro: Nenhum vídeo gravado.");

    const clientSelect = document.getElementById('video-client-select');
    const clientId = clientSelect ? clientSelect.value : null;
    
    if (!clientId) return alert("⚠️ Erro: Selecione um Cliente/Encomenda na lista antes de enviar!");

    // 2. Prepara Dados
    const descEl = document.getElementById('info-desc');
    const descText = descEl ? descEl.innerText : 'Vídeo de Encomenda';
    
    const formData = new FormData();
    formData.append('client_id', clientId);
    formData.append('description', descText);
    // Adiciona o nome do arquivo para garantir que o servidor entenda a extensão
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

// --- VÍDEOS DO ADMIN (RÁPIDO E COM BOTÕES BONITOS 🎨) ---
async function loadAdminVideos() {
    const tbody = document.getElementById('admin-video-list');
    if(!tbody) return;

    // Aviso de carregamento
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Carregando vídeos...</td></tr>';

    try {
        const res = await fetch('/api/videos/list');
        const list = await res.json();
        
        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Nenhum vídeo encontrado.</td></tr>';
            return;
        }

        let htmlBuffer = '';
        let renderizados = 0;
        let totalValidos = 0;

        for (let i = 0; i < list.length; i++) {
            totalValidos++;

            if (renderizados >= adminVideoLimit) continue; // Trava de segurança 

            const v = list[i];
            
            // A MÁGICA DOS BOTÕES AQUI 👇
            htmlBuffer += `
                <tr>
                    <td style="font-weight:bold; color:#0a1931;">${v.id}</td>
                    <td>${v.client_name || 'Desconhecido'}</td>
                    <td>${formatDate(v.created_at)}</td>
                    <td>
                        <div style="display: flex; gap: 8px; justify-content: flex-start;">
                            <a href="/uploads/videos/${v.filename}" target="_blank" 
                               style="background-color: #00b1ea; color: white; padding: 6px 12px; text-decoration: none; border-radius: 4px; font-size: 13px; font-weight: bold; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                <i class="fas fa-eye"></i> Ver
                            </a> 
                            <button onclick="deleteVideo(${v.id}, '${v.filename}')" 
                                    style="background-color: #dc3545; color: white; border: none; padding: 6px 12px; cursor: pointer; border-radius: 4px; font-size: 13px; font-weight: bold; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                <i class="fas fa-trash"></i> Excluir
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

        tbody.innerHTML = htmlBuffer;

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

// --- VÍDEOS DO CLIENTE (LEVE E PREPARADO PARA MP4 🎬) ---
async function loadClientVideos() {
    const grid = document.getElementById('client-video-grid');
    if(!grid) return; 
    
    grid.innerHTML = '<p style="text-align:center; width:100%;">Carregando seus vídeos...</p>';

    try {
        const res = await fetch('/api/videos/list');
        const list = await res.json();
        
        if(list.length === 0) {
            grid.innerHTML = '<p style="text-align:center; color:#666; width:100%; margin-top:20px;">Nenhum vídeo disponível no momento.</p>';
            return;
        }

        let htmlBuffer = '';
        let renderizados = 0;
        let totalValidos = 0;

        for (let i = 0; i < list.length; i++) {
            totalValidos++;

            if (renderizados >= clientVideoLimit) continue; // Trava de segurança para não explodir o celular do cliente

            const v = list[i];
            const dateStr = new Date(v.created_at).toLocaleDateString('pt-BR');
            const descSafe = (v.description || 'Sem descrição').replace(/"/g, '&quot;');
            
            // Verifica a extensão do arquivo (agora pode ser .mp4 ou .webm)
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

        // ADICIONA O BOTÃO "CARREGAR MAIS" NO FINAL DA GRADE
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
    boxSel.innerHTML = '<option value="">Carregando...</option>';
    boxSel.disabled = true;

    if(!clientId) return;

    // Precisamos de uma rota que filtre boxes. Vamos usar a existente e filtrar no JS por simplicidade
    // Idealmente: /api/boxes?client_id=X
    const res = await fetch('/api/boxes'); 
    const allBoxes = await res.json();
    
    // Filtra boxes do cliente
    const clientBoxes = allBoxes.filter(b => b.client_id == clientId);

    boxSel.innerHTML = '<option value="">Selecione o Box...</option>';
    clientBoxes.forEach(b => {
        // Guarda peso e descrição nos atributos para calcular preço
        const weight = b.order_weight || 0; // Pega o peso da encomenda vinculada
        const desc = b.products || `Box ${b.box_code}`;
        boxSel.innerHTML += `<option value="${b.id}" data-weight="${weight}" data-desc="${desc}">
            ${b.box_code} (${weight} Kg)
        </option>`;
    });
    boxSel.disabled = false;
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
// FUNÇÃO EXCLUSIVA DO PAINEL DO CLIENTE (COM MEMÓRIA PARA A CICÍ)
// ==========================================
async function loadClientInvoices() {
    const tbody = document.getElementById('client-invoices-list');
    if(!tbody) return; 

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Carregando...</td></tr>';

    try {
        const res = await fetch('/api/invoices/my_invoices'); 
        const list = await res.json();

        tbody.innerHTML = '';
        if(list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">Nenhuma fatura pendente.</td></tr>';
            return;
        }

        let faturasPendentes = 0; 

        list.forEach(inv => {
            let statusHtml = '';
            let actionHtml = '';

            let rawDesc = inv.box_code ? `Box ${inv.box_code}` : `Fatura #${inv.id}`;
            let safeDesc = rawDesc.replace(/'/g, "&#39;").replace(/"/g, "&quot;");

            if(inv.status === 'approved') {
                statusHtml = '<span style="color:green; font-weight:bold;">✅ PAGO</span>';
                actionHtml = '<span style="color:#ccc; font-size:12px;">Concluído</span>';
            } else if(inv.status === 'in_review') {
                statusHtml = '<span style="background-color:blue; color:white; padding:2px 5px; border-radius:4px; font-weight:bold;">👀 Em Análise</span>';
                actionHtml = '<span style="color:#ccc; font-size:12px;">Aguardando o Admin</span>';
            } else if(inv.status === 'pending') {
                faturasPendentes++; 
                statusHtml = '<span style="color:orange; font-weight:bold;">⏳ Pendente</span>';
                
                actionHtml = `
                <div style="display:flex; justify-content:center; gap:8px;">
                    <button class="btn-pisca" onclick="openPaymentModal('${inv.id}', '${safeDesc}', '${inv.amount}')" style="background:#00b1ea; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:12px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
                        💸 Pagar pelo Pix e Enviar o Comprovante 
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
                <td style="font-weight:bold; color:#0a1931;">R$ ${parseFloat(inv.amount).toFixed(2)}</td>
                <td>${statusHtml}</td>
                <td style="text-align:center;">${actionHtml}</td>
            </tr>`;
        });

        // 🧠 MEMÓRIA DA CICÍ: Só entra aqui se tiver fatura E se ELA AINDA NÃO AVISOU hoje
        if (faturasPendentes > 0 && !window.ciciJaAvisouFatura) {
            window.ciciJaAvisouFatura = true; // Grava na memória que ela já fez o trabalho!
            
            setTimeout(() => {
                showSection('billing-view');
                
                setTimeout(() => {
                    CiciTour.focarElemento('.btn-pisca', `🚨 Ei! Vi que você tem fatura pendente.<br><br>Clique no botão azul que a seta está apontando para abrir o seu PIX.`);
                    
                    document.getElementById('cici-overlay').onclick = () => CiciTour.limparFoco('.btn-pisca');
                }, 500);
            }, 8000); 
        }

    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Erro ao carregar faturas.</td></tr>';
    }
}
// ==========================================
// ABRIR MODAL DE PAGAMENTO (PIX MANUAL) - ATUALIZADO COM CICÍ
// ==========================================
function openPaymentModal(orderId, description, amount) {
    // 1. Mostra o modal na tela
    document.getElementById('modal-payment').style.display = 'block';

    // 2. Preenche os valores ocultos
    let valorNumerico = limparValor(amount);
    document.getElementById('pay-order-id').value = orderId;
    document.getElementById('pay-amount').value = valorNumerico; 

    // 3. Formata o texto bonito (Ex: Fatura #12 - R$ 50,00)
    let valorParaExibir = valorNumerico.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('pay-desc').innerText = `${description} - ${valorParaExibir}`;
    
    // 4. Limpa o input de arquivo (caso o cliente tenha aberto antes e fechado)
    const fileInput = document.getElementById('pix-file-input');
    if(fileInput) fileInput.value = '';
    
    // 5. Restaura o botão de enviar (caso tenha ficado travado em "Enviando...")
    const btnSubmit = document.getElementById('btn-submit-receipt');
    if(btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="fas fa-upload"></i> ENVIAR COMPROVANTE';
    }
    
    // 6. Abre sempre na aba padrão da Chave CNPJ
    togglePixKey('cnpj');

    // ✨ A MÁGICA DA CICÍ COMEÇA AQUI ✨
    // Espera meio segundo (500ms) para o modal abrir direitinho na tela e então aponta a seta
    setTimeout(() => {
        // Foca no campo de escolher o arquivo e dá a instrução exata
        CiciTour.focarElemento('#pix-file-input', `💸 <b>Passo 1:</b> Copie a chave acima e faça o PIX no seu banco.<br><br><b>Passo 2:</b> Tire um Print do comprovante.<br><br><b>Passo 3:</b> Clique aqui onde a seta aponta, selecione a foto do Print e depois clique em "Enviar Comprovante"!`);
        
        // Se o cliente clicar no campo para escolher a foto, a tela volta ao normal
        const inputArquivo = document.getElementById('pix-file-input');
        if (inputArquivo) {
            inputArquivo.onclick = () => CiciTour.limparFoco('#pix-file-input');
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
    
    // Reseta o botão de enviar
    const btnSubmit = document.getElementById('btn-submit-receipt');
    if(btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="fas fa-upload"></i> ENVIAR COMPROVANTE';
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
// ==========================================
// CICÍ COBRANDO DADOS DO RECEBEDOR (COM MEMÓRIA)
// ==========================================
async function checkMissingReceiverInfo(clientId) {
    if(!clientId) return;

    try {
        const res = await fetch('/api/boxes'); 
        const allBoxes = await res.json();
        const clientBoxes = allBoxes.filter(b => b.client_id == clientId);
        
        const missingInfoBoxes = clientBoxes.filter(b => !b.receiver_name || !b.ticket_number);
        
        // 🧠 MEMÓRIA DA CICÍ: Só entra se faltar dado E ela ainda não avisou
        if (missingInfoBoxes.length > 0 && !window.ciciJaAvisouBox) {
            window.ciciJaAvisouBox = true; // Grava na memória!
            
            setTimeout(() => {
                showSection('box-view'); 
                
                setTimeout(() => {
                    CiciTour.focarElemento('#box-table-body', `📦 Atenção! Você precisa me dizer quem vai retirar a sua encomenda lá em Bissau.<br><br>Olhe para onde a seta está apontando, clique em <b>"Informar Recebedor"</b> e preencha o Nome e o Número do Bilhete do seu familiar.`);
                    
                    document.getElementById('cici-overlay').onclick = () => CiciTour.limparFoco('#box-table-body');
                }, 500);

            }, 4000); 
        }
    } catch(err) {
        console.error("Erro ao verificar recebedores: ", err);
    }
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
// ==========================================
// CARREGAR LISTA PARA IMPRIMIR ETIQUETAS (OTIMIZADO 🚀)
// ==========================================
let labelsLimit = 50;

async function loadLabels() {
    if (currentUser.role === 'client') {
        alert("Acesso restrito.");
        showSection('orders-view');
        return;
    }

    const tbody = document.getElementById('labels-list');
    if(!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" align="center">Carregando etiquetas...</td></tr>';

    try {
        const [resOrders, resBoxes] = await Promise.all([
            fetch('/api/orders'),
            fetch('/api/boxes')
        ]);
        
        const orders = await resOrders.json();
        const boxes = await resBoxes.json();
        
        if ((!orders || orders.length === 0) && (!boxes || boxes.length === 0)) {
            tbody.innerHTML = '<tr><td colspan="6" align="center">Nenhuma etiqueta encontrada.</td></tr>';
            return;
        }

        boxes.sort((a, b) => {
            const boxA = a.box_code || '';
            const boxB = b.box_code || '';
            return boxA.localeCompare(boxB, undefined, {numeric: true, sensitivity: 'base'});
        });

        let htmlBuffer = '';
        let renderizados = 0;
        let totalValidos = 0;

        // PARTE 1: MOSTRAR AS CAIXAS (BOXES) PRIMEIRO
        for (let i = 0; i < boxes.length; i++) {
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
        tbody.innerHTML = '<tr><td colspan="6" align="center">Erro ao carregar dados. Tente novamente.</td></tr>';
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

    // ==========================================
    // NOVA MÁGICA: SALVA OS VOLUMES NO BANCO DE DADOS EM SILÊNCIO
    // ==========================================
    const itemType = box.value.startsWith('box-') ? 'box' : 'order';
    
    fetch('/api/update-volumes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: data.id, type: itemType, volumes: qtdVolumes })
    }).then(() => console.log("Volumes salvos no banco com sucesso!"))
      .catch(e => console.error("Erro ao salvar volumes:", e));
    // ==========================================

    let nomeEscolhido = `Etiqueta_${data.code}.pdf`;
    if (isMobile) {
        nomeEscolhido = prompt("Digite o nome para salvar o PDF da etiqueta:", `Etiqueta_${data.code}`);
        if (nomeEscolhido === null || nomeEscolhido.trim() === "") return; 
        if (!nomeEscolhido.toLowerCase().endsWith('.pdf')) nomeEscolhido += '.pdf';
    }

    alert("Gerando a Etiqueta... Por favor, aguarde.");

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [100, 151] });

    // ==========================================
    // 1. CARREGAR A LOGO NORMAL (logo.png)
    // ==========================================
    let logoData = null;
    try {
        const img = new Image();
        img.src = 'logo.png'; 
        img.crossOrigin = 'Anonymous';
        await new Promise((resolve) => {
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width; canvas.height = img.height;
                canvas.getContext('2d').drawImage(img, 0, 0);
                logoData = canvas.toDataURL('image/png');
                resolve();
            };
            img.onerror = resolve; 
        });
    } catch(e) {}

    // ==========================================
    // 2. CARREGAR O NOVO CARIMBO ROBUSTO (carimbo.png)
    // ==========================================
    let carimboData = null;
    try {
        const imgCarimbo = new Image();
        imgCarimbo.src = 'carimbo.png'; 
        imgCarimbo.crossOrigin = 'Anonymous';
        await new Promise((resolve) => {
            imgCarimbo.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = imgCarimbo.width; canvas.height = imgCarimbo.height;
                canvas.getContext('2d').drawImage(imgCarimbo, 0, 0);
                carimboData = canvas.toDataURL('image/png');
                resolve();
            };
            imgCarimbo.onerror = resolve; 
        });
    } catch(e) {}

    // Gera as páginas
    for (let i = 1; i <= qtdVolumes; i++) {
        if (i > 1) doc.addPage();

        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, 100, 151, 'F');

        // --- CABEÇALHO ---
        if (logoData) {
            doc.addImage(logoData, 'PNG', 5, 5, 18, 18); 
        }
        
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

        // --- CAIXA: DESTINATÁRIO ---
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

        // --- CAIXAS: CÓDIGO E PESO ---
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

        // --- CAIXA: CONTEÚDO / DESCRIÇÃO ---
        doc.roundedRect(5, 72, 90, 50, 2, 2, 'S');
        doc.setFontSize(8);
        doc.text("CONTEÚDO / DESCRIÇÃO", 7, 76);
        doc.line(7, 77, 40, 77);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        let descText = data.description || 'Nenhum conteúdo informado.';
        let splitDesc = doc.splitTextToSize(descText, 86);
        doc.text(splitDesc, 7, 82);

        // --- RODAPÉ (BOX, VOLUME E QR CODE) ---
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

        // ==========================================
        // 🛡️ SUPER FILTRO DO QR CODE (À PROVA DE ERROS)
        // ==========================================
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

        // ==========================================
        // 3. BATER O NOVO CARIMBO POR CIMA DE TUDO
        // ==========================================
        if (carimboData) {
            doc.saveGraphicsState(); 
            doc.setGState(new doc.GState({opacity: 0.85})); 
            doc.addImage(carimboData, 'PNG', 20, 45, 60, 60);
            doc.restoreGraphicsState();
        }
    } // Fim do loop de páginas

    if (isMobile) {
        doc.save(nomeEscolhido);
        alert(`✅ O arquivo "${nomeEscolhido}" foi baixado!\n\nAbra o aplicativo Print Label e vá em 'Impressão de PDF' para imprimir.`);
    } else {
        doc.autoPrint(); 
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = url;
        document.body.appendChild(iframe);
        
        iframe.onload = function() {
            setTimeout(function() {
                iframe.focus();
                iframe.contentWindow.print();
            }, 100);
        };
    }
}
// ============================================================
// LÓGICA DE RECIBOS PROFISSIONAIS (OTIMIZADA 🚀)
// ============================================================
let receiptsLimit = 50;

async function loadReceipts() {
    const list = document.getElementById('receipts-list');
    if (!list) return;

    list.innerHTML = '<tr><td colspan="6" align="center">Carregando recibos...</td></tr>';

    try {
        const response = await fetch('/api/boxes');
        let boxes = response.ok ? await response.json() : [];

        if (currentUser && currentUser.role === 'client') {
            boxes = boxes.filter(b => b.client_id === currentUser.id);
        }

        if (boxes.length === 0) {
            list.innerHTML = '<tr><td colspan="6" align="center">Nenhum recibo disponível.</td></tr>';
            return;
        }

        boxes.sort((a, b) => b.id - a.id);

        let htmlBuffer = '';
        let renderizados = 0;
        let totalValidos = 0;

        for (let i = 0; i < boxes.length; i++) {
            totalValidos++;
            
            if (renderizados >= receiptsLimit) continue; // Limite para não travar

            const box = boxes[i];
            const peso = parseFloat(box.order_weight || 0);
            const freteEstimado = peso * globalPricePerKg;
            const valorFrete = parseFloat(box.freight_amount) || parseFloat(box.amount) || freteEstimado;
            const valorNf = parseFloat(box.nf_amount) || 0;
            const valorTotalCalculado = valorFrete + valorNf;

            const valorReais = valorTotalCalculado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const produtos = box.products || '---';
            
            let clientCol = '';
            if (currentUser.role !== 'client') {
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

        list.innerHTML = htmlBuffer;
        
        const thClient = document.getElementById('rec-col-client');
        if(thClient && currentUser.role === 'client') thClient.style.display = 'none';

    } catch (err) {
        console.error(err);
        list.innerHTML = '<tr><td colspan="6">Erro ao carregar dados.</td></tr>';
    }
}

function loadMoreReceipts() {
    receiptsLimit += 50;
    loadReceipts();
}

// 5. GERAR RECIBO A4 (Com Nota Fiscal e Total Corrigido)
async function printReceipt(boxId) {
    const printArea = document.getElementById('print-area');
    
    try {
        const res = await fetch(`/api/receipt-data/${boxId}`); 
        const response = await res.json();
        
        if (!response.success) {
            return alert("Erro ao buscar dados do recibo: " + (response.msg || 'Erro desconhecido'));
        }

        const d = response.data;

        // MATEMÁTICA CORRIGIDA AQUI:
        const nfVal = parseFloat(d.nf_amount) || 0;
        const freteVal = parseFloat(d.freight_amount) || parseFloat(d.amount) || 0; 
        
        // Agora o total OBRIGATORIAMENTE soma o Frete + Nota Fiscal
        const totalVal = freteVal + nfVal;

        const valorFreteReais = freteVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const valorNfReais = nfVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const valorTotalReais = totalVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        const dataHoje = new Date().toLocaleDateString('pt-BR');
        const stampStatus = d.is_paid ? 'PAGO' : 'PENDENTE';
        const stampColor = d.is_paid ? '#13d841' : '#d40c0ce5';

        printArea.innerHTML = '';
        
        const receiptDiv = document.createElement('div');
        receiptDiv.className = 'receipt-a4-container'; 
        
        receiptDiv.innerHTML = `
            <style>
                @media print {
                    @page { margin: 5mm; }
                    html, body { height: 99%; overflow: hidden; }
                    .receipt-a4-container { page-break-after: avoid; page-break-inside: avoid; }
                    #print-area { page-break-after: avoid; }
                }
            </style>

            <div style="position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%) rotate(-15deg); 
                        font-size: 60px; font-weight: 900; color: ${stampColor}; opacity: 0.2; border: 5px solid ${stampColor}; padding: 10px 40px; text-transform:uppercase;">
                ${stampStatus}
            </div>

            <div class="rec-header">
                <div style="display:flex; align-items:center; gap:15px;">
                    <img src="/logo.png" style="width:70px; height:70px; object-fit:contain;">
                    
                    <div>
                        <h1 style="margin:0; font-size:22px; color:#0a1931;">GUINEEXPRESS</h1>
                        <p style="margin:0; font-size:10px; font-weight:bold;">AGENCIA DE LOGÍSTICA INTERNACIONAL</p>
                        <p style="margin:2px 0 0 0; font-size:10px;">CNPJ: 49.356.085/0001-34</p>
                    </div>
                </div>
                <div style="text-align:right; font-size:11px;">
                    <strong>Av. Tristão Gonçalves, 1203</strong><br>
                    Centro - Fortaleza / CE<br>
                    (85) 98239-207<br>
                    Comercialguineexpress245@gmail.com
                </div>
            </div>

            <div class="rec-title-bar">
                <span>RECIBO DE ENCOMENDA</span>
                <span>Box Nº ${d.box_code || '1'} | Ref: ${d.order_code || '-'}</span>
                <span>Emissão: ${dataHoje}</span>
            </div>

            <div class="rec-grid" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                
                <div class="rec-box">
                    <h3>DADOS DO CLIENTE</h3>
                    <div class="rec-line"><strong>Nome:</strong> ${d.client_name}</div>
                    <div class="rec-line"><strong>Telefone:</strong> ${d.phone || '-'}</div>
                    <div class="rec-line"><strong>Documento:</strong> ${d.document || '-'}</div>
                    <div class="rec-line"><strong>Email:</strong> ${d.email || '-'}</div>
                </div>

                <div class="rec-box">
                    <h3>DADOS DO ENVIO</h3>
                    <div class="rec-line"><strong>Destino:</strong> Guiné-Bissau</div>
                    <div class="rec-line"><strong>Ref. Encomenda:</strong> ${d.order_code || '-'}</div>
                    <div class="rec-line"><strong>Peso:</strong> ${d.weight} kg</div>
                    <div class="rec-line"><strong>Volumes (Qtd):</strong> ${d.volumes || '1'} volume(s)</div>
                    <div class="rec-line"><strong>Status:</strong> ${d.order_status || 'Processando'}</div>
                </div>

                <div class="rec-box">
                    <h3>RETIRADA EM GUINÉ-BISSAU</h3>
                    <div class="rec-line"><strong>Local:</strong> Rotunda de Nhonho</div>
                    <div class="rec-line"><strong>Bairro:</strong> Belem</div>
                    <div class="rec-line"><strong>Contato:</strong> +245 956604423</div>
                    <div class="rec-line" style="color: #d32f2f; background: #fff3cd; padding: 5px; margin-top: 8px; border-radius: 4px; border: 1px solid #ffe69c;">
                        <strong>AUTORIZADO A RETIRAR:</strong><br>
                        👤 Nome: ${d.receiver_name ? d.receiver_name : 'O Próprio Cliente'}<br>
                        📄 Bilhete: ${d.receiver_doc ? d.receiver_doc : '-'}
                    </div>
                </div>

            </div> 
            <table class="rec-table">
                <thead>
                    <tr>
                        <th>DESCRIÇÃO DOS SERVIÇOS</th>
                        <th style="width:100px; text-align:center;">PESO</th>
                        <th style="width:120px; text-align:right;">VALOR</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="border-bottom: 1px solid #eee; padding-bottom: 10px;">
                            <strong>Frete Aéreo/Marítimo Internacional</strong><br>
                            <small>Conteúdo: ${d.products || 'Diversos'}</small>
                        </td>
                        <td style="text-align:center; border-bottom: 1px solid #eee;">${d.weight} kg</td>
                        <td style="text-align:right; border-bottom: 1px solid #eee;">${valorFreteReais}</td>
                    </tr>
                    <tr>
                        <td style="padding-top: 10px;">
                            <strong>Taxa de Despacho / Nota Fiscal</strong><br>
                            <small>Impostos e taxas aduaneiras</small>
                        </td>
                        <td style="text-align:center;">-</td>
                        <td style="text-align:right;">${valorNfReais}</td>
                    </tr>
                    <tr>
                        <td colspan="2" style="text-align:right; font-weight:bold; padding-top:15px; font-size: 14px;">TOTAL A PAGAR:</td>
                        <td style="text-align:right; font-weight:bold; font-size:18px; padding-top:15px; color:#d32f2f;">${valorTotalReais}</td>
                    </tr>
                </tbody>
            </table>

            <div class="rec-footer-text">
                Declaro que os itens acima listados foram conferidos na minha presença. <br>
                A Guineexpress não se responsabiliza por itens não conferidos no local da retirada.
            </div>

            <div class="rec-signatures">
                <div class="rec-sign-line">GUINEEXPRESS LOGÍSTICA</div>
                <div class="rec-sign-line">ASSINATURA DO CLIENTE</div>
            </div>
        `;

        printArea.appendChild(receiptDiv);
        setTimeout(() => { window.print(); }, 500);

    } catch (e) {
        console.error(e);
        alert("Erro ao gerar recibo: " + e.message);
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
        document.getElementById('order-code').value = order.code;
        document.getElementById('order-desc').value = order.description;
        document.getElementById('order-weight').value = order.weight;
        document.getElementById('order-status').value = order.status;
        document.getElementById('order-client-select').value = order.client_id;

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

async function handleOrderSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('editing-order-id').value;

    // Bloqueia botão para evitar duplo clique
    const btn = e.target.querySelector('button[type="submit"]');
    const txtOriginal = btn.innerText;
    btn.disabled = true;
    btn.innerText = "Salvando...";

    try {
        if (id) {
            await updateOrder(id); // Edição
        } else {
            // Verifica se a função createOrder existe antes de chamar
            if(typeof createOrder === 'function') await createOrder(); 
        }
    } finally {
        btn.disabled = false;
        btn.innerText = txtOriginal;
    }
}

// --- FUNÇÃO AUXILIAR: ATUALIZAR ENCOMENDA (PUT) ---
async function updateOrder(id) {
    const data = {
        client_id: document.getElementById('order-client-select').value,
        code: document.getElementById('order-code').value,
        description: document.getElementById('order-desc').value,
        weight: document.getElementById('order-weight').value,
        status: document.getElementById('order-status').value
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
function printLabel(code, name, weight, desc) {
    const printWindow = window.open('', '', 'width=400,height=600');
    printWindow.document.write(`
        <html>
        <body style="text-align:center; font-family:Arial;">
            <div style="border:2px solid #000; padding:20px; margin:10px;">
                <h1>GUINEEXPRESS</h1>
                <h2 style="font-size:40px; margin:10px 0;">${code}</h2>
                <div id="qrcode" style="display:flex; justify-content:center; margin:20px 0;"></div>
                <h3>${name}</h3>
                <p>${desc} - ${weight}kg</p>
                <p style="font-size:10px;">${new Date().toLocaleDateString()}</p>
            </div>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
            <script>
                new QRCode(document.getElementById("qrcode"), {
                    text: "${code}|${name}", // O Scanner lê isso aqui
                    width: 150,
                    height: 150
                });
                setTimeout(() => { window.print(); window.close(); }, 1000);
            </script>
        </body>
        </html>
    `);
}
// --- FUNÇÃO PARA GERAR A TIMELINE VISUAL ---
function getTimelineHTML(status) {
    // Ordem dos status
    const steps = ['Recebido', 'Em Trânsito', 'Chegou GB', 'Entregue'];
    
    // Normaliza o status atual (caso venha diferente)
    let currentStepIndex = 0;
    if (status.includes('Recebido') || status.includes('Triagem')) currentStepIndex = 0;
    if (status.includes('Trânsito') || status.includes('Voo')) currentStepIndex = 1;
    if (status.includes('Chegou') || status.includes('Armazém') || status.includes('Disponível')) currentStepIndex = 2;
    if (status.includes('Entregue') || status.includes('Retirado')) currentStepIndex = 3;

    // Calcula porcentagem da barra verde
    const progressPercent = (currentStepIndex / (steps.length - 1)) * 100;

    let html = `
        <div class="timeline-container">
            <div class="timeline-progress" style="width: ${progressPercent}%"></div>
    `;

    // Ícones para cada etapa
    const icons = ['📥', '✈️', '🏢', '✅'];

    steps.forEach((step, index) => {
        const isActive = index <= currentStepIndex ? 'active' : '';
        html += `
            <div class="timeline-step ${isActive}">
                ${isActive ? icons[index] : ''} <span class="timeline-label">${step}</span>
            </div>
        `;
    });

    html += `</div>`;
    return html;
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
        // ATENÇÃO: Mudei a rota para '/api/admin/broadcast-zap' (se você for usar aquela que criamos antes)
        // Se você atualizou a sua rota antiga mesmo, pode manter '/api/admin/broadcast'
        const res = await fetch('/api/admin/broadcast-zap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // NOVO: Enviando a variável sendZap para o backend saber se deve acionar o robô do WhatsApp
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
// ABA FINANCEIRO (TURBINADA 🚀)
// ==========================================
let financesLimit = 50;

async function loadFinances() {
    try {
        const res = await fetch('/api/finances/all');
        const finances = await res.json();
        const tbody = document.getElementById('finances-list');
        
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Carregando financeiro...</td></tr>';

        const toggleBtn = document.getElementById('toggle-finances');
        const showCompleted = toggleBtn ? toggleBtn.checked : false;

        if (finances.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Nenhum registro encontrado.</td></tr>`;
            return;
        }

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

            if (statusPt === 'Pago' && !showCompleted) continue;

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
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Nenhum registro pendente para exibir.</td></tr>`;
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

// NO SEU SCRIPT.JS (Frontend)
async function registerPush() {
    if (!('serviceWorker' in navigator)) return;

    try {
        const register = await navigator.serviceWorker.register('/sw.js');
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

            const publicVapidKey = 'BA_H_d0E7KaJSgex51WxeAchwC9XI6graWVeazPjv2o_CWgi93iQ0ckagGQeSOcZcndzhrHC0jWNIuFIGQJ3BdY';
            const convertedKey = urlBase64ToUint8Array(publicVapidKey);

            const subscription = await register.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedKey
            });

            await fetch('/api/notifications/subscribe', {
                method: 'POST',
                body: JSON.stringify(subscription),
                headers: { 'Content-Type': 'application/json' },
                // ADICIONEI ESTA LINHA ABAIXO:
                credentials: 'same-origin' 
            });
            console.log("Push ativado com sucesso!");
        }
    } catch (e) {
        console.error("Erro no processo de push:", e);
    }
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
/* ==========================================
   SISTEMA DE INSTALAÇÃO DO APLICATIVO (PWA)
========================================== */
let deferredPrompt;

// 1. O navegador avisa que o App está pronto para instalar
window.addEventListener('beforeinstallprompt', (e) => {
    // Impede o aviso padrão (chato) do Google Chrome
    e.preventDefault();
    // Salva o evento para usarmos quando o cliente clicar no botão
    deferredPrompt = e;
    
    // Mostra o nosso banner bonitão
    const installBanner = document.getElementById('install-banner');
    if (installBanner) {
        installBanner.style.display = 'flex';
    }
});

// 2. O que acontece quando o cliente clica em "Instalar"
async function installPWA() {
    if (deferredPrompt) {
        // Mostra a tela oficial de instalação do Android/iOS
        deferredPrompt.prompt();
        
        // Espera o cliente dizer "Sim" ou "Não"
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            console.log('Cliente instalou o App!');
        }
        
        // Limpa a memória e esconde o banner
        deferredPrompt = null;
        hideInstallBanner();
    }
}

// 3. O que acontece se ele clicar em "Agora não"
function hideInstallBanner() {
    const installBanner = document.getElementById('install-banner');
    if (installBanner) {
        installBanner.style.display = 'none';
    }
}
async function registerNotificationSystem() {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
            const swReg = await navigator.serviceWorker.ready;
            const permission = await Notification.requestPermission();
            
            if (permission === 'granted') {
                // SUA CHAVE PÚBLICA QUE ESTÁ NO .ENV
                const publicKey = 'BA_H_d0E7KaJSgex51WxeAchwC9XI6graWVeazPjv2o_CWgi93iQ0ckagGQeSOcZcndzhrHC0jWNIuFIGQJ3BdY';
                
                let subscription = await swReg.pushManager.getSubscription();

                if (!subscription) {
                    subscription = await swReg.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: publicKey
                    });
                }

                // Salva no seu banco de dados
                await fetch('/api/notifications/subscribe', {
                    method: 'POST',
                    body: JSON.stringify(subscription),
                    headers: { 'Content-Type': 'application/json' }
                });
                console.log("✅ Dispositivo pronto para notificações!");
            }
        } catch (e) {
            console.error("Erro ao registrar notificações:", e);
        }
    }
}

// Rodar ao carregar a página
document.addEventListener('DOMContentLoaded', registerNotificationSystem);

// Chama a função assim que o site carregar
document.addEventListener('DOMContentLoaded', registerNotificationSystem);
async function subscribeUser() {
    if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        
        // Verifica se já tem permissão
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        // Cria a assinatura para enviar ao seu banco de dados
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: 'SUA_CHAVE_VAPID_PUBLICA_AQUI'
        });

        // ENVIA PARA O SERVIDOR SALVAR
        await fetch('/api/notifications/subscribe', {
            method: 'POST',
            body: JSON.stringify(subscription),
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
// ==========================================
// FUNÇÃO EXCLUSIVA DO PAINEL DO ADMINISTRADOR
// ==========================================
async function loadInvoices() {
    const tbody = document.getElementById('invoices-list');
    if(!tbody) return;

    try {
        const res = await fetch('/api/invoices/list');
        const list = await res.json();

        tbody.innerHTML = '';
        
        list.forEach(inv => {
            let statusHtml = '';
            if(inv.status === 'approved' || inv.status === 'paid') statusHtml = '<span style="color:green; font-weight:bold;">✅ PAGO</span>';
            else if(inv.status === 'in_review') statusHtml = '<span style="background-color:blue; color:white; padding:2px 5px; border-radius:4px; font-weight:bold;">👀 Em Análise</span>';
            else if(inv.status === 'pending') statusHtml = '<span style="color:orange; font-weight:bold;">⏳ Pendente</span>';
            else statusHtml = '<span style="color:red;">Cancelado</span>';

            let deleteBtn = '';
            let actionButtons = '';

            // BOTÕES DO ADMIN
            if(currentUser && currentUser.role === 'admin') {
                deleteBtn = `<button onclick="deleteInvoice(${inv.id})" style="color:red; background:none; border:none; cursor:pointer; margin-left:10px;" title="Excluir"><i class="fas fa-trash"></i></button>`;
                
                if (inv.status === 'pending') {
                    // NOVO: Botão de Baixa Manual quando está pendente
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
                actionButtons = '-'; // Funcionários comuns não aprovam
            }

            const refCode = inv.order_code || inv.raw_order || inv.box_code || 'Sem Ref.';

            if (currentUser && currentUser.role === 'admin') {
                tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="font-weight:bold; color:#0a1931; padding:12px;">${refCode}</td>
                    <td>${inv.client_name}</td>
                    <td>${inv.box_code || '-'}</td>
                    <td style="font-weight:bold;">R$ ${inv.amount}</td> 
                    <td>${statusHtml}</td>
                    <td><div style="display:flex; gap:5px; align-items:center;">${actionButtons} ${deleteBtn}</div></td>
                </tr>`;
            } else {
                // Tabela para funcionário comum ver (AGORA COM O VALOR)
                tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="font-weight:bold; color:#0a1931; padding:12px;">${refCode}</td>
                    <td>${inv.client_name}</td>
                    <td>${inv.box_code || '-'}</td>
                    <td style="font-weight:bold;">R$ ${inv.amount}</td> 
                    <td>${statusHtml}</td>
                    <td>-</td>
                </tr>`;
            }
        });
    } catch (err) {
        console.error("Erro ao carregar faturas:", err);
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
            html2canvas:  { scale: 2 },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
        };

        // Manda baixar automaticamente e depois volta o botão ao normal
        html2pdf().set(opt).from(divTemp).save().then(() => {
            btn.innerHTML = textoOriginal;
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

const truck = document.getElementById("truck");
const gameContainer = document.getElementById("game-container");
const scoreElement = document.getElementById("score");
const modalJogo = document.getElementById("modal-jogo");
let score = 0;
let isGameOver = false;

// Abrir e Fechar o Jogo (CORRIGIDO)
const btnAbrirJogo = document.getElementById("btn-abrir-jogo");
const btnFecharJogo = document.getElementById("fechar-jogo");

if (btnAbrirJogo) {
    btnAbrirJogo.onclick = () => { 
        modalJogo.style.display = 'flex'; 
        resetJogo(); 
    };
}

if (btnFecharJogo) {
    btnFecharJogo.onclick = () => { 
        modalJogo.style.display = 'none'; 
        isGameOver = true; 
    };
}

// Função de Saltar
function jump() {
    if (truck && !truck.classList.contains("animate-jump")) {
        truck.classList.add("animate-jump");
        setTimeout(() => truck.classList.remove("animate-jump"), 500);
    }
}

// Detetar clique/toque para saltar (CORRIGIDO)
if (gameContainer) {
    gameContainer.addEventListener("mousedown", jump);
    gameContainer.addEventListener("touchstart", (e) => { e.preventDefault(); jump(); });
}

// Detetar clique/toque para saltar
gameContainer.addEventListener("mousedown", jump);
gameContainer.addEventListener("touchstart", (e) => { e.preventDefault(); jump(); });

// Criar Obstáculos (Caixas)
function createObstacle() {
    if (isGameOver) return;

    const obstacle = document.createElement("div");
    obstacle.classList.add("box-obstacle");
    obstacle.innerHTML = "📦";
    gameContainer.appendChild(obstacle);

    let obstaclePosition = 400; // Começa fora da tela à direita
    let randomSpeed = 3 + Math.random() * 5; // Velocidade aleatória

    let timer = setInterval(() => {
        // Colisão
        let truckTop = parseInt(window.getComputedStyle(truck).getPropertyValue("bottom"));
        
        if (obstaclePosition > 20 && obstaclePosition < 60 && truckTop < 30) {
            clearInterval(timer);
            isGameOver = true;
            document.getElementById("game-over-text").style.display = "block";
            return;
        }

        obstaclePosition -= randomSpeed;
        obstacle.style.left = obstaclePosition + "px";

        if (obstaclePosition < -50) {
            clearInterval(timer);
            gameContainer.removeChild(obstacle);
            
            if (!isGameOver) {
                score++;
                scoreElement.innerHTML = "Pontos: " + score;

                // --- VERIFICAÇÃO DE RECORDE ---
                // Se chegar exatamente a 50, dispara o prémio!
                if (score === 50) {
                    ganhouPremioJogo();
                }
            }
        }
    }, 20);

    // Cria a próxima caixa num tempo aleatório
    if (!isGameOver) setTimeout(createObstacle, 1500 + Math.random() * 2000);
}

function resetJogo() {
    isGameOver = false;
    score = 0;
    scoreElement.innerHTML = "Pontos: 0";
    document.getElementById("game-over-text").style.display = "none";
    // Limpar caixas antigas
    document.querySelectorAll('.box-obstacle').forEach(box => box.remove());
    createObstacle();
}
function ganhouPremioJogo() {
    // 💥 Confettis de Elite!
    if (typeof confetti === "function") {
        confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 } });
    }

    // Avisa a Cici para gritar a vitória
    if (typeof ciciAvisa === "function") {
        ciciAvisa("INCRÍVEL! Chegou aos 50 pontos e ganhou 5 Pontos Express! 🏆", "sucesso");
    }

    // Guarda no Banco de Dados
    fetch('/api/save-game-points', { method: 'POST' })
    .then(res => res.json())
    .then(() => console.log("Prémio do jogo guardado!"))
    .catch(err => console.error("Erro ao guardar pontos do jogo"));
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

// Disparar a atualização para o servidor
async function applyBulkStatus() {
    const checkboxes = document.querySelectorAll('.order-checkbox:checked');
    const newStatus = document.getElementById('bulk-status-select').value;
    
    if (checkboxes.length === 0) return alert("Selecione pelo menos uma encomenda.");
    if (!newStatus) return alert("Selecione o novo status que deseja aplicar.");
    
    if (!confirm(`Tem certeza que deseja alterar o status de ${checkboxes.length} encomendas para "${newStatus}"?`)) return;

    // Pega os IDs selecionados
    const orderIds = Array.from(checkboxes).map(cb => cb.value);

    try {
        const response = await fetch('/api/orders/bulk-status', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: orderIds, status: newStatus })
        });

        const data = await response.json();
        if (data.success) {
            alert(`✅ ${data.updated} encomendas atualizadas com sucesso!`);
            
            // Reseta a interface
            document.getElementById('selectAllOrders').checked = false;
            document.getElementById('bulk-status-select').value = "";
            document.getElementById('bulk-action-container').style.display = 'none';
            
            // Recarrega a tabela
            loadOrders(); 
        } else {
            alert("Erro: " + data.message);
        }
    } catch (error) {
        console.error(error);
        alert("Erro de conexão ao tentar atualizar em massa.");
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
    navigator.clipboard.writeText(chave);
    alert("Chave PIX copiada! Agora pague no seu banco e volte para enviar o comprovante.");
}

// ==========================================
// CLIENTE ENVIA COMPROVANTE PIX
// ==========================================
async function submitPixReceipt() {
    const orderId = document.getElementById('pay-order-id').value;
    const fileInput = document.getElementById('pix-file-input');
    const btn = document.getElementById('btn-submit-receipt');

    if (!fileInput.files[0]) {
        return alert("Por favor, selecione a foto do comprovante antes de enviar.");
    }

    const formData = new FormData();
    formData.append('receipt', fileInput.files[0]);

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

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
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-upload"></i> ENVIAR COMPROVANTE';
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
// 1. ABA DE ENTREGAS INTELIGENTE
// ==========================================
async function loadDeliveryList() {
    try {
        const response = await fetch('/api/orders'); 
        const orders = await response.json();
        const list = document.getElementById('delivery-list');
        list.innerHTML = '';

        // Verifica se o usuário quer ver o histórico (se o botão não existir, esconde por padrão)
        const toggleBtn = document.getElementById('toggle-deliveries');
        const showCompleted = toggleBtn ? toggleBtn.checked : false;

        orders.forEach(order => {
            const isDelivered = order.status === 'Entregue';
            
            // A MÁGICA AQUI: Se for entregue e o botão não estiver marcado, pula e oculta!
            if (isDelivered && !showCompleted) return;

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
        const res = await fetch('/api/invoices/list');
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

        const tbody = document.getElementById('manifest-list');
        tbody.innerHTML = '';

        let itemMap = {};

        // Lógica inteligente para separar quantidades e nomes
        json.data.forEach(row => {
            // Agora ele lê a coluna 'items' que vem da nova rota do servidor
            if (!row.items) return; 
            
            // Separa os itens por vírgula ou por linha (Enter)
            let itemsArray = row.items.split(/,|\n/);
            
            itemsArray.forEach(item => {
                let cleanItem = item.trim();
                if (!cleanItem) return;

                // Tenta achar um número no começo (Ex: "20 Calcinhas") ou no fim (Ex: "Calcinhas 20")
                let match = cleanItem.match(/^(\d+)\s*(.*)$/) || cleanItem.match(/^(.*)\s+(\d+)$/);
                
                let qtd = 1; // Se não tiver número, assume que é 1
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

                // Padroniza o nome para maiúsculo para somar iguais (ex: havaianas = HAVAIANAS)
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
        let keys = Object.keys(itemMap).sort(); // Ordem alfabética
        
        if(keys.length === 0) {
            tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">Nenhum produto encontrado nas encomendas/boxes ativas.</td></tr>';
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

        // Adiciona a linha de TOTAL no final
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

// COLOQUE APENAS ISSO:
// --- NOVO BOTÃO DE BAIXAR EXCEL INTELIGENTE ---
function exportManifestExcel() {
    // Redireciona para a nossa nova rota inteligente do backend!
    window.location.href = '/api/export/smart-excel';
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