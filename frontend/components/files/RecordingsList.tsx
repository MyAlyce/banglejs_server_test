import React, { Component } from "react";
import { Widget } from "../util/Widget";
import { Button, Col, Row } from "react-bootstrap";
import { ZenFsRoutes } from "../../scripts/data_util/zenfsUtils";
import { csvRoutes } from "../../scripts/data_util/fs_csv";
import { client, splitCamelCase, WebRTCclient } from "../../scripts/streamclient";
import { RTCCallInfo } from "../../scripts/streamclient";

import { workers } from 'device-decoder';
import gsworker from '../../scripts/csv.worker'
import { WorkerInfo } from 'graphscript-workers';
import {stateHandler} from '../../scripts/state'

import { drive } from "../../scripts/fetch";

import * as Icon from 'react-feather'

let GDriveIcon = "./assets/GDrive.svg";


export class RecordingsList extends Component<{dir?:string, streamId?:string}> {

    state = {
        folders:undefined as any,
        recordings:undefined
    }

    dir?:string;
    csvworker:WorkerInfo;
    streamId?:string;

    constructor(props:{dir?:string, streamId?:string}) {
        super(props);


        this.dir = props.dir;
        if(props.dir) stateHandler.data.selectedFolder = props.dir;
        this.streamId = props?.streamId;
    }

    async parseFolderList() {

        csvRoutes.readCSVChunkFromDB(
            client.currentUser.firstName+client.currentUser.lastName + '/folderList'
        ).then((data:any) => {
            this.setState({folders:data.folder});
            this.listRecordings();
        });
    }

    componentDidMount(): void {

        this.dir = stateHandler.data.selectedFolder;

        this.csvworker = workers.addWorker({url:gsworker});
        if(client.currentUser) this.csvworker.run('checkFolderList', [client.currentUser.firstName+client.currentUser.lastName+'/folderList', this.dir]).then(()=> {        
            this.parseFolderList();
        });
    }

    componentWillUnmount(): void {
        this.csvworker?.terminate();
    }
    //list from db
    async listRecordings() {
        let recordings = [] as any[];
        //get saved files in indexeddb
        //iterate and push divs with download & delete & backup
        //list backed up nonlocal files too? from gdrive

        let dir = this.dir ? this.dir : 
            this.streamId ? (WebRTCclient.rtc[this.streamId] as RTCCallInfo).firstName +(WebRTCclient.rtc[this.streamId] as RTCCallInfo).lastName : 
            client.currentUser.firstName + client.currentUser.lastName;
        
        let filelist = await ZenFsRoutes.listFiles(dir); //list for a particular user
        //getfilelist
        if(!stateHandler.data.selectedFolder) stateHandler.data.selectedFolder = dir;

        filelist.forEach((file) => {

            if(!file.includes('folderList') && !file.includes('state')) {

                let download = async () => {
                    csvRoutes.writeToCSVFromDB(dir+'/'+file, 10); //download files in chunks (in MB). !0MB limit recommended, it will number each chunk for huge files
                }
    
                let deleteFile = () => {
                    ZenFsRoutes.deleteFile(dir+'/'+file).then(() => {
                        this.listRecordings();
                    });
                }
    
                let backup = () => {
                    //google drive backup
                    drive.uploadFileToGoogleDrive(file, dir, undefined, undefined, undefined);
                }
    
                recordings.push (
                    <div key={file}>
                        <Row className='recordings'>
                            <Col xs lg="2" className='over'>{file}</Col>
                            <Col className="d-grid gap-2"><Button variant='secondary' onClick={download}><Icon.Download/></Button></Col>
                            <Col className="d-grid gap-2"><Button variant='danger' onClick={deleteFile}><Icon.X/></Button></Col>
                            <Col className="d-grid gap-2"><Button variant='caution' onClick={backup}><img src={GDriveIcon} height="50px" width="50px"></img ></Button></Col>
                        </Row>
                    </div>
                )
            } 
        });

        this.setState({recordings});

        return recordings;
    }


    render() {

        return (
            <Widget 
                header={( <b>Recordings</b> )}
                content={
                    <>
                    <label>Select Folder:</label>&nbsp;
                    <select value={stateHandler.data.selectedFolder} onChange={(ev)=>{ 
                            this.dir = ev.target.value; stateHandler.data.selectedFolder=ev.target.value; this.listRecordings(); 
                        }}
                    >
                        { this.state.folders ? this.state.folders.map((v) => {
                            return (<option value={v} key={v}>{splitCamelCase(v)}</option>)
                        }) : null }
                    </select>
                    <hr />
                    <div style={{maxHeight:'600px'}}>
                        {this.state.recordings ? this.state.recordings : ""}
                    </div>
                </>
                }
            />
        );
    }
}