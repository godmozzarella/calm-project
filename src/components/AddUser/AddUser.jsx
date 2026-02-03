import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Form from '../FormAuthorization/FormAuthorization'
import Users from '../Users/Users'

const AddUser = () =>{

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [email, setEmail] = useState('');
    const [users, setUsers] = useState([])
    const navigate = useNavigate();


	const addUser = user => {
		setUsers(prev => [...prev, user])
	}

    const handleRegistration = (e) => {
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
        console.log("Пользователь добавлен!");
    };

    const handleLogin = (e) => {
        e.preventDefault();
        if (!email || !password) {
            alert("Заполните все поля");
            return;
        }
        
        addUser({ id: Date.now(), password, confirmPassword, email });
        setPassword('');
        setEmail('');

        navigate('/main');
    };

    return (
        <>
            <Form
                handleRegistration={handleRegistration}
                handleLogin={handleLogin}
                email={email}
                setEmail={(e) => setEmail(e.target.value)}
                password={password}
                setPassword={(e) => setPassword(e.target.value)}
                confirmPassword={confirmPassword}
                setConfirmPassword={(e) => setConfirmPassword(e.target.value)}
            />
            <Users
                users={users}
            />
        </>
        
    );
}

export default AddUser;
