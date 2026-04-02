const rootElement = document.documentElement;
const pageCache = new Map();
const parser = new DOMParser();

let emailJsInitialized = false;
let currentPageUrl = "";
let navigationToken = 0;
let pageCleanupCallbacks = [];

const normalizeUrl = (input) => {
  const url = new URL(input, window.location.href);
  url.hash = "";
  return url.href;
};

const getCurrentPage = () => document.body.dataset.page || "";
const getNavToggle = () => document.querySelector(".nav-toggle");
const getSiteNav = () => document.querySelector(".site-nav");
const getThemeToggle = () => document.querySelector(".theme-toggle");
const getTopbar = () => document.querySelector(".topbar");
const getBoardLayout = () => document.querySelector(".board-layout");
const getContentColumn = () => document.querySelector(".content-column");
const getReferenceBoard = () => document.querySelector(".reference-board");

const updateNavOpenState = (isOpen) => {
  document.body.dataset.navOpen = String(Boolean(isOpen));

  const navToggle = getNavToggle();

  if (navToggle) {
    navToggle.setAttribute("aria-expanded", String(Boolean(isOpen)));
  }
};

const applyTheme = (theme) => {
  const nextTheme = theme === "light" ? "light" : "dark";
  const themeToggle = getThemeToggle();

  rootElement.dataset.theme = nextTheme;

  try {
    window.localStorage.setItem("site-theme", nextTheme);
  } catch (error) {
    // Ignore storage errors and keep the theme for this session.
  }

  if (!themeToggle) {
    return;
  }

  const isLight = nextTheme === "light";
  const label = themeToggle.querySelector(".theme-toggle-label");

  themeToggle.setAttribute("aria-pressed", String(isLight));
  themeToggle.setAttribute(
    "aria-label",
    isLight ? "Switch to dark theme" : "Switch to light theme"
  );

  if (label) {
    label.textContent = isLight ? "Light" : "Dark";
  }
};

const getPrimaryScrollContainer = () => {
  if (window.innerWidth <= 760) {
    return null;
  }

  if (getCurrentPage() === "home") {
    return getContentColumn();
  }

  return getBoardLayout();
};

const resetPageScroll = () => {
  window.scrollTo(0, 0);

  const boardLayout = getBoardLayout();
  const contentColumn = getContentColumn();

  if (boardLayout) {
    boardLayout.scrollTop = 0;
  }

  if (contentColumn) {
    contentColumn.scrollTop = 0;
  }
};

const syncFrozenScroll = () => {
  const scrollContainer = getPrimaryScrollContainer();
  const shouldFreeze = Boolean(
    scrollContainer && scrollContainer.scrollHeight <= scrollContainer.clientHeight + 2
  );

  document.body.classList.toggle("is-frozen-scroll", shouldFreeze);

  if (shouldFreeze && scrollContainer) {
    scrollContainer.scrollTop = 0;
  }
};

const syncScrollFade = (list) => {
  const wrap = list.closest("[data-scroll-fade-wrap]");

  if (!wrap) {
    return;
  }

  const maxScrollTop = list.scrollHeight - list.clientHeight;
  const hasOverflow = maxScrollTop > 2;
  const hasBottomFade = hasOverflow && list.scrollTop < maxScrollTop - 2;

  wrap.classList.toggle("has-bottom-fade", hasBottomFade);
};

const syncAllScrollFades = () => {
  document.querySelectorAll("[data-scroll-fade-list]").forEach((list) => {
    syncScrollFade(list);
  });
};

const syncActiveNav = () => {
  const activePage = getCurrentPage();

  document.querySelectorAll(".site-nav a[data-page]").forEach((link) => {
    const isActive = link.dataset.page === activePage;

    if (isActive) {
      link.setAttribute("aria-current", "true");
    } else {
      link.removeAttribute("aria-current");
    }
  });
};

const applyNewsFilter = (group, filter) => {
  const buttons = group.querySelectorAll("[data-news-filter]");
  const items = group.querySelectorAll("[data-news-item-tag]");
  const scrollList = group.querySelector(".home-panel-list--scroll");

  buttons.forEach((button) => {
    const isActive = button.dataset.newsFilter === filter;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  items.forEach((item) => {
    const shouldShow = filter === "all" || item.dataset.newsItemTag === filter;
    item.hidden = !shouldShow;
    item.classList.remove("is-first-visible", "is-last-visible");
  });

  const visibleItems = Array.from(items).filter((item) => !item.hidden);

  if (visibleItems.length) {
    visibleItems[0].classList.add("is-first-visible");
    visibleItems[visibleItems.length - 1].classList.add("is-last-visible");
  }

  if (scrollList) {
    scrollList.scrollTop = 0;
    syncScrollFade(scrollList);
  }

  window.requestAnimationFrame(syncFrozenScroll);
};

const initNewsFilters = () => {
  document.querySelectorAll("[data-news-filter-group]").forEach((group) => {
    applyNewsFilter(group, "all");
  });
};

const initEmailJsIfNeeded = () => {
  const emailjsConfig =
    typeof window !== "undefined" ? window.EMAILJS_CONFIG || null : null;
  const hasEmailJsConfig = Boolean(
    window.emailjs &&
    emailjsConfig &&
    emailjsConfig.publicKey &&
    emailjsConfig.serviceId &&
    emailjsConfig.templateId
  );

  if (!hasEmailJsConfig) {
    return null;
  }

  if (!emailJsInitialized) {
    window.emailjs.init({
      publicKey: emailjsConfig.publicKey,
    });

    emailJsInitialized = true;
  }

  return emailjsConfig;
};

const handleContactFormSubmit = async (form) => {
  const status = form.querySelector("[data-contact-form-status]");
  const recipient = form.dataset.contactEmail || "";
  const formData = new FormData(form);
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const subjectInput = String(formData.get("subject") || "").trim();
  const message = String(formData.get("message") || "").trim();

  if (!message) {
    if (status) {
      status.textContent = "Please enter a message before sending.";
    }
    return;
  }

  const subject = subjectInput || `Website message from ${name || "a visitor"}`;
  const bodySections = [
    name ? `Name: ${name}` : "",
    email ? `Email: ${email}` : "",
    "",
    "Message:",
    message,
  ].filter(Boolean);

  const emailjsConfig = initEmailJsIfNeeded();

  if (emailjsConfig) {
    if (status) {
      status.textContent = "Sending your message...";
    }

    try {
      await window.emailjs.sendForm(
        emailjsConfig.serviceId,
        emailjsConfig.templateId,
        form
      );

      form.reset();

      if (status) {
        status.textContent = "Your message has been sent successfully.";
      }

      return;
    } catch (error) {
      if (status) {
        status.textContent =
          "Direct sending is unavailable right now. Opening your email app instead.";
      }
    }
  } else if (status) {
    status.textContent = "Opening your email app...";
  }

  window.location.href = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodySections.join("\n"))}`;
};

const cleanupPageBindings = () => {
  pageCleanupCallbacks.forEach((cleanup) => cleanup());
  pageCleanupCallbacks = [];
};

const bindPageScrollHandlers = () => {
  cleanupPageBindings();

  const topbar = getTopbar();
  const boardLayout = getBoardLayout();
  const contentColumn = getContentColumn();
  const scrollFadeLists = document.querySelectorAll("[data-scroll-fade-list]");

  if (topbar) {
    let ticking = false;

    const getScrollOffset = () => {
      const scrollContainer = getPrimaryScrollContainer();

      if (!scrollContainer) {
        return window.scrollY;
      }

      return scrollContainer.scrollTop;
    };

    const syncTopbar = () => {
      topbar.classList.toggle("is-stuck", getScrollOffset() > 20);
      ticking = false;
    };

    const queueTopbarSync = () => {
      if (ticking) {
        return;
      }

      ticking = true;
      window.requestAnimationFrame(syncTopbar);
    };

    syncTopbar();

    window.addEventListener("scroll", queueTopbarSync, { passive: true });
    pageCleanupCallbacks.push(() => {
      window.removeEventListener("scroll", queueTopbarSync);
    });

    window.addEventListener("resize", queueTopbarSync);
    pageCleanupCallbacks.push(() => {
      window.removeEventListener("resize", queueTopbarSync);
    });

    if (boardLayout) {
      boardLayout.addEventListener("scroll", queueTopbarSync, { passive: true });
      pageCleanupCallbacks.push(() => {
        boardLayout.removeEventListener("scroll", queueTopbarSync);
      });
    }

    if (contentColumn) {
      contentColumn.addEventListener("scroll", queueTopbarSync, { passive: true });
      pageCleanupCallbacks.push(() => {
        contentColumn.removeEventListener("scroll", queueTopbarSync);
      });
    }
  }

  scrollFadeLists.forEach((list) => {
    const sync = () => syncScrollFade(list);
    list.addEventListener("scroll", sync, { passive: true });
    pageCleanupCallbacks.push(() => {
      list.removeEventListener("scroll", sync);
    });
    sync();
  });
};

const initPageBehaviors = ({ resetScroll = false } = {}) => {
  if (resetScroll) {
    resetPageScroll();
  }

  updateNavOpenState(false);
  syncActiveNav();
  applyTheme(rootElement.dataset.theme || "dark");
  initNewsFilters();
  bindPageScrollHandlers();
  syncAllScrollFades();
  syncFrozenScroll();
};

const parseHtml = (html) => parser.parseFromString(html, "text/html");

const fetchPageDocument = async (url) => {
  const cacheKey = normalizeUrl(url);

  if (pageCache.has(cacheKey)) {
    return parseHtml(pageCache.get(cacheKey));
  }

  const response = await fetch(cacheKey, {
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error(`Failed to load page: ${response.status}`);
  }

  const html = await response.text();
  pageCache.set(cacheKey, html);

  return parseHtml(html);
};

const isScriptLoaded = (src) =>
  Array.from(document.querySelectorAll("script[src]")).some(
    (script) => new URL(script.src, window.location.href).href === src
  );

const loadExternalScript = (src) =>
  new Promise((resolve, reject) => {
    if (isScriptLoaded(src)) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Unable to load script: ${src}`));
    document.head.appendChild(script);
  });

const ensurePageScripts = async (nextDocument, baseUrl) => {
  const mainScriptUrl = new URL("script.js", window.location.href).href;
  const pageScripts = Array.from(nextDocument.querySelectorAll("head script[src]"));

  for (const script of pageScripts) {
    const src = script.getAttribute("src");

    if (!src) {
      continue;
    }

    const absoluteSrc = new URL(src, baseUrl).href;

    if (absoluteSrc === mainScriptUrl) {
      continue;
    }

    await loadExternalScript(absoluteSrc);
  }
};

const syncHeadMetadata = (nextDocument) => {
  if (nextDocument.title) {
    document.title = nextDocument.title;
  }

  const nextDescription = nextDocument.querySelector('meta[name="description"]');
  const currentDescription = document.querySelector('meta[name="description"]');

  if (nextDescription && currentDescription) {
    currentDescription.setAttribute(
      "content",
      nextDescription.getAttribute("content") || ""
    );
  }

  if (nextDocument.documentElement.lang) {
    document.documentElement.lang = nextDocument.documentElement.lang;
  }
};

const swapPageContent = (nextDocument) => {
  const nextBoard = nextDocument.querySelector(".reference-board");
  const currentBoard = getReferenceBoard();

  if (!nextBoard || !currentBoard) {
    throw new Error("Missing board content.");
  }

  currentBoard.innerHTML = nextBoard.innerHTML;
  document.body.dataset.page = nextDocument.body.dataset.page || "";
  document.body.dataset.navOpen = "false";
  document.body.classList.remove("is-frozen-scroll");
};

const shouldHandleInternalPageLink = (link) => {
  const href = link.getAttribute("href");

  if (!href) {
    return false;
  }

  if (
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("javascript:")
  ) {
    return false;
  }

  if (link.hasAttribute("download")) {
    return false;
  }

  if (link.target && link.target.toLowerCase() !== "_self") {
    return false;
  }

  const url = new URL(href, window.location.href);

  if (url.origin !== window.location.origin) {
    return false;
  }

  return /\.html$/i.test(url.pathname);
};

const navigateTo = async (href, { historyMode = "push" } = {}) => {
  const targetUrl = new URL(href, window.location.href);
  const targetKey = normalizeUrl(targetUrl.href);

  if (targetKey === currentPageUrl) {
    updateNavOpenState(false);
    return;
  }

  const requestId = ++navigationToken;

  try {
    const nextDocument = await fetchPageDocument(targetUrl.href);

    if (requestId !== navigationToken) {
      return;
    }

    await ensurePageScripts(nextDocument, targetUrl.href);

    if (requestId !== navigationToken) {
      return;
    }

    syncHeadMetadata(nextDocument);
    swapPageContent(nextDocument);

    currentPageUrl = targetKey;

    if (historyMode === "push") {
      window.history.pushState(
        { url: currentPageUrl },
        "",
        `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`
      );
    } else if (historyMode === "replace") {
      window.history.replaceState(
        { url: currentPageUrl },
        "",
        `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`
      );
    }

    initPageBehaviors({ resetScroll: true });
  } catch (error) {
    window.location.href = targetUrl.href;
  }
};

document.addEventListener("click", (event) => {
  const target = event.target;

  if (!(target instanceof Element)) {
    return;
  }

  const themeToggle = target.closest(".theme-toggle");

  if (themeToggle) {
    event.preventDefault();
    const nextTheme =
      (rootElement.dataset.theme || "dark") === "light" ? "dark" : "light";
    applyTheme(nextTheme);
    return;
  }

  const navToggle = target.closest(".nav-toggle");

  if (navToggle) {
    event.preventDefault();
    const isOpen = document.body.dataset.navOpen === "true";
    updateNavOpenState(!isOpen);
    return;
  }

  const filterButton = target.closest("[data-news-filter]");

  if (filterButton) {
    const group = filterButton.closest("[data-news-filter-group]");

    if (group) {
      applyNewsFilter(group, filterButton.dataset.newsFilter || "all");
    }

    return;
  }

  const link = target.closest("a[href]");

  if (!link) {
    return;
  }

  if (link.closest(".site-nav")) {
    updateNavOpenState(false);
  }

  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }

  if (!shouldHandleInternalPageLink(link)) {
    return;
  }

  event.preventDefault();
  void navigateTo(link.href, { historyMode: "push" });
});

document.addEventListener("submit", (event) => {
  const target = event.target;

  if (!(target instanceof HTMLFormElement)) {
    return;
  }

  if (!target.matches("[data-contact-form]")) {
    return;
  }

  event.preventDefault();
  void handleContactFormSubmit(target);
});

window.addEventListener("popstate", () => {
  void navigateTo(window.location.href, { historyMode: "none" });
});

window.addEventListener("resize", () => {
  syncFrozenScroll();
  syncAllScrollFades();
});

window.addEventListener("load", () => {
  syncFrozenScroll();
  syncAllScrollFades();
});

currentPageUrl = normalizeUrl(window.location.href);
pageCache.set(currentPageUrl, document.documentElement.outerHTML);
window.history.replaceState({ url: currentPageUrl }, "", window.location.href);

initPageBehaviors();
