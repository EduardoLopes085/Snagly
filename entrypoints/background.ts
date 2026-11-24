import { browser } from 'wxt/browser';

const patterns = ['https://*.x.com/*','https://*.twitter.com/*','https://*.instagram.com/*','https://*.facebook.com/*'];
const targets = new Map<number,{url:string;token?:string}>();

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
  browser.runtime.onMessage.addListener((message,sender) => {
    if (sender.tab?.id === undefined || message?.type !== 'snagly-context' || typeof message.url !== 'string') return;
    try {
      const url = new URL(message.url);
      if (url.protocol === 'https:' && /(^|\.)(x|twitter|instagram|facebook)\.com$/.test(url.hostname)) {
        targets.set(sender.tab.id, {
          url: url.href,
          token: typeof message.token === 'string' && /^[\da-f-]{36}$/.test(message.token) ? message.token : undefined,
        });
      }
    } catch { /* Invalid page data. */ }
  });
  browser.tabs.onRemoved.addListener(id => targets.delete(id));
  browser.tabs.onUpdated.addListener((id,change) => { if(change.url) targets.delete(id); });
  browser.contextMenus.onClicked.addListener(async (info,tab) => {
    if(info.menuItemId !== 'snagly-download' || tab?.id === undefined) return;
    const params = new URLSearchParams({tab:String(tab.id)});
    const context = targets.get(tab.id);
    const selected = context?.url ?? info.linkUrl ?? info.pageUrl;
    targets.delete(tab.id);
    if(selected) params.set('post',selected);
    if(context?.token) params.set('target',context.token);
    await browser.windows.create({url:browser.runtime.getURL('/popup.html')+'?'+params,type:'popup',width:960,height:680});
  });
});
