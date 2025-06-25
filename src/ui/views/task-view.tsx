import { setEmojiShorthandCompletionField, setInlineField } from "data-import/inline-field";
import { LIST_ITEM_REGEX } from "data-import/markdown-file";
import { SListEntry, SListItem, STask } from "data-model/serialized/markdown";
import { GroupElement, Grouping, Groupings } from "data-model/value";
import { DateTime } from "luxon";
import { MarkdownRenderChild, Menu, Notice, Platform, Vault } from "obsidian";
import { Fragment, h } from "preact";
import { useContext, useState, useEffect, useRef } from "preact/hooks";
import { executeTask } from "query/engine";
import { Query } from "query/query";
import {
    DataviewContext,
    DataviewInit,
    ErrorMessage,
    ErrorPre,
    Lit,
    Markdown,
    ReactRenderer,
    useIndexBackedState,
} from "ui/markdown";
import { asyncTryOrPropagate } from "util/normalize";

// Simple Preact date picker component
function DatePicker({ onSelect, onClose, initialDate = '', position = { x: 0, y: 0 } }: {
    onSelect: (date: string) => void,
    onClose: () => void,
    initialDate?: string,
    position?: { x: number, y: number }
}) {
    const inputRef = useRef<HTMLInputElement>(null);

    // Function to handle date change
    const handleDateChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target.value) {
            onSelect(target.value);
            onClose();
        }
    };

    // When the component mounts, directly click to open the calendar
    useEffect(() => {
        if (inputRef.current) {
            // Focus and click to open the native calendar
            inputRef.current.focus();
            inputRef.current.showPicker();

            // Listen for changes directly on the input
            inputRef.current.addEventListener('change', handleDateChange);
        }

        return () => {
            if (inputRef.current) {
                inputRef.current.removeEventListener('change', handleDateChange);
            }
        };
    }, []);

    // Handle events to prevent propagation
    const stopPropagation = (e: Event) => {
        e.stopPropagation();
    };

    return (
        <div
            className="dataview-date-picker"
            style={{
                position: 'fixed',
                zIndex: 1000,
                top: `${position.y}px`,
                left: `${position.x}px`,
                opacity: 0.01, // Nearly invisible container
                width: '1px',  // Minimal size
                height: '1px'
            }}
            onClick={stopPropagation}
            onMouseDown={stopPropagation}
        >
            <input
                ref={inputRef}
                type="date"
                defaultValue={initialDate || DateTime.now().toFormat('yyyy-MM-dd')}
                style={{
                    opacity: 0.01,
                }}
            />
        </div>
    );
}

/** Function used to test if a given event correspond to a pressed link */
function wasLinkPressed(evt: preact.JSX.TargetedMouseEvent<HTMLElement>): boolean {
    return evt.target != null && evt.target != undefined && (evt.target as HTMLElement).tagName == "A";
}

/** JSX component which renders a task element recursively. */
function TaskItem({ item }: { item: STask }) {
    let context = useContext(DataviewContext);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [datePickerPosition, setDatePickerPosition] = useState({ x: 0, y: 0 });

    // Schedule task function (moved outside onContextMenu handler)
    async function scheduleTask(vault: Vault, daysToAdd: number, customDate?: string) {
        // If custom date is provided, use it directly
        if (customDate) {
            updateTaskWithDates(customDate);
            return;
        }

        // Determine which text property contains dates
        const referenceText = getReferenceText(item);
        console.log("Using reference text:", referenceText);

        // Extract existing dates from the reference text
        console.log("Item:", item);
        const existingDates = extractDatesFromTask(referenceText);
        console.log("Existing dates:", existingDates);

        // Determine reference date with priority: completion > due > scheduled > today
        let referenceDate: DateTime;
        if (existingDates.completion) {
            referenceDate = DateTime.fromISO(existingDates.completion);
            console.log("Using completion date as reference:", existingDates.completion);
        } else if (existingDates.due) {
            referenceDate = DateTime.fromISO(existingDates.due);
            console.log("Using due date as reference:", existingDates.due);
        } else if (existingDates.scheduled) {
            referenceDate = DateTime.fromISO(existingDates.scheduled);
            console.log("Using scheduled date as reference:", existingDates.scheduled);
        } else {
            referenceDate = DateTime.now();
            console.log("No existing dates found, using today as reference");
        }

        // Calculate new date based on reference date
        const newDate = referenceDate.plus({ days: daysToAdd }).toFormat("yyyy-MM-dd");
        console.log("New date calculated:", newDate);

        // Update the task with the new date
        updateTaskWithDates(newDate);
    }

    // Function to determine which text property contains dates
    function getReferenceText(task: STask): string {
        // Check if originalText property exists and contains dates
        if (task.originalText && containsDatePatterns(task.originalText)) {
            return task.originalText;
        }
        // Check if text property contains dates
        else if (containsDatePatterns(task.text)) {
            return task.text;
        }
        // Default to originalText if it exists, otherwise use text
        else {
            return task.originalText || task.text;
        }
    }

    // Function to check if text contains any date patterns
    function containsDatePatterns(text: string): boolean {
        const datePatterns = [
            /\[(due|scheduled|completion|start|created)::\s*\d{4}-\d{2}-\d{2}\]/,  // Inline field
            /[📅⏳✅🛫⊕]\s*\d{4}-\d{2}-\d{2}/  // Emoji shorthand
        ];

        return datePatterns.some(pattern => pattern.test(text));
    }

    // Function to update the task with new dates
    function updateTaskWithDates(dateStr: string) {
        let updatedText: string;
        const isCompleted = item.status === "x";

        // Use the same reference text for updating
        const textToUpdate = getReferenceText(item);
        const useEmojiFormat = detectEmojiDateFormat(textToUpdate);

        if (useEmojiFormat) {
            updatedText = updateEmojiDates(textToUpdate, dateStr, isCompleted);
        } else {
            // Update due date
            let textWithDueDate = setInlineField(textToUpdate, "due", dateStr);

            // If task is completed, also update completion date
            if (isCompleted) {
                updatedText = setInlineField(textWithDueDate, "completion", dateStr);
            } else {
                updatedText = setInlineField(textWithDueDate, "scheduled", dateStr);
            }
        }

        console.log("Reference text:", textToUpdate);
        console.log("Updated text:", updatedText);

        // Rewrite the task with updated text
        rewriteTaskForScheduled(context.app.vault, item, item.status, updatedText).then(() => {
            // Show a notice
            new Notice(`Task ${isCompleted ? "completed and " : ""}scheduled for ${dateStr}`);

            // Refresh dataview
            context.app.workspace.trigger("dataview:refresh-views");
        });
    }

    // Navigate to the given task on click.
    const onClicked = (evt: preact.JSX.TargetedMouseEvent<HTMLElement>) => {
        if (wasLinkPressed(evt)) {
            return;
        }

        // Don't navigate if date picker is shown
        if (showDatePicker) {
            return;
        }

        // Check if click was inside date picker (by className)
        if (evt.target && (evt.target as HTMLElement).closest('.dataview-date-picker')) {
            evt.stopPropagation();
            return;
        }

        evt.stopPropagation();
        const selectionState = {
            eState: {
                cursor: {
                    from: { line: item.line, ch: item.position.start.col },
                    to: { line: item.line + item.lineCount - 1, ch: item.position.end.col },
                },
                line: item.line,
            },
        };

        // MacOS interprets the Command key as Meta.
        context.app.workspace.openLinkText(
            item.link.toFile().obsidianLink(),
            item.path,
            evt.ctrlKey || (evt.metaKey && Platform.isMacOS),
            selectionState as any
        );
    };

    // Check/uncheck the task in the original file.
    const onChecked = (evt: preact.JSX.TargetedEvent<HTMLInputElement>) => {
        evt.stopPropagation();
        const completed = evt.currentTarget.checked;
        const status = completed ? "x" : " ";
        // Update data-task on the parent element (css style)
        const parent = evt.currentTarget.parentElement;
        parent?.setAttribute("data-task", status);

        let flatted: STask[] = [item];

        if (context.settings.recursiveSubTaskCompletion) {
            function flatter(iitem: STask | SListItem) {
                flatted.push(iitem as STask);
                iitem.children.forEach(flatter);
            }
            item.children.forEach(flatter);
            flatted = flatted.flat(Infinity);
        }

        async function effectFn() {
            for (let i = 0; i < flatted.length; i++) {
                const _item = flatted[i];
                let updatedText: string = _item.text;
                if (context.settings.taskCompletionTracking) {
                    updatedText = setTaskCompletion(
                        _item.text,
                        context.settings.taskCompletionUseEmojiShorthand,
                        context.settings.taskCompletionText,
                        context.settings.taskCompletionDateFormat,
                        completed
                    );
                }
                await rewriteTask(context.app.vault, _item, status, updatedText);
            }
            context.app.workspace.trigger("dataview:refresh-views");
        }
        effectFn();
    };

    // Show context menu with scheduling options on right click
    const onContextMenu = (evt: preact.JSX.TargetedMouseEvent<HTMLElement>) => {
        evt.preventDefault();
        evt.stopPropagation();

        const menu = new Menu();

        // Header for scheduling options
        menu.addItem((item) => {
            item.setTitle("Reschedule Relative to Task Date")
                .setDisabled(true);
        });

        // Custom date
        menu.addItem((item) => {
            item.setTitle("Specific date...")
                .onClick((event) => {
                    // Stop propagation to prevent parent click handlers from firing
                    if (event) {
                        event.stopPropagation();
                        event.preventDefault();
                    }

                    // Position the date picker near where the user clicked
                    setDatePickerPosition({
                        x: evt.clientX,
                        y: evt.clientY - 100
                    });
                    setShowDatePicker(true);
                });
        });

        // TODAY
        menu.addItem((item) => {
            item.setTitle("Today")
                .onClick(() => {
                    const today = DateTime.now().toFormat("yyyy-MM-dd");
                    scheduleTask(context.app.vault, 0, today);
                });
        });
        // FUTURE OPTIONS - Move forward in time

        // 1 day later (tomorrow)
        menu.addItem((item) => {
            item.setTitle("+1")
                .onClick(() => scheduleTask(context.app.vault, 1));
        });

        // 3 days later
        menu.addItem((item) => {
            item.setTitle("+3")
                .onClick(() => scheduleTask(context.app.vault, 3));
        });

        // 1 week later
        menu.addItem((item) => {
            item.setTitle("+7")
                .onClick(() => scheduleTask(context.app.vault, 7));
        });

        // 2 weeks later
        menu.addItem((item) => {
            item.setTitle("+14")
                .onClick(() => scheduleTask(context.app.vault, 14));
        });

        // 1 month later
        menu.addItem((item) => {
            item.setTitle("+30")
                .onClick(() => scheduleTask(context.app.vault, 30));
        });


        // Separator
        menu.addSeparator();
        // 1 day earlier (yesterday)
        menu.addItem((item) => {
            item.setTitle("-1")
                .onClick(() => scheduleTask(context.app.vault, -1));
        });
        // PAST OPTIONS - Move backwards in time

        // 3 days earlier
        menu.addItem((item) => {
            item.setTitle("-3")
                .onClick(() => scheduleTask(context.app.vault, -3));
        });
        // 1 week earlier
        menu.addItem((item) => {
            item.setTitle("-7")
                .onClick(() => scheduleTask(context.app.vault, -7));
        });

        // 2 weeks earlier
        menu.addItem((item) => {
            item.setTitle("-14")
                .onClick(() => scheduleTask(context.app.vault, -14));
        });

        // 1 month earlier
        menu.addItem((item) => {
            item.setTitle("-30")
                .onClick(() => scheduleTask(context.app.vault, -30));
        });



        // Show the menu
        menu.showAtMouseEvent(evt);
    };

    const checked = item.status !== " ";
    return (
        <li
            class={"dataview task-list-item" + (checked ? " is-checked" : "")}
            onClick={onClicked}
            onContextMenu={onContextMenu}
            data-task={item.status}
        >
            <input class="dataview task-list-item-checkbox" type="checkbox" checked={checked} onClick={onChecked} />
            <Markdown inline={true} content={item.visual ?? item.text} sourcePath={item.path} />
            {item.children.length > 0 && <TaskList items={item.children} />}

            {/* Render the date picker when showDatePicker is true */}
            {showDatePicker && (
                <DatePicker
                    initialDate={DateTime.now().toFormat('yyyy-MM-dd')}
                    position={datePickerPosition}
                    onSelect={(date) => {
                        scheduleTask(context.app.vault, 0, date);
                        setShowDatePicker(false);
                    }}
                    onClose={() => setShowDatePicker(false)}
                />
            )}
        </li>
    );
}

/** JSX component which renders a plain list item recursively. */
function ListItem({ item }: { item: SListEntry }) {
    let context = useContext(DataviewContext);

    // Navigate to the given task on click.
    const onClicked = (evt: preact.JSX.TargetedMouseEvent<HTMLElement>) => {
        if (wasLinkPressed(evt)) {
            return;
        }

        evt.stopPropagation();
        const selectionState = {
            eState: {
                cursor: {
                    from: { line: item.line, ch: item.position.start.col },
                    to: { line: item.line + item.lineCount - 1, ch: item.position.end.col },
                },
                line: item.line,
            },
        };

        // MacOS interprets the Command key as Meta.
        context.app.workspace.openLinkText(
            item.link.toFile().obsidianLink(),
            item.path,
            evt.ctrlKey || (evt.metaKey && Platform.isMacOS),
            selectionState as any
        );
    };

    return (
        <li class="dataview task-list-basic-item" onClick={onClicked}>
            <Markdown inline={true} content={item.visual ?? item.text} sourcePath={item.path} />
            {item.children.length > 0 && <TaskList items={item.children} />}
        </li>
    );
}

/** JSX component which renders a list of task items recursively. */
function TaskList({ items }: { items: SListItem[] }) {
    const settings = useContext(DataviewContext).settings;
    if (items.length == 0 && settings.warnOnEmptyResult)
        return <ErrorMessage message="Dataview: No results to show for task query." />;

    let [nest, _mask] = nestItems(items);
    return (
        <ul class="contains-task-list">
            {nest.map(item =>
                item.task ? <TaskItem key={listId(item)} item={item} /> : <ListItem key={listId(item)} item={item} />
            )}
        </ul>
    );
}

/** JSX component which returns the result count. */
function ResultCount(props: { item: SListEntry | STask | GroupElement<SListEntry | STask> }) {
    const { settings } = useContext(DataviewContext);
    return settings.showResultCount ? (
        <span class="dataview small-text">{Groupings.count(props.item.rows)}</span>
    ) : (
        <Fragment></Fragment>
    );
}

/** JSX component which recursively renders grouped tasks. */
function TaskGrouping({ items, sourcePath }: { items: Grouping<SListItem>; sourcePath: string }) {
    const isGrouping = items.length > 0 && Groupings.isGrouping(items);

    return (
        <Fragment>
            {isGrouping &&
                items.map(item => (
                    <Fragment key={item.key}>
                        <h4>
                            <Lit value={item.key} sourcePath={sourcePath} />
                            <ResultCount item={item} />
                        </h4>
                        <div class="dataview result-group">
                            <TaskGrouping items={item.rows} sourcePath={sourcePath} />
                        </div>
                    </Fragment>
                ))}
            {!isGrouping && <TaskList items={items as SListItem[]} />}
        </Fragment>
    );
}

export type TaskViewState =
    | { state: "loading" }
    | { state: "error"; error: string }
    | { state: "ready"; items: Grouping<SListItem> };

/**
 * Pure view over (potentially grouped) tasks and list items which allows for checking/unchecking tasks and manipulating
 * the task view.
 */
export function TaskView({ query, sourcePath }: { query: Query; sourcePath: string }) {
    let context = useContext(DataviewContext);

    let items = useIndexBackedState<TaskViewState>(
        context.container,
        context.app,
        context.settings,
        context.index,
        { state: "loading" },
        async () => {
            let result = await asyncTryOrPropagate(() =>
                executeTask(query, sourcePath, context.index, context.settings)
            );
            if (!result.successful) return { state: "error", error: result.error, sourcePath };
            else return { state: "ready", items: result.value.tasks };
        }
    );

    if (items.state == "loading")
        return (
            <Fragment>
                <ErrorPre>Loading</ErrorPre>
            </Fragment>
        );
    else if (items.state == "error")
        return (
            <Fragment>
                <ErrorPre>Dataview: {items.error}</ErrorPre>
            </Fragment>
        );

    return (
        <div class="dataview dataview-container">
            <TaskGrouping items={items.items} sourcePath={sourcePath} />
        </div>
    );
}

export function createTaskView(init: DataviewInit, query: Query, sourcePath: string): MarkdownRenderChild {
    return new ReactRenderer(init, <TaskView query={query} sourcePath={sourcePath} />);
}

export function createFixedTaskView(
    init: DataviewInit,
    items: Grouping<SListItem>,
    sourcePath: string
): MarkdownRenderChild {
    return new ReactRenderer(init, <TaskGrouping items={items} sourcePath={sourcePath} />);
}

/////////////////////////
// Task De-Duplication //
/////////////////////////

function listId(item: SListItem): string {
    return item.path + ":" + item.line;
}

function parentListId(item: SListItem): string {
    return item.path + ":" + item.parent;
}

/** Compute a map of all task IDs -> tasks. */
function enumerateChildren(item: SListItem, output: Map<string, SListItem>): Map<string, SListItem> {
    if (!output.has(listId(item))) output.set(listId(item), item);
    for (let child of item.children) enumerateChildren(child, output);

    return output;
}

/** Replace basic tasks with tasks from a lookup map. Retains the original order of the list. */
function replaceChildren(elements: SListItem[], lookup: Map<string, SListItem>): SListItem[] {
    return elements.map(element => {
        element.children = replaceChildren(element.children, lookup);

        const id = listId(element);
        const map = lookup.get(id);

        if (map) return map;
        else return element;
    });
}

/**
 * Removes tasks from a list if they are already present by being a child of another task. Fixes child pointers.
 * Retains original order of input list.
 */
export function nestItems(raw: SListItem[]): [SListItem[], Set<string>] {
    let elements: Map<string, SListItem> = new Map();
    let mask: Set<string> = new Set();

    for (let elem of raw) {
        let id = listId(elem);
        elements.set(id, elem);
        mask.add(id);
    }

    // List all elements & their children in the lookup map.
    for (let elem of raw) enumerateChildren(elem, elements);

    let roots = raw.filter(
        elem => elem.parent == undefined || elem.parent == null || !elements.has(parentListId(elem))
    );
    return [replaceChildren(roots, elements), mask];
}

/**
 * Recursively removes tasks from each subgroup if they are already present by being a child of another task.
 * Fixes child pointers. Retains original order of input list.
 */
export function nestGroups(raw: Grouping<SListItem>): Grouping<SListItem> {
    if (Groupings.isGrouping(raw)) {
        return raw.map(g => {
            return { key: g.key, rows: nestGroups(g.rows) };
        });
    } else {
        return nestItems(raw)[0];
    }
}

///////////////////////
// Task Manipulation //
///////////////////////

/** Trim empty ending lines. */
function trimEndingLines(text: string): string {
    let parts = text.split(/\r?\n/u);
    let trim = parts.length - 1;
    while (trim > 0 && parts[trim].trim() == "") trim--;

    return parts.join("\n");
}

/** Set the task completion key on check. */
export function setTaskCompletion(
    originalText: string,
    useEmojiShorthand: boolean,
    completionKey: string,
    completionDateFormat: string,
    complete: boolean
): string {
    const blockIdRegex = /\^[a-z0-9\-]+/i;

    if (!complete && !useEmojiShorthand)
        return trimEndingLines(setInlineField(originalText.trimEnd(), completionKey)).trimEnd();

    let parts = originalText.split(/\r?\n/u);
    const matches = blockIdRegex.exec(parts[parts.length - 1]);
    console.debug("matchreg", matches);

    let processedPart = parts[parts.length - 1].split(blockIdRegex).join(""); // last part without block id
    if (useEmojiShorthand) {
        processedPart = setEmojiShorthandCompletionField(
            processedPart,
            complete ? DateTime.now().toFormat("yyyy-MM-dd") : ""
        );
    } else {
        processedPart = setInlineField(processedPart, completionKey, DateTime.now().toFormat(completionDateFormat));
    }
    processedPart = `${processedPart.trimEnd()}${matches?.length ? " " + matches[0].trim() : ""}`.trimEnd(); // add back block id
    parts[parts.length - 1] = processedPart;

    return parts.join("\n");
}

export async function rewriteTaskForScheduled(vault: Vault, task: STask, desiredStatus: string, desiredText?: string) {
    console.log("RIGHT CLICKED: rewriteTaskForScheduled", desiredStatus, desiredText);
    if (desiredText == undefined || desiredText == task.text) return;
    desiredStatus = desiredStatus == "" ? " " : desiredStatus;

    let rawFiletext = await vault.adapter.read(task.path);
    let hasRN = rawFiletext.contains("\r");
    let filetext = rawFiletext.split(/\r?\n/u);

    if (filetext.length < task.line) {
        console.log("RIGHT CLICKED: filetext.length < task.line");
        return;
    }
    let match = LIST_ITEM_REGEX.exec(filetext[task.line]);
    if (!match || match[2].length == 0) {
        console.log("RIGHT CLICKED: !match || match[2].length == 0");
        return;
    }

    let taskTextParts = task.text.split("\n");

    // Function to normalize text for comparison - keep only alphanumeric and spaces
    function normalizeForComparison(text: string): string {
        // First remove all date patterns - both inline field and emoji shorthand
        let cleaned = text
            // Remove inline fields like [due:: date]
            .replace(/\[[\w-]+::.*?\]/g, "")
            // Remove emoji date patterns like 📅 YYYY-MM-DD
            .replace(/[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Emoji_Component}]+\s*\d{4}-\d{2}-\d{2}/gu, "");

        // Then extract only alphanumeric characters and spaces for a clean comparison
        let normalized = "";
        for (let i = 0; i < cleaned.length; i++) {
            const char = cleaned.charAt(i);
            if (/[\p{L}\p{N}\s]/u.test(char)) {
                normalized += char;
            }
        }

        // Normalize whitespace: trim and collapse multiple spaces
        return normalized.trim().replace(/\s+/g, " ");
    }

    const taskNormalized = normalizeForComparison(taskTextParts[0]);
    const matchNormalized = normalizeForComparison(match[3]);

    console.log("RIGHT CLICKED: Normalized comparison:",
        `[${taskNormalized}]`,
        `[${matchNormalized}]`);

    // Use a similarity threshold to allow for minor differences
    const similarityCheck = (a: string, b: string): boolean => {
        if (a === b) return true;

        // If either string is empty after normalization, we can't compare
        if (!a || !b) return false;

        // Simple check - one string contains the other
        if (a.includes(b) || b.includes(a)) return true;

        return false;
    };

    if (!similarityCheck(taskNormalized, matchNormalized)) {
        console.log("RIGHT CLICKED: Text similarity check failed");
        return;
    }

    // We have a positive match here at this point, so go ahead and do the rewrite of the status.
    let initialSpacing = /^[\s>]*/u.exec(filetext[task.line])!![0];
    if (desiredText) {
        let desiredParts = desiredText.split("\n");

        let newTextLines: string[] = [`${initialSpacing}${task.symbol} [${desiredStatus}] ${desiredParts[0]}`].concat(
            desiredParts.slice(1).map(l => initialSpacing + "\t" + l)
        );

        filetext.splice(task.line, task.lineCount, ...newTextLines);
    } else {
        filetext[task.line] = `${initialSpacing}${task.symbol} [${desiredStatus}] ${taskTextParts[0].trim()}`;
    }

    let newText = filetext.join(hasRN ? "\r\n" : "\n");
    await vault.adapter.write(task.path, newText);
}
/** Rewrite a task with the given completion status and new text. */
export async function rewriteTask(vault: Vault, task: STask, desiredStatus: string, desiredText?: string) {
    if (desiredStatus == task.status && (desiredText == undefined || desiredText == task.text)) return;
    desiredStatus = desiredStatus == "" ? " " : desiredStatus;

    let rawFiletext = await vault.adapter.read(task.path);
    let hasRN = rawFiletext.contains("\r");
    let filetext = rawFiletext.split(/\r?\n/u);

    if (filetext.length < task.line) return;
    let match = LIST_ITEM_REGEX.exec(filetext[task.line]);
    if (!match || match[2].length == 0) return;

    let taskTextParts = task.text.split("\n");
    if (taskTextParts[0].trim() != match[3].trim()) return;

    // We have a positive match here at this point, so go ahead and do the rewrite of the status.
    let initialSpacing = /^[\s>]*/u.exec(filetext[task.line])!![0];
    if (desiredText) {
        let desiredParts = desiredText.split("\n");

        let newTextLines: string[] = [`${initialSpacing}${task.symbol} [${desiredStatus}] ${desiredParts[0]}`].concat(
            desiredParts.slice(1).map(l => initialSpacing + "\t" + l)
        );

        filetext.splice(task.line, task.lineCount, ...newTextLines);
    } else {
        filetext[task.line] = `${initialSpacing}${task.symbol} [${desiredStatus}] ${taskTextParts[0].trim()}`;
    }

    let newText = filetext.join(hasRN ? "\r\n" : "\n");
    console.log("RIGHT CLICKED: newText", newText);
    await vault.adapter.write(task.path, newText);
}

// Function to extract dates from task text
function extractDatesFromTask(text: string): { due?: string; scheduled?: string; completion?: string } {
    const result: { due?: string; scheduled?: string; completion?: string } = {};

    // Extract dates from inline fields
    const dueMatch = text.match(/\[due::\s*(\d{4}-\d{2}-\d{2})\]/);
    if (dueMatch) {
        result.due = dueMatch[1];
    }

    const scheduledMatch = text.match(/\[scheduled::\s*(\d{4}-\d{2}-\d{2})\]/);
    if (scheduledMatch) {
        result.scheduled = scheduledMatch[1];
    }

    const completionMatch = text.match(/\[completion::\s*(\d{4}-\d{2}-\d{2})\]/);
    if (completionMatch) {
        result.completion = completionMatch[1];
    }

    // Extract dates from emoji shorthand format
    const dueDateEmoji = text.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
    if (dueDateEmoji) {
        result.due = dueDateEmoji[1];
    }

    const scheduledDateEmoji = text.match(/⏳\s*(\d{4}-\d{2}-\d{2})/);
    if (scheduledDateEmoji) {
        result.scheduled = scheduledDateEmoji[1];
    }

    const completionDateEmoji = text.match(/✅\s*(\d{4}-\d{2}-\d{2})/);
    if (completionDateEmoji) {
        result.completion = completionDateEmoji[1];
    }
    return result;
}

// Function to detect if emoji date format is being used
function detectEmojiDateFormat(text: string): boolean {
    const emojiDateRegex = /[\p{Emoji}\p{Emoji_Presentation}][\p{Emoji_Modifier}]?\s*\d{4}-\d{2}-\d{2}/gu;
    return emojiDateRegex.test(text);
}

// Function to update dates in emoji format
function updateEmojiDates(text: string, date: string, isCompleted: boolean = false): string {
    // Define emoji constants
    const dueDateEmoji = "📅";
    const completionEmoji = "✅";

    // Remove existing due dates (both emoji and inline field)
    let result = text.replace(/(\s+)?📅\s*\d{4}-\d{2}-\d{2}/g, "")
        .replace(/(\s+)?\[due::.*?\]/g, "");

    // Remove existing scheduled dates (both emoji and inline field)
    result = result.replace(/(\s+)?⏳\s*\d{4}-\d{2}-\d{2}/g, "")
        .replace(/(\s+)?\[scheduled::.*?\]/g, "");

    // If completed, also remove and update completion date
    if (isCompleted) {
        result = result.replace(/(\s+)?✅\s*\d{4}-\d{2}-\d{2}/g, "")
            .replace(/(\s+)?\[completion::.*?\]/g, "");

        // Add due date and completion date
        return `${result.trim()} ${dueDateEmoji} ${date} ${completionEmoji} ${date}`;
    } else {
        // Just add due date
        return `${result.trim()} ${dueDateEmoji} ${date}`;
    }
}
