// js/relatorios.js

// ====== CONFIGURAÇÃO FIREBASE ======
const firebaseConfig = {
  apiKey: "AIzaSyD7wJktOHu8-DcjUJuq2LNfc3tzbPYG51I",
  authDomain: "vendas-5be3a.firebaseapp.com",
  projectId: "vendas-5be3a",
  storageBucket: "vendas-5be3a.firebasestorage.app",
  messagingSenderId: "1081607347261",
  appId: "1:1081607347261:web:042bcb33c48d115d6ade54",
  measurementId: "G-VCGD6B2XET"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
// ===================================

let todasAsVendas = [];
let chartInstancia = null;

document.addEventListener("DOMContentLoaded", async () => {
    const hoje = new Date();
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(hoje.getDate() - 7);

    document.getElementById("filtro-data-ini").value = formatarDataInput(seteDiasAtras);
    document.getElementById("filtro-data-fim").value = formatarDataInput(hoje);

    await carregarVendasBanco();

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            window.location.href = "index.html";
        }
    });
});

function formatarDataInput(data) {
    let rAno = data.getFullYear();
    let rMes = String(data.getMonth() + 1).padStart(2, '0');
    let rDia = String(data.getDate()).padStart(2, '0');
    return `${rAno}-${rMes}-${rDia}`;
}

async function carregarVendasBanco() {
    try {
        const snapshot = await db.collection("vendas").get();
        todasAsVendas = [];
        snapshot.forEach(doc => {
            todasAsVendas.push({ id: doc.id, ...doc.data() });
        });
        filtrarVendas();
    } catch (e) {
        console.error("Erro ao carregar vendas:", e);
    }
}

function filtrarVendas() {
    const dataIniInput = document.getElementById("filtro-data-ini").value;
    const dataFimInput = document.getElementById("filtro-data-fim").value;

    if (!dataIniInput || !dataFimInput) return;

    const partsIni = dataIniInput.split('-');
    const dateIni = new Date(partsIni[0], partsIni[1] - 1, partsIni[2], 0, 0, 0);

    const partsFim = dataFimInput.split('-');
    const dateFim = new Date(partsFim[0], partsFim[1] - 1, partsFim[2], 23, 59, 59);

    const vendasFiltradas = todasAsVendas.filter(venda => {
        if (!venda.data) return false;
        const p = venda.data.split('/');
        const dataVenda = new Date(p[2], p[1] - 1, p[0]);
        return dataVenda >= dateIni && dataVenda <= dateFim;
    });

    let totalVendas = 0;
    vendasFiltradas.forEach(v => {
        totalVendas += v.totalLiquido || v.totalBruto || 0;
    });

    document.getElementById("resumo-vendas").innerText = `R$ ${totalVendas.toFixed(2).replace('.', ',')}`;
    document.getElementById("resumo-total").innerText = `R$ ${totalVendas.toFixed(2).replace('.', ',')}`;

    renderizarCardsVendas(vendasFiltradas);
    atualizarGrafico(vendasFiltradas);
}

function renderizarCardsVendas(vendas) {
    const container = document.getElementById("tabela-relatorios");
    container.innerHTML = "";

    if (vendas.length === 0) {
        container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #64748b; font-weight: bold; padding: 30px;">Nenhuma venda encontrada para o período selecionado.</p>`;
        return;
    }

    vendas.forEach(venda => {
        const total = venda.totalLiquido || venda.totalBruto || 0;
        const pagamento = venda.pagamento || "Dinheiro";
        const dataHora = `${venda.data} às ${venda.hora || ''}`;
        const totalItens = venda.itens ? venda.itens.length : 0;

        container.innerHTML += `
            <div class="card-venda">
                <div class="card-venda-header">
                    <span class="card-venda-id"><i class="fa-solid fa-hashtag"></i> ${venda.id.substring(0, 6).toUpperCase()}</span>
                    <span class="card-venda-data"><i class="fa-regular fa-clock"></i> ${dataHora}</span>
                </div>
                <div class="card-venda-body">
                    <div class="card-venda-info">
                        <span class="info-label">Forma de Pgto:</span>
                        <span class="info-valor pgto-tag">${pagamento}</span>
                    </div>
                    <div class="card-venda-info">
                        <span class="info-label">Produtos:</span>
                        <span class="info-valor">${totalItens} item(ns)</span>
                    </div>
                    <div class="card-venda-total">
                        <span class="total-label">Total:</span>
                        <span class="total-valor">R$ ${total.toFixed(2).replace('.', ',')}</span>
                    </div>
                </div>
                <div class="card-venda-acoes">
                    <button onclick="editarVendaNoCaixa('${venda.id}')" class="btn-card-editar" title="Editar nota no caixa">
                        <i class="fa-solid fa-pen"></i> Editar
                    </button>
                    <button onclick="excluirVenda('${venda.id}')" class="btn-card-excluir" title="Excluir nota permanentemente">
                        <i class="fa-solid fa-trash"></i> Excluir
                    </button>
                </div>
            </div>
        `;
    });
}

function atualizarGrafico(vendas) {
    const agrupado = {};
    vendas.forEach(v => {
        agrupado[v.data] = (agrupado[v.data] || 0) + (v.totalLiquido || v.totalBruto || 0);
    });

    const labels = Object.keys(agrupado).sort((a, b) => {
        const pa = a.split('/'); const pb = b.split('/');
        return new Date(pa[2], pa[1] - 1, pa[0]) - new Date(pb[2], pb[1] - 1, pb[0]);
    });
    const valores = labels.map(l => agrupado[l]);

    const ctx = document.getElementById('graficoVendas').getContext('2d');
    
    if (chartInstancia) {
        chartInstancia.destroy();
    }

    chartInstancia = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Faturamento',
                data: valores,
                borderColor: '#0055A4',
                backgroundColor: 'rgba(0, 85, 164, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.3,
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
            alert("Venda excluída com sucesso!");
            await carregarVendasBanco();
        } catch (e) {
            console.error("Erro ao excluir venda:", e);
            alert("Erro ao excluir do Firebase.");
        }
    }
}