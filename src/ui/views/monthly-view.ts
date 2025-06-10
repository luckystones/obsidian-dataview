import { STask } from 'data-model/serialized/markdown';
import { Component } from 'obsidian';
import { DataEntry, ExpenseAnalyzer, ExpenseItem } from '../../../expense-analyzer';
import { TaggedFile } from '../../api/inline-field-search';
import { MonthlyTaskApi } from '../../api/monthly-task-search';
import { MonthUtils } from '../../api/MonthUtils';
import { DataviewApi } from '../../api/plugin-api';

// Interface for popup state
interface ExpenseEditPopup {
    isOpen: boolean;
    expense: ExpenseItem | null;
    categoryOptions: string[];
    selectedCategory: string;
    originalCategory: string;
    newCategoryKey: string;
    element: HTMLElement | null;
    currentDataEntry: DataEntry | null;
}

interface TaskStatistic {
    name: string;
    todo: number;
    done: number;
    score: string;
    level: string;
    color: string;
}

export class MonthlyView {
    private dv: DataviewApi;
    private monthlyTaskApi: MonthlyTaskApi;
    private chartColors = [
        '#FF6B6B', '#FF9E7A', '#FFBF86', '#FFE66D',
        '#8AFF80', '#80FFEA', '#80D8FF', '#9580FF',
        '#FF80BF', '#FF8095', '#B6FFDB', '#DBFFB6'
    ];

    // Popup state
    private popup: ExpenseEditPopup = {
        isOpen: false,
        expense: null,
        categoryOptions: [],
        selectedCategory: '',
        originalCategory: '',
        newCategoryKey: '',
        element: null,
        currentDataEntry: null
    };

    constructor(dv: DataviewApi) {
        this.dv = dv;
        this.monthlyTaskApi = new MonthlyTaskApi(dv);
    }

    /**
     * Renders a complete monthly dashboard with stats and reflections
     * @param filename The filename in YYYY-Month format (e.g., 2025-June)
     * @param component The component to use for rendering
     * @param container The container to render in
     * @returns The container with the rendered dashboard
     */
    public async renderMonthlyDashboard(
        filename: string,
        component: Component,
        container: HTMLElement
    ): Promise<HTMLElement> {
        // Create main container
        const dashboardContainer = container.createEl('div');
        dashboardContainer.setAttribute('style', 'margin: 1em 0;');

        // Create horizontal flex container for time and stats
        const timeStatsContainer = dashboardContainer.createEl('div');
        timeStatsContainer.setAttribute('style', 'display: flex; flex-direction: row; align-items: flex-start; justify-content: space-between; gap: 20px; flex-wrap: wrap; margin-bottom: 30px; min-height: 280px;');

        // Render monthly stats
        await this.renderStats(filename, timeStatsContainer, component);

        // Render monthly time
        await this.renderMonthlyTime(filename, timeStatsContainer, component);

        // Render reflections section
        await this.renderReflections(filename, component, dashboardContainer);

        // Render expenses section
        await this.renderExpenses(filename, component, dashboardContainer);

        return dashboardContainer;
    }

    /**
     * Renders task statistics as a pie chart
     * @param filename The filename in YYYY-Month format
     * @param container The container to render the statistics in
     * @param component The component to use for rendering
     * @returns The container with the rendered statistics
     */
    private async renderStats(
        filename: string,
        container: HTMLElement,
        component: Component
    ): Promise<HTMLElement> {
        // Create container for statistics
        const statsContainer = container.createEl('div');
        statsContainer.setAttribute('style', 'display: flex; justify-content: center; align-items: center; flex-grow: 1;');

        try {
            // Parse the month and year from the filename
            const [yearStr, monthName] = filename.split('-');
            const year = parseInt(yearStr);
            const monthIndex = this.getMonthIndex(monthName);

            if (isNaN(year) || monthIndex === -1) {
                throw new Error('Invalid filename format. Expected YYYY-Month.');
            }

            // Get tasks using the MonthlyTaskApi
            const tasks = this.monthlyTaskApi.searchMonthlyTasks('"game/objectives"', filename);

            if (tasks.length === 0) {
                const noTasks = statsContainer.createEl('div');
                noTasks.textContent = 'No tasks found for this month.';
                noTasks.setAttribute('style', `
                    text-align: center;
                    color: #64748b;
                    font-style: italic;
                    padding: 16px;
                `);
                return statsContainer;
            }

            // Group tasks by filename
            const tasksByFile: Record<string, STask[]> = {};
            tasks.forEach(task => {
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

            return statsContainer;
        } catch (e) {
            console.error('Error rendering monthly stats:', e);
            const errorMessage = statsContainer.createEl('div');
            errorMessage.textContent = `Error loading statistics: ${e.message}`;
            errorMessage.setAttribute('style', 'color: #FF6B6B; text-align: center;');
            return statsContainer;
        }
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
        flexContainer.setAttribute('style', 'display: flex; flex-direction: row; align-items: stretch; justify-content: center; gap: 20px; min-height: 280px;');

        // Create chart container
        const chartContainer = flexContainer.createEl('div');
        chartContainer.setAttribute('style', 'width: 280px; height: 280px; position: relative;');

        // Create summary container - modified to stretch horizontally
        const summaryContainer = flexContainer.createEl('div');
        summaryContainer.setAttribute('style', 'min-width: 200px; flex-grow: 1; display: flex;');

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

        // Calculate how many columns we need based on the number of objectives
        const itemsPerColumn = 5;
        const numColumns = Math.max(1, Math.ceil(objectives.length / itemsPerColumn));

        // Create columns container to hold multiple columns
        const columnsContainer = summaryContainer.createEl('div');
        columnsContainer.setAttribute('style', `
            display: grid;
            grid-template-columns: repeat(${numColumns}, 1fr);
            gap: 10px;
            width: 100%;
        `);

        // Sort objectives by total task count (descending)
        objectives.sort((a, b) => (b.done + b.todo) - (a.done + a.todo));

        // Create columns of summary tables
        for (let colIndex = 0; colIndex < numColumns; colIndex++) {
            // Create task summary table for this column
            const summaryTable = columnsContainer.createEl('div');
            summaryTable.setAttribute('style', `
                background: rgba(22, 33, 51, 0.7);
                border-radius: 8px;
                padding: 12px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                height: 100%;
                display: flex;
                flex-direction: column;
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

            // Calculate the range of objectives for this column
            const startIdx = colIndex * itemsPerColumn;
            const endIdx = Math.min(startIdx + itemsPerColumn, objectives.length);

            // Add rows for each file in this column
            for (let i = startIdx; i < endIdx; i++) {
                const obj = objectives[i];
                const total = obj.done + obj.todo;
                if (total === 0) continue;

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
            }
        }

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
     * Helper method to convert month name to month index (0-11)
     * @param monthName The month name (e.g., January, February, etc.)
     * @returns The month index (0-11) or -1 if invalid
     */
    private getMonthIndex(monthName: string): number {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        // Try exact match first
        const exactIndex = months.findIndex(m => m.toLowerCase() === monthName.toLowerCase());
        if (exactIndex !== -1) {
            return exactIndex;
        }

        // Try partial match
        const partialIndex = months.findIndex(m => m.toLowerCase().startsWith(monthName.toLowerCase()));
        return partialIndex;
    }

    /**
     * Calculates and displays age and time indicators based on the given filename and a static birth date
     * @param filename The filename in YYYY-Month format
     * @param container The container to render the indicators in
     * @param component The component to use for rendering
     * @returns The container with the rendered indicators
     */
    public async renderMonthlyTime(
        filename: string,
        container: HTMLElement,
        component: Component
    ): Promise<HTMLElement> {
        // Create a container for the age indicators
        const timeContainer = container.createEl('div');
        timeContainer.setAttribute('style', 'width: 260px; height: 260px; position: relative;');

        try {
            // Parse the month and year from the filename
            const [yearStr, monthName] = filename.split('-');
            const year = parseInt(yearStr);
            const monthIndex = this.getMonthIndex(monthName);

            if (isNaN(year) || monthIndex === -1) {
                throw new Error('Invalid filename format. Expected YYYY-Month.');
            }

            // Get the last day of the month
            const lastDay = new Date(year, monthIndex + 1, 0); // Month is 0-based, so +1 for next month, day 0 = last day of current month

            // Calculate age
            const birthDate = new Date('1989-07-21');
            const age = (lastDay.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
            const ageNumber = Number(age.toFixed(2));

            // Calculate days and months passed in the current year
            const startOfYear = new Date(lastDay.getFullYear(), 0, 1);
            const daysPassed = Math.floor((lastDay.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
            const monthsPassed = lastDay.getMonth() + 1; // +1 because months are 0-indexed

            // Calculate percentages and angles
            const monthsPercent = (monthsPassed / 12) * 100;
            const daysPercent = (daysPassed / 365) * 100;
            const monthsAngle = (monthsPercent / 100) * 360;
            const daysAngle = (daysPercent / 100) * 360;

            // Create the outer months circle
            const monthsCircle = timeContainer.createEl('div');
            monthsCircle.setAttribute('style', `
                position: absolute;
                top: 0;
                left: 0;
                width: 260px;
                height: 260px;
                border-radius: 50%;
                background: conic-gradient(
                    #50C878 0deg, 
                    #50C878 ${monthsAngle}deg, 
                    rgba(30, 41, 59, 0.3) ${monthsAngle}deg, 
                    rgba(30, 41, 59, 0.3) 360deg
                );
                display: flex;
                justify-content: center;
                align-items: center;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            `);

            // Create the middle days circle
            const daysCircle = monthsCircle.createEl('div');
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

            // Create months indicator positioned on the months circle
            const monthsIndicatorAngle = Math.min(monthsAngle - 10, 200); // Position it near the end of the progress, but not beyond 200deg
            const monthsIndicator = timeContainer.createEl('div');
            monthsIndicator.setAttribute('style', `
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
                transform: translate(-50%, -50%) rotate(${monthsIndicatorAngle}deg) translate(130px) rotate(-${monthsIndicatorAngle}deg);
            `);

            const monthText = monthsIndicator.createEl('div');
            monthText.innerHTML = `<span style="color: #50C878; font-weight: 700;">${monthsPassed}</span> months`;

            return timeContainer;
        } catch (e) {
            console.error('Error rendering monthly time:', e);
            const errorMessage = timeContainer.createEl('div');
            errorMessage.textContent = `Error: ${e.message}`;
            errorMessage.setAttribute('style', 'color: #FF6B6B; text-align: center;');
            return timeContainer;
        }
    }

    /**
     * Converts hex color to RGB values string (e.g. "59, 130, 246")
     * @param hex Hex color string (e.g. "#3b82f6")
     * @returns RGB values as string
     */
    private hexToRgb(hex: string): string {
        // Remove the hash
        hex = hex.replace('#', '');

        // Parse the hex values
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        return `${r}, ${g}, ${b}`;
    }

    /**
     * Renders monthly reflections from files tagged with specific fields
     * @param filename The filename in YYYY-Month format 
     * @param component The component to use for rendering
     * @param container The container to render the reflections in
     * @returns The container with the rendered reflections
     */
    public async renderReflections(
        filename: string,
        component: Component,
        container: HTMLElement
    ): Promise<HTMLElement> {
        // Create container for the reflections view
        const reflectionsContainer = container.createEl('div');
        reflectionsContainer.setAttribute('style', `
            margin: 2em 0;
            padding: 16px;
            background: rgba(22, 33, 51, 0.03);
            border-radius: 8px;
            border: 1px solid rgba(30, 41, 59, 0.1);
        `);

        // Add header
        const header = reflectionsContainer.createEl('h2');
        header.textContent = 'Monthly Notes & Reflections';
        header.setAttribute('style', `
            margin: 0 0 16px 0;
            font-size: 1.4em;
            color: #3b82f6;
            font-weight: 600;
            text-align: center;
            border-bottom: 2px solid rgba(59, 130, 246, 0.2);
            padding-bottom: 8px;
        `);

        try {
            // Parse year and month from filename
            const [yearStr, monthName] = filename.split('-');
            const year = parseInt(yearStr);
            const monthIndex = this.getMonthIndex(monthName);

            if (isNaN(year) || monthIndex === -1) {
                const errorMessage = reflectionsContainer.createEl('div');
                errorMessage.textContent = 'Invalid filename format. Expected YYYY-Month.';
                errorMessage.setAttribute('style', 'color: #FF6B6B; text-align: center;');
                return reflectionsContainer;
            }

            // Search for files with multiple fields
            const fields = ["highlight", "feeling", "tefekkur", "sohbet", "words"];
            const highlightFiles = await this.dv.fieldSearch.searchFilesWithField({
                year: year,
                month: monthIndex,
                tag: fields,
                searchPath: "daily",
                component: component
            });

            // Check if we found any files
            const totalFiles = Object.values(highlightFiles).flat().length;

            if (totalFiles === 0) {
                const noReflections = reflectionsContainer.createEl('div');
                noReflections.textContent = 'No notes or reflections found for this month.';
                noReflections.setAttribute('style', `
                    text-align: center;
                    color: #64748b;
                    font-style: italic;
                    padding: 16px;
                `);
                return reflectionsContainer;
            }

            // Render reflections by field type
            await this.renderReflectionsByFieldType(highlightFiles, reflectionsContainer, component);

            return reflectionsContainer;
        } catch (e) {
            console.error('Error rendering reflections:', e);
            const errorMessage = reflectionsContainer.createEl('div');
            errorMessage.textContent = `Error loading reflections: ${e.message}`;
            errorMessage.setAttribute('style', 'color: #FF6B6B; text-align: center;');
            return reflectionsContainer;
        }
    }

    /**
     * Renders reflections grouped by field type
     * @param files Files containing reflections grouped by day
     * @param container Container to render the reflections in
     * @param component Component to use for rendering
     */
    private async renderReflectionsByFieldType(
        files: Record<string, TaggedFile[]>,
        container: HTMLElement,
        component: Component
    ): Promise<void> {
        // Field-specific colors
        const fieldColors = {
            highlight: '#3b82f6',  // Blue
            feeling: '#ec4899',    // Pink
            tefekkur: '#f97316',   // Orange
            sohbet: '#84cc16',     // Green
            words: '#8b5cf6',      // Purple
            default: '#64748b'     // Gray
        };

        // First, collect all files and organize them by field type
        const filesByFieldType: Record<string, TaggedFile[]> = {};

        // Process each day/group key
        for (const [groupKey, groupFiles] of Object.entries(files)) {
            console.log(groupKey, groupFiles);
            if (!groupFiles || groupFiles.length === 0) continue;

            // Process each file for this day
            for (const file of groupFiles) {
                const fieldType = file.source || 'note';

                // Initialize array for this field type if not exists
                if (!filesByFieldType[fieldType]) {
                    filesByFieldType[fieldType] = [];
                }

                // Add file to the appropriate field type group
                filesByFieldType[fieldType].push(file);
            }
        }

        // Create field type cards container with CSS grid
        const cardsContainer = container.createEl('div');
        cardsContainer.setAttribute('style', `
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 12px;
            margin-top: 12px;
        `);

        // Process each field type
        for (const [fieldType, fieldFiles] of Object.entries(filesByFieldType)) {
            if (fieldFiles.length === 0) continue;

            // Get color for this field type
            const color = fieldColors[fieldType as keyof typeof fieldColors] || fieldColors.default;

            // Create card for this field type
            const fieldCard = cardsContainer.createEl('div');
            fieldCard.setAttribute('style', `
                background: white;
                border-radius: 6px;
                box-shadow: 0 3px 5px rgba(0, 0, 0, 0.05);
                overflow: hidden;
                display: flex;
                flex-direction: column;
                height: 100%;
                min-height: 180px;
                border-top: 3px solid ${color};
            `);

            // Add field type header
            const fieldHeader = fieldCard.createEl('div');
            fieldHeader.setAttribute('style', `
                padding: 8px 12px;
                font-weight: 600;
                font-size: 1em;
                color: ${color};
                background: rgba(${this.hexToRgb(color)}, 0.05);
                display: flex;
                justify-content: space-between;
                align-items: center;
            `);

            const fieldTitle = fieldHeader.createEl('span');
            fieldTitle.textContent = fieldType.charAt(0).toUpperCase() + fieldType.slice(1);

            const fileCount = fieldHeader.createEl('span');
            fileCount.textContent = `${fieldFiles.length} item${fieldFiles.length > 1 ? 's' : ''}`;
            fileCount.setAttribute('style', 'font-size: 0.75em; opacity: 0.7;');

            // Add content container
            const contentContainer = fieldCard.createEl('div');
            contentContainer.setAttribute('style', `
                padding: 10px;
                flex-grow: 1;
                display: flex;
                flex-direction: column;
                gap: 8px;
                overflow-y: auto;
                max-height: 250px;
            `);

            // Sort files by date
            fieldFiles.sort((a, b) => {
                const dateA = this.getFileDateFromFilename(a.basename);
                const dateB = this.getFileDateFromFilename(b.basename);
                if (dateA && dateB) {
                    return dateA.getTime() - dateB.getTime();
                }
                return 0;
            });

            // Process each file for this field type
            for (const file of fieldFiles) {
                // Create file container
                const fileContainer = contentContainer.createEl('div');
                fileContainer.setAttribute('style', `
                    border-bottom: 1px dashed rgba(0, 0, 0, 0.1);
                    padding-bottom: 8px;
                    margin-bottom: 8px;
                    position: relative;
                `);

                // Add file title with link
                const fileTitle = fileContainer.createEl('div');
                fileTitle.setAttribute('style', `
                    font-weight: 500;
                    margin-bottom: 4px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                `);

                // Add calendar icon
                const calendarIcon = fileTitle.createEl('span');
                calendarIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`;
                calendarIcon.setAttribute('style', `color: ${color}; opacity: 0.7;`);

                // Extract and display date
                const fileDate = this.getFileDateFromFilename(file.basename);
                const dateText = fileDate ? fileDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : file.basename;

                const fileLink = fileTitle.createEl('a');
                fileLink.textContent = dateText;
                fileLink.setAttribute('href', file.path);
                fileLink.setAttribute('style', `
                    color: #334155;
                    text-decoration: none;
                    font-size: 0.9em;
                `);

                // Add click handler
                fileLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.dv.app.workspace.openLinkText(file.path, '', false);
                });

                // If file has tag values, display them
                if (file.tagValues && file.tagValues.length > 0) {
                    const tagValuesContainer = fileContainer.createEl('div');
                    tagValuesContainer.setAttribute('style', `
                        display: flex;
                        flex-wrap: wrap;
                        gap: 3px;
                        margin-bottom: 4px;
                    `);

                    file.tagValues.forEach((value: string) => {
                        const tagValue = tagValuesContainer.createEl('span');
                        tagValue.textContent = value;
                        tagValue.setAttribute('style', `
                            background-color: rgba(${this.hexToRgb(color)}, 0.1);
                            color: ${color};
                            padding: 1px 6px;
                            border-radius: 3px;
                            font-size: 0.65em;
                            font-weight: 500;
                            text-transform: capitalize;
                        `);
                    });
                }

            }
        }
    }

    /**
     * Helper method to extract date from filename
     * @param filename The filename
     * @returns The extracted date or null if no date is found
     */
    private getFileDateFromFilename(filename: string): Date | null {
        // Regular expression to match date formats in filenames
        const datePattern = /(\d{4}-\d{2}-\d{2})/;
        const match = filename.match(datePattern);

        if (match) {
            const dateStr = match[1];
            return new Date(dateStr);
        }

        return null;
    }

    /**
     * Renders expense analysis for the given month
     * @param filename The filename in YYYY-Month format
     * @param component The component to use for rendering
     * @param container The container to render the expenses in
     * @returns The container with the rendered expenses
     */
    public async renderExpenses(
        filename: string,
        component: Component,
        container: HTMLElement
    ): Promise<HTMLElement> {
        // Create container for the expenses view
        const expensesContainer = container.createEl('div');
        expensesContainer.setAttribute('style', `
            margin: 2em 0;
            padding: 16px;
            background: rgba(30, 41, 59, 0.7);
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
            overflow-x: auto; /* Add horizontal scrolling for small screens */
        `);

        // Add header
        const header = expensesContainer.createEl('h2');
        header.textContent = 'Monthly Expenses';
        header.setAttribute('style', `
            margin: 0 0 16px 0;
            font-size: 1.4em;
            color: #e11d48;
            font-weight: 600;
            text-align: center;
            border-bottom: 2px solid rgba(225, 29, 72, 0.2);
            padding-bottom: 8px;
        `);

        try {
            // Initialize the expense analyzer
            const analyzer = new ExpenseAnalyzer(this.dv.app);

            // Set analyze other option to true (can be configurable later)
            analyzer.setAnalyzeOther(true);

            const expenseFile = 'game/financial/budget/credit_card_expenses.md';
            // Config file path
            const configFilePath = 'game/financial/budget/credit_card_analysis.md';

            // Run the analysis on the expense file
            const dataEntries = await analyzer.analyzeExpenses(expenseFile, configFilePath);

            if (dataEntries.length === 0) {
                const noExpenses = expensesContainer.createEl('div');
                noExpenses.textContent = 'No expenses found for this month.';
                noExpenses.setAttribute('style', `
                    text-align: center;
                    color: #cbd5e1;
                    font-style: italic;
                    padding: 16px;
                `);
                return expensesContainer;
            }

            // Create a flex container for the visualization and details
            const contentContainer = expensesContainer.createEl('div');
            contentContainer.setAttribute('style', `
                display: flex;
                flex-direction: row;
                gap: 20px;
                flex-wrap: wrap;
            `);

            // Create container for visualization (left side)
            const visualizationContainer = contentContainer.createEl('div');
            visualizationContainer.setAttribute('style', `
                flex: 1 1 500px;
                min-width: 300px;
            `);

            // Create container for expense details (right side)
            const detailsContainer = contentContainer.createEl('div');
            detailsContainer.setAttribute('style', `
                flex: 1 1 300px;
                min-width: 250px;
                display: none;
                background: rgba(15, 23, 42, 0.5);
                border-radius: 6px;
                padding: 12px;
                max-height: 500px;
                overflow-y: auto;
                align-self: flex-start;
            `);

            // Render expense visualization
            await this.renderExpenseVisualization(dataEntries, visualizationContainer, detailsContainer);

            return expensesContainer;
        } catch (e) {
            console.error('Error rendering expenses:', e);
            const errorMessage = expensesContainer.createEl('div');
            errorMessage.textContent = `Error loading expenses: ${e.message}`;
            errorMessage.setAttribute('style', 'color: #FF6B6B; text-align: center;');
            return expensesContainer;
        }
    }

    /**
     * Shows detailed expenses for a selected category
     * @param category The selected category
     * @param totalAmount Total amount for the category
     * @param detailsContainer Container to display the details
     * @param expenseItems Array of expense items for this category
     * @param dataEntries All data entries (needed for category options and updates)
     * @param currentEntry Current data entry for this category
     */
    private showCategoryDetails(
        category: string,
        totalAmount: number,
        detailsContainer: HTMLElement,
        expenseItems: ExpenseItem[],
        dataEntries: DataEntry[],
        currentEntry: DataEntry
    ): void {
        // Clear previous details
        detailsContainer.empty();

        // Show the details container
        detailsContainer.style.display = 'block';

        // Create header
        const headerContainer = detailsContainer.createEl('div');
        headerContainer.setAttribute('style', `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
            padding-bottom: 8px;
        `);

        const categoryTitle = headerContainer.createEl('h3');
        categoryTitle.textContent = category;
        categoryTitle.setAttribute('style', `
            margin: 0;
            font-size: 1.1em;
            font-weight: 600;
            color: #ffffff;
        `);

        const closeButton = headerContainer.createEl('button');
        closeButton.textContent = '×';
        closeButton.setAttribute('style', `
            background: none;
            border: none;
            color: #ffffff;
            font-size: 1.2em;
            font-weight: bold;
            cursor: pointer;
            padding: 0 5px;
        `);

        closeButton.addEventListener('click', () => {
            // Close any open popup first
            this.closeExpensePopup();

            // Hide details container
            detailsContainer.style.display = 'none';

            // Remove highlighting from selected bar
            document.querySelectorAll('.expense-bar-selected').forEach(el => {
                el.classList.remove('expense-bar-selected');
                // Reset the background to original color
                const index = parseInt((el as HTMLElement).dataset.index || "0");
                (el as HTMLElement).style.backgroundColor = this.chartColors[index % this.chartColors.length];
            });
        });

        // Show total for this category
        const totalContainer = detailsContainer.createEl('div');
        totalContainer.setAttribute('style', `
            font-size: 1.1em;
            font-weight: 500;
            color: #f87171;
            margin-bottom: 12px;
            text-align: right;
        `);
        totalContainer.textContent = `Total: ${totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;

        // Create expense items list
        const itemsContainer = detailsContainer.createEl('div');
        itemsContainer.setAttribute('style', `
            margin-top: 8px;
        `);

        // Check if we have expense details
        if (!expenseItems || expenseItems.length === 0) {
            const noItems = itemsContainer.createEl('div');
            noItems.textContent = 'No detailed expense data available for this category.';
            noItems.setAttribute('style', `
                text-align: center;
                color: #cbd5e1;
                font-style: italic;
                padding: 16px;
            `);
            return;
        }

        // Get all available categories from data entries
        const allCategories = new Set<string>();
        dataEntries.forEach(entry => {
            allCategories.add(entry.category);
        });

        // Sort expense details by date (newest first)
        const sortedExpenses = [...expenseItems].sort((a, b) => {
            const dateA = this.parseDate(a.date);
            const dateB = this.parseDate(b.date);
            return dateB.getTime() - dateA.getTime();
        });

        // Add expense items
        sortedExpenses.forEach(item => {
            const itemRow = itemsContainer.createEl('div');
            itemRow.setAttribute('style', `
                display: flex;
                justify-content: space-between;
                padding: 8px 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                cursor: pointer;
                transition: background-color 0.2s;
            `);
            itemRow.classList.add('expense-item-row');

            // Add hover effect
            itemRow.addEventListener('mouseenter', () => {
                itemRow.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            });

            itemRow.addEventListener('mouseleave', () => {
                itemRow.style.backgroundColor = '';
            });

            const itemInfo = itemRow.createEl('div');
            itemInfo.setAttribute('style', `
                flex-grow: 1;
            `);

            const itemDate = itemInfo.createEl('div');
            itemDate.textContent = item.date;
            itemDate.setAttribute('style', `
                font-size: 0.8em;
                color: #cbd5e1;
                margin-bottom: 2px;
            `);

            const itemDescription = itemInfo.createEl('div');
            itemDescription.textContent = item.description;
            itemDescription.setAttribute('style', `
                font-size: 0.85em;
                color: #ffffff;
            `);

            const itemAmount = itemRow.createEl('div');
            itemAmount.textContent = `${item.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
            itemAmount.setAttribute('style', `
                font-size: 0.85em;
                color: #ffffff;
                text-align: right;
                margin-left: 10px;
                white-space: nowrap;
            `);

            // Add click handler to show edit popup
            itemRow.addEventListener('click', (e) => {
                // Close any existing popup first
                this.closeExpensePopup();

                // Open new popup for this expense
                this.openExpensePopup(item, Array.from(allCategories), category, currentEntry, itemRow, detailsContainer);
            });
        });
    }

    /**
     * Opens a popup for editing an expense
     * @param expense The expense item to edit
     * @param categoryOptions Available category options
     * @param currentCategory Current category of the expense
     * @param currentDataEntry Current data entry this expense belongs to
     * @param itemRow The row element that was clicked
     * @param detailsContainer The parent container for positioning
     */
    private openExpensePopup(
        expense: ExpenseItem,
        categoryOptions: string[],
        currentCategory: string,
        currentDataEntry: DataEntry,
        itemRow: HTMLElement,
        detailsContainer: HTMLElement
    ): void {
        // Update popup state
        this.popup.isOpen = true;
        this.popup.expense = expense;
        this.popup.categoryOptions = categoryOptions;
        this.popup.selectedCategory = currentCategory;
        this.popup.originalCategory = currentCategory;
        this.popup.newCategoryKey = '';
        this.popup.currentDataEntry = currentDataEntry;

        // Create popup element
        const popupEl = document.createElement('div');
        this.popup.element = popupEl;

        // Style the popup
        popupEl.setAttribute('style', `
            position: absolute;
            width: 300px;
            background-color: #1e293b;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 6px;
            padding: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 1000;
        `);

        // Create title
        const title = popupEl.createEl('h3');
        title.textContent = 'Edit Expense Category';
        title.setAttribute('style', `
            margin: 0 0 12px 0;
            font-size: 1em;
            color: #ffffff;
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
            padding-bottom: 8px;
        `);

        // Expense display (non-editable)
        const expenseDisplay = popupEl.createEl('div');
        expenseDisplay.setAttribute('style', `
            background-color: #2d3a4f;
            border-radius: 4px;
            padding: 8px;
            margin-bottom: 12px;
            font-size: 0.85em;
            color: #cbd5e1;
        `);
        expenseDisplay.textContent = expense.rawText || `${expense.date} ${expense.description} ${expense.amount} TL`;

        // Category dropdown
        const categoryLabel = popupEl.createEl('label');
        categoryLabel.textContent = 'Category:';
        categoryLabel.setAttribute('style', `
            display: block;
            margin-bottom: 4px;
            color: #cbd5e1;
            font-size: 0.8em;
        `);

        const categorySelect = popupEl.createEl('select');
        categorySelect.setAttribute('style', `
            width: 100%;
            padding: 6px 8px;
            background-color: #2d3a4f;
            color: #ffffff;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 4px;
            margin-bottom: 12px;
            font-size: 0.9em;
        `);

        // Add options to dropdown
        categoryOptions.sort().forEach(category => {
            const option = categorySelect.createEl('option');
            option.value = category;
            option.text = category;

            // Select current category
            if (category === currentCategory) {
                option.selected = true;
            }
        });

        categorySelect.addEventListener('change', () => {
            this.popup.selectedCategory = categorySelect.value;
        });

        // New Category Key text area
        const keyLabel = popupEl.createEl('label');
        keyLabel.textContent = 'New Category Key:';
        keyLabel.setAttribute('style', `
            display: block;
            margin-bottom: 4px;
            color: #cbd5e1;
            font-size: 0.8em;
        `);

        const keyInput = popupEl.createEl('input');
        keyInput.type = 'text';
        keyInput.placeholder = 'Enter new category keyword';
        keyInput.setAttribute('style', `
            width: 100%;
            padding: 6px 8px;
            background-color: #2d3a4f;
            color: #ffffff;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 4px;
            margin-bottom: 8px;
            font-size: 0.9em;
        `);

        keyInput.addEventListener('input', (e) => {
            this.popup.newCategoryKey = (e.target as HTMLInputElement).value;
        });

        // Help text
        const helpText = popupEl.createEl('div');
        helpText.textContent = 'Add a keyword to help categorize similar expenses automatically in the future.';
        helpText.setAttribute('style', `
            font-size: 0.75em;
            color: #94a3b8;
            margin-bottom: 12px;
            font-style: italic;
        `);

        // Button container
        const buttonContainer = popupEl.createEl('div');
        buttonContainer.setAttribute('style', `
            display: flex;
            justify-content: flex-end;
            gap: 8px;
        `);

        // Cancel button
        const cancelButton = buttonContainer.createEl('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.setAttribute('style', `
            padding: 6px 12px;
            background-color: transparent;
            color: #cbd5e1;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.85em;
        `);

        cancelButton.addEventListener('click', () => {
            this.closeExpensePopup();
        });

        // OK button
        const okButton = buttonContainer.createEl('button');
        okButton.textContent = 'OK';
        okButton.setAttribute('style', `
            padding: 6px 12px;
            background-color: #3b82f6;
            color: #ffffff;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.85em;
        `);

        okButton.addEventListener('click', () => {
            // Handle category change and new category key
            this.changeExpenseCategory(expense, currentDataEntry, this.popup.selectedCategory, this.popup.newCategoryKey);

            // Close popup
            this.closeExpensePopup();
        });

        // Add popup to body
        document.body.appendChild(popupEl);

        // Position popup near the clicked row
        const rect = itemRow.getBoundingClientRect();
        const detailsRect = detailsContainer.getBoundingClientRect();

        // Try to position so it doesn't overflow the container
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceRight = detailsRect.right - rect.left;

        if (spaceBelow < 300) {
            // Position above if not enough space below
            popupEl.style.top = `${rect.top - popupEl.offsetHeight}px`;
        } else {
            popupEl.style.top = `${rect.bottom}px`;
        }

        if (spaceRight < 320) {
            // Position to the left if not enough space to the right
            popupEl.style.left = `${rect.right - popupEl.offsetWidth}px`;
        } else {
            popupEl.style.left = `${rect.left}px`;
        }

        // Add click outside handler
        document.addEventListener('click', this.handleClickOutside.bind(this));

        // Focus the new category key input
        keyInput.focus();
    }

    /**
     * Handles clicks outside the popup to close it
     */
    private handleClickOutside(e: MouseEvent): void {
        if (this.popup.isOpen && this.popup.element) {
            const target = e.target as HTMLElement;
            if (!this.popup.element.contains(target) && !target.closest('.expense-item-row')) {
                this.closeExpensePopup();
            }
        }
    }

    /**
     * Closes the expense edit popup
     */
    private closeExpensePopup(): void {
        if (this.popup.isOpen && this.popup.element) {
            this.popup.element.remove();
            this.popup.isOpen = false;
            this.popup.expense = null;
            this.popup.element = null;

            // Remove click outside handler
            document.removeEventListener('click', this.handleClickOutside.bind(this));
        }
    }

    /**
     * Changes the category of an expense
     * @param expense The expense to change
     * @param currentEntry The data entry containing the expense
     * @param newCategory The new category to assign
     * @param newCategoryKey New keyword to add to category configuration
     */
    private async changeExpenseCategory(
        expense: ExpenseItem,
        currentEntry: DataEntry,
        newCategory: string,
        newCategoryKey: string
    ): Promise<void> {
        // For now, just log the change - in a real implementation, this would save to the file
        console.log(`Changed expense category from ${this.popup.originalCategory} to ${newCategory}:`, expense);

        if (newCategoryKey && newCategoryKey.trim() !== '') {
            console.log(`Adding new category key "${newCategoryKey}" for category "${newCategory}"`);

            try {
                // Initialize the expense analyzer
                const analyzer = new ExpenseAnalyzer(this.dv.app);

                // Add the new category key
                const success = await analyzer.addCategoryKeyword(newCategory, newCategoryKey);

                if (success) {
                    // Show success notification
                    this.showNotification(
                        `Added keyword "${newCategoryKey}" to category "${newCategory}"`,
                        'success'
                    );
                } else {
                    // Show error notification
                    this.showNotification(
                        `Failed to add keyword or keyword already exists`,
                        'error'
                    );
                }
            } catch (error) {
                console.error('Error adding category keyword:', error);
                this.showNotification(
                    `Error adding category keyword: ${error.message}`,
                    'error'
                );
            }
        }

        // Here you would update the DataEntry or save changes back to the file
        // This would likely involve a call to an API or file system
    }

    /**
     * Shows a notification message
     * @param message Message to show
     * @param type Type of notification (success, error, info)
     */
    private showNotification(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
        // Create notification element
        const notification = document.createElement('div');

        // Set styles based on type
        let bgColor = '#3b82f6'; // info blue
        let textColor = '#ffffff';
        let icon = '🛈';

        if (type === 'success') {
            bgColor = '#10b981'; // green
            icon = '✓';
        } else if (type === 'error') {
            bgColor = '#ef4444'; // red
            icon = '✗';
        }

        // Style the notification
        notification.setAttribute('style', `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 12px 16px;
            background-color: ${bgColor};
            color: ${textColor};
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 1000;
            max-width: 300px;
            font-size: 0.9em;
            display: flex;
            align-items: center;
            gap: 8px;
        `);

        // Add icon
        const iconSpan = notification.createEl('span');
        iconSpan.textContent = icon;
        iconSpan.setAttribute('style', `
            font-size: 1.2em;
        `);

        // Add message
        const messageSpan = notification.createEl('span');
        messageSpan.textContent = message;

        // Add to document
        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.5s';

            setTimeout(() => {
                notification.remove();
            }, 500);
        }, 3000);
    }

    /**
     * Parse date string (DD/MM/YYYY) to Date object
     * @param dateStr Date string in DD/MM/YYYY format
     */
    private parseDate(dateStr: string): Date {
        const [day, month, year] = dateStr.split('/');
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    /**
     * Renders a visualization of expense data
     * @param dataEntries The expense data entries
     * @param container The container to render the visualization in
     * @param detailsContainer The container to show detailed expenses when a category is clicked
     */
    private async renderExpenseVisualization(
        dataEntries: DataEntry[],
        container: HTMLElement,
        detailsContainer: HTMLElement
    ): Promise<void> {
        // Create visualization container
        const visualizationContainer = container.createEl('div');
        visualizationContainer.setAttribute('style', `
            margin: 1em 0;
            display: flex;
            flex-direction: column;
            align-items: center;
        `);

        // Active filename
        const activeFilename = this.dv.app.workspace.getActiveFile()?.basename;
        if (!activeFilename) {
            console.error('No active file found');
            return;
        }
        const yearAndMonth = MonthUtils.parseYearAndMonthFromFilename(activeFilename);
        console.log(yearAndMonth);
        if (!yearAndMonth) {
            console.error('Invalid filename format:', activeFilename);
            return;
        }
        const year = yearAndMonth.year;
        const month = yearAndMonth.month + 1;

        // Calculate total expenses with validation
        let totalExpenses = 0;
        try {
            totalExpenses = dataEntries.filter(entry => {
                // Filter if year and month is same
                const entryYear = Number(entry.year);
                const entryMonth = Number(entry.month);
                return entryYear === year && entryMonth === month;
            }).reduce((sum, entry) => {
                // Ensure the amount is a valid number
                const amount = typeof entry.amount === 'number' && !isNaN(entry.amount)
                    ? entry.amount
                    : 0;
                return sum + amount;
            }, 0);
        } catch (e) {
            console.error('Error calculating total expenses:', e);
        }

        // Group entries by category and calculate category totals
        const categoryTotals: Record<string, number> = {};
        dataEntries.filter(entry => {
            const entryYear = Number(entry.year);
            const entryMonth = Number(entry.month);
            return entryYear === year && entryMonth === month;
        }).forEach(entry => {
            // Skip entries with invalid amounts
            if (typeof entry.amount !== 'number' || isNaN(entry.amount)) {
                console.warn(`Skipping entry with invalid amount: ${entry.category}`);
                return;
            }

            if (!categoryTotals[entry.category]) {
                categoryTotals[entry.category] = 0;
            }
            categoryTotals[entry.category] += entry.amount;
        });

        // Sort categories by amount (descending)
        const sortedCategories = Object.entries(categoryTotals)
            .sort(([, amountA], [, amountB]) => amountB - amountA);

        // Create total expenses display
        const totalContainer = visualizationContainer.createEl('div');
        totalContainer.setAttribute('style', `
            font-size: 2em;
            font-weight: 700;
            color: #e11d48;
            margin-bottom: 0.5em;
            text-align: center;
        `);

        // Display total with validation
        if (totalExpenses > 0) {
            totalContainer.textContent = `${totalExpenses.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
        } else {
            totalContainer.textContent = `0,00 TL`;
        }

        // Create bar chart container
        const chartContainer = visualizationContainer.createEl('div');
        chartContainer.setAttribute('style', `
            width: 100%;
            max-width: 800px;
            margin: 1em 0;
        `);

        // If there are no valid expenses, show a message
        if (totalExpenses <= 0 || Object.keys(categoryTotals).length === 0) {
            const noData = chartContainer.createEl('div');
            noData.textContent = 'No valid expense data available for visualization.';
            noData.setAttribute('style', `
                text-align: center;
                color: #cbd5e1;
                font-style: italic;
                padding: 20px;
                border: 1px dashed #cbd5e1;
                border-radius: 6px;
            `);
            return;
        }

        // Limit to top 10 categories for better visualization
        const topCategories = sortedCategories.slice(0, 10);

        // Create bars for each category
        topCategories.forEach(([category, amount], index) => {
            // Skip invalid amounts
            if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
                return;
            }

            // Calculate percentage with validation
            const percentage = Math.max(1, Math.min(100, (amount / totalExpenses) * 100));
            const barColor = this.chartColors[index % this.chartColors.length];

            // Create bar container
            const barContainer = chartContainer.createEl('div');
            barContainer.setAttribute('style', `
                display: grid;
                grid-template-columns: 220px minmax(60px, 1fr) 120px;
                gap: 12px;
                align-items: center;
                margin-bottom: 12px;
                height: 30px;
            `);

            // Create category label
            const categoryLabel = barContainer.createEl('div');
            categoryLabel.textContent = category.length > 25 ? category.substring(0, 23) + '...' : category;
            categoryLabel.setAttribute('style', `
                font-size: 0.85em;
                font-weight: 600;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                padding: 0 5px;
                color: #ffffff;
                text-shadow: 0px 1px 2px rgba(0, 0, 0, 0.5);
            `);

            // Create bar wrapper
            const barWrapper = barContainer.createEl('div');
            barWrapper.setAttribute('style', `
                height: 100%;
                width: 100%;
                position: relative;
                background-color: rgba(255, 255, 255, 0.1);
                border-radius: 4px;
                cursor: pointer;
            `);

            // Create bar with percentage tooltip
            const bar = barWrapper.createEl('div');
            bar.setAttribute('style', `
                height: 100%;
                width: ${percentage}%;
                background-color: ${barColor};
                border-radius: 4px;
                transition: width 0.3s ease, background-color 0.3s ease;
                min-width: 4px;
                position: relative;
            `);
            bar.setAttribute('title', `${percentage.toFixed(1)}%`);

            // Add click event to show category details
            barWrapper.addEventListener('click', () => {
                // Close any open popup first
                this.closeExpensePopup();

                // Find the DataEntry for this category
                const entry = dataEntries.find(entry =>
                    entry.category === category &&
                    Number(entry.year) === year &&
                    Number(entry.month) === month
                );

                // Show details for this category using the expenses array from the DataEntry
                if (entry && entry.expenses) {
                    this.showCategoryDetails(
                        category,
                        amount,
                        detailsContainer,
                        entry.expenses,
                        dataEntries,
                        entry
                    );
                } else {
                    this.showCategoryDetails(
                        category,
                        amount,
                        detailsContainer,
                        [],
                        dataEntries,
                        entry || {
                            category,
                            month: month.toString(),
                            year: year.toString(),
                            monthyear: `${month}/${year}`,
                            amount,
                            expenses: []
                        }
                    );
                }

                // Highlight the selected bar
                document.querySelectorAll('.expense-bar-selected').forEach(el => {
                    el.classList.remove('expense-bar-selected');
                    // Reset the background to original color
                    const index = parseInt((el as HTMLElement).dataset.index || "0");
                    (el as HTMLElement).style.backgroundColor = this.chartColors[index % this.chartColors.length];
                });

                bar.classList.add('expense-bar-selected');
                // Store index for color restoration
                bar.dataset.index = index.toString();
                bar.style.backgroundColor = this.lightenColor(barColor, 20);
            });

            // Add hover effect
            barWrapper.addEventListener('mouseenter', () => {
                if (!bar.classList.contains('expense-bar-selected')) {
                    bar.style.backgroundColor = this.lightenColor(barColor, 10);
                }
            });

            barWrapper.addEventListener('mouseleave', () => {
                if (!bar.classList.contains('expense-bar-selected')) {
                    bar.style.backgroundColor = barColor;
                }
            });

            // Create amount label - always right-aligned
            const amountLabel = barContainer.createEl('div');
            amountLabel.textContent = `${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
            amountLabel.setAttribute('style', `
                font-size: 0.85em;
                text-align: right;
                font-weight: 500;
                color: #ffffff;
                text-shadow: 0px 1px 2px rgba(0, 0, 0, 0.5);
                white-space: nowrap;
            `);
        });
    }

    /**
     * Lighten a color by the given percentage
     * @param color Hex color string
     * @param percent Percentage to lighten
     */
    private lightenColor(color: string, percent: number): string {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;

        return '#' + (
            0x1000000 +
            (R < 255 ? R : 255) * 0x10000 +
            (G < 255 ? G : 255) * 0x100 +
            (B < 255 ? B : 255)
        ).toString(16).slice(1);
    }


} 