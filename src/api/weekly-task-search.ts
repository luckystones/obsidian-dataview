import { STask } from 'data-model/serialized/markdown';
import { Component, Notice } from 'obsidian';
import { DataArray } from './data-array';
import { DataviewApi } from './plugin-api';
import { DateTime } from 'luxon';
import { WeeklyView } from '../ui/views/weekly-view';

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export interface ParsedTask {
    description: string;
    duration: string;
    startTime: string;
    eventId: string;
    repetition: string;
    scheduleDate: string;
    dueDate: string;
    completionDate: string;
}

export interface WeeklyTaskGroup {
    Monday: STask[];
    Tuesday: STask[];
    Wednesday: STask[];
    Thursday: STask[];
    Friday: STask[];
    Saturday: STask[];
    Sunday: STask[];
}

export interface WeeklyTaskOptions {
    /** The year to get tasks for */
    year: number;
    /** The week number to get tasks for (1-52) */
    week: number;
    /** The path to search for tasks in. Defaults to "/" (root) */
    searchPath?: string;
    /** The filename to use for rendering (format: YYYY-WW). If not provided, will be generated from year and week */
    filename?: string;
    /** The component to use for rendering. Required for rendering tasks. */
    component?: Component;
    /** The container to render tasks in. Required for rendering tasks. */
    container?: HTMLElement;
    /** Whether to render as a table (true) or list view (false). Defaults to true. */
    tableView?: boolean;
    /** Whether to show only the task description (true) or the full task text (false). Defaults to true. */
    trimTaskText?: boolean;
}

export class WeeklyTaskApi {
    private dv: DataviewApi;
    private weeklyView: WeeklyView;

    constructor(dv: DataviewApi) {
        this.dv = dv;
        this.weeklyView = new WeeklyView(dv);
    }

    /**
     * Gets and renders weekly tasks in one operation
     * @param options The options for getting and rendering weekly tasks
     * @returns The container element with the rendered tasks
     */
    public async getAndRenderWeeklyTasks(options: WeeklyTaskOptions): Promise<HTMLElement> {
        const {
            year,
            week,
            searchPath = '"/game/objectives"',
            component,
            container,
            trimTaskText = true,
        } = options;

        if (!component || !container) {
            throw new Error('Component and container are required for rendering tasks');
        }

        let filename: string;

        // If year and week are provided, use them to create the filename
        if (year && week) {
            filename = `${year}-W${week}`;
        } else {
            // Otherwise try to get active file name
            const activeFileName = this.dv.app.workspace.getActiveFile()?.name;
            if (!activeFileName) {
                throw new Error('Could not determine current file and no year/week provided');
            }
            filename = activeFileName;
        }

        const result = await this.searchForTasksWithTag(searchPath, filename);
        const tasks = this.processTaskResults(result, filename);

        // If trimTaskText is true, update each task's text to show only the description
        if (trimTaskText) {
            Object.values(tasks).forEach(dayTasks => {
                dayTasks.forEach((task: STask) => {
                    const parsedTask = this.parseTask(task.text);
                    // Store the original text in a new property
                    (task as any).originalText = task.text;
                    // Update the text to show only the description
                    task.text = parsedTask.description;
                    // Also update visual if it exists
                    if (task.visual) {
                        task.visual = parsedTask.description;
                    }
                });
            });
        }

        // Render them using the WeeklyView class
        const taskContainer = this.weeklyView.renderWeeklyTasksAsTable(tasks, filename, component, container);

        const taskAndTimeContainer = this.weeklyView.renderWeeklyTime(filename, taskContainer, component);
        // Ensure styles are applied
        this.weeklyView.reloadStyles();

        return taskAndTimeContainer;
    }

    /**
     * Process task results into day-grouped format
     * @param result Task results from search
     * @param filename Filename in YYYY-WW format
     * @returns Tasks grouped by day of week
     */
    private processTaskResults(result: DataArray<STask>, filename: string): WeeklyTaskGroup {
        const groupedTasks: WeeklyTaskGroup = {
            Monday: [],
            Tuesday: [],
            Wednesday: [],
            Thursday: [],
            Friday: [],
            Saturday: [],
            Sunday: []
        };

        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

        result.forEach((task: STask) => {
            let referenceDate: Date | undefined;
            if (task.completion) {
                referenceDate = new Date(task.completion as number);
            } else if (task.scheduled) {
                referenceDate = new Date(task.scheduled as number);
            } else if (task.due) {
                referenceDate = new Date(task.due as number);
            }

            if (referenceDate) {
                const dayOfWeek = days[referenceDate.getDay()] as DayOfWeek;
                groupedTasks[dayOfWeek].push(task);
            }
        });

        return groupedTasks;
    }

    public async getWeeklyTasks(year: number, week: number, searchPath: string = "/"): Promise<WeeklyTaskGroup> {
        try {
            const query = `TASK
                WHERE (completed AND completion.year = ${year} AND completion.weekyear = ${week}) 
                OR (due AND due.year = ${year} AND due.weekyear = ${week}) 
                OR (scheduled AND scheduled.year = ${year} AND scheduled.weekyear = ${week})`;

            const result = await this.dv.query(query);
            if (!result.successful) {
                throw new Error(result.error);
            }

            const tasks = result.value.values as STask[];
            return this.groupTasksByDay(tasks, year, week);
        } catch (e) {
            throw new Error(`Failed to get weekly tasks: ${e.message}`);
        }
    }

    private groupTasksByDay(tasks: STask[], year: number, week: number): WeeklyTaskGroup {
        const result: WeeklyTaskGroup = {
            Monday: [],
            Tuesday: [],
            Wednesday: [],
            Thursday: [],
            Friday: [],
            Saturday: [],
            Sunday: []
        };

        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

        tasks.forEach(task => {
            let referenceDate: Date | undefined;
            if (task.completion) {
                referenceDate = new Date(task.completion as number);
            } else if (task.scheduled) {
                referenceDate = new Date(task.scheduled as number);
            } else if (task.due) {
                referenceDate = new Date(task.due as number);
            }

            if (referenceDate) {
                const dayIndex = referenceDate.getDay();
                const dayName = days[dayIndex] as DayOfWeek;
                result[dayName].push(task);
            }
        });

        return result;
    }

    /**
     * Finds the first Monday of the specified week in the year
     */
    private findFirstMonday(year: number, week: number): Date {
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

    private parseTask(taskText: string): ParsedTask {
        // Default values
        const result: ParsedTask = {
            description: taskText,
            duration: '',
            startTime: '',
            eventId: '',
            repetition: '',
            scheduleDate: '',
            dueDate: '',
            completionDate: ''
        };

        // Extract metadata and description using regex
        // Format: Task description #tag @duration(2h) @start(10:00) @id(123) @repeat(daily) ⏳ 2023-01-01 📅 2023-01-02 ✅ 2023-01-03

        // Extract and remove duration: @duration(2h)
        const durationMatch = taskText.match(/@duration\(([^)]+)\)/);
        if (durationMatch) {
            result.duration = durationMatch[1];
            result.description = result.description.replace(durationMatch[0], '').trim();
        }

        // Extract and remove start time: @start(10:00)
        const startMatch = taskText.match(/@start\(([^)]+)\)/);
        if (startMatch) {
            result.startTime = startMatch[1];
            result.description = result.description.replace(startMatch[0], '').trim();
        }

        // Extract and remove event ID: @id(123)
        const idMatch = taskText.match(/@id\(([^)]+)\)/);
        if (idMatch) {
            result.eventId = idMatch[1];
            result.description = result.description.replace(idMatch[0], '').trim();
        }

        // Extract and remove repetition: @repeat(daily)
        const repeatMatch = taskText.match(/@repeat\(([^)]+)\)/);
        if (repeatMatch) {
            result.repetition = repeatMatch[1];
            result.description = result.description.replace(repeatMatch[0], '').trim();
        }

        // Extract and remove scheduled date: ⏳ 2023-01-01
        const scheduleMatch = taskText.match(/⏳ ([0-9-]+)/);
        if (scheduleMatch) {
            result.scheduleDate = scheduleMatch[1];
            result.description = result.description.replace(scheduleMatch[0], '').trim();
        }

        // Extract and remove due date: 📅 2023-01-02
        const dueMatch = taskText.match(/📅 ([0-9-]+)/);
        if (dueMatch) {
            result.dueDate = dueMatch[1];
            result.description = result.description.replace(dueMatch[0], '').trim();
        }

        // Extract and remove completion date: ✅ 2023-01-03
        const completionMatch = taskText.match(/✅ ([0-9-]+)/);
        if (completionMatch) {
            result.completionDate = completionMatch[1];
            result.description = result.description.replace(completionMatch[0], '').trim();
        }

        // Clean up any remaining double spaces
        result.description = result.description.replace(/\s+/g, ' ').trim();

        return result;
    }

    /**
     * Searches for tasks with a specific tag in the given path
     * @param searchpath The path to search for tasks in
     * @param filename The current filename (in format YYYY-WW)
     * @returns An array of tasks matching the criteria
     */
    public searchForTasksWithTag(searchpath: string, filename: string): DataArray<STask> {
        try {
            // Parse year and week from filename
            const [year, weekStr] = filename.split('-W');
            const week = parseInt(weekStr, 10);

            if (isNaN(week) || !year) {
                console.error('Invalid filename format:', filename);
                console.error('Expected format: YYYY-WW');
                return this.dv.array([]) as DataArray<STask>;
            }


            // Get pages from the given search path
            const basicSearch = this.dv.pages('"game/objectives"');

            // If no pages found, return an empty task array
            if (!basicSearch || !basicSearch.length) {
                return this.dv.array([]) as DataArray<STask>;
            }

            // Create a flattened array of all tasks from all pages
            const allTasks = basicSearch.flatMap(page => {
                // Check if the page has a file property with tasks
                if (page &&
                    typeof page === 'object' &&
                    page.file &&
                    typeof page.file === 'object' &&
                    'tasks' in page.file &&
                    Array.isArray(page.file.tasks)) {
                    return page.file.tasks;
                }
                return [];
            }) as DataArray<STask>;


            // Filter tasks based on date criteria
            const taskSearch = allTasks.where((task: STask): boolean => {
                try {
                    // Get the date range for the specified week
                    const { firstMonday, lastSunday } = this.getWeekDateRange(parseInt(year), week);

                    const hasCompletionMatch = task.completed &&
                        task.completion &&
                        this.isDateInWeek(task.completion as DateTime, firstMonday, lastSunday);

                    // Check if due date exists and is in the same year and week
                    const hasDueMatch = task.due &&
                        this.isDateInWeek(task.due as DateTime, firstMonday, lastSunday);

                    // Check if scheduled date exists and is in the same year and week
                    const hasScheduledMatch = task.scheduled &&
                        this.isDateInWeek(task.scheduled as DateTime, firstMonday, lastSunday);

                    // Return true if any of the date criteria match
                    return !!(hasCompletionMatch || hasDueMatch || hasScheduledMatch);
                } catch (e) {
                    console.error('Error processing task:', task.text, e);
                    return false;
                }
            });

            return taskSearch;
        } catch (e) {
            console.error('Error in searchForTasksWithTag:', e);
            new Notice(
                'Invalid Dataview query: ' + String(e)
            );
            return this.dv.array([]) as DataArray<STask>;
        }
    }

    /**
     * Calculates the date range (first Monday and last Sunday) for a specific week of the year
     * @param year The year 
     * @param week The week number
     * @returns An object containing firstMonday and lastSunday dates
     */
    private getWeekDateRange(year: number, week: number): { firstMonday: Date, lastSunday: Date } {
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
     * Checks if a date falls within the specified week of the year
     * @param toBeCheckedDate The date in milliseconds to check
     * @param firstMonday The first day (Monday) of the week
     * @param lastSunday The last day (Sunday) of the week
     * @returns True if the date is in the specified week, false otherwise
     */
    private isDateInWeek(toBeCheckedDate: DateTime | number, firstMonday: Date, lastSunday: Date): boolean {
        try {
            // Convert toBeCheckedDate to a Date object, handling Luxon DateTime correctly
            let dueDate: Date;
            if (typeof toBeCheckedDate === 'object' && 'toJSDate' in toBeCheckedDate) {
                // This is a Luxon DateTime object
                dueDate = toBeCheckedDate.toJSDate();
            } else {
                dueDate = new Date(toBeCheckedDate as number);
            }

            if (isNaN(dueDate.getTime())) {
                console.error('Invalid date:', toBeCheckedDate);
                return false;
            }

            if (isNaN(firstMonday.getTime()) || isNaN(lastSunday.getTime())) {
                console.error('Invalid week range:', firstMonday, lastSunday);
                return false;
            }

            return dueDate >= firstMonday && dueDate <= lastSunday;
        } catch (e) {
            console.error('Error in isDateInWeek:', e);
            return false;
        }
    }
} 