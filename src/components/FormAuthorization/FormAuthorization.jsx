
import FormLogin from '../FormLogin/FormLogin'
import FormRegistration from '../FormRegistration/FormRegistration'
import { useState} from 'react';


import s from './FormAuthorization.module.scss'

const Form = (props) => {
    const {
        handleRegistration,
        handleLogin,
        loginEmail,
        setLoginEmail,
        registerEmail,
        setRegisterEmail,
        loginPassword,
        setLoginPassword,
        registerPassword,
        setRegisterPassword,
        confirmPassword,
        setConfirmPassword,
        userName,
        setUserName
    } = props

    const [activeTab, setActiveTab] = useState('login'); 

    
    
    return (
        <div className={s.authWrapper}>
            <div className={s.tabSwitcher}>
                <div 
                    className={`${s.tab} ${activeTab === 'login' ? 'active' : ''}`}
                    onClick={() => setActiveTab('login')}
                >
                    Вход
                </div>
                <div 
                    className={`${s.tab} ${activeTab === 'register' ? 'active' : ''}`}
                    onClick={() => setActiveTab('register')}
                >
                    Регистрация
                </div>
                <div className={s.tabSlider} style={{ left: activeTab === 'register' ? '50%' : '0%' }}></div>
            </div>

            {activeTab === 'login' && ( <FormLogin 
                onSubmit={handleLogin}
                email={loginEmail}
                setEmail={setLoginEmail}
                password={loginPassword}
                setPassword={setLoginPassword}
            /> )}

            {activeTab === 'register' && ( <FormRegistration 
                onSubmit={handleRegistration}
                email={registerEmail}
                setEmail={setRegisterEmail}
                password={registerPassword}
                setPassword={setRegisterPassword}
                confirmPassword={confirmPassword}
                setConfirmPassword={setConfirmPassword}
                userName={userName}
                setUserName={setUserName}
            /> )}

        </div>
    )
}

export default Form

