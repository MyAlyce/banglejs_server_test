import { CSV } from './csv.js';

let dbInstances: { [key: string]: IDBDatabase } = {};

let CURRENT_DB_VERSION = 1;
const DEFAULT_DB_NAME = 'myDB';
const DEFAULT_CHUNK_SIZE = 256 * 1024; // 256KB

// Default onupgradeneeded function to create necessary object stores
const defaultOnUpgradeNeeded = (db: IDBDatabase) => {
    if (!db.objectStoreNames.contains('directories')) {
        db.createObjectStore('directories', { keyPath: 'name' });
    }
    if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'path' });
    }
};

// Initialize IndexedDB with optional onupgradeneeded callback
export const initIndexedDB = async (
    dbName = DEFAULT_DB_NAME,
    version = CURRENT_DB_VERSION,
    onupgradeneeded: (db: IDBDatabase) => void = defaultOnUpgradeNeeded
): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, version);

        request.onupgradeneeded = (event) => {
            const db = request.result;
            CURRENT_DB_VERSION++; // Increment the version number on upgrade
            onupgradeneeded(db);
        };

        request.onsuccess = () => {
            dbInstances[dbName] = request.result;
            resolve(true);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
};


// Helper function to get or initialize the database instance for a given dbName
export const getDBInstance = async (dbName: string): Promise<IDBDatabase> => {
    if (!dbInstances[dbName]) {
        await initIndexedDB(dbName);
    }
    return dbInstances[dbName];
};

export const deleteDBInstance = async (dbName: string): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(dbName);
        
        request.onsuccess = () => {
            delete dbInstances[dbName];
            resolve(true);
        };

        request.onerror = () => {
            reject(request.error);
        };

        request.onblocked = () => {
            console.warn(`Delete operation for database "${dbName}" is blocked.`);
        };
    });
};

export const closeDBInstance = (dbName: string): boolean => {
    const dbInstance = dbInstances[dbName];
    if (dbInstance) {
        dbInstance.close();
        delete dbInstances[dbName];
        return true;
    }
    return false;
};

// Helper function to get data from a store
export const getStore = async <T>(store: IDBObjectStore, key: IDBValidKey): Promise<T> => {
    const request = store.get(key);
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

// Helper function to put data into a store
export const putStore = async <T>(store: IDBObjectStore, value: T, key?: IDBValidKey): Promise<void> => {
    const request = store.put(value, key);
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

// Delete data from a store
export const deleteStore = async<T>(store: IDBObjectStore, query: IDBValidKey | IDBKeyRange): Promise<void> => {
    return await new Promise<void>((resolve, reject) => {
        const request = store.delete(query);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

// Format path to ensure it starts with a slash
export const formatPath = (path: string, dir?: string): string => {
    if (!path.startsWith('/')) path = '/' + path;
    if (dir) {
        if (!dir.startsWith('/')) dir = '/' + dir;
        path = dir + path;
    }
    return path;
};

// Check if a directory exists
export const dirExists = async (directory: string, dbName = DEFAULT_DB_NAME): Promise<boolean> => {
    const dbInstance = await getDBInstance(dbName);
    const tx = dbInstance.transaction('directories', 'readonly');
    const store = tx.objectStore('directories');
    const dirData = await getStore(store, directory);
    return !!dirData;
};

// Ensure directory is initialized
export const checkDirInit = async (path: string, dbName = DEFAULT_DB_NAME): Promise<string> => {
    const dbInstance = await getDBInstance(dbName);

    path = formatPath(path);
    const directory = `/${path.split('/')[1]}`;
    if (!directory) throw new Error(`Bad Path: ${path}`);

    const dirExistsInDB = await dirExists(directory, dbName);
    if (!dirExistsInDB) {
        await createFolder(directory, dbName);  // Create the directory if it doesn't exist
    }

    return path;
};

export function isTypedArray(x:any) { //https://stackoverflow.com/a/40319428
    return (ArrayBuffer.isView(x) && Object.prototype.toString.call(x) !== "[object DataView]");
}

// Function to encode data before storing
export const encodeData = (data: any): { encodedData: Blob, metadata: any } => {
    let encodedData: Blob;
    let metadata: any = {};

    if (typeof data === 'string') {
        encodedData = new Blob([data], { type: 'text/plain' });
        metadata = {
            type: 'string',
            encoding: 'utf-8'
        };
    } else if (data instanceof Blob) {
        encodedData = data;
        metadata = {
            type: 'blob',
            mimeType: data.type
        };
    } else if (isTypedArray(data)) {
        encodedData = new Blob([data.buffer], { type: 'application/octet-stream' });
        metadata = {
            type: data.constructor.name,
            length: data.length,
            byteOffset: data.byteOffset
        };
    } else {
        throw new Error('Unsupported data type');
    }

    return { encodedData, metadata };
};

// Function to decode data after retrieving
export const decodeData = async (storedData: any): Promise<any> => {
    const { data, metadata } = storedData;

    if (metadata?.type === 'string' || metadata?.type === 'text/plain') {
        return await data.text();
    }

    if (metadata?.type === 'blob') {
        return data;
    }

    if (metadata?.type && metadata?.length && metadata?.byteOffset !== undefined) {
        const arrayBuffer = await data.arrayBuffer();
        const TypedArrayConstructor = globalThis[metadata.type as keyof typeof globalThis] as any;
        return new TypedArrayConstructor(arrayBuffer, metadata.byteOffset, metadata.length);
    }

    return data;
};

//chunking data makes it more streamable

// Write a file with optional chunking
export const writeFile = async (
    path: string,
    data: string | ArrayBufferView | Blob,
    chunkSize: number | null = DEFAULT_CHUNK_SIZE,
    onwrite = (written: boolean) => {},
    dbName = DEFAULT_DB_NAME
): Promise<boolean> => {
    path = await checkDirInit(path, dbName);
    const dbInstance = await getDBInstance(dbName);

    const { encodedData, metadata } = encodeData(data);
    const tx = dbInstance.transaction(['files', 'directories'], 'readwrite');
    const fileStore = tx.objectStore('files');
    const dirStore = tx.objectStore('directories');

    const pathParts = path.split('/').slice(1); // Remove the leading slash
    const rootDir = pathParts[0];
    const subDir = pathParts.length > 2 ? pathParts[1] : undefined;

    const directoryKey = subDir ? `/${rootDir}/${subDir}` : `/${rootDir}`;
    const dirData = await getStore<any>(dirStore, directoryKey) || { name: directoryKey, files: {} };

    const totalChunks = chunkSize ? Math.ceil(encodedData.size / chunkSize) : 1;
    for (let i = 0; i < totalChunks; i++) {
        const chunkData = chunkSize ? encodedData.slice(i * chunkSize, (i + 1) * chunkSize) : encodedData;
        const chunkKey = i === 0 ? path : `${path}_chunk_${i}`;
        await putStore(fileStore, { path: chunkKey, data: chunkData, metadata });

        dirData.files[chunkKey] = metadata;
    }

    await putStore(dirStore, dirData);

    if (subDir) {
        const parentDirKey = `/${rootDir}`;
        let parentDirData = await getStore<any>(dirStore, parentDirKey);
        if (!parentDirData) parentDirData = { name: parentDirKey, files: {} };
        if (!parentDirData.files[`/${rootDir}/${subDir}`]) {
            parentDirData.files[`/${rootDir}/${subDir}`] = { type: 'folder' };
            await putStore(dirStore, parentDirData);
        }
    }

    if (onwrite) onwrite(true);
    return true;
};

// Append to a file by adding to the last chunk or creating a new one
export const appendFile = async (
    path: string,
    data: string | ArrayBufferView | Blob,
    chunkSize: number = DEFAULT_CHUNK_SIZE,
    onwrite = (written: boolean) => {},
    dbName = DEFAULT_DB_NAME
): Promise<boolean> => {
    path = await checkDirInit(path, dbName);
    const dbInstance = await getDBInstance(dbName);

    const { encodedData, metadata } = encodeData(data);

    let lastChunkData: Blob | undefined = undefined;
    let lastChunkIndex = -1;

    await processFileChunksWithCursor(path, (chunk, index) => {
        lastChunkData = chunk.data;
        lastChunkIndex = index;
    }, dbName);

    const tx = dbInstance.transaction(['files', 'directories'], 'readwrite');
    const fileStore = tx.objectStore('files');
    const dirStore = tx.objectStore('directories');

    let leftoverData = encodedData;

    if (lastChunkData) {
        const combinedBlob = new Blob([lastChunkData, encodedData]);
        if (combinedBlob.size <= chunkSize) {
            await putStore(fileStore, { path: lastChunkIndex === 0 ? path : `${path}_chunk_${lastChunkIndex}`, data: combinedBlob, metadata });
            leftoverData = null;
        } else {
            await putStore(fileStore, { path: lastChunkIndex === 0 ? path : `${path}_chunk_${lastChunkIndex}`, data: combinedBlob.slice(0, chunkSize), metadata });
            leftoverData = combinedBlob.slice(chunkSize);
            lastChunkIndex++;
        }
    }

    while (leftoverData?.size > 0) {
        const newChunkSize = Math.min(chunkSize, leftoverData.size);
        const newChunkData = leftoverData.slice(0, newChunkSize);

        const chunkKey = `${path}_chunk_${lastChunkIndex}`;
        await putStore(fileStore, { path: chunkKey, data: newChunkData, metadata });

        let dirName = `/${path.split('/')[1]}`;
        const dirData = await getStore<any>(dirStore, dirName) || { name: dirName, files: {} };
        dirData.files[chunkKey] = metadata;
        await putStore(dirStore, dirData);

        leftoverData = leftoverData.slice(newChunkSize);
        lastChunkIndex++;
    }

    if (onwrite) onwrite(true);
    return true;
};


// Read a file and reconstruct from chunks
export const readFile = async (
    path: string,
    dbName = DEFAULT_DB_NAME
): Promise<any> => {
    path = await checkDirInit(path, dbName);
    const dbInstance = await getDBInstance(dbName);
    const tx = dbInstance.transaction('files', 'readonly');
    const store = tx.objectStore('files');
    const chunks: Blob[] = [];
    let finalMetadata: any = {};

    return new Promise((resolve, reject) => {
        const firstChunkRequest = store.get(path);

        firstChunkRequest.onsuccess = (event) => {
            const firstChunk = firstChunkRequest.result;
            if (firstChunk) {
                chunks.push(firstChunk.data);
                finalMetadata = firstChunk.metadata;

                const keyRange = IDBKeyRange.bound(`${path}_chunk_`, `${path}_chunk_\uffff`);
                const chunkRequest = store.openCursor(keyRange);

                chunkRequest.onsuccess = (event) => {
                    const cursor = (event.target as IDBRequest).result;
                    if (cursor) {
                        const chunkData = cursor.value.data;
                        chunks.push(chunkData);

                        cursor.continue();  // Move to the next chunk
                    } else {
                        const fullBlob = new Blob(chunks, { type: finalMetadata.mimeType || 'application/octet-stream' });
                        resolve(decodeData({ data: fullBlob, metadata: finalMetadata }));
                    }
                };

                chunkRequest.onerror = () => reject(chunkRequest.error);
            } else {
                const keyRange = IDBKeyRange.bound(`${path}_chunk_`, `${path}_chunk_\uffff`);
                const chunkRequest = store.openCursor(keyRange);

                chunkRequest.onsuccess = (event) => {
                    const cursor = (event.target as IDBRequest).result;
                    if (cursor) {
                        const chunkData = cursor.value.data;
                        chunks.push(chunkData);

                        if (!finalMetadata) {
                            finalMetadata = cursor.value.metadata;
                        }

                        cursor.continue();  // Move to the next chunk
                    } else {
                        const fullBlob = new Blob(chunks, { type: finalMetadata.mimeType || 'application/octet-stream' });
                        resolve(decodeData({ data: fullBlob, metadata: finalMetadata }));
                    }
                };

                chunkRequest.onerror = () => reject(chunkRequest.error);
            }
        };

        firstChunkRequest.onerror = () => reject(firstChunkRequest.error);
    });
};

// Check if a file exists
export const exists = async (path: string, dbName = DEFAULT_DB_NAME): Promise<boolean> => {
    path = await checkDirInit(path, dbName);
    const dbInstance = await getDBInstance(dbName);
    const tx = dbInstance.transaction('files', 'readonly');
    const store = tx.objectStore('files');

    const firstChunkRequest = await new Promise<any>((resolve, reject) => {
        const request = store.get(path);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
    });

    if (firstChunkRequest) {
        return true;
    }

    const keyRange = IDBKeyRange.bound(`${path}_chunk_0`, `${path}_chunk_0\uffff`);
    const cursor = await new Promise<IDBCursorWithValue | null>((resolve, reject) => {
        const request = store.openCursor(keyRange);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
    });

    return !!cursor;
};

// Get filenames in a directory
export const getFilenames = async (
    directory: string,
    onload = (directory: string[]) => {},
    dbName = DEFAULT_DB_NAME
): Promise<string[]> => {
    directory = await checkDirInit(directory, dbName);
    const dbInstance = await getDBInstance(dbName);
    const tx = dbInstance.transaction('files', 'readonly');
    const store = tx.objectStore('files');
    const keyRange = IDBKeyRange.bound(directory + '/', directory + '/\uffff');
    const filenames: Set<string> = new Set();

    return new Promise((resolve, reject) => {
        const request = store.openCursor(keyRange);

        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result;
            if (cursor) {
                const filePath = cursor.key as string;
                const baseFilePath = filePath.includes('_chunk_') ? filePath.split('_chunk_')[0] : filePath;
                filenames.add(baseFilePath);
                cursor.continue();
            } else {
                const fileList = Array.from(filenames);
                onload(fileList);
                resolve(fileList);
            }
        };

        request.onerror = () => reject(request.error);
    });
};

// Process file chunks with a cursor
export const processFileChunksWithCursor = async (
    path: string,
    chunkProcessor = (chunk: any, index: number) => {},
    dbName = DEFAULT_DB_NAME
): Promise<void> => {
    path = await checkDirInit(path, dbName);
    const dbInstance = await getDBInstance(dbName);
    const tx = dbInstance.transaction('files', 'readonly');
    const store = tx.objectStore('files');

    const firstChunk = await getStore(store, path);
    if (firstChunk) {
        chunkProcessor(firstChunk, 0);
    }

    const keyRange = IDBKeyRange.bound(`${path}_chunk_`, `${path}_chunk_\uffff`);
    let chunkIndex = firstChunk ? 1 : 0;

    return new Promise((resolve, reject) => {
        const request = store.openCursor(keyRange);

        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result;
            if (cursor) {
                chunkProcessor(cursor.value, chunkIndex);
                chunkIndex += 1;
                cursor.continue();
            } else {
                resolve();
            }
        };

        request.onerror = () => reject(request.error);
    });
};

// Read a text file chunk
export const readTextFileChunk = async (
    path: string,
    begin = 0,
    end: 'end' | number = 'end',
    onread = (data: string, path: string) => {},
    dbName = DEFAULT_DB_NAME
): Promise<string | undefined> => {
    path = await checkDirInit(path, dbName);
    const data = await readFile(path, dbName);
    if (data) {
        const chunk = typeof end === 'number' ? data.substring(begin, end) : data;
        onread(chunk, path);
        return chunk;
    }
};

// Get file size
export const getFileSize = async (
    path: string,
    onread = (size: number) => {},
    dbName = DEFAULT_DB_NAME
): Promise<number> => {
    path = await checkDirInit(path, dbName);
    const data = await readFile(path, dbName);
    const size = data ? data.size : 0;
    onread(size);
    return size;
};

// Read a file as text
export const readFileAsText = async (
    path: string,
    end: 'end' | number = 'end',
    begin = 0,
    onread = (data: string, filename: string) => {},
    dbName = DEFAULT_DB_NAME
): Promise<string | undefined> => {
    path = await checkDirInit(path, dbName);
    const size = await getFileSize(path, undefined, dbName);
    if (end === 'end') end = size;
    const data = await readTextFileChunk(path, begin, end as number, onread, dbName);
    onread(data, path);
    return data;
};

// Delete a file
export const deleteFile = async (path: string, ondelete = () => {}, dbName = DEFAULT_DB_NAME): Promise<boolean> => {
    path = await checkDirInit(path, dbName);
    const dbInstance = await getDBInstance(dbName);
    const tx = dbInstance.transaction(['files', 'directories'], 'readwrite');
    const fileStore = tx.objectStore('files');
    const dirStore = tx.objectStore('directories');

    await new Promise<void>((resolve, reject) => {
        const request = fileStore.delete(path);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });

    const directory = `/${path.split('/')[1]}`;
    const dirData = await getStore<any>(dirStore, directory);
    if (dirData && dirData.files[path]) {
        delete dirData.files[path];
        await putStore(dirStore, dirData);
    }

    ondelete();
    return true;
};

// Create a folder (directory)
export const createFolder = async (foldername: string, dbName = DEFAULT_DB_NAME): Promise<boolean> => {
    const dbInstance = await getDBInstance(dbName);
    const tx = dbInstance.transaction('directories', 'readwrite');
    const store = tx.objectStore('directories');

    await putStore(store, { name: formatPath(foldername), files: {} });

    const pathParts = foldername.split('/');
    if (pathParts.length > 1) {
        const rootDir = pathParts[0];
        const subDir = pathParts.slice(1).join('/');
        const parentDirKey = `/${rootDir}`;
        const parentDirData = await getStore<any>(store, parentDirKey) || { name: parentDirKey, files: {} };
        parentDirData.files[foldername] = { type: 'folder' };
        await putStore(store, parentDirData);
    }

    return true;
};

// Delete a folder (directory)
export const deleteFolder = async (foldername: string, dbName = DEFAULT_DB_NAME): Promise<boolean> => {
    const dbInstance = await getDBInstance(dbName);
    const tx = dbInstance.transaction(['directories', 'files'], 'readwrite');
    const dirStore = tx.objectStore('directories');
    const fileStore = tx.objectStore('files');

    const keyRange = IDBKeyRange.bound(`${foldername}/`, `${foldername}/\uffff`);
    const deleteFilesPromise = new Promise<void>((resolve, reject) => {
        const request = fileStore.openCursor(keyRange);
        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result;
            if (cursor) {
                fileStore.delete(cursor.primaryKey);
                cursor.continue();
            } else {
                resolve();
            }
        };
        request.onerror = () => reject(request.error);
    });

    await deleteFilesPromise;

    await new Promise<void>((resolve, reject) => {
        const request = dirStore.delete(foldername);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });

    const pathParts = foldername.split('/');
    if (pathParts.length > 1) {
        const rootDir = pathParts[0];
        const subDir = pathParts.slice(1).join('/');

        const parentDirKey = `/${rootDir}`;
        const parentDirData = await getStore<any>(dirStore, parentDirKey);
        if (parentDirData && parentDirData.files[foldername]) {
            delete parentDirData.files[foldername];
            await putStore(dirStore, parentDirData);
        }
    }

    return true;
};

// Get CSV header
export const getCSVHeader = async (
    path: string,
    onopen = (header: string, filename: string) => {},
    dbName = DEFAULT_DB_NAME
): Promise<string> => {
    path = await checkDirInit(path, dbName);
    const data = await readFile(path, dbName);
    if (data && typeof data === 'string') {
        const header = data ? data.split('\n')[0] : '';
        onopen(header, path);
        return header;
    }
    return '';
};

// Write database data to CSV in chunks
export const writeToCSVFromDB = async (path: string, fileSizeLimitMb = 10, dbName = DEFAULT_DB_NAME): Promise<boolean> => {
    path = await checkDirInit(path, dbName);
    const data = await readFile(path, dbName);
    if (!data) return false;
    const size = data.size;
    const maxFileSize = fileSizeLimitMb * 1024 * 1024;
    let i = 0;

    const writeChunkToFile = async () => {
        if (i < size) {
            const end = Math.min(i + maxFileSize, size);
            const chunkData = await data.slice(i, end).text();
            let fName = path.split('/')[2];
            if (i > 0) {
                const chunk = Math.floor(i / maxFileSize);
                fName = fName.replace('.csv', `_${chunk}.csv`);
            }
            CSV.saveCSV(chunkData, fName);
            i += maxFileSize;
            await writeChunkToFile();
        }
    };

    await writeChunkToFile();
    return true;
};

// Process CSV chunks from DB
export const processCSVChunksFromDB = async (
    path: string,
    onData = (csvdata: any, start: number, end: number, size: number) => {},
    maxChunkSize: 'end' | number = 256000,
    start = 0,
    options = { transpose: false },
    dbName = DEFAULT_DB_NAME
): Promise<boolean> => {
    const size = await getFileSize(path, undefined, dbName);
    let partition = start;

    const processPartition = async () => {
        const endChunk = maxChunkSize === 'end' ? maxChunkSize : Math.min(partition + maxChunkSize, size);
        const result = await readCSVChunkFromDB(path, partition, endChunk, options, dbName);
        await onData(result, partition, endChunk as any, size);
        partition = endChunk as any;
        if ((partition as any) !== 'end' && partition < size) {
            await processPartition();
        }
    };

    await processPartition();
    return true;
};

// Read CSV chunk from DB
export const readCSVChunkFromDB = async (
    path: string,
    start = 0,
    end: 'end' | number = 'end',
    options = { transpose: false },
    dbName = DEFAULT_DB_NAME
): Promise<any> => {
    path = await checkDirInit(path, dbName);

    const header = await getCSVHeader(path, undefined, dbName);
    if (!header) return undefined;

    const size = await getFileSize(path, undefined, dbName);
    if (end === 'end') end = size;

    const data = await readTextFileChunk(path, start, end, undefined, dbName);
    if (!data) return undefined;

    const rows = data.split('\n').slice(1);
    rows.pop();

    const transpose = options.transpose || false;
    const resultNames = header.split(',');

    const preprocess = (value: string): any => {
        if (typeof value === 'string')
            try {
                return JSON.parse(value);
            } catch {
                return value;
            }
        else return value;
    };

    const results: any = {};

    rows.forEach((row, i) => {
        const rowData = row.split(',');
        if (transpose) {
            const entry: any = {};
            rowData.forEach((value, index) => {
                entry[resultNames[index]] = preprocess(value);
            });
            if (!results[i]) results[i] = [];
            results[i].push(entry);
        } else {
            rowData.forEach((value, index) => {
                const key = resultNames[index];
                if (!results[key]) results[key] = [];
                results[key].push(preprocess(value));
            });
        }
    });

    return results;
};

// List files in a directory, accounting for chunked files as a single file
export const listFiles = async (
    dir: string,
    onload = (files: string[]) => {},
    dbName = DEFAULT_DB_NAME
): Promise<string[]> => {
    dir = await checkDirInit(dir, dbName);
    const dbInstance = await getDBInstance(dbName);
    const tx = dbInstance.transaction('directories', 'readonly');
    const store = tx.objectStore('directories');
    const dirData = await getStore(store, dir) as any;
    const files: string[] = [];

    if (dirData && dirData.files) {
        files.push(...Object.keys(dirData.files));
    }
    onload(files);
    return files;
};

// Export functions
export const IndexedDBRoutes = {
    initIndexedDB,
    getDBInstance,
    deleteDBInstance,
    closeDBInstance,
    dirExists,
    exists,
    readFile,
    readTextFileChunk,
    getFilenames,
    writeFile,
    appendFile,
    deleteFile,
    readFileAsText,
    getFileSize,
    getCSVHeader,
    listFiles,
    createFolder,
    deleteFolder,
    writeToCSVFromDB,
    processCSVChunksFromDB,
    readCSVChunkFromDB,
    processFileChunksWithCursor
};











//TESTS

export const testIndexedDB = async (dbName = DEFAULT_DB_NAME) => {
    try {
        console.log('Initializing database...');
        await initIndexedDB(dbName);
        console.log('Database initialized.');

        const folderName = '/testFolder';
        const fileName = formatPath('/testFile.txt', folderName);
        const fileContent = 'Hello, IndexedDB!';
        const updatedContent = 'Hello again, IndexedDB!';
        
        console.log('Creating folder...');
        await createFolder(folderName, dbName);
        console.log('Folder created.');

        console.log('Writing file...');
        await writeFile(fileName, fileContent, null, undefined, dbName);
        console.log('File written.');

        console.log('Reading file...');
        let content = await readFileAsText(fileName, 'end', 0, undefined, dbName);
        console.log('File content:', content);

        console.log('Appending to file...');
        await appendFile(fileName, updatedContent, null, undefined, dbName);
        console.log('Content appended.');

        console.log('Reading file again...');
        content = await readFileAsText(fileName, 'end', 0, undefined, dbName);
        console.log('Updated file content:', content);

        console.log('Checking if file exists...');
        const exist = await exists(fileName, dbName);
        console.log(`File exists: ${exist}`);

        console.log('Listing files in directory...');
        const files = await listFiles(folderName, undefined, dbName);
        console.log('Files in directory:', files);

        console.log('Deleting file...');
        await deleteFile(fileName, undefined, dbName);
        console.log('File deleted.');

        console.log('Deleting folder...');
        await deleteFolder(folderName, dbName);
        console.log('Folder deleted.');

        console.log('Closing database instance...');
        closeDBInstance(dbName);
        console.log('Database instance closed.');

        console.log('Re-opening database instance...');
        await initIndexedDB(dbName);
        console.log('Database instance re-opened.');

        console.log('Deleting database instance...');
        await deleteDBInstance(dbName);
        console.log('Database instance deleted.');

    } catch (error) {
        console.error('Error during test:', error);
    }
};
