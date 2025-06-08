import { STask } from 'data-model/serialized/markdown';
import { Component } from 'obsidian';
import { DataviewApi } from '../../api/plugin-api';
import { DayOfWeek, WeeklyTaskGroup } from '../../api/weekly-task-search';

interface TaskStatistic {
    name: string;
    todo: number;
    done: number;
    score: string;
    level: string;
    color: string;
}

export class WeeklyView {
    private dv: DataviewApi;
    private weekendColor = '#9C89B8'; // A calm lavender/purple color
    private chartColors = [
        '#FF6B6B', '#FF9E7A', '#FFBF86', '#FFE66D',
        '#8AFF80', '#80FFEA', '#80D8FF', '#9580FF',
        '#FF80BF', '#FF8095', '#B6FFDB', '#DBFFB6'
    ];

    constructor(dv: DataviewApi) {
        this.dv = dv;
    }

    /**
     * Renders weekly tasks as a table
     */
    public renderWeeklyTasksAsTable(
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
        // Create statistics section
        this.renderStats(tasks, filename, weeklyContainer);

        return weeklyContainer;
    }

    /**
     * Renders task statistics as a pie chart
     */
    private renderStats(
        tasks: WeeklyTaskGroup,
        filename: string,
        container: HTMLElement
    ): void {
        // Create container for statistics
        const statsContainer = container.createEl('div');
        statsContainer.setAttribute('style', 'margin: 1em auto 2em; display: flex; justify-content: center; align-items: center;');

        // Aggregate all tasks
        const allTasks: STask[] = [];
        Object.values(tasks).forEach(dayTasks => {
            allTasks.push(...dayTasks);
        });

        if (allTasks.length === 0) {
            return; // Skip if no tasks
        }

        // Group tasks by filename
        const tasksByFile: Record<string, STask[]> = {};
        allTasks.forEach(task => {
            const file = task.path.split('/').pop() || 'Unknown';
            if (!tasksByFile[file]) {
                tasksByFile[file] = [];
            }
            tasksByFile[file].push(task);
        });

        // Collect statistics
        const objectives: TaskStatistic[] = [];
        let index = 0;

        for (const [file, fileTasks] of Object.entries(tasksByFile)) {
            let todo = 0;
            let done = 0;

            // Count todo and done tasks
            fileTasks.forEach((task: STask) => {
                if (task.completed) {
                    done++;
                } else {
                    todo++;
                }
            });

            // Calculate completion percentage
            const total = todo + done;
            const score = total > 0 ? (done * 100 / total) : 0;

            // Assign a color from our palette
            const color = this.chartColors[index % this.chartColors.length];

            objectives.push({
                name: file,
                todo: todo,
                done: done,
                score: score.toFixed(0),
                level: (done / 20).toFixed(0),
                color: color
            });

            index++;
        }

        // Create pie chart
        this.createPieChart(objectives, statsContainer);
    }

    /**
     * Creates a pie chart visualizing task statistics
     */
    private createPieChart(
        objectives: TaskStatistic[],
        container: HTMLElement
    ): void {
        // Create flex container for chart and summary
        const flexContainer = container.createEl('div');
        flexContainer.setAttribute('style', 'display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 20px;');

        // Create chart container
        const chartContainer = flexContainer.createEl('div');
        chartContainer.setAttribute('style', 'width: 280px; height: 280px; position: relative;');

        // Create summary container
        const summaryContainer = flexContainer.createEl('div');
        summaryContainer.setAttribute('style', 'min-width: 200px; max-width: 250px;');

        // Calculate total tasks for percentage
        const totalTasks = objectives.reduce((sum, obj) => sum + obj.todo + obj.done, 0);
        if (totalTasks === 0) return;

        // Generate conic gradient for pie chart
        let startAngle = 0;
        let gradientString = '';

        objectives.forEach((obj) => {
            const segmentSize = ((obj.todo + obj.done) / totalTasks) * 100;
            const endAngle = startAngle + segmentSize;

            gradientString += `${obj.color} ${startAngle}%, ${obj.color} ${endAngle}%, `;
            startAngle = endAngle;
        });

        // Remove trailing comma and space
        gradientString = gradientString.slice(0, -2);

        // Create main pie chart
        const pieChart = chartContainer.createEl('div');
        pieChart.setAttribute('style', `
            position: absolute;
            top: 20px;
            left: 20px;
            width: 240px;
            height: 240px;
            border-radius: 50%;
            background: conic-gradient(${gradientString});
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 2;
        `);

        // Create center circle (donut hole)
        const centerCircle = pieChart.createEl('div');
        centerCircle.setAttribute('style', `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 100px;
            height: 100px;
            border-radius: 50%;
            background: rgba(22, 33, 51, 0.95);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            color: #f8fafc;
            z-index: 4;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.3);
        `);

        // Display total tasks
        const totalDisplay = centerCircle.createEl('div');
        totalDisplay.textContent = totalTasks.toString();
        totalDisplay.setAttribute('style', `
            font-size: 38px;
            font-weight: 700;
            line-height: 1;
            background: linear-gradient(90deg, #60A5FA, #818CF8);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-fill-color: transparent;
            margin-bottom: -2px;
        `);

        // "Tasks" label
        const tasksLabel = centerCircle.createEl('div');
        tasksLabel.textContent = 'tasks';
        tasksLabel.setAttribute('style', 'font-size: 14px; opacity: 0.8;');

        // Add completion rate
        const doneCount = objectives.reduce((sum, obj) => sum + obj.done, 0);
        const completionRate = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0;

        const completionDisplay = centerCircle.createEl('div');
        completionDisplay.textContent = `${completionRate}% done`;
        completionDisplay.setAttribute('style', `
            font-size: 12px;
            margin-top: 5px;
            color: ${completionRate > 50 ? '#50C878' : '#FF6B6B'};
            font-weight: 600;
        `);

        // Create task summary table
        const summaryTable = summaryContainer.createEl('div');
        summaryTable.setAttribute('style', `
            background: rgba(22, 33, 51, 0.7);
            border-radius: 8px;
            padding: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        `);

        // Add table header
        const tableHeader = summaryTable.createEl('div');
        tableHeader.setAttribute('style', `
            display: grid;
            grid-template-columns: minmax(100px, auto) 70px;
            padding-bottom: 8px;
            margin-bottom: 8px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
            font-weight: 600;
            font-size: 13px;
            color: #f8fafc;
        `);

        const fileHeaderCell = tableHeader.createEl('div');
        fileHeaderCell.textContent = 'File';
        fileHeaderCell.setAttribute('style', 'padding: 4px 8px;');

        const statsHeaderCell = tableHeader.createEl('div');
        statsHeaderCell.textContent = 'Tasks';
        statsHeaderCell.setAttribute('style', 'padding: 4px 8px; text-align: right;');

        // Sort objectives by total task count (descending)
        objectives.sort((a, b) => (b.done + b.todo) - (a.done + a.todo));

        // Add rows for each file
        objectives.forEach((obj) => {
            const total = obj.done + obj.todo;
            if (total === 0) return;

            const row = summaryTable.createEl('div');
            row.setAttribute('style', `
                display: grid;
                grid-template-columns: minmax(100px, auto) 70px;
                font-size: 12px;
                margin-bottom: 4px;
                padding: 4px 0;
                border-radius: 4px;
                color: #f8fafc;
            `);

            // Create color indicator
            const fileCell = row.createEl('div');
            fileCell.setAttribute('style', 'display: flex; align-items: center; gap: 6px; padding: 4px 8px;');

            const colorIndicator = fileCell.createEl('div');
            colorIndicator.setAttribute('style', `
                width: 12px;
                height: 12px;
                background-color: ${obj.color};
                border-radius: 3px;
            `);

            const fileName = fileCell.createEl('div');
            fileName.textContent = obj.name.length > 15 ? obj.name.substring(0, 15) + '...' : obj.name;
            fileName.setAttribute('style', 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;');

            // Create task count with completion percentage
            const statsCell = row.createEl('div');
            statsCell.setAttribute('style', 'padding: 4px 8px; text-align: right; display: flex; justify-content: flex-end; align-items: center; gap: 6px;');

            const percentage = Math.round((obj.done / total) * 100);

            const miniProgress = statsCell.createEl('div');
            miniProgress.setAttribute('style', `
                width: 24px;
                height: 4px;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 2px;
                overflow: hidden;
                position: relative;
            `);

            const progressFill = miniProgress.createEl('div');
            progressFill.setAttribute('style', `
                position: absolute;
                top: 0;
                left: 0;
                height: 100%;
                width: ${percentage}%;
                background-color: ${percentage > 50 ? '#50C878' : '#FF6B6B'};
                border-radius: 2px;
            `);

            const taskCount = statsCell.createEl('div');
            taskCount.innerHTML = `<span style="color: #50C878;">${obj.done}</span>/<span style="color: #FF6B6B;">${total}</span>`;
        });

        // Add filename labels inside segments to help identify them in the chart
        startAngle = 0;
        objectives.forEach((obj) => {
            const segmentSize = ((obj.todo + obj.done) / totalTasks) * 100;
            if (segmentSize < 8) {
                startAngle += segmentSize;
                return; // Skip very small segments
            }

            const endAngle = startAngle + segmentSize;
            const midAngle = startAngle + (segmentSize / 2);

            // Create a container for the segment text that will be rotated to align with the segment
            const segmentTextContainer = chartContainer.createEl('div');
            segmentTextContainer.setAttribute('style', `
                position: absolute;
                top: 50%;
                left: 50%;
                width: 120px;
                height: 50px;
                transform-origin: left center;
                transform: translate(0, -50%) rotate(${midAngle / 100 * 360}deg);
                z-index: 3;
                pointer-events: none;
            `);

            // Calculate the segment width at different distances from center
            const segmentWidthDegrees = segmentSize / 100 * 360;
            // Only create radial text if segment is wide enough
            if (segmentWidthDegrees >= 20) {
                // Create the filename element
                const filenameEl = segmentTextContainer.createEl('div');
                filenameEl.setAttribute('style', `
                    position: absolute;
                    top: 0;
                    left: 60px;
                    transform: rotate(-${midAngle / 100 * 360}deg);
                    color: #fff;
                    font-size: 11px;
                    font-weight: 600;
                    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
                    text-align: left;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 80px;
                `);
                filenameEl.textContent = obj.name.substring(0, 12) + (obj.name.length > 12 ? '...' : '');
            }

            startAngle = endAngle;
        });
    }


    /**
     * Calculates and displays age and time indicators based on the given filename and a static birth date
     * @param filename The filename in YYYY-WW format
     * @param container The container to render the indicators in
     * @param component The component to use for rendering
     * @returns The container with the rendered indicators
     */
    public renderWeeklyTime(
        filename: string,
        container: HTMLElement,
        component: Component
    ): HTMLElement {
        // Create a container for the age indicators
        console.log("🐞🐞🐞 calling age indicator")
        const timeContainer = container.createEl('div');
        timeContainer.setAttribute('style', 'margin: 2em auto; width: 260px; height: 260px; position: relative;');

        // Get the last day of the week from the filename
        const lastDay = this.getLastDayOfWeek(filename);

        // Calculate age
        const birthDate = '1989-07-21';
        const age = (lastDay.getTime() - new Date(birthDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        const ageNumber = Number(age.toFixed(2));

        // Calculate days and weeks passed in the current year
        const daysPassed = Math.floor((lastDay.getTime() - new Date(lastDay.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
        const weeksPassed = Math.floor(daysPassed / 7);

        // Calculate percentages and angles
        const weeksPercent = (weeksPassed / 52) * 100;
        const daysPercent = (daysPassed / 365) * 100;
        const weeksAngle = (weeksPercent / 100) * 360;
        const daysAngle = (daysPercent / 100) * 360;

        // Create the outer weeks circle
        const weeksCircle = timeContainer.createEl('div');
        weeksCircle.setAttribute('style', `
            position: absolute;
            top: 0;
            left: 0;
            width: 260px;
            height: 260px;
            border-radius: 50%;
            background: conic-gradient(
                #50C878 0deg, 
                #50C878 ${weeksAngle}deg, 
                rgba(30, 41, 59, 0.3) ${weeksAngle}deg, 
                rgba(30, 41, 59, 0.3) 360deg
            );
            display: flex;
            justify-content: center;
            align-items: center;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        `);

        // Create the middle days circle
        const daysCircle = weeksCircle.createEl('div');
        daysCircle.setAttribute('style', `
            width: 200px;
            height: 200px;
            border-radius: 50%;
            background: conic-gradient(
                #FF6B6B 0deg, 
                #FF6B6B ${daysAngle}deg, 
                rgba(30, 41, 59, 0.5) ${daysAngle}deg, 
                rgba(30, 41, 59, 0.5) 360deg
            );
            display: flex;
            justify-content: center;
            align-items: center;
            box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.1);
        `);

        // Create the inner age circle
        const ageCircle = daysCircle.createEl('div');
        ageCircle.setAttribute('style', `
            width: 140px;
            height: 140px;
            border-radius: 50%;
            background: rgba(22, 33, 51, 0.95);
            color: #f8fafc;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(10px);
            position: relative;
            z-index: 2;
        `);

        // Create age display
        const ageDisplay = ageCircle.createEl('div');
        ageDisplay.textContent = ageNumber.toString();
        ageDisplay.setAttribute('style', `
            font-size: 42px;
            font-weight: 700;
            line-height: 1;
            background: linear-gradient(90deg, #60A5FA, #818CF8);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-fill-color: transparent;
            margin-bottom: -2px;
        `);

        // Create age label
        const ageLabel = ageCircle.createEl('div');
        ageLabel.textContent = 'years';
        ageLabel.setAttribute('style', 'font-size: 14px; opacity: 0.8;');

        // Create days indicator positioned on the days circle
        const daysIndicatorAngle = Math.min(daysAngle - 10, 110); // Position it near the end of the progress, but not beyond 110deg
        const daysIndicator = timeContainer.createEl('div');
        daysIndicator.setAttribute('style', `
            position: absolute;
            top: 50%;
            left: 50%;
            background-color: rgba(22, 33, 51, 0.95);
            color: #f8fafc;
            padding: 6px 10px;
            border-radius: 20px;
            font-size: 14px;
            display: flex;
            align-items: center;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
            z-index: 3;
            transform: translate(-50%, -50%) rotate(${daysIndicatorAngle}deg) translate(100px) rotate(-${daysIndicatorAngle}deg);
        `);

        const dayText = daysIndicator.createEl('div');
        dayText.innerHTML = `<span style="color: #FF6B6B; font-weight: 700;">${daysPassed}</span> days`;

        // Create weeks indicator positioned on the weeks circle
        const weeksIndicatorAngle = Math.min(weeksAngle - 10, 200); // Position it near the end of the progress, but not beyond 200deg
        const weeksIndicator = timeContainer.createEl('div');
        weeksIndicator.setAttribute('style', `
            position: absolute;
            top: 50%;
            left: 50%;
            background-color: rgba(22, 33, 51, 0.95);
            color: #f8fafc;
            padding: 6px 10px;
            border-radius: 20px;
            font-size: 14px;
            display: flex;
            align-items: center;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
            z-index: 3;
            transform: translate(-50%, -50%) rotate(${weeksIndicatorAngle}deg) translate(130px) rotate(-${weeksIndicatorAngle}deg);
        `);

        const weekText = weeksIndicator.createEl('div');
        weekText.innerHTML = `<span style="color: #50C878; font-weight: 700;">${weeksPassed}</span> weeks`;

        return timeContainer;
    }

    /**
     * Gets the last day (Sunday) of the week from the filename
     * @param filename The filename in YYYY-WW format
     * @returns The date of the last day of the week
     */
    private getLastDayOfWeek(filename: string): Date {
        const dates = this.getDatesForWeek(filename);
        return dates.Sunday;
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

    /**
     * Gets the dates for each day of the week based on the filename (YYYY-WW format)
     */
    private getDatesForWeek(filename: string): Record<DayOfWeek, Date> {
        try {
            const weekNumber = parseInt(filename.split('W')[1]);
            const year = parseInt(filename.split('-')[0]);

            // Get the date range for the week
            const firstMonday = this.findFirstMonday(year, weekNumber);

            // Calculate all days of the week from the first Monday
            const tuesday = new Date(firstMonday);
            tuesday.setDate(firstMonday.getDate() + 1);
            const wednesday = new Date(firstMonday);
            wednesday.setDate(firstMonday.getDate() + 2);
            const thursday = new Date(firstMonday);
            thursday.setDate(firstMonday.getDate() + 3);
            const friday = new Date(firstMonday);
            friday.setDate(firstMonday.getDate() + 4);
            const saturday = new Date(firstMonday);
            saturday.setDate(firstMonday.getDate() + 5);
            const sunday = new Date(firstMonday);
            sunday.setDate(firstMonday.getDate() + 6);

            return {
                Monday: firstMonday,
                Tuesday: tuesday,
                Wednesday: wednesday,
                Thursday: thursday,
                Friday: friday,
                Saturday: saturday,
                Sunday: sunday
            };
        } catch (error) {
            console.error('Error in getDatesForWeek:', error);
            // Return Invalid Dates in case of error
            return {
                Monday: new Date(NaN),
                Tuesday: new Date(NaN),
                Wednesday: new Date(NaN),
                Thursday: new Date(NaN),
                Friday: new Date(NaN),
                Saturday: new Date(NaN),
                Sunday: new Date(NaN)
            };
        }
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

    /**
     * Force reload the CSS styles to ensure they're applied
     */
    public reloadStyles(): void {
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
}
