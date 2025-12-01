import { DayUtils } from "../../api/DayUtils";
import { DateTime } from "luxon";

describe("DayUtils", () => {
    describe("isDateBeforeOrEqual", () => {
        const endOfDay = new Date(2025, 11, 1, 23, 59, 59, 999); // December 1, 2025 end of day

        test("DateTime object - same day should return true", () => {
            const sameDay = DateTime.fromObject({ year: 2025, month: 12, day: 1, hour: 12 });
            expect(DayUtils.isDateBeforeOrEqual(sameDay, endOfDay)).toBe(true);
        });

        test("DateTime object - day before should return true", () => {
            const dayBefore = DateTime.fromObject({ year: 2025, month: 11, day: 30 });
            expect(DayUtils.isDateBeforeOrEqual(dayBefore, endOfDay)).toBe(true);
        });

        test("DateTime object - day after should return false", () => {
            const dayAfter = DateTime.fromObject({ year: 2025, month: 12, day: 2 });
            expect(DayUtils.isDateBeforeOrEqual(dayAfter, endOfDay)).toBe(false);
        });

        test("DateTime object - week before should return true", () => {
            const weekBefore = DateTime.fromObject({ year: 2025, month: 11, day: 24 });
            expect(DayUtils.isDateBeforeOrEqual(weekBefore, endOfDay)).toBe(true);
        });

        test("DateTime object - month before should return true", () => {
            const monthBefore = DateTime.fromObject({ year: 2025, month: 11, day: 1 });
            expect(DayUtils.isDateBeforeOrEqual(monthBefore, endOfDay)).toBe(true);
        });

        test("DateTime object - year before should return true", () => {
            const yearBefore = DateTime.fromObject({ year: 2024, month: 12, day: 1 });
            expect(DayUtils.isDateBeforeOrEqual(yearBefore, endOfDay)).toBe(true);
        });

        test("Timestamp (number) - same day should return true", () => {
            const sameDay = new Date(2025, 11, 1, 12, 0).getTime();
            expect(DayUtils.isDateBeforeOrEqual(sameDay, endOfDay)).toBe(true);
        });

        test("Timestamp (number) - day before should return true", () => {
            const dayBefore = new Date(2025, 10, 30).getTime();
            expect(DayUtils.isDateBeforeOrEqual(dayBefore, endOfDay)).toBe(true);
        });

        test("Timestamp (number) - day after should return false", () => {
            const dayAfter = new Date(2025, 11, 2).getTime();
            expect(DayUtils.isDateBeforeOrEqual(dayAfter, endOfDay)).toBe(false);
        });

        test("Edge case - exactly at end of day should return true", () => {
            const exactEndOfDay = DateTime.fromObject({
                year: 2025,
                month: 12,
                day: 1,
                hour: 23,
                minute: 59,
                second: 59,
                millisecond: 999
            });
            expect(DayUtils.isDateBeforeOrEqual(exactEndOfDay, endOfDay)).toBe(true);
        });

        test("Edge case - one millisecond after end of day should return false", () => {
            const oneMsAfter = DateTime.fromObject({
                year: 2025,
                month: 12,
                day: 2,
                hour: 0,
                minute: 0,
                second: 0,
                millisecond: 0
            });
            expect(DayUtils.isDateBeforeOrEqual(oneMsAfter, endOfDay)).toBe(false);
        });

        test("Invalid date should return false", () => {
            const invalidDate = NaN;
            expect(DayUtils.isDateBeforeOrEqual(invalidDate, endOfDay)).toBe(false);
        });

        test("Invalid end of day should return false", () => {
            const validDate = DateTime.fromObject({ year: 2025, month: 12, day: 1 });
            const invalidEndOfDay = new Date(NaN);
            expect(DayUtils.isDateBeforeOrEqual(validDate, invalidEndOfDay)).toBe(false);
        });

        test("Should handle timezone differences correctly", () => {
            // Create dates in different timezones
            const utcDate = DateTime.fromObject({ year: 2025, month: 12, day: 1 }, { zone: 'utc' });
            expect(DayUtils.isDateBeforeOrEqual(utcDate, endOfDay)).toBe(true);
        });
    });

    describe("getDayDateRange", () => {
        test("Valid date should return correct range", () => {
            const result = DayUtils.getDayDateRange(2025, 11, 1); // December 1, 2025

            expect(result.startOfDay.getFullYear()).toBe(2025);
            expect(result.startOfDay.getMonth()).toBe(11); // December (0-based)
            expect(result.startOfDay.getDate()).toBe(1);
            expect(result.startOfDay.getHours()).toBe(0);
            expect(result.startOfDay.getMinutes()).toBe(0);
            expect(result.startOfDay.getSeconds()).toBe(0);
            expect(result.startOfDay.getMilliseconds()).toBe(0);

            expect(result.endOfDay.getFullYear()).toBe(2025);
            expect(result.endOfDay.getMonth()).toBe(11);
            expect(result.endOfDay.getDate()).toBe(1);
            expect(result.endOfDay.getHours()).toBe(23);
            expect(result.endOfDay.getMinutes()).toBe(59);
            expect(result.endOfDay.getSeconds()).toBe(59);
            expect(result.endOfDay.getMilliseconds()).toBe(999);
        });

        test("Invalid month should return NaN dates", () => {
            const result = DayUtils.getDayDateRange(2025, 13, 1);
            expect(isNaN(result.startOfDay.getTime())).toBe(true);
            expect(isNaN(result.endOfDay.getTime())).toBe(true);
        });

        test("Invalid day should return NaN dates", () => {
            const result = DayUtils.getDayDateRange(2025, 11, 32);
            expect(isNaN(result.startOfDay.getTime())).toBe(true);
            expect(isNaN(result.endOfDay.getTime())).toBe(true);
        });
    });

    describe("isDateInDay", () => {
        const startOfDay = new Date(2025, 11, 1, 0, 0, 0, 0);
        const endOfDay = new Date(2025, 11, 1, 23, 59, 59, 999);

        test("DateTime in the middle of the day should return true", () => {
            const midDay = DateTime.fromObject({ year: 2025, month: 12, day: 1, hour: 12 });
            expect(DayUtils.isDateInDay(midDay, startOfDay, endOfDay)).toBe(true);
        });

        test("DateTime at start of day should return true", () => {
            const startDateTime = DateTime.fromObject({
                year: 2025,
                month: 12,
                day: 1,
                hour: 0,
                minute: 0
            });
            expect(DayUtils.isDateInDay(startDateTime, startOfDay, endOfDay)).toBe(true);
        });

        test("DateTime at end of day should return true", () => {
            const endDateTime = DateTime.fromObject({
                year: 2025,
                month: 12,
                day: 1,
                hour: 23,
                minute: 59
            });
            expect(DayUtils.isDateInDay(endDateTime, startOfDay, endOfDay)).toBe(true);
        });

        test("DateTime before day should return false", () => {
            const beforeDay = DateTime.fromObject({ year: 2025, month: 11, day: 30 });
            expect(DayUtils.isDateInDay(beforeDay, startOfDay, endOfDay)).toBe(false);
        });

        test("DateTime after day should return false", () => {
            const afterDay = DateTime.fromObject({ year: 2025, month: 12, day: 2 });
            expect(DayUtils.isDateInDay(afterDay, startOfDay, endOfDay)).toBe(false);
        });

        test("Timestamp in the day should return true", () => {
            const midDay = new Date(2025, 11, 1, 12, 0).getTime();
            expect(DayUtils.isDateInDay(midDay, startOfDay, endOfDay)).toBe(true);
        });
    });

    describe("parseYearMonthDayFromFilename", () => {
        test("Valid YYYY-MM-DD format should parse correctly", () => {
            const result = DayUtils.parseYearMonthDayFromFilename("2025-12-01");
            expect(result).toEqual({ year: 2025, month: 11, day: 1 }); // month is 0-based
        });

        test("Valid YYYY-MM-DD.md format should parse correctly", () => {
            const result = DayUtils.parseYearMonthDayFromFilename("2025-12-01.md");
            expect(result).toEqual({ year: 2025, month: 11, day: 1 });
        });

        test("Single digit month should parse correctly", () => {
            const result = DayUtils.parseYearMonthDayFromFilename("2025-01-15");
            expect(result).toEqual({ year: 2025, month: 0, day: 15 });
        });

        test("Single digit day should parse correctly", () => {
            const result = DayUtils.parseYearMonthDayFromFilename("2025-12-05");
            expect(result).toEqual({ year: 2025, month: 11, day: 5 });
        });

        test("Invalid format should return undefined", () => {
            const result = DayUtils.parseYearMonthDayFromFilename("2025-12");
            expect(result).toBeUndefined();
        });

        test("Wrong format (DD-MM-YYYY) should return undefined", () => {
            const result = DayUtils.parseYearMonthDayFromFilename("01-12-2025");
            expect(result).toBeUndefined();
        });

        test("Invalid month should return undefined", () => {
            const result = DayUtils.parseYearMonthDayFromFilename("2025-13-01");
            expect(result).toBeUndefined();
        });

        test("Invalid day should return undefined", () => {
            const result = DayUtils.parseYearMonthDayFromFilename("2025-12-32");
            expect(result).toBeUndefined();
        });

        test("Empty string should return undefined", () => {
            const result = DayUtils.parseYearMonthDayFromFilename("");
            expect(result).toBeUndefined();
        });

        test("Non-date string should return undefined", () => {
            const result = DayUtils.parseYearMonthDayFromFilename("not-a-date");
            expect(result).toBeUndefined();
        });
    });
});

