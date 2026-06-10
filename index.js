async function analisarMesa() {
    try {
        const response = await axios.get(API_URL);
        const dados = response.data;

        if (!dados) {
            console.log("⚠️ API respondeu, mas os dados vieram vazios.");
            return;
        }

        // 🟢 DIAGNÓSTICO 1: Ver o que está vindo da API
        console.log(`[MESA] Jogador: ${dados.jogador_porcentagem}% | Banca: ${dados.banca_porcentagem}% | Rodada: ${dados.id_rodada || dados.gameId} | Resultado: ${dados.resultado_rodada}`);

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

        if (idRodadaAtual !== ultimaRodadaAnalisada && resultadoAtual !== 'ESPERANDO') {
            
            const pctJogador = parseFloat(dados.jogador_porcentagem || 0);
            const pctBanca = parseFloat(dados.banca_porcentagem || 0);
            const diferenca = Math.abs(pctJogador - pctBanca); 

            // ALERTA DE PORCENTAGEM FAVORÁVEL
            if (diferenca >= DIFERENCA_MINIMA && diferenca <= DIFERENCA_MAXIMA) {
                if (!avisoMesaAquecidaDisparado && !aguardandoResultado) {
                    const maiorCor = pctJogador > pctBanca ? '🔵 JOGADOR' : '🔴 BANCA';
                    const msgAquecimento = 
                        `⚠️ *MESA EM ANÁLISE PROFUNDA!* ⚠️\n\n` +
                        `📈 A diferença de volume atingiu *${diferenca.toFixed(1)}%*.\n` +
                        `🔥 Tendência forte a favor de: *${maiorCor}*\n\n` +
                        `📱 *Fiquem atentos no grupo!*`;
                    
                    await bot.sendMessage(chatId, msgAquecimento, { parse_mode: 'Markdown' });
                    avisoMesaAquecidaDisparado = true;
                }
            } else {
                avisoMesaAquecidaDisparado = false;
            }

            // LIMPEZA DE EMPATES
            const historicoBruto = dados.historico_resultados || dados.historico || []; 
            
            // 🟢 DIAGNÓSTICO 2: Ver o histórico bruto que o robô achou
            console.log(`[HISTÓRICO BRUTO ENCONTRADO]:`, historicoBruto);

            const historicoLimpo = historicoBruto.filter(res => res !== 'EMPATE' && res !== 'E' && res !== 'T');
            
            // 🟢 DIAGNÓSTICO 3: Ver o histórico após limpar os empates
            console.log(`[HISTÓRICO LIMPO PARA PADRÕES]:`, historicoLimpo);

            const padraoDetectado = verificar7Padrões(historicoLimpo);
            const porcentagemValida = (diferenca >= DIFERENCA_MINIMA && diferenca <= DIFERENCA_MAXIMA);

            // 🟢 DIAGNÓSTICO 4: Ver por que não enviou
            if (padraoDetectado) {
                console.log(`🎯 PADRÃO DETECTADO: ${padraoDetectado.nome} | Porcentagem Válida? ${porcentagemValida} (Dif: ${diferenca.toFixed(1)}%)`);
            }

            if (padraoDetectado && porcentagemValida && !alertaDisparado && !aguardandoResultado) {
                direcaoSugerida = padraoDetectado.sugerido; 
                
                // Força a conversão caso a API use siglas como 'P' ou 'B'
                let corSinal = '';
                if (direcaoSugerida === 'BANCA' || direcaoSugerida === 'B') {
                    corSinal = '🔴 BANCA';
                    direcaoSugerida = 'BANCA'; // padroniza para a checagem de resultado
                } else {
                    corSinal = '🔵 JOGADOR';
                    direcaoSugerida = 'JOGADOR'; // padroniza para a checagem de resultado
                }
                
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
        console.log("❌ Erro no loop de análise:", error.message);
    }
}
