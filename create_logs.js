const sqlite3 = require('sqlite3').verbose();
// Conecta ao seu banco de dados atual
const db = new sqlite3.Database('./guineexpress_v4.db');

db.serialize(() => {
    console.log("🛠️ Criando tabela de Auditoria...");

    // 1. Cria a tabela system_logs se ela não existir
    db.run(`CREATE TABLE IF NOT EXISTS system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_name TEXT,
        action TEXT,      
        details TEXT,    
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.log("❌ Erro ao criar tabela:", err.message);
        } else {
            console.log("✅ Tabela 'system_logs' verificada/criada com sucesso!");
        }
    });

    // 2. Insere um log de teste para você ver algo na tela imediatamente
    db.run(`INSERT INTO system_logs (user_name, action, details) 
            VALUES ('Sistema', 'TESTE', 'Tabela de auditoria criada manualmente agora.')`, (err) => {
        if(!err) console.log("✅ Log de teste inserido com sucesso!");
    });
});

// Fecha a conexão após terminar
setTimeout(() => {
    db.close();
    console.log("🔒 Conexão fechada.");
}, 1000);