export function isIosSafari(ua: string, standalone: boolean): boolean {
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isSafari = !(/CriOS|FxiOS|OPiOS|EdgiOS/i.test(ua));
  return isIos && isSafari && !standalone;
}

export function shouldShowInstallBanner(
  ua: string,
  standalone: boolean,
  dismissed: boolean
): boolean {
  return isIosSafari(ua, standalone) && !dismissed;
}
