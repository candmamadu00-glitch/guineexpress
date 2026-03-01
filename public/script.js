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

// --- SISTEMA DE ENCOMENDAS E CAIXAS ---
async function loadBoxes() {
    const res = await fetch('/api/boxes');
    let list = await res.json(); // Mudei de const para let para podermos ordenar
    const tbody = document.getElementById('box-table-body');
    
    if(tbody) {
        tbody.innerHTML = '';

        // MÁGICA DE ORDENAÇÃO: Organiza do menor para o maior (Box 1, Box 2, Box 3...)
        list.sort((a, b) => {
            const boxA = a.box_code || '';
            const boxB = b.box_code || '';
            // localeCompare com 'numeric: true' faz a ordenação inteligente de números
            return boxA.localeCompare(boxB, undefined, {numeric: true, sensitivity: 'base'});
        });

        list.forEach(b => {
            const act = (currentUser.role !== 'client') ? 
                `<button onclick="deleteBox(${b.id})" style="color:white; background:red; border:none; padding:5px 10px; cursor:pointer; border-radius:3px;">Excluir</button>` : '-';
            
            const weight = parseFloat(b.order_weight) || 0;
            const totalValue = (weight * globalPricePerKg).toFixed(2);

            tbody.innerHTML += `
            <tr>
                <td style="font-weight:bold; color:#0a1931;">${b.box_code}</td>
                <td>${b.client_name || '-'}</td>
                <td>${b.order_code || '-'}</td>
                <td>${weight} Kg</td>
                <td style="font-weight:bold; color:green;">${totalValue}</td> 
                <td>${b.products || '-'}</td>
                <td>${act}</td>
            </tr>`; 
        });
        makeTablesResponsive();
    }
}
// ==========================================
// FUNÇÃO QUE FALTAVA: CRIAR ENCOMENDA
// ==========================================
async function createOrder() {
    // 1. Pega os dados do formulário
    const clientId = document.getElementById('order-client-select').value;
    const code = document.getElementById('order-code').value;
    const desc = document.getElementById('order-desc').value;
    const weight = document.getElementById('order-weight').value;
    const status = document.getElementById('order-status').value;

    // 2. Validação simples
    if (!clientId || !code || !weight) {
        return alert("Preencha Cliente, Código e Peso!");
    }

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
            closeModal('modal-order');
            
            // 5. Atualiza a lista na tela
            loadOrders();
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
    const codeVal = codeEl.value;
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
    const slots15min = await resSlots.json();
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
        const bookedDates = appointments.filter(app => app.status !== 'Cancelado').map(app => app.date);
        const groups = {};
        slots15min.forEach(slot => { if(!groups[slot.date]) groups[slot.date] = []; groups[slot.date].push(slot); });

        if(Object.keys(groups).length === 0) container.innerHTML = '<p style="text-align:center; color:#666;">Sem horários disponíveis.</p>';

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

    const tbody = document.getElementById('client-schedule-list');
    if(tbody) {
        tbody.innerHTML = '';
        appointments.forEach(app => {
            const canCancel = app.status !== 'Cancelado' && app.status !== 'Recusado';
            const btn = canCancel ? `<button onclick="cancelBooking(${app.id})" style="color:red; border:1px solid red; background:white; padding:2px 5px; cursor:pointer;">Cancelar</button>` : '-';
            tbody.innerHTML += `<tr><td>${formatDate(app.date)}</td><td>${app.time_slot}</td><td>${app.status}</td><td>${btn}</td></tr>`;
        });
        // Mobile schedule fix could go here if table used
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

function renderAdminSchedule(appointments) {
    const tbody = document.getElementById('admin-schedule-list');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    appointments.forEach(app => {
        // Escolhe uma cor bonitinha para o status (opcional)
        let badgeClass = 'bg-success'; // Padrão Verde (Aprovado/Automático)
        if (app.status === 'Pendente') badgeClass = 'bg-warning'; // Amarelo se ainda estiver processando
        if (app.status === 'Recusado' || app.status === 'Cancelado') badgeClass = 'bg-danger';

        // Cria a linha com EXATAS 5 colunas para bater com o HTML perfeito
        tbody.innerHTML += `
            <tr>
                <td data-label="Data">${formatDate(app.date)}</td>
                <td data-label="Horário">${app.time_slot}</td>
                <td data-label="Cliente" style="font-weight: bold;">${app.client_name}</td>
                <td data-label="Tel">${app.client_phone || '-'}</td>
                <td data-label="Status">
                    <span class="badge ${badgeClass}">${app.status}</span>
                </td>
            </tr>
        `;
    });
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

async function loadClients() { 
    try {
        const res = await fetch('/api/clients'); 
        const list = await res.json(); 
        
        // Preenche os Selects (ex: na hora de criar encomenda)
        const selects = [
            document.getElementById('order-client-select'),
            document.getElementById('box-client-select')
        ];

        selects.forEach(sel => {
            if(sel) {
                sel.innerHTML = '<option value="">Selecione o Cliente...</option>'; 
                list.forEach(c => {
                    if(c.name) {
                        sel.innerHTML += `<option value="${c.id}">${c.name} | ${c.email || 'Sem email'}</option>`; 
                    }
                });
            }
        });

        // Preenche a Tabela da Aba "Clientes"
        const tbody = document.getElementById('clients-list'); 
        if(tbody) {
            tbody.innerHTML = ''; 
            
            list.forEach(c => { 
                if(!c.name) return; 

                // Botão Ativar/Desativar
                let actionBtn = '';
                if (currentUser && currentUser.role === 'admin') {
                    const btnColor = c.active ? '#dc3545' : '#28a745';
                    const btnText = c.active ? 'Desativar' : 'Ativar';
                    actionBtn = `<button onclick="toggleClient(${c.id},${c.active?0:1})" style="color:white; background:${btnColor}; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">${btnText}</button>`;
                } else {
                    actionBtn = '<span style="color:#999; font-size:12px;">🔒 Restrito</span>';
                }

                // Status Badge
                const statusBadge = c.active 
                    ? '<span style="background:#d4edda; color:#155724; padding:2px 8px; border-radius:10px; font-size:12px; font-weight:bold;">Ativo</span>' 
                    : '<span style="background:#f8d7da; color:#721c24; padding:2px 8px; border-radius:10px; font-size:12px; font-weight:bold;">Inativo</span>';

                // --- CORREÇÃO AQUI (profile_pic em vez de photo) ---
                let imgUrl = '';
                if (c.profile_pic && c.profile_pic !== 'default.png') {
                    // Verifica se já é um link completo (ex: Google) ou se é arquivo nosso
                    if (c.profile_pic.startsWith('http')) {
                        imgUrl = c.profile_pic;
                    } else {
                        imgUrl = '/uploads/' + c.profile_pic;
                    }
                } else {
                    // Avatar genérico com iniciais
                    imgUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=random&color=fff&size=64`;
                }

                const photoHtml = `<img src="${imgUrl}" 
                    onerror="this.src='https://ui-avatars.com/api/?name=User&background=ccc'" 
                    style="width:32px; height:32px; border-radius:50%; object-fit:cover; border:1px solid #ddd;">`;
                // ----------------------------------------------------

                tbody.innerHTML += `
                    <tr style="border-bottom: 1px solid #eee; text-align: center;">
                        <td style="padding:10px;">${photoHtml}</td>  
                        <td style="text-align:left; font-weight:bold;">${c.name}</td> 
                        <td>${c.email || '-'}</td> 
                        <td>${c.phone || '-'}</td> 
                        <td>${c.country || 'BR'}</td> 
                        <td>${statusBadge}</td> 
                        <td>${actionBtn}</td> 
                    </tr>`; 
            }); 
            
            if(typeof makeTablesResponsive === 'function') makeTablesResponsive();
        }
    } catch (error) {
        console.error("Erro ao carregar clientes:", error);
    }
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
// 2. FUNÇÃO LOAD ORDERS ATUALIZADA (COM BOTÃO DE AVARIA)
// ==============================================================
async function loadOrders() {
    if (!currentUser) return; 

    try {
        const res = await fetch('/api/orders');
        const list = await res.json();
        // --- 🔴 ADICIONE ESTE BLOCO AQUI (CORREÇÃO) 🔴 ---
        // Isso força o contador do início a mostrar o número real de linhas da tabela
        const dashCount = document.getElementById('dash-orders-count');
        if (dashCount) {
            dashCount.innerText = list.length; // Se a lista for vazia (0), mostra 0
        }
        // Tenta pegar o tbody correto dependendo da tela
        const tbody = document.getElementById('orders-list') || 
                      document.getElementById('client-orders-list') || 
                      document.querySelector('.data-table tbody');
        
        if(tbody) {
            tbody.innerHTML = '';
            
            if(list.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;">Nenhuma encomenda encontrada.</td></tr>';
                return;
            }

            list.forEach(o => {
                const phone = o.client_phone || o.phone || o.whatsapp || ''; 
                const email = o.client_email || o.email || o.mail || ''; 
                const name = o.client_name || o.name || 'Cliente';
                const price = o.price || 0; 

                // --- 1. STATUS (VISUAL OU DROPDOWN) ---
                let statusDisplay;

                if (currentUser.role === 'client') {
                    // CLIENTE: Vê a Timeline Visual Bonita
                    statusDisplay = getTimelineHTML(o.status);
                } else {
                    // ADMIN/FUNC: Vê o Dropdown para editar rápido
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
                    // --- ADMIN / FUNCIONÁRIO ---
                    const whatsappColor = phone ? '#25D366' : '#ccc';
                    const emailColor = email ? '#007bff' : '#ccc';

                    actions = `<div style="display:flex; gap:5px; justify-content:center;">`;

                    // WhatsApp
                    actions += `
                        <button onclick="sendNotification('whatsapp', '${phone}', '${name}', '${o.code}', '${o.status}')" 
                                title="Enviar WhatsApp"
                                style="background:${whatsappColor}; color:white; border:none; width:30px; height:30px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                            <i class="fab fa-whatsapp"></i>
                        </button>`;
                    
                    // Email
                    actions += `
                        <button onclick="sendNotification('email', '${email}', '${name}', '${o.code}', '${o.status}')" 
                                title="Enviar Email"
                                style="background:${emailColor}; color:white; border:none; width:30px; height:30px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                            <i class="far fa-envelope"></i>
                        </button>`;

                    // Editar
                    actions += `
                        <button onclick="editOrder(${o.id})" 
                                title="Editar"
                                style="background:#ffc107; color:white; border:none; width:30px; height:30px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                            <i class="fas fa-edit"></i>
                        </button>`;

                    // Excluir
                    actions += `
                        <button onclick="deleteOrder(${o.id})" 
                                title="Excluir"
                                style="background:#dc3545; color:white; border:none; width:30px; height:30px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                            <i class="fas fa-trash"></i>
                        </button>`;

                    // --- [NOVO] BOTÃO DE AVARIA ---
                    actions += `
                        <button onclick="DeliveryProof.start(${o.id}, 'damage')" 
                                title="Relatar Avaria/Dano"
                                style="background:#dc3545; color:white; border:none; width:30px; height:30px; border-radius:50%; margin-left:5px; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                            <i class="fas fa-exclamation-triangle"></i>
                        </button>`;
                    // -----------------------------

                    // Ver Foto (Se existir)
                    if (o.delivery_proof) {
                        actions += `
                        <button onclick='DeliveryProof.view("${o.delivery_proof}")' 
                                title="Ver Comprovante/Foto"
                                style="background:#6f42c1; color:white; border:none; width:30px; height:30px; border-radius:50%; margin-left:5px; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                            <i class="fas fa-camera"></i>
                        </button>`;
                    }
                    
                    // Imprimir Etiqueta
                    actions += `
                    <button onclick="printLabel('${o.code}', '${name}', '${o.weight}', '${o.description}')" 
                            title="Imprimir Etiqueta"
                            style="background:#6c757d; color:white; border:none; width:30px; height:30px; border-radius:50%; margin-left:5px; cursor:pointer;">
                        <i class="fas fa-print"></i>
                    </button>`;
                
                    actions += `</div>`;

                } else {
                    // --- CLIENTE ---
                    if (o.status === 'Pendente Pagamento' || o.status === 'Pendente') {
                        actions = `
                        <button onclick="openPaymentModal(${o.id}, '${o.description}', ${price})" 
                            class="btn-pay-pulse"
                            style="background:#28a745; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-weight:bold; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
                            <i class="fas fa-dollar-sign"></i> PAGAR
                        </button>`;
                    } 
                    else if (o.status === 'Pago') {
                        actions = `<span style="color:green; font-weight:bold;"><i class="fas fa-check-circle"></i> Pago</span>`;
                    } 
                    // Cliente vê foto se entregue OU se tiver avaria
                    else if ((o.status === 'Entregue' || o.status === 'Avaria') && o.delivery_proof) {
                        actions = `<button onclick='DeliveryProof.view("${o.delivery_proof}")' style="color:#6f42c1; border:1px solid #6f42c1; background:none; padding:4px 10px; border-radius:4px; cursor:pointer;">Ver Foto 📸</button>`;
                    }
                    else {
                        actions = `<button onclick="alert('Detalhes: ${o.description} | Valor: R$ ${price}')" style="padding:5px 10px; border:1px solid #ddd; background:#fff; cursor:pointer; border-radius:4px;">Detalhes</button>`;
                    }
                }
                
                // --- RENDERIZAÇÃO DA LINHA ---
tbody.innerHTML += `
    <tr style="border-bottom: 1px solid #eee;">
        <td style="text-align: center;">
            <input type="checkbox" class="order-checkbox" value="${o.id}" onclick="updateBulkCounter()">
        </td>
        <td style="padding:12px;"><strong>${o.code}</strong></td>
        <td>${name}</td>
        <td>${o.description||'-'}</td>
        <td>${o.weight} Kg</td>
        <td>R$ ${parseFloat(price).toFixed(2)}</td> 
        <td style="min-width: 250px;">${statusDisplay}</td>
        <td>${actions}</td>
    </tr>`; 
            });
            
            if(typeof makeTablesResponsive === 'function') makeTablesResponsive();
        }
        // SE FOR CLIENTE, ATUALIZA O SININHO
        if (currentUser.role === 'client') {
            updateClientNotifications(list);
        }
    } catch (error) {
        console.error("Erro ao carregar encomendas:", error);
    }
}
function toggleOrderForm() { const f = document.getElementById('new-order-form'); f.classList.toggle('hidden'); if(!f.classList.contains('hidden')) loadClients(); }
async function updateOrderStatus(id, status) { await fetch('/api/orders/update', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status})}); loadOrders(); }
// --- ATUALIZAR PERFIL (COM FOTO) ---
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
            if(result.newProfilePicUrl) {
                const imgDisplay = document.getElementById('profile-img-display');
                // Adiciona timestamp para forçar atualização do cache do navegador
                imgDisplay.src = result.newProfilePicUrl + '?v=' + new Date().getTime();
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

    // UI de gravando
    document.getElementById('btn-start-rec').classList.add('hidden');
    document.getElementById('btn-stop-rec').classList.remove('hidden');
    document.getElementById('recording-timer').classList.remove('hidden');
}

function stopRecording() {
    mediaRecorder.stop();
    document.getElementById('btn-start-rec').classList.remove('hidden');
    document.getElementById('btn-stop-rec').classList.add('hidden');
    document.getElementById('recording-timer').classList.add('hidden');
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

async function loadAdminVideos() {
    const res = await fetch('/api/videos/list');
    const list = await res.json();
    const tbody = document.getElementById('admin-video-list');
    if(!tbody) return;
    tbody.innerHTML = '';
    list.forEach(v => {
        tbody.innerHTML += `
            <tr>
                <td>${v.id}</td>
                <td>${v.client_name || 'Desconhecido'}</td>
                <td>${formatDate(v.created_at)}</td>
                <td>
                    <a href="/uploads/videos/${v.filename}" target="_blank" style="color:blue">Ver</a> | 
                    <button onclick="deleteVideo(${v.id}, '${v.filename}')" style="color:red; border:none; background:none; cursor:pointer;">Excluir</button>
                </td>
            </tr>
        `;
    });
}

async function loadClientVideos() {
    const grid = document.getElementById('client-video-grid');
    if(!grid) return; 
    
    try {
        const res = await fetch('/api/videos/list');
        const list = await res.json();
        
        if(list.length === 0) {
            grid.innerHTML = '<p style="text-align:center; color:#666; width:100%; margin-top:20px;">Nenhum vídeo disponível no momento.</p>';
            return;
        }

        // Monta todo o HTML numa variável primeiro (Mais rápido)
        let htmlBuffer = '';

        list.forEach(v => {
            const dateStr = new Date(v.created_at).toLocaleDateString('pt-BR');
            // Escapa aspas para evitar quebra de HTML
            const descSafe = (v.description || 'Sem descrição').replace(/"/g, '&quot;');
            
            htmlBuffer += `
                <div class="video-card" style="border:1px solid #ddd; padding:15px; border-radius:8px; background:white; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                    <div style="margin-bottom:10px; font-weight:bold; color:#0a1931; font-size:14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${descSafe}">
                        📦 ${descSafe}
                    </div>
                    <video controls preload="metadata" style="width:100%; border-radius:5px; background:black; aspect-ratio: 16/9;">
                        <source src="/uploads/videos/${v.filename}" type="video/webm">
                        Seu navegador não suporta vídeos.
                    </video>
                    <div style="margin-top:10px; display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:12px; color:#666;">📅 ${dateStr}</span>
                        <a href="/uploads/videos/${v.filename}" download="video-${v.id}.webm" class="btn-primary" style="padding:5px 10px; text-decoration:none; font-size:12px; border-radius:4px;">
                            <i class="fas fa-download"></i> Baixar
                        </a>
                    </div>
                </div>
            `;
        });

        grid.innerHTML = htmlBuffer;

    } catch (error) {
        console.error("Erro ao carregar vídeos:", error);
        grid.innerHTML = '<p style="color:red; text-align:center;">Erro de conexão ao buscar vídeos.</p>';
    }
}

async function deleteVideo(id, filename) {
    if(!confirm("Excluir este vídeo permanentemente?")) return;
    await fetch('/api/videos/delete', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({id, filename})
    });
    loadAdminVideos();
    
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
// --- SISTEMA FINANCEIRO E COBRANÇA ---

// 1. Carregar Clientes no Select de Cobrança
async function loadClientsForBilling() {
    const sel = document.getElementById('bill-client-select');
    if(!sel) return;
    const res = await fetch('/api/clients');
    const list = await res.json();
    sel.innerHTML = '<option value="">Selecione...</option>';
    list.forEach(c => {
        sel.innerHTML += `<option value="${c.id}" data-email="${c.email}">${c.name}</option>`;
    });
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

// 3. Calcula o Valor (Peso * Preço Global)
function calculateBillAmount(selectElement) {
    const option = selectElement.options[selectElement.selectedIndex];
    const weight = parseFloat(option.getAttribute('data-weight')) || 0;
    
    // Usa o preço global carregado no inicio do dashboard
    // Se globalPricePerKg for 0, certifique-se que loadPrice() foi chamado
    const total = (weight * globalPricePerKg).toFixed(2);
    document.getElementById('bill-amount').value = total;
}

// 4. Criar a Fatura no Mercado Pago
async function createInvoice(e) {
    e.preventDefault();
    
    const clientSelect = document.getElementById('bill-client-select');
    const boxSelect = document.getElementById('bill-box-select');
    
    const data = {
        client_id: clientSelect.value,
        email: clientSelect.options[clientSelect.selectedIndex].getAttribute('data-email'),
        box_id: boxSelect.value,
        description: boxSelect.options[boxSelect.selectedIndex].getAttribute('data-desc'),
        amount: document.getElementById('bill-amount').value
    };

    if(!confirm(`Gerar cobrança de ${data.amount} para este cliente?`)) return;

    const btn = e.target.querySelector('button');
    const originalText = btn.innerText;
    btn.innerText = "Gerando Pix e Link...";
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
        } else {
            alert("Erro: " + json.msg);
        }
    } catch(err) {
        alert("Erro de conexão.");
    }
    
    btn.innerText = originalText;
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
// FUNÇÃO EXCLUSIVA DO PAINEL DO CLIENTE
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
                statusHtml = '<span style="color:orange; font-weight:bold;">⏳ Pendente</span>';
                
                // OS DOIS BOTÕES APARECEM AQUI PARA O CLIENTE
                actionHtml = `
                <div style="display:flex; justify-content:center; gap:8px;">
                    <button onclick="openPaymentModal('${inv.id}', '${safeDesc}', '${inv.amount}')" style="background:#00b1ea; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:12px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
                        💸 Pix / QR Code do Brasil
                    </button>
                    <button onclick="openEcobankModal(${inv.id})" style="background:#0a1931; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:12px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
                        🏦 Pagar no Banco da Guine Bissau
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
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Erro ao carregar faturas.</td></tr>';
    }
}
// ======================================================
// FUNÇÃO PARA PAGAR COM CARTÃO (CHECKOUT PRO MERCADO PAGO)
// ======================================================
async function goToCardCheckout() {
    // 1. Pega os dados escondidos no modal (ID e Valor)
    const orderId = document.getElementById('pay-order-id').value;
    const amount = document.getElementById('pay-amount').value;
    const description = document.getElementById('pay-desc').innerText;

    // Muda o botão para mostrar que está carregando
    const btnCard = document.querySelector('#area-card button');
    const originalText = btnCard.innerHTML;
    btnCard.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Redirecionando...';
    btnCard.disabled = true;

    try {
        // 2. Chama a nossa rota no backend que cria a "Preferência"
        const response = await fetch('/api/create-preference', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: description || `Fatura #${orderId}`,
                price: parseFloat(amount),
                quantity: 1
            })
        });

        const data = await response.json();

        // 3. Se o backend devolver o link de pagamento, manda o cliente pra lá!
        if (data.init_point) {
            window.location.href = data.init_point;
        } else {
            alert('Erro ao gerar o link de pagamento. Tente novamente.');
            btnCard.innerHTML = originalText;
            btnCard.disabled = false;
        }

    } catch (error) {
        console.error("Erro ao redirecionar para o cartão:", error);
        alert('Erro de conexão com o servidor.');
        btnCard.innerHTML = originalText;
        btnCard.disabled = false;
    }
}
function openPaymentModal(orderId, description, amount) {
    console.log("Tentando abrir modal:", { orderId, description, amount }); // Debug no Console

    document.getElementById('modal-payment').style.display = 'block';

    // 1. Limpa o valor recebido
    let valorNumerico = limparValor(amount);

    // 2. Preenche os inputs ocultos (importante para o envio ao backend)
    document.getElementById('pay-order-id').value = orderId;
    document.getElementById('pay-amount').value = valorNumerico; 

    // 3. Formata para exibir bonito no título (Ex: R$ 4,00)
    let valorParaExibir = valorNumerico.toLocaleString('pt-BR', { 
        style: 'currency', 
        currency: 'BRL' 
    });

    // Atualiza o texto visual
    document.getElementById('pay-desc').innerText = `${description} - ${valorParaExibir}`;
    
    // Reseta visualização do QR Code
    document.getElementById('qrcode-container').innerHTML = '';
    document.getElementById('pix-copy-paste').value = '';
    
    showMethod('pix');
}


// 2. Alternar Abas (Pix vs Cartão)
function showMethod(method) {
    const pixArea = document.getElementById('area-pix');
    const cardArea = document.getElementById('area-card');
    const btnPix = document.getElementById('btn-tab-pix');
    const btnCard = document.getElementById('btn-tab-card');

    if(method === 'pix') {
        pixArea.style.display = 'block';
        cardArea.style.display = 'none';
        btnPix.style.background = '#0a1931';
        btnPix.style.color = '#fff';
        btnCard.style.background = '#eee';
        btnCard.style.color = '#333';
    } else {
        pixArea.style.display = 'none';
        cardArea.style.display = 'block';
        btnCard.style.background = '#009ee3';
        btnCard.style.color = '#fff';
        btnPix.style.background = '#eee';
        btnPix.style.color = '#333';
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

// Variável global para controlar o "robô" que verifica o pagamento
let pixCheckInterval = null;

// --- 1. GERAR PIX (Modificada para iniciar a verificação) ---
async function generatePixPayment() {
    const btn = document.getElementById('btn-gen-pix');
    const orderId = document.getElementById('pay-order-id').value; // ID da fatura no seu banco
    
    let rawAmount = document.getElementById('pay-amount').value; 
    let amountVal = parseFloat(rawAmount); 

    if (!amountVal || amountVal <= 0) { 
        alert('Erro: Valor inválido.'); 
        return; 
    }

    btn.innerHTML = 'Gerando... <i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;

    try {
        // Pega o email do usuário logado se existir, senão usa genérico
        const userEmail = currentUser ? currentUser.email : 'cliente@guineexpress.com';
        const userName = currentUser ? currentUser.name : 'Cliente';

        const response = await fetch('/api/create-pix', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: amountVal,
                description: `Fatura #${orderId}`,
                email: userEmail, 
                firstName: userName
            })
        });

        const data = await response.json();

        if (data.error) throw new Error(data.error);

        // Exibe o QR Code
        const container = document.getElementById('qrcode-container');
        container.innerHTML = '';

        if(data.qr_code_base64) {
            const img = document.createElement('img');
            img.src = `data:image/png;base64,${data.qr_code_base64}`;
            img.style.maxWidth = '200px';
            container.appendChild(img);
        }
        
        document.getElementById('pix-copy-paste').value = data.qr_code;
        btn.style.display = 'none'; // Esconde o botão de gerar
        
        // AVISO VISUAL
        const containerArea = document.getElementById('area-pix');
        let statusMsg = document.getElementById('pix-status-msg');
        if(!statusMsg) {
            statusMsg = document.createElement('p');
            statusMsg.id = 'pix-status-msg';
            statusMsg.style.fontWeight = 'bold';
            statusMsg.style.color = '#d4af37';
            statusMsg.style.marginTop = '10px';
            containerArea.appendChild(statusMsg);
        }
        statusMsg.innerHTML = '<i class="fas fa-sync fa-spin"></i> Aguardando pagamento...';

        // === A MÁGICA: INICIA O ROBÔ VIGILANTE ===
        startPixPolling(data.payment_id, orderId);

    } catch (error) {
        console.error(error);
        alert("Erro ao gerar PIX: " + error.message);
        btn.innerHTML = 'Tentar Novamente';
        btn.disabled = false;
    }
}

// --- 2. ROBÔ VIGILANTE (Verifica a cada 5 segundos) ---
function startPixPolling(paymentId, invoiceId) {
    // Limpa qualquer verificação anterior para não acumular
    if(pixCheckInterval) clearInterval(pixCheckInterval);

    pixCheckInterval = setInterval(async () => {
        try {
            const res = await fetch('/api/check-payment-status', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ payment_id: paymentId, invoice_id: invoiceId })
            });
            
            const json = await res.json();
            
            if(json.status === 'approved') {
                // SUCESSO! O DINHEIRO CAIU
                clearInterval(pixCheckInterval); // Para o robô
                
                const statusMsg = document.getElementById('pix-status-msg');
                if(statusMsg) {
                    statusMsg.innerHTML = '✅ PAGAMENTO CONFIRMADO!';
                    statusMsg.style.color = 'green';
                }

                // Toca um som de sucesso (opcional)
                // const audio = new Audio('sucesso.mp3'); audio.play();

                setTimeout(() => {
                    alert("Pagamento Recebido com Sucesso! ✈️");
                    closePaymentModal();
                    loadClientInvoices(); // Atualiza a tabela no fundo
                }, 1000);
            }
        } catch (e) {
            console.error("Erro verificando pix:", e);
        }
    }, 5000); // 5000ms = 5 segundos
}

// --- 3. FECHAR MODAL (Importante parar o robô) ---
function closePaymentModal() {
    document.getElementById('modal-payment').style.display = 'none';
    
    // Para a verificação para não gastar internet do cliente
    if(pixCheckInterval) clearInterval(pixCheckInterval);
    
    // Reseta visual
    const btn = document.getElementById('btn-gen-pix');
    if(btn) {
        btn.style.display = 'block';
        btn.innerHTML = 'GERAR QR CODE AGORA';
        btn.disabled = false;
    }
    const statusMsg = document.getElementById('pix-status-msg');
    if(statusMsg) statusMsg.remove();
}


// Função auxiliar para copiar o código Pix
function copyPix() {
    const copyText = document.getElementById("pix-copy-paste");
    copyText.select();
    copyText.setSelectionRange(0, 99999); 
    navigator.clipboard.writeText(copyText.value);
    alert("Código PIX copiado!");
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
// --- FUNÇÕES DO HISTÓRICO ---

async function loadHistory() {
    const tbody = document.getElementById('history-list');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" align="center">Carregando histórico...</td></tr>';

    try {
        const res = await fetch('/api/history');
        const list = await res.json();
        
        tbody.innerHTML = '';
        
        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" align="center">Nenhum registro encontrado.</td></tr>';
            return;
        }

        list.forEach(item => {
            const date = new Date(item.created_at).toLocaleDateString('pt-BR');
            const statusClass = `status-${item.status}`; 
            
            // 1. CORREÇÃO DE ALINHAMENTO: 
            // Só cria a string da coluna se NÃO for cliente. 
            // Se for cliente, a coluna simplesmente não existirá no HTML da linha.
            let clientCellHtml = '';
            if (currentUser.role !== 'client') {
                clientCellHtml = `<td>${item.client_name || 'Desconhecido'}</td>`;
            }

            // 2. CORREÇÃO DA DESCRIÇÃO:
            // Tenta pegar 'description' (da tabela orders) ou 'products' (da tabela boxes)
            const conteudo = item.description || item.products || 'Sem descrição';

            tbody.innerHTML += `
                <tr>
                    <td>${date}</td>
                    <td style="font-weight:bold;">${item.code}</td>
                    ${clientCellHtml}
                    <td>${conteudo}</td>
                    <td><span class="status-badge ${statusClass}">${item.status}</span></td>
                </tr>
            `;
        });
        
        // 3. AJUSTE DO CABEÇALHO (TH):
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
// CARREGAR LISTA PARA IMPRIMIR ETIQUETAS
// ==========================================
async function loadLabels() {
    // Permite Admin e Employee (Funcionário)
    if (currentUser.role === 'client') {
        alert("Acesso restrito.");
        showSection('orders-view');
        return;
    }

    const tbody = document.getElementById('labels-list');
    if(!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" align="center">Carregando etiquetas...</td></tr>';

    try {
        // MÁGICA 1: Busca as Encomendas E as Boxes ao mesmo tempo!
        const [resOrders, resBoxes] = await Promise.all([
            fetch('/api/orders'),
            fetch('/api/boxes')
        ]);
        
        const orders = await resOrders.json();
        const boxes = await resBoxes.json();
        
        tbody.innerHTML = '';

        if ((!orders || orders.length === 0) && (!boxes || boxes.length === 0)) {
            tbody.innerHTML = '<tr><td colspan="6" align="center">Nenhuma etiqueta encontrada.</td></tr>';
            return;
        }

        // MÁGICA 2: Organiza as Boxes do menor para o maior (Box 1, Box 2, Box 3...)
        boxes.sort((a, b) => {
            const boxA = a.box_code || '';
            const boxB = b.box_code || '';
            return boxA.localeCompare(boxB, undefined, {numeric: true, sensitivity: 'base'});
        });

        // ----------------------------------------------------
        // PARTE 1: MOSTRAR AS CAIXAS (BOXES) PRIMEIRO
        // ----------------------------------------------------
        boxes.forEach(box => {
            // Procura a encomenda original para "roubar" o telefone e o email do cliente
            const orderOriginal = orders.find(o => o.code === box.order_code) || {};
            
            // Monta o pacote perfeito com NÚMERO DA BOX, TELEFONE e EMAIL!
            const labelData = {
                id: box.id,
                box_code: box.box_code, // Garante que a etiqueta imprima o número da Box
                code: box.order_code || 'SEM-REF',
                client_name: box.client_name || orderOriginal.client_name || 'Desconhecido',
                client_phone: orderOriginal.client_phone || 'Não informado',
                client_email: orderOriginal.client_email || 'Não informado',
                description: box.products || orderOriginal.description || 'Diversos',
                weight: box.order_weight || orderOriginal.weight || 0
            };

            // Sanitiza para não quebrar o HTML
            const jsonStr = JSON.stringify(labelData).replace(/'/g, "&#39;").replace(/"/g, "&quot;");
            
            let row = `
                <tr style="background-color: #f4f9ff; border-left: 4px solid #00b1ea;">
                    <td><input type="checkbox" class="label-check" value="box-${box.id}" data-obj='${jsonStr}'></td>
                    <td><span style="background:#0a1931; color:#fff; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:bold;">📦 BOX</span></td>
                    <td style="font-weight:bold; color:#d4af37;">${box.box_code}</td>
                    <td>${labelData.client_name} <br> <span style="font-size:11px; color:#666;">📞 ${labelData.client_phone} | ✉️ ${labelData.client_email}</span></td>
                    <td>${labelData.description}</td>
                    <td>${labelData.weight} kg</td>
                </tr>
            `;
            tbody.innerHTML += row;
        });

        // ----------------------------------------------------
        // PARTE 2: MOSTRAR AS ENCOMENDAS SOLTAS DEPOIS
        // ----------------------------------------------------
        // Filtra para não mostrar encomendas que já estão dentro de alguma Box
        const ordersWithoutBox = orders.filter(o => !boxes.some(b => b.order_code === o.code));
        ordersWithoutBox.sort((a, b) => b.id - a.id); // Mais recentes primeiro

        ordersWithoutBox.forEach(order => {
            const date = new Date(order.created_at).toLocaleDateString('pt-BR');
            
            const labelData = {
                id: order.id,
                code: order.code,
                box_code: '', // Vazio porque não é box
                client_name: order.client_name || 'Desconhecido',
                client_phone: order.client_phone || 'Não informado',
                client_email: order.client_email || 'Não informado',
                description: order.description || '---',
                weight: order.weight || 0
            };

            const orderJson = JSON.stringify(labelData).replace(/'/g, "&#39;").replace(/"/g, "&quot;");
            
            let row = `
                <tr>
                    <td><input type="checkbox" class="label-check" value="ord-${order.id}" data-obj='${orderJson}'></td>
                    <td>${date}</td>
                    <td style="font-weight:bold;">${order.code}</td>
                    <td>${labelData.client_name} <br> <span style="font-size:11px; color:#666;">📞 ${labelData.client_phone} | ✉️ ${labelData.client_email}</span></td>
                    <td>${labelData.description}</td>
                    <td>${labelData.weight} kg</td>
                </tr>
            `;
            tbody.innerHTML += row;
        });

    } catch (err) {
        console.error("Erro ao carregar etiquetas:", err);
        tbody.innerHTML = '<tr><td colspan="6" align="center">Erro ao carregar dados. Tente novamente.</td></tr>';
    }
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

// 4. GERAR E IMPRIMIR ETIQUETAS (Com sistema de Volume X/Y e Logo Oficial)
function printSelectedLabels() {
    const checked = document.querySelectorAll('.label-check:checked');
    if (checked.length === 0) return alert("Selecione pelo menos uma encomenda.");

    const printArea = document.getElementById('print-area');
    printArea.innerHTML = ''; 

    // Dados Fixos da Empresa
    const company = {
        name: "Guineexpress Logística",
        address: "Av. Tristão Gonçalves, 1203",
        contact: "(85) 98239-207",
        cnpj: "49.356.085/0001-34"
    };

    checked.forEach(box => {
        const data = JSON.parse(box.getAttribute('data-obj'));
        
        // 1. PERGUNTA QUANTAS SACOLAS TEM ESTA ENCOMENDA
        let qtdVolumes = prompt(`Quantas sacolas/volumes tem a encomenda de ${data.client_name}? (Código: ${data.code})`, "1");
        
        // Se o usuário cancelar ou digitar letra, assume 1
        qtdVolumes = parseInt(qtdVolumes) || 1; 

        // 2. LOOP MÁGICO: Gera a quantidade de etiquetas que o usuário pediu
        for (let i = 1; i <= qtdVolumes; i++) {
            
            const labelDiv = document.createElement('div');
            labelDiv.className = 'shipping-label-container'; 
            
            labelDiv.innerHTML = `
                <div class="lbl-header" style="display:flex; justify-content:space-between; align-items:center;">
                    <img src="/logo.png" style="width: 60px; height: 60px; object-fit: contain;">
                    
                    <div style="text-align: right; font-size: 9px; color: #fff; line-height: 1.3;">
                        <strong style="font-size:11px; color:#d4af37;">${company.name}</strong><br>
                        ${company.address}<br>
                        ${company.contact}<br>
                        CNPJ: ${company.cnpj}
                    </div>
                </div>

                <div class="lbl-body">
                    <div class="lbl-box">
                        <div class="lbl-title">DESTINATÁRIO (GUINÉ-BISSAU)</div>
                        <div class="lbl-text" style="font-size: 14px;">${data.client_name || 'CLIENTE'}</div>
                        <div style="font-size: 11px; margin-top: 2px;">
                            Tel: ${data.client_phone || '-'}<br>
                            Email: ${data.client_email ? data.client_email.substring(0, 25) : '-'}
                        </div>
                    </div>

                    <div style="display:flex; gap: 5px;">
                        <div class="lbl-box" style="flex: 2;">
                            <div class="lbl-title">CONTEÚDO</div>
                            <div class="lbl-text" style="font-size: 12px;">${data.description ? data.description.substring(0, 40) : '-'}</div>
                        </div>
                        <div class="lbl-box" style="flex: 1; text-align: center;">
                            <div class="lbl-title">PESO TOTAL</div>
                            <div class="lbl-text" style="font-size: 16px;">${data.weight} kg</div>
                        </div>
                    </div>
                    
                    <div class="lbl-box">
                        <div class="lbl-title">OBSERVAÇÕES</div>
                        <div style="font-size: 10px;">Entrega prevista: </div>
                    </div>
                </div>

                <div class="lbl-footer" style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div class="lbl-title" style="border:none; margin:0;">NÚMERO DA BOX</div>
                         <div style="font-size: 22px; font-weight: 900; letter-spacing: 1px;">${data.box_code || data.code}</div>
                    </div>
                    
                    <div style="background: #000; color: #fff; padding: 6px 12px; text-align: center; border-radius: 4px; min-width: 60px;">
                        <div style="font-size: 9px; letter-spacing: 2px; font-weight:bold;">VOLUME</div>
                        <div style="font-size: 24px; font-weight: 900;">${i}/${qtdVolumes}</div>
                    </div>

                    <div id="qr-${data.id}-${i}" style="background:#fff; padding:2px; border:1px solid #ddd;"></div>
                </div>
            `;

            printArea.appendChild(labelDiv);

            // Gerar QR Code (Adicionado o número do volume no ID para não dar conflito)
            new QRCode(document.getElementById(`qr-${data.id}-${i}`), {
                text: `BOX:${data.box_code || data.code}|VOL:${i}/${qtdVolumes}|${data.client_name}`,
                width: 60, height: 60,
                correctLevel : QRCode.CorrectLevel.L
            });
        }
    });

    setTimeout(() => { window.print(); }, 500);
}
// ============================================================
// LÓGICA DE RECIBOS PROFISSIONAIS (CORRIGIDA)
// ============================================================

// 1. Carrega a tabela na aba (Moeda R$)
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

        list.innerHTML = '';
        if (boxes.length === 0) {
            list.innerHTML = '<tr><td colspan="6" align="center">Nenhum recibo disponível.</td></tr>';
            return;
        }

        boxes.sort((a, b) => b.id - a.id);

        boxes.forEach(box => {
            // CORREÇÃO: Usa 'box' aqui dentro do loop
            const peso = parseFloat(box.order_weight || 0).toFixed(2);
            
            // Lógica visual para valor (apenas visualização rápida na tabela)
            // O valor real calculado vem na hora de imprimir
            let valorNum = parseFloat(box.amount || 0);
            
            // Se o valor for 0, tenta estimar visualmente (peso * preço global) para a tabela não ficar zerada
            if(valorNum === 0 && globalPricePerKg > 0) {
                valorNum = parseFloat(peso) * globalPricePerKg;
            }

            const valorReais = valorNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const produtos = box.products || '---';
            
            let clientCol = '';
            if (currentUser.role !== 'client') {
                clientCol = `<td>${box.client_name || 'Desconhecido'}</td>`;
            }

            const row = `
                <tr>
                    <td><strong>#${box.box_code}</strong></td>
                    ${clientCol}
                    <td><small>${produtos.substring(0, 30)}...</small></td>
                    <td>${peso} kg</td>
                    <td style="font-weight:bold; color:#0a1931;">${valorReais}</td>
                    <td>
                        <button onclick="printReceipt(${box.id})" class="btn" style="background:#000; color:#d4af37; border:1px solid #d4af37; padding:5px 10px; font-size:11px; font-weight:bold;">
                            <i class="fas fa-print"></i> RECIBO
                        </button>
                    </td>
                </tr>
            `;
            list.innerHTML += row;
        });
        
        const thClient = document.getElementById('rec-col-client');
        if(thClient && currentUser.role === 'client') thClient.style.display = 'none';

    } catch (err) {
        console.error(err);
        list.innerHTML = '<tr><td colspan="6">Erro ao carregar dados.</td></tr>';
    }
}

// 5. GERAR RECIBO A4 (Tamanho Normal - Com Logo Oficial e Retirada)
async function printReceipt(boxId) {
    const printArea = document.getElementById('print-area');
    
    try {
        // Busca dados reais do banco
        const res = await fetch(`/api/receipt-data/${boxId}`); 
        const response = await res.json();
        
        if (!response.success) {
            return alert("Erro ao buscar dados do recibo: " + (response.msg || 'Erro desconhecido'));
        }

        const d = response.data; // Dados vindos do backend

        // Formata valores
        const valorReais = parseFloat(d.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const dataHoje = new Date().toLocaleDateString('pt-BR');
        
        // Define Status baseado no pagamento real
        const stampStatus = d.is_paid ? 'PAGO' : 'PENDENTE';
        const stampColor = d.is_paid ? '#28a745' : '#dc3545'; // Verde ou Vermelho

        printArea.innerHTML = '';
        
        // Estrutura HTML Otimizada para A4
        const receiptDiv = document.createElement('div');
        receiptDiv.className = 'receipt-a4-container'; 
        
        receiptDiv.innerHTML = `
            <div style="position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%) rotate(-15deg); 
                        font-size: 60px; font-weight: 900; color: ${stampColor}; opacity: 0.2; border: 5px solid ${stampColor}; padding: 10px 40px; text-transform:uppercase;">
                ${stampStatus}
            </div>

            <div class="rec-header">
                <div style="display:flex; align-items:center; gap:15px;">
                    <img src="/logo.png" style="width:70px; height:70px; object-fit:contain;">
                    
                    <div>
                        <h1 style="margin:0; font-size:22px; color:#0a1931;">GUINEEXPRESS</h1>
                        <p style="margin:0; font-size:10px; font-weight:bold;">LOGÍSTICA INTERNACIONAL</p>
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
                    <div class="rec-line"><strong>Status:</strong> ${d.order_status || 'Processando'}</div>
                </div>
                <div class="rec-box">
                    <h3>RETIRADA EM GUINÉ-BISSAU</h3>
                    <div class="rec-line"><strong>Local:</strong> Rotunda de Nhonho</div>
                    <div class="rec-line"><strong>Bairro:</strong> Belem</div>
                    <div class="rec-line"><strong>Contato:</strong> +245 956604423</div>
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
                        <td>
                            <strong>Frete Aéreo/Marítimo Internacional</strong><br>
                            <small>Conteúdo: ${d.products || 'Diversos'}</small>
                        </td>
                        <td style="text-align:center;">${d.weight} kg</td>
                        <td style="text-align:right;">${valorReais}</td>
                    </tr>
                    <tr>
                        <td colspan="2" style="text-align:right; font-weight:bold; padding-top:15px;">TOTAL LÍQUIDO:</td>
                        <td style="text-align:right; font-weight:bold; font-size:16px; padding-top:15px;">${valorReais}</td>
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

        // Reseta visual
        if(preview) preview.style.display = 'none';
        if(video) video.style.display = 'block';
        if(btnSnap) btnSnap.classList.remove('hidden');
        if(btnConfirm) btnConfirm.classList.add('hidden');
        
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

    // Tira a foto (Igual ao anterior)
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
        document.getElementById('btn-confirm-delivery').classList.remove('hidden');
    },

    // Confirma e envia (Lógica diferente para Avaria)
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
// EXPORTAÇÃO PARA EXCEL (ADMIN)
// ==========================================
async function exportOrdersToExcel() {
    // Verifica permissão (Só Admin)
    if (currentUser.role !== 'admin') return alert('Apenas administradores.');

    const btn = document.querySelector('button[onclick="exportOrdersToExcel()"]');
    const oldText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...';

    try {
        // 1. Busca os dados mais recentes do servidor
        const res = await fetch('/api/orders');
        const orders = await res.json();

        if (orders.length === 0) {
            alert("Nenhuma encomenda para exportar.");
            btn.innerHTML = oldText;
            return;
        }

        // 2. Formata os dados para ficarem bonitos no Excel
        const dataFormatted = orders.map(o => ({
            "Código": o.code,
            "Cliente": o.client_name || o.name,
            "Telefone": o.client_phone || o.phone,
            "Descrição": o.description,
            "Peso (kg)": o.weight,
            "Preço (R$)": parseFloat(o.price || 0).toFixed(2),
            "Status": o.status,
            "Data Criação": o.created_at ? new Date(o.created_at).toLocaleDateString('pt-BR') : '-',
            "Local Atual": o.delivery_location || '-'
        }));

        // 3. Cria a Planilha
        const worksheet = XLSX.utils.json_to_sheet(dataFormatted);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Encomendas");

        // 4. Ajusta largura das colunas (Opcional, mas fica pro)
        const wscols = [
            {wch: 15}, // Código
            {wch: 25}, // Cliente
            {wch: 15}, // Telefone
            {wch: 30}, // Descrição
            {wch: 10}, // Peso
            {wch: 10}, // Preço
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
        btn.innerHTML = oldText;
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
// --- FUNÇÃO: CARREGAR LOGS DE ACESSO ---
async function loadAccessLogs() {
    try {
        const response = await fetch('/api/admin/logs');
        const logs = await response.json();
        
        const tbody = document.getElementById('logs-table-body');
        tbody.innerHTML = ''; // Limpa a tabela

        logs.forEach(log => {
            const tr = document.createElement('tr');
            
            // Define cor baseada no status (Sucesso = Verde, Falha = Vermelho)
            const statusColor = log.status === 'Sucesso' ? '#28a745' : '#dc3545';
            const statusBadge = `<span style="background: ${statusColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${log.status}</span>`;

            // Formata a data
            const date = new Date(log.created_at).toLocaleString('pt-BR');

            tr.innerHTML = `
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${date}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">${log.user_input}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${statusBadge}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${log.device}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; font-family: monospace;">${log.ip_address}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">${log.reason || '-'}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Erro ao carregar logs:", error);
        alert("Erro ao carregar histórico.");
    }
}
// ==========================================
// ABA FINANCEIRO (ENCOMENDAS E FATURAS)
// ==========================================

async function loadFinances() {
    try {
        const res = await fetch('/api/finances/all');
        const finances = await res.json();
        const tbody = document.getElementById('finances-list');
        tbody.innerHTML = '';

        if (finances.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Nenhum registo encontrado.</td></tr>`;
            return;
        }

        finances.forEach(item => {
            // 1. TRADUÇÃO AUTOMÁTICA DO STATUS (AGORA COM 'APPROVED')
            let statusPt = item.status;
            const statusLower = statusPt.toLowerCase();

            if (statusLower === 'pending') statusPt = 'Pendente';
            // Adicionamos o 'approved' aqui juntamente com o 'paid'
            if (statusLower === 'paid' || statusLower === 'approved') statusPt = 'Pago'; 
            if (statusLower === 'cancelled' || statusLower === 'rejected') statusPt = 'Cancelado';

            // 2. Escolhe a cor da etiqueta dependendo do status traduzido
            let statusBadge = 'bg-warning'; // Padrão (Pendente)
            if (statusPt.toLowerCase().includes('pago')) statusBadge = 'bg-success'; // Verde
            if (statusPt.toLowerCase().includes('cancelado')) statusBadge = 'bg-danger'; // Vermelho

            const tr = document.createElement('tr');
            // ADICIONAMOS O data-label EM CADA TD PARA O TELEMÓVEL LER!
            tr.innerHTML = `
                <td data-label="Código" style="font-weight: bold;">${item.id_code || 'N/A'}</td>
                <td data-label="Tipo"><span class="badge ${item.type === 'Encomenda' ? 'bg-info' : 'bg-primary'}">${item.type}</span></td>
                <td data-label="Cliente">${item.client_name || 'Desconhecido'}</td>
                <td data-label="Descrição">${item.description || '-'}</td>
                <td data-label="Peso">${item.weight ? item.weight + ' kg' : '-'}</td>
                <td data-label="Status"><span class="badge ${statusBadge}">${statusPt}</span></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error("Erro ao carregar o financeiro", e);
    }
}

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
        headStyles: { fillColor: [10, 25, 49] }, // Cor ajustada para o azul escuro da sua marca (opcional)
        
        // MÁGICA ACONTECE AQUI: Hook para alterar estilos das células dinamicamente
        didParseCell: function(data) {
            // Verifica se estamos no corpo da tabela (body) e na coluna 5 (que é a de Status)
            // Índices: 0=Código, 1=Tipo, 2=Cliente, 3=Descrição, 4=Peso, 5=Status
            if (data.section === 'body' && data.column.index === 5) {
                
                // Pega o texto da célula e converte para minúsculo para facilitar a comparação
                const statusText = data.cell.text.join('').toLowerCase();

                if (statusText.includes('pago')) {
                    // Fundo Verde claro e Texto Verde Escuro
                    data.cell.styles.fillColor = [212, 237, 218]; 
                    data.cell.styles.textColor = [21, 87, 36];
                    data.cell.styles.fontStyle = 'bold';
                } 
                else if (statusText.includes('pendente')) {
                    // Fundo Vermelho claro e Texto Vermelho Escuro
                    data.cell.styles.fillColor = [248, 215, 218];
                    data.cell.styles.textColor = [114, 28, 36];
                    data.cell.styles.fontStyle = 'bold';
                }
                else if (statusText.includes('cancelado')) {
                    // Fundo Cinza/Vermelho (pode ajustar como quiser)
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

    // 2. Define as colunas e as larguras
    sheet.columns = [
        { header: 'Código', key: 'code', width: 15 },
        { header: 'Tipo', key: 'type', width: 15 },
        { header: 'Cliente', key: 'client', width: 25 },
        { header: 'Descrição', key: 'desc', width: 30 },
        { header: 'Peso', key: 'weight', width: 15 },
        { header: 'Status', key: 'status', width: 20 }
    ];

    // 3. Pinta o cabeçalho de Azul Escuro (padrão GuineExpress) com letra branca
    sheet.getRow(1).eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A1931' } };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    });

    // 4. Puxa as linhas da sua tabela HTML
    const rows = document.querySelectorAll('#finances-list tr');
    
    rows.forEach(tr => {
        // Ignora a linha de "Nenhum registro encontrado"
        if(tr.cells.length === 1) return;

        // Pega os textos de cada coluna
        const rowData = {
            code: tr.cells[0].innerText,
            type: tr.cells[1].innerText,
            client: tr.cells[2].innerText,
            desc: tr.cells[3].innerText,
            weight: tr.cells[4].innerText,
            status: tr.cells[5].innerText
        };

        const excelRow = sheet.addRow(rowData);

        // 5. Aplica as cores na coluna de Status (Coluna 6)
        const statusCell = excelRow.getCell(6);
        const statusText = rowData.status.toLowerCase();

        if (statusText.includes('pago')) {
            // Fundo Verde (FF + Hex da cor)
            statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EDDA' } }; 
            statusCell.font = { color: { argb: 'FF155724' }, bold: true };
        } 
        else if (statusText.includes('pendente')) {
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
            if(inv.status === 'approved') statusHtml = '<span style="color:green; font-weight:bold;">✅ PAGO</span>';
            else if(inv.status === 'in_review') statusHtml = '<span style="background-color:blue; color:white; padding:2px 5px; border-radius:4px; font-weight:bold;">👀 Em Análise</span>';
            else if(inv.status === 'pending') statusHtml = '<span style="color:orange; font-weight:bold;">⏳ Pendente</span>';
            else statusHtml = '<span style="color:red;">Cancelado</span>';

            let deleteBtn = '';
            let actionButtons = '';

            // BOTÕES DO ADMIN
            if(currentUser && currentUser.role === 'admin') {
                deleteBtn = `<button onclick="deleteInvoice(${inv.id})" style="color:red; background:none; border:none; cursor:pointer; margin-left:10px;" title="Excluir"><i class="fas fa-trash"></i></button>`;
                
                if (inv.status === 'pending') {
                    actionButtons = `<span style="font-size:12px; color:gray;">Aguardando Cliente...</span>`;
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
                actionButtons += ` <button onclick="checkInvoiceStatus('${inv.mp_payment_id}', ${inv.id})" style="font-size:12px; cursor:pointer; background:none; border:none;" title="Forçar Verificação Pix">🔄</button>`;
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
                // Tabela para funcionário comum ver
                tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="font-weight:bold; color:#0a1931; padding:12px;">${refCode}</td>
                    <td>${inv.client_name}</td>
                    <td>${inv.box_code || '-'}</td>
                    <td>${statusHtml}</td>
                    <td>-</td>
                </tr>`;
            }
        });
    } catch (err) {
        console.error("Erro ao carregar faturas:", err);
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

// O Cliente clica para enviar a foto do comprovante para o servidor
async function submitEcobankReceipt() {
    const invoiceId = document.getElementById('ecobank-invoice-id').value;
    const fileInput = document.getElementById('ecobank-receipt-file');
    
    if (fileInput.files.length === 0) return alert("Anexe a foto do comprovativo primeiro!");

    const formData = new FormData();
    formData.append('receipt', fileInput.files[0]);

    alert("A enviar o comprovativo... Aguarde.");
    try {
        const res = await fetch(`/api/invoices/${invoiceId}/upload-receipt`, { method: 'POST', body: formData });
        const data = await res.json();
        
        if(data.success) {
            alert("✅ Comprovativo enviado! Aguarde a aprovação da GuineExpress.");
            document.getElementById('modal-ecobank').style.display = 'none';
            loadClientInvoices(); // Atualiza a tabela dele para Em Análise
        } else {
            alert("Erro: " + data.message);
        }
    } catch(err) { alert("Erro ao enviar a imagem."); }
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

// ==================================================================
// LÓGICA DO JOGO DA ROLETA DA SORTE 🎡
// ==================================================================

// Variáveis do Modal
const modalRoleta = document.getElementById('modal-roleta');
const btnFecharRoleta = document.getElementById('fechar-roleta');
const btnGirar = document.getElementById('btn-girar');
const wheel = document.getElementById('wheel');

// Modificamos a função que o botão flutuante chama para abrir a tela
function abrirRoleta() {
    if(modalRoleta) {
        modalRoleta.classList.add('ativo');
    }
}

// Fechar a Roleta
if(btnFecharRoleta) {
    btnFecharRoleta.addEventListener('click', () => {
        modalRoleta.classList.remove('ativo');
    });
}

// ==================================================================
// LÓGICA DO JOGO DA ROLETA (VERSÃO FINAL COM PRÉMIOS)
// ==================================================================
const listaPremios = [
    "Parabéns! Ganhou 10% de desconto! (Código: GUINE10)", // Fatia 0
    "Ah não... Não foi desta vez. Tente amanhã!",         // Fatia 1
    "Boa! Ganhou 1 Ponto Express para a sua conta!",       // Fatia 2
    "Puxa vida... Tente amanhã!",                          // Fatia 3
    "Legal! Ganhou 5% de desconto! (Código: GUINE5)",      // Fatia 4
    "Quase... Volte a tentar amanhã!"                      // Fatia 5
];

let grausAtuais = 0;

if(btnGirar) {
    btnGirar.addEventListener('click', () => {
        // 1. VERIFICA SE JÁ JOGOU HOJE (Proteção anti-vício!)
        const ultimoJogo = localStorage.getItem('dataUltimaRoleta');
        const dataHoje = new Date().toDateString();

        if (ultimoJogo === dataHoje) {
            if (typeof ciciAvisa === "function") {
                ciciAvisa("Você já girou a roleta hoje! Volte amanhã para tentar a sorte de novo. ", "erro");
            } else {
                alert("Você já girou a roleta hoje! Volte amanhã.");
            }
            return; // Bloqueia e não deixa girar
        }

        // 2. PREPARA PARA GIRAR
        btnGirar.disabled = true;
        btnGirar.innerText = "A GIRAR... 🌀";

        // 3. SORTEIA O PRÉMIO (0 a 5)
        const fatiaSorteada = Math.floor(Math.random() * 6); 

        // 4. MATEMÁTICA PARA PARAR NA FATIA CERTA
        // Cada fatia tem 60 graus. O meio da fatia é 30.
        const centroDaFatia = (fatiaSorteada * 60) + 30;
        
        // Quantos graus temos de rodar para o centro da fatia ficar no ponteiro (no topo, que é 0)
        const grausParaGirar = 1800 + (360 - centroDaFatia);
        
        grausAtuais += grausParaGirar;

        // Roda o CSS!
        wheel.style.transform = `rotate(${grausAtuais}deg)`;

        // 5. DEPOIS DE PARAR (Espera 4 segundos da animação)
        setTimeout(() => {
            // Regista que o utilizador já jogou hoje
            localStorage.setItem('dataUltimaRoleta', dataHoje);

            // Verifica se ganhou algo ou se foi "Tente Amanhã"
            // Fatias pares (0, 2, 4) são os prémios!
            if (fatiaSorteada === 0 || fatiaSorteada === 2 || fatiaSorteada === 4) {
                
                // 💥 DISPARA OS CONFETTIS! 💥
                if (typeof confetti === "function") {
                    confetti({
                        particleCount: 150,
                        spread: 80,
                        origin: { y: 0.6 },
                        colors: ['#009ee3', '#d4af37', '#ffffff'] // As cores da Guineexpress!
                    });
                }
                   // Se a fatia for a de "1 Ponto" (Fatia 2), avisa o servidor
                if (fatiaSorteada === 2) {
                    fetch('/api/save-points', { method: 'POST' })
                    .then(response => response.json())
                    .then(data => {
                        console.log("Ponto guardado com sucesso no banco de dados!");
                    })
                    .catch(err => console.error("Erro ao comunicar com o servidor"));
                }
                if (typeof ciciAvisa === "function") {
                    ciciAvisa(listaPremios[fatiaSorteada], "sucesso");
                } else {
                    alert(listaPremios[fatiaSorteada]);
                }

                // DICA PARA O FUTURO: Aqui nós avisaremos o servidor para guardar o prémio no Banco de Dados!

            } else {
                // Se perdeu (Fatias 1, 3, 5)
                if (typeof ciciAvisa === "function") {
                    ciciAvisa(listaPremios[fatiaSorteada], "info");
                } else {
                    alert(listaPremios[fatiaSorteada]);
                }
            }
            
            btnGirar.innerText = "VOLTE AMANHÃ";
            
        }, 4000);
    });
}
const truck = document.getElementById("truck");
const gameContainer = document.getElementById("game-container");
const scoreElement = document.getElementById("score");
const modalJogo = document.getElementById("modal-jogo");
let score = 0;
let isGameOver = false;

// Abrir e Fechar o Jogo
document.getElementById("btn-abrir-jogo").onclick = () => { modalJogo.style.display = 'flex'; resetJogo(); };
document.getElementById("fechar-jogo").onclick = () => { modalJogo.style.display = 'none'; isGameOver = true; };

// Função de Saltar
function jump() {
    if (!truck.classList.contains("animate-jump")) {
        truck.classList.add("animate-jump");
        setTimeout(() => truck.classList.remove("animate-jump"), 500);
    }
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
// ==================================================================
// LÓGICA DO PASSAPORTE DE VIAGENS (VERSÃO REAL)
// ==================================================================

// Abrir Passaporte com Efeito Sonoro
const btnAbrirPassaporte = document.getElementById('btn-abrir-passaporte');
const modalPassaporte = document.getElementById('modal-passaporte');
const btnFecharPassaporte = document.getElementById('fechar-passaporte');

if (btnAbrirPassaporte) {
    btnAbrirPassaporte.onclick = () => {
        modalPassaporte.style.display = 'flex';
        
        // Efeito sonoro de carimbo (opcional, mas muito fixe!)
        try {
            let audio = new Audio('https://www.soundjay.com/office/sounds/stapler-01.mp3');
            audio.volume = 0.4;
            audio.play();
        } catch (e) { console.log("Som bloqueado pelo navegador"); }

        // Chama a função que vai buscar os dados reais ao servidor
        carregarCarimbos();
    };
}

if (btnFecharPassaporte) {
    btnFecharPassaporte.onclick = () => {
        modalPassaporte.style.display = 'none';
    };
}

// Fecha o modal se o utilizador clicar fora da caixa do passaporte
window.onclick = (event) => {
    if (event.target == modalPassaporte) {
        modalPassaporte.style.display = "none";
    }
};

function carregarCarimbos() {
    fetch('/api/get-passport')
        .then(res => {
            if (!res.ok) throw new Error('Página não encontrada no servidor (404)');
            return res.json();
        })
        .then(data => {
            if (data.success) {
                document.getElementById('pass-user-name').innerText = data.nome;
                const mapaCidades = {
                    "Bissau": "stamp-BIS",
                    "Lisboa": "stamp-LIS",
                    "Paris": "stamp-PAR",
                    "Dakar": "stamp-DAK"
                };

                document.querySelectorAll('.stamp-item').forEach(s => {
                    s.classList.add('locked');
                    s.classList.remove('unlocked');
                });

                data.destinos.forEach(destinoReal => {
                    const idCarimbo = mapaCidades[destinoReal];
                    if (idCarimbo && document.getElementById(idCarimbo)) {
                        document.getElementById(idCarimbo).classList.remove('locked');
                        document.getElementById(idCarimbo).classList.add('unlocked');
                    }
                });
            }
        })
        .catch(err => console.error("Aviso: O passaporte ainda não tem dados para mostrar. ", err));
}

// Clique do botão com som corrigido (link estável)
if (btnAbrirPassaporte) {
    btnAbrirPassaporte.onclick = () => {
        modalPassaporte.style.display = 'flex';
        // Novo link de som mais confiável
        let audio = new Audio('https://assets.mixkit.co/active_storage/sfx/201/201-preview.mp3');
        audio.volume = 0.3;
        audio.play().catch(() => {}); // Ignora erro se o som falhar
        carregarCarimbos();
    };
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