import React, {Component} from 'react'
import {PopupModal} from '../Modal/Modal'
import { Button } from 'react-bootstrap';
import { Stopwatch } from '../State/StateStopwatch';
import {client, events, webrtcData} from '../../scripts/streamclient'
import {stateHandler} from '../../scripts/state'
import { recordEvent } from '../../scripts/recording';
import * as Icon from 'react-feather'
import { StateModal } from '../State/StateModal';
import { NoteForm } from './NoteForm';
import { EventStruct } from 'graphscript-database/src/services/struct/datastructures/types';

export class NoteModal extends Component<{streamId?:string, defaultShow?:boolean, onSubmit?:(message:any)=>void}> {

    unique = `notemodal${Math.floor(Math.random()*1000000000000000)}`

    state = {
        writeIn:false,
        selectedTimeInput:'date'
    }

    defaultOptions = [
        'Event',
        'Vitals',
        'Sleep',
        'Mood',
        'Exercise',
        'Medication',
        'Social'
    ] as string[];
    
    savedEventOptions = stateHandler.data.savedEventOptions as string[];

    startTime = Date.now();
    endTime = undefined;
    ref:any; ref2:any; ref3:any

    streamId?:string;

    constructor(props:{streamId?:string, defaultShow?:boolean, onSubmit?:(message:any)=>void}) {
        super(props);
        this.ref = React.createRef();
        this.ref2 = React.createRef();
        this.ref3 = React.createRef();
        if(!stateHandler.data.selectedTimeInput) stateHandler.data.selectedTimeInput = 'date';
        this.streamId = props.streamId;
    }


    submit = async () => {
        let note = {
            notes:(document.getElementById(this.unique+'notes') as HTMLInputElement).value,
            event:(document.getElementById(this.unique+'event') as HTMLInputElement).value,
            timestamp:this.startTime,
            grade:parseInt((document.getElementById(this.unique+'grade') as HTMLInputElement).value)
        };
        if(!note.event) note.event = 'Event';
        else note.event = formatWord(note.event);
        if(!note.timestamp) note.timestamp = Date.now();

        
        if(this.state.writeIn) {

            if(!this.savedEventOptions.includes(note.event)) {
                this.savedEventOptions.push(
                    note.event
                );
                stateHandler.setState({savedEventOptions:this.savedEventOptions});
                //write saved options to file
            }
        }

        if(client.currentUser) //todo switch to google drive backup
            await client.addEvent(
                client.currentUser, 
                client.currentUser._id, 
                note.event, 
                note.notes,
                this.startTime, 
                this.endTime, 
                note.grade 
            ) as EventStruct;

        
        let from;
        if(this.streamId) {
            from = webrtcData.availableStreams[this.streamId].firstName + webrtcData.availableStreams[this.streamId].lastName;
        } else {
            from = client.currentUser.firstName + client.currentUser.lastName;
        }

        let message = {
            from:from,
            event:note.event,
            notes:note.notes,
            grade:note.grade,
            startTime:this.startTime,
            endTime:this.endTime,
            timestamp:note.timestamp as number
        };

        for(const key in webrtcData.availableStreams) {
            webrtcData.availableStreams[key].send({event:message});
        }

        recordEvent(from, message, this.streamId);

        events.push(message as any);

        if(this.props.onSubmit) {
            this.props.onSubmit(message);
        }
   
    }

    render() {
 
        let now = new Date();
        this.startTime = now.getTime();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        let localDateTime = now.toISOString().slice(0,16);
        
        return (
            <>            
                <StateModal
                    stateKey={this.streamId ? `${this.streamId}notemodal` : 'notemodal'}
                    defaultShow={this.props.defaultShow}
                    title={"New Event Log"} 
                    body={<>
                        <NoteForm
                            streamId={this.props.streamId}
                            onSubmit={this.props.onSubmit}
                        />
                    </>}
                />
            </>
        )
    }
}


const updateInputColor = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value);
    const color = getColorGradientRG(value);
    event.target.style.backgroundColor = color;
}



function getColorGradientRG(value) {
    let r, g, b;

    if (value < 5) {
        r = Math.floor(200 * (value / 5));
        g = 200;
        b = 0;
    } else {
        r = 200;
        g = Math.floor(200 * (1 - (value - 5) / 5));
        b = 0;
    }
            
    return `rgb(${r}, ${g}, ${b})`;
}


function formatWord(str) {
    const firstLetter = str.charAt(0);
    const firstLetterCap = firstLetter.toUpperCase();
    const remainingLetters = str.slice(1).toLowerCase();
    return firstLetterCap + remainingLetters;
}