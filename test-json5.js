import JSON5 from 'json5';

const badJson = `[
  {
    "vendor": "פז קמעונאות ואנרגיה בע\\"m", "category": "נסיעות אחרות",
    "type": "חשבונית מס/קבלה",
    "totalAmount": 213.11, "currency": "ILS", "date": "06/04/2026"
  }
]`;

try {
  console.log("Parsing...");
  const parsed = JSON5.parse(badJson);
  console.log("Success:", parsed);
} catch (e) {
  console.error("Error:", e.message);
}
