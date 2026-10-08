/**
 * ВСЁ В ОДНОМ: вставьте этот файл целиком в консоль Calltouch (под своей сессией).
 *
 * Перед запуском заполните CONFIG.createUrl и CONFIG.interactionPeriod
 * (один раз снимите из DevTools → Network при ручном создании аудитории).
 *
 * Затем:
 *   await qaRun({ dryRun: true, limit: 1 })   // проверка + лог в localhost
 *   await qaRun()                            // создать все primary+negative
 *
 * Опционально только посмотреть тела запросов без отправки:
 *   qaPreviewRequests({ limit: 2 })
 */
(async function () {
  const CONFIG = {
    siteId: 50949,
    // !!! вставьте URL создания аудитории из Network
    createUrl: "PASTE_CREATE_URL_FROM_NETWORK",
    // !!! период = дата посева, НЕ fullDepth. Пример:
    // interactionPeriod: { date: "2026-10-08", days: null, periodType: "exactDate" },
    interactionPeriod: null,
    seedDate: (function () {
      var d = new Date();
      var dd = String(d.getDate()).padStart(2, "0");
      var mm = String(d.getMonth() + 1).padStart(2, "0");
      return dd + "_" + mm + "_" + d.getFullYear();
    })(),
    lacmusPositive: 100,
    lacmusControl: 10,
    qaApiBase: "http://localhost:3000",
    delayMs: 400
  };

  // ——— каталог e-com условий (волны 1–2) ———
  var CONDITIONS = [
    { key: "session_ecommerce_has_checkout_order", wave: "1", group_type: "sessions", api_type: "session_ecommerce_has_checkout_order", api_shape: "value_int", seed_positive: "1", seed_control: "0", audience_from: "", audience_to: "", negative_from: "", negative_to: "", expected_positive: "lacmus_positive", expected_negative: "lacmus_control" },
    { key: "session_ecommerce_has_product_add_to_cart", wave: "1", group_type: "sessions", api_type: "session_ecommerce_has_product_add_to_cart", api_shape: "value_int", seed_positive: "1", seed_control: "0", audience_from: "", audience_to: "", negative_from: "", negative_to: "", expected_positive: "lacmus_positive", expected_negative: "lacmus_control" },
    { key: "session_ecommerce_has_product_remove_from_cart", wave: "1", group_type: "sessions", api_type: "session_ecommerce_has_product_remove_from_cart", api_shape: "value_int", seed_positive: "1", seed_control: "0", audience_from: "", audience_to: "", negative_from: "", negative_to: "", expected_positive: "lacmus_positive", expected_negative: "lacmus_control" },
    { key: "session_ecommerce_has_product_view", wave: "1", group_type: "sessions", api_type: "session_ecommerce_has_product_view", api_shape: "value_int", seed_positive: "1", seed_control: "0", audience_from: "", audience_to: "", negative_from: "", negative_to: "", expected_positive: "lacmus_positive", expected_negative: "lacmus_control" },
    { key: "session_ecommerce_has_purchase", wave: "1", group_type: "sessions", api_type: "session_ecommerce_has_purchase", api_shape: "value_int", seed_positive: "1", seed_control: "0", audience_from: "", audience_to: "", negative_from: "", negative_to: "", expected_positive: "lacmus_positive", expected_negative: "lacmus_control" },
    { key: "session_ecommerce_added_to_cart_products_revenue", wave: "1", group_type: "sessions", api_type: "session_ecommerce_added_to_cart_products_revenue", api_shape: "from_to", seed_positive: "100", seed_control: "5", audience_from: "50", audience_to: "150", negative_from: "1", negative_to: "10", expected_positive: "lacmus_positive", expected_negative: "zero" },
    { key: "session_ecommerce_in_cart_products_count", wave: "1", group_type: "sessions", api_type: "session_ecommerce_in_cart_products_count", api_shape: "from_to", seed_positive: "1", seed_control: "0", audience_from: "1", audience_to: "1", negative_from: "5", negative_to: "5", expected_positive: "lacmus_positive", expected_negative: "zero" },
    { key: "session_ecommerce_in_cart_products_revenue", wave: "1", group_type: "sessions", api_type: "session_ecommerce_in_cart_products_revenue", api_shape: "from_to", seed_positive: "100", seed_control: "5", audience_from: "50", audience_to: "150", negative_from: "1", negative_to: "10", expected_positive: "lacmus_positive", expected_negative: "zero" },
    { key: "session_ecommerce_ordered_products_count", wave: "1", group_type: "sessions", api_type: "session_ecommerce_ordered_products_count", api_shape: "from_to", seed_positive: "1", seed_control: "0", audience_from: "1", audience_to: "1", negative_from: "5", negative_to: "5", expected_positive: "lacmus_positive", expected_negative: "zero" },
    { key: "session_ecommerce_ordered_products_revenue", wave: "1", group_type: "sessions", api_type: "session_ecommerce_ordered_products_revenue", api_shape: "from_to", seed_positive: "100", seed_control: "5", audience_from: "50", audience_to: "150", negative_from: "1", negative_to: "10", expected_positive: "lacmus_positive", expected_negative: "zero" },
    { key: "session_ecommerce_purchased_products_count", wave: "1", group_type: "sessions", api_type: "session_ecommerce_purchased_products_count", api_shape: "from_to", seed_positive: "1", seed_control: "0", audience_from: "1", audience_to: "1", negative_from: "5", negative_to: "5", expected_positive: "lacmus_positive", expected_negative: "zero" },
    { key: "session_ecommerce_purchased_products_revenue", wave: "1", group_type: "sessions", api_type: "session_ecommerce_purchased_products_revenue", api_shape: "from_to", seed_positive: "100", seed_control: "5", audience_from: "50", audience_to: "150", negative_from: "1", negative_to: "10", expected_positive: "lacmus_positive", expected_negative: "zero" },
    { key: "session_ecommerce_removed_from_cart_products_revenue", wave: "1", group_type: "sessions", api_type: "session_ecommerce_removed_from_cart_products_revenue", api_shape: "from_to", seed_positive: "40", seed_control: "5", audience_from: "30", audience_to: "50", negative_from: "1", negative_to: "10", expected_positive: "lacmus_positive", expected_negative: "zero" },

    { key: "client_session_ecommerce_has_checkout_order", wave: "2", group_type: "clients", api_type: "client_session_ecommerce_has_checkout_order", api_shape: "value_int", seed_positive: "1", seed_control: "0", audience_from: "", audience_to: "", negative_from: "", negative_to: "", expected_positive: "lacmus_positive", expected_negative: "lacmus_control" },
    { key: "client_session_ecommerce_has_product_add_to_cart", wave: "2", group_type: "clients", api_type: "client_session_ecommerce_has_product_add_to_cart", api_shape: "value_int", seed_positive: "1", seed_control: "0", audience_from: "", audience_to: "", negative_from: "", negative_to: "", expected_positive: "lacmus_positive", expected_negative: "lacmus_control" },
    { key: "client_session_ecommerce_has_product_remove_from_cart", wave: "2", group_type: "clients", api_type: "client_session_ecommerce_has_product_remove_from_cart", api_shape: "value_int", seed_positive: "1", seed_control: "0", audience_from: "", audience_to: "", negative_from: "", negative_to: "", expected_positive: "lacmus_positive", expected_negative: "lacmus_control" },
    { key: "client_session_ecommerce_has_product_view", wave: "2", group_type: "clients", api_type: "client_session_ecommerce_has_product_view", api_shape: "value_int", seed_positive: "1", seed_control: "0", audience_from: "", audience_to: "", negative_from: "", negative_to: "", expected_positive: "lacmus_positive", expected_negative: "lacmus_control" },
    { key: "client_session_ecommerce_has_purchase", wave: "2", group_type: "clients", api_type: "client_session_ecommerce_has_purchase", api_shape: "value_int", seed_positive: "1", seed_control: "0", audience_from: "", audience_to: "", negative_from: "", negative_to: "", expected_positive: "lacmus_positive", expected_negative: "lacmus_control" },
    { key: "client_session_ecommerce_added_to_cart_products_revenue", wave: "2", group_type: "clients", api_type: "client_session_ecommerce_added_to_cart_products_revenue", api_shape: "from_to", seed_positive: "100", seed_control: "0", audience_from: "50", audience_to: "150", negative_from: "1", negative_to: "10", expected_positive: "lacmus_positive", expected_negative: "zero" },
    { key: "client_session_ecommerce_in_cart_products_count", wave: "2", group_type: "clients", api_type: "client_session_ecommerce_in_cart_products_count", api_shape: "from_to", seed_positive: "1", seed_control: "0", audience_from: "1", audience_to: "1", negative_from: "5", negative_to: "5", expected_positive: "lacmus_positive", expected_negative: "zero" },
    { key: "client_session_ecommerce_in_cart_products_revenue", wave: "2", group_type: "clients", api_type: "client_session_ecommerce_in_cart_products_revenue", api_shape: "from_to", seed_positive: "100", seed_control: "0", audience_from: "50", audience_to: "150", negative_from: "1", negative_to: "10", expected_positive: "lacmus_positive", expected_negative: "zero" },
    { key: "client_session_ecommerce_ordered_products_count", wave: "2", group_type: "clients", api_type: "client_session_ecommerce_ordered_products_count", api_shape: "from_to", seed_positive: "1", seed_control: "0", audience_from: "1", audience_to: "1", negative_from: "5", negative_to: "5", expected_positive: "lacmus_positive", expected_negative: "zero" },
    { key: "client_session_ecommerce_ordered_products_revenue", wave: "2", group_type: "clients", api_type: "client_session_ecommerce_ordered_products_revenue", api_shape: "from_to", seed_positive: "100", seed_control: "0", audience_from: "50", audience_to: "150", negative_from: "1", negative_to: "10", expected_positive: "lacmus_positive", expected_negative: "zero" },
    { key: "client_session_ecommerce_purchased_products_count", wave: "2", group_type: "clients", api_type: "client_session_ecommerce_purchased_products_count", api_shape: "from_to", seed_positive: "1", seed_control: "0", audience_from: "1", audience_to: "1", negative_from: "5", negative_to: "5", expected_positive: "lacmus_positive", expected_negative: "zero" },
    { key: "client_session_ecommerce_purchased_products_revenue", wave: "2", group_type: "clients", api_type: "client_session_ecommerce_purchased_products_revenue", api_shape: "from_to", seed_positive: "100", seed_control: "0", audience_from: "50", audience_to: "150", negative_from: "1", negative_to: "10", expected_positive: "lacmus_positive", expected_negative: "zero" },
    { key: "client_session_ecommerce_removed_from_cart_products_revenue", wave: "2", group_type: "clients", api_type: "client_session_ecommerce_removed_from_cart_products_revenue", api_shape: "from_to", seed_positive: "100", seed_control: "0", audience_from: "50", audience_to: "150", negative_from: "1", negative_to: "10", expected_positive: "lacmus_positive", expected_negative: "zero" }
  ];

  function sleep(ms) {
    return new Promise(function (r) {
      setTimeout(r, ms);
    });
  }

  function expectedClients(cond, role) {
    var key = role === "primary" ? cond.expected_positive : cond.expected_negative;
    if (key === "lacmus_positive") return CONFIG.lacmusPositive;
    if (key === "lacmus_control") return CONFIG.lacmusControl;
    if (key === "zero") return 0;
    return null;
  }

  function buildElement(cond, role) {
    var el = { type: cond.api_type };
    if (cond.api_shape === "value_int") {
      el.value = Number(role === "primary" ? cond.seed_positive : cond.seed_control);
      return el;
    }
    if (cond.api_shape === "from_to") {
      el.from = Number(role === "primary" ? cond.audience_from : cond.negative_from);
      el.to = Number(role === "primary" ? cond.audience_to : cond.negative_to);
      return el;
    }
    throw new Error("unsupported api_shape " + cond.api_shape);
  }

  function buildRequest(cond, role) {
    var name = "qa-" + CONFIG.seedDate + "-" + cond.key + "-" + role;
    var body = {
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
    return {
      name: name,
      role: role,
      key: cond.key,
      wave: cond.wave,
      method: "POST",
      url: CONFIG.createUrl,
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: body,
      expected_clients: expectedClients(cond, role),
      lacmus: role === "primary" ? CONFIG.lacmusPositive : CONFIG.lacmusControl
    };
  }

  /** Массив всех запросов (primary + negative на каждое условие) = 52 штуки */
  function buildAllRequests(opts) {
    opts = opts || {};
    var list = CONDITIONS.slice();
    if (opts.wave) {
      list = list.filter(function (c) {
        return String(c.wave) === String(opts.wave);
      });
    }
    if (opts.limit) list = list.slice(0, opts.limit);
    var out = [];
    list.forEach(function (cond) {
      out.push(buildRequest(cond, "primary"));
      out.push(buildRequest(cond, "negative"));
    });
    return out;
  }

  async function logToQa(req, calltouchId, dryRun) {
    try {
      await fetch(CONFIG.qaApiBase + "/api/audiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: req.name,
          params: {
            key: req.key,
            role: req.role,
            wave: req.wave,
            element: req.body.conditions[0].elements[0],
            dryRun: !!dryRun
          },
          lacmus: req.lacmus,
          clients_count: req.lacmus,
          expected_clients: req.expected_clients,
          calltouch_audience_id: calltouchId != null ? String(calltouchId) : null
        })
      });
    } catch (e) {
      console.warn("QA log skip:", e.message);
    }
  }

  async function sendOne(req, dryRun) {
    console.log(dryRun ? "[dryRun]" : "[POST]", req.name, req.body.conditions[0].elements[0]);
    if (dryRun) {
      await logToQa(req, null, true);
      return { ok: true, dryRun: true, name: req.name };
    }
    if (!CONFIG.createUrl || CONFIG.createUrl.indexOf("PASTE_") === 0) {
      throw new Error("Заполните CONFIG.createUrl");
    }
    if (!CONFIG.interactionPeriod) {
      throw new Error("Заполните CONFIG.interactionPeriod (не fullDepth)");
    }
    var res = await fetch(req.url, {
      method: req.method,
      credentials: req.credentials,
      headers: req.headers,
      body: JSON.stringify(req.body)
    });
    var text = await res.text();
    var json = null;
    try {
      json = JSON.parse(text);
    } catch (_) {}
    if (!res.ok) throw new Error(req.name + " → " + res.status + " " + text.slice(0, 300));
    var id = json && (json.id || json.audienceId || json.audience_id);
    await logToQa(req, id, false);
    return { ok: true, name: req.name, id: id, raw: json };
  }

  window.qaPreviewRequests = function (opts) {
    var requests = buildAllRequests(opts);
    console.log("Запросов:", requests.length);
    console.table(
      requests.map(function (r) {
        return {
          name: r.name,
          wave: r.wave,
          role: r.role,
          element: JSON.stringify(r.body.conditions[0].elements[0]),
          expected: r.expected_clients
        };
      })
    );
    window.QA_REQUESTS = requests;
    return requests;
  };

  window.qaRun = async function (opts) {
    opts = opts || {};
    var requests = buildAllRequests(opts);
    var results = [];
    for (var i = 0; i < requests.length; i++) {
      results.push(await sendOne(requests[i], !!opts.dryRun));
      await sleep(CONFIG.delayMs);
    }
    console.log("Готово:", results.length);
    window.QA_LAST_RESULTS = results;
    return results;
  };

  window.qaEcomConfig = CONFIG;
  window.QA_CONDITIONS = CONDITIONS;

  console.log(
    "Скрипт загружен. Условий:",
    CONDITIONS.length,
    "→ запросов:",
    CONDITIONS.length * 2,
    "\n1) Правьте CONFIG.createUrl и CONFIG.interactionPeriod в начале файла (или: qaEcomConfig.createUrl = '...'; qaEcomConfig.interactionPeriod = {...})",
    "\n2) qaPreviewRequests({ limit: 2 })",
    "\n3) await qaRun({ dryRun: true, limit: 1 })",
    "\n4) await qaRun()"
  );
})();
