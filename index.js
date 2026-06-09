const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Robô Dama dos Dados 7 Padrões Ativo!'));
app.listen(PORT, () => console.log(`💻 Servidor ativo na porta ${PORT}`));

const token = process.env.TELEGRAM_BOT_TOKEN || 'SEU_TOKEN_AQUI';
const chatId = process.env.TELEGRAM_CHAT_ID || 'SEU_CHAT_ID_AQUI';
const bot = new TelegramBot(token, { polling: false });

const API_URL = process.env.API_URL || 'https://api-bacbo-monitor.onrender.com/api/monitor/status';
const INTERVALO_VERIFICACAO = 1000; 

// TRAVAS DE PORCENTAGEM DO LOUGANS
const DIFERENCA_MINIMA = 10.0; 
const DIFERENCA_MAXIMA = 18.0; 

let totalGreens = 0;
let totalReds = 0;
let totalEmpates = 0;

let alertaDisparado = false;
let aguardandoResultado = false;
let direcaoSugerida = ''; 
let historicoRodadas = []; 

function obterMensagemGestao() {
    return `📊 *SUGESTÃO DE GESTÃO (SEM MARTINGALE)*\n` +
           `🔴 *Entrada:* R$ 5,00 | 🟡 *Proteção Empate:* R$ 1,50\n` +
           `🎯 *Siga o gerenciamento à risca!*`;
}

// RELATÓRIO DE 12 HORAS
setInterval(async () => {
    const relatorio = `📊 *RELATÓRIO DE ASSERTIVIDADE (Últimas 12h)*\n\n` +
                      `✅ Greens: ${totalGreens}\n` +
                      `🟡 Empates com Proteção: ${totalEmpates}\n` +
                      `❌ Reds: ${totalReds}\n\n` +
                      `📈 Monitoramento dos 7 padrões de cores ativo!`;
    try {
        await bot.sendMessage(chatId, relatorio, { parse_mode: 'Markdown' });
    } catch (e) {
        console.log("Erro ao enviar relatório");
    }
}, 12 * 60 * 60 * 1000);

// VERIFICAÇÃO SEPARADA DOS 7 PADRÕES DO PDF
function verificar7Padrões(historico) {
    if (historico.length < 8) return false;
    
    // Pega as fatias necessárias para análise profunda das sequências
    const h = historico.slice(-8); 
    const p7 = historico.slice(-7);
    const p6 = historico.slice(-6);
    const p5 = historico.slice(-5);

    // 1. PADRÃO 2X1 (Ex: Vermelho, Vermelho, Azul, Vermelho -> Entrada na formação)
    if (p5[0] === p5[1] && p5[2] !== p5[0] && p5[3] === p5[0] && p5[4] === p5[0]) {
        return "PADRÃO 2X1";
    }

    // 2. PADRÃO 2X2 (Ex: Vermelho, Vermelho, Azul, Azul -> Entrada na quebra da última cor)
    if (p5[1] === p5[2] && p5[3] === p5[4] && p5[1] !== p5[3]) {
        return "PADRÃO 2X2";
    }

    // 3. PADRÃO ESCADINHA (Formação visual em diagonal)
    if (p5[0] !== p5[1] && p5[1] === p5[2] && p5[2] !== p5[3] && p5[3] === p5[4]) {
        return "PADRÃO ESCADINHA";
    }

    // 4. PADRÃO ESCADINHA INVERTIDO
    if (p6[0] !== p6[1] && p6[1] === p6[2] && p6[2] !== p6[3] && p6[3] === p6[4] && p6[4] === p6[5]) {
        return "PADRÃO ESCADINHA INVERTIDO";
    }

    // 5. PADRÃO DE ALTERNÂNCIA (Surf vertical de 4 bolinhas e uma quebra imediata)
    if (p6[0] === p6[1] && p6[1] === p6[2] && p6[2] === p6[3] && p6[4] !== p6[3] && p6[5] === p6[3]) {
        return "PADRÃO DE ALTERNÂNCIA";
    }

    // 6. PADRÃO DE ALTERNÂNCIA 2 (Após o segundo 2x1 contra a mesa, entra no fluxo)
    if (h[0] === h[1] && h[2] !== h[0] && h[3] === h[0] && h[4] !== h[0] && h[5] === h[0] && h[6] !== h[0] && h[7] === h[0]) {
        return "PADRÃO DE ALTERNÂNCIA 2";
    }

    // 7. PADRÃO DE QUEBRA DA SEGUNDA LINHA APÓS O SURF (Surf de exatamente 4 bolinhas e quebra na segunda coluna)
    if (p7[0] === p7[1] && p7[1] === p7[2] && p7[2] === p7[3] && p7[4] !== p7[3] && p7[5] !== p7[3] && p7[6] === p7[3]) {
        return "QUEBRA DA SEGUNDA LINHA APÓS O SURF";
    }

    return false;
}

async function analisarMesa() {
    try {
        const response = await axios.get(API_URL);
        const dados = response.data;

        if (!dados || !dados.jogador_porcentagem || !dados.banca_porcentagem) return;

        const pctJogador = parseFloat(dados.jogador_porcentagem);
        const pctBanca = parseFloat(dados.banca_porcentagem);
        const diferenca = Math.abs(pctJogador - pctBanca); 
        const resultadoAtual = dados.resultado_rodada; 
        
        const multiplicadorEmpate = dados.multiplicador_empate || "4x"; 

        // Alimenta o histórico ignorando os empates para não quebrar a contagem visual das cores
        if (resultadoAtual && resultadoAtual !== 'ESPERANDO' && resultadoAtual !== 'EMPATE') {
            if (historicoRodadas[historicoRodadas.length - 1] !== resultadoAtual) {
                historicoRodadas.push(resultadoAtual);
                if (historicoRodadas.length > 15) historicoRodadas.shift();
            }
        }

        // VALIDAÇÃO DE RESULTADO (GREEN / RED / EMPATE DA RODADA)
        if (aguardandoResultado && resultadoAtual && resultadoAtual !== 'ESPERANDO') {
            if (resultadoAtual === direcaoSugerida) {
                totalGreens++;
                await bot.sendMessage(chatId, `✅ *GREEN CONFIRMADO!*`);
                aguardandoResultado = false;
                alertaDisparado = false;
            } else if (resultadoAtual === 'EMPATE') {
                totalEmpates++;
                await bot.sendMessage(chatId, `🟡 *EMPATE COM PROTEÇÃO!* 🟡\n\n🎯 O resultado foi Empate de *${multiplicadorEmpate}*.\nA sua proteção salvou a banca!`);
                aguardandoResultado = false;
                alertaDisparado = false;
            } else {
                totalReds++;
                await bot.sendMessage(chatId, `❌ *RED!* Sem Martingale, seguimos a gestão fixa.`);
                aguardandoResultado = false;
                alertaDisparado = false;
            }
            return;
        }

        // FILTRO DUPLO: ANÁLISE ISOLADA DOS 7 PADRÕES + JANELA DE 10% A 18%
        const padraoDetectado = verificar7Padrões(historicoRodadas);
        const porcentagemValida = (diferenca >= DIFERENCA_MINIMA && diferenca <= DIFERENCA_MAXIMA);

        if (padraoDetectado && porcentagemValida && !alertaDisparado && !aguardandoResultado) {
            direcaoSugerida = pctJogador > pctBanca ? 'JOGADOR' : 'BANCA';
            let corSinal = direcaoSugerida === 'BANCA' ? '🔴 BANCA' : '🔵 JOGADOR';
            
            const mensagemTelegram = 
                `🎯 *SINAL DETECTADO (ESTRATÉGIA OFICIAL)!* 🎯\n\n` +
                `📊 *Padrão Mapeado:* ${padraoDetectado}\n` +
                `📈 *Diferença na Mesa:* ${diferenca.toFixed(1)}%\n\n` +
                `🎯 *ENTRADA:* JOGAR NA ${corSinal} (A Favor da Maioria)\n\n` +
                `${obterMensagemGestao()}`;

            await bot.sendMessage(chatId, mensagemTelegram, { parse_mode: 'Markdown' });
            
            alertaDisparado = true;
            aguardandoResultado = true; 
        }

    } catch (error) {
        // Anti-travamento do loop
    }
}

setInterval(analisarMesa, INTERVALO_VERIFICACAO);

// Teste de Ativação imediata enviado ao Telegram para checar o sinal
bot.sendMessage(chatId, `🚀 *ROBÔ DAMA DOS DADOS TOTALMENTE BLINDADO!*\n\nConfiguração 100% Fiel ao PDF:\n1️⃣ Padrão 2x1\n2️⃣ Padrão 2x2\n3️⃣ Padrão Escadinha\n4️⃣ Padrão Escadinha Invertido\n5️⃣ Padrão de Alternância\n6️⃣ Padrão de Alternância 2\n7️⃣ Quebra da Segunda Linha após o Surf\n\n🔥 Filtro: Diferença entre 10% e 18% | 🟡 Leitura de Empates Ativa!`, { parse_mode: 'Markdown' })
   .catch((e) => console.log(e.message));
