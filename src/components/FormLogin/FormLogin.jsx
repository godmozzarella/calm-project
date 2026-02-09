import Button from '../Button/Button'
import Input from '../Input/Input'



const FormLogin = (props) => {
    const { 
            onSubmit,
            email, 
			setEmail, 
			password, 
            setPassword } = props;

    return (
        <form onSubmit={onSubmit}>
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
                pattern="^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[#@$!%*?&])[A-Za-z\d#@$!%*?&]{8,}$"
            />  
            <Button
                colored
                children={
                    <>Войти</>
                }
            />
        </form>
    )
}

export default FormLogin