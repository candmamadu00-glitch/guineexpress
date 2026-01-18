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
const Preference = require('mercadopago').Preference;
const cron = require('node-cron'); 
const path = require('path'); 
const SQLiteStore = require('connect-sqlite3')(session);
const sqlite3 = require('sqlite3').verbose();

// =============================================================
// 1. CONEXÃO E CORREÇÃO DO BANCO DE DADOS (INTEGRADO)
// =============================================================
// Conecta ao banco principal
const db = new sqlite3.Database('./guineexpress_v4.db', (err) => {
    if (err) console.error("Erro ao conectar no banco:", err);
    else console.log("✅ Banco de dados conectado.");
});

// --- PATCH DE CORREÇÃO E CRIAÇÃO DE TABELAS ---
db.serialize(() => {
    console.log("🔄 Verificando integridade do banco de dados...");

    // 1. Adiciona colunas que faltavam (Corrige o erro SQLITE_ERROR)
    // O callback vazio () => {} ignora o erro se a coluna já existir
    db.run("ALTER TABLE orders ADD COLUMN delivery_proof TEXT", () => {}); 
    db.run("ALTER TABLE orders ADD COLUMN proof_image TEXT", () => {});      
    db.run("ALTER TABLE orders ADD COLUMN delivery_location TEXT", () => {}); 
    db.run("ALTER TABLE invoices ADD COLUMN mp_payment_id TEXT", () => {});
    db.run("ALTER TABLE boxes ADD COLUMN shipment_id INTEGER REFERENCES shipments(id)", () => {});

    // 2. Tabela de Usuários
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT, 
        name TEXT, 
        email TEXT UNIQUE, 
        phone TEXT, 
        country TEXT, 
        document TEXT, 
        password TEXT,
        profile_pic TEXT DEFAULT '/uploads/default.png', 
        active INTEGER DEFAULT 1
    )`);
   
    // 3. Tabela de Encomendas
    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE,
        client_id INTEGER,
        description TEXT,
        weight REAL,
        status TEXT,
        price REAL DEFAULT 0,
        delivery_proof TEXT,
        proof_image TEXT,
        delivery_location TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(client_id) REFERENCES users(id)
    )`);

    // 4. Tabela de Box
    db.run(`CREATE TABLE IF NOT EXISTS boxes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        order_id INTEGER, 
        box_code TEXT,
        products TEXT,
        amount REAL,
        shipment_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(client_id) REFERENCES users(id),
        FOREIGN KEY(order_id) REFERENCES orders(id),
        FOREIGN KEY(shipment_id) REFERENCES shipments(id)
    )`);

    // 5. Tabela de Despesas
    db.run(`CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        description TEXT,
        category TEXT, 
        amount REAL,
        date DATE DEFAULT CURRENT_DATE
    )`);

    // 6. Logs e Outras Tabelas
    db.run(`CREATE TABLE IF NOT EXISTS system_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_name TEXT, action TEXT, details TEXT, ip_address TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    
    db.run(`CREATE TABLE IF NOT EXISTS shipments (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE, type TEXT, status TEXT, departure_date DATE, arrival_forecast DATE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    
    db.run(`CREATE TABLE IF NOT EXISTS invoices (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER, box_id INTEGER, amount REAL, description TEXT, status TEXT DEFAULT 'pending', mp_payment_id TEXT, qr_code TEXT, qr_code_base64 TEXT, payment_link TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(client_id) REFERENCES users(id), FOREIGN KEY(box_id) REFERENCES boxes(id))`);
    
    db.run(`CREATE TABLE IF NOT EXISTS availability (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, start_time TEXT, end_time TEXT, max_slots INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    
    db.run("CREATE TABLE IF NOT EXISTS settings (key TEXT UNIQUE, value REAL)");
    db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('price_per_kg', 0.00)");
    
    db.run(`CREATE TABLE IF NOT EXISTS appointments (id INTEGER PRIMARY KEY AUTOINCREMENT, availability_id INTEGER, client_id INTEGER, time_slot TEXT, status TEXT DEFAULT 'Pendente', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    
    db.run(`CREATE TABLE IF NOT EXISTS videos (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER, filename TEXT, description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);

    // 7. Usuários Iniciais (Segurança)
    const createUser = (role, name, email, password) => {
        if (!password) return; 
        db.get("SELECT email FROM users WHERE email = ?", [email], (err, row) => {
            if (!row) {
                const hash = bcrypt.hashSync(password, 10);
                db.run(`INSERT INTO users (role, name, email, password, country) VALUES (?, ?, ?, ?, ?)`, 
                    [role, name, email, hash, 'Guiné-Bissau']);
                console.log(`[SEGURANÇA] Usuário inicial criado: ${name}`);
            }
        });
    };

    createUser('admin', 'Lelo (Admin)', 'lelo@guineexpress.com', process.env.PASS_ADMIN);
    createUser('employee', 'Cala', 'cala@guineexpress.com', process.env.PASS_CALA);
    createUser('employee', 'Guto', 'guto@guineexpress.com', process.env.PASS_GUTO);
    createUser('employee', 'Pedro', 'pedro@guineexpress.com', process.env.PASS_PEDRO);
    createUser('employee', 'Neu', 'neu@guineexpress.com', process.env.PASS_NEU);
});

// =============================================================
// 2. CONFIGURAÇÕES GERAIS (EMAIL, UPLOAD, MERCADO PAGO)
// =============================================================

// Pasta de Uploads
app.use('/uploads', express.static('uploads'));
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
if (!fs.existsSync('uploads/videos')) fs.mkdirSync('uploads/videos', { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

const videoStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/videos/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const uploadVideo = multer({ storage: videoStorage });

// --- CORREÇÃO DO EMAIL (PORTA SEGURA PARA RENDER) ---
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', // Obrigatório para evitar erros de DNS
    port: 465,              // Porta segura SSL
    secure: true,           // Obrigatório para porta 465
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Função de Email HTML
async function sendEmailHtml(to, subject, title, message) {
    if (!to || to.includes('undefined')) return;
    const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px;">
        <div style="background-color: #000; padding: 20px; text-align: center;">
            <h1 style="color: #d4af37; margin: 0;">GUINEEXPRESS</h1>
        </div>
        <div style="padding: 30px; background-color: #fff;">
            <h2 style="color: #0a1931;">${title}</h2>
            <p>${message}</p>
            <br><a href="https://guineexpress.com" style="background-color: #28a745; color: #fff; padding: 10px; text-decoration: none; border-radius: 5px;">Acessar Conta</a>
        </div>
    </div>`;
    try {
        await transporter.sendMail({
            from: '"Guineexpress" <comercialguineexpress245@gmail.com>',
            to: to, subject: subject, html: htmlContent
        });
        console.log(`📧 Email enviado para ${to}`);
    } catch (error) {
        console.error("❌ Erro ao enviar email:", error.message);
    }
}

// Log do Sistema
function logSystemAction(req, action, details) {
    const user = req.session.userName || 'Sistema';
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    db.run("INSERT INTO system_logs (user_name, action, details, ip_address) VALUES (?, ?, ?, ?)", [user, action, details, ip]);
}

// Mercado Pago
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
const payment = new Payment(client);

// Middlewares
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads/videos', express.static('uploads/videos'));

app.use(session({
    store: new SQLiteStore({ db: 'sessions.db', dir: '.' }),
    secret: process.env.SESSION_SECRET || 'segredo_padrao',
    resave: false, saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7, secure: false } 
}));

// =============================================================
// 3. ROTAS DE AUTENTICAÇÃO E USUÁRIOS
// =============================================================

app.post('/api/login', (req, res) => {
    const { login, password, role } = req.body;
    db.get("SELECT * FROM users WHERE email = ? OR phone = ?", [login, login], (err, user) => {
        if (err || !user) return res.status(400).json({ success: false, msg: 'Usuário não encontrado.' });
        if (user.active !== 1) return res.status(400).json({ success: false, msg: 'Conta desativada.' });
        if (!bcrypt.compareSync(password, user.password)) return res.status(400).json({ success: false, msg: 'Senha incorreta.' });

        if (user.role !== role) {
            return res.status(400).json({ success: false, msg: `Login incorreto! Conta de ${user.role} tentando entrar como ${role}.` });
        }

        req.session.userId = user.id;
        req.session.role = user.role;
        req.session.userName = user.name;
        console.log(`✅ Login: ${user.name}`);
        res.json({ success: true, role: user.role, name: user.name });
    });
});

app.post('/api/logout', (req, res) => { req.session.destroy(); res.json({success: true}); });

app.get('/api/check-session', (req, res) => {
    if (req.session.userId) {
        res.json({ loggedIn: true, user: { id: req.session.userId, name: req.session.userName, role: req.session.role } });
    } else {
        res.json({ loggedIn: false });
    }
});

app.get('/api/user', (req, res) => {
    if (!req.session.userId) return res.status(401).json({});
    db.get("SELECT * FROM users WHERE id = ?", [req.session.userId], (err, row) => res.json(row));
});

app.post('/api/users/change-password', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ success: false });
    const { currentPass, newPass } = req.body;
    db.get("SELECT password FROM users WHERE id = ?", [req.session.userId], (err, user) => {
        if (!bcrypt.compareSync(currentPass, user.password)) return res.json({ success: false, message: "Senha incorreta." });
        const newHash = bcrypt.hashSync(newPass, 10);
        db.run("UPDATE users SET password = ? WHERE id = ?", [newHash, req.session.userId], () => res.json({ success: true }));
    });
});

app.get('/api/admin/logs', (req, res) => {
    if(req.session.role !== 'admin') return res.status(403).json({});
    db.all("SELECT * FROM system_logs ORDER BY id DESC LIMIT 100", (err, rows) => res.json(rows || []));
});

app.get('/api/clients', (req, res) => {
    db.all("SELECT * FROM users WHERE role = 'client'", (err, rows) => res.json(rows || []));
});

app.post('/api/register', (req, res) => {
    const {name, email, phone, country, document, password} = req.body;
    const hash = bcrypt.hashSync(password, 10);
    db.run(`INSERT INTO users (role, name, email, phone, country, document, password) VALUES ('client', ?, ?, ?, ?, ?, ?)`, 
        [name, email, phone, country, document, hash], (err) => {
            if (err) return res.json({success: false, msg: 'Dados já existem.'});
            res.json({success: true});
    });
});

// =============================================================
// 4. ROTAS FINANCEIRAS, AGENDAMENTO E PEDIDOS
// =============================================================

// Despesas
app.post('/api/expenses/add', (req, res) => {
    if(req.session.role !== 'admin') return res.status(403).json({});
    const { description, category, amount, date } = req.body;
    db.run("INSERT INTO expenses (description, category, amount, date) VALUES (?, ?, ?, ?)", [description, category, amount, date], (err) => res.json({ success: !err }));
});

app.get('/api/expenses/list', (req, res) => {
    if(req.session.role !== 'admin') return res.status(403).json({});
    db.all("SELECT * FROM expenses ORDER BY date DESC", (err, rows) => res.json(rows || []));
});

app.post('/api/expenses/delete', (req, res) => {
    if(req.session.role !== 'admin') return res.status(403).json({});
    db.run("DELETE FROM expenses WHERE id = ?", [req.body.id], (err) => res.json({ success: !err }));
});

// Relatório Financeiro
app.get('/api/financial-report', (req, res) => {
    if(req.session.role !== 'admin') return res.status(403).json({});
    db.get("SELECT SUM(amount) as total FROM boxes", [], (err, rev) => {
        db.get("SELECT SUM(amount) as total FROM expenses", [], (err, exp) => {
            res.json({ revenue: rev?.total || 0, expenses: exp?.total || 0, profit: (rev?.total||0) - (exp?.total||0) });
        });
    });
});

// Agendamento
app.post('/api/schedule/create-availability', (req, res) => {
    const { date, start_time, end_time, max_slots } = req.body;
    db.run("INSERT INTO availability (date, start_time, end_time, max_slots) VALUES (?,?,?,?)", [date, start_time, end_time, max_slots], (err) => res.json({ success: !err }));
});

app.get('/api/schedule/availability', (req, res) => {
    db.all("SELECT * FROM availability WHERE date >= date('now') ORDER BY date ASC, start_time ASC", [], (err, rows) => res.json(rows || []));
});

app.post('/api/schedule/delete-availability', (req, res) => {
    db.run("DELETE FROM appointments WHERE availability_id = ?", [req.body.id]);
    db.run("DELETE FROM availability WHERE id = ?", [req.body.id], (err) => res.json({ success: !err }));
});

// Slots 15 min
app.get('/api/schedule/slots-15min', (req, res) => {
    db.all("SELECT * FROM availability WHERE date >= date('now') ORDER BY date ASC, start_time ASC", [], (err, ranges) => {
        if(err) return res.json([]);
        db.all("SELECT availability_id, time_slot, status FROM appointments WHERE status != 'Cancelado'", [], (err2, bookings) => {
            if (!bookings) bookings = [];
            let finalSlots = [];
            ranges.forEach(range => {
                let current = new Date(`2000-01-01T${range.start_time}`);
                let end = new Date(`2000-01-01T${range.end_time}`);
                while (current < end) {
                    let timeStr = current.toTimeString().substring(0,5);
                    let taken = bookings.filter(b => b.availability_id === range.id && b.time_slot === timeStr).length;
                    finalSlots.push({ availability_id: range.id, date: range.date, time: timeStr, max_slots: range.max_slots, taken: taken, available: range.max_slots - taken });
                    current.setMinutes(current.getMinutes() + 15);
                }
            });
            res.json(finalSlots);
        });
    });
});

app.post('/api/schedule/book', (req, res) => {
    const { availability_id, date, time } = req.body;
    db.get(`SELECT count(*) as qtd FROM appointments WHERE availability_id = ? AND time_slot = ? AND status != 'Cancelado'`, [availability_id, time], (err, row) => {
        db.get("SELECT max_slots FROM availability WHERE id = ?", [availability_id], (err, avail) => {
            if (row.qtd >= avail.max_slots) return res.json({ success: false, msg: 'Esgotado.' });
            db.run("INSERT INTO appointments (availability_id, client_id, time_slot, status) VALUES (?,?,?, 'Pendente')", [availability_id, req.session.userId, time], (err) => res.json({success: !err}));
        });
    });
});

app.get('/api/schedule/appointments', (req, res) => {
    let sql = `SELECT ap.id, ap.status, ap.time_slot, av.date, u.name as client_name, u.phone as client_phone FROM appointments ap JOIN availability av ON ap.availability_id = av.id JOIN users u ON ap.client_id = u.id`;
    let params = [];
    if (req.session.role === 'client') { sql += " WHERE ap.client_id = ?"; params.push(req.session.userId); }
    sql += " ORDER BY av.date ASC, ap.time_slot ASC";
    db.all(sql, params, (err, rows) => res.json(rows || []));
});

app.post('/api/schedule/status', (req, res) => db.run("UPDATE appointments SET status = ? WHERE id = ?", [req.body.status, req.body.id], (err) => res.json({success: !err})));
app.post('/api/schedule/cancel', (req, res) => db.run("UPDATE appointments SET status = 'Cancelado' WHERE id = ? AND client_id = ?", [req.body.id, req.session.userId], (err) => res.json({success: !err})));

// --- ENCOMENDAS (ORDERS) ---
app.get('/api/orders', (req, res) => {
    let sql = `SELECT orders.*, users.name as client_name, users.phone as client_phone, users.email as client_email FROM orders JOIN users ON orders.client_id = users.id`;
    let params = [];
    if(req.session.role === 'client') { sql += " WHERE client_id = ?"; params.push(req.session.userId); }
    sql += " ORDER BY orders.id DESC";
    db.all(sql, params, (err, rows) => res.json(rows || []));
});

app.post('/api/orders/create', (req, res) => {
    const { client_id, code, description, weight, status } = req.body;
    db.get("SELECT value FROM settings WHERE key = 'price_per_kg'", (err, row) => {
        const pricePerKg = row ? parseFloat(row.value) : 0;
        const totalPrice = (parseFloat(weight) * pricePerKg).toFixed(2);
        db.run(`INSERT INTO orders (client_id, code, description, weight, status, price) VALUES (?, ?, ?, ?, ?, ?)`,
            [client_id, code, description, weight, status, totalPrice], function(err) {
                if (err) return res.json({ success: false, msg: err.message });
                res.json({ success: true, id: this.lastID });
        });
    });
});

// --- NO SEU ARQUIVO SERVER.JS ---
// Substitua a rota app.post('/api/orders/update'...) por esta:

app.post('/api/orders/update', (req, res) => {
    const { id, status, location, delivery_proof } = req.body;
    
    // Busca dados para email
    db.get(`SELECT orders.code, users.email, users.name FROM orders JOIN users ON orders.client_id = users.id WHERE orders.id = ?`, [id], (err, row) => {
        if (!row) return res.json({ success: false });

        let sql = "UPDATE orders SET status = ? WHERE id = ?";
        let params = [status, id];

        if (delivery_proof) {
            // CORREÇÃO AQUI: Salvando na coluna 'delivery_proof' que o front-end lê
            sql = "UPDATE orders SET status = ?, delivery_proof = ?, delivery_location = ? WHERE id = ?";
            params = [status, delivery_proof, location || 'App', id];
        }

        db.run(sql, params, (errUpdate) => {
            if (errUpdate) return res.json({ success: false, msg: errUpdate.message });

            // Envia Email
            if (row.email) {
                const subject = `Atualização: ${row.code} - ${status}`;
                let msg = `O status mudou para: <b>${status}</b>`;
                if(delivery_proof) msg += "<br>📦 <b>Entrega confirmada com FOTO!</b> Acesse seu painel para ver.";
                
                // Função segura de envio
                if(typeof sendEmailHtml === 'function') {
                    sendEmailHtml(row.email, subject, "Status Atualizado", msg);
                }
            }
            res.json({ success: true });
        });
    });
});

app.get('/api/boxes', (req, res) => {
    let sql = `SELECT boxes.*, users.name as client_name, orders.code as order_code FROM boxes JOIN users ON boxes.client_id = users.id LEFT JOIN orders ON boxes.order_id = orders.id`;
    let params = [];
    if(req.session.role === 'client') { sql += " WHERE boxes.client_id = ?"; params.push(req.session.userId); }
    db.all(sql, params, (err, rows) => res.json(rows));
});

app.post('/api/boxes/create', (req, res) => {
    const {client_id, order_id, box_code, products, amount} = req.body;
    db.run("INSERT INTO boxes (client_id, order_id, box_code, products, amount) VALUES (?,?,?,?,?)", [client_id, order_id, box_code, products, amount], (err) => res.json({success: !err}));
});

app.post('/api/boxes/delete', (req, res) => db.run("DELETE FROM boxes WHERE id = ?", [req.body.id], (err) => res.json({success: !err})));

app.post('/api/user/update', upload.single('profile_pic'), (req, res) => {
    if (!req.session.userId) return res.status(401).json({ success: false });
    const { name, phone, email } = req.body;
    if (req.file) {
        db.run("UPDATE users SET name=?, phone=?, email=?, profile_pic=? WHERE id=?", [name, phone, email, req.file.filename, req.session.userId], (err) => {
            res.json({ success: true, newProfilePicUrl: '/uploads/' + req.file.filename });
        });
    } else {
        db.run("UPDATE users SET name=?, phone=?, email=? WHERE id=?", [name, phone, email, req.session.userId], (err) => res.json({ success: true }));
    }
});

app.post('/api/clients/toggle', (req, res) => db.run("UPDATE users SET active = ? WHERE id = ?", [req.body.active, req.body.id], () => res.json({ success: true })));

app.get('/api/config/price', (req, res) => db.get("SELECT value FROM settings WHERE key = 'price_per_kg'", (err, row) => res.json({ price: row ? row.value : 0 })));
app.post('/api/config/price', (req, res) => db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('price_per_kg', ?)", [req.body.price], (err) => res.json({ success: !err })));

app.post('/api/videos/upload', uploadVideo.single('video'), (req, res) => {
    if(!req.file) return res.json({success: false});
    const { client_id, description } = req.body;
    db.run("INSERT INTO videos (client_id, filename, description) VALUES (?, ?, ?)", [client_id, req.file.filename, description], (err) => res.json({success: !err}));
});

app.get('/api/videos/list', (req, res) => {
    if(req.session.role === 'client') {
        db.all("SELECT * FROM videos WHERE client_id = ? ORDER BY id DESC", [req.session.userId], (err, rows) => res.json(rows));
    } else {
        db.all(`SELECT videos.*, users.name as client_name FROM videos LEFT JOIN users ON videos.client_id = users.id ORDER BY videos.id DESC`, (err, rows) => res.json(rows));
    }
});

app.post('/api/videos/delete', (req, res) => {
    if(req.session.role === 'client') return res.status(403).json({});
    db.run("DELETE FROM videos WHERE id = ?", [req.body.id], (err) => {
        try { fs.unlinkSync(`uploads/videos/${req.body.filename}`); } catch(e){}
        res.json({success: !err});
    });
});
// CRIAR FATURA E ENVIAR EMAIL DE COBRANÇA
app.post('/api/invoices/create', async (req, res) => {
    if(req.session.role !== 'admin') return res.status(403).json({msg: 'Sem permissão'});

    const { client_id, box_id, amount, description, email } = req.body; // O email vem do front

    try {
        // A. Mercado Pago (Mantém igual)
        const paymentData = {
            transaction_amount: parseFloat(amount),
            description: description,
            payment_method_id: 'pix',
            payer: { email: email || 'cliente@guineexpress.com' }
        };
        const result = await payment.create({ body: paymentData });
        const mp_id = result.id;
        const qr_code = result.point_of_interaction.transaction_data.qr_code;
        const qr_base64 = result.point_of_interaction.transaction_data.qr_code_base64;
        const ticket_url = result.point_of_interaction.transaction_data.ticket_url;

        // B. Salva no Banco
        db.run(`INSERT INTO invoices (client_id, box_id, amount, description, status, mp_payment_id, qr_code, qr_code_base64, payment_link) 
                VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
                [client_id, box_id, amount, description, mp_id, qr_code, qr_base64, ticket_url],
                function(err) {
                    if(err) return res.json({success: false, msg: 'Erro ao salvar fatura'});

                    // C. ENVIA O EMAIL AUTOMÁTICO
                    if (email) {
                        // Busca nome do cliente rapidinho
                        db.get("SELECT name FROM users WHERE id = ?", [client_id], (e, u) => {
                            const name = u ? u.name : 'Cliente';
                            
                            const subject = `Fatura Disponível: R$ ${amount}`;
                            const title = "Pagamento Pendente";
                            const msg = `Olá, <strong>${name}</strong>.<br><br>
                                         Uma nova fatura foi gerada para o envio <strong>${description}</strong>.<br>
                                         Valor: <strong>R$ ${amount}</strong><br><br>
                                         Clique abaixo para pagar via Pix ou Cartão:<br><br>
                                         <a href="${ticket_url}" style="background:#d4af37; color:#000; padding:12px 25px; text-decoration:none; font-weight:bold; font-size:16px; border-radius:5px;">PAGAR AGORA</a>`;
                            
                            sendEmailHtml(email, subject, title, msg);
                        });
                    }

                    res.json({success: true});
                });

    } catch (error) {
        console.error(error);
        res.json({success: false, msg: 'Erro na comunicação com Mercado Pago'});
    }
});

// 2. Listar Faturas
app.get('/api/invoices/list', (req, res) => {
    let sql = `SELECT invoices.*, users.name as client_name, boxes.box_code 
               FROM invoices 
               LEFT JOIN users ON invoices.client_id = users.id 
               LEFT JOIN boxes ON invoices.box_id = boxes.id`;
    
    let params = [];

    // Se for cliente, vê só as dele
    if(req.session.role === 'client') {
        sql += " WHERE invoices.client_id = ?";
        params.push(req.session.userId);
    } 
    // Se for funcionário ou admin, vê tudo (pode adicionar filtros se quiser)

    sql += " ORDER BY invoices.id DESC";
    
    db.all(sql, params, (err, rows) => {
        if(err) return res.json([]);
        res.json(rows);
    });
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
    // Pegamos apenas o email. Não importa a 'role' que veio do front,
    // nós vamos forçar a busca apenas por CLIENTES no banco de dados.
    const { email } = req.body;

    if (!email) return res.json({ success: false, msg: "E-mail é obrigatório." });

    // --- REMOVI O BLOCO "IF" QUE BLOQUEAVA ADMIN/EMPLOYEE AQUI ---
    // Motivo: A consulta SQL abaixo já filtra "AND role = 'client'". 
    // Se um Admin tentar, o banco simplesmente não vai achar nada e retornará "Cliente não encontrado",
    // o que é mais seguro e evita o erro de usabilidade.

    // 2. Busca APENAS se for role='client'
    const sqlFind = `SELECT * FROM users WHERE (email = ? OR phone = ?) AND role = 'client'`;
    
    db.get(sqlFind, [email, email], (err, user) => {
        if (err || !user) {
            // Se for um Admin tentando, vai cair aqui (User not found), o que é perfeito.
            return res.json({ success: false, msg: "Cliente não encontrado com este e-mail." });
        }

        // 3. Gera nova senha e envia
        const newPassword = Math.random().toString(36).slice(-6).toUpperCase(); 
        const newHash = bcrypt.hashSync(newPassword, 10);

        db.run("UPDATE users SET password = ? WHERE id = ?", [newHash, user.id], (errUpdate) => {
            if (errUpdate) {
                return res.status(500).json({ success: false, msg: "Erro ao atualizar senha." });
            }

            const mailOptions = {
                from: '"Guineexpress" <seu_email_aqui@gmail.com>', 
                to: user.email,
                subject: 'Sua Nova Senha - Guineexpress',
                html: `
                    <div style="font-family: sans-serif; padding: 20px; color: #333;">
                        <h2>Olá, ${user.name}</h2>
                        <p>Recebemos seu pedido de recuperação de senha.</p>
                        <p>Sua nova senha temporária é:</p>
                        <h1 style="background: #f4f4f4; padding: 10px; display: inline-block; letter-spacing: 5px;">${newPassword}</h1>
                        <p>Acesse sua conta e altere para uma senha de sua preferência.</p>
                    </div>
                `
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error("Erro email:", error);
                    return res.json({ success: false, msg: "Erro técnico ao enviar e-mail. A senha foi alterada, contate o suporte." });
                }
                res.json({ success: true, msg: "Verifique seu e-mail (e a caixa de SPAM) para pegar a nova senha." });
            });
        });
    });
});
// --- ROTA: HISTÓRICO DE ENVIOS ---
app.get('/api/history', (req, res) => {
    // Base da Query: Pega dados da encomenda e o nome do dono
    let sql = `SELECT orders.*, users.name as client_name 
               FROM orders 
               JOIN users ON orders.client_id = users.id`;
    
    let params = [];

    // Se for CLIENTE, filtra para ver só os dele
    if (req.session.role === 'client') {
        sql += " WHERE orders.client_id = ?";
        params.push(req.session.userId);
    }
    // Se for Admin/Employee, não tem WHERE, vê tudo.

    // Ordena do mais recente para o mais antigo
    sql += " ORDER BY orders.created_at DESC";

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error(err);
            return res.json([]);
        }
        res.json(rows);
    });
});
// =======================================================
// ROTA DE IMPRESSÃO INTELIGENTE (RECIBO COMPLETO)
// =======================================================
app.get('/api/print-receipt/:boxId', (req, res) => {
    const boxId = req.params.boxId;

    // 1. Pega a Box selecionada
    db.get("SELECT * FROM boxes WHERE id = ?", [boxId], (err, currentBox) => {
        if (err || !currentBox) {
            return res.json({ success: false, msg: "Box não encontrado." });
        }

        // 2. Busca dados da Encomenda vinculada e do Cliente
        // Se a box não tiver encomenda (order_id null), busca só o cliente
        let sqlData = "";
        let params = [];

        if (currentBox.order_id) {
            // Tem encomenda: Traz dados da Ordem + Cliente
            sqlData = `
                SELECT orders.code as order_code, orders.status as order_status, orders.created_at as order_date,
                       users.name as client_name, users.phone, users.document, users.email, users.country
                FROM orders
                JOIN users ON orders.client_id = users.id
                WHERE orders.id = ?
            `;
            params = [currentBox.order_id];
        } else {
            // Box Avulsa: Traz só dados do Cliente
            sqlData = `SELECT name as client_name, phone, document, email, country FROM users WHERE id = ?`;
            params = [currentBox.client_id];
        }

        db.get(sqlData, params, (err, dataInfo) => {
            if (err) return res.json({ success: false, msg: "Erro ao buscar dados." });

            // 3. Busca TODAS as boxes que pertencem à mesma encomenda (para listar tudo junto no recibo)
            // Se for box avulsa, traz só ela mesma.
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
                // Retorna o pacote completo para o Javascript montar o PDF
                res.json({ 
                    success: true, 
                    info: dataInfo || {}, // Dados do Cliente/Ordem
                    boxes: allBoxes,       // Lista de Caixas
                    currentBox: currentBox // A caixa que foi clicada
                });
            });
        });
    });
});
// ==========================================
// ROTA DASHBOARD BI (ESTATÍSTICAS)
// ==========================================
app.get('/api/dashboard-stats', (req, res) => {
    
    // 1. Total Faturado (Soma das Boxes)
    const sqlRevenue = "SELECT SUM(amount) as total FROM boxes";
    
    // 2. Peso Total (Soma das Encomendas)
    const sqlWeight = "SELECT SUM(weight) as total FROM orders";
    
    // 3. Contagem (Clientes, Encomendas)
    const sqlCountOrders = "SELECT COUNT(*) as total FROM orders";
    const sqlCountClients = "SELECT COUNT(*) as total FROM users WHERE role = 'client'";

    // 4. Agrupamento por Status (Para o Gráfico de Pizza)
    const sqlStatus = "SELECT status, COUNT(*) as count FROM orders GROUP BY status";

    // Executa as queries em cadeia (SQLite simples)
    db.get(sqlRevenue, [], (err, revRow) => {
        const revenue = revRow ? revRow.total : 0;

        db.get(sqlWeight, [], (err, weiRow) => {
            const weight = weiRow ? weiRow.total : 0;

            db.get(sqlCountOrders, [], (err, ordRow) => {
                const totalOrders = ordRow ? ordRow.total : 0;

                db.get(sqlCountClients, [], (err, cliRow) => {
                    const totalClients = cliRow ? cliRow.total : 0;

                    db.all(sqlStatus, [], (err, statusRows) => {
                        
                        // Envia tudo junto para o frontend
                        res.json({
                            success: true,
                            data: {
                                revenue: revenue || 0,
                                weight: weight || 0,
                                totalOrders: totalOrders || 0,
                                totalClients: totalClients || 0,
                                statusDistribution: statusRows || []
                            }
                        });
                    });
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
            invoices.status as payment_status -- Pega o status do pagamento (approved/pending)
        FROM boxes
        LEFT JOIN users ON boxes.client_id = users.id
        LEFT JOIN orders ON boxes.order_id = orders.id
        LEFT JOIN invoices ON boxes.id = invoices.box_id
        WHERE boxes.id = ?
    `;

    db.get(sqlBox, [boxId], (err, box) => {
        if (err) return res.json({ success: false, msg: "Erro no banco." });
        if (!box) return res.json({ success: false, msg: "Box não encontrada." });

        // Busca preço por Kg para cálculo automático
        db.get("SELECT value FROM settings WHERE key = 'price_per_kg'", (err2, setting) => {
            let pricePerKg = setting ? parseFloat(setting.value) : 0;
            let currentAmount = parseFloat(box.amount) || 0;
            let weight = parseFloat(box.weight) || 0;

            // Se valor for 0, calcula automático (Peso x Preço)
            if (currentAmount === 0 && weight > 0 && pricePerKg > 0) {
                currentAmount = weight * pricePerKg;
            }

            box.amount = currentAmount.toFixed(2);
            box.weight = weight.toFixed(2);
            
            // Define status legível para o recibo
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
    // Verifica se é admin (opcional, mas recomendado)
    // if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({});

    try {
        performBackup();
        res.json({ success: true, msg: "Backup realizado e salvo na pasta /backups!" });
    } catch (e) {
        res.json({ success: false, msg: "Erro ao fazer backup." });
    }
});
// ==========================================
// LOGÍSTICA DE EMBARQUES (MANIFESTO)
// ==========================================

// 1. Criar Novo Embarque
app.post('/api/shipments/create', (req, res) => {
    if(req.session.role !== 'admin') return res.status(403).json({});
    const { code, type, departure_date } = req.body;
    
    db.run("INSERT INTO shipments (code, type, status, departure_date) VALUES (?, ?, 'Aberto', ?)", 
        [code, type, departure_date], 
        (err) => res.json({ success: !err })
    );
});

// 2. Listar Embarques
app.get('/api/shipments/list', (req, res) => {
    // Traz o embarque e CONTA quantas caixas tem dentro
    const sql = `SELECT s.*, COUNT(b.id) as box_count 
                 FROM shipments s 
                 LEFT JOIN boxes b ON b.shipment_id = s.id 
                 GROUP BY s.id ORDER BY s.id DESC`;
    db.all(sql, (err, rows) => res.json(rows || []));
});

// 3. Listar Caixas "Órfãs" (Sem embarque)
app.get('/api/shipments/pending-boxes', (req, res) => {
    // Só mostra caixas que NÃO têm shipment_id
    const sql = `SELECT b.id, b.box_code, u.name as client_name 
                 FROM boxes b 
                 JOIN users u ON b.client_id = u.id 
                 WHERE b.shipment_id IS NULL OR b.shipment_id = 0`;
    db.all(sql, (err, rows) => res.json(rows || []));
});

// 4. Adicionar Caixa ao Embarque
app.post('/api/shipments/add-box', (req, res) => {
    if(req.session.role !== 'admin') return res.status(403).json({});
    const { shipment_id, box_id } = req.body;
    
    db.run("UPDATE boxes SET shipment_id = ? WHERE id = ?", [shipment_id, box_id], (err) => {
        res.json({ success: !err });
    });
});

// 5. Dados para o Manifesto (Impressão)
app.get('/api/shipments/manifest/:id', (req, res) => {
    const shipId = req.params.id;
    
    // Dados do Embarque
    db.get("SELECT * FROM shipments WHERE id = ?", [shipId], (err, shipment) => {
        if(!shipment) return res.json({ success: false });

        // Itens do Embarque (Caixas + Clientes + Encomendas)
        const sqlItems = `
            SELECT b.box_code, b.products, u.name as client_name, u.document, u.country, o.weight 
            FROM boxes b
            JOIN users u ON b.client_id = u.id
            LEFT JOIN orders o ON b.order_id = o.id
            WHERE b.shipment_id = ?
        `;
        
        db.all(sqlItems, [shipId], (err, items) => {
            res.json({ success: true, shipment, items });
        });
    });
});
// --- ROTA: Pegar UMA encomenda pelo ID (Para preencher o modal de edição) ---
app.get('/api/orders/:id', (req, res) => {
    db.get("SELECT * FROM orders WHERE id = ?", [req.params.id], (err, row) => {
        if (err || !row) return res.status(404).json(null);
        res.json(row);
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
// --- ROTA: Excluir Encomenda (DELETE) ---
app.delete('/api/orders/:id', (req, res) => {
    if (!req.session.userId || req.session.role === 'client') {
        return res.status(403).json({ success: false, message: 'Sem permissão' });
    }

    db.run("DELETE FROM orders WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.json({ success: false, message: "Erro ao excluir." });
        res.json({ success: true });
    });
});

// Certifique-se que a rota está assim:
app.get('/api/users-all', (req, res) => {
    // Permite ADMIN e EMPLOYEE. Só bloqueia se não estiver logado ou se for CLIENTE.
    if(!req.session.role || req.session.role === 'client') {
        return res.status(403).json([]);
    }
    
    db.all("SELECT id, name, email, role FROM users", (err, rows) => {
        res.json(rows || []);
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

    const { id, active } = req.body;
    db.run("UPDATE users SET active = ? WHERE id = ?", [active, id], (err) => {
        res.json({ success: !err });
    });
});

// =====================================================
// INICIALIZAÇÃO DO SERVIDOR
// =====================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Servidor Guineexpress rodando na porta ${PORT}`);
    console.log(`📡 Modo: ${process.env.NODE_ENV || 'Desenvolvimento'}`);
});