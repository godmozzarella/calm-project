package com.calm.security;

import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;

import java.util.List;

/** Лёгкий принципал, который кладётся в SecurityContext после валидации JWT. */
public class AuthenticatedUser extends User {

	private final String userId;

	public AuthenticatedUser(String userId, String email) {
		super(email, "", List.of(new SimpleGrantedAuthority("ROLE_USER")));
		this.userId = userId;
	}

	public String getUserId() {
		return userId;
	}
}
