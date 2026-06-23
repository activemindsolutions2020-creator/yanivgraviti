import Hebcal from 'hebcal';

// Passover 2026 is April 2
const passover = new Hebcal.HDate(new Date(2026, 3, 2));
console.log('Passover holidays:', passover.holidays());

// Regular day
const regular = new Hebcal.HDate(new Date(2026, 3, 10));
console.log('Regular holidays:', regular.holidays());
