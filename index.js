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
let historicoRodadas = []; // [0] = Mais recente, [1] = Penúltimo...

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
function verificar7Padrões(historico) {
    if (historico.length < 7) return false;

    // Fatias limpas onde [0] é o que acabou de cair na tela
    const p3 = historico.slice(0, 3);
    const p4 = historico.slice(0, 4);
    const p5 = historico.slice(0, 5);
    const p7 = historico.slice(0, 7);

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
    const p6 = historico.slice(0, 6);
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

        const pctJogador = parseFloat(dados.jogador_porcentagem);
        const pctBanca = parseFloat(dados.banca_porcentagem);
        const diferenca = Math.abs(pctJogador - pctBanca); 
        const resultadoAtual = dados.resultado_rodada; // Deve retornar 'JOGADOR', 'BANCA' ou 'EMPATE'
        
        const multiplicadorEmpate = dados.multiplicador_empate || "4x"; 

        // Alimenta o histórico inserindo o mais recente no início do array [0]
        if (resultadoAtual && resultadoAtual !== 'ESPERANDO' && resultadoAtual !== 'EMPATE') {
            if (historicoRodadas[0] !== resultadoAtual) {
                historicoRodadas.unshift(resultadoAtual); // unshift garante que [0] é o mais novo
                if (historicoRodadas.length > 15) historicoRodadas.pop();
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

        // EXECUÇÃO DOS FILTROS UNIFICADOS
        const padraoDetectado = verificar7Padrões(historicoRodadas);
        const porcentagemValida = (diferenca >= DIFERENCA_MINIMA && diferenca <= DIFERENCA_MAXIMA);

        if (padraoDetectado && porcentagemValida && !alertaDisparado && !aguardandoResultado) {
            // Define a direção com base no retorno preciso do padrão geométrico
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
        }

    } catch (error) {
        // Evita travamento
    }
}

setInterval(analisarMesa, INTERVALO_VERIFICACAO);

// Teste de Ativação imediata enviado ao Telegram para checar o sinal
bot.sendMessage(chatId, `🚀 *ROBÔ DAMA DOS DADOS TOTALMENTE BLINDADO!*\n\nConfiguração 100% Fiel ao PDF (Gatilho Rápido):\n1️⃣ Padrão 2x1 (Corrigido)\n2️⃣ Padrão 2x2\n3️⃣ Padrão Escadinha (3x2)\n4️⃣ Padrão Escadinha Invertido (Prioridade)\n5️⃣ Padrão de Alternância (Quebra de Surf)\n6️⃣ Padrão de Alternância 2 (2x1 Contínuo)\n7️⃣ Quebra da Segunda Linha após o Surf\n\n🔥 Filtro: Diferença entre 10% e 18% | 🟡 Leitura de Empates Ativa!`, { parse_mode: 'Markdown' })
   .catch((e) => console.log(e.message));
