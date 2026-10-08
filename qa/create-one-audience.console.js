/**
 * Одна аудитория — вставьте ВЕСЬ файл в Console на странице Calltouch → Enter.
 *
 * Исправление 400 «Блок клиенты должен быть первым»:
 * в conditions сначала groupType: "clients", затем "and", затем sessions.
 */
(async () => {
  const siteId = 50949;

  const period = {
    date: null,
    days: null,
    periodType: "fullDepth"
  };

  const body = {
    name: "qa-demo-session_ecommerce_has_product_add_to_cart-primary",
    dataSource: "currentProject",
    projectSiteIds: [siteId],
    siteId: siteId,
    conditions: [
      {
        type: "group",
        groupType: "clients",
        interactionPeriod: period,
        elements: []
      },
      { type: "and" },
      {
        type: "group",
        groupType: "sessions",
        interactionPeriod: period,
        elements: [
          {
            type: "session_ecommerce_has_product_add_to_cart",
            value: 1
          }
        ]
      }
    ]
  };

  console.log("request body", body);

  const res = await fetch(
    `https://my.calltouch.ru/api/sites/${siteId}/leads-product/auditorium/v2/create`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (_) {}

  console.log("status", res.status);
  console.log("response", json || text);

  return { status: res.status, body: body, response: json || text };
})();
