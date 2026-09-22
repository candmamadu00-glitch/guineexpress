// ==========================================
// 🚀 OPERAÇÃO RESGATE: DEVOLVER CAIXAS E ENCOMENDAS
// ==========================================
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataFolder = fs.existsSync('/data') ? '/data' : '.';
const dbPath = path.join(dataFolder, 'guineexpress_v4.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Erro ao conectar:', err.message);
        return;
    }
    console.log(`✅ Conectado à Base de Dados: ${dbPath}`);
    
    db.serialize(() => {
        // 1. Ressuscita todas as BOXES
        db.run("UPDATE boxes SET deleted = 0", function(err) {
            if (err) console.error("Erro nas boxes:", err);
            else console.log(`📦 Boxes recuperadas: ${this.changes} caixas voltaram à vida!`);
        });

        // 2. Ressuscita todas as ENCOMENDAS
        db.run("UPDATE orders SET deleted = 0", function(err) {
            if (err) console.error("Erro nas encomendas:", err);
            else console.log(`🚚 Encomendas recuperadas: ${this.changes} pacotes voltaram à vida!`);
        });
    });

    // Fecha a conexão após 2 segundos
    setTimeout(() => {
        db.close();
        console.log("✅ Operação de resgate concluída com sucesso!");
    }, 2000);
});