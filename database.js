require('dotenv').config();
const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');

// O .trim() remove espaços vazios antes e depois, evitando o erro
const url = process.env.TURSO_DATABASE_URL ? process.env.TURSO_DATABASE_URL.trim() : null;
const authToken = process.env.TURSO_AUTH_TOKEN ? process.env.TURSO_AUTH_TOKEN.trim() : null;

console.log("📡 Conectando ao Banco de Dados (Turso)...");

// Cria o cliente do Turso. Se não tiver URL (rodando local sem net), tenta criar arquivo local.
const client = createClient({
    url: url || 'file:local_backup.db',
    authToken: authToken,
});

// --- ADAPTADOR (WRAPPER) ---
// Isso faz o Turso "fingir" que é o SQLite antigo para o seu server.js não quebrar
const db = {
    // Executa comando (INSERT, UPDATE, DELETE)
    run: async function(sql, params = [], callback) {
        try {
            const args = params || [];
            const rs = await client.execute({ sql, args });
            // Simula o "this.lastID" e "this.changes" do SQLite antigo
            if (callback) {
                const context = { lastID: Number(rs.lastInsertRowid), changes: rs.rowsAffected };
                callback.call(context, null);
            }
        } catch (e) {
            console.error("❌ Erro SQL (RUN):", e.message);
            if (callback) callback(e);
        }
    },
    // Pega uma única linha (SELECT ... LIMIT 1)
    get: async function(sql, params = [], callback) {
        try {
            const args = params || [];
            const rs = await client.execute({ sql, args });
            if (callback) callback(null, rs.rows[0]);
        } catch (e) {
            console.error("❌ Erro SQL (GET):", e.message);
            if (callback) callback(e);
        }
    },
    // Pega todas as linhas (SELECT *)
    all: async function(sql, params = [], callback) {
        try {
            const args = params || [];
            const rs = await client.execute({ sql, args });
            if (callback) callback(null, rs.rows);
        } catch (e) {
            console.error("❌ Erro SQL (ALL):", e.message);
            if (callback) callback(e);
        }
    },
    // Função para manter compatibilidade
    serialize: function(callback) {
        if(callback) callback();
    }
};

// --- CRIAÇÃO DAS TABELAS (MIGRAÇÃO AUTOMÁTICA) ---
async function initDB() {
    try {
        console.log("🔄 Verificando estrutura do banco na Nuvem...");

        // 1. Tabela Usuários
        await client.execute(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            role TEXT, name TEXT, email TEXT UNIQUE, phone TEXT, 
            country TEXT, document TEXT, password TEXT, 
            profile_pic TEXT DEFAULT 'https://placehold.co/100', 
            active INTEGER DEFAULT 1
        )`);

        // 2. Tabela de Encomendas
        await client.execute(`CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE, client_id INTEGER, description TEXT, 
            weight REAL, status TEXT, price REAL DEFAULT 0,
            delivery_proof TEXT, proof_image TEXT, delivery_location TEXT,   
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(client_id) REFERENCES users(id)
        )`);

        // 3. Tabela de Embarques (Shipments) - Criar antes de Boxes
        await client.execute(`CREATE TABLE IF NOT EXISTS shipments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE, type TEXT, status TEXT,          
            departure_date DATE, arrival_forecast DATE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // 4. Tabela de Box
        await client.execute(`CREATE TABLE IF NOT EXISTS boxes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER, order_id INTEGER, 
            box_code TEXT, products TEXT, amount REAL,
            shipment_id INTEGER,      
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(client_id) REFERENCES users(id),
            FOREIGN KEY(order_id) REFERENCES orders(id),
            FOREIGN KEY(shipment_id) REFERENCES shipments(id)
        )`);

        // 5. Tabelas Financeiras e Logs
        await client.execute(`CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            description TEXT, category TEXT, amount REAL,
            date DATE DEFAULT CURRENT_DATE
        )`);

        await client.execute(`CREATE TABLE IF NOT EXISTS system_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_name TEXT, action TEXT, details TEXT,    
            ip_address TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        await client.execute(`CREATE TABLE IF NOT EXISTS invoices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER, box_id INTEGER, amount REAL,
            description TEXT, status TEXT DEFAULT 'pending', 
            mp_payment_id TEXT, qr_code TEXT, qr_code_base64 TEXT, 
            payment_link TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(client_id) REFERENCES users(id),
            FOREIGN KEY(box_id) REFERENCES boxes(id)
        )`);

        // 6. Agendamentos e Outros
        await client.execute(`CREATE TABLE IF NOT EXISTS availability (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT, start_time TEXT, end_time TEXT, max_slots INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        await client.execute("CREATE TABLE IF NOT EXISTS settings (key TEXT UNIQUE, value REAL)");
        // Tenta inserir configuração padrão, ignora se já existir
        try { await client.execute("INSERT INTO settings (key, value) VALUES ('price_per_kg', 0.00)"); } catch(e){}

        await client.execute(`CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            availability_id INTEGER, client_id INTEGER, time_slot TEXT,  
            status TEXT DEFAULT 'Pendente', created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(availability_id) REFERENCES availability(id),
            FOREIGN KEY(client_id) REFERENCES users(id)
        )`);

        await client.execute(`CREATE TABLE IF NOT EXISTS videos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER, filename TEXT, description TEXT, 
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(client_id) REFERENCES users(id)
        )`);

        console.log("✅ Tabelas sincronizadas no Turso!");
        createDefaultUsers();

    } catch (e) {
        console.error("❌ Erro na inicialização do Banco:", e);
    }
}

// --- CRIAÇÃO DE USUÁRIOS PADRÃO ---
async function createDefaultUsers() {
    const createUser = async (role, name, email, password) => {
        if (!password) return;
        try {
            const res = await client.execute({sql: "SELECT email FROM users WHERE email = ?", args: [email]});
            if (res.rows.length === 0) {
                const hash = bcrypt.hashSync(password, 10);
                await client.execute({
                    sql: "INSERT INTO users (role, name, email, password, country) VALUES (?, ?, ?, ?, ?)",
                    args: [role, name, email, hash, 'Guiné-Bissau']
                });
                console.log(`[SEGURANÇA] Usuário inicial criado: ${name}`);
            }
        } catch(e) { console.error("Erro ao criar user:", e); }
    };

    await createUser('admin', 'Lelo (Admin)', 'lelo@guineexpress.com', process.env.PASS_ADMIN);
    await createUser('employee', 'Cala', 'cala@guineexpress.com', process.env.PASS_CALA);
    await createUser('employee', 'Guto', 'guto@guineexpress.com', process.env.PASS_GUTO);
    await createUser('employee', 'Pedro', 'pedro@guineexpress.com', process.env.PASS_PEDRO);
    await createUser('employee', 'Neu', 'neu@guineexpress.com', process.env.PASS_NEU);
}

// Inicializa
initDB();

module.exports = db;