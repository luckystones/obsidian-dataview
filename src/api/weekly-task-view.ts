import { STask } from 'data-model/serialized/markdown';
import { Component, Notice } from 'obsidian';
import { DataArray } from './data-array';
import { DataviewApi } from './plugin-api';
import { DateTime } from 'luxon';

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
    private weekendColor = '#9C89B8'; // A calm lavender/purple color

    constructor(dv: DataviewApi) {
        this.dv = dv;
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
            tableView = true,
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

        console.log('SEARCH PATH ------- ', searchPath, 'FILENAME ------- ', filename);
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

        // Render them
        const result2 = tableView
            ? this.renderWeeklyTasksAsTable(tasks, filename, component, container)
            : this.renderWeeklyTasksAsList(tasks, filename, component, container);

        // Ensure styles are applied
        this.reloadStyles();

        return result2;
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

    /**
     * Force reload the CSS styles to ensure they're applied
     */
    private reloadStyles() {
        // Get all style elements
        const styleElements = document.querySelectorAll('style');

        // Find the dataview style element or the obsidian app style
        let styleElement: HTMLStyleElement | null = null;
        for (let i = 0; i < styleElements.length; i++) {
            const el = styleElements[i] as HTMLStyleElement;
            if (el.innerHTML.includes('dataview') || el.innerHTML.includes('.weekly-task-view')) {
                styleElement = el;
                break;
            }
        }

        if (styleElement) {
            // Save the current CSS
            const css = styleElement.innerHTML;

            // Force a re-render by changing the content
            styleElement.innerHTML = '';
            setTimeout(() => {
                if (styleElement) styleElement.innerHTML = css;

                // Add inline styles to ensure visibility
                const tables = document.querySelectorAll('.dataview.table-view-table');
                tables.forEach(table => {
                    const headers = table.querySelectorAll('th');
                    headers.forEach((header, index) => {
                        // const day = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][index % 7];
                        (header as HTMLElement).setAttribute('style', `color: var(--color-monday) !important; border-bottom: 3px solid var(--color-monday) !important; font-weight: bold !important;`);
                    });
                });
            }, 10);
        }
    }

    public async getWeeklyTasks(year: number, week: number, searchPath: string = "/"): Promise<WeeklyTaskGroup> {
        console.log('GETTING WEEKLY TASKS API one------- ')
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

    private renderWeeklyTasksAsTable(
        tasks: WeeklyTaskGroup,
        filename: string,
        component: Component,
        container: HTMLElement
    ): HTMLElement {
        // Create container for the weekly view
        const weeklyContainer = container.createEl('div');
        weeklyContainer.setAttribute('style', 'margin: 1em 0; padding: 10px; border-radius: 6px;');

        // Get dates for the week
        const dates = this.getDatesForWeek(filename);
        console.log('DATES ------- ', dates);

        // Render weekdays section
        const weekdays: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        this.renderWeekdaysTable(tasks, dates, weekdays, weeklyContainer, component, filename);

        // Render weekend section
        const weekendDays: DayOfWeek[] = ['Saturday', 'Sunday'];
        this.renderWeekendTable(tasks, dates, weekendDays, weeklyContainer, component, filename);

        return weeklyContainer;
    }

    /**
     * Renders the weekdays (Monday-Friday) table
     */
    private renderWeekdaysTable(
        tasks: WeeklyTaskGroup,
        dates: Record<DayOfWeek, Date>,
        weekdays: DayOfWeek[],
        parentContainer: HTMLElement,
        component: Component,
        filename: string
    ): void {
        // Create weekdays table container
        const weekdaysContainer = parentContainer.createEl('div');

        // Add header


        // Create headers with dates
        const weekdayHeaders = weekdays.map(day => {
            return `<span style="color: #5899D6; font-weight: bold; display: block; padding: 4px;">${day} (${dates[day].getDate()})</span>`;
        });

        // Create task cells
        const weekdayTasks = weekdays.map(day => {
            const taskContainer = createEl('div');
            this.dv.taskList(tasks[day], false, taskContainer, component, filename);
            this.styleCompletedTasks(taskContainer);
            return taskContainer;
        });

        // Render weekdays table
        this.dv.table(weekdayHeaders, [weekdayTasks], weekdaysContainer, component, filename);

        // Style the table
        this.styleTable(weekdaysContainer, '#5899D6');
    }

    /**
     * Renders the weekend (Saturday-Sunday) table
     */
    private renderWeekendTable(
        tasks: WeeklyTaskGroup,
        dates: Record<DayOfWeek, Date>,
        weekendDays: DayOfWeek[],
        parentContainer: HTMLElement,
        component: Component,
        filename: string
    ): void {
        // Create weekend table container
        const weekendContainer = parentContainer.createEl('div');


        // Create headers with dates
        const weekendHeaders = weekendDays.map(day => {
            return `<span style="color: ${this.weekendColor}; font-weight: bold; display: block; padding: 4px;">${day} (${dates[day].getDate()})</span>`;
        });

        // Create task cells
        const weekendTasks = weekendDays.map(day => {
            const taskContainer = createEl('div');
            this.dv.taskList(tasks[day], false, taskContainer, component, filename);
            this.styleCompletedTasks(taskContainer);
            return taskContainer;
        });

        // Render weekend table
        this.dv.table(weekendHeaders, [weekendTasks], weekendContainer, component, filename);

        // Style the table
        this.styleTable(weekendContainer, this.weekendColor);
    }

    /**
     * Applies styling to completed tasks
     */
    private styleCompletedTasks(container: HTMLElement): void {
        setTimeout(() => {
            const checkboxes = container.querySelectorAll('.task-list-item-checkbox:checked');
            checkboxes.forEach(checkbox => {
                const textEl = checkbox.closest('.task-list-item');
                if (textEl) {
                    textEl.setAttribute('style', 'color: #3faf78 !important; text-decoration: line-through;');
                }
                checkbox.setAttribute('style', 'background-color: #3faf78 !important; border-color: #3faf78 !important;');
            });
        }, 10);
    }

    /**
     * Applies styling to table elements
     */
    private styleTable(container: HTMLElement, headerColor: string): void {
        setTimeout(() => {
            const table = container.querySelector('.dataview.table-view-table');
            if (table) {
                table.setAttribute('style', 'width: 100%; border-collapse: collapse; border: none;');

                // Style headers
                const headerRow = table.querySelector('thead tr');
                if (headerRow) {
                    headerRow.setAttribute('style', `background-color: ${this.getHeaderBgColor(headerColor)}; border-radius: 4px;`);
                }

                const headers = table.querySelectorAll('th');
                headers.forEach(header => {
                    header.setAttribute('style', `color: ${headerColor}; border-bottom: 2px solid ${headerColor}; font-weight: bold; padding: 8px; text-align: left; background-color: ${this.getHeaderBgColor(headerColor)};`);
                });

                // Style cells - removing borders
                const cells = table.querySelectorAll('td');
                cells.forEach(cell => {
                    cell.setAttribute('style', 'padding: 8px; vertical-align: top; border: none;');

                    // Remove border from task list containers
                    const taskContainers = cell.querySelectorAll('.contains-task-list');
                    taskContainers.forEach(taskContainer => {
                        taskContainer.setAttribute('style', 'border: none; padding: 0; margin: 0;');
                    });
                });
            }
        }, 10);
    }

    /**
     * Get a light background color based on the header color
     */
    private getHeaderBgColor(headerColor: string): string {
        // For blue headers (#5899D6) - light blue background
        if (headerColor === '#5899D6') {
            return 'rgba(88, 153, 214, 0.1)';
        }
        // For lavender headers (#9C89B8) - light lavender background
        else if (headerColor === this.weekendColor) {
            return 'rgba(156, 137, 184, 0.1)';
        }
        // Default fallback - convert hex to rgba with 0.1 opacity
        return this.hexToRgba(headerColor, 0.1);
    }

    /**
     * Convert hex color to rgba with specified opacity
     */
    private hexToRgba(hex: string, alpha: number): string {
        // Remove the hash
        hex = hex.replace('#', '');

        // Parse the hex values
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        // Return rgba color
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    private renderWeeklyTasksAsList(
        tasks: WeeklyTaskGroup,
        filename: string,
        component: Component,
        container: HTMLElement
    ): HTMLElement {
        // Create container for the weekly view
        const weeklyContainer = container.createEl('div');
        weeklyContainer.setAttribute('style', 'margin: 1em 0; padding: 10px; border-radius: 6px;');

        // Create weekdays section
        const weekdaysContainer = weeklyContainer.createEl('div');
        const weekdaysHeader = weekdaysContainer.createEl('h4');
        weekdaysHeader.textContent = "📅 Weekdays";
        weekdaysHeader.setAttribute('style', 'margin-top: 15px; margin-bottom: 10px; padding: 5px; background-color: rgba(88, 153, 214, 0.1); border-radius: 4px;');

        // Get dates for the week
        const dates = this.getDatesForWeek(filename);

        // Render weekdays
        const weekdays: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        weekdays.forEach(day => {
            const dayContainer = weekdaysContainer.createEl('div');
            dayContainer.setAttribute('style', 'margin: 0.5em 0;');

            const dayHeader = dayContainer.createEl('h5');
            const date = dates[day];
            const formattedDate = isNaN(date.getTime()) ? '?' : date.getDate().toString();
            dayHeader.textContent = `${day} (${formattedDate})`;
            dayHeader.setAttribute('style', 'color: #5899D6; border-bottom: 2px solid #5899D6; font-weight: bold; padding: 6px; margin-bottom: 10px; background-color: rgba(88, 153, 214, 0.05); border-radius: 4px;');

            // Render tasks for this day using Dataview's taskList
            this.dv.taskList(tasks[day], false, dayContainer, component, filename);

            // Apply styles to completed tasks and remove borders
            setTimeout(() => {
                // Style completed tasks
                const checkboxes = dayContainer.querySelectorAll('.task-list-item-checkbox:checked');
                checkboxes.forEach(checkbox => {
                    const textEl = checkbox.closest('.task-list-item');
                    if (textEl) {
                        textEl.setAttribute('style', 'color: #3faf78 !important; text-decoration: line-through;');
                    }
                    checkbox.setAttribute('style', 'background-color: #3faf78 !important; border-color: #3faf78 !important;');
                });

                // Remove borders from task lists
                const taskLists = dayContainer.querySelectorAll('.contains-task-list');
                taskLists.forEach(list => {
                    list.setAttribute('style', 'border: none; padding: 0; margin: 0;');
                });
            }, 10);
        });

        // Create weekend section
        const weekendContainer = weeklyContainer.createEl('div');
        const weekendHeader = weekendContainer.createEl('h4');
        weekendHeader.textContent = "🌅 Weekend";
        weekendHeader.setAttribute('style', `margin-top: 15px; margin-bottom: 10px; padding: 5px; background-color: ${this.getHeaderBgColor(this.weekendColor)}; border-radius: 4px;`);

        // Render weekend days
        const weekendDays: DayOfWeek[] = ['Saturday', 'Sunday'];
        weekendDays.forEach(day => {
            const dayContainer = weekendContainer.createEl('div');
            dayContainer.setAttribute('style', 'margin: 0.5em 0;');

            const dayHeader = dayContainer.createEl('h5');
            const date = dates[day];
            const formattedDate = isNaN(date.getTime()) ? '?' : date.getDate().toString();
            dayHeader.textContent = `${day} (${formattedDate})`;
            dayHeader.setAttribute('style', `color: ${this.weekendColor}; border-bottom: 2px solid ${this.weekendColor}; font-weight: bold; padding: 6px; margin-bottom: 10px; background-color: ${this.getHeaderBgColor(this.weekendColor).replace('0.1', '0.05')}; border-radius: 4px;`);

            // Render tasks for this day using Dataview's taskList
            this.dv.taskList(tasks[day], false, dayContainer, component, filename);

            // Apply styles to completed tasks and remove borders
            setTimeout(() => {
                // Style completed tasks
                const checkboxes = dayContainer.querySelectorAll('.task-list-item-checkbox:checked');
                checkboxes.forEach(checkbox => {
                    const textEl = checkbox.closest('.task-list-item');
                    if (textEl) {
                        textEl.setAttribute('style', 'color: #3faf78 !important; text-decoration: line-through;');
                    }
                    checkbox.setAttribute('style', 'background-color: #3faf78 !important; border-color: #3faf78 !important;');
                });

                // Remove borders from task lists
                const taskLists = dayContainer.querySelectorAll('.contains-task-list');
                taskLists.forEach(list => {
                    list.setAttribute('style', 'border: none; padding: 0; margin: 0;');
                });
            }, 10);
        });

        return weeklyContainer;
    }

    private getDatesForWeek(filename: string): Record<DayOfWeek, Date> {
        const weekNumber = filename.split('W')[1];
        const year = filename.split('-')[0];
        console.log('YEAR ------- ', year);
        console.log('WEEK NUMBER ------- ', weekNumber);
        const monday = this.findFirstMonday(parseInt(year), parseInt(weekNumber));
        const tuesday = new Date(monday);
        tuesday.setDate(tuesday.getDate() + 1);
        const wednesday = new Date(monday);
        wednesday.setDate(wednesday.getDate() + 2);
        const thursday = new Date(monday);
        thursday.setDate(thursday.getDate() + 3);
        const friday = new Date(monday);
        friday.setDate(friday.getDate() + 4);
        const saturday = new Date(monday);
        saturday.setDate(saturday.getDate() + 5);
        const sunday = new Date(monday);
        sunday.setDate(sunday.getDate() + 6);
        return {
            Monday: monday,
            Tuesday: tuesday,
            Wednesday: wednesday,
            Thursday: thursday,
            Friday: friday,
            Saturday: saturday,
            Sunday: sunday
        };
    }

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

            console.log('Searching for tasks in year:', year, 'week:', week);

            // Get pages from the given search path
            const basicSearch = this.dv.pages('"game/objectives"');

            console.log('BASIC SEARCH ------- ', basicSearch);
            // If no pages found, return an empty task array
            if (!basicSearch || !basicSearch.length) {
                console.log('NO PAGES FOUND ------- ');
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
                console.log('NO TASKS FOUND ------- ');
                return [];
            }) as DataArray<STask>;

            console.log('Found', allTasks.length, 'total tasks');

            // Filter tasks based on date criteria
            const taskSearch = allTasks.where((task: STask): boolean => {
                try {

                    const hasCompletionMatch = task.completed &&
                        task.completion &&
                        this.isDateInWeek(task.completion as DateTime, parseInt(year), week);

                    // Check if due date exists and is in the same year and week
                    const hasDueMatch = task.due &&
                        this.isDateInWeek(task.due as DateTime, parseInt(year), week);

                    // Check if scheduled date exists and is in the same year and week
                    const hasScheduledMatch = task.scheduled &&
                        this.isDateInWeek(task.scheduled as DateTime, parseInt(year), week);

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
     * Checks if a date falls within the specified week of the year
     * @param toBeCheckedDate The date in milliseconds to check
     * @param year The year to check against
     * @param week The week number to check against
     * @returns True if the date is in the specified week, false otherwise
     */
    private isDateInWeek(toBeCheckedDate: DateTime | number, year: number, week: number): boolean {
        try {
            if (!year || !week) {
                console.error('Invalid year or week parameters:', year, week);
                return false;
            }

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

            // Get date range for the specified week
            try {
                const firstMonday = this.findFirstMonday(year, week);

                if (isNaN(firstMonday.getTime())) {
                    console.error('Invalid first Monday for year/week:', year, week);
                    return false;
                }

                const lastSunday = new Date(firstMonday);
                lastSunday.setDate(firstMonday.getDate() + 6);
                lastSunday.setHours(23, 59, 59, 999);

                return dueDate >= firstMonday && dueDate <= lastSunday;
            } catch (e) {
                console.error('Error calculating week range:', e);
                return false;
            }
        } catch (e) {
            console.error('Error in isDateInWeek:', e);
            return false;
        }
    }
} 