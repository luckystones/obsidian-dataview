import { STask } from 'data-model/serialized/markdown';
import { Component } from 'obsidian';
import { DataviewApi } from '../../api/plugin-api';
import { TaggedFile } from '../../api/inline-field-search';
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

        this.renderWeekdaysTable(tasks, dates, weeklyContainer, component, filename);
        this.renderWeekendTable(tasks, dates, weeklyContainer, component, filename);

        return weeklyContainer;
    }

    /**
     * Renders weekly reflections from files tagged with "highlights"
     * @param filename The filename in YYYY-WW format 
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
        header.textContent = 'Weekly Notes & Reflections';
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
            // Parse year and week from filename
            const [yearStr, weekStr] = filename.split('-W');
            const year = parseInt(yearStr);
            const week = parseInt(weekStr);

            if (isNaN(year) || isNaN(week)) {
                const errorMessage = reflectionsContainer.createEl('div');
                errorMessage.textContent = 'Invalid filename format. Expected YYYY-WW.';
                errorMessage.setAttribute('style', 'color: #FF6B6B; text-align: center;');
                return reflectionsContainer;
            }

            // Search for files with multiple fields: highlight, feeling, tefekkur, sohbet, and words
            const fields = ["highlight", "feeling", "tefekkur", "sohbet", "words"];
            const highlightFiles = await this.dv.fieldSearch.searchFilesWithField({
                year: year,
                week: week,
                tag: fields,
                searchPath: "daily",
                component: component
            });

            // Check if we found any files
            const totalFiles = Object.values(highlightFiles).flat().length;

            if (totalFiles === 0) {
                const noReflections = reflectionsContainer.createEl('div');
                noReflections.textContent = 'No notes or reflections found for this week.';
                noReflections.setAttribute('style', `
                    text-align: center;
                    color: #64748b;
                    font-style: italic;
                    padding: 16px;
                `);
                return reflectionsContainer;
            }

            // Render reflections by field type instead of by day
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
     * Renders reflections grouped by field type instead of by day
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

        // Process each day
        const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        for (const day of days) {
            const dayFiles = files[day];
            if (!dayFiles || dayFiles.length === 0) continue;

            // Process each file for this day
            for (const file of dayFiles) {
                const fieldType = file.source || 'note';

                // Initialize array for this field type if not exists
                if (!filesByFieldType[fieldType]) {
                    filesByFieldType[fieldType] = [];
                }

                // Add file to the appropriate field type group
                filesByFieldType[fieldType].push(file);
            }
        }

        // Create field type cards container with CSS grid - more compact
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

            // Create card for this field type with more compact styling
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

            // Add field type header with more compact styling
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

            // Add content container with more compact styling
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
                // Create file container - make it more compact
                const fileContainer = contentContainer.createEl('div');
                fileContainer.setAttribute('style', `
                    border-bottom: 1px dashed rgba(0, 0, 0, 0.1);
                    padding-bottom: 8px;
                    margin-bottom: 8px;
                    position: relative;
                `);

                // Add file title with link - make it more compact
                const fileTitle = fileContainer.createEl('div');
                fileTitle.setAttribute('style', `
                    font-weight: 500;
                    margin-bottom: 4px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                `);

                // Add calendar icon and make it smaller
                const calendarIcon = fileTitle.createEl('span');
                calendarIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`;
                calendarIcon.setAttribute('style', `color: ${color}; opacity: 0.7;`);

                // Extract and display date (day of week + date)
                const fileDate = this.getFileDateFromFilename(file.basename);
                // Use short day name for more compact display
                const shortDayName = fileDate ? this.getShortDayName(fileDate.getDay()) : '';
                const dateText = fileDate ? `${shortDayName} (${fileDate.getDate()})` : file.basename;

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

                // If file has tag values, display them in a more compact way
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
     * Helper method to extract date from filename (format YYYY-MM-DD)
     */
    private getFileDateFromFilename(filename: string): Date | null {
        const match = filename.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
            const year = parseInt(match[1]);
            const month = parseInt(match[2]) - 1;  // Month is 0-indexed in JavaScript
            const day = parseInt(match[3]);
            return new Date(year, month, day);
        }
        return null;
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
     * Renders task statistics as a pie chart
     */
    private async renderStats(
        tasks: WeeklyTaskGroup,
        filename: string,
        container: HTMLElement
    ): Promise<HTMLElement> {
        // Create container for statistics
        const statsContainer = container.createEl('div');
        statsContainer.setAttribute('style', 'display: flex; justify-content: center; align-items: center; flex-grow: 1;');

        // Aggregate all tasks
        const allTasks: STask[] = [];
        Object.values(tasks).forEach(dayTasks => {
            allTasks.push(...dayTasks);
        });

        if (allTasks.length === 0) {
            return statsContainer; // Skip if no tasks
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

        return statsContainer;
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
        timeContainer.setAttribute('style', 'width: 260px; height: 260px; position: relative;');

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
        parentContainer: HTMLElement,
        component: Component,
        filename: string
    ): void {
        // Create weekdays table container
        const weekdays: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
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
        parentContainer: HTMLElement,
        component: Component,
        filename: string
    ): void {
        // Create weekend table container
        const weekendDays: DayOfWeek[] = ['Saturday', 'Sunday'];
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

    /**
     * Renders a complete weekly dashboard with tasks and reflections
     * @param tasks Weekly tasks to display
     * @param filename The filename in YYYY-WW format
     * @param component The component to use for rendering
     * @param container The container to render in
     * @returns The container with the rendered dashboard
     */
    public async renderWeeklyDashboard(
        tasks: WeeklyTaskGroup,
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

        // Render weekly time and stats side by side
        await this.renderStats(tasks, filename, timeStatsContainer);
        await this.renderWeeklyTime(filename, timeStatsContainer, component);

        // Render tasks section
        const tasksContainer = dashboardContainer.createEl('div');
        await this.renderWeeklyTasksAsTable(tasks, filename, component, tasksContainer);

        // Render reflections section
        await this.renderReflections(filename, component, dashboardContainer);

        // Ensure styles are applied
        this.reloadStyles();

        return dashboardContainer;
    }

    /**
     * Helper method to get short day name from day index
     */
    private getShortDayName(dayIndex: number): string {
        const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return shortDays[dayIndex];
    }
}
