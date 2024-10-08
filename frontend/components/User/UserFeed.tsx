import React from 'react';
import * as Icon from 'react-feather';
import { StreamText } from '../Streams/StreamText';
import { Col, Row } from 'react-bootstrap';
import { BeatingSVG } from '../BeatingSVG/BeatingSVG';

export function UserFeed(props:{streamId?:string, width?:string}) {

  return (
      <Col className="my-auto" style={{minWidth:props.width, borderRadius:'10px', backgroundColor:'rgba(255,255,255,0.9)'}}>
        <Row>
          <Col className="my-auto" title="Heart Rate">
            <BeatingSVG subscribeTo={props.streamId ? props.streamId+'hr' : 'hr'} objectKey={'hr'}/>
                <br/><StreamText movingAverage={3} stateKey={props.streamId ? props.streamId+'hr' : 'hr'} objectKey={'hr'}/> /min
          </Col> 
          <Col className="my-auto" title="Heart Rate Variability">
            <BeatingSVG subscribeTo={props.streamId ? props.streamId+'hr' : 'hr'} objectKey={'hr'} customContent={<Icon.Activity color="darkgreen" size={40}/>}/>
            <br/><br/><StreamText stateKey={props.streamId ? props.streamId+'hr' : 'hr'} objectKey={'hrv'} movingAverage={3} /> HRV
          </Col>
          <Col className="my-auto" title="Breathing Rate">
            <BeatingSVG subscribeTo={props.streamId ? props.streamId+'breath' : 'breath'} bpm={0.00001} objectKey={'breath'} customContent={<Icon.Wind size={40}></Icon.Wind>}/>
            <br/><br/><StreamText stateKey={props.streamId ? props.streamId+'breath' : 'breath'} objectKey={'breath'}/> /min
          </Col>
        </Row>
      </Col>
      
  );
}

/**
 * 
 *TODO: make these tooltips instead for the card body so it's more intuitive 
    <Overlay target={target.current} show={show} placement="top"> 
        {({
          placement: _placement,
          arrowProps: _arrowProps,
          show: _show,
          popper: _popper,
          hasDoneInitialMeasure: _hasDoneInitialMeasure,
          ...props
        }) => (
          <div
            {...props}
            style={{
              position: 'absolute',
              backgroundColor: '#CA7EFC',
              padding: '2px 10px',
              color: 'white',
              borderRadius: 3,
              ...props.style,
            }}
          >
            Heart Rate
          </div>
        )}
      </Overlay> 
 */