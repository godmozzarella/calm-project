import { useState } from 'react';

import Form from '../Form/Form'

const AddUser = (props) =>{

    const {
        addUser
    } = props

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [email, setEmail] = useState('');

    const [activeTab, setActiveTab] = useState('register'); 


    const handleAdd = (e) => {
        e.preventDefault();
        if (!email || !password || !confirmPassword) {
            alert("Заполните все поля");
            return;
        }

        if (password !== confirmPassword) {
            alert("Пароли не совпадают");
            return;
        }
        
        addUser({ id: Date.now(), password, confirmPassword, email });
        setPassword('');
        setConfirmPassword('');
        setEmail('');
        console.log("Add User button clicked!");
    };

    return (
        <div className="auth-wrapper" onSubmit={handleAdd}>
            <div className="tab-switcher">
                <div 
                    className={`tab ${activeTab === 'login' ? 'active' : ''}`}
                    onClick={() => setActiveTab('login')}
                >
                    Вход
                </div>
                <div 
                    className={`tab ${activeTab === 'register' ? 'active' : ''}`}
                    onClick={() => setActiveTab('register')}
                >
                    Регистрация
                </div>
                <div className="tab-slider" style={{ left: activeTab === 'register' ? '50%' : '0%' }}></div>
            </div>


            {activeTab === 'register' && ( <form>   
                <input  type="email" 
                        placeholder="Электронная почта" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)}/> 
                <input  type="password" 
                        placeholder="Пароль" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}/>   
                <input  type="password" 
                        placeholder="Повторите пароль" 
                        value={confirmPassword} 
                        onChange={(e) => setConfirmPassword(e.target.value)}/>   
                <button className='contrast-btn'>Зарегистрироваться</button> 

            </form>
            )}

            {activeTab === 'login' && ( <form> 
                
                <Form/>  
                <input  type="email" 
                        placeholder="Электронная почта" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)}/>
                <input  type="text" 
                        placeholder="Пароль" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}/>   
                <button className='contrast-btn'>Войти</button> 
            </form>
            )}
        </div>
    );
}

export default AddUser;
