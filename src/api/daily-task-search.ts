import { STask } from 'data-model/serialized/markdown';
import { Component, Notice } from 'obsidian';
import { DataArray } from './data-array';
import { DataviewApi } from './plugin-api';
import { DateTime } from 'luxon';
import { DayUtils } from './DayUtils';
import { DailyView } from '../ui/views/daily-view';

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

export interface DailyTaskOptions {
    /** The year to get tasks for */
    year?: number;
    /** The month to get tasks for (1-12) */
    month?: number;
    /** The day to get tasks for (1-31) */
    day?: number;
    /** The path to search for tasks in. Defaults to "/" (root) */
    searchPath?: string;
    /** The filename to use for rendering (format: YYYY-MM-DD). If not provided, will be generated from year, month, and day */
    filename?: string;
    /** The component to use for rendering. Required for rendering tasks. */
    component?: Component;
    /** The container to render tasks in. Required for rendering tasks. */
    container?: HTMLElement;
    /** Whether to show only the task description (true) or the full task text (false). Defaults to true. */
    trimTaskText?: boolean;
}

export class DailyTaskApi {
    private dv: DataviewApi;
    private dailyView: DailyView;

    constructor(dv: DataviewApi) {
        this.dv = dv;
        this.dailyView = new DailyView(dv);
    }

    /**
     * Gets the filename from options or determines it from the active file
     * @param options Options containing year, month, day, and optional filename
     * @returns The filename in YYYY-MM-DD format
     */
    private getFilenameFromOptions(options: DailyTaskOptions): string {
        const { year, month, day, filename: optionsFilename } = options;

        // If filename is provided in options, use it
        if (optionsFilename) {
            return optionsFilename;
        }

        // If year, month, and day are provided, use them to create the filename
        if (year !== undefined && month !== undefined && day !== undefined) {
            const paddedDay = String(day).padStart(2, '0');
            const paddedMonth = String(month).padStart(2, '0');
            return `${year}-${paddedMonth}-${paddedDay}`;
        }

        // Otherwise try to get active file name
        const activeFileName = this.dv.app.workspace.getActiveFile()?.name;
        if (!activeFileName) {
            throw new Error('Could not determine current file and no year/month/day provided');
        }
        console.log('activeFileName', activeFileName);

        return activeFileName;
    }

    /**
     * Gets and renders daily tasks in one operation
     * @param options The options for getting and rendering daily tasks
     * @returns The container element with the rendered tasks
     */
    public async getAndRenderDailyTasks(options: DailyTaskOptions): Promise<HTMLElement> {
        const {
            searchPath = '"game/objectives"',
            trimTaskText = true,
            component,
            container,
        } = options;

        if (!component || !container) {
            throw new Error('Component and container are required for rendering tasks');
        }

        // Get filename using the extracted method
        const filename = this.getFilenameFromOptions(options);

        const result = this.searchForTasksWithDate(searchPath, filename);
        const tasks = result.array();

        // If trimTaskText is true, update each task's text to show only the description
        if (trimTaskText) {
            tasks.forEach((task: STask) => {
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
        }

        // Render using the DailyView with filters
        const dailyContainer = await this.dailyView.renderDailyTasks(tasks, filename, component, container);

        return dailyContainer;
    }

    /**
     * Gets daily tasks for a specific date
     * @param year The year
     * @param month The month (1-12)
     * @param day The day of the month
     * @param searchPath The path to search for tasks in. Defaults to "/"
     * @returns An array of tasks for the specified day 
     */
    public async getDailyTasks(year: number, month: number, day: number, searchPath: string = "/"): Promise<STask[]> {
        try {
            const query = `TASK
                WHERE (completed AND completion >= date(${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}) AND completion < date(${year}-${String(month).padStart(2, '0')}-${String(day + 1).padStart(2, '0')})) 
                OR (due >= date(${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}) AND due < date(${year}-${String(month).padStart(2, '0')}-${String(day + 1).padStart(2, '0')})) 
                OR (scheduled >= date(${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}) AND scheduled < date(${year}-${String(month).padStart(2, '0')}-${String(day + 1).padStart(2, '0')}))`;
            console.log('query', query);

            const result = await this.dv.query(query);
            if (!result.successful) {
                throw new Error(result.error);
            }

            const tasks = result.value.values as STask[];
            return tasks;
        } catch (e) {
            throw new Error(`Failed to get daily tasks: ${e.message}`);
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
     * Searches for tasks with a specific date in the given path
     * @param searchpath The path to search for tasks in
     * @param filename The current filename (in format YYYY-MM-DD)
     * @returns An array of tasks matching the criteria
     */
    private parseYearMonthDayFromFilename(filename: string): { year: number, month: number, day: number } | undefined {
        return DayUtils.parseYearMonthDayFromFilename(filename);
    }

    public searchForTasksWithDate(searchpath: string, filename: string): DataArray<STask> {
        try {
            // Parse year, month, and day from filename
            const dateInfo = this.parseYearMonthDayFromFilename(filename);
            console.log('dateInfo', dateInfo);

            if (!dateInfo) {
                return this.dv.array([]) as DataArray<STask>;
            }

            const { year, month, day } = dateInfo;
            const basicSearch = this.dv.pages(searchpath);

            // If no pages found, return an empty task array
            if (!basicSearch || !basicSearch.length) {
                console.log('no pages found');
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
                    // Ignore cancelled tasks (tasks with status "-")
                    if (task.status === "-") {
                        return false;
                    }

                    // Get the date range for the specified day
                    const { startOfDay, endOfDay } = DayUtils.getDayDateRange(year, month, day);

                    // If task is completed
                    if (task.completed) {
                        // Only show if it has a completion date AND was completed on this specific day
                        if (task.completion) {
                            return DayUtils.isDateInDay(task.completion as DateTime, startOfDay, endOfDay);
                        }
                        // Ignore completed tasks without a completion date
                        return false;
                    }

                    // For uncompleted tasks, show if due or scheduled on or before this day
                    const hasDueBeforeOrEqual = task.due &&
                        DayUtils.isDateBeforeOrEqual(task.due as DateTime, endOfDay);

                    const hasScheduledBeforeOrEqual = task.scheduled &&
                        DayUtils.isDateBeforeOrEqual(task.scheduled as DateTime, endOfDay);

                    // Return true if any of the date criteria match
                    return !!(hasDueBeforeOrEqual || hasScheduledBeforeOrEqual);
                } catch (e) {
                    console.error('Error processing task:', task.text, e);
                    return false;
                }
            });

            return taskSearch;
        } catch (e) {
            console.error('Error in searchForTasksWithDate:', e);
            new Notice(
                'Invalid Dataview query: ' + String(e)
            );
            return this.dv.array([]) as DataArray<STask>;
        }
    }
}

