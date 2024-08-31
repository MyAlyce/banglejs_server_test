import React, { Component } from 'react';
import { EventHandler } from 'graphscript-core';

import { stateHandler } from '../../scripts/state';

export class sComponent<P = {} & {
    state?: EventHandler;
    doNotSubscribe?: string[]; // can skip certain props
}, S = {}> extends Component<P, S> {
    __statemgr = stateHandler as EventHandler;
    __state_subs: { [key: string]: number } = {};
    __updated: any[] = [];
    __unique = `component${Math.floor(Math.random() * 1000000000000000)}`;

    react_setState = this.setState.bind(this);

    constructor(
        props: P & {
            state?: EventHandler;
            doNotSubscribe?: string[]; // can skip certain props
        } = {} as P & {
            state?: EventHandler; // can apply a new state other than the global state so you can have states for certain pages, for example
        }
    ) {
        super(props);

        if (props.state) // synced with global state
            this.__statemgr = props.state;

        this.setState = (s: any) => {
            this.__updated = Object.keys(s);
            this.react_setState(s);
            if (typeof s === 'object') {
                stateHandler.setState(s); // now relay through event handler
            }
        };

        let found: Partial<S> = {};
        for (const prop in this.state) { // for all props in state, subscribe to changes in the global state
            if (props?.doNotSubscribe && props.doNotSubscribe.indexOf(prop) > -1) continue;
            if (prop in this.__statemgr.data) found[prop as keyof S] = this.__statemgr.data[prop];
        }
        if (Object.keys(found).length > 0) {
            Object.assign(this.state, found);
        }
        setTimeout(() => {
            for (const prop in this.state) { // for all props in state, subscribe to changes in the global state
                if (props?.doNotSubscribe && props.doNotSubscribe.indexOf(prop) > -1) continue;
                if (prop in this.__statemgr.data) found[prop as keyof S] = this.__statemgr.data[prop];
                this.__subscribeComponent(prop);
            }
            if (Object.keys(found).length > 0) this.react_setState(found); // override defaults
        }, 0.001);
    }

    __subscribeComponent(prop: string, onEvent?: (value: any) => void) {
        let sub = this.__statemgr.subscribeEvent(prop, (res) => {
            let c = this;
            if (typeof c === 'undefined') { // the class will be garbage collected by react and this will work to unsubscribe
                this.__statemgr.unsubscribeEvent(prop, sub);
            } else {
                if (onEvent) onEvent(res);
                let wasupdated = this.__updated.indexOf(prop);
                if (wasupdated > -1) {
                    this.__updated.splice(wasupdated, 1);
                } else {
                    this.react_setState({ [prop]: res } as Pick<S, keyof S>); // only updates one prop at a time rn
                }
            }
        });
        this.__state_subs[prop] = sub as number;

        return sub;
    }

    __unsubscribeComponent(prop?: string) {
        if (!prop) {
            for (const key in this.__state_subs) {
                this.__statemgr.unsubscribeEvent(key, this.__state_subs[key]);
            }
        } else this.__statemgr.unsubscribeEvent(prop, this.__state_subs[prop]);
    }
}
