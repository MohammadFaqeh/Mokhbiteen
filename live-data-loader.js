(function () {
  "use strict";

  async function loadLiveData() {
    try {
      const config = window.MOKHBITEEN_SUPABASE;
      if (!config) throw new Error("Missing Supabase configuration");
      const response = await fetch(`${config.url}/rest/v1/live_board?select=data&id=eq.main`, {
        headers: { apikey: config.publishableKey },
        cache: "no-store"
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const rows = await response.json();
      if (rows.length && rows[0].data) window.MOKHBITEEN_DATA = rows[0].data;
    } catch (error) {
      console.warn("تعذر تحميل البيانات المباشرة؛ استُخدمت النسخة الاحتياطية المحلية:", error);
    }
    const script = document.createElement("script");
    script.src = "script.js?v=20260807-12";
    document.body.appendChild(script);
  }

  loadLiveData();
})();
