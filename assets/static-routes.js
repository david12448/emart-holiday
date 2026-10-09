/* Public navigation only. No collector endpoints or bulk source mappings. */
(() => {
  const config = window.MART_CONFIG || {};
  const params = new URLSearchParams(location.search);
  const sid = params.get("storeId");
  const canonical = document.querySelector('link[rel="canonical"]') ||
    document.head.appendChild(Object.assign(document.createElement("link"), {rel: "canonical"}));
  if (!canonical.href && config.routeCanonicalBase) {
    canonical.href = new URL(config.routeCanonicalBase, location.origin).href;
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
