import React, {Component} from 'react'
import { StreamDefaults, Streams } from '../../scripts/streamclient';
import { ButtonGroup, ToggleButton, ToggleButtonGroup } from 'react-bootstrap';

export class StreamToggle extends Component<{
    toggled?:Partial<string[]>|undefined,
    subscribable?:Partial<string[]>|undefined,
    onChange:(ev:{key:string,checked:boolean}) => void,
    onlyOneActive?:boolean
}> {

    state={
        onChange: (ev:{key:string,checked:boolean}) => {},
        subscribable: [...StreamDefaults] as any as Partial<string[]>,
        toggled: [...StreamDefaults] as any as Partial<string[]>,
        defaultValue: [] as (string|number)[]
    }

    unique=`${Math.floor(Math.random()*1000000000000000)}`;

    constructor(props) {
        super(props);
        
        if(this.props.subscribable) this.state.subscribable = this.props.subscribable;
        if(this.props.toggled) {
            this.state.toggled = this.props.toggled; 
            this.state.toggled.forEach((v) => {
                let idx = this.state.subscribable.indexOf(v);
                if(idx > -1) {
                    this.state.defaultValue.push(idx);
                }
            })
        }
        
        if(this.props.onChange) this.state.onChange = this.props.onChange;
    }

    render() {

        return (
            <ToggleButtonGroup 
                className="mb-2" 
                type={(this.props.onlyOneActive ? "radio" : "checkbox") as any}
                defaultValue={(this.props.onlyOneActive ? this.state.defaultValue[0] : this.state.defaultValue) as any}
                onChange={((n,ev)=>{
                    const v = this.state.subscribable[parseInt(ev.target.value)] as string;
                    let idx = this.state.toggled.indexOf(v);
                    if(idx < 0) {
                        if(this.props.onlyOneActive) {
                            this.state.toggled.forEach((j:any) => {
                                this.state.onChange({key:j, checked:false});
                            });
                            this.state.toggled.length = 0;
                            this.state.toggled.push(v);
                            if(this.state.onChange) 
                                this.state.onChange({key:v,checked:true});
                        } else {
                            this.state.toggled.push(v);
                            if(this.state.onChange) 
                                this.state.onChange({key:v,checked:true});
                        }
                    }
                    else {
                        if(!this.props.onlyOneActive) {
                            this.state.toggled.splice(idx, 1);
                            if(this.state.onChange) 
                                this.state.onChange({key:v,checked:false});
                            
                        }
                    }
                    this.setState({});
                }) as any}
            >
                {
                    this.state.subscribable.map((v: any, i) => {
                        return <ToggleButton
                            id={this.unique+v}
                            key={this.unique+v}
                            value={i}
                            name={this.unique}
                            className='btnhover'
                            variant={this.state.toggled.indexOf(v) > -1 ? 'primary' : 'dark'}
                        >{(v as string).toUpperCase()}</ToggleButton>
                    })
                }
            </ToggleButtonGroup>
        );
    }
}