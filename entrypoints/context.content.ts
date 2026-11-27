export default defineContentScript({
  matches:['https://*.x.com/*','https://*.twitter.com/*','https://*.instagram.com/*','https://*.facebook.com/*'],
  main() {
    document.addEventListener('contextmenu',event => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      document.querySelector('[data-snagly-context]')?.removeAttribute('data-snagly-context');
      const token = crypto.randomUUID();
      target.setAttribute('data-snagly-context', token);
    },{capture:true});
  },
});
