(function () {
  var EVENT_GAP_MS = 3000;

  function todayStamp() {
    var d = new Date();
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var dd = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + mm + "-" + dd;
  }

  function parseRoute() {
    var path = (location.pathname || "/").replace(/\/+$/, "") || "/";
    var queryDate = new URLSearchParams(location.search).get("seed_date");
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

  function product(date, extras) {
    extras = extras || {};
    return {
      id: extras.id || "vacuum_" + date,
      name: extras.name || "vacuum_" + date,
      price: extras.price == null ? 100 : extras.price,
      brand: extras.brand || "nkh_" + date,
      category: extras.category || "sandbox_" + date,
      variant: extras.variant || "seed_" + date,
      margin: extras.margin == null ? 60 : extras.margin,
      quantity: extras.quantity == null ? 1 : extras.quantity
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

  function recordSession(route, events) {
    var base = qaApiBase();
    if (base === null) {
      logLine("QA API пропущен (не localhost; задайте window.QA_API_BASE)");
      return Promise.resolve(null);
    }
    var role = route.mode === "control" ? "control" : "positive";
    var body = {
      tested_at: new Date().toISOString(),
      role: role,
      cohort: "session_main",
      audience_params: [],
      fingerprint: null,
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

  function sendChain(steps, route) {
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
        return recordSession(route || { mode: "tester" }, sent);
      })
      .catch(function (err) {
        logLine("ошибка: " + err.message);
      });
  }

  function seedSteps(date) {
    var main = product(date);
    var removed = product(date, { id: "vacuum_" + date + "_rm", price: 40, margin: 20 });
    return [
      { method: "detail", payload: { products: [main] } },
      { method: "addToCart", payload: { products: [main] } },
      { method: "removeFromCart", payload: { products: [removed] } },
      { method: "checkout", payload: { products: [main] } },
      {
        method: "purchase",
        payload: { id: "order_" + date, manager: "sandbox", products: [main] }
      }
    ];
  }

  function bindTester(route) {
    var date = route.date;
    var modeEl = document.getElementById("ecom-mode");
    var productEl = document.getElementById("ecom-product");
    var entryLink = document.getElementById("ecom-entry-link");
    var controlLink = document.getElementById("ecom-control-link");

    if (modeEl) {
      if (route.mode === "entry") {
        modeEl.textContent = "Автосев /entry-" + date + ": все 5 событий с паузой 3 с";
      } else if (route.mode === "control") {
        modeEl.textContent = "Контроль /control-" + date + ": события e-comm не отправляются";
      } else {
        modeEl.textContent = "Тестер. Дата товара: " + date;
      }
    }
    if (productEl) {
      productEl.textContent = "vacuum_" + date;
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
          sendChain(seedSteps(date), route);
          return;
        }
        var steps = seedSteps(date);
        var found = steps.filter(function (step) {
          return step.method === method;
        })[0];
        if (found) {
          send(found.method, found.payload)
            .then(function () {
              return recordSession(route, [{ event: found.method, value: found.payload }]);
            })
            .catch(function (err) {
              logLine("ошибка: " + err.message);
            });
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var route = parseRoute();
    bindTester(route);

    if (route.mode === "entry") {
      logLine("старт автосева для " + route.date);
      sendChain(seedSteps(route.date), route);
    } else if (route.mode === "control") {
      logLine("контрольный визит, e-comm пропущен");
      recordSession(route, []);
    }
  });
})();

