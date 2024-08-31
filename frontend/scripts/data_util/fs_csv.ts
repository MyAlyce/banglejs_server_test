import { IndexedDBRoutes, appendFile, checkDirInit, deleteFile, exists, formatPath, getCSVHeader, listFiles, processCSVChunksFromDB, readCSVChunkFromDB, readFileAsText, writeFile, writeToCSVFromDB } from "./IDButils"; //'./zenfsUtils'//
import { CSV, parseCSVData, toISOLocal } from './csv';

const CSV_REFERENCE: {
    [filename: string]: {
        header: string[],
        lastX: number,
        buffer: string,
        buffered: number,
        toFixed: number,
        bufferSize: number | undefined,
        xIncrement?: number | undefined
    }
} = {}

function lerp(v0, v1, t) {
    return ((1 - t) * v0) + (v1 * t);
}

function interpolerp(v0, v1, fit, floor = true) {
    if (fit <= 2) return [v0, v1];
    let a = 1 / fit;
    let result = new Array(fit);
    result[0] = v0;
    for (let i = 1; i <= fit; i++) {
        result[i] = lerp(v0, v1, a * i);
        if (floor) result[i] = Math.floor(result[i]);
    }
    return result;
}

export const appendCSV = async (
    newData: { [key: string]: string | number | (string | number)[] },
    filename: string,
    header?: string[],
    options?: {
        json?: boolean,
        toFixed?: number,
        bufferSize?: number,
        xIncrement?: number,
        dbName?: string
    }
) => {
    if (!filename) {
        let keys = Object.keys(CSV_REFERENCE);
        if (keys.length > 0) filename = keys[keys.length - 1];
        else filename = `csv${new Date().toISOString()}`;
    }

    let csv = CSV_REFERENCE[filename];

    if (!csv) {
        let keys = Object.keys(newData);
        if (!header && await exists(filename, options?.dbName)) {
            header = (await getCSVHeader(filename)).split(',');
        }
        CSV_REFERENCE[filename] = {
            header: header || ['timestamp', ...keys],
            lastX: undefined,
            buffer: '',
            buffered: 0,
            bufferSize: options?.bufferSize || 0,
            toFixed: options?.toFixed || 0,
            xIncrement: options?.xIncrement || 0
        };
        csv = CSV_REFERENCE[filename];
    }

    // Read existing file content
    const existingData = await readExistingCSV(filename, options?.dbName);

    if (!existingData) {
        // If file doesn't exist, create it with the header
        csv.buffer = csv.header.join(',') + '\n';
    }

    // Convert new data into rows
    const rows = convertNewDataToRows(newData, csv);

    // Append only new rows that don't already exist in the existing data
    rows.forEach(row => {
        const rowKey = row.join(',');
        if (!existingData || !existingData.includes(rowKey)) {
            csv.buffer += rowKey + '\n';
            csv.buffered++;
        }
    });

    // Write the buffer to the file
    if (csv.bufferSize && csv.buffered >= csv.bufferSize) {
        await writeBufferToFile(filename, csv.buffer, options?.dbName);
        csv.buffer = '';
        csv.buffered = 0;
    } else {
        await writeBufferToFile(filename, csv.buffer, options?.dbName);
        csv.buffer = '';
    }
};

async function readExistingCSV(filename: string, dbName?: string): Promise<string[] | null> {
    if (await exists(filename, dbName)) {
        const data = await readFileAsText(filename, 'end', 0, undefined, dbName);
        if (data) {
            return data.split('\n').filter(row => row.trim() !== '');
        }
    }
    return null;
}

function convertNewDataToRows(newData: { [key: string]: string | number | (string | number)[] }, csv: any): string[][] {
    const rows: string[][] = [];
    const maxLen = Math.max(...Object.values(newData).map(val => Array.isArray(val) ? val.length : 1));

    for (let i = 0; i < maxLen; i++) {
        const row: string[] = [];
        for (const key of csv.header) {
            const value = newData[key];
            if (Array.isArray(value)) {
                row.push(value[i] !== undefined ? String(value[i]) : '');
            } else {
                row.push(i === 0 ? String(value || '') : '');
            }
        }
        rows.push(row);
    }

    return rows;
}
async function writeBufferToFile(filename: string, buffer: string, dbName?: string): Promise<boolean> {
    const fileExists = await exists(filename, dbName);
    if (!fileExists) {
        // If the file doesn't exist, write the buffer as a new file (including the header)
        return new Promise((resolve, reject) => {
            writeFile(filename, buffer, undefined, (written: boolean) => resolve(written), dbName);
        });
    } else {
        
    console.log(filename,buffer);
        // If the file exists, append the buffer without the header
        return new Promise((resolve, reject) => {
            appendFile(filename, buffer, undefined, (written: boolean) => resolve(written), dbName);
        });
    }
}


export const updateCSVHeader = (header: any[], filename: string) => {
    if (CSV_REFERENCE[filename]) {
        CSV_REFERENCE[filename].header = header;
    }
}

export const createCSV = (
    filename: string,
    header: string[],
    toFixed: number = 5,
    bufferSize: number = 0,
    xIncrement?: number,
    dbName = 'myDB'
) => {
    if (!CSV_REFERENCE[filename]) {
        if (header?.indexOf('timestamp') > 1) { header.splice(header.indexOf('timestamp'), 1); header.unshift('timestamp'); }
        if ((header?.[0].toLowerCase().includes('time') || header?.[0].toLowerCase().includes('unix')) && header[1] !== 'localized') {
            header.splice(1, 0, 'localized');
        }

        CSV_REFERENCE[filename] = {
            header,
            lastX: header[1] === 'localized' ? Date.now() : 0,
            bufferSize,
            buffer: '',
            buffered: 0,
            toFixed,
            xIncrement
        };

        return new Promise((res, rej) => {
            exists(filename, dbName).then((doesExist) => {
                if (!doesExist) {
                    writeFile(
                        filename,
                        CSV_REFERENCE[filename].header ? CSV_REFERENCE[filename].header.join(',') + '\n' : '',
                        undefined,
                        (written: boolean) => {
                            res(written);
                        },
                        dbName
                    ).catch(rej);
                }
            });
        });
    }
}

export const visualizeDirectory = async (
    dir: string, 
    parentNode = document.body, 
    dbName = 'myDB'
) => {
    return new Promise(async (res, rej) => {
        let dirId = dir.replaceAll('/', '_');
        if (parentNode.querySelector('#bfs' + dirId)) {
            parentNode.querySelector('#bfs' + dirId)?.remove();
        }
        parentNode.insertAdjacentHTML('beforeend', `<div id='bfs${dirId}' class='bfs${dirId}'></div>`);
        let div = parentNode.querySelector('#bfs' + dirId);
        console.log(dir);
        await listFiles(dir, undefined, dbName).then((directory) => {
            console.log(directory);
            if (directory.length === 0) {
                (div as any).innerHTML = 'No Files!';
            } else {
                directory.forEach((listing) => {
                    console.log("LISTING", listing);
                    const isFolder = !listing.includes('.'); //no extension assumed to be file, todo just use metadata since . can be in a folder
                    div?.insertAdjacentHTML(
                        'beforeend',
                        `<div id='${listing}' class='bfsfilediv'>
                            <span class='bfsfiletitle'>${isFolder ? 'Folder: ' : 'Data: '}</span>
                            <span>${listing}</span>
                            ${!isFolder ? `<button class='bfsdownloadbtn' id='download${listing}'>Download</button>` : ''}
                            ${!isFolder ? `<button class='bfsdeletebtn' id='delete${listing}'>Delete</button>` : ''}
                        </div>`
                    );

                    if (document.getElementById(`delete${listing}`)) {
                        (document.getElementById(`delete${listing}`) as HTMLButtonElement).onclick = () => {
                            deleteFile(listing, () => {
                                visualizeDirectory(dir, parentNode, dbName);
                            }, dbName);
                        }
                    }

                    if (document.getElementById(`download${listing}`)) {
                        (document.getElementById(`download${listing}`) as HTMLButtonElement).onclick = () => {
                            const filePath = listing;
                            if (listing.endsWith('.csv')) {
                                writeToCSVFromDB(filePath, 10, dbName);
                            } else {
                                readFileAsText(filePath, 'end', 0, (data) => {
                                    if(!data) throw new Error(`No data: ${filePath}`);
                                    const blob = new Blob([data], { type: 'text/plain' });
                                    const link = document.createElement('a');
                                    link.href = URL.createObjectURL(blob);
                                    link.download = listing;
                                    link.click();
                                    URL.revokeObjectURL(link.href);
                                }, dbName);
                            }
                        }
                    }

                    if (isFolder) {
                        visualizeDirectory(listing, div as any, dbName);
                    }
                });
            }
            res(directory);
        }).catch(rej);
    });
};

// Example: `checkFolderList` accounting for dictionary-based file list
export async function checkFolderList(
    hasFolderName?: string, 
    listfilename = '/data/folderList.csv', 
    dbName = 'myDB'
): Promise<string[]> {
    let data: { folder: string[], lastmodified: number[] } = { folder: [], lastmodified: [] };

    if (hasFolderName && hasFolderName.trim() === '') {
        console.warn('Invalid folder name provided, skipping.');
        return data.folder;
    }

    const fileExists = await exists(listfilename, dbName);
    let needsUpdate = false;
    if (hasFolderName && !fileExists) {
        await csvRoutes.createCSV(listfilename, ['folder', 'lastmodified'], 5, 0, undefined, dbName);
        data.folder.push(hasFolderName);
        data.lastmodified.push(Date.now());

        await csvRoutes.appendCSV(data, listfilename, ['folder', 'lastmodified'], { dbName });
    } else {
        let folderExists = false;

        await csvRoutes.processCSVChunksFromDB(
            listfilename,
            (csvdata) => {
                for (const key in csvdata) {
                    if (key === 'folder') {
                        csvdata[key].forEach((folderName: string, i: number) => {
                            if (folderName && folderName.trim() !== '') {
                                if (folderName === hasFolderName) {
                                    folderExists = true;
                                    csvdata['lastmodified'][i] = Date.now(); // Update lastmodified
                                    needsUpdate = true;
                                }
                                data.folder.push(folderName);
                                data.lastmodified.push(csvdata['lastmodified'][i]);
                            }
                        });
                    }
                }
            },
            10000,
            0,
            undefined,
            dbName
        );

        if (!folderExists && hasFolderName) {
            data.folder.push(hasFolderName);
            data.lastmodified.push(Date.now());
            needsUpdate = true;
        }

        console.log(data.folder);

        if (needsUpdate) {
            await deleteFile(listfilename, undefined, dbName);
            await csvRoutes.appendCSV(data, listfilename, ['folder', 'lastmodified'], { dbName });
        }
    }

    return data.folder;
}

// Example: `parseFolderList` with dictionary-based file list
export async function parseFolderList(
    listParentFolder: string = 'data',
    listName: string = 'folderList.csv',
    dbName = 'myDB'
): Promise<string[]> {
    if (!listParentFolder) return [];

    await checkDirInit(listParentFolder, dbName);

    const path = formatPath(listName, listParentFolder);

    const data = await readCSVChunkFromDB(path, 0, 'end', undefined, dbName);

    return data?.folder ? data.folder : [];
}

export const csvRoutes = {
    appendCSV: appendCSV,
    updateCSVHeader: updateCSVHeader,
    createCSV: createCSV,
    visualizeDirectory: visualizeDirectory,
    openCSV: CSV.openCSV,
    saveCSV: CSV.saveCSV,
    openCSVRaw: CSV.openCSVRaw,
    parseCSVData: parseCSVData,
    getCSVHeader: getCSVHeader,
    writeToCSVFromDB: writeToCSVFromDB,
    readCSVChunkFromDB: readCSVChunkFromDB,
    processCSVChunksFromDB: processCSVChunksFromDB,
    toISOLocal: toISOLocal,
    checkFolderList: checkFolderList,
    parseFolderList: parseFolderList
}
