import { useState, useEffect } from 'react';

const EditUser = (props) =>{

    const {
        user,
        editUser,
        onClose
    } = props

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [email, setEmail] = useState('');

    useEffect(() => {
        if (user) {
            setPassword(user.password);
            setConfirmPassword(user.confirmPassword);
            setEmail(user.email);
        }
    }, [user]);

    const handleEdit = (e) => {
        e.preventDefault();
        if (!email || !password || !confirmPassword) {
            alert("Заполните все поля");
            return;
        }

        if (password !== confirmPassword) {
            alert("Пароли не совпадают");
            return;
        }
        editUser({ id: user.id, password, confirmPassword, email }); 
        if (onClose) onClose();
    };

    return (
        <form onSubmit={handleEdit}>
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
            <button>Edit User</button>
        </form>
    );
}

export default EditUser;