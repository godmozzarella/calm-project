import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import Form from '../FormAuthorization/FormAuthorization'

const PASS_RULES = [
        { regex: /.{8,}/, message: 'не менее 8 символов' },
        { regex: /[a-z]/, message: 'строчную букву' },
        { regex: /[A-Z]/, message: 'заглавную букву' },
        { regex: /\d/, message: 'цифру' },
        { regex: /[#_@$!%*?&]/, message: 'спецсимвол' },
    ];

const validate = (value) => {
    if (!value) return '';
    const error = PASS_RULES.find(rule => !rule.regex.test(value));
    return error ? `Пароль должен содержать ${error.message}` : '';
};

const AddUser = () =>{

    const [confirmPassword, setConfirmPassword] = useState('');
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [registerEmail, setRegisterEmail] = useState('');
    const [registerPassword, setRegisterPassword] = useState('');
    const [userName, setUserName] = useState('');
    const [users, setUsers] = useState(() => {
        const savedUsers = JSON.parse(localStorage.getItem('users')) || [];
        return savedUsers;
    })
    const [debouncedEmail, setDebouncedEmail] = useState('');
    const [emailError, setEmailError] = useState('');
    const [loginError, setLoginError] = useState('');
    const [registerError, setRegisterError] = useState('');


    const navigate = useNavigate();

	const addUser = user => {
		setUsers(prev => [...prev, user])
	}

    const loginUser = (email, password) => {
        const user = users.find(
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

        if (emailError) {
            alert('Введите корректный email');
            return;
        }

        if (registerError) {
            alert(registerError);
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

        if (loginError) {
            alert(loginError);
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

    const handleEmailChange = (e, type = 'register') => {
        const value = e.target.value;

        if (type === 'register') {
            setRegisterEmail(value);
        } else {
            setLoginEmail(value);
        }
    };
    
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedEmail(registerEmail);
        }, 1000);

        return () => clearTimeout(timer);
    }, [registerEmail]);

    useEffect(() => {
        if (!debouncedEmail) {
            setEmailError('');
            return;
        }

        const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(debouncedEmail);
        setEmailError(isValid ? '' : 'Некорректный email');
    }, [debouncedEmail]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setLoginError(validate(loginPassword));
        }, 1000);
        return () => clearTimeout(timer);
    }, [loginPassword]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setRegisterError(validate(registerPassword));
        }, 1000);
        return () => clearTimeout(timer);
    }, [registerPassword]);


    return (
        <>
            <Form
                handleRegistration={handleRegistration}
                handleLogin={handleLogin}
                loginEmail={loginEmail}
                loginPassword={loginPassword}
                registerEmail={registerEmail}
                registerPassword={registerPassword}
                confirmPassword={confirmPassword}
                setConfirmPassword={(e) => setConfirmPassword(e.target.value)}
                userName={userName}
                setUserName={(e) => setUserName(e.target.value)}
                emailError={emailError}
                handleEmailChange={handleEmailChange}
                loginError={loginError}
                registerError={registerError}
                setLoginPassword={(e) => setLoginPassword(e.target.value)}
                setRegisterPassword={(e) => setRegisterPassword(e.target.value)}
            />
        </>
        
    );
}

export default AddUser;
