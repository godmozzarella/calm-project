import Button from '../Button/Button'
import Input from '../Input/Input'
import { useState } from 'react';


import s from './RegAndLogForm.module.scss'

const Form = (props) => {
    const {
        handleAdd,
        email,
        setEmail,
        password,
        setPassword,
        confirmPassword,
        setConfirmPassword,
    } = props

    const [activeTab, setActiveTab] = useState('register'); 
    
    return (
        <div className={s.authWrapper} onSubmit={handleAdd}>
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


            {activeTab === 'register' && ( <form>   
                <Input  type="email" 
                        placeholder="Электронная почта" 
                        value={email} 
                        onChange={setEmail}/> 
                <Input  type="password" 
                        placeholder="Пароль" 
                        value={password}
                        onChange={setPassword}/>   
                <Input  type="password" 
                        placeholder="Повторите пароль" 
                        value={confirmPassword} 
                        onChange={setConfirmPassword}/>  
                <Button
                        colored
                        children={
                        <p className={s.buttonText}>Зарегистрироваться</p>
                    }
                />       
            </form>
            )}

            {activeTab === 'login' && (  
                <form> 
                    <Input
                        id="email"
                        type="email"
                        placeholder="Электронная почта"
                        value={email}
                        onChange={setEmail}
                    />
                    <Input
                        id="password"
                        type="password"
                        placeholder="Пароль"
                        value={password}
                        onChange={setPassword}
                    />
                    <Button
                        colored
                        children={
                            <p className={s.buttonText}>Войти</p>
                        }
                    />
                </form>
            )}
        </div>
    )
}

export default Form

