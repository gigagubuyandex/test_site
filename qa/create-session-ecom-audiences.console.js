/**
 * Массовое создание аудиторий по параметрам СЕССИЙ (session_ecommerce_*).
 * Вставьте ВЕСЬ файл в Console на странице Calltouch → Enter.
 *
 * Создаёт primary + negative на каждое условие (13 × 2 = 26 аудиторий).
 * Лог только в консоль.
 *
 * Управление (после вставки, если нужно повторить):
 *   await qaCreateSessionEcom({ dryRun: true, limit: 1 })
 *   await qaCreateSessionEcom()
 */
(async () => {
  const CONFIG = {
    siteId: 50949,
    createUrl: "https://my.calltouch.ru/api/sites/50949/leads-product/auditorium/v2/create",
    seedDate: (function () {
      var d = new Date();
      var dd = String(d.getDate()).padStart(2, "0");
      var mm = String(d.getMonth() + 1).padStart(2, "0");
      return dd + "_" + mm + "_" + d.getFullYear();
    })(),
    delayMs: 400,
    /** Для боевого теста лучше снять дату из UI; fullDepth — как в рабочем демо */
    interactionPeriod: {
      date: null,
      days: null,
      periodType: "fullDepth"
    }
  };

  var CONDITIONS = [
    { key: "session_ecommerce_has_checkout_order", api_shape: "value_int", seed_positive: "1", seed_control: "0", audience_from: "", audience_to: "", negative_from: "", negative_to: "" },
    { key: "session_ecommerce_has_product_add_to_cart", api_shape: "value_int", seed_positive: "1", seed_control: "0", audience_from: "", audience_to: "", negative_from: "", negative_to: "" },
    { key: "session_ecommerce_has_product_remove_from_cart", api_shape: "value_int", seed_positive: "1", seed_control: "0", audience_from: "", audience_to: "", negative_from: "", negative_to: "" },
    { key: "session_ecommerce_has_product_view", api_shape: "value_int", seed_positive: "1", seed_control: "0", audience_from: "", audience_to: "", negative_from: "", negative_to: "" },
    { key: "session_ecommerce_has_purchase", api_shape: "value_int", seed_positive: "1", seed_control: "0", audience_from: "", audience_to: "", negative_from: "", negative_to: "" },
    { key: "session_ecommerce_added_to_cart_products_revenue", api_shape: "from_to", seed_positive: "100", seed_control: "5", audience_from: "50", audience_to: "150", negative_from: "1", negative_to: "10" },
    { key: "session_ecommerce_in_cart_products_count", api_shape: "from_to", seed_positive: "1", seed_control: "0", audience_from: "1", audience_to: "1", negative_from: "5", negative_to: "5" },
    { key: "session_ecommerce_in_cart_products_revenue", api_shape: "from_to", seed_positive: "100", seed_control: "5", audience_from: "50", audience_to: "150", negative_from: "1", negative_to: "10" },
    { key: "session_ecommerce_ordered_products_count", api_shape: "from_to", seed_positive: "1", seed_control: "0", audience_from: "1", audience_to: "1", negative_from: "5", negative_to: "5" },
    { key: "session_ecommerce_ordered_products_revenue", api_shape: "from_to", seed_positive: "100", seed_control: "5", audience_from: "50", audience_to: "150", negative_from: "1", negative_to: "10" },
    { key: "session_ecommerce_purchased_products_count", api_shape: "from_to", seed_positive: "1", seed_control: "0", audience_from: "1", audience_to: "1", negative_from: "5", negative_to: "5" },
    { key: "session_ecommerce_purchased_products_revenue", api_shape: "from_to", seed_positive: "100", seed_control: "5", audience_from: "50", audience_to: "150", negative_from: "1", negative_to: "10" },
    { key: "session_ecommerce_removed_from_cart_products_revenue", api_shape: "from_to", seed_positive: "40", seed_control: "5", audience_from: "30", audience_to: "50", negative_from: "1", negative_to: "10" }
  ];

  function sleep(ms) {
    return new Promise(function (r) {
      setTimeout(r, ms);
    });
  }

  function buildElement(cond, role) {
    var el = { type: cond.key };
    if (cond.api_shape === "value_int") {
      el.value = Number(role === "primary" ? cond.seed_positive : cond.seed_control);
      return el;
    }
    el.from = Number(role === "primary" ? cond.audience_from : cond.negative_from);
    el.to = Number(role === "primary" ? cond.audience_to : cond.negative_to);
    return el;
  }

  function buildBody(cond, role) {
    return {
      name: "qa-" + CONFIG.seedDate + "-" + cond.key + "-" + role,
      dataSource: "currentProject",
      projectSiteIds: [CONFIG.siteId],
      siteId: CONFIG.siteId,
      conditions: [
        {
          type: "group",
          groupType: "clients",
          interactionPeriod: CONFIG.interactionPeriod,
          elements: []
        },
        { type: "and" },
        {
          type: "group",
          groupType: "sessions",
          interactionPeriod: CONFIG.interactionPeriod,
          elements: [buildElement(cond, role)]
        }
      ]
    };
  }

  async function createOne(cond, role, dryRun) {
    var body = buildBody(cond, role);
    console.log(dryRun ? "[dryRun]" : "[create]", body.name, body.conditions[2].elements[0]);

    if (dryRun) {
      console.log("body", body);
      return { ok: true, dryRun: true, name: body.name, body: body };
    }

    var res = await fetch(CONFIG.createUrl, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    var text = await res.text();
    var json = null;
    try {
      json = JSON.parse(text);
    } catch (_) {}

    console.log("status", res.status, body.name);
    console.log("response", json || text);

    if (!res.ok) {
      return { ok: false, name: body.name, status: res.status, response: json || text };
    }
    return {
      ok: true,
      name: body.name,
      status: res.status,
      id: json && (json.id || json.audienceId || json.audience_id),
      response: json
    };
  }

  window.qaCreateSessionEcom = async function (opts) {
    opts = opts || {};
    var list = CONDITIONS.slice();
    if (opts.limit) list = list.slice(0, opts.limit);

    var results = [];
    for (var i = 0; i < list.length; i++) {
      results.push(await createOne(list[i], "primary", !!opts.dryRun));
      await sleep(CONFIG.delayMs);
      results.push(await createOne(list[i], "negative", !!opts.dryRun));
      await sleep(CONFIG.delayMs);
    }

    var failed = results.filter(function (r) {
      return !r.ok;
    });
    console.log("Итого:", results.length, "ok:", results.length - failed.length, "fail:", failed.length);
    if (failed.length) console.log("Ошибки:", failed);
    window.QA_SESSION_ECOM_RESULTS = results;
    return results;
  };

  window.qaSessionEcomConfig = CONFIG;
  window.QA_SESSION_ECOM_CONDITIONS = CONDITIONS;

  console.log(
    "Скрипт session e-com загружен. Условий:",
    CONDITIONS.length,
    "→ аудиторий:",
    CONDITIONS.length * 2,
    "\nСейчас запускаю создание всех…"
  );

  return await window.qaCreateSessionEcom();
})();
