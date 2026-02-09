import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Form from '../FormAuthorization/FormAuthorization'

const AddUser = () =>{

    const [confirmPassword, setConfirmPassword] = useState('');
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [registerEmail, setRegisterEmail] = useState('');
    const [registerPassword, setRegisterPassword] = useState('');
    const [userName, setUserName] = useState('');
    const [users, setUsers] = useState([])
    const navigate = useNavigate();

	const addUser = user => {
		setUsers(prev => [...prev, user])
	}

    const loginUser = (email, password) => {
        const savedUsers = JSON.parse(localStorage.getItem('users')) || [];

        const user = savedUsers.find(
            user => user.email === email && user.password === password
        );

        if (user) {
            localStorage.setItem('currentUser', JSON.stringify(user));
            return true;
        }

        return false;
    }

    const handleRegistration = (e) => {
        e.preventDefault();

        if (!userName || !registerEmail || !registerPassword || !confirmPassword) {
            alert("Заполните все поля");
            return;
        }

        if (registerPassword !== confirmPassword) {
            alert("Пароли не совпадают");
            return;
        }

        const newUser = { id: Date.now(), email: registerEmail, password: registerPassword, name: userName};

        addUser(newUser);

        const updatedUsers = [...users, newUser];
        localStorage.setItem('users', JSON.stringify(updatedUsers));

        localStorage.setItem('currentUser', JSON.stringify(newUser));

        setRegisterPassword('');
        setConfirmPassword('');
        setRegisterEmail('');
        setUserName('');

        alert('Вы зарегистрированы!');

    
    };

    const handleLogin = (e) => {
        e.preventDefault();
        if (!loginEmail || !loginPassword) {
            alert("Заполните все поля");
            return;
        }
        
        const isAuthenticated = loginUser(loginEmail, loginPassword);
        if (isAuthenticated) {
            setLoginPassword('');
            setLoginEmail('');
           navigate('/profile');

        } else {
            alert("Неверный email или пароль");
        }
    };

    return (
        <>
            <Form
                handleRegistration={handleRegistration}
                handleLogin={handleLogin}
                loginEmail={loginEmail}
                setLoginEmail={(e) => setLoginEmail(e.target.value)}
                loginPassword={loginPassword}
                setLoginPassword={(e) => setLoginPassword(e.target.value)}
                registerEmail={registerEmail}
                setRegisterEmail={(e) => setRegisterEmail(e.target.value)}
                registerPassword={registerPassword}
                setRegisterPassword={(e) => setRegisterPassword(e.target.value)}
                confirmPassword={confirmPassword}
                setConfirmPassword={(e) => setConfirmPassword(e.target.value)}
                userName={userName}
                setUserName={(e) => setUserName(e.target.value)}
            />
        </>
        
    );
}

export default AddUser;
