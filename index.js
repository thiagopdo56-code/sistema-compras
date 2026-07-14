const { app, BrowserWindow } = require('electron');
const path = require('path');

// Se você usa o Express rodando em segundo plano, pode importá-lo aqui,
// ou simplesmente carregar o HTML direto se a API rodar separado.
function criarJanela() {
    const janelaPrincipal = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // Abre o arquivo de vendas ou a index (dashboard) do seu projeto
    janelaPrincipal.loadFile('index.html');

    // Remove a barra de menu padrão (opcional, deixa o visual mais limpo)
    janelaPrincipal.setMenu(null);
}

// Inicializa o app Electron
app.whenReady().then(() => {
    criarJanela();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) criarJanela();
    });
});

// Fecha o app quando todas as janelas forem fechadas (exceto no Mac)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});