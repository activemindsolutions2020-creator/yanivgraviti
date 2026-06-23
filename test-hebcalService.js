import { getLastWorkingDaysOfMonth, isWithinLastWorkingDays } from './services/hebcalService.js';

const lastDays = getLastWorkingDaysOfMonth(2026, 5); // June 2026
console.log("Last 5 working days of June 2026:", lastDays);

// Let's test September 2026 (Rosh Hashana, Yom Kippur etc.)
const septDays = getLastWorkingDaysOfMonth(2026, 8); // September 2026
console.log("Last 5 working days of Sep 2026:", septDays);

// Today (June 23, 2026)
console.log("Is today in last 5 working days?", isWithinLastWorkingDays(new Date(2026, 5, 23)));
console.log("Is June 25 in last 5 working days?", isWithinLastWorkingDays(new Date(2026, 5, 25)));
