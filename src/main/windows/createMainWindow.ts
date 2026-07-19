import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { secureNavigation } from '@main/security/navigation';

const preloadPath = join(__dirname, '..', 'preload', 'index.js');

export const createMainWindow = async (): Promise<BrowserWindow> => {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  const rendererRoot = join(app.getAppPath(), 'dist', 'renderer');
  const window = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 800,
    minHeight: 700,
    title: 'SceneSift',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      devTools: Boolean(devServerUrl),
    },
  });

  if (devServerUrl) {
    await window.loadURL(devServerUrl);
  } else {
    await window.loadFile(join(rendererRoot, 'index.html'));
  }

  secureNavigation(window.webContents, devServerUrl, rendererRoot);
  window.once('ready-to-show', () => window.show());

  return window;
};
