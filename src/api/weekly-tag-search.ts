import { Component, Notice, TFile } from 'obsidian';
import { DataviewApi } from './plugin-api';
import { DayOfWeek } from './weekly-task-search';
import { WeekUtils } from './WeekUtils';

export interface TaggedFile extends TFile {
    /** The values of the tag if the tag has values (e.g. #tag/value1/value2) */
    tagValues?: string[];
}

export interface WeeklyTagGroup {
    Monday: TaggedFile[];
    Tuesday: TaggedFile[];
    Wednesday: TaggedFile[];
    Thursday: TaggedFile[];
    Friday: TaggedFile[];
    Saturday: TaggedFile[];
    Sunday: TaggedFile[];
}

export interface WeeklyTagOptions {
    /** The year to search for */
    year: number;
    /** The week number to search for (1-52) */
    week: number;
    /** The tag to search for (without the # prefix) */
    tag: string;
    /** The path to search for files in. Defaults to "/daily" */
    searchPath?: string;
    /** The filename to use for rendering (format: YYYY-WW). If not provided, will be generated from year and week */
    filename?: string;
    /** The component to use for rendering. Required for rendering results. */
    component?: Component;
    /** The container to render results in. Required for rendering results. */
    container?: HTMLElement;
}


export class WeeklyTagApi {
    private dv: DataviewApi;

    constructor(dv: DataviewApi) {
        this.dv = dv;
    }

    /**
     * Gets the filename from options or determines it from the active file
     * @param options Options containing year, week, and optional filename
     * @returns The filename in YYYY-WW format
     */
    private getFilenameFromOptions(options: WeeklyTagOptions): string {
        const { year, week, filename: optionsFilename } = options;

        // If filename is provided in options, use it
        if (optionsFilename) {
            return optionsFilename;
        }

        // If year and week are provided, use them to create the filename
        if (year && week) {
            return `${year}-W${week}`;
        }

        // Otherwise try to get active file name
        const activeFileName = this.dv.app.workspace.getActiveFile()?.name;
        if (!activeFileName) {
            throw new Error('Could not determine current file and no year/week provided');
        }

        return activeFileName;
    }


    public async searchFilesWithTag(options: WeeklyTagOptions): Promise<WeeklyTagGroup> {
        const {
            year,
            week,
            tag,
            searchPath = "daily",
        } = options;

        // Get filename using the extracted method
        const filename = this.getFilenameFromOptions(options);

        console.log("🐞 searchFilesWithTag", filename);

        try {
            // Parse year and week from filename if they weren't provided directly
            let yearToUse = year;
            let weekToUse = week;

            if (!yearToUse || !weekToUse) {
                const yearWeek = WeekUtils.parseYearAndWeekFromFilename(filename);
                if (!yearWeek) {
                    throw new Error('Invalid filename format. Expected YYYY-WW');
                }

                yearToUse = yearWeek.year;
                weekToUse = yearWeek.week;
            }

            // Get the date range for the week
            const { firstMonday, lastSunday } = WeekUtils.getWeekDateRange(yearToUse, weekToUse);

            // Search for files with the tag in the given path
            const files = await this.findFilesWithTag(tag, searchPath, firstMonday, lastSunday);

            // Group the files by day of week
            const groupedFiles = this.groupFilesByDay(files);

            return groupedFiles;
        } catch (e) {
            console.error('Error in searchFilesWithTag:', e);
            new Notice(`Error searching for files with tag #${tag}: ${e.message}`);

            // Return empty groups
            return this.createEmptyWeeklyTagGroup();
        }
    }

    /**
     * Finds files with a specific tag in the given path within a date range
     * @param tag The tag to search for (without the # prefix)
     * @param searchPath The path to search for files in
     * @param startDate The start date of the search range
     * @param endDate The end date of the search range
     * @returns An array of files matching the criteria
     */
    private async findFilesWithTag(
        tag: string,
        searchPath: string,
        startDate: Date,
        endDate: Date
    ): Promise<TaggedFile[]> {
        console.log("🐞 findFilesWithTag", tag, searchPath, startDate, endDate);
        try {
            // Ensure tag doesn't have # prefix
            const cleanTag = tag.startsWith('#') ? tag.substring(1) : tag;

            // Use DataView's pages API instead of direct vault access
            // This is more efficient as it uses DataView's cached metadata
            const pages = this.dv.pages(`"${searchPath}"`);

            // If no pages found, return empty array
            if (!pages || pages.length === 0) {
                return [];
            }

            // Filter files by date and tag
            const matchingFiles: TaggedFile[] = [];

            console.log("🐞 pages", pages);
            // Process each page from the search results
            for (const page of pages.values) {
                // Skip if page doesn't have file info
                if (!page || typeof page !== 'object' || !page.file || typeof page.file !== 'object' || !page.file.path) {
                    console.log("🐞 page is not a valid object", page);
                    continue;
                }

                // Get the file from the page
                const filePath = page.file.path;
                const file = this.dv.app.vault.getAbstractFileByPath(filePath);
                if (!file || !(file instanceof TFile)) {
                    console.log("🐞 file is not a TFile", file);
                    continue;
                }

                // Check if file date is within range
                const fileDate = this.getFileDateFromPath(file.path);
                if (!fileDate || fileDate < startDate || fileDate > endDate) {
                    // console.log("🐞 file is not in the date range", fileDate);
                    continue;
                }

                // Check if page has the tag
                let hasMatchingTag = false;
                let matchingTagValues: string[] = [];

                // Look for tags in the page tags field
                if (page.file.tags && Array.isArray(page.file.tags)) {
                    console.log("🐞 page.file.tags", page.file.tags);
                    // DataView returns tags without the # prefix
                    for (const pageTag of page.file.tags) {
                        // Convert to string in case it's not already
                        const tagStr = String(pageTag).toLowerCase();

                        console.log("🐞 checking if tagStr: ", tagStr, "is a match", cleanTag.toLowerCase());
                        if (tagStr === cleanTag.toLowerCase() ||
                            tagStr.startsWith(`${cleanTag.toLowerCase()}/`)) {

                            console.log("🐞 hasMatchingTag", tagStr);
                            hasMatchingTag = true;

                            // Extract values from hierarchical tags
                            if (tagStr.includes('/')) {
                                console.log("🐞 tagStr.includes('/')", tagStr);
                                const tagPrefix = `${cleanTag.toLowerCase()}/`;
                                if (tagStr.startsWith(tagPrefix)) {
                                    // Extract values part (everything after tag/)
                                    const valuesStr = tagStr.substring(tagPrefix.length);
                                    // Split by / to get individual values
                                    const values = valuesStr.split('/').filter(v => v.trim() !== '');

                                    // Add to values array
                                    if (values.length > 0) {
                                        matchingTagValues.push(...values);
                                    }
                                }
                            }
                        }
                    }
                }

                if (hasMatchingTag) {
                    // Create a tagged file by extending the TFile
                    const taggedFile = file as TaggedFile;

                    // Add the tag values
                    taggedFile.tagValues = matchingTagValues;

                    matchingFiles.push(taggedFile);
                }
            }

            return matchingFiles;
        } catch (e) {
            console.error('Error in findFilesWithTag:', e);
            return [];
        }
    }

    /**
     * Groups files by day of week
     * @param files The files to group
     * @param weekStart The start date of the week
     * @param weekEnd The end date of the week
     * @returns Files grouped by day of week
     */
    private groupFilesByDay(files: TaggedFile[]): WeeklyTagGroup {
        const result: WeeklyTagGroup = this.createEmptyWeeklyTagGroup();

        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

        files.forEach(file => {
            const fileDate = this.getFileDateFromPath(file.path);
            if (!fileDate) return;

            const dayIndex = fileDate.getDay();
            const dayName = days[dayIndex] as DayOfWeek;

            result[dayName].push(file);
        });

        return result;
    }

    /**
     * Creates an empty weekly tag group
     * @returns An empty weekly tag group
     */
    private createEmptyWeeklyTagGroup(): WeeklyTagGroup {
        return {
            Monday: [] as TaggedFile[],
            Tuesday: [] as TaggedFile[],
            Wednesday: [] as TaggedFile[],
            Thursday: [] as TaggedFile[],
            Friday: [] as TaggedFile[],
            Saturday: [] as TaggedFile[],
            Sunday: [] as TaggedFile[]
        };
    }

    /**
     * Extracts a date from a file path
     * Assumes files in daily folder follow a naming pattern like: YYYY-MM-DD.md
     * @param filePath The file path
     * @returns A Date object or undefined if no date can be extracted
     */
    private getFileDateFromPath(filePath: string): Date | undefined {
        try {
            // Extract filename without extension
            const filename = filePath.split('/').pop()?.split('.')[0];
            if (!filename) return undefined;

            // Check if filename matches date pattern YYYY-MM-DD
            const dateMatch = filename.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (!dateMatch) return undefined;

            const year = parseInt(dateMatch[1]);
            const month = parseInt(dateMatch[2]) - 1; // JS months are 0-indexed
            const day = parseInt(dateMatch[3]);

            return new Date(year, month, day);
        } catch (e) {
            console.error('Error extracting date from file path:', e);
            return undefined;
        }
    }

    /**
     * Renders the weekly tag search results as a simple HTML list
     * @param files The grouped files by day of week
     * @param container The container to render the results in
     * @returns The container with the rendered results
     */
    public renderWeeklyTagResults(
        files: WeeklyTagGroup,
        container: HTMLElement
    ): HTMLElement {
        // Create container for the weekly view
        const weeklyContainer = container.createEl('div');
        weeklyContainer.setAttribute('style', 'margin: 1em 0; padding: 10px; border-radius: 6px;');

        // Render each day of the week
        const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

        days.forEach(day => {
            const dayFiles = files[day];
            if (dayFiles.length === 0) return; // Skip empty days

            // Create day container
            const dayContainer = weeklyContainer.createEl('div');
            dayContainer.setAttribute('style', `
                margin-bottom: 1em;
                padding: 8px 12px;
                border-radius: 6px;
                background: rgba(30, 41, 59, 0.1);
            `);

            // Add day header
            const dayHeader = dayContainer.createEl('h3');
            dayHeader.textContent = day;
            dayHeader.setAttribute('style', `
                margin: 0 0 8px 0;
                color: #5899D6;
                font-size: 1.1em;
                font-weight: 600;
            `);

            // Add files list
            const filesList = dayContainer.createEl('ul');
            filesList.setAttribute('style', `
                margin: 0;
                padding-left: 20px;
                list-style-type: disc;
            `);

            dayFiles.forEach(file => {
                const fileItem = filesList.createEl('li');

                // Create file link
                const fileLink = fileItem.createEl('a');
                fileLink.textContent = file.basename;
                fileLink.setAttribute('href', file.path);
                fileLink.setAttribute('style', `
                    color: #60A5FA;
                    text-decoration: none;
                    font-weight: 500;
                `);

                // Add click handler
                fileLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.dv.app.workspace.openLinkText(file.path, '', false);
                });

                // Display tag values if they exist
                if (file.tagValues && file.tagValues.length > 0) {
                    const tagValuesContainer = fileItem.createEl('div');
                    tagValuesContainer.setAttribute('style', `
                        margin-top: 4px;
                        margin-left: 4px;
                        display: flex;
                        flex-wrap: wrap;
                        gap: 4px;
                    `);

                    file.tagValues.forEach(value => {
                        const tagValue = tagValuesContainer.createEl('span');
                        tagValue.textContent = value;
                        tagValue.setAttribute('style', `
                            background-color: rgba(96, 165, 250, 0.2);
                            color: #3b82f6;
                            padding: 2px 6px;
                            border-radius: 4px;
                            font-size: 0.8em;
                            font-weight: 500;
                        `);
                    });
                }
            });
        });

        return weeklyContainer;
    }

    /**
     * Extracts highlights from file content
     * Looks for highlights in formats like:
     * - Highlights: ...
     * - "> ..." (block quotes)
     * - "==highlighted text=="
     * @param content The file content
     * @returns Array of extracted highlights
     */
    public extractHighlightsFromContent(content: string): string[] {
        const highlights: string[] = [];

        // Try to find highlights section
        const highlightsSection = content.match(/(?:#+\s*Highlights|Highlights:)([\s\S]*?)(?:(?:#+\s*)|$)/i);
        if (highlightsSection && highlightsSection[1]) {
            const section = highlightsSection[1].trim();

            // Look for bullet points in the highlights section
            const bulletPoints = section.split(/\n- |\n\* /);
            if (bulletPoints.length > 1) {
                // Skip the first element which is empty or garbage
                for (let i = 1; i < bulletPoints.length; i++) {
                    const highlight = bulletPoints[i].trim();
                    if (highlight) {
                        highlights.push(highlight);
                    }
                }
            }
        }

        // If no specific highlights section, look for block quotes
        if (highlights.length === 0) {
            const blockQuotes = content.match(/(?:^|\n)> (.*?)(?:$|\n(?!>))/g);
            if (blockQuotes) {
                blockQuotes.forEach(quote => {
                    // Remove the "> " prefix
                    const cleanQuote = quote.replace(/^> |(?:\n> )/g, '').trim();
                    if (cleanQuote) {
                        highlights.push(cleanQuote);
                    }
                });
            }
        }

        // Look for highlighted text (==text==)
        const highlightedText = content.match(/==(.*?)==/g);
        if (highlightedText) {
            highlightedText.forEach(highlight => {
                // Remove the == markers
                const cleanHighlight = highlight.replace(/^==|==$|==/g, '').trim();
                if (cleanHighlight) {
                    highlights.push(cleanHighlight);
                }
            });
        }

        return highlights;
    }
} 