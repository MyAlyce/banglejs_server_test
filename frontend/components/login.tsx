import React from 'react';
import { sComponent } from './util/state.component';
import { stateHandler } from '../scripts/state';
import { fetchLogin,  handleSignIn, signOut } from '../scripts/fetch';

interface LoginState {
    isLoggedIn: boolean;
    user: string | null;
    users: Array<{ googleId: string; name: string; email: string }>;
}

let googleLogo = './assets/google.png';

class Login extends sComponent<{}, LoginState> {
    state: LoginState = {
        isLoggedIn: false,
        user: null,
        users: []
    };

    constructor(props) {
        super(props);
    }

    async componentDidMount() {
        await handleSignIn('g_id_signin', this.onSignIn);
    }

    async onSignIn(result: any) {

        // this.fetchUserData(result.id, result.access_token);
    }

    signOut() {
        signOut();
        // Update the login state using EventHandler
        stateHandler.setState({ isLoggedIn: false });
    }

    render() {
        const { users } = this.state;
        return (
            <div>
                <button id="g_id_signin">Sign In With Google <img src={googleLogo} width="50px"></img></button>
            </div>
        );
    }
}

export default Login;
