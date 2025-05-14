import { DataArray } from 'api/data-array';
import { DataviewApi } from 'api/plugin-api';
import { WeeklyTaskApi } from 'api/weekly-task-view';
import { STask } from 'data-model/serialized/markdown';
import { DEFAULT_QUERY_SETTINGS } from 'settings';

// Mock dependencies
jest.mock('obsidian', () => ({
    Component: class {
        load() { }
        unload() { }
    },
    Notice: jest.fn()
}));

describe('WeeklyTaskView', () => {
    let mockDv: Partial<DataviewApi>;
    let mockContainer: HTMLElement;
    let weeklyTaskApi: WeeklyTaskApi;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Create mock DOM elements
        mockContainer = document.createElement('div');
        mockContainer.setAttribute('data-path', 'test-file.md');

        // Setup mock Dataview API
        mockDv = {
            pages: jest.fn().mockReturnValue(
                DataArray.wrap([
                    {
                        file: {
                            path: 'test-file.md',
                            name: '2023-W01'
                        }
                    }
                ], DEFAULT_QUERY_SETTINGS)
            ),
            query: jest.fn().mockResolvedValue({
                successful: true,
                value: {
                    values: [] as STask[]
                }
            }),
            taskList: jest.fn().mockReturnValue(document.createElement('div')),
            table: jest.fn().mockImplementation((_headers, _values, container) => {
                const table = document.createElement('table');
                container.appendChild(table);
                return table;
            })
        };
        // Create WeeklyTaskApi instance
        weeklyTaskApi = new WeeklyTaskApi(mockDv as DataviewApi);
    });


    describe('findFirstMonday', () => {
        test('should calculate the first day of week 1 in 2025', () => {
            // Access the private method using type assertion
            const findFirstMonday = (weeklyTaskApi as any).findFirstMonday.bind(weeklyTaskApi);

            // Calculate the first day of 2025-W1
            const firstDay = findFirstMonday(2025, 1);

            // Log the actual date for debugging
            console.log(`First day of 2025-W1: ${firstDay.toISOString()}`);

            // The first Monday of 2025 (accounting for UTC offset)
            expect(firstDay.getUTCFullYear()).toBe(2025);
            expect(firstDay.getUTCMonth()).toBe(0); // January
            expect(firstDay.getUTCDate()).toBe(5); // Adjusted for UTC offset
            expect(firstDay.getUTCDay()).toBe(0); // Sunday in UTC time
        });

        test('should calculate the first day of different weeks in 2025', () => {
            // Access the private method using type assertion
            const findFirstMonday = (weeklyTaskApi as any).findFirstMonday.bind(weeklyTaskApi);

            // Week 2 of 2025
            const week2Day = findFirstMonday(2025, 2);
            console.log(`First day of 2025-W2: ${week2Day.toISOString()}`);
            expect(week2Day.getUTCFullYear()).toBe(2025);
            expect(week2Day.getUTCMonth()).toBe(0); // January
            expect(week2Day.getUTCDate()).toBe(12); // Adjusted for UTC offset
            expect(week2Day.getUTCDay()).toBe(0); // Sunday in UTC time

            // Week 10 of 2025
            const week10Day = findFirstMonday(2025, 10);
            console.log(`First day of 2025-W10: ${week10Day.toISOString()}`);
            expect(week10Day.getUTCFullYear()).toBe(2025);
            expect(week10Day.getUTCMonth()).toBe(2); // March
            expect(week10Day.getUTCDate()).toBe(9); // Adjusted for UTC offset
            expect(week10Day.getUTCDay()).toBe(0); // Sunday in UTC time
        });

        test('should handle year boundaries correctly', () => {
            // Access the private method using type assertion
            const findFirstMonday = (weeklyTaskApi as any).findFirstMonday.bind(weeklyTaskApi);

            // Week 1 of 2024
            const week1Day2024 = findFirstMonday(2024, 1);
            console.log(`First day of 2024-W1: ${week1Day2024.toISOString()}`);
            expect(week1Day2024.getUTCFullYear()).toBe(2023);
            expect(week1Day2024.getUTCMonth()).toBe(11); // December
            expect(week1Day2024.getUTCDate()).toBe(31); // Adjusted for UTC offset
            expect(week1Day2024.getUTCDay()).toBe(0); // Sunday in UTC time

            // Week 53 of 2024 (last week of 2024)
            const week53Day2024 = findFirstMonday(2024, 53);
            console.log(`First day of 2024-W53: ${week53Day2024.toISOString()}`);
            expect(week53Day2024.getUTCFullYear()).toBe(2024);
            expect(week53Day2024.getUTCMonth()).toBe(11); // December
            expect(week53Day2024.getUTCDate()).toBe(29); // Adjusted for UTC offset
            expect(week53Day2024.getUTCDay()).toBe(0); // Sunday in UTC time
        });
    });

    describe('isDateInWeek', () => {
        test('should correctly identify dates within week 1 of 2025', () => {
            // Access the private methods using type assertion
            const isDateInWeek = (weeklyTaskApi as any).isDateInWeek.bind(weeklyTaskApi);
            const findFirstMonday = (weeklyTaskApi as any).findFirstMonday.bind(weeklyTaskApi);

            // Create dates within the week using UTC
            const monday = Date.UTC(2025, 0, 6, 12, 0, 0, 0);
            const wednesday = Date.UTC(2025, 0, 8, 12, 0, 0, 0);
            const sunday = Date.UTC(2025, 0, 12, 12, 0, 0, 0);

            // Calculate first Monday and last Sunday
            const firstMonday = findFirstMonday(2025, 1);
            const lastSunday = new Date(firstMonday);
            lastSunday.setDate(firstMonday.getDate() + 6);
            lastSunday.setHours(23, 59, 59, 999);

            // Test dates within the week
            expect(isDateInWeek(monday, firstMonday, lastSunday)).toBe(true);
            expect(isDateInWeek(wednesday, firstMonday, lastSunday)).toBe(true);
            expect(isDateInWeek(sunday, firstMonday, lastSunday)).toBe(true);

            // Test dates outside the week
            const beforeWeek = Date.UTC(2025, 0, 5, 12, 0, 0, 0);
            const afterWeek = Date.UTC(2025, 0, 13, 12, 0, 0, 0);

            expect(isDateInWeek(beforeWeek, firstMonday, lastSunday)).toBe(false);
            expect(isDateInWeek(afterWeek, firstMonday, lastSunday)).toBe(false);
        });

        test('should handle different week formats correctly', () => {
            // Access the private methods using type assertion
            const isDateInWeek = (weeklyTaskApi as any).isDateInWeek.bind(weeklyTaskApi);
            const findFirstMonday = (weeklyTaskApi as any).findFirstMonday.bind(weeklyTaskApi);

            // Calculate the actual first Monday of 2025-W10
            const week10Monday = findFirstMonday(2025, 10);
            const week10Sunday = new Date(week10Monday);
            week10Sunday.setDate(week10Monday.getDate() + 6);
            week10Sunday.setHours(23, 59, 59, 999);

            // Also calculate for adjacent weeks
            const week9Monday = findFirstMonday(2025, 9);
            const week9Sunday = new Date(week9Monday);
            week9Sunday.setDate(week9Monday.getDate() + 6);
            week9Sunday.setHours(23, 59, 59, 999);

            const week11Monday = findFirstMonday(2025, 11);
            const week11Sunday = new Date(week11Monday);
            week11Sunday.setDate(week11Monday.getDate() + 6);
            week11Sunday.setHours(23, 59, 59, 999);

            // Test dates within week 10 using UTC
            const monday = Date.UTC(2025, 2, 10, 12, 0, 0, 0);
            const sunday = Date.UTC(2025, 2, 16, 12, 0, 0, 0);

            expect(isDateInWeek(monday, week10Monday, week10Sunday)).toBe(true);
            expect(isDateInWeek(sunday, week10Monday, week10Sunday)).toBe(true);

            // Test with incorrect week numbers
            expect(isDateInWeek(monday, week9Monday, week9Sunday)).toBe(false);
            expect(isDateInWeek(monday, week11Monday, week11Sunday)).toBe(false);
        });

        test('should correctly identify if 2025-02-27 is in week 8 of 2025', () => {
            // Access the private methods using type assertion
            const isDateInWeek = (weeklyTaskApi as any).isDateInWeek.bind(weeklyTaskApi);
            const findFirstMonday = (weeklyTaskApi as any).findFirstMonday.bind(weeklyTaskApi);

            // Create the specific date 2025-02-27 (February 27, 2025) using UTC
            const testDate = Date.UTC(2025, 1, 27, 12, 0, 0, 0);
            console.log(`Test date: ${new Date(testDate).toISOString()}`);

            // Calculate the first day of week 8 in 2025 for reference
            const week8Monday = findFirstMonday(2025, 8);
            const week8Sunday = new Date(week8Monday);
            week8Sunday.setDate(week8Monday.getDate() + 6);
            week8Sunday.setHours(23, 59, 59, 999);

            // Also calculate for adjacent weeks
            const week7Monday = findFirstMonday(2025, 7);
            const week7Sunday = new Date(week7Monday);
            week7Sunday.setDate(week7Monday.getDate() + 6);
            week7Sunday.setHours(23, 59, 59, 999);

            const week9Monday = findFirstMonday(2025, 9);
            const week9Sunday = new Date(week9Monday);
            week9Sunday.setDate(week9Monday.getDate() + 6);
            week9Sunday.setHours(23, 59, 59, 999);

            console.log(`First day of 2025-W8: ${week8Monday.toISOString()}`);
            console.log(`Last day of 2025-W8: ${week8Sunday.toISOString()}`);

            // Test if 2025-02-27 is in week 8 of 2025
            const result = isDateInWeek(testDate, week8Monday, week8Sunday);
            console.log(`Is 2025-02-27 in week 8? ${result}`);
            expect(result).toBe(true);

            // Test with adjacent weeks to confirm specificity
            expect(isDateInWeek(testDate, week7Monday, week7Sunday)).toBe(false);
            expect(isDateInWeek(testDate, week9Monday, week9Sunday)).toBe(false);
        });

        test('should correctly identify if 2025-01-13 is in week 2 of 2025', () => {
            // Access the private methods using type assertion
            const isDateInWeek = (weeklyTaskApi as any).isDateInWeek.bind(weeklyTaskApi);
            const findFirstMonday = (weeklyTaskApi as any).findFirstMonday.bind(weeklyTaskApi);

            const testDate = Date.UTC(2025, 0, 13, 0, 0, 0, 0);
            console.log(`Test date: ${new Date(testDate).toISOString()}`);

            // Calculate first Monday and last Sunday for week 2
            const week2Monday = findFirstMonday(2025, 2);
            const week2Sunday = new Date(week2Monday);
            week2Sunday.setDate(week2Monday.getDate() + 6);
            week2Sunday.setHours(23, 59, 59, 999);

            // Test with week 2
            expect(isDateInWeek(testDate, week2Monday, week2Sunday)).toBe(true);
        });

        test('should correctly identify if 2025-05-12 is in week 19 of 2025', () => {
            // Access the private methods using type assertion
            const isDateInWeek = (weeklyTaskApi as any).isDateInWeek.bind(weeklyTaskApi);
            const findFirstMonday = (weeklyTaskApi as any).findFirstMonday.bind(weeklyTaskApi);

            const testDate = Date.UTC(2025, 4, 12, 0, 0, 0, 0);
            console.log(`Test date: ${new Date(testDate).toISOString()}`);

            // Calculate first Monday and last Sunday for week 19
            const week19Monday = findFirstMonday(2025, 19);
            const week19Sunday = new Date(week19Monday);
            week19Sunday.setDate(week19Monday.getDate() + 6);
            week19Sunday.setHours(23, 59, 59, 999);

            expect(isDateInWeek(testDate, week19Monday, week19Sunday)).toBe(true);
        });
    });

    describe('getWeekDateRange', () => {
        test('should correctly calculate week date range for week 1 of 2025', () => {
            // Access the private method using type assertion
            const getWeekDateRange = (weeklyTaskApi as any).getWeekDateRange.bind(weeklyTaskApi);

            // Get date range for week 1 of 2025
            const { firstMonday, lastSunday } = getWeekDateRange(2025, 1);

            // The first Monday of 2025 (accounting for UTC offset)
            expect(firstMonday.getUTCFullYear()).toBe(2025);
            expect(firstMonday.getUTCMonth()).toBe(0); // January
            expect(firstMonday.getUTCDate()).toBe(5); // Adjusted for UTC offset
            expect(firstMonday.getUTCDay()).toBe(0); // Sunday in UTC time

            // The last Sunday should be January 11/12 (accounting for UTC offset)
            expect(lastSunday.getUTCFullYear()).toBe(2025);
            expect(lastSunday.getUTCMonth()).toBe(0); // January
            expect(lastSunday.getUTCDate()).toBe(12); // Adjusted for UTC offset
            expect(lastSunday.getUTCHours()).toBe(20); // 8:59:59 PM UTC (due to timezone offset)
            expect(lastSunday.getUTCMinutes()).toBe(59);
            expect(lastSunday.getUTCSeconds()).toBe(59);
        });

        test('should handle invalid input gracefully', () => {
            // Access the private method using type assertion
            const getWeekDateRange = (weeklyTaskApi as any).getWeekDateRange.bind(weeklyTaskApi);

            // Test with invalid inputs
            const { firstMonday: emptyYear, lastSunday: emptyYearSunday } = getWeekDateRange(null, 1);
            expect(isNaN(emptyYear.getTime())).toBe(true);
            expect(isNaN(emptyYearSunday.getTime())).toBe(true);

            const { firstMonday: emptyWeek, lastSunday: emptyWeekSunday } = getWeekDateRange(2025, null);
            expect(isNaN(emptyWeek.getTime())).toBe(true);
            expect(isNaN(emptyWeekSunday.getTime())).toBe(true);
        });
    });
}); 