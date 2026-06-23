import Hebcal from 'hebcal';

export const isWorkingDayInIsrael = (date) => {
  const dayOfWeek = date.getDay();
  // 5 is Friday, 6 is Saturday
  if (dayOfWeek === 5 || dayOfWeek === 6) return false;

  const hdate = new Hebcal.HDate(date);
  const holidays = hdate.holidays();
  
  if (!holidays || holidays.length === 0) return true;

  for (const h of holidays) {
    const desc = h.desc[0];
    
    // Skip holidays that are observed only outside of Israel
    if (h.CHUL_ONLY) continue;

    // Holidays where work is generally forbidden (Yom Tov)
    const isMajorHoliday = desc.includes("Pesach") || 
                           desc.includes("Shavuot") || 
                           desc.includes("Rosh Hashana") || 
                           desc.includes("Yom Kippur") || 
                           desc.includes("Sukkot") || 
                           desc.includes("Simchat Torah") ||
                           desc.includes("Shmini Atzeret");
                           
    // Chol HaMoed is technically a working day for many, but we will count it as a working day unless specified.
    if (isMajorHoliday && !desc.includes("Chol ha-Moed")) {
      return false;
    }
  }

  return true;
};

/**
 * Gets the dates of the last `numDays` working days of a given month.
 */
export const getLastWorkingDaysOfMonth = (year, month, numDays = 5) => {
  // month is 0-indexed (0 = Jan, 11 = Dec)
  const lastDay = new Date(year, month + 1, 0); // Last day of the month
  
  const workingDays = [];
  let current = new Date(lastDay);

  while (workingDays.length < numDays && current.getDate() > 0 && current.getMonth() === month) {
    if (isWorkingDayInIsrael(current)) {
      workingDays.push(new Date(current));
    }
    current.setDate(current.getDate() - 1);
  }

  return workingDays.reverse(); // Return in chronological order
};

/**
 * Checks if today is one of the last `numDays` working days of the month.
 */
export const isWithinLastWorkingDays = (date, numDays = 5) => {
  const lastDays = getLastWorkingDaysOfMonth(date.getFullYear(), date.getMonth(), numDays);
  
  // Normalize dates to YYYY-MM-DD in local time
  const getLocalStr = (d) => {
    const offset = d.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(d - offset)).toISOString().slice(0, 10);
    return localISOTime;
  };

  const todayStr = getLocalStr(date);
  
  return lastDays.some(d => getLocalStr(d) === todayStr);
};
