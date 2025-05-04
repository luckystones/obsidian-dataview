import { STask } from 'data-model/serialized/markdown';
import { Component } from 'obsidian';
import { DataviewApi } from './plugin-api';

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

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
}

export class WeeklyTaskApi {
    private dv: DataviewApi;

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
            tableView = true
        } = options;

        if (!component || !container) {
            throw new Error('Component and container are required for rendering tasks');
        }

        // Get the tasks
        const tasks = await this.getWeeklyTasks(year, week, searchPath);

        // Render them
        return tableView
            ? this.renderWeeklyTasksAsTable(tasks, filename, component, container)
            : this.renderWeeklyTasksAsList(tasks, filename, component, container);
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

    private renderWeeklyTasksAsTable(
        tasks: WeeklyTaskGroup,
        filename: string,
        component: Component,
        container: HTMLElement
    ): HTMLElement {
        // Create container for the weekly view
        const weeklyContainer = container.createEl('div', { cls: 'weekly-task-view' });

        // Get dates for the week
        const dates = this.getDatesForWeek(filename);

        // Create weekdays table
        const weekdaysContainer = weeklyContainer.createEl('div', { cls: 'weekdays-container' });
        const weekdaysHeader = weekdaysContainer.createEl('h4');
        weekdaysHeader.textContent = "📅 Week Overview";

        // Create headers array with dates
        const weekdayHeaders = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(
            day => `${day} (${dates[day as DayOfWeek].getDate()})`
        );

        // Create task cells array
        const weekdayTasks = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => {
            const taskContainer = createEl('div');
            this.dv.taskList(tasks[day as DayOfWeek], false, taskContainer, component, filename);
            return taskContainer;
        });

        // Render weekdays table
        this.dv.table(weekdayHeaders, [weekdayTasks], weekdaysContainer, component, filename);

        // Create weekend table
        const weekendContainer = weeklyContainer.createEl('div', { cls: 'weekend-container' });
        const weekendHeader = weekendContainer.createEl('h4');
        weekendHeader.textContent = "🌅 Weekend";

        // Create weekend headers with dates
        const weekendHeaders = ['Saturday', 'Sunday'].map(
            day => `${day} (${dates[day as DayOfWeek].getDate()})`
        );

        // Create weekend task cells
        const weekendTasks = ['Saturday', 'Sunday'].map(day => {
            const taskContainer = createEl('div');
            this.dv.taskList(tasks[day as DayOfWeek], false, taskContainer, component, filename);
            return taskContainer;
        });

        // Render weekend table
        this.dv.table(weekendHeaders, [weekendTasks], weekendContainer, component, filename);

        return weeklyContainer;
    }

    private renderWeeklyTasksAsList(
        tasks: WeeklyTaskGroup,
        filename: string,
        component: Component,
        container: HTMLElement
    ): HTMLElement {
        // Create container for the weekly view
        const weeklyContainer = container.createEl('div', { cls: 'weekly-task-view' });

        // Create weekdays section
        const weekdaysContainer = weeklyContainer.createEl('div', { cls: 'weekdays-container' });
        const weekdaysHeader = weekdaysContainer.createEl('h4');
        weekdaysHeader.textContent = "📅 Weekdays";

        // Get dates for the week
        const dates = this.getDatesForWeek(filename);

        // Render weekdays
        const weekdays: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        weekdays.forEach(day => {
            const dayContainer = weekdaysContainer.createEl('div', { cls: 'day-container' });
            const dayHeader = dayContainer.createEl('h5');
            dayHeader.textContent = `${day} (${dates[day].getDate()})`;

            // Render tasks for this day using Dataview's taskList
            this.dv.taskList(tasks[day], false, dayContainer, component, filename);
        });

        // Create weekend section
        const weekendContainer = weeklyContainer.createEl('div', { cls: 'weekend-container' });
        const weekendHeader = weekendContainer.createEl('h4');
        weekendHeader.textContent = "🌅 Weekend";

        // Render weekend days
        const weekendDays: DayOfWeek[] = ['Saturday', 'Sunday'];
        weekendDays.forEach(day => {
            const dayContainer = weekendContainer.createEl('div', { cls: 'day-container' });
            const dayHeader = dayContainer.createEl('h5');
            dayHeader.textContent = `${day} (${dates[day].getDate()})`;

            // Render tasks for this day using Dataview's taskList
            this.dv.taskList(tasks[day], false, dayContainer, component, filename);
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
} 