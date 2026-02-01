import { useState } from 'react';

import Form from '../RegAndLogForm/RegAndLogForm'

const AddUser = (props) =>{

    const {
        addUser
    } = props

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [email, setEmail] = useState('');


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
        <Form
            handleAdd={handleAdd}
            email={email}
            setEmail={(e) => setEmail(e.target.value)}
            password={password}
            setPassword={(e) => setPassword(e.target.value)}
            confirmPassword={confirmPassword}
            setConfirmPassword={(e) => setConfirmPassword(e.target.value)}
        />
    );
}

export default AddUser;
