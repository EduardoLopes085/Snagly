import { browser } from 'wxt/browser';

const patterns = ['https://*.x.com/*','https://*.twitter.com/*','https://*.instagram.com/*','https://*.facebook.com/*'];

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, sender) => {
    if (message?.type !== 'snagly-download') return;
    const popupUrl = browser.runtime.getURL('/popup.html');
    if (sender.id !== browser.runtime.id ||
        sender.url?.split('?')[0] !== popupUrl ||
        typeof message.url !== 'string' ||
        typeof message.filename !== 'string') return;
    return (async () => {
      const id = await browser.downloads.download({
        url: message.url,
        filename: message.filename,
        conflictAction: 'uniquify',
      });
      const [download] = await browser.downloads.search({ id });
      if (!download || download.state === 'interrupted') {
        throw new Error('O navegador não conseguiu iniciar o download.');
      }
      return { id };
    })();
  });
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({id:'snagly-download',title:'Baixar com Snagly',contexts:['page','video','link','image'],documentUrlPatterns:patterns});
  });
  browser.contextMenus.onClicked.addListener(async (info,tab) => {
    if(info.menuItemId !== 'snagly-download' || tab?.id === undefined) return;
    const params = new URLSearchParams({tab:String(tab.id)});
    const [context] = await browser.scripting.executeScript({
      target:{tabId:tab.id},
      func:() => ({
        pageUrl:location.href,
        token:document.querySelector('[data-snagly-context]')?.getAttribute('data-snagly-context'),
      }),
    }).catch(() => []);
    const selected = info.linkUrl ?? context?.result?.pageUrl ?? info.pageUrl;
    if(selected) params.set('post',selected);
    const token = context?.result?.token;
    if(token && /^[\da-f-]{36}$/.test(token)) params.set('target',token);
    await browser.windows.create({url:browser.runtime.getURL('/popup.html')+'?'+params,type:'popup',width:960,height:680});
  });
});
