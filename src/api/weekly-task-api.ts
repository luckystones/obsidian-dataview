import { STask } from 'data-model/serialized/markdown';
import { Component } from 'obsidian';
import { DataviewApi } from './plugin-api';

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
            searchPath = "/",
            filename = `${year}-W${week}`,
            component,
            container,
            tableView = true,
            trimTaskText = true
        } = options;

        if (!component || !container) {
            throw new Error('Component and container are required for rendering tasks');
        }

        // Get the tasks
        const tasks = await this.getWeeklyTasks(year, week, searchPath);

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
        const result = tableView
            ? this.renderWeeklyTasksAsTable(tasks, filename, component, container)
            : this.renderWeeklyTasksAsList(tasks, filename, component, container);

        // Ensure styles are applied
        this.reloadStyles();

        return result;
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
            dayHeader.textContent = `${day} (${dates[day].getDate()})`;
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
            dayHeader.textContent = `${day} (${dates[day].getDate()})`;
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
        const [year, weekNumber] = filename.split('-W').map(Number);
        const firstMonday = this.findFirstMonday(year, weekNumber);

        return {
            Monday: new Date(firstMonday),
            Tuesday: new Date(firstMonday.getTime() + 24 * 60 * 60 * 1000),
            Wednesday: new Date(firstMonday.getTime() + 2 * 24 * 60 * 60 * 1000),
            Thursday: new Date(firstMonday.getTime() + 3 * 24 * 60 * 60 * 1000),
            Friday: new Date(firstMonday.getTime() + 4 * 24 * 60 * 60 * 1000),
            Saturday: new Date(firstMonday.getTime() + 5 * 24 * 60 * 60 * 1000),
            Sunday: new Date(firstMonday.getTime() + 6 * 24 * 60 * 60 * 1000)
        };
    }

    private findFirstMonday(year: number, week: number): Date {
        const janFirst = new Date(year, 0, 1);
        const daysToFirstMonday = (8 - janFirst.getDay()) % 7;
        const firstMondayOfYear = new Date(year, 0, 1 + daysToFirstMonday);
        const targetMonday = new Date(firstMondayOfYear);
        targetMonday.setDate(firstMondayOfYear.getDate() + (week - 1) * 7);
        return targetMonday;
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
} 