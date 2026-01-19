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

            // Esconde Login e Mostra Dashboard
            document.getElementById('login-screen').classList.add('hidden');
            
            if (currentRole === 'admin') {
                window.location.href = 'dashboard-admin.html'; // Ou exibe a div do admin
            } else {
                // Se estivermos no index.html e for cliente, manda pro dashboard
                // Se já estivermos no dashboard-client.html, apenas carrega a Home
                if(window.location.pathname.includes('index') || window.location.pathname === '/') {
                     window.location.href = 'dashboard-client.html';
                } else {
                     showSection('home-view'); // Garante que vá para a Home
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
// CONFIGURAÇÃO AVANÇADA DE MÁSCARAS
// ==========================================

// Definição completa: Prefixo (para salvar no banco) e Máscara Visual
const countryData = {
    'GW': { code: '245', phoneMask: '+{245} 00 000 00 00', docMask: '000000000' }, // Guiné
    'BR': { code: '55',  phoneMask: '+{55} (00) 00000-0000', docMask: '000.000.000-00' }, // Brasil (CPF)
    'PT': { code: '351', phoneMask: '+{351} 000 000 000', docMask: '000000000' }, // Portugal (NIF)
    'SN': { code: '221', phoneMask: '+{221} 00 000 00 00', docMask: '0 000 0000 00000' }, // Senegal
    'MA': { code: '212', phoneMask: '+{212} 0 00 00 00 00', docMask: '00000000' }, // Marrocos
    'US': { code: '1',   phoneMask: '+{1} (000) 000-0000', docMask: '000-00-0000' }, // EUA
    'FR': { code: '33',  phoneMask: '+{33} 0 00 00 00 00', docMask: '000000000000' }, // França
    'ES': { code: '34',  phoneMask: '+{34} 000 000 000', docMask: '00000000X' }, // Espanha (NIE/DNI)
    'UK': { code: '44',  phoneMask: '+{44} 0000 000000', docMask: '000000000' }, // UK
    'BE': { code: '32',  phoneMask: '+{32} 000 00 00 00', docMask: '00.00.00-000.00' }, // Bélgica
    'CV': { code: '238', phoneMask: '+{238} 000 00 00', docMask: '000000000' }, // Cabo Verde
    'default': { code: '', phoneMask: '00000000000000', docMask: '********************' }
};

let phoneMaskInstance = null;
let docMaskInstance = null;

function updateMasks() {
    if (typeof IMask === 'undefined') return console.warn("IMask não carregado.");

    const countrySelect = document.getElementById('reg-country');
    const phoneInput = document.getElementById('reg-phone');
    const docInput = document.getElementById('reg-doc');

    if (!countrySelect || !phoneInput || !docInput) return;

    const country = countrySelect.value;
    const data = countryData[country] || countryData['default'];

    // --- 1. MÁSCARA DE TELEFONE (Com Prefixo Automático) ---
    if (phoneMaskInstance) phoneMaskInstance.destroy();
    
    try {
        phoneMaskInstance = IMask(phoneInput, {
            mask: data.phoneMask,
            lazy: false,  // Faz a máscara aparecer imediatamente (ex: +245 __ ___)
            placeholderChar: '_' // Caractere para onde o usuário deve digitar
        });
    } catch (e) { console.error(e); }

    // --- 2. MÁSCARA DE DOCUMENTO (Validação de Formato) ---
    if (docMaskInstance) docMaskInstance.destroy();

    try {
        docMaskInstance = IMask(docInput, {
            mask: data.docMask,
            prepare: (str) => str.toUpperCase() // Força letras maiúsculas
        });
        
        // Ajusta placeholder visualmente
        if (country === 'BR') docInput.placeholder = "CPF (000.000.000-00)";
        else if (country === 'PT') docInput.placeholder = "NIF";
        else docInput.placeholder = "Número do Documento";
        
    } catch (e) { console.error(e); }
}

// Inicializa as máscaras assim que carregar
document.addEventListener('DOMContentLoaded', () => {
    // Se existir o select na tela, aplica a máscara inicial
    if(document.getElementById('reg-country')) {
        updateMasks();
    }
});
// --- LOGIN & CADASTRO (CORRIGIDO) ---
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const login = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;
    
    // Envia a role atual (que vem dos botões "Sou Cliente", "Funcionário", etc)
    const res = await fetch('/api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password: pass, role: currentRole })
    });
    
    const data = await res.json();
    
    if(data.success) {
        localStorage.setItem('userRole', data.role);
        
        // --- AQUI ESTÁ A CORREÇÃO DO REDIRECIONAMENTO ---
        if (data.role === 'client') {
            window.location.href = 'dashboard-client.html';
        } else if (data.role === 'employee') {
            window.location.href = 'dashboard-employee.html'; // <--- O NOVO ARQUIVO
        } else {
            window.location.href = 'dashboard-admin.html';
        }
        // ------------------------------------------------
    } else {
        alert(data.msg);
    }
});

// --- CADASTRO COM VALIDAÇÃO RIGOROSA ---
document.getElementById('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const pass = document.getElementById('reg-pass').value;
    const pass2 = document.getElementById('reg-pass2').value;
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const country = document.getElementById('reg-country').value;

    // 1. Validação de Senha
    if (pass !== pass2) return alert('❌ As senhas não coincidem!');
    if (pass.length < 6) return alert('❌ A senha deve ter no mínimo 6 caracteres.');

    // 2. Validação de Telefone (Usando a máscara)
    if (!phoneMaskInstance || !phoneMaskInstance.masked.isComplete) {
        return alert('❌ Digite o número de celular completo (com DDD).');
    }

    // 3. Validação de Documento (Usando a máscara)
    // Para alguns países a validação de tamanho é crítica
    if (!docMaskInstance || !docMaskInstance.masked.isComplete) {
        return alert('❌ O número do documento está incompleto ou inválido para o país selecionado.');
    }

    // PREPARAÇÃO DOS DADOS PARA O BANCO
    // Pega o valor "unmasked" (sem traços e parenteses) mas garante o código do país
    // O IMask unmaskedValue já remove a formatação, mas mantém os números.
    // Ex: +245 99... vira 24599... (Perfeito para o WhatsApp API)
    const cleanPhone = phoneMaskInstance.unmaskedValue; 
    
    // Documento limpo (apenas letras e números)
    const cleanDoc = docMaskInstance.value.toUpperCase(); 

    const formData = {
        name: name,
        email: email,
        phone: cleanPhone, // Envia ex: 245966600000
        country: country,
        document: cleanDoc,
        password: pass
    };

    const btn = e.target.querySelector('button');
    const oldText = btn.innerText;
    btn.innerText = "Cadastrando...";
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
            showLogin(); 
            // Limpa formulário
            document.getElementById('register-form').reset();
            updateMasks(); // Reseta as máscaras
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
function showSection(id) {
    // 1. Esconde todas as seções
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    
    // 2. Mostra a seção desejada
    const section = document.getElementById(id);
    if(section) {
        section.classList.remove('hidden');
        localStorage.setItem('activeTab', id);
    }

    // 3. Carrega os dados específicos de cada aba
    if(id === 'orders-view') loadOrders();
    if(id === 'schedule-view') loadSchedules();
    if(id === 'box-view') loadBoxes(); 
    if(id === 'price-section') loadPrice(); 
    if(id === 'billing-view') loadClientInvoices();
    if(id === 'history-view') loadHistory(); 
    if(id === 'labels-view') loadLabels();
    if(id === 'expenses-view') loadExpenses();
    if(id === 'logs-view') loadSystemLogs();
    if(id === 'shipments-view') loadShipments();
    if(id === 'receipts-view') loadReceipts();

    // --- CORREÇÃO AQUI: Carrega dados para gravar vídeo ---
    if(id === 'videos-section') {
        // Se for admin/funcionário, carrega lista de encomendas para selecionar
        if(currentUser.role !== 'client') {
            loadOrdersForVideo(); 
            loadAdminVideos(); // Lista os vídeos já feitos
        } else {
            loadClientVideos(); // Cliente só vê a galeria
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
    const list = await res.json();
    const tbody = document.getElementById('box-table-body');
    
    if(tbody) {
        tbody.innerHTML = '';
        list.forEach(b => {
            const act = (currentUser.role !== 'client') ? 
                `<button onclick="deleteBox(${b.id})" style="color:white; background:red; border:none; padding:5px 10px; cursor:pointer;">Excluir</button>` : '-';
            
            const weight = parseFloat(b.order_weight) || 0;
            const totalValue = (weight * globalPricePerKg).toFixed(2);

            tbody.innerHTML += `
            <tr>
                <td>${b.box_code}</td>
                <td>${b.client_name || '-'}</td>
                <td>${b.order_code || '-'}</td>
                <td>${weight} Kg</td>
                <td style="font-weight:bold; color:green;">${totalValue}</td> <td>${b.products || '-'}</td>
                <td>${act}</td>
            </tr>`; 
        });
        // CORREÇÃO 1: Adicionado para funcionar no mobile
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
        let actions = '-';
        if(app.status === 'Pendente') {
            actions = `<button onclick="updateScheduleStatus(${app.id}, 'Aprovado')" style="color:green; cursor:pointer;">✔</button> <button onclick="updateScheduleStatus(${app.id}, 'Recusado')" style="color:red; cursor:pointer;">✖</button>`;
        }
        tbody.innerHTML += `<tr><td>${formatDate(app.date)}</td><td>${app.time_slot}</td><td>${app.client_name}<br><small>${app.client_phone}</small></td><td>${app.status}</td><td>${actions}</td></tr>`;
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
    
    // 1. Seleciona todos os botões dentro da div correta (#role-selector)
    const buttons = document.querySelectorAll('#role-selector button');
    
    // 2. Reseta TODOS os botões para Cinza (Inativo)
    buttons.forEach(b => {
        b.style.background = '#eee';
        b.style.color = '#333';
        // Remove a classe btn-primary se ela estiver atrapalhando a cor
        b.classList.remove('btn-primary'); 
        b.classList.add('btn'); // Garante a formatação básica
    });
    
    // 3. Pinta APENAS o botão clicado de Azul Escuro (Ativo)
    const activeBtn = document.getElementById(`btn-${role}`);
    if(activeBtn) {
        activeBtn.style.background = '#0a1931'; // Cor Azul do seu tema
        activeBtn.style.color = '#fff';         // Texto Branco
    }

    // 4. Controla visibilidade dos links (Esqueci a senha / Cadastro)
    // Tenta pegar a div que agrupa os links, ou os links individuais
    const linksContainer = document.getElementById('client-links');
    
    if (linksContainer) {
        // Se você tem a div agrupando (como no código anterior)
        if (role !== 'client') {
            linksContainer.classList.add('hidden');
        } else {
            linksContainer.classList.remove('hidden');
        }
    } else {
        // Caso não tenha a div, esconde item por item
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
                    // Adiciona o caminho da pasta uploads
                    imgUrl = '/uploads/' + c.profile_pic;
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
// Função Principal de Carregar Encomendas (ATUALIZADA COM FOTO)
// ==============================================================
// 1. FUNÇÃO DA TIMELINE VISUAL (Adicione antes do loadOrders)
// ==============================================================
function getTimelineHTML(status) {
    // Define os passos
    const steps = ['Recebido', 'Em Trânsito', 'Chegou', 'Entregue'];
    
    // Descobre em qual passo estamos
    let currentIdx = 0;
    if (status.match(/Recebido|Triagem|Processando/i)) currentIdx = 0;
    else if (status.match(/Trânsito|Voo|Enviado/i)) currentIdx = 1;
    else if (status.match(/Chegou|Armazém|Disponível/i)) currentIdx = 2;
    else if (status.match(/Entregue|Retirado|Finalizado/i)) currentIdx = 3;

    // Calcula % da barra verde
    const percent = (currentIdx / (steps.length - 1)) * 100;

    // Gera o HTML
    let html = `
        <div class="timeline-container" style="min-width: 250px; margin: 10px 0;">
            <div class="timeline-progress" style="width: ${percent}%"></div>
            <div style="display:flex; justify-content:space-between; position:relative; z-index:2;">`;

    const icons = ['📥', '✈️', '🏢', '✅'];

    steps.forEach((step, idx) => {
        const activeClass = idx <= currentIdx ? 'active' : '';
        // Só mostra o ícone se estiver ativo para ficar mais limpo
        const iconDisplay = idx <= currentIdx ? icons[idx] : `<div style="width:8px; height:8px; background:#ddd; border-radius:50%;"></div>`;
        
        // Estilo da bolinha
        let dotStyle = `width: 30px; height: 30px; background: white; border: 2px solid #ddd; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px;`;
        
        if(activeClass) {
            dotStyle = `width: 30px; height: 30px; background: #28a745; border: 2px solid #28a745; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; box-shadow: 0 0 5px rgba(40,167,69,0.4);`;
        }

        html += `
            <div class="timeline-step" style="display:flex; flex-direction:column; align-items:center;">
                <div style="${dotStyle}">${activeClass ? icons[idx] : ''}</div>
                <span style="font-size: 10px; color: #666; margin-top: 5px; font-weight: ${activeClass ? 'bold' : 'normal'}">${step}</span>
            </div>`;
    });

    html += `</div></div>`;
    return html;
}

// ==============================================================
// 2. FUNÇÃO LOAD ORDERS ATUALIZADA (COM BOTÃO DE AVARIA)
// ==============================================================
async function loadOrders() {
    if (!currentUser) return; 

    try {
        const res = await fetch('/api/orders');
        const list = await res.json();
        
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


function discardVideo() {
    currentBlob = null;
    recordedChunks = [];
    document.getElementById('video-preview').pause();
    document.getElementById('video-preview').src = "";
    document.getElementById('camera-feed').style.display = 'block';
    document.getElementById('video-preview').style.display = 'none';
    document.getElementById('camera-controls-ui').style.display = 'block';
    document.getElementById('preview-controls-ui').style.display = 'none';
}

async function confirmUpload() {
    if(!currentBlob) return alert("Erro: Nenhum vídeo gravado.");

    const clientSelect = document.getElementById('video-client-select');
    const clientId = clientSelect ? clientSelect.value : null;
    
    if (!clientId) return alert("⚠️ Erro: Selecione um Cliente/Encomenda na lista antes de enviar!");

    // Dados descritivos
    const descEl = document.getElementById('info-desc');
    const descText = descEl ? descEl.innerText : 'Vídeo de Encomenda';
    
    // Preparação do envio
    const formData = new FormData();
    formData.append('client_id', clientId);
    formData.append('description', descText);
    formData.append('video', currentBlob, `rec-${Date.now()}.webm`);

    // Feedback visual no botão
    let btn = document.querySelector('#preview-controls-ui .btn-primary');
    // Fallback se não achar o botão específico
    if(!btn) btn = document.querySelector('button[onclick="confirmUpload()"]');
    
    const oldText = btn ? btn.innerText : 'Enviar';
    if(btn) {
        btn.innerText = "Enviando... ⏳"; 
        btn.disabled = true;
    }

    try {
        const res = await fetch('/api/videos/upload', { method: 'POST', body: formData });
        
        // Verifica se a resposta é JSON válido
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error("Erro de servidor (Resposta não é JSON)");
        }

        const data = await res.json();
        
        if(data.success) {
            alert("✅ Vídeo enviado com sucesso!");
            
            // Recarrega a lista apropriada
            if(currentUser.role !== 'client') {
                 if(typeof loadAdminVideos === 'function') loadAdminVideos(); 
            } else {
                 if(typeof loadClientVideos === 'function') loadClientVideos();
            }
            
            // Reseta a interface de gravação
            discardVideo(); 
        } else {
            throw new Error(data.msg || "Erro desconhecido no upload");
        }
    } catch(e) { 
        console.error(e);
        alert("❌ Falha no envio: " + e.message); 
    } finally {
        // Restaura o botão sempre, mesmo se der erro
        if(btn) {
            btn.innerText = oldText; 
            btn.disabled = false;
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

// Função INTELIGENTE: Esconde o valor se for funcionário
async function loadInvoices() {
    const tbody = document.getElementById('invoices-list');
    if(!tbody) return;

    const res = await fetch('/api/invoices/list');
    const list = await res.json();

    tbody.innerHTML = '';
    
    list.forEach(inv => {
        let statusHtml = '';
        if(inv.status === 'approved') statusHtml = '<span style="color:green; font-weight:bold;">✅ PAGO</span>';
        else if(inv.status === 'pending') statusHtml = '<span style="color:orange; font-weight:bold;">⏳ Pendente</span>';
        else statusHtml = '<span style="color:red;">Cancelado</span>';

        // Botão de Excluir (SÓ ADMIN VÊ)
        let deleteBtn = '';
        if(currentUser && currentUser.role === 'admin') {
            deleteBtn = `<button onclick="deleteInvoice(${inv.id})" style="color:red; background:none; border:none; cursor:pointer; margin-left:10px;" title="Excluir"><i class="fas fa-trash"></i></button>`;
        }

        const checkBtn = `<button onclick="checkInvoiceStatus('${inv.mp_payment_id}', ${inv.id})" style="font-size:12px; cursor:pointer;" title="Verificar">🔄</button>`;

        // AQUI ESTÁ O TRUQUE:
        if (currentUser && currentUser.role === 'admin') {
            // ADMIN: Vê coluna de VALOR e AÇÕES completas
            tbody.innerHTML += `
            <tr>
                <td>#${inv.id}</td>
                <td>${inv.client_name}</td>
                <td>${inv.box_code || '-'}</td>
                <td>R$ ${inv.amount}</td> <td>${statusHtml}</td>
                <td>${checkBtn} ${deleteBtn}</td>
            </tr>`;
        } else {
            // FUNCIONÁRIO: Não tem a coluna de valor
            tbody.innerHTML += `
            <tr>
                <td>#${inv.id}</td>
                <td>${inv.client_name}</td>
                <td>${inv.box_code || '-'}</td>
                <td>${statusHtml}</td>
                <td>${checkBtn}</td>
            </tr>`;
        }
    });
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
// --- FUNÇÕES DE FATURA DO CLIENTE ---

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

            // Sanitiza a descrição (Troca aspas simples por código HTML)
            let rawDesc = inv.box_code ? `Box ${inv.box_code}` : `Fatura #${inv.id}`;
            let safeDesc = rawDesc.replace(/'/g, "&#39;").replace(/"/g, "&quot;");

            if(inv.status === 'approved') {
                statusHtml = '<span style="color:green; font-weight:bold;">✅ PAGO</span>';
                actionHtml = '<span style="color:#ccc; font-size:12px;">Concluído</span>';
            } else if(inv.status === 'pending') {
                statusHtml = '<span style="color:orange; font-weight:bold;">⏳ Pendente</span>';
                
                // CORREÇÃO: Usamos safeDesc para não quebrar o onclick
                actionHtml = `<button onclick="openPaymentModal('${inv.id}', '${safeDesc}', '${inv.amount}')" class="btn-primary" style="padding:5px 15px; font-size:12px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
                    💸 Pagar
                </button>`;
            } else {
                statusHtml = '<span style="color:red;">Cancelado</span>';
                actionHtml = '-';
            }

            tbody.innerHTML += `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding:12px;">#${inv.id}</td>
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
// --- SISTEMA DE ETIQUETAS ---

async function loadLabels() {
    // CORREÇÃO: Permite Admin e Employee (Funcionário)
    if (currentUser.role === 'client') {
        alert("Acesso restrito.");
        showSection('orders-view');
        return;
    }

    const tbody = document.getElementById('labels-list');
    if(!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" align="center">Carregando encomendas...</td></tr>';

    try {
        const res = await fetch('/api/orders'); 
        const orders = await res.json();
        
        tbody.innerHTML = '';

        if (!orders || orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" align="center">Nenhuma encomenda encontrada.</td></tr>';
            return;
        }

        // Ordena por data (mais recente primeiro)
        orders.sort((a, b) => b.id - a.id);

        orders.forEach(order => {
            const date = new Date(order.created_at).toLocaleDateString('pt-BR');
            // Sanitiza o JSON para o atributo data-obj não quebrar o HTML
            const orderJson = JSON.stringify(order).replace(/'/g, "&#39;");
            
            let row = `
                <tr>
                    <td><input type="checkbox" class="label-check" value="${order.id}" data-obj='${orderJson}'></td>
                    <td>${date}</td>
                    <td style="font-weight:bold;">${order.code}</td>
                    <td>${order.client_name || 'Desconhecido'} <br> <span style="font-size:11px; color:#666;">${order.client_phone || ''}</span></td>
                    <td>${order.description || '---'}</td>
                    <td>${order.weight || 0} kg</td>
                </tr>
            `;
            tbody.innerHTML += row;
        });

    } catch (err) {
        console.error("Erro ao carregar etiquetas:", err);
        tbody.innerHTML = '<tr><td colspan="6" align="center">Erro ao carregar dados.</td></tr>';
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

// 4. GERAR E IMPRIMIR ETIQUETAS (Tamanho Pequeno 100x150mm)
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
        
        // Estrutura HTML Otimizada para Térmica
        const labelDiv = document.createElement('div');
        labelDiv.className = 'shipping-label-container'; // Classe conectada ao @page label-page
        
        labelDiv.innerHTML = `
            <div class="lbl-header">
                <div class="lbl-logo">
                    <span class="lbl-logo-main">GE</span>
                    <span class="lbl-logo-sub">Ltda</span>
                </div>
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
                        <div class="lbl-title">PESO</div>
                        <div class="lbl-text" style="font-size: 16px;">${data.weight} kg</div>
                    </div>
                </div>
                
                <div class="lbl-box">
                    <div class="lbl-title">OBSERVAÇÕES</div>
                    <div style="font-size: 10px;">Entrega prevista: 14/01/2026 (Est.)</div>
                </div>
            </div>

            <div class="lbl-footer">
                <div>
                    <div class="lbl-title" style="border:none; margin:0;">RASTREIO</div>
                    <div style="font-size: 26px; font-weight: 900; letter-spacing: 2px;">${data.code}</div>
                </div>
                <div id="qr-${data.id}" style="background:#fff; padding:2px; border:1px solid #ddd;"></div>
            </div>
        `;

        printArea.appendChild(labelDiv);

        // QR Code
        new QRCode(document.getElementById(`qr-${data.id}`), {
            text: `CODE:${data.code}|${data.client_name}`,
            width: 70, height: 70,
            correctLevel : QRCode.CorrectLevel.L
        });
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

// 5. GERAR RECIBO A4 (Tamanho Normal - CORRIGIDO)
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
                    <div style="width:70px; height:70px; border:3px solid #d4af37; border-radius:50%; background:#000; color:#d4af37; display:flex; flex-direction:column; align-items:center; justify-content:center; -webkit-print-color-adjust: exact;">
                        <b style="font-size:24px; line-height:1;">GE</b>
                        <span style="font-size:9px; color:#fff;">LTDA</span>
                    </div>
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

            <div class="rec-grid">
                <div class="rec-box">
                    <h3>DADOS DO CLIENTE</h3>
                    <div class="rec-line"><strong>Nome:</strong> ${d.client_name}</div>
                    <div class="rec-line"><strong>Telefone:</strong> ${d.phone || '-'}</div>
                    <div class="rec-line"><strong>Documento:</strong> ${d.document || '-'}</div>
                    <div class="rec-line"><strong>Email:</strong> ${d.email || '-'}</div>
                </div>
                <div class="rec-box">
                    <h3>DADOS DO ENVIO</h3>
                    <div class="rec-line"><strong>Destino:</strong> ${d.country || 'Guiné-Bissau (GW)'}</div>
                    <div class="rec-line"><strong>Ref. Encomenda:</strong> ${d.order_code || '-'}</div>
                    <div class="rec-line"><strong>Peso Registrado:</strong> ${d.weight} kg</div>
                    <div class="rec-line"><strong>Status:</strong> ${d.order_status || 'Processando'}</div>
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
                Declaro que os itens acima listados foram conferidos e pesados na minha presença. <br>
                A Guineexpress não se responsabiliza por itens não declarados ou frágeis sem embalagem adequada.
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
// ==========================================
// LÓGICA DE AUDITORIA
// ==========================================
async function loadSystemLogs() {
    const list = document.getElementById('logs-list');
    if(!list) return;

    list.innerHTML = '<tr><td colspan="5" align="center">Carregando logs...</td></tr>';

    try {
        const res = await fetch('/api/admin/logs');
        const logs = await res.json();
        
        list.innerHTML = '';
        if(logs.length === 0) {
            list.innerHTML = '<tr><td colspan="5" align="center">Nenhum registro de segurança.</td></tr>';
            return;
        }

        logs.forEach(log => {
            const date = new Date(log.created_at).toLocaleString('pt-BR');
            
            // Corzinha para ações perigosas
            let colorStyle = '';
            if(log.action.includes('DELETE') || log.action.includes('EXCLUSÃO')) colorStyle = 'color:red; font-weight:bold;';
            if(log.action.includes('LOGIN')) colorStyle = 'color:green;';

            list.innerHTML += `
                <tr style="font-size: 12px;">
                    <td>${date}</td>
                    <td><strong>${log.user_name}</strong></td>
                    <td style="${colorStyle}">${log.action}</td>
                    <td>${log.details}</td>
                    <td style="color:#999;">${log.ip_address || '-'}</td>
                </tr>
            `;
        });

    } catch (err) {
        console.error(err);
        list.innerHTML = '<tr><td colspan="5">Erro ao carregar logs.</td></tr>';
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
                <td>${new Date(s.departure_date).toLocaleDateString('pt-BR')}</td>
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
    const steps = ['Recebido', 'Em Trânsito', 'Chegou BR', 'Entregue'];
    
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

    if (!subject || !message) return alert("❌ Preencha o assunto e a mensagem.");

    if (!confirm("⚠️ Tem a certeza? Isso enviará e-mails para TODOS os clientes.")) return;

    const btn = document.querySelector('#broadcast-modal .btn-primary');
    const oldText = btn.innerText;
    btn.innerText = "Enviando...";
    btn.disabled = true;

    try {
        const res = await fetch('/api/admin/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject, message })
        });
        
        const data = await res.json();

        if (data.success) {
            alert("✅ " + data.msg);
            closeModal('broadcast-modal');
            document.getElementById('broadcast-subject').value = '';
            document.getElementById('broadcast-message').value = '';
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