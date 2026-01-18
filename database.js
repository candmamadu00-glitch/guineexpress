require('dotenv').config(); // Garante que lê o .env
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

// Cria/Conecta ao banco V4
const db = new sqlite3.Database('./guineexpress_v4.db');
// --- CORREÇÃO AUTOMÁTICA DE COLUNAS (PATCH) ---
db.serialize(() => {
    // 1. Colunas para o Sistema de Entrega (Foto e Localização)
    // O callback (err) => {} vazio serve para ignorar o erro caso a coluna já exista
    db.run("ALTER TABLE orders ADD COLUMN delivery_proof TEXT", (err) => {});
    db.run("ALTER TABLE orders ADD COLUMN proof_image TEXT", (err) => {});      // Necessário para a Câmera
    db.run("ALTER TABLE orders ADD COLUMN delivery_location TEXT", (err) => {}); // Necessário para a Câmera

    // 2. Coluna para o Financeiro (Mercado Pago)
    db.run("ALTER TABLE invoices ADD COLUMN mp_payment_id TEXT", (err) => {});
    
    // 3. Coluna para envio em Caixas (Logística)
    db.run("ALTER TABLE boxes ADD COLUMN shipment_id INTEGER REFERENCES shipments(id)", (err) => {});
    
    console.log("✅ Verificação de colunas do banco concluída.");
});
db.serialize(() => {
    // 1. Cria coluna de FOTO se não existir
    db.run("ALTER TABLE orders ADD COLUMN delivery_proof TEXT", (err) => {
        if (!err) console.log("✅ Coluna 'delivery_proof' adicionada com sucesso!");
    });

    // 2. Cria coluna de ID DO PIX se não existir
    db.run("ALTER TABLE invoices ADD COLUMN mp_payment_id TEXT", (err) => {
        if (!err) console.log("✅ Coluna 'mp_payment_id' adicionada com sucesso!");
    });
});
db.serialize(() => {
    // 1. Tabela de Usuários (CORRIGIDA - usa profile_pic)
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
   
    // 2. Tabela de Encomendas
    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE,
        client_id INTEGER,
        description TEXT,
        weight REAL,
        status TEXT,
        price REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(client_id) REFERENCES users(id)
    )`);

    // 3. Tabela de Box
    db.run(`CREATE TABLE IF NOT EXISTS boxes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        order_id INTEGER, 
        box_code TEXT,
        products TEXT,
        amount REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(client_id) REFERENCES users(id),
        FOREIGN KEY(order_id) REFERENCES orders(id)
    )`);

    // 4. Tabela de Despesas
    db.run(`CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        description TEXT,
        category TEXT, 
        amount REAL,
        date DATE DEFAULT CURRENT_DATE
    )`);

    // 5. Tabela de Logs de Auditoria
    db.run(`CREATE TABLE IF NOT EXISTS system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_name TEXT,
        action TEXT,      
        details TEXT,    
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 6. Tabela de Embarques (Shipments)
    db.run(`CREATE TABLE IF NOT EXISTS shipments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE,   
        type TEXT,            
        status TEXT,          
        departure_date DATE,
        arrival_forecast DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 7. Atualização para adicionar shipment_id em boxes
    db.run("ALTER TABLE boxes ADD COLUMN shipment_id INTEGER REFERENCES shipments(id)", (err) => {
        // Ignora erro se coluna já existir
    });

    // 8. Tabela de Faturas (Cobranças)
    db.run(`CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        box_id INTEGER,
        amount REAL,
        description TEXT,
        status TEXT DEFAULT 'pending', 
        mp_payment_id TEXT, 
        qr_code TEXT, 
        qr_code_base64 TEXT, 
        payment_link TEXT, 
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(client_id) REFERENCES users(id),
        FOREIGN KEY(box_id) REFERENCES boxes(id)
    )`);

    // 9. Agendamento - Disponibilidade (VAGAS)
    db.run(`CREATE TABLE IF NOT EXISTS availability (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT, 
        start_time TEXT, 
        end_time TEXT, 
        max_slots INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 10. Configurações Globais (Preço kg)
    db.run("CREATE TABLE IF NOT EXISTS settings (key TEXT UNIQUE, value REAL)");
    db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('price_per_kg', 0.00)");

    // 11. Agendamento - Pedidos
    db.run(`CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        availability_id INTEGER, 
        client_id INTEGER, 
        time_slot TEXT,  
        status TEXT DEFAULT 'Pendente',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(availability_id) REFERENCES availability(id),
        FOREIGN KEY(client_id) REFERENCES users(id)
    )`);

    // 12. Tabela de Vídeos
    db.run(`CREATE TABLE IF NOT EXISTS videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        filename TEXT,
        description TEXT, 
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(client_id) REFERENCES users(id)
    )`);

    // =======================================================
    // SEGURANÇA MÁXIMA: CRIAÇÃO DE USUÁRIOS VIA .ENV
    // =======================================================
    const createUser = (role, name, email, password) => {
        // Só cria se a senha existir (não cria usuário com senha vazia/indefinida)
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

    // Aqui usamos as variáveis do arquivo .env
    // Se você não colocar no .env, esses usuários NÃO SERÃO CRIADOS (Segurança)
    createUser('admin', 'Lelo (Admin)', 'lelo@guineexpress.com', process.env.PASS_ADMIN);
    createUser('employee', 'Cala', 'cala@guineexpress.com', process.env.PASS_CALA);
    createUser('employee', 'Guto', 'guto@guineexpress.com', process.env.PASS_GUTO);
    createUser('employee', 'Pedro', 'pedro@guineexpress.com', process.env.PASS_PEDRO);
    createUser('employee', 'Neu', 'neu@guineexpress.com', process.env.PASS_NEU);
});

module.exports = db;