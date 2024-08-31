import React, {Component} from 'react'
import { WebRTCclient, RTCCallInfo } from '../../scripts/streamclient';
import { UserBar } from '../User/UserBar';
import { Widget } from '../util/Widget';
import { Card } from 'react-bootstrap';
import { ToggleAudioVideo } from '../WebRTC/Calling';

const personIcon = './assets/person.jpg';

let selectedKey = "Demo" as string|undefined;

export class StreamSelect extends Component<{[key:string]:any}> {
   
    state = { //synced with global state
        activeStream:undefined as any,
        dropdownOpen: true
    }

    wrapperRef:any;
    selectedKey?:string = selectedKey;

    onchange=(key, activeStream)=>{}

    constructor(props:{onChange:(key)=>void, selected?:string}) {
        super(props);
        if(props.selected) this.state.activeStream = props.selected;
        if(props?.onChange) 
            this.onchange = props.onChange;
    }
    

    // componentDidMount() {
    //     document.addEventListener('mousedown', this.handleClickOutside);
    // }

    // componentWillUnmount() {
    //     document.removeEventListener('mousedown', this.handleClickOutside);
    // }

    setWrapperRef = (node) => {
        this.wrapperRef = node;
    };
    
    // handleClickOutside = (event) => {
    //     // if (this.wrapperRef && !this.wrapperRef.contains(event.target)) {
    //     //     this.setState({ dropdownOpen: false });
    //     // }
    // };

    toggleDropdown = () => {
        this.setState({ dropdownOpen: !this.state.dropdownOpen });
    };

    onItemClick = (key: string | undefined) => {
        //console.log(key);
        let activeStream;
        if(key === 'My Device' || key === 'Demo')
            activeStream = undefined;//, dropdownOpen: false });
        else 
            activeStream = key;

        if(this.selectedKey !== key) 
            this.onchange(key, activeStream);
        
        this.selectedKey = key;

        selectedKey = key as string;
            
    };

    render() {
      
        return (
            <Widget 
                header={<div style={{cursor:'pointer', width:'100%', height:'100%'}} onClick={this.toggleDropdown}><b>Live Streams | </b> {this.state.activeStream
                    ? (
                        <>{(WebRTCclient.rtc[this.state.activeStream] as RTCCallInfo).firstName} {(WebRTCclient.rtc[this.state.activeStream] as RTCCallInfo).lastName} 
                    </>)
                    : this.selectedKey}</div>}
                content={
                    <div ref={this.setWrapperRef} className="stream-select">
                        
                        {this.state.dropdownOpen && (
                        <div className="d-flex flex-column" style={{gap: '10px', padding: '10px'}}>

                            <span
                                key="Demo"
                                style={{cursor:'pointer'}}
                                onClick={() => this.onItemClick('Demo')}
                                className={this.state.activeStream === undefined ? 'selected' : ''}
                            >
                                <Widget className='hoverdiv' header={"Demo Data"} content={<></>}/>
                            </span>
                            <span
                                key="My-Device"
                                style={{cursor:'pointer'}}
                                onClick={() => this.onItemClick('My Device')}
                                className={this.state.activeStream === undefined ? 'selected' : ''}
                            >
                                <Widget className='hoverdiv'  header={<>My Device</>} content={<UserBar hideAlertModal={true}/>} />
                                
                            </span>
                            {Object.keys(WebRTCclient.rtc).length > 0 &&
                            Object.keys(WebRTCclient.rtc).map((key) => {
                                return (
                                <span
                                    key={key}
                                    style={{cursor:'pointer'}}
                                    onClick={() => this.onItemClick(key)}
                                    className={this.state.activeStream === key ? 'selected' : ''}
                                >
                                    <Widget className='hoverdiv'  content={
                                        <UserBar 
                                            streamId={key} 
                                            hideAlertModal={true} 
                                            hideMessageModal={true}
                                        />
                                    } />
                                </span>
                                );
                            })}
                        </div>
                        )}
                    </div>
                }
            />
           
        );
    }
}