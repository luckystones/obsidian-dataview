import { Component } from 'obsidian';

/**
 * Interface for a file with tagged fields
 */
export interface TaggedFile {
    path: string;
    basename: string;
    source?: string;
    tagValues?: string[];
}

/**
 * Group of tagged files
 */
export interface TagGroup {
    [key: string]: TaggedFile[];
}

/**
 * Options for searching files with fields
 */
export interface FieldSearchOptions {
    year: number;
    searchPath?: string;
    component: Component;
    tag: string | string[];
    week?: number;
    month?: number;
    day?: number;
}

/**
 * Class for searching files with inline fields
 */
export class InlineFieldSearch {
    private app: any;

    constructor(app: any) {
        this.app = app;
    }

    /**
     * Extract highlights or other tagged content from file content
     * @param content The file content to search
     * @returns Array of extracted highlights
     */
    public extractHighlightsFromContent(content: string): string[] {
        const highlights: string[] = [];

        // Match content between highlight:: and next field or end of content
        const highlightRegex = /(?:highlight|feeling|tefekkur|sohbet|words)::(.+?)(?=\n\w+::|$)/gs;
        let match;

        while ((match = highlightRegex.exec(content)) !== null) {
            // Extract the highlight text
            const highlightText = match[1].trim();
            if (highlightText) {
                highlights.push(highlightText);
            }
        }

        return highlights;
    }

    /**
     * Search for files with specific fields in a particular time period
     * @param options Search options including year, week/month, tags, etc.
     * @returns Object containing tagged files grouped by day or other keys
     */
    public async searchFilesWithField(options: FieldSearchOptions): Promise<TagGroup> {
        const { year, week, month, day, searchPath = '', tag } = options;

        // Initialize result
        const result: TagGroup = {};

        try {
            // Get all markdown files from the vault
            const files = this.app.vault.getMarkdownFiles();

            // Filter files by path if searchPath is provided
            const filteredFiles = searchPath
                ? files.filter((file: any) => file.path.startsWith(searchPath))
                : files;

            // Process each file
            for (const file of filteredFiles) {
                // Check if the file matches our time period criteria
                const isMatch = await this.isFileInTimePeriod(file, year, week, month, day);
                if (!isMatch) continue;

                // Check if file has the required field(s)
                const fileFields = await this.getFileFields(file, tag);
                if (Object.keys(fileFields).length === 0) continue;

                // Determine the grouping key (e.g., day of week)
                const groupKey = await this.getGroupKeyForFile(file, week !== undefined);
                if (!groupKey) continue;

                // Initialize array for this key if needed
                if (!result[groupKey]) {
                    result[groupKey] = [];
                }

                // Add file to results with its fields
                for (const [fieldName, values] of Object.entries(fileFields)) {
                    result[groupKey].push({
                        path: file.path,
                        basename: file.basename,
                        source: fieldName,
                        tagValues: values
                    });
                }
            }

            return result;
        } catch (e) {
            console.error('Error searching files with fields:', e);
            return {};
        }
    }

    /**
     * Check if a file belongs to a specific time period
     * @param file The file to check
     * @param year The year to match
     * @param week Optional week number
     * @param month Optional month number (0-11)
     * @param day Optional day
     * @returns Boolean indicating if the file is in the time period
     */
    private async isFileInTimePeriod(
        file: any,
        year: number,
        week?: number,
        month?: number,
        day?: number
    ): Promise<boolean> {
        // Parse date from filename (expecting format YYYY-MM-DD for daily notes)
        const match = file.basename.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!match) return false;

        const fileYear = parseInt(match[1]);
        const fileMonth = parseInt(match[2]) - 1; // JS months are 0-indexed
        const fileDay = parseInt(match[3]);

        const fileDate = new Date(fileYear, fileMonth, fileDay);

        // Check year match
        if (fileYear !== year) return false;

        // Check month match if provided
        if (month !== undefined && fileMonth !== month) return false;

        // Check day match if provided
        if (day !== undefined && fileDay !== day) return false;

        // Check week match if provided
        if (week !== undefined) {
            const fileWeek = this.getWeekNumber(fileDate);
            return fileWeek === week;
        }

        return true;
    }

    /**
     * Get week number for a date
     * @param date The date to get week number for
     * @returns Week number (1-53)
     */
    private getWeekNumber(date: Date): number {
        // Copy date to avoid modifying the original
        const d = new Date(date);

        // Set to nearest Thursday (makes week number consistent)
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);

        // Get first day of year
        const yearStart = new Date(d.getFullYear(), 0, 1);

        // Calculate week number: Week 1 is the 1st week with the year's first Thursday
        const weekNum = Math.floor(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7) + 1;

        return weekNum;
    }

    /**
     * Get fields and their values from a file
     * @param file The file to extract fields from
     * @param tags The field names to look for
     * @returns Object with field names as keys and arrays of values
     */
    private async getFileFields(file: any, tags: string | string[]): Promise<Record<string, string[]>> {
        const fields: Record<string, string[]> = {};
        const tagArray = Array.isArray(tags) ? tags : [tags];

        try {
            // Read file content
            const content = await this.app.vault.read(file);

            // Process each tag
            for (const tag of tagArray) {
                // Match pattern like "tag:: value" or "tag:: value1, value2"
                const regex = new RegExp(`${tag}::(.+?)(?=\\n\\w+::|$)`, 'gs');
                let match;

                const values: string[] = [];

                while ((match = regex.exec(content)) !== null) {
                    const value = match[1].trim();
                    if (value) {
                        // Split by commas if multiple values
                        const valueItems = value.split(',').map(v => v.trim());
                        values.push(...valueItems);
                    }
                }

                if (values.length > 0) {
                    fields[tag] = values;
                }
            }

            return fields;
        } catch (e) {
            console.error(`Error getting fields from file ${file.path}:`, e);
            return {};
        }
    }

    /**
     * Determine the grouping key for a file (e.g., day of week)
     * @param file The file to get key for
     * @param useWeekday Whether to use weekday names
     * @returns The grouping key
     */
    private async getGroupKeyForFile(file: any, useWeekday: boolean): Promise<string | null> {
        // Parse date from filename
        const match = file.basename.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!match) return null;

        const year = parseInt(match[1]);
        const month = parseInt(match[2]) - 1; // JS months are 0-indexed
        const day = parseInt(match[3]);

        const fileDate = new Date(year, month, day);

        if (useWeekday) {
            // Return day of week name
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            return days[fileDate.getDay()];
        } else {
            // Return day of month
            return fileDate.getDate().toString();
        }
    }
} 