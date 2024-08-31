import React, {Component} from "react"
import { googleAPI } from "../../scripts/fetch"
import { PopupModal } from "../Modal/Modal"


export class GoogleMapsModal extends Component<{selectedCoords:string}> {

    constructor(props) {
        super(props);

    }

    render() {
        return (
            <PopupModal
                defaultShow={true}
                body={
                <>
                    { googleAPI.mapsKey ? 
                        <iframe width="100%" height="500px" style={{border:0}} loading="lazy" allowFullScreen={true}
                        src={`https://www.google.com/maps/embed/v1/place?q=${this.props.selectedCoords}&key=${googleAPI.mapsKey}`}></iframe>
                        :
                        <div>NO MAPS API KEY</div>
                    }
                    
                </>
                }
                onClose={()=>{this.setState({selectedCoords:undefined})}}
            /> 
        )
    }
   
}