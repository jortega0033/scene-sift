import { app, BrowserWindow, protocol } from 'electron';
import { join } from 'node:path';
import { createMainWindow } from '@main/windows/createMainWindow';
import { registerIpcHandlers } from '@main/ipc/registerIpcHandlers';
import { registerSmokeIpcHandlers } from '@main/ipc/registerSmokeIpcHandlers';
import { DatabaseService } from '@main/services/database/databaseService';
import { VideoService } from '@main/services/video/videoService';
import { registerLocalVideoProtocol } from '@main/services/video/localVideoProtocol';
import { applyCsp } from '@main/security/csp';

// Must run before app.ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'local', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

let dbService: DatabaseService | null = null;

const isSmokeTest = process.argv.includes('--smoke-test');
const isElectronQaSmoke = process.env.SCENESIFT_ELECTRON_SMOKE === '1';

if (isSmokeTest) {
  setTimeout(() => {
    app.quit();
  }, 5_000);
}

const initializeApp = async (): Promise<void> => {
  try {
    app.setName('SceneSift');
    applyCsp();

    if (isElectronQaSmoke) {
      registerSmokeIpcHandlers();
    } else {
      const databasePath = join(app.getPath('userData'), 'database', 'scenesift.sqlite');
      const migrationsFolder = join(app.getAppPath(), 'src', 'database', 'migrations');
      dbService = new DatabaseService(databasePath, migrationsFolder);
      dbService.initialize();
      const videoService = new VideoService(dbService);
      registerLocalVideoProtocol(videoService);
      registerIpcHandlers({ databaseService: dbService, videoService });
    }

    await createMainWindow();
  } catch (error) {
    console.error('[SceneSift][startup]', error);
    app.quit();
  }
};

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    dbService?.close();
    app.quit();
  }
});

app.on('before-quit', () => {
  dbService?.close();
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createMainWindow();
  }
});

process.on('uncaughtException', (error) => {
  console.error('[SceneSift][uncaughtException]', error.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('[SceneSift][unhandledRejection]', reason);
});

void app.whenReady().then(initializeApp);
