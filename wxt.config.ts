import { defineConfig } from 'wxt';

export default defineConfig({
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    name: 'Snagly',
    description: '__MSG_description__',
    default_locale: 'en',
    permissions: ['activeTab', 'scripting', 'downloads', 'contextMenus'],
    optional_host_permissions: ['https://cdn.syndication.twimg.com/*', 'https://video.twimg.com/*', 'https://*.cdninstagram.com/*', 'https://*.fbcdn.net/*'],
    content_security_policy: {
      extension_pages: "default-src 'none'; script-src 'self'; worker-src 'self'; style-src 'self'; media-src https: blob:; img-src https:; connect-src https://cdn.syndication.twimg.com https://video.twimg.com https://*.cdninstagram.com https://*.fbcdn.net; object-src 'none'; base-uri 'none'; form-action 'none'",
    },
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'snagly@snagly-extension',
          strict_min_version: '140.0',
          data_collection_permissions: { required: ['none'] },
        },
      },
    }),
  }),
});
