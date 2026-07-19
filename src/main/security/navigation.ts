import { shell, type WebContents } from 'electron';
import { fileURLToPath } from 'node:url';
import { relative, resolve, sep } from 'node:path';

export const isAllowedUrl = (
  url: string,
  devServerUrl?: string,
  allowedFileRoot?: string,
): boolean => {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol === 'file:' && allowedFileRoot) {
      const requestedPath = resolve(fileURLToPath(parsedUrl));
      const rootPath = resolve(allowedFileRoot);
      const normalizedRoot = process.platform === 'win32' ? rootPath.toLowerCase() : rootPath;
      const normalizedRequested =
        process.platform === 'win32' ? requestedPath.toLowerCase() : requestedPath;
      const withinRoot =
        normalizedRequested === normalizedRoot ||
        normalizedRequested.startsWith(`${normalizedRoot}${sep}`);
      if (!withinRoot) {
        return false;
      }

      const distance = relative(rootPath, requestedPath);
      return distance === '' || (!distance.startsWith('..') && !distance.includes(':'));
    }

    if (!devServerUrl) {
      return false;
    }

    const allowedDevUrl = new URL(devServerUrl);
    return (
      (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') &&
      parsedUrl.origin === allowedDevUrl.origin &&
      parsedUrl.pathname.startsWith(allowedDevUrl.pathname)
    );
  } catch {
    return false;
  }
};

export const secureNavigation = (
  webContents: WebContents,
  devServerUrl?: string,
  allowedFileRoot?: string,
): void => {
  webContents.on('will-navigate', (event, url) => {
    if (!isAllowedUrl(url, devServerUrl, allowedFileRoot)) {
      event.preventDefault();
    }
  });

  webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      void shell.openExternal(url);
    }

    return { action: 'deny' };
  });
};
