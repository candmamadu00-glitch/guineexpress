require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const app = express();
const fs = require('fs');
const multer = require('multer');
const nodemailer = require('nodemailer');
const helmet = require('helmet');
const compression = require('compression');
const MercadoPagoConfig = require('mercadopago').MercadoPagoConfig;
const Payment = require('mercadopago').Payment;
const cron = require('node-cron');
const path = require('path');

// --- 1. CONFIGURAÇÃO POSTGRESQL & SESSÃO ---
const { Pool } = require('pg');
const pgSession = require('connect-pg-simple')(session);

// Pool de conexão para a Sessão (Usa a mesma URL do banco)
const sessionPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Importa seu adaptador de banco de dados (database.js)
const db = require('./database'); 

// --- 2. CONFIGURAÇÃO CLOUDINARY (FOTOS E VÍDEOS) ---
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Storage para FOTOS (Perfil, Comprovantes)
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'guineexpress_fotos',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
        public_id: (req, file) => 'foto-' + Date.now()
    },
});
const upload = multer({ storage: storage });

// Storage para VÍDEOS (Encomendas)
const videoStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'guineexpress_videos',
        resource_type: 'video', // Importante para vídeos!
        allowed_formats: ['mp4', 'mov', 'avi'],
        public_id: (req, file) => 'video-' + Date.now()
    },
});
const uploadVideo = multer({ storage: videoStorage });

// --- 3. MIDDLEWARES DE SEGURANÇA E PERFORMANCE ---
app.use(helmet({ contentSecurityPolicy: false })); 
app.use(compression()); 
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// --- 4. SESSÃO PERSISTENTE (POSTGRESQL) ---
app.use(session({
    store: new pgSession({
        pool: sessionPool,                // Conexão Postgres
        tableName: 'session',             // Tabela onde salva (cria sozinha)
        createTableIfMissing: true        // Cria a tabela se não existir
    }),
    secret: process.env.SESSION_SECRET || 'guineexpress_segredo_super_forte',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 dias
        secure: false // Mude para 'true' se tiver HTTPS configurado
    } 
}));

// --- CONFIGURAÇÃO DE EMAIL (GMAIL) ---
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, 
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    tls: { rejectUnauthorized: false }
});

// Função Auxiliar de Email (Mantida igual)
async function sendEmailHtml(to, subject, title, message) {
    if (!to || to.includes('undefined')) return;
    const senderEmail = process.env.EMAIL_USER; 
    const htmlContent = `
    <div style="font-family: Arial; padding: 20px; border: 1px solid #ddd;">
        <h2 style="color: #0a1931;">${title}</h2>
        <p>${message}</p>
        <p style="font-size:12px; color:#777;">Guineexpress Logística</p>
    </div>`;
    try {
        await transporter.sendMail({
            from: `"Guineexpress" <${senderEmail}>`,
            to: to, subject: subject, html: htmlContent
        });
    } catch (error) { console.error("❌ Erro email:", error); }
}

// Log do Sistema (Mantido igual)
function logSystemAction(req, action, details) {
    const user = (req.session.user && req.session.user.name) ? req.session.user.name : 'Sistema';
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    db.run("INSERT INTO system_logs (user_name, action, details, ip_address) VALUES (?, ?, ?, ?)", 
        [user, action, details, ip], (err) => {});
}
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
const payment = new Payment(client);
// Segurança e Performance
app.use(helmet({ contentSecurityPolicy: false })); // Protege headers HTTP
app.use(compression()); // Comprime respostas para ficar mais rápido

// Garante pastas de upload
if (!fs.existsSync('uploads/videos')){ fs.mkdirSync('uploads/videos', { recursive: true }); }

// Configuração de armazenamento de vídeos
const videoStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/videos/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const uploadVideo = multer({ storage: videoStorage });
// -------------------------------------------------

// Servir a pasta de vídeos estática
app.use('/uploads/videos', express.static('uploads/videos'));

// Verificação de segurança do banco
if (!db || typeof db.get !== 'function') {
    console.error("ERRO CRÍTICO: Banco de dados não carregou. Verifique o final do arquivo database.js"); 
    process.exit(1);
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    store: new SQLiteStore({ db: 'sessions.db', dir: '.' }), // Salva sessão em arquivo
    secret: process.env.SESSION_SECRET || 'segredo_padrao',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 1000 * 60 * 60 * 24 * 7, // Login dura 7 dias
        secure: false // Mude para true quando tiver HTTPS
    } 
}));
// Permite que o navegador acesse os vídeos gravados
app.use('/uploads/videos', express.static('uploads/videos'));

// ==================================================================
// FUNÇÃO AUXILIAR: Detectar Dispositivo e Salvar Log
// ==================================================================
function logAccess(req, userInput, status, reason) {
    const userAgent = req.headers['user-agent'] || '';
    // Verifica se é mobile (Android, iPhone, etc)
    const isMobile = /mobile|android|iphone|ipad|phone/i.test(userAgent);
    const device = isMobile ? 'Celular 📱' : 'Computador 💻';
    
    // Pega o IP (considerando proxies como o Render)
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'IP Oculto';

    const sql = "INSERT INTO access_logs (user_input, status, reason, device, ip_address) VALUES (?, ?, ?, ?, ?)";
    db.run(sql, [userInput, status, reason, device, ip], (err) => {
        if(err) console.error("Erro ao salvar log:", err);
    });
}

// ==================================================================
// ROTA: LOGIN INTELIGENTE (COM RASTREAMENTO)
// ==================================================================
app.post('/api/login', (req, res) => {
    const { login, password, role } = req.body;

    // 1. Busca o usuário
    const sql = "SELECT * FROM users WHERE email = ? OR phone = ?";
    
    db.get(sql, [login, login], (err, user) => {
        if (err) {
            logAccess(req, login, 'Erro', 'Erro interno no Banco');
            return res.status(500).json({ success: false, msg: 'Erro interno.' });
        }

        // 2. Se não achou o usuário
        if (!user) {
            logAccess(req, login, 'Falha', 'Usuário não encontrado');
            return res.status(400).json({ success: false, msg: 'Usuário não encontrado.' });
        }

        // 3. Verifica se a conta está ativa
        if (user.active !== 1) {
            logAccess(req, login, 'Falha', 'Conta Desativada');
            return res.status(400).json({ success: false, msg: 'Conta desativada. Fale com o suporte.' });
        }

        // 4. Verifica a Senha
        if (!bcrypt.compareSync(password, user.password)) {
            // AQUI ESTÁ O PULO DO GATO: Salvamos que alguém tentou invadir
            logAccess(req, login, 'Falha', 'Senha Incorreta 🔒');
            return res.status(400).json({ success: false, msg: 'Senha incorreta.' });
        }

        // 5. Verifica o Cargo
        if (user.role !== role) {
            logAccess(req, login, 'Falha', `Cargo Errado (Tentou ${role} sendo ${user.role})`);
            return res.status(400).json({ 
                success: false, 
                msg: `Login incorreto! Você é ${user.role}, mas tentou entrar como ${role}.` 
            });
        }

        // 6. Sucesso Absoluto
        req.session.userId = user.id;
        req.session.role = user.role;
        req.session.user = user; // Salva o objeto user inteiro na sessão para facilitar
        
        // Registra o sucesso
        logAccess(req, login, 'Sucesso', `Login Realizado (${user.role}) ✅`);
        
        console.log(`✅ Login Sucesso: ${user.name}`);
        res.json({ success: true, role: user.role, name: user.name });
    });
});

// --- ROTA EXTRA: Para o Admin ver os Logs ---
app.get('/api/admin/logs', (req, res) => {
    if (!req.session.role || req.session.role !== 'admin') {
        return res.status(403).json([]);
    }
    // Pega os últimos 100 acessos, do mais recente para o mais antigo
    db.all("SELECT * FROM access_logs ORDER BY id DESC LIMIT 100", (err, rows) => {
        res.json(rows || []);
    });
});
app.post('/api/logout', (req, res) => { 
    // Usa callback para garantir que a sessão foi apagada do banco antes de responder
    req.session.destroy((err) => {
        if(err) console.error("Erro no logout:", err);
        res.json({success: true}); 
    });
});
// ROTA: Checar Sessão Ativa (Para Auto-Login)
app.get('/api/check-session', (req, res) => {
    // Verifica o objeto 'user' inteiro, que é o padrão mais robusto
    if (req.session.user) {
        res.json({ 
            loggedIn: true, 
            user: { 
                id: req.session.user.id,
                name: req.session.user.name,
                role: req.session.user.role,
                profile_pic: req.session.user.profile_pic // Importante para o frontend
            }
        });
    } else {
        res.json({ loggedIn: false });
    }
});
app.get('/api/user', (req, res) => {
    if (!req.session.userId) return res.status(401).json({});
    db.get("SELECT * FROM users WHERE id = ?", [req.session.userId], (err, row) => res.json(row));
});
// ROTA: Alterar Senha (CORRIGIDA)
app.post('/api/users/change-password', (req, res) => {
    // CORREÇÃO: Agora verificamos 'userId' em vez de 'user'
    if (!req.session.userId) {
        return res.status(401).json({ success: false, message: 'Não autorizado. Por favor, faça login novamente.' });
    }

    const { currentPass, newPass } = req.body;
    const userId = req.session.userId; // Pega o ID correto da sessão

    // 1. Busca a senha atual do banco
    db.get("SELECT password FROM users WHERE id = ?", [userId], (err, user) => {
        if (err || !user) return res.json({ success: false, message: "Erro ao buscar usuário." });

        // 2. Verifica se a senha atual confere
        if (!bcrypt.compareSync(currentPass, user.password)) {
            return res.json({ success: false, message: "❌ A senha atual está incorreta." });
        }

        // 3. Criptografa a nova senha e salva
        const newHash = bcrypt.hashSync(newPass, 10);
        db.run("UPDATE users SET password = ? WHERE id = ?", [newHash, userId], (err) => {
            if (err) return res.json({ success: false, message: "Erro ao atualizar." });
            res.json({ success: true, message: "✅ Senha alterada com sucesso!" });
        });
    });
});

// --- ROTA: Ler Logs do Sistema ---
app.get('/api/admin/logs', (req, res) => {
    // Apenas Admin pode ver
    // if (!req.session.role || req.session.role !== 'admin') return res.status(403).json([]);

    // CORREÇÃO: Lendo da tabela 'system_logs' ordenado pelo mais recente
    db.all("SELECT * FROM system_logs ORDER BY created_at DESC LIMIT 100", (err, rows) => {
        if (err) {
            console.error(err);
            return res.json([]);
        }
        res.json(rows);
    });
});
// --- ROTA QUE ESTAVA FALTANDO ---
app.get('/api/clients', (req, res) => {
    // Busca todos os usuários que são 'client'
    db.all("SELECT * FROM users WHERE role = 'client'", (err, rows) => {
        if(err) {
            console.error(err);
            return res.json([]);
        }
        res.json(rows);
    });
});
// --- ROTA DE DADOS COMPLETOS PARA O RECIBO ---
app.get('/api/full-receipt/:orderId', (req, res) => {
    const orderId = req.params.orderId;

    // 1. Busca dados da Encomenda + Cliente
    const sqlOrder = `
        SELECT orders.*, users.name as client_name, users.phone, users.document, users.country
        FROM orders
        JOIN users ON orders.client_id = users.id
        WHERE orders.id = ?
    `;

    // 2. Busca TODAS as Caixas vinculadas a essa encomenda
    const sqlBoxes = `SELECT * FROM boxes WHERE order_id = ?`;

    db.get(sqlOrder, [orderId], (err, order) => {
        if (err || !order) return res.json({ success: false, msg: "Encomenda não encontrada." });

        db.all(sqlBoxes, [orderId], (err, boxes) => {
            if (err) return res.json({ success: false, msg: "Erro nas caixas." });
            
            // Envia tudo junto para o frontend
            res.json({ success: true, order: order, boxes: boxes });
        });
    });
});
// --- ROTA DE CADASTRO (COM UPLOAD CLOUDINARY) ---
// Note o uso de 'upload.single' para processar a foto
app.post('/api/register', upload.single('profile_pic'), (req, res) => {
    const { name, email, phone, country, document, password } = req.body;

    // Validações básicas
    if (!name || !email || !password || !phone || !document) {
        return res.json({ success: false, msg: 'Preencha todos os campos obrigatórios.' });
    }
    if (password.length < 6) return res.json({ success: false, msg: 'Senha muito curta.' });

    // Pega a URL da foto do Cloudinary (ou usa padrão se não enviou)
    const profilePicUrl = req.file ? req.file.path : 'https://res.cloudinary.com/demo/image/upload/v1/default_avatar.png';

    // Verifica duplicação antes de criar
    db.get("SELECT id FROM users WHERE email = ? OR document = ?", [email, document], (err, row) => {
        if (row) {
            return res.json({ success: false, msg: 'E-mail ou Documento já cadastrado!' });
        }

        const hash = bcrypt.hashSync(password, 10);
        
        // Insere no PostgreSQL (o database.js converte a sintaxe automaticamente)
        db.run(`INSERT INTO users (role, name, email, phone, country, document, password, profile_pic) 
                VALUES ('client', ?, ?, ?, ?, ?, ?, ?)`, 
            [name, email, phone, country, document, hash, profilePicUrl], 
            (err) => {
                if (err) {
                    console.error("Erro cadastro:", err);
                    return res.json({ success: false, msg: 'Erro no banco de dados.' });
                }
                res.json({ success: true, msg: 'Conta criada com sucesso!' });
            }
        );
    });
});
// ==========================================
// CONTROLE DE DESPESAS (LUCRO REAL)
// ==========================================

// 1. Adicionar Despesa
app.post('/api/expenses/add', (req, res) => {
    if(req.session.role !== 'admin') return res.status(403).json({});
    const { description, category, amount, date } = req.body;
    
    db.run("INSERT INTO expenses (description, category, amount, date) VALUES (?, ?, ?, ?)", 
        [description, category, amount, date], 
        (err) => res.json({ success: !err })
    );
});

// 2. Listar Despesas
app.get('/api/expenses/list', (req, res) => {
    if(req.session.role !== 'admin') return res.status(403).json({});
    
    db.all("SELECT * FROM expenses ORDER BY date DESC", (err, rows) => {
        res.json(rows || []);
    });
});

app.post('/api/expenses/delete', (req, res) => {
    if(req.session.role !== 'admin') return res.status(403).json({});
    
    const id = req.body.id;

    // Primeiro buscamos o dado para saber o que está sendo apagado (para o log ficar rico)
    db.get("SELECT description, amount FROM expenses WHERE id = ?", [id], (err, row) => {
        if(row) {
            db.run("DELETE FROM expenses WHERE id = ?", [id], (err) => {
                if(!err) {
                    // GRAVA O LOG AQUI
                    logSystemAction(req, 'EXCLUSÃO FINANCEIRA', `Apagou despesa: ${row.description} (R$ ${row.amount})`);
                }
                res.json({ success: !err });
            });
        } else {
            res.json({ success: false });
        }
    });
});

// 4. Relatório Financeiro (Lucro Líquido)
app.get('/api/financial-report', (req, res) => {
    if(req.session.role !== 'admin') return res.status(403).json({});

    const sqlRevenue = "SELECT SUM(amount) as total FROM boxes"; // Ganhos (Boxes)
    const sqlExpenses = "SELECT SUM(amount) as total FROM expenses"; // Gastos

    db.get(sqlRevenue, [], (err, rev) => {
        const revenue = rev ? rev.total : 0;
        
        db.get(sqlExpenses, [], (err, exp) => {
            const expenses = exp ? exp.total : 0;
            const profit = revenue - expenses;

            res.json({
                revenue: revenue || 0,
                expenses: expenses || 0,
                profit: profit || 0
            });
        });
    });
});

app.post('/api/schedule/create-availability', (req, res) => {
    const { date, start_time, end_time, max_slots } = req.body;
    db.run("INSERT INTO availability (date, start_time, end_time, max_slots) VALUES (?,?,?,?)",
        [date, start_time, end_time, max_slots], (err) => res.json({ success: !err }));
});
app.get('/api/schedule/availability', (req, res) => {
    // PostgreSQL usa CURRENT_DATE em vez de date('now')
    db.all("SELECT * FROM availability WHERE date >= CURRENT_DATE ORDER BY date ASC, start_time ASC", [], (err, rows) => {
        if(err) return res.json([]);
        res.json(rows);
    });
});
app.post('/api/schedule/delete-availability', (req, res) => {
    // Primeiro apaga os agendamentos dessa janela
    db.run("DELETE FROM appointments WHERE availability_id = ?", [req.body.id], (err) => {
        // Depois apaga a janela
        db.run("DELETE FROM availability WHERE id = ?", [req.body.id], (err) => res.json({ success: !err }));
    });
});
app.post('/api/admin/broadcast', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ success: false });
    const { subject, message } = req.body;

    db.all("SELECT email, name FROM users WHERE role = 'client'", [], (err, clients) => {
        if (err || !clients) return res.json({ success: false });
        clients.forEach(c => sendEmailHtml(c.email, `📢 ${subject}`, subject, `Olá ${c.name},<br>${message}`));
        res.json({ success: true, msg: `Enviando para ${clients.length} clientes!` });
    });
});
app.get('/favicon.ico', (req, res) => res.status(204)); // Responde "Sem conteúdo" e para de reclamar
// 3. Rota INTELIGENTE: Quebra os horários em 15 min (CORREÇÃO DO ERRO AQUI)
app.get('/api/schedule/slots-15min', (req, res) => {
    db.all("SELECT * FROM availability WHERE date >= CURRENT_DATE ORDER BY date ASC, start_time ASC", [], (err, ranges) => {
        if(err) return res.json([]);

        db.all("SELECT availability_id, time_slot, status FROM appointments WHERE status != 'Cancelado'", [], (err2, bookings) => {
            if (err2 || !bookings) bookings = []; 

            let finalSlots = [];
            ranges.forEach(range => {
                // Data base fictícia para cálculo de horas
                let current = new Date(`2000-01-01T${range.start_time}`);
                let end = new Date(`2000-01-01T${range.end_time}`);

                while (current < end) {
                    let timeStr = current.toTimeString().substring(0,5);
                    // Filtra agendamentos já feitos
                    let taken = bookings.filter(b => b.availability_id === range.id && b.time_slot === timeStr).length;
                    
                    finalSlots.push({
                        availability_id: range.id,
                        date: range.date,
                        time: timeStr,
                        max_slots: range.max_slots,
                        taken: taken,
                        available: range.max_slots - taken
                    });
                    current.setMinutes(current.getMinutes() + 15);
                }
            });
            res.json(finalSlots);
        });
    });
});

// 4. Reservar
app.post('/api/schedule/book', (req, res) => {
    const { availability_id, date, time } = req.body;
    const client_id = req.session.userId; // Sessão via PostgreSQL

    // Verifica duplicidade no dia
    db.get(`SELECT ap.id FROM appointments ap JOIN availability av ON ap.availability_id = av.id 
            WHERE ap.client_id = ? AND av.date = ? AND ap.status != 'Cancelado'`, 
    [client_id, date], (err, hasBooking) => {
        if (hasBooking) return res.json({ success: false, msg: 'Você já tem um agendamento neste dia.' });

        // Verifica lotação
        db.get(`SELECT count(*) as qtd FROM appointments WHERE availability_id = ? AND time_slot = ? AND status != 'Cancelado'`, 
        [availability_id, time], (err, row) => {
            db.get("SELECT max_slots FROM availability WHERE id = ?", [availability_id], (err, avail) => {
                if (!avail) return res.json({success: false, msg: "Erro na vaga"});
                
                // Conversão de string para número (Postgres retorna count como string as vezes)
                if (parseInt(row.qtd) >= avail.max_slots) return res.json({ success: false, msg: 'Horário esgotado.' });

                db.run("INSERT INTO appointments (availability_id, client_id, time_slot, status) VALUES (?,?,?, 'Pendente')", 
                    [availability_id, client_id, time], (err) => res.json({success: !err}));
            });
        });
    });
});

// 5. Lista Agendamentos
app.get('/api/schedule/appointments', (req, res) => {
    let sql = `SELECT ap.id, ap.status, ap.time_slot, av.date, u.name as client_name, u.phone as client_phone 
               FROM appointments ap 
               JOIN availability av ON ap.availability_id = av.id 
               JOIN users u ON ap.client_id = u.id`;
    let params = [];
    if (req.session.role === 'client') { 
        sql += " WHERE ap.client_id = ?"; 
        params.push(req.session.userId); 
    }
    sql += " ORDER BY av.date ASC, ap.time_slot ASC";
    db.all(sql, params, (err, rows) => {
        res.json(rows || []);
    });
});
// Ações de Agendamento
app.post('/api/schedule/status', (req, res) => db.run("UPDATE appointments SET status = ? WHERE id = ?", [req.body.status, req.body.id], (err) => res.json({success: !err})));
app.post('/api/schedule/cancel', (req, res) => db.run("UPDATE appointments SET status = 'Cancelado' WHERE id = ? AND client_id = ?", [req.body.id, req.session.userId], (err) => res.json({success: !err})));

// Rota de Pedidos (Atualizada para trazer Telefone e Email)
app.get('/api/orders', (req, res) => {
    let sql = `SELECT orders.*, users.name as client_name, users.phone as client_phone, users.email as client_email 
               FROM orders JOIN users ON orders.client_id = users.id`;
    let params = [];
    if(req.session.role === 'client') { 
        sql += " WHERE client_id = ?"; 
        params.push(req.session.userId); 
    }
    sql += " ORDER BY orders.id DESC"; 
    db.all(sql, params, (err, rows) => res.json(rows || []));
});

app.get('/api/orders/by-client/:id', (req, res) => db.all("SELECT * FROM orders WHERE client_id = ?", [req.params.id], (err, rows) => res.json(rows)));
// --- ROTA CORRIGIDA: CRIAR ENCOMENDA (COM CÁLCULO DE PREÇO) ---
app.post('/api/orders/create', (req, res) => {
    const { client_id, code, description, weight, status } = req.body;

    db.get("SELECT value FROM settings WHERE key = 'price_per_kg'", (err, row) => {
        const pricePerKg = row ? parseFloat(row.value) : 0;
        const totalPrice = (parseFloat(weight) * pricePerKg).toFixed(2);

        // MUDANÇA: 'RETURNING id' é obrigatório no Postgres para pegar o ID gerado
        const sql = `INSERT INTO orders (client_id, code, description, weight, status, price) 
                     VALUES (?, ?, ?, ?, ?, ?) RETURNING id`;
                     
        // Usamos db.get porque queremos receber o ID de volta
        db.get(sql, [client_id, code, description, weight, status, totalPrice], (err, newRow) => {
            if (err) {
                if(err.message.includes('unique')) return res.json({ success: false, msg: "Código já existe." });
                return res.json({ success: false, msg: err.message });
            }
            // Sucesso: Retorna o ID que veio do banco
            res.json({ success: true, id: newRow.id });
        });
    });
});
// ATUALIZAR STATUS E ENVIAR EMAIL AUTOMÁTICO (COM FOTO)
app.post('/api/orders/update', (req, res) => {
    const { id, status, location, delivery_proof } = req.body;

    db.get(`SELECT orders.code, orders.description, users.email, users.name 
            FROM orders JOIN users ON orders.client_id = users.id WHERE orders.id = ?`, [id], (err, row) => {
        if (err || !row) return res.json({ success: false, msg: "Encomenda não encontrada" });

        let sql, params;
        if (delivery_proof) {
            sql = "UPDATE orders SET status = ?, delivery_proof = ?, delivery_location = ? WHERE id = ?";
            params = [status, delivery_proof, location || 'Local não informado', id];
        } else {
            sql = "UPDATE orders SET status = ? WHERE id = ?";
            params = [status, id];
        }

        db.run(sql, params, (errUpdate) => {
            if (errUpdate) return res.json({ success: false });

            // Envia Email
            if (row.email) {
                const subject = `Atualização: Encomenda ${row.code} - ${status}`;
                let msg = `Olá, <strong>${row.name}</strong>.<br>Status: <strong>${status}</strong>`;
                if (delivery_proof) msg += `<br>📦 Entrega confirmada.`;
                sendEmailHtml(row.email, subject, `Status: ${status}`, msg);
            }
            res.json({ success: true });
        });
    });
});
app.get('/api/boxes', (req, res) => {
    let sql = `SELECT boxes.*, users.name as client_name, orders.code as order_code 
               FROM boxes JOIN users ON boxes.client_id = users.id 
               LEFT JOIN orders ON boxes.order_id = orders.id`;
    let params = [];
    if(req.session.role === 'client') { sql += " WHERE boxes.client_id = ?"; params.push(req.session.userId); }
    db.all(sql, params, (err, rows) => res.json(rows || []));
});

app.post('/api/boxes/create', (req, res) => {
    const {client_id, order_id, box_code, products, amount} = req.body;
    db.run("INSERT INTO boxes (client_id, order_id, box_code, products, amount) VALUES (?,?,?,?,?)", 
        [client_id, order_id, box_code, products, amount], (err) => res.json({success: !err}));
});

app.post('/api/boxes/delete', (req, res) => db.run("DELETE FROM boxes WHERE id = ?", [req.body.id], (err) => res.json({success: !err})));
app.post('/api/user/update', upload.single('profile_pic'), (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false, message: "Sessão expirada." });

    const { name, phone, email, password } = req.body;
    const userId = req.session.user.id;
    let sql, params;

    // Se enviou foto nova, o Cloudinary já devolveu a URL em req.file.path
    if (req.file) {
        const fileUrl = req.file.path; // URL do Cloudinary

        if (password && password.trim() !== "") {
            const hash = bcrypt.hashSync(password, 10);
            sql = "UPDATE users SET name=?, phone=?, email=?, profile_pic=?, password=? WHERE id=?";
            params = [name, phone, email, fileUrl, hash, userId];
        } else {
            sql = "UPDATE users SET name=?, phone=?, email=?, profile_pic=? WHERE id=?";
            params = [name, phone, email, fileUrl, userId];
        }
    } else {
        // Mantém foto antiga
        if (password && password.trim() !== "") {
            const hash = bcrypt.hashSync(password, 10);
            sql = "UPDATE users SET name=?, phone=?, email=?, password=? WHERE id=?";
            params = [name, phone, email, hash, userId];
        } else {
            sql = "UPDATE users SET name=?, phone=?, email=? WHERE id=?";
            params = [name, phone, email, userId];
        }
    }

    db.run(sql, params, (err) => {
        if (err) return res.json({ success: false, message: "Erro ao atualizar." });

        // Atualiza sessão em tempo real
        req.session.user.name = name;
        req.session.user.email = email;
        if (req.file) req.session.user.profile_pic = req.file.path;

        res.json({ success: true, message: "Perfil atualizado!", newProfilePic: req.session.user.profile_pic });
    });
});
app.post('/api/clients/toggle', (req, res) => db.run("UPDATE users SET active = ? WHERE id = ?", [req.body.active, req.body.id], () => res.json({ success: true })));
// --- ROTA DE PREÇO (CONFIGURAÇÃO) ---
// Configuração de Preço KG
app.get('/api/config/price', (req, res) => {
    db.get("SELECT value FROM settings WHERE key = 'price_per_kg'", (err, row) => res.json({ price: row ? row.value : 0 }));
});
app.post('/api/config/price', (req, res) => {
    if(req.session.role !== 'admin') return res.status(403).json({});
    // No Postgres, usamos ON CONFLICT para insert or replace
    const sql = "INSERT INTO settings (key, value) VALUES ('price_per_kg', ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value";
    db.run(sql, [req.body.price], (err) => res.json({ success: !err }));
});
// --- CORREÇÃO DA ROTA DE UPLOAD DE VÍDEO ---
app.post('/api/videos/upload', uploadVideo.single('video'), (req, res) => {
    if(!req.file) return res.status(400).json({success: false, msg: "Nenhum vídeo enviado."});
    
    const { client_id, description } = req.body;
    
    // Salva a URL do Cloudinary (req.file.path)
    db.run("INSERT INTO videos (client_id, filename, description) VALUES (?, ?, ?)", 
    [client_id, req.file.path, description], (err) => {
        if(err) return res.status(500).json({success: false, msg: "Erro no banco."});
        res.json({success: true});
    });
});

// 2. Listar Vídeos
app.get('/api/videos/list', (req, res) => {
    if(req.session.role === 'client') {
        db.all("SELECT * FROM videos WHERE client_id = ? ORDER BY id DESC", [req.session.userId], (err, rows) => res.json(rows));
    } else {
        db.all(`SELECT videos.*, users.name as client_name FROM videos 
                LEFT JOIN users ON videos.client_id = users.id ORDER BY videos.id DESC`, (err, rows) => res.json(rows));
    }
});

app.post('/api/videos/delete', (req, res) => {
    if(req.session.role === 'client') return res.status(403).json({});
    db.run("DELETE FROM videos WHERE id = ?", [req.body.id], (err) => res.json({success: !err}));
});
// CRIAR FATURA E ENVIAR EMAIL DE COBRANÇA
app.post('/api/invoices/create', async (req, res) => {
    if(req.session.role !== 'admin') return res.status(403).json({msg: 'Sem permissão'});
    const { client_id, box_id, amount, description, email } = req.body;

    try {
        // Gera Pix no Mercado Pago
        const paymentData = {
            transaction_amount: parseFloat(amount),
            description: description,
            payment_method_id: 'pix',
            payer: { email: email || 'cliente@guineexpress.com' }
        };
        const result = await payment.create({ body: paymentData });
        const mp_id = result.id;
        const ticket_url = result.point_of_interaction.transaction_data.ticket_url;

        db.run(`INSERT INTO invoices (client_id, box_id, amount, description, status, mp_payment_id, qr_code, qr_code_base64, payment_link) 
                VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
                [client_id, box_id, amount, description, mp_id, 
                 result.point_of_interaction.transaction_data.qr_code, 
                 result.point_of_interaction.transaction_data.qr_code_base64, 
                 ticket_url],
                (err) => {
                    if(err) return res.json({success: false});
                    if (email) sendEmailHtml(email, `Fatura: ${description}`, "Pagamento Pendente", `Pague aqui: <a href="${ticket_url}">LINK PIX</a>`);
                    res.json({success: true});
                });
    } catch (error) {
        res.json({success: false, msg: 'Erro Mercado Pago'});
    }
});

// 2. Listar Faturas
app.get('/api/invoices/list', (req, res) => {
    let sql = `SELECT invoices.*, users.name as client_name, boxes.box_code FROM invoices 
               LEFT JOIN users ON invoices.client_id = users.id LEFT JOIN boxes ON invoices.box_id = boxes.id`;
    let params = [];
    if(req.session.role === 'client') {
        sql += " WHERE invoices.client_id = ?";
        params.push(req.session.userId);
    } 
    sql += " ORDER BY invoices.id DESC";
    db.all(sql, params, (err, rows) => res.json(rows || []));
});

// 3. Excluir Cobrança (Admin)
app.post('/api/invoices/delete', (req, res) => {
    if(req.session.role !== 'admin') return res.status(403).json({});
    db.run("DELETE FROM invoices WHERE id = ?", [req.body.id], (err) => res.json({success: !err}));
});

// 4. Verificar Status (Webhook Simulado)
// O botão "Verificar Pagamento" vai chamar isso para atualizar o status real
app.post('/api/invoices/check-status', async (req, res) => {
    const { mp_payment_id, invoice_id } = req.body;
    
    try {
        // Consulta o status atual no Mercado Pago
        const checkPayment = await new Payment(client).get({ id: mp_payment_id });
        const currentStatus = checkPayment.status; // 'approved', 'pending', etc.

        // Atualiza no banco
        db.run("UPDATE invoices SET status = ? WHERE id = ?", [currentStatus, invoice_id], (err) => {
            res.json({ success: true, status: currentStatus });
        });

    } catch (error) {
        res.json({ success: false });
    }
});
// ======================================================
// 🚀 INÍCIO DAS ROTAS DE PAGAMENTO (PIX E CARTÃO)
// ======================================================

// ======================================================
// 1. ROTA DE PIX (ATUALIZADA)
// ======================================================
app.post('/api/create-pix', async (req, res) => {
    try {
        const { amount, description, email, firstName } = req.body;

        const payment = new Payment(client);

        const body = {
            transaction_amount: parseFloat(amount),
            description: description || 'Pagamento Guineexpress',
            payment_method_id: 'pix',
            payer: {
                email: email || 'email@cliente.com',
                first_name: firstName || 'Cliente'
            },
            date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString()
        };

        const result = await payment.create({ body });

        // RETORNA O ID DO PAGAMENTO PARA O FRONTEND MONITORAR
        res.json({
            payment_id: result.id, // O frontend precisa disso para o Robô
            qr_code: result.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: result.point_of_interaction.transaction_data.qr_code_base64
        });

    } catch (error) {
        console.error("Erro ao gerar Pix:", error);
        res.status(500).json({ error: 'Erro ao conectar com Mercado Pago' });
    }
});

// ======================================================
// 2. NOVA ROTA: CHECAR STATUS (O ROBÔ USA ESSA)
// ======================================================
app.post('/api/check-payment-status', async (req, res) => {
    try {
        // Recebe o ID do pagamento (MP) e o ID da fatura (Banco de dados)
        const { payment_id, invoice_id } = req.body;

        const payment = new Payment(client);
        
        // Pergunta ao Mercado Pago: "E aí, esse ID já pagou?"
        const result = await payment.get({ id: payment_id });

        const status = result.status; // 'pending', 'approved', 'rejected'

        if (status === 'approved') {
            // SE O DINHEIRO CAIU, ATUALIZA O BANCO SOZINHO!
            
            // 1. Atualiza a fatura para 'approved'
            db.run("UPDATE invoices SET status = 'approved', mp_payment_id = ? WHERE id = ?", 
                [payment_id, invoice_id], 
                (err) => {
                    if (err) console.error("Erro ao atualizar fatura:", err);
                    else console.log(`✅ Fatura #${invoice_id} paga via PIX Automático!`);
                }
            );

            // 2. (Opcional) Se a fatura for de um Box, acha o Box e a Encomenda e marca como Pago
            // Isso garante que a encomenda mude de cor na tabela
            db.get("SELECT box_id FROM invoices WHERE id = ?", [invoice_id], (err, row) => {
                if(row && row.box_id) {
                    db.run("UPDATE orders SET status = 'Pago' WHERE id IN (SELECT order_id FROM boxes WHERE id = ?)", [row.box_id]);
                }
            });
        }

        // Responde para o frontend (o robô vai ler isso)
        res.json({ status: status });

    } catch (error) {
        console.error("Erro ao verificar status:", error);
        res.status(500).json({ error: "Erro na verificação" });
    }
});

// ======================================================
// 3. ROTA CARTÃO (MANTENHA COMO ESTÁ, SÓ PULE ELA)
// ======================================================

// 2. Rota para gerar Link de Cartão (Checkout Pro)
app.post('/api/create-preference', async (req, res) => {
    try {
        const { title, price, quantity } = req.body;

        const preference = new Preference(client);

        const body = {
            items: [
                {
                    title: title,
                    quantity: Number(quantity),
                    unit_price: Number(price),
                    currency_id: 'BRL',
                },
            ],
            // Configure para onde o cliente volta depois de pagar
            back_urls: {
                success: 'https://seusite.com/dashboard-client.html', // Mude para seu domínio real
                failure: 'https://seusite.com/dashboard-client.html',
                pending: 'https://seusite.com/dashboard-client.html',
            },
            auto_return: 'approved',
        };

        const result = await preference.create({ body });

        // Devolve o link para redirecionar o cliente
        res.json({ init_point: result.init_point });

    } catch (error) {
        console.error("Erro ao criar preferência:", error);
        res.status(500).json({ error: 'Erro ao criar checkout' });
    }
});

// ======================================================
// 🏁 FIM DAS ROTAS DE PAGAMENTO
// ======================================================
// --- ROTA: PEGAR FATURAS DO CLIENTE LOGADO (CORRIGIDA) ---
app.get('/api/invoices/my_invoices', (req, res) => {
    // 1. Verifica se o ID do usuário está na sessão (Correção aqui)
    if (!req.session.userId) {
        return res.status(401).json({ msg: 'Usuário não autenticado' });
    }

    const clientId = req.session.userId; // Correção: usa userId direto

    // 2. Busca as faturas
    // Nota: Se der erro de 'no such column: mp_payment_link', remova essa coluna do SELECT abaixo
    const sql = `
        SELECT i.id, i.amount, i.status, i.payment_link, b.box_code
        FROM invoices i
        LEFT JOIN boxes b ON i.box_id = b.id
        WHERE i.client_id = ?
        ORDER BY i.id DESC
    `;

    db.all(sql, [clientId], (err, rows) => {
        if (err) {
            console.error("Erro ao buscar faturas:", err);
            return res.status(500).json({ err: err.message });
        }
        res.json(rows);
    });
});
// --- ROTA: RECUPERAR SENHA (CORRIGIDA) ---
app.post('/api/recover-password', (req, res) => {
    const { email } = req.body;
    db.get("SELECT * FROM users WHERE email = ? AND role = 'client'", [email], (err, user) => {
        if (err || !user) return res.json({ success: false, msg: "E-mail não encontrado." });

        const newPass = Math.random().toString(36).slice(-6).toUpperCase();
        const hash = bcrypt.hashSync(newPass, 10);

        db.run("UPDATE users SET password = ? WHERE id = ?", [hash, user.id], (err) => {
            if (err) return res.json({ success: false });
            sendEmailHtml(user.email, "Nova Senha", "Recuperação", `Sua nova senha é: <b>${newPass}</b>`);
            res.json({ success: true, msg: "Senha enviada para o e-mail." });
        });
    });
});
// --- ROTA: HISTÓRICO DE ENVIOS ---
app.get('/api/history', (req, res) => {
    let sql = `SELECT orders.*, users.name as client_name 
               FROM orders 
               JOIN users ON orders.client_id = users.id`;
    let params = [];

    if (req.session.role === 'client') {
        sql += " WHERE orders.client_id = ?";
        params.push(req.session.userId);
    }
    // PostgreSQL: Ordenação padrão
    sql += " ORDER BY orders.created_at DESC";

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error(err);
            return res.json([]);
        }
        res.json(rows || []);
    });
});
// =======================================================
// ROTA DE IMPRESSÃO INTELIGENTE (RECIBO COMPLETO)
// =======================================================
app.get('/api/print-receipt/:boxId', (req, res) => {
    const boxId = req.params.boxId;

    db.get("SELECT * FROM boxes WHERE id = ?", [boxId], (err, currentBox) => {
        if (err || !currentBox) return res.json({ success: false, msg: "Box não encontrado." });

        let sqlData = "";
        let params = [];

        if (currentBox.order_id) {
            sqlData = `
                SELECT orders.code as order_code, orders.status as order_status, orders.created_at as order_date,
                       users.name as client_name, users.phone, users.document, users.email, users.country
                FROM orders
                JOIN users ON orders.client_id = users.id
                WHERE orders.id = ?
            `;
            params = [currentBox.order_id];
        } else {
            sqlData = `SELECT name as client_name, phone, document, email, country FROM users WHERE id = ?`;
            params = [currentBox.client_id];
        }

        db.get(sqlData, params, (err, dataInfo) => {
            if (err) return res.json({ success: false, msg: "Erro ao buscar dados." });

            let sqlAllBoxes = "";
            let paramsBoxes = [];

            if (currentBox.order_id) {
                sqlAllBoxes = "SELECT * FROM boxes WHERE order_id = ?";
                paramsBoxes = [currentBox.order_id];
            } else {
                sqlAllBoxes = "SELECT * FROM boxes WHERE id = ?";
                paramsBoxes = [boxId];
            }

            db.all(sqlAllBoxes, paramsBoxes, (err, allBoxes) => {
                res.json({ 
                    success: true, 
                    info: dataInfo || {}, 
                    boxes: allBoxes,       
                    currentBox: currentBox 
                });
            });
        });
    });
});
// ==========================================
// ROTA DASHBOARD BI (ESTATÍSTICAS)
// ==========================================
app.get('/api/dashboard-stats', (req, res) => {
    
    const sqlTotals = `
        SELECT 
            (SELECT SUM(price) FROM orders) as revenue,
            (SELECT SUM(weight) FROM orders) as weight,
            (SELECT COUNT(*) FROM orders) as totalOrders,
            (SELECT COUNT(*) FROM users WHERE role = 'client') as totalClients
    `;

    const sqlStatus = "SELECT status, COUNT(*) as count FROM orders GROUP BY status";

    // --- CORREÇÃO IMPORTANTE PARA POSTGRESQL ---
    // Substituímos strftime por TO_CHAR e date('now') por CURRENT_DATE
    const sqlMonthly = `
        SELECT TO_CHAR(created_at, 'MM/YYYY') as month, SUM(price) as total 
        FROM orders 
        WHERE created_at >= (CURRENT_DATE - INTERVAL '6 months') 
        GROUP BY TO_CHAR(created_at, 'MM/YYYY') 
        ORDER BY MIN(created_at) ASC
    `;

    db.get(sqlTotals, [], (err, totals) => {
        if (err) return res.json({ success: false });

        db.all(sqlStatus, [], (err, statusRows) => {
            db.all(sqlMonthly, [], (err, monthlyRows) => {
                res.json({
                    success: true,
                    data: {
                        revenue: totals.revenue || 0,
                        weight: totals.weight || 0,
                        totalOrders: totals.totalOrders || 0,
                        totalClients: totals.totalClients || 0,
                        statusDistribution: statusRows || [],
                        revenueHistory: monthlyRows || [] 
                    }
                });
            });
        });
    });
});
// ==========================================
// ROTA DO RECIBO PRO (COM STATUS DE PAGAMENTO)
// ==========================================
app.get('/api/receipt-data/:boxId', (req, res) => {
    const boxId = req.params.boxId;

    const sqlBox = `
        SELECT 
            boxes.id, boxes.box_code, boxes.amount, boxes.products, boxes.created_at,
            orders.weight as weight, 
            orders.code as order_code,
            users.name as client_name, users.phone, users.document, users.country, users.email,
            invoices.status as payment_status 
        FROM boxes
        LEFT JOIN users ON boxes.client_id = users.id
        LEFT JOIN orders ON boxes.order_id = orders.id
        LEFT JOIN invoices ON boxes.id = invoices.box_id
        WHERE boxes.id = ?
    `;

    db.get(sqlBox, [boxId], (err, box) => {
        if (err || !box) return res.json({ success: false, msg: "Box não encontrada." });

        db.get("SELECT value FROM settings WHERE key = 'price_per_kg'", (err2, setting) => {
            let pricePerKg = setting ? parseFloat(setting.value) : 0;
            let currentAmount = parseFloat(box.amount) || 0;
            let weight = parseFloat(box.weight) || 0;

            if (currentAmount === 0 && weight > 0 && pricePerKg > 0) {
                currentAmount = weight * pricePerKg;
            }

            box.amount = currentAmount.toFixed(2);
            box.weight = weight.toFixed(2);
            box.is_paid = (box.payment_status === 'approved'); 

            res.json({ success: true, data: box });
        });
    });
});
// ==========================================
// SISTEMA DE BACKUP AUTOMÁTICO
// ==========================================

// Função que executa a cópia do arquivo
function performBackup() {
    const backupDir = './backups';
    const dbFile = './guineexpress_v4.db';
    
    // 1. Cria a pasta 'backups' se não existir
    if (!fs.existsSync(backupDir)){
        fs.mkdirSync(backupDir);
    }

    // 2. Gera nome do arquivo com Data e Hora (ex: backup-2023-10-25-1430.db)
    const date = new Date();
    const timestamp = date.toISOString().replace(/[:.]/g, '-').slice(0, 16); // Formata data
    const destFile = path.join(backupDir, `backup-${timestamp}.db`);

    // 3. Copia o arquivo
    fs.copyFile(dbFile, destFile, (err) => {
        if (err) {
            console.error('❌ Erro no Backup:', err);
        } else {
            console.log(`✅ Backup realizado com sucesso: ${destFile}`);
            
            // (Opcional) Limpeza: Mantém apenas os últimos 7 backups para não encher o disco
            fs.readdir(backupDir, (err, files) => {
                if (files.length > 30) {
                    // Lógica simples para remover os mais antigos se tiver muitos
                    const oldFile = path.join(backupDir, files[0]);
                    fs.unlink(oldFile, () => console.log("Backup antigo removido."));
                }
            });
        }
    });
}

// AGENDAMENTO: Roda todo dia à 00:00 (Meia-noite)
cron.schedule('0 0 * * *', () => {
    console.log('⏳ Iniciando backup automático...');
    performBackup();
});

// ROTA MANUAL: Para chamar via botão no Painel
app.get('/api/admin/force-backup', (req, res) => {
    res.json({ success: true, msg: "No PostgreSQL (Render), o backup é gerenciado na nuvem, não por arquivo local." });
});
// ==========================================
// LOGÍSTICA DE EMBARQUES (MANIFESTO)
// ==========================================

// 1. Criar Novo Embarque
app.post('/api/shipments/create', (req, res) => {
    if(req.session.role !== 'admin') return res.status(403).json({});
    const { code, type, departure_date } = req.body;
    
    db.run("INSERT INTO shipments (code, type, status, departure_date) VALUES (?, ?, 'Aberto', ?)", 
        [code, type, departure_date], (err) => res.json({ success: !err }));
});

// 2. Listar Embarques
app.get('/api/shipments/list', (req, res) => {
    const sql = `SELECT s.*, COUNT(b.id) as box_count 
                 FROM shipments s 
                 LEFT JOIN boxes b ON b.shipment_id = s.id 
                 GROUP BY s.id ORDER BY s.id DESC`;
    db.all(sql, (err, rows) => res.json(rows || []));
});

// 3. Listar Caixas "Órfãs" (Sem embarque)
app.get('/api/shipments/pending-boxes', (req, res) => {
    const sql = `SELECT b.id, b.box_code, u.name as client_name 
                 FROM boxes b 
                 JOIN users u ON b.client_id = u.id 
                 WHERE b.shipment_id IS NULL OR b.shipment_id = 0`;
    db.all(sql, (err, rows) => res.json(rows || []));
});

// 4. Adicionar Caixa ao Embarque
app.post('/api/shipments/add-box', (req, res) => {
    if(req.session.role !== 'admin') return res.status(403).json({});
    db.run("UPDATE boxes SET shipment_id = ? WHERE id = ?", [req.body.shipment_id, req.body.box_id], (err) => res.json({ success: !err }));
});

// 5. Dados para o Manifesto (Impressão)
app.get('/api/shipments/manifest/:id', (req, res) => {
    const shipId = req.params.id;
    db.get("SELECT * FROM shipments WHERE id = ?", [shipId], (err, shipment) => {
        if(!shipment) return res.json({ success: false });

        const sqlItems = `
            SELECT b.box_code, b.products, u.name as client_name, u.document, u.country, o.weight 
            FROM boxes b
            JOIN users u ON b.client_id = u.id
            LEFT JOIN orders o ON b.order_id = o.id
            WHERE b.shipment_id = ?
        `;
        db.all(sqlItems, [shipId], (err, items) => res.json({ success: true, shipment, items }));
    });
});
// --- ROTA: Pegar UMA encomenda pelo ID (Para preencher o modal de edição) ---
app.put('/api/orders/:id', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ success: false });

    const { client_id, code, description, weight, status } = req.body;
    const id = req.params.id;

    db.get("SELECT value FROM settings WHERE key = 'price_per_kg'", (err, row) => {
        const pricePerKg = row ? parseFloat(row.value) : 0;
        const newPrice = (parseFloat(weight) * pricePerKg).toFixed(2);

        const sql = `UPDATE orders SET client_id = ?, code = ?, description = ?, weight = ?, status = ?, price = ? WHERE id = ?`;
        db.run(sql, [client_id, code, description, weight, status, newPrice, id], (err) => res.json({ success: !err }));
    });
});

// --- ROTA: Atualizar Encomenda (CORRIGIDA) ---
app.put('/api/orders/:id', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ success: false });

    const { client_id, code, description, weight, status } = req.body;
    const id = req.params.id;

    // 1. Busca o preço atual no banco para recalcular
    db.get("SELECT value FROM settings WHERE key = 'price_per_kg'", (err, row) => {
        // Se não achar, usa 0
        const pricePerKg = row ? parseFloat(row.value) : 0;
        
        // 2. Recalcula o preço novo (Peso Editado * Preço Atual)
        const newPrice = (parseFloat(weight) * pricePerKg).toFixed(2);

        const sql = `
            UPDATE orders 
            SET client_id = ?, code = ?, description = ?, weight = ?, status = ?, price = ?
            WHERE id = ?
        `;

        // 3. Salva com o preço correto
        db.run(sql, [client_id, code, description, weight, status, newPrice, id], function(err) {
            if (err) {
                console.error(err);
                return res.json({ success: false, message: "Erro ao atualizar no banco." });
            }
            res.json({ success: true });
        });
    });
});
// --- ROTA: Excluir Encomenda (CORRIGIDA) ---
app.delete('/api/orders/:id', (req, res) => {
    if (!req.session.userId || req.session.role === 'client') {
        return res.status(403).json({ success: false, message: 'Sem permissão' });
    }

    const id = req.params.id;
    const userName = (req.session.user && req.session.user.name) ? req.session.user.name : 'Staff';
    // Correção de IP para o Render
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    db.get("SELECT code FROM orders WHERE id = ?", [id], (err, row) => {
        const orderCode = row ? row.code : 'Desconhecido';

        db.run("DELETE FROM orders WHERE id = ?", [id], (err) => {
            if (err) return res.json({ success: false, message: "Erro ao excluir." });

            const details = `Apagou a encomenda ${orderCode} (ID: ${id})`;
            db.run(`INSERT INTO system_logs (user_name, action, details, ip_address) VALUES (?, ?, ?, ?)`, 
                [userName, "EXCLUSÃO", details, ip], (logErr) => {});

            res.json({ success: true });
        });
    });
});
// Certifique-se que a rota está assim:
app.get('/api/admin/employees', (req, res) => {
    if (!req.session.role || req.session.role !== 'admin') return res.status(403).json({ success: false });
    db.all("SELECT id, name, email, active, phone FROM users WHERE role = 'employee'", (err, rows) => {
        res.json({ success: true, employees: rows || [] });
    });
});
// --- ROTA: Listar Funcionários (Para o Admin) ---
app.get('/api/admin/employees', (req, res) => {
    // Verifica se é admin
    if (!req.session.role || req.session.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Sem permissão' });
    }

    // Busca apenas usuários com cargo 'employee'
    db.all("SELECT id, name, email, active, phone FROM users WHERE role = 'employee'", (err, rows) => {
        if (err) {
            console.error(err);
            return res.json({ success: false, employees: [] });
        }
        res.json({ success: true, employees: rows });
    });
});

// --- ROTA: Ativar/Desativar Funcionário ---
app.post('/api/admin/toggle-employee', (req, res) => {
    if (!req.session.role || req.session.role !== 'admin') return res.status(403).json({});
    db.run("UPDATE users SET active = ? WHERE id = ?", [req.body.active, req.body.id], (err) => res.json({ success: !err }));
});
// --- ROTA: Pegar dados do Usuário Logado (Para o Painel) ---
app.get('/api/user/me', (req, res) => {
    if (req.session.user) {
        res.json({ 
            success: true, 
            name: req.session.user.name,
            profile_pic: req.session.user.profile_pic 
        });
    } else {
        res.json({ success: false });
    }
});

// =====================================================
// INICIALIZAÇÃO DO SERVIDOR
// =====================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Servidor Guineexpress rodando na porta ${PORT}`);
    console.log(`📡 Modo: ${process.env.NODE_ENV || 'Desenvolvimento'}`);
    console.log(`💽 Banco: PostgreSQL`);
});