import Button from '../Button/Button'
import Input from '../Input/Input'
import FormLogin from '../FormLogin/FormLogin'
import FormRegistration from '../FormRegistration/FormRegistration'
import { useState } from 'react';


import s from './FormAuthorization.module.scss'

const Form = (props) => {
    const {
        handleRegistration,
        handleLogin,
        email,
        setEmail,
        password,
        setPassword,
        confirmPassword,
        setConfirmPassword,
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
                email={email}
                setEmail={setEmail}
                password={password}
                setPassword={setPassword}
            /> )}

            {activeTab === 'register' && ( <FormRegistration 
                onSubmit={handleRegistration}
                email={email}
                setEmail={setEmail}
                password={password}
                setPassword={setPassword}
                confirmPassword={confirmPassword}
                setConfirmPassword={setConfirmPassword}
            /> )}

        </div>
    )
}

export default Form

