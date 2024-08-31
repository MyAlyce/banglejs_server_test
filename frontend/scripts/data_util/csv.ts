type CSVNote = { idx: number; text: string };
type CSVOptions = {
    delimiter?: string;
    header?: string;
    saveNotes?: boolean;
    data?: Array<string | Array<string | number>>;
};
type ProcessDataOptions = {
    filename?: string;
    save?: boolean;
    header?: string[];
    data: Array<{ [key: string]: any }>;
};
type ParseCSVDataOptions = {
    data: string;
    filename: string;
    header?: string | string[];
    hasEnd?: boolean;
    parser?: (lines: string[], filename: string, header: string[]) => any;
};
type CSVResult = {
    filename: string;
    header: string;
    body: string;
};

export class CSV {
    notes: CSVNote[];
    onOpen: (data: string[][], header: string[], path: string) => void;

    constructor({
        onOpen = this.defaultOnOpen,
        saveButtonId = null,
        openButtonId = null
    }: {
        onOpen?: (data: string[][], header: string[], path: string) => void;
        saveButtonId?: string | null;
        openButtonId?: string | null;
    } = {}) {
        this.onOpen = onOpen;
        this.notes = [];

        if (saveButtonId) {
            document.getElementById(saveButtonId)?.addEventListener('click', () => CSV.saveCSV());
        }
        if (openButtonId) {
            document.getElementById(openButtonId)?.addEventListener('click', () => CSV.openCSV());
        }
    }

    processArraysForCSV({
        data = [],
        delimiter = "|",
        header = "",
        saveNotes = false
    }: CSVOptions = {}): string {
        let csvData = header ? `${header}\n` : "";
        let noteIdx = 0;

        data.forEach((line, i) => {
            let processedLine = Array.isArray(line) ? line.join(",") : line.split(delimiter).join(",");
            if (saveNotes && this.notes[noteIdx] && this.notes[noteIdx].idx === i) {
                processedLine += `,${this.notes[noteIdx].text}`;
                noteIdx++;
            }
            csvData += `${processedLine}\n`;
        });

        return csvData;
    }

    static saveCSV(csvData: string = "a,b,c\n1,2,3\n3,2,1\n", filename: string = ""): void {
        const hiddenElement = document.createElement('a');
        hiddenElement.href = `data:text/csv;charset=utf-8,${encodeURI(csvData)}`;
        hiddenElement.target = "_blank";
        hiddenElement.download = filename.endsWith('.csv') ? filename : `${filename || new Date().toISOString()}.csv`;
        hiddenElement.click();
    }

    static openCSV({
        delimiter = ",",
        onOpen = (data: string[][], header: string[], path: string) => ({ data, header, path })
    }: {
        delimiter?: string;
        onOpen?: (data: string[][], header: string[], path: string) => any;
    } = {}): Promise<{ data: string[][]; header: string[]; filename: string }> {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.accept = '.csv';
            input.type = 'file';

            input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files![0];
                const reader = new FileReader();

                reader.onload = (event) => {
                    const csvData = (event.target as FileReader).result as string;
                    const csvArr = csvData.split("\n").filter(Boolean);
                    const header = csvArr[0].split(delimiter);
                    const data = csvArr.slice(1).map(row => row.split(delimiter));
                    onOpen(data, header, file.name);
                    resolve({ data, header, filename: file.name });
                };
                reader.readAsText(file);
            };

            input.click();
        });
    }

    static openCSVRaw({
        onOpen = (data: string, path: string) => ({ data, path })
    }: {
        onOpen?: (data: string, path: string) => any;
    } = {}): Promise<{ data: string; filename: string }> {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.accept = '.csv';
            input.type = 'file';

            input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files![0];
                const reader = new FileReader();

                reader.onload = (event) => {
                    const csvData = (event.target as FileReader).result as string;
                    onOpen(csvData, file.name);
                    resolve({ data: csvData, filename: file.name });
                };
                reader.readAsText(file);
            };

            input.click();
        });
    }

    defaultOnOpen(data: string[][], header: string[], path: string): void {
        console.log("CSV Opened!", header, data);
    }
}

export const parseCSVData = ({
    data,
    filename,
    header,
    hasEnd = true,
    parser = (lines, filename, header) => {
        const result: { [key: string]: any } = { filename, header };

        lines.forEach(line => {
            const entries = line.split(',');
            entries.forEach((entry, index) => {
                const key = header[index];
                if (!result[key]) result[key] = [];
                result[key].push(entry);
            });
        });

        return result;
    }
}: ParseCSVDataOptions): any => {
    const lines = data.includes('\r') ? data.split('\r\n') : data.split('\n');
    const actualHeader = Array.isArray(header) ? header : header?.split(',') || lines.shift()?.split(',');
    if (!actualHeader) return {};
    if (!hasEnd) lines.pop();
    return parser(lines, filename, actualHeader);
};

export function toISOLocal(date: Date | string): string {
    const d = new Date(date);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const millis = (n: number) => n.toString().padStart(3, '0');
    const offset = d.getTimezoneOffset();
    const sign = offset < 0 ? '+' : '-';
    const absOffset = Math.abs(offset);

    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${millis(d.getMilliseconds())}(UTC${sign}${pad(Math.floor(absOffset / 60))}:00)`;
}

export const processDataForCSV = ({
    filename = '',
    save = false,
    header = [],
    data
}: ProcessDataOptions): CSVResult | undefined => {
    if (!data || !Array.isArray(data)) return undefined;

    const head = [...header];
    if (head.includes('timestamp')) {
        head.splice(head.indexOf('timestamp') + 1, 0, 'localized');
    }

    const csvHeader = head.join(',') + '\n';
    const lines: string[] = [];

    data.forEach(item => {
        if (Array.isArray(item)) {
            item.forEach((subItem, j) => {
                lines[j] = lines[j] ? `${lines[j]},${subItem}` : subItem.toString();
            });
        } else if (typeof item === 'object') {
            const x = item.x || item.timestamp;
            const keys = [...header];
            x.forEach((val: any, j: number) => {
                lines[j] = lines[j] ? `${lines[j]},${val}` : val.toString();
                if (item.timestamp) {
                    keys.splice(keys.indexOf('timestamp'), 1);
                    lines[j] += `,${toISOLocal(item.timestamp[j])}`;
                }
                keys.forEach(key => {
                    if (Array.isArray(item[key][j])) {
                        lines[j] += `,${item[key][j].join(',')}`;
                    } else {
                        lines[j] += `,${item[key][j]}`;
                    }
                });
            });
        }
    });

    const result: CSVResult = {
        filename,
        header: csvHeader,
        body: lines.join('\n')
    };

    if (save) {
        CSV.saveCSV(csvHeader + result.body, filename);
    }

    // if (write) {
    //     fs.exists(filename, (exists) => {
    //         const fileContent = exists ? result.body : csvHeader + result.body;
    //         appendFile(filename, fileContent, dir);
    //     });
    // }

    return result;
};
