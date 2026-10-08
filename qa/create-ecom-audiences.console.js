/**
 * Создание e-com аудиторий Calltouch из консоли браузера.
 *
 * Как запускать:
 * 1. Откройте Calltouch под своей сессией.
 * 2. Один раз создайте любую аудиторию вручную → DevTools → Network → скопируйте
 *    Request URL создания и кусок interactionPeriod из тела запроса.
 * 3. Вставьте ниже CREATE_URL и INTERACTION_PERIOD.
 * 4. Убедитесь, что локальный QA API запущен (http://localhost:3000).
 * 5. В консоли: сначала вставьте содержимое qa/ecom-conditions.js, затем этот файл.
 * 6. Вызовите: await window.qaCreateEcomAudiences({ dryRun: true })
 *    потом без dryRun.
 *
 * Секреты/логины агенту не передавать — используется cookie вашей сессии.
 */
(async function () {
  const CONFIG = {
    siteId: 50949,
    /** Обязательно: URL из Network (создание аудитории). Пример-заглушка: */
    createUrl: "PASTE_CREATE_URL_FROM_NETWORK",
    /** Дата посева в имени: dd_mm_yyyy */
    seedDate: (function () {
      const d = new Date();
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      return dd + "_" + mm + "_" + d.getFullYear();
    })(),
    lacmusPositive: 100,
    lacmusControl: 10,
    qaApiBase: "http://localhost:3000",
    delayMs: 400,
    /**
     * Обязательно снять из UI-запроса (не fullDepth).
     * Пример после съёма:
     * { date: "2026-10-08", days: null, periodType: "exactDate" }
     */
    interactionPeriod: null
  };

  function sleep(ms) {
    return new Promise(function (r) {
      setTimeout(r, ms);
    });
  }

  function expectedClients(cond, role) {
    const key = role === "primary" ? cond.expected_positive : cond.expected_negative;
    if (key === "lacmus_positive") return CONFIG.lacmusPositive;
    if (key === "lacmus_control") return CONFIG.lacmusControl;
    if (key === "zero") return 0;
    return null;
  }

  function buildElement(cond, role) {
    const el = { type: cond.api_type };
    if (cond.api_shape === "value_int") {
      el.value = Number(role === "primary" ? cond.seed_positive : cond.seed_control);
      return el;
    }
    if (cond.api_shape === "from_to") {
      el.from = Number(role === "primary" ? cond.audience_from : cond.negative_from);
      el.to = Number(role === "primary" ? cond.audience_to : cond.negative_to);
      return el;
    }
    throw new Error("unsupported api_shape: " + cond.api_shape + " for " + cond.key);
  }

  function buildBody(cond, role) {
    const name = "qa-" + CONFIG.seedDate + "-" + cond.key + "-" + role;
    return {
      name: name,
      dataSource: "currentProject",
      projectSiteIds: [CONFIG.siteId],
      siteId: CONFIG.siteId,
      conditions: [
        {
          type: "group",
          groupType: cond.group_type,
          interactionPeriod: CONFIG.interactionPeriod,
          elements: [buildElement(cond, role)]
        }
      ]
    };
  }

  async function createInCalltouch(body) {
    if (!CONFIG.createUrl || CONFIG.createUrl.indexOf("PASTE_") === 0) {
      throw new Error("Укажите CONFIG.createUrl из Network");
    }
    const res = await fetch(CONFIG.createUrl, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (_) {}
    if (!res.ok) {
      throw new Error("Calltouch " + res.status + " " + text.slice(0, 300));
    }
    return json;
  }

  async function logToQa(payload) {
    try {
      const res = await fetch(CONFIG.qaApiBase + "/api/audiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const t = await res.text();
        console.warn("QA log failed", res.status, t);
        return null;
      }
      return res.json();
    } catch (err) {
      console.warn("QA API недоступен (запустите npm start):", err.message);
      return null;
    }
  }

  async function createOne(cond, role, opts) {
    const body = buildBody(cond, role);
    const lacmus = role === "primary" ? CONFIG.lacmusPositive : CONFIG.lacmusControl;
    const expected = expectedClients(cond, role);
    console.log(opts.dryRun ? "[dryRun]" : "[create]", body.name, body.conditions[0].elements[0]);

    if (opts.dryRun) {
      await logToQa({
        name: body.name,
        params: {
          key: cond.key,
          role: role,
          wave: cond.wave,
          cohort: cond.cohort,
          api_type: cond.api_type,
          api_shape: cond.api_shape,
          element: body.conditions[0].elements[0],
          dryRun: true
        },
        lacmus: lacmus,
        clients_count: lacmus,
        expected_clients: expected,
        calltouch_audience_id: null
      });
      return { dryRun: true, name: body.name };
    }

    const created = await createInCalltouch(body);
    const ctId =
      (created && (created.id || created.audienceId || created.audience_id)) || null;

    await logToQa({
      name: body.name,
      params: {
        key: cond.key,
        role: role,
        wave: cond.wave,
        cohort: cond.cohort,
        api_type: cond.api_type,
        api_shape: cond.api_shape,
        element: body.conditions[0].elements[0],
        response: created
      },
      lacmus: lacmus,
      clients_count: lacmus,
      expected_clients: expected,
      calltouch_audience_id: ctId != null ? String(ctId) : null
    });

    return { name: body.name, calltouch_audience_id: ctId, raw: created };
  }

  window.qaCreateEcomAudiences = async function (options) {
    const opts = Object.assign({ dryRun: false, limit: null, wave: null }, options || {});
    if (!window.QA_ECOM_CONDITIONS || !window.QA_ECOM_CONDITIONS.length) {
      throw new Error("Сначала вставьте qa/ecom-conditions.js");
    }
    if (!CONFIG.interactionPeriod) {
      throw new Error(
        "Задайте CONFIG.interactionPeriod из Network (periodType fullDepth запрещён)"
      );
    }

    let list = window.QA_ECOM_CONDITIONS.slice();
    if (opts.wave) {
      list = list.filter(function (c) {
        return String(c.wave) === String(opts.wave);
      });
    }
    if (opts.limit) list = list.slice(0, opts.limit);

    const results = [];
    for (let i = 0; i < list.length; i++) {
      const cond = list[i];
      results.push(await createOne(cond, "primary", opts));
      await sleep(CONFIG.delayMs);
      results.push(await createOne(cond, "negative", opts));
      await sleep(CONFIG.delayMs);
    }
    console.log("Готово:", results.length, "аудиторий");
    return results;
  };

  window.qaEcomConfig = CONFIG;
  console.log(
    "qaCreateEcomAudiences готов. Условий:",
    (window.QA_ECOM_CONDITIONS && window.QA_ECOM_CONDITIONS.length) || 0,
    "\n1) CONFIG.createUrl + CONFIG.interactionPeriod",
    "\n2) await qaCreateEcomAudiences({ dryRun: true, limit: 1 })",
    "\n3) await qaCreateEcomAudiences()"
  );
})();
