const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express'); // Necessário para a Render não derrubar o bot

// Inicializa um servidor web simples (Exigência da Render para planos grátis)
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Robô Bac Bo Ativo e Monitorando!'));
app.listen(PORT, () => console.log(`💻 Servidor Web da Render ativo na porta ${PORT}`));

// ==========================================
// CONFIGURAÇÕES DO TELEGRAM
// ==========================================
// Na Render, você vai cadastrar essas duas variáveis nas "Environment Variables"
const token = process.env.TELEGRAM_BOT_TOKEN || 'SEU_TOKEN_AQUI';
const chatId = process.env.TELEGRAM_CHAT_ID || 'SEU_CHAT_ID_AQUI';
const bot = new TelegramBot(token, { polling: false });

// URL da API que lê os dados reais da mesa do Bac Bo (via BetFusion)
const API_URL = 'https://api-server--louganslima.replit.app/api/monitor/status';

// CONFIGURAÇÃO DOS NOVOS GATILHOS (JANELA ENTRE 10% E 18%)
const DIFERENCA_MINIMA = 10.0; 
const DIFERENCA_MAXIMA = 18.0; 
const INTERVALO_VERIFICACAO = 1000; // AGORA ULTRA RÁPIDO: Checa a cada 1 segundo

let alertaDisparado = false;

// ==========================================
// FUNÇÃO DE GESTÃO: CÁLCULO DOS VALORES (30% Empate)
// ==========================================
function obterMensagemGestao() {
    return `📊 *SUGESTÃO DE GESTÃO (Banca R$ 20)*\n` +
           `⚠️ *Limite de Risco:* Máximo 3 percas seguidas\n` +
           `🔴 *Valor na Cor:* R$ 5,12\n` +
           `🟡 *Proteção Empate (30%):* R$ 1,54\n` +
           `🎯 *Meta Diária:* 2 vitórias e saia do mercado!`;
}

// ==========================================
// FUNÇÃO PRINCIPAL: ANÁLISE ULTRA RÁPIDA da MESA
// ==========================================
async function analisarMesa() {
    try {
        const response = await axios.get(API_URL);
        const dados = response.data;

        if (!dados || !dados.jogador_porcentagem || !dados.banca_porcentagem) {
            return; // Sai correndo para checar no próximo segundo sem perder tempo
        }

        const pctJogador = parseFloat(dados.jogador_porcentagem);
        const pctBanca = parseFloat(dados.banca_porcentagem);
        
        // Calcula a diferença absoluta
        const diferenca = Math.abs(pctJogador - pctBanca);

        // NOVA LÓGICA DE JANELA: Só entra se estiver entre 10% e 18%
        if (diferenca >= DIFERENCA_MINIMA && diferenca <= DIFERENCA_MAXIMA) {
            if (!alertaDisparado) {
                let direcaoAposta = pctJogador > pctBanca ? '🔴 BANCA' : '🔵 JOGADOR';
                
                const mensagemTelegram = 
                    `🚨 *SINAL DETECTADO NO BAC BO!* 🚨\n\n` +
                    `📊 *Análise do Momento:*\n` +
                    `🔵 Jogador: ${pctJogador}%\n` +
                    `🔴 Banca: ${pctBanca}%\n` +
                    `📈 Diferença Ideal: ${diferenca.toFixed(1)}%\n\n` +
                    `🎯 *ENTRADA CONFIRMADA:* JOGAR NA ${direcaoAposta}\n\n` +
                    `${obterMensagemGestao()}\n\n` +
                    `⚡ _Sinal enviado em tempo real! Corra para a mesa!_`;

                // Dispara imediatamente para o Telegram
                bot.sendMessage(chatId, messageTelegram, { parse_mode: 'Markdown' });
                console.log(`✅ [SINAL ENVIADO] Diferença de ${diferenca.toFixed(1)}% dentro da janela segura.`);
                
                alertaDisparado = true; 
            }
        } else {
            // Se a diferença cair abaixo de 10% OU subir acima de 18%, o robô reseta ou ignora
            if (alertaDisparado) {
                if (diferenca > DIFERENCA_MAXIMA) {
                    console.log(`⚠️ [ALERTA ABORTADO] Diferença disparou para ${diferenca.toFixed(1)}% (Muito alta! Risco detectado).`);
                } else {
                    console.log(`🔄 [MESA NORMAL] Diferença voltou para ${diferenca.toFixed(1)}%. Pronto para o próximo.`);
                }
                alertaDisparado = false;
            }
        }

    } catch (error) {
        // Silencia erros repetitivos de conexão para não travar o loop de 1 segundo
        console.log("Aguardando estabilidade da API da mesa...");
    }
}

// Inicia o monitoramento em tempo real (1s)
setInterval(analisarMesa, INTERVALO_VERIFICACAO);
console.log("🚀 Super Robô Bac Bo Pro ativo para a Render!");
console.log(`📡 Varrendo a mesa a cada ${INTERVALO_VERIFICACAO / 1000} segundo. Janela: 10% a 18%.`);
