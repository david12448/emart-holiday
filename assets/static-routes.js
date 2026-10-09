/* Public navigation only. No collector endpoints or bulk source mappings. */
(() => {
  const config = window.MART_CONFIG || {};
  const params = new URLSearchParams(location.search);
  const sid = params.has("storeId") ? params.get("storeId") : config.routeDefaults?.storeId;
  const canonical = document.querySelector('link[rel="canonical"]') ||
    document.head.appendChild(Object.assign(document.createElement("link"), {rel: "canonical"}));
  if (!canonical.href && config.routeCanonicalBase) {
    const path = params.get("region") === "all" || params.get("region") === "전체" ?
      config.routeCanonicalBase : config.routeCanonicalDefault || config.routeCanonicalBase;
    canonical.href = new URL(path, location.origin).href;
  }
  const region = params.get("region");
  if (!sid && region && !["all","전체"].includes(region) && config.publicRouteBase) {
    fetch(config.publicRouteBase + "region-" + encodeURIComponent(region) + ".json")
      .then(r => {if (!r.ok) throw new Error("route unavailable"); return r.json();})
      .then(route => {
        const url = new URL(route.path, location.origin);
        if (url.origin === location.origin && !url.search && !url.hash) canonical.href = url.href;
      }).catch(() => {
        const url = new URL(location.href); url.search = "";
        url.searchParams.set("region",region); canonical.href = url.href;
      });
  }
  if (/^[a-f0-9]{16}$/.test(sid || "") && config.publicRouteBase) {
    fetch(config.publicRouteBase + sid + ".json").then(r => {
      if (!r.ok) throw new Error("route unavailable");
      return r.json();
    }).then(route => {
      const url = new URL(route.path, location.origin);
      const base = new URL(config.publicRouteBase, location.origin).pathname.split("/data/")[0];
      if (url.origin !== location.origin || !url.pathname.startsWith(base + "/") ||
          url.search || url.hash || !url.pathname.endsWith("/")) return;
      canonical.href = url.href;
    }).catch(() => {
      // Unregistered legacy stores remain independently addressable.
      const url = new URL(location.href);
      url.search = "";
      url.searchParams.set("storeId", sid);
      canonical.href = url.href;
    });
  }
  const tabs = document.getElementById("embed-month-tabs");
  // Resolve only the clicked public store, keeping bulk mappings off the client.
  document.addEventListener("click", event => {
    const anchor = event.target.closest("a[href]");
    if (!anchor || event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
        anchor.target === "_blank" || !config.publicRouteBase) return;
    const target = new URL(anchor.href, location.href);
    const id = target.searchParams.get("storeId");
    if (target.origin !== location.origin || !/^[a-f0-9]{16}$/.test(id || "")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    fetch(config.publicRouteBase + id + ".json").then(r => {
      if (!r.ok) throw new Error("unregistered");
      return r.json();
    }).then(route => {
      const destination = new URL(route.path, location.origin);
      if (destination.origin !== location.origin) throw new Error("invalid route");
      const query = new URLSearchParams(target.search);
      query.delete("storeId");
      destination.search = query.toString();
      destination.hash = target.hash;
      location.assign(destination.href);
    }).catch(() => location.assign(target.href));
  }, true);
  if (!tabs) return;
  const now = new Date(new Date().toLocaleString("en-US", {timeZone:"Asia/Seoul"}));
  for (let offset = 0; offset < 2; offset++) {
    const month = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const key = month.getFullYear() + "-" + String(month.getMonth() + 1).padStart(2,"0");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = offset ? "다음 달" : "이번 달";
    button.dataset.month = key;
    button.addEventListener("click", () => {
      if (!document.querySelector(".month-calendar")) return;
      selectedYear = month.getFullYear();
      selectedMonth = month.getMonth() + 1;
      selectedCalendarDate = null;
      updateDateInUrl();
      renderCurrentView();
      const rows = requestedStoreId ? holidayData.filter(s => getStoreId(s) === requestedStoreId) :
        selectedRegion === "all" ? holidayData : holidayData.filter(s => getStoreRegion(s) === selectedRegion);
      document.getElementById("embed-unknown").hidden = rows.some(s =>
        (s.holidays || []).some(d => d.startsWith(key + "-")));
      for (const tab of tabs.children) tab.setAttribute("aria-pressed", String(tab === button));
    });
    tabs.appendChild(button);
  }
})();
