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
const DIFERENCA_MINIMA = 8.0; 
const DIFERENCA_MAXIMA = 22.0; 

let totalGreens = 0;
let totalReds = 0;
let totalEmpates = 0;

let alertaDisparado = false;
let aguardandoResultado = false;
let direcaoSugerida = ''; 
let ultimaRodadaAnalisada = '';

// Variável para controlar o aviso de porcentagem e evitar spam
let avisoMesaAquecidaDisparado = false;

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

// CORE DE INTELIGÊNCIA - OS 7 PADRÕES REAIS DO LOUGANS (GATILHO IMEDIATO)
function verificar7Padrões(historicoLimpo) {
    if (historicoLimpo.length < 7) return false;

    const p3 = historicoLimpo.slice(0, 3);
    const p4 = historicoLimpo.slice(0, 4);
    const p5 = historicoLimpo.slice(0, 5);
    const p7 = historicoLimpo.slice(0, 7);

    // 4. PADRÃO ESCADINHA INVERTIDO (1x2x2) - TRAVA DE PRIORIDADE MÁXIMA
    if (p5[0] === p5[1] && p5[2] === p5[3] && p5[0] !== p5[2] && p5[4] === p5[0]) {
        return { nome: "PADRÃO ESCADINHA INVERTIDO", sugerido: p5[0] }; 
    }

    // 2. PADRÃO 2X2 (Inversão)
    if (p4[0] === p4[1] && p4[2] === p4[3] && p4[0] !== p4[2]) {
        return { nome: "PADRÃO 2X2", sugerido: p4[2] }; 
    }

    // 1. PADRÃO 2X1 (Formato do Lougans: 🔴 🔵 🔴 🔴)
    if (p4[0] === p4[2] && p4[0] === p4[3] && p4[1] !== p4[0]) {
        return { nome: "PADRÃO 2X1", sugerido: p4[0] }; 
    }

    // 3. PADRÃO ESCADINHA (3x2)
    if (p5[0] === p5[1] && p5[2] === p5[3] && p5[3] === p5[4] && p5[0] !== p5[2]) {
        return { nome: "PADRÃO ESCADINHA", sugerido: p5[2] }; 
    }

    // 5. PADRÃO DE ALTERNÂNCIA (Quebra do Surf)
    if (p5[1] === p5[2] && p5[2] === p5[3] && p5[3] === p5[4] && p5[0] !== p5[1]) {
        return { nome: "PADRÃO DE ALTERNÂNCIA (QUEBRA DO SURF)", sugerido: p5[1] }; 
    }

    // 6. PADRÃO DE ALTERNÂNCIA 2 (2x1 Repetido contra a mesa)
    if (p7[0] === p7[3] && p7[0] === p7[4] && p7[0] === p7[6] &&
        p7[1] === p7[5] && p7[1] !== p7[0] && p7[2] === p7[0]) {
        return { nome: "PADRÃO DE ALTERNÂNCIA 2", sugerido: p7[1] }; 
    }

    // 7. QUEBRA DA SEGUNDA LINHA APÓS O SURF
    const p6 = historicoLimpo.slice(0, 6);
    if (p6[0] === p6[1] && p6[2] === p6[3] && p6[3] === p6[4] && p6[4] === p6[5] && p6[0] !== p6[2]) {
        return { nome: "QUEBRA DA SEGUNDA LINHA APÓS O SURF", sugerido: p6[2] }; 
    }

    return false;
}

async function analisarMesa() {
    try {
        const response = await axios.get(API_URL);
        const dados = response.data;

        if (!dados || !dados.jogador_porcentagem || !dados.banca_porcentagem) return;

        const idRodadaAtual = dados.id_rodada || dados.gameId;
        const resultadoAtual = dados.resultado_rodada; 

        // VALIDAÇÃO DO RESULTADO DA JOGADA
        if (aguardandoResultado && idRodadaAtual !== ultimaRodadaAnalisada && resultadoAtual && resultadoAtual !== 'ESPERANDO') {
            if (resultadoAtual === direcaoSugerida) {
                totalGreens++;
                await bot.sendMessage(chatId, `✅ *GREEN CONFIRMADO!*`);
            } else if (resultadoAtual === 'EMPATE') {
                totalEmpates++;
                const multiplicadorEmpate = dados.multiplicador_empate || "4x"; 
                await bot.sendMessage(chatId, `🟡 *EMPATE COM PROTEÇÃO!* 🟡\n\n🎯 O resultado foi Empate de *${multiplicadorEmpate}*.\nA sua proteção salvou a banca!`);
            } else {
                totalReds++;
                await bot.sendMessage(chatId, `❌ *RED!* Sem Martingale, seguimos a gestão fixa.`);
            }
            aguardandoResultado = false;
            alertaDisparado = false;
            ultimaRodadaAnalisada = idRodadaAtual;
            return;
        }

        // Fluxo principal de análise na rodada nova
        if (idRodadaAtual !== ultimaRodadaAnalisada && resultadoAtual !== 'ESPERANDO') {
            
            const pctJogador = parseFloat(dados.jogador_porcentagem);
            const pctBanca = parseFloat(dados.banca_porcentagem);
            const diferenca = Math.abs(pctJogador - pctBanca); 

            // 🚨 NOVO: ALERTA DE PORCENTAGEM FAVORÁVEL (MESA AQUECIDA)
            if (diferenca >= DIFERENCA_MINIMA && diferenca <= DIFERENCA_MAXIMA) {
                if (!avisoMesaAquecidaDisparado && !aguardandoResultado) {
                    const maiorCor = pctJogador > pctBanca ? '🔵 JOGADOR' : '🔴 BANCA';
                    const msgAquecimento = 
                        `⚠️ *MESA EM ANÁLISE PROFUNDA!* ⚠️\n\n` +
                        `📈 A diferença de volume atingiu *${diferenca.toFixed(1)}%*.\n` +
                        `🔥 Tendência forte a favor de: *${maiorCor}*\n\n` +
                        `📱 *Fiquem atentos no grupo,* o robô está aguardando o fechamento geométrico dos padrões!`;
                    
                    await bot.sendMessage(chatId, msgAquecimento, { parse_mode: 'Markdown' });
                    avisoMesaAquecidaDisparado = true; // Trava o aviso para não repetir
                }
            } else {
                // Se a mesa esfriar (cair de 8%), reseta a trava para um próximo aquecimento
                avisoMesaAquecidaDisparado = false;
            }

            // LIMPEZA DE EMPATES PARA A FORMAÇÃO DOS PADRÕES
            const historicoBruto = dados.historico_resultados || dados.historico || []; 
            const historicoLimpo = historicoBruto.filter(res => res !== 'EMPATE' && res !== 'E' && res !== 'T');

            const padraoDetectado = verificar7Padrões(historicoLimpo);
            const porcentagemValida = (diferenca >= DIFERENCA_MINIMA && diferenca <= DIFERENCA_MAXIMA);

            if (padraoDetectado && porcentagemValida && !alertaDisparado && !aguardandoResultado) {
                direcaoSugerida = padraoDetectado.sugerido; 
                let corSinal = direcaoSugerida === 'BANCA' ? '🔴 BANCA' : '🔵 JOGADOR';
                
                const mensagemTelegram = 
                    `🎯 *SINAL DETECTADO (ESTRATÉGIA OFICIAL)!* 🎯\n\n` +
                    `📊 *Padrão Mapeado:* ${padraoDetectado.nome}\n` +
                    `📈 *Diferença na Mesa:* ${diferenca.toFixed(1)}%\n\n` +
                    `🎯 *ENTRADA:* JOGAR NA ${corSinal}\n\n` +
                    `${obterMensagemGestao()}`;

                await bot.sendMessage(chatId, mensagemTelegram, { parse_mode: 'Markdown' });
                
                alertaDisparado = true;
                aguardandoResultado = true; 
                ultimaRodadaAnalisada = idRodadaAtual;
            }
        }

    } catch (error) {
        // Anti-travamento
    }
}

setInterval(analisarMesa, INTERVALO_VERIFICACAO);

// Teste de Ativação imediata enviado ao Telegram
bot.sendMessage(chatId, `🚀 *ROBÔ DAMA DOS DADOS ATUALIZADO!*\n\nConfiguração Atual:\n🔥 Trava de Porcentagem: *8% a 22%*\n⚠️ Alerta de Pré-Sinal (Mesa Aquecida) Ativo!\n🟡 Filtro de Empate Inteligente Ativo!`, { parse_mode: 'Markdown' })
   .catch((e) => console.log(e.message));
