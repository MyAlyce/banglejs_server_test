import { CSV } from './csv.js';

//@ts-ignore
import { fs, configure, InMemory } from '@zenfs/core';
//@ts-ignore
import * as asyncFs from '@zenfs/core/promises' //has promise based calls 
//@ts-ignore
import { IndexedDB } from '@zenfs/dom';

const defaultDB = IndexedDB;

let mounted = {};

// Initialize file systems
export const initFS = async (
    mounts: { [key: string]: any } = { '/tmp': InMemory, '/data': defaultDB },
    oninit = (asyncFs) => { },
    onerror = (e) => { }
) => {

    let toMount = {};
    if(!mounted['/tmp']) mounts['/tmp'] = InMemory; 
    for(const key in mounts) {
        if(!mounted[key]) {
            toMount[key] = mounts[key];
        }
    }

    if(Object.keys(toMount).length === 0) {
        return;
    } 

    Object.assign(mounted, mounts);

    console.log(mounted, asyncFs);
    try {
        await configure({
            mounts: toMount
        });
        oninit(asyncFs);
        
        return true;
    } catch (e) {
        onerror(e);
        return false;
    }
};

export const createFolder = async (foldername: string) => {
    await asyncFs.mkdir(foldername);
    return true;
}
export const deleteFolder = async (foldername: string) => {
    await asyncFs.rmdir(foldername);
    return true;
}

//make sure it starts with the /
export const formatPath = (path: string, dir?: string) => {
    if (!path.startsWith('/')) path = '/' + path;
    if (dir) {
        if (!dir.startsWith('/')) dir = '/' + dir;
        path = dir + path;
    }
    return path;
}

//asyncFs.stat(path).then((stats)=>{ if(stats.isDirectory()) console.log("directory") }); //etc

export const checkDirInit = async (path: string, dbType = defaultDB as any) => {
    path = formatPath(path);
    let splt = path.split('/').filter(Boolean);

    if (splt.length < 1) throw `Bad Path: ${path}`; // no directory or invalid path

    const [dbName, folderName, subFolderName] = splt;

    // Check if the DB (first part) exists
    if (!await dirExists('/' + dbName)) {
        //console.trace(dbName, 'DNE, initDB', path);
        await initFS({ ['/' + dbName]: dbType });
        console.log(await asyncFs.readdir('/'+dbName));
        // createFolder('/'+dbName)
    } else {
        //console.log(dbName, 'DB exists', path);
    }

    // If there is a third part (sub-folder), check if the second part (folder) exists and create it if not
    if (subFolderName) {
        const folderPath = '/' + dbName + '/' + folderName;
        if (!await asyncFs.exists(folderPath)) {
            //console.log(folderName, 'DNE, mkdir', folderPath);
            await createFolder(folderPath);
        } else {
            //console.log(folderName, 'dir exists', folderPath);
        }
    }

    return path;
}

//for zenfs paths, start with the folder name, e.g. 'data/' like so, as it will make a (default indexedDB) type 
// Check if a path exists
export const exists = async (path = ''):Promise<boolean> => {
    path = await checkDirInit(path);
    return await new Promise(async (res,rej) => {
        try{
            let ex = await asyncFs.exists(path);
            res(ex);
        } catch(er) {
            res(false);
        }
    });
};

// Read a file
export const readFile = async (path = 'data/myfile.csv') => {
    path = await checkDirInit(path);
    if(await exists(path))
        return await asyncFs.readFile(path, 'utf8');
};

// Read a file chunk
export const readTextFileChunk = async (path = 'data/myfile.csv', begin = 0, end:'end'|number = 5120, onread = (data, path) => { }) => {

    path = await checkDirInit(path);

    if (path) {
        try {
            const file = await asyncFs.open(path, 'r');
            const size = await getFileSize(path);
            if (end === 'end') end = size;
            const buffer = new Uint8Array((end as number) - begin);
            const { bytesRead } = await file.read(buffer, 0, (end as number) - begin, begin);
            const data = new TextDecoder().decode(buffer.subarray(0, bytesRead));
            await file.close();
            onread(data, path);
            return data;
        } catch (e) {
            console.error(e);
        }
    } else {
        console.error('Path name is not defined');
        return undefined;
    }
};

// Get filenames in a directory
export const getFilenames = async (directory = 'data', onload = (directory) => { }) => {
    directory = await checkDirInit(directory);
    const files = await asyncFs.readdir(directory);
    onload(files);
    return files;
};

// Write a file, will overwrite a path automatically
export const writeFile = async (path, data, onwrite = (data) => { }) => {
    path = await checkDirInit(path);
    let splt = path.split('/').filter(Boolean);
    if(splt[2]) path = '/'+splt[1]+'/'+splt[2];
    console.log('writing',path, data);
    await asyncFs.writeFile(path, data);
    console.log(await asyncFs.readdir('/'+splt[1]), await asyncFs.readdir('/'));
    onwrite(data);
    return true;
};

// Append to a file, will use writeFile if file not created yet just to save a check for you
export const appendFile = async (path, data, onwrite = (data) => { }) => {
    path = await checkDirInit(path);
    let fileExists = await exists(path);
    if (!fileExists) await asyncFs.writeFile(path, data);
    else await asyncFs.appendFile(path, data);
    onwrite(data);
    return true;
};

// Delete a file
export const deleteFile = async (path = 'data/myfile.csv', ondelete = () => { }) => {
    path = await checkDirInit(path);
    await asyncFs.unlink(path);
    ondelete();
    return true;
};



// Read a file as text
export const readFileAsText = async (path = 'data/myfile.csv', end: 'end' | number = 'end', begin = 0, onread = (data, filename) => { }) => {

    path = await checkDirInit(path);
    const size = await getFileSize(path);
    if (end === 'end') end = size;
    const data = await readTextFileChunk(path, begin, end as any, onread);
    onread(data, path);
    return data;
};

// List files in a directory
export const listFiles = async (dir = 'data', onload = (directory) => { }) => {
    dir = await checkDirInit(dir);
    const directory = await asyncFs.readdir(dir);
    onload(directory);
    return directory;
};

// Get file size
export const getFileSize = async (path = 'data/myfile.csv', onread = (size) => { }) => {

    path = await checkDirInit(path);
    const stats = await asyncFs.stat(path);
    const filesize = stats.size;
    onread(filesize);
    return filesize;
};

// Get CSV header
export const getCSVHeader = async (path = 'data/myfile.csv', onopen = (header, filename) => { }) => {

    path = await checkDirInit(path);
    let fex = await exists(path);
    if(!fex) return "";
    
    const file = await asyncFs.open(path, 'r');
    const buffer = new Uint8Array(65535);
    const { bytesRead } = await file.read(buffer, 0, 65535, 0);
    const data = new TextDecoder().decode(buffer.subarray(0, bytesRead));
    const lines = data.split('\n');
    const header = lines[0];
    await file.close();
    onopen(header, path);
    return header;
};

// Write database data to CSV in chunks
export const writeToCSVFromDB = async (path = 'data/myfile.csv', fileSizeLimitMb = 10) => {

    path = await checkDirInit(path);
    let fex = await exists(path);
    if(!fex) return "";
    
    const stats = await asyncFs.stat(path);
    const filesize = stats.size;
    const maxFileSize = fileSizeLimitMb * 1024 * 1024;
    const file = await asyncFs.open(path, 'r');
    let i = 0;
    let end = maxFileSize;

    const writeChunkToFile = async () => {
        if (i < filesize) {
            if (i + end > filesize) end = filesize - i;
            const buffer = new Uint8Array(end);
            const { bytesRead } = await file.read(buffer, 0, end, i);
            const data = new TextDecoder().decode(buffer.subarray(0, bytesRead));
            let fName = path.split('/')[2]; //'/dir/fName'
            if (i / maxFileSize > 0) {
                const chunk = Math.round(i / maxFileSize);
                if (fName.endsWith('.csv'))
                    fName = fName.substring(0, fName.length - 4) + '_' + chunk + '.csv';
                else fName += '_' + chunk;
            }
            CSV.saveCSV(data, fName);
            i += maxFileSize;
            await writeChunkToFile();
        }
    };

    await writeChunkToFile();
    await file.close();
    return true;
};

// Process CSV chunks from DB
export const processCSVChunksFromDB = async (path = 'data/myfile.csv', onData = (csvdata, start, end, size) => { }, maxChunkSize = 10000, start = 0, options = { transpose: false }) => {
    
    let fex = await exists(path);
    if(!fex) return false;

    const size = await getFileSize(path);
    let partition = start;
    const processPartition = async () => {
        let endChunk = partition + maxChunkSize;
        if (endChunk > size) endChunk = size;
        const result = await readCSVChunkFromDB(path, partition, endChunk, options);
        await onData(result, partition, endChunk, size);
        partition = endChunk;
        if (partition !== size) {
            await processPartition();
        }
    };
    await processPartition();
    return true;
};

// Read CSV chunk from DB
export const readCSVChunkFromDB = async (path = 'data/myfile.csv', start = 0, end: string | number = 'end', options = { transpose: false }) => {

    path = await checkDirInit(path);
    let fex = await exists(path);
    if(!fex) return "";

    const transpose = options.transpose || false;
    const header = await getCSVHeader(path);
    if (!header) return undefined;

    const resultNames = header.split(',');
    let size = await getFileSize(path);
    if (end === 'end') end = size;

    const data = (await readTextFileChunk(path, start, end as number))?.split('\n').slice(1, -1) as string[];
    const preprocess = (value) => {
        try {
            value = JSON.parse(value);
        } catch { }
        return value;
    };

    const results = transpose ? [] : {} as any;
    data.forEach((r) => {
        const row = r.split(',');
        if (transpose) {
            const entry = {};
            row.forEach((v, idx) => {
                entry[resultNames[idx]] = preprocess(v);
            });
            (results).push(entry);
        } else {
            row.forEach((v, i) => {
                const header = resultNames[i];
                if (!results[header]) results[header] = [];
                results[header].push(preprocess(v));
            });
        }
    });
    return results;
};

// Check if directory exists
export const dirExists = async (directory) => {
    try {
        const dir = await asyncFs.readdir(directory);
        return true;
    } catch (er) {
        return false;
    }
};



//redundant declaration prevents minification of names for the routes
export const ZenFsRoutes = {
    initFS: initFS,
    dirExists: dirExists,
    exists: exists,
    readFile: readFile,
    readTextFileChunk: readTextFileChunk,
    getFilenames: getFilenames,
    writeFile: writeFile,
    appendFile: appendFile,
    deleteFile: deleteFile,
    readFileAsText: readFileAsText,
    getFileSize: getFileSize,
    getCSVHeader: getCSVHeader,
    listFiles: listFiles,
    createFolder,
    deleteFolder
};