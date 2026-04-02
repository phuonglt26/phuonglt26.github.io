const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");
const themeToggle = document.querySelector(".theme-toggle");
const topbar = document.querySelector(".topbar");
const boardLayout = document.querySelector(".board-layout");
const contentColumn = document.querySelector(".content-column");
const navLinks = document.querySelectorAll(".site-nav a[data-page]");
const newsFilterGroups = document.querySelectorAll("[data-news-filter-group]");
const contactForms = document.querySelectorAll("[data-contact-form]");
const scrollFadeLists = document.querySelectorAll("[data-scroll-fade-list]");
const activePage = document.body.dataset.page;
const emailjsConfig =
  typeof window !== "undefined" ? window.EMAILJS_CONFIG || null : null;

const rootElement = document.documentElement;

const applyTheme = (theme) => {
  const nextTheme = theme === "light" ? "light" : "dark";
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

  if (activePage === "home" && contentColumn) {
    return contentColumn;
  }

  return boardLayout;
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

if (navLinks.length && activePage) {
  navLinks.forEach((link) => {
    const isActive = link.dataset.page === activePage;
    if (isActive) {
      link.setAttribute("aria-current", "true");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

if (themeToggle) {
  applyTheme(rootElement.dataset.theme || "dark");

  themeToggle.addEventListener("click", () => {
    const nextTheme =
      (rootElement.dataset.theme || "dark") === "light" ? "dark" : "light";
    applyTheme(nextTheme);
  });
}

if (navToggle && siteNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = document.body.dataset.navOpen === "true";
    document.body.dataset.navOpen = String(!isOpen);
    navToggle.setAttribute("aria-expanded", String(!isOpen));
  });

  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      document.body.dataset.navOpen = "false";
      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}

if (newsFilterGroups.length) {
  newsFilterGroups.forEach((group) => {
    const buttons = group.querySelectorAll("[data-news-filter]");
    const items = group.querySelectorAll("[data-news-item-tag]");
    const scrollList = group.querySelector(".home-panel-list--scroll");

    const applyNewsFilter = (filter) => {
      buttons.forEach((button) => {
        const isActive = button.dataset.newsFilter === filter;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
      });

      items.forEach((item) => {
        const shouldShow =
          filter === "all" || item.dataset.newsItemTag === filter;
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

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        applyNewsFilter(button.dataset.newsFilter || "all");
      });
    });

    applyNewsFilter("all");
  });
}

if (scrollFadeLists.length) {
  scrollFadeLists.forEach((list) => {
    const sync = () => syncScrollFade(list);

    list.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    window.addEventListener("load", sync);
    sync();
  });
}

if (contactForms.length) {
  const hasEmailJsConfig = Boolean(
    window.emailjs &&
    emailjsConfig &&
    emailjsConfig.publicKey &&
    emailjsConfig.serviceId &&
    emailjsConfig.templateId
  );

  if (hasEmailJsConfig) {
    window.emailjs.init({
      publicKey: emailjsConfig.publicKey,
    });
  }

  contactForms.forEach((form) => {
    const status = form.querySelector("[data-contact-form-status]");
    const recipient = form.dataset.contactEmail || "";

    form.addEventListener("submit", (event) => {
      event.preventDefault();

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

      if (hasEmailJsConfig) {
        if (status) {
          status.textContent = "Sending your message...";
        }

        window.emailjs
          .sendForm(emailjsConfig.serviceId, emailjsConfig.templateId, form)
          .then(() => {
            form.reset();
            if (status) {
              status.textContent = "Your message has been sent successfully.";
            }
          })
          .catch(() => {
            if (status) {
              status.textContent =
                "Direct sending is unavailable right now. Opening your email app instead.";
            }

            window.location.href = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodySections.join("\n"))}`;
          });

        return;
      }

      if (status) {
        status.textContent = "Opening your email app...";
      }

      window.location.href = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodySections.join("\n"))}`;
    });
  });
}

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

  window.addEventListener(
    "scroll",
    queueTopbarSync,
    { passive: true }
  );

  if (boardLayout) {
    boardLayout.addEventListener("scroll", queueTopbarSync, { passive: true });
  }

  if (contentColumn) {
    contentColumn.addEventListener("scroll", queueTopbarSync, { passive: true });
  }

  window.addEventListener("resize", queueTopbarSync);
}

syncFrozenScroll();
window.addEventListener("resize", syncFrozenScroll);
window.addEventListener("load", syncFrozenScroll);
