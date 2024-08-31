import { GDrive } from "./GDrive";
import { appendFile, formatPath, readFile } from "./IDButils"//"./zenfsUtils";

//utils to talk between zenfs and google drive directly
export class FS_Drive {

    GDriveInstance: GDrive;

    constructor(GDriveInstance: GDrive) {
        this.GDriveInstance = GDriveInstance;
    }

    //backup BFS file to drive by name (requires gapi authorization)
    backupFS_CSVToDrive = (
        path: string, //'/dir/fname',
        mimeType?:string
    ) => {
        if (!mimeType) mimeType = this.inferMimeType(path);
        return new Promise(async (res, rej) => {
            path = formatPath(path);
            if (this.GDriveInstance.isLoggedIn) {
                readFile(path).then((output) => {
                    if (!output) return;
                    let file = new Blob([output], { type: mimeType });
                    this.GDriveInstance.checkFolder(this.GDriveInstance.directory, (result) => {
                        //console.log(result);`
                        let metadata = {
                            'name': path.split('/')[2], //should be fname following convention
                            'mimeType': mimeType,
                            'parents': [result.files[0].id]
                        }
                        let token = this.GDriveInstance.gapi.auth.getToken().access_token;
                        var form = new FormData();
                        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
                        form.append('file', file);

                        var xhr = new XMLHttpRequest();
                        xhr.open('post', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id');
                        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
                        xhr.responseType = 'json';
                        xhr.onload = () => {
                            console.log("Uploaded file id: ", xhr.response.id); // Retrieve uploaded file ID.
                            //this.listDriveFiles();
                            res(true);
                        };
                        xhr.send(form);
                    });
                }).catch(console.error);
            } else {
                console.warn("Sign in with Google first!");
                this.GDriveInstance.handleUserSignIn().then(async () => {
                    if (this.GDriveInstance.isLoggedIn) {
                        res(await this.backupFS_CSVToDrive(path, mimeType)); //rerun
                    }
                });

            }
        });

    }


    //pass a queried drive folder (i.e. from listDriveFiles)
    driveToLocalDB = (
        file: { id: string, name: string, [key: string]: any }, //you need the file id from gdrive
        backupDir = 'data',
        ondownload = (body) => { },
        mimeType?:string
    ) => {
        if (!mimeType) mimeType = this.inferMimeType(file.name);
        return new Promise((res, rej) => {
            if (this.GDriveInstance.isLoggedIn) {
                var request = this.GDriveInstance.gapi.client.drive.files.export({
                    'fileId': file.id, 'mimeType': mimeType
                });
                request.then(async (resp) => {
                    let filename = file.name;
                    const path = formatPath(filename, backupDir)
                    await appendFile(
                        path,
                        resp.body
                    );

                    ondownload(resp.body);
                    res(resp.body);
                });
            } else {
                console.warn("Sign in with Google first!");
                this.GDriveInstance.handleUserSignIn().then(async () => {
                    if (this.GDriveInstance.isLoggedIn) {
                        res(await this.driveToLocalDB(
                            file,
                            backupDir, //rerun
                            ondownload,
                            mimeType
                        ))
                    }
                });
            }
        });
    }

    inferMimeType = (path, download=false) => {
        const ext = path.split('.').pop().toLowerCase();
        switch (ext) {
            case 'csv': return download ? 'text/csv' : 'application/vnd.google-apps.spreadsheet' //interactable as spreadsheet
            case 'tsv': return 'text/tab-separated-values';
            case 'txt': return 'text/plain';
            case 'html': return 'text/html';
            case 'json': return 'application/json';
            case 'xml': return 'application/xml';
            case 'jpg':
            case 'jpeg': return 'image/jpeg';
            case 'png': return 'image/png';
            case 'gif': return 'image/gif';
            case 'bmp': return 'image/bmp';
            case 'tiff': return 'image/tiff';
            case 'webp': return 'image/webp';
            case 'pdf': return 'application/pdf';
            case 'doc': return 'application/msword';
            case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            case 'xls': return 'application/vnd.ms-excel';
            case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            case 'ppt': return 'application/vnd.ms-powerpoint';
            case 'pptx': return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
            case 'odt': return 'application/vnd.oasis.opendocument.text';
            case 'ods': return 'application/vnd.oasis.opendocument.spreadsheet';
            case 'odp': return 'application/vnd.oasis.opendocument.presentation';
            case 'rtf': return 'application/rtf';
            case 'zip': return 'application/zip';
            case 'rar': return 'application/vnd.rar';
            case '7z': return 'application/x-7z-compressed';
            case 'tar': return 'application/x-tar';
            case 'gz': return 'application/gzip';
            case 'mp3': return 'audio/mpeg';
            case 'wav': return 'audio/wav';
            case 'ogg': return 'audio/ogg';
            case 'mp4': return 'video/mp4';
            case 'avi': return 'video/x-msvideo';
            case 'mov': return 'video/quicktime';
            case 'wmv': return 'video/x-ms-wmv';
            case 'flv': return 'video/x-flv';
            case 'mkv': return 'video/x-matroska';
            // Add more cases as needed
            default: return 'application/octet-stream';
        }
    };


}