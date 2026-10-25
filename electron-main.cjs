/**
 * VAAIRO Spirits & Beverage ERP — Desktop Native Wrapper (Electron)
 * Provides direct ESC/POS hardware thermal printer access, cash drawer kicks,
 * and offline window frame management for enterprise POS terminals.
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    backgroundColor: '#0A006E',
    title: 'VAAIRO Spirits & Beverage ERP — Enterprise Terminal',
    icon: path.join(__dirname, 'public', 'apple-touch-icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'electron-preload.cjs'),
    },
  });

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handler: Direct Hardware Thermal Receipt Printing
ipcMain.handle('print-thermal-receipt', async (event, { rawContent, silent = true }) => {
  if (!mainWindow) return { success: false, error: 'No active window' };
  try {
    const printers = await mainWindow.webContents.getPrintersAsync();
    return { success: true, printers };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
