import { STask } from 'data-model/serialized/markdown';
import { Component } from 'obsidian';
import { DataviewApi } from '../../api/plugin-api';

export class DailyView {
    private dv: DataviewApi;
    private primaryColor = '#5899D6';
    private chartColors = [
        '#FF6B6B', '#FF9E7A', '#FFBF86', '#FFE66D',
        '#8AFF80', '#80FFEA', '#80D8FF', '#9580FF',
        '#FF80BF', '#FF8095', '#B6FFDB', '#DBFFB6'
    ];

    constructor(dv: DataviewApi) {
        this.dv = dv;
    }

    /**
     * Renders daily tasks with filters
     */
    public async renderDailyTasks(
        tasks: STask[],
        filename: string,
        component: Component,
        container: HTMLElement
    ): Promise<HTMLElement> {
        // Create container for the daily view
        const dailyContainer = container.createEl('div');
        dailyContainer.setAttribute('style', 'margin: 1em 0; padding: 10px; border-radius: 6px;');

        // Keep track of currently filtered tasks
        let filteredTasks = tasks;

        // Create filters for tasks
        this.createTaskFilters(dailyContainer, tasks, (filtered) => {
            filteredTasks = filtered;
            this.renderFilteredTasks(filteredTasks, dailyContainer, component, filename);
        });

        // Initial render with all tasks
        this.renderFilteredTasks(filteredTasks, dailyContainer, component, filename);

        return dailyContainer;
    }

    /**
     * Creates filter buttons for tasks
     */
    private createTaskFilters(
        parentContainer: HTMLElement,
        tasks: STask[],
        onFilterChange: (filteredTasks: STask[]) => void
    ): void {
        // Create filter container
        const filterContainer = parentContainer.createEl('div');
        filterContainer.setAttribute('style', `
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 12px;
            padding: 8px;
            background: rgba(22, 33, 51, 0.03);
            border-radius: 6px;
        `);

        // Add filter title
        const filterTitle = filterContainer.createEl('div');
        filterTitle.textContent = 'Filter by:';
        filterTitle.setAttribute('style', `
            font-weight: 600;
            color: #64748b;
            margin-right: 8px;
            display: flex;
            align-items: center;
        `);

        // Helper function to normalize filename (strip _archive suffix and .md extension)
        const normalizeFilename = (filename: string): string => {
            return filename.replace(/\.md$/, '').replace(/_archive$/, '');
        };

        // Collect unique normalized filenames from tasks and count tasks
        const fileGroups = new Map<string, { count: number, originalFiles: Set<string> }>();
        let allTasksCount = tasks.length;

        tasks.forEach((task: STask) => {
            const baseFilename = task.path.split('/').pop() || 'Unknown';
            const normalizedName = normalizeFilename(baseFilename);

            if (!fileGroups.has(normalizedName)) {
                fileGroups.set(normalizedName, { count: 0, originalFiles: new Set() });
            }

            const group = fileGroups.get(normalizedName)!;
            group.count++;
            group.originalFiles.add(baseFilename);
        });

        // Keep track of active filters (using normalized names)
        let activeFilters: Set<string> = new Set();

        // Create "All" button
        const allButton = this.createFilterButton(
            filterContainer,
            'All',
            allTasksCount,
            this.primaryColor,
            true
        );

        // Create buttons for each unique file group
        const fileButtons: { [key: string]: HTMLElement } = {};
        Array.from(fileGroups.entries()).forEach(([normalizedName, group], index) => {
            const color = this.chartColors[index % this.chartColors.length];
            const button = this.createFilterButton(filterContainer, normalizedName, group.count, color, false);
            fileButtons[normalizedName] = button;

            // Add click handler for file filter
            button.addEventListener('click', () => {
                if (activeFilters.has(normalizedName)) {
                    // Deactivate this filter
                    activeFilters.delete(normalizedName);
                    button.style.opacity = '0.5';
                    button.style.borderWidth = '1px';
                } else {
                    // Activate this filter
                    activeFilters.add(normalizedName);
                    button.style.opacity = '1';
                    button.style.borderWidth = '2px';
                }

                // Deactivate "All" button if any specific filter is active
                if (activeFilters.size > 0) {
                    allButton.style.opacity = '0.5';
                    allButton.style.borderWidth = '1px';

                    // Filter tasks - include both regular and archived versions
                    const filtered = tasks.filter((task: STask) => {
                        const baseFilename = task.path.split('/').pop() || 'Unknown';
                        const normalizedName = normalizeFilename(baseFilename);
                        return activeFilters.has(normalizedName);
                    });
                    onFilterChange(filtered);
                } else {
                    // Show all tasks if no filters are active
                    allButton.style.opacity = '1';
                    allButton.style.borderWidth = '2px';
                    onFilterChange(tasks);
                }
            });
        });

        // Add click handler for "All" button
        allButton.addEventListener('click', () => {
            // Clear all filters
            activeFilters.clear();
            allButton.style.opacity = '1';
            allButton.style.borderWidth = '2px';

            // Reset all file buttons
            Object.values(fileButtons).forEach(btn => {
                btn.style.opacity = '0.5';
                btn.style.borderWidth = '1px';
            });

            onFilterChange(tasks);
        });
    }

    /**
     * Creates a single filter button
     */
    private createFilterButton(
        container: HTMLElement,
        label: string,
        count: number,
        color: string,
        isActive: boolean
    ): HTMLElement {
        const button = container.createEl('button');
        button.textContent = `${label} (${count})`;
        button.setAttribute('style', `
            padding: 6px 12px;
            border: ${isActive ? '2px' : '1px'} solid ${color};
            border-radius: 4px;
            background: ${this.hexToRgba(color, 0.1)};
            color: ${color};
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            opacity: ${isActive ? '1' : '0.5'};
        `);

        button.addEventListener('mouseenter', () => {
            button.style.background = this.hexToRgba(color, 0.2);
            button.style.transform = 'translateY(-1px)';
        });

        button.addEventListener('mouseleave', () => {
            button.style.background = this.hexToRgba(color, 0.1);
            button.style.transform = 'translateY(0)';
        });

        return button;
    }

    /**
     * Renders filtered tasks
     */
    private renderFilteredTasks(
        tasks: STask[],
        container: HTMLElement,
        component: Component,
        filename: string
    ): void {
        // Remove existing task container if it exists
        const existingContainer = container.querySelector('.daily-tasks-container');
        if (existingContainer) {
            existingContainer.remove();
        }

        // Create new task container
        const taskContainer = container.createEl('div');
        taskContainer.classList.add('daily-tasks-container');

        // Separate completed and incomplete tasks
        const completedTasks = tasks.filter(t => t.completed);
        const incompleteTasks = tasks.filter(t => !t.completed);

        // Render incomplete tasks
        if (incompleteTasks.length > 0) {
            const incompleteHeader = taskContainer.createEl('h3');
            incompleteHeader.textContent = `⏳ Incomplete (${incompleteTasks.length})`;
            incompleteHeader.setAttribute('style', 'margin-top: 1em; margin-bottom: 0.5em;');

            // Convert to proper grouping format - groupByFile = false to remove file headers
            // const incompleteGrouped = this.dv.array(incompleteTasks).groupBy(t => t.link).array();
            this.dv.taskList(incompleteTasks as any, false, taskContainer, component, filename);
        }

        // Render completed tasks
        if (completedTasks.length > 0) {
            const completedHeader = taskContainer.createEl('h3');
            completedHeader.textContent = `✅ Completed (${completedTasks.length})`;
            completedHeader.setAttribute('style', 'margin-top: 1em; margin-bottom: 0.5em;');

            // Convert to proper grouping format - groupByFile = false to remove file headers
            const completedGrouped = this.dv.array(completedTasks).groupBy(t => t.link).array();
            this.dv.taskList(completedGrouped as any, false, taskContainer, component, filename);
        }

        // Show empty state if no tasks
        if (tasks.length === 0) {
            const emptyState = taskContainer.createEl('div');
            emptyState.textContent = 'No tasks found for this day.';
            emptyState.setAttribute('style', `
                padding: 2em;
                text-align: center;
                color: #64748b;
                font-style: italic;
            `);
        }
    }

    /**
     * Converts hex color to rgba
     */
    private hexToRgba(hex: string, alpha: number): string {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
}

