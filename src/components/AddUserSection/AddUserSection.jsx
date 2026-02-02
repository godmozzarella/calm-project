import { useState } from 'react'

import AddUser from '../AddUser/AddUser'
import Users from '../Users/Users'

const AddUserSection = () => {
	const [users, setUsers] = useState([])

	const addUser = user => {
		setUsers(prev => [...prev, user])
	}

	const deleteUser = id => {
		setUsers(prev => prev.filter(user => user.id !== id))
	}

	const editUser = updatedUser => {
		setUsers(prevUsers =>
			prevUsers.map(user => (user.id === updatedUser.id ? updatedUser : user))
		)
	}

	return (
		<>
			<AddUser addUser={addUser} />
			<Users
				users={users}
				editUser={editUser}
				deleteUser={deleteUser}
			/>
		</>
	)
}

export default AddUserSection
