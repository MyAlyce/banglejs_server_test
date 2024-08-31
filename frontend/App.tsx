import React from 'react';
import { sComponent } from './components/util/state.component';
import Login from './components/login';
import Espruino from './components/espruino';
import { Chart } from './components/chart/Chart';
import { AnswerCallModal, CallSelf, MediaDeviceOptions, ToggleAudioVideo, ViewSelfVideoStream } from './components/WebRTC/Calling';
import { RTCAudio, RTCVideo } from './components/WebRTC/WebRTCStream';
import { RTCCallInfo, WebRTCclient, getActiveStream, getActiveStreamDir, getCallLocation, webrtcData } from './scripts/streamclient';
import { Widget } from './components/util/Widget';
import { Folders } from './components/files/Folders'
import { RecordBar } from './components/files/RecordBar';

import { RecordingsList } from './components/files/RecordingsList';
import { UserBar } from './components/User/UserBar';
import { getCurrentLocation } from './scripts/gps';
import { WebRTCInfo } from 'graphscript-frontend';
import { CardGroup } from 'react-bootstrap';
import { NoteTaking } from './components/files/NoteTaking';
import { FriendsModal } from './components/User/FriendsModal';


let appLogo = './assets/myalyce.png';


//themes
import './styles/theme.scss'
import './styles/components_global.css'
import { NoteModal } from './components/files/NoteModal';

interface AppState {
    isLoggedIn: boolean;
    route: string;
    activeStream?: string;
    selectedFolder?: string;
    triggerPageRerender?: boolean;
    viewVitals?: boolean;
    availableStreams: {
        [key: string]: WebRTCInfo;
    }
    selectedAudioOut?: string;
    unansweredCalls?: any[]
}

let skipLogin = false;

class App extends sComponent<{}, AppState> {

    statesub1?: number;
    selectedCoords?: string;

    state: AppState = {
        isLoggedIn: false,
        route: '/',
        activeStream: undefined,
        selectedFolder: undefined,
        triggerPageRerender: false,
        viewVitals: true,
        availableStreams: WebRTCclient.rtc,
        selectedAudioOut: undefined,
        unansweredCalls: undefined
    };

    constructor(props: {}) {
        super(props);
    }


    componentDidMount(): void {
        //todo: add menu and make it so the menu changes the pages
        this.statesub1 = this.__statemgr.subscribeEvent('route', (route: string) => {
            window.history.pushState(undefined, route, location.origin + route); //uhh
        });
        if (this.state.activeStream) {
            this.__subscribeComponent(this.state.activeStream + 'hasAudio');
            this.__subscribeComponent(this.state.activeStream + 'hasVideo');
        }
    }

    componentWillUnmount(): void {
        this.__statemgr.unsubscribeEvent('route', this.statesub1);
        if (this.state.activeStream) {
            this.__unsubscribeComponent(this.state.activeStream + 'hasAudio');
            this.__unsubscribeComponent(this.state.activeStream + 'hasVideo');
        }
    }

    flipState() {
        setTimeout(() => {
            this.setState({ triggerPageRerender: false });
        }, 0.01);
    }

    render() {

        if (this.state.triggerPageRerender) {
            this.flipState();
            return;
        }

        const { route, isLoggedIn, activeStream, selectedFolder, unansweredCalls } = this.state;

        let dir = isLoggedIn ? getActiveStreamDir() : undefined;
        let call = isLoggedIn ? getActiveStream() : undefined;

        //console.log(unansweredCalls);

        return (


            //the App level class is where we'll lay out our page workflow, then the sub components will contain specific functionalities or nested modules 
            <div>
                {!(skipLogin || isLoggedIn) ?
                    <div className='logincover' style={{ zIndex: 100, color: 'white' }}>
                        <div className="wave-container">
                            <div className="wave"></div>
                            <div className="wave"></div>
                            <div className="wave"></div>
                            <div className="wave"></div>
                            <div className="wave"></div>
                        </div>
                        <div className="wave-container2">
                            <div className="wave"></div>
                            <div className="wave"></div>
                            <div className="wave"></div>
                            <div className="wave"></div>
                            <div className="wave"></div>
                        </div>
                        <div className="cover-content">
                            <img className="img-fluid" width="75%" alt="MyAlyce" src={appLogo} />
                            <br /><br /><br />
                            <Login />
                        </div>
                    </div>

                    : //or                     

                    //Logged in app main body
                    (route === '/home' || route === '/') ?

                        <>
                            <Espruino showLogger={false} />
                            <Chart sensors={['ppg']} title="Heart Rate Monitor" />
                            {/* 
                                <Chart sensors={['hr']} title="Heart Rate Algorithm"/>
                                <Chart sensors={['accel']} title="Accelerometer"/>
                                <Chart sensors={['compass']} title="Compass"/>
                                <Chart sensors={['env']} title="Environmental Sensor"/>  */
                            }

                            {isLoggedIn ? //drive backup, friends, webrtc, and drive backup examples
                            <>

                                {/**Modals i.e. hidden floating elements triggered in context, they could also be added/removed but this is easy */}
                                <NoteModal />
                                {this.state.availableStreams && Object.keys(this.state.availableStreams).map((rtcId) => {
                                    return <NoteModal streamId={rtcId} />
                                }) //render note modals top level to preserve timers
                                }
                                {unansweredCalls && Object.keys(unansweredCalls).map((rtcId) => {
                                    return <span key={Math.random()}><AnswerCallModal streamId={rtcId} /></span>
                                })}

                                {/** User interactions testing */}
                                <>
                                    <Widget
                                        title={
                                            <UserBar
                                                streamId={this.state.activeStream}
                                                //useActiveStream={true}
                                                pinOnClick={call ? () => {
                                                    getCallLocation(call as RTCCallInfo).then((res) => {
                                                        if (res?.latitude) {
                                                            this.selectedCoords = `${res?.latitude},${res?.longitude}`
                                                            this.setState({});
                                                        }
                                                    });
                                                } : () => {
                                                    getCurrentLocation().then((res) => {
                                                        if (res?.latitude) {
                                                            this.selectedCoords = `${res?.latitude},${res?.longitude}`
                                                            this.setState({});
                                                        }
                                                    });
                                                }}
                                                vitalsOnClick={() => {
                                                    this.setState({ viewVitals: !this.state.viewVitals })
                                                }}
                                                xOnClick={call ? () => {
                                                    call?.terminate();
                                                    delete WebRTCclient.rtc[(call as RTCCallInfo)._id];
                                                    this.setState({ activeStream: undefined, triggerPageRerender: true, availableStreams: WebRTCclient.rtc });
                                                } : undefined}
                                                videoOnClick={call ? (onState) => {
                                                    this.setState({});
                                                } : undefined}
                                                audioOnClick={call ? (onState) => {
                                                    this.setState({});
                                                } : undefined}
                                            />
                                        }
                                    />
                                </>

                                {/** Stream recording and google drive testing */}
                                <>
                                    <Folders dir={selectedFolder || dir} />
                                    <RecordBar dir={selectedFolder || dir} streamId={activeStream} />
                                    <RecordingsList dir={selectedFolder || dir} streamId={activeStream} />
                                    <NoteTaking
                                        showInput={false}
                                        streamId={this.state.activeStream}
                                        filename={this.state.activeStream ? this.state.activeStream + '.csv' : 'Notes.csv'}
                                        dir={dir}
                                    />
                                </>

                                {/** WebRTC testing */}
                                <>
                                    <FriendsModal />
                                    <CallSelf />
                                    {(call?.viewingVideo || call?.viewingAudio) &&
                                        <CardGroup>
                                            {call?.viewingVideo &&
                                                <Widget
                                                    content={
                                                        <>
                                                            <RTCVideo
                                                                call={call}
                                                            />
                                                        </>
                                                    }
                                                />
                                            }
                                            {
                                                call?.viewingAudio &&
                                                <Widget
                                                    content={
                                                        <>
                                                            <RTCAudio
                                                                call={call}
                                                                audioOutId={this.state.selectedAudioOut}
                                                            />
                                                        </>
                                                    }
                                                />
                                            }
                                        </CardGroup>
                                    }
                                    <MediaDeviceOptions />
                                    {activeStream && <><ViewSelfVideoStream streamId={activeStream} /> {webrtcData.availableStreams[activeStream].audioStream && <RTCAudio />} </>}

                                    {this.state.activeStream ?
                                        <Widget
                                            content={
                                                <ToggleAudioVideo streamId={this.state.activeStream}
                                                    videoOnClick={(onState: boolean) => {
                                                        //toggle picture in picture
                                                        this.setState({});
                                                    }}
                                                    audioOnClick={(onState: boolean) => {
                                                        //toggle local volume controls
                                                        this.setState({});
                                                    }} />
                                            }
                                        /> : null}
                                </>

                            </> : null}
                        </>

                        : //or 

                        //other pages 
                        route === '/settings' ?
                        <>

                        </>

                        : //or 

                        route === '/test' ?
                        <>

                        </>

                        : //or  

                        null
                }
            </div>
        );
    }
}

export default App;


///todo reimplement browserfs, csv, and then implement a progressive data backup system for google sheets