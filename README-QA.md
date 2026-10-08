# Локальный QA-журнал

## Запуск

Зависимости лежат на локальном диске (Google Drive ломает `npm install`):

`%LOCALAPPDATA%\nkh-sandbox-qa\node_modules`

SQLite-файл:

`%LOCALAPPDATA%\nkh-sandbox-qa\data\app.db`

```bash
npm start
```

Откроется:

- сайт: http://localhost:3000/
- admin: http://localhost:3000/admin
- health: http://localhost:3000/api/health

## DataGrip

Подключение: SQLite → файл  
`C:\Users\<you>\AppData\Local\nkh-sandbox-qa\data\app.db`

## Переустановка зависимостей

```powershell
cd $env:LOCALAPPDATA\nkh-sandbox-qa
npm install express@4.21.2 better-sqlite3@11.7.0 cors@2.8.5
```

## API

- `GET/POST /api/audiences`, `PATCH/DELETE /api/audiences/:id`
- `GET/POST /api/sessions`, `PATCH/DELETE /api/sessions/:id`
- `GET/POST /api/test-results`, `PATCH/DELETE /api/test-results/:id`
- `POST /api/import/audiences` — body `{ "csv": "name,params,..." }`
- `POST /api/import/audience-facts` — body `{ "csv": "name,real_clients,..." }`
- `POST /api/seed/session-plan` — план `session_main` (100+10) + `session_multi` (10×2)

Запись сессий с страницы e-com работает при открытии через `http://localhost:3000`. На Netlify по умолчанию пропускается (можно задать `window.QA_API_BASE`).

## Скрипт создания аудиторий (консоль Calltouch)

1. Запустите `npm start`.
2. В Calltouch снимите из Network: `createUrl` и `interactionPeriod`.
3. Вставьте в консоль по очереди:
   - `qa/ecom-conditions.js`
   - `qa/create-ecom-audiences.console.js` (правьте `CONFIG` вверху)
4. `await qaCreateEcomAudiences({ dryRun: true, limit: 1 })`
5. `await qaCreateEcomAudiences()`

## План сессий

```bash
curl -X POST http://localhost:3000/api/seed/session-plan -H "Content-Type: application/json" -d "{\"seed_date\":\"2026-10-08\"}"
```

## Webhook → Firebase RTDB

Function: `netlify/functions/calltouch-webhook.js`  
После деплоя: `https://nkh-sandbox.netlify.app/.netlify/functions/calltouch-webhook`

В Netlify UI задайте сами (агенту не присылать):

- `FIREBASE_DATABASE_URL=https://first-7b348-default-rtdb.firebaseio.com`
- `FIREBASE_SERVICE_ACCOUNT` — JSON ключа service account
