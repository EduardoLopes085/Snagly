import { browser } from 'wxt/browser';

export default defineContentScript({
  matches:['https://*.x.com/*','https://*.twitter.com/*','https://*.instagram.com/*','https://*.facebook.com/*'],
  main() {
    document.addEventListener('contextmenu',event => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const article = target.closest('article');
      const instagram = /(^|\.)instagram\.com$/.test(location.hostname);
      const link = instagram
        ? target.closest('a') ?? article?.querySelector<HTMLAnchorElement>('a[href*="/reel/"],a[href*="/p/"]')
        : article?.querySelector('time')?.closest('a') ?? target.closest('a');
      document.querySelector('[data-snagly-context]')?.removeAttribute('data-snagly-context');
      const token = crypto.randomUUID();
      target.setAttribute('data-snagly-context', token);
      void browser.runtime.sendMessage({type:'snagly-context',url:link?.href ?? location.href,token}).catch(() => {});
    },{capture:true});
  },
});
