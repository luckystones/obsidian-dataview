import { DataviewApi } from 'index';
import { App, Component, TFile } from 'obsidian';

/**
 * Interface for a file with tagged fields
 */
export interface TaggedFile {
    path: string;
    basename: string;
    source?: string;
    tagValues?: string[];
    // TFile properties that might be needed
    name?: string;
    extension?: string;
    stat?: any;
    vault?: any;
    parent?: any;
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
    private dv: any;

    constructor(app: App, dv: DataviewApi) {
        this.app = app;
        // Get dataview API if available
        this.dv = dv;
    }


    /**
     * Search for files with specific fields in a particular time period
     * @param options Search options including year, week/month, tags, etc.
     * @returns Object containing tagged files grouped by day or other keys
     */
    public async searchFilesWithField(options: FieldSearchOptions): Promise<TagGroup> {
        const { year, week, month, day, searchPath = "daily", tag } = options;

        // Calculate date range based on the provided parameters
        const { startDate, endDate } = this.calculateDateRange(year, week, month, day);

        // Use the findFilesWithFields method to search for files
        const matchingFiles = await this.findFilesWithFields(tag, searchPath, startDate, endDate);

        // Group files by day or date
        const result: TagGroup = {};

        for (const file of matchingFiles) {
            // Determine the group key (e.g., day of week or day of month)
            const groupKey = this.getGroupKeyForFile(file, week !== undefined);

            if (!groupKey) continue;

            // Initialize array for this key if needed
            if (!result[groupKey]) {
                result[groupKey] = [];
            }

            // Add file to results
            result[groupKey].push(file);
        }

        return result;
    }

    /**
     * Calculate the date range for searching files
     * @param year The year
     * @param week Optional week number
     * @param month Optional month number (0-11)
     * @param day Optional day
     * @returns Object with startDate and endDate
     */
    private calculateDateRange(
        year: number,
        week?: number,
        month?: number,
        day?: number
    ): { startDate: Date, endDate: Date } {
        let startDate: Date;
        let endDate: Date;

        if (week !== undefined) {
            // Weekly range
            startDate = this.getFirstDayOfWeek(year, week);
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6); // 7 days in a week
        } else if (month !== undefined) {
            // Monthly range
            startDate = new Date(year, month, 1);
            endDate = new Date(year, month + 1, 0); // Last day of month
        } else if (day !== undefined) {
            // Single day
            startDate = new Date(year, 0, day);
            endDate = new Date(startDate);
        } else {
            // Full year
            startDate = new Date(year, 0, 1);
            endDate = new Date(year, 11, 31);
        }

        // Set time to beginning and end of day
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        return { startDate, endDate };
    }

    /**
     * Get the first day (Monday) of a specific week in a year
     * @param year The year
     * @param week The week number (1-53)
     * @returns Date object for the first day of the week
     */
    private getFirstDayOfWeek(year: number, week: number): Date {
        // Start with Jan 1
        const date = new Date(year, 0, 1);

        // Get the day of the week (0 = Sunday, 1 = Monday, etc.)
        const dayOfWeek = date.getDay() || 7; // Convert Sunday from 0 to 7

        // Calculate days to add to get to the first Monday
        // If already Monday, add 0, otherwise add (8 - dayOfWeek)
        const daysToAdd = dayOfWeek === 1 ? 0 : (8 - dayOfWeek);

        // Add days to get to the first Monday of year
        date.setDate(date.getDate() + daysToAdd);

        // Add (week - 1) * 7 days to get to the desired week
        date.setDate(date.getDate() + (week - 1) * 7);

        return date;
    }

    /**
     * Extract date from file path
     * @param path The file path
     * @returns Date object or null if no date found
     */
    private getFileDateFromPath(path: string): Date | null {
        // Match YYYY-MM-DD pattern in the path
        const match = path.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (!match) return null;

        const year = parseInt(match[1]);
        const month = parseInt(match[2]) - 1; // 0-indexed months
        const day = parseInt(match[3]);

        return new Date(year, month, day);
    }

    /**
     * Determine the grouping key for a file (e.g., day of week or day of month)
     * @param file The file to get key for
     * @param useWeekday Whether to use weekday names
     * @returns The grouping key
     */
    private getGroupKeyForFile(file: TaggedFile, useWeekday: boolean): string | null {
        // Extract date from file path
        const fileDate = this.getFileDateFromPath(file.path);
        if (!fileDate) return null;

        if (useWeekday) {
            // Return day of week name
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            return days[fileDate.getDay()];
        } else {
            // Return day of month
            return fileDate.getDate().toString();
        }
    }

    /**
     * Finds files with specific inline fields in the given path within a date range
     * @param fieldNames Array of field names to search for
     * @param searchPath The path to search for files in
     * @param startDate The start date of the search range
     * @param endDate The end date of the search range
     * @returns An array of files matching the criteria
     */
    private async findFilesWithFields(
        fieldNames: string | string[],
        searchPath: string,
        startDate: Date,
        endDate: Date
    ): Promise<TaggedFile[]> {
        try {
            // Ensure fieldNames is an array
            const fieldNamesArray = Array.isArray(fieldNames) ? fieldNames : [fieldNames];

            // Use DataView's pages API instead of direct vault access
            // This is more efficient as it uses DataView's cached metadata
            const pages = this.dv?.pages('"daily"') || [];

            // If no pages found, return empty array
            if (!pages || pages.length === 0) {
                return [];
            }

            // Filter files by date and inline field
            const matchingFiles: TaggedFile[] = [];

            // Process each page from the search results
            for (const page of pages.values) {
                // Skip if page doesn't have file info
                if (!page || typeof page !== 'object' || !page.file || typeof page.file !== 'object' || !page.file.path) {
                    continue;
                }

                // Get the file from the page
                const filePath = page.file.path;
                const file = this.app.vault.getAbstractFileByPath(filePath);
                if (!file || !(file instanceof TFile)) {
                    continue;
                }

                // Check if file date is within range
                const fileDate = this.getFileDateFromPath(file.path);
                if (!fileDate || fileDate < startDate || fileDate > endDate) {
                    continue;
                }

                // For each field name, collect values separately
                const fieldEntries: { fieldName: string, values: string[] }[] = [];

                // First check if the fields exist in dataview's cached metadata
                for (const fieldName of fieldNamesArray) {
                    if (page[fieldName] !== undefined) {
                        // Extract values for this field
                        const fieldValues: string[] = [];

                        // Extract values if it's an array or convert to string if it's not
                        if (Array.isArray(page[fieldName])) {
                            fieldValues.push(...page[fieldName].map((v: any) => String(v)));
                        } else {
                            const value = String(page[fieldName]).trim();
                            if (value) {
                                fieldValues.push(value);
                            }
                        }

                        if (fieldValues.length > 0) {
                            fieldEntries.push({
                                fieldName,
                                values: fieldValues
                            });
                        }
                    }
                }

                // If no fields found in metadata, check file content directly
                if (fieldEntries.length === 0) {
                    try {
                        // Read file content
                        const content = await this.app.vault.read(file);

                        // Check each field name in content
                        for (const fieldName of fieldNamesArray) {
                            const fieldValues: string[] = [];

                            // Use the improved regex pattern that stops at:
                            // - Next field (any word followed by ::)
                            // - Heading (# symbols)
                            // - Code block (triple backticks)
                            // - Blank line
                            // - End of content
                            const fieldRegex = new RegExp(`${fieldName}::(.+?)(?=\\n\\S+::|\\n#+\\s|\\n\`\`\`|\\n\\n|$)`, 'gs');
                            let match;

                            while ((match = fieldRegex.exec(content)) !== null) {
                                const value = match[1].trim();
                                if (value) {
                                    // Don't split by commas for most fields except feeling
                                    if (fieldName === 'feeling') {
                                        // Split by commas if multiple values
                                        const valueItems = value.split(',').map(v => v.trim());
                                        fieldValues.push(...valueItems);
                                    } else {
                                        fieldValues.push(value);
                                    }
                                }
                            }

                            // Also check frontmatter for the field
                            const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
                            if (frontmatterMatch && frontmatterMatch[1]) {
                                const frontmatter = frontmatterMatch[1];

                                // Look for fieldName: in frontmatter
                                const fieldLineRegex = new RegExp(`${fieldName}\\s*:(.*?)($|\\n)`, 'i');
                                const fieldLineMatch = frontmatter.match(fieldLineRegex);

                                if (fieldLineMatch && fieldLineMatch[1]) {
                                    const value = fieldLineMatch[1].trim();

                                    if (value) {
                                        // Handle array values in YAML [item1, item2] format
                                        if (value.startsWith('[') && value.endsWith(']')) {
                                            // Simple splitting - for more complex YAML you'd need a parser
                                            const items = value.slice(1, -1).split(',');
                                            for (const item of items) {
                                                const cleanItem = item.trim();
                                                if (cleanItem) {
                                                    fieldValues.push(cleanItem);
                                                }
                                            }
                                        } else {
                                            fieldValues.push(value);
                                        }
                                    }
                                }
                            }

                            // If we found values for this field, add to our entries
                            if (fieldValues.length > 0) {
                                fieldEntries.push({
                                    fieldName,
                                    values: fieldValues
                                });
                            }
                        }
                    } catch (e) {
                        console.error("Error reading file content:", e);
                    }
                }

                // Create a separate TaggedFile for each field type
                for (const entry of fieldEntries) {
                    // Create a tagged file with necessary properties
                    const taggedFile: TaggedFile = {
                        path: file.path,
                        name: file.name,
                        basename: file.basename,
                        extension: file.extension,
                        tagValues: [...entry.values],
                        source: entry.fieldName
                    };

                    matchingFiles.push(taggedFile);
                }
            }

            return matchingFiles;
        } catch (e) {
            console.error('Error in findFilesWithFields:', e);
            return [];
        }
    }
} 