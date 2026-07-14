// js/relatorios.js

// ====== CONFIGURAÇÃO FIREBASE ======
const firebaseConfig = {
  apiKey: "AIzaSyBZYWl6TWgSthBAVe1bTp2SkmDAdmtXieM",
  authDomain: "vendas2-47769.firebaseapp.com",
  projectId: "vendas2-47769",
  storageBucket: "vendas2-47769.firebasestorage.app",
  messagingSenderId: "34980699438",
  appId: "1:34980699438:web:643b2dbe31331d16886ebf",
  measurementId: "G-Y1MGMGQWDK"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
// ===================================

let todasAsVendas = [];
let chartInstancia = null;
document.addEventListener("DOMContentLoaded", async () => {
    // ... manter códigos existentes ...
    forcarLetrasMaiusculas();
});

function forcarLetrasMaiusculas() {
    const aplicarNosInputs = () => {
        document.querySelectorAll('input[type="text"], textarea').forEach(input => {
            if (!input.dataset.maiusculaConfigurada) {
                input.dataset.maiusculaConfigurada = "true";
                input.style.textTransform = "uppercase";
                input.addEventListener('input', function() {
                    this.value = this.value.toUpperCase();
                });
            }
        });
    };
    aplicarNosInputs();
    const observer = new MutationObserver(aplicarNosInputs);
    observer.observe(document.body, { childList: true, subtree: true });
}

// Mantendo a função nativa de edição no Caixa interligada
function editarVendaNoCaixa(idVenda) {
    if(confirm("Deseja abrir esta nota no CAIXA para editá-la?")) {
        localStorage.setItem("editandoVendaId", idVenda);
        window.location.href = "vendas.html";
    }
}
document.addEventListener("DOMContentLoaded", async () => {
    // 1. Injeta os campos de hora dinamicamente no HTML existente
    injetarInputsDeHora();

    const hoje = new Date();
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(hoje.getDate() - 7);

    document.getElementById("filtro-data-ini").value = formatarDataInput(seteDiasAtras);
    document.getElementById("filtro-data-fim").value = formatarDataInput(hoje);

    await carregarVendasBanco();

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") window.location.href = "index.html";
    });
});

// ==== INJEÇÃO AUTOMÁTICA DOS CAMPOS DE HORA ====
function injetarInputsDeHora() {
    const dataIniInput = document.getElementById("filtro-data-ini");
    if (dataIniInput && !document.getElementById("filtro-hora-ini")) {
        const wrapper = document.createElement("div");
        wrapper.style.display = "flex";
        wrapper.style.gap = "5px";
        dataIniInput.parentNode.insertBefore(wrapper, dataIniInput);
        wrapper.appendChild(dataIniInput);
        
        const horaIni = document.createElement("input");
        horaIni.type = "time";
        horaIni.id = "filtro-hora-ini";
        horaIni.value = "00:00";
        wrapper.appendChild(horaIni);
    }

    const dataFimInput = document.getElementById("filtro-data-fim");
    if (dataFimInput && !document.getElementById("filtro-hora-fim")) {
        const wrapper = document.createElement("div");
        wrapper.style.display = "flex";
        wrapper.style.gap = "5px";
        dataFimInput.parentNode.insertBefore(wrapper, dataFimInput);
        wrapper.appendChild(dataFimInput);
        
        const horaFim = document.createElement("input");
        horaFim.type = "time";
        horaFim.id = "filtro-hora-fim";
        horaFim.value = "23:59";
        wrapper.appendChild(horaFim);
    }
}

function formatarDataInput(dateObj) {
    const d = String(dateObj.getDate()).padStart(2, '0');
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const y = dateObj.getFullYear();
    return `${y}-${m}-${d}`; 
}

// Junta a string de Data (DD/MM/YYYY) com Hora (HH:MM:SS) em Milissegundos exatos
function converterDataHoraBrParaDate(dataBr, horaBr) {
    if (!dataBr) return 0;
    const partes = dataBr.split('/');
    if (partes.length !== 3) return 0;

    let h = 0, m = 0, s = 0;
    if (horaBr) {
        const partesHora = horaBr.split(':');
        h = parseInt(partesHora[0]) || 0;
        m = parseInt(partesHora[1]) || 0;
        s = parseInt(partesHora[2]) || 0;
    }
    
    return new Date(partes[2], partes[1] - 1, partes[0], h, m, s).getTime();
}

async function carregarVendasBanco() {
    try {
        const snapshot = await db.collection("vendas").get();
        todasAsVendas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        aplicarFiltros(); 
    } catch (e) {
        console.error("Erro ao carregar vendas do Firebase.", e);
    }
}

function aplicarFiltros() {
    // Coleta as Datas
    const iniStr = document.getElementById("filtro-data-ini").value;
    const fimStr = document.getElementById("filtro-data-fim").value;
    
    // Coleta as Horas (se o elemento não existir por algum motivo, usa padrão)
    const horaIniStr = document.getElementById("filtro-hora-ini") ? document.getElementById("filtro-hora-ini").value : "00:00";
    const horaFimStr = document.getElementById("filtro-hora-fim") ? document.getElementById("filtro-hora-fim").value : "23:59";

    // Converte os inputs no padrão universal de timestamp
    const dtInicioMs = new Date(`${iniStr}T${horaIniStr}:00`).getTime();
    const dtFimMs = new Date(`${fimStr}T${horaFimStr}:59`).getTime();

    let totalVendas = 0;
    let totalContasRecebidas = 0;

    const vendasFiltradas = todasAsVendas.filter(v => {
        // Converte a data e a hora que vem do firebase para timestamp
        const vMs = converterDataHoraBrParaDate(v.data, v.hora);
        return vMs >= dtInicioMs && vMs <= dtFimMs;
    });

    const vendasParaTabela = [...vendasFiltradas].reverse();

    const tbody = document.getElementById("tabela-relatorios");
    tbody.innerHTML = "";

    if (vendasParaTabela.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color:#ef4444;"><i class="fa-solid fa-folder-open"></i> Nenhuma movimentação no período/horário selecionado.</td></tr>`;
    }

    let faturamentoPorData = {};

    vendasParaTabela.forEach(venda => {
        let totalFloat = parseFloat(venda.totalLiquido || venda.totalBruto || venda.valorParaRelatorio || 0);
        let eRecebimento = venda.pagamento === "Recebimento de Conta";

        if (eRecebimento) {
            totalContasRecebidas += totalFloat;
        } else {
            totalVendas += totalFloat;
        }

        // Agrupa os valores por dia (ignora a hora pro gráfico ficar visível)
        if (!faturamentoPorData[venda.data]) faturamentoPorData[venda.data] = 0;
        faturamentoPorData[venda.data] += totalFloat;

        let badgeTipo = eRecebimento 
            ? `<span style="background: #f59e0b; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;"><i class="fa-solid fa-handshake"></i> Conta Recebida</span>`
            : `<span style="background: #10b981; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;"><i class="fa-solid fa-cart-shopping"></i> Venda Caixa</span>`;
        
        let idExibicao = venda.id ? venda.id.substring(0,5) : '-';

        tbody.innerHTML += `
            <tr>
                <td>#${idExibicao}</td>
                <td>${venda.data} às ${venda.hora || '--:--'}</td>
                <td>${badgeTipo}</td>
                <td>${venda.pagamento}</td>
                <td style="color: #10b981; font-weight: 900;">R$ ${totalFloat.toFixed(2).replace('.', ',')}</td>
                <td class="acoes-cell">
                    <button class="btn-icon edit" onclick="editarVendaNoCaixa('${venda.id}')" title="Editar no PDV">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="btn-icon delete" onclick="excluirVenda('${venda.id}')" title="Excluir Definitivamente">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    let totalGeral = totalVendas + totalContasRecebidas;
    document.getElementById("resumo-vendas").innerText = `R$ ${totalVendas.toFixed(2).replace('.', ',')}`;
    document.getElementById("resumo-contas").innerText = `R$ ${totalContasRecebidas.toFixed(2).replace('.', ',')}`;
    document.getElementById("resumo-total").innerText = `R$ ${totalGeral.toFixed(2).replace('.', ',')}`;

    renderizarGraficoMontanhaRussa(faturamentoPorData);
}

function renderizarGraficoMontanhaRussa(dadosPorData) {
    const datasOrdenadas = Object.keys(dadosPorData).sort((a, b) => {
        return converterDataHoraBrParaDate(a, "00:00") - converterDataHoraBrParaDate(b, "00:00");
    });

    const labels = [];
    const dados = [];

    datasOrdenadas.forEach(data => {
        labels.push(data.substring(0, 5)); 
        dados.push(dadosPorData[data]);
    });

    const ctx = document.getElementById('graficoVendas').getContext('2d');
    
    if (chartInstancia) chartInstancia.destroy();

    chartInstancia = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Faturamento Diário (R$)',
                data: dados,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.2)', 
                borderWidth: 3,
                fill: true, 
                tension: 0.4, 
                pointBackgroundColor: '#0055A4',
                pointRadius: 5,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { 
                y: { beginAtZero: true, grid: { color: '#e2e8f0' } },
                x: { grid: { display: false } }
            },
            plugins: { 
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let valor = context.raw || 0;
                            return ' Faturamento: R$ ' + valor.toFixed(2).replace('.', ',');
                        }
                    }
                }
            }
        }
    });
}

function editarVendaNoCaixa(idVenda) {
    if(confirm("Deseja abrir esta nota no CAIXA para editá-la?")) {
        localStorage.setItem("editandoVendaId", idVenda);
        window.location.href = "vendas.html";
    }
}

async function excluirVenda(idVenda) {
    if(confirm(`ATENÇÃO! Deseja EXCLUIR DEFINITIVAMENTE a nota?\n\nIsso NÃO voltará os produtos para o estoque automaticamente.`)) {
        try {
            await db.collection("vendas").doc(idVenda).delete();
            alert("Venda excluída com sucesso.");
            await carregarVendasBanco(); 
        } catch(e) {
            alert("Erro de conexão com o Firebase.");
        }
    }
}