import { DateTime } from 'luxon';

/**
 * Utility class for week-related calculations
 */
export class WeekUtils {
    /**
     * Calculates the date range (first Monday and last Sunday) for a specific week of the year
     * @param year The year 
     * @param week The week number
     * @returns An object containing firstMonday and lastSunday dates
     */
    public static getWeekDateRange(year: number, week: number): { firstMonday: Date, lastSunday: Date } {
        if (!year || !week) {
            console.error('Invalid year or week parameters:', year, week);
            return {
                firstMonday: new Date(NaN),
                lastSunday: new Date(NaN)
            };
        }

        try {
            const firstMonday = this.findFirstMonday(year, week);

            if (isNaN(firstMonday.getTime())) {
                console.error('Invalid first Monday for year/week:', year, week);
                return {
                    firstMonday: new Date(NaN),
                    lastSunday: new Date(NaN)
                };
            }

            const lastSunday = new Date(firstMonday);
            lastSunday.setDate(firstMonday.getDate() + 6);
            lastSunday.setHours(23, 59, 59, 999);

            return { firstMonday, lastSunday };
        } catch (e) {
            console.error('Error calculating week range:', e);
            return {
                firstMonday: new Date(NaN),
                lastSunday: new Date(NaN)
            };
        }
    }

    /**
     * Finds the first Monday of the specified week in the year
     * @param year The year
     * @param week The week number
     * @returns The date of the first Monday of the week
     */
    public static findFirstMonday(year: number, week: number): Date {
        try {
            // Validate inputs
            const janFirst = new Date(year, 0, 1);

            // Find the first Monday of the year
            // getDay() returns 0 for Sunday, 1 for Monday, etc.
            const dayOfWeek = janFirst.getDay();
            const daysToFirstMonday = dayOfWeek === 1 ? 0 : (dayOfWeek === 0 ? 1 : 8 - dayOfWeek);

            const firstMondayOfYear = new Date(year, 0, 1 + daysToFirstMonday);

            // Calculate the target Monday based on the week number
            const targetMonday = new Date(firstMondayOfYear);
            targetMonday.setDate(firstMondayOfYear.getDate() + (week - 1) * 7);

            return targetMonday;
        } catch (e) {
            console.error('Error in findFirstMonday:', e);
            throw e;
        }
    }

    /**
     * Checks if a date falls within the specified week of the year
     * @param toBeCheckedDate The date in milliseconds to check
     * @param firstMonday The first day (Monday) of the week
     * @param lastSunday The last day (Sunday) of the week
     * @returns True if the date is in the specified week, false otherwise
     */
    public static isDateInWeek(toBeCheckedDate: DateTime | number, firstMonday: Date, lastSunday: Date): boolean {
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

            if (isNaN(firstMonday.getTime()) || isNaN(lastSunday.getTime())) {
                console.error('Invalid week range:', firstMonday, lastSunday);
                return false;
            }

            return dateToCheck >= firstMonday && dateToCheck <= lastSunday;
        } catch (e) {
            console.error('Error in isDateInWeek:', e);
            return false;
        }
    }

    /**
     * Parses year and week from a filename
     * @param filename The filename in YYYY-WW format
     * @returns An object containing year and week numbers, or undefined if parsing fails
     */
    public static parseYearAndWeekFromFilename(filename: string): { year: number, week: number } | undefined {
        try {
            // Parse year and week from filename
            const [yearStr, weekStr] = filename.split('-W');
            const year = parseInt(yearStr);
            const week = parseInt(weekStr);

            if (isNaN(week) || isNaN(year) || !yearStr || !weekStr) {
                console.error('Invalid filename format:', filename);
                console.error('Expected format: YYYY-WW');
                return undefined;
            }

            return { year, week };
        } catch (e) {
            console.error('Error parsing year and week from filename:', e);
            return undefined;
        }
    }
} 