const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Robô Bac Bo com Placar Ativo!'));
app.listen(PORT, () => console.log(`💻 Servidor ativo na porta ${PORT}`));

const token = process.env.TELEGRAM_BOT_TOKEN || 'SEU_TOKEN_AQUI';
const chatId = process.env.TELEGRAM_CHAT_ID || 'SEU_CHAT_ID_AQUI';
const bot = new TelegramBot(token, { polling: false });

// URL da nossa nova API na Render (vamos configurar no próximo passo)
const API_URL = process.env.API_URL || 'https://api-server--louganslima.replit.app/api/monitor/status';

const DIFERENCA_MINIMA = 10.0; 
const DIFERENCA_MAXIMA = 18.0; 
const INTERVALO_VERIFICACAO = 1000; 

// CONTADORES DO PLACAR
let totalGreens = 0;
let totalReds = 0;
let totalEmpates = 0;

let alertaDisparado = false;
let aguardandoResultado = false;
let direcaoSugerida = ''; // Guarda se foi JOGADOR ou BANCA

function obterMensagemGestao() {
    return `📊 *SUGESTÃO DE GESTÃO (Banca R$ 20)*\n` +
           `🔴 *Valor na Cor:* R$ 5,12 | 🟡 *Empate (30%):* R$ 1,54\n` +
           `🎯 *Meta Diária:* 2 vitórias e saia!`;
}

// FUNÇÃO DO RELATÓRIO DE 12 HORAS
setInterval(async () => {
    const relatorio = `📊 *RELATÓRIO DE ASSERTIVIDADE (Últimas 12h)*\n\n` +
                      `✅ Greens: ${totalGreens}\n` +
                      `🟡 Empates com Proteção: ${totalEmpates}\n` +
                      `❌ Reds: ${totalReds}\n\n` +
                      `📈 Segue a gestão que o lucro é certo!`;
    try {
        await bot.sendMessage(chatId, relatorio, { parse_mode: 'Markdown' });
        console.log("📊 Relatório de 12 horas enviado!");
    } catch (e) {
        console.log("Erro ao enviar relatório de 12h");
    }
}, 12 * 60 * 60 * 1000); // Executa a cada 12 horas

async function analisarMesa() {
    try {
        const response = await axios.get(API_URL);
        const dados = response.data;

        if (!dados || !dados.jogador_porcentagem || !dados.banca_porcentagem) return;

        const pctJogador = parseFloat(dados.jogador_porcentagem);
        const pctBanca = parseFloat(dados.banca_porcentagem);
        const diferenca = Math.abs(pctJogador - pctBanca);
        const resultadoAtual = dados.resultado_rodada; // API vai nos dizer quem ganhou ('JOGADOR', 'BANCA' ou 'EMPATE')

        // 1. LÓGICA DE VALIDAÇÃO DE RESULTADO (GREEN/RED)
        if (aguardandoResultado && resultadoAtual) {
            if (resultadoAtual === direcaoSugerida) {
                totalGreens++;
                await bot.sendMessage(chatId, `✅ *GREEN CONFIRMADO!* Vamos para a próxima!`);
                aguardandoResultado = false;
                alertaDisparado = false;
            } else if (resultadoAtual === 'EMPATE') {
                totalEmpates++;
                await bot.sendMessage(chatId, `🟡 *EMPATE DETECTADO!* Proteção salva a entrada.`);
                aguardandoResultado = false;
                alertaDisparado = false;
            } else if (resultadoAtual !== direcaoSugerida && resultadoAtual !== 'ESPERANDO') {
                // Aqui simplificado, mas conta o Red se errar a sequência
                totalReds++;
                await bot.sendMessage(chatId, `❌ *RED!* Mantenha a calma e respeite o stop.`);
                aguardandoResultado = false;
                alertaDisparado = false;
            }
            return;
        }

        // 2. LÓGICA DE DISPARO DE SINAL
        if (diferenca >= DIFERENCA_MINIMA && diferenca <= DIFERENCA_MAXIMA && !alertaDisparado && !aguardandoResultado) {
            direcaoSugerida = pctJogador > pctBanca ? 'BANCA' : 'JOGADOR';
            let corSinal = direcaoSugerida === 'BANCA' ? '🔴 BANCA' : '🔵 JOGADOR';
            
            const mensagemTelegram = 
                `🚨 *SINAL DETECTADO NO BAC BO!* 🚨\n\n` +
                `🎯 *ENTRADA CONFIRMADA:* JOGAR NA ${corSinal}\n\n` +
                `${obterMensagemGestao()}`;

            await bot.sendMessage(chatId, mensagemTelegram, { parse_mode: 'Markdown' });
            console.log(`✅ Sinal enviado! Aguardando resultado da mesa...`);
            
            alertaDisparado = true;
            aguardandoResultado = true; // Ativa o modo de espera pelo resultado da rodada
        }

    } catch (error) {
        // Silencia erros de conexão
    }
}

setInterval(analisarMesa, INTERVALO_VERIFICACAO);
console.log("🚀 Robô com Contador de Placar e Relatório de 12h Ativo!");
