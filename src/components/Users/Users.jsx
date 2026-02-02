import User from '../User/User'

import s from './Users.module.scss'

const Users = props => {
	const { users, editUser, deleteUser } = props

	if (users.length === 0) {
		return (
			<div className={s.block}>
				<p>No users available.</p>
			</div>
		)
	}
	return (
		<div className={s.block}>
			<h2>User List</h2>
			<ul className={s.list}>
				{users.map(user => (
					<li key={user.id}>
						<User
							user={user}
							deleteUser={deleteUser}
							editUser={editUser}
						/>
					</li>
				))}
			</ul>
		</div>
	)
}

export default Users
