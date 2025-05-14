import { DataArray } from 'api/data-array';
import { DataviewApi } from 'api/plugin-api';
import { STask } from 'data-model/serialized/markdown';
import { Component } from 'obsidian';
import { DEFAULT_QUERY_SETTINGS } from 'settings';
import WeeklyTaskView from 'ui/views/weekly-task-view';

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
    let mockComponent: Component;
    let mockContainer: HTMLElement;
    let weeklyTaskView: WeeklyTaskView;

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

        mockComponent = new Component();

        // Create WeeklyTaskView instance
        weeklyTaskView = new WeeklyTaskView(mockDv as DataviewApi, mockComponent, mockContainer);
    });


    describe('findMondayOfTheGivenWeek', () => {
        test('should calculate the first day of week 1 in 2025', () => {
            // Access the private method using type assertion
            const findMondayOfTheGivenWeek = (weeklyTaskView as any).findMondayOfTheGivenWeek.bind(weeklyTaskView);

            // Calculate the first day of 2025-W1
            const firstDay = findMondayOfTheGivenWeek(2025, 1);

            // Log the actual date for debugging
            console.log(`First day of 2025-W1: ${firstDay.toISOString()}`);

            // The first Monday of 2025 should be January 6, 2025
            expect(firstDay.getUTCFullYear()).toBe(2025);
            expect(firstDay.getUTCMonth()).toBe(0); // January
            expect(firstDay.getUTCDate()).toBe(6);
            expect(firstDay.getUTCDay()).toBe(1); // Monday (1 in getDay())
        });

        test('should calculate the first day of different weeks in 2025', () => {
            // Access the private method using type assertion
            const findMondayOfTheGivenWeek = (weeklyTaskView as any).findMondayOfTheGivenWeek.bind(weeklyTaskView);

            // Week 2 of 2025
            const week2Day = findMondayOfTheGivenWeek(2025, 2);
            console.log(`First day of 2025-W2: ${week2Day.toISOString()}`);
            expect(week2Day.getUTCFullYear()).toBe(2025);
            expect(week2Day.getUTCMonth()).toBe(0); // January
            expect(week2Day.getUTCDate()).toBe(13);
            expect(week2Day.getUTCDay()).toBe(1); // Monday

            // Week 10 of 2025
            const week10Day = findMondayOfTheGivenWeek(2025, 10);
            console.log(`First day of 2025-W10: ${week10Day.toISOString()}`);
            expect(week10Day.getUTCFullYear()).toBe(2025);
            expect(week10Day.getUTCMonth()).toBe(2); // March
            expect(week10Day.getUTCDate()).toBe(10);
            expect(week10Day.getUTCDay()).toBe(1); // Monday
        });

        test('should handle year boundaries correctly', () => {
            // Access the private method using type assertion
            const findMondayOfTheGivenWeek = (weeklyTaskView as any).findMondayOfTheGivenWeek.bind(weeklyTaskView);

            // Week 1 of 2024
            const week1Day2024 = findMondayOfTheGivenWeek(2024, 1);
            console.log(`First day of 2024-W1: ${week1Day2024.toISOString()}`);
            expect(week1Day2024.getUTCFullYear()).toBe(2024);
            expect(week1Day2024.getUTCMonth()).toBe(0); // January
            expect(week1Day2024.getUTCDate()).toBe(1);
            expect(week1Day2024.getUTCDay()).toBe(1); // Monday

            // Week 53 of 2024 (last week of 2024)
            const week53Day2024 = findMondayOfTheGivenWeek(2024, 53);
            console.log(`First day of 2024-W53: ${week53Day2024.toISOString()}`);
            expect(week53Day2024.getUTCFullYear()).toBe(2024);
            expect(week53Day2024.getUTCMonth()).toBe(11); // December
            expect(week53Day2024.getUTCDate()).toBe(30);
            expect(week53Day2024.getUTCDay()).toBe(1); // Monday
        });
    });

    describe('isDateInWeek', () => {
        test('should correctly identify dates within week 1 of 2025', () => {
            // Access the private method using type assertion
            const isDateInWeek = (weeklyTaskView as any).isDateInWeek.bind(weeklyTaskView);

            // Create dates within the week using UTC
            const monday = Date.UTC(2025, 0, 6, 12, 0, 0, 0);
            const wednesday = Date.UTC(2025, 0, 8, 12, 0, 0, 0);
            const sunday = Date.UTC(2025, 0, 12, 12, 0, 0, 0);

            // Test dates within the week
            expect(isDateInWeek(monday, '2025-W1')).toBe(true);
            expect(isDateInWeek(wednesday, '2025-W1')).toBe(true);
            expect(isDateInWeek(sunday, '2025-W1')).toBe(true);

            // Test dates outside the week
            const beforeWeek = Date.UTC(2025, 0, 5, 12, 0, 0, 0);
            const afterWeek = Date.UTC(2025, 0, 13, 12, 0, 0, 0);

            expect(isDateInWeek(beforeWeek, '2025-W1')).toBe(false);
            expect(isDateInWeek(afterWeek, '2025-W1')).toBe(false);
        });

        test('should handle different week formats correctly', () => {
            // Access the private methods using type assertion
            const isDateInWeek = (weeklyTaskView as any).isDateInWeek.bind(weeklyTaskView);
            const findMondayOfTheGivenWeek = (weeklyTaskView as any).findMondayOfTheGivenWeek.bind(weeklyTaskView);

            // Calculate the actual first Monday of 2025-W10
            const week10Monday = findMondayOfTheGivenWeek(2025, 10);
            const week10Sunday = new Date(week10Monday);
            week10Sunday.setDate(week10Monday.getDate() + 6);

            // Test dates within week 10 using UTC
            const monday = Date.UTC(2025, 2, 10, 12, 0, 0, 0);
            const sunday = Date.UTC(2025, 2, 16, 12, 0, 0, 0);

            expect(isDateInWeek(monday, '2025-W10')).toBe(true);
            expect(isDateInWeek(sunday, '2025-W10')).toBe(true);

            // Test with incorrect week numbers
            expect(isDateInWeek(monday, '2025-W9')).toBe(false);
            expect(isDateInWeek(monday, '2025-W11')).toBe(false);
        });

        test('should correctly identify if 2025-02-27 is in week 8 of 2025', () => {
            // Access the private methods using type assertion
            const isDateInWeek = (weeklyTaskView as any).isDateInWeek.bind(weeklyTaskView);
            const findMondayOfTheGivenWeek = (weeklyTaskView as any).findMondayOfTheGivenWeek.bind(weeklyTaskView);

            // Create the specific date 2025-02-27 (February 27, 2025) using UTC
            const testDate = Date.UTC(2025, 1, 27, 12, 0, 0, 0);
            console.log(`Test date: ${new Date(testDate).toISOString()}`);

            // Calculate the first day of week 8 in 2025 for reference
            const week8Monday = findMondayOfTheGivenWeek(2025, 8);
            const week8Sunday = new Date(week8Monday);
            week8Sunday.setDate(week8Monday.getDate() + 6);

            console.log(`First day of 2025-W8: ${week8Monday.toISOString()}`);
            console.log(`Last day of 2025-W8: ${week8Sunday.toISOString()}`);

            // Test if 2025-02-27 is in week 8 of 2025
            const result = isDateInWeek(testDate, '2025-W8');
            console.log(`Is 2025-02-27 in week 8? ${result}`);
            expect(result).toBe(true);

            // Test with adjacent weeks to confirm specificity
            expect(isDateInWeek(testDate, '2025-W7')).toBe(false);
            expect(isDateInWeek(testDate, '2025-W9')).toBe(false);
        });

        test('should correctly identify if 2025-01-13 is in week 2 of 2025', () => {
            // Access the private methods using type assertion
            const isDateInWeek = (weeklyTaskView as any).isDateInWeek.bind(weeklyTaskView);

            const testDate = Date.UTC(2025, 0, 13, 0, 0, 0, 0);
            console.log(`Test date: ${new Date(testDate).toISOString()}`);

            // Test with adjacent weeks to confirm specificity
            expect(isDateInWeek(testDate, '2025-W2')).toBe(true);
        });
        test('should correctly identify if 2025-01-19 is in week 19 of 2025', () => {
            // Access the private methods using type assertion
            const isDateInWeek = (weeklyTaskView as any).isDateInWeek.bind(weeklyTaskView);

            const testDate = Date.UTC(2025, 4, 12, 0, 0, 0, 0);
            console.log(`Test date: ${new Date(testDate).toISOString()}`);

            expect(isDateInWeek(testDate, '2025-W19')).toBe(true);
        });
    });

}); 