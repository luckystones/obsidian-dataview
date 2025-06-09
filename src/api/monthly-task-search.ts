import { DataArray, DataviewApi, STask } from 'index';
import { DateTime } from 'luxon';
import { MonthUtils } from './MonthUtils';

export interface MonthlyTaskGroup {
    tasks: STask[];
    // Add other properties as needed for monthly tasks organization
}

export interface MonthlyTaskOptions {
    /** The year to get tasks for */
    year: number;
    /** The month to get tasks for (0-11) */
    month: number;
    /** The path to search for tasks in. Defaults to "/" (root) */
    searchPath?: string;
    /** The filename to use for rendering (format: YYYY-Month). If not provided, will be generated from year and month */
    filename?: string;
}

export class MonthlyTaskApi {
    private dv: DataviewApi;

    constructor(dv: DataviewApi) {
        this.dv = dv;
    }

    /**
     * Gets the filename from options or determines it from the active file
     * @param options Options containing year, month, and optional filename
     * @returns The filename in YYYY-Month format
     */
    private getFilenameFromOptions(options: MonthlyTaskOptions): string {
        const { year, month, filename: optionsFilename } = options;
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        // If filename is provided in options, use it
        if (optionsFilename) {
            return optionsFilename;
        }

        // If year and month are provided, use them to create the filename
        if (year !== undefined && month !== undefined && month >= 0 && month < 12) {
            return `${year}-${monthNames[month]}`;
        }

        // Otherwise try to get active file name
        const activeFileName = this.dv.app.workspace.getActiveFile()?.name;
        if (!activeFileName) {
            throw new Error('Could not determine current file and no year/month provided');
        }

        return activeFileName;
    }

    /**
     * Gets monthly tasks based on the provided options
     * @param options Options for fetching monthly tasks
     * @returns A group of tasks for the specified month
     */
    public getMonthlyTasks(options: MonthlyTaskOptions): MonthlyTaskGroup {
        // Get filename using the helper method
        const filename = this.getFilenameFromOptions(options);

        // Search for tasks
        const tasks = this.searchMonthlyTasks('"game/objectives"', filename);

        // Process the tasks
        return this.processTaskResults(tasks);
    }

    /**
     * Process task results for monthly view
     * @param tasks The tasks to process
     * @returns Processed tasks grouped for monthly view
     */
    private processTaskResults(tasks: DataArray<STask>): MonthlyTaskGroup {
        // Process tasks for monthly view
        // This could involve sorting by date, grouping by categories, etc.
        return {
            tasks: tasks.array()
        };
    }

    public searchMonthlyTasks(searchpath: string, filename: string): DataArray<STask> {
        try {
            // Parse year and month from filename
            const yearMonth = MonthUtils.parseYearAndMonthFromFilename(filename);

            if (!yearMonth) {
                return this.dv.array([]) as DataArray<STask>;
            }

            const { year, month } = yearMonth;

            // Get date range for the month
            const { firstDay, lastDay } = MonthUtils.getMonthDateRange(year, month);

            // Get pages from the given search path
            const pages = this.dv.pages(searchpath);

            // If no pages found, return an empty task array
            if (!pages || !pages.length) {
                return this.dv.array([]) as DataArray<STask>;
            }

            // Create a flattened array of all tasks from all pages
            const allTasks = pages.flatMap(page => {
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
                    // Check if completion date exists and is in the same year and month
                    const hasCompletionMatch = task.completed &&
                        task.completion &&
                        MonthUtils.isDateInMonth(task.completion as DateTime, firstDay, lastDay);

                    // Check if due date exists and is in the same year and month
                    const hasDueMatch = task.due &&
                        MonthUtils.isDateInMonth(task.due as DateTime, firstDay, lastDay);

                    // Check if scheduled date exists and is in the same year and month
                    const hasScheduledMatch = task.scheduled &&
                        MonthUtils.isDateInMonth(task.scheduled as DateTime, firstDay, lastDay);

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
            return this.dv.array([]) as DataArray<STask>;
        }
    }
}