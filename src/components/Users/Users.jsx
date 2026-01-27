import User from '../User/User'

const Users = props => {
	const { users, editUser, deleteUser } = props

	if (users.length === 0) {
		return (
			<div className="u-block">
				<p>No users available.</p>
			</div>
		)
	}
	return (
		<div className="u-block">
			<h2>User List</h2>
			<ul className="user-list">
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
