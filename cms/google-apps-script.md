# Google Apps Script (optional)

You can add a **Publish** button in Google Sheets that POSTs CSV rows to your CMS server.

1. In the Sheet: **Extensions → Apps Script**
2. Paste a script that reads each tab, builds CSV text, and calls:

```javascript
UrlFetchApp.fetch('https://your-cms-host/api/import/csv', {
  method: 'post',
  contentType: 'application/json',
  headers: { 'X-CMS-Key': 'YOUR_CMS_API_KEY' },
  payload: JSON.stringify({
    'Words.csv': wordsCsv,
    'WordLists.csv': listsCsv,
    // ...
  }),
});
```

3. Call `/api/publish` after import.

For most teams, **download CSV → LexiQuest CMS Import tab** is simpler and does not require hosting the CMS publicly.
