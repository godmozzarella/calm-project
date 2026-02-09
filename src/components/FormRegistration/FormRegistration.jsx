import Button from '../Button/Button'
import Input from '../Input/Input'

const FormRegistration = (props) => {
    const { 
            onSubmit,
            email, 
			setEmail, 
			password, 
			setPassword, 
			confirmPassword, 
			setConfirmPassword,
            userName,
            setUserName
         } = props;

    return (
        <form onSubmit={onSubmit}>
             <Input type="text" 
                    placeholder="Введите имя" 
                    value={userName} 
                    onChange={setUserName} />  
            <Input  type="email" 
                    placeholder="Электронная почта" 
                    value={email} 
                    onChange={setEmail}/> 
            <Input  type="password" 
                    placeholder="Пароль" 
                    value={password}
                    onChange={setPassword}
                    pattern="^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[#@$!%*?&])[A-Za-z\d#@$!%*?&]{8,}$"/>   
            <Input  type="password" 
                    placeholder="Повторите пароль" 
                    value={confirmPassword} 
                    onChange={setConfirmPassword} />  
            <Button
                    colored
                    children={
                    <>Зарегистрироваться</>
                }
            />
        </form>
    )
}

export default FormRegistration