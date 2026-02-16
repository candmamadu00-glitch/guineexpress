const API_KEY = "AIzaSyDTDbQbHTeAXRDzlbkWN-Emb4H4KL5nRug";

async function testarChave() {
    console.log("🔄 Perguntando ao Google quais modelos sua chave pode usar...");
    
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        const data = await response.json();
        
        if (data.error) {
            console.error("❌ ERRO NA CHAVE DO GOOGLE:", data.error.message);
        } else {
            console.log("✅ MODELOS LIBERADOS PARA VOCÊ:");
            // Filtra e mostra só os nomes dos modelos
            const modelos = data.models.map(m => m.name.replace('models/', ''));
            console.log(modelos.join(', '));
        }
    } catch (err) {
        console.error("Falha na conexão:", err.message);
    }
}

testarChave();