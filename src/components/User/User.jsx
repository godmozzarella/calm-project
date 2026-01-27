import { useState } from 'react'
import { DeleteIcon, EditIcon } from '../../assets/icons'
import EditUser from '../EditUser/EditUser'

const User = props => {
	const { user, editUser, deleteUser } = props

	const [editForm, setEditForm] = useState(false)

	const handleDelete = e => {
		e.preventDefault()
		deleteUser(user.id)
	}

	console.log(user)
	return (
		<div>
			<div className="user">
				<div>
					<h3>{user.email}</h3>
					<p>{user.password}</p>
				</div>
				<span>
					<EditIcon
						className="icon"
						onClick={() => {
							setEditForm(!editForm)
						}}
					/>
					<DeleteIcon
						className="icon"
						onClick={handleDelete}
					/>
				</span>
			</div>
			{editForm && (
				<EditUser
					user={user}
					editUser={editUser}
					onClose={() => setEditForm(false)}
				/>
			)}
		</div>
	)
}

export default User
