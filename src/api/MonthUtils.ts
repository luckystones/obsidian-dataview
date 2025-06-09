import { DateTime } from 'luxon';

/**
 * Utility class for month-related calculations
 */
export class MonthUtils {
    /**
     * Calculates the date range (first day and last day) for a specific month of the year
     * @param year The year 
     * @param month The month (0-11)
     * @returns An object containing firstDay and lastDay dates
     */
    public static getMonthDateRange(year: number, month: number): { firstDay: Date, lastDay: Date } {
        if (isNaN(year) || isNaN(month) || month < 0 || month > 11) {
            console.error('Invalid year or month parameters:', year, month);
            return {
                firstDay: new Date(NaN),
                lastDay: new Date(NaN)
            };
        }

        try {
            // First day of the month
            const firstDay = new Date(year, month, 1);
            firstDay.setHours(0, 0, 0, 0);

            // Last day of the month (setting day 0 of next month gives last day of current month)
            const lastDay = new Date(year, month + 1, 0);
            lastDay.setHours(23, 59, 59, 999);

            return { firstDay, lastDay };
        } catch (e) {
            console.error('Error calculating month range:', e);
            return {
                firstDay: new Date(NaN),
                lastDay: new Date(NaN)
            };
        }
    }

    /**
     * Checks if a date falls within the specified month of the year
     * @param toBeCheckedDate The date in milliseconds or DateTime to check
     * @param firstDay The first day of the month
     * @param lastDay The last day of the month
     * @returns True if the date is in the specified month, false otherwise
     */
    public static isDateInMonth(toBeCheckedDate: DateTime | number, firstDay: Date, lastDay: Date): boolean {
        try {
            // Convert toBeCheckedDate to a Date object, handling Luxon DateTime correctly
            let dateToCheck: Date;
            if (typeof toBeCheckedDate === 'object' && 'toJSDate' in toBeCheckedDate) {
                // This is a Luxon DateTime object
                dateToCheck = toBeCheckedDate.toJSDate();
            } else {
                dateToCheck = new Date(toBeCheckedDate as number);
            }

            if (isNaN(dateToCheck.getTime())) {
                console.error('Invalid date:', toBeCheckedDate);
                return false;
            }

            if (isNaN(firstDay.getTime()) || isNaN(lastDay.getTime())) {
                console.error('Invalid month range:', firstDay, lastDay);
                return false;
            }

            return dateToCheck >= firstDay && dateToCheck <= lastDay;
        } catch (e) {
            console.error('Error in isDateInMonth:', e);
            return false;
        }
    }

    /**
     * Parses year and month from a filename
     * @param filename The filename in YYYY-Month format (e.g., 2023-January)
     * @returns An object containing year and month numbers, or undefined if parsing fails
     */
    public static parseYearAndMonthFromFilename(filename: string): { year: number, month: number } | undefined {
        try {
            // Parse year and month from filename
            const [yearStr, monthName] = filename.split('-');
            const year = parseInt(yearStr);

            if (isNaN(year) || !yearStr || !monthName) {
                console.error('Invalid filename format:', filename);
                console.error('Expected format: YYYY-Month (e.g., 2023-January)');
                return undefined;
            }

            // Convert month name to month index (0-11)
            const month = new Date(`${monthName} 1, ${year}`).getMonth();

            if (isNaN(month)) {
                console.error('Invalid month name:', monthName);
                return undefined;
            }

            return { year, month };
        } catch (e) {
            console.error('Error parsing year and month from filename:', e);
            return undefined;
        }
    }
} 