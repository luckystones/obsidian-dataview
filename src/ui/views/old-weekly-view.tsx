import { DataArray } from 'api/data-array';
import { DataviewApi } from 'api/plugin-api';
import { WeeklyTaskApi } from 'api/weekly-task-view';
import { SMarkdownPage, STask } from 'data-model/serialized/markdown';
import { Component } from 'obsidian';

export default class OldWeeklyView {
    private dv: DataviewApi;
    private component: Component;
    private container: HTMLElement;
    private TIMEZONE_OFFSET: number = 3;
    private weeklyTaskApi: WeeklyTaskApi;

    constructor(dv: DataviewApi, component: Component, container: HTMLElement) {
        this.dv = dv;
        this.component = component;
        this.container = container;
        this.weeklyTaskApi = new WeeklyTaskApi(dv);
    }

    public async getWeeklyTasks2() {
        console.log('GETTING WEEKLY TASKS ------- ')
        const pages = this.dv.pages() as unknown as DataArray<SMarkdownPage>;
        const currentPage = pages.find(p => p.file?.path === this.container.getAttribute('data-path'));
        const filename = currentPage?.file?.name;

        if (!filename) {
            throw new Error('Could not determine current file');
        }

        const result = await this.weeklyTaskApi.searchForTasksWithTag('"/game/objectives"', filename);
        const tasks = this.processTaskResults(result, filename);
        return this.renderWeeklyView(tasks);
    }

    private processTaskResults(result: DataArray<STask>, filename: string) {
        const groupedTasks: Record<string, STask[]> = {};
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        console.log('PROCESSING TASKS WITH NEW VERSION ------- ')
        result.forEach((task: STask) => {
            let referenceDate: Date | undefined;
            if (task.completion) {
                if (this.isDateInWeek(task.completion as number, filename)) {
                    referenceDate = new Date(task.completion as number);
                }
            } else if (task.scheduled) {
                if (this.isDateInWeek(task.scheduled as number, filename)) {
                    referenceDate = new Date(task.scheduled as number);
                }
            } else if (task.due) {
                if (this.isDateInWeek(task.due as number, filename)) {
                    referenceDate = new Date(task.due as number);
                }
            }

            if (referenceDate) {
                const dayOfWeek = days[referenceDate.getDay()];
                if (!groupedTasks[dayOfWeek]) {
                    groupedTasks[dayOfWeek] = [];
                }
                groupedTasks[dayOfWeek].push(task);
            }
        });

        return groupedTasks;
    }

    public renderWeeklyView(groupedTasks: Record<string, STask[]>) {
        const pages = this.dv.pages() as unknown as DataArray<SMarkdownPage>;
        const currentPage = pages.find(p => p.file?.path === this.container.getAttribute('data-path'));
        const filename = currentPage?.file?.name;

        if (!filename) {
            throw new Error('Could not determine current file');
        }

        const weekNumber = filename.split('W')[1];
        const year = filename.split('-')[0];

        const targetMonday = this.findMondayOfTheGivenWeek(Number(year), Number(weekNumber));

        const monday = new Date(targetMonday);
        const tuesday = new Date(targetMonday); tuesday.setDate(monday.getDate() + 1);
        const wednesday = new Date(targetMonday); wednesday.setDate(monday.getDate() + 2);
        const thursday = new Date(targetMonday); thursday.setDate(monday.getDate() + 3);
        const friday = new Date(targetMonday); friday.setDate(monday.getDate() + 4);
        const saturday = new Date(targetMonday); saturday.setDate(monday.getDate() + 5);
        const sunday = new Date(targetMonday); sunday.setDate(monday.getDate() + 6);

        // Create header elements
        const weekdaysHeader = this.container.createEl('h4');
        weekdaysHeader.textContent = "📅 Weekdays";

        // Create weekdays table
        const weekdaysHeaders = [
            `Mon (${monday.getDate()})`,
            `Tue (${tuesday.getDate()})`,
            `Wed (${wednesday.getDate()})`,
            `Thu (${thursday.getDate()})`,
            `Fri (${friday.getDate()})`
        ];

        const weekdaysValues = [
            this.dv.taskList(groupedTasks.Monday || [], false, this.container, this.component, filename),
            this.dv.taskList(groupedTasks.Tuesday || [], false, this.container, this.component, filename),
            this.dv.taskList(groupedTasks.Wednesday || [], false, this.container, this.component, filename),
            this.dv.taskList(groupedTasks.Thursday || [], false, this.container, this.component, filename),
            this.dv.taskList(groupedTasks.Friday || [], false, this.container, this.component, filename)
        ];

        this.dv.table(weekdaysHeaders, [weekdaysValues], this.container, this.component, filename);

        // Create weekend header
        const weekendHeader = this.container.createEl('h4');
        weekendHeader.textContent = "🌅 Weekend";

        // Create weekend table
        const weekendHeaders = [
            `Sat (${saturday.getDate()})`,
            `Sun (${sunday.getDate()})`
        ];

        const weekendValues = [
            this.dv.taskList(groupedTasks.Saturday || [], false, this.container, this.component, filename),
            this.dv.taskList(groupedTasks.Sunday || [], false, this.container, this.component, filename)
        ];

        this.dv.table(weekendHeaders, [weekendValues], this.container, this.component, filename);
    }

    public getWeeklyTime() {
        const birthDate = '1989-07-21';
        const currentDate = this.getLastDayOfWeek();
        const age = (currentDate.getTime() - new Date(birthDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        const ageNumber = Number(age.toFixed(2));

        const daysPassed = Math.floor((currentDate.getTime() - new Date(currentDate.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
        const weeksPassed = Math.floor(daysPassed / 7);

        // Create header elements
        const ageHeader = this.container.createEl('h3');
        ageHeader.textContent = '⏳ Age: ' + ageNumber;

        const daysHeader = this.container.createEl('h5');
        daysHeader.textContent = '📅 Days Passed: ' + daysPassed;

        const weeksHeader = this.container.createEl('h5');
        weeksHeader.textContent = '📆 Weeks Passed: ' + weeksPassed;
    }

    private getLastDayOfWeek(): Date {
        const pages = this.dv.pages() as unknown as DataArray<SMarkdownPage>;
        const currentPage = pages.find(p => p.file?.path === this.container.getAttribute('data-path'));
        const filename = currentPage?.file?.name;

        if (!filename) {
            throw new Error('Could not determine current file');
        }

        const weekNumber = filename.split('W')[1];
        const year = filename.split('-')[0];

        const date = new Date(Number(year), 0, 1);
        const dayOffset = (date.getDay() + 6) % 7;
        const firstMonday = new Date(date.setDate(date.getDate() + (1 - dayOffset + (Number(weekNumber) - 1) * 7)));
        const lastDay = new Date(firstMonday.setDate(firstMonday.getDate() + 6));
        return lastDay;
    }

    private findMondayOfTheGivenWeek(year: number, week: number): Date {
        // Create date at noon to avoid timezone issues
        const janFirst = new Date(year, 0, 1, this.TIMEZONE_OFFSET, 0, 0, 0);
        console.log('janFirst', janFirst);
        const daysToFirstMonday = (8 - janFirst.getDay()) % 7;
        console.log('daysToFirstMonday', daysToFirstMonday);
        const firstMondayOfYear = new Date(year, 0, 1 + daysToFirstMonday, this.TIMEZONE_OFFSET, 0, 0, 0);
        console.log('firstMondayOfYear', firstMondayOfYear);
        const targetMonday = new Date(firstMondayOfYear);
        targetMonday.setDate(firstMondayOfYear.getDate() + (week - 1) * 7);
        console.log('targetMonday', targetMonday);
        return targetMonday;
    }

    private findSundayOfTheGivenWeek(year: number, week: number): Date {
        const firstMonday = this.findMondayOfTheGivenWeek(year, week);
        const lastSunday = new Date(firstMonday);
        lastSunday.setDate(firstMonday.getDate() + 6);
        lastSunday.setHours(23, 59, 59, 999);
        return lastSunday;
    }

    private isDateInWeek(dateMillis: number, filename: string): boolean {
        const dueDate = new Date(dateMillis);
        const [year, week] = filename.split('-W').map(Number);
        const firstMonday = this.findMondayOfTheGivenWeek(year, week);
        const lastSunday = this.findSundayOfTheGivenWeek(year, week);
        console.log('dueDate', dueDate, 'firstMonday', firstMonday, 'lastSunday', lastSunday);
        console.log('dueDate >= firstMonday', dueDate >= firstMonday);
        console.log('dueDate <= lastSunday', dueDate <= lastSunday);
        return dueDate >= firstMonday && dueDate <= lastSunday;
    }
}