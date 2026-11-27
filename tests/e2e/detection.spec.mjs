import { test as base, expect, chromium } from "@playwright/test";
import { resolve } from "node:path";
import { resolveMediaTarget } from "../../src/target.ts";
import {
  mountedMetaVariants,
  validatedInstagramVariants,
} from "../../src/instagram-player.ts";
import { mountedXVariants, validatedXVariants } from "../../src/x-player.ts";
import { scanSocialPost } from "../../src/social.ts";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const token = "a1111111-1111-4111-8111-111111111111";
const selectedToken = "b2222222-2222-4222-8222-222222222222";
const extension = resolve(".output/chrome-mv3");
const test = base.extend({
  context: async ({}, use, info) => {
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      executablePath: process.env.SNAGLY_CHROMIUM_PATH,
      headless: true,
      args: [
        `--disable-extensions-except=${extension}`,
        `--load-extension=${extension}`,
        "--enable-unsafe-extension-debugging",
      ],
    });
    await context.tracing.start({ screenshots: true, snapshots: true });
    try {
      await use(context);
    } finally {
      await context.tracing.stop(
        info.status !== info.expectedStatus
          ? { path: info.outputPath("trace.zip") }
          : {},
      );
      await context.close();
    }
  },
});

for (const permalink of [false, true]) {
  for (const clicked of [false, true]) {
    test(`X resolves a quoted video, permalink=${permalink}, clicked=${clicked}`, async ({context,page}) => {
      const clip = 'https://video.twimg.com/amplify_video/456/vid/avc1/640x360/quote.mp4';
      const media = url => ({video_info:{variants:[{content_type:'video/mp4',url}]}});
      const data = {rest_id:'123',quoted_status_result:{result:{rest_id:'234',legacy:{extended_entities:{media:[media(clip)]}}}}};
      const html = '<article><a href="/outer/status/123"><time>outer</time></a><div role="link">' +
        (permalink ? '<a href="/quoted/status/234"><time>quoted</time></a>' : '') +
        '<div><video id="target" width="200" height="100" poster="https://pbs.twimg.com/amplify_video_thumb/456/img/a.jpg"></video><button id="overlay">play</button></div>' +
        '</div></article><article><a href="/reply/status/999"><time>reply</time></a><video width="200" height="100"></video></article>' +
        '<script type="application/json">' + JSON.stringify([data,{rest_id:'999',legacy:{extended_entities:{media:[media(clip.replace('/456/','/789/'))]}}}]) + '</script>';
      await fixture(page,'https://x.com/outer/status/123',html);
      let clickedToken;
      if (clicked) {
        await page.locator('#overlay').dispatchEvent('contextmenu');
        clickedToken = await page.locator('#overlay').getAttribute('data-snagly-context');
      }
      const popup = await openPopup(context,page);
      if (clicked) await popup.goto(popup.url()+'&target='+clickedToken);
      await expect(popup.locator('#media li')).toHaveCount(1);
      await expect(popup.locator('#media video')).toHaveAttribute('src',clip);
    });
  }
}

test('X reads nested quote props without scanning unrelated replies', async ({page}) => {
  const url = 'https://video.twimg.com/amplify_video/456/vid/640x360/quote.mp4';
  await fixture(page,'https://x.com/outer/status/123','<article><a href="/outer/status/123"><time>outer</time></a><video id="target" width="200" height="100" poster="https://pbs.twimg.com/amplify_video_thumb/456/img/a.jpg"></video></article>');
  await page.locator('#target').evaluate((node,{url,token}) => {
    node.setAttribute('data-snagly-context',token);
    const props = {tweet:{quoted_status_result:{result:{legacy:{extended_entities:{media:[{video_info:{variants:[{url}]}}]}}}}}};
    props.tweet.replies = [{video_info:{variants:[{url:url.replace('/456/','/789/')}]}}];
    node.__reactProps$test = props;
  },{url,token});
  await scan(page);
  const raw = await page.evaluate(`(${mountedXVariants.toString()})("123",location.href,"${selectedToken}")`);
  expect(validatedXVariants(raw)).toEqual([{url,quality:'360p'}]);
});

test('X finds cached quote media using only the selected poster identity', async ({page}) => {
  const url = 'https://video.twimg.com/amplify_video/456/vid/640x360/quote.mp4';
  await fixture(page,'https://x.com/outer/status/123','<article><a href="/outer/status/123"><time>outer</time></a><video id="target" width="200" height="100" poster="https://pbs.twimg.com/amplify_video_thumb/456/img/a.jpg"></video></article><script type="application/json">'+JSON.stringify({rest_id:'234',legacy:{extended_entities:{media:[{video_info:{variants:[{content_type:'video/mp4',url}]}}]}}})+'</script>');
  const result = await scan(page,null,null);
  const sources = await page.evaluate(`(${scanSocialPost.toString()})({site:"X",id:"123"},location.href,null,"${result.selectionToken}")`);
  expect(sources).toEqual([{url,quality:'360p'}]);
});

const platforms = [
  {
    site: "X",
    origin: "https://x.com",
    paths: ["/home", "/messages/1", "/author/status/123"],
    link: "/author/status/123",
    other: "/another/status/321",
    url: "https://video.twimg.com/ext_tw_video/456/vid/640x360/clip.mp4",
  },
  {
    site: "Instagram",
    origin: "https://www.instagram.com",
    paths: ["/", "/direct/t/1/", "/reel/Target/"],
    link: "/reel/Target/",
    other: "/reel/Other/",
    url: "https://scontent.cdninstagram.com/clip.mp4?sig=test",
  },
  {
    site: "Facebook",
    origin: "https://www.facebook.com",
    paths: ["/", "/messages/t/1", "/watch/?v=123"],
    link: "/watch/?v=123",
    other: "/watch/?v=321",
    url: "https://video.fbcdn.net/clip.mp4?sig=test",
  },
];

async function scan(page, preferred = null, context = token) {
  return page.evaluate(
    `(${resolveMediaTarget.toString()})(${JSON.stringify(preferred)},${JSON.stringify(context)},${JSON.stringify(selectedToken)})`,
  );
}

async function fixture(page, url, html) {
  await page.context().route("**/*", (route) => {
    if (!route.request().url().startsWith("https://")) return route.continue();
    if (route.request().isNavigationRequest())
      return route.fulfill({ contentType: "text/html", body: html });
    return route.abort();
  });
  await page.goto(url);
}

function articles(platform) {
  return `<article><a href="${platform.other}"><time>other</time></a><video id="other" width="200" height="100"></video></article>
    <article><a href="${platform.link}"><time>target</time></a><div>
    <video id="target" width="200" height="100"></video><button id="overlay">play</button></div></article>`;
}

for (const platform of platforms) {
  test(`${platform.site} associates shared media with its inner publication`, async ({page}) => {
    await fixture(page,platform.origin+platform.other,
      `<article><a href="${platform.other}"><time>outer</time></a><div role="link"><a href="${platform.link}"><time>shared</time></a><div><video id="target" width="200" height="100"></video><button id="overlay">play</button></div></div></article>`);
    const toolbar = await scan(page,null,null);
    expect(toolbar.ambiguous).toBe(false);
    expect(toolbar.post.id).toBe(platform.site === 'Instagram' ? 'Target' : '123');
    await page.locator('#overlay').evaluate((node,value) => node.setAttribute('data-snagly-context',value),token);
    const clicked = await scan(page);
    expect(clicked.post.id).toBe(toolbar.post.id);
    await expect(page.locator(`#target[data-snagly-selected="${selectedToken}"]`)).toHaveCount(1);
  });
  test(`${platform.site} reads a player whose React props are on its container`, async ({
    page,
  }) => {
    await fixture(
      page,
      platform.origin + platform.paths[0],
      articles(platform),
    );
    await page.locator("#target").evaluate(
      (node, { site, url, token }) => {
        node.setAttribute("data-snagly-context", token);
        const props =
          site === "X"
            ? { video: { variants: [{ src: url }] } }
            : { media: { video_versions: [{ url, height: 360 }] } };
        node.parentElement.__reactFiber$test = { memoizedProps: props };
      },
      { site: platform.site, url: platform.url, token },
    );
    await scan(page);
    const source =
      platform.site === "X"
        ? `(${mountedXVariants.toString()})(null,location.href,"${selectedToken}")`
        : `(${mountedMetaVariants.toString()})(location.href,null,"${selectedToken}",${JSON.stringify(platform.site)})`;
    const raw = await page.evaluate(source);
    const choices =
      platform.site === "X"
        ? validatedXVariants(raw)
        : validatedInstagramVariants(raw, platform.site);
    expect(choices.some((choice) => choice.url === platform.url)).toBe(true);
  });
  for (const path of platform.paths) {
    test(`${platform.site} selects the clicked player among adjacent media at ${path}`, async ({
      page,
    }) => {
      await fixture(page, platform.origin + path, articles(platform));
      await page
        .locator("#overlay")
        .evaluate(
          (node, value) => node.setAttribute("data-snagly-context", value),
          token,
        );
      // Unrelated protection must not suppress the selected publication.
      await page
        .locator("#other")
        .evaluate((node) =>
          Object.defineProperty(node, "mediaKeys", { value: {} }),
        );
      const result = await scan(page);
      expect(result.ambiguous).toBe(false);
      expect(result.protectedMedia).toBe(false);
      expect(result.post.id).toBe(
        platform.site === "Instagram" ? "Target" : "123",
      );
      await expect(
        page.locator(`#target[data-snagly-selected="${selectedToken}"]`),
      ).toHaveCount(1);
      const direct = await page.locator("#target").evaluate((node, url) => {
        node.src = URL.createObjectURL(new Blob(["player"]));
        node.__reactFiber$test = {
          return: { pendingProps: platformProps(url) },
        };
        function platformProps(url) {
          return {
            video: { variants: [{ src: url }] },
            media: { video_versions: [{ url, height: 360 }] },
            videoData: { browser_native_hd_url: url },
          };
        }
        return true;
      }, platform.url);
      expect(direct).toBe(true);
      const source =
        platform.site === "X"
          ? `(${mountedXVariants.toString()})("123",location.href,"${selectedToken}")`
          : `(${mountedMetaVariants.toString()})(location.href,${JSON.stringify(result.post.id)},"${selectedToken}",${JSON.stringify(platform.site)})`;
      const raw = await page.evaluate(source);
      const choices =
        platform.site === "X"
          ? validatedXVariants(raw)
          : validatedInstagramVariants(raw, platform.site);
      expect(choices.some((choice) => choice.url === platform.url)).toBe(true);
      expect(choices.every((choice) => choice.url === platform.url)).toBe(true);
    });
  }

  test(`${platform.site} asks for selection on an ambiguous feed`, async ({
    page,
  }) => {
    await fixture(
      page,
      platform.origin + platform.paths[0],
      articles(platform),
    );
    const result = await scan(page, null, null);
    expect(result.ambiguous).toBe(true);
    expect(result.urls).toEqual([]);
    expect(result.selectionToken).toBeNull();
  });

  test(`${platform.site} reads a clicked direct-message player without a public permalink`, async ({
    page,
  }) => {
    await fixture(
      page,
      platform.origin + platform.paths[1],
      '<div role="row"><video id="other" width="200" height="100"></video></div><div role="row"><video id="target" width="200" height="100"></video></div>',
    );
    await page
      .locator("#target")
      .evaluate(
        (node, value) => node.setAttribute("data-snagly-context", value),
        token,
      );
    const result = await scan(page);
    expect(result.post).toBeUndefined();
    expect(result.selectionToken).toBe(selectedToken);
    expect(result.ambiguous).toBe(false);
    await page.locator("#target").evaluate((node, url) => {
      node.__reactFiber$test = {
        return: {
          memoizedProps: {
            video: { variants: [{ src: url }] },
            media: { video_versions: [{ url, height: 360 }] },
          },
        },
      };
    }, platform.url);
    const playerSource =
      platform.site === "X"
        ? `(${mountedXVariants.toString()})(null,location.href,"${selectedToken}")`
        : `(${mountedMetaVariants.toString()})(location.href,null,"${selectedToken}",${JSON.stringify(platform.site)})`;
    const raw = await page.evaluate(playerSource);
    const choices =
      platform.site === "X"
        ? validatedXVariants(raw)
        : validatedInstagramVariants(raw, platform.site);
    expect(choices.some((choice) => choice.url === platform.url)).toBe(true);
    await page.locator("#target").evaluate((node) => node.remove());
    const stale = await scan(page);
    expect(stale.missing).toBe(true);
    expect(stale.urls).toEqual([]);
  });

  test(`${platform.site} popup uses the exact context-menu target and groups its resolutions`, async ({
    context,
    page,
  }) => {
    await fixture(
      page,
      platform.origin + platform.paths[0],
      articles(platform),
    );
    await page.locator("#target").evaluate(
      (node, { site, url }) => {
        node.src = URL.createObjectURL(new Blob(["player"]));
        const props =
          site === "X"
            ? {
                video: {
                  variants: [
                    { src: url },
                    { src: url + "?tag=1" },
                    { src: url.replace("640x360", "1280x720") },
                  ],
                },
              }
            : site === "Instagram"
              ? {
                  media: {
                    code: "Target",
                    video_versions: [
                      { url, height: 360 },
                      {
                        url: url.replace("clip.mp4", "large.mp4"),
                        height: 720,
                      },
                    ],
                  },
                }
              : {
                  videoData: {
                    video_id: "123",
                    browser_native_hd_url: url,
                    browser_native_sd_url: url.replace("clip.mp4", "small.mp4"),
                  },
                };
        node.__reactFiber$test = { return: { memoizedProps: props } };
      },
      { site: platform.site, url: platform.url },
    );
    await page.locator("#overlay").dispatchEvent("contextmenu");
    await expect(page.locator("#overlay")).toHaveAttribute(
      "data-snagly-context",
      /^[\da-f-]{36}$/,
    );
    const clickedToken = await page
      .locator("#overlay")
      .getAttribute("data-snagly-context");
    const popup = await openPopup(context, page);
    await popup.goto(popup.url() + "&target=" + clickedToken);
    await expect(popup.locator("#media li")).toHaveCount(1);
    await expect(popup.locator("#media video")).toHaveAttribute(
      "src",
      /video\.twimg\.com|cdninstagram\.com|fbcdn\.net/,
    );
    await expect(popup.locator("#media select").first()).toContainText(
      platform.site === "Facebook" ? "HD" : "360p",
    );
    await expect(
      popup.locator("#media select").first().locator("option"),
    ).toHaveCount(3);
  });
}

test("scopes protection to the selected player and rejects a protected selection", async ({
  page,
}) => {
  const platform = platforms[1];
  await fixture(page, platform.origin + "/", articles(platform));
  await page.locator("#target").evaluate((node, value) => {
    node.setAttribute("data-snagly-context", value);
    Object.defineProperty(node, "mediaKeys", { value: {} });
  }, token);
  const result = await scan(page);
  expect(result.protectedMedia).toBe(true);
  expect(result.urls).toEqual([]);
});

test("a non-media message never falls back to another visible DM player", async ({
  page,
}) => {
  await fixture(
    page,
    "https://www.facebook.com/messages/t/1",
    '<div role="row"><span id="message">text</span></div><div role="row"><video width="200" height="100"></video></div>',
  );
  await page
    .locator("#message")
    .evaluate(
      (node, value) => node.setAttribute("data-snagly-context", value),
      token,
    );
  const result = await scan(page);
  expect(result.playerInfo).toEqual([]);
  expect(result.urls).toEqual([]);
});

test("the only playing visible video wins when opening from the toolbar", async ({
  page,
}) => {
  const platform = platforms[1];
  await fixture(page, platform.origin + "/", articles(platform));
  await page
    .locator("#target")
    .evaluate((node) =>
      Object.defineProperty(node, "paused", { value: false }),
    );
  const result = await scan(page, null, null);
  expect(result.ambiguous).toBe(false);
  expect(result.post.id).toBe("Target");
});

test("does not let player props include adjacent Facebook messages", async ({
  page,
}) => {
  await fixture(
    page,
    "https://www.facebook.com/messages/t/1",
    '<div role="row"><video id="target" width="200" height="100"></video></div><video id="other"></video>',
  );
  await page.locator("#target").evaluate((node, value) => {
    node.setAttribute("data-snagly-context", value);
    const row = node.parentElement;
    node.__reactFiber$test = {
      return: {
        memoizedProps: {
          videoData: { sd_src: "https://video.fbcdn.net/target.mp4" },
        },
        return: {
          stateNode: row,
          memoizedProps: {},
          return: {
            memoizedProps: {
              videoData: { sd_src: "https://video.fbcdn.net/other.mp4" },
            },
          },
        },
      },
    };
  }, token);
  await scan(page);
  const raw = await page.evaluate(
    `(${mountedMetaVariants.toString()})(location.href,null,"${selectedToken}","Facebook")`,
  );
  expect(validatedInstagramVariants(raw, "Facebook")).toEqual([
    { url: "https://video.fbcdn.net/target.mp4", quality: "SD" },
  ]);
});

async function openPopup(context, page) {
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent("serviceworker");
  const id = new URL(worker.url()).host;
  const session = await context.browser().newBrowserCDPSession();
  const { targetInfos } = await session.send("Target.getTargets", {
    filter: [{ type: "tab" }],
  });
  const tab = targetInfos.find((target) => target.url === page.url());
  await session.send("Extensions.triggerAction", {
    id,
    targetId: tab.targetId,
  });
  await session.detach();
  await expect
    .poll(() =>
      context
        .pages()
        .some((candidate) =>
          candidate
            .url()
            .startsWith(`chrome-extension://${id}/popup.html?tab=`),
        ),
    )
    .toBe(true);
  return context
    .pages()
    .find((candidate) =>
      candidate.url().startsWith(`chrome-extension://${id}/popup.html?tab=`),
    );
}

test("Instagram discovers server-rendered media on the first SPA scan without F5", async ({
  context,
  page,
}) => {
  let requests = 0;
  await context.route("**/*", (route) => {
    if (!route.request().url().startsWith("https://")) return route.continue();
    if (route.request().resourceType() === "document")
      return route.fulfill({
        contentType: "text/html",
        body: '<video width="300" height="180"></video>',
      });
    if (route.request().url().includes("/p/Target/")) {
      requests++;
      return route.fulfill({
        contentType: "text/html",
        body:
          '<script type="application/json">' +
          JSON.stringify({
            code: "Target",
            video_versions: [
              {
                height: 720,
                url: "https://scontent.cdninstagram.com/target.mp4",
              },
            ],
          }) +
          "</script>",
      });
    }
    return route.abort();
  });
  await page.goto("https://www.instagram.com/explore/");
  await page.evaluate(() => history.pushState({}, "", "/reel/Target/"));
  const started = Date.now();
  const popup = await openPopup(context, page);
  await expect(popup.locator("#media li")).toHaveCount(1);
  expect(requests).toBe(1);
  await expect(popup.locator("#media select").first()).toContainText("720p");
  expect(Date.now() - started).toBeLessThan(3000);
  expect(
    await page.evaluate(
      () => performance.getEntriesByType("navigation").length,
    ),
  ).toBe(1);
});

test("a delayed Instagram player replacement is discovered without reloading the page", async ({
  context,
  page,
}) => {
  await context.route("**/*", (route) => {
    if (!route.request().url().startsWith("https://")) return route.continue();
    return route.fulfill({
      contentType: "text/html",
      body: route.request().isNavigationRequest()
        ? '<video id="player" width="300" height="180"></video>'
        : "",
    });
  });
  await page.goto("https://www.instagram.com/reel/Target/");
  const popup = await openPopup(context, page);
  await page.evaluate(() => {
    setTimeout(() => {
      const old = document.querySelector("video");
      const player = old.cloneNode();
      old.replaceWith(player);
      player.__reactFiber$test = {
        return: {
          pendingProps: {
            media: {
              video_versions: [
                {
                  url: "https://scontent.cdninstagram.com/target.mp4",
                  height: 720,
                },
              ],
            },
          },
        },
      };
    }, 700);
  });
  await expect(popup.locator("#media li")).toHaveCount(1);
  expect(
    await page.evaluate(
      () => performance.getEntriesByType("navigation").length,
    ),
  ).toBe(1);
});

test("navigation during a metadata request never renders the old media", async ({
  context,
  page,
}) => {
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  let requested = false;
  await context.route("**/*", async (route) => {
    if (!route.request().url().startsWith("https://")) return route.continue();
    if (route.request().isNavigationRequest())
      return route.fulfill({
        contentType: "text/html",
        body: '<video width="300" height="180"></video>',
      });
    if (route.request().url().includes("/p/Target/")) {
      requested = true;
      await pending;
      return route.fulfill({
        contentType: "text/html",
        body:
          '<script type="application/json">' +
          JSON.stringify({
            code: "Target",
            video_url: "https://scontent.cdninstagram.com/old.mp4",
          }) +
          "</script>",
      });
    }
    return route.abort();
  });
  await page.goto("https://www.instagram.com/reel/Target/");
  const popup = await openPopup(context, page);
  await expect.poll(() => requested).toBe(true);
  await page.evaluate(() => history.pushState({}, "", "/reel/Other/"));
  release();
  await expect(popup.locator("#refresh")).toBeEnabled();
  await expect(popup.locator("#status")).toContainText(
    /page changed|publicação mudou/i,
  );
  await expect(popup.locator("#media li")).toHaveCount(0);
});

test("a native MP4 download completes after the extension window closes", async ({
  context,
  page,
}) => {
  const media = await readFile(new URL("./fixtures/clip.mp4", import.meta.url));
  const server = createServer((request, response) => {
    if (request.url === "/clip.mp4") {
      response.writeHead(200, {
        "Content-Type": "video/mp4",
        "Content-Length": media.length,
      });
      response.end(media);
    } else {
      response.writeHead(200, { "Content-Type": "text/html" });
      response.end(
        '<video width="300" height="180" preload="none" src="/clip.mp4"></video>',
      );
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await page.goto("http://127.0.0.1:" + server.address().port);
    const popup = await openPopup(context, page);
    await expect(popup.locator("#media li")).toHaveCount(1);
    const worker = context.serviceWorkers()[0];
    await popup.locator("#media select").first().selectOption("0");
    await expect.poll(() => popup.isClosed()).toBe(true);
    await expect
      .poll(() =>
        worker.evaluate(async () => {
          const items = await chrome.downloads.search({});
          return items[0]?.state;
        }),
      )
      .toBe("complete");
    const saved = await worker.evaluate(
      async () => (await chrome.downloads.search({}))[0],
    );
    expect(saved.url).toContain("/clip.mp4");
    expect(await readFile(saved.filename)).toEqual(media);
    expect(page.isClosed()).toBe(false);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("Instagram metadata groups resolutions while keeping carousel items separate", async ({
  context,
  page,
}) => {
  const media = {
    code: "Target",
    carousel_media: [
      {
        pk: "first",
        video_versions: [
          {
            url: "https://scontent.cdninstagram.com/first-small.mp4",
            height: 360,
          },
          {
            url: "https://scontent.cdninstagram.com/first-large.mp4",
            height: 720,
          },
        ],
      },
      {
        pk: "second",
        video_versions: [
          {
            url: "https://scontent.cdninstagram.com/second-small.mp4",
            height: 480,
          },
          {
            url: "https://scontent.cdninstagram.com/second-large.mp4",
            height: 1080,
          },
        ],
      },
    ],
  };
  await fixture(
    page,
    "https://www.instagram.com/p/Target/",
    '<script type="application/json">' + JSON.stringify(media) + "</script>",
  );
  const popup = await openPopup(context, page);
  await expect(popup.locator("#media li")).toHaveCount(2);
  await expect(
    popup
      .locator("#media li")
      .nth(0)
      .locator("select")
      .first()
      .locator("option"),
  ).toHaveCount(3);
  await expect(
    popup
      .locator("#media li")
      .nth(1)
      .locator("select")
      .first()
      .locator("option"),
  ).toHaveCount(3);
  await expect(
    popup.locator("#media li").nth(0).locator("video"),
  ).toHaveAttribute("src", /first-/);
  await expect(
    popup.locator("#media li").nth(1).locator("video"),
  ).toHaveAttribute("src", /second-/);
});

test("X metadata keeps the clicked attachment when a tweet contains two videos", async ({
  context,
  page,
}) => {
  const clip = "https://video.twimg.com/ext_tw_video/456/vid/640x360/clip.mp4";
  const other =
    "https://video.twimg.com/ext_tw_video/789/vid/640x360/other.mp4";
  const tweet = {
    id_str: "123",
    extended_entities: {
      media: [
        {
          video_info: { variants: [{ content_type: "video/mp4", url: clip }] },
        },
        {
          video_info: { variants: [{ content_type: "video/mp4", url: other }] },
        },
      ],
    },
  };
  const html =
    '<article><a href="/author/status/123"><time>post</time></a><div>' +
    '<video id="target" width="200" height="100" poster="https://pbs.twimg.com/ext_tw_video_thumb/456/img/a.jpg"></video>' +
    '<button id="overlay">play</button></div>' +
    '<video width="200" height="100" poster="https://pbs.twimg.com/ext_tw_video_thumb/789/img/b.jpg"></video></article>' +
    '<script type="application/json">' +
    JSON.stringify(tweet) +
    "</script>";
  await fixture(page, "https://x.com/author/status/123", html);
  await page.locator("#overlay").dispatchEvent("contextmenu");
  const clickedToken = await page
    .locator("#overlay")
    .getAttribute("data-snagly-context");
  expect(clickedToken).toMatch(/^[\da-f-]{36}$/);
  const popup = await openPopup(context, page);
  await popup.goto(popup.url() + "&target=" + clickedToken);
  await expect(popup.locator("#media li")).toHaveCount(1);
  await expect(popup.locator("#media video")).toHaveAttribute("src", clip);
});
