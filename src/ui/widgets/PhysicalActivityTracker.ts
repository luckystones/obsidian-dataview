import { App, Notice } from 'obsidian';
import { DateTime } from 'luxon';

interface ActivityRecord {
    done: boolean;
    date: string; // YYYY-MM-DD format
    set: number;
    activities: boolean[]; // Array of activity completion statuses
}

const ACTIVITY_NAMES = ['Pushup', 'Crunch', 'Sideplank', 'Plank', 'Bridge', 'Squat', 'DeadHang'];
const INITIAL_SET_NUMBER = 5;

export class PhysicalActivityTracker {
    private app: App;
    private csvPath: string;
    private activityCount: number;
    private startDate: DateTime; // First day of tracking

    constructor(app: App, csvPath: string = 'physical-activity-tracker.csv', startDate?: DateTime) {
        this.app = app;
        this.csvPath = csvPath;
        this.activityCount = ACTIVITY_NAMES.length;
        this.startDate = startDate || DateTime.now();
    }

    /**
     * Calculates the set number for a given date based on the progression formula
     * Each set number is repeated for setNumber*3 days
     * Starting from set 5
     */
    public calculateSetNumber(currentDate: DateTime): number {
        // Calculate days since start
        const daysSinceStart = Math.floor(currentDate.diff(this.startDate, 'days').days);

        if (daysSinceStart < 0) {
            return INITIAL_SET_NUMBER;
        }

        let setNumber = INITIAL_SET_NUMBER;
        let daysPassed = 0;

        // Calculate which set we should be on
        while (daysPassed <= daysSinceStart) {
            const daysForCurrentSet = setNumber * 3;
            if (daysPassed + daysForCurrentSet > daysSinceStart) {
                // We're still in this set period
                break;
            }
            daysPassed += daysForCurrentSet;
            setNumber++;
        }

        return setNumber;
    }

    /**
     * Ensures the CSV file exists and has the proper header
     */
    private async ensureCSVExists(): Promise<void> {
        const file = this.app.vault.getAbstractFileByPath(this.csvPath);

        if (!file) {
            // Create header row with named activity columns
            const activityColumns = ACTIVITY_NAMES.join(',');
            const header = `done,date,set,${activityColumns}\n`;
            await this.app.vault.create(this.csvPath, header);
        }
    }

    /**
     * Reads the CSV file and returns all records
     */
    private async readCSV(): Promise<ActivityRecord[]> {
        await this.ensureCSVExists();

        const file = this.app.vault.getAbstractFileByPath(this.csvPath);
        if (!file || file.name !== this.csvPath.split('/').pop()) {
            return [];
        }

        const content = await this.app.vault.read(file as any);
        const lines = content.split('\n').filter(line => line.trim());

        // Skip header
        const records: ActivityRecord[] = [];
        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(',');
            if (parts.length < 3) continue;

            const done = parts[0].trim().toLowerCase() === 'true';
            const date = parts[1].trim();
            const set = parseInt(parts[2].trim()) || 0;
            const activities = parts.slice(3, 3 + this.activityCount).map(a => a.trim() === '✅');

            records.push({ done, date, set, activities });
        }

        return records;
    }

    /**
     * Writes records back to the CSV file
     */
    private async writeCSV(records: ActivityRecord[]): Promise<void> {
        await this.ensureCSVExists();

        const file = this.app.vault.getAbstractFileByPath(this.csvPath);
        if (!file) return;

        // Build header with named activities
        const activityColumns = ACTIVITY_NAMES.join(',');
        const header = `done,date,set,${activityColumns}\n`;

        // Build rows
        const rows = records.map(record => {
            const activitiesStr = record.activities.map(a => a ? '✅' : '').join(',');
            return `${record.done},${record.date},${record.set},${activitiesStr}`;
        }).join('\n');

        await this.app.vault.modify(file as any, header + rows + '\n');
    }

    /**
     * Gets the record for a specific date
     */
    public async getRecordForDate(date: string): Promise<ActivityRecord | null> {
        const records = await this.readCSV();
        return records.find(r => r.date === date) || null;
    }

    /**
     * Gets records for the last N days including today
     */
    public async getLastNDaysRecords(n: number, today: DateTime): Promise<Map<string, ActivityRecord>> {
        const records = await this.readCSV();
        const recordMap = new Map<string, ActivityRecord>();

        for (const record of records) {
            recordMap.set(record.date, record);
        }

        return recordMap;
    }

    /**
     * Toggles the activity status for a specific date
     */
    public async toggleActivityForDate(date: string, setNumber: number): Promise<boolean> {
        const records = await this.readCSV();
        let existingIndex = records.findIndex(r => r.date === date);

        if (existingIndex >= 0) {
            // Toggle: if already done, mark as not done and clear activities
            const current = records[existingIndex];
            if (current.done) {
                records[existingIndex] = {
                    done: false,
                    date,
                    set: setNumber,
                    activities: Array(this.activityCount).fill(false)
                };
            } else {
                records[existingIndex] = {
                    done: true,
                    date,
                    set: setNumber,
                    activities: Array(this.activityCount).fill(true)
                };
            }
        } else {
            // Create new record with all activities marked as done
            records.push({
                done: true,
                date,
                set: setNumber,
                activities: Array(this.activityCount).fill(true)
            });
        }

        await this.writeCSV(records);
        return records.find(r => r.date === date)!.done;
    }

    /**
     * Renders the activity tracker widget
     */
    public async renderTracker(container: HTMLElement, currentDate: DateTime): Promise<void> {
        // Calculate set number based on progression
        const setNumber = this.calculateSetNumber(currentDate);
        const trackerContainer = container.createEl('div');
        trackerContainer.setAttribute('style', `
            margin: 1.5em 0;
            padding: 1.5em;
            background: rgba(22, 33, 51, 0.03);
            border-radius: 8px;
            border: 1px solid rgba(22, 33, 51, 0.1);
        `);

        // Title with set info
        const titleContainer = trackerContainer.createEl('div');
        titleContainer.setAttribute('style', 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 1em;');

        const title = titleContainer.createEl('h3');
        title.textContent = 'Physical Tracker';
        title.setAttribute('style', `
            margin: 0;
            color: #5899D6;
            font-size: 1.1em;
        `);

        // Set info badge
        const setInfo = titleContainer.createEl('div');
        const daysInCurrentSet = setNumber * 3;
        const daysSinceStart = Math.floor(currentDate.diff(this.startDate, 'days').days);

        // Calculate which day we are in the current set
        let daysPassed = 0;
        let currentSetNumber = INITIAL_SET_NUMBER;
        while (currentSetNumber < setNumber) {
            daysPassed += currentSetNumber * 3;
            currentSetNumber++;
        }
        const dayInSet = daysSinceStart - daysPassed + 1;

        setInfo.textContent = `${dayInSet}/${daysInCurrentSet}`;
        setInfo.setAttribute('style', `
            padding: 0.4em 0.8em;
            background: #FFFF00;
            color: black;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: 600;
        `);

        // Create timeline container
        const timelineContainer = trackerContainer.createEl('div');
        timelineContainer.setAttribute('style', `
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 15px;
            position: relative;
            padding: 1em 0;
        `);

        // Get records for last 5 days (4 previous + today)
        const records = await this.getLastNDaysRecords(5, currentDate);
        const days: { date: DateTime; record: ActivityRecord | null; isToday: boolean }[] = [];

        // Build array of last 5 days with calculated set numbers
        for (let i = 4; i >= 0; i--) {
            const date = currentDate.minus({ days: i });
            const dateStr = date.toFormat('yyyy-MM-dd');
            let record = records.get(dateStr) || null;

            // If no record exists, create one with the calculated set number
            if (!record) {
                const calculatedSet = this.calculateSetNumber(date);
                record = {
                    done: false,
                    date: dateStr,
                    set: calculatedSet,
                    activities: Array(this.activityCount).fill(false)
                };
            }

            days.push({
                date,
                record,
                isToday: i === 0
            });
        }

        // Render each day with connecting lines
        days.forEach((day, index) => {
            const dayContainer = timelineContainer.createEl('div');
            dayContainer.setAttribute('style', `
                display: flex;
                flex-direction: column;
                align-items: center;
                position: relative;
            `);

            // Date label
            const dateLabel = dayContainer.createEl('div');
            dateLabel.textContent = day.date.toFormat('MMM dd');
            dateLabel.setAttribute('style', `
                font-size: 0.75em;
                color: #64748b;
                margin-bottom: 0.5em;
            `);

            // Button/circle
            const button = dayContainer.createEl('button');
            const isDone = day.record?.done || false;
            const displaySet = day.record?.set || this.calculateSetNumber(day.date);

            button.textContent = displaySet.toString();
            button.disabled = !day.isToday;

            const baseStyle = `
                width: 50px;
                height: 50px;
                border-radius: 50%;
                border: 3px solid;
                font-weight: bold;
                font-size: 1.2em;
                cursor: ${day.isToday ? 'pointer' : 'default'};
                transition: all 0.3s ease;
                position: relative;
                z-index: 10;
            `;

            if (day.isToday) {
                // Today's button - interactive
                button.setAttribute('style', baseStyle + `
                    background: ${isDone ? '#10b981' : '#ffffff'};
                    border-color: ${isDone ? '#10b981' : '#5899D6'};
                    color: ${isDone ? '#ffffff' : '#5899D6'};
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                `);

                button.addEventListener('mouseenter', () => {
                    button.style.transform = 'scale(1.1)';
                    button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
                });

                button.addEventListener('mouseleave', () => {
                    button.style.transform = 'scale(1)';
                    button.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                });

                button.addEventListener('click', async () => {
                    const dateStr = day.date.toFormat('yyyy-MM-dd');
                    const calculatedSet = this.calculateSetNumber(day.date);
                    const newStatus = await this.toggleActivityForDate(dateStr, calculatedSet);

                    // Update button appearance
                    if (newStatus) {
                        button.style.background = '#10b981';
                        button.style.borderColor = '#10b981';
                        button.style.color = '#ffffff';
                        new Notice(`All ${this.activityCount} activities completed for set ${calculatedSet}! 🎉`);
                    } else {
                        button.style.background = '#ffffff';
                        button.style.borderColor = '#5899D6';
                        button.style.color = '#5899D6';
                        new Notice('Activities marked as incomplete');
                    }
                });
            } else {
                // Previous days - disabled
                button.setAttribute('style', baseStyle + `
                    background: ${isDone ? '#10b981' : '#f3f4f6'};
                    border-color: ${isDone ? '#10b981' : '#d1d5db'};
                    color: ${isDone ? '#ffffff' : '#9ca3af'};
                    opacity: 0.7;
                `);
            }

            dayContainer.appendChild(button);

            // Add connecting line to the right of this circle (except for last item)
            if (index < days.length - 1) {
                const nextDayDone = days[index + 1].record?.done || false;
                const line = dayContainer.createEl('div');
                line.setAttribute('style', `
                    width: 15px;
                    height: 8px;
                    background: ${isDone && nextDayDone ? '#10b981' : '#d1d5db'};
                    position: absolute;
                    left: calc(50% + 22.5px);
                    top: calc(0.75em + 0.5em + 30px - 3px);
                    z-index: 1;
                `);
            }
        });
    }
}

