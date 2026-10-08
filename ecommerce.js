(function () {
  var EVENT_GAP_MS = 3000;

  function todayStamp() {
    var d = new Date();
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var dd = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + mm + "-" + dd;
  }

  function qs() {
    return new URLSearchParams(location.search || "");
  }

  function parseRoute() {
    var path = (location.pathname || "/").replace(/\/+$/, "") || "/";
    var q = qs();
    var queryDate = q.get("seed_date");
    var entry = path.match(/^\/entry-(.+)$/i);
    var control = path.match(/^\/control-(.+)$/i);

    if (entry) {
      return { mode: "entry", date: decodeURIComponent(entry[1]) };
    }
    if (control) {
      return { mode: "control", date: decodeURIComponent(control[1]) };
    }
    return { mode: "tester", date: queryDate || todayStamp() };
  }

  function applyFingerprint() {
    var fp = qs().get("fp");
    if (!fp) return null;
    var maxAge = 60 * 60 * 24 * 30;
    document.cookie =
      "nkh_fp=" +
      encodeURIComponent(fp) +
      "; path=/; max-age=" +
      maxAge +
      "; SameSite=Lax";
    try {
      localStorage.setItem("nkh_fp", fp);
    } catch (_) {}
    return fp;
  }

  function productExtrasFromQuery(date) {
    var q = qs();
    var suffix = q.get("product") || q.get("p") || "";
    var price = q.get("price");
    var brand = q.get("brand");
    var category = q.get("category");
    var variant = q.get("variant");
    var base = suffix ? "vacuum_" + date + "_" + suffix : "vacuum_" + date;
    return {
      id: q.get("product_id") || base,
      name: q.get("product_name") || base,
      price: price != null && price !== "" ? Number(price) : 100,
      brand: brand || "nkh_" + date + (suffix ? "_" + suffix : ""),
      category: category || "sandbox_" + date,
      variant: variant || "seed_" + date + (suffix ? "_" + suffix : ""),
      margin: 60,
      quantity: 1
    };
  }

  function product(date, extras) {
    extras = extras || {};
    var fromQuery = productExtrasFromQuery(date);
    return {
      id: extras.id || fromQuery.id,
      name: extras.name || fromQuery.name,
      price: extras.price == null ? fromQuery.price : extras.price,
      brand: extras.brand || fromQuery.brand,
      category: extras.category || fromQuery.category,
      variant: extras.variant || fromQuery.variant,
      margin: extras.margin == null ? fromQuery.margin : extras.margin,
      quantity: extras.quantity == null ? fromQuery.quantity : extras.quantity
    };
  }

  function logLine(text) {
    var box = document.getElementById("ecom-log");
    var line = new Date().toISOString() + "  " + text;
    console.log("[ecom]", text);
    if (box) {
      box.textContent += line + "\n";
      box.scrollTop = box.scrollHeight;
    }
  }

  function waitForCt(timeoutMs) {
    return new Promise(function (resolve, reject) {
      var started = Date.now();
      (function tick() {
        if (typeof window.ct !== "function") {
          if (Date.now() - started > timeoutMs) {
            reject(new Error("Calltouch ct не загрузился за " + timeoutMs + " мс"));
            return;
          }
          setTimeout(tick, 200);
          return;
        }
        if (window.ct.loaded) {
          resolve();
          return;
        }
        var initScript = document.querySelector('script[src*="mod.calltouch.ru/init"]');
        if (initScript || Date.now() - started > 1500) {
          resolve();
          return;
        }
        setTimeout(tick, 200);
      })();
    });
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function qaApiBase() {
    if (window.QA_API_BASE) return String(window.QA_API_BASE).replace(/\/+$/, "");
    if (/^localhost$|^127\.0\.0\.1$/.test(location.hostname)) return "";
    return null;
  }

  function recordSession(route, events, fingerprint) {
    var base = qaApiBase();
    if (base === null) {
      return Promise.resolve(null);
    }
    var role = route.mode === "control" ? "control" : "positive";
    var body = {
      tested_at: new Date().toISOString(),
      role: role,
      cohort: qs().get("cohort") || "session_main",
      audience_params: [],
      fingerprint: fingerprint || null,
      user_agent: navigator.userAgent,
      entry_url: location.href,
      ecom_events: events || [],
      status: "done"
    };
    return fetch(base + "/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
      .then(function (res) {
        if (!res.ok) throw new Error("sessions HTTP " + res.status);
        return res.json();
      })
      .then(function (row) {
        logLine("сессия записана в QA DB id=" + row.id);
        return row;
      })
      .catch(function (err) {
        logLine("не удалось записать сессию: " + err.message);
        return null;
      });
  }

  function send(method, payload) {
    return waitForCt(15000).then(function () {
      window.ct("send_ecommerce", method, payload);
      logLine(method + " " + JSON.stringify(payload));
    });
  }

  function sendChain(steps, route, fingerprint) {
    var sent = [];
    var chain = Promise.resolve();
    steps.forEach(function (step, index) {
      chain = chain.then(function () {
        if (index > 0) {
          logLine("пауза " + EVENT_GAP_MS + " мс");
          return sleep(EVENT_GAP_MS);
        }
      }).then(function () {
        return send(step.method, step.payload).then(function () {
          sent.push({ event: step.method, value: step.payload });
        });
      });
    });
    return chain
      .then(function () {
        document.documentElement.setAttribute("data-ecom-done", "1");
        return recordSession(route || { mode: "tester" }, sent, fingerprint);
      })
      .catch(function (err) {
        document.documentElement.setAttribute("data-ecom-done", "error");
        logLine("ошибка: " + err.message);
      });
  }

  function seedSteps(date, mode) {
    var main = product(date);
    var removed = product(date, {
      id: main.id + "_rm",
      name: main.name + "_rm",
      price: 40,
      margin: 20
    });
    var all = [
      { method: "detail", payload: { products: [main] } },
      { method: "addToCart", payload: { products: [main] } },
      { method: "removeFromCart", payload: { products: [removed] } },
      { method: "checkout", payload: { products: [main] } },
      {
        method: "purchase",
        payload: {
          id: "order_" + date + "_" + (qs().get("product") || "0"),
          manager: "sandbox",
          products: [main]
        }
      }
    ];

    // ecom=all|detail|detail,addToCart|none
    var ecom = (qs().get("ecom") || "").trim();
    if (!ecom) {
      if (mode === "control") return [];
      return all;
    }
    if (ecom === "none") return [];
    if (ecom === "all") return all;
    var wanted = ecom.split(",").map(function (s) {
      return s.trim();
    });
    return all.filter(function (step) {
      return wanted.indexOf(step.method) !== -1;
    });
  }

  function bindTester(route, fingerprint) {
    var date = route.date;
    var modeEl = document.getElementById("ecom-mode");
    var productEl = document.getElementById("ecom-product");
    var entryLink = document.getElementById("ecom-entry-link");
    var controlLink = document.getElementById("ecom-control-link");
    var p = product(date);

    if (modeEl) {
      if (route.mode === "entry") {
        modeEl.textContent =
          "Автосев /entry-" + date + (fingerprint ? " fp=" + fingerprint : "");
      } else if (route.mode === "control") {
        modeEl.textContent = "Контроль /control-" + date + ": e-comm не отправляются";
      } else {
        modeEl.textContent = "Тестер. Дата товара: " + date;
      }
    }
    if (productEl) {
      productEl.textContent = p.id;
    }
    if (entryLink) {
      entryLink.href = "/entry-" + encodeURIComponent(date);
    }
    if (controlLink) {
      controlLink.href = "/control-" + encodeURIComponent(date);
    }

    document.querySelectorAll("[data-ecom]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var method = btn.getAttribute("data-ecom");
        if (method === "all") {
          sendChain(seedSteps(date, "entry"), route, fingerprint);
          return;
        }
        var steps = seedSteps(date, "entry");
        var found = steps.filter(function (step) {
          return step.method === method;
        })[0];
        if (found) {
          send(found.method, found.payload)
            .then(function () {
              return recordSession(
                route,
                [{ event: found.method, value: found.payload }],
                fingerprint
              );
            })
            .catch(function (err) {
              logLine("ошибка: " + err.message);
            });
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var fingerprint = applyFingerprint();
    var route = parseRoute();
    bindTester(route, fingerprint);

    if (fingerprint) {
      logLine("fingerprint=" + fingerprint);
    }

    if (route.mode === "entry") {
      var steps = seedSteps(route.date, "entry");
      logLine("старт автосева для " + route.date + " events=" + steps.length);
      if (!steps.length) {
        document.documentElement.setAttribute("data-ecom-done", "1");
        recordSession(route, [], fingerprint);
        return;
      }
      sendChain(steps, route, fingerprint);
    } else if (route.mode === "control") {
      logLine("контрольный визит, e-comm пропущен");
      document.documentElement.setAttribute("data-ecom-done", "1");
      recordSession(route, [], fingerprint);
    }
  });
})();
