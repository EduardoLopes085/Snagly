// Serialized by executeScript. All DOM selection helpers must remain local.
export function resolveMediaTarget(
  preferredUrl: string | null,
  contextToken: string | null,
  selectionToken: string,
) {
  const pageUrl = location.href;
  const host = location.hostname.replace(/^(?:www|mobile|m)\./, "");
  const site: "X" | "Instagram" | "Facebook" | undefined =
    host === "x.com" || host === "twitter.com"
      ? "X"
      : host === "instagram.com"
        ? "Instagram"
        : host === "facebook.com"
          ? "Facebook"
          : undefined;
  const postFrom = (href: string) => {
    let url: URL;
    try {
      url = new URL(href, pageUrl);
    } catch {
      return;
    }
    const linkedHost = url.hostname.replace(/^(?:www|mobile|m)\./, "");
    const samePlatform =
      site === "X"
        ? linkedHost === "x.com" || linkedHost === "twitter.com"
        : linkedHost === host;
    if (
      url.protocol !== "https:" ||
      !samePlatform ||
      url.username ||
      url.password ||
      url.port
    )
      return;
    const id =
      site === "X"
        ? /^\/(?:\w+|i\/web)\/status\/(\d+)(?:\/|$)/.exec(url.pathname)?.[1]
        : site === "Instagram"
          ? /^\/(?:[\w.]+\/)?(?:p|reels?|tv)\/([\w-]+)(?:\/|$)/.exec(
              url.pathname,
            )?.[1]
          : (/^\/(?:reel|(?:[^/]+\/)?videos(?:\/[^/]+)?)\/(\d+)(?:\/|$)/.exec(
              url.pathname,
            )?.[1] ??
            (/^\/(?:watch\/?|video\.php)$/.test(url.pathname)
              ? (url.searchParams.get("v") ?? undefined)
              : undefined));
    if (id) return { id, href: url.href };
  };
  const visible = (element: Element) => {
    const box = element.getBoundingClientRect();
    return (
      box.width > 0 &&
      box.height > 0 &&
      box.top < innerHeight &&
      box.bottom > 0 &&
      box.left < innerWidth &&
      box.right > 0
    );
  };
  const mediaIn = (element: Element) =>
    element.matches("video,audio")
      ? [element as HTMLMediaElement]
      : [...element.querySelectorAll<HTMLMediaElement>("video,audio")];
  const findOwner = (element: Element) => {
    const scope = element.closest('article,[role="article"]');
    if (!scope) return;
    // A shared post can own a permalink inside the outer publication.
    let local: Element | null = element;
    for (let level = 0; local && local !== scope && level < 8; level++, local = local.parentElement) {
      const links = local.matches('a[href]') ? [local as HTMLAnchorElement]
        : [...local.querySelectorAll<HTMLAnchorElement>('a[href]')].slice(0, 100);
      const posts = new Map<string, { id: string; href: string }>();
      for (const link of links) {
        const post = postFrom(link.href);
        if (post) posts.set(post.id, post);
      }
      if (posts.size === 1) return [...posts.values()][0];
      if (posts.size > 1) break;
    }
    const timestamp = scope.querySelector("time")?.closest("a");
    const primary = timestamp && postFrom(timestamp.href);
    if (primary) return primary;
    if (site === "X") return;
    const posts = new Map<string, { id: string; href: string }>();
    for (const link of [
      ...scope.querySelectorAll<HTMLAnchorElement>("a[href]"),
    ].slice(0, 100)) {
      const post = postFrom(link.href);
      if (post) posts.set(post.id, post);
    }
    return posts.size === 1 ? [...posts.values()][0] : undefined;
  };
  // Reuse ownership decisions within this scan, without retaining feed DOM nodes.
  const ownersByElement = new WeakMap<Element, ReturnType<typeof findOwner>>();
  const owner = (element: Element) => {
    if (!ownersByElement.has(element)) ownersByElement.set(element, findOwner(element));
    return ownersByElement.get(element);
  };
  let post = preferredUrl ? postFrom(preferredUrl) : undefined;
  const marked =
    contextToken && /^[\da-f-]{36}$/.test(contextToken)
      ? document.querySelector('[data-snagly-context="' + contextToken + '"]')
      : null;
  const all = [
    ...document.querySelectorAll<HTMLMediaElement>("video,audio"),
  ].slice(0, 200);
  let selected: HTMLMediaElement[] = [];
  let scope: Element | null = null;
  let ambiguous = false;
  if (marked) {
    scope = marked;
    // Stop at the first player container, before reaching adjacent messages/posts.
    for (let level = 0; level < 7 && scope; level++) {
      const items = mediaIn(scope);
      if (items.length) {
        const showing = items.filter(visible);
        selected = items.length === 1 ? items : showing;
        ambiguous = selected.length !== 1;
        break;
      }
      if (
        scope.matches('article,[role="article"],[role="dialog"],[role="row"]')
      )
        break;
      scope = scope.parentElement;
    }
    const link = marked.closest<HTMLAnchorElement>("a[href]");
    post = (link && postFrom(link.href)) || owner(marked) || post;
  }
  if (!selected.length && !ambiguous) {
    post ??= postFrom(pageUrl);
    const owners = new Map(all.map((media) => [media, owner(media)]));
    const belongs = (media: HTMLMediaElement) => owners.get(media)?.id === post?.id ||
      owner(media.closest('article,[role="article"]') ?? media)?.id === post?.id;
    const owned = post
      ? all.filter(belongs)
      : [];
    const eligible = post
      ? all.filter(
          (media) => !owners.get(media) || belongs(media),
        )
      : all;
    const dialog = eligible.filter(
      (media) => media.closest('[role="dialog"]') && visible(media),
    );
    const onPage = eligible.filter(visible);
    let candidates = owned.length
      ? owned.filter(visible)
      : dialog.length
        ? dialog
        : onPage;
    // A target lost during a rerender must not silently become another DM.
    if (contextToken && !marked && !post) candidates = [];
    if (marked && !selected.length && !post) candidates = [];
    if (post && !owned.length && postFrom(pageUrl)?.id !== post.id)
      candidates = [];
    const playing = candidates.filter((media) => !media.paused && !media.ended);
    if (playing.length === 1) candidates = playing;
    if (candidates.length === 1) {
      selected = candidates;
      scope = selected[0]!;
      post = owner(scope) ?? post;
    } else if (candidates.length > 1) {
      ambiguous = true;
    }
  }
  if (!site) {
    selected = all;
    ambiguous = false;
  }
  // Keep only the selected player marked across isolated and MAIN worlds.
  if (/^[\da-f-]{36}$/.test(selectionToken)) {
    for (const old of document.querySelectorAll(
      '[data-snagly-selected="' + selectionToken + '"]',
    )) {
      old.removeAttribute("data-snagly-selected");
    }
  }
  const anchor = selected.length === 1 ? selected[0]! : marked;
  if (anchor && !ambiguous && /^[\da-f-]{36}$/.test(selectionToken)) {
    anchor.setAttribute("data-snagly-selected", selectionToken);
  }
  const protectedMedia = selected.some((media) => media.mediaKeys);
  const urls =
    (site && protectedMedia) || ambiguous
      ? []
      : selected.flatMap((media) => {
          if (media.mediaKeys) return [];
          const source = media.currentSrc || media.src;
          return source && source.length <= 16384 && /^https?:/.test(source)
            ? [source]
            : [];
        });
  const streaming = selected.some((media) =>
    /^(?:blob:)|\.(?:m3u8|mpd)(?:[?#]|$)/i.test(media.currentSrc || media.src),
  );
  const posters = selected
    .filter((media): media is HTMLVideoElement => media.tagName === "VIDEO")
    .map((video) => video.poster)
    .filter((url) => /^https:/.test(url));
  return {
    pageUrl,
    site,
    post,
    urls,
    posters,
    protectedMedia,
    streaming,
    ambiguous,
    missing: !anchor,
    selectionToken: anchor && !ambiguous ? selectionToken : null,
    playerInfo: selected.map((media) => ({
      source: (media.currentSrc || media.src).startsWith("blob:")
        ? "blob"
        : media.currentSrc || media.src
          ? "url"
          : "empty",
      readyState: media.readyState,
      react: Object.keys(media).some(
        (key) =>
          key.startsWith("__reactFiber$") || key.startsWith("__reactProps$"),
      ),
    })),
  };
}
