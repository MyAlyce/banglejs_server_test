import React from 'react'
import { sComponent } from "../util/state.component";
import { recordCSV, stopRecording } from '../../scripts/recording';
import { SensorDefaults, Sensors, client, WebRTCclient } from '../../scripts/streamclient';
import { StreamToggle } from '../Streams/StreamToggle';
import * as Icon from 'react-feather'
import { RTCCallInfo } from '../../scripts/streamclient';

export class RecordBar extends sComponent<{
    toggled?:string[], toggleable?:string[], dir?:string, 
    streamId?:string, onChange?:(ev:{isRecording:boolean, streamId?:string})=>void
}> {

    state = {
        streamRecording:undefined,
        activeStream:undefined,
    }
    
    dir?:string;
    toggled=[...SensorDefaults] as string[];
    toggleable=[...SensorDefaults] as string[];
    isRecording = false;

    constructor(props:{toggled?:string[], toggleable?:string[], dir?:string, streamId?:string, onChange:(ev:{isRecording:boolean, streamId?:string})=>void}) {
        super(props);

        if(props.toggled) this.toggled = props.toggled;
        if(props.toggleable) this.toggleable = props.toggleable;
        this.dir = props.dir ? props.dir : client.currentUser.firstName+client.currentUser.lastName;
        this.isRecording = this.__statemgr.data[props.streamId ? props.streamId+'isRecording':'isRecording'];
    }

    componentDidMount(): void {
        //this.__subscribeComponent(this.props.streamId ? this.props.streamId : '');
        this.__subscribeComponent(this.props.streamId ? this.props.streamId+'isRecording':'isRecording');
    }

    componentWillUnmount(): void {
        //this.__unsubscribeComponent
        this.__unsubscribeComponent(this.props.streamId ? this.props.streamId+'isRecording':'isRecording');
    }


    record(streamId?:string, sensors?:Sensors[], subTitle?:string, dir:string=this.dir as string) {
        recordCSV(streamId, sensors, subTitle, dir);
        if(this.props.onChange) this.props.onChange({isRecording:true, streamId})
    }

    async stopRecording(streamId?:string, dir:string=this.dir as string) {
        await stopRecording(streamId, dir, client.currentUser.firstName+client.currentUser.lastName); //folder list will be associated with current user so they will only see indexeddb folders for users they are associated with
        if(this.props.onChange) this.props.onChange({isRecording:false, streamId})
    }

    render () {
        
        let dir = this.dir ? this.dir : 
            this.state.activeStream ? (WebRTCclient.rtc[this.state.activeStream] as RTCCallInfo).firstName + (WebRTCclient.rtc[this.state.activeStream] as RTCCallInfo).lastName : 
            client.currentUser.firstName + client.currentUser.lastName;
        
        return (
            <div className="d-grid gap-2">
                {this.__statemgr.data[this.props.streamId ? this.props.streamId+'isRecording':'isRecording'] ? 
                    <button  onClick={()=>{ 
                        stopRecording(this.props.streamId, dir, client.currentUser.firstName+client.currentUser.lastName) 
                    }}>
                        <Icon.Pause className="align-text-bottom" size={20}></Icon.Pause>&nbsp;Pause
                    </button> 
                        : //OR
                    <>
                        <button  onClick={()=>{
                            this.record(this.props.streamId, this.toggled as any, dir, dir)}}
                        >
                            <Icon.Circle className="align-text-bottom" size={20}></Icon.Circle>&nbsp;Record
                        </button>{' '}
                        <StreamToggle 
                            toggled={this.toggled as any}
                            subscribable={this.toggleable as any}
                            onChange = {(ev:any)=>{ 
                               
                            }}
                        />
                    </> 
                }
            </div>
        );
    }
}