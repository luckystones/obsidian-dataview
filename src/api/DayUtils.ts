import { DateTime } from 'luxon';

/**
 * Utility class for day-related calculations
 */
export class DayUtils {
    /**
     * Calculates the date range (start and end) for a specific day
     * @param year The year 
     * @param month The month (0-11)
     * @param day The day of the month (1-31)
     * @returns An object containing startOfDay and endOfDay dates
     */
    public static getDayDateRange(year: number, month: number, day: number): { startOfDay: Date, endOfDay: Date } {
        if (isNaN(year) || isNaN(month) || isNaN(day) || month < 0 || month > 11 || day < 1 || day > 31) {
            console.error('Invalid year, month, or day parameters:', year, month, day);
            return {
                startOfDay: new Date(NaN),
                endOfDay: new Date(NaN)
            };
        }

        try {
            // Start of the day
            const startOfDay = new Date(year, month, day);
            startOfDay.setHours(0, 0, 0, 0);

            // End of the day
            const endOfDay = new Date(year, month, day);
            endOfDay.setHours(23, 59, 59, 999);

            return { startOfDay, endOfDay };
        } catch (e) {
            console.error('Error calculating day range:', e);
            return {
                startOfDay: new Date(NaN),
                endOfDay: new Date(NaN)
            };
        }
    }

    /**
     * Checks if a date falls within the specified day
     * @param toBeCheckedDate The date in milliseconds or DateTime to check
     * @param startOfDay The start of the day
     * @param endOfDay The end of the day
     * @returns True if the date is in the specified day, false otherwise
     */
    public static isDateInDay(toBeCheckedDate: DateTime | number, startOfDay: Date, endOfDay: Date): boolean {
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

            if (isNaN(startOfDay.getTime()) || isNaN(endOfDay.getTime())) {
                console.error('Invalid day range:', startOfDay, endOfDay);
                return false;
            }

            return dateToCheck >= startOfDay && dateToCheck <= endOfDay;
        } catch (e) {
            console.error('Error in isDateInDay:', e);
            return false;
        }
    }

    /**
     * Checks if a date is before or equal to the specified day (end of day)
     * @param toBeCheckedDate The date in milliseconds or DateTime to check
     * @param endOfDay The end of the day to compare against
     * @returns True if the date is before or equal to the end of the specified day, false otherwise
     */
    public static isDateBeforeOrEqual(toBeCheckedDate: DateTime | number, endOfDay: Date): boolean {
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

            if (isNaN(endOfDay.getTime())) {
                console.error('Invalid day:', endOfDay);
                return false;
            }

            return dateToCheck <= endOfDay;
        } catch (e) {
            console.error('Error in isDateBeforeOrEqual:', e);
            return false;
        }
    }

    /**
     * Parses year, month, and day from a filename in YYYY-MM-DD format
     * @param filename The filename in YYYY-MM-DD format (e.g., 2025-12-01)
     * @returns An object containing year, month (0-11), and day numbers, or undefined if parsing fails
     */
    public static parseYearMonthDayFromFilename(filename: string): { year: number, month: number, day: number } | undefined {
        try {
            // Remove .md extension if present
            const cleanFilename = filename.replace(/\.md$/, '');

            // Parse year, month, and day from filename (YYYY-MM-DD format)
            const parts = cleanFilename.split('-');

            if (parts.length !== 3) {
                console.error('Invalid filename format:', filename);
                console.error('Expected format: YYYY-MM-DD (e.g., 2025-12-01)');
                return undefined;
            }

            const year = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1; // Convert to 0-based month
            const day = parseInt(parts[2]);

            if (isNaN(year) || isNaN(month) || isNaN(day)) {
                console.error('Invalid date components in filename:', filename);
                return undefined;
            }

            if (month < 0 || month > 11 || day < 1 || day > 31) {
                console.error('Invalid month or day values:', { month, day });
                return undefined;
            }

            return { year, month, day };
        } catch (e) {
            console.error('Error parsing year, month, and day from filename:', e);
            return undefined;
        }
    }
}

