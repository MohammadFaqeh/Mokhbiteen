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
      if (rows.length && rows[0].data) {
        const liveData = rows[0].data;
        (liveData.days || []).forEach((day) => {
          ["achievement", "nextRequired"].forEach((field) => {
            const value = String(day[field] || "").trim();
            if (!value || value.startsWith("يُضاف")) day[field] = "----";
          });
        });
        window.MOKHBITEEN_DATA = liveData;
      }
    } catch (error) {
      console.warn("تعذر تحميل البيانات المباشرة؛ استُخدمت النسخة الاحتياطية المحلية:", error);
    }
    const script = document.createElement("script");
    script.src = "script.js?v=20260808-13";
    document.body.appendChild(script);
  }

  loadLiveData();
})();
