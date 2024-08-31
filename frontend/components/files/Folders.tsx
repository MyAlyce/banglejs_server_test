import React from 'react'

import {stateHandler} from '../../scripts/state'
import { client, setCamelCase, splitCamelCase } from '../../scripts/streamclient';
import { checkFolderList, parseFolderList } from '../../scripts/data_util/fs_csv';
import { sComponent } from '../util/state.component';
import { exists } from '../../scripts/data_util/zenfsUtils';


export class Folders extends sComponent<{dir?:string, onSelected?:(folder:string)=>void}> {

    unique=`folder${Math.floor(Math.random()*10000000000000)}`;

    folders=[] as string[]

    state={
        selectedFolder:""
    }


    constructor(props:{onSelected:(folder:string)=>void}) {
        super(props);
    }

    componentDidMount() {
        this.parseFolderList();
    }

    async parseFolderList() {
        exists(client.currentUser.firstName + client.currentUser.lastName+'/folderList').then((doesExist) => {
            if(doesExist) parseFolderList(client.currentUser.firstName + client.currentUser.lastName).then((folders) => {
                this.folders = folders;
                this.setState({});
            });
        })
    }

    render() {
        return (<>
            <select defaultValue={stateHandler.data.selectedFolder || this.props.dir} onChange={(ev)=>{
                if(this.props.onSelected) {
                    this.props.onSelected(ev.target.value);
                    this.setState({selectedFolder:ev.target.value});
                }
            }}>{...this.folders.map((v) => {
                return <option value={v}>{splitCamelCase(v)}</option>;
            })}</select>
            <input id={this.unique+'input'} type="text"></input>
            <button onClick={()=>{
                let newFolder = (document.getElementById(this.unique+'input') as any).value;
                if(newFolder) {
                    checkFolderList(
                        client.currentUser.firstName+client.currentUser.lastName+'/folderList', 
                        setCamelCase(newFolder)
                    ).then(() => {
                        this.parseFolderList();
                    });
                }
            }}>Add Folder</button>
        </>);
    }
}